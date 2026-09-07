'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ProjectSummary } from '@weekflow/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toApiFailure } from '@/lib/api-client';
import {
  assignProjectMember,
  listAssignableMembers,
  listProjectMembers,
  removeProjectMember,
} from './api';

/**
 * Assignment management (§15.4).
 *
 * Removing a member closes their assignment period rather than deleting it, so
 * "History" still shows the stretch that made past weeks reportable (§5.3).
 */
export function ProjectMembersDialog({
  project,
  onClose,
  onChanged,
}: {
  project: ProjectSummary;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [includeHistory, setIncludeHistory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Every membership write bumps the project's revision, and the next write must
   * present the new one. The API returns the refreshed project for exactly this
   * reason — reusing the revision the dialog opened with would 409 on the second
   * action in a row (§16.2).
   */
  const [revision, setRevision] = useState(project.revision);

  const membersQuery = useQuery({
    queryKey: ['project-members', project.id, includeHistory],
    queryFn: () => listProjectMembers(project.id, includeHistory),
  });

  const assignableQuery = useQuery({
    queryKey: ['assignable-members'],
    queryFn: listAssignableMembers,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });
    onChanged();
  };

  const assign = useMutation({
    mutationFn: (userId: string) => assignProjectMember(project.id, userId, revision),
    onMutate: () => setError(null),
    onError: (err) => setError(toApiFailure(err).message),
    onSuccess: (result) => {
      setRevision(result.project.revision);
      setSelectedUserId('');
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeProjectMember(project.id, userId, revision),
    onMutate: () => setError(null),
    onError: (err) => setError(toApiFailure(err).message),
    onSuccess: (result) => {
      setRevision(result.project.revision);
      refresh();
    },
  });

  const rows = membersQuery.data?.data ?? [];
  const assignedIds = new Set(rows.filter((row) => row.endedAt === null).map((row) => row.user.id));
  const assignable = (assignableQuery.data ?? []).filter((user) => !assignedIds.has(user.id));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project.name} — members</DialogTitle>
          <DialogDescription>
            Removing a member keeps their assignment history, so weeks they already worked stay
            reportable.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="assign-member">Assign a Team Member</Label>
            <select
              id="assign-member"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={!project.isActive || assignable.length === 0}
            >
              <option value="">
                {assignable.length === 0 ? 'No members available' : 'Select a member…'}
              </option>
              {assignable.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={!selectedUserId || assign.isPending || !project.isActive}
            onClick={() => assign.mutate(selectedUserId)}
          >
            Assign
          </Button>
        </div>

        {!project.isActive && (
          <p className="text-xs text-muted-foreground">
            Reactivate this project before assigning members.
          </p>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {includeHistory ? 'All assignments' : 'Current members'}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setIncludeHistory((value) => !value)}>
            {includeHistory ? 'Show current only' : 'Show history'}
          </Button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {membersQuery.isLoading && <Skeleton className="h-16 w-full" />}

          {!membersQuery.isLoading && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {includeHistory ? 'No assignments recorded.' : 'No current members.'}
            </p>
          )}

          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.user.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.endedAt
                    ? `${new Date(row.assignedAt).toLocaleDateString()} – ${new Date(row.endedAt).toLocaleDateString()}`
                    : `Since ${new Date(row.assignedAt).toLocaleDateString()}`}
                </p>
              </div>
              {row.endedAt === null && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(row.user.id)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
