/**
 * UTM-BASED EXAM MESSAGE MATCH (founder instruction, 2026-09-27).
 *
 * Meta ad campaigns append `?exam=jee|neet|neet-pg|upsc|…` to the landing URL.
 * The hero eyebrow, headline, subhead, CTA label and trust line then speak to
 * that exam alone, so the ad a student clicked and the page they land on say
 * the same thing. No server routing is involved: the param is read
 * client-side on mount (LandingPage.tsx), and an absent or unknown value
 * leaves the page exactly as it was — the change is purely additive.
 *
 * WHERE THE EXAM IS READ FROM, in order. `?exam=` is the form the ads are
 * meant to set, and it survives the bare-root geo redirect (location.replace
 * only rewrites the hash, so the query stays in the URL). But a Meta campaign
 * is often built without one, carrying the exam only inside its utm naming —
 * `?utm_campaign=neet-pg-sep-2026`. Those are read as a fallback, so an ad
 * launched without the explicit param still message-matches instead of
 * silently landing on the generic page. A query inside the hash route
 * (`#/in?exam=jee`) is read too, in case a link is ever written that way.
 */
import { PRIMARY_CTA } from './landingRegions';

export interface ExamMatch {
  /** The `?exam=` value this entry answers. */
  slug: string;
  /** The exam chip to light prominently — spelled as region.exams spells it. */
  chip: string;
  /** The small badge above the headline, e.g. “For NEET aspirants” — the
   *  fastest possible confirmation that this page is for the exam the ad was
   *  about, readable before a single word of the headline. */
  eyebrow: string;
  headline: string;
  sub: string;
  /** The CTA label — hero button AND the mobile sticky bar. */
  cta: string;
  /** The trust line under the hero CTA. */
  proof: string;
}

/** The CTA label every match shares — the SAME words the rest of the page
 *  uses, imported rather than retyped so a message-matched visitor and a
 *  default one are asked for exactly the same thing. */
const MATCH_CTA = PRIMARY_CTA;

/**
 * The message match for an exam whose pain is the SHARED one — the hours go
 * in daily and nothing tells you what is still there. The four campaigns the
 * founder actually runs (JEE, NEET, NEET PG, UPSC) carry hand-written copy
 * below because their narratives genuinely differ; everything else is built
 * from this so a new ad set never lands on the generic page for want of a
 * paragraph nobody wrote.
 */
function standardMatch(slug: string, chip: string, subject: string): ExamMatch {
  return {
    slug,
    chip,
    eyebrow: `For ${chip} aspirants`,
    headline: `You study for ${chip} every day. But what’s actually sticking?`,
    sub: `VicharakAI tracks every ${subject} you cover and tells you exactly what to revise today — before the next mock shows you the gap.`,
    cta: MATCH_CTA,
    proof: `Your full ${chip} syllabus is already loaded · plan ready in 2 minutes`,
  };
}

/**
 * ONE PAIN, FOUR EXAMS. Each headline states the ad's own narrative — the
 * hours are going in, but nothing tells you what is still there — in the
 * exam's own language, so the page reads as a continuation of the ad rather
 * than a different pitch. English throughout, matching the rest of the
 * product (the Hinglish variants shipped on 2026-09-27 were reverted here on
 * the same day the app-wide English-only rule was re-applied).
 */
