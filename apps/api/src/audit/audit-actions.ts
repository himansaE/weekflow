/**
 * The audit event catalogue — specification §14.
 *
 * `managerFeed` marks the events that appear in the manager's Recent Activity.
 * Draft saves are recorded but excluded: they are frequent, and surfacing them
 * would leak how a member is progressing through a private draft (§7.4).
 */

export const AuditAction = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_CREATED: 'USER_CREATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',

  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  PROJECT_REACTIVATED: 'PROJECT_REACTIVATED',
  PROJECT_MEMBER_ASSIGNED: 'PROJECT_MEMBER_ASSIGNED',
  PROJECT_MEMBER_REMOVED: 'PROJECT_MEMBER_REMOVED',

  REPORT_CREATED: 'REPORT_CREATED',
  REPORT_DRAFT_SAVED: 'REPORT_DRAFT_SAVED',
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
  REPORT_RESUBMITTED: 'REPORT_RESUBMITTED',
  REPORT_CHANGES_REQUESTED: 'REPORT_CHANGES_REQUESTED',
  REPORT_APPROVED: 'REPORT_APPROVED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntityType = {
  USER: 'User',
  PROJECT: 'Project',
  PROJECT_MEMBER: 'ProjectMember',
  REPORT: 'Report',
} as const;
export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];

/** Events the manager Recent Activity feed may show (§8.4). */
export const MANAGER_FEED_ACTIONS: ReadonlySet<AuditAction> = new Set([
  AuditAction.USER_REGISTERED,
  AuditAction.USER_CREATED,
  AuditAction.USER_ROLE_CHANGED,
  AuditAction.USER_DEACTIVATED,
  AuditAction.USER_REACTIVATED,
  AuditAction.PROJECT_CREATED,
  AuditAction.PROJECT_UPDATED,
  AuditAction.PROJECT_ARCHIVED,
  AuditAction.PROJECT_REACTIVATED,
  AuditAction.PROJECT_MEMBER_ASSIGNED,
  AuditAction.PROJECT_MEMBER_REMOVED,
  AuditAction.REPORT_SUBMITTED,
  AuditAction.REPORT_RESUBMITTED,
  AuditAction.REPORT_CHANGES_REQUESTED,
  AuditAction.REPORT_APPROVED,
]);
