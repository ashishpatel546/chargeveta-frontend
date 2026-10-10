import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from './sign-in-form';
import { readSession } from '@/lib/server/session';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { expired } = await searchParams;

  // Already signed in and arriving here by hand: send them on rather than
  // offering a form that would replace a working session. Not when the console
  // sent them here because the session failed — cookies can outlive a session
  // the API has ended, and sending them back would only bounce them here again.
  if (!expired && (await readSession())) redirect('/dashboard');

  return (
    <AuthLayout surface="console">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to the operator console.
        </p>
      </div>
      {expired ? (
        <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
          Your session ended. Sign in again to carry on.
        </p>
      ) : null}
      <SignInForm />
      <p className="text-muted-foreground border-t pt-6 text-center text-sm">
        Charging your car?{' '}
        <Link href="/driver/sign-in" className="text-foreground underline underline-offset-4">
          Open the driver app
        </Link>
      </p>
    </AuthLayout>
  );
}
