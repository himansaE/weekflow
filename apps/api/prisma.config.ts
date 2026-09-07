import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of schema.prisma: the CLI reads it here,
 * and the runtime client receives a driver adapter instead (see PrismaService).
 *
 * That split is useful for us — the integration suite points DATABASE_URL at
 * TEST_DATABASE_URL before the client is constructed (test/setup-integration.ts),
 * so there is exactly one place that decides which database is in use.
 *
 * `shadowDatabaseUrl` is set explicitly because `migrate dev` replays the whole
 * migration history into a throwaway database to compute a diff, and the local
 * server's auto-created shadow database collided with existing types. It must
 * never point at DATABASE_URL — Prisma refuses with P3025 if it does.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
