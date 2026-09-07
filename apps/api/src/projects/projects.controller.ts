import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Patch, Query } from '@nestjs/common';
import { Role } from '@weekflow/shared';
import type {
  ApiList,
  EligibleProject,
  ProjectMembership,
  ProjectSummary,
  SafeUser,
} from '@weekflow/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CalendarService } from '../calendar/calendar.service';
import { EligibilityService } from './eligibility.service';
import { ProjectsService } from './projects.service';
import {
  AssignMemberDto,
  CreateProjectDto,
  EligibleProjectsQueryDto,
  ExpectedProjectRevisionDto,
  ProjectListQueryDto,
  ProjectMembersQueryDto,
  UpdateProjectDto,
} from './dto/projects.dto';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly eligibility: EligibilityService,
    private readonly calendar: CalendarService,
  ) {}

  /**
   * Declared BEFORE `:id` so Express does not match "eligible" as a project id
   * (§15.4). It is also the one route here open to Team Members — everything
   * else is manager-only.
   */
  @Get('eligible')
  eligible(
    @CurrentUser() actor: SafeUser,
    @Query() query: EligibleProjectsQueryDto,
  ): Promise<EligibleProject[]> {
    const weekStart = this.calendar.requireCanonicalWeek(query.weekStart);
    // Always the actor's own eligibility — there is no userId parameter to abuse.
    return this.eligibility.eligibleProjects(actor.id, weekStart);
  }

  @Roles(Role.MANAGER)
  @Get('assignable-members')
  assignableMembers(): Promise<{ id: string; fullName: string; email: string }[]> {
    return this.projects.assignableMembers();
  }

  @Roles(Role.MANAGER)
  @Get()
  list(@Query() query: ProjectListQueryDto): Promise<ApiList<ProjectSummary>> {
    return this.projects.list(query);
  }

  @Roles(Role.MANAGER)
  @Post()
  create(@CurrentUser() actor: SafeUser, @Body() dto: CreateProjectDto): Promise<ProjectSummary> {
    return this.projects.create(actor, { name: dto.name, description: dto.description });
  }

  @Roles(Role.MANAGER)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectSummary> {
    return this.projects.findById(id);
  }

  @Roles(Role.MANAGER)
  @Patch(':id')
  update(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectSummary> {
    return this.projects.update(actor, id, {
      name: dto.name,
      description: dto.description,
      expectedRevision: dto.expectedRevision,
    });
  }

  @Roles(Role.MANAGER)
  @Post(':id/archive')
  archive(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpectedProjectRevisionDto,
  ): Promise<ProjectSummary> {
    return this.projects.setActive(actor, id, false, dto.expectedRevision);
  }

  @Roles(Role.MANAGER)
  @Post(':id/reactivate')
  reactivate(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpectedProjectRevisionDto,
  ): Promise<ProjectSummary> {
    return this.projects.setActive(actor, id, true, dto.expectedRevision);
  }

  @Roles(Role.MANAGER)
  @Get(':id/members')
  members(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectMembersQueryDto,
  ): Promise<ApiList<ProjectMembership>> {
    return this.projects.listMembers(id, {
      includeHistory: query.includeHistory,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Roles(Role.MANAGER)
  @Post(':id/members')
  assign(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMemberDto,
  ): Promise<{ created: boolean; project: ProjectSummary }> {
    return this.projects.assignMember(actor, id, dto.userId, dto.expectedProjectRevision);
  }

  /**
   * A command, not a DELETE: the assignment row is closed rather than removed, so
   * the member's historical eligibility survives (§5.3).
   */
  @Roles(Role.MANAGER)
  @Post(':id/members/:userId/remove')
  removeMember(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ExpectedProjectRevisionDto,
  ): Promise<{ removed: boolean; project: ProjectSummary }> {
    return this.projects.removeMember(actor, id, userId, dto.expectedRevision);
  }
}
