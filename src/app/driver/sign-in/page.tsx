import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInTabs } from './sign-in-tabs';
import { Button } from '@/components/ui/button';
import { detectCountry } from '@/lib/server/detect-country';
import { readDriverSession } from '@/lib/server/driver-session';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Sign in' };

export default async function DriverSignInPage({
  searchParams,
}: PageProps<'/driver/sign-in'>) {
  const { expired } = await searchParams;

  // Not after a failed session — see the staff sign-in page.
  if (!expired && (await readDriverSession())) redirect('/driver');

  return (
    <AuthLayout surface="driver">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Sign in to charge</h1>
        <p className="text-muted-foreground text-sm">With your mobile number, or your email and password.</p>
      </div>
      {expired ? (
        <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
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
    </AuthLayout>
  );
}
