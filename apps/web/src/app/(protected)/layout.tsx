'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/use-session';

/**
 * Gate for every authenticated page.
 *
 * This is a **convenience**, not a security boundary — the API enforces access on
 * every request and this layout cannot see anything the server did not send.
 *
 * The shell renders only once identity has loaded, which is what stops a member
 * briefly seeing the manager navigation before the role arrives (§9.1).
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="ml-auto size-8 rounded-full" />
        </div>
        <div className="flex flex-1">
          <div className="hidden w-64 shrink-0 border-r p-3 lg:block">
            <Skeleton className="mb-4 h-6 w-28" />
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-4 px-4 py-6 lg:px-8">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
