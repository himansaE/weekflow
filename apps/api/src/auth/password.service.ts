import { Injectable, Logger } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import type { HashOptions } from 'argon2';

/**
 * Password hashing (§12.2).
 *
 * Argon2id with explicit, recorded parameters. The library generates a fresh
 * random salt per password and embeds it — together with these parameters — in
 * the PHC string it returns, so raising the cost later still verifies old hashes.
 *
 * These are argon2's own defaults, stated explicitly rather than inherited: a
 * library default that shifts between versions would silently change the cost of
 * every new password.
 */
const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  /** The plaintext is never logged, trimmed or truncated — spaces are part of it. */
  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /**
   * Constant-time comparison, delegated to the library.
   *
   * A malformed or legacy hash makes argon2 throw; that is treated as "does not
   * match" rather than propagated, so a corrupt row cannot turn into a 500 that
   * tells an attacker the account exists.
   */
  async verify(digest: string, password: string): Promise<boolean> {
    try {
      return await verify(digest, password);
    } catch (error) {
      this.logger.warn(
        `Password verification failed to run: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return false;
    }
  }
}
