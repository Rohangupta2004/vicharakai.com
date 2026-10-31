import { followSeoRedirect } from '../seoRedirects';

export type ExamRoute =
  | { kind: 'exam-index' }
  | { kind: 'exam-page'; slug: string }
  | { kind: 'exam-subject'; examSlug: string; subjectSlug: string };

function routeFromPath(raw: string): ExamRoute | null {
  const clean = raw.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === 'exam') return { kind: 'exam-index' };
  if (!clean.startsWith('exam/')) return null;
  const parts = clean.split('/');
  if (parts.length === 2 && parts[1]) return { kind: 'exam-page', slug: parts[1] };
  if (parts.length === 3 && parts[1] && parts[2]) {
    return { kind: 'exam-subject', examSlug: parts[1], subjectSlug: parts[2] };
  }
  return null;
}

export function readExamRouteFromLocation(): ExamRoute | null {
  if (typeof window === 'undefined') return null;
  // A retired exam guide URL moves to the closest kept page; the index renders meanwhile.
  if (followSeoRedirect() && routeFromPath(window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname)) {
    return { kind: 'exam-index' };
  }
  const hash = window.location.hash || '';
  return routeFromPath(hash ? hash.replace(/^#/, '') : window.location.pathname);
}

export function sameExamRoute(a: ExamRoute | null, b: ExamRoute | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const EXAM_INDEX_HREF = '/exam';
export const examHref = (slug: string) => `/exam/${slug}`;
export const examSubjectHref = (examSlug: string, subjectSlug: string) => `/exam/${examSlug}/${subjectSlug}`;
