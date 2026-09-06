import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of schema.prisma: the CLI reads it here,
 * and the runtime client receives a driver adapter instead (see PrismaService).
 *
 * That split is useful for us — the integration suite points DATABASE_URL at
 * TEST_DATABASE_URL before the client is constructed (test/setup-integration.ts),
 * so there is exactly one place that decides which database is in use.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
