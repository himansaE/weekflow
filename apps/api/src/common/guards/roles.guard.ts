import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@weekflow/shared';
import { ApiException } from '../errors/api.exception';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestWithUser } from '../decorators/current-user.decorator';

/**
 * Enforces `@Roles(...)` (§3.2).
 *
 * A known manager-only route called by a Team Member returns 403 — the route's
 * existence is not a secret. Hiding a *resource* whose existence would disclose
 * another member's data is a separate concern, handled with 404 at the service
 * level.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Reached only if a route is both @Public() and @Roles(...) — a contradiction
    // that should fail closed rather than silently allow.
    if (!user) throw ApiException.unauthenticated();

    if (!required.includes(user.role)) {
      throw ApiException.forbidden('This action is restricted to managers.');
    }

    return true;
  }
}
