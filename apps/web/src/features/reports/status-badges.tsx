import { ReportStatus, SubmissionState } from '@weekflow/shared';
import { Badge } from '@/components/ui/badge';

/**
 * Workflow and submission state are two independent axes and are shown as two
 * separate badges (§17 of the scope, §4.2).
 *
 * Merging them — "Approved (late)" as one label — would lose the distinction the
 * whole model depends on: a report can be Approved *and* late, or Needs
 * Correction *and* originally on time.
 *
 * Member-facing views give the workflow more visual weight (D124), so the
 * workflow badge is solid and the submission badge is outlined.
 */

const WORKFLOW_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  NEEDS_CORRECTION: 'Changes requested',
  APPROVED: 'Approved',
};

const SUBMISSION_LABEL: Record<SubmissionState, string> = {
  NOT_STARTED: 'Not started',
  PENDING: 'Due this week',
  OVERDUE: 'Overdue',
  SUBMITTED_ON_TIME: 'Submitted on time',
  SUBMITTED_LATE: 'Submitted late',
};

export function WorkflowBadge({ status }: { status: ReportStatus }) {
  const variant =
    status === ReportStatus.APPROVED
      ? 'default'
      : status === ReportStatus.NEEDS_CORRECTION
        ? 'destructive'
        : 'secondary';

  return <Badge variant={variant}>{WORKFLOW_LABEL[status]}</Badge>;
}

export function SubmissionStateBadge({ state }: { state: SubmissionState }) {
  // Text carries the meaning; colour only reinforces it (§10).
  const variant = state === SubmissionState.OVERDUE ? 'destructive' : 'outline';
  return <Badge variant={variant}>{SUBMISSION_LABEL[state]}</Badge>;
}
