/**
 * pricingRegion — WHICH PRICE (and which payment processor) a student sees,
 * decided by the EXAM THEY PICKED, not by their IP address or browser locale.
 *
 * The rule (founder decision, 2026-09-27):
 *  - An INDIAN exam (JEE, NEET, NEET PG, INICET, UPSC, MPSC, CAT, CLAT, SSC,
 *    RRB, banking, defence, teaching, …) → ₹149/month via Razorpay.
 *  - A US / INTERNATIONAL exam (MCAT, USMLE, GRE, GMAT, LSAT, SAT, ACT,
 *    A-Levels, UCAT, GAMSAT, …) → $14.99/month via Creem.
 *  - Exam unknown or not set yet → INDIA (₹149). Any doubt means India.
 *
 * Why exam and not geo: an Indian aspirant on a VPN or a foreign SIM must
 * never be quoted dollars, and a US student preparing for the MCAT must never
 * be quoted rupees Razorpay can't collect internationally. The exam is an
 * explicit, stored choice (zuno_profile.exam — or the onboarding draft before
 * the profile row lands), so every pricing surface reads the same signal.
 *
 * Resolution order:
 *  1. The planner catalogue (syllabus.ts getExam — includes examCatalog's
 *     worldwide list and the US per-subject exams): its `country` field wins.
 *  2. The structured syllabus database (data/syllabuses) — EXACT id matches
 *     only (its fuzzy resolver is fine for showing a syllabus, but too loose
 *     for a money decision: "CUSAT" must never substring-match "SAT").
 *  3. Keyword match on the exam id/label for typed exams the databases don't
 *     know (e.g. "custom:usmle-step-3").
 *  4. Default: India.
 *
 * useRegion.ts (IP-based geo) deliberately plays NO part here any more — it
 * remains only for possible region-specific CONTENT routing.
 */
import { getExam } from './syllabus';
import { getSyllabus } from './data/syllabuses';

/** Tokens that name an international exam even when no catalogue entry
 * matches — matched as WHOLE tokens of the slug, never substrings, so CAT
 * (India) can never collide with ACT, and CUSAT can never match SAT. */
const INTERNATIONAL_EXAM_TOKENS = new Set([
  'mcat', 'usmle', 'gre', 'gmat', 'lsat', 'sat', 'act', 'psat', 'dat', 'oat', 'pcat',
  'ucat', 'gamsat', 'bmat', 'lnat', 'nclex', 'comlex', 'toefl', 'ielts',
  'gcse', 'alevel', 'alevels', 'tmua', 'mdcat', 'gaokao', 'suneung', 'topik', 'usmles',
]);

/** Multi-word international markers checked against the whole slug. */
const INTERNATIONAL_EXAM_PHRASES = [
  'a-level', 'a-levels', 'ap-exam', 'ap-calculus', 'ap-physics', 'ap-chemistry', 'ap-biology',
  'international-baccalaureate', 'ib-diploma', 'usmle-step',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^custom:/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugLooksInternational(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const slug = slugify(String(raw));
  if (!slug) return false;
  for (const phrase of INTERNATIONAL_EXAM_PHRASES) {
    if (slug === phrase || slug.startsWith(`${phrase}-`) || slug.includes(`-${phrase}`)) return true;
  }
  return slug.split('-').some((token) => INTERNATIONAL_EXAM_TOKENS.has(token));
}

/**
 * True when the student's exam prices in INR through Razorpay; false when it
 * prices in USD through Creem. `examId` is `zuno_profile.exam` (or the
 * onboarding draft's exam id); `examLabel` is an optional display name that
 * helps classify typed exams whose slug alone is ambiguous.
 *
 * NO EXAM = INDIA. This is the documented default for every pricing surface.
 */
export function examPricingIsIndia(
  examId: string | null | undefined,
  examLabel?: string | null,
): boolean {
  const id = typeof examId === 'string' ? (examId ?? '').trim() : '';
  if (!id) return true;

  // 1. The planner catalogue — every entry that declares a country is exact.
  const def = getExam(id);
  if (def?.country) return def.country === 'India';

  // 2. The structured syllabus database — exact id only (never fuzzy here).
  const structured = getSyllabus(id) ?? getSyllabus(id.replace(/^custom:/, ''));
  if (structured?.country) return structured.country === 'India';

  // 3. Keyword fallback for typed exams neither database knows.
  if (slugLooksInternational(id) || slugLooksInternational(examLabel ?? null)) return false;

  // 4. Any doubt means India — the product's primary market.
  return true;
}

/** 'razorpay' | 'creem' — the processor the exam routes to. Display only;
 * features/premium/premiumCheckout.ts remains the one place money moves. */
export function examPaymentProcessor(
  examId: string | null | undefined,
  examLabel?: string | null,
): 'razorpay' | 'creem' {
  return examPricingIsIndia(examId, examLabel) ? 'razorpay' : 'creem';
}
