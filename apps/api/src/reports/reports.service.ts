import { Injectable } from '@nestjs/common';
import { ApiErrorCode, ReportAction, ReportStatus } from '@weekflow/shared';
import type {
  ApiList,
  ReportContentInput,
  ReportListItem,
  ReportView,
  SafeUser,
  WeekStart,
  WeeklyReportContext,
} from '@weekflow/shared';
import { AuditAction, AuditEntityType } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { CalendarService } from '../calendar/calendar.service';
import { ApiException } from '../common/errors/api.exception';
import { paginationMeta } from '../common/dto/pagination.dto';
import { EligibilityService } from '../projects/eligibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportContentService } from './report-content.service';
import type { Prisma, Report, ReportVersion } from '../generated/prisma/client';

type ReportWithOwner = Report & { user: { id: string; fullName: string; email: string } };

/**
 * The weekly report aggregate (§7, §15.6).
 *
 * The rule that shapes this whole service: **opening the editor creates nothing**
 * (D114). A report row exists only after the member saves or submits, which is
 * what makes "Not Started" a real, distinguishable state rather than an empty
 * draft nobody asked for.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
    private readonly eligibility: EligibilityService,
    private readonly content: ReportContentService,
    private readonly audit: AuditService,
  ) {}

  /** Editor context for a week. Read-only — it must never persist anything. */
  async contextFor(
    actor: SafeUser,
    weekStart: WeekStart,
    asOf: Date = new Date(),
  ): Promise<{ data: WeeklyReportContext; context: { asOf: string; timezone: string } }> {
    this.assertWeekIsOpenForReporting(actor, weekStart, asOf);

    const report = await this.prisma.report.findUnique({
      where: { userId_weekStart: { userId: actor.id, weekStart: new Date(weekStart) } },
      include: { user: true },
    });

    const deadlineAt = report?.deadlineAt ?? this.calendar.deadlineFor(weekStart);
    const submissionState = this.calendar.submissionState({
      firstSubmittedAt: report?.firstSubmittedAt ?? null,
      deadlineAt,
      hasReport: report !== null,
      asOf,
    });

    const view = report ? await this.toReportView(report, actor, asOf) : null;

    return {
      data: {
        weekStart,
        weekEnd: this.calendar.weekEndDate(weekStart),
        deadlineAt: deadlineAt.toISOString(),
        timezone: this.calendar.config.timezone,
        submissionState,
        report: view,
        allowedActions: view?.allowedActions ?? [ReportAction.SAVE_DRAFT, ReportAction.SUBMIT],
      },
      context: { asOf: asOf.toISOString(), timezone: this.calendar.config.timezone },
    };
  }

  /**
   * First persistence: creates the Report, version 1, its content and the
   * pointers in one transaction (§16.1).
   *
   * The circular relationship between Report and ReportVersion is resolved
   * inside the transaction — insert the report with null pointers, insert V1,
   * then set them — so no successful response ever exposes a null current
   * version (§13.4).
   */
  async create(
    actor: SafeUser,
    input: { weekStart: WeekStart; content: ReportContentInput },
    asOf: Date = new Date(),
  ): Promise<ReportView> {
    this.assertWeekIsOpenForReporting(actor, input.weekStart, asOf);
    await this.eligibility.assertProjectsEligible(
      actor.id,
      input.weekStart,
      ReportContentService.referencedProjectIds(input.content),
    );

    const reportId = await this.prisma
      .$transaction(async (tx) => {
        const report = await tx.report.create({
          data: {
            userId: actor.id,
            weekStart: new Date(input.weekStart),
            reportingTimezone: this.calendar.config.timezone,
            // Frozen at creation so a later configuration change cannot move an
            // existing report's deadline (§4.4).
            deadlineAt: this.calendar.deadlineFor(input.weekStart),
            status: ReportStatus.DRAFT,
          },
        });

        const version = await tx.reportVersion.create({
          data: { reportId: report.id, versionNumber: 1 },
        });

        await this.content.replace(tx, version.id, input.content);

        await tx.report.update({
          where: { id: report.id },
          data: { currentVersionId: version.id },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.REPORT_CREATED,
            entityType: AuditEntityType.REPORT,
            entityId: report.id,
            reportId: report.id,
            reportVersionId: version.id,
            metadata: { weekStart: input.weekStart },
          },
          tx,
        );

        return report.id;
      })
      .catch((error: unknown) => {
        // The unique index on (userId, weekStart) is what actually prevents a
        // duplicate — two concurrent first saves both pass any prior read (§16.2).
        if (ReportsService.isUniqueViolation(error)) {
          throw ApiException.conflict(
            ApiErrorCode.REPORT_ALREADY_EXISTS,
            'You already have a report for this week.',
          );
        }
        throw error;
      });

    return this.findByIdForActor(reportId, actor, asOf);
  }

  /**
   * Saves the editable version in place.
   *
   * Both tokens are checked: `expectedRevision` catches a concurrent save from
   * another tab, and `expectedVersionId` catches the case that matters more — a
   * manager requested changes while this tab was open, so writing would target a
   * version that is now frozen (§16.2).
   */
  async saveDraft(
    actor: SafeUser,
    reportId: string,
    input: { expectedRevision: number; expectedVersionId: string; content: ReportContentInput },
    asOf: Date = new Date(),
  ): Promise<ReportView> {
    const report = await this.loadOwned(reportId, actor);

    await this.eligibility.assertProjectsEligible(
      actor.id,
      ReportsService.toWeekStart(report.weekStart),
      ReportContentService.referencedProjectIds(input.content),
    );

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.report.findUniqueOrThrow({ where: { id: reportId } });

      if (current.revision !== input.expectedRevision) {
        throw ReportsService.stale();
      }
      if (current.status === ReportStatus.APPROVED || current.status === ReportStatus.SUBMITTED) {
        throw ApiException.conflict(
          ApiErrorCode.INVALID_TRANSITION,
          'This report is not editable right now.',
        );
      }

      const editable = await ReportsService.editableVersion(tx, reportId);
      if (editable.id !== input.expectedVersionId) {
        throw ReportsService.stale();
      }

      await this.content.replace(tx, editable.id, input.content);

      const bumped = await tx.report.updateMany({
        where: { id: reportId, revision: current.revision },
        data: { revision: { increment: 1 } },
      });
      if (bumped.count === 0) throw ReportsService.stale();

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.REPORT_DRAFT_SAVED,
          entityType: AuditEntityType.REPORT,
          entityId: reportId,
          reportId,
          reportVersionId: editable.id,
          // Version and revision only — never content (§14).
          metadata: { versionId: editable.id, revision: current.revision + 1 },
        },
        tx,
      );
    });

    return this.findByIdForActor(reportId, actor, asOf);
  }

  async listOwn(
    actor: SafeUser,
    query: { page: number; pageSize: number },
    asOf: Date = new Date(),
  ): Promise<ApiList<ReportListItem>> {
    const where: Prisma.ReportWhereInput = { userId: actor.id };

    const [rows, totalItems] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: [{ weekStart: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          latestSubmittedVersion: {
            include: {
              tasks: { select: { project: { select: { id: true, name: true } } } },
              nextWeekTasks: { select: { project: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const projects = new Map<string, string>();
        for (const task of [
          ...(row.latestSubmittedVersion?.tasks ?? []),
          ...(row.latestSubmittedVersion?.nextWeekTasks ?? []),
        ]) {
          if (task.project) projects.set(task.project.id, task.project.name);
        }

        return {
          id: row.id,
          weekStart: ReportsService.toWeekStart(row.weekStart),
          weekEnd: this.calendar.weekEndDate(ReportsService.toWeekStart(row.weekStart)),
          deadlineAt: row.deadlineAt.toISOString(),
          status: row.status,
          submissionState: this.calendar.submissionState({
            firstSubmittedAt: row.firstSubmittedAt,
            deadlineAt: row.deadlineAt,
            hasReport: true,
            asOf,
          }),
          firstSubmittedAt: row.firstSubmittedAt?.toISOString() ?? null,
          latestSubmittedAt: row.latestSubmittedVersion?.submittedAt?.toISOString() ?? null,
          projects: [...projects].map(([id, name]) => ({ id, name })),
        };
      }),
      meta: paginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findByIdForActor(
    reportId: string,
    actor: SafeUser,
    asOf: Date = new Date(),
  ): Promise<ReportView> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { user: true },
    });

    // A report belonging to someone else is indistinguishable from one that does
    // not exist (§3.2). Manager visibility of submitted versions arrives in M6.
    if (!report || report.userId !== actor.id) {
      throw ApiException.notFound('Report not found.');
    }

    return this.toReportView(report, actor, asOf);
  }

  private async toReportView(
    report: ReportWithOwner,
    actor: SafeUser,
    asOf: Date,
  ): Promise<ReportView> {
    const weekStart = ReportsService.toWeekStart(report.weekStart);

    const displayVersionId = report.currentVersionId;
    if (!displayVersionId) {
      // Unreachable: the create transaction always sets the pointer (§13.4).
      throw new Error(`Report ${report.id} has no current version.`);
    }

    const version = await this.prisma.reportVersion.findUniqueOrThrow({
      where: { id: displayVersionId },
    });
    const content = await this.content.load(this.prisma, displayVersionId);

    const isOwner = report.userId === actor.id;
    const editable = version.submittedAt === null ? version.id : null;

    return {
      id: report.id,
      owner: {
        id: report.user.id,
        fullName: report.user.fullName,
        email: report.user.email,
      },
      weekStart,
      weekEnd: this.calendar.weekEndDate(weekStart),
      deadlineAt: report.deadlineAt.toISOString(),
      timezone: report.reportingTimezone,
      status: report.status,
      submissionState: this.calendar.submissionState({
        firstSubmittedAt: report.firstSubmittedAt,
        deadlineAt: report.deadlineAt,
        hasReport: true,
        asOf,
      }),
      firstSubmittedAt: report.firstSubmittedAt?.toISOString() ?? null,
      latestSubmittedAt: null,
      revision: report.revision,
      displayVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        submittedAt: version.submittedAt?.toISOString() ?? null,
        content,
      },
      editableVersionId: isOwner ? editable : null,
      allowedActions: ReportsService.allowedActions(report.status, isOwner),
    };
  }

  /**
   * What the actor may do next, computed server-side so the UI cannot offer an
   * action the API would refuse (§15.6). Submit/resubmit are wired in M6.
   */
  private static allowedActions(status: ReportStatus, isOwner: boolean): ReportAction[] {
    if (!isOwner) return [];

    switch (status) {
      case ReportStatus.DRAFT:
        return [ReportAction.SAVE_DRAFT, ReportAction.SUBMIT];
      case ReportStatus.NEEDS_CORRECTION:
        return [ReportAction.SAVE_DRAFT, ReportAction.RESUBMIT];
      // Submitted and approved content is read-only for everyone (§7.1).
      default:
        return [];
    }
  }

  private async loadOwned(reportId: string, actor: SafeUser): Promise<Report> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.userId !== actor.id) {
      throw ApiException.notFound('Report not found.');
    }
    return report;
  }

  private static async editableVersion(
    tx: Prisma.TransactionClient,
    reportId: string,
  ): Promise<ReportVersion> {
    const version = await tx.reportVersion.findFirst({
      where: { reportId, submittedAt: null },
    });

    if (!version) {
      throw ApiException.conflict(
        ApiErrorCode.INVALID_TRANSITION,
        'This report has no editable version.',
      );
    }

    return version;
  }

  /**
   * Which weeks a member may report on (§4.3 Derived).
   *
   * Past and current weeks are allowed — a missed week can be filled in later,
   * and its real timestamps make it correctly late. Future weeks are not: there
   * is nothing to report yet, and allowing it would let a member pre-submit.
   */
  private assertWeekIsOpenForReporting(actor: SafeUser, weekStart: WeekStart, asOf: Date): void {
    const current = this.calendar.currentWeekStart(asOf);
    if (weekStart > current) {
      throw ApiException.badRequest('You cannot create a report for a future week.', [
        { path: 'weekStart', message: 'This week has not started yet.' },
      ]);
    }
  }

  /** `weekStart` is a DATE column; only its calendar part is meaningful (§4.1). */
  private static toWeekStart(value: Date): WeekStart {
    return value.toISOString().slice(0, 10);
  }

  private static stale(): ApiException {
    return ApiException.conflict(
      ApiErrorCode.STALE_REPORT,
      'This report changed since you loaded it. Reload and try again.',
    );
  }

  private static isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
