export const EXAM_SEO_PATHS = new Set([
  '/jee', '/neet', '/neet-pg', '/upsc', '/cat', '/clat', '/ssc', '/rrb',
  '/inicet', '/mpsc', '/banking', '/defence', '/teaching',
]);

export type SeoPublicRoute =
  | { kind: 'exam'; path: string }
  | { kind: 'prep-index' }
  | { kind: 'prep-article'; slug: string };

function routeFromPath(raw: string): SeoPublicRoute | null {
  const path = `/${raw.replace(/^\/+|\/+$/g, '').toLowerCase()}`;
  if (EXAM_SEO_PATHS.has(path)) return { kind: 'exam', path };
  if (path === '/prep') return { kind: 'prep-index' };
  const slug = path.startsWith('/prep-')
    ? path.slice('/prep-'.length)
    : path.startsWith('/prep/')
      ? path.slice('/prep/'.length)
      : '';
  if (!slug) return null;
  if (!slug || slug.includes('/') || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(slug)) return null;
  return { kind: 'prep-article', slug };
}

export function readSeoPublicRouteFromLocation(): SeoPublicRoute | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  return routeFromPath(hash ? hash.replace(/^#/, '') : window.location.pathname);
}

export function sameSeoPublicRoute(a: SeoPublicRoute | null, b: SeoPublicRoute | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
