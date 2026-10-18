/**
 * premiumCheckout — THE one checkout implementation for VicharakAI Premium.
 *
 * Every upgrade surface (the trial-expiry PaywallScreen, the in-app Premium
 * tab, the Account & plan sheet) calls `startPremiumCheckout` so there is a
 * single place where money changes hands and a single place to fix when it
 * breaks. Before 2026-09-27 the Razorpay flow was copy-pasted into three
 * components and they had already drifted apart.
 *
 * Routing — `isIndia` is EXAM-BASED: callers derive it from the student's
 * exam via pricingRegion.examPricingIsIndia (Indian exam → Razorpay,
 * US/international exam → Creem; unknown → India). Never IP/geo.
 *   India (isIndia)     → Razorpay — create-razorpay-order builds the order
 *                         and returns the PUBLIC key_id the modal must open
 *                         with (key and order always come from the same
 *                         account), then verify-razorpay-payment confirms it
 *                         server-side and writes the entitlement row to
 *                         vicharakai_subscriptions.
 *   Everywhere else     → Creem — a hosted payment link carrying
 *                         metadata[app_email]; the creem-webhook hook writes
 *                         the entitlement when Creem confirms the payment.
 *
 * ONE plan is sold: VicharakAI Premium, ₹149/month (or $14.99/month). The
 * ₹10 day tier was deleted on 2026-09-27 — nothing here can charge it.
 */
import { PAID_PLANS, PREMIUM_PLAN, type PaidPlanId } from '../../access';
import { creemCheckoutUrl } from '../../creemConfig';
import { hookHeaders } from '../../shared/platformAuth';
import {
  trackCheckoutFailed,
  trackCheckoutStart,
  trackCheckoutSuccess,
  trackEvent,
} from '../../shared/track';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
/** Razorpay's modal theme colour — a concrete hex (the modal can't read CSS vars). */
export const RAZORPAY_THEME = '#0057FF';

export const CHECKOUT_START_ERROR =
  'We couldn’t start the payment — please try again in a moment. No money was taken.';
export const CHECKOUT_UNCONFIRMED_ERROR =
  'Your payment went through but we couldn’t confirm it automatically. Nothing is lost — contact support with your payment ID and we’ll set your plan up right away.';
export const CHECKOUT_FAILED_ERROR =
  'That payment didn’t go through — no money was taken. Check your payment method and try again.';
export const CHECKOUT_UNREACHABLE_ERROR =
  'We couldn’t reach the payment service. Check your connection and try again.';

/** Load Razorpay's checkout.js on demand — only when a paid CTA is tapped. */
export function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay script failed to load'));
    document.head.appendChild(script);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const text = await response.text();
    if (!text) return {};
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export interface PremiumCheckoutArgs {
  spaceId: string;
  /** The signed-in student's email — the key the entitlement row is written under. */
  userEmail: string;
  /** From pricingRegion.examPricingIsIndia(exam): an Indian exam pays in ₹
   * through Razorpay; a US/international exam in $ through Creem. */
  isIndia: boolean;
  plan?: PaidPlanId;
  /** Fired after a VERIFIED payment — the entitlement row already exists. */
  onSuccess: (plan: PaidPlanId) => void;
  /** A human sentence to show the student. Never a raw error. */
  onError: (message: string) => void;
  /** Always fires when the flow stops being busy (success, failure, dismiss). */
  onSettled: () => void;
  /** International only: the tab opened, payment happens on Creem. */
  onCreemRedirect?: () => void;
}

/**
 * Start checkout for VicharakAI Premium. Resolves as soon as the payment
 * surface is open or has failed to open — completion arrives through
 * `onSuccess` / `onError`.
 */
