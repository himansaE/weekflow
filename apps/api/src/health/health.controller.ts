import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * §15.7 — liveness and readiness. Both responses are deliberately minimal: no
 * version dump, no configuration, no connection strings.
 */
// Deployment probes run before and without a session (§15.7).
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<{ status: string }> {
    const databaseReady = await this.prisma.isReachable();

    if (!databaseReady) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'unavailable' };
    }

    return { status: 'ready' };
  }
}
