export type StaticPageKey = 'about' | 'terms' | 'privacy' | 'refund' | 'contact';

const PAGE_KEYS: StaticPageKey[] = ['about', 'terms', 'privacy', 'refund', 'contact'];

// Hash routes work on every host; verified custom-domain rewrites can also
// serve the same public entry at a real pathname. A present hash wins so #/
// always means the landing page even when history started on /terms.
export function readStaticPageFromLocation(): StaticPageKey | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash || '';
  if (rawHash) {
    const hash = rawHash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
    return (PAGE_KEYS as string[]).includes(hash) ? (hash as StaticPageKey) : null;
  }
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return (PAGE_KEYS as string[]).includes(path) ? (path as StaticPageKey) : null;
}
