'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createUserSchema, LIMITS, Role } from '@weekflow/shared';
import type { CreateUserInput } from '@weekflow/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toApiFailure } from '@/lib/api-client';
import { createUser } from './api';

/**
 * Manager-created accounts (§15.3). Unlike public signup this form has a role
 * selector — the initial password is set here and never displayed back in the
 * table or profile afterwards (§9.3).
 */
export function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      role: Role.TEAM_MEMBER,
      password: '',
      passwordConfirmation: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      reset();
      setOpen(false);
      onCreated();
    },
    onError: (error) => {
      const failure = toApiFailure(error);
      if (failure.code === 'DUPLICATE_RESOURCE') {
        setError('email', { message: failure.message });
      }
      failure.fieldErrors?.forEach((fieldError) => {
        setError(fieldError.path as keyof CreateUserInput, { message: fieldError.message });
      });
    },
  });

  const failure = createMutation.error ? toApiFailure(createMutation.error) : null;
  const showSummary =
    failure && failure.code !== 'DUPLICATE_RESOURCE' && !failure.fieldErrors?.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Create user</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            The account is usable immediately. Share the initial password securely — it is not shown
            again.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          {showSummary && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{failure.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-fullName">Full name</Label>
            <Input id="new-fullName" {...register('fullName')} />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">Role</Label>
            <select
              id="new-role"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              {...register('role')}
            >
              <option value={Role.TEAM_MEMBER}>Team Member</option>
              <option value={Role.MANAGER}>Manager</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Initial password</Label>
            <Input id="new-password" type="password" {...register('password')} />
            <p className="text-xs text-muted-foreground">
              At least {LIMITS.user.password.min} characters.
            </p>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password-confirm">Confirm password</Label>
            <Input
              id="new-password-confirm"
              type="password"
              {...register('passwordConfirmation')}
            />
            {errors.passwordConfirmation && (
              <p className="text-sm text-destructive">{errors.passwordConfirmation.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
