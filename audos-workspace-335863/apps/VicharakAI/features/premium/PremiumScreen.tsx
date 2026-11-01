/**
 * PremiumScreen — the "VicharakAI Premium" tab: the ONE place inside the app
 * where a student sees where their plan stands and upgrades.
 *
 * It replaced the jarring full-screen paywall modal that used to pop over
 * whatever a student was doing the moment they tapped a locked feature.
 * `access.openPaywall(feature)` now navigates HERE and names the feature at
 * the top of the screen, so a premium gate is a destination, not an
 * interruption. The blocking trial-expiry gate (AppShell gate 5) is still
 * PaywallScreen — that one has to stop the app, and nothing else does.
 *
 * ONE plan is sold: VicharakAI Premium — ₹149/month through Razorpay. The
 * ₹10 day and yearly tiers are retired; the 7-day free trial is the only
 * try-before-paying path.
 */
import { useEffect, useState } from 'react';
import {
  BadgeCheck, Check, ChevronRight, Crown, Loader2, Lock, RefreshCw, ShieldCheck, Sparkles,
} from 'lucide-react';
import {
  PREMIUM_INCLUDES,
  PREMIUM_PLAN,
  TRIAL_DURATION_DAYS,
  planPriceLabel,
  premiumPlanTitle,
  trialFramingLine,
} from '../../access';
import {
  BORDER, BRAND, BRAND_GRADIENT, DANGER, INK, INK_SOFT, PAPER_SUNK, RADIUS, SUCCESS, TEXT, TEXT_MUTED,
  TEXT_SECONDARY, tint,
} from '../../theme';
import { Card } from '../../ui';
import { useApp } from '../../app/AppContext';
import { startPremiumCheckout } from './premiumCheckout';
import { trackPaywallView } from '../../shared/track';

/** Premium uses the same electric blue as every primary action; the deeper
 * blue is reserved for readable icon and checklist ink on pale surfaces. */
const PREMIUM_BLUE = '#0057FF';
const PREMIUM_BLUE_DEEP = '#0041CC';

/** What the student tried to open before landing here. */
const FEATURE_LABELS: Record<string, string> = {
  scan: 'Scan & Mistake Book capture',
  test: 'AI test generator',
  chat: 'Unlimited AI coach',
  analysis: 'Mock test analysis',
};

