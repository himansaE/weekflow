import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { SafeUser } from '@weekflow/shared';
import type { Request } from 'express';

/** Set by `JwtAuthGuard` after it re-reads the user row for this request. */
export interface RequestWithUser extends Request {
  user?: SafeUser;
}

/**
 * The authenticated actor, resolved from the validated session.
 *
 * Write endpoints take the owner from here and never from the request body — an
 * input `userId` would let a member write as somebody else (§3.2).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SafeUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      // Unreachable through the global guard; a loud failure beats handing a
      // service `undefined` and having it fall back to some other identity.
      throw new Error('CurrentUser used on a route that is not authenticated.');
    }

    return request.user;
  },
);
