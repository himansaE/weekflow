'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import {
  TIME_CATEGORY_LABELS,
  TIME_CATEGORY_VALUES,
  formatMinutes,
  fromHoursMinutes,
  toHoursMinutes,
} from '@weekflow/shared';
import type { EligibleProject, ReportContentInput } from '@weekflow/shared';
import { Input } from '@/components/ui/input';
import {
  AddRowButton,
  FieldError,
  MobileFieldLabel,
  ProjectSelect,
  RemoveRowButton,
  SectionEmptyState,
} from './repeatable-section';

/**
 * Time Breakdown (§6.6). Entirely optional — a report submits fine with none.
 *
 * Entered as hours and minutes, stored as integer minutes. This total is a
 * *separate* self-reported view from the tasks' actual time: the two are never
 * added together, reconciled, or required to match. The comparison below is
 * informational, and a mismatch is not an error.
 */
export function TimeBreakdownSection({
  projects,
  readOnly,
}: {
  projects: EligibleProject[];
  readOnly: boolean;
}) {
  const { control, watch, formState } = useFormContext<ReportContentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'timeEntries' });
  const errors = formState.errors.timeEntries;

  const entries = watch('timeEntries') ?? [];
  const tasks = watch('tasks') ?? [];

  const categorizedTotal = entries.reduce((sum, row) => sum + (row?.minutes ?? 0), 0);
  const taskActualTotal = tasks.reduce((sum, row) => sum + (row?.actualMinutes ?? 0), 0);

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <SectionEmptyState message="No categorized time. This section is optional and never blocks submission." />
      )}

      {fields.map((field, index) => {
        const rowErrors = errors?.[index];

        return (
          <div
            key={field.id}
            className="space-y-3 rounded-md border p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px_40px] lg:items-end lg:gap-2 lg:space-y-0 lg:border-0 lg:p-0"
          >
            <div className="space-y-1">
              <MobileFieldLabel>Category</MobileFieldLabel>
              <Controller
                control={control}
                name={`timeEntries.${index}.category`}
                render={({ field: categoryField }) => (
                  <select
                    aria-label={`Time entry ${index + 1} category`}
                    className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                    disabled={readOnly}
                    value={categoryField.value ?? ''}
                    onChange={(event) =>
                      categoryField.onChange(event.target.value === '' ? null : event.target.value)
                    }
                  >
                    <option value="">—</option>
                    {TIME_CATEGORY_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {TIME_CATEGORY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                )}
              />
              <FieldError message={rowErrors?.category?.message} />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Project (optional)</MobileFieldLabel>
              <Controller
                control={control}
                name={`timeEntries.${index}.projectId`}
                render={({ field: projectField }) => (
                  <ProjectSelect
                    id={`time-${index}-project`}
                    projects={projects}
                    value={projectField.value}
                    onChange={projectField.onChange}
                    allowNone
                    disabled={readOnly}
                  />
                )}
              />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Duration</MobileFieldLabel>
              <Controller
                control={control}
                name={`timeEntries.${index}.minutes`}
                render={({ field: minutesField }) => {
                  // Hours/minutes is a display concern; the value stays integer
                  // minutes so nothing is lost in the round trip (§6.6).
                  const total = minutesField.value ?? 0;
                  const { hours, minutes } = toHoursMinutes(total);

                  return (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        inputMode="numeric"
                        aria-label={`Time entry ${index + 1} hours`}
                        disabled={readOnly}
                        value={hours}
                        onChange={(event) =>
                          minutesField.onChange(
                            fromHoursMinutes(clamp(event.target.value, 0, 168), minutes),
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        className="w-20"
                        inputMode="numeric"
                        aria-label={`Time entry ${index + 1} minutes`}
                        disabled={readOnly}
                        value={minutes}
                        onChange={(event) =>
                          minutesField.onChange(
                            fromHoursMinutes(hours, clamp(event.target.value, 0, 59)),
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">m</span>
                    </div>
                  );
                }}
              />
              <FieldError message={rowErrors?.minutes?.message} />
            </div>

            <div className="flex justify-end">
              <RemoveRowButton
                onClick={() => remove(index)}
                label={`Remove time entry ${index + 1}`}
                disabled={readOnly}
              />
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <AddRowButton
          label="Add time entry"
          onClick={() => append({ category: null, minutes: 0, projectId: null })}
        />
      )}

      {fields.length > 0 && (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Categorized total <strong>{formatMinutes(categorizedTotal)}</strong> · task actual time{' '}
          <strong>{formatMinutes(taskActualTotal)}</strong>.{' '}
          {categorizedTotal !== taskActualTotal &&
            'These are separate self-reported views and do not have to match.'}
        </div>
      )}
    </div>
  );
}

function clamp(raw: string, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
