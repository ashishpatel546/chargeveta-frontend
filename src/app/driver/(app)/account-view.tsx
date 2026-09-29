'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDriver, useSetDriver } from '@/components/driver-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { driverApiSend } from '@/lib/api/driver-client';
import type { DriverDto } from '@/lib/api/driver-types';
import { driverSignOut } from '@/lib/server/driver-auth';
import { NotificationsCard } from './notifications-card';

/**
 * A signed-in driver's own account (`charveta` doc 6 §22.3): who they are,
 * their name, and their password. Cards, sessions, receipts and nearby
 * stations are their own screens under the bottom nav (`driver-shell.tsx`).
 */
export function AccountView() {
  const driver = useDriver();
  const setDriver = useSetDriver();

  return (
    <div className="space-y-4">
      <IdentityCard driver={driver} />
      <NameCard driver={driver} onSaved={setDriver} />
      <PasswordCard driver={driver} />
      <NotificationsCard />
      <SignOutCard />
    </div>
  );
}

function IdentityCard({ driver }: { driver: DriverDto }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Your account</CardTitle>
        <CardDescription>
          How you signed in. To change an email or phone number, contact your
          operator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {driver.email ? (
          <p>
            {driver.email}{' '}
            {driver.emailVerified ? (
              <span className="text-muted-foreground">(confirmed)</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-500">
                (not confirmed)
              </span>
            )}
          </p>
        ) : null}
        {driver.phone ? (
          <p>
            {driver.phone}{' '}
            {driver.phoneVerified ? (
              <span className="text-muted-foreground">(confirmed)</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-500">
                (not confirmed)
              </span>
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NameCard({
  driver,
  onSaved,
}: {
  driver: DriverDto;
  onSaved: (driver: DriverDto) => void;
}) {
  const [name, setName] = useState(driver.name ?? '');

  const save = useMutation({
    mutationFn: () =>
      driverApiSend<DriverDto>('PATCH', '/driver/me', {
        name: name.trim() === '' ? null : name.trim(),
      }),
    onSuccess: (updated) => {
      onSaved(updated);
      toast.success('Name saved.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Name</CardTitle>
        <CardDescription>Shown on your receipts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Label htmlFor="name" className="sr-only">
            Name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="Your name"
          />
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ driver }: { driver: DriverDto }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirm) {
        throw new Error('The two passwords do not match');
      }
      await driverApiSend<void>('PUT', '/driver/me/password', {
        ...(driver.hasPassword ? { currentPassword } : {}),
        newPassword,
      });
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      toast.success(
        'Password saved. Every other device you signed in on has been signed out.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{driver.hasPassword ? 'Change password' : 'Set a password'}</CardTitle>
        <CardDescription>
          {driver.hasPassword
            ? 'Ends every other session of yours.'
            : 'Needs a confirmed email. Until then, sign in with a phone code or an emailed link.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {driver.hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Type it again</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignOutCard() {
  return (
    <form action={driverSignOut}>
      <Button type="submit" variant="outline" className="w-full">
        Sign out
      </Button>
    </form>
  );
}