export async function startPremiumCheckout({
  spaceId,
  userEmail,
  isIndia,
  plan = PREMIUM_PLAN,
  onSuccess,
  onError,
  onSettled,
  onCreemRedirect,
}: PremiumCheckoutArgs): Promise<void> {
  const def = PAID_PLANS[plan];
  const rail = isIndia ? 'razorpay' : 'creem';
  trackEvent('payment_initiated', {
    plan,
    amount_inr: def.inrAmount,
    processor: rail,
    spaceId,
  });

  /* ---------- international: Creem hosted checkout ---------- */
  if (!isIndia) {
    const url = creemCheckoutUrl(plan, userEmail);
    if (!url) {
      trackCheckoutFailed('creem', 'missing_checkout_url', { plan, spaceId });
      onError(CHECKOUT_START_ERROR);
      onSettled();
      return;
    }
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      try {
        sessionStorage.setItem('vicharakai_creem_checkout_pending', plan);
      } catch {
        /* private browsing — success is counted only if they come back in this tab */
      }
      trackCheckoutStart('creem', { plan, amount_inr: def.inrAmount, spaceId });
      onCreemRedirect?.();
    } catch {
      trackCheckoutFailed('creem', 'window_open_failed', { plan, spaceId });
      onError(CHECKOUT_UNREACHABLE_ERROR);
    } finally {
      onSettled();
    }
    return;
  }

  /* ---------- India: Razorpay ---------- */
  try {
    await loadRazorpayScript();
    // The platform secrets proxy occasionally fails transiently upstream, so
    // one client-side retry (a fresh request) rides through the blip.
    let orderOk = false;
    let orderData: Record<string, unknown> = {};
    let orderId = '';
    let razorpayKeyId = '';
    for (let attempt = 0; attempt < 2 && !orderId; attempt++) {
      const orderRes = await fetch(`/api/hooks/execute/${spaceId}/create-razorpay-order`, {
        method: 'POST',
        headers: hookHeaders(),
        body: JSON.stringify({ planType: plan, amount: def.paise, email: userEmail }),
      });
      orderData = await parseJsonBody(orderRes);
      orderId = typeof orderData.order_id === 'string' ? orderData.order_id : '';
      // The hook returns the PUBLIC key id with the order so they always match.
      razorpayKeyId = typeof orderData.key_id === 'string' ? orderData.key_id : '';
      orderOk = orderRes.ok;
    }
    if (!orderOk || !orderId || !razorpayKeyId) {
      trackCheckoutFailed('razorpay', 'order_create_failed', { plan, spaceId });
      onError(CHECKOUT_START_ERROR);
      onSettled();
      return;
    }
    const razorpayCheckout = new ((window as any).Razorpay)({
      key: razorpayKeyId,
      order_id: orderId,
      amount: orderData.amount,
      currency: typeof orderData.currency === 'string' ? orderData.currency : 'INR',
      name: 'VicharakAI',
      description: `VicharakAI Premium — ${def.inr}/${def.per}`,
      prefill: { email: userEmail },
      theme: { color: RAZORPAY_THEME },
      modal: {
        ondismiss: () => onSettled(),
      },
      handler: (payment: any) => {
        void (async () => {
          try {
            const verifyRes = await fetch(`/api/hooks/execute/${spaceId}/verify-razorpay-payment`, {
              method: 'POST',
              headers: hookHeaders(),
              body: JSON.stringify({
                razorpay_order_id: payment?.razorpay_order_id,
                razorpay_payment_id: payment?.razorpay_payment_id,
                razorpay_signature: payment?.razorpay_signature,
                plan_type: plan,
                user_email: userEmail,
              }),
            });
            const verifyBody = await parseJsonBody(verifyRes);
            if (verifyRes.ok && verifyBody.success === true) {
              trackCheckoutSuccess('razorpay', { plan, amount_inr: def.inrAmount, spaceId });
              onSuccess(plan);
            } else {
              trackCheckoutFailed('razorpay', 'verify_unconfirmed', { plan, spaceId });
              onError(CHECKOUT_UNCONFIRMED_ERROR);
            }
          } catch {
            trackCheckoutFailed('razorpay', 'verify_unreachable', { plan, spaceId });
            onError(CHECKOUT_UNCONFIRMED_ERROR);
          } finally {
            onSettled();
          }
        })();
      },
    });
    razorpayCheckout.on?.('payment.failed', (response: any) => {
      const reason =
        (typeof response?.error?.description === 'string' && response.error.description) ||
        (typeof response?.error?.reason === 'string' && response.error.reason) ||
        (typeof response?.error?.code === 'string' && response.error.code) ||
        'payment_failed';
      trackCheckoutFailed('razorpay', reason, { plan, spaceId });
      onError(CHECKOUT_FAILED_ERROR);
      onSettled();
      razorpayCheckout.close?.();
    });
    razorpayCheckout.open();
    trackCheckoutStart('razorpay', { plan, amount_inr: def.inrAmount, spaceId });
  } catch {
    trackCheckoutFailed('razorpay', 'checkout_unreachable', { plan, spaceId });
    onError(CHECKOUT_UNREACHABLE_ERROR);
    onSettled();
  }
}
