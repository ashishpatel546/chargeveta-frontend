import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Button } from '@/components/ui/button';
import { changePassword, signOut } from '@/lib/server/auth';
import { readPrincipal } from '@/lib/server/principal';
import { AuthLayout } from '@/components/auth-layout';

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
    <AuthLayout surface="console">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Change your password</h1>
        <p className="text-muted-foreground text-sm">
          Change the password for <strong>{who}</strong>. Anywhere else you are
          signed in is signed out; this browser stays signed in.
        </p>
      </div>
      {forced ? (
        <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
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
    </AuthLayout>
  );
}
