import 'server-only';

import { redirect } from 'next/navigation';
import type { DriverDto } from '../api/driver-types';
import { driverApiGet, DriverSessionExpiredError } from './driver-api';

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
  try {
    return await driverApiGet<DriverDto>('/driver/me');
  } catch (error) {
    if (error instanceof DriverSessionExpiredError) redirect('/driver/sign-in');
    throw error;
  }
}
