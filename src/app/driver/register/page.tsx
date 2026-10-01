import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OtpForm } from '../sign-in/otp-form';
import { config } from '@/lib/config';
import { detectCountry } from '@/lib/server/detect-country';
import { readDriverSession } from '@/lib/server/driver-session';

export const metadata: Metadata = { title: 'Create an account' };

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
        <p className="text-muted-foreground text-sm">{config.appName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>Enter your operator code and mobile number.</li>
          <li>Type the code we send you. That creates your account.</li>
          <li>Add an email and a password later, under Account, if you like.</li>
        </ol>
      </div>
      <OtpForm signUp defaultCountry={await detectCountry()} />
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href="/driver/sign-in" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
