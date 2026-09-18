'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { config } from '../config';
import type { FormState } from '../forms';
import { apiFetch, readMessage } from './api';
import { clearSession, readSession, writeSession } from './session';
import type { TokenPair } from './session';

const credentials = z.object({
  tenantSlug: z.string().trim().max(100).optional(),
  email: z.email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
});

/**
 * Signs in and keeps the pair in `httpOnly` cookies.
 *
 * The tenant slug is offered rather than required: a dedicated deployment
 * ignores it and a shared one needs it, and the API already knows which it is.
 * Deciding that here would mean two places holding the same rule.
 */
export async function signIn(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error) };
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return {
      error: `The API at ${config.apiBaseUrl} did not answer. Is it running?`,
    };
  }

  if (!response.ok) {
    // The API gives one generic reason for every bad sign-in, and so does this:
    // saying which half was wrong tells a stranger whether an address is
    // registered here.
    return {
      error:
        response.status === 401
          ? 'Those details were not accepted.'
          : await readMessage(response),
    };
  }

  await writeSession((await response.json()) as TokenPair);
  // Outside the try: `redirect` works by throwing, and a catch would swallow it.
  redirect('/stations');
}

const setup = z
  .object({
    setupToken: z.string().trim().min(1, 'This link is missing its token'),
    // The API's own limits (12 to 256), repeated so a short password is
    // caught before a round trip — the API still has the final word.
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(256, 'Use at most 256 characters'),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: 'The two passwords do not match',
    path: ['confirm'],
  });

/**
 * Redeems a setup token — from an invitation or a password reset email — and
 * signs the person in with the password they just chose (doc 6 §19.2, §22.2).
 *
 * The API ends every other session the user had, so a reset really is one.
 */
export async function redeemSetupToken(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = setup.safeParse({
    setupToken: form.get('setupToken'),
    password: form.get('password'),
    confirm: form.get('confirm'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form' };
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        setupToken: parsed.data.setupToken,
        password: parsed.data.password,
      }),
      cache: 'no-store',
    });
  } catch {
    return {
      error: `The API at ${config.apiBaseUrl} did not answer. Is it running?`,
    };
  }

  if (!response.ok) {
    // One answer for every way a token can be wrong, as the API gives: used,
    // expired, replaced by a newer one, or for an account that was since
    // deactivated all look the same from outside, and should.
    return {
      error:
        response.status === 401
          ? 'This link has expired or has already been used. Ask your administrator for a new one.'
          : await readMessage(response),
    };
  }

  // A person arriving from an email may still be signed in as somebody else
  // in this browser — a shared machine, an admin testing an invitation. The
  // new pair replaces the old one, so they land as who the link was for.
  await writeSession((await response.json()) as TokenPair);
  redirect('/stations');
}

/** Ends the session on the API as well as here. */
export async function signOut(): Promise<void> {
  if (await readSession()) {
    // Best effort. If the API cannot be reached the cookies still go and the
    // session expires on its own; leaving the browser signed in because a
    // network call failed would be the worse answer.
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
  }
  await clearSession();
  redirect('/sign-in');
}
