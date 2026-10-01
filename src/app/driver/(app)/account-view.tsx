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
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type { DriverDto } from '@/lib/api/driver-types';
import { driverSignOut } from '@/lib/server/driver-auth';
import { NotificationsCard } from './notifications-card';

/**
 * A signed-in driver's own account (`charveta` doc 6 §22.3): who they are,
 * their name, their email and their password. The phone the account was
 * created with is fixed; an email is added here and confirmed by a link
 * ("Phone first"). Cards, sessions, receipts and nearby
 * stations are their own screens under the bottom nav (`driver-shell.tsx`).
 */
export function AccountView() {
  const driver = useDriver();
  const setDriver = useSetDriver();

  return (
    <div className="space-y-4">
      <IdentityCard driver={driver} />
      <NameCard driver={driver} onSaved={setDriver} />
      <EmailCard driver={driver} onChanged={setDriver} />
      <PasswordCard driver={driver} onSaved={setDriver} />
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
          Your account is your phone number. To change it, contact your
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
        {driver.pendingEmail && driver.pendingEmail !== driver.email ? (
          <p>
            {driver.pendingEmail}{' '}
            <span className="text-amber-700 dark:text-amber-500">
              (not confirmed yet)
            </span>
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

function EmailCard({
  driver,
  onChanged,
}: {
  driver: DriverDto;
  onChanged: (driver: DriverDto) => void;
}) {
  const [email, setEmail] = useState('');

  // The API records the address as pending whatever happens next, so the
  // account is re-read rather than guessed at.
  const send = useMutation({
    mutationFn: async (address: string) => {
      await driverApiSend<{ message: string }>('POST', '/driver/me/email', {
        email: address,
      });
      return driverApiGet<DriverDto>('/driver/me');
    },
    onSuccess: (updated) => {
      onChanged(updated);
      setEmail('');
      toast.success('Confirmation link sent. Check your inbox.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmed = driver.email && driver.emailVerified ? driver.email : null;
  const pending =
    driver.pendingEmail && driver.pendingEmail !== confirmed
      ? driver.pendingEmail
      : null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{confirmed ? 'Change email' : 'Add an email'}</CardTitle>
        <CardDescription>
          {confirmed
            ? `You can sign in with ${confirmed} as well as your phone.`
            : 'Lets you sign in with an emailed link or a password, as well as your phone.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending ? (
          <div className="space-y-2 border-l-2 border-amber-500 pl-3 text-sm">
            <p>
              <span className="font-medium">{pending}</span>{' '}
              <span className="text-amber-700 dark:text-amber-500">
                not confirmed yet
              </span>
            </p>
            <p className="text-muted-foreground">
              Follow the link we emailed to confirm it. Until then it cannot be
              used to sign in. No email, or the link has expired?
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={send.isPending}
              onClick={() => send.mutate(pending)}
            >
              {send.isPending ? 'Sending…' : 'Send the link again'}
            </Button>
          </div>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send.mutate(email.trim());
          }}
        >
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={320}
            placeholder={pending ? 'A different address' : 'you@example.com'}
            required
          />
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard({
  driver,
  onSaved,
}: {
  driver: DriverDto;
  onSaved: (driver: DriverDto) => void;
}) {
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
      // The API answers 204, so the driver everyone else reads is updated
      // here: without it this card kept saying "Set a password", looked as
      // if the save had done nothing, and the next try left out the current
      // password the API now asks for.
      if (!driver.hasPassword) onSaved({ ...driver, hasPassword: true });
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
            : driver.emailVerified
              ? 'Lets you sign in with your email and a password.'
              : 'Password sign-in is by email: add one above first.'}
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
          <Button
            type="submit"
            disabled={save.isPending || !driver.emailVerified}
          >
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
