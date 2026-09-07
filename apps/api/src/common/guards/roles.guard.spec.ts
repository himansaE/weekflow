import { Reflector } from '@nestjs/core';
import { Role } from '@weekflow/shared';
import type { SafeUser } from '@weekflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ApiException } from '../errors/api.exception';

/** RBAC — role gate decision logic (§3.2). */

const member: SafeUser = {
  id: 'u1',
  fullName: 'Nimal',
  email: 'nimal@weekflow.example.test',
  role: Role.TEAM_MEMBER,
  isActive: true,
};

const manager: SafeUser = { ...member, id: 'u2', role: Role.MANAGER };

function contextFor(user?: SafeUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: Role[] | undefined): RolesGuard {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated actor when no roles are required', () => {
    expect(guardRequiring(undefined).canActivate(contextFor(member))).toBe(true);
    expect(guardRequiring([]).canActivate(contextFor(member))).toBe(true);
  });

  it('allows an actor holding the required role', () => {
    expect(guardRequiring([Role.MANAGER]).canActivate(contextFor(manager))).toBe(true);
  });

  it('rejects a Team Member on a manager-only route with 403', () => {
    // 403, not 404: the route's existence is not a secret. Hiding a *resource*
    // whose existence would disclose another member's data is a separate,
    // service-level concern.
    const guard = guardRequiring([Role.MANAGER]);

    expect(() => guard.canActivate(contextFor(member))).toThrow(ApiException);
    try {
      guard.canActivate(contextFor(member));
    } catch (error) {
      expect((error as ApiException).getStatus()).toBe(403);
      expect((error as ApiException).code).toBe('FORBIDDEN');
    }
  });

  it('fails closed when a route is both public and role-restricted', () => {
    // A contradiction in decorators must not become an open door.
    const guard = guardRequiring([Role.MANAGER]);

    try {
      guard.canActivate(contextFor(undefined));
      fail('expected the guard to reject');
    } catch (error) {
      expect((error as ApiException).getStatus()).toBe(401);
    }
  });
});
