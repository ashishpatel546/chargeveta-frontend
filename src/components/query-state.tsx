'use client';

import { InboxIcon, LockIcon } from 'lucide-react';
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

  // A role that may not see this is not a failure: nothing broke, and red
  // would say it did. Say whose screen it is and who can open it up.
  if (status === 403) {
    const role = /requires the (\w+) role/i.exec(message)?.[1];
    return (
      <div className="bg-card/60 text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
        <span
          aria-hidden
          className="bg-muted grid size-10 place-items-center rounded-xl"
        >
          <LockIcon className="size-5" />
        </span>
        <div className="max-w-[48ch] space-y-1 text-pretty">
          <p className="text-foreground font-medium">
            {role ? `For ${role}s and above` : 'Not available to your role'}
          </p>
          <p>
            Your role can’t open this. Ask an owner or admin of this operator if
            you need it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>That did not work</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card/60 text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
      <span
        aria-hidden
        className="bg-muted grid size-10 place-items-center rounded-xl"
      >
        <InboxIcon className="size-5" />
      </span>
      <p className="max-w-[44ch] text-pretty">{children}</p>
    </div>
  );
}
