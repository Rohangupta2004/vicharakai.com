/**
 * Funnel event tracking — the ONE way this app reports a step of the
 * signup → onboarding → paywall → checkout funnel.
 *
 * Mirrors components/landingAnalytics.ts so a signed-in event and a
 * signed-out CTA belong to the same visitor and the same workspace
 * analytics summary. Each call fans out two ways, all best-effort:
 *
 *   1. `window.trackFunnelEvent` — the platform's always-present Google Tag
 *      Manager helper (integrations/funnel-analytics). Safe no-op when the
 *      workspace has no container, and never throws.
 *   2. `POST /api/space/:spaceId/track` — the same workspace analytics
 *      endpoint the landing page and the `lead` event already post to, so
 *      paywall views and checkout starts land next to the captures they
 *      follow. This is the feed `get_analytics_summary` actually counts.
 *
 * EVERY STEP IS SWALLOWED. Instrumentation must never be able to block a
 * checkout or a study session, so nothing here is awaited and nothing here
 * can throw into a click handler.
 *
 * Event NAMES live at their call sites (or in the named helpers below),
 * so searching for 'paywall_view' lands on the one place it actually fires.
 */
import { examLabelFromId } from '../customExam';
import { getExam, type ExamDef } from '../syllabus';

/** The same visitor id the landing page and the lead event use, so a CTA
 *  tap, an onboarding step and a checkout belong to one person. */
function visitorId(): string {
  try {
    const key = 'audos_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `v_${Math.random().toString(36).substring(2)}_${Date.now()}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return '';
  }
}

function resolveSpaceId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window === 'undefined') return '';
  const w = window as any;
  return w.__APP_ID__ || w.__SPACE_ID__ || '';
}

/** Use the platform-verified session whenever one exists. The previous
 * `app_<timestamp>` id kept onboarding/paywall events anonymous even after
 * OTP, which is why CRM contacts could show zero events. */
function sessionId(spaceId: string): string {
  try {
    const accepted = (window as any).__audosAcceptedSessionId;
    if (typeof accepted === 'string' && accepted.startsWith('wses_')) return accepted;
    const stored = localStorage.getItem(`space_session_${spaceId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const candidate = parsed.workspaceSessionId || parsed.sessionId || parsed.id;
      if (typeof candidate === 'string' && candidate) return candidate;
    }
    const journeyKey = `audos_journey_session_${spaceId || 'default'}`;
    let journey = localStorage.getItem(journeyKey);
    if (!journey) {
      journey = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(journeyKey, journey);
    }
    return journey;
  } catch {
    return `journey_${Date.now()}`;
  }
}

function attribution(): Record<string, string> | null {
  const merged: Record<string, string> = {};
  try {
    const stored = JSON.parse(localStorage.getItem('audos_attribution') || '{}') as Record<string, unknown>;
    const aliases: Record<string, string> = {
      utmsource: 'utm_source', utmSource: 'utm_source', utm_source: 'utm_source',
      utmmedium: 'utm_medium', utmMedium: 'utm_medium', utm_medium: 'utm_medium',
      utmcampaign: 'utm_campaign', utmCampaign: 'utm_campaign', utm_campaign: 'utm_campaign',
      utmcontent: 'utm_content', utmContent: 'utm_content', utm_content: 'utm_content',
      utmterm: 'utm_term', utmTerm: 'utm_term', utm_term: 'utm_term',
      fbclid: 'fbclid', gclid: 'gclid', referrer: 'ref', ref: 'ref',
    };
    for (const [key, value] of Object.entries(stored)) {
      const target = aliases[key];
      if (target && typeof value === 'string' && value) merged[target] = value;
    }
  } catch {}
  return Object.keys(merged).length > 0 ? merged : null;
}

/** Fire one funnel event. Never throws. Never awaited. */
export function trackEvent(name: string, props: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  try {
    const gtm = (window as any).trackFunnelEvent;
    if (typeof gtm === 'function') gtm(name, props);
  } catch {
    /* no container, or a tag threw — the student must not notice */
  }

  const space =
    resolveSpaceId(typeof props.spaceId === 'string' ? props.spaceId : undefined);
  if (!space) return;
  try {
    const campaignAttribution = attribution();
    void fetch(`/api/space/${space}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Checkout often navigates or tears the modal down immediately;
      // keepalive lets the beacon finish even if this document is gone.
      keepalive: true,
      body: JSON.stringify({
        eventType: name,
        sessionId: sessionId(space),
        visitorId: visitorId(),
        metadata: campaignAttribution ? { ...props, attribution: campaignAttribution } : props,
        attribution: campaignAttribution,
      }),
    }).catch(() => {});
  } catch {
    /* offline, blocked by an extension, or refused — checkout still works */
  }
}

