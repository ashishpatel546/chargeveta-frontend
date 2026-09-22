'use client';

import { createContext, useContext, useState } from 'react';
import type { DriverDto } from '@/lib/api/driver-types';

/**
 * Who is signed in, for the driver screens — `principal-context.tsx`, mirrored.
 *
 * `driver/(app)/layout.tsx` resolves this once per navigation and puts it
 * here, so a screen that wants the driver's name does not fetch `/driver/me`
 * again just to read it. Unlike the (read-only) staff principal, this one
 * also carries a setter: the account screen edits the driver's own name, and
 * without a shared setter the header (also reading this context) would keep
 * showing the old one until the next navigation re-ran the layout's fetch.
 */
const DriverContext = createContext<
  [DriverDto, (driver: DriverDto) => void] | null
>(null);

export function DriverProvider({
  driver,
  children,
}: {
  driver: DriverDto;
  children: React.ReactNode;
}) {
  const state = useState(driver);
  return (
    <DriverContext.Provider value={state}>{children}</DriverContext.Provider>
  );
}

export function useDriver(): DriverDto {
  const state = useContext(DriverContext);
  if (!state) {
    throw new Error('useDriver is only usable inside the driver app layout');
  }
  return state[0];
}

/** Updates the driver every screen inside the layout reads through `useDriver`. */
export function useSetDriver(): (driver: DriverDto) => void {
  const state = useContext(DriverContext);
  if (!state) {
    throw new Error('useSetDriver is only usable inside the driver app layout');
  }
  return state[1];
}
