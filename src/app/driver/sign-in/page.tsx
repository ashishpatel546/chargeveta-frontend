import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInTabs } from './sign-in-tabs';
import { config } from '@/lib/config';
import { readDriverSession } from '@/lib/server/driver-session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function DriverSignInPage({
  searchParams,
}: PageProps<'/driver/sign-in'>) {
  if (await readDriverSession()) redirect('/driver');

  const { expired } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-sm">Sign in to charge.</p>
      </div>
      {expired ? (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          Your session ended. Sign in again to carry on.
        </p>
      ) : null}
      <SignInTabs />
      <p className="text-muted-foreground text-center text-sm">
        New here?{' '}
        <Link href="/driver/register" className="text-foreground underline underline-offset-4">
          Register with an email
        </Link>
      </p>
    </main>
  );
}
