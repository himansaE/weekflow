import { z } from 'zod';
import {
  BLOCKER_STATUS_VALUES,
  PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  TIME_CATEGORY_VALUES,
} from '../enums';
import type { BlockerStatus, Priority, TaskStatus, TimeCategory } from '../enums';
import { LIMITS, SECTION_CAPS, SUBMISSION_MINIMUMS } from '../validation-limits';

/**
 * Report content — specification §6.
 *
 * One shape, two validation profiles (§6.8):
 *
 * - **draft** — bounded but permissive. A half-finished row saves fine; what is
 *   present must still be valid, so a draft can never hold a 400% completion or
 *   an unknown enum.
 * - **submit** — every required value present.
 *
 * Both are built from the same field definitions below, so a bound can only be
 * changed in one place and the two profiles cannot drift apart.
 */

// ─── shared field pieces ─────────────────────────────────────────────────────

/** Present-but-blank is normalized to null on save, so `''` never reaches a column. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .nullable()
    .optional();

const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(min, `${label} is required`).max(max, `${label} is too long`));

const percent = z.number().int().min(0).max(100);
const minutes = z.number().int().min(0).max(LIMITS.task.minutes.max);

/** A new row omits `id`; a saved row carries the server UUID (§15.5). */
const rowId = z.uuid().optional();

const priority = z.enum(PRIORITY_VALUES as [Priority, ...Priority[]]);
const taskStatus = z.enum(TASK_STATUS_VALUES as [TaskStatus, ...TaskStatus[]]);
const blockerStatus = z.enum(BLOCKER_STATUS_VALUES as [BlockerStatus, ...BlockerStatus[]]);
const timeCategory = z.enum(TIME_CATEGORY_VALUES as [TimeCategory, ...TimeCategory[]]);

/**
 * Links must be absolute http(s) with no embedded credentials (§6.7).
 *
 * `javascript:` and `data:` are the reason this is a allowlist of schemes rather
 * than a general URL check — a stored `javascript:` href is a stored XSS vector
 * the moment anything renders it.
 */
const safeUrl = z
  .string()
  .trim()
  .min(1, 'URL is required')
  .max(LIMITS.link.url.max)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (LIMITS.link.allowedProtocols as readonly string[]).includes(url.protocol) &&
        url.username === '' &&
        url.password === ''
      );
    } catch {
      return false;
    }
  }, 'Enter a full http:// or https:// address');

// ─── row schemas, per profile ────────────────────────────────────────────────

const taskShape = {
  id: rowId,
  taskName: LIMITS.task.taskName,
  deliverable: LIMITS.task.deliverable,
};

const draftTask = z.object({
  id: rowId,
  taskName: optionalText(taskShape.taskName.max),
  projectId: z.uuid().nullable().optional(),
  priority: priority.nullable().optional(),
  plannedPercent: percent.nullable().optional(),
  actualPercent: percent.nullable().optional(),
  status: taskStatus.nullable().optional(),
  plannedMinutes: minutes.nullable().optional(),
  actualMinutes: minutes.nullable().optional(),
  deliverable: optionalText(taskShape.deliverable.max),
});

const submitTask = z.object({
  id: rowId,
  taskName: requiredText(taskShape.taskName.min, taskShape.taskName.max, 'Task name'),
  projectId: z.uuid('Select a project'),
  priority,
  // Independent by design: planning 100% and achieving 70% is a normal week,
  // not a validation error (§6.2).
  plannedPercent: percent,
  actualPercent: percent,
  status: taskStatus,
  plannedMinutes: minutes,
  actualMinutes: minutes,
  deliverable: requiredText(taskShape.deliverable.min, taskShape.deliverable.max, 'Deliverable'),
});

const draftNextWeekTask = z.object({
  id: rowId,
  taskName: optionalText(LIMITS.nextWeekTask.taskName.max),
  projectId: z.uuid().nullable().optional(),
  priority: priority.nullable().optional(),
});

const submitNextWeekTask = z.object({
  id: rowId,
  taskName: requiredText(
    LIMITS.nextWeekTask.taskName.min,
    LIMITS.nextWeekTask.taskName.max,
    'Task name',
  ),
  projectId: z.uuid('Select a project'),
  priority,
});

const draftBlocker = z.object({
  id: rowId,
  description: optionalText(LIMITS.blocker.description.max),
  /** Null means a general, team-wide blocker rather than a project one (§6.4). */
  projectId: z.uuid().nullable().optional(),
  status: blockerStatus.nullable().optional(),
  isKeyIssue: z.boolean().optional(),
});

const submitBlocker = z.object({
  id: rowId,
  description: requiredText(
    LIMITS.blocker.description.min,
    LIMITS.blocker.description.max,
    'Blocker description',
  ),
  projectId: z.uuid().nullable().optional(),
  status: blockerStatus,
  isKeyIssue: z.boolean().optional(),
});

const draftAchievement = z.object({
  id: rowId,
  description: optionalText(LIMITS.achievement.description.max),
  projectId: z.uuid().nullable().optional(),
  isKeyAchievement: z.boolean().optional(),
});

const submitAchievement = z.object({
  id: rowId,
  description: requiredText(
    LIMITS.achievement.description.min,
    LIMITS.achievement.description.max,
    'Achievement description',
  ),
  projectId: z.uuid().nullable().optional(),
  isKeyAchievement: z.boolean().optional(),
});

const draftTimeEntry = z.object({
  id: rowId,
  category: timeCategory.nullable().optional(),
  /** Zero is a real answer while drafting; a submitted row must be positive (§6.6). */
  minutes: minutes.nullable().optional(),
  projectId: z.uuid().nullable().optional(),
});

