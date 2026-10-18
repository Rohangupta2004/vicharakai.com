import type { DesktopThemeTokens } from '../types';

export type ParsedResponseBody = { data: unknown; rawText: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Parses a fetch Response body safely so a 5xx HTML page (proxy timeout,
// memory-crash restart, etc.) does not throw inside `response.json()` and
// get swallowed into the generic "Connection error" copy. Always returns
// an object instead of throwing — callers inspect `response.ok` themselves.
export async function parseResponseBody(response: Response): Promise<ParsedResponseBody> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    return { data: null, rawText: '' };
  }

  if (!rawText) {
    return { data: null, rawText: '' };
  }

  try {
    return { data: JSON.parse(rawText) as unknown, rawText };
  } catch {
    return { data: null, rawText };
  }
}

// Pick the most informative error message we can show to the user given
// what came back over the wire. Server-provided `error` always wins; for
// unparseable / non-JSON responses we expose the HTTP status so the bug
// is debuggable instead of being hidden behind "Connection error".
export function describeResponseFailure(
  response: Response,
  body: unknown,
  rawText: string,
  fallback: string,
): string {
  if (isRecord(body)) {
    const errField = body.error;
    if (typeof errField === 'string' && errField.trim()) return errField;
    const msgField = body.message;
    if (typeof msgField === 'string' && msgField.trim()) return msgField;
  }

  const status = response.status;
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Please try again in a moment.';
  }
  if (status >= 500) return `Server error (${status}). Please try again.`;
  if (status === 404) return 'This space could not be found. Please contact support.';
  if (status === 403) return 'This email is not authorized to access this space.';
  if (status === 400 && rawText) {
    // Sometimes the server returns a plain text 400; surface a trimmed copy
    const snippet = rawText.trim().slice(0, 140);
    if (snippet) return snippet;
  }

  return fallback;
}

// Snapshot of the JSON envelope returned by /api/space/:spaceId/register.
// All fields are optional because the server has historically added/removed
// keys; the client narrows individually before use.
export interface SpaceRegisterResponseBody {
  success?: boolean;
  workspaceSessionId?: string;
  contactId?: string;
  email?: string;
  isReturningUser?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  visitorId?: string | null;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

// Snapshot of the JSON envelope returned by /api/auth/otp/space/{send,verify}.
export interface OtpResponseBody {
  success?: boolean;
  resendCooldown?: number;
  attemptsRemaining?: number;
  expiresIn?: number;
  sessionVerified?: boolean;
  // The canonical contact-linked session the server verified; the client must
  // adopt this id (it may differ from the pending registration session).
  canonicalSessionId?: string;
  workspaceSessionId?: string;
}

export interface EmailGateProps {
  spaceId: string;
  branding?: {
    name?: string;
    tagline?: string;
    logoUrl?: string;
    heroVideoUrl?: string;
    colors?: Record<string, any>;
    palette?: Record<string, any>;
  };
  themeTokens?: DesktopThemeTokens;
}

export type GateStep = 'loading' | 'email' | 'code' | 'complete';

// Derive a usable color set from a single hex primary color
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 3 && clean.length !== 6) return null;
  const normalized =
    clean.length === 3
      ? clean.split('').map((char) => char + char).join('')
      : clean;
  return {
    r: parseInt(normalized.substring(0, 2), 16),
    g: parseInt(normalized.substring(2, 4), 16),
    b: parseInt(normalized.substring(4, 6), 16),
  };
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  return match ? `#${match[1]}` : undefined;
}

export function readableTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.58 ? '#0F172A' : '#ffffff';
}

// ---------------------------------------------------------------------------
// SEO metadata for the public (signed-out) landing page.
// The space ships as a client-rendered bundle with no server-authored <head>,
// so the tags are written into document.head on mount. Existing tags are
// reused rather than duplicated, so re-mounting never stacks up copies.
// ---------------------------------------------------------------------------
export const SEO_CANONICAL_URL = 'https://www.vicharakai.com';
// TITLE AND DESCRIPTION (founder instruction, 2026-10-01). The product is a
// PREPARATION SYSTEM, not “a revision app for IB, IG…” — the tab title and
// the description both have to say that. applyRegionSeoTags in
// landingRegions.ts rewrites the same tags per regional route; keep the two
// in step.
export const SEO_TITLE = 'VicharakAI: Turn Mock Test Mistakes into Marks | JEE, NEET, NEET PG, UPSC, CAT, GATE, SSC';
export const SEO_DESCRIPTION =
  'VicharakAI saves the concept behind every mock-test mistake, finds related questions and schedules revision around your recall. For JEE, NEET, NEET PG, UPSC, CAT, GATE and SSC aspirants. ₹149 a month.';
