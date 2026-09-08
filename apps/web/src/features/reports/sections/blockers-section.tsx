'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { BLOCKER_STATUS_VALUES } from '@weekflow/shared';
import type { EligibleProject, ReportContentInput } from '@weekflow/shared';
import { Textarea } from '@/components/ui/textarea';
import {
  AddRowButton,
  FieldError,
  MobileFieldLabel,
  ProjectSelect,
  RemoveRowButton,
  SectionEmptyState,
} from './repeatable-section';

const STATUS_LABEL: Record<string, string> = { OPEN: 'Open', RESOLVED: 'Resolved' };

/**
 * Blockers (§6.4). Optional section — zero blockers is a valid week.
 *
 * At most one row can be the Key Issue, so the control is a radio group: picking
 * one clears the previous automatically, which is the same rule the database
 * enforces with a partial unique index.
 */
export function BlockersSection({
  projects,
  readOnly,
}: {
  projects: EligibleProject[];
  readOnly: boolean;
}) {
  const { control, register, setValue, watch, formState } = useFormContext<ReportContentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'blockers' });
  const errors = formState.errors.blockers;
  const rows = watch('blockers');

  const selectKeyIssue = (index: number) => {
    fields.forEach((_, i) =>
      setValue(`blockers.${i}.isKeyIssue`, i === index, { shouldDirty: true }),
    );
  };

  const clearKeyIssue = () => {
    fields.forEach((_, i) => setValue(`blockers.${i}.isKeyIssue`, false, { shouldDirty: true }));
  };

  const hasKeyIssue = rows?.some((row) => row?.isKeyIssue) ?? false;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <SectionEmptyState message="No blockers this week. This section is optional." />
      )}

      {fields.map((field, index) => {
        const rowErrors = errors?.[index];

        return (
          <div key={field.id} className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <MobileFieldLabel>Description</MobileFieldLabel>
              <Textarea
                rows={2}
                aria-label={`Blocker ${index + 1} description`}
                disabled={readOnly}
                aria-invalid={Boolean(rowErrors?.description)}
                {...register(`blockers.${index}.description`)}
              />
              <FieldError message={rowErrors?.description?.message} />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
              <div className="space-y-1">
                <MobileFieldLabel>Project (optional)</MobileFieldLabel>
                <Controller
                  control={control}
                  name={`blockers.${index}.projectId`}
                  render={({ field: projectField }) => (
                    <ProjectSelect
                      id={`blocker-${index}-project`}
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
                <MobileFieldLabel>Status</MobileFieldLabel>
                <select
                  aria-label={`Blocker ${index + 1} status`}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                  disabled={readOnly}
                  {...register(`blockers.${index}.status`)}
                >
                  <option value="">—</option>
                  {BLOCKER_STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="key-issue"
                    className="size-4"
                    disabled={readOnly}
                    checked={rows?.[index]?.isKeyIssue ?? false}
                    onChange={() => selectKeyIssue(index)}
                  />
                  Key issue
                </label>
                <RemoveRowButton
                  onClick={() => remove(index)}
                  label={`Remove blocker ${index + 1}`}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        );
      })}

      <FieldError message={typeof errors?.message === 'string' ? errors.message : undefined} />

      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && (
          <AddRowButton
            label="Add blocker"
            onClick={() =>
              append({ description: null, projectId: null, status: 'OPEN', isKeyIssue: false })
            }
          />
        )}
        {/* A radio group cannot be un-picked, so "no key issue" needs its own control. */}
        {hasKeyIssue && !readOnly && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4"
            onClick={clearKeyIssue}
          >
            Clear key issue
          </button>
        )}
      </div>
    </div>
  );
}
