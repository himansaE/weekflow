'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
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

/**
 * Achievements (§6.5). Optional, with at most one Key Achievement — same radio
 * pattern and same reasoning as the Key Issue.
 *
 * Nothing here is inferred from completed tasks: an achievement is something the
 * member chose to record.
 */
export function AchievementsSection({
  projects,
  readOnly,
}: {
  projects: EligibleProject[];
  readOnly: boolean;
}) {
  const { control, register, setValue, watch, formState } = useFormContext<ReportContentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'achievements' });
  const errors = formState.errors.achievements;
  const rows = watch('achievements');

  const selectKey = (index: number) => {
    fields.forEach((_, i) =>
      setValue(`achievements.${i}.isKeyAchievement`, i === index, { shouldDirty: true }),
    );
  };

  const clearKey = () => {
    fields.forEach((_, i) =>
      setValue(`achievements.${i}.isKeyAchievement`, false, { shouldDirty: true }),
    );
  };

  const hasKey = rows?.some((row) => row?.isKeyAchievement) ?? false;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <SectionEmptyState message="Nothing recorded. This section is optional." />
      )}

      {fields.map((field, index) => {
        const rowErrors = errors?.[index];

        return (
          <div key={field.id} className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <MobileFieldLabel>Description</MobileFieldLabel>
              <Textarea
                rows={2}
                aria-label={`Achievement ${index + 1} description`}
                disabled={readOnly}
                aria-invalid={Boolean(rowErrors?.description)}
                {...register(`achievements.${index}.description`)}
              />
              <FieldError message={rowErrors?.description?.message} />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-1">
                <MobileFieldLabel>Project (optional)</MobileFieldLabel>
                <Controller
                  control={control}
                  name={`achievements.${index}.projectId`}
                  render={({ field: projectField }) => (
                    <ProjectSelect
                      id={`achievement-${index}-project`}
                      projects={projects}
                      value={projectField.value}
                      onChange={projectField.onChange}
                      allowNone
                      disabled={readOnly}
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="key-achievement"
                    className="size-4"
                    disabled={readOnly}
                    checked={rows?.[index]?.isKeyAchievement ?? false}
                    onChange={() => selectKey(index)}
                  />
                  Key achievement
                </label>
                <RemoveRowButton
                  onClick={() => remove(index)}
                  label={`Remove achievement ${index + 1}`}
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
            label="Add achievement"
            onClick={() => append({ description: null, projectId: null, isKeyAchievement: false })}
          />
        )}
        {hasKey && !readOnly && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4"
            onClick={clearKey}
          >
            Clear key achievement
          </button>
        )}
      </div>
    </div>
  );
}