export const SEO_OG_TITLE = 'VicharakAI: Every Mistake Comes Back, Right Before You Forget It';
export const SEO_SOCIAL_IMAGE =
  'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1792307215949-8x7kjg.png';

export const SEO_NAMED_META: Array<[string, string]> = [
  ['description', SEO_DESCRIPTION],
  [
    'keywords',
    'JEE revision app, NEET preparation, UPSC exam prep, spaced revision, question cards, weak topic analysis, competitive exam prep India',
  ],
  ['robots', 'index, follow'],
  ['twitter:card', 'summary_large_image'],
  ['twitter:title', SEO_OG_TITLE],
  ['twitter:description', SEO_DESCRIPTION],
  ['twitter:image', SEO_SOCIAL_IMAGE],
  ['theme-color', '#040817'],
];

export const SEO_PROPERTY_META: Array<[string, string]> = [
  ['og:site_name', 'VicharakAI'],
  ['og:title', SEO_OG_TITLE],
  ['og:description', SEO_DESCRIPTION],
  ['og:url', SEO_CANONICAL_URL],
  ['og:type', 'website'],
  ['og:image', SEO_SOCIAL_IMAGE],
];

// ---------------------------------------------------------------------------
// Google Sign-In via Google Identity Services (https://accounts.google.com/gsi/client).
// Only the OAuth *Client ID* belongs in the browser — the Google OAuth client
// secret is stored as a platform secret server-side and is never needed for
// the GSI ID-token flow used here.
// ---------------------------------------------------------------------------
// Real Client ID from the founder’s Google Cloud Console. Only the Client ID
// belongs in the browser — the matching client secret lives server-side as
// the workspace secret GOOGLE_OAUTH_CLIENT_SECRET and is never needed by the
// GSI ID-token flow used here.
export const GOOGLE_CLIENT_ID = '727932908971-l7kioqg123iejs01sgppnt3jtdbeoek5.apps.googleusercontent.com';
export const GOOGLE_CLIENT_ID_IS_PLACEHOLDER = GOOGLE_CLIENT_ID.indexOf('YOUR_GOOGLE_CLIENT_ID') !== -1;
// Google sign-in is authorized on this origin (per the founder’s Google Cloud
// Console: https://www.vicharakai.com). Other vicharakai.com hosts (the bare
// apex and the legacy app subdomain) hand off here before GSI opens.
export const GOOGLE_AUTHORIZED_HOST = 'www.vicharakai.com';
// Canonical-host guard (root cause of Google’s "origin mismatch" error): GSI
// must never be initialized while the page is on a non-canonical host — e.g.
// the bare apex vicharakai.com in the moment before the www redirect fires.
// Initializing GSI there fires it against that interim origin, which Google
// rejects. Every gsi.initialize()/gsi.renderButton() path checks this first,
// so GSI only ever runs once the page has settled on www.vicharakai.com
// (localhost stays allowed for local development).
export const CANONICAL_HOST = GOOGLE_AUTHORIZED_HOST;
export function isGsiAllowedOnThisHost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === CANONICAL_HOST || hostname === 'localhost';
}

export let gsiScriptPromise: Promise<void> | null = null;

export function loadGsiScript(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
    return Promise.resolve();
  }
  if (gsiScriptPromise) return gsiScriptPromise;
  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('Failed to load the Google Sign-In script'));
    };
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

