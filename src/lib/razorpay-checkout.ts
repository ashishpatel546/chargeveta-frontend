'use client';

/**
 * Loads Razorpay's Checkout script on demand and opens it for one order —
 * `charveta` doc 6 §22.4. There is no npm package for this; Razorpay's own
 * docs have the driver load `checkout.js` from their CDN and construct
 * `window.Razorpay` themselves.
 */

export interface RazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amountMinor: string;
  currency: string;
  name: string;
  description: string;
  email?: string;
  contact?: string;
  /**
   * Called the moment Razorpay reports an attempt failed, with a message fit
   * to show the driver. Checkout stays open so they can try again; nothing
   * is reported to the API from here — a failure is only ever recorded by the
   * API asking Razorpay itself.
   */
  onPaymentFailed?: (message: string) => void;
}

/** What Checkout's `handler` receives, and exactly what `…/confirm` wants (`ConfirmPaymentDto`). */
export interface RazorpayCheckoutResult {
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void;
}

/** What Checkout's `payment.failed` event carries. */
interface RazorpayFailure {
  error?: { code?: string; description?: string; reason?: string };
}

/** Turns Checkout's failure into words for the driver. */
export function checkoutFailureMessage(response: RazorpayFailure): string {
  const why = response.error?.description?.trim();
  return (
    `Payment failed${why ? `: ${why.replace(/\.$/, '')}` : ''}. ` +
    'If your bank took the money, it goes back to you automatically.'
  );
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<void> | undefined;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Resolves with the payment id + signature once the driver pays, or rejects
 * if they dismiss the sheet first — there is no successful outcome to
 * report then, so the caller's mutation should just surface the rejection.
 * A failed attempt is passed to `onPaymentFailed` at once; closing the sheet
 * after one rejects with that failure rather than "closed before paying".
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutResult> {
  if (typeof window === 'undefined') {
    throw new Error('Checkout only runs in the browser.');
  }
  await loadScript();
  const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor })
    .Razorpay;
  return new Promise((resolve, reject) => {
    let failure: string | undefined;
    const checkout = new Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amountMinor,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: {
        ...(options.email ? { email: options.email } : {}),
        ...(options.contact ? { contact: options.contact } : {}),
      },
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        resolve({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () =>
          reject(new Error(failure ?? 'Checkout was closed before paying.')),
      },
    });
    checkout.on('payment.failed', (response) => {
      failure = checkoutFailureMessage(response);
      options.onPaymentFailed?.(failure);
    });
    checkout.open();
  });
}
