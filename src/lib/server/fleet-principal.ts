import 'server-only';

import { redirect } from 'next/navigation';
import type { FleetManagerMe } from '../api/fleet-types';
import { FleetApiError, fleetApiGet, FleetSessionExpiredError } from './fleet-api';
import { readFleetSession } from './fleet-session';

/**
 * The signed-in fleet manager and their fleet, or a redirect to the fleet
 * sign-in page — `requireDriver()`, mirrored.
 *
 * It asks the API every time rather than trusting the cookie: a manager whose
 * fleet was deactivated, or whose operator switched the fleet module off, is
 * refused by the API at once, and this page should say so at once too.
 *
 * The redirect carries `expired=1`, which stops the sign-in page sending a
 * visitor who still has (now useless) cookies straight back here in a loop.
 * Signing in again replaces them.
 */
export async function requireFleetManager(): Promise<FleetManagerMe> {
  // Nobody signed in at all: a plain sign-in, not "your session ended".
  if (!(await readFleetSession())) redirect('/fleet/sign-in');
  try {
    return await fleetApiGet<FleetManagerMe>('/fleet-manager/me');
  } catch (error) {
    if (
      error instanceof FleetSessionExpiredError ||
      (error instanceof FleetApiError &&
        (error.status === 401 || error.status === 403))
    ) {
      redirect('/fleet/sign-in?expired=1');
    }
    throw error;
  }
}
