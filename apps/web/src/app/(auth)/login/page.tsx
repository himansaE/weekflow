import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/login-form';
import { RegisteredNotice } from '@/features/auth/registered-notice';

export const metadata: Metadata = { title: 'Sign in · WeekFlow' };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reads a search param, so it needs its own Suspense boundary. */}
        <Suspense fallback={null}>
          <RegisteredNotice />
        </Suspense>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
