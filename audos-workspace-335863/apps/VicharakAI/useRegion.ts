/**
 * Region detection for region-specific exam routing and pricing.
 *
 * IP-BASED, VIA OUR OWN SERVER: the hook asks the workspace's `geo` server
 * function (/api/hooks/execute/<spaceId>/geo), which does the ipapi.co lookup
 * server-side and answers { country }. It must NOT call ipapi.co from the
 * browser — that request is blocked by CORS, failed silently, and left every
 * visitor (including Indian students, who should see ₹10/₹149 via Razorpay)
 * on whatever the locale fallback guessed. The call carries a 4s timeout so a
 * slow lookup can never stall the UI or delay pricing — a timeout resolves to
 * the locale fallback, and any doubt means India/INR. The result is cached for
 * 24 hours in localStorage under 'user_region_v2' (with the lookup time in
 * 'user_region_time'), mirrored into sessionStorage 'geo_country' (shared
 * with the landing page, components/EmailGate.tsx) and into the legacy
 * localStorage key `vicharakai_user_region` so older readers keep agreeing.
 * The obsolete pre-v2 key 'user_region' is cleared on load so returning
 * users are re-detected instead of trusting a stale locale-based guess.
 *
 * The fetch is fully wrapped — a network failure can never crash the app;
 * it falls back to the browser's own locale list (navigator.language /
 * navigator.languages), and any doubt resolves to India ('IN'), the product's
 * primary market. Stale cached values that aren't a two-letter country code
 * are cleared on load before the cache is trusted ('GLOBAL' is accepted as a
 * legacy alias meaning "not India").
 *
 * PRICING NOTE (updated 2026-09-27): this hook NO LONGER drives pricing.
 * Pricing follows the EXAM the student picked — see pricingRegion.ts
 * (Indian exam → ₹149/Razorpay, US/international exam → $14.99/Creem,
 * unknown → India). PaywallScreen, PremiumScreen, AccountSheet,
 * ProfileScreen, AppShell and OnboardingFlow all read that classifier; no
 * pricing surface imports this hook anymore. It is kept only for possible
 * region-specific CONTENT routing — do not reintroduce it into any pricing
 * decision.
 */
import { useEffect, useState } from 'react';

export const REGION_STORAGE_KEY = 'vicharakai_user_region';
/** Session cache for the IP-based country lookup — shared with EmailGate.tsx. */
export const GEO_COUNTRY_CACHE_KEY = 'geo_country';
/** 24h-TTL localStorage cache of the IP-detected region. */
export const REGION_V2_KEY = 'user_region_v2';
export const REGION_V2_TIME_KEY = 'user_region_time';
/** The obsolete pre-v2 cache key — cleared on load so old guesses never win. */
const LEGACY_REGION_KEY = 'user_region';
const REGION_CACHE_TTL_MS = 86_400_000; // 24 hours
const IP_LOOKUP_TIMEOUT_MS = 4_000;
const DEFAULT_REGION = 'IN';

/** This space's id, for building the `geo` server-function URL. */
function spaceIdForHooks(): string | null {
  try {
    const injectedSpaceId = (window as unknown as { __SPACE_ID__?: unknown }).__SPACE_ID__;
    if (typeof injectedSpaceId === 'string' && injectedSpaceId) return injectedSpaceId;
    const workspaceId = (window as unknown as { __WORKSPACE_ID__?: unknown }).__WORKSPACE_ID__;
    if (typeof workspaceId === 'string' && workspaceId) return workspaceId;
  } catch {
    /* no window globals — the locale fallback covers it */
  }
  return null;
}

/** The workspace's own geo endpoint — the server side of the IP lookup. */
export function geoEndpoint(): string | null {
  const spaceId = spaceIdForHooks();
  return spaceId ? `/api/hooks/execute/${spaceId}/geo` : null;
}

/** Languages spoken (almost) exclusively in India — a locale starting with
 * one of these counts as India even without an explicit region subtag. */
