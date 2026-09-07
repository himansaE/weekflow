import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Brings the integration database's schema up to date once per Jest run.
 *
 * Integration tests exist to prove database-level guarantees — CHECK constraints,
 * partial uniques, exclusion constraints, triggers — so they are worthless
 * against a stale schema. Running `migrate deploy` here means a constraint added
 * in a migration is exercised on the next test run without anyone remembering to
 * migrate by hand.
 */
export default function globalSetup(): void {
  const apiRoot = resolve(__dirname, '..');
  loadEnv({ path: resolve(apiRoot, '.env'), quiet: true });

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set — integration tests need a real database.');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL — the suite truncates it.');
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
    shell: true,
  });
}
