import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * A Prisma client bound to TEST_DATABASE_URL.
 *
 * Integration tests talk to a real PostgreSQL instance on purpose: constraint
 * violations, trigger rejections and concurrent-write races cannot be proven
 * against a mock (§18).
 */
export function createTestPrismaClient(): PrismaClient {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is not set.');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Every table, ordered so the statement is self-contained. TRUNCATE ... CASCADE
 * is used rather than deletes because the immutability triggers deliberately
 * refuse to delete submitted content — and those are row-level triggers, which
 * TRUNCATE does not fire.
 */
const TABLES = [
  'AuditLog',
  'Review',
  'ReportLink',
  'TimeEntry',
  'Achievement',
  'Blocker',
  'NextWeekTask',
  'ReportTask',
  'ReportVersion',
  'Report',
  'ProjectMember',
  'ProjectActivityPeriod',
  'Project',
  'User',
] as const;

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * Asserts that a write is rejected by the database, and returns the message so a
 * test can pin *which* constraint fired. A test that only asserted "it threw"
 * would still pass if the row were rejected for an unrelated reason.
 */
export async function expectRejection(operation: () => Promise<unknown>): Promise<string> {
  try {
    await operation();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('Expected the database to reject this write, but it succeeded.');
}
