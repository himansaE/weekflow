import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { LIMITS } from '@weekflow/shared';

/**
 * Request DTOs (§15.3).
 *
 * The global ValidationPipe runs with `whitelist` and `forbidNonWhitelisted`, so
 * any field not declared here is rejected rather than silently ignored — a
 * request cannot smuggle `role` or `isActive` into registration (§12.5).
 *
 * Bounds come from `packages/shared`, the same constants the web form validates
 * against, so the two cannot drift.
 */

/** Email is normalized before validation so `A@x.test` and `a@x.test` are one identity. */
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(LIMITS.user.email.max)
  email!: string;

  // Deliberately only "non-empty": applying the registration policy here would
  // lock out existing accounts if the policy were ever tightened.
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(LIMITS.user.fullName.min, LIMITS.user.fullName.max, {
    message: `Full name must be between ${LIMITS.user.fullName.min} and ${LIMITS.user.fullName.max} characters`,
  })
  fullName!: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(LIMITS.user.email.max)
  email!: string;

  // Never trimmed — spaces are part of the chosen password.
  @IsString()
  @Length(LIMITS.user.password.min, LIMITS.user.password.max, {
    message: `Password must be between ${LIMITS.user.password.min} and ${LIMITS.user.password.max} characters`,
  })
  password!: string;

  @IsString()
  passwordConfirmation!: string;
}
