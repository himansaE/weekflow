'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Role } from '@weekflow/shared';
import type { LoginInput, RegisterInput, SafeUser } from '@weekflow/shared';
import { isUnauthenticated } from '@/lib/api-client';
import { fetchCurrentUser, login, logout, register } from './api';

export const sessionQueryKey = ['auth', 'me'] as const;

/**
 * The signed-in identity.
 *
 * It comes from `/auth/me` rather than from anything stored client-side, because
 * the API re-reads the user row on every request: a deactivated account or a
 * changed role is reflected here on the next fetch, and cannot be faked by
 * editing local state.
 *
 * A 401 is a legitimate answer ("nobody is signed in"), not an error to retry.
 */
export function useSession() {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => !isUnauthenticated(error) && failureCount < 2,
    staleTime: 60_000,
  });

  const user = query.data ?? null;

  return {
    user,
    isLoading: query.isLoading,
    isAuthenticated: user !== null,
    isManager: user?.role === Role.MANAGER,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (user: SafeUser) => {
      // Seed the cache so the shell renders the right role immediately instead of
      // flashing a loading state, then let the normal refetch confirm it.
      queryClient.setQueryData(sessionQueryKey, user);
      router.replace('/dashboard');
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Cleared even if the request failed: the user asked to leave, and no
      // previously fetched member or manager data may survive into whoever signs
      // in next on this device (§9.4).
      queryClient.clear();
      router.replace('/login');
    },
  });
}
