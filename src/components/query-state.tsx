'use client';

import { InboxIcon } from 'lucide-react';
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
        <Skeleton key={index} className="h-12 w-full rounded-xl" />
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
    <div className="bg-card/60 text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
      <span aria-hidden className="bg-muted grid size-10 place-items-center rounded-xl">
        <InboxIcon className="size-5" />
      </span>
      <p className="max-w-[44ch] text-pretty">{children}</p>
    </div>
  );
}
