import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FleetSignInForm } from './sign-in-form';
import { readFleetSession } from '@/lib/server/fleet-session';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Sign in' };

export default async function FleetSignInPage({
  searchParams,
}: PageProps<'/fleet/sign-in'>) {
  const { expired } = await searchParams;
  // `expired` means the portal sent this visitor here because the API refused
  // their session; sending them back while the cookies linger would loop.
  if (!expired && (await readFleetSession())) redirect('/fleet');

  return (
    <AuthLayout surface="fleet">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage your fleet&apos;s charging.
        </p>
      </div>
      {expired ? (
        <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
          Your session ended. Sign in again to carry on.
        </p>
      ) : null}
      <FleetSignInForm />
      <p className="text-muted-foreground text-center text-xs">
        Fleet accounts are created by your charging operator. Forgotten your
        password? Ask them for a new setup link.
      </p>
    </AuthLayout>
  );
}
