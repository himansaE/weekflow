import { z } from 'zod';

/**
 * Startup environment contract — specification §19.2.
 *
 * Validation is fail-fast and deliberately strict about the security-relevant
 * combinations: a production deployment may not run with a non-Secure cookie, and
 * `SameSite=None` is meaningless (and browser-rejected) without `Secure`.
 */

const csvOrigins = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z
          .url('CORS_ORIGINS entries must be absolute origins')
          .refine((origin) => {
            const url = new URL(origin);
            // An origin is scheme + host + port. A path, query or trailing slash
            // means the allowlist entry can never match a real Origin header.
            return (
              url.pathname === '/' &&
              !url.search &&
              !url.hash &&
              !origin.endsWith('/')
            );
          }, 'CORS_ORIGINS entries must be bare origins with no path, query or trailing slash')
          .refine(
            (origin) => !origin.includes('*'),
            'CORS_ORIGINS must not contain wildcards',
          ),
      )
      .min(1, 'At least one allowed origin is required'),
  );

const isIanaTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'debug', 'verbose'])
      .default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().min(1).optional(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ISSUER: z.string().min(1).default('weekflow-api'),
    JWT_AUDIENCE: z.string().min(1).default('weekflow-web'),
    JWT_EXPIRES_IN: z.string().min(1).default('8h'),

    AUTH_COOKIE_NAME: z.string().min(1).default('weekflow_session'),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().min(1).optional(),

    CORS_ORIGINS: csvOrigins,

    APP_TIMEZONE: z
      .string()
      .min(1)
      .default('Asia/Colombo')
      .refine(isIanaTimeZone, 'APP_TIMEZONE must be a valid IANA time zone'),
    REPORT_DEADLINE_HOUR: z.coerce.number().int().min(0).max(23).default(9),
    REPORT_DEADLINE_MINUTE: z.coerce.number().int().min(0).max(59).default(0),

    SEED_DEMO: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SEED_DEMO_PASSWORD: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message:
          'COOKIE_SECURE must be true in production — the session cookie requires HTTPS',
      });
    }

    if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SAME_SITE'],
        message:
          'SameSite=None requires COOKIE_SECURE=true; browsers reject the cookie otherwise',
      });
    }

    if (env.NODE_ENV === 'production') {
      const insecureOrigin = env.CORS_ORIGINS.find((origin) =>
        origin.startsWith('http://'),
      );
      if (insecureOrigin) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: `Production origins must use https (found ${insecureOrigin})`,
        });
      }
    }

    if (env.SEED_DEMO && !env.SEED_DEMO_PASSWORD) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_DEMO_PASSWORD'],
        message: 'SEED_DEMO_PASSWORD is required when SEED_DEMO=true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    // Never echo the offending values — some of them are secrets.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