const INDIA_LANGUAGE_CODES = ['hi', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa', 'bn', 'ur', 'or'];

export interface RegionInfo {
  /** ISO 3166-1 alpha-2 country code, e.g. 'IN', 'US', 'GB'. */
  countryCode: string;
  isIndia: boolean;
}

/** Normalise a stored or detected value into a two-letter uppercase code, or null. */
function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = (value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Remove the obsolete 'user_region' cache the moment the app loads, so
 * returning users get re-detected by IP instead of an old locale guess. */
function clearLegacyRegionKey(): void {
  try {
    localStorage.removeItem(LEGACY_REGION_KEY);
  } catch {
    /* non-fatal */
  }
}

/** Read the 24h localStorage cache ('user_region_v2' + 'user_region_time').
 * Returns a country code, or 'GLOBAL' (legacy alias for "not India"), or
 * null when missing/expired/invalid — expired entries are removed. */
function readCachedRegionV2(): string | null {
  try {
    const cached = (localStorage.getItem(REGION_V2_KEY) || '').trim().toUpperCase();
    const cachedTime = Number.parseInt(localStorage.getItem(REGION_V2_TIME_KEY) || '', 10);
    if (!cached) return null;
    const fresh = Number.isFinite(cachedTime) && Date.now() - cachedTime < REGION_CACHE_TTL_MS;
    if (!fresh) {
      localStorage.removeItem(REGION_V2_KEY);
      localStorage.removeItem(REGION_V2_TIME_KEY);
      return null;
    }
    if (cached === 'GLOBAL') return 'GLOBAL';
    return normalizeCountryCode(cached);
  } catch {
    return null;
  }
}

/** Read the session-cached country code. Clears stale non-code values first —
 * older builds cached the literal string 'GLOBAL', which must never be
 * trusted as a country code. */
function readCachedGeoCountry(): string | null {
  try {
    const raw = (sessionStorage.getItem(GEO_COUNTRY_CACHE_KEY) || '').trim().toUpperCase();
    if (!raw) return null;
    if (!/^[A-Z]{2}$/.test(raw)) {
      sessionStorage.removeItem(GEO_COUNTRY_CACHE_KEY); // stale 'GLOBAL' etc.
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function readCachedRegion(): string | null {
  try {
    return normalizeCountryCode(localStorage.getItem(REGION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function cacheCountryCode(code: string): void {
  try {
    sessionStorage.setItem(GEO_COUNTRY_CACHE_KEY, code);
  } catch {
    /* non-fatal */
  }
  try {
    localStorage.setItem(REGION_STORAGE_KEY, code);
  } catch {
    /* non-fatal */
  }
  try {
    localStorage.setItem(REGION_V2_KEY, code);
    localStorage.setItem(REGION_V2_TIME_KEY, Date.now().toString());
  } catch {
    /* non-fatal */
  }
}

/** Every locale the browser reports, lowercased. Never throws. */
function browserLocales(): string[] {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    const langs =
      typeof navigator !== 'undefined' && Array.isArray(navigator.languages) ? navigator.languages : [];
    return [lang, ...langs].filter(Boolean).map((locale) => String(locale).toLowerCase());
  } catch {
    return [];
  }
}

/** The region subtag of a BCP-47 locale ('en-IN' → 'IN', 'zh-Hans-CN' → 'CN'), or null. */
function regionSubtagOf(locale: string): string | null {
  const match = locale.match(/^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2})(?:-|$)/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Locale-based FALLBACK — used for the first synchronous render and whenever
 * the ipapi.co IP lookup fails. India-specific languages and any *-IN locale
 * mean India; a clearly foreign region subtag (en-US, en-GB, …) names that
 * country; anything indeterminate defaults to India.
 */
export function detectCountryCode(): string {
  try {
    const locales = browserLocales();
    for (const locale of locales) {
      if (INDIA_LANGUAGE_CODES.some((code) => locale === code || locale.startsWith(`${code}-`))) {
        return DEFAULT_REGION;
      }
    }
    for (const locale of locales) {
      const region = regionSubtagOf(locale);
      if (region) return region;
    }
    // Default to India since most users are Indian exam students.
    return DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION; // default India on any surprise
  }
}

/** True when the fallback detection points at India — or nothing says otherwise. */
export function detectIsIndia(): boolean {
  try {
    return detectCountryCode() === DEFAULT_REGION;
  } catch {
    return true; // default India
  }
}

/**
 * IP-based lookup through the workspace's own `geo` server function, capped at
 * 4 seconds. The server does the ipapi.co call (the browser cannot — CORS) and
 * returns `{ country }`. Resolves to a two-letter country code, or '' when the
 * server could not determine one — it never throws and never rejects.
 */
async function fetchCountryCodeByIp(): Promise<string> {
  const endpoint = geoEndpoint();
  if (!endpoint) return '';
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(IP_LOOKUP_TIMEOUT_MS)
        : undefined;
    const res = await fetch(endpoint, signal ? { signal } : undefined);
    if (!res.ok) return '';
    const data = (await res.json()) as { country?: unknown; data?: { country?: unknown } };
    // The hook runner may wrap the payload under `data` alongside its `_meta`.
    return normalizeCountryCode(data.country ?? data.data?.country) || '';
  } catch {
    return '';
  }
}

/**
 * The visitor's region, resolved synchronously for first paint: the session
 * cache when one exists, then the 24h 'user_region_v2' cache, then the legacy
 * localStorage cache. The IP lookup in useRegion refines it moments later. A
 * cached legacy 'GLOBAL' resolves to a neutral non-India code ('US') purely
 * for pricing; the IP pass replaces it.
 *
 * WITH NOTHING CACHED THE FIRST PAINT IS INDIA, not the browser locale. A
 * huge share of Indian phones report en-US/en-GB, so the locale guess used to
 * paint $14.99 and a Creem checkout at an Indian student for the second or
 * two before the IP lookup landed — on the paywall, the Premium tab and the
 * onboarding price line, i.e. exactly the screens a paying user reads. The
 * documented rule for this hook has always been "any doubt means India/INR",
 * and this is the one place it was not applied. detectCountryCode() is still
 * the fallback INSIDE useRegion when the IP lookup itself fails.
 */
export function resolveRegion(): string {
  clearLegacyRegionKey();
  const sessionCached = readCachedGeoCountry();
  if (sessionCached) return sessionCached;
  const v2 = readCachedRegionV2();
  if (v2 === 'GLOBAL') return 'US';
  if (v2) return v2;
  return readCachedRegion() || DEFAULT_REGION;
}

export function useRegion(): RegionInfo {
  const [countryCode, setCountryCode] = useState<string>(() => resolveRegion());

  useEffect(() => {
    clearLegacyRegionKey();
    // Session cache hit (also clears stale 'GLOBAL' values) → nothing to do.
    if (readCachedGeoCountry()) return;
    // A fresh (<24h) IP-derived cache also counts — no second lookup needed.
    const v2 = readCachedRegionV2();
    if (v2 && v2 !== 'GLOBAL') {
      try {
        sessionStorage.setItem(GEO_COUNTRY_CACHE_KEY, v2);
      } catch {
        /* non-fatal */
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      const ipCode = await fetchCountryCodeByIp();
      const code = ipCode || detectCountryCode();
      cacheCountryCode(code);
      if (!cancelled) setCountryCode(code);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { countryCode, isIndia: countryCode === DEFAULT_REGION };
}
