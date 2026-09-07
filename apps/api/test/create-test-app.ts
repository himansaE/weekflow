import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  /** Express handle for supertest. */
  server: unknown;
}

/**
 * Boots the real application — same modules, same global guards, same middleware
 * order — against TEST_DATABASE_URL.
 *
 * Building the app through `configureApp` rather than assembling a bespoke test
 * app is the point: the CSRF, authentication and role guards only mean something
 * in the order they actually ship in.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  await configureApp(app);

  return {
    app,
    prisma: app.get(PrismaService),
    server: app.getHttpServer(),
  };
}

/** The origin the test environment allowlists, used for the CSRF header pair. */
export const ALLOWED_ORIGIN = 'http://localhost:3000';
