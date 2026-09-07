'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth/use-session';

/**
 * `/dashboard` resolves to the right role dashboard once identity has loaded —
 * never guessed before (§9.1).
 *
 * The real Member (§8.5) and Manager (§8.4) dashboards land in M8; this M3
 * placeholder proves the shell, session and role split work end to end.
 */
export default function DashboardPage() {
  const { user, isManager } = useSession();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isManager ? 'Manager Dashboard' : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {user.fullName} ({user.email})
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isManager ? 'Team overview' : 'Action required'}</CardTitle>
          <CardDescription>
            {isManager
              ? 'Summary metrics, the attention queue and analytics arrive in M8.'
              : 'Your weekly report queue arrives once the report editor lands in M5.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Authentication, role-based access control and the application shell are in place.
        </CardContent>
      </Card>
    </div>
  );
}
