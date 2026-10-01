import { DriverShell } from '@/components/driver-shell';
import { requireDriver } from '@/lib/server/driver-principal';

/**
 * Everything a driver needs to be signed in for — `(console)/layout.tsx`,
 * mirrored. `requireDriver()` is the real check; `proxy.ts` excludes the
 * whole `/driver` tree from its shortcut precisely so this is the one place
 * that decides.
 */
export default async function DriverAppLayout({ children }: LayoutProps<'/driver'>) {
  const driver = await requireDriver();
  return <DriverShell driver={driver}>{children}</DriverShell>;
}
