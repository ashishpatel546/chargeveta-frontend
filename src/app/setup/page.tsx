import type { Metadata } from 'next';
import Link from 'next/link';
import { SetupForm } from './setup-form';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Set your password' };

/**
 * Where an invitation or a password-reset email lands (doc 6 §22.2).
 *
 * Deliberately does not check the token before showing the form. Checking it
 * would need an API route that answers "is this token valid" without spending
 * it, which is an oracle for guessing tokens and buys a person nothing: they
 * find out on submit either way, with the same message.
 *
 * Nor does it redirect a signed-in visitor away, as the sign-in page does. The
 * person holding this link may be on a machine where someone else is signed
 * in, and sending them to that person's console would be exactly wrong.
 */
export default async function SetupPage({ searchParams }: PageProps<'/setup'>) {
  const { token } = await searchParams;
  const setupToken = typeof token === 'string' ? token : '';

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose a password for your account. You will be signed in straight
          after.
        </p>
      </div>
      {setupToken ? (
        <SetupForm setupToken={setupToken} />
      ) : (
        <div className="space-y-3 text-sm">
          <p className="border-l-2 border-amber-500 pl-3 text-amber-700 dark:text-amber-500">
            This link is missing its token. Open it again from the email, or
            ask your administrator for a new one.
          </p>
          <p>
            <Link href="/sign-in" className="underline underline-offset-4">
              Go to sign in
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
