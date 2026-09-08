'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { EligibleProject } from '@weekflow/shared';
import { Button } from '@/components/ui/button';

/**
 * Shared scaffolding for the repeatable sections (§9.2).
 *
 * The desktop/mobile split lives here rather than in each section: on wide
 * screens rows are a grid, on narrow ones each row becomes a stacked card. An
 * editable form must never require horizontal scrolling (§10), which is the
 * whole reason for the second layout.
 */

export function SectionEmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}

export function AddRowButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Plus className="mr-1 size-4" aria-hidden />
      {label}
    </Button>
  );
}

export function RemoveRowButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}

/**
 * A project picker over the member's eligible projects for *this* week.
 *
 * Archived or formerly assigned projects appear with an explanation rather than
 * being hidden — they are legitimately reportable for a historical week (§5.3).
 */
export function ProjectSelect({
  projects,
  value,
  onChange,
  id,
  allowNone,
  disabled,
  invalid,
}: {
  projects: EligibleProject[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  id: string;
  allowNone?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <select
      id={id}
      className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
      value={value ?? ''}
      aria-invalid={invalid}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
    >
      <option value="">{allowNone ? 'General / no project' : 'Select a project…'}</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
          {!project.isCurrentlyActive
            ? ' (archived)'
            : !project.isCurrentlyAssigned
              ? ' (no longer assigned)'
              : ''}
        </option>
      ))}
    </select>
  );
}

/** Row label shown only on narrow screens, where there is no column header. */
export function MobileFieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted-foreground lg:hidden">{children}</span>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
