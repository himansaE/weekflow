/**
 * WeekFlow domain enums — specification §13.2.
 *
 * These are the single source of truth for both the Prisma schema and the web UI.
 * Values are uppercase keys on the wire (§15.1).
 */

export const Role = {
  TEAM_MEMBER: 'TEAM_MEMBER',
  MANAGER: 'MANAGER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Persisted workflow status. There is deliberately NO `NOT_STARTED` and no
 * `RESUBMITTED` value (§4.2): "not started" means no Report row exists, and a
 * resubmission returns the report to `SUBMITTED`.
 */
export const ReportStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  NEEDS_CORRECTION: 'NEEDS_CORRECTION',
  APPROVED: 'APPROVED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/**
 * API-only enum — NEVER persisted as a workflow column (§13.2, §4.2).
 * Always derived at read time from `firstSubmittedAt`, `deadlineAt` and `asOf`.
 */
export const SubmissionState = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
  SUBMITTED_ON_TIME: 'SUBMITTED_ON_TIME',
  SUBMITTED_LATE: 'SUBMITTED_LATE',
} as const;
export type SubmissionState = (typeof SubmissionState)[keyof typeof SubmissionState];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const TaskStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const BlockerStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const;
export type BlockerStatus = (typeof BlockerStatus)[keyof typeof BlockerStatus];

export const TimeCategory = {
  DEVELOPMENT: 'DEVELOPMENT',
  TESTING: 'TESTING',
  MEETING: 'MEETING',
  DOCUMENTATION: 'DOCUMENTATION',
  OTHER: 'OTHER',
} as const;
export type TimeCategory = (typeof TimeCategory)[keyof typeof TimeCategory];

export const ReviewAction = {
  APPROVE: 'APPROVE',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
} as const;
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction];

/** Display labels for the categorized time breakdown (§6.6). */
export const TIME_CATEGORY_LABELS: Record<TimeCategory, string> = {
  DEVELOPMENT: 'Development',
  TESTING: 'Testing',
  MEETING: 'Meeting',
  DOCUMENTATION: 'Documentation',
  OTHER: 'Other',
};

export const ROLE_VALUES = Object.values(Role);
export const REPORT_STATUS_VALUES = Object.values(ReportStatus);
export const SUBMISSION_STATE_VALUES = Object.values(SubmissionState);
export const PRIORITY_VALUES = Object.values(Priority);
export const TASK_STATUS_VALUES = Object.values(TaskStatus);
export const BLOCKER_STATUS_VALUES = Object.values(BlockerStatus);
export const TIME_CATEGORY_VALUES = Object.values(TimeCategory);
export const REVIEW_ACTION_VALUES = Object.values(ReviewAction);
