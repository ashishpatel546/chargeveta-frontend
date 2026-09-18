import { ConsoleShell } from '@/components/console-shell';
import { requirePrincipal } from '@/lib/server/principal';

/**
 * Everything behind a sign-in.
 *
 * The principal is resolved once here and handed down, so no page repeats the
 * check and every page can assume there is somebody signed in. The role comes
 * with it, which is what the navigation hides links by — hiding is a courtesy,
 * though: the API refuses regardless of what the console offers.
 */
export default async function ConsoleLayout({
  children,
}: LayoutProps<'/'>) {
  const principal = await requirePrincipal();
  return <ConsoleShell principal={principal}>{children}</ConsoleShell>;
}
