import { DateTime } from 'luxon';
import { SubmissionState } from './enums';

/**
 * The reporting calendar — specification §4.
 *
 * Two rules drive every decision here:
 *
 * 1. A reporting week is the **half-open** interval `[Monday 00:00, next Monday 00:00)`
 *    in the application time zone, so the whole of Sunday including its final
 *    fractions of a second belongs to the week (§4.1). Comparing against a
 *    "Sunday 23:59:59" endpoint would silently drop sub-second submissions.
 * 2. `weekStart` is a **calendar date in the application zone**, never a UTC
 *    instant. Storing an instant would make the week a report belongs to depend
 *    on the server's locale.
 *
 * This module is the single source of truth: the API, the web client and the
 * tests all import it, so a week boundary cannot drift between them.
 */

export interface CalendarConfig {
  /** IANA zone, e.g. `Asia/Colombo`. */
  timezone: string;
  /** Local hour of the following-Monday deadline (§4.1). */
  deadlineHour: number;
  deadlineMinute: number;
}

export const DEFAULT_CALENDAR: CalendarConfig = {
  timezone: 'Asia/Colombo',
  deadlineHour: 9,
  deadlineMinute: 0,
};

/** A canonical `YYYY-MM-DD` calendar date that is always a Monday. */
export type WeekStart = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function zoned(weekStart: WeekStart, config: CalendarConfig): DateTime {
  const dt = DateTime.fromISO(weekStart, { zone: config.timezone });
  if (!dt.isValid) {
    throw new RangeError(`Invalid week start "${weekStart}": ${dt.invalidReason ?? 'unknown'}`);
  }
  return dt.startOf('day');
}

/**
 * True only for a well-formed `YYYY-MM-DD` date that falls on a Monday.
 *
 * Every endpoint that accepts a week requires this, so a caller cannot address a
 * "week" starting on a Wednesday and silently receive a different cohort (§15.2).
 */
export function isCanonicalWeekStart(value: string, config: CalendarConfig): boolean {
  if (!ISO_DATE.test(value)) return false;

  const dt = DateTime.fromISO(value, { zone: config.timezone });
  // Luxon: weekday 1 is Monday.
  return dt.isValid && dt.weekday === 1;
}

/** The reporting week that contains `instant`. */
export function weekStartFor(instant: Date, config: CalendarConfig): WeekStart {
  const local = DateTime.fromJSDate(instant, { zone: config.timezone });
  // Luxon's `startOf('week')` is Monday-based, matching §4.1.
  return local.startOf('week').toISODate() as WeekStart;
}

/** The current reporting week. `now` is injected so tests never depend on the clock. */
export function currentWeekStart(now: Date, config: CalendarConfig): WeekStart {
  return weekStartFor(now, config);
}

/**
 * The Sunday calendar date shown in the UI (§4.1).
 *
 * This is a *display* value. Never compare instants against it — use
 * `weekRangeFor().endExclusive`.
 */
export function weekEndDateFor(weekStart: WeekStart, config: CalendarConfig): string {
  return zoned(weekStart, config).plus({ days: 6 }).toISODate() as string;
}

/** Shift a week start by whole weeks; negative goes backwards. */
export function addWeeks(weekStart: WeekStart, weeks: number, config: CalendarConfig): WeekStart {
  return zoned(weekStart, config).plus({ weeks }).toISODate() as WeekStart;
}

/**
 * The selected week plus the `count - 1` weeks before it, chronologically.
 * Backs the Tasks Completed trend, which defaults to five weeks (§8.3).
 */
export function recentWeekStarts(
  weekStart: WeekStart,
  count: number,
  config: CalendarConfig,
): WeekStart[] {
  if (count < 1) return [];
  return Array.from({ length: count }, (_, index) =>
    addWeeks(weekStart, index - (count - 1), config),
  );
}

/**
 * The week as a half-open instant range, ready for `>= start AND < endExclusive`
 * comparisons against `timestamptz` columns.
 */
export function weekRangeFor(
  weekStart: WeekStart,
  config: CalendarConfig,
): { start: Date; endExclusive: Date } {
  const start = zoned(weekStart, config);
  return {
    start: start.toUTC().toJSDate(),
    endExclusive: start.plus({ weeks: 1 }).toUTC().toJSDate(),
  };
}

/**
 * The submission deadline: the following Monday at the configured local time,
 * converted to UTC (§4.1).
 *
 * Adding seven calendar days and then setting the local clock time — rather than
 * adding a fixed number of hours — is what keeps 09:00 meaning 09:00 local across
 * a DST transition in zones that observe one.
 */
export function deadlineFor(weekStart: WeekStart, config: CalendarConfig): Date {
  return zoned(weekStart, config)
    .plus({ days: 7 })
    .set({
      hour: config.deadlineHour,
      minute: config.deadlineMinute,
      second: 0,
      millisecond: 0,
    })
    .toUTC()
    .toJSDate();
}

export interface SubmissionStateInput {
  /** Null until the report is submitted for the very first time. */
  firstSubmittedAt: Date | null;
  deadlineAt: Date;
  /** Whether a Report row exists at all — this is what separates Pending from Not Started. */
  hasReport: boolean;
  /** One evaluation instant for the whole response (§4.4). */
  asOf: Date;
}

/**
 * Derives the submission state (§4.2).
 *
 * This is computed, never stored: a stored column would drift from
 * `firstSubmittedAt` the moment a correction cycle or a deadline change occurred.
 *
 * The precedence below is the specification's table, in order. Two consequences
 * are deliberate and easy to get wrong:
 *
 * - Submission at exactly the deadline is **on time** (`<=`), so the boundary is
 *   inclusive for the member and exclusive for overdue.
 * - Only the *first* submission is consulted. A correction resubmitted after the
 *   deadline leaves an originally on-time report on time, and a late report stays
 *   late even after approval.
 */
export function deriveSubmissionState({
  firstSubmittedAt,
  deadlineAt,
  hasReport,
  asOf,
}: SubmissionStateInput): SubmissionState {
  if (firstSubmittedAt !== null) {
    return firstSubmittedAt.getTime() <= deadlineAt.getTime()
      ? SubmissionState.SUBMITTED_ON_TIME
      : SubmissionState.SUBMITTED_LATE;
  }

  // Strictly after: at the deadline instant the member is not yet overdue,
  // mirroring the inclusive on-time boundary above.
  if (asOf.getTime() > deadlineAt.getTime()) {
    return SubmissionState.OVERDUE;
  }

  return hasReport ? SubmissionState.PENDING : SubmissionState.NOT_STARTED;
}
