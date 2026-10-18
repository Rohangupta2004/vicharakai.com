/**
 * Exam-standard question pacing — the ONE place "how long is one question
 * allowed to take?" is answered.
 *
 * The doubt card's silent timer offers two modes and both are computed here:
 *
 *  - Mode A ("question pace"): the question's OWN expected length — derived
 *    from its stored difficulty when the vision pass tagged one — plus a
 *    3-minute thinking buffer.
 *  - Mode B ("exam pace"): the real per-question budget of the student's exam
 *    (NEET ≈ 72s, JEE ≈ 3 min, UPSC Prelims ≈ 72s…) plus a 2-minute buffer.
 *
 * The lookup matches on the exam id OR its human label, so a custom exam
 * typed at onboarding ("NEET UG 2027") still resolves to the right pace and
 * anything unrecognised falls back to a neutral 2 minutes per question.
 *
 * NOTE: these are per-question BUDGETS, not the FSRS grading thresholds. The
 * implicit grade boundaries (<20s Easy · ≤2 min Good · >2 min Hard) live with
 * the grading logic in features/doubts/useDoubts.ts.
 */

/** Buffer added on top of the question's own expected length (Mode A). */
export const QUESTION_PACE_BUFFER_SECONDS = 180;
/** Buffer added on top of the exam's standard per-question budget (Mode B). */
export const EXAM_PACE_BUFFER_SECONDS = 120;
/** Used for any exam the table below does not recognise. */
export const DEFAULT_EXAM_SECONDS_PER_QUESTION = 120;

/**
 * Seconds per question, by exam. Keyword-matched (first hit wins) so both
 * `profile.exam` ids and free-typed exam labels resolve.
 */
const EXAM_PACE_TABLE: Array<{ match: RegExp; seconds: number; label: string }> = [
  { match: /neet[\s_-]*pg|inicet/i, seconds: 60, label: 'NEET PG' },
  { match: /neet/i, seconds: 72, label: 'NEET' },
  { match: /jee|bitsat|viteee/i, seconds: 180, label: 'JEE' },
  { match: /upsc|\bias\b|\bcse\b|civil\s*services/i, seconds: 72, label: 'UPSC Prelims' },
  { match: /\bssc\b|\bcgl\b|chsl/i, seconds: 48, label: 'SSC' },
  { match: /ibps|\bsbi\b|\brrb\b|bank/i, seconds: 40, label: 'Banking' },
  { match: /\bcat\b|\bxat\b|\bnmat\b/i, seconds: 110, label: 'CAT' },
  { match: /gate/i, seconds: 166, label: 'GATE' },
  { match: /clat|\blsat\b|\bailet\b/i, seconds: 60, label: 'Law entrance' },
  { match: /\bnda\b|\bcds\b|\bafcat\b/i, seconds: 60, label: 'Defence' },
  { match: /gmat/i, seconds: 130, label: 'GMAT' },
  { match: /\bgre\b/i, seconds: 105, label: 'GRE' },
  { match: /mcat|usmle/i, seconds: 95, label: 'MCAT' },
  { match: /ucat|bmat/i, seconds: 45, label: 'UCAT' },
  { match: /psat|\bsat\b|\bact\b/i, seconds: 78, label: 'SAT' },
  { match: /a[\s-]*level|gcse|\bhsc\b|\bsee\b|board/i, seconds: 150, label: 'Board exam' },
];

export interface ExamPace {
  /** The exam's standard budget for ONE question, in seconds. */
  secondsPerQuestion: number;
  /** Short human name for the matched pace, shown on the timer chip. */
  label: string;
}

/** The exam-standard pace for an exam id and/or its human label. */
export function examPace(examId: string | null | undefined, examLabel?: string | null): ExamPace {
  const haystack = `${examId ?? ''} ${examLabel ?? ''}`.trim();
  if (haystack) {
    for (const entry of EXAM_PACE_TABLE) {
      if (entry.match.test(haystack)) return { secondsPerQuestion: entry.seconds, label: entry.label };
    }
  }
  return { secondsPerQuestion: DEFAULT_EXAM_SECONDS_PER_QUESTION, label: 'Standard' };
}

/**
 * How long ONE question is expected to take on its own merits — read off the
 * difficulty the vision pass tagged it with. Unknown difficulty means an
 * average question, i.e. 2 minutes.
 */
export function questionOwnSeconds(difficulty: string | null | undefined): number {
  const value = String(difficulty ?? '').trim().toLowerCase();
  if (value === 'easy') return 60;
  if (value === 'hard') return 180;
  return 120;
}

/** Mode A total: the question's own length + the 3-minute buffer. */
export function questionPaceLimit(difficulty: string | null | undefined): number {
  return questionOwnSeconds(difficulty) + QUESTION_PACE_BUFFER_SECONDS;
}

/** Mode B total: the exam's per-question budget + the 2-minute buffer. */
export function examPaceLimit(examId: string | null | undefined, examLabel?: string | null): number {
  return examPace(examId, examLabel).secondsPerQuestion + EXAM_PACE_BUFFER_SECONDS;
}

/** "1m 12s" / "3m" — compact pace label for the mode chips. */
export function formatPaceShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}s`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
