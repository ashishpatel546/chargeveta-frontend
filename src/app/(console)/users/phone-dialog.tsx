'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { apiSend } from '@/lib/api/client';
import type { ConsoleUser } from '@/lib/api/types';

/**
 * Sets the mobile number a person is texted on when a session cannot be
 * stopped and nobody answers the alert (doc 6 §22.4). Only owners and admins
 * are texted, but anyone may have one. The API normalises what is typed and
 * refuses what cannot be a number, so this only passes it on.
 */
export function PhoneDialog({ user }: { user: ConsoleUser }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(user.phone ?? '');
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (value: string | null) =>
      apiSend<ConsoleUser>('PATCH', `/users/${user.id}`, { phone: value }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      toast.success(
        updated.phone
          ? `${updated.email} will be texted on ${updated.phone}.`
          : `${updated.email} has no phone number now.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPhone(user.phone ?? '');
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Phone
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phone for {user.email}</DialogTitle>
          <DialogDescription>
            Owners and admins with a number are texted when a charging session
            cannot be stopped and its alert goes unanswered.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`phone-${user.id}`}>Mobile number</Label>
          <Input
            id={`phone-${user.id}`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+91 98765 43210"
          />
          <p className="text-muted-foreground text-xs">
            Without a country code, this installation&apos;s default is
            assumed.
          </p>
        </div>
        <DialogFooter>
          {user.phone ? (
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate(null)}
            >
              Remove
            </Button>
          ) : null}
          <Button
            disabled={phone.trim().length === 0 || save.isPending}
            onClick={() => save.mutate(phone.trim())}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
