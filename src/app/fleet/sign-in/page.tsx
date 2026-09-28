import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FleetSignInForm } from './sign-in-form';
import { config } from '@/lib/config';
import { readFleetSession } from '@/lib/server/fleet-session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function FleetSignInPage({
  searchParams,
}: PageProps<'/fleet/sign-in'>) {
  const { expired } = await searchParams;
  // `expired` means the portal sent this visitor here because the API refused
  // their session; sending them back while the cookies linger would loop.
  if (!expired && (await readFleetSession())) redirect('/fleet');

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName} fleet
        </h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage your fleet&apos;s charging.
        </p>
      </div>
      {expired ? (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          Your session ended. Sign in again to carry on.
        </p>
      ) : null}
      <FleetSignInForm />
      <p className="text-muted-foreground text-center text-xs">
        Fleet accounts are created by your charging operator. Forgotten your
        password? Ask them for a new setup link.
      </p>
    </main>
  );
}
