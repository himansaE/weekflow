import { Injectable } from '@nestjs/common';
import { ApiErrorCode, Role } from '@weekflow/shared';
import type { ApiList, ProjectMembership, ProjectSummary, SafeUser } from '@weekflow/shared';
import { AuditAction, AuditEntityType } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/errors/api.exception';
import { paginationMeta } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma, Project } from '../generated/prisma/client';
import type { ProjectListQueryDto } from './dto/projects.dto';

/**
 * Project administration (§5.3, §15.4).
 *
 * The whole module is built around one idea: **nothing is deleted**. Archiving
 * closes the open activity period, reactivating opens a new one, and removing a
 * member closes their assignment. Historical weeks stay reportable because the
 * periods that made them eligible are still there.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProjectListQueryDto): Promise<ApiList<ProjectSummary>> {
    const where: Prisma.ProjectWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          // Only currently open assignments count as "active members".
          _count: { select: { members: { where: { endedAt: null } } } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        ...ProjectsService.toSummary(row),
        activeMemberCount: row._count.members,
      })),
      meta: paginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findById(id: string): Promise<ProjectSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { members: { where: { endedAt: null } } } } },
    });
    if (!project) throw ApiException.notFound('Project not found.');

    return { ...ProjectsService.toSummary(project), activeMemberCount: project._count.members };
  }

  /**
   * Creates the project and opens its first activity period in one transaction.
   *
   * A project with no activity period would be invisible to eligibility — it
   * could never be selected for any week — so the two must be created together.
   */
  async create(
    actor: SafeUser,
    input: { name: string; description?: string | null },
  ): Promise<ProjectSummary> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            name: input.name,
            description: input.description ?? null,
            activityPeriods: { create: { startedAt: new Date() } },
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.PROJECT_CREATED,
            entityType: AuditEntityType.PROJECT,
            entityId: project.id,
            metadata: { name: project.name },
          },
          tx,
        );

        return { ...ProjectsService.toSummary(project), activeMemberCount: 0 };
      });
    } catch (error) {
      throw ProjectsService.mapDuplicateName(error);
    }
  }

  async update(
    actor: SafeUser,
    id: string,
    input: { name?: string; description?: string | null; expectedRevision: number },
  ): Promise<ProjectSummary> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await ProjectsService.loadForUpdate(tx, id, input.expectedRevision);

        const data: Prisma.ProjectUpdateInput = {};
        if (input.name !== undefined) data.name = input.name;
        // `description: null` clears it; omitting the key leaves it alone (§15.4).
        if (input.description !== undefined) data.description = input.description;

        const updated = await ProjectsService.bumpRevision(tx, project, data);

        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.PROJECT_UPDATED,
            entityType: AuditEntityType.PROJECT,
            entityId: project.id,
            metadata: { changed: Object.keys(data), name: updated.name },
          },
          tx,
        );

        return this.findById(updated.id);
      });
    } catch (error) {
      throw ProjectsService.mapDuplicateName(error);
    }
  }

  /**
   * Archive and reactivate.
   *
   * Archiving closes the single open activity period; reactivating opens a NEW
   * one. An old interval is never reopened or rewritten, which is what keeps a
   * week that fell inside a previous active stretch eligible forever (§5.3).
   *
   * Both are idempotent: asking for the state a project is already in returns it
   * unchanged rather than opening a second period.
   */
  async setActive(
    actor: SafeUser,
    id: string,
    isActive: boolean,
    expectedRevision: number,
  ): Promise<ProjectSummary> {
    await this.prisma.$transaction(async (tx) => {
      const project = await ProjectsService.loadForUpdate(tx, id, expectedRevision);
      if (project.isActive === isActive) return;

      const at = new Date();

      if (isActive) {
        await tx.projectActivityPeriod.create({ data: { projectId: id, startedAt: at } });
      } else {
        // Exactly one period can be open — a partial unique index guarantees it —
        // so this closes the current stretch and no other.
        await tx.projectActivityPeriod.updateMany({
          where: { projectId: id, endedAt: null },
          data: { endedAt: at },
        });
      }

      await ProjectsService.bumpRevision(tx, project, { isActive });

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: isActive ? AuditAction.PROJECT_REACTIVATED : AuditAction.PROJECT_ARCHIVED,
          entityType: AuditEntityType.PROJECT,
          entityId: id,
          metadata: { name: project.name },
        },
        tx,
      );
    });

    return this.findById(id);
  }

  async listMembers(
    projectId: string,
    options: { includeHistory: boolean; page: number; pageSize: number },
  ): Promise<ApiList<ProjectMembership>> {
    await this.findById(projectId); // 404s before paging over nothing

    const where: Prisma.ProjectMemberWhereInput = {
      projectId,
      ...(options.includeHistory ? {} : { endedAt: null }),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.projectMember.findMany({
        where,
        orderBy: [{ assignedAt: 'desc' }, { id: 'asc' }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        include: { user: true },
      }),
      this.prisma.projectMember.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        user: {
          id: row.user.id,
          fullName: row.user.fullName,
          email: row.user.email,
          isActive: row.user.isActive,
        },
        assignedAt: row.assignedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
      })),
      meta: paginationMeta(options.page, options.pageSize, totalItems),
    };
  }

  /**
   * Opens an assignment period. Idempotent when one is already open.
   *
   * Returns the refreshed project because every membership write bumps the
   * project's revision — a caller doing two actions in a row needs the new token,
   * or the second would be rejected as stale.
   */
  async assignMember(
    actor: SafeUser,
    projectId: string,
    userId: string,
    expectedProjectRevision: number,
  ): Promise<{ created: boolean; project: ProjectSummary }> {
    const created = await this.prisma.$transaction(async (tx) => {
      // Lock order: project before user (§16.2).
      const project = await ProjectsService.loadForUpdate(tx, projectId, expectedProjectRevision);

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw ApiException.notFound('User not found.');

      if (!user.isActive) {
        throw ApiException.conflict(
          ApiErrorCode.INVALID_TRANSITION,
          'Reactivate the account before assigning it to a project.',
        );
      }
      if (!project.isActive) {
        throw ApiException.conflict(
          ApiErrorCode.INVALID_TRANSITION,
          'Reactivate the project before assigning members.',
        );
      }

      const open = await tx.projectMember.findFirst({
        where: { projectId, userId, endedAt: null },
      });
      if (open) return false;

      await tx.projectMember.create({
        data: { projectId, userId, assignedAt: new Date() },
      });
      await ProjectsService.bumpRevision(tx, project, {});

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.PROJECT_MEMBER_ASSIGNED,
          entityType: AuditEntityType.PROJECT_MEMBER,
          entityId: projectId,
          metadata: { projectId, userId, projectName: project.name },
        },
        tx,
      );

      return true;
    });

    return { created, project: await this.findById(projectId) };
  }

  /**
   * Closes the open assignment. The row survives — that is what lets a member
   * report on a project they were removed from mid-week (§5.3).
   */
  async removeMember(
    actor: SafeUser,
    projectId: string,
    userId: string,
    expectedProjectRevision: number,
  ): Promise<{ removed: boolean; project: ProjectSummary }> {
    const removed = await this.prisma.$transaction(async (tx) => {
      const project = await ProjectsService.loadForUpdate(tx, projectId, expectedProjectRevision);

      const closed = await tx.projectMember.updateMany({
        where: { projectId, userId, endedAt: null },
        data: { endedAt: new Date() },
      });

      // Idempotent: removing an already-removed member creates no zero-length
      // period and no second audit event.
      if (closed.count === 0) return false;

      await ProjectsService.bumpRevision(tx, project, {});

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.PROJECT_MEMBER_REMOVED,
          entityType: AuditEntityType.PROJECT_MEMBER,
          entityId: projectId,
          metadata: { projectId, userId, projectName: project.name },
        },
        tx,
      );

      return true;
    });

    return { removed, project: await this.findById(projectId) };
  }

  /** Active Team Members, for the assignment picker. */
  async assignableMembers(): Promise<{ id: string; fullName: string; email: string }[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: Role.TEAM_MEMBER, isActive: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: { id: true, fullName: true, email: true },
    });
    return rows;
  }

  private static toSummary(project: Project): Omit<ProjectSummary, 'activeMemberCount'> {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      isActive: project.isActive,
      revision: project.revision,
      createdAt: project.createdAt.toISOString(),
    };
  }

  private static async loadForUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    expectedRevision: number,
  ): Promise<Project> {
    const project = await tx.project.findUnique({ where: { id } });
    if (!project) throw ApiException.notFound('Project not found.');

    if (project.revision !== expectedRevision) {
      throw ApiException.conflict(
        ApiErrorCode.STALE_REPORT,
        'This project changed since you loaded it. Reload and try again.',
      );
    }

    return project;
  }

  private static async bumpRevision(
    tx: Prisma.TransactionClient,
    project: Project,
    data: Prisma.ProjectUpdateInput,
  ): Promise<Project> {
    const result = await tx.project.updateMany({
      where: { id: project.id, revision: project.revision },
      data: { ...data, revision: { increment: 1 } },
    });

    if (result.count === 0) {
      throw ApiException.conflict(
        ApiErrorCode.STALE_REPORT,
        'This project changed since you loaded it. Reload and try again.',
      );
    }

    return tx.project.findUniqueOrThrow({ where: { id: project.id } });
  }

  /** The case-insensitive unique index reports as P2002 on a functional index. */
  private static mapDuplicateName(error: unknown): unknown {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : '';

    const isDuplicate =
      (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') ||
      message.includes('Project_name_lower_unique');

    if (isDuplicate) {
      return ApiException.conflict(
        ApiErrorCode.DUPLICATE_RESOURCE,
        'A project with that name already exists.',
      );
    }

    return error;
  }
}
