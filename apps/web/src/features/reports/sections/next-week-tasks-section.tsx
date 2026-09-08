'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { PRIORITY_VALUES } from '@weekflow/shared';
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

const PRIORITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

/**
 * Next Week Tasks (§6.3) — name, project and priority only.
 *
 * Project eligibility is judged against the *report's* week, not next week: a
 * plan row is not a reservation of a future assignment (§5.2).
 */
export function NextWeekTasksSection({
  projects,
  readOnly,
}: {
  projects: EligibleProject[];
  readOnly: boolean;
}) {
  const { control, register, formState } = useFormContext<ReportContentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'nextWeekTasks' });
  const errors = formState.errors.nextWeekTasks;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <SectionEmptyState message="No plans yet. At least one is required to submit." />
      )}

      {fields.map((field, index) => {
        const rowErrors = errors?.[index];

        return (
          <div
            key={field.id}
            className="space-y-3 rounded-md border p-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_120px_40px] lg:items-start lg:gap-2 lg:space-y-0 lg:border-0 lg:p-0"
          >
            <div className="space-y-1">
              <MobileFieldLabel>Task</MobileFieldLabel>
              <Input
                aria-label={`Next week task ${index + 1} name`}
                disabled={readOnly}
                aria-invalid={Boolean(rowErrors?.taskName)}
                {...register(`nextWeekTasks.${index}.taskName`)}
              />
              <FieldError message={rowErrors?.taskName?.message} />
            </div>

            <div className="space-y-1">
              <MobileFieldLabel>Project</MobileFieldLabel>
              <Controller
                control={control}
                name={`nextWeekTasks.${index}.projectId`}
                render={({ field: projectField }) => (
                  <ProjectSelect
                    id={`next-${index}-project`}
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
                aria-label={`Next week task ${index + 1} priority`}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                disabled={readOnly}
                {...register(`nextWeekTasks.${index}.priority`)}
              >
                <option value="">—</option>
                {PRIORITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end lg:pt-1">
              <RemoveRowButton
                onClick={() => remove(index)}
                label={`Remove next week task ${index + 1}`}
                disabled={readOnly}
              />
            </div>
          </div>
        );
      })}

      <FieldError message={typeof errors?.message === 'string' ? errors.message : undefined} />

      {!readOnly && (
        <AddRowButton
          label="Add planned task"
          onClick={() => append({ taskName: null, projectId: null, priority: null })}
        />
      )}
    </div>
  );
}
