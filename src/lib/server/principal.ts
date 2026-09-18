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
export async function requirePrincipal(): Promise<Principal> {
  try {
    return await apiGet<Principal>('/auth/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/sign-in');
    throw error;
  }
}
