/**
 * CANONICAL URL NORMALISATION FOR THE PUBLIC SEO SURFACE.
 *
 * The indexable surface covers exactly JEE Main, NEET UG and NEET PG. This
 * module gives every retired regional/exam URL, legacy prep alias, hash route
 * and trailing-slash duplicate one destination. `location.replace` leaves no
 * history entry, while the destination page writes a self-referencing
 * canonical through seoMeta.ts.
 *
 * The workspace host serves the client bundle with HTTP 200 before JavaScript
 * runs and exposes no workspace-level HTTP redirect table. These redirects are
 * therefore client-side; real 301s for path aliases must be configured by the
 * hosting layer. Protocol and non-www variants are already 301-normalised by
 * the custom-domain host.
 */

export const KEPT_EXAM_PLANNER_PATHS = ['/jee', '/neet', '/neet-pg'] as const;
export const KEPT_EXAM_GUIDE_SLUGS = ['jee', 'neet', 'neet-pg'] as const;

const LEGACY_REGION_REDIRECTS: Record<string, string> = {
  '/in': '/',
  '/us': '/',
  '/uk': '/',
  '/global': '/',
};

const PLANNER_REDIRECTS: Record<string, string> = {
  '/inicet': '/neet-pg',
  '/gate': '/prep',
  '/upsc': '/prep',
  '/cat': '/prep',
  '/clat': '/prep',
  '/ssc': '/prep',
  '/rrb': '/prep',
  '/mpsc': '/prep',
  '/banking': '/prep',
  '/defence': '/prep',
  '/teaching': '/prep',
};

const EXAM_GUIDE_REDIRECTS: Record<string, string> = {
  inicet: '/exam/neet-pg',
  gate: '/exam',
  upsc: '/exam',
  cat: '/exam',
  clat: '/exam',
  ssc: '/exam',
  rrb: '/exam',
  mpsc: '/exam',
  banking: '/exam',
  defence: '/exam',
  teaching: '/exam',
};

const LEARN_REDIRECTS: Record<string, string> = {
  'jee-advanced-strategy': '/jee',
  'upsc-study-plan': '/learn',
  'how-to-study-for-upsc': '/learn',
  'upsc-gs-strategy': '/learn',
  'upsc-optional-strategy': '/learn',
  'cat-preparation': '/learn',
  'clat-preparation': '/learn',
  'ssc-cgl-strategy': '/learn',
  'ssc-cgl-preparation': '/learn',
};

const STUDY_METHOD_REDIRECTS: Record<string, string> = {
  'upsc-answer-writing-revision-plan': '/study-methods',
  'recover-after-bad-cat-mock': '/study-methods',
  'ssc-cgl-weekly-revision-timetable': '/study-methods',
};

const PREP_SLUG_REDIRECTS: Record<string, string> = {
  'beating-forgetting-curve-jee': 'beat-forgetting-jee',
  'beating-forgetting-curve-neet': 'beat-forgetting-neet',
};

const PUBLIC_TOP_LEVELS = new Set([
  'jee', 'neet', 'neet-pg', 'prep', 'study-methods', 'exam', 'compare', 'learn',
  'about', 'terms', 'privacy', 'refund', 'contact', 'sitemap',
]);

function cleanPath(rawPath: string): string {
  const clean = rawPath.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  return clean ? `/${clean}` : '/';
}

function isPublicPath(rawPath: string): boolean {
  const clean = cleanPath(rawPath).slice(1);
  if (!clean) return true;
  const [first] = clean.split('/');
  return PUBLIC_TOP_LEVELS.has(first) || first.startsWith('prep-');
}

/** The kept page a retired or legacy path should move to, or null. */
export function seoRedirectFor(rawPath: string): string | null {
  const path = cleanPath(rawPath);
  const regional = LEGACY_REGION_REDIRECTS[path];
  if (regional) return regional;
  const clean = path.slice(1);
  if (!clean) return null;
  const [first, second, third] = clean.split('/');
  if (!second) {
    if (first.startsWith('prep-')) {
      const slug = first.slice('prep-'.length);
      return slug ? `/prep/${PREP_SLUG_REDIRECTS[slug] ?? slug}` : '/prep';
    }
    return PLANNER_REDIRECTS[`/${first}`] ?? null;
  }
  if (first === 'exam') return EXAM_GUIDE_REDIRECTS[second] ?? null;
  if (first === 'learn' && !third) return LEARN_REDIRECTS[second] ?? null;
  if (first === 'study-methods' && !third) return STUDY_METHOD_REDIRECTS[second] ?? null;
  if (first === 'prep' && !third && PREP_SLUG_REDIRECTS[second]) {
    return `/prep/${PREP_SLUG_REDIRECTS[second]}`;
  }
  return null;
}

let redirectingTo: string | null = null;

/** Navigates a duplicate or retired URL to its one canonical path. */
export function followSeoRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/^#/, '');
  const hashPath = hash.startsWith('/') && isPublicPath(hash) ? cleanPath(hash) : '';
  const pathname = window.location.pathname;
  const requested = hashPath || pathname;
  const retiredTarget = seoRedirectFor(requested);
  const hashTarget = !retiredTarget && hashPath ? hashPath : null;
  const slashTarget =
    !retiredTarget && !hashTarget && pathname !== '/' && /\/$/.test(pathname) && isPublicPath(pathname)
      ? cleanPath(pathname)
      : null;
  const target = retiredTarget ?? hashTarget ?? slashTarget;
  if (!target || redirectingTo === target) return Boolean(target);
  if (!hashPath && cleanPath(pathname) === target && !/\/$/.test(pathname)) return false;
  redirectingTo = target;
  try {
    window.location.replace(target);
  } catch {
    redirectingTo = null;
    /* navigation refused: the page underneath still renders a link to the target */
  }
  return true;
}
