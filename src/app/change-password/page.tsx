import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import { changePassword, signOut } from '@/lib/server/auth';
import { readPrincipal } from '@/lib/server/principal';

export const metadata: Metadata = { title: 'Change your password' };

/**
 * Where a staff user changes their own password.
 *
 * Deliberately outside the `(console)` layout: that layout sends anyone who
 * still has to change a temporary password *here*, so living under it would
 * loop. It still needs a session — `readPrincipal()` sends a signed-out
 * visitor to sign in — and the API refuses everything else until this is
 * done, which `lib/api/client.ts` turns into a redirect back here too.
 */
export default async function ChangePasswordPage() {
  const principal = await readPrincipal();
  const forced = principal.kind === 'user' && principal.mustChangePassword === true;
  const who = principal.kind === 'user' ? principal.email : principal.name;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Change the password for <strong>{who}</strong>. Anywhere else you are
          signed in is signed out; this browser stays signed in.
        </p>
      </div>
      {forced ? (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          You were given a temporary password. Choose your own before carrying
          on.
        </p>
      ) : null}
      <ChangePasswordForm action={changePassword} />
      <div className="flex items-center justify-between text-sm">
        {forced ? (
          <span />
        ) : (
          <Link href="/dashboard" className="underline underline-offset-4">
            Back to the console
          </Link>
        )}
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
