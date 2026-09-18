'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api/client';

/**
 * One query client for the app.
 *
 * Created in state rather than at module scope: a module-level client is shared
 * between requests on the server, which would leak one tenant's cached answers
 * into another's render.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Charging data moves; five seconds is short enough that a stale
            // screen is never surprising and long enough that clicking about
            // does not hammer the API.
            staleTime: 5_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // A refusal is an answer: retrying a 403 just asks again.
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
