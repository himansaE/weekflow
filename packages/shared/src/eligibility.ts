/**
 * Temporal project eligibility — specification §5.2.
 *
 * A member may reference a project in a week's report only if their assignment
 * and the project's active period **both overlap the week at the same time**.
 * This is one shared predicate precisely because it has three consumers that
 * must agree: the editor's project picker, submit-time revalidation, and the
 * dashboard's project cohort. If they disagreed, a member could pick a project
 * the server then rejects, or a report could count toward a project it was never
 * eligible for.
 */

/** A half-open `[startAt, endAt)` period; a null end means "still open". */
export interface Period {
  startAt: Date;
  endAt: Date | null;
}

export interface WeekRange {
  start: Date;
  endExclusive: Date;
}

const POSITIVE_INFINITY_MS = Number.POSITIVE_INFINITY;

function endMs(period: Period): number {
  return period.endAt === null ? POSITIVE_INFINITY_MS : period.endAt.getTime();
}

/**
 * True when the week, the assignment and the activity period share a stretch of
 * time of **positive duration**:
 *
 *   max(week.start, assignment.startAt, activity.startAt)
 *     < min(week.endExclusive, assignment.endAt ?? ∞, activity.endAt ?? ∞)
 *
 * Two properties of this form matter:
 *
 * - It is a genuine three-way intersection. It is *not* enough for the
 *   assignment and the activity period to each touch the week separately — a
 *   member assigned Mon–Tue to a project that was only active Thu–Sun was never
 *   able to work on it, and is correctly ineligible.
 * - The comparison is strict, so exactly touching endpoints do not qualify: an
 *   assignment ending at Monday 00:00 confers no eligibility on the week that
 *   starts at that instant.
 */
export function periodsOverlapWeek(week: WeekRange, assignment: Period, activity: Period): boolean {
  const latestStart = Math.max(
    week.start.getTime(),
    assignment.startAt.getTime(),
    activity.startAt.getTime(),
  );

  const earliestEnd = Math.min(week.endExclusive.getTime(), endMs(assignment), endMs(activity));

  return latestStart < earliestEnd;
}

/**
 * True when *any* assignment period pairs with *any* activity period to cover
 * part of the week.
 *
 * Both lists are histories, not current state: a member removed and later
 * reassigned has several assignment rows, and a project archived and later
 * reactivated has several activity rows. Any qualifying pair is sufficient, which
 * is what keeps historical weeks reportable after an archive or a removal (§5.3).
 */
export function isProjectEligible(
  week: WeekRange,
  assignments: readonly Period[],
  activityPeriods: readonly Period[],
): boolean {
  return assignments.some((assignment) =>
    activityPeriods.some((activity) => periodsOverlapWeek(week, assignment, activity)),
  );
}
