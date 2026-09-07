import { Injectable } from '@nestjs/common';
import { LIMITS } from '@weekflow/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditAction, AuditEntityType } from './audit-actions';

export interface AuditEvent {
  /** Null only for controlled system/seed events, never an unknown browser actor. */
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  reportId?: string | null;
  reportVersionId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only business-event history (§14).
 *
 * `record` takes a transaction client on purpose. Every mutation writes its audit
 * entry **inside the same transaction** as the change it describes, so a rolled
 * back operation cannot leave a success event behind and a successful one cannot
 * go unrecorded.
 *
 * ReportVersion is the content history; audit metadata never carries report
 * content, passwords, tokens or cookies.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        reportId: event.reportId ?? null,
        reportVersionId: event.reportVersionId ?? null,
        metadata: this.boundMetadata(event.metadata),
      },
    });
  }

  /**
   * Metadata is small by contract. Oversized metadata is dropped rather than
   * truncated — a half-serialized object is worse than an honest marker, and the
   * event itself still records who did what to which entity.
   */
  private boundMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (!metadata || Object.keys(metadata).length === 0) return undefined;

    const serialized = JSON.stringify(metadata);
    if (Buffer.byteLength(serialized, 'utf8') > LIMITS.audit.metadataBytes) {
      return { omitted: 'metadata exceeded size limit' };
    }

    return metadata as Prisma.InputJsonValue;
  }
}
