import { useState, useEffect } from 'react';
import { useSpaceRuntime } from '../SpaceRuntimeContext';
import { isRecord, parseResponseBody, describeResponseFailure, normalizeHexColor, readableTextColor, RAZORPAY_PLAN_PAISE, PLAN_PRICE_INR, loadRazorpayScript } from './emailGateShared';
import type { SpaceRegisterResponseBody, OtpResponseBody, GateStep, PaidPlanId } from './emailGateShared';
import type { EmailGateProps } from './emailGateShared';
import { TRIAL_DURATION_DAYS } from '../apps/VicharakAI/access';
import { readStaticPageFromLocation } from './staticPageRoute';
import type { StaticPageKey } from './staticPageRoute';
import { readLearnRouteFromLocation, sameLearnRoute } from './Learn/learnRoute';
import type { LearnRoute } from './Learn/learnRoute';
import { readExamRouteFromLocation, sameExamRoute } from './Exam/examRoute';
import type { ExamRoute } from './Exam/examRoute';
import { readCompareRouteFromLocation, sameCompareRoute } from './Compare/compareRoute';
import type { CompareRoute } from './Compare/compareRoute';
import { readSeoPublicRouteFromLocation, sameSeoPublicRoute } from './seoPublicRoute';
import type { SeoPublicRoute } from './seoPublicRoute';
import {
  applyRegionSeoTags,
  initialLandingRegion,
  landingRegion,
  readLandingRegionFromLocation,
  readRegionPreference,
  resolveLandingRegion,
  resolveLandingRegionWithTimeout,
} from './landingRegions';
import type { RegionKey } from './landingRegions';

interface OpenAIAdsMeasurementWindow extends Window {
  __OPENAI_ADS_MEASUREMENT_SURFACE_CONTEXT__?: string;
  __OPENAI_ADS_MEASUREMENT_RECEIPT__?: string | null;
  __OPENAI_ADS_MEASUREMENT_CONSENT_PROMISE__?: Promise<string | null>;
  __audosRequestOpenAIAdsMeasurementConsent?: (input: {
    granted: boolean;
    explicitMarketingMeasurementOptIn: boolean;
    source: 'email_gate' | 'server_policy';
  }) => Promise<string | null>;
}

const getOpenAIAdsMeasurementWindow = () =>
  window as OpenAIAdsMeasurementWindow;

function syncOpenAIAdsMeasurementConsent(
  granted: boolean,
  explicitMarketingMeasurementOptIn: boolean,
  source: 'email_gate' | 'server_policy',
): Promise<void> {
  const measurementWindow = getOpenAIAdsMeasurementWindow();
  if (typeof measurementWindow.__audosRequestOpenAIAdsMeasurementConsent !== 'function') {
    return Promise.resolve();
  }
  const pending = measurementWindow.__audosRequestOpenAIAdsMeasurementConsent({
    granted,
    explicitMarketingMeasurementOptIn,
    source,
  });
  measurementWindow.__OPENAI_ADS_MEASUREMENT_CONSENT_PROMISE__ = pending;
  return pending.then(() => undefined).catch(() => undefined);
}

async function awaitOpenAIAdsMeasurementConsent(): Promise<void> {
  const pending =
    getOpenAIAdsMeasurementWindow().__OPENAI_ADS_MEASUREMENT_CONSENT_PROMISE__;
  if (!pending) return;
  await Promise.race([
    pending.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 1000)),
  ]);
}

const SAVED_SESSION_TIMEOUT_MS = 7000;

