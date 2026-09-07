import type { Prisma } from '../generated/prisma/client';

/**
 * Transaction-scoped advisory locks (§16.2).
 *
 * Some invariants span *rows that do not exist yet* — "at least one active
 * manager must remain" cannot be protected by locking a single row, because two
 * concurrent demotions each read a count of 2 and each conclude they are safe.
 * A named advisory lock serializes exactly those commands and nothing else.
 *
 * `pg_advisory_xact_lock` is released automatically when the transaction ends,
 * including on rollback, so a failed command can never strand the lock.
 */
export const LockName = {
  /** Guards the "never remove the last active manager" invariant (§3.2). */
  MANAGER_POPULATION: 'weekflow:manager_population',
} as const;
export type LockName = (typeof LockName)[keyof typeof LockName];

export async function acquireAdvisoryLock(
  tx: Prisma.TransactionClient,
  name: LockName,
): Promise<void> {
  // hashtext() maps the name to the bigint the lock API expects. The value only
  // needs to be stable and collision-free among our own lock names.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${name}))`;
}

/**
 * Lock ordering, applied wherever a command touches more than one parent (§16.2).
 *
 * Report first, then projects, then users, each group sorted by id. Two commands
 * that take the same locks in the same order cannot deadlock.
 */
export function sortedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}
