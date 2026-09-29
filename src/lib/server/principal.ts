import 'server-only';

import { redirect } from 'next/navigation';
import type { Principal } from '../api/types';
import { apiGet, SessionExpiredError } from './api';

/**
 * Who is signed in, or a redirect to the sign-in page.
 *
 * Every page under the console layout calls this through the layout, so a page
 * can assume a principal. It asks the API rather than reading the token,
 * because the role on a token is a snapshot: the API re-reads the session each
 * request, so a demotion applies immediately, and the console should show what
 * the API will actually allow.
 */
export async function readPrincipal(): Promise<Principal> {
  try {
    return await apiGet<Principal>('/auth/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/sign-in');
    throw error;
  }
}

/**
 * `readPrincipal()`, and a detour first if the user's password must change.
 *
 * `/auth/me` still answers while it must, which is what lets the console
 * layout be the one place that sends them to `/change-password` before any
 * page renders. The browser client (`lib/api/client.ts`) catches the same
 * thing mid-session, from the API's `PASSWORD_CHANGE_REQUIRED` refusal.
 */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await readPrincipal();
  if (principal.kind === 'user' && principal.mustChangePassword) {
    redirect('/change-password');
  }
  return principal;
}
