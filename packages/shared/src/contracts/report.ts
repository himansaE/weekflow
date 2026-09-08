import { z } from 'zod';
import type { ReportAction } from './api';
import type { ReportStatus, SubmissionState } from '../enums';
import type { ReportContentView } from './report-content';
import { draftContentSchema } from './report-content';
import { expectedRevisionSchema } from './admin';

/** Report commands and views — specification §15.6. */

const weekStartSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD');

/**
 * Creation carries `submit`, so a member who fills the form and presses Submit
 * gets one atomic create-and-submit rather than an artificial save first (D115).
 * The submit path is wired in M6.
 */
export const createReportSchema = z.object({
  weekStart: weekStartSchema,
  content: draftContentSchema,
  submit: z.boolean().default(false),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

/**
 * Draft saves carry both concurrency tokens.
 *
 * `expectedRevision` catches "the report changed"; `expectedVersionId` catches
 * the more specific and more dangerous case — the manager requested changes
 * while this tab was open, so the version being edited is no longer the editable
 * one, and saving would write into a frozen version (§16.2).
 */
export const saveDraftSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  expectedVersionId: z.uuid(),
  content: draftContentSchema,
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export interface ReportVersionView {
  id: string;
  versionNumber: number;
  submittedAt: string | null;
  content: ReportContentView;
}

export interface ReportVersionSummary {
  id: string;
  versionNumber: number;
  submittedAt: string | null;
}

export interface ReportView {
  id: string;
  owner: { id: string; fullName: string; email: string };
  weekStart: string;
  weekEnd: string;
  deadlineAt: string;
  timezone: string;
  status: ReportStatus;
  /** Always derived, never stored (§4.2). */
  submissionState: SubmissionState;
  firstSubmittedAt: string | null;
  latestSubmittedAt: string | null;
  revision: number;
  /** The version this actor is authorized to see (§7.4). */
  displayVersion: ReportVersionView;
  /** Present for the owner only; absent for a manager viewing a submitted report. */
  editableVersionId: string | null;
  allowedActions: ReportAction[];
}

/**
 * The editor's context for a week.
 *
 * `report: null` means nothing is persisted yet — opening the editor must not
 * create anything (§7, D114), so this is how "Not Started" is represented.
 */
export interface WeeklyReportContext {
  weekStart: string;
  weekEnd: string;
  deadlineAt: string;
  timezone: string;
  submissionState: SubmissionState;
  report: ReportView | null;
  allowedActions: ReportAction[];
}

export interface ReportListItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  deadlineAt: string;
  status: ReportStatus;
  submissionState: SubmissionState;
  firstSubmittedAt: string | null;
  latestSubmittedAt: string | null;
  projects: { id: string; name: string }[];
}

/** An empty aggregate, used to seed a brand-new editor form. */
export function emptyReportContent(): ReportContentView {
  return {
    tasks: [],
    nextWeekTasks: [],
    blockers: [],
    achievements: [],
    timeEntries: [],
    notes: null,
    links: [],
  };
}