export interface GoogleJwtProfile {
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

// Decodes the payload of Google’s ID token (a JWT) to read email + name. The
// signature is not re-verified client-side — Google issued the token moments
// earlier over HTTPS, and the server-side register call is what actually
// establishes the session.
export function decodeGoogleCredential(credential: string): GoogleJwtProfile | null {
  try {
    const payload = credential.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const data = JSON.parse(json) as Record<string, unknown>;
    return {
      email: typeof data.email === 'string' ? data.email : undefined,
      firstName: typeof data.given_name === 'string' ? data.given_name : undefined,
      lastName: typeof data.family_name === 'string' ? data.family_name : undefined,
      fullName: typeof data.name === 'string' ? data.name : undefined,
    };
  } catch {
    return null;
  }
}

export function upsertHeadTag(selector: string, create: () => HTMLElement): HTMLElement {
  const existing = document.head.querySelector(selector) as HTMLElement | null;
  if (existing) return existing;
  const created = create();
  document.head.appendChild(created);
  return created;
}

export function applyLandingSeoTags() {
  if (typeof document === 'undefined') return;

  document.title = SEO_TITLE;

  SEO_NAMED_META.forEach(([name, content]) => {
    const tag = upsertHeadTag(`meta[name="${name}"]`, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', name);
      return meta;
    });
    tag.setAttribute('content', content);
  });

  SEO_PROPERTY_META.forEach(([property, content]) => {
    const tag = upsertHeadTag(`meta[property="${property}"]`, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', property);
      return meta;
    });
    tag.setAttribute('content', content);
  });

  const canonical = upsertHeadTag('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    return link;
  });
  canonical.setAttribute('href', SEO_CANONICAL_URL);
}

// ---------------------------------------------------------------------------
// PRICING IS GEO-BRANCHED (2026-09-01). The signed-out landing page renders
// one of two content branches, decided once on mount by resolveGeoBranch()
// further down this file:
//
//   branch 'IN'     → Monthly ₹149 / 30 days, charged in rupees through
//                     Razorpay without leaving the page.
//   branch 'GLOBAL' → Monthly $14.99 / month, charged through a Creem payment
//                     link (the creem-webhook server function grants the
//                     entitlement from Creem's own event).
//
// The ₹10/$1 DAY TIER IS GONE (2026-09-27) — deleted from these tables, not
// just hidden, so no code path can price or order one. The FREE trial (its
// length is TRIAL_DURATION_DAYS in apps/VicharakAI/access.ts — 7 days since
// 2026-09-27) is the only "try it first", and the in-app Premium screen sells
// the same single plan on the same two rails. The yearly tier is retired too
// — never reintroduce either one here.
// ---------------------------------------------------------------------------
/* The PUBLIC Razorpay key id is NOT hardcoded here — the create-razorpay-order
 * hook returns it as `key_id` alongside the order, so the checkout modal always
 * opens with the key matching the account the order was created on. The key
 * SECRET lives only in the server hooks. */
export const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
/** Numeric plan amounts — the ONE place a price figure lives on this page.
 * Display prices, Razorpay paise, the day-rate monthly equivalent and the
 * monthly savings badge are all derived from these. Must agree with
 * apps/VicharakAI/access.ts PAID_PLANS (and, for USD, with what the Creem
 * links below actually charge). */
export const PLAN_AMOUNT_INR = { monthly: 149 } as const;
/** International plan amount (USD). This figure is also what the landing
 * page's GLOBAL pricing card prints, so the Creem product behind
 * CREEM_PAYMENT_LINK.monthly MUST be priced at the same number — change one
 * and you have to change the other. */
export const PLAN_AMOUNT_USD = { monthly: 14.99 } as const;
/** Razorpay amounts in paise — must match the create-razorpay-order hook. */
export const RAZORPAY_PLAN_PAISE = {
  monthly: PLAN_AMOUNT_INR.monthly * 100,
} as const;
/** India display prices — derived from PLAN_AMOUNT_INR above. */
export const PLAN_PRICE_INR = { monthly: `₹${PLAN_AMOUNT_INR.monthly}` } as const;
/** International display prices — derived from PLAN_AMOUNT_USD above. */
export const PLAN_PRICE_USD = { monthly: `$${PLAN_AMOUNT_USD.monthly}` } as const;
/** The Creem payment link behind the GLOBAL branch's pricing card (the same
 * product as apps/VicharakAI/creemConfig.ts). Creem hosts the checkout, so
 * the visitor leaves the page for it — see creemCheckoutUrl below. */
export const CREEM_PAYMENT_LINK = {
  monthly: 'https://www.creem.io/payment/prod_1slDIFvd9buIA1VPRjKfN8',
} as const;

