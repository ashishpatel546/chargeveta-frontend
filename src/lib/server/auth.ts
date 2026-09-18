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
