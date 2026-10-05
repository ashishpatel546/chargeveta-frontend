import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotForm } from './forgot-form';
import { AuthLayout } from '@/components/auth-layout';

export const metadata: Metadata = { title: 'Forgot password' };

/**
 * "Forgot password?" for staff (doc 6 §19.2). The email it asks for carries a
 * link to `/setup`, the same page an administrator's reset link opens.
 *
 * Under `/sign-in` so the proxy's (`proxy.ts`) public-path rule already covers it.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthLayout surface="console">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Reset your password</h1>
        <p className="text-muted-foreground text-sm">
          We will email you a link to choose a new password. Your current
          password keeps working until you use it.
        </p>
      </div>
      <ForgotForm />
      <p className="text-sm">
        <Link href="/sign-in" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
