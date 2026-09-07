import { Injectable } from '@nestjs/common';
import { isProjectEligible, weekRangeFor } from '@weekflow/shared';
import type { EligibleProject, Period, WeekStart } from '@weekflow/shared';
import { ApiException } from '../common/errors/api.exception';
import { CalendarService } from '../calendar/calendar.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which projects a member may reference for a given week (§5.2).
 *
 * Deliberately built on the shared `isProjectEligible` predicate rather than a
 * bespoke SQL condition. The editor's picker, submit-time revalidation and the
 * dashboard's project cohort must give the *same* answer — if they diverged, a
 * member could choose a project the server then rejects, or a report could count
 * toward a project it was never eligible for.
 *
 * The cost is loading a member's assignment periods and the projects' activity
 * periods rather than filtering in the database. Both are small — periods per
 * member per project, not rows per report — and correctness across three
 * consumers is worth more than the round trip. If a dashboard aggregate ever
 * needs this in SQL, the predicate above is the specification to port.
 */
@Injectable()
export class EligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
  ) {}

  async eligibleProjects(userId: string, weekStart: WeekStart): Promise<EligibleProject[]> {
    const week = weekRangeFor(weekStart, this.calendar.config);

    // Only projects this member has ever been assigned to can qualify, so the
    // candidate set is bounded by their assignment history.
    const assignments = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: { include: { activityPeriods: true } } },
    });

    const byProject = new Map<
      string,
      { name: string; isActive: boolean; assignments: Period[]; activity: Period[]; open: boolean }
    >();

    for (const assignment of assignments) {
      const entry = byProject.get(assignment.projectId) ?? {
        name: assignment.project.name,
        isActive: assignment.project.isActive,
        assignments: [],
        activity: assignment.project.activityPeriods.map((period) => ({
          startAt: period.startedAt,
          endAt: period.endedAt,
        })),
        open: false,
      };

      entry.assignments.push({ startAt: assignment.assignedAt, endAt: assignment.endedAt });
      if (assignment.endedAt === null) entry.open = true;

      byProject.set(assignment.projectId, entry);
    }

    const eligible: EligibleProject[] = [];
    for (const [projectId, entry] of byProject) {
      if (!isProjectEligible(week, entry.assignments, entry.activity)) continue;

      eligible.push({
        id: projectId,
        name: entry.name,
        // Labels for the picker, not eligibility: a project can be eligible for a
        // past week while archived or unassigned today, and the UI says so (§5.3).
        isCurrentlyActive: entry.isActive,
        isCurrentlyAssigned: entry.open,
      });
    }

    return eligible.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Submit-time revalidation (§5.3): the picker is never trusted, because a
   * project can stop being eligible between loading the form and saving it, and
   * because a request need not have come from the form at all.
   */
  async assertProjectsEligible(
    userId: string,
    weekStart: WeekStart,
    projectIds: readonly string[],
  ): Promise<void> {
    const wanted = [...new Set(projectIds)];
    if (wanted.length === 0) return;

    const eligible = new Set((await this.eligibleProjects(userId, weekStart)).map((p) => p.id));
    const rejected = wanted.filter((id) => !eligible.has(id));

    if (rejected.length > 0) {
      throw ApiException.validationFailed(
        'One or more selected projects are not available for this week.',
        rejected.map((id) => ({ path: `projectId:${id}`, message: 'Project is not eligible.' })),
      );
    }
  }
}