const EXAM_MATCHES: Record<string, ExamMatch> = {
  jee: {
    slug: 'jee',
    chip: 'JEE',
    eyebrow: 'For JEE aspirants',
    headline: 'You study for JEE every day. But what’s actually sticking?',
    sub: 'VicharakAI tracks every chapter you cover and tells you exactly what to revise today — before the next mock shows you the gap.',
    cta: MATCH_CTA,
    proof: 'Your JEE syllabus is already loaded · plan ready in 2 minutes',
  },
  neet: {
    slug: 'neet',
    chip: 'NEET',
    eyebrow: 'For NEET aspirants',
    headline: 'You study for NEET every day. But what’s actually sticking?',
    sub: 'VicharakAI tracks every chapter you cover and tells you exactly what to revise today — before the next mock shows you the gap.',
    cta: MATCH_CTA,
    proof: 'Your full NEET syllabus is already loaded · plan ready in 2 minutes',
  },
  'neet-pg': {
    slug: 'neet-pg',
    chip: 'NEET PG',
    eyebrow: 'For NEET PG aspirants',
    headline: 'Duty all day, NEET PG prep at night. Is any of it staying?',
    sub: 'VicharakAI tracks what you actually get through and tells you exactly what to revise today — before the gap costs you a rank.',
    cta: MATCH_CTA,
    proof: 'Built for working NEET PG aspirants · plan ready in 2 minutes',
  },
  upsc: {
    slug: 'upsc',
    chip: 'UPSC',
    eyebrow: 'For UPSC aspirants',
    headline: 'You read six hours a day. What’s left from four months ago?',
    sub: 'VicharakAI remembers every topic you’ve covered and brings it back before it slips — not after prelims tells you.',
    cta: MATCH_CTA,
    proof: 'GS, optional and current affairs tracked together · plan ready in 2 minutes',
  },
  inicet: standardMatch('inicet', 'INICET', 'topic'),
  cat: standardMatch('cat', 'CAT', 'concept'),
  clat: standardMatch('clat', 'CLAT', 'subject'),
  ssc: standardMatch('ssc', 'SSC', 'topic'),
  mpsc: standardMatch('mpsc', 'MPSC', 'topic'),
  gate: standardMatch('gate', 'GATE', 'chapter'),
  boards: standardMatch('boards', 'Boards', 'chapter'),
};

/** An alias a campaign name is likely to spell without the hyphen. */
EXAM_MATCHES.neetpg = EXAM_MATCHES['neet-pg'];

/** Longest first, so `neet-pg-sep-2026` resolves to NEET PG and never to the
 *  NEET entry that is also a substring of it. */
const MATCH_KEYS = Object.keys(EXAM_MATCHES).sort((a, b) => b.length - a.length);

/**
 * The exam named anywhere inside a free-text campaign / ad-set / creative
 * name. Everything non-alphanumeric collapses to a single hyphen and the
 * comparison is made against hyphen-delimited segments, so `neet-pg-sep-2026`
 * and `NEET_PG | Sep 2026` both resolve, while `neetpg2` — which is not the
 * exam — does not accidentally match `neet`.
 */
function matchFromFreeText(value: string): ExamMatch | null {
  const haystack = `-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-`;
  for (const key of MATCH_KEYS) {
    if (haystack.includes(`-${key}-`)) return EXAM_MATCHES[key];
  }
  return null;
}

/** The utm fields a Meta campaign names its exam in when `?exam=` is absent,
 *  in the order they are worth trusting: the ad's own creative name is more
 *  specific than the ad set, which is more specific than the campaign. */
const UTM_FALLBACK_PARAMS = ['utm_content', 'utm_term', 'utm_campaign'] as const;

/**
 * The exam this visit is about, or null for the default page.
 *
 * `?exam=` wins wherever it appears — the real query string first (the form
 * the ads are meant to set), then a query inside the hash route. Failing
 * that, the utm fields are scanned for an exam name, so a campaign launched
 * without the explicit param still message-matches. An absent or unknown
 * value returns null and renders the page exactly as it was.
 */
export function readExamMatch(): ExamMatch | null {
  if (typeof window === 'undefined') return null;
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const q = hash.indexOf('?');
    const hashParams = q === -1 ? null : new URLSearchParams(hash.slice(q + 1));

    const explicit = search.get('exam') || hashParams?.get('exam') || '';
    if (explicit) {
      const direct = EXAM_MATCHES[explicit.trim().toLowerCase()];
      if (direct) return direct;
      // An ad that wrote `?exam=NEET PG 2026` still meant NEET PG.
      const loose = matchFromFreeText(explicit);
      if (loose) return loose;
    }

    for (const param of UTM_FALLBACK_PARAMS) {
      const value = search.get(param) || hashParams?.get(param) || '';
      if (!value) continue;
      const match = matchFromFreeText(value);
      if (match) return match;
    }

    return null;
  } catch {
    return null;
  }
}
