/**
 * LANDING FUNNEL INSTRUMENTATION (2026-09-27).
 *
 * WHY THIS FILE EXISTS. The signed-out page reported ZERO CTA clicks against
 * 1,560 unique visitors — while the same analytics recorded 475 unique email
 * captures over that period. Both cannot be true: every one of those captures
 * began with a visitor tapping a CTA. The button was never the problem.
 * NOTHING ON THIS PAGE EVER REPORTED A CLICK. The only event the signed-out
 * flow has ever sent is `lead`, fired by useEmailGateController AFTER an
 * email is captured, so every step between landing and signup — and every
 * step after it, including reaching the price — was invisible.
 *
 * A funnel you cannot see is a funnel you cannot fix, which is why this lands
 * alongside the copy and layout work rather than after it.
 *
 * Each call fans out three ways, all best-effort:
 *
 *   1. `window.trackFunnelEvent` — the platform's always-present Google Tag
 *      Manager helper (integrations/funnel-analytics). It is a safe no-op
 *      when the workspace has no container configured, and never throws.
 *   2. `POST /api/space/:spaceId/track` — the same workspace analytics
 *      endpoint the lead event already posts to, so a CTA tap and a pricing
 *      view land in the workspace funnel next to the captures they precede.
 *   3. the Meta Pixel, when one is on the page, as a CUSTOM event — the ad
 *      account gets an intent signal earlier than the email capture without
 *      polluting the standard conversion taxonomy that `Lead` already owns.
 *
 * EVERY STEP IS SWALLOWED. Instrumentation must never be able to stop a
 * visitor reaching the sign-in panel, so nothing here is awaited and nothing
 * here can throw into a click handler.
 */

/** Which CTA earned the tap. Knowing this is the entire point: the page
 *  carries eight of them and, until now, no way to tell them apart. */
export type CtaLocation =
  | 'nav'
  | 'hero'
  | 'after-problem'
  | 'after-how-it-works'
  | 'after-memory-loop'
  | 'after-test-analysis'
  | 'pricing-trial'
  | 'pricing-monthly'
  /* The SECOND pricing block, mounted above the closing ask (2026-09-27).
     Told apart from the mid-page one on purpose: if the repeat is what
     earns the taps, the first block is in the wrong place. */
  | 'pricing-close-trial'
  | 'pricing-close-monthly'
  | 'close'
  /* RETIRED 2026-09-30: the mobile sticky bottom bar was removed from the
     page (founder instruction). Kept in the union so old recorded events
     still typecheck anywhere they are read back. */
  | 'mobile-sticky'
  /* The hero promo strip's Claim button (2026-09-30) — its inline email
     field is gone. Since v199 the tap opens a pre-filled MAILTO to the
     founder (never the sign-in) and is still counted here. */
  | 'free-session-banner'
  /* The "Want to talk to me?" band's Book a Free Session button (v201,
     2026-10-01) — a mailto to the founder, counted like the banner claim
     but told apart so the two offers' pull can be compared. */
  | 'talk-session'
  /* The free test-analysis tool CTA (2026-10-02) — "Get My Free Analysis".
     It stashes the visitor's uploaded paper / typed mistakes in
     localStorage and opens the same sign-in, so the funnel can tell this
     hook apart from a plain hero tap. */
  | 'free-analysis';

export interface LandingEventContext {
  /** The space this page belongs to. Falls back to the injected global. */
  spaceId: string;
  /** The regional route in play: in / us / uk / global. */
  region: string;
  /** The `?exam=` message match in play, or null for the default page. */
  exam?: string | null;
}

/** The one visitor id used before and after sign-in. SpaceRuntimeContext and
 * the in-app funnel read this same key, so an ad click does not become a new
 * person when the app opens. */
