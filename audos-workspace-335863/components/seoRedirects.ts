/**
 * REDIRECTS FOR RETIRED SEO URLS.
 *
 * The SEO surface covers exactly three exams: JEE Main, NEET UG and NEET PG.
 * Every URL that used to exist for another exam is mapped here to the closest
 * page that still exists, so an old link, a bookmark or a stale search result
 * lands on a real page instead of a not-found view.
 *
 * The host serves this bundle with HTTP 200 for every path and has no
 * server-side redirect table that workspace files can write to, so these are
 * client-side `location.replace` redirects (no history entry is left behind).
 */

export const KEPT_EXAM_PLANNER_PATHS = ['/jee', '/neet', '/neet-pg'] as const;
export const KEPT_EXAM_GUIDE_SLUGS = ['jee', 'neet', 'neet-pg'] as const;

const PLANNER_REDIRECTS: Record<string, string> = {
  '/inicet': '/neet-pg',
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

/** The kept page a retired path should move to, or null when the path is not retired. */
export function seoRedirectFor(rawPath: string): string | null {
  const clean = rawPath.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!clean) return null;
  const [first, second, third] = clean.split('/');
  if (!second) return PLANNER_REDIRECTS[`/${first}`] ?? null;
  if (first === 'exam') return EXAM_GUIDE_REDIRECTS[second] ?? null;
  if (first === 'learn' && !third) return LEARN_REDIRECTS[second] ?? null;
  if (first === 'study-methods' && !third) return STUDY_METHOD_REDIRECTS[second] ?? null;
  return null;
}

/** Navigates away from a retired URL. Returns true when a redirect was started. */
export function followSeoRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/^#/, '');
  const raw = hash.startsWith('/') ? hash : window.location.pathname;
  const target = seoRedirectFor(raw);
  if (!target) return false;
  try {
    window.location.replace(target);
  } catch {
    /* navigation refused: the page underneath still renders a link to the target */
  }
  return true;
}
