export type CompareRoute =
  | { kind: 'compare-index' }
  | { kind: 'compare-page'; slug: string };

function routeFromPath(raw: string): CompareRoute | null {
  const clean = raw.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === 'compare') return { kind: 'compare-index' };
  if (!clean.startsWith('compare/')) return null;
  const slug = clean.slice('compare/'.length);
  return slug && !slug.includes('/') ? { kind: 'compare-page', slug } : null;
}

export function readCompareRouteFromLocation(): CompareRoute | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  return routeFromPath(hash ? hash.replace(/^#/, '') : window.location.pathname);
}

export function sameCompareRoute(a: CompareRoute | null, b: CompareRoute | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const COMPARE_INDEX_HREF = '/compare';
export const compareHref = (slug: string) => `/compare/${slug}`;
