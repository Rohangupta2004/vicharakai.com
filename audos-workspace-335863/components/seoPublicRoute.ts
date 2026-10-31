import { KEPT_EXAM_PLANNER_PATHS, followSeoRedirect, seoRedirectFor } from './seoRedirects';

export const EXAM_SEO_PATHS = new Set<string>(KEPT_EXAM_PLANNER_PATHS);

export type SeoPublicRoute =
  | { kind: 'exam'; path: string }
  | { kind: 'prep-index' }
  | { kind: 'prep-article'; slug: string };

function routeFromPath(raw: string): SeoPublicRoute | null {
  const path = `/${raw.replace(/^\/+|\/+$/g, '').toLowerCase()}`;
  if (EXAM_SEO_PATHS.has(path)) return { kind: 'exam', path };
  // A retired exam planner keeps resolving to the exam view, which sends the
  // visitor to the closest kept page instead of dropping them on the landing page.
  if (path.split('/').length === 2 && seoRedirectFor(path)) return { kind: 'exam', path };
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
  followSeoRedirect();
  const hash = window.location.hash || '';
  return routeFromPath(hash ? hash.replace(/^#/, '') : window.location.pathname);
}

export function sameSeoPublicRoute(a: SeoPublicRoute | null, b: SeoPublicRoute | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
