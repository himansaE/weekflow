import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  currentWeekStart,
  deadlineFor,
  deriveSubmissionState,
  isCanonicalWeekStart,
  weekEndDateFor,
  weekRangeFor,
} from '@weekflow/shared';
import type { CalendarConfig, SubmissionState, WeekStart } from '@weekflow/shared';
import { ApiException } from '../common/errors/api.exception';
import type { Env } from '../config/env.schema';

/**
 * The application's reporting calendar, bound to the configured timezone and
 * deadline (§4).
 *
 * A thin wrapper over the pure helpers in `packages/shared` on purpose: the rules
 * stay testable without Nest, and every caller in the API gets the same
 * configuration rather than passing its own.
 */
@Injectable()
export class CalendarService {
  readonly config: CalendarConfig;

  constructor(config: ConfigService<Env, true>) {
    this.config = {
      timezone: config.get('APP_TIMEZONE', { infer: true }),
      deadlineHour: config.get('REPORT_DEADLINE_HOUR', { infer: true }),
      deadlineMinute: config.get('REPORT_DEADLINE_MINUTE', { infer: true }),
    };
  }

  /** Backend time is authoritative — a client clock never decides the week (§4.1). */
  currentWeekStart(asOf: Date = new Date()): WeekStart {
    return currentWeekStart(asOf, this.config);
  }

  /**
   * Validates a caller-supplied week. Rejecting a non-Monday here is what stops a
   * request addressing a "week" that overlaps two real reporting weeks (§15.2).
   */
  requireCanonicalWeek(value: string): WeekStart {
    if (!isCanonicalWeekStart(value, this.config)) {
      throw ApiException.badRequest('weekStart must be a Monday in YYYY-MM-DD form.', [
        { path: 'weekStart', message: 'Must be a Monday (YYYY-MM-DD).' },
      ]);
    }
    return value;
  }

  weekEndDate(weekStart: WeekStart): string {
    return weekEndDateFor(weekStart, this.config);
  }

  weekRange(weekStart: WeekStart): { start: Date; endExclusive: Date } {
    return weekRangeFor(weekStart, this.config);
  }

  deadlineFor(weekStart: WeekStart): Date {
    return deadlineFor(weekStart, this.config);
  }

  submissionState(input: {
    firstSubmittedAt: Date | null;
    deadlineAt: Date;
    hasReport: boolean;
    asOf: Date;
  }): SubmissionState {
    return deriveSubmissionState(input);
  }
}
