import 'server-only';

import { redirect } from 'next/navigation';
import type { PlatformAdminMe } from '../api/platform-types';
import {
  PlatformApiError,
  platformApiGet,
  PlatformSessionExpiredError,
} from './platform-api';
import { readPlatformSession } from './platform-session';

/**
 * The signed-in platform administrator, or a redirect to the platform sign-in
 * page — `requireFleetManager()`, mirrored. It asks the API every time rather
 * than trusting the cookie, so a revoked session is refused at once.
 *
 * `/platform/auth/me` answers even while the admin still has to change their
 * password, which is what lets this be the one place that sends them to do
 * so before any platform page renders.
 */
export async function readPlatformAdmin(): Promise<PlatformAdminMe> {
  if (!(await readPlatformSession())) redirect('/platform/sign-in');
  try {
    return await platformApiGet<PlatformAdminMe>('/platform/auth/me');
  } catch (error) {
    if (
      error instanceof PlatformSessionExpiredError ||
      (error instanceof PlatformApiError &&
        (error.status === 401 || error.status === 403))
    ) {
      redirect('/platform/sign-in?expired=1');
    }
    throw error;
  }
}

/** `readPlatformAdmin()`, and a detour first if their password must change. */
export async function requirePlatformAdmin(): Promise<PlatformAdminMe> {
  const me = await readPlatformAdmin();
  if (me.mustChangePassword) redirect('/platform/change-password');
  return me;
}
