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
}

/** What Checkout's `handler` receives, and exactly what `…/confirm` wants (`ConfirmPaymentDto`). */
export interface RazorpayCheckoutResult {
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface RazorpayInstance {
  open: () => void;
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
        ondismiss: () => reject(new Error('Checkout was closed before paying.')),
      },
    });
    checkout.open();
  });
}
