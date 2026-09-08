import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@weekflow/shared';
import type { ApiList, ReportListItem, ReportView, SafeUser } from '@weekflow/shared';
import { CalendarService } from '../calendar/calendar.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  parseDraftContent,
  ReportListQueryDto,
  SaveDraftDto,
  WeeklyReportQueryDto,
} from './dto/reports.dto';

/**
 * Weekly reports (§15.6). Team Member routes — manager visibility of submitted
 * reports arrives with the review workflow in M6.
 */
@Roles(Role.TEAM_MEMBER)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly calendar: CalendarService,
  ) {}

  /**
   * Editor context. A GET that creates nothing — `report: null` is how "Not
   * Started" is represented (D114).
   */
  @Get('current')
  current(@CurrentUser() actor: SafeUser, @Query() query: WeeklyReportQueryDto) {
    const weekStart = query.weekStart
      ? this.calendar.requireCanonicalWeek(query.weekStart)
      : this.calendar.currentWeekStart();

    return this.reports.contextFor(actor, weekStart);
  }

  @Get('mine')
  listMine(
    @CurrentUser() actor: SafeUser,
    @Query() query: ReportListQueryDto,
  ): Promise<ApiList<ReportListItem>> {
    return this.reports.listOwn(actor, query);
  }

  @Post()
  create(@CurrentUser() actor: SafeUser, @Body() dto: CreateReportDto): Promise<ReportView> {
    const weekStart = this.calendar.requireCanonicalWeek(dto.weekStart);
    return this.reports.create(actor, { weekStart, content: parseDraftContent(dto.content) });
  }

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

  @Get(':id')
  findOne(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportView> {
    return this.reports.findByIdForActor(id, actor);
  }
}
