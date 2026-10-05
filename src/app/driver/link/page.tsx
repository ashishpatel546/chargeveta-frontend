import type { Metadata } from 'next';
import { RedeemLinkForm } from './redeem-link-form';
import { RequestLinkForm } from './request-link-form';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Sign in with a link' };

/**
 * Two purposes, told apart by whether a token is on the URL:
 *
 * - With one (`?token=cvl....`), the link an email sent — sign-in, or
 *   confirming an address added under Account (`redeemLinkAction`'s doc
 *   comment).
 * - Without one, a form to request a new link, for someone who followed a
 *   sign-in prompt to "email me a link" or whose old one expired.
 *
 * Deliberately does not check the token before showing the redeem button, and
 * does not redirect a signed-in visitor away — `setup/page.tsx`'s reasoning,
 * unchanged: checking it would be a guessing oracle, and the person holding
 * this link may not be who is currently signed in on this machine.
 */
export default async function DriverLinkPage({
  searchParams,
}: PageProps<'/driver/link'>) {
  const { token } = await searchParams;
  const linkToken = typeof token === 'string' ? token : '';

  return (
    <AuthLayout surface="driver">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Sign in with a link</h1>
        <p className="text-muted-foreground text-sm">
          {linkToken
            ? 'Continue to sign in with this link.'
            : 'Get a sign-in link by email.'}
        </p>
      </div>
      {linkToken ? <RedeemLinkForm token={linkToken} /> : <RequestLinkForm />}
    </AuthLayout>
  );
}
