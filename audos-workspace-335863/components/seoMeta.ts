import { useEffect } from 'react';

/**
 * THE ONE PLACE A PUBLIC PAGE WRITES ITS <head>.
 *
 * The space is a client-rendered bundle: the host serves the same document for
 * every route and fills only the canonical + a path-derived title, so the
 * description, Open Graph tags and structured data of EVERY route would
 * otherwise stay on the homepage's values. That is what makes 300+ URLs look
 * like one page to a crawler.
 *
 * applyPageSeo writes the complete set for the route that is open: title,
 * description, robots, canonical, Open Graph, Twitter card and JSON-LD. Tags
 * are rewritten in place, never appended, so navigating inside the SPA can
 * not stack duplicates.
 *
 * TWO THINGS IT DELIBERATELY CLEARS. The landing page writes hreflang
 * alternates for its four regional routes (/in /us /uk /global); left behind
 * they would claim a JEE guide has a US variant. And the previous route's
 * page-level JSON-LD has to go before this route's is added. Both are tagged
 * (data-seo-page) so the site-wide Organization block injected by the
 * platform's head settings is never touched.
 */

export const SITE_ORIGIN = 'https://www.vicharakai.com';

export const SITE_IMAGE =
  'https://storage.googleapis.com/audos-images/chat-attachments/26649289-cffa-4dec-b6f1-3eb7da1ea96f.png';

/** The llms.txt pointer. Platform head settings refuse this rel value, so the
 *  shell writes it on every public route instead. */
const AI_INSTRUCTIONS_HREF = `${SITE_ORIGIN}/llms.txt`;

const MANAGED = 'data-seo-page';

export interface PageSeo {
  /** Unique per route. Never the homepage title. */
  title: string;
  /** Unique per route, aim for 150-160 characters. */
  description: string;
  /** Path only, with a leading slash — the origin is added here. */
  canonicalPath: string;
  /** Defaults to 'index, follow'. Only a not-found or auth-gated view should
   *  pass 'noindex, follow'. */
  robots?: string;
  /** 'website' (default) or 'article'. */
  ogType?: 'website' | 'article';
  image?: string;
  /** Page-level structured data. Replaced wholesale on every route change. */
  jsonLd?: Array<Record<string, unknown>>;
}

function upsert<T extends HTMLElement>(selector: string, create: () => T): T {
  const existing = document.head.querySelector(selector) as T | null;
  if (existing) return existing;
  const created = create();
  document.head.appendChild(created);
  return created;
}

function setNamedMeta(name: string, content: string): void {
  upsert(`meta[name="${name}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  }).setAttribute('content', content);
}

function setPropertyMeta(property: string, content: string): void {
  upsert(`meta[property="${property}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  }).setAttribute('content', content);
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function applyPageSeo(seo: PageSeo): void {
  if (typeof document === 'undefined') return;
  try {
    const url = absoluteUrl(seo.canonicalPath);
    const image = seo.image ?? SITE_IMAGE;

    document.title = seo.title;
    setNamedMeta('description', seo.description);
    setNamedMeta('robots', seo.robots ?? 'index, follow');
    setNamedMeta('twitter:card', 'summary_large_image');
    setNamedMeta('twitter:title', seo.title);
    setNamedMeta('twitter:description', seo.description);
    setNamedMeta('twitter:image', image);

    setPropertyMeta('og:site_name', 'VicharakAI');
    setPropertyMeta('og:type', seo.ogType ?? 'website');
    setPropertyMeta('og:title', seo.title);
    setPropertyMeta('og:description', seo.description);
    setPropertyMeta('og:url', url);
    setPropertyMeta('og:image', image);
    setPropertyMeta('og:locale', 'en_IN');

    upsert('link[rel="canonical"]', () => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      return link;
    }).setAttribute('href', url);

    upsert('link[rel="ai-instructions"]', () => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'ai-instructions');
      return link;
    }).setAttribute('href', AI_INSTRUCTIONS_HREF);

    // The landing page's regional alternates do not apply to any other route.
    document.head
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .forEach((node) => node.remove());

    document.head.querySelectorAll(`script[${MANAGED}]`).forEach((node) => node.remove());
    (seo.jsonLd ?? []).forEach((block) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(MANAGED, '1');
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    });
  } catch {
    /* head writing is best-effort — it must never blank a page */
  }
}

/** Remove only what applyPageSeo added that is route-specific. Leaves title,
 *  description and canonical alone: the next route overwrites them, and an
 *  empty gap between the two is worse than a stale value. */
export function clearPageJsonLd(): void {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll(`script[${MANAGED}]`).forEach((node) => node.remove());
}

export function usePageSeo(seo: PageSeo): void {
  const key = JSON.stringify(seo);
  useEffect(() => {
    applyPageSeo(JSON.parse(key) as PageSeo);
    return clearPageJsonLd;
  }, [key]);
}

/* ==========================================================================
 *  SCHEMA BUILDERS
 * ======================================================================== */

/** The product itself, described against one exam. Price facts mirror the
 *  live Razorpay plan (create-razorpay-order: 14900 paise = ₹149/month). */
export function softwareApplicationSchema(examLabel: string, pagePath: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'VicharakAI',
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Web',
    description: `AI study companion for ${examLabel} preparation in India. Builds a personalized revision plan using spaced repetition, identifies weak topics from test scores, and adapts daily to your progress.`,
    offers: {
      '@type': 'Offer',
      price: '149',
      priceCurrency: 'INR',
      priceValidUntil: '2027-12-31',
      description: '7-day free trial, then ₹149/month',
    },
    url: SITE_ORIGIN,
    mainEntityOfPage: absoluteUrl(pagePath),
    publisher: { '@type': 'Organization', name: 'VicharakAI', url: SITE_ORIGIN },
  };
}

export function breadcrumbSchema(trail: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: absoluteUrl(entry.path),
    })),
  };
}

export function faqSchema(entries: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
}

export function articleSchema(input: {
  headline: string;
  description: string;
  path: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.path) },
    image: input.image ?? SITE_IMAGE,
    author: { '@type': 'Organization', name: 'VicharakAI', url: SITE_ORIGIN },
    publisher: {
      '@type': 'Organization',
      name: 'VicharakAI',
      url: SITE_ORIGIN,
      logo: { '@type': 'ImageObject', url: SITE_IMAGE },
    },
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  };
}

export function itemListSchema(
  name: string,
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      url: absoluteUrl(entry.path),
    })),
  };
}
