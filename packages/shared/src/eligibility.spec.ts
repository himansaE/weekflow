import { DEFAULT_CALENDAR, weekRangeFor } from './calendar';
import { isProjectEligible, periodsOverlapWeek } from './eligibility';
import type { Period } from './eligibility';

const cfg = DEFAULT_CALENDAR;
const colombo = (isoLocal: string): Date => new Date(`${isoLocal}+05:30`);

/** Reporting week Mon 31 Aug 2026 → Sun 6 Sep 2026, Asia/Colombo. */
const week = weekRangeFor('2026-08-31', cfg);

const period = (startLocal: string, endLocal?: string): Period => ({
  startAt: colombo(startLocal),
  endAt: endLocal ? colombo(endLocal) : null,
});

/** Open for the whole of recorded time — the common "still active" case. */
const alwaysOpen = period('2020-01-01T00:00:00');

describe('ELIG — three-way interval overlap (§5.2)', () => {
  it('is eligible when assigned Monday–Wednesday and the project is active all week', () => {
    const assignment = period('2026-08-31T00:00:00', '2026-09-02T17:00:00');
    expect(periodsOverlapWeek(week, assignment, alwaysOpen)).toBe(true);
  });

  it('is eligible when assigned from Thursday onward', () => {
    const assignment = period('2026-09-03T09:00:00');
    expect(periodsOverlapWeek(week, assignment, alwaysOpen)).toBe(true);
  });

  it('is INELIGIBLE when assignment and activity each touch the week but never together', () => {
    // The case a naive "both intersect the week" check gets wrong: the member was
    // assigned Mon–Tue, but the project was only active Thu–Sun. There was never a
    // moment they could have worked on it.
    const assignment = period('2026-08-31T00:00:00', '2026-09-01T23:59:59');
    const activity = period('2026-09-03T00:00:00', '2026-09-07T00:00:00');

    expect(periodsOverlapWeek(week, assignment, activity)).toBe(false);
  });

  it('excludes an assignment that ends exactly when the week begins', () => {
    const assignment = period('2026-08-24T00:00:00', '2026-08-31T00:00:00');
    expect(periodsOverlapWeek(week, assignment, alwaysOpen)).toBe(false);
  });

  it('excludes an assignment that begins exactly when the week ends', () => {
    const assignment = period('2026-09-07T00:00:00');
    expect(periodsOverlapWeek(week, assignment, alwaysOpen)).toBe(false);
  });

  it('includes an assignment covering only the final moment of Sunday', () => {
    const assignment = period('2026-09-06T23:59:59.500');
    expect(periodsOverlapWeek(week, assignment, alwaysOpen)).toBe(true);
  });

  it('is eligible for a week in which the project was archived midweek', () => {
    const activity = period('2026-01-01T00:00:00', '2026-09-02T12:00:00');
    expect(periodsOverlapWeek(week, alwaysOpen, activity)).toBe(true);
  });

  it('is ineligible for a week wholly before the project was reactivated', () => {
    const activity = period('2026-09-14T00:00:00');
    expect(periodsOverlapWeek(week, alwaysOpen, activity)).toBe(false);
  });

  it('treats a null end as open-ended in both period kinds', () => {
    expect(periodsOverlapWeek(week, alwaysOpen, alwaysOpen)).toBe(true);
  });
});

describe('ELIG — eligibility across period histories (§5.3)', () => {
  it('accepts any qualifying pair when a member was removed and later reassigned', () => {
    const assignments = [
      period('2026-01-01T00:00:00', '2026-06-30T00:00:00'), // long over
      period('2026-09-02T09:00:00'), // reassigned midweek
    ];

    expect(isProjectEligible(week, assignments, [alwaysOpen])).toBe(true);
  });

  it('accepts a project archived and later reactivated when one period covers the week', () => {
    const activityPeriods = [
      period('2025-01-01T00:00:00', '2026-08-20T00:00:00'), // archived before the week
      period('2026-09-04T00:00:00'), // reactivated on the Friday
    ];

    expect(isProjectEligible(week, [alwaysOpen], activityPeriods)).toBe(true);
  });

  it('rejects when no assignment period pairs with any activity period', () => {
    const assignments = [period('2026-08-31T00:00:00', '2026-09-01T00:00:00')];
    const activityPeriods = [
      period('2025-01-01T00:00:00', '2026-08-01T00:00:00'),
      period('2026-09-03T00:00:00'),
    ];

    expect(isProjectEligible(week, assignments, activityPeriods)).toBe(false);
  });

  it.each([
    ['no assignments', [], [alwaysOpen]],
    ['no activity periods', [alwaysOpen], []],
    ['neither', [], []],
  ])('rejects with %s', (_label, assignments: Period[], activityPeriods: Period[]) => {
    expect(isProjectEligible(week, assignments, activityPeriods)).toBe(false);
  });

  it('keeps a historical week eligible after both the removal and the archive', () => {
    // Reporting a past week from today must not depend on today's state.
    const assignments = [period('2026-08-25T00:00:00', '2026-09-02T00:00:00')];
    const activityPeriods = [period('2026-01-01T00:00:00', '2026-09-10T00:00:00')];

    expect(isProjectEligible(week, assignments, activityPeriods)).toBe(true);
    // ... but the following week, after both closed, is not eligible.
    expect(isProjectEligible(weekRangeFor('2026-09-14', cfg), assignments, activityPeriods)).toBe(
      false,
    );
  });
});
