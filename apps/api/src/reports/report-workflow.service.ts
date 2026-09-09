import { Injectable } from '@nestjs/common';
import { ApiErrorCode, ReportStatus, ReviewAction, submitContentSchema } from '@weekflow/shared';
import type { ReportContentInput, ReviewView, SafeUser } from '@weekflow/shared';
import { AuditAction, AuditEntityType } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/errors/api.exception';
import { EligibilityService } from '../projects/eligibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../common/transaction-options';
import { ReportContentService } from './report-content.service';
import type { Prisma, Report } from '../generated/prisma/client';

/**
 * The report workflow — submit, resubmit, approve and request changes (§7, §16).
 *
 * Two properties hold across every command here:
 *
 * 1. **A submitted version is history.** Corrections never edit it; they get a
 *    fresh version cloned from it. V1 remains byte-identical forever.
 * 2. **A transition is claimed with a conditional write, not a read-then-write.**
 *    `updateMany` filtered on the current status and revision is atomic: a second
 *    concurrent command blocks on the row lock, re-evaluates the predicate after
 *    the first commits, matches nothing, and is rejected. That is what makes two
 *    simultaneous manager reviews yield exactly one Review (§16.2).
 */
@Injectable()
export class ReportWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ReportContentService,
    private readonly eligibility: EligibilityService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Submit (from DRAFT) or resubmit (from NEEDS_CORRECTION).
   *
   * Both persist the supplied content, freeze the version and move the report to
   * SUBMITTED. They differ only in the state they start from and the audit event
   * they write.
   */
  async submit(
    actor: SafeUser,
    reportId: string,
    input: {
      expectedRevision: number;
      expectedVersionId: string;
      content: ReportContentInput;
    },
    options: { resubmit: boolean },
  ): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.userId !== actor.id) throw ApiException.notFound('Report not found.');

    const weekStart = report.weekStart.toISOString().slice(0, 10);
    const validated = ReportWorkflowService.assertSubmittable(input.content);
    await this.eligibility.assertProjectsEligible(
      actor.id,
      weekStart,
      ReportContentService.referencedProjectIds(validated),
    );

    const fromStatus = options.resubmit ? ReportStatus.NEEDS_CORRECTION : ReportStatus.DRAFT;

    await this.prisma.$transaction(async (tx) => {
      // One captured instant for the version, the report and the audit entry, so
      // they can never disagree about when this happened (§16.3).
      const now = new Date();

      // Claim the transition before touching anything else.
      const claimed = await tx.report.updateMany({
        where: { id: reportId, status: fromStatus, revision: input.expectedRevision },
        data: {
          status: ReportStatus.SUBMITTED,
          revision: { increment: 1 },
          // Set exactly once. A correction resubmitted after the deadline must
          // leave an originally on-time report on time (§4.2).
          ...(report.firstSubmittedAt === null ? { firstSubmittedAt: now } : {}),
        },
      });

      if (claimed.count === 0) {
        throw ReportWorkflowService.transitionRefused(fromStatus, options.resubmit);
      }

      const editable = await tx.reportVersion.findFirst({
        where: { reportId, submittedAt: null },
      });
      if (!editable || editable.id !== input.expectedVersionId) {
        throw ApiException.conflict(
          ApiErrorCode.STALE_REPORT,
          'This report changed since you loaded it. Reload and try again.',
        );
      }

      // Content must land while the version is still editable — the immutability
      // trigger refuses writes the moment submittedAt is set.
      await this.content.replace(tx, editable.id, validated);
      await tx.reportVersion.update({ where: { id: editable.id }, data: { submittedAt: now } });

      await tx.report.update({
        where: { id: reportId },
        data: { currentVersionId: editable.id, latestSubmittedVersionId: editable.id },
      });

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: options.resubmit ? AuditAction.REPORT_RESUBMITTED : AuditAction.REPORT_SUBMITTED,
          entityType: AuditEntityType.REPORT,
          entityId: reportId,
          reportId,
          reportVersionId: editable.id,
          metadata: { versionNumber: editable.versionNumber },
        },
        tx,
      );
    }, TRANSACTION_OPTIONS);
  }

  /**
   * Create-and-submit in one transaction (D115).
   *
   * A member who fills the form and presses Submit should not need an artificial
   * Save Draft first, and the two steps must not be separately observable.
   */
  async createAndSubmit(
    actor: SafeUser,
    reportId: string,
    versionId: string,
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<void> {
    await tx.reportVersion.update({ where: { id: versionId }, data: { submittedAt: now } });

    await tx.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.SUBMITTED,
        firstSubmittedAt: now,
        currentVersionId: versionId,
        latestSubmittedVersionId: versionId,
      },
    });

    await this.audit.record(
      {
        actorUserId: actor.id,
        action: AuditAction.REPORT_SUBMITTED,
        entityType: AuditEntityType.REPORT,
        entityId: reportId,
        reportId,
        reportVersionId: versionId,
        metadata: { versionNumber: 1 },
      },
      tx,
    );
  }

  /**
   * A manager review: approve, or request changes.
   *
   * Requesting changes is the only path that creates a version. It does four
   * things atomically — record the review, allocate the next version number,
   * deep-clone the submitted content into it, and repoint the report — because a
   * partial result would leave a report with no editable version, or a clone with
   * no review explaining it (§16.1).
   */
  async review(
    manager: SafeUser,
    reportId: string,
    input: {
      reportVersionId: string;
      expectedRevision: number;
      action: ReviewAction;
      comment?: string | null;
    },
  ): Promise<void> {
    if (
      input.action === ReviewAction.REQUEST_CHANGES &&
      (input.comment ?? '').trim().length === 0
    ) {
      // Also a CHECK constraint, but catching it here gives the manager a field
      // error instead of a constraint violation (§7.5).
      throw ApiException.validationFailed('Explain what needs to change.', [
        { path: 'comment', message: 'A comment is required when requesting changes.' },
      ]);
    }

    await this.prisma.$transaction(async (tx) => {
      const nextStatus =
        input.action === ReviewAction.APPROVE
          ? ReportStatus.APPROVED
          : ReportStatus.NEEDS_CORRECTION;

      /**
       * The concurrency gate.
       *
       * Two managers acting at once both reach here; the second blocks on the row
       * lock, re-evaluates `status: SUBMITTED` after the first commits, matches
       * zero rows and is refused. Pinning `latestSubmittedVersionId` as well means
       * a decision can never land on a version other than the one that was read.
       */
      const claimed = await tx.report.updateMany({
        where: {
          id: reportId,
          status: ReportStatus.SUBMITTED,
          revision: input.expectedRevision,
          latestSubmittedVersionId: input.reportVersionId,
        },
        data: { status: nextStatus, revision: { increment: 1 } },
      });

      if (claimed.count === 0) {
        await ReportWorkflowService.explainRefusedReview(tx, reportId, input.reportVersionId);
      }

      const report = await tx.report.findUniqueOrThrow({ where: { id: reportId } });

      // A manager must not review a report they own — possible only if they were
      // promoted after writing it (§3.2).
      if (report.userId === manager.id) {
        throw ApiException.forbidden('You cannot review your own report.');
      }

      const review = await tx.review.create({
        data: {
          reportId,
          reportVersionId: input.reportVersionId,
          reviewerId: manager.id,
          action: input.action,
          comment: input.comment?.trim() ? input.comment.trim() : null,
        },
      });

      if (input.action === ReviewAction.REQUEST_CHANGES) {
        const reviewed = await tx.reportVersion.findUniqueOrThrow({
          where: { id: input.reportVersionId },
        });

        // Allocated while the row lock is held, so a retry cannot skip a number
        // or create a second clone (§16.2).
        const clone = await tx.reportVersion.create({
          data: { reportId, versionNumber: reviewed.versionNumber + 1 },
        });

        await this.content.copyInto(tx, reviewed.id, clone.id);

        // The member now edits the clone; managers keep seeing the reviewed
        // version until it is resubmitted (§7.4).
        await tx.report.update({ where: { id: reportId }, data: { currentVersionId: clone.id } });

        await this.audit.record(
          {
            actorUserId: manager.id,
            action: AuditAction.REPORT_CHANGES_REQUESTED,
            entityType: AuditEntityType.REPORT,
            entityId: reportId,
            reportId,
            reportVersionId: reviewed.id,
            // The comment lives on the Review; audit links to it rather than
            // duplicating the text (§14).
            metadata: { reviewId: review.id, createdVersionNumber: clone.versionNumber },
          },
          tx,
        );
        return;
      }

      await this.audit.record(
        {
          actorUserId: manager.id,
          action: AuditAction.REPORT_APPROVED,
          entityType: AuditEntityType.REPORT,
          entityId: reportId,
          reportId,
          reportVersionId: input.reportVersionId,
          metadata: { reviewId: review.id },
        },
        tx,
      );
    }, TRANSACTION_OPTIONS);
  }

  async listReviews(reportId: string): Promise<ReviewView[]> {
    const reviews = await this.prisma.review.findMany({
      where: { reportId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { reviewer: true, reportVersion: true },
    });

    return reviews.map((review) => ({
      id: review.id,
      reportVersionId: review.reportVersionId,
      versionNumber: review.reportVersion.versionNumber,
      reviewer: { id: review.reviewer.id, fullName: review.reviewer.fullName },
      action: review.action,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    }));
  }

  /** Strict validation, mapped onto the §15.1 field-error shape. */
  static assertSubmittable(content: ReportContentInput): ReportContentInput {
    const result = submitContentSchema.safeParse(content);

    if (!result.success) {
      throw ApiException.validationFailed(
        'This report is not ready to submit yet.',
        result.error.issues.map((issue) => ({
          path: `content.${issue.path.join('.')}`,
          message: issue.message,
        })),
      );
    }

    return result.data;
  }

  private static transitionRefused(from: ReportStatus, resubmit: boolean): ApiException {
    return ApiException.conflict(
      ApiErrorCode.INVALID_TRANSITION,
      resubmit
        ? 'This report is not awaiting corrections.'
        : `This report cannot be submitted from its current state (expected ${from}).`,
    );
  }

  /**
   * Turns a refused claim into the reason the caller can act on.
   *
   * Always throws. Reading the row after losing the race is safe — the winning
   * transaction has committed by the time the lock is released.
   */
  private static async explainRefusedReview(
    tx: Prisma.TransactionClient,
    reportId: string,
    versionId: string,
  ): Promise<never> {
    const report: Report | null = await tx.report.findUnique({ where: { id: reportId } });
    if (!report) throw ApiException.notFound('Report not found.');

    const alreadyReviewed = await tx.review.findUnique({
      where: { reportVersionId: versionId },
    });

    if (alreadyReviewed) {
      throw ApiException.conflict(
        ApiErrorCode.REPORT_ALREADY_REVIEWED,
        'Another manager already reviewed this version.',
      );
    }

    if (report.status === ReportStatus.APPROVED) {
      throw ApiException.conflict(
        ApiErrorCode.INVALID_TRANSITION,
        'This report is approved and final.',
      );
    }

    if (report.status !== ReportStatus.SUBMITTED) {
      throw ApiException.conflict(
        ApiErrorCode.INVALID_TRANSITION,
        'This report is not awaiting review.',
      );
    }

    throw ApiException.conflict(
      ApiErrorCode.STALE_REPORT,
      'This report changed since you loaded it. Reload and try again.',
    );
  }
}
