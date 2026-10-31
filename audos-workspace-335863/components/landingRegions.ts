import {
  SEO_CANONICAL_URL,
  SEO_DESCRIPTION,
  SEO_OG_TITLE,
  SEO_SOCIAL_IMAGE,
  SEO_TITLE,
  upsertHeadTag,
} from './emailGateShared';

/** VicharakAI currently serves one India-focused English landing experience. */
export type RegionKey = 'in';

export interface RegionConfig {
  key: RegionKey;
  path: string;
  hash: string;
  label: string;
  shortLabel: string;
  seo: {
    title: string;
    description: string;
    keywords: string;
    ogDescription: string;
    hreflang: string;
  };
}

const INDIA: RegionConfig = {
  key: 'in',
  path: '/in',
  hash: '#/in',
  label: 'India',
  shortLabel: 'India',
  seo: {
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    keywords: 'AI study companion India, revision planner for JEE and NEET, what to revise today, mock test analysis app, weak topic tracker, competitive exam study planner',
    ogDescription: SEO_DESCRIPTION,
    hreflang: 'en-IN',
  },
};

export const LANDING_REGIONS: Record<RegionKey, RegionConfig> = { in: INDIA };
export const REGION_ORDER: RegionKey[] = ['in'];
export const DEFAULT_REGION: RegionKey = 'in';
export const REGION_PREFERENCE_KEY = 'vicharakai_region';

export function landingRegion(_key?: RegionKey | null): RegionConfig {
  return INDIA;
}

/** Legacy regional URLs intentionally resolve to the India page. */
export function readLandingRegionFromLocation(): RegionKey | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash
    ? window.location.hash.replace(/^#\/?/, '')
    : window.location.pathname.replace(/^\/+|\/+$/g, '');
  return ['in', 'us', 'uk', 'global'].includes(raw.toLowerCase()) ? 'in' : null;
}

export function readRegionPreference(): RegionKey | null {
  return 'in';
}

export function saveRegionPreference(_key: RegionKey): void {
  try { localStorage.setItem(REGION_PREFERENCE_KEY, 'in'); } catch {}
}

export function initialLandingRegion(): RegionKey {
  return 'in';
}

export async function resolveLandingRegion(_spaceId: string): Promise<RegionKey> {
  return 'in';
}

export async function resolveLandingRegionWithTimeout(_spaceId: string): Promise<RegionKey> {
  return 'in';
}

function setNamedMeta(name: string, content: string): void {
  const tag = upsertHeadTag(`meta[name="${name}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  });
  tag.setAttribute('content', content);
}

function setPropertyMeta(property: string, content: string): void {
  const tag = upsertHeadTag(`meta[property="${property}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  });
  tag.setAttribute('content', content);
}

export function applyRegionSeoTags(_region: RegionConfig, _explicit: boolean): void {
  if (typeof document === 'undefined') return;
  // The India-only experience may use #/in as client state, but fragments are
  // never separate indexable pages. Canonical and sitemap therefore agree on /.
  const canonicalUrl = `${SEO_CANONICAL_URL}/`;
  document.title = SEO_TITLE;
  setNamedMeta('description', SEO_DESCRIPTION);
  setNamedMeta('keywords', INDIA.seo.keywords);
  setNamedMeta('robots', 'index, follow');
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', SEO_OG_TITLE);
  setNamedMeta('twitter:description', SEO_DESCRIPTION);
  setNamedMeta('twitter:image', SEO_SOCIAL_IMAGE);
  setNamedMeta('theme-color', '#040817');
  setPropertyMeta('og:site_name', 'VicharakAI');
  setPropertyMeta('og:title', SEO_OG_TITLE);
  setPropertyMeta('og:description', SEO_DESCRIPTION);
  setPropertyMeta('og:url', canonicalUrl);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:image', SEO_SOCIAL_IMAGE);
  setPropertyMeta('og:locale', 'en_IN');
  const canonical = upsertHeadTag('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    return link;
  });
  canonical.setAttribute('href', canonicalUrl);
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove());
  const aiInstructions = upsertHeadTag('link[rel="ai-instructions"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'ai-instructions');
    return link;
  });
  aiInstructions.setAttribute('href', `${SEO_CANONICAL_URL}/llms.txt`);
}
