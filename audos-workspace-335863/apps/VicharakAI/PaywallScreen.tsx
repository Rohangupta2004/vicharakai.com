/**
 * PaywallScreen — the full-screen VicharakAI subscription surface.
 *
 * It fires in exactly TWO places, and nowhere else:
 *  1. TRIAL EXPIRY (`blocking`) — every new student gets a 7-day free trial
 *     (started at onboarding completion, tracked in vicharakai_trials); a
 *     student whose trial has ended with no active subscription lands here
 *     before any app content loads. No close button, no “continue for free”.
 *  2. THE LAST STEP OF ONBOARDING — the caller passes `onStartTrial`, which
 *     renders the primary “Start my 7-day free trial” CTA (no card, no
 *     checkout) above the plan card. The number comes from
 *     TRIAL_DURATION_DAYS — never hardcode it here.
 * Tapping a locked feature mid-session no longer opens this as a popup: it
 * navigates to the in-app Premium tab (features/premium/PremiumScreen.tsx).
 *
 * ONE PLAN IS SOLD: VicharakAI Premium, ₹149/month. The yearly tier went on
 * 2026-08-19 and the ₹10 day/'Trial' tier was DELETED on 2026-09-27 — a
 * FREE trial and a ₹10 paid trial side by side only made people
 * hesitate. Payment routes by the STUDENT'S EXAM (pricingRegion.ts — an
 * Indian exam prices ₹149 via Razorpay, a US/international exam $14.99 via
 * Creem, unknown defaults to India) through the ONE shared implementation in
 * features/premium/premiumCheckout.ts. Callers pass `examId` (the profile's
 * exam, or the onboarding draft's) so the price can never disagree with the
 * exam the student actually chose.
 *
 * This screen uses a LIGHT surface — near-white page, white plan card with a
 * hairline border, dark ink text — with the brand's electric blue gradient
 * (#0041CC → #0057FF) reserved for the CTA and accents. Fixed hex values,
 * independent of the dark/light theme, so it renders identically everywhere.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  PAID_PLANS,
  PREMIUM_INCLUDES,
  PREMIUM_PLAN,
  TRIAL_DURATION_DAYS,
  planPriceLabel,
  premiumPlanTitle,
  trialFramingLine,
  type PaidPlanId,
} from './access';
import { trackPaywallView } from './shared/track';
import { examPricingIsIndia } from './pricingRegion';
import { startPremiumCheckout } from './features/premium/premiumCheckout';

export type PremiumFeature = 'scan' | 'test' | 'chat' | 'analysis';

const FEATURE_LABELS: Record<PremiumFeature, string> = {
  scan: 'Scan & Mistake Book Capture',
  test: 'Test Generator',
  chat: 'Unlimited AI Coach',
  analysis: 'Mock Test Analysis',
};

/* Brand palette for this screen — light surfaces + the electric-blue
 * gradient. Text is dark ink on white so every line clears contrast
 * comfortably; text on the blue fills is white. */
const PAYWALL_PRIMARY = '#0057FF';
const PAYWALL_GRADIENT = 'linear-gradient(135deg, #0041CC 0%, #0057FF 100%)';
const PAYWALL_BG = '#F8F9FA';
const PANEL = '#FFFFFF';
const PANEL_SOFT = '#FFFFFF';
const PAYWALL_BORDER = '#E5E7EB';
const INK = '#111827';
const INK_SOFT = '#4B5563';

