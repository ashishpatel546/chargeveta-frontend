import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OtpForm } from '../sign-in/otp-form';
import { config } from '@/lib/config';
import { readDriverSession } from '@/lib/server/driver-session';

export const metadata: Metadata = { title: 'Sign up' };

/**
 * Signing up is signing in with a phone code for the first time: the code
 * creates the account, keyed by the number it proved, and it is the only thing
 * that does (`charveta` doc 6 §22.3, "Phone first"). An email and a password
 * are added afterwards, under Account. The same form as the sign-in page's
 * Phone tab, with words for someone who has no account yet.
 */
export default async function DriverRegisterPage() {
  if (await readDriverSession()) redirect('/driver');

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Sign up with your mobile number. We send you a code, and entering it
          creates your account. You can add an email and a password afterwards,
          under Account.
        </p>
      </div>
      <OtpForm />
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href="/driver/sign-in" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
