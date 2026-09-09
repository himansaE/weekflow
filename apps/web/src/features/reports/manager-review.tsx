'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ReviewAction } from '@weekflow/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toApiFailure } from '@/lib/api-client';
import { fetchReport, listReviews, listVersions, reviewReport } from './api';
import { VersionDialog } from './correction-banner';
import { ReadOnlyReport } from './read-only-report';
import { SubmissionStateBadge, WorkflowBadge } from './status-badges';

/**
 * Manager Review (§9, §24 of the scope).
 *
 * The content is rendered by `ReadOnlyReport`, which has no inputs at all — a
 * manager is never handed an editable control for a member's content, and the
 * surest way to guarantee that is for the control not to exist.
 *
 * Review controls sit in a sticky panel beside the content on desktop and in a
 * bottom action area on mobile (§10).
 */
export function ManagerReview({ reportId }: { reportId: string }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [commentRequired, setCommentRequired] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);

  const reportQuery = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => fetchReport(reportId),
  });
  const versionsQuery = useQuery({
    queryKey: ['report-versions', reportId],
    queryFn: () => listVersions(reportId),
  });
  const reviewsQuery = useQuery({
    queryKey: ['report-reviews', reportId],
    queryFn: () => listReviews(reportId),
  });

  const report = reportQuery.data;

  const review = useMutation({
    mutationFn: (action: ReviewAction) => {
      if (!report) throw new Error('Report not loaded.');

      return reviewReport(reportId, {
        // Pins the exact version that was read, so a decision cannot land on a
        // version another manager has already superseded (§7.5).
        reportVersionId: report.displayVersion.id,
        expectedRevision: report.revision,
        action,
        comment: comment.trim() ? comment.trim() : null,
      });
    },
    onMutate: () => {
      setError(null);
      setCommentRequired(false);
    },
    onSuccess: () => {
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      void queryClient.invalidateQueries({ queryKey: ['report-reviews', reportId] });
      void queryClient.invalidateQueries({ queryKey: ['report-versions', reportId] });
    },
    onError: (err) => {
      const failure = toApiFailure(err);
      setError(failure.message);
      if (failure.fieldErrors?.some((fieldError) => fieldError.path === 'comment')) {
        setCommentRequired(true);
      }
    },
  });

  if (reportQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (reportQuery.isError || !report) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>
          This report is not available. An unsubmitted draft is private to its author.
        </AlertDescription>
      </Alert>
    );
  }

  const canReview = report.allowedActions.includes('APPROVE');
  const versions = versionsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{report.owner.fullName}</h1>
          <WorkflowBadge status={report.status} />
          <SubmissionStateBadge state={report.submissionState} />
        </div>
        <p className="text-sm text-muted-foreground">
          {report.weekStart} – {report.weekEnd} · viewing version{' '}
          {report.displayVersion.versionNumber}
          {report.firstSubmittedAt &&
            ` · first submitted ${new Date(report.firstSubmittedAt).toLocaleString()}`}
        </p>
      </header>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submitted report</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadOnlyReport content={report.displayVersion.content} />
          </CardContent>
        </Card>

        {/* Sticky on desktop; on narrow screens it simply flows to the bottom,
            which is the mobile action area (§10). */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {canReview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="review-comment">
                    Comment
                    <span className="ml-1 text-xs text-muted-foreground">
                      (required to request changes)
                    </span>
                  </Label>
                  <Textarea
                    id="review-comment"
                    rows={4}
                    value={comment}
                    aria-invalid={commentRequired}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="What needs to change, and why."
                  />
                  {commentRequired && (
                    <p className="text-xs text-destructive">
                      A comment is required when requesting changes.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    disabled={review.isPending}
                    onClick={() => review.mutate(ReviewAction.APPROVE)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() => review.mutate(ReviewAction.REQUEST_CHANGES)}
                  >
                    Request changes
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Approving is final. Requesting changes keeps this version intact and gives the
                  member a new one to correct.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertDescription>
                {report.status === 'APPROVED'
                  ? 'This report is approved and final.'
                  : 'This report is not awaiting review.'}
              </AlertDescription>
            </Alert>
          )}

          {versions.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {versions.map((version) => (
                  <Button
                    key={version.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setViewingVersion(version.id)}
                  >
                    Version {version.versionNumber}
                    {version.id === report.displayVersion.id && (
                      <Badge variant="outline" className="ml-2">
                        Viewing
                      </Badge>
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review history</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {reviews.map((entry) => (
                    <li key={entry.id} className="border-l-2 pl-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            entry.action === ReviewAction.APPROVE ? 'default' : 'destructive'
                          }
                        >
                          {entry.action === ReviewAction.APPROVE ? 'Approved' : 'Changes requested'}
                        </Badge>
                        <Badge variant="outline">v{entry.versionNumber}</Badge>
                      </div>
                      {entry.comment && <p className="mt-1 whitespace-pre-wrap">{entry.comment}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.reviewer.fullName} · {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {viewingVersion && (
        <VersionDialog
          reportId={reportId}
          versionId={viewingVersion}
          onClose={() => setViewingVersion(null)}
        />
      )}
    </div>
  );
}
