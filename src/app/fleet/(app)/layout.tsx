import { FleetShell } from '@/components/fleet-shell';
import { requireFleetManager } from '@/lib/server/fleet-principal';

/**
 * Everything a fleet manager needs to be signed in for. `requireFleetManager()`
 * is the real check; `proxy.ts` lets the whole `/fleet` tree through so
 * this is the one place that decides, as `driver/(app)/layout.tsx` is.
 */
export default async function FleetAppLayout({ children }: LayoutProps<'/fleet'>) {
  const me = await requireFleetManager();
  return <FleetShell me={me}>{children}</FleetShell>;
}