const submitTimeEntry = z.object({
  id: rowId,
  category: timeCategory,
  minutes: z
    .number()
    .int()
    .min(LIMITS.timeEntry.submittedMinutes.min, 'Enter a duration greater than zero')
    .max(LIMITS.timeEntry.submittedMinutes.max),
  projectId: z.uuid().nullable().optional(),
});

const draftLink = z.object({
  id: rowId,
  label: optionalText(LIMITS.link.label.max),
  url: z.string().max(LIMITS.link.url.max).optional().nullable(),
});

const submitLink = z.object({
  id: rowId,
  label: requiredText(LIMITS.link.label.min, LIMITS.link.label.max, 'Link label'),
  url: safeUrl,
});

// ─── aggregate ───────────────────────────────────────────────────────────────

/**
 * The two profiles are written out rather than generated from a shared factory:
 * a generic helper erases each row type, and these refinements need to see the
 * actual fields they check.
 *
 * Every array is required, even when empty. A *missing* array is an error, not an
 * accidental clear — an empty one explicitly clears the section (§15.5).
 */
const notesSchema = z
  .string()
  .max(LIMITS.notes.max)
  .transform((value) => (value.trim().length === 0 ? null : value))
  .nullable();

export const draftContentSchema = z.object({
  tasks: z.array(draftTask).max(SECTION_CAPS.tasks),
  nextWeekTasks: z.array(draftNextWeekTask).max(SECTION_CAPS.nextWeekTasks),
  blockers: z
    .array(draftBlocker)
    .max(SECTION_CAPS.blockers)
    // At most one key issue per version (§6.4). The database enforces this too;
    // catching it here produces a usable field error rather than a constraint
    // violation surfacing as a 500.
    .refine((rows) => rows.filter((row) => row.isKeyIssue).length <= 1, {
      message: 'Only one blocker can be the key issue',
    }),
  achievements: z
    .array(draftAchievement)
    .max(SECTION_CAPS.achievements)
    .refine((rows) => rows.filter((row) => row.isKeyAchievement).length <= 1, {
      message: 'Only one achievement can be the key achievement',
    }),
  timeEntries: z.array(draftTimeEntry).max(SECTION_CAPS.timeEntries),
  notes: notesSchema,
  links: z.array(draftLink).max(SECTION_CAPS.links),
});

export const submitContentSchema = z.object({
  tasks: z
    .array(submitTask)
    .min(SUBMISSION_MINIMUMS.tasks, 'Add at least one current task before submitting')
    .max(SECTION_CAPS.tasks),
  nextWeekTasks: z
    .array(submitNextWeekTask)
    .min(SUBMISSION_MINIMUMS.nextWeekTasks, 'Add at least one next-week task before submitting')
    .max(SECTION_CAPS.nextWeekTasks),
  blockers: z
    .array(submitBlocker)
    .max(SECTION_CAPS.blockers)
    .refine((rows) => rows.filter((row) => row.isKeyIssue).length <= 1, {
      message: 'Only one blocker can be the key issue',
    }),
  achievements: z
    .array(submitAchievement)
    .max(SECTION_CAPS.achievements)
    .refine((rows) => rows.filter((row) => row.isKeyAchievement).length <= 1, {
      message: 'Only one achievement can be the key achievement',
    }),
  timeEntries: z.array(submitTimeEntry).max(SECTION_CAPS.timeEntries),
  notes: notesSchema,
  links: z.array(submitLink).max(SECTION_CAPS.links),
});

export type ReportContentInput = z.infer<typeof draftContentSchema>;
export type SubmittableContent = z.infer<typeof submitContentSchema>;

// ─── response shapes ─────────────────────────────────────────────────────────

export interface ReportTaskView {
  id: string;
  position: number;
  taskName: string | null;
  projectId: string | null;
  priority: Priority | null;
  plannedPercent: number | null;
  actualPercent: number | null;
  status: TaskStatus | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  deliverable: string | null;
}

export interface NextWeekTaskView {
  id: string;
  position: number;
  taskName: string | null;
  projectId: string | null;
  priority: Priority | null;
}

export interface BlockerView {
  id: string;
  position: number;
  description: string | null;
  projectId: string | null;
  status: BlockerStatus | null;
  isKeyIssue: boolean;
}

export interface AchievementView {
  id: string;
  position: number;
  description: string | null;
  projectId: string | null;
  isKeyAchievement: boolean;
}

export interface TimeEntryView {
  id: string;
  position: number;
  category: TimeCategory | null;
  minutes: number | null;
  projectId: string | null;
}

export interface ReportLinkView {
  id: string;
  position: number;
  label: string | null;
  url: string | null;
}

export interface ReportContentView {
  tasks: ReportTaskView[];
  nextWeekTasks: NextWeekTaskView[];
  blockers: BlockerView[];
  achievements: AchievementView[];
  timeEntries: TimeEntryView[];
  notes: string | null;
  links: ReportLinkView[];
}

/** The six fixed sections, in fixed order (§6.1). */
export const REPORT_SECTIONS = [
  { key: 'tasks', label: 'Completed / Current Tasks' },
  { key: 'nextWeekTasks', label: 'Next Week Tasks' },
  { key: 'blockers', label: 'Blockers' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'timeEntries', label: 'Time Breakdown' },
  { key: 'notesAndLinks', label: 'Notes & Links' },
] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number]['key'];

/** Minutes ⇄ hours/minutes, for the time inputs (§6.6). */
export function toHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function fromHoursMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/** "7h 30m" for display; charts may use decimals but the data stays integer minutes. */
export function formatMinutes(totalMinutes: number): string {
  const { hours, minutes } = toHoursMinutes(totalMinutes);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
