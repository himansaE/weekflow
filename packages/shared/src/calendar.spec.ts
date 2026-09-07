import {
  addWeeks,
  currentWeekStart,
  DEFAULT_CALENDAR,
  deadlineFor,
  deriveSubmissionState,
  isCanonicalWeekStart,
  recentWeekStarts,
  weekEndDateFor,
  weekRangeFor,
  weekStartFor,
} from './calendar';
import { SubmissionState } from './enums';

const cfg = DEFAULT_CALENDAR; // Asia/Colombo (UTC+5:30, no DST), deadline 09:00

/** Asia/Colombo is UTC+5:30, so a local wall-clock time is 5h30m earlier in UTC. */
const colombo = (isoLocal: string): Date => new Date(`${isoLocal}+05:30`);

describe('CAL — reporting calendar (§4.1)', () => {
  describe('canonical week starts', () => {
    it('accepts a Monday', () => {
      expect(isCanonicalWeekStart('2026-08-31', cfg)).toBe(true);
    });

    it.each([
      ['a Sunday', '2026-08-30'],
      ['a Tuesday', '2026-09-01'],
    ])('rejects %s', (_label, value) => {
      expect(isCanonicalWeekStart(value, cfg)).toBe(false);
    });

    it.each([
      ['a non-date', 'not-a-date'],
      ['a wrong format', '31-08-2026'],
      ['a datetime', '2026-08-31T00:00:00Z'],
      ['an impossible date', '2026-02-30'],
    ])('rejects %s', (_label, value) => {
      expect(isCanonicalWeekStart(value, cfg)).toBe(false);
    });
  });

  describe('week containing an instant', () => {
    it('maps a mid-week instant to its Monday', () => {
      expect(weekStartFor(colombo('2026-09-03T14:00:00'), cfg)).toBe('2026-08-31');
    });

    it('includes Monday 00:00 in the week it starts', () => {
      expect(weekStartFor(colombo('2026-08-31T00:00:00'), cfg)).toBe('2026-08-31');
    });

    it('includes the last instant of Sunday — the week is half-open', () => {
      expect(weekStartFor(colombo('2026-09-06T23:59:59.999'), cfg)).toBe('2026-08-31');
    });

    it('rolls to the next week at the following Monday 00:00', () => {
      expect(weekStartFor(colombo('2026-09-07T00:00:00'), cfg)).toBe('2026-09-07');
    });

    it('uses the application zone, not the server zone', () => {
      // 2026-09-06T20:00Z is already Monday 01:30 in Colombo, so it belongs to
      // the NEXT reporting week even though it is still Sunday in UTC.
      expect(weekStartFor(new Date('2026-09-06T20:00:00Z'), cfg)).toBe('2026-09-07');
    });
  });

  it('reports the Sunday calendar date for display', () => {
    expect(weekEndDateFor('2026-08-31', cfg)).toBe('2026-09-06');
  });

  it('exposes the week as a half-open UTC instant range', () => {
    const range = weekRangeFor('2026-08-31', cfg);

    expect(range.start.toISOString()).toBe('2026-08-30T18:30:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-09-06T18:30:00.000Z');
    // Exactly one week wide, with no gap or overlap against the next week.
    expect(weekRangeFor('2026-09-07', cfg).start).toEqual(range.endExclusive);
  });

  describe('deadline', () => {
    it('matches the specification worked example (§4.1)', () => {
      // weekStart 2026-08-31 → Colombo deadline Mon 7 Sep 09:00 → 03:30Z.
      expect(deadlineFor('2026-08-31', cfg).toISOString()).toBe('2026-09-07T03:30:00.000Z');
    });

    it('falls one week plus nine hours after the week opens', () => {
      const { start } = weekRangeFor('2026-08-31', cfg);
      const deadline = deadlineFor('2026-08-31', cfg);
      const hours = (deadline.getTime() - start.getTime()) / 3_600_000;

      expect(hours).toBe(7 * 24 + 9);
    });

    it('honours a configured deadline hour', () => {
      const late = deadlineFor('2026-08-31', { ...cfg, deadlineHour: 17, deadlineMinute: 30 });
      expect(late.toISOString()).toBe('2026-09-07T12:00:00.000Z');
    });
  });

  it('lists the selected week plus the previous four, chronologically (§8.3)', () => {
    expect(recentWeekStarts('2026-08-31', 5, cfg)).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ]);
  });

  it('shifts week starts in both directions', () => {
    expect(addWeeks('2026-08-31', 1, cfg)).toBe('2026-09-07');
    expect(addWeeks('2026-08-31', -1, cfg)).toBe('2026-08-24');
  });

  it('derives the current week from an injected clock', () => {
    expect(currentWeekStart(colombo('2026-09-04T09:00:00'), cfg)).toBe('2026-08-31');
  });
});

