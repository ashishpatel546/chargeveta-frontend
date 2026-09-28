'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { config } from '../config';
import type { FormState } from '../forms';
import { fleetApiFetch, readFleetMessage } from './fleet-api';
import { clearFleetSession, readFleetSession, writeFleetSession } from './fleet-session';
import type { FleetTokenPair } from './fleet-session';

/**
 * How a fleet manager signs in (`charveta` doc 6 §23): an email and password
 * they chose from the setup link staff sent them. There is no self-signup —
 * the operator's staff create every fleet manager.
 */

async function post(
  path: string,
  body: unknown,
): Promise<
  | { ok: true; pair: FleetTokenPair }
  | { ok: false; status: number; error: string }
> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      error: await readFleetMessage(response),
    };
  }
  return { ok: true, pair: (await response.json()) as FleetTokenPair };
}

const credentials = z.object({
  tenantSlug: z.string().trim().max(100).optional(),
  email: z.email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
});

export async function fleetSignInAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse({
    tenantSlug: (form.get('tenantSlug') as string | null) || undefined,
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const result = await post('/fleet-manager/auth/login', parsed.data);
  if (!result.ok) {
    // One reason for every refusal, as the API gives: saying which half was
    // wrong would tell a stranger whether an address is a fleet manager here.
    return {
      error:
        result.status === 401
          ? 'Those details were not accepted.'
          : result.error,
    };
  }
  await writeFleetSession(result.pair);
  redirect('/fleet');
}

const setup = z
  .object({
    setupToken: z.string().trim().min(1, 'This link is missing its token'),
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

/** Redeems the setup link staff sent, and signs the manager in. */
export async function fleetSetupAction(
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

  const result = await post('/fleet-manager/auth/setup', {
    setupToken: parsed.data.setupToken,
    password: parsed.data.password,
  });
  if (!result.ok) {
    return {
      error:
        result.status === 401
          ? 'This link has expired or has already been used. Ask the charging operator for a new one.'
          : result.error,
    };
  }
  await writeFleetSession(result.pair);
  redirect('/fleet');
}

/** Ends the session on the API as well as here. */
export async function fleetSignOut(): Promise<void> {
  if (await readFleetSession()) {
    await fleetApiFetch('/fleet-manager/auth/logout', { method: 'POST' }).catch(
      () => undefined,
    );
  }
  await clearFleetSession();
  redirect('/fleet/sign-in');
}
