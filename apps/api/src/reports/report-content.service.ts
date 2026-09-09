import { Injectable } from '@nestjs/common';
import type { ReportContentInput, ReportContentView } from '@weekflow/shared';
import { ApiException } from '../common/errors/api.exception';
import type { Prisma } from '../generated/prisma/client';

/** The six version-owned child collections (§13.5). */
type ChildModel =
  'reportTask' | 'nextWeekTask' | 'blocker' | 'achievement' | 'timeEntry' | 'reportLink';

const SECTION_TO_MODEL: Record<string, ChildModel> = {
  tasks: 'reportTask',
  nextWeekTasks: 'nextWeekTask',
  blockers: 'blocker',
  achievements: 'achievement',
  timeEntries: 'timeEntry',
  links: 'reportLink',
};

/**
 * Offset applied while re-numbering positions.
 *
 * `(reportVersionId, position)` is unique, so moving row A to position 0 while
 * row B still occupies it collides mid-update. Every row is first pushed beyond
 * the section cap, then written to its final position — two phases, no transient
 * duplicate (§16.3).
 */
const POSITION_OFFSET = 100_000;

/**
 * Reads and writes the content of one report version.
 *
 * Reconciliation is by row id, never delete-and-recreate: recreating would issue
 * new ids on every save, so a row the user is editing would change identity
 * underneath them, and any future reference to a row would break.
 */
