import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../errors/api.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestWithUser } from '../decorators/current-user.decorator';
import type { Env } from '../../config/env.schema';
import { TokenService } from '../../auth/token.service';
import { UsersService } from '../../users/users.service';

/**
 * Authenticates every request. Registered globally, with `@Public()` as the only
 * way out, so the default is deny (§3.2).
 *
 * The token is only ever read from the HttpOnly cookie — never from an
 * `Authorization` header or a query parameter. Accepting a second source would
 * hand an XSS payload a way to authenticate with a token it obtained elsewhere,
 * and would bypass the Origin/custom-header CSRF baseline that assumes the cookie
 * is the sole credential (§12.4).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const cookieName = this.config.get('AUTH_COOKIE_NAME', { infer: true });
    const token: unknown = request.cookies?.[cookieName];

    if (typeof token !== 'string' || token.length === 0) {
      throw ApiException.unauthenticated();
    }

    const claims = this.tokens.verify(token);
    if (!claims) {
      throw ApiException.unauthenticated('Your session has expired. Sign in again.');
    }

    /**
     * The claims are NOT trusted for role or account status.
     *
     * This database read on every authenticated request is what makes the
     * confirmed rule in §3.2 true: a deactivated user loses access immediately,
     * even while holding an unexpired token. A role change likewise takes effect
     * on the next request rather than at the next login.
     */
    const user = await this.users.findActiveById(claims.sub);
    if (!user) {
      throw ApiException.unauthenticated('Your session is no longer valid.');
    }

    request.user = user;
    return true;
  }
}
