'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * How many screens this tab has shown since the console loaded. Module state,
 * so it survives client-side navigation and resets on a full load — which is
 * exactly when the browser's history may hold nothing of ours to go back to.
 */
let screensShown = 0;

/**
 * Counts screens. Mounted once, in the console shell; `BackButton` reads the
 * count to decide whether "back" can mean the browser's back.
 */
export function useCountScreens() {
  const pathname = usePathname();
  useEffect(() => {
    screensShown += 1;
  }, [pathname]);
}

/**
 * "Back" on a detail page.
 *
 * Goes to the previous screen when there is one in this tab — a charger
 * opened from a session goes back to that session, not to the charger list.
 * Opened straight from a link, a bookmark or an installed app's cold start,
 * there is no previous screen of ours (and `router.back()` would leave the
 * app, or do nothing), so it goes to `fallback`, the list the page belongs to.
 */
export function BackButton({
  fallback,
  label = 'Back',
}: {
  fallback: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground -ml-2 mb-2 print:hidden"
      onClick={() => {
        if (screensShown > 1) router.back();
        else router.push(fallback);
      }}
    >
      <ArrowLeftIcon />
      {label}
    </Button>
  );
}
