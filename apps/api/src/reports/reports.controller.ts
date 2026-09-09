import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@weekflow/shared';
import type {
  ApiList,
  ReportListItem,
  ReportVersionSummary,
  ReportVersionView,
  ReportView,
  ReviewView,
  SafeUser,
} from '@weekflow/shared';
import { CalendarService } from '../calendar/calendar.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportWorkflowService } from './report-workflow.service';
import {
  CreateReportDto,
  parseDraftContent,
  ReportListQueryDto,
  ReviewDto,
  SaveDraftDto,
  SubmitReportDto,
  WeeklyReportQueryDto,
} from './dto/reports.dto';

/**
 * Weekly reports (§15.6).
 *
 * Role restrictions are per route, not per controller: reads are shared between
 * the owner and a manager (with different visibility resolved in the service),
 * writes belong to the owner, and review belongs to a manager.
 */
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly workflow: ReportWorkflowService,
    private readonly calendar: CalendarService,
  ) {}

  /**
   * Editor context. A GET that creates nothing — `report: null` is how "Not
   * Started" is represented (D114).
   */
  @Roles(Role.TEAM_MEMBER)
  @Get('current')
  current(@CurrentUser() actor: SafeUser, @Query() query: WeeklyReportQueryDto) {
    const weekStart = query.weekStart
      ? this.calendar.requireCanonicalWeek(query.weekStart)
      : this.calendar.currentWeekStart();

    return this.reports.contextFor(actor, weekStart);
  }

  @Roles(Role.TEAM_MEMBER)
  @Get('mine')
  listMine(
    @CurrentUser() actor: SafeUser,
    @Query() query: ReportListQueryDto,
  ): Promise<ApiList<ReportListItem>> {
    return this.reports.listOwn(actor, query);
  }

  @Roles(Role.TEAM_MEMBER)
  @Post()
  create(@CurrentUser() actor: SafeUser, @Body() dto: CreateReportDto): Promise<ReportView> {
    const weekStart = this.calendar.requireCanonicalWeek(dto.weekStart);

    return this.reports.create(actor, {
      weekStart,
      content: parseDraftContent(dto.content),
      submit: dto.submit ?? false,
    });
  }

  @Roles(Role.TEAM_MEMBER)
  @Patch(':id/draft')
  saveDraft(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDraftDto,
  ): Promise<ReportView> {
    return this.reports.saveDraft(actor, id, {
      expectedRevision: dto.expectedRevision,
      expectedVersionId: dto.expectedVersionId,
      content: parseDraftContent(dto.content),
    });
  }

  /** Freezes the editable version and moves the report to SUBMITTED (§7.1). */
  @Roles(Role.TEAM_MEMBER)
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitReportDto,
  ): Promise<ReportView> {
    await this.workflow.submit(
      actor,
      id,
      {
        expectedRevision: dto.expectedRevision,
        expectedVersionId: dto.expectedVersionId,
        content: parseDraftContent(dto.content),
      },
      { resubmit: false },
    );

    return this.reports.findByIdForActor(id, actor);
  }

  /**
   * The same transition from NEEDS_CORRECTION. `firstSubmittedAt` is untouched,
   * so a correction sent after the deadline leaves an originally on-time report
   * on time (§4.2).
   */
  @Roles(Role.TEAM_MEMBER)
  @Post(':id/resubmit')
  @HttpCode(HttpStatus.OK)
  async resubmit(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitReportDto,
  ): Promise<ReportView> {
    await this.workflow.submit(
      actor,
      id,
      {
        expectedRevision: dto.expectedRevision,
        expectedVersionId: dto.expectedVersionId,
        content: parseDraftContent(dto.content),
      },
      { resubmit: true },
    );

    return this.reports.findByIdForActor(id, actor);
  }

  /**
   * Manager review. Requesting changes preserves the reviewed version and creates
   * an editable clone in the same transaction (§7.3).
   */
  @Roles(Role.MANAGER)
  @Post(':id/reviews')
  async review(
    @CurrentUser() manager: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDto,
  ): Promise<ReportView> {
    await this.workflow.review(manager, id, {
      reportVersionId: dto.reportVersionId,
      expectedRevision: dto.expectedRevision,
      action: dto.action,
      comment: dto.comment ?? null,
    });

    return this.reports.findByIdForActor(id, manager);
  }

  /** Owner or manager, with different visibility resolved in the service (§7.4). */
  @Get(':id')
  findOne(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportView> {
    return this.reports.findByIdForActor(id, actor);
  }

  @Get(':id/versions')
  listVersions(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportVersionSummary[]> {
    return this.reports.listVersions(id, actor);
  }

  @Get(':id/versions/:versionId')
  getVersion(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<ReportVersionView> {
    return this.reports.getVersion(id, versionId, actor);
  }

  /** The review timeline, visible to the owner and to managers (§25 of the scope). */
  @Get(':id/reviews')
  async listReviews(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReviewView[]> {
    // Reuses the same visibility gate as the report itself.
    await this.reports.findByIdForActor(id, actor);
    return this.workflow.listReviews(id);
  }
}