export default function PaywallScreen({
  feature,
  blocking = false,
  trialEnded = false,
  subscriptionLapsed = false,
  spaceId,
  userEmail,
  examId = null,
  examLabel = null,
  onPaymentSuccess,
  onClose,
  onStartTrial,
  startTrialBusy = false,
  onOpenTestPanel,
}: {
  /** What the student tried to open — named on the screen. Null = generic. */
  feature: PremiumFeature | null;
  /** True when rendered as the trial-expiry gate — no close button. */
  blocking?: boolean;
  /** True when the free trial is over — shows the trial-ended line. */
  trialEnded?: boolean;
  /** True when this student has PAID before and the plan lapsed. They never
   * had a trial to lose, so the trial-ended line is simply wrong for them —
   * and "your free trial has ended" is the last thing a former subscriber
   * should read. */
  subscriptionLapsed?: boolean;
  spaceId: string;
  /** The signed-in student's email — the key the entitlement row is written under. */
  userEmail: string;
  /** The student's exam (zuno_profile.exam or the onboarding draft) — decides
   * ₹/Razorpay vs $/Creem via pricingRegion.ts. Null/unknown = India. */
  examId?: string | null;
  /** Optional display name of the exam — helps classify typed exams. */
  examLabel?: string | null;
  /** Fired after a VERIFIED payment — the plan is already recorded. */
  onPaymentSuccess: (plan: PaidPlanId) => void;
  onClose: () => void;
  /** Onboarding only: renders the primary “Start my N-day free trial” CTA.
   * Starting the trial writes the profile — no payment, no card. */
  onStartTrial?: () => void;
  /** True while the trial start (profile + Day-1 plan write) is in flight. */
  startTrialBusy?: boolean;
  /** QA only: 5 quick taps on the logo open the hidden Time Machine panel —
   * the escape hatch when a tester is date-jumped into the Day-4 gate. */
  onOpenTestPanel?: () => void;
}) {
  /* Pricing follows the EXAM, never the IP address — see pricingRegion.ts. */
  const isIndia = examPricingIsIndia(examId, examLabel);
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [creemOpened, setCreemOpened] = useState(false);
  const priceLine = planPriceLabel(PREMIUM_PLAN, isIndia);
  const def = PAID_PLANS[PREMIUM_PLAN];
  /* Why this screen appeared, read off the props the caller already sets:
     the blocking gate at trial expiry, a premium feature the student tapped,
     or the final step of onboarding. Mount only — one view is one event,
     however many times it re-renders after. */
  useEffect(() => {
    const source = blocking
      ? (subscriptionLapsed ? 'subscription_lapsed' : 'trial_expired')
      : onStartTrial
        ? 'onboarding'
        : feature
          ? 'locked_feature'
          : 'upgrade_banner';
    trackPaywallView(source, {
      spaceId,
      examId: examId || null,
      blocking,
      trialEnded,
      subscriptionLapsed,
      feature: feature || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Hidden QA gesture — 5 taps on the logo within 2s. Invisible otherwise. */
  const logoTapsRef = useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  const handleLogoTap = () => {
    if (!onOpenTestPanel) return;
    const now = Date.now();
    const taps = logoTapsRef.current;
    logoTapsRef.current = {
      count: now - taps.last < 2000 ? taps.count + 1 : 1,
      last: now,
    };
    if (logoTapsRef.current.count >= 5) {
      logoTapsRef.current = { count: 0, last: 0 };
      onOpenTestPanel();
    }
  };

  /* ONE checkout for the ONE plan — Razorpay in India, Creem elsewhere. */
  const startCheckout = () => {
    if (busy || startTrialBusy) return;
    setBusy(true);
    setCheckoutError('');
    setCreemOpened(false);
    void startPremiumCheckout({
      spaceId,
      userEmail,
      isIndia,
      onSuccess: onPaymentSuccess,
      onError: setCheckoutError,
      onSettled: () => setBusy(false),
      onCreemRedirect: () => setCreemOpened(true),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="VicharakAI Premium"
      style={{ background: PAYWALL_BG }}
      data-testid="screen-paywall"
    >
      {/* Tactile press on the plan card — existing palette only, collapses
          under prefers-reduced-motion. */}
      <style>{`
        .paywall-plan { transition: transform 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.15s ease-out; }
        .paywall-plan:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(17,24,39,0.10); }
        .paywall-plan:active { transform: scale(0.96); }
        @media (prefers-reduced-motion: reduce) {
          .paywall-plan, .paywall-plan:hover, .paywall-plan:active { transform: none; transition: none; }
        }
      `}</style>
      <div className="min-h-full w-full max-w-[440px] mx-auto px-5 py-6 flex flex-col">
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-2.5 select-none"
            aria-label="VicharakAI"
            onClick={handleLogoTap}
            data-testid="paywall-logo"
          >
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: PAYWALL_GRADIENT, color: '#FFFFFF', boxShadow: '0 6px 18px rgba(0,87,255,0.25)' }}
              aria-hidden="true"
            >
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight" style={{ color: INK }}>
              VicharakAI
            </span>
          </span>
          {/* 44px, not 36: this screen renders OUTSIDE `.vicharak-app`, so
              the app-wide 44px tap-target floor never reached it. */}
          {!blocking && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 rounded-full flex items-center justify-center touch-manipulation"
              style={{ background: '#EEF1F5', color: INK }}
              data-testid="button-paywall-close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Why this screen appeared — shown only once the free trial is over. */}
        {trialEnded && (
          <p
            className="mt-5 rounded-xl px-3.5 py-2.5 text-[13px] font-extrabold leading-snug"
            style={{ background: 'rgba(0,87,255,0.07)', border: '1px solid rgba(0,87,255,0.28)', color: PAYWALL_PRIMARY }}
            data-testid="text-paywall-trial-ended"
          >
            {subscriptionLapsed
              ? 'Your VicharakAI Premium plan has ended. Renew to keep your plan, revisions and history.'
              : `Your ${TRIAL_DURATION_DAYS}-day free trial has ended. Continue with Premium to keep your plan.`}
          </p>
        )}

        <h1
          className={`${trialEnded ? 'mt-4' : 'mt-7'} text-[28px] sm:text-[32px] font-extrabold leading-[1.08] tracking-tight`}
          style={{ color: INK }}
          data-testid="text-paywall-headline"
        >
          {onStartTrial ? 'Start studying today.' : subscriptionLapsed ? 'Pick up where you left off.' : 'Keep your plan running.'}
        </h1>
        <p className="mt-2 text-[14px] font-bold" style={{ color: INK_SOFT }} data-testid="text-paywall-subheadline">
          {trialFramingLine(isIndia)}
        </p>

        {/* What they tried to open — the reason this screen appeared. */}
        {feature && (
          <span
            className="mt-3 self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-extrabold rounded-full"
            style={{ background: 'rgba(0,87,255,0.08)', color: PAYWALL_PRIMARY, border: '1px solid rgba(0,87,255,0.25)' }}
            data-testid="chip-paywall-feature"
          >
            <Lock className="w-3.5 h-3.5" />
            {FEATURE_LABELS[feature]}
          </span>
        )}

        {/* The one plan, on a readable card. */}
        <div
          className="mt-5 p-5 rounded-3xl"
          style={{ background: PANEL, border: `1px solid ${PAYWALL_BORDER}`, boxShadow: '0 12px 32px rgba(17,24,39,0.08)' }}
        >
          {checkoutError && (
            <p
              className="mb-4 rounded-xl px-3.5 py-2.5 text-[12px] font-bold leading-snug"
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}
              role="alert"
              data-testid="text-paywall-checkout-error"
            >
              {checkoutError}
            </p>
          )}

          {creemOpened && (
            <p
              className="mb-4 rounded-xl px-3.5 py-2.5 text-[12px] font-bold leading-snug"
              style={{ background: 'rgba(0,87,255,0.07)', border: '1px solid rgba(0,87,255,0.25)', color: PAYWALL_PRIMARY }}
              data-testid="text-paywall-creem-pending"
            >
              Checkout opened in a new tab. Finish the payment there, then come back and reload — Premium switches
              on automatically.
            </p>
          )}

          {/* Onboarding: the free trial leads. It is the primary action — no
              card, no checkout; starting it writes the profile and Day-1 plan. */}
          {onStartTrial && (
            <>
              <button
                type="button"
                disabled={busy || startTrialBusy}
                onClick={onStartTrial}
                className="w-full py-4 rounded-full text-[15px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation disabled:opacity-70"
                style={{ background: PAYWALL_GRADIENT, color: '#FFFFFF', boxShadow: '0 10px 26px rgba(0,87,255,0.4)' }}
                data-testid="button-paywall-start-trial"
              >
                {startTrialBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {startTrialBusy ? 'Setting up your plan…' : `Start my ${TRIAL_DURATION_DAYS}-day free trial`}
              </button>
              <p className="mt-2.5 text-[12px] font-bold text-center" style={{ color: INK_SOFT }} data-testid="text-paywall-trial-note">
                Full access for {TRIAL_DURATION_DAYS} days · No card needed
              </p>
              <div className="my-4 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1" style={{ background: PAYWALL_BORDER }} />
                <span className="text-[11px] font-bold" style={{ color: INK_SOFT }}>or subscribe now</span>
                <span className="h-px flex-1" style={{ background: PAYWALL_BORDER }} />
              </div>
            </>
          )}

          {/* VicharakAI Premium — the ONLY plan. No tier to compare, nothing
              to weigh up: one name, one price, one list of what it does. */}
          <button
            type="button"
            disabled={busy || startTrialBusy}
            onClick={startCheckout}
            className="paywall-plan relative w-full rounded-2xl p-4 text-left touch-manipulation disabled:opacity-80"
            style={{
              background: PANEL_SOFT,
              border: `2px solid ${PAYWALL_PRIMARY}`,
              boxShadow: '0 10px 26px rgba(0,87,255,0.16)',
              cursor: busy ? 'wait' : 'pointer',
            }}
            data-testid="button-paywall-plan-monthly"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex items-start gap-2.5">
                <span
                  className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: PAYWALL_GRADIENT, color: '#FFFFFF' }}
                  aria-hidden="true"
                >
                  <Check className="w-3 h-3" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-extrabold leading-snug" style={{ color: INK }} data-testid="text-paywall-plan-title">
                    {premiumPlanTitle(isIndia)}
                  </span>
                  <span className="block mt-0.5 text-[11px] font-semibold leading-snug" style={{ color: INK_SOFT }}>
                    The full AI engine behind your prep. Cancel anytime.
                  </span>
                </span>
              </span>
              <span className="flex-shrink-0 text-right">
                <span className="block text-[22px] font-extrabold leading-none tracking-tight" style={{ color: INK }}>
                  {busy ? '…' : isIndia ? def.inr : def.usd}
                </span>
                <span className="block mt-1 text-[11px] font-bold" style={{ color: INK_SOFT }}>
                  / month
                </span>
              </span>
            </div>
            {/* What Premium includes — the same list the Premium tab shows. */}
            <ul className="mt-3 space-y-1.5">
              {PREMIUM_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: PAYWALL_PRIMARY }} aria-hidden="true" />
                  <span className="text-[12px] font-semibold leading-snug" style={{ color: INK_SOFT }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </button>

          <button
            type="button"
            disabled={busy || startTrialBusy}
            onClick={startCheckout}
            className="mt-5 w-full py-4 rounded-full text-[15px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation disabled:opacity-70"
            style={{ background: PAYWALL_GRADIENT, color: '#FFFFFF', boxShadow: '0 10px 26px rgba(0,87,255,0.4)' }}
            data-testid="button-paywall-unlock"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Opening secure checkout…' : `Go Premium · ${priceLine}`}
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-center" style={{ color: INK_SOFT }} data-testid="text-paywall-trust">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: PAYWALL_PRIMARY }} />
            {isIndia ? 'Secure payment · UPI, card, wallet' : 'Secure international checkout · card'}
          </p>
        </div>
      </div>
    </div>
  );
}
