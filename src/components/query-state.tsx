'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';

/**
 * The three things a screen full of API data can be: waiting, refused, or
 * empty. Written once so every screen says it the same way.
 */
export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function Failed({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : undefined;
  const message =
    error instanceof Error ? error.message : 'Something went wrong.';

  return (
    <Alert variant="destructive">
      <AlertTitle>
        {status === 403
          ? 'Your role does not allow this'
          : 'That did not work'}
      </AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
      {children}
    </p>
  );
}
