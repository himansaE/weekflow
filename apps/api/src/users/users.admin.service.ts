import { Injectable } from '@nestjs/common';
import { ApiErrorCode, Role } from '@weekflow/shared';
import type { AdminSafeUser, ApiList, SafeUser } from '@weekflow/shared';
import { AuditAction, AuditEntityType } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/errors/api.exception';
import { acquireAdvisoryLock, LockName } from '../common/locks';
import { paginationMeta } from '../common/dto/pagination.dto';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import type { Prisma, User } from '../generated/prisma/client';
import type { UserListQueryDto } from './dto/users.dto';

/**
 * Manager-only account administration (§3.3, §15.3).
 *
 * Accounts are deactivated, never deleted, so historical reports and reviews keep
 * their author (§13.7).
 */
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserListQueryDto): Promise<ApiList<AdminSafeUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Counted with the same predicate as the rows, so the total can never
    // describe a different set from the page (§15.2).
    const [rows, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => UsersService.toAdminSafeUser(row)),
      meta: paginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async create(
    actor: SafeUser,
    input: { fullName: string; email: string; role: Role; password: string },
  ): Promise<AdminSafeUser> {
    // Outside the transaction: hashing is ~100ms of deliberate CPU work, and the
    // unique index — not a prior read — is what prevents a duplicate.
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            role: input.role,
            passwordHash,
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.USER_CREATED,
            entityType: AuditEntityType.USER,
            entityId: user.id,
            metadata: { role: user.role },
          },
          tx,
        );

        return UsersService.toAdminSafeUser(user);
      });
    } catch (error) {
      if (UsersAdminService.isUniqueViolation(error)) {
        throw ApiException.conflict(
          ApiErrorCode.DUPLICATE_RESOURCE,
          'An account with that email already exists.',
        );
      }
      throw error;
    }
  }

  async changeRole(actor: SafeUser, userId: string, role: Role, expectedRevision: number) {
    return this.prisma.$transaction(async (tx) => {
      // Serializes every command that can change the manager population, so two
      // concurrent demotions cannot each observe a safe count (§16.2).
      await acquireAdvisoryLock(tx, LockName.MANAGER_POPULATION);

      const user = await UsersAdminService.loadForUpdate(tx, userId, expectedRevision);
      if (user.role === role) {
        // Idempotent: the requested state already holds.
        return UsersService.toAdminSafeUser(user);
      }

      if (role === Role.TEAM_MEMBER) {
        this.assertNotSelf(actor, userId, 'You cannot change your own role.');
        await UsersAdminService.assertAnotherActiveManagerRemains(tx, userId);
      }

      const updated = await UsersAdminService.bumpRevision(tx, user, { role });

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_ROLE_CHANGED,
          entityType: AuditEntityType.USER,
          entityId: user.id,
          metadata: { oldRole: user.role, newRole: role },
        },
        tx,
      );

      return UsersService.toAdminSafeUser(updated);
    });
  }

  async setActive(actor: SafeUser, userId: string, isActive: boolean, expectedRevision: number) {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, LockName.MANAGER_POPULATION);

      const user = await UsersAdminService.loadForUpdate(tx, userId, expectedRevision);
      if (user.isActive === isActive) {
        return UsersService.toAdminSafeUser(user);
      }

      if (!isActive) {
        this.assertNotSelf(actor, userId, 'You cannot deactivate your own account.');
        if (user.role === Role.MANAGER) {
          await UsersAdminService.assertAnotherActiveManagerRemains(tx, userId);
        }
      }

      const updated = await UsersAdminService.bumpRevision(tx, user, { isActive });

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: isActive ? AuditAction.USER_REACTIVATED : AuditAction.USER_DEACTIVATED,
          entityType: AuditEntityType.USER,
          entityId: user.id,
          metadata: { isActive },
        },
        tx,
      );

      return UsersService.toAdminSafeUser(updated);
    });
  }

  /**
   * Locking self-service out of role and status changes removes a whole class of
   * accident — a manager cannot strand themselves, and cannot be tricked into
   * doing it by a forged request (§3.2).
   */
  private assertNotSelf(actor: SafeUser, userId: string, message: string): void {
    if (actor.id === userId) throw ApiException.forbidden(message);
  }

  /** Must be called while holding MANAGER_POPULATION. */
  private static async assertAnotherActiveManagerRemains(
    tx: Prisma.TransactionClient,
    excludingUserId: string,
  ): Promise<void> {
    const remaining = await tx.user.count({
      where: { role: Role.MANAGER, isActive: true, id: { not: excludingUserId } },
    });

    if (remaining === 0) {
      throw ApiException.conflict(
        ApiErrorCode.INVALID_TRANSITION,
        'This is the last active manager. Promote another manager first.',
      );
    }
  }

  private static async loadForUpdate(
    tx: Prisma.TransactionClient,
    userId: string,
    expectedRevision: number,
  ): Promise<User> {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiException.notFound('User not found.');

    if (user.revision !== expectedRevision) {
      throw ApiException.conflict(
        ApiErrorCode.STALE_REPORT,
        'This account changed since you loaded it. Reload and try again.',
      );
    }

    return user;
  }

  /**
   * Writes conditionally on the revision as well as the id. Even if two commands
   * somehow passed the read check, only the first `updateMany` matches — so the
   * token cannot be defeated by a race between the read and the write.
   */
  private static async bumpRevision(
    tx: Prisma.TransactionClient,
    user: User,
    data: Prisma.UserUpdateInput,
  ): Promise<User> {
    const result = await tx.user.updateMany({
      where: { id: user.id, revision: user.revision },
      data: { ...data, revision: { increment: 1 } },
    });

    if (result.count === 0) {
      throw ApiException.conflict(
        ApiErrorCode.STALE_REPORT,
        'This account changed since you loaded it. Reload and try again.',
      );
    }

    return tx.user.findUniqueOrThrow({ where: { id: user.id } });
  }

  private static isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
