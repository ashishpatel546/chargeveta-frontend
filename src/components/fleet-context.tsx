'use client';

import { createContext, useContext } from 'react';
import type { FleetManagerMe } from '@/lib/api/fleet-types';

/**
 * The signed-in fleet manager and their fleet, resolved once per navigation
 * by `fleet/(app)/layout.tsx` — `principal-context.tsx` for the fleet portal.
 */
const FleetContext = createContext<FleetManagerMe | null>(null);

export function FleetProvider({
  me,
  children,
}: {
  me: FleetManagerMe;
  children: React.ReactNode;
}) {
  return <FleetContext.Provider value={me}>{children}</FleetContext.Provider>;
}

export function useFleetManager(): FleetManagerMe {
  const me = useContext(FleetContext);
  if (!me) throw new Error('useFleetManager is only usable inside the fleet portal');
  return me;
}
