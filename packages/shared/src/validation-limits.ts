/**
 * Every numeric bound, string length and collection cap in WeekFlow.
 *
 * DERIVED(§6.1): the specification labels the detailed limits below as Derived —
 * they are implementation contracts, not recovered decisions. They live here and
 * ONLY here so that web validation, API DTOs, the Prisma schema and the tests can
 * never drift, and so that reconciliation against a recovered decision is a
 * single-file change (see docs/derived-register.md).
 */

/** Minutes in one week — the plausibility bound for any self-reported duration (§6.6). */
export const MINUTES_IN_WEEK = 7 * 24 * 60; // 10_080

export const LIMITS = {
  user: {
    fullName: { min: 1, max: 120 },
    email: { max: 254 },
    /** Spaces permitted, never truncated, never trimmed (§12.2). */
    password: { min: 12, max: 128 },
  },

  project: {
    name: { min: 1, max: 120 },
    description: { max: 2_000 },
  },

  task: {
    taskName: { min: 1, max: 200 },
    deliverable: { min: 1, max: 2_000 },
    percent: { min: 0, max: 100 },
    minutes: { min: 0, max: MINUTES_IN_WEEK },
  },

  nextWeekTask: {
    taskName: { min: 1, max: 200 },
  },

  blocker: {
    description: { min: 1, max: 2_000 },
  },

  achievement: {
    description: { min: 1, max: 2_000 },
  },

  timeEntry: {
    /** A submitted row must be > 0; a draft row may be 0 (§13.5). */
    minutes: { min: 0, max: MINUTES_IN_WEEK },
    submittedMinutes: { min: 1, max: MINUTES_IN_WEEK },
    /** Hours/minutes input decomposition (§6.6). */
    minutesComponent: { min: 0, max: 59 },
  },

  notes: { max: 5_000 },

  link: {
    label: { min: 1, max: 120 },
    url: { min: 1, max: 2_048 },
    allowedProtocols: ['http:', 'https:'] as const,
  },

  review: {
    /** Required and non-blank for REQUEST_CHANGES (§7.5). */
    requestChangesComment: { min: 1, max: 2_000 },
    /** Optional for APPROVE (§7.5). */
    approveComment: { max: 2_000 },
  },

  audit: {
    /** Bounded metadata; never full report content or secrets (§14). */
    metadataBytes: 4_096,
  },
} as const;

/** Maximum rows per section in one report version (§6.8). */
export const SECTION_CAPS = {
  tasks: 100,
  nextWeekTasks: 100,
  blockers: 50,
  achievements: 50,
  timeEntries: 100,
  links: 25,
} as const;

/** Minimum rows required to submit (§6.8, Confirmed). */
export const SUBMISSION_MINIMUMS = {
  tasks: 1,
  nextWeekTasks: 1,
} as const;

/** At most one key flag per report version (§6.4, §6.5, Confirmed). */
export const KEY_FLAG_MAX_PER_VERSION = 1;

/** Request body ceiling for the report aggregate (§6.8). */
export const MAX_REQUEST_BODY_BYTES = 1_048_576; // 1 MiB

export const PAGINATION = {
  defaultPage: 1,
  defaultPageSize: 20,
  minPageSize: 1,
  maxPageSize: 100,
} as const;

/** Maximum reporting weeks addressable by one list request (§15.2). */
export const MAX_WEEK_RANGE = 52;

export const DASHBOARD = {
  /** Selected week plus the previous four (§8.3, Confirmed). */
  taskTrendWeeks: 5,
  /** Bounds on `recentLimit` for the member dashboard (§15.7). */
  recentReports: { min: 1, max: 10, default: 5 },
  /** DERIVED(§8.5): a current report is "approaching" within this window. */
  approachingDeadlineHours: 24,
  /** Percentages are rounded for display only (§8.2). */
  percentDisplayDecimals: 1,
} as const;

/** DERIVED(§9.3): member search debounce, milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Mandatory custom header on every browser mutation (§12.4). */
export const CSRF_HEADER_NAME = 'x-weekflow-request';
export const CSRF_HEADER_VALUE = '1';
