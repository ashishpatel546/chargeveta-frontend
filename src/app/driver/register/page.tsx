import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './register-form';
import { config } from '@/lib/config';
import { readDriverSession } from '@/lib/server/driver-session';

export const metadata: Metadata = { title: 'Register' };

export default async function DriverRegisterPage() {
  if (await readDriverSession()) redirect('/driver');

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Register with an email and password.
        </p>
      </div>
      <RegisterForm />
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href="/driver/sign-in" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
