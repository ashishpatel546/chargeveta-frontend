import type { Metadata } from 'next';
import Link from 'next/link';
import { PlatformSetupForm } from './setup-form';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Set your password' };

/**
 * Where a platform admin's setup or reset link lands (doc 6 §19.4) — the
 * staff `/setup` page, for the people above the tenants. The same two rules:
 * the token is not checked before the form is shown (that would be an oracle
 * for guessing them), and a signed-in visitor is not sent away, since the
 * person holding the link may be at someone else's machine.
 */
export default async function PlatformSetupPage({
  searchParams,
}: PageProps<'/platform/setup'>) {
  const { token } = await searchParams;
  const setupToken = typeof token === 'string' ? token : '';

  return (
    <AuthLayout surface="platform">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Choose a password</h1>
        <p className="text-muted-foreground text-sm">
          Choose a password for your platform admin account. You will be
          signed in straight after.
        </p>
      </div>
      {setupToken ? (
        <PlatformSetupForm setupToken={setupToken} />
      ) : (
        <div className="space-y-3 text-sm">
          <p className="border-l-2 border-caution pl-3 text-caution-ink">
            This link is missing its token. Open it again exactly as you were
            given it, or ask another platform admin for a new one.
          </p>
          <p>
            <Link href="/platform/sign-in" className="underline underline-offset-4">
              Go to sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
