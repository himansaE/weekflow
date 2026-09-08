'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { LIMITS } from '@weekflow/shared';
import type { ReportContentInput } from '@weekflow/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AddRowButton,
  FieldError,
  MobileFieldLabel,
  RemoveRowButton,
  SectionEmptyState,
} from './repeatable-section';

/**
 * Notes & Links (§6.7). Optional.
 *
 * Links are validated on submit against an allowlist of `http:`/`https:` — a
 * stored `javascript:` href would be a stored XSS vector the moment anything
 * rendered it. The rule lives in the shared schema, so this form and the API
 * apply exactly the same check.
 */
export function NotesAndLinksSection({ readOnly }: { readOnly: boolean }) {
  const { control, register, watch, formState } = useFormContext<ReportContentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'links' });
  const errors = formState.errors.links;

  const notes = watch('notes') ?? '';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="report-notes">Notes</Label>
        <Textarea
          id="report-notes"
          rows={4}
          placeholder="Anything else worth recording this week."
          disabled={readOnly}
          {...register('notes')}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <FieldError message={formState.errors.notes?.message} />
          <span>
            {notes.length} / {LIMITS.notes.max}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Links</Label>

        {fields.length === 0 && <SectionEmptyState message="No links added." />}

        {fields.map((field, index) => {
          const rowErrors = errors?.[index];

          return (
            <div
              key={field.id}
              className="space-y-3 rounded-md border p-3 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_40px] sm:items-start sm:gap-2 sm:space-y-0 sm:border-0 sm:p-0"
            >
              <div className="space-y-1">
                <MobileFieldLabel>Label</MobileFieldLabel>
                <Input
                  aria-label={`Link ${index + 1} label`}
                  disabled={readOnly}
                  aria-invalid={Boolean(rowErrors?.label)}
                  {...register(`links.${index}.label`)}
                />
                <FieldError message={rowErrors?.label?.message} />
              </div>

              <div className="space-y-1">
                <MobileFieldLabel>URL</MobileFieldLabel>
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  aria-label={`Link ${index + 1} URL`}
                  disabled={readOnly}
                  aria-invalid={Boolean(rowErrors?.url)}
                  {...register(`links.${index}.url`)}
                />
                <FieldError message={rowErrors?.url?.message} />
              </div>

              <div className="flex justify-end sm:pt-1">
                <RemoveRowButton
                  onClick={() => remove(index)}
                  label={`Remove link ${index + 1}`}
                  disabled={readOnly}
                />
              </div>
            </div>
          );
        })}

        {!readOnly && (
          <AddRowButton label="Add link" onClick={() => append({ label: null, url: null })} />
        )}
      </div>
    </div>
  );
}
