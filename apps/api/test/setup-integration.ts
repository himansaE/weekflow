/**
 * Integration-test bootstrap.
 *
 * The suite talks to a REAL PostgreSQL database (spec §18) — constraint violations,
 * transaction rollbacks and concurrent-review races cannot be proven against mocks.
 * It refuses to run unless TEST_DATABASE_URL is set and distinct from DATABASE_URL,
 * so a careless run can never truncate the development database.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../.env.test'), quiet: true });
loadEnv({ path: resolve(__dirname, '../.env'), quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
const devUrl = process.env.DATABASE_URL;

if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Integration tests need a disposable PostgreSQL database.',
  );
}

if (devUrl && testUrl === devUrl) {
  throw new Error(
    'TEST_DATABASE_URL must not equal DATABASE_URL — the integration suite truncates its database.',
  );
}

// Everything downstream (PrismaService, Nest config) reads DATABASE_URL.
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
