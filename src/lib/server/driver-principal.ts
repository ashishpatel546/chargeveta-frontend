import 'server-only';

import { redirect } from 'next/navigation';
import type { DriverDto } from '../api/driver-types';
import { driverApiGet, DriverSessionExpiredError } from './driver-api';
import { readDriverSession } from './driver-session';

/**
 * Who is signed in, or a redirect to the driver sign-in page —
 * `lib/server/principal.ts`'s `requirePrincipal`, mirrored for a driver.
 *
 * Every page under `driver/(app)` calls this through that layout, and it asks
 * the API rather than trusting the token for the same reason the staff
 * version does: a blocked or deactivated driver should lose access the
 * request after, not whenever their token happens to expire.
 */
export async function requireDriver(): Promise<DriverDto> {
  // Nobody signed in at all: a plain sign-in, not "your session ended".
  if (!(await readDriverSession())) redirect('/driver/sign-in');
  try {
    return await driverApiGet<DriverDto>('/driver/me');
  } catch (error) {
    if (error instanceof DriverSessionExpiredError) {
      redirect('/driver/sign-in?expired=1');
    }
    throw error;
  }
}
