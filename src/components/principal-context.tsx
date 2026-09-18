'use client';

import { createContext, useContext } from 'react';
import { atLeast, type Principal, type Role } from '@/lib/api/types';

/**
 * Who is signed in, for the screens.
 *
 * The layout resolves this on the server once per navigation and puts it here,
 * so a button that only an admin can use knows without asking the API again.
 * This only ever hides things: the API refuses on its own, and a console that
 * trusted this for anything more would be trusting the browser.
 */
const PrincipalContext = createContext<Principal | null>(null);

export function PrincipalProvider({
  principal,
  children,
}: {
  principal: Principal;
  children: React.ReactNode;
}) {
  return (
    <PrincipalContext.Provider value={principal}>
      {children}
    </PrincipalContext.Provider>
  );
}

export function usePrincipal(): Principal {
  const principal = useContext(PrincipalContext);
  if (!principal) {
    throw new Error('usePrincipal is only usable inside the console layout');
  }
  return principal;
}

/** `useCan('admin')` — whether this role reaches that rung of the ladder. */
export function useCan(role: Role): boolean {
  return atLeast(usePrincipal().role, role);
}
