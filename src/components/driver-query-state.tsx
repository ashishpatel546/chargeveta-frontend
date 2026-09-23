'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DriverApiError } from '@/lib/api/driver-client';

export { Empty, Loading } from '@/components/query-state';

/**
 * `query-state.tsx`'s `Failed`, for a `DriverApiError` rather than an
 * `ApiError` — a driver has no role to explain a 403 with, but a 422 is
 * common here (a blocked card, a charger not connected), so that is the one
 * worth a distinct title.
 */
export function Failed({ error }: { error: unknown }) {
  const status = error instanceof DriverApiError ? error.status : undefined;
  const message =
    error instanceof Error ? error.message : 'Something went wrong.';

  return (
    <Alert variant="destructive">
      <AlertTitle>
        {status === 422 ? "That can't be done right now" : 'That did not work'}
      </AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
