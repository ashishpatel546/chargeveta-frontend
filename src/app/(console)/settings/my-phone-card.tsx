'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePrincipal } from '@/components/principal-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiSend } from '@/lib/api/client';

/**
 * The signed-in person's own mobile number (PATCH /auth/me), for the texts an
 * unanswered stop alert escalates to (doc 6 §22.4). Anyone may set their own;
 * the principal is read on the server, so a refresh shows the saved value.
 */
export function MyPhoneCard() {
  const principal = usePrincipal();
  const router = useRouter();
  const current = principal.kind === 'user' ? (principal.phone ?? '') : '';
  const [phone, setPhone] = useState(current);

  const save = useMutation({
    mutationFn: (value: string | null) =>
      apiSend<{ phone: string | null }>('PATCH', '/auth/me', { phone: value }),
    onSuccess: (me) => {
      setPhone(me.phone ?? '');
      router.refresh();
      toast.success(
        me.phone ? `Saved: ${me.phone}.` : 'Your phone number is removed.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (principal.kind !== 'user') return null;

  return (
    <Card className="mb-4" size="sm">
      <CardHeader>
        <CardTitle>Your phone</CardTitle>
        <CardDescription>
          Owners and admins with a number are texted when a charging session
          cannot be stopped and its alert goes unanswered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(phone.trim() === '' ? null : phone.trim());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="my-phone">Mobile number</Label>
            <Input
              id="my-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="w-56"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <Button
            type="submit"
            disabled={save.isPending || phone.trim() === current}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