export function getJourneyVisitorId(): string {
  try {
    const key = 'audos_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      const cookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('audos_vid='));
      id = cookie ? decodeURIComponent(cookie.slice('audos_vid='.length)) : null;
    }
    if (!id) id = `v_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return '';
  }
}

/** A stable anonymous session for the whole landing → email-capture journey.
 * `/register` receives this exact id, allowing the platform to heal the
 * pre-sign-in events onto the contact instead of leaving one orphan per tap. */
export function getJourneySessionId(spaceId: string): string {
  try {
    const key = `audos_journey_session_${spaceId || 'default'}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

function journeyAttribution(): Record<string, string> | null {
  const merged: Record<string, string> = {};
  try {
    const stored = JSON.parse(localStorage.getItem('audos_attribution') || '{}') as Record<string, unknown>;
    const aliases: Record<string, string> = {
      utmsource: 'utm_source', utmSource: 'utm_source', utm_source: 'utm_source',
      utmmedium: 'utm_medium', utmMedium: 'utm_medium', utm_medium: 'utm_medium',
      utmcampaign: 'utm_campaign', utmCampaign: 'utm_campaign', utm_campaign: 'utm_campaign',
      utmcontent: 'utm_content', utmContent: 'utm_content', utm_content: 'utm_content',
      utmterm: 'utm_term', utmTerm: 'utm_term', utm_term: 'utm_term',
      fbclid: 'fbclid', gclid: 'gclid', referrer: 'ref', ref: 'ref', httpReferrer: 'http_referrer',
    };
    for (const [key, value] of Object.entries(stored)) {
      const target = aliases[key];
      if (target && typeof value === 'string' && value) merged[target] = value;
    }
  } catch {}
  const params = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref']) {
    const value = params.get(key);
    if (value) merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

function resolveSpaceId(spaceId: string): string {
  if (spaceId) return spaceId;
  const w = window as any;
  return w.__APP_ID__ || w.__SPACE_ID__ || '';
}

function send(ctx: LandingEventContext, eventType: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const attribution = journeyAttribution();
  const payload = { region: ctx.region, exam: ctx.exam || null, ...params };

  try {
    const gtm = (window as any).trackFunnelEvent;
    if (typeof gtm === 'function') gtm(eventType, payload);
  } catch {
    /* no container, or a tag threw — the visitor must not notice */
  }

  const space = resolveSpaceId(ctx.spaceId);
  if (!space) return;
  try {
    void fetch(`/api/space/${space}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The tap usually navigates into the sign-in panel immediately; keepalive
      // lets the beacon finish even if this document is torn down first.
      keepalive: true,
      body: JSON.stringify({
        eventType,
        sessionId: getJourneySessionId(space),
        visitorId: getJourneyVisitorId(),
        metadata: attribution ? { ...payload, attribution } : payload,
        attribution,
      }),
    }).catch(() => {});
  } catch {
    /* offline, blocked by an extension, or refused — the tap still works */
  }
}

/** A generic pre-auth journey event used by the landing and email gate. */
export function trackJourneyEvent(
  ctx: LandingEventContext,
  eventType: string,
  params: Record<string, unknown> = {},
): void {
  send(ctx, eventType, params);
}

/** The landing page actually rendered. */
export function trackLandingView(ctx: LandingEventContext): void {
  send(ctx, 'page_view', { surface: 'landing', path: window.location.pathname });
}

/** A visitor tapped a CTA. Always fired BEFORE openLogin(), never instead. */
export function trackCtaClick(ctx: LandingEventContext, location: CtaLocation): void {
  send(ctx, 'cta_click', { location });
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === 'function') {
      fbq('trackCustom', 'LandingCtaClick', { location, region: ctx.region, exam: ctx.exam || null });
    }
  } catch {
    /* no pixel on this page */
  }
}

/** The pricing band reached the viewport — the step the funnel reported as 0
 *  purely because nobody was counting it. Fired once per page view. */
export function trackPricingView(ctx: LandingEventContext): void {
  send(ctx, 'pricing_view', {});
}

/** The visitor ran the hero demo. The strongest pre-signup intent signal the
 *  page has, and worth separating from a plain CTA tap. */
export function trackDemoRun(ctx: LandingEventContext): void {
  send(ctx, 'demo_run', {});
}
