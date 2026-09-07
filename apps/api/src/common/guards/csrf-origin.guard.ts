import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiErrorCode, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@weekflow/shared';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception';
import type { Env } from '../../config/env.schema';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The CSRF baseline (§12.4): an allowlisted `Origin`, a JSON content type, and a
 * mandatory custom header on every state-changing request — instead of a
 * separate CSRF-token subsystem.
 *
 * Why this works: a cross-site attacker can make the browser send a form POST,
 * but cannot set a custom header without a CORS preflight, and the preflight is
 * refused because their origin is not on the allowlist. Requiring
 * `Content-Type: application/json` closes the same hole from the other side —
 * that content type alone already forces a preflight.
 *
 * What it depends on, and therefore what must never change without revisiting it:
 * every unsafe endpoint is covered (this guard is global), and no endpoint accepts
 * a form-encoded body. It does not defend against same-origin XSS.
 *
 * Login, register and logout are included deliberately: login CSRF (forcing a
 * victim into the attacker's session) is a real attack, and §12.4 names them.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  private readonly allowedOrigins: readonly string[];

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigins = config.get('CORS_ORIGINS', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // GET/HEAD never change state, and OPTIONS is the preflight itself.
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;

    // A missing or literal "null" Origin is rejected rather than trusted. Browsers
    // send Origin on cross-origin requests and on same-origin non-GET requests;
    // "null" is what sandboxed iframes and some redirects present.
    if (typeof origin !== 'string' || origin === 'null' || !this.allowedOrigins.includes(origin)) {
      throw new ApiException(
        ApiErrorCode.ORIGIN_NOT_ALLOWED,
        HttpStatus.FORBIDDEN,
        'Request origin is not allowed.',
      );
    }

    const custom = request.headers[CSRF_HEADER_NAME];
    if ((Array.isArray(custom) ? custom[0] : custom) !== CSRF_HEADER_VALUE) {
      throw new ApiException(
        ApiErrorCode.REQUEST_HEADER_REQUIRED,
        HttpStatus.FORBIDDEN,
        'Request is missing a required header.',
      );
    }

    // Only enforced when a body is actually present, so a bodyless POST command
    // is not rejected for lacking a content type.
    const hasBody =
      request.headers['content-length'] !== undefined ||
      request.headers['transfer-encoding'] !== undefined;
    if (hasBody && Number(request.headers['content-length'] ?? 1) > 0) {
      const contentType = request.headers['content-type'] ?? '';
      if (!contentType.toLowerCase().startsWith('application/json')) {
        throw new ApiException(
          ApiErrorCode.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
          'Request body must be application/json.',
        );
      }
    }

    return true;
  }
}