/** '23 Sep 2026' — a subscription row's expiry, for the next-billing line. */
function formatDate(iso: string | null | undefined): string | null {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function PremiumScreen() {
  const { data, access: accessFeature, settings } = useApp();
  const { spaceId } = data;
  const {
    accessStatus, paidPlan, paidSessionEmail, paywall, closePaywall, handlePaymentSuccess,
    accessChecking, subscriptionsQ,
  } = accessFeature;
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  /* The feature chip explains THIS visit, so it is read ONCE at mount and
     retired when the student leaves — coming back later from the nav must
     not still blame a tap from an hour ago. Snapshotting rather than reading
     `paywall` live also means the clearing cleanup cannot erase the chip out
     from under the first render. */
  const [gatedFeature] = useState<string | null>(() => paywall?.feature ?? null);
  useEffect(() => () => closePaywall(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    trackPaywallView('premium_tab', {
      spaceId,
      status: accessStatus.status,
      feature: gatedFeature,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceLine = planPriceLabel(PREMIUM_PLAN);
  const subscribed = accessStatus.status === 'subscribed';
  const onTrial = accessStatus.status === 'trial';
  const daysLeft = accessStatus.daysLeftInTrial ?? TRIAL_DURATION_DAYS;
  const renewsOn = formatDate(paidPlan?.expires_at);
  const lifetime = paidPlan?.plan_type === 'lifetime';
  /* The one status line, in the student's own words. Pending/loading is not
   * a plan verdict, so it renders no badge until the server has answered. */
  const status = accessChecking || subscriptionsQ.loading || accessStatus.status === 'pending'
    ? null
    : subscribed
      ? {
        badge: 'Premium — active',
        headline: lifetime ? 'Premium — active, forever' : 'You’re on VicharakAI Premium',
        detail: lifetime
          ? 'Full access with no renewal date.'
          : renewsOn
            ? `Renews on ${renewsOn} · ${priceLine}`
            : `Active · ${priceLine}`,
        tone: SUCCESS,
      }
      : onTrial
        ? {
            badge: `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
            headline: `You’re on a ${TRIAL_DURATION_DAYS}-day free trial`,
            detail: `Full access until your trial ends. After that it’s ${priceLine} — cancel anytime.`,
            tone: BRAND,
          }
        : accessStatus.status === 'expired'
          ? {
              badge: 'Unsubscribed',
              headline: 'Your access has ended',
              detail: `Go Premium to get your daily plan, revision schedule and AI coach back — ${priceLine}.`,
              tone: DANGER,
            }
          : null;

  const goPremium = () => {
    if (busy) return;
    setBusy(true);
    setCheckoutError('');
    void startPremiumCheckout({
      spaceId,
      userEmail: paidSessionEmail,
      onSuccess: handlePaymentSuccess,
      onError: setCheckoutError,
      onSettled: () => setBusy(false),
    });
  };

  return (
    <div
      className="flex-1 w-full max-w-[640px] mx-auto px-4 sm:px-6 pt-6 vicharak-screen-pad space-y-4"
      data-testid="screen-premium"
    >
      <style>{`
        .vk-premium-hero { position: relative; overflow: hidden; }
        .vk-premium-hero::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 120% at 88% -20%, ${tint(PREMIUM_BLUE, 0.18)} 0%, transparent 62%);
        }
        .vk-premium-cta { transition: transform 0.14s ease-out, background-color 0.15s ease; }
        .vk-premium-cta:active { transform: scale(0.985); }
        @media (prefers-reduced-motion: reduce) { .vk-premium-cta:active { transform: none; } }
      `}</style>

      {/* Why this screen opened — named plainly, never as an accusation. */}
      {gatedFeature && !subscribed && (
        <p
          className="flex items-center gap-2 px-3.5 py-2.5"
          style={{
            borderRadius: RADIUS.md,
            background: tint(BRAND, 0.08),
            border: `1px solid ${tint(BRAND, 0.3)}`,
            fontSize: '0.82rem',
            fontWeight: 600,
            color: INK,
          }}
          data-testid="chip-premium-feature"
        >
          <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND }} />
          {FEATURE_LABELS[gatedFeature] ?? 'That feature'} is part of Premium
        </p>
      )}

      {/* 1 — where the student stands right now */}
      {status && (
      <Card
        radius={RADIUS.lg}
        className="vk-premium-hero p-5 vicharak-rise"
        style={{ border: `1px solid ${tint(status.tone, 0.45)}` }}
        testId="card-premium-status"
      >
        <div className="relative flex items-start gap-3">
          <span
            className="w-11 h-11 flex items-center justify-center flex-shrink-0"
            style={{
              borderRadius: RADIUS.md,
              background: `linear-gradient(135deg, ${PREMIUM_BLUE_DEEP}, ${PREMIUM_BLUE})`,
              color: '#FFFFFF',
            }}
            aria-hidden="true"
          >
            <Crown className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="inline-flex items-center gap-1.5 px-2.5 py-1"
              style={{
                borderRadius: RADIUS.chip,
                background: tint(status.tone, 0.12),
                border: `1px solid ${tint(status.tone, 0.34)}`,
                fontSize: '0.72rem',
                fontWeight: 600,
                color: status.tone,
              }}
              data-testid="badge-premium-status"
            >
              {subscribed ? <BadgeCheck className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {status.badge}
            </p>
            <h1
              className="mt-2 leading-tight"
              style={{ fontSize: '1.32rem', fontWeight: 600, color: TEXT }}
              data-testid="text-premium-headline"
            >
              {status.headline}
            </h1>
            <p
              className="mt-1.5 leading-relaxed"
              style={{ fontSize: '0.88rem', color: TEXT_SECONDARY }}
              data-testid="text-premium-status-detail"
            >
              {status.detail}
            </p>
            {paidSessionEmail && (
              <p className="mt-1.5 break-all" style={{ fontSize: '0.75rem', color: TEXT_MUTED }} data-testid="text-premium-email">
                {paidSessionEmail}
              </p>
            )}
          </div>
        </div>
      </Card>
      )}

      {/* 2 — the plan itself: one card, one price, no choosing */}
      <Card
        radius={RADIUS.lg}
        className="p-5 vicharak-rise"
        style={{ animationDelay: '40ms', border: `1px solid ${tint(PREMIUM_BLUE, 0.5)}` }}
        testId="card-premium-plan"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p style={{ fontSize: '1rem', fontWeight: 600, color: TEXT }} data-testid="text-premium-plan-title">
            {premiumPlanTitle()}
          </p>
        </div>
        <p className="mt-1 leading-relaxed" style={{ fontSize: '0.82rem', color: TEXT_MUTED }} data-testid="text-premium-trial-framing">
          {subscribed ? 'Everything below is switched on for your account.' : trialFramingLine()}
        </p>

        <ul className="mt-4 space-y-2" data-testid="list-premium-includes">
          {PREMIUM_INCLUDES.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: tint(PREMIUM_BLUE, 0.14), color: PREMIUM_BLUE_DEEP }}
                aria-hidden="true"
              >
                <Check className="w-3 h-3" />
              </span>
              <span className="leading-relaxed" style={{ fontSize: '0.88rem', color: INK }}>
                {item}
              </span>
            </li>
          ))}
        </ul>

        {subscriptionsQ.error && (
          <div
            role="alert"
            className="mt-4 px-3.5 py-3"
            style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.09), border: `1px solid ${tint(DANGER, 0.3)}` }}
            data-testid="premium-plan-load-error"
          >
            <p className="leading-relaxed" style={{ fontSize: '0.82rem', color: INK }}>
              We couldn't refresh your plan status just now. Your account and payment details are still safe.
            </p>
            <button
              type="button"
              onClick={() => subscriptionsQ.refresh()}
              className="vicharak-btn vicharak-btn-ghost mt-2"
              data-testid="button-premium-plan-retry"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}

        {checkoutError && (
          <p
            role="alert"
            className="mt-4 px-3.5 py-2.5 leading-snug"
            style={{
              borderRadius: RADIUS.md,
              background: tint(DANGER, 0.09),
              border: `1px solid ${tint(DANGER, 0.3)}`,
              fontSize: '0.8rem',
              fontWeight: 600,
              color: DANGER,
            }}
            data-testid="text-premium-checkout-error"
          >
            {checkoutError}
          </p>
        )}

        {subscribed ? (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => settings.setAccountSheetOpen(true)}
              className="vk-premium-cta w-full px-4 py-3.5 flex items-center gap-3 text-left touch-manipulation"
              style={{ background: PAPER_SUNK, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, minHeight: 52 }}
              data-testid="button-premium-manage"
            >
              <Crown className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
              <span className="min-w-0 flex-1">
                <span className="block" style={{ fontSize: '0.9rem', fontWeight: 600, color: TEXT }}>
                  Manage subscription
                </span>
                <span className="block mt-0.5" style={{ fontSize: '0.75rem', color: TEXT_MUTED }}>
                  {renewsOn ? `Next billing date · ${renewsOn}` : 'Plan, renewal and payment details'}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
            </button>
            <p className="leading-relaxed" style={{ fontSize: '0.75rem', color: TEXT_MUTED }}>
              Cancel any time — you keep access until {renewsOn ?? 'the end of the paid period'}.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={goPremium}
              className="vk-premium-cta mt-5 w-full inline-flex items-center justify-center gap-2 touch-manipulation disabled:opacity-70"
              style={{
                minHeight: 52,
                borderRadius: RADIUS.md,
                background: BRAND_GRADIENT,
                border: '1.5px solid #0057FF',
                color: '#FFFFFF',
                fontSize: '0.98rem',
                fontWeight: 600,
              }}
              data-testid="button-go-premium"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {busy ? 'Opening secure checkout…' : `Go Premium · ${priceLine}`}
            </button>
          </>
        )}

        {/* Trust — who takes the money, and what happens if you stop. */}
        <div className="mt-4 flex flex-col gap-1.5" data-testid="premium-trust">
          <p className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: TEXT_MUTED }}>
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND }} />
            Secure payment via Razorpay · UPI, card, wallet
          </p>
          <p className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: TEXT_MUTED }}>
            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SUCCESS }} />
            Cancel anytime · your study history is never deleted
          </p>
        </div>
      </Card>

      {/* 3 — the plain-language answer to "what am I actually paying for?" */}
      <Card radius={RADIUS.lg} className="p-5 vicharak-rise" style={{ animationDelay: '80ms' }} testId="card-premium-why">
        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: TEXT }}>Why Premium is worth it</p>
        <p className="mt-1.5 leading-relaxed" style={{ fontSize: '0.86rem', color: TEXT_SECONDARY }}>
          You already do the hard part — the hours. Premium is the part that stops those hours quietly draining
          away: every chapter you finish comes back on the day you were about to forget it, and the weak ones come
          back first. One month costs less than a single coaching class.
        </p>
      </Card>
    </div>
  );
}
