/**
 * AccountSheet — [FIX 1] the in-app "Account & subscription" panel.
 *
 * Opens as a slide-up bottom sheet from the Profile tab's "Account &
 * subscription settings" row — a modal INSIDE the app, so closing it always
 * returns exactly where the student was (no navigation to another screen,
 * nothing to break back-navigation).
 *
 * Contents:
 *  1. ACTIVE PLAN, clearly at the top — 'Trial — Day 2 of 3', 'VicharakAI
 *     Premium — active until …', 'Lifetime Premium', or 'No active plan'.
 *  2. PRICING — ONE plan card with its benefits: VicharakAI Premium,
 *     ₹149/month for an Indian exam, $14.99/month for a US/international
 *     exam (pricingRegion.ts — the price follows the exam the student
 *     picked, never their IP address). The ₹10 day/'Trial' tier
 *     was DELETED on 2026-09-27 — the 3-day FREE trial covers "try it
 *     first"; a legacy ₹10 row bought before then still shows as the active
 *     plan above until it expires.
 *
 * Checkout is not implemented here: it calls the ONE shared implementation in
 * features/premium/premiumCheckout.ts (Razorpay for India, Creem for the
 * rest), so a payment made here lands in vicharakai_subscriptions identically
 * to one made on the Premium tab or the trial-expiry paywall.
 */
import { useEffect, useState } from 'react';
import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  AMBER, BORDER, BORDER_STRONG, CARD, CARD_SOFT, DANGER, NAVY_ALT,
  ORANGE, OVERLAY_BG, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, tint,
} from '../../theme';
import {
  PAID_PLANS, PREMIUM_INCLUDES, PREMIUM_PRODUCT_NAME, TRIAL_DURATION_DAYS,
  type PaidPlanId,
} from '../../access';
import { examPricingIsIndia } from '../../pricingRegion';
import { useApp } from '../../app/AppContext';
import { startPremiumCheckout } from '../premium/premiumCheckout';
import { trackPaywallView } from '../../shared/track';

