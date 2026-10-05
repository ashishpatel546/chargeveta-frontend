import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlatformSignInForm } from './sign-in-form';
import { readPlatformSession } from '@/lib/server/platform-session';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Sign in' };

export default async function PlatformSignInPage({
  searchParams,
}: PageProps<'/platform/sign-in'>) {
  const { expired } = await searchParams;
  // `expired` means the console sent this visitor here because the API
  // refused their session; sending them back while the cookies linger would
  // loop.
  if (!expired && (await readPlatformSession())) redirect('/platform/dashboard');

  return (
    <AuthLayout surface="platform">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to administer the operators on this installation.
        </p>
      </div>
      {expired ? (
        <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
          Your session ended. Sign in again to carry on.
        </p>
      ) : null}
      <PlatformSignInForm />
    </AuthLayout>
  );
}
