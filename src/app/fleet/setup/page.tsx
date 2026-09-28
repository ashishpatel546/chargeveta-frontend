import type { Metadata } from 'next';
import Link from 'next/link';
import { FleetSetupForm } from './setup-form';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Set your password' };

/**
 * Where a fleet manager's invitation or reset email lands — the address the
 * API writes into it (`${CONSOLE_BASE_URL}/fleet/setup?token=`). Like staff's
 * `/setup`, it does not check the token before the form is sent, and does not
 * redirect a visitor who is signed in: see that page for why.
 */
export default async function FleetSetupPage({
  searchParams,
}: PageProps<'/fleet/setup'>) {
  const { token } = await searchParams;
  const setupToken = typeof token === 'string' ? token : '';

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName} fleet
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose a password for your fleet account. You will be signed in
          straight after.
        </p>
      </div>
      {setupToken ? (
        <FleetSetupForm setupToken={setupToken} />
      ) : (
        <div className="space-y-3 text-sm">
          <p className="border-l-2 border-amber-500 pl-3 text-amber-700 dark:text-amber-500">
            This link is missing its token. Open it again from the email, or
            ask your charging operator for a new one.
          </p>
          <p>
            <Link href="/fleet/sign-in" className="underline underline-offset-4">
              Go to sign in
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
