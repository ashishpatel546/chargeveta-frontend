'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { config } from '../config';
import type { FormState, OtpRequestState } from '../forms';
import { driverApiFetch, readDriverMessage } from './driver-api';
import { clearDriverSession, readDriverSession, writeDriverSession } from './driver-session';
import type { DriverTokenPair } from './driver-session';
import { clientHeaders } from './client-address';

/**
 * How a driver signs in (`charveta` doc 6 §22.3): a phone OTP, an emailed
 * magic link, or email+password. All three end the same way — a token pair
 * written to `cvd_at`/`cvd_rt` and a redirect to `/driver` — so every action
 * below shares that last step, matching `lib/server/auth.ts`'s staff actions.
 */

const tenantScoped = z.object({
  tenantSlug: z.string().trim().max(100).optional(),
});

/**
 * `status` travels alongside the message so a caller can special-case a 401
 * ("that code/password/link was not accepted") without guessing it from the
 * message text — which would break the moment the API's own wording changed,
 * or never match at all against a real `{message: "Unauthorized"}` body.
 */
async function post<T>(path: string, body: unknown): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }
> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await clientHeaders()),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: `The API at ${config.apiBaseUrl} did not answer. Is it running?`,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: await readDriverMessage(response),
    };
  }
  return { ok: true, data: (await response.json()) as T };
}

// ---------------------------------------------------------------------------
// Phone OTP — a two-step flow, so it needs a richer state than plain
// error/message: the phone step's result carries what the code step needs.
// ---------------------------------------------------------------------------

const requestOtpSchema = tenantScoped.extend({
  phone: z.string().trim().min(6).max(24, 'Enter a phone number'),
});

export async function requestOtpAction(
  _previous: OtpRequestState,
  form: FormData,
): Promise<OtpRequestState> {
  const parsed = requestOtpSchema.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    phone: form.get('phone'),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const result = await post<{ phone: string; resendAfterSeconds: number }>(
    '/driver/auth/otp',
    parsed.data,
  );
  if (!result.ok) {
    return {
      error:
        // The API's 429 message already names the wait; anything else is
        // shown as it came, the same "one generic reason" restraint staff
        // sign-in uses for a wrong password.
        result.error,
    };
  }
  return {
    sent: {
      phone: result.data.phone,
      tenantSlug: parsed.data.tenantSlug,
      resendAfterSeconds: result.data.resendAfterSeconds,
    },
  };
}

const verifyOtpSchema = tenantScoped.extend({
  phone: z.string().trim().min(6).max(24),
  code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code'),
});

export async function verifyOtpAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = verifyOtpSchema.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    phone: form.get('phone'),
    code: form.get('code'),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const result = await post<DriverTokenPair & { created: boolean }>(
    '/driver/auth/otp/verify',
    parsed.data,
  );
  if (!result.ok) {
    return {
      error:
        result.status === 401
          ? 'That code was not accepted.'
          : result.error,
    };
  }
  await writeDriverSession(result.data);
  redirect('/driver');
}

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

const loginSchema = tenantScoped.extend({
  email: z.email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
});

export async function driverLoginAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const result = await post<DriverTokenPair & { created: boolean }>(
    '/driver/auth/login',
    parsed.data,
  );
  if (!result.ok) {
    return {
      error:
        result.status === 401
          ? 'Those details were not accepted.'
          : result.error,
    };
  }
  await writeDriverSession(result.data);
  redirect('/driver');
}

const registerSchema = tenantScoped.extend({
  email: z.email('That does not look like an email address'),
  password: z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(256, 'Use at most 256 characters'),
  confirm: z.string(),
  name: z.string().trim().max(120).optional(),
}).refine((value) => value.password === value.confirm, {
  message: 'The two passwords do not match',
  path: ['confirm'],
});

/**
 * Registers, and sends a link to confirm the address rather than signing in
 * at once — the password only takes effect once that link is followed
 * (`/driver/link`, same redemption `DriverAuthController.register` docs).
 */
export async function registerDriverAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    email: form.get('email'),
    password: form.get('password'),
    confirm: form.get('confirm'),
    name: (form.get('name') as string | null) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form' };
  }

  const result = await post<{ message: string }>('/driver/auth/register', {
    tenantSlug: parsed.data.tenantSlug,
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
  });
  if (!result.ok) return { error: result.error };
  return { message: result.data.message };
}

// ---------------------------------------------------------------------------
// Magic link
// ---------------------------------------------------------------------------

const requestLinkSchema = tenantScoped.extend({
  email: z.email('That does not look like an email address'),
});

export async function requestLinkAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = requestLinkSchema.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    email: form.get('email'),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const result = await post<{ message: string }>('/driver/auth/link', parsed.data);
  if (!result.ok) return { error: result.error };
  return { message: result.data.message };
}

const redeemLinkSchema = z.object({
  token: z.string().trim().min(1, 'This link is missing its token').max(200),
});

/**
 * Redeems a magic link — sign-in or registration-confirmation alike, the API
 * does not distinguish (`DriverAuthController.redeemLink`).
 *
 * A `'use server'` action, reached only by a form submission a person makes
 * (never by the page load itself): a mail scanner that fetches the link to
 * check it performs a GET and never invokes this, so the token survives being
 * previewed. See `driver/link/page.tsx`.
 */
export async function redeemLinkAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = redeemLinkSchema.safeParse({ token: form.get('token') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the link' };

  const result = await post<DriverTokenPair & { created: boolean }>(
    '/driver/auth/link/redeem',
    parsed.data,
  );
  if (!result.ok) {
    return {
      error:
        result.status === 401
          ? 'This link has expired or has already been used. Ask for a new one.'
          : result.error,
    };
  }
  await writeDriverSession(result.data);
  redirect('/driver');
}

/** Ends the session on the API as well as here. */
export async function driverSignOut(): Promise<void> {
  if (await readDriverSession()) {
    await driverApiFetch('/driver/auth/logout', { method: 'POST' }).catch(
      () => undefined,
    );
  }
  await clearDriverSession();
  redirect('/driver/sign-in');
}
