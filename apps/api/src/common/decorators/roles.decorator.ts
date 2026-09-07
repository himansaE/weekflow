import { SetMetadata } from '@nestjs/common';
import type { Role } from '@weekflow/shared';

export const ROLES_KEY = 'weekflow:roles';

/**
 * Restricts a route to the listed roles (§3.2).
 *
 * This is a coarse gate only. Whether *this* actor may touch *this* report stays
 * a service-level check — a manager passing `@Roles(MANAGER)` still must not read
 * a private draft.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
