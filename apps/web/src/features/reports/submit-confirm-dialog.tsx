'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Submission confirmation (§7.5).
 *
 * The point is to state the consequence plainly before it happens: the version
 * becomes read-only, and the only way back into it is a manager requesting
 * changes — which creates a new version rather than reopening this one.
 */
export function SubmitConfirmDialog({
  open,
  isResubmit,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isResubmit: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isResubmit ? 'Resubmit for review?' : 'Submit this report?'}</DialogTitle>
          <DialogDescription>
            Once submitted, this version becomes read-only. You can only edit it again if a manager
            requests changes — and that creates a new version, leaving this one intact.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Keep editing
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Submitting…' : isResubmit ? 'Resubmit' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
