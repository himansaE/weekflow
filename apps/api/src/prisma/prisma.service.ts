import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 constructs the client with a driver adapter rather than reading a URL
 * from the schema. The connection string is resolved once, here, from the process
 * environment — which is what lets the integration suite redirect the whole
 * application to TEST_DATABASE_URL by setting DATABASE_URL before Nest boots
 * (test/setup-integration.ts).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set — the Prisma adapter cannot be created.');
    }

    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      // Deliberately non-fatal. A readiness probe only means something if the
      // process can start without the database: on a transient outage the
      // platform should see /health/ready return 503 and hold traffic back,
      // rather than watch the container crash-loop (§15.7, §19.3).
      this.logger.error(
        'Database unavailable at startup — /health/ready will report unavailable until it recovers',
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap liveness probe for `/health/ready` — never exposes connection details. */
  async isReachable(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        'Database readiness check failed',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
