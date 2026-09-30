'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM, EMPTY_OTP_REQUEST, type OtpChannel } from '@/lib/forms';
import { requestOtpAction, verifyOtpAction } from '@/lib/server/driver-auth';

/**
 * Phone sign-in: request a code, then enter it.
 *
 * Plain client state (`step`, `phone`, `error`) rather than a pair of
 * `useActionState` hooks, one per step: every other form here is one step, so
 * `useActionState`'s own state (whatever the action last returned) *is* the
 * form's whole state. This one is two steps sharing a "which step" decision
 * neither action alone can express, and deriving it from two chained
 * `useActionState` results — including going back a step, which no action
 * ever un-does — turned into more state-reconciliation code than the two
 * `startTransition` calls below. A `<form action={fn}>` accepts any function;
 * React only wraps it in the server-action machinery when `fn` itself is one,
 * so `sendCode`/`verify` stay ordinary client functions that call the real
 * server actions and set state imperatively once they resolve.
 */
export function OtpForm() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const sendCode = (form: FormData) => {
    setError(undefined);
    startTransition(async () => {
      const result = await requestOtpAction(EMPTY_OTP_REQUEST, form);
      if (result.sent) {
        setPhone(result.sent.phone);
        setChannel(result.sent.channel);
        setTenantSlug(result.sent.tenantSlug ?? '');
        setStep('code');
        return;
      }
      setError(result.error);
    });
  };

  const verify = (form: FormData) => {
    setError(undefined);
    startTransition(async () => {
      // Throws (via `redirect()`) on success, which propagates out of this
      // transition and lets Next navigate — only a refusal returns normally.
      const result = await verifyOtpAction(EMPTY_FORM, form);
      setError(result.error);
    });
  };

  if (step === 'code') {
    return (
      <form action={verify} className="space-y-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {/* Where to look: the API names the channel, the same for every
            number (it is the operator's setting, not the account's). */}
        <p className="text-muted-foreground text-sm">
          {channel === 'whatsapp' ? (
            <>
              We sent a code on WhatsApp to{' '}
              <span className="text-foreground font-medium">{phone}</span>.
              Open WhatsApp to find it.
            </>
          ) : (
            <>
              We sent a code by SMS to{' '}
              <span className="text-foreground font-medium">{phone}</span>.
            </>
          )}
        </p>
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
          />
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError(undefined);
          }}
          className="text-muted-foreground block text-center text-xs underline underline-offset-4"
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form action={sendCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="otp-tenantSlug">Operator</Label>
        <Input
          id="otp-tenantSlug"
          name="tenantSlug"
          autoComplete="organization"
          placeholder="your-operator-name"
          spellCheck={false}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send code'}
      </Button>
    </form>
  );
}
