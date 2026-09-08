import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { validateEnv } from './config/env.schema';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Fails fast with a field-by-field report before anything else boots (§19.2).
      validate: validateEnv,
    }),
    PrismaModule,
    CalendarModule,
    AuditModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    /**
     * Guard order matters and is the order listed here (§3.2).
     *
     * 1. CSRF/origin — must reject a forged cross-site request *before any write*,
     *    and before spending a database round trip on authentication.
     * 2. Rate limit — cheap, and must apply to failed logins, which never reach
     *    the auth guard.
     * 3. Authentication — resolves the actor by re-reading the user row.
     * 4. Roles — needs that actor to exist.
     */
    { provide: APP_GUARD, useClass: CsrfOriginGuard },
    // Registered as a provider and aliased, so the counters live in one instance
    // that the integration suite can resolve and reset between tests.
    RateLimitGuard,
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
