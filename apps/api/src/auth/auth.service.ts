import { Injectable } from '@nestjs/common';
import { ApiErrorCode, GENERIC_AUTH_FAILURE, Role } from '@weekflow/shared';
import type { SafeUser } from '@weekflow/shared';
import { AuditAction, AuditEntityType } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/errors/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface IssuedSession {
  user: SafeUser;
  token: string;
  /** Absolute expiry, taken from the signed token so the cookie cannot outlive it. */
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Public registration. Always creates a `TEAM_MEMBER` — the role is not an
   * input, so no request body can escalate it (§3.3). Manager-created accounts
   * with an explicit role arrive in M4.
   */
  async register(input: { fullName: string; email: string; password: string }): Promise<SafeUser> {
    // Hashing is deliberately outside the transaction: it takes ~100ms of CPU by
    // design, and holding a database transaction open for it would be wasteful
    // under load. The unique index is what actually prevents a duplicate.
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            passwordHash,
            role: Role.TEAM_MEMBER,
          },
        });

        await this.audit.record(
          {
            actorUserId: user.id,
            action: AuditAction.USER_REGISTERED,
            entityType: AuditEntityType.USER,
            entityId: user.id,
            metadata: { role: user.role },
          },
          tx,
        );

        return UsersService.toSafeUser(user);
      });
    } catch (error) {
      if (AuthService.isUniqueViolation(error)) {
        throw ApiException.conflict(
          ApiErrorCode.DUPLICATE_RESOURCE,
          'An account with that email already exists.',
        );
      }
      throw error;
    }
  }

  /**
   * Verifies credentials and issues a session.
   *
   * Every failure path — unknown email, wrong password, deactivated account —
   * returns the same message, so the endpoint cannot be used to enumerate
   * accounts (§12.2). A password verification still runs against a dummy hash
   * when the email is unknown, so the response time does not reveal it either.
   */
  async login(input: { email: string; password: string }): Promise<IssuedSession> {
    const user = await this.users.findByEmail(input.email);

    if (!user) {
      await this.passwords.verify(AuthService.DUMMY_HASH, input.password);
      throw ApiException.unauthenticated(GENERIC_AUTH_FAILURE);
    }

    const matches = await this.passwords.verify(user.passwordHash, input.password);
    if (!matches || !user.isActive) {
      throw ApiException.unauthenticated(GENERIC_AUTH_FAILURE);
    }

    return this.issueSession(UsersService.toSafeUser(user));
  }

  private issueSession(user: SafeUser): IssuedSession {
    const { token, expiresAt } = this.tokens.issue(user.id);
    return { user, token, expiresAt };
  }

  /**
   * A valid Argon2id hash of a value nobody knows, used to keep the unknown-email
   * path as slow as the real one.
   */
  private static readonly DUMMY_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZTEyMw$Zm9vYmFyYmF6cXV4Y29ycmVjdGhvcnNlYmF0dGVyeQ';

  private static isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