/** '23 Sep 2026' — a subscription row's expiry for the active-plan line. */
function formatExpiry(iso: string | null | undefined): string | null {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { data, access: accessFeature } = useApp();
  const { spaceId } = data;
  const { accessStatus, paidPlan, paidSessionEmail, handlePaymentSuccess } = accessFeature;
  /* Pricing follows the student's EXAM (pricingRegion.ts), never their IP. */
  const isIndia = examPricingIsIndia(data.profile?.exam ?? null, data.savedExamLabel ?? null);

  const [busyPlan, setBusyPlan] = useState<PaidPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  useEffect(() => {
    trackPaywallView('account_sheet', {
      spaceId,
      status: accessStatus.status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 1. the active plan, stated plainly ---------- */
  const planStatus = (() => {
    if (accessStatus.status === 'subscribed') {
      const until = formatExpiry(paidPlan?.expires_at);
      if (paidPlan?.plan_type === 'day') {
        /* A legacy ₹10 day pass bought before 2026-09-27. Nothing sells it
           any more; it is honoured until it expires. */
        return { name: 'Day pass (legacy)', line: until ? `Active until ${until}` : 'Active', active: true };
      }
      if (paidPlan?.plan_type === 'monthly') {
        return { name: PREMIUM_PRODUCT_NAME, line: until ? `Renews on ${until}` : 'Active', active: true };
      }
      if (paidPlan?.plan_type === 'lifetime') {
        return { name: 'Lifetime Premium', line: 'Active — never expires', active: true };
      }
      return { name: 'Premium', line: 'Active subscription', active: true };
    }
    if (accessStatus.status === 'trial') {
      // A day count only with a REAL trial record (trialExpiresAt set) —
      // never fabricate one while the subscription/trial rows are loading.
      if (!accessStatus.trialExpiresAt) {
        return { name: 'Trial', line: 'Active — full access', active: true };
      }
      const left = accessStatus.daysLeftInTrial ?? TRIAL_DURATION_DAYS;
      const dayOf = Math.min(TRIAL_DURATION_DAYS, Math.max(1, TRIAL_DURATION_DAYS - left + 1));
      return { name: 'Trial', line: `Day ${dayOf} of ${TRIAL_DURATION_DAYS}`, active: true };
    }
    return { name: 'No active plan', line: 'Pick a plan below to unlock VicharakAI', active: false };
  })();

  /* ---------- checkout ---------- */

  const startCheckout = (plan: PaidPlanId) => {
    if (busyPlan) return;
    setCheckoutError('');
    setBusyPlan(plan);
    void startPremiumCheckout({
      spaceId,
      userEmail: paidSessionEmail,
      isIndia,
      plan,
      // Refreshes the subscription rows — the active-plan card above updates
      // in place, so the sheet can simply stay open.
      onSuccess: handlePaymentSuccess,
      onError: setCheckoutError,
      onSettled: () => setBusyPlan(null),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Account and subscription"
      data-testid="sheet-account"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 vicharak-fade"
        style={{ background: OVERLAY_BG }}
      />
      <div
        className="relative max-h-[88vh] overflow-y-auto vicharak-sheet"
        style={{
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          background: NAVY_ALT,
          borderTop: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold" style={{ color: TEXT }}>
              Account &amp; plan
            </h2>
            {paidSessionEmail && (
              <p className="text-[11px] mt-0.5 truncate" style={{ color: TEXT_MUTED }} data-testid="text-account-email">
                {paidSessionEmail}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: BORDER, color: TEXT }}
            data-testid="button-close-account"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-7 space-y-4">
          {/* 1 — the active plan, clearly at the top */}
          <section
            className="p-4"
            style={{
              background: CARD,
              border: `1px solid ${planStatus.active ? tint(SUCCESS, 0.4) : BORDER}`,
              borderRadius: RADIUS.lg,
            }}
            data-testid="card-active-plan"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
              Current plan
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-base font-extrabold" style={{ color: TEXT }} data-testid="text-active-plan-name">
                {planStatus.name}
              </p>
              <span
                className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] flex-shrink-0"
                style={
                  planStatus.active
                    ? { borderRadius: RADIUS.chip, background: tint(SUCCESS, 0.14), border: `1px solid ${tint(SUCCESS, 0.4)}`, color: SUCCESS }
                    : { borderRadius: RADIUS.chip, background: tint(TEXT_MUTED, 0.14), border: `1px solid ${BORDER}`, color: TEXT_MUTED }
                }
                data-testid="badge-active-plan-status"
              >
                {planStatus.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }} data-testid="text-active-plan-detail">
              {planStatus.line}
            </p>
          </section>

          {/* 2 — one plan, one price. Nothing to compare, nothing to choose. */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
              {accessStatus.status === 'subscribed' ? 'Extend your plan' : 'Upgrade'}
            </p>

            {checkoutError && (
              <p
                className="mt-2 px-3.5 py-2.5 text-[12px] font-bold leading-snug"
                role="alert"
                style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.3)}`, color: DANGER }}
                data-testid="text-account-checkout-error"
              >
                {checkoutError}
              </p>
            )}

            <div className="mt-3 space-y-3">
              {(['monthly'] as PaidPlanId[]).map((plan) => {
                const def = PAID_PLANS[plan];
                const price = isIndia ? def.inr : def.usd;
                return (
                  <button
                    key={plan}
                    type="button"
                    disabled={busyPlan !== null}
                    onClick={() => startCheckout(plan)}
                    className="relative w-full p-4 text-left touch-manipulation transition-transform active:scale-[0.98] disabled:opacity-70"
                    style={{
                      background: CARD_SOFT,
                      border: `2px solid ${AMBER}`,
                      borderRadius: RADIUS.lg,
                      boxShadow: '0 10px 26px rgba(0,87,255,0.28)',
                      opacity: busyPlan ? 0.6 : 1,
                    }}
                    data-testid={`button-account-plan-${plan}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold" style={{ color: TEXT }}>
                          {PREMIUM_PRODUCT_NAME}
                        </p>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: TEXT_MUTED }}>
                          Full access — cancel anytime
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {busyPlan === plan ? (
                          <Loader2 className="w-5 h-5 animate-spin inline-block" style={{ color: AMBER }} />
                        ) : (
                          <>
                            <span className="block text-xl font-extrabold leading-none tracking-tight" style={{ color: TEXT }}>
                              {price}
                            </span>
                            <span className="block mt-1 text-[11px] font-bold" style={{ color: TEXT_MUTED }}>
                              / month
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* What this plan includes — benefits listed plainly. */}
                    <ul className="mt-3 space-y-1">
                      {PREMIUM_INCLUDES.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-1.5">
                          <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: AMBER }} aria-hidden="true" />
                          <span className="text-[11px] font-semibold leading-snug" style={{ color: TEXT_SECONDARY }}>
                            {benefit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <p
              className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-center"
              style={{ color: TEXT_MUTED }}
              data-testid="text-account-trust"
            >
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: ORANGE }} />
              {isIndia
                ? 'Secure payment via Razorpay · UPI, card, wallet'
                : 'Secure international checkout via Creem · card'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
