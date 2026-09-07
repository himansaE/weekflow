'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PAGINATION } from '@weekflow/shared';
import type { ProjectSummary } from '@weekflow/shared';
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
import { listProjects, setProjectActive } from './api';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectMembersDialog } from './project-members-dialog';
import { Pagination } from './pagination';

export function ProjectsPage() {
  const { get, setFilters, clearAll, page } = useFilterParams();
  const [search, setSearch] = useDebouncedFilter('search', setFilters, get('search') ?? '');
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [membersFor, setMembersFor] = useState<ProjectSummary | null>(null);

  const statusFilter = get('isActive');
  const filters = {
    page,
    pageSize: PAGINATION.defaultPageSize,
    search: get('search'),
    isActive: statusFilter === undefined ? undefined : statusFilter === 'true',
  };

  const projectsQuery = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => listProjects(filters),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const toggleActive = useMutation({
    mutationFn: (project: ProjectSummary) =>
      setProjectActive(project.id, !project.isActive, project.revision),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(toApiFailure(error).message),
    onSettled: invalidate,
  });

  const rows = projectsQuery.data?.data ?? [];
  const meta = projectsQuery.data?.meta;
  const hasFilters = Boolean(get('search') ?? statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Project Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Archiving removes a project from new reports. Past reports and assignments are kept.
          </p>
        </div>
        <CreateProjectDialog onCreated={invalidate} />
      </div>

      {actionError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="project-search">Search</Label>
          <Input
            id="project-search"
            placeholder="Project name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-status">Status</Label>
          <select
            id="project-status"
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
            value={statusFilter ?? ''}
            onChange={(event) => setFilters({ isActive: event.target.value || undefined })}
          >
            <option value="">All projects</option>
            <option value="true">Active</option>
            <option value="false">Archived</option>
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
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectsQuery.isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!projectsQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {hasFilters ? 'No projects match these filters.' : 'No projects yet.'}
                </TableCell>
              </TableRow>
            )}

            {rows.map((project) => (
              <TableRow key={project.id} className={project.isActive ? undefined : 'opacity-60'}>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell className="max-w-sm truncate text-muted-foreground">
                  {project.description ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {project.activeMemberCount}
                </TableCell>
                <TableCell>
                  <Badge variant={project.isActive ? 'outline' : 'secondary'}>
                    {project.isActive ? 'Active' : 'Archived'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => setMembersFor(project)}>
                    Members
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={toggleActive.isPending}
                    onClick={() => toggleActive.mutate(project)}
                    title={
                      project.isActive
                        ? 'Archiving keeps existing reports and assignment history'
                        : undefined
                    }
                  >
                    {project.isActive ? 'Archive' : 'Reactivate'}
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

      {membersFor && (
        <ProjectMembersDialog
          project={membersFor}
          onClose={() => setMembersFor(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}
