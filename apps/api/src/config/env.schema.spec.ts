import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/weekflow?schema=public',
  JWT_SECRET: 'a'.repeat(48),
  CORS_ORIGINS: 'http://localhost:3000',
};

describe('validateEnv (§19.2)', () => {
  it('accepts a minimal development environment and applies documented defaults', () => {
    const env = validateEnv({ ...base });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.APP_TIMEZONE).toBe('Asia/Colombo');
    expect(env.REPORT_DEADLINE_HOUR).toBe(9);
    expect(env.REPORT_DEADLINE_MINUTE).toBe(0);
    expect(env.AUTH_COOKIE_NAME).toBe('weekflow_session');
    expect(env.COOKIE_SAME_SITE).toBe('lax');
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects an unknown time zone', () => {
    expect(() =>
      validateEnv({ ...base, APP_TIMEZONE: 'Mars/Olympus' }),
    ).toThrow(/APP_TIMEZONE/);
  });

  it('refuses to start production with a non-Secure cookie', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false',
        CORS_ORIGINS: 'https://weekflow.vercel.app',
      }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('refuses SameSite=None without Secure — browsers would drop the cookie', () => {
    expect(() =>
      validateEnv({
        ...base,
        COOKIE_SAME_SITE: 'none',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/SameSite=None/);
  });

  it('refuses an http origin in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        CORS_ORIGINS: 'https://weekflow.vercel.app,http://sneaky.example',
      }),
    ).toThrow(/https/);
  });

  it.each([
    ['a trailing slash', 'http://localhost:3000/'],
    ['a path', 'http://localhost:3000/api'],
    ['a wildcard', 'https://*.vercel.app'],
  ])(
    'rejects a CORS origin with %s — it can never match an Origin header',
    (_label, origin) => {
      expect(() => validateEnv({ ...base, CORS_ORIGINS: origin })).toThrow(
        /CORS_ORIGINS/,
      );
    },
  );

  it('parses a comma-separated origin allowlist', () => {
    const env = validateEnv({
      ...base,
      CORS_ORIGINS: 'http://localhost:3000, http://127.0.0.1:3000',
    });

    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('requires a demo password when the seed guard is enabled (§17.5)', () => {
    expect(() => validateEnv({ ...base, SEED_DEMO: 'true' })).toThrow(
      /SEED_DEMO_PASSWORD/,
    );
  });

  it('never echoes a rejected secret value in the error message', () => {
    // Too short to pass, but the failure report must still not print it: the same
    // message reaches logs and terminals.
    const secret = 'leaked-secret-42';

    let message = '';
    try {
      validateEnv({
        ...base,
        JWT_SECRET: secret,
        DATABASE_URL: `postgres://u:${secret}@h/db`,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/JWT_SECRET/);
    expect(message).not.toContain(secret);
  });
});
