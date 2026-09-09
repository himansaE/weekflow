'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ReviewAction } from '@weekflow/shared';
import type { ReportView } from '@weekflow/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchVersion, listReviews } from './api';
import { ReadOnlyReport } from './read-only-report';

/**
 * The correction banner (D120, §11 of the scope).
 *
 * Shown above the editor when a manager has requested changes, carrying the
 * comment, who wrote it, when, and which version it judged.
 *
 * Previous versions and the review history open in dialogs rather than by
 * navigating away: the member is mid-edit, and losing unsaved work to read the
 * feedback would be the worst possible moment for it (§9.2).
 */
export function CorrectionBanner({ report }: { report: ReportView }) {
  const [showVersion, setShowVersion] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const reviewsQuery = useQuery({
    queryKey: ['report-reviews', report.id],
    queryFn: () => listReviews(report.id),
  });

  const reviews = reviewsQuery.data ?? [];
  // The feedback that put this report into correction is the most recent
  // request-changes review.
  const latest = [...reviews]
    .reverse()
    .find((review) => review.action === ReviewAction.REQUEST_CHANGES);

  if (!latest) return null;

  return (
    <>
      <Alert role="status">
        <AlertTitle className="flex flex-wrap items-center gap-2">
          Changes requested
          <Badge variant="outline">Version {latest.versionNumber}</Badge>
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="whitespace-pre-wrap text-foreground">{latest.comment}</p>

          <p className="text-xs text-muted-foreground">
            {latest.reviewer.fullName} ·{' '}
            {new Date(latest.createdAt).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowVersion(latest.reportVersionId)}
            >
              View version {latest.versionNumber}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
              Review history
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {showVersion && (
        <VersionDialog
          reportId={report.id}
          versionId={showVersion}
          onClose={() => setShowVersion(null)}
        />
      )}

      <Dialog open={showHistory} onOpenChange={(open) => !open && setShowHistory(false)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review history</DialogTitle>
            <DialogDescription>Every decision, against the version it judged.</DialogDescription>
          </DialogHeader>

          <ol className="space-y-4">
            {reviews.map((review) => (
              <li key={review.id} className="border-l-2 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={review.action === ReviewAction.APPROVE ? 'default' : 'destructive'}
                  >
                    {review.action === ReviewAction.APPROVE ? 'Approved' : 'Changes requested'}
                  </Badge>
                  <Badge variant="outline">Version {review.versionNumber}</Badge>
                </div>
                {review.comment && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{review.comment}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {review.reviewer.fullName} · {new Date(review.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Read-only view of one immutable submitted version (§25 of the scope). */
export function VersionDialog({
  reportId,
  versionId,
  onClose,
}: {
  reportId: string;
  versionId: string;
  onClose: () => void;
}) {
  const versionQuery = useQuery({
    queryKey: ['report-version', reportId, versionId],
    queryFn: () => fetchVersion(reportId, versionId),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Version {versionQuery.data?.versionNumber ?? ''}
            {versionQuery.data?.submittedAt && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                submitted {new Date(versionQuery.data.submittedAt).toLocaleString()}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            This version is immutable — it is exactly what was submitted.
          </DialogDescription>
        </DialogHeader>

        {versionQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : versionQuery.data ? (
          <ReadOnlyReport content={versionQuery.data.content} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