async function fetchSavedSession(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SAVED_SESSION_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useEmailGateController(
  { spaceId, branding, themeTokens }: EmailGateProps,
  { enableGoogleSignIn = false }: { enableGoogleSignIn?: boolean } = {},
) {
  const { setSessionId } = useSpaceRuntime();
  const [email, setEmail] = useState('');
  // Which legal document is open in the in-page modal. The Privacy Policy and
  // the Terms of Service open as portalled modals from in-flow links (pricing
  // cards, sign-in panel, closing CTA) so the visitor never loses their place;
  // the same content is also routable as full pages (see staticPage below).
  const [legalDoc, setLegalDoc] = useState<null | 'privacy' | 'terms'>(null);
  // Which routed informational page (#/about, #/terms, #/privacy, #/refund,
  // #/contact) is open. The space has no server-side router - the platform
  // serves this component at the domain root only, so a real /terms path would
  // 404 on a direct load. The public pages therefore resolve through hash
  // routes, which survive direct loads and refreshes on any host.
  const [staticPage, setStaticPage] = useState<StaticPageKey | null>(() => readStaticPageFromLocation());
  // THE LEARN HUB (#/learn and #/learn/<slug>). A second public route family
  // resolving exactly like the informational pages above, one segment deeper.
  // It is signed-out content, so it renders ahead of the landing page for any
  // visitor. See components/Learn/learnRoute.ts.
  const [learnRoute, setLearnRoute] = useState<LearnRoute | null>(() => readLearnRouteFromLocation());
  const [examRoute, setExamRoute] = useState<ExamRoute | null>(() => readExamRouteFromLocation());
  const [compareRoute, setCompareRoute] = useState<CompareRoute | null>(() => readCompareRouteFromLocation());
  const [seoPublicRoute, setSeoPublicRoute] = useState<SeoPublicRoute | null>(() => readSeoPublicRouteFromLocation());
  const readSitemapRoute = () => {
    if (typeof window === 'undefined') return false;
    const raw = window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname;
    return raw.replace(/^\/+|\/+$/g, '').toLowerCase() === 'sitemap';
  };
  const [sitemapRoute, setSitemapRoute] = useState<boolean>(() => readSitemapRoute());

  // ---- Which regional landing page is being read ----
  // VicharakAI has four acquisition pages that share one component library:
  //  /in (India) · /us · /uk · /global. See components/landingRegions.ts for
  // the config each of them renders and for how the routes resolve.
  //
  // `regionFromUrl` is set only when the URL actually names a region, which is
  // what decides the canonical tag: an explicitly requested page is canonical
  // to itself, while the bare root geo-detects its CONTENT but keeps the bare
  // canonical, so the two never compete for the same ranking.
  const [regionFromUrl, setRegionFromUrl] = useState<RegionKey | null>(() => readLandingRegionFromLocation());
  // What the root route shows. Seeded from whatever is already known (the
  // region resolved earlier this session, else a cached country, else the
  // device clock) so the page never waits on a network call, then corrected
  // once by the effect below.
  const [detectedRegion, setDetectedRegion] = useState<RegionKey>(() => initialLandingRegion());
  const landingRegionKey: RegionKey = regionFromUrl ?? detectedRegion;

  useEffect(() => {
    // hashchange covers the in-page switcher and the legal links; popstate
    // covers a real /in-style path arriving through history navigation.
    const onRouteChange = () => {
      const page = readStaticPageFromLocation();
      const learn = readLearnRouteFromLocation();
      const exam = readExamRouteFromLocation();
      const compare = readCompareRouteFromLocation();
      const seoPublic = readSeoPublicRouteFromLocation();
      const sitemap = readSitemapRoute();
      setStaticPage(page);
      setLearnRoute((current) => (sameLearnRoute(current, learn) ? current : learn));
      setExamRoute((current) => (sameExamRoute(current, exam) ? current : exam));
      setCompareRoute((current) => (sameCompareRoute(current, compare) ? current : compare));
      setSeoPublicRoute((current) => (sameSeoPublicRoute(current, seoPublic) ? current : seoPublic));
      setSitemapRoute(sitemap);
      setRegionFromUrl(readLandingRegionFromLocation());
      // A link inside the legal modal may navigate to a routed page - close
      // the modal so it does not sit above the page it linked to.
      if (page || learn || exam || compare || seoPublic || sitemap) setLegalDoc(null);
    };
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
    };
  }, []);

  // Geo-detect the ROOT route only. A URL that names its region is honoured
  // exactly as written — a shared /uk link must never silently become /in.
  useEffect(() => {
    if (regionFromUrl) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveLandingRegion(spaceId);
      if (!cancelled) setDetectedRegion(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [regionFromUrl, spaceId]);

  useEffect(() => {
    if (!legalDoc) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLegalDoc(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [legalDoc]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Which login method the visitor is using inside the panel.
  //  - 'otp'      → passwordless magic code (email → 4-digit code → verify)
  //  - 'password' → direct email + password sign-in
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<GateStep>('loading');
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsentState] = useState(false);
  const [adultOrGuardianConsent, setAdultOrGuardianConsent] = useState(false);
  const setMarketingConsent = (granted: boolean) => {
    setMarketingConsentState(granted);
    if (!granted) setAdultOrGuardianConsent(false);
  };
  const pendingConsentKey = `vicharakai_pending_consent_${spaceId}`;
  const readPendingConsent = (): { marketingConsent: boolean; adultOrGuardianConsent: boolean } | null => {
    try {
      const raw = localStorage.getItem(pendingConsentKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        marketingConsent: parsed.marketingConsent === true,
        adultOrGuardianConsent: parsed.adultOrGuardianConsent === true,
      };
    } catch {
      return null;
    }
  };
  const syncVerifiedMarketingPreferences = async (
    verifiedSessionId: string,
    optedIn: boolean,
    adultOrGuardian: boolean,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/hooks/execute/${spaceId}/vicharakai-marketing-preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': verifiedSessionId,
        },
        credentials: 'include',
        body: JSON.stringify({
          marketingConsent: optedIn,
          adultOrGuardianConsent: adultOrGuardian,
        }),
      });
      if (!response.ok) return false;
      const payload = await response.json().catch(() => null);
      const result = payload && typeof payload.data === 'object' ? payload.data : payload;
      try { localStorage.removeItem(pendingConsentKey); } catch {}
      return result?.eligibleForMarketing === true;
    } catch {
      return false;
    }
  };

  const [loginOpen, setLoginOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Google uses the platform OAuth route; the legacy GSI button state remains
  // false so the panel consistently renders the redirect button.
  const [gsiButtonReady, setGsiButtonReady] = useState(false);

  // Get workspaceId from window context
  const workspaceId = (window as any).__WORKSPACE_ID__ || null;
  const gdprEnabled = !!(window as any).__GDPR_ENABLED__;

  useEffect(() => {
    // Advanced matching requires both explicit marketing opt-in and the
    // adult/guardian confirmation; no geography or server-policy shortcut
    // grants measurement.
    const granted = marketingConsent && adultOrGuardianConsent;
    void syncOpenAIAdsMeasurementConsent(granted, granted, 'email_gate');
  }, [marketingConsent, adultOrGuardianConsent, spaceId]);
  // Template previews (genesis-space*) aren’t tied to a workspace, so the
  // normal email/OTP registration can’t complete — always offer guest entry
  // there. Cloned workspaces (workspace-N) keep the flag-gated behavior.
  const isTemplatePreview = spaceId === 'genesis-space' || spaceId.startsWith('genesis-space-');
  const guestModeEnabled = !!(window as any).__GUEST_MODE_ENABLED__ || isTemplatePreview;
  const rawSocialProviders = (window as any).__SOCIAL_PROVIDERS__;
  const socialProviders: string[] = Array.isArray(rawSocialProviders)
    ? rawSocialProviders.filter((provider: unknown) => provider !== 'google')
    : [];

  // ---- Checkout state: Razorpay for EVERYONE ----
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<PaidPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ planName: string; priceLabel: string } | null>(null);

  const geoBranch = 'IN' as const;
  const isIndia = true;
  const planPrice = PLAN_PRICE_INR;
  // The one offer line. Creating an account starts a free trial with full
  // access and no card; TRIAL_DURATION_DAYS in apps/VicharakAI/access.ts is
  // the single source of the length, so the landing page, the sign-in panel
  // and the in-app paywall can never quote different numbers of days. The
  // paid plan below is what happens after the trial ends.
  const trialTrustLine = `Free for ${TRIAL_DURATION_DAYS} days with no card. The trial ends without a charge; then choose ${planPrice.monthly} for one month.`;
  // Price-free offer line for every surface OUTSIDE the pricing section (hero,
  // closing CTA): actual prices appear only in the pricing section at the
  // bottom of the page.
  const trialFreeLine = `Free for ${TRIAL_DURATION_DAYS} days — full access, no credit card and no automatic charge.`;

  // ---- PWA install banner (mobile only) ----
  // Android/Chrome fires `beforeinstallprompt` before showing its own install
  // UI; we capture it and offer a branded bottom sheet with a real Install
  // button instead. iOS Safari has no such event, so after a short delay we
  // show Share → “Add to Home Screen” instructions. Never shown when already
  // installed (standalone), on desktop widths, or within 7 days of dismissal.
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // don’t show if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as any).standalone) return; // iOS standalone flag
    // Mobile browsers only — desktop keeps the browser’s own install UI.
    if (window.innerWidth > 768) return;
    // don’t show if the visitor dismissed recently (within 7 days)
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent;
    const isIOSDevice = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    const isSafariBrowser = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);

    if (isIOSDevice && isSafariBrowser) {
      setIsIOS(true);
      // Show the iOS instructions after a short delay
      const timer = setTimeout(() => setShowInstallBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    } catch {
      /* storage unavailable — the banner simply reappears next visit */
    }
  };

  // Prefill the Razorpay modal from anything already known about the visitor.
  const knownCheckoutPrefill = (): { name: string; email: string } => {
    let name = '';
    let prefillEmail = email.trim();
    try {
      const stored = localStorage.getItem(`space_session_${spaceId}`);
      if (stored) {
        const session = JSON.parse(stored) as { email?: string; firstName?: string | null; lastName?: string | null };
        if (!prefillEmail && typeof session.email === 'string') prefillEmail = session.email;
        name = [session.firstName, session.lastName].filter(Boolean).join(' ');
      }
      if (!prefillEmail) prefillEmail = localStorage.getItem('user_email') || '';
    } catch {
      /* prefill is best-effort only */
    }
    return { name, email: prefillEmail };
  };

  // India checkout: create the order server-side (the hook locks amounts to
  // the three known plans), open Razorpay’s modal with the PUBLIC key_id the
  // hook returned alongside the order (key and order always come from the same
  // account that way), then verify server-side before celebrating. The key
  // secret never leaves the create/verify hooks. A verified payment also
  // writes the entitlement row to the vicharakai_subscriptions table (see the
  // verify-razorpay-payment hook).
  //
  // PAYMENT IS LIVE (the hook serves an rzp_live key) — real cards and UPI
  // charge real money; live mode has no test card. The order request includes
  // the visitor’s email + planType so the hook stamps notes { email, plan } on
  // the Razorpay order — the razorpay-webhook hook reads those notes to
  // activate the subscription from the server-to-server event.
  const startRazorpayCheckout = async (plan: PaidPlanId, planName: string, priceLabel: string) => {
    if (checkoutBusyPlan) return;
    setCheckoutError('');
    setCheckoutBusyPlan(plan);
    const prefill = knownCheckoutPrefill();
    try {
      await loadRazorpayScript();
      // The platform secrets proxy occasionally fails transiently upstream, so
      // one client-side retry (a fresh request) rides through the blip.
      let orderResOk = false;
      let orderData: Record<string, unknown> = {};
      let orderId = '';
      let razorpayKeyId = '';
      for (let attempt = 0; attempt < 2 && !orderId; attempt++) {
        const orderRes = await fetch(`/api/hooks/execute/${spaceId}/create-razorpay-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planType: plan, amount: RAZORPAY_PLAN_PAISE[plan], email: prefill.email }),
        });
        const orderBody = await parseResponseBody(orderRes);
        orderData = isRecord(orderBody.data) ? orderBody.data : {};
        orderId = typeof orderData.order_id === 'string' ? orderData.order_id : '';
        // The hook returns the PUBLIC key id with the order so they always match.
        razorpayKeyId = typeof orderData.key_id === 'string' ? orderData.key_id : '';
        orderResOk = orderRes.ok;
      }
      if (!orderResOk || !orderId || !razorpayKeyId) {
        setCheckoutError("We couldn’t start the payment — please try again in a moment. No money was taken.");
        setCheckoutBusyPlan(null);
        return;
      }
      const razorpayCheckout = new ((window as any).Razorpay)({
        key: razorpayKeyId,
        order_id: orderId,
        amount: orderData.amount,
        currency: typeof orderData.currency === 'string' ? orderData.currency : 'INR',
        name: brandName,
        description: `${brandName} ${planName} — ${priceLabel}`,
        prefill,
        theme: { color: primaryColor },
        modal: {
          ondismiss: () => setCheckoutBusyPlan(null),
        },
        handler: (payment: any) => {
          void (async () => {
            try {
              const verifyRes = await fetch(`/api/hooks/execute/${spaceId}/verify-razorpay-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: payment?.razorpay_order_id,
                  razorpay_payment_id: payment?.razorpay_payment_id,
                  razorpay_signature: payment?.razorpay_signature,
                  plan_type: plan,
                  user_email: prefill.email,
                }),
              });
              const verifyBody = await parseResponseBody(verifyRes);
              const verified = isRecord(verifyBody.data) ? verifyBody.data : verifyBody;
              if (verifyRes.ok && isRecord(verified) && verified.success === true && verified.subscription_saved === true) {
                setCheckoutSuccess({ planName, priceLabel });
              } else {
                const paymentId = String(payment?.razorpay_payment_id || 'unavailable');
                setCheckoutError(`Your payment was captured but Premium is not active yet. Payment ID: ${paymentId}. Contact grohan24102004@gmail.com with this ID.`);
              }
            } catch {
              const paymentId = String(payment?.razorpay_payment_id || 'unavailable');
              setCheckoutError(`Your payment was captured but Premium is not active yet. Payment ID: ${paymentId}. Contact grohan24102004@gmail.com with this ID.`);
            } finally {
              setCheckoutBusyPlan(null);
            }
          })();
        },
      });
      razorpayCheckout.on?.('payment.failed', () => {
        setCheckoutError("That payment didn’t go through — no money was taken. Check your payment method and try again.");
        setCheckoutBusyPlan(null);
        razorpayCheckout.close?.();
      });
      razorpayCheckout.open();
    } catch {
      setCheckoutError("We couldn’t reach the payment service. Check your connection and try again.");
      setCheckoutBusyPlan(null);
    }
  };

  const startCheckout = (plan: PaidPlanId, planName: string, priceLabel: string) => {
    void startRazorpayCheckout(plan, planName, priceLabel);
  };

  useEffect(() => {
    // Crash guard: neither attribution capture nor the session check may ever
    // blank the landing page — any unexpected error (blocked storage, a bad
    // stored session, a failed fetch) falls back to the email form instead.
    try {
      storeAttribution();
    } catch (err) {
      console.error('[EmailGate] storeAttribution failed:', err);
    }
    checkExistingSession().catch((err) => {
      console.error('[EmailGate] checkExistingSession failed:', err);
      setError('We could not verify your saved sign-in. You can still sign in below.');
      setStep('email');
    });
  }, [spaceId]);

  // Pre-fill email from localStorage when loaded inside the onboarding walkthrough
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('walkthrough') === 'true') {
      const storedEmail = localStorage.getItem('user_email');
      if (storedEmail) setEmail(storedEmail);
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // ROOT-ROUTE REGIONAL REDIRECT. A visitor landing on the bare root is sent
  // to their regional route (#/in · #/us · #/uk · #/global) so the address bar
  // always names the page being read. The visitor's own saved switcher choice
  // (localStorage 'vicharakai_region') wins outright and skips the geo lookup;
  // otherwise the country is geo-detected under a hard overall budget
  // (REGION_REDIRECT_TIMEOUT_MS), falling back to Global when nothing is
  // knowable. location.replace keeps the bare root out of history, so the back
  // button never bounces through it. The redirect fires ONLY on the signed-out
  // landing route: never over a routed page (#/terms …), never on the OTP code
  // screen, and never for a signed-in visitor (step 'loading'/'complete'),
  // whose hash belongs to the app shell's own deep links. An explicit /uk-style
  // URL is honoured exactly as written — it never redirects.
  // A /learn route is also exempt: it is a public page in its own right, and
  // bouncing a visitor who followed a link to an article onto #/in instead
  // would lose the page they actually asked for.
  useEffect(() => {
    if (step !== 'email' || staticPage || learnRoute || examRoute || compareRoute || seoPublicRoute || sitemapRoute || regionFromUrl) return;
    const redirectTo = (key: RegionKey) => {
      try {
        window.location.replace(landingRegion(key).hash);
      } catch {
        /* navigation refused — the geo-detected content underneath still renders */
      }
    };
    const preferred = readRegionPreference();
    if (preferred) {
      redirectTo(preferred);
      return;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await resolveLandingRegionWithTimeout(spaceId);
      if (cancelled) return;
      // The visitor may have navigated while the lookup ran — a URL that now
      // names a region or a routed page wins over the stale answer.
      if (readLandingRegionFromLocation() || readStaticPageFromLocation() || readLearnRouteFromLocation() || readExamRouteFromLocation() || readCompareRouteFromLocation() || readSeoPublicRouteFromLocation() || readSitemapRoute()) return;
      redirectTo(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, staticPage, learnRoute, examRoute, compareRoute, seoPublicRoute, sitemapRoute, regionFromUrl, spaceId]);

  // Search/social metadata for the public landing page: title, description,
  // keywords, robots, canonical, Open Graph, Twitter card and the hreflang
  // alternates. Each region carries its own set (that is the point of having
  // four pages), so this re-runs whenever the region changes; the tags are
  // rewritten in place rather than appended, so switching can never stack up
  // duplicates.
  //
  // The /learn pages are NOT regional — one hub serves every market — so this
  // stands down while one is open rather than stamping a region's title and
  // canonical over an article. ArticlePage sets its own title.
  useEffect(() => {
    if (learnRoute || examRoute || compareRoute || seoPublicRoute || sitemapRoute || staticPage) return;
    applyRegionSeoTags(landingRegion(landingRegionKey), regionFromUrl !== null);
  }, [landingRegionKey, regionFromUrl, learnRoute, examRoute, compareRoute, seoPublicRoute, sitemapRoute, staticPage]);

  // Landing hero entrance animation (client-only; defaults visible if JS is slow)
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Floating header: transparent over the hero, solid after the visitor scrolls.
  // The landing page scrolls inside `.eg-root` (not the window), so the listener
  // attaches to that container. Re-runs on step change since eg-root only exists
  // on the main landing screen, and on geoBranch change because the two
  // branches are different page trees.
  useEffect(() => {
    const root = document.querySelector('.eg-root');
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 24);
    root.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener('scroll', onScroll);
  }, [step, staticPage, landingRegionKey]);

  // Scroll-reveal: sections marked with [data-reveal] fade in as they enter
  // the viewport. Scrolling happens inside `.eg-root` (not the window), so the
  // observer is rooted there. Re-runs on step change since the landing shell
  // only exists on the main signed-out screen — and on geoBranch change, which
  // swaps in a whole new set of [data-reveal] sections that would otherwise
  // stay stuck at opacity 0 because the observer had already run.
  useEffect(() => {
    const root = document.querySelector('.eg-root');
    if (!root) return;
    const targets = Array.from(root.querySelectorAll('[data-reveal]'));
    if (targets.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('eg-revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('eg-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { root, threshold: 0.15 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [step, staticPage, landingRegionKey]);

  // Switching region is a page change, not a jump inside one — somebody
  // reading /in at the pricing section who taps “UK” should land at the top of
  // the UK page, not halfway down it. The landing page scrolls inside
  // `.eg-root` rather than the window, so a hash link moves nothing by itself
  // and this has to be done here.
  useEffect(() => {
    const root = document.querySelector('.eg-root');
    if (root) root.scrollTop = 0;
  }, [landingRegionKey]);

  const checkExistingSession = async () => {
    // `?as=visitor` preview: never adopt a stored session — skip straight to the
    // logged-out email form instead of jumping to the empty 'complete' state.
    const forceVisitor = typeof window !== 'undefined' && (window as any).__AUDOS_FORCE_VISITOR__ === true;
    const sessionKey = `space_session_${spaceId}`;
    const existingSession = forceVisitor ? null : localStorage.getItem(sessionKey);

    if (existingSession) {
      try {
        const session = JSON.parse(existingSession);
        const effectiveSessionId = session.workspaceSessionId || session.id;

        // SECURITY GATE — the code screen must never be escapable. handleSendOtp
        // stores a real wses_ session with verified:false BEFORE the code is
        // entered, so a reload (or a back navigation) used to land here and,
        // whenever the check-session call was unreachable or no workspaceId was
        // present, fall through to setSessionId() below — entering the app, and
        // every onboarding screen, with an unverified email. A session this
        // browser has not verified is never adopted: the visitor goes back to
        // the code step (or the email step) and finishes verification.
        const locallyUnverified =
          session.verified === false || (session.verified !== true && !session.isGuest);
        if (effectiveSessionId && locallyUnverified) {
          setPendingSessionId(effectiveSessionId);
          if (typeof session.email === 'string' && session.email) setEmail(session.email);
          setOtpEnabled(!!workspaceId);
          // A code step without a workspace can never verify; fail back to the
          // email entry surface instead of trapping the visitor.
          setStep(workspaceId && typeof session.email === 'string' && session.email ? 'code' : 'email');
          return;
        }

        if (effectiveSessionId) {
          if (workspaceId) {
            try {
              // The config request used to block this critical path even though
              // its response was ignored. Check the saved session directly and
              // cap the wait so a slow auth service can never strand the public
              // entry on a blank screen.
              setOtpEnabled(true);
              const checkRes = await fetchSavedSession(`/api/auth/otp/space/check-session?workspaceId=${workspaceId}&sessionUuid=${encodeURIComponent(effectiveSessionId)}`, {
                credentials: 'include'
              });
              if (!checkRes.ok) throw new Error(`Saved-session check failed (${checkRes.status})`);
              const checkData = await checkRes.json();

              if (checkData.verified) {
                // Adopt the canonical wses_ id when the server names one that
                // differs from the stored id (older sessions stored a stale
                // pending/uuid form the data plane no longer accepts).
                const checkCanonicalId =
                  typeof checkData.canonicalSessionId === 'string' &&
                  checkData.canonicalSessionId.startsWith('wses_')
                    ? checkData.canonicalSessionId
                    : effectiveSessionId;
                if (checkCanonicalId !== effectiveSessionId) {
                  try {
                    localStorage.setItem(sessionKey, JSON.stringify({
                      ...session,
                      id: checkCanonicalId,
                      workspaceSessionId: checkCanonicalId,
                    }));
                  } catch {}
                }
                try { (window as any).__audosAcceptedSessionId = checkCanonicalId; } catch {}
                const serverEmail = typeof checkData.email === 'string' ? checkData.email.toLowerCase().trim() : '';
                const verifiedEmail = serverEmail || (typeof session.email === 'string' ? session.email.toLowerCase().trim() : '');
                if (!verifiedEmail) {
                  setError('Your saved session did not include a verified email. Please sign in again.');
                  setStep('email');
                  return;
                }
                setEmail(verifiedEmail);
                setSessionId(checkCanonicalId);
                const pendingConsent = readPendingConsent();
                if (pendingConsent) {
                  const synced = await syncVerifiedMarketingPreferences(
                    checkCanonicalId,
                    pendingConsent.marketingConsent,
                    pendingConsent.adultOrGuardianConsent,
                  );
                  if (synced && pendingConsent.marketingConsent && pendingConsent.adultOrGuardianConsent) {
                    fireLeadEventWithRetry(verifiedEmail, 0, true);
                  }
                }
                setStep('complete');
                return;
              } else {
                setStep('email');
                return;
              }
            } catch (e) {
              console.error('[EmailGate] saved-session verification failed', e);
              setError('We could not verify your saved sign-in. You can still sign in below.');
              setStep('email');
              return;
            }
          }

          setError('We could not verify your saved sign-in. You can still sign in below.');
          setStep('email');
          return;
        }
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }

    if (workspaceId) setOtpEnabled(true);

    setStep('email');
  };

  // Passwordless "Magic Code" flow: register the email to obtain a workspace
  // session, then send a one-time code and advance to the code-entry step.
  // ALL users (new and returning) go through the code step in this path.
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const validationRes = await fetch(`/api/hooks/execute/${spaceId}/validate-signup-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const validationBody = await parseResponseBody(validationRes);
      const validation = isRecord(validationBody.data) ? validationBody.data : null;
      if (!validationRes.ok || !validation || validation.valid !== true) {
        setError(
          validation && typeof validation.message === 'string'
            ? validation.message
            : 'We could not validate that email right now. Please try again.',
        );
        setLoading(false);
        return;
      }

      // Template previews / spaces with no workspace can’t run the OTP flow
      // (there’s no workspace to send a code for) — fall back to direct entry.
      if (!workspaceId) {
        await registerSession();
        return;
      }

      const attribution = getAttribution();
      const visitorId = getVisitorId();
      const sessionId = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      await awaitOpenAIAdsMeasurementConsent();
      const measurementWindow = getOpenAIAdsMeasurementWindow();

      const registerRes = await fetch(`/api/space/${spaceId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: normalizedEmail,
          sessionId,
          visitorId,
          attribution,
          metadata: { emailVerified: false, marketingConsent: false },
          workspaceId,
          sourceUrl: window.location.href,
          // /register runs before OTP because the platform requires its
          // server-generated session id. Never opt an unverified CRM contact
          // into marketing; the verified preference hook records consent only
          // after OTP or platform social auth succeeds.
          marketingConsent: false,
          measurementConsent:
            typeof measurementWindow.__OPENAI_ADS_MEASUREMENT_RECEIPT__ === 'string',
          surfaceContextToken:
            measurementWindow.__OPENAI_ADS_MEASUREMENT_SURFACE_CONTEXT__,
          measurementConsentReceipt:
            measurementWindow.__OPENAI_ADS_MEASUREMENT_RECEIPT__ || undefined,
        }),
      });

      const { data: registerResult, rawText: registerRawText } =
        await parseResponseBody(registerRes);

      if (!registerRes.ok) {
        console.error('[EmailGate] register failed', {
          status: registerRes.status,
          body: registerResult ?? registerRawText.slice(0, 200),
        });
        setError(
          describeResponseFailure(
            registerRes,
            registerResult,
            registerRawText,
            'Failed to create session. Please try again.',
          ),
        );
        setLoading(false);
        return;
      }

      if (!isRecord(registerResult)) {
        console.error('[EmailGate] register returned an unparseable body', {
          status: registerRes.status,
          rawText: registerRawText.slice(0, 200),
        });
        setError('The server returned an unexpected response. Please try again.');
        setLoading(false);
        return;
      }

      const registerBody = registerResult as SpaceRegisterResponseBody;
      const wsSessionId = registerBody.workspaceSessionId;
      if (typeof wsSessionId !== 'string' || !wsSessionId.startsWith('wses_')) {
        setError('The server did not return a valid sign-in session. Please try again.');
        setLoading(false);
        return;
      }
      setPendingSessionId(wsSessionId);

      const sessionKey = `space_session_${spaceId}`;
      const pendingSession = {
        id: wsSessionId,
        workspaceSessionId: wsSessionId,
        email: normalizedEmail,
        contactId: registerResult.contactId || null,
        timestamp: Date.now(),
        verified: false,
        metadata: { emailVerified: false },
      };
      localStorage.setItem(sessionKey, JSON.stringify(pendingSession));

      const response = await fetch('/api/auth/otp/space/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, workspaceId, sessionUuid: wsSessionId }),
      });

      const { data: otpResult, rawText: otpRawText } = await parseResponseBody(response);

      if (!response.ok) {
        console.error('[EmailGate] otp send failed', {
          status: response.status,
          body: otpResult ?? otpRawText.slice(0, 200),
        });
        setError(
          describeResponseFailure(
            response,
            otpResult,
            otpRawText,
            'Failed to send code. Please try again.',
          ),
        );
        setLoading(false);
        return;
      }

      const otpBody: OtpResponseBody = isRecord(otpResult) ? otpResult : {};
      setResendCooldown(otpBody.resendCooldown ?? 60);
      setStep('code');
    } catch (err) {
      console.error('[EmailGate] Network error in handleSendOtp:', err);
      setError('Connection error. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Password authentication is not part of the documented platform contract.
  // Email sign-in always uses the verified OTP route; Google uses platform OAuth.
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassword('');
    setAuthMode('otp');
    setError('Password sign-in is unavailable. Use a sign-in code.');
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    handleSendOtp(e);
  };

  const switchAuthMode = (_mode: 'otp' | 'password') => {
    setPassword('');
    setAuthMode('otp');
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 4) {
      setError('Please enter the 4-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (!pendingSessionId) {
        setError('Session expired. Please start over.');
        setStep('email');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/otp/space/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, code, workspaceId, sessionUuid: pendingSessionId }),
      });

      const { data: verifyResult, rawText: verifyRawText } = await parseResponseBody(response);
      const verifyBody: OtpResponseBody = isRecord(verifyResult) ? verifyResult : {};

      if (!response.ok || !verifyBody.success) {
        console.error('[EmailGate] otp verify failed', {
          status: response.status,
          body: verifyResult ?? verifyRawText.slice(0, 200),
        });
        if (typeof verifyBody.attemptsRemaining === 'number') {
          setError(`Invalid code. ${verifyBody.attemptsRemaining} attempts remaining.`);
        } else {
          setError(
            describeResponseFailure(
              response,
              verifyResult,
              verifyRawText,
              'Invalid code. Please try again.',
            ),
          );
        }
        setLoading(false);
        return;
      }

      // Adopt the CANONICAL verified session id the server returns — the
      // verified row may differ from the pending registration session, and
      // presenting the unverified pending id strands the visitor at
      // "verified session ID required" on every private write.
      const rawCanonicalSessionId =
        verifyBody.canonicalSessionId ?? verifyBody.workspaceSessionId;
      const canonicalAdoptedSessionId =
        typeof rawCanonicalSessionId === 'string' && rawCanonicalSessionId.startsWith('wses_')
          ? rawCanonicalSessionId
          : null;
      if (!canonicalAdoptedSessionId) {
        setError('The server verified the code but did not return a valid session. Please retry.');
        setLoading(false);
        return;
      }
      await completeVerifiedSession(canonicalAdoptedSessionId);
    } catch (err) {
      console.error('[EmailGate] Network error in handleCodeSubmit:', err);
      setError('Connection error. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !pendingSessionId) return;

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/otp/space/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, workspaceId, sessionUuid: pendingSessionId }),
      });

      const { data: resendResult, rawText: resendRawText } = await parseResponseBody(response);

      if (response.ok) {
        const resendBody: OtpResponseBody = isRecord(resendResult) ? resendResult : {};
        setResendCooldown(resendBody.resendCooldown ?? 60);
        setCode('');
      } else {
        console.error('[EmailGate] otp resend failed', {
          status: response.status,
          body: resendResult ?? resendRawText.slice(0, 200),
        });
        setError(
          describeResponseFailure(
            response,
            resendResult,
            resendRawText,
            'Failed to resend code. Please try again.',
          ),
        );
      }
    } catch (err) {
      console.error('[EmailGate] Network error in handleResendCode:', err);
      setError('Connection error. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeVerifiedSession = async (adoptedSessionId?: string | null) => {
    const verifiedSessionId = adoptedSessionId || pendingSessionId;
    if (typeof verifiedSessionId !== 'string' || !verifiedSessionId.startsWith('wses_')) {
      setError('The server did not return a valid verified session. Please retry.');
      setLoading(false);
      return;
    }
    const sessionKey = `space_session_${spaceId}`;
    const normalizedEmail = email.toLowerCase().trim();
    let verifiedMetadata: Record<string, unknown> = {};
    let verifiedContactId: string | null = null;
    try {
      const existingSession = localStorage.getItem(sessionKey);
      if (existingSession) {
        const parsed = JSON.parse(existingSession);
        if (parsed.metadata) verifiedMetadata = parsed.metadata;
        if (typeof parsed.contactId === 'string') verifiedContactId = parsed.contactId;
      }
    } catch {}
    const session = {
      id: verifiedSessionId,
      workspaceSessionId: verifiedSessionId,
      email: normalizedEmail,
      contactId: verifiedContactId,
      timestamp: Date.now(),
      verified: true,
      isReturningUser: true,
      metadata: { ...verifiedMetadata, emailVerified: true },
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));

    try {
      (window as any).__audosAcceptedSessionId = verifiedSessionId;
      window.dispatchEvent(new CustomEvent('audos:session-established', {
        detail: {
          workspaceSessionId: verifiedSessionId,
          email: normalizedEmail,
          verified: true,
        }
      }));
    } catch (e) {}

    const marketingEligible = await syncVerifiedMarketingPreferences(
      verifiedSessionId,
      marketingConsent,
      adultOrGuardianConsent,
    );
    if (marketingEligible) fireLeadEventWithRetry(normalizedEmail, 0, true);
    setSessionId(verifiedSessionId);
    completeGateEntry();
    setLoading(false);
  };

  const registerSession = async () => {
    const normalizedEmail = email.toLowerCase().trim();

    // Template previews have no workspace, so the server-side register can
    // never succeed ("Could not resolve workspace from space."). Create a
    // local preview session with the entered email instead.
    if (isTemplatePreview) {
      const previewId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const previewSession = {
        id: previewId,
        workspaceSessionId: previewId,
        email: normalizedEmail,
        isGuest: true,
        timestamp: Date.now(),
        verified: true,
        metadata: {},
      };
      localStorage.setItem(`space_session_${spaceId}`, JSON.stringify(previewSession));
      try {
        window.dispatchEvent(new CustomEvent('audos:session-established', {
          detail: { workspaceSessionId: previewId, email: normalizedEmail, isGuest: true },
        }));
      } catch (e) {}
      setSessionId(previewId);
      completeGateEntry();
      setLoading(false);
      return;
    }

    // Real workspaces must complete OTP or platform social auth. This helper
    // must never turn a plain /register response into an authenticated entry.
    setError('Verified sign-in is temporarily unavailable. Please retry.');
    setLoading(false);
    return;

    const attribution = getAttribution();
    const visitorId = getVisitorId();
    const sessionId = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    await awaitOpenAIAdsMeasurementConsent();
    const measurementWindow = getOpenAIAdsMeasurementWindow();

    const response = await fetch(`/api/space/${spaceId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: normalizedEmail,
        sessionId,
        visitorId,
        attribution,
        metadata: {},
        workspaceId,
        sourceUrl: window.location.href,
        marketingConsent,
        measurementConsent:
          typeof measurementWindow.__OPENAI_ADS_MEASUREMENT_RECEIPT__ === 'string',
        surfaceContextToken:
          measurementWindow.__OPENAI_ADS_MEASUREMENT_SURFACE_CONTEXT__,
        measurementConsentReceipt:
          measurementWindow.__OPENAI_ADS_MEASUREMENT_RECEIPT__ || undefined,
      }),
    });

    const { data: registerResult, rawText: registerRawText } = await parseResponseBody(response);

    if (!response.ok) {
      console.error('[EmailGate] registerSession failed', {
        status: response.status,
        body: registerResult ?? registerRawText.slice(0, 200),
      });
      setError(
        describeResponseFailure(
          response,
          registerResult,
          registerRawText,
          'Registration failed. Please try again.',
        ),
      );
      setLoading(false);
      return;
    }

    if (!isRecord(registerResult)) {
      console.error('[EmailGate] registerSession returned an unparseable body', {
        status: response.status,
        rawText: registerRawText.slice(0, 200),
      });
      setError('The server returned an unexpected response. Please try again.');
      setLoading(false);
      return;
    }

    const registerBody = registerResult as SpaceRegisterResponseBody;
    const effectiveSessionId = registerBody.workspaceSessionId;
    if (typeof effectiveSessionId !== 'string' || !effectiveSessionId.startsWith('wses_')) {
      setError('The server did not return a valid session. Please try again.');
      setLoading(false);
      return;
    }

    const sessionKey = `space_session_${spaceId}`;
    const session = {
      id: effectiveSessionId,
      workspaceSessionId: registerBody.workspaceSessionId || effectiveSessionId,
      email: normalizedEmail,
      contactId: registerBody.contactId || null,
      timestamp: Date.now(),
      isReturningUser: !!registerBody.isReturningUser,
      metadata: registerBody.metadata || {},
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));

    try {
      window.dispatchEvent(new CustomEvent('audos:session-established', {
        detail: {
          workspaceSessionId: registerBody.workspaceSessionId,
          email: normalizedEmail,
        }
      }));
    } catch (e) {}

    setSessionId(effectiveSessionId);
    completeGateEntry();
    setLoading(false);
  };

  const handleGuestMode = async () => {
    setError('');
    setLoading(true);

    try {
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const sessionKey = `space_session_${spaceId}`;
      const guestSession = {
        id: guestId,
        workspaceSessionId: guestId,
        email: null,
        isGuest: true,
        timestamp: Date.now(),
        verified: true,
        metadata: {},
      };
      localStorage.setItem(sessionKey, JSON.stringify(guestSession));

      try {
        window.dispatchEvent(new CustomEvent('audos:session-established', {
          detail: { workspaceSessionId: guestId, isGuest: true },
        }));
      } catch (e) {}

      setSessionId(guestId);
      completeGateEntry();
    } catch (err) {
      setError('Could not continue as guest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // `?as=visitor` preview forces the signed-out view even after a real
  // sign-in: the gate would render nothing and the visitor would land on the
  // blank-screen lock instead of the space. The session write is real (only
  // reads are shadowed under the forced-visitor preview), so drop the
  // as=visitor param and reload — the fresh session is adopted and the
  // signed-in space opens.
  const completeGateEntry = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__AUDOS_FORCE_VISITOR__ === true) {
        const url = new URL(window.location.href);
        url.searchParams.delete('as');
        window.location.replace(url.toString());
        return;
      }
    } catch (e) {}
    setStep('complete');
  };

  const handleSocialLogin = (provider: string) => {
    // Consent is remembered locally across the provider redirect, but it is
    // written server-side only after the platform returns a verified session.
    try {
      localStorage.setItem(pendingConsentKey, JSON.stringify({
        marketingConsent,
        adultOrGuardianConsent,
        savedAt: Date.now(),
      }));
    } catch {}
    let socialReturnTo = window.location.href;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('as');
      socialReturnTo = url.toString();
    } catch (e) {}
    const returnUrl = encodeURIComponent(socialReturnTo);
    const url = workspaceId
      ? `/api/auth/social/${provider}?workspaceId=${workspaceId}&spaceId=${spaceId}&returnUrl=${returnUrl}`
      : `/api/auth/social/${provider}?spaceId=${spaceId}&returnUrl=${returnUrl}`;
    window.location.href = url;
  };

  // Google sign-in is delegated entirely to the platform social-auth route.
  // That route verifies signature, issuer, audience, expiry and email status
  // before it creates the workspace session; this browser never sees or trusts
  // an ID-token payload.
  const handleGoogleCredential = async (_response?: { credential?: string }) => {
    setError('This Google sign-in response cannot be verified in the browser. Please try again.');
    setGoogleLoading(false);
  };

  const handleGoogleSignIn = () => {
    setError('');
    setGoogleLoading(true);
    handleSocialLogin('google');
  };

  // The login panel keeps this callback for backwards-compatible layout, but
  // the platform OAuth redirect button is now the only Google entry point.
  const mountGsiButton = (_el: HTMLDivElement | null) => {
    setGsiButtonReady(false);
  };

  function getVisitorId(): string {
    const key = 'audos_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `v_${Math.random().toString(36).substring(2)}_${Date.now()}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getAttrCookie(): Record<string, string> | null {
    try {
      const raw = localStorage.getItem('audos_attribution');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setAttrCookie(jsonStr: string) {
    const ATTR_COOKIE_NAME = 'audos_attr';
    const MULTI_LEVEL_TLDS = ['co.uk','co.za','co.in','co.jp','co.kr','co.nz','com.au','com.br','com.cn','com.mx','com.sg','com.hk','com.tw','com.ar','com.co','com.eg','com.my','com.ng','com.pe','com.ph','com.pk','com.tr','com.ua','com.vn','org.uk','org.au','net.au','net.uk','ac.uk','gov.uk','gov.au','edu.au','ne.jp','or.jp'];
    const hostname = window.location.hostname;
    const platformDomains = [
      'replit.dev', 'replit.app', 'repl.co',
      'github.io', 'herokuapp.com', 'netlify.app', 'vercel.app',
      'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com',
      'azurewebsites.net', 'cloudfront.net', 'amazonaws.com',
      'ngrok.io', 'ngrok.app', 'railway.app', 'render.com',
      'fly.dev', 'deno.dev', 'glitch.me'
    ];
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    let isPlatform = false;
    for (let i = 0; i < platformDomains.length; i++) {
      if (hostname.endsWith('.' + platformDomains[i]) || hostname === platformDomains[i]) {
        isPlatform = true;
        break;
      }
    }
    let domainPart = '';
    if (!isLocalhost && !isIP && !isPlatform) {
      const parts = hostname.split('.');
      const lastTwo = parts.slice(-2).join('.');
      if (MULTI_LEVEL_TLDS.indexOf(lastTwo) !== -1 && parts.length >= 3) {
        domainPart = '; domain=.' + parts.slice(-3).join('.');
      } else if (parts.length >= 2) {
        domainPart = '; domain=.' + parts.slice(-2).join('.');
      }
    }
    const isSecure = window.location.protocol === 'https:';
    const secureFlag = isSecure ? '; Secure' : '';
    document.cookie = ATTR_COOKIE_NAME + '=' + encodeURIComponent(jsonStr) + '; max-age=86400; path=/' + domainPart + '; SameSite=Lax' + secureFlag;
  }

  function storeAttribution() {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = params.has('utm_source') || params.has('utm_medium') || params.has('utm_campaign') || params.has('fbclid') || params.has('gclid') || params.has('ref');
    if (!hasUtm) return;

    const attr: Record<string, string> = { capturedAt: Date.now().toString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => {
      const v = params.get(p);
      if (v) attr[p === 'ref' ? 'referrer' : p.replace('utm_', 'utm').replace('_', '')] = v;
    });
    if (document.referrer) attr.httpReferrer = document.referrer;

    try {
      localStorage.setItem('audos_attribution', JSON.stringify(attr));
    } catch {}

    const cookieAttr: Record<string, string> = { capturedAt: new Date().toISOString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => {
      const v = params.get(p);
      if (v) cookieAttr[p] = v;
    });
    if (document.referrer) cookieAttr.httpReferrer = document.referrer;
    try {
      setAttrCookie(JSON.stringify(cookieAttr));
    } catch {}
  }

  async function fireLeadEventWithRetry(
    emailAddr: string,
    attempt = 0,
    consentGranted = marketingConsent && adultOrGuardianConsent,
  ) {
    // Raw email and advanced-matching identifiers never leave the browser
    // until identity is verified and the person explicitly opts in.
    if (!consentGranted) return;
    const normalizedEmail = emailAddr.toLowerCase().trim();
    // Task #1480: stable conversion id used for both client-side rdt('track','Lead', …)
    // and server-side Reddit CAPI so they dedupe.
    const conversionId = `lead_${spaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const tryFireFbq = (): boolean => {
      if (typeof (window as any).fbq === 'function') {
        const pixelId = (window as any).__META_PIXEL_ID__;
        if (pixelId) (window as any).fbq('init', pixelId, { em: normalizedEmail });
        (window as any).fbq('track', 'Lead', {
          content_name: 'Verified signup',
          content_category: 'space',
        });
        return true;
      }
      return false;
    };

    if (!tryFireFbq()) {
      const maxRetries = 5;
      const delays = [100, 200, 400, 800, 1600];

      const retryWithBackoff = (retryAttempt: number) => {
        if (retryAttempt >= maxRetries) {
          console.warn('[EmailGate] Failed to fire Lead event - fbq never loaded after 5 retries');
          return;
        }
        setTimeout(() => {
          if (tryFireFbq()) {
          } else {
            retryWithBackoff(retryAttempt + 1);
          }
        }, delays[retryAttempt]);
      };

      retryWithBackoff(0);
    }

    // Task #1480: Reddit Pixel Lead (parallel to Meta). We call window.rdt
    // directly — the queue stub installed by the injected PageVisit snippet
    // (Task #1456, already live) handles late pixel.js loads, so we don’t
    // need the exponential-backoff retry the Meta path uses. Re-running
    // rdt('init', …, { email, externalId }) propagates advanced matching for
    // the subsequent Lead event (Reddit "Step 3: Set up match keys").
    try {
      const rdt = (window as any).rdt;
      const pixelId = (window as any).__REDDIT_PIXEL_ID__;
      if (typeof rdt === 'function') {
        if (pixelId) {
          rdt('init', pixelId, { email: normalizedEmail, externalId: getVisitorId() });
        }
        rdt('track', 'Lead', { conversionId });
      }
    } catch (e) {
      console.warn('[EmailGate] Reddit Pixel Lead failed:', e);
    }

    if (!workspaceId) return;
    try {
      await fetch(`/api/space/${spaceId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'lead',
          sessionId: `lead_${Date.now()}`,
          visitorId: getVisitorId(),
          // Task #1480: include conversionId so server-side Reddit CAPI dedupes
          // with the client-side rdt('track','Lead',…) fired above.
          conversionId,
          metadata: { email: normalizedEmail, verified: true, marketingConsent: true, conversionId, ...getAttribution() },
          workspaceId,
        }),
      });
    } catch {
      if (attempt < 2) setTimeout(() => fireLeadEventWithRetry(emailAddr, attempt + 1, consentGranted), 2000);
    }
  }

  const getAttribution = () => {
    const params = new URLSearchParams(window.location.search);

    const urlAttribution: Record<string, string | null> = {};
    if (params.get('utm_source')) urlAttribution.utmSource = params.get('utm_source');
    if (params.get('utm_medium')) urlAttribution.utmMedium = params.get('utm_medium');
    if (params.get('utm_campaign')) urlAttribution.utmCampaign = params.get('utm_campaign');
    if (params.get('utm_content')) urlAttribution.utmContent = params.get('utm_content');
    if (params.get('utm_term')) urlAttribution.utmTerm = params.get('utm_term');
    if (params.get('fbclid')) urlAttribution.fbclid = params.get('fbclid');
    if (params.get('gclid')) urlAttribution.gclid = params.get('gclid');
    if (params.get('ref')) urlAttribution.referrer = params.get('ref');
    if (document.referrer) urlAttribution.httpReferrer = document.referrer;

    const storedAttr = getAttrCookie();

    const merged: Record<string, string | null> = {};
    if (storedAttr) {
      for (const [key, value] of Object.entries(storedAttr)) {
        if (value && key !== 'capturedAt') merged[key] = value;
      }
    }
    for (const [key, value] of Object.entries(urlAttribution)) {
      if (value) merged[key] = value;
    }

    return Object.keys(merged).length > 0 ? merged : null;
  };

  const runtimeConfig = (window as any).__SPACE_CONFIG__;
  const runtimeDesktop = runtimeConfig?.desktop || {};
  const runtimeThemeTokens = runtimeDesktop?.themeTokens || {};
  const runtimeBranding = runtimeDesktop?.branding || {};
  // Founder-selected typography flows through themeTokens.typography (kickoff →
  // compiled __SPACE_CONFIG__). Derive the body/heading font stacks here so the
  // landing renders the chosen fonts instead of a hard-coded system-ui.
  const typography =
    themeTokens?.typography || runtimeThemeTokens?.typography || {};
  const bodyFontStack = typography.bodyFont
    ? `"${typography.bodyFont}", system-ui, -apple-system, sans-serif`
    : 'system-ui, -apple-system, sans-serif';
  const headingFontStack = typography.headingFont
    ? `"${typography.headingFont}", system-ui, -apple-system, sans-serif`
    : bodyFontStack;
  // Kickoff stores the manually selected color in palette.primary. Shell accent
  // is derived from palette.highlight and is only a fallback for older spaces.
  const selectedAccentColor = normalizeHexColor(
    themeTokens?.shell?.accentColor ||
      runtimeThemeTokens?.shell?.accentColor ||
      runtimeDesktop?.theme?.accentColor,
  );
  const palette =
    themeTokens?.palette ||
    runtimeThemeTokens?.palette ||
    branding?.palette ||
    runtimeBranding?.palette ||
    branding?.colors ||
    runtimeBranding?.colors ||
    {};
  // VicharakAI palette — white-blue sheet, navy ink, ONE accent: #0057FF
  // (deep partner #003AB0, tint #6C9BFF). No cyan, no purple, no teal.
  // Changing the values here keeps the OTP screen, sign-in modal and
  // checkout modals on the same brand as the landing page.
  const primaryColor = '#0057FF';
  const primaryDeep = '#003AB0';
  const accentSoft = '#6C9BFF';
  const highlightColor = accentSoft;
  const contrastColor = '#EAF2FF';
  const brandName = branding?.name || 'VicharakAI';
  const tagline = branding?.tagline || 'Study it. Test it. Don\u2019t lose it.';
  const logoUrl = branding?.logoUrl;
  const pageBackground = '#F2F7FF';
  const sectionBackground = '#F2F7FF';
  const panelColor = '#FFFFFF';
  const panelStrongColor = '#FFFFFF';
  const bgLight = 'rgba(0, 87, 255, 0.08)';
  const bgMedium = '#E8F0FF';
  const borderColor = '#C7DAFF';
  const textPrimary = '#001847';
  const textMuted = '#002F8A';
  const textSubtle = 'rgba(0, 47, 138, 0.62)';
  const onPrimary = '#FFFFFF';
  const onHighlight = '#111827';
  // The brand fill is a real 135° blue→deep-navy gradient. Every consumer
  // assigns it through the `background:` shorthand — never `backgroundColor`,
  // which silently drops a gradient value. The hero and the OTP screen sit on
  // the same dark canvas lit by a blue beacon glow from the top centre.
  const brandGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${primaryDeep} 100%)`;
  // The same sweep for text FILLED with the gradient: it leads in from the
  // light blue tint, because a raw #0057FF→#003AB0 fill reads as almost black
  // at the navy end and the headline all but disappears on the dark canvas.
  const brandGradientText = `linear-gradient(120deg, ${primaryDeep} 0%, ${primaryColor} 58%, #2F82F5 100%)`;
  const heroGlow = `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 87, 255, 0.12) 0%, transparent 72%), ${pageBackground}`;
  const heroGradient = heroGlow;
  const gateGradient = heroGlow;
  // Semantic tones: form/payment errors, and the nightly pace verdicts
  // (on track / behind / off pace).
  const toneDanger = '#F87171';
  const toneWarn = '#FBBF24';
  const toneGood = '#34D399';
  const subjectOrange = '#F97316';
  // Scrim behind the login modal — the canvas colour dims the landing while it opens.
  const darkSurface = '#001847';
  const loginPanelId = 'email-gate-login-panel';

  const openLogin = () => {
    setLoginOpen(true);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-testid="input-email"]');
      input?.focus();
    }, 0);
  };

  // The ONE address every signed-out surface writes to (founder instruction,
  // 2026-10-01). The old support@vicharakai.com mailbox is retired — footer,
  // legal modal, Learn hub and the routed pages all read this.
  const SUPPORT_EMAIL = 'grohan24102004@gmail.com';

  // Shared look for the policy / support links that sit next to the sign-up
  // and payment buttons.
  const legalLinkStyle: React.CSSProperties = {
    color: primaryColor,
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  };

  const navLinkStyle: React.CSSProperties = {
    color: textMuted,
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  };

  // A monochrome onboarding mark (path marker ".mono.") can be recolored for
  // contrast; any other logo (legacy colored, knockout, dimensional) is shown
  // as-is on a neutral chip so it keeps working without clashing.
  const logoIsMono =
    typeof logoUrl === 'string' && /\.mono\.[a-z0-9]+(?:[?#].*)?$/i.test(logoUrl);

  // Centralized logo "block/chip": the fill derives from the current theme
  // tokens and the mark auto-picks white/black for contrast, so swapping the
  // brand palette recolors the block without ever regenerating the logo.
  const BrandMark = ({
    size = 40,
    blockColor,
    radiusScale = 0.26,
  }: { size?: number; blockColor?: string; radiusScale?: number }) => {
    const fill = blockColor || primaryColor;
    const markIsLight = readableTextColor(fill) === '#ffffff';
    const inner = Math.round(size * 0.6);
    const blockStyle = {
      width: size,
      height: size,
      borderRadius: Math.round(size * radiusScale),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    } as const;
    if (logoUrl && !logoIsMono) {
      // No chip at all: the mark is a transparent PNG whose left wing is white,
      // so ANY plate behind it — even a 5% white one — reads as a pale square
      // against the near-black canvas. It sits straight on the background
      // instead, which is also how it appears inside the app.
      return (
        <div style={{ ...blockStyle, backgroundColor: 'transparent' }}>
          <img
            src={logoUrl}
            alt={brandName}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            style={{ width: size, height: size, objectFit: 'contain' }}
          />
        </div>
      );
    }
    return (
      <div style={{ ...blockStyle, backgroundColor: fill }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={brandName}
            width={inner}
            height={inner}
            loading="lazy"
            decoding="async"
            style={{
              width: inner,
              height: inner,
              objectFit: 'contain',
              filter: markIsLight ? 'brightness(0) invert(1)' : 'brightness(0)',
            }}
          />
        ) : (
          <span
            style={{
              color: markIsLight ? '#ffffff' : '#0F172A',
              fontWeight: 700,
              fontSize: Math.round(size * 0.42),
              fontFamily: headingFontStack,
            }}
          >
            {brandName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    );
  };
  return {
    setSessionId,
    email,
    setEmail,
    legalDoc,
    setLegalDoc,
    staticPage,
    setStaticPage,
    learnRoute,
    examRoute,
    compareRoute,
    seoPublicRoute,
    sitemapRoute,
    landingRegionKey,
    regionFromUrl,
    password,
    setPassword,
    code,
    setCode,
    authMode,
    setAuthMode,
    loading,
    setLoading,
    error,
    setError,
    step,
    setStep,
    otpEnabled,
    setOtpEnabled,
    resendCooldown,
    setResendCooldown,
    pendingSessionId,
    setPendingSessionId,
    marketingConsent,
    setMarketingConsent,
    adultOrGuardianConsent,
    setAdultOrGuardianConsent,
    loginOpen,
    setLoginOpen,
    entered,
    setEntered,
    scrolled,
    setScrolled,
    googleLoading,
    setGoogleLoading,
    gsiButtonReady,
    setGsiButtonReady,
    workspaceId,
    gdprEnabled,
    isTemplatePreview,
    guestModeEnabled,
    enableGoogleSignIn,
    rawSocialProviders,
    socialProviders,
    checkoutBusyPlan,
    setCheckoutBusyPlan,
    checkoutError,
    setCheckoutError,
    checkoutNotice,
    setCheckoutNotice,
    checkoutSuccess,
    setCheckoutSuccess,
    geoBranch,
    isIndia,
    planPrice,
    trialTrustLine,
    trialFreeLine,
    /* The one trial length, threaded to every gate sub-component so the
       sign-in panel and the overlays can never print a stale number. */
    trialDurationDays: TRIAL_DURATION_DAYS,
    installPrompt,
    setInstallPrompt,
    showInstallBanner,
    setShowInstallBanner,
    isIOS,
    setIsIOS,
    handleInstall,
    handleDismissInstall,
    knownCheckoutPrefill,
    startRazorpayCheckout,
    startCheckout,
    checkExistingSession,
    handleSendOtp,
    handlePasswordLogin,
    handleAuthSubmit,
    switchAuthMode,
    handleCodeSubmit,
    handleResendCode,
    completeVerifiedSession,
    registerSession,
    handleGuestMode,
    completeGateEntry,
    handleSocialLogin,
    handleGoogleCredential,
    handleGoogleSignIn,
    mountGsiButton,
    getVisitorId,
    getAttrCookie,
    setAttrCookie,
    storeAttribution,
    fireLeadEventWithRetry,
    getAttribution,
    runtimeConfig,
    runtimeDesktop,
    runtimeThemeTokens,
    runtimeBranding,
    typography,
    bodyFontStack,
    headingFontStack,
    selectedAccentColor,
    palette,
    primaryColor,
    primaryDeep,
    accentSoft,
    highlightColor,
    contrastColor,
    brandName,
    tagline,
    logoUrl,
    pageBackground,
    sectionBackground,
    panelColor,
    panelStrongColor,
    bgLight,
    bgMedium,
    borderColor,
    textPrimary,
    textMuted,
    textSubtle,
    onPrimary,
    onHighlight,
    brandGradient,
    brandGradientText,
    heroGlow,
    heroGradient,
    gateGradient,
    toneDanger,
    toneWarn,
    toneGood,
    subjectOrange,
    darkSurface,
    loginPanelId,
    openLogin,
    SUPPORT_EMAIL,
    legalLinkStyle,
    navLinkStyle,
    logoIsMono,
    BrandMark,
  };
}
