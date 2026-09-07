import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MAX_REQUEST_BODY_BYTES } from '@weekflow/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { notFoundHandler } from './common/middleware/not-found.handler';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService<Env, true>);

  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  // The deployed topology puts Vercel's rewrite in front of this service, so the
  // client address arrives in X-Forwarded-For. Without this, per-IP rate limiting
  // would treat the whole internet as one edge address (plan: proxy topology).
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  // The report aggregate is the only large payload; anything past 1 MiB is a
  // defect or an attack, not a legitimate weekly report (§6.8). Nest's own body
  // parser API avoids importing express directly, which it does not own.
  app.useBodyParser('json', { limit: MAX_REQUEST_BODY_BYTES });
  app.useBodyParser('urlencoded', {
    limit: MAX_REQUEST_BODY_BYTES,
    extended: false,
  });

  // Credentialed CORS against an exact allowlist — never `*` with credentials (§12.4).
  // Still required for local dev (:3000 → :4000) and as the fallback if the
  // production rewrite proxy is ever removed.
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-WeekFlow-Request', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  // Routes are mounted by init(), so this fallback must be registered afterwards
  // to sit last in the Express stack. Without it an unmatched path returns
  // Express's HTML 404 page instead of the §15.1 error envelope.
  await app.init();
  app.use(notFoundHandler);

  await app.listen(port, '0.0.0.0');
  Logger.log(`WeekFlow API listening on port ${port} (${nodeEnv})`, 'Bootstrap');
}

void bootstrap();
