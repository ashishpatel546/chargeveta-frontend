/**
 * What a form action hands back to its form.
 *
 * Kept out of the `'use server'` files on purpose: everything exported from one
 * of those becomes a callable server action, and a type is not that.
 */
export interface FormState {
  /** Shown above the form. Absent when nothing has gone wrong yet. */
  error?: string;
  /** Shown when the action succeeded and the page stays put. */
  message?: string;
}

export const EMPTY_FORM: FormState = {};

/**
 * `driver-auth.ts`'s phone sign-in is two steps, so its state carries more
 * than plain `error`/`message`: the phone step's result is what the code
 * step needs. Kept here rather than in `driver-auth.ts` for the same reason
 * `FormState` is kept out of `lib/server/auth.ts` — a `'use server'` file may
 * only export async functions, and neither a type nor a constant is one.
 */
/** Where a driver's sign-in code went — the API's `DRIVER_OTP_CHANNEL`. */
export type OtpChannel = 'sms' | 'whatsapp';

export interface OtpRequestState {
  error?: string;
  sent?: {
    phone: string;
    channel: OtpChannel;
    tenantSlug?: string;
    resendAfterSeconds: number;
  };
}
export const EMPTY_OTP_REQUEST: OtpRequestState = {};
