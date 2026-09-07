'use client';

import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** Confirms a successful signup after the redirect from /register. */
export function RegisteredNotice() {
  const registered = useSearchParams().get('registered') === '1';
  if (!registered) return null;

  return (
    <Alert role="status">
      <AlertDescription>Account created. Sign in to continue.</AlertDescription>
    </Alert>
  );
}
