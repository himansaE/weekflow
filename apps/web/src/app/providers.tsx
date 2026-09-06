'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isUnauthenticated } from '@/lib/api-client';

/**
 * One QueryClient per browser session.
 *
 * On a 401 the whole cache is cleared before redirecting (§9.4): a session may end
 * because the account was deactivated server-side, and another user could sign in
 * next on the same device — no previously fetched member or manager data may
 * survive into that session.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => !isUnauthenticated(error) && failureCount < 2,
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  const [sessionExpiryInstalled, setSessionExpiryInstalled] = useState(false);
  if (!sessionExpiryInstalled) {
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && isUnauthenticated(event.query.state.error)) {
        queryClient.clear();
        router.replace('/login');
      }
    });
    setSessionExpiryInstalled(true);
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
