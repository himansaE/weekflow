import { z } from 'zod';
import { Role } from '../enums';
import { LIMITS } from '../validation-limits';

/**
 * Authentication contracts — specification §12, §15.3.
 *
 * The schemas here are the single source of truth: the web forms and the API DTOs
 * both derive from them, so a rule cannot be tightened on one side only.
 */

/**
 * The only shape of a user that ever crosses the wire. `passwordHash` is not a
 * field on this type by construction, so it cannot leak by forgetting to strip it
 * from a Prisma record (§12.5).
 */
export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

/** Administration views additionally need the concurrency token and timestamps (§15.3). */
export interface AdminSafeUser extends SafeUser {
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Email is compared case-insensitively and stored normalized, so `A@x.test` and
 * `a@x.test` are one identity (§12.2). The password is deliberately NOT trimmed —
 * leading or trailing spaces are part of what the user chose.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(LIMITS.user.email.max, `Email must be at most ${LIMITS.user.email.max} characters`)
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(LIMITS.user.password.min, `Password must be at least ${LIMITS.user.password.min} characters`)
  .max(LIMITS.user.password.max, `Password must be at most ${LIMITS.user.password.max} characters`);

export const fullNameSchema = z
  .string()
  .trim()
  .min(LIMITS.user.fullName.min, 'Full name is required')
  .max(
    LIMITS.user.fullName.max,
    `Full name must be at most ${LIMITS.user.fullName.max} characters`,
  );

export const loginSchema = z.object({
  email: emailSchema,
  // Login must not enforce the registration password policy: tightening the rule
  // later would otherwise lock out existing accounts before they can sign in.
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * DERIVED(§12.2 rate limiting): the specification requires rate limiting on auth
 * endpoints but names no numbers. These are per client address, per endpoint.
 */
export const AUTH_RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * One message for every authentication failure. Distinguishing "no such account"
 * from "wrong password" from "deactivated" would turn the login form into an
 * account-enumeration oracle (§12.2).
 */
export const GENERIC_AUTH_FAILURE = 'Email or password is incorrect.';
