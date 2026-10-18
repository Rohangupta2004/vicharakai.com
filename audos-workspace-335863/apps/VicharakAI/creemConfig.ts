/**
 * Creem checkout configuration — the INTERNATIONAL (non-India) payment path.
 *
 * Payment routing (restored 2026-09-27):
 *   India          → Razorpay, ₹149/month (UPI, cards, wallets)
 *   Everywhere else → Creem, $14.99/month (merchant of record, handles
 *                     cross-border tax)
 * The region comes from useRegion.ts (server-side IP lookup via the `geo`
 * hook, with a locale fallback that resolves any doubt to India).
 *
 * The ₹10 / $1 DAY PASS IS GONE (2026-09-27). Its payment link is deleted
 * here as well as from the plan config, so no surface — and no stale deep
 * link — can open a day-pass checkout. Legacy 'day' rows already written to
 * vicharakai_subscriptions keep working until they expire.
 *
 * After a customer pays, Creem calls the creem-webhook hook
 * (https://audos.com/api/workspaces/workspace-335863/hooks/creem-webhook),
 * which writes the entitlement to vicharakai_subscriptions. The link opened
 * from the paywall carries metadata[app_email] (the signed-in student's
 * email) and metadata[plan], so the webhook can grant the entitlement to the
 * right account even when the customer pays with a different email at
 * checkout — Creem echoes metadata back in every webhook event.
 */

import type { PaidPlanId } from './access';

/**
 * Creem payment link for the monthly VicharakAI Premium subscription.
 *
 * PRICE MISMATCH TO RESOLVE: the app and the landing page both advertise
 * $14.99/month, but the last real payment through this product landed in
 * vicharakai_subscriptions as 1000 cents ($10.00, row id 4) — so the Creem
 * product itself is still priced at $10. Raise it to $14.99 in the Creem
 * dashboard, or drop PLAN_AMOUNTS.monthly.usd (access.ts) and
 * PLAN_AMOUNT_USD.monthly (components/emailGateShared.tsx) back to 10. The
 * two numbers must agree — a visitor must never be quoted one price and
 * charged another.
 */
export const CREEM_MONTH_LINK = 'https://www.creem.io/payment/prod_1slDIFvd9buIA1VPRjKfN8';

/** The payment link for a plan — only the monthly subscription is sold. */
export function creemLinkFor(plan: PaidPlanId): string | null {
  return plan === 'monthly' ? CREEM_MONTH_LINK : null;
}

/** Safety guard: true only for a real https Creem URL (no placeholder marker). */
export function isCreemLinkConfigured(link: string | null): boolean {
  return typeof link === 'string' && /^https:\/\//.test(link) && !link.includes('REPLACE_WITH');
}

/**
 * The full checkout URL to open: the plan's payment link plus
 * metadata[app_email] + metadata[plan] query params. Creem processes
 * metadata server-side and includes it in webhook events, which is how the
 * creem-webhook hook maps the payment back to this student's account.
 */
export function creemCheckoutUrl(plan: PaidPlanId, email: string): string | null {
  const link = creemLinkFor(plan);
  if (!isCreemLinkConfigured(link)) return null;
  const sep = (link as string).includes('?') ? '&' : '?';
  const params = new URLSearchParams();
  params.set('metadata[app_email]', (email ?? '').trim().toLowerCase());
  params.set('metadata[plan]', plan);
  return `${link}${sep}${params.toString()}`;
}
