/**
 * THE /learn ROUTES.
 *
 * The space has no server-side router. The platform serves the landing bundle
 * at the domain root, and the custom-domain host additionally rewrites a few
 * real paths (/terms, /privacy …) onto the same bundle without redirecting.
 * So every public route in this codebase resolves the SAME way: read the hash
 * first and, when one is present, let it win outright; otherwise fall back to
 * the real pathname, which is what makes a direct load of a rewritten URL
 * work. See readStaticPageFromLocation in components/StaticPages.tsx — this
 * is deliberately the same shape, one segment deeper.
 *
 * Recognised forms:
 *   #/learn            /learn            → the index
 *   #/learn/<slug>     /learn/<slug>     → that article
 *
 * IN-PAGE LINKS USE THE HASH FORM (learnHref / learnArticleHref below).
 * A hash link needs no host rewrite, so it survives on audos.com and on the
 * custom domain alike, and it navigates through `hashchange` without a full
 * page load — which is what makes this behave like a client-side router.
 *
 * An UNKNOWN slug still resolves to an article route rather than to null. The
 * article view then renders its own “no such article” state, which is far
 * better than silently dropping the visitor back onto the landing page (where
 * the root geo-redirect would immediately send them somewhere else again).
 */

export type LearnRoute = { kind: 'index' } | { kind: 'article'; slug: string };

const LEARN_SEGMENT = 'learn';

/** `learn`, `learn/spaced-repetition` → a route; anything else → null. */
function routeFromPath(raw: string): LearnRoute | null {
  const clean = raw.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === LEARN_SEGMENT) return { kind: 'index' };
  if (!clean.startsWith(`${LEARN_SEGMENT}/`)) return null;
  const slug = clean.slice(LEARN_SEGMENT.length + 1);
  // Only ever one segment deep — /learn/a/b is not a route.
  if (!slug || slug.includes('/')) return null;
  return { kind: 'article', slug };
}

export function readLearnRouteFromLocation(): LearnRoute | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash || '';
  if (rawHash) return routeFromPath(rawHash.replace(/^#/, ''));
  return routeFromPath(window.location.pathname);
}

/** True when two resolved routes point at the same page. Lets the controller
 *  hold the route in state without re-rendering on every unrelated hash
 *  change. */
export function sameLearnRoute(a: LearnRoute | null, b: LearnRoute | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'article' && b.kind === 'article' ? a.slug === b.slug : true;
}

/** The article index. */
export const LEARN_HREF = `/${LEARN_SEGMENT}`;

/** A single article. */
export function learnArticleHref(slug: string): string {
  return `/${LEARN_SEGMENT}/${slug}`;
}

/** The landing page. The bare root resolves the visitor's own region (their
 *  saved switcher choice, else geo), so this is “home” on every market. */
export const LANDING_HREF = '#/';
