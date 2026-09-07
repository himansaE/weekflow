import type { ApiSuccess, LoginInput, RegisterInput, SafeUser } from '@weekflow/shared';
import { apiClient } from '@/lib/api-client';

/**
 * Auth transport. Every call carries the session cookie (`withCredentials`) and
 * the CSRF custom header, both configured once on the shared Axios instance.
 */

export async function login(input: LoginInput): Promise<SafeUser> {
  const { data } = await apiClient.post<ApiSuccess<SafeUser>>('/auth/login', input);
  return data.data;
}

export async function register(input: RegisterInput): Promise<SafeUser> {
  const { data } = await apiClient.post<ApiSuccess<SafeUser>>('/auth/register', input);
  return data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<SafeUser> {
  const { data } = await apiClient.get<ApiSuccess<SafeUser>>('/auth/me');
  return data.data;
}
