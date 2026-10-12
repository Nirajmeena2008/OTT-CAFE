import { api } from './api';

export interface RazorpayCheckoutOptions {
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  order_id: string;
  receipt?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  themeColor?: string;
  onSuccess?: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onError?: (error: Error | { code?: string; description?: string; source?: string; step?: string; reason?: string }) => void;
  onDismiss?: () => void;
}

/**
 * Ensures Razorpay Checkout script (https://checkout.razorpay.com/v1/checkout.js) is loaded.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * STEP 2: FRONTEND - Checkout
 * Opens the Razorpay Standard Checkout modal with order_id, handles success, dismissal, and failure.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
  }

  // Resolve key ID safely without exposing secrets
  const key = await api.getRazorpayKey();
  if (!key) {
    throw new Error('Razorpay Key ID is not configured.');
  }

  return new Promise((resolve, reject) => {
    let isHandled = false;

    const rzpOptions = {
      key,
      amount: options.amount,
      currency: options.currency || 'INR',
      name: options.name || 'Out of the Town - Restro and Bakery',
      description: options.description || 'Delicious Gourmet Food & Artisan Bakery',
      image: '/ott-logo.svg',
      order_id: options.order_id,
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || '',
      },
      notes: options.notes || {},
      theme: {
        color: options.themeColor || '#d97706', // Warm amber
      },
      handler: async function (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) {
        isHandled = true;
        try {
          // STEP 3: Send razorpay_payment_id, razorpay_order_id, razorpay_signature to verify endpoint
          await api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (options.onSuccess) {
            options.onSuccess(response);
          }
          resolve(response);
        } catch (err: any) {
          const verifyError = new Error(err.message || 'Payment signature verification failed');
          if (options.onError) {
            options.onError(verifyError);
          }
          reject(verifyError);
        }
      },
      modal: {
        ondismiss: function () {
          if (!isHandled) {
            if (options.onDismiss) {
              options.onDismiss();
            }
            reject(new Error('Payment cancelled by user.'));
          }
        },
      },
    };

    const rzpInstance = new (window as any).Razorpay(rzpOptions);

    // Handle payment.failed event
    rzpInstance.on('payment.failed', function (response: any) {
      isHandled = true;
      const errorMsg =
        response?.error?.description || response?.error?.reason || 'Payment failed. Please try again.';
      const failureError = new Error(errorMsg);
      if (options.onError) {
        options.onError(response?.error || failureError);
      }
      reject(failureError);
    });

    rzpInstance.open();
  });
}
