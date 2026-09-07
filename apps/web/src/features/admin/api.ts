import type {
  AdminSafeUser,
  ApiList,
  ApiSuccess,
  EligibleProject,
  ProjectMembership,
  ProjectSummary,
  Role,
} from '@weekflow/shared';
import { apiClient } from '@/lib/api-client';

/** Manager administration transport (§15.3, §15.4). */

export interface UserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * Undefined filters are omitted entirely rather than sent empty. `isActive`
 * absent means "any status", which is a different question from `isActive=false`.
 */
function toParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    out[key] = String(value);
  }
  return out;
}

export async function listUsers(params: UserListParams): Promise<ApiList<AdminSafeUser>> {
  const { data } = await apiClient.get<ApiList<AdminSafeUser>>('/users', {
    params: toParams({ ...params }),
  });
  return data;
}

export async function createUser(input: {
  fullName: string;
  email: string;
  role: Role;
  password: string;
  passwordConfirmation: string;
}): Promise<AdminSafeUser> {
  const { data } = await apiClient.post<ApiSuccess<AdminSafeUser>>('/users', input);
  return data.data;
}

export async function changeUserRole(
  id: string,
  input: { role: Role; expectedRevision: number },
): Promise<AdminSafeUser> {
  const { data } = await apiClient.post<ApiSuccess<AdminSafeUser>>(`/users/${id}/role`, input);
  return data.data;
}

export async function setUserActive(
  id: string,
  isActive: boolean,
  expectedRevision: number,
): Promise<AdminSafeUser> {
  const action = isActive ? 'reactivate' : 'deactivate';
  const { data } = await apiClient.post<ApiSuccess<AdminSafeUser>>(`/users/${id}/${action}`, {
    expectedRevision,
  });
  return data.data;
}

export interface ProjectListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export async function listProjects(params: ProjectListParams): Promise<ApiList<ProjectSummary>> {
  const { data } = await apiClient.get<ApiList<ProjectSummary>>('/projects', {
    params: toParams({ ...params }),
  });
  return data;
}

export async function createProject(input: {
  name: string;
  description?: string | null;
}): Promise<ProjectSummary> {
  const { data } = await apiClient.post<ApiSuccess<ProjectSummary>>('/projects', input);
  return data.data;
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string | null; expectedRevision: number },
): Promise<ProjectSummary> {
  const { data } = await apiClient.patch<ApiSuccess<ProjectSummary>>(`/projects/${id}`, input);
  return data.data;
}

export async function setProjectActive(
  id: string,
  isActive: boolean,
  expectedRevision: number,
): Promise<ProjectSummary> {
  const action = isActive ? 'reactivate' : 'archive';
  const { data } = await apiClient.post<ApiSuccess<ProjectSummary>>(`/projects/${id}/${action}`, {
    expectedRevision,
  });
  return data.data;
}

export async function listProjectMembers(
  projectId: string,
  includeHistory: boolean,
): Promise<ApiList<ProjectMembership>> {
  const { data } = await apiClient.get<ApiList<ProjectMembership>>(
    `/projects/${projectId}/members`,
    { params: toParams({ includeHistory, pageSize: 100 }) },
  );
  return data;
}

/** Returns the refreshed project so the caller can carry the new revision forward. */
export async function assignProjectMember(
  projectId: string,
  userId: string,
  expectedProjectRevision: number,
): Promise<{ created: boolean; project: ProjectSummary }> {
  const { data } = await apiClient.post<ApiSuccess<{ created: boolean; project: ProjectSummary }>>(
    `/projects/${projectId}/members`,
    { userId, expectedProjectRevision },
  );
  return data.data;
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  expectedRevision: number,
): Promise<{ removed: boolean; project: ProjectSummary }> {
  const { data } = await apiClient.post<ApiSuccess<{ removed: boolean; project: ProjectSummary }>>(
    `/projects/${projectId}/members/${userId}/remove`,
    { expectedRevision },
  );
  return data.data;
}

export async function listAssignableMembers(): Promise<
  { id: string; fullName: string; email: string }[]
> {
  const { data } = await apiClient.get<
    ApiSuccess<{ id: string; fullName: string; email: string }[]>
  >('/projects/assignable-members');
  return data.data;
}

export async function listEligibleProjects(weekStart: string): Promise<EligibleProject[]> {
  const { data } = await apiClient.get<ApiSuccess<EligibleProject[]>>('/projects/eligible', {
    params: { weekStart },
  });
  return data.data;
}
