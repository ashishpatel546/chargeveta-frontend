import { PlatformShell } from '@/components/platform-shell';
import { requirePlatformAdmin } from '@/lib/server/platform-principal';

/**
 * Everything a platform admin needs to be signed in for, and to have
 * replaced their temporary password for. `proxy.ts` lets the whole
 * `/platform` tree through, so this is the one place that decides.
 */
export default async function PlatformAppLayout({
  children,
}: LayoutProps<'/platform'>) {
  const me = await requirePlatformAdmin();
  return <PlatformShell me={me}>{children}</PlatformShell>;
}
