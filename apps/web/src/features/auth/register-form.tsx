'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LIMITS, registerSchema } from '@weekflow/shared';
import type { RegisterInput } from '@weekflow/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toApiFailure } from '@/lib/api-client';
import { useRegister } from './use-session';

/**
 * Public signup. There is deliberately no role selector — the API always creates
 * a Team Member and rejects any attempt to send a role (§3.3).
 */
export function RegisterForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    // The same schema the API validates against, imported from packages/shared,
    // so the two cannot drift apart.
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', passwordConfirmation: '' },
  });

  const registerMutation = useRegister();

  const onSubmit = handleSubmit((values) => {
    registerMutation.mutate(values, {
      onSuccess: () => router.replace('/login?registered=1'),
      onError: (error) => {
        const failure = toApiFailure(error);
        // Field-level errors land on their field; anything else falls through to
        // the summary alert below.
        failure.fieldErrors?.forEach((fieldError) => {
          setError(fieldError.path as keyof RegisterInput, { message: fieldError.message });
        });
        if (failure.code === 'DUPLICATE_RESOURCE') {
          setError('email', { message: failure.message });
        }
      },
    });
  });

  const failure = registerMutation.error ? toApiFailure(registerMutation.error) : null;
  const showSummary =
    failure && !failure.fieldErrors?.length && failure.code !== 'DUPLICATE_RESOURCE';

  return (
    <form noValidate className="space-y-5" onSubmit={onSubmit}>
      {showSummary && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          autoComplete="name"
          autoFocus
          aria-invalid={Boolean(errors.fullName)}
          {...register('fullName')}
        />
        {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-hint"
          {...register('password')}
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least {LIMITS.user.password.min} characters. Spaces count.
        </p>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="passwordConfirmation">Confirm password</Label>
        <Input
          id="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.passwordConfirmation)}
          {...register('passwordConfirmation')}
        />
        {errors.passwordConfirmation && (
          <p className="text-sm text-destructive">{errors.passwordConfirmation.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
