'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { config } from '../config';
import type { FormState } from '../forms';
import { platformApiFetch, readPlatformRefusal } from './platform-api';
import {
  clearPlatformSession,
  readPlatformSession,
  writePlatformSession,
} from './platform-session';
import type { PlatformTokenPair } from './platform-session';
import { clientHeaders } from './client-address';

/**
 * How a platform administrator signs in: an email and a password, and no
 * tenant slug — a platform admin belongs to no operator. The first admin is
 * seeded on the API with a temporary password, which is why a fresh session
 * may be sent straight to `/platform/change-password`.
 */

const credentials = z.object({
  email: z.email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
});

export async function platformSignInAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/platform/auth/sign-in`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await clientHeaders()),
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return {
      error: `The API at ${config.apiBaseUrl} did not answer. Is it running?`,
    };
  }

  if (!response.ok) {
    // One reason for every bad sign-in, as the API gives.
    if (response.status === 401) return { error: 'Those details were not accepted.' };
    if (response.status === 429) {
      return { error: 'Too many attempts. Wait a minute and try again.' };
    }
    return { error: (await readPlatformRefusal(response)).message };
  }

  await writePlatformSession((await response.json()) as PlatformTokenPair);
  // The tenants page's layout sends a must-change admin on to change their
  // password, so this does not need to ask first.
  redirect('/platform/tenants');
}

const change = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    // The API's own limits, repeated so a short password is caught before a
    // round trip — the API still has the final word.
    newPassword: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(256, 'Use at most 256 characters'),
    confirm: z.string(),
  })
  .refine((value) => value.newPassword === value.confirm, {
    message: 'The two new passwords do not match',
    path: ['confirm'],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'The new password has to be different from the current one',
    path: ['newPassword'],
  });

/**
 * Changes the signed-in admin's own password. The API ends every other
 * session they have and keeps this one, so the cookies stay as they are.
 */
export async function platformChangePasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = change.safeParse({
    currentPassword: form.get('currentPassword'),
    newPassword: form.get('newPassword'),
    confirm: form.get('confirm'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form' };
  }

  let call: Awaited<ReturnType<typeof platformApiFetch>>;
  try {
    call = await platformApiFetch('/platform/auth/password', {
      method: 'PUT',
      contentType: 'application/json',
      body: JSON.stringify({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      }),
    });
  } catch {
    return {
      error: `The API at ${config.apiBaseUrl} did not answer. Is it running?`,
    };
  }
  if (!call.ok) redirect('/platform/sign-in?expired=1');
  if (!call.response.ok) {
    return { error: (await readPlatformRefusal(call.response)).message };
  }
  redirect('/platform/tenants');
}

const setup = z
  .object({
    setupToken: z.string().min(1, 'This link is missing its token'),
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
 * Redeems a platform admin's setup or reset link (`/platform/setup`): they
 * choose their own password and are signed in. There is nothing to change
 * afterwards — nobody else ever knew it.
 */
export async function platformRedeemSetupAction(
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
    response = await fetch(`${config.apiBaseUrl}/platform/auth/setup`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await clientHeaders()),
      },
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
    // One answer for every way a link can be wrong, as the API gives.
    if (response.status === 401) {
      return {
        error:
          'This link has expired, has been replaced by a newer one, or has already been used. Ask another platform admin for a new one.',
      };
    }
    if (response.status === 429) {
      return { error: 'Too many attempts. Wait a minute and try again.' };
    }
    return { error: (await readPlatformRefusal(response)).message };
  }

  // Replaces any platform session already in this browser, so they land as
  // who the link was for.
  await writePlatformSession((await response.json()) as PlatformTokenPair);
  redirect('/platform/tenants');
}

/** Ends the session on the API as well as here. */
export async function platformSignOut(): Promise<void> {
  if (await readPlatformSession()) {
    await platformApiFetch('/platform/auth/sign-out', { method: 'POST' }).catch(
      () => undefined,
    );
  }
  await clearPlatformSession();
  redirect('/platform/sign-in');
}
