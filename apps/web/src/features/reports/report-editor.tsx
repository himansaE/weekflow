'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { draftContentSchema, REPORT_SECTIONS, emptyReportContent } from '@weekflow/shared';
import type { EligibleProject, ReportContentInput, ReportView } from '@weekflow/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toApiFailure } from '@/lib/api-client';
import { listEligibleProjects } from '@/features/admin/api';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { createReport, fetchWeeklyContext, saveDraft } from './api';
import { TasksSection } from './sections/tasks-section';
import { NextWeekTasksSection } from './sections/next-week-tasks-section';
import { BlockersSection } from './sections/blockers-section';
import { AchievementsSection } from './sections/achievements-section';
import { TimeBreakdownSection } from './sections/time-breakdown-section';
import { NotesAndLinksSection } from './sections/notes-and-links-section';
import { SubmissionStateBadge, WorkflowBadge } from './status-badges';

/**
 * The weekly report editor (§9.2, §23 of the original scope).
 *
 * A single page with the six fixed sections in fixed order — not a wizard. The
 * member can fill them in any order and save at any point, which is what makes a
 * draft useful.
 *
 * Opening this page persists nothing: the report is created by the first save
 * (D114), so `context.report === null` is a real state rather than an empty
 * record somebody has to clean up.
 */
export function ReportEditor({ weekStart }: { weekStart?: string }) {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  const contextQuery = useQuery({
    queryKey: ['report-context', weekStart ?? 'current'],
    queryFn: () => fetchWeeklyContext(weekStart),
  });

  const context = contextQuery.data;
  const report = context?.report ?? null;

  const projectsQuery = useQuery({
    queryKey: ['eligible-projects', context?.weekStart],
    queryFn: () => listEligibleProjects(context!.weekStart),
    enabled: Boolean(context?.weekStart),
  });

  const form = useForm<ReportContentInput>({
    resolver: zodResolver(draftContentSchema),
    defaultValues: emptyReportContent() as ReportContentInput,
  });

  /**
   * A successful save becomes the new baseline for dirty tracking (§9.2), so the
   * unsaved-changes warning stops firing once the work is safe.
   */
  const resetTo = (content: ReportContentInput) => form.reset(content, { keepErrors: false });

  useEffect(() => {
    if (!context) return;
    resetTo((report?.displayVersion.content ?? emptyReportContent()) as ReportContentInput);
    // Re-seed only when the loaded report identity changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, report?.revision, context?.weekStart]);

  const isDirty = form.formState.isDirty;
  useUnsavedChangesWarning(isDirty);

  const save = useMutation({
    mutationFn: async (content: ReportContentInput): Promise<ReportView> => {
      if (!context) throw new Error('No editor context loaded.');

      // First save creates the aggregate; later ones patch the editable version.
      if (!report) {
        return createReport({ weekStart: context.weekStart, content });
      }

      return saveDraft(report.id, {
        expectedRevision: report.revision,
        expectedVersionId: report.editableVersionId ?? report.displayVersion.id,
        content,
      });
    },
    onMutate: () => setSaveError(null),
    onSuccess: (saved) => {
      setLastSavedAt(new Date());
      // The server's canonical content carries the real row ids back, so the next
      // save updates rows rather than duplicating them.
      resetTo(saved.displayVersion.content as ReportContentInput);
      void queryClient.invalidateQueries({ queryKey: ['report-context'] });
      void queryClient.invalidateQueries({ queryKey: ['my-reports'] });
    },
    onError: (error) => {
      const failure = toApiFailure(error);
      setSaveError(failure.message);

      // Field errors from the server land on their fields, so the message appears
      // where the problem is rather than only at the top (§9.2).
      failure.fieldErrors?.forEach((fieldError) => {
        const path = fieldError.path.replace(/^content\./, '');
        form.setError(path as never, { message: fieldError.message });
      });

      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });

  if (contextQuery.isLoading || !context) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const projects: EligibleProject[] = projectsQuery.data ?? [];
  const readOnly = !context.allowedActions.includes('SAVE_DRAFT');

  return (
    <FormProvider {...form}>
      <div ref={formTopRef} className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">My Weekly Report</h1>
            {report && <WorkflowBadge status={report.status} />}
            <SubmissionStateBadge state={context.submissionState} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatWeek(context.weekStart, context.weekEnd)} · due{' '}
            {new Date(context.deadlineAt).toLocaleString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {report && ` · version ${report.displayVersion.versionNumber}`}
          </p>
        </header>

        {projects.length === 0 && !projectsQuery.isLoading && (
          <Alert>
            <AlertDescription>
              You have no projects available for this week. Ask a manager to assign you to one —
              tasks require a project.
            </AlertDescription>
          </Alert>
        )}

        {saveError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <form
          noValidate
          className="space-y-6"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
        >
          <Section index={0}>
            <TasksSection projects={projects} readOnly={readOnly} />
          </Section>
          <Section index={1}>
            <NextWeekTasksSection projects={projects} readOnly={readOnly} />
          </Section>
          <Section index={2}>
            <BlockersSection projects={projects} readOnly={readOnly} />
          </Section>
          <Section index={3}>
            <AchievementsSection projects={projects} readOnly={readOnly} />
          </Section>
          <Section index={4}>
            <TimeBreakdownSection projects={projects} readOnly={readOnly} />
          </Section>
          <Section index={5}>
            <NotesAndLinksSection readOnly={readOnly} />
          </Section>

          {!readOnly && (
            <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save draft'}
              </Button>

              <p className="text-xs text-muted-foreground" aria-live="polite">
                {isDirty
                  ? 'Unsaved changes'
                  : lastSavedAt
                    ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
                    : 'No changes yet'}
              </p>

              <Badge variant="outline" className="ml-auto">
                Submitting arrives in M6
              </Badge>
            </div>
          )}
        </form>
      </div>
    </FormProvider>
  );
}

/** Numbered card wrapper, so the fixed section order is visible (§6.1). */
function Section({ index, children }: { index: number; children: React.ReactNode }) {
  const section = REPORT_SECTIONS[index]!;

  return (
    <Card id={`section-${section.key}`}>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="mr-2 text-muted-foreground">{index + 1}.</span>
          {section.label}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function formatWeek(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}
