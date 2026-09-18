import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignInForm } from './sign-in-form';
import { config } from '@/lib/config';
import { readSession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  // Already signed in and arriving here by hand: send them on rather than
  // offering a form that would replace a working session.
  if (await readSession()) redirect('/stations');

  const { expired } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Sign in to the operator console.
        </p>
      </div>
      {expired ? (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          Your session ended. Sign in again to carry on.
        </p>
      ) : null}
      <SignInForm />
    </main>
  );
}
