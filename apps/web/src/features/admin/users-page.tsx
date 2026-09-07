'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PAGINATION, Role } from '@weekflow/shared';
import type { AdminSafeUser } from '@weekflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toApiFailure } from '@/lib/api-client';
import { useDebouncedFilter, useFilterParams } from '@/hooks/use-filter-params';
import { changeUserRole, listUsers, setUserActive } from './api';
import { CreateUserDialog } from './create-user-dialog';
import { Pagination } from './pagination';

export function UsersPage() {
  const { get, setFilters, clearAll, page } = useFilterParams();
  const [search, setSearch] = useDebouncedFilter('search', setFilters, get('search') ?? '');
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const roleFilter = get('role') as Role | undefined;
  const statusFilter = get('isActive');

  const filters = {
    page,
    pageSize: PAGINATION.defaultPageSize,
    search: get('search'),
    role: roleFilter,
    isActive: statusFilter === undefined ? undefined : statusFilter === 'true',
  };

  const usersQuery = useQuery({
    queryKey: ['users', filters],
    queryFn: () => listUsers(filters),
  });

  /**
   * Every mutation sends `expectedRevision` and refetches on settle. Conservative
   * invalidation rather than an optimistic edit: a rejected 409 must leave the
   * table showing what the server actually holds (§11.4).
   */
  const mutate = useMutation({
    mutationFn: async (action: { user: AdminSafeUser; kind: 'role' | 'status' }) => {
      if (action.kind === 'role') {
        const next = action.user.role === Role.MANAGER ? Role.TEAM_MEMBER : Role.MANAGER;
        return changeUserRole(action.user.id, {
          role: next,
          expectedRevision: action.user.revision,
        });
      }
      return setUserActive(action.user.id, !action.user.isActive, action.user.revision);
    },
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(toApiFailure(error).message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const rows = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const hasFilters = Boolean(get('search') ?? roleFilter ?? statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts are deactivated, never deleted, so their reports stay available.
          </p>
        </div>
        <CreateUserDialog
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        />
      </div>

      {actionError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="user-search">Search</Label>
          <Input
            id="user-search"
            placeholder="Name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-role">Role</Label>
          <select
            id="user-role"
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
            value={roleFilter ?? ''}
            onChange={(event) => setFilters({ role: event.target.value || undefined })}
          >
            <option value="">All roles</option>
            <option value={Role.TEAM_MEMBER}>Team Member</option>
            <option value={Role.MANAGER}>Manager</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-status">Status</Label>
          <select
            id="user-status"
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
            value={statusFilter ?? ''}
            onChange={(event) => setFilters({ isActive: event.target.value || undefined })}
          >
            <option value="">Any status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {hasFilters && (
          <Button variant="ghost" onClick={clearAll}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!usersQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {/* "No matches" and "no data" are different states (§9.4). */}
                  {hasFilters ? 'No users match these filters.' : 'No users yet.'}
                </TableCell>
              </TableRow>
            )}

            {rows.map((user) => (
              <TableRow key={user.id} className={user.isActive ? undefined : 'opacity-60'}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === Role.MANAGER ? 'default' : 'secondary'}>
                    {user.role === Role.MANAGER ? 'Manager' : 'Team Member'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {/* Text, not colour alone (§10). */}
                  <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutate.isPending}
                    onClick={() => mutate.mutate({ user, kind: 'role' })}
                  >
                    {user.role === Role.MANAGER ? 'Make Team Member' : 'Make Manager'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutate.isPending}
                    onClick={() => mutate.mutate({ user, kind: 'status' })}
                    title={user.isActive ? 'Deactivating keeps all reports and history' : undefined}
                  >
                    {user.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
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