/**
 * The Creem checkout URL for a plan, carrying metadata[app_email] and
 * metadata[plan]. Creem echoes metadata back in every webhook event, which is
 * how the creem-webhook server function attaches the entitlement to the right
 * account even when the customer pays with a different email at checkout.
 * `email` may be empty — the webhook then falls back to the Creem customer
 * email.
 */
export function creemCheckoutUrl(plan: PaidPlanId, email: string): string {
  const link = CREEM_PAYMENT_LINK[plan];
  const params = new URLSearchParams();
  const normalized = email.trim().toLowerCase();
  if (normalized) params.set('metadata[app_email]', normalized);
  params.set('metadata[plan]', plan);
  return `${link}${link.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** Session cache for the IP lookup — shared with the app’s useRegion hook. */
export const GEO_COUNTRY_CACHE_KEY = 'geo_country';
/** The lookup now goes through our own server, so it needs room for the
 * round trip plus the provider call — still short enough that pricing paints
 * from the timezone fallback long before this fires. */
export const GEO_LOOKUP_TIMEOUT_MS = 4000;

/** One plan, everywhere. The day pass was deleted on 2026-09-27. */
export type PaidPlanId = 'monthly';

// ---------------------------------------------------------------------------
// GEO BRANCH — which of the landing page’s two content experiences a visitor
// gets. 'IN' is the Indian branch (Indian exam copy, ₹ pricing, Razorpay);
// 'GLOBAL' is the international branch (MCAT/GRE/GMAT/LSAT copy, $ pricing,
// Creem). Resolved ONCE per session by resolveGeoBranch() below and cached in
// sessionStorage, so it never re-fires on a re-render or a re-mount.
// ---------------------------------------------------------------------------
export type GeoBranch = 'IN' | 'GLOBAL';
/** Session cache for the resolved branch. */
export const GEO_BRANCH_CACHE_KEY = 'geo_branch';
/** The free, key-less geo-IP endpoint the branch is resolved from. */
export const IPAPI_URL = 'https://ipapi.co/json/';
/** Short enough that a slow or blocked lookup never holds the page: the
 * timezone fallback has already painted, and the branch simply corrects
 * itself if the answer arrives. */
export const IPAPI_TIMEOUT_MS = 3500;

/** An AbortSignal that fires after `ms`, or undefined where unsupported. */
function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

/** The branch resolved earlier this session, or null. */
export function readCachedGeoBranch(): GeoBranch | null {
  try {
    const raw = (sessionStorage.getItem(GEO_BRANCH_CACHE_KEY) || '').trim().toUpperCase();
    if (raw === 'IN' || raw === 'GLOBAL') return raw;
    if (raw) sessionStorage.removeItem(GEO_BRANCH_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

/** Remember the branch (and the country code it came from) for this session. */
export function cacheGeoBranch(branch: GeoBranch, countryCode?: string): void {
  try {
    sessionStorage.setItem(GEO_BRANCH_CACHE_KEY, branch);
  } catch {
    /* storage unavailable — the lookup simply runs again next mount */
  }
  if (countryCode && /^[A-Z]{2}$/.test(countryCode)) {
    try {
      sessionStorage.setItem(GEO_COUNTRY_CACHE_KEY, countryCode);
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * The visitor’s country straight from ipapi.co (free, no key). Returns '' on
 * any failure — a timeout, a rate-limit answer, a CORS refusal or an
 * unreadable payload all fall through to the server-side lookup below. Never
 * throws and never rejects.
 */
export async function fetchIpApiCountry(): Promise<string> {
  try {
    const signal = timeoutSignal(IPAPI_TIMEOUT_MS);
    const response = await fetch(IPAPI_URL, signal ? { signal } : undefined);
    if (!response.ok) return '';
    const data = (await response.json()) as { country_code?: unknown; country?: unknown; error?: unknown };
    if (data.error) return '';
    const raw = data.country_code ?? data.country;
    const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    return /^[A-Z]{2}$/.test(code) ? code : '';
  } catch {
    return '';
  }
}

/** A country code cached earlier this session, or null. Anything that is not a
 * two-letter code is a leftover from an older build and is thrown away. */
export function readCachedGeoCountry(): string | null {
  try {
    const raw = (sessionStorage.getItem(GEO_COUNTRY_CACHE_KEY) || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(raw)) {
      if (raw) sessionStorage.removeItem(GEO_COUNTRY_CACHE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** The visitor’s country, resolved by the workspace’s own `geo` server
 * function, which performs the same ipapi.co lookup SERVER-SIDE. This is the
 * SECOND step of resolveGeoBranch: the browser call above is tried first, and
 * this is what covers it being rate-limited, refused by CORS or blocked by an
 * extension — which is exactly what used to leave every visitor on the
 * fallback. Returns '' on any failure — a timeout, a server error or an
 * unreadable payload all fall through to the timezone fallback below. Never
 * throws and never rejects. */
export async function fetchGeoCountry(spaceId: string): Promise<string> {
  if (!spaceId) return '';
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(GEO_LOOKUP_TIMEOUT_MS)
        : undefined;
    const response = await fetch(`/api/hooks/execute/${spaceId}/geo`, signal ? { signal } : undefined);
    if (!response.ok) return '';
    const data = (await response.json()) as { country?: unknown; data?: { country?: unknown } };
    // The hook runner may wrap the payload under `data` alongside its `_meta`.
    const raw = data.country ?? data.data?.country;
    const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    return /^[A-Z]{2}$/.test(code) ? code : '';
  } catch {
    return '';
  }
}

/** The device timezone string, or null when it cannot be read. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return null;
  }
}

/** True only when the device clock CLEARLY names India — Asia/Kolkata,
 * Asia/Calcutta or a literal IST. This is the DECISIVE tiebreaker over the IP
 * lookup: a VPN or a wrong country code cached in an earlier session can make
 * geoCountry say anything, but an IST clock means an Indian student, so INR
 * wins. An unreadable timezone is NOT clearly India — it returns false here. */
export function isClearlyIndiaTimezone(): boolean {
  const tz = deviceTimeZone();
  return tz !== null && (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta') || tz === 'IST');
}

/** The visitor’s clock standing in for the IP lookup: an IST timezone means
 * India. Used before the lookup resolves and whenever it fails, so a blocked
 * request never leaves an international visitor on the rupee/Razorpay lineup.
 * Unlike isClearlyIndiaTimezone, an UNREADABLE timezone falls back to India
 * here — with no IP result and no clock, the primary market wins. */
export function isIndiaTimezone(): boolean {
  const tz = deviceTimeZone();
  if (tz === null) return true;
  return tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta') || tz === 'IST';
}

/** The branch a country code belongs to: only 'IN' is the Indian experience. */
export function branchForCountry(countryCode: string): GeoBranch {
  return countryCode.trim().toUpperCase() === 'IN' ? 'IN' : 'GLOBAL';
}

/** The branch the device clock implies — the last-resort fallback when no IP
 * answer can be had at all. An IST clock (or an unreadable one, where the
 * primary market wins) means the Indian branch. */
export function timezoneGeoBranch(): GeoBranch {
  return isIndiaTimezone() ? 'IN' : 'GLOBAL';
}

/**
 * Resolve which content branch this visitor gets, in strict order:
 *
 *   1. the branch already cached in sessionStorage (so it resolves ONCE);
 *   2. ipapi.co’s country_code, fetched straight from the browser;
 *   3. the workspace’s own `geo` server function, which performs the same
 *      lookup server-side — the safety net for the browser call being
 *      rate-limited or refused by CORS;
 *   4. the device timezone.
 *
 * Always resolves, never throws, and caches whatever it decides.
 */
export async function resolveGeoBranch(spaceId: string): Promise<GeoBranch> {
  const cached = readCachedGeoBranch();
  if (cached) return cached;

  const ipApiCountry = await fetchIpApiCountry();
  if (ipApiCountry) {
    const branch = branchForCountry(ipApiCountry);
    cacheGeoBranch(branch, ipApiCountry);
    return branch;
  }

  const serverCountry = await fetchGeoCountry(spaceId);
  if (serverCountry) {
    const branch = branchForCountry(serverCountry);
    cacheGeoBranch(branch, serverCountry);
    return branch;
  }

  const fallback = timezoneGeoBranch();
  cacheGeoBranch(fallback);
  return fallback;
}

/** Load Razorpay’s checkout.js on demand — only when a paid CTA is tapped. */
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
