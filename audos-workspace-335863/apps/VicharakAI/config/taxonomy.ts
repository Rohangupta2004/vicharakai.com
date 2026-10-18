/**
 * taxonomy — the ONE shared home of every reason/difficulty vocabulary in
 * the product. Nothing here schedules or stores anything; these are the
 * fixed word lists every feature must agree on:
 *
 *  · DIFFICULTY            — content difficulty labels (Easy/Medium/Hard)
 *                            used by task and question difficulty prompts.
 *  · DOUBT_GRADES          — the recall-grade taxonomy (Again / Hard / Good /
 *                            Easy — the four standard FSRS responses)
 *                            + the silent-timer buckets that assign them
 *                            (≤20s = Easy · ≤2min = Good · longer = Again)
 *                            + the FSRS rating each grade maps to.
 *  · WRONG_REASONS         — the fixed post-test wrong-answer taxonomy
 *                            (exactly SIX reasons, one picked per mistake)
 *                            + the coaching follow-up each reason maps to.
 *
 * config/sharedConfig.ts re-exports everything below, so existing imports
 * keep working — but the definitions live HERE and only here.
 */

import type { FsrsGrade } from '../fsrsTypes';

/* ------------------------------------------------------------------ */
/*  Content difficulty (Easy / Medium / Hard)                          */
/* ------------------------------------------------------------------ */

export const DIFFICULTY = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
} as const;

export type DifficultyLabel = (typeof DIFFICULTY)[keyof typeof DIFFICULTY];

/** The fourth option on the post-task prompt — no revision entry is kept. */
export const NO_REVISION_LABEL = 'No Revision';

/* ------------------------------------------------------------------ */
/*  Doubt review grades (Again / Hard / Good / Easy — the FSRS scale)   */
/* ------------------------------------------------------------------ */

/**
 * The doubt-review grade vocabulary — the four standard FSRS responses, in
 * the order they are shown to the student: Again · Hard · Good · Easy. This
 * is the ONE home of that vocabulary (do not redeclare it per feature).
 * Distinct from DIFFICULTY above (Easy/Medium/Hard CONTENT difficulty):
 * a doubt grade is a memory-recall verdict, not a difficulty label.
 */
export const DOUBT_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type DoubtGrade = (typeof DOUBT_GRADES)[number];

/** The student-facing label for each grade — the chip copy, in one place. */
export const DOUBT_GRADE_LABELS: Record<DoubtGrade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/** Recall within this many seconds grades Easy (≤20s). */
export const DOUBT_EASY_MAX_SECONDS = 20;
/** Recall within this many seconds (past the Easy bound) grades Good;
 * anything longer — or a timer expiry — grades Again (>2 min). */
export const DOUBT_GOOD_MAX_SECONDS = 120;

/**
 * THE timing-bucket → grade mapping: ≤20s Easy · ≤2min Good · else Again.
 * Only the silent timer and the wrong-MCQ path use it. 'hard' is never
 * inferred from a clock — a struggled-but-recalled review is something only
 * the student can report, which is what the Hard chip is for.
 */
export function doubtGradeFromSeconds(elapsedSeconds: number): DoubtGrade {
  if (elapsedSeconds <= DOUBT_EASY_MAX_SECONDS) return 'easy';
  if (elapsedSeconds <= DOUBT_GOOD_MAX_SECONDS) return 'good';
  return 'again';
}

/**
 * Doubt grades map onto the FSRS ratings one-for-one: Again → 1 (the card
 * lapses into the relearning state), Hard → 2, Good → 3, Easy → 4.
 * The FSRS maths lives in revisionEngine.fsrsReview — the ONE scheduler.
 */
export const DOUBT_GRADE_TO_FSRS: Record<DoubtGrade, FsrsGrade> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

/** True when a grade counts as a successful recall — everything but Again.
 * FSRS treats Hard as a (weak) success, so it advances the card too; only
 * Again is a lapse. Drives `revise_count`, which stores successes only. */
export function isSuccessfulRecall(grade: DoubtGrade): boolean {
  return grade !== 'again';
}

/* ------------------------------------------------------------------ */
/*  Wrong-answer reasons (post-test analysis — exactly six)            */
/* ------------------------------------------------------------------ */

export const WRONG_REASONS = [
  'Silly',
  'No Concept / Not Learnt',
  'Time',
  'Calculation',
  'No Revision',
  'Pressure / No Click',
] as const;

export type WrongReason = (typeof WRONG_REASONS)[number];

export function isWrongReason(value: unknown): value is WrongReason {
  return typeof value === 'string' && (WRONG_REASONS as readonly string[]).includes(value);
}

/** The coaching follow-up each reason maps to — shown right under the picked
 * chip. `{concept}` is replaced with the question's concept tag when known. */
export const WRONG_REASON_FOLLOWUPS: Record<WrongReason, string> = {
  Silly: 'Noted as a slip — read the full question once more before answering next time.',
  'No Concept / Not Learnt':
    'Learn {concept} before reattempting — it is in your mistake book now; a “Learn {concept}” task has been added to your plan.',
  Time: 'Use the timer: take your next practice run as a TIMED test of similar/PYQ questions so pacing becomes a habit.',
  Calculation: "Try to solve it slowly — don't rush the algebra. Redo this one on paper, step by step, before your next test.",
  'No Revision':
    'This concept slipped because it was never revised — it is queued back into your spaced revision loop (1/3/7/14 days).',
  'Pressure / No Click':
    'Stay in the neutral phase: breathe, skip, return. No extra drilling needed — this was nerves, not knowledge.',
};