/* ---------- once-guards (localStorage, same key shape as access.ts) ---------- */

function flagKey(spaceId: string, flag: string): string {
  return `vicharakai:${spaceId}:${flag}`;
}

function readFlag(spaceId: string, flag: string): string | null {
  try {
    return window.localStorage.getItem(flagKey(spaceId, flag));
  } catch {
    return null;
  }
}

function writeFlag(spaceId: string, flag: string, value: string): void {
  try {
    window.localStorage.setItem(flagKey(spaceId, flag), value);
  } catch {
    /* privacy mode — the guard simply won't hold across visits */
  }
}

/**
 * Fire `name` at most once, ever, on this device. The marker is written
 * BEFORE the event, so a bulk action that reaches this several times in the
 * same tick still produces exactly one event.
 */
export function trackEventOnce(
  spaceId: string,
  flag: string,
  name: string,
  props: Record<string, unknown> = {},
): void {
  if (readFlag(spaceId, flag) !== null) return;
  writeFlag(spaceId, flag, '1');
  trackEvent(name, { spaceId, ...props });
}

/** Fire `name` at most once per calendar day (`day` is an ISO yyyy-mm-dd). */
export function trackEventOncePerDay(
  spaceId: string,
  flag: string,
  day: string,
  name: string,
  props: Record<string, unknown> = {},
): void {
  if (readFlag(spaceId, flag) === day) return;
  writeFlag(spaceId, flag, day);
  trackEvent(name, { spaceId, ...props });
}

/**
 * The exam label every event reports, resolved exactly the way the app titles
 * the exam on screen — so `exam` reads identically on every event in the
 * funnel whether the caller holds the syllabus, the saved label, or only the
 * profile's exam id.
 */
export function trackedExamLabel(
  examDef: ExamDef | null | undefined,
  savedLabel?: string | null,
  examId?: string | null,
): string {
  return (
    examDef?.name ||
    (savedLabel || '').trim() ||
    (examId ? getExam(examId)?.name : undefined) ||
    examLabelFromId(examId)
  );
}

/* ---------- named conversion events (2026-09-27 app-funnel pass) ---------- */

export type CheckoutRail = 'razorpay' | 'creem';

/** One onboarding screen became visible. `step` is the screen name. */
export function trackOnboardingStep(step: string, extra: Record<string, unknown> = {}): void {
  trackEvent('onboarding_step', { step, ...extra });
}

/** The plan / subscription screen actually rendered. Also writes
 *  `pricing_view` — the event type `get_analytics_summary` already counts
 *  as totalPricingViews (the landing pricing band uses the same name). */
export function trackPaywallView(source: string, extra: Record<string, unknown> = {}): void {
  trackEvent('paywall_view', { source, ...extra });
  trackEvent('pricing_view', { source, surface: 'app', ...extra });
}

/** Razorpay modal opened, or the Creem link was followed. */
export function trackCheckoutStart(rail: CheckoutRail, extra: Record<string, unknown> = {}): void {
  trackEvent('checkout_start', { rail, ...extra });
}

/** A verified payment landed. Also writes `purchase` so the summary's
 *  totalPurchases counter moves — that name is what the lead/pricing
 *  counters already pair with. */
export function trackCheckoutSuccess(rail: CheckoutRail, extra: Record<string, unknown> = {}): void {
  trackEvent('checkout_success', { rail, ...extra });
  trackEvent('purchase', { rail, ...extra });
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', { rail, ...extra });
    }
  } catch {
    /* no pixel on this page */
  }
}

/** Checkout failed to open, the student was declined, or verify failed. */
export function trackCheckoutFailed(
  rail: CheckoutRail,
  reason: string,
  extra: Record<string, unknown> = {},
): void {
  trackEvent('checkout_failed', { rail, reason, ...extra });
}

/** The 3-day free trial row was written. */
export function trackTrialStarted(extra: Record<string, unknown> = {}): void {
  trackEvent('trial_started', extra);
}

/** The student hit the trial-expiry gate (no active subscription). */
export function trackTrialExpired(extra: Record<string, unknown> = {}): void {
  trackEvent('trial_expired', extra);
}
