'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { PRIORITY_VALUES, TASK_STATUS_VALUES, TaskStatus } from '@weekflow/shared';
import type { EligibleProject, ReportContentInput } from '@weekflow/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AddRowButton,
  FieldError,
  MobileFieldLabel,
  ProjectSelect,
  RemoveRowButton,
  SectionEmptyState,
} from './repeatable-section';

const TITLE_CASE: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
};

/**
 * Completed / Current Tasks (§6.2).
 *
 * Planned and actual percentages are independent — planning 100% and achieving
 * 70% is a normal week. Nothing here derives one field from another: no computing
 * actual% from time, no flipping status when a percentage changes. A visibly odd
 * combination gets a non-blocking hint, never a hard rejection.
 */
export function TasksSection({
  projects,
  readOnly,
}: {
  projects: EligibleProject[];
  readOnly: boolean;
}) {
  const { control, register, watch, formState } = useFormContext<ReportContentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'tasks' });
  const errors = formState.errors.tasks;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <SectionEmptyState message="No tasks yet. At least one is required to submit." />
      )}

      {/* Column headers exist only where the grid does. */}
      {fields.length > 0 && (
        <div className="hidden gap-2 border-b pb-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_90px_90px_120px_100px_100px_40px]">
          <span>Task</span>
          <span>Project</span>
          <span>Priority</span>
          <span>Planned %</span>
          <span>Actual %</span>
          <span>Status</span>
          <span>Planned time</span>
          <span>Actual time</span>
          <span className="sr-only">Actions</span>
        </div>
      )}

      {fields.map((field, index) => {
        const rowErrors = errors?.[index];
        const status = watch(`tasks.${index}.status`);
        const actual = watch(`tasks.${index}.actualPercent`);
        // A hint, not a rule (§6.2).
        const inconsistent =
          status === TaskStatus.COMPLETED && typeof actual === 'number' && actual < 100;

        return (
          <div
            key={field.id}
            className="space-y-3 rounded-md border p-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_90px_90px_120px_100px_100px_40px] lg:items-start lg:gap-2 lg:space-y-0 lg:border-0 lg:p-0"
          >
            <div className="space-y-1">
              <MobileFieldLabel>Task</MobileFieldLabel>
              <Input
                aria-label={`Task ${index + 1} name`}
                disabled={readOnly}
                aria-invalid={Boolean(rowErrors?.taskName)}
                {...register(`tasks.${index}.taskName`)}
              />
              <FieldError message={rowErrors?.taskName?.message} />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Project</MobileFieldLabel>
              <Controller
                control={control}
                name={`tasks.${index}.projectId`}
                render={({ field: projectField }) => (
                  <ProjectSelect
                    id={`task-${index}-project`}
                    projects={projects}
                    value={projectField.value}
                    onChange={projectField.onChange}
                    disabled={readOnly}
                    invalid={Boolean(rowErrors?.projectId)}
                  />
                )}
              />
              <FieldError message={rowErrors?.projectId?.message} />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Priority</MobileFieldLabel>
              <select
                aria-label={`Task ${index + 1} priority`}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                disabled={readOnly}
                {...register(`tasks.${index}.priority`)}
              >
                <option value="">—</option>
                {PRIORITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {TITLE_CASE[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Planned %</MobileFieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                aria-label={`Task ${index + 1} planned percent`}
                disabled={readOnly}
                {...register(`tasks.${index}.plannedPercent`, { setValueAs: toNullableInt })}
              />
              <FieldError message={rowErrors?.plannedPercent?.message} />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Actual %</MobileFieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                aria-label={`Task ${index + 1} actual percent`}
                disabled={readOnly}
                {...register(`tasks.${index}.actualPercent`, { setValueAs: toNullableInt })}
              />
              <FieldError message={rowErrors?.actualPercent?.message} />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Status</MobileFieldLabel>
              <select
                aria-label={`Task ${index + 1} status`}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                disabled={readOnly}
                {...register(`tasks.${index}.status`)}
              >
                <option value="">—</option>
                {TASK_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {TITLE_CASE[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Planned time (min)</MobileFieldLabel>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`Task ${index + 1} planned minutes`}
                disabled={readOnly}
                {...register(`tasks.${index}.plannedMinutes`, { setValueAs: toNullableInt })}
              />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Actual time (min)</MobileFieldLabel>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`Task ${index + 1} actual minutes`}
                disabled={readOnly}
                {...register(`tasks.${index}.actualMinutes`, { setValueAs: toNullableInt })}
              />
            </div>

            <div className="flex justify-end lg:pt-1">
              <RemoveRowButton
                onClick={() => remove(index)}
                label={`Remove task ${index + 1}`}
                disabled={readOnly}
              />
            </div>

            {/* Deliverable needs a full row in both layouts. */}
            <div className="space-y-1 lg:col-span-9">
              <Label htmlFor={`task-${index}-deliverable`} className="text-xs">
                Deliverable
              </Label>
              <Textarea
                id={`task-${index}-deliverable`}
                rows={2}
                placeholder="What was produced — or what progress was made and why it is unfinished."
                disabled={readOnly}
                aria-invalid={Boolean(rowErrors?.deliverable)}
                {...register(`tasks.${index}.deliverable`)}
              />
              <FieldError message={rowErrors?.deliverable?.message} />
              {inconsistent && (
                <p className="text-xs text-muted-foreground">
                  Marked completed with actual progress under 100% — allowed, just double-check.
                </p>
              )}
            </div>
          </div>
        );
      })}

      <FieldError message={typeof errors?.message === 'string' ? errors.message : undefined} />

      {!readOnly && (
        <AddRowButton
          label="Add task"
          onClick={() =>
            append({
              taskName: null,
              projectId: null,
              priority: null,
              plannedPercent: null,
              actualPercent: null,
              status: null,
              plannedMinutes: null,
              actualMinutes: null,
              deliverable: null,
            })
          }
        />
      )}
    </div>
  );
}

/**
 * An empty number input is "not answered", which is null — not zero. Coercing it
 * to 0 would silently claim the member reported zero (§6.8).
 */
function toNullableInt(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
