'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilterParams } from '@/hooks/use-filter-params';
import { Pagination } from '@/features/admin/pagination';
import { listMyReports } from './api';
import { SubmissionStateBadge, WorkflowBadge } from './status-badges';

/**
 * Report History (§9) — a page of its own, separate from the editor and the
 * dashboard, and server-side paginated.
 *
 * Workflow and submission state get their own columns rather than one merged
 * label, because they are independent (§4.2).
 */
export function ReportHistory() {
  const { setFilters, page } = useFilterParams();

  const reportsQuery = useQuery({
    queryKey: ['my-reports', page],
    queryFn: () => listMyReports(page),
  });

  const rows = reportsQuery.data?.data ?? [];
  const meta = reportsQuery.data?.meta;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Report History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every week you have started, newest first.
          </p>
        </div>
        <Button render={<Link href="/reports/current" />}>Current week</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Submission</TableHead>
              <TableHead className="text-right">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportsQuery.isLoading &&
              Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!reportsQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No reports yet. Start with the current week.
                </TableCell>
              </TableRow>
            )}

            {rows.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">
                  {formatWeek(report.weekStart, report.weekEnd)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {report.projects.length > 0
                    ? report.projects.map((project) => project.name).join(', ')
                    : '—'}
                </TableCell>
                <TableCell>
                  <WorkflowBadge status={report.status} />
                </TableCell>
                <TableCell>
                  <SubmissionStateBadge state={report.submissionState} />
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {report.firstSubmittedAt
                    ? new Date(report.firstSubmittedAt).toLocaleDateString()
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && (
        <Pagination meta={meta} onPageChange={(next) => setFilters({ page: String(next) })} />
      )}
    </div>
  );
}

function formatWeek(weekStart: string, weekEnd: string): string {
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}
