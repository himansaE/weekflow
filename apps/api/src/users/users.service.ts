import { Injectable } from '@nestjs/common';
import type { AdminSafeUser, SafeUser } from '@weekflow/shared';
import type { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Account queries (§11.3). Administration commands land in M4; what is here is
 * what authentication and the guards need.
 *
 * `toSafeUser` is the only way a user reaches the wire. Returning a raw Prisma
 * record would carry `passwordHash` with it, so no endpoint serializes one (§12.5).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by `JwtAuthGuard` on every authenticated request.
   *
   * The `isActive` filter is the mechanism behind the confirmed rule that a
   * deactivated user loses access immediately, even holding an unexpired token
   * (§3.2) — which is why this is a query and not a claim.
   */
  async findActiveById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findFirst({ where: { id, isActive: true } });
    return user ? UsersService.toSafeUser(user) : null;
  }

  /** Email is stored normalized, so the lookup is exact rather than case-insensitive. */
  findByEmail(email: string, tx?: Prisma.TransactionClient): Promise<User | null> {
    return (tx ?? this.prisma).user.findUnique({ where: { email } });
  }

  static toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  static toAdminSafeUser(user: User): AdminSafeUser {
    return {
      ...UsersService.toSafeUser(user),
      revision: user.revision,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