describe('CAL — submission state precedence (§4.2)', () => {
  const deadlineAt = deadlineFor('2026-08-31', cfg); // 2026-09-07T03:30:00Z

  const state = (input: {
    firstSubmittedAt?: Date | null;
    hasReport?: boolean;
    asOf: Date;
  }): SubmissionState =>
    deriveSubmissionState({
      firstSubmittedAt: input.firstSubmittedAt ?? null,
      deadlineAt,
      hasReport: input.hasReport ?? false,
      asOf: input.asOf,
    });

  it('is NOT_STARTED with no report before the deadline', () => {
    expect(state({ asOf: colombo('2026-09-04T10:00:00') })).toBe(SubmissionState.NOT_STARTED);
  });

  it('is PENDING once a draft exists before the deadline', () => {
    expect(state({ hasReport: true, asOf: colombo('2026-09-04T10:00:00') })).toBe(
      SubmissionState.PENDING,
    );
  });

  it.each([
    ['no report', false],
    ['an unsubmitted draft', true],
  ])('is OVERDUE after the deadline with %s', (_label, hasReport) => {
    expect(state({ hasReport, asOf: colombo('2026-09-07T09:00:01') })).toBe(
      SubmissionState.OVERDUE,
    );
  });

  it('is not yet OVERDUE at exactly the deadline instant', () => {
    expect(state({ hasReport: true, asOf: deadlineAt })).toBe(SubmissionState.PENDING);
  });

  it('treats submission at exactly the deadline as on time', () => {
    expect(state({ firstSubmittedAt: deadlineAt, asOf: deadlineAt })).toBe(
      SubmissionState.SUBMITTED_ON_TIME,
    );
  });

  it('treats submission one millisecond later as late', () => {
    const justLate = new Date(deadlineAt.getTime() + 1);
    expect(state({ firstSubmittedAt: justLate, asOf: justLate })).toBe(
      SubmissionState.SUBMITTED_LATE,
    );
  });

  it('keeps an on-time report on time when corrections are resubmitted after the deadline', () => {
    // The whole point of §4.2: only the FIRST submission decides timeliness.
    const onTime = colombo('2026-09-07T08:00:00');
    const muchLater = colombo('2026-09-20T12:00:00');

    expect(state({ firstSubmittedAt: onTime, hasReport: true, asOf: muchLater })).toBe(
      SubmissionState.SUBMITTED_ON_TIME,
    );
  });

  it('keeps a late report late no matter how long ago it was approved', () => {
    const late = colombo('2026-09-08T09:00:00');
    expect(state({ firstSubmittedAt: late, asOf: colombo('2026-10-30T09:00:00') })).toBe(
      SubmissionState.SUBMITTED_LATE,
    );
  });

  it('never reports OVERDUE once a first submission exists', () => {
    const late = colombo('2026-09-09T09:00:00');
    expect(state({ firstSubmittedAt: late, asOf: colombo('2026-09-30T09:00:00') })).not.toBe(
      SubmissionState.OVERDUE,
    );
  });
});
