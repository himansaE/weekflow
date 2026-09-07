import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global: every feature module writes audit events (§14). */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
