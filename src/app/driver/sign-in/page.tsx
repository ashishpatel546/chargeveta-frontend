import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInTabs } from './sign-in-tabs';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import { detectCountry } from '@/lib/server/detect-country';
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
      <SignInTabs defaultCountry={await detectCountry()} />
      <div className="space-y-2 border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">New here?</p>
        <Button
          variant="outline"
          className="w-full"
          render={<Link href="/driver/register" />}
          nativeButton={false}
        >
          Create an account
        </Button>
        <p className="text-muted-foreground text-xs">
          All you need is your mobile number.
        </p>
      </div>
    </main>
  );
}
