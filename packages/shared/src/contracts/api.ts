/** Transport envelopes and error codes — specification §15.1. */

export interface ApiSuccess<T> {
  data: T;
  /** Present on responses whose meaning depends on evaluation time or filters. */
  context?: ResponseContext;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiList<T> {
  data: T[];
  meta: PaginationMeta;
  context?: ResponseContext;
}

/**
 * Every derived value (submission state, compliance, overdue) depends on a single
 * evaluation instant. It is returned so the client never recomputes it from its
 * own clock (§4.4, §15.7).
 */
export interface ResponseContext {
  /** The one instant the whole response was evaluated against. */
  asOf: string;
  timezone?: string;
  weekStart?: string;
  memberId?: string | null;
  projectId?: string | null;
  /** Analytics always read the latest submitted version (§8.1). */
  source?: 'LATEST_SUBMITTED_VERSION';
}

export interface ApiFieldError {
  /** Dotted path into the request body, e.g. `content.tasks.0.projectId`. */
  path: string;
  message: string;
}

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: ApiFieldError[];
    requestId: string;
  };
}

export const ApiErrorCode = {
  /** 400 — malformed shape, query or date. */
  BAD_REQUEST: 'BAD_REQUEST',
  /** 422 — well-formed but fails report/business validation. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** 401 — absent, invalid, expired session, or a deactivated account. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** 403 — role restriction. */
  FORBIDDEN: 'FORBIDDEN',
  /** 403 — CSRF origin policy, rejected before any write (§12.4). */
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  /** 403 — missing mandatory custom header (§12.4). */
  REQUEST_HEADER_REQUIRED: 'REQUEST_HEADER_REQUIRED',
  /** 404 — absent, or present but not visible to this actor (§3.2). */
  NOT_FOUND: 'NOT_FOUND',
  /** 409 — a report already exists for this owner and week. */
  REPORT_ALREADY_EXISTS: 'REPORT_ALREADY_EXISTS',
  /** 409 — optimistic concurrency: the report changed under the caller. */
  STALE_REPORT: 'STALE_REPORT',
  /** 409 — another manager already reviewed this version (§16.2). */
  REPORT_ALREADY_REVIEWED: 'REPORT_ALREADY_REVIEWED',
  /** 409 — the requested transition is not legal from the current state. */
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  /** 409 — duplicate email or project name. */
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  /** 429 — rate limited. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** 500 — sanitized unexpected failure. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** Actions the current actor may take on a report, computed server-side (§15.6). */
export const ReportAction = {
  SAVE_DRAFT: 'SAVE_DRAFT',
  SUBMIT: 'SUBMIT',
  RESUBMIT: 'RESUBMIT',
  APPROVE: 'APPROVE',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
} as const;
export type ReportAction = (typeof ReportAction)[keyof typeof ReportAction];

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}
