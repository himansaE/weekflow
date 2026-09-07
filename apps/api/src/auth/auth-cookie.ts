import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.schema';
import type { ConfigService } from '@nestjs/config';

/**
 * Session cookie handling (§12.3).
 *
 * The token is set only here and read only by `JwtAuthGuard`. It never appears in
 * a JSON response body, so JavaScript — including an injected script — cannot
 * read it.
 *
 * Under the deployed topology the browser talks only to the Vercel origin, so the
 * cookie is host-only (`Domain` unset), `Secure` and `SameSite=Lax`. Widening
 * `Domain` would hand the session to every sibling subdomain.
 */
function baseOptions(config: ConfigService<Env, true>): CookieOptions {
  const domain = config.get('COOKIE_DOMAIN', { infer: true });

  return {
    httpOnly: true,
    secure: config.get('COOKIE_SECURE', { infer: true }),
    sameSite: config.get('COOKIE_SAME_SITE', { infer: true }),
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

export function setSessionCookie(
  res: Response,
  config: ConfigService<Env, true>,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(config.get('AUTH_COOKIE_NAME', { infer: true }), token, {
    ...baseOptions(config),
    expires: expiresAt,
  });
}

/**
 * Clearing must use the same name, path and domain the cookie was set with —
 * otherwise the browser keeps the original and the user stays signed in.
 *
 * Note the honest limit (§12.2): this removes the browser's copy. A stateless JWT
 * that was copied elsewhere stays valid until it expires, unless the account is
 * deactivated — which the guard does check on every request.
 */
export function clearSessionCookie(res: Response, config: ConfigService<Env, true>): void {
  res.clearCookie(config.get('AUTH_COOKIE_NAME', { infer: true }), baseOptions(config));
}
