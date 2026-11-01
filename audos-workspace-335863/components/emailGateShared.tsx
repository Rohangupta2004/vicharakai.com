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
  /** OTP-enabled registration returns this short-lived binding. It is not a
   * workspace session and must never be adopted by the app. */
  provisionalSessionToken?: string;
  /** Present only for legacy/no-OTP registration or older compatible hosts. */
  workspaceSessionId?: string | null;
  otpRequired?: boolean;
  legacyAuthorized?: boolean;
  identityMode?: string;
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

export type GateStep = 'loading' | 'email' | 'code' | 'retry' | 'complete';

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
export const SEO_TITLE = 'AI Study Companion for JEE Main, NEET UG & NEET PG | VicharakAI';
export const SEO_DESCRIPTION =
  'VicharakAI is an AI study companion and revision planner for JEE Main, NEET UG and NEET PG, with mock-test analysis, weak-topic tracking and a daily what-to-revise plan. 7-day trial, then ₹149/month.';
export const SEO_OG_TITLE = 'VicharakAI: AI Revision Planner for JEE Main, NEET UG & NEET PG';
export const SEO_SOCIAL_IMAGE =
  'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1792307215949-8x7kjg.png';

export const SEO_NAMED_META: Array<[string, string]> = [
  ['description', SEO_DESCRIPTION],
  [
    'keywords',
    'AI study companion India, revision planner for JEE and NEET, what to revise today, mock test analysis app, weak topic tracker, competitive exam study planner',
  ],
  ['robots', 'index, follow'],
  ['twitter:card', 'summary_large_image'],
  ['twitter:title', SEO_OG_TITLE],
  ['twitter:description', SEO_DESCRIPTION],
  ['twitter:image', SEO_SOCIAL_IMAGE],
  ['theme-color', '#0057FF'],
];

export const SEO_PROPERTY_META: Array<[string, string]> = [
  ['og:site_name', 'VicharakAI'],
  ['og:title', SEO_OG_TITLE],
  ['og:description', SEO_DESCRIPTION],
  ['og:url', `${SEO_CANONICAL_URL}/`],
  ['og:type', 'website'],
  ['og:image', SEO_SOCIAL_IMAGE],
];

// Google sign-in is handled only by the platform's
// /api/auth/social/google route. The browser never decodes or trusts an ID
// token and never creates a verified session from client-controlled claims.

export function upsertHeadTag(selector: string, create: () => HTMLElement): HTMLElement {
  const matches = Array.from(document.head.querySelectorAll(selector)) as HTMLElement[];
  const existing = matches.shift();
  matches.forEach((node) => node.remove());
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
  canonical.setAttribute('href', `${SEO_CANONICAL_URL}/`);
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
/** Razorpay amounts in paise — must match the create-razorpay-order hook. */
export const RAZORPAY_PLAN_PAISE = {
  monthly: PLAN_AMOUNT_INR.monthly * 100,
} as const;
/** India display prices — derived from PLAN_AMOUNT_INR above. */
export const PLAN_PRICE_INR = { monthly: `₹${PLAN_AMOUNT_INR.monthly}` } as const;
/** One India-only plan: ₹149/month through Razorpay. */
export type PaidPlanId = 'monthly';

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
