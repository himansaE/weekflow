import { Injectable } from '@nestjs/common';
import { ApiErrorCode, ReportAction, ReportStatus, Role } from '@weekflow/shared';
import type {
  ApiList,
  ReportContentInput,
  ReportListItem,
  ReportVersionSummary,
  ReportVersionView,
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
import { TRANSACTION_OPTIONS } from '../common/transaction-options';
import { EligibilityService } from '../projects/eligibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportContentService } from './report-content.service';
import { ReportWorkflowService } from './report-workflow.service';
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
    private readonly workflow: ReportWorkflowService,
    private readonly audit: AuditService,
  ) {}

  /** Editor context for a week. Read-only — it must never persist anything. */
  async contextFor(
    actor: SafeUser,
    weekStart: WeekStart,
    asOf: Date = new Date(),
  ): Promise<{ data: WeeklyReportContext; context: { asOf: string; timezone: string } }> {
    this.assertWeekIsOpenForReporting(weekStart, asOf);

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
   * With `submit: true` the same transaction also freezes the version and
   * records the submission, so a member who fills the form and presses Submit
   * never needs an artificial Save Draft first, and the two steps are not
   * separately observable (D115).
   */
  async create(
    actor: SafeUser,
    input: { weekStart: WeekStart; content: ReportContentInput; submit: boolean },
    asOf: Date = new Date(),
  ): Promise<ReportView> {
    this.assertWeekIsOpenForReporting(input.weekStart, asOf);

    const content = input.submit
      ? ReportWorkflowService.assertSubmittable(input.content)
      : input.content;

    await this.eligibility.assertProjectsEligible(
      actor.id,
      input.weekStart,
      ReportContentService.referencedProjectIds(content),
    );

    const reportId = await this.prisma
      .$transaction(async (tx) => {
        const now = new Date();

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

        // The version was created a statement ago, so it owns no rows.
        await this.content.replace(tx, version.id, content, { fresh: true });

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
            metadata: { weekStart: input.weekStart, submitted: input.submit },
          },
          tx,
        );

        if (input.submit) {
          await this.workflow.createAndSubmit(actor, report.id, version.id, tx, now);
        }

        return report.id;
      }, TRANSACTION_OPTIONS)
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
    }, TRANSACTION_OPTIONS);

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

    if (!report) throw ApiException.notFound('Report not found.');
    this.assertVisible(report, actor);

    return this.toReportView(report, actor, asOf);
  }

  /**
   * Version list.
   *
   * A manager never sees the unfinished correction draft: until the member
   * resubmits, the only versions that exist for them are the submitted ones
   * (§7.4).
   */
  async listVersions(reportId: string, actor: SafeUser): Promise<ReportVersionSummary[]> {
    const report = await this.prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    this.assertVisible(report, actor);

    const isOwner = report.userId === actor.id;

    const versions = await this.prisma.reportVersion.findMany({
      where: { reportId, ...(isOwner ? {} : { submittedAt: { not: null } }) },
      orderBy: { versionNumber: 'asc' },
    });

    return versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      submittedAt: version.submittedAt?.toISOString() ?? null,
    }));
  }

  async getVersion(
    reportId: string,
    versionId: string,
    actor: SafeUser,
  ): Promise<ReportVersionView> {
    const report = await this.prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    this.assertVisible(report, actor);

    const version = await this.prisma.reportVersion.findUnique({ where: { id: versionId } });
    // Same-report check: a version id from another report must not be readable
    // through this route (§15.6).
    if (!version || version.reportId !== reportId) {
      throw ApiException.notFound('Version not found.');
    }

    const isOwner = report.userId === actor.id;
    if (!isOwner && version.submittedAt === null) {
      throw ApiException.notFound('Version not found.');
    }

    return {
      id: version.id,
      versionNumber: version.versionNumber,
      submittedAt: version.submittedAt?.toISOString() ?? null,
      content: await this.content.load(this.prisma, version.id),
    };
  }

  /**
   * Visibility (§7.4).
   *
   * An owner always sees their own report. A manager sees it only once something
   * has been submitted — an initial draft is private, so it is a 404 rather than
   * a 403: even its existence is the member's business.
   */
  private assertVisible(report: Report, actor: SafeUser): void {
    if (report.userId === actor.id) return;

    if (actor.role === Role.MANAGER && report.latestSubmittedVersionId !== null) return;

    throw ApiException.notFound('Report not found.');
  }

  private async toReportView(
    report: ReportWithOwner,
    actor: SafeUser,
    asOf: Date,
  ): Promise<ReportView> {
    const weekStart = ReportsService.toWeekStart(report.weekStart);
    const isOwner = report.userId === actor.id;

    // The owner sees the version they are working on; a manager sees the latest
    // submitted one, so a correction in progress stays private (§7.4).
    const displayVersionId = isOwner ? report.currentVersionId : report.latestSubmittedVersionId;
    if (!displayVersionId) {
      // Unreachable: the create transaction always sets currentVersionId, and a
      // manager without latestSubmittedVersionId was already refused (§13.4).
      throw new Error(`Report ${report.id} has no visible version.`);
    }

    const version = await this.prisma.reportVersion.findUniqueOrThrow({
      where: { id: displayVersionId },
    });
    const content = await this.content.load(this.prisma, displayVersionId);

    const latestSubmitted = report.latestSubmittedVersionId
      ? await this.prisma.reportVersion.findUnique({
          where: { id: report.latestSubmittedVersionId },
        })
      : null;

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
      latestSubmittedAt: latestSubmitted?.submittedAt?.toISOString() ?? null,
      revision: report.revision,
      displayVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        submittedAt: version.submittedAt?.toISOString() ?? null,
        content,
      },
      editableVersionId: isOwner && version.submittedAt === null ? version.id : null,
      allowedActions: ReportsService.allowedActions(report.status, isOwner, actor.role),
    };
  }

  /**
   * What the actor may do next, computed server-side so the UI cannot offer an
   * action the API would refuse (§15.6).
   */
  private static allowedActions(
    status: ReportStatus,
    isOwner: boolean,
    role: SafeUser['role'],
  ): ReportAction[] {
    if (isOwner) {
      switch (status) {
        case ReportStatus.DRAFT:
          return [ReportAction.SAVE_DRAFT, ReportAction.SUBMIT];
        case ReportStatus.NEEDS_CORRECTION:
          return [ReportAction.SAVE_DRAFT, ReportAction.RESUBMIT];
        // Submitted and approved content is read-only for its owner too (§7.1).
        default:
          return [];
      }
    }

    // A manager can act only on a report awaiting review. Approved is terminal —
    // there is no reopen path anywhere in the product (§7.1).
    if (role === Role.MANAGER && status === ReportStatus.SUBMITTED) {
      return [ReportAction.APPROVE, ReportAction.REQUEST_CHANGES];
    }

    return [];
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
  private assertWeekIsOpenForReporting(weekStart: WeekStart, asOf: Date): void {
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