@Injectable()
export class ReportContentService {
  async load(tx: Prisma.TransactionClient, versionId: string): Promise<ReportContentView> {
    const version = await tx.reportVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        tasks: { orderBy: { position: 'asc' } },
        nextWeekTasks: { orderBy: { position: 'asc' } },
        blockers: { orderBy: { position: 'asc' } },
        achievements: { orderBy: { position: 'asc' } },
        timeEntries: { orderBy: { position: 'asc' } },
        links: { orderBy: { position: 'asc' } },
      },
    });

    return {
      tasks: version.tasks.map((row) => ({
        id: row.id,
        position: row.position,
        taskName: row.taskName,
        projectId: row.projectId,
        priority: row.priority,
        plannedPercent: row.plannedPercent,
        actualPercent: row.actualPercent,
        status: row.status,
        plannedMinutes: row.plannedMinutes,
        actualMinutes: row.actualMinutes,
        deliverable: row.deliverable,
      })),
      nextWeekTasks: version.nextWeekTasks.map((row) => ({
        id: row.id,
        position: row.position,
        taskName: row.taskName,
        projectId: row.projectId,
        priority: row.priority,
      })),
      blockers: version.blockers.map((row) => ({
        id: row.id,
        position: row.position,
        description: row.description,
        projectId: row.projectId,
        status: row.status,
        isKeyIssue: row.isKeyIssue,
      })),
      achievements: version.achievements.map((row) => ({
        id: row.id,
        position: row.position,
        description: row.description,
        projectId: row.projectId,
        isKeyAchievement: row.isKeyAchievement,
      })),
      timeEntries: version.timeEntries.map((row) => ({
        id: row.id,
        position: row.position,
        category: row.category,
        minutes: row.minutes,
        projectId: row.projectId,
      })),
      notes: version.notes,
      links: version.links.map((row) => ({
        id: row.id,
        position: row.position,
        label: row.label,
        url: row.url,
      })),
    };
  }

  /**
   * Replaces a version's content with the submitted aggregate.
   *
   * Ordering matters and is deliberate:
   *  1. validate every supplied id belongs to this version,
   *  2. delete removed rows,
   *  3. clear key flags before setting the new one,
   *  4. push surviving rows past the position offset,
   *  5. upsert every row at its final position.
   *
   * Steps 3 and 4 exist because the database has partial unique indexes on the
   * key flags and a unique index on position; without them a legal end state is
   * unreachable because an intermediate state violates a constraint.
   */
  async replace(
    tx: Prisma.TransactionClient,
    versionId: string,
    content: ReportContentInput,
    options: { fresh?: boolean } = {},
  ): Promise<void> {
    // `fresh` means the version was created moments ago in this same transaction,
    // so it owns no rows: every delete and position-offset query would be a
    // guaranteed no-op. Skipping them removes a dozen round trips from the create
    // path, which matters because the whole aggregate write must fit inside one
    // transaction (§16.1).
    const fresh = options.fresh ?? false;

    await this.assertIdsBelongToVersion(tx, versionId, content, fresh);

    await tx.reportVersion.update({ where: { id: versionId }, data: { notes: content.notes } });

    await this.reconcileWithFresh(tx, versionId, 'reportTask', fresh, content.tasks, (row) => ({
      taskName: row.taskName ?? null,
      projectId: row.projectId ?? null,
      priority: row.priority ?? null,
      plannedPercent: row.plannedPercent ?? null,
      actualPercent: row.actualPercent ?? null,
      status: row.status ?? null,
      plannedMinutes: row.plannedMinutes ?? null,
      actualMinutes: row.actualMinutes ?? null,
      deliverable: row.deliverable ?? null,
    }));

    await this.reconcileWithFresh(
      tx,
      versionId,
      'nextWeekTask',
      fresh,
      content.nextWeekTasks,
      (row) => ({
        taskName: row.taskName ?? null,
        projectId: row.projectId ?? null,
        priority: row.priority ?? null,
      }),
    );

    // Key flags are cleared first so the partial unique index cannot trip while
    // the old key row and the new one briefly both claim the flag (§16.3).
    // Unnecessary on a fresh version — there is nothing to clear.
    if (!fresh) {
      await tx.blocker.updateMany({
        where: { reportVersionId: versionId },
        data: { isKeyIssue: false },
      });
    }
    await this.reconcileWithFresh(tx, versionId, 'blocker', fresh, content.blockers, (row) => ({
      description: row.description ?? null,
      projectId: row.projectId ?? null,
      status: row.status ?? null,
      isKeyIssue: row.isKeyIssue ?? false,
    }));

    if (!fresh) {
      await tx.achievement.updateMany({
        where: { reportVersionId: versionId },
        data: { isKeyAchievement: false },
      });
    }
    await this.reconcileWithFresh(
      tx,
      versionId,
      'achievement',
      fresh,
      content.achievements,
      (row) => ({
        description: row.description ?? null,
        projectId: row.projectId ?? null,
        isKeyAchievement: row.isKeyAchievement ?? false,
      }),
    );

    await this.reconcileWithFresh(
      tx,
      versionId,
      'timeEntry',
      fresh,
      content.timeEntries,
      (row) => ({
        category: row.category ?? null,
        minutes: row.minutes ?? null,
        projectId: row.projectId ?? null,
      }),
    );

    await this.reconcileWithFresh(tx, versionId, 'reportLink', fresh, content.links, (row) => ({
      label: row.label ?? null,
      url: row.url ?? null,
    }));
  }

  /**
   * Deep-copies one version's content into another — the correction clone (§7.3).
   *
   * Every child gets a NEW id: a submitted row must never be attached to two
   * versions or moved into the clone. Inserts are batched per collection so the
   * whole clone costs six statements rather than one per row, which keeps a large
   * report inside the transaction budget.
   */
  async copyInto(
    tx: Prisma.TransactionClient,
    sourceVersionId: string,
    targetVersionId: string,
  ): Promise<void> {
    const content = await this.load(tx, sourceVersionId);

    await tx.reportVersion.update({
      where: { id: targetVersionId },
      // The source's notes come along; the clone is a copy, not a blank slate.
      data: { notes: content.notes },
    });

    const link = (index: number) => ({ reportVersionId: targetVersionId, position: index });

    if (content.tasks.length > 0) {
      await tx.reportTask.createMany({
        data: content.tasks.map((row, index) => ({
          ...link(index),
          taskName: row.taskName,
          projectId: row.projectId,
          priority: row.priority,
          plannedPercent: row.plannedPercent,
          actualPercent: row.actualPercent,
          status: row.status,
          plannedMinutes: row.plannedMinutes,
          actualMinutes: row.actualMinutes,
          deliverable: row.deliverable,
        })),
      });
    }

    if (content.nextWeekTasks.length > 0) {
      await tx.nextWeekTask.createMany({
        data: content.nextWeekTasks.map((row, index) => ({
          ...link(index),
          taskName: row.taskName,
          projectId: row.projectId,
          priority: row.priority,
        })),
      });
    }

    if (content.blockers.length > 0) {
      await tx.blocker.createMany({
        data: content.blockers.map((row, index) => ({
          ...link(index),
          description: row.description,
          projectId: row.projectId,
          status: row.status,
          isKeyIssue: row.isKeyIssue,
        })),
      });
    }

    if (content.achievements.length > 0) {
      await tx.achievement.createMany({
        data: content.achievements.map((row, index) => ({
          ...link(index),
          description: row.description,
          projectId: row.projectId,
          isKeyAchievement: row.isKeyAchievement,
        })),
      });
    }

    if (content.timeEntries.length > 0) {
      await tx.timeEntry.createMany({
        data: content.timeEntries.map((row, index) => ({
          ...link(index),
          category: row.category,
          minutes: row.minutes,
          projectId: row.projectId,
        })),
      });
    }

    if (content.links.length > 0) {
      await tx.reportLink.createMany({
        data: content.links.map((row, index) => ({
          ...link(index),
          label: row.label,
          url: row.url,
        })),
      });
    }
  }

  /** Every project referenced anywhere in the aggregate, for eligibility checks. */
  static referencedProjectIds(content: ReportContentInput): string[] {
    const ids = [
      ...content.tasks.map((row) => row.projectId),
      ...content.nextWeekTasks.map((row) => row.projectId),
      ...content.blockers.map((row) => row.projectId),
      ...content.achievements.map((row) => row.projectId),
      ...content.timeEntries.map((row) => row.projectId),
    ];

    return [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  }

  /**
   * Rejects an id that is not a row of this version.
   *
   * Without this a caller could send another member's row id and have it silently
   * adopted — or moved out of a submitted version (§15.5, RBAC).
   */
  private async assertIdsBelongToVersion(
    tx: Prisma.TransactionClient,
    versionId: string,
    content: ReportContentInput,
    fresh: boolean,
  ): Promise<void> {
    const supplied = new Map<string, string[]>();
    for (const [section, model] of Object.entries(SECTION_TO_MODEL)) {
      const rows = (content as unknown as Record<string, { id?: string }[]>)[section] ?? [];
      const ids = rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');

      // The same id twice in one payload would make reconciliation ambiguous.
      if (new Set(ids).size !== ids.length) {
        throw ApiException.badRequest(`Duplicate row id in ${section}.`);
      }

      supplied.set(model, ids);
    }

    for (const [model, ids] of supplied) {
      if (ids.length === 0) continue;

      // A brand-new version owns no rows, so any supplied id is foreign by
      // definition — no query needed to establish that.
      if (fresh) {
        throw ApiException.badRequest('A submitted row does not belong to this report version.');
      }

      const found = await this.childDelegate(tx, model as ChildModel).findMany({
        where: { id: { in: ids }, reportVersionId: versionId },
        select: { id: true },
      });

      if (found.length !== ids.length) {
        throw ApiException.badRequest('A submitted row does not belong to this report version.');
      }
    }
  }

  private async reconcileWithFresh<TRow extends { id?: string }>(
    tx: Prisma.TransactionClient,
    versionId: string,
    model: ChildModel,
    fresh: boolean,
    rows: TRow[],
    toData: (row: TRow) => Record<string, unknown>,
  ): Promise<void> {
    const delegate = this.childDelegate(tx, model);
    const keptIds = rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');

    if (!fresh) {
      // Rows the payload omitted are gone. Only from THIS editable version — the
      // corresponding row in an earlier submitted version is untouched (§13.7).
      await delegate.deleteMany({
        where: {
          reportVersionId: versionId,
          ...(keptIds.length ? { id: { notIn: keptIds } } : {}),
        },
      });

      if (keptIds.length > 0) {
        // Phase one: move survivors out of the way of the final numbering.
        await delegate.updateMany({
          where: { reportVersionId: versionId },
          data: { position: { increment: POSITION_OFFSET } },
        });
      }
    }

    // Phase two: array order is the position (§15.5). Updates go one by one
    // because each row carries different values; inserts are batched into a
    // single statement, which is what keeps a large report inside the
    // transaction budget.
    const inserts: Record<string, unknown>[] = [];

    for (const [index, row] of rows.entries()) {
      const data = { ...toData(row), position: index };

      if (row.id) {
        await delegate.update({ where: { id: row.id }, data });
      } else {
        inserts.push({ ...data, reportVersionId: versionId });
      }
    }

    if (inserts.length > 0) {
      await delegate.createMany({ data: inserts });
    }
  }

  /**
   * The six child delegates share the shape this service uses, but Prisma types
   * them individually. One narrow accessor keeps the cast in a single place
   * instead of scattering it through every call site.
   */
  private childDelegate(
    tx: Prisma.TransactionClient,
    model: ChildModel,
  ): {
    findMany: (args: unknown) => Promise<{ id: string }[]>;
    deleteMany: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  } {
    return tx[model] as unknown as ReturnType<ReportContentService['childDelegate']>;
  }
}
