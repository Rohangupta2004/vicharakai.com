// =============================================
// STUDY ENGINE — DETERMINISTIC ONLY
// AI is NOT permitted in this file.
// =============================================
/**
 * The ONE revision scheduler. Every spaced-repetition date in the product is
 * calculated here — nothing else may do interval arithmetic.
 *
 * Three learning entities revise, each with its own ladder
 * (config/revision.ts) but ONE engine:
 *
 *  - 'topic'    — planner tasks (zuno_items revision rows). The 1→3→7→14→28
 *                 ladder is materialised as rows when a topic is completed,
 *                 counted from the ACTUAL study date; from the first completed
 *                 revision onward the Again/Hard/Good/Easy rating rolls the
 *                 topic one step at a time (nextTopicRevisionStep).
 *  - 'chapter'  — chapter mastery (zuno_exam_progress.spaced_revision_due_at).
 *                 One rolling due date, indexed by the chapter's attempt count.
 *  - 'question' — saved doubts (zuno_question_queue.next_revision_on). One
 *                 rolling due date, indexed by how many times the student got
 *                 the question right; the ladder EXHAUSTS (the question
 *                 clears for good after the last interval). Once a card has
 *                 been graded, the FSRS state machine below owns its dates —
 *                 and an 'Again' rating is measured in MINUTES, not days.
 *
 * "What is the next revision date for this topic?" has exactly one
 * authoritative answer: `calculateNextRevision`.
 *
 * NOTE: this file deliberately sits at the app root (next to engine.ts, not
 * inside an engine/ folder) so the existing `./engine` import specifier stays
 * unambiguous for the space compiler.
 */

import {
  AGAIN_REQUEUE_MINUTES,
  CHAPTER_SPACED_INTERVALS,
  DOUBT_FSRS_CLEAR_DAYS,
  QUESTION_REVISION_INTERVALS,
  RATING_EASY_LATER_LONG_DAYS,
  RATING_EASY_LATER_SHORT_DAYS,
  RATING_EASY_LONG_STEP_MIN,
  RATING_GOOD_EARLIER_DAYS,
  RECALL_INTERVAL_DAYS,
  REVISION_DAILY_CAP,
  TOPIC_REVISION_INTERVALS,
} from './config/revision';
import { newFsrsCardState, type FsrsCardState, type FsrsGrade } from './fsrsTypes';

export type RevisionEntityType = 'topic' | 'chapter' | 'question';

/** The student's difficulty signal, when one exists for the entity. */
export type RevisionPerformance = 'hard' | 'medium' | 'easy' | null;

/**
 * How the topic was actually studied (the task's stored `task_type`).
 * Each bucket has its own default ladder; an explicit Hard/Easy performance
 * signal from the student always outranks the bucket default.
 */
export type TopicTaskType = 'lecture' | 'self_study' | 'practice';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The interval ladder for one entity type. Topics ALWAYS follow the one
 * canonical 1→3→7→14→28 ladder — there are no per-difficulty or per-task-type
 * ladder variants any more; the post-revision Again/Hard/Good/Easy rating
 * moves a topic ALONG the ladder instead (nextTopicRevisionStep). The legacy
 * `performance` and `taskType` parameters are accepted and ignored so older
 * call sites keep compiling (the signals still drive prioritisation). */
export function revisionIntervals(
  entityType: RevisionEntityType,
  _performance: RevisionPerformance = null,
  _taskType: TopicTaskType | null = null,
): number[] {
  if (entityType === 'chapter') return [...CHAPTER_SPACED_INTERVALS];
  if (entityType === 'question') return [...QUESTION_REVISION_INTERVALS];
  return [...TOPIC_REVISION_INTERVALS];
}

export interface NextRevisionArgs {
  entityType: RevisionEntityType;
  /** The date the ladder counts from (YYYY-MM-DD): the study/answer date. */
  baseDate: string;
  /**
   * How far along the ladder this entity is:
   *  - 'chapter': the chapter's attempt count (1 = first study session);
   *  - 'question': how many times the student answered it right (0 on save);
   *  - 'topic': the interval INDEX being scheduled (0-based).
   */
  step: number;
  /** Hard/Medium/Easy — shifts the topic ladder; ignored by the others. */
  performance?: RevisionPerformance;
}

export interface NextRevision {
  /** The next due date, or null when the ladder is exhausted (questions clear). */
  dueOn: string | null;
  /** The interval (days) that produced it, or null when exhausted. */
  intervalDays: number | null;
  /** True when the entity has completed its whole ladder. */
  exhausted: boolean;
}

/**
 * THE canonical answer to "when does this come back?".
 *  - chapters clamp to the last interval (mastery keeps revising at 14 days);
 *  - questions exhaust (after the last interval the question clears);
 *  - topics read the interval at the given index of the chosen ladder.
 */
export function calculateNextRevision(args: NextRevisionArgs): NextRevision {
  const ladder = revisionIntervals(args.entityType, args.performance ?? null);
  if (args.entityType === 'question') {
    if (args.step >= ladder.length) return { dueOn: null, intervalDays: null, exhausted: true };
    const days = ladder[Math.max(0, args.step)];
    return { dueOn: addDays(args.baseDate, days), intervalDays: days, exhausted: false };
  }
  if (args.entityType === 'chapter') {
    // Indexed by attempt count (1-based), clamped to the last rung.
    const days = ladder[Math.min(Math.max(0, args.step - 1), ladder.length - 1)];
    return { dueOn: addDays(args.baseDate, days), intervalDays: days, exhausted: false };
  }
  const index = Math.max(0, args.step);
  if (index >= ladder.length) return { dueOn: null, intervalDays: null, exhausted: true };
  const days = ladder[index];
  return { dueOn: addDays(args.baseDate, days), intervalDays: days, exhausted: false };
}

/**
 * The full topic schedule for one completed study: every ladder date from the
 * study date, minus any intervals the caller wants to skip (already-passed
 * rungs when back-logging an old topic). Used by engine.buildRevisionDrafts —
 * the single materialisation point for zuno_items revision rows.
 */
export function topicRevisionSchedule(
  studiedOn: string,
  performance: RevisionPerformance = null,
  skipIntervals: Set<number> = new Set(),
  taskType: TopicTaskType | null = null,
): Array<{ intervalDays: number; dueOn: string }> {
  return revisionIntervals('topic', performance, taskType)
    .filter((days) => !skipIntervals.has(days))
    .map((days) => ({ intervalDays: days, dueOn: addDays(studiedOn, days) }));
}

/* ------------------------------------------------------------------ */
/*  Post-revision rating — the Again / Hard / Good / Easy chips        */
/* ------------------------------------------------------------------ */

/** The four chips shown after a topic revision is completed. Stored verbatim
 * in zuno_task_feedback.feeling, per topic per student, so the next revision
 * can say “Last time you rated this Hard — how do you feel now?”. */
export type TopicRating = 'again' | 'hard' | 'good' | 'easy';

export const TOPIC_RATINGS: readonly TopicRating[] = ['again', 'hard', 'good', 'easy'];

export function isTopicRating(value: unknown): value is TopicRating {
  return value === 'again' || value === 'hard' || value === 'good' || value === 'easy';
}

export interface TopicRevisionStep {
  /** The standard ladder rung the topic now sits on (1/3/7/14/28). */
  stepDays: number;
  /** Days until the next revision actually lands (the rung ± the rating shift). */
  dueInDays: number;
  /** The next due date, counted from `ratedOn`. */
  dueOn: string;
}

/**
 * THE next-revision rule for a rated topic revision — the exact product spec:
 *   Again → reset to day 1;
 *   Hard  → the standard next interval, unchanged;
 *   Good  → the standard next interval minus one day (revisit slightly
 *           sooner, so it never quite fades);
 *   Easy  → the standard next interval plus 1–2 days (they own it — push it
 *           out a bit, but NEVER skip the step itself).
 * Example — a topic whose completed revision sat on the 3-day rung
 * (standard next = 7): Again → 1 · Hard → 7 · Good → 6 · Easy → 9.
 * The ladder is 1 → 3 → 7 → 14 → 28 and clamps at the top: a topic at 28
 * keeps revising monthly. Legacy interval values (5, 21, …) snap to the
 * nearest rung at or below them, so old rows roll cleanly onto the ladder.
 */
export function nextTopicRevisionStep(
  currentIntervalDays: number | null | undefined,
  rating: TopicRating,
  ratedOn: string,
): TopicRevisionStep {
  const ladder = TOPIC_REVISION_INTERVALS;
  if (rating === 'again') {
    const first = ladder[0];
    return { stepDays: first, dueInDays: first, dueOn: addDays(ratedOn, first) };
  }
  const current = Number(currentIntervalDays);
  let index = -1;
  if (Number.isFinite(current)) {
    for (let i = 0; i < ladder.length; i += 1) if (current >= ladder[i]) index = i;
  }
  const stepDays = ladder[Math.min(index + 1, ladder.length - 1)];
  let dueInDays = stepDays;
  if (rating === 'good') dueInDays = Math.max(1, stepDays - RATING_GOOD_EARLIER_DAYS);
  if (rating === 'easy') {
    dueInDays = stepDays + (stepDays >= RATING_EASY_LONG_STEP_MIN ? RATING_EASY_LATER_LONG_DAYS : RATING_EASY_LATER_SHORT_DAYS);
  }
  return { stepDays, dueInDays, dueOn: addDays(ratedOn, dueInDays) };
}

/* ------------------------------------------------------------------ */
/*  Pile-up protection (FSRS chunking)                                 */
/* ------------------------------------------------------------------ */

/**
 * Chunk a desired due date onto the nearest day that still has room.
 *
 * `countByDate` maps ISO date → how many revision items are already scheduled
 * there. When the desired day is full (>= cap), the date walks forward one day
 * at a time until it finds an open slot (bounded by `maxShiftDays` so a
 * pathological backlog can never loop). The chosen day's count is incremented
 * IN PLACE, so calling this in a loop chunks a whole batch across days —
 * never more than `cap` items land on any single day.
 */
export function nextOpenRevisionDay(
  desiredOn: string,
  countByDate: Map<string, number>,
  cap: number = REVISION_DAILY_CAP,
  maxShiftDays = 30,
): string {
  let date = desiredOn;
  for (let i = 0; i < maxShiftDays; i += 1) {
    if ((countByDate.get(date) ?? 0) < cap) break;
    date = addDays(date, 1);
  }
  countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  return date;
}

/* ------------------------------------------------------------------ */
/*  FSRS — Free Spaced Repetition Scheduler (doubt cards)              */
/* ------------------------------------------------------------------ */
/**
 * The real FSRS-4.5 state machine, day-granular, PURE ALGORITHM — zero AI.
 * It drives saved-doubt scheduling (zuno_question_queue.fsrs_json): each
 * graded review updates stability/difficulty from the elapsed days and the
 * grade, then solves the 90%-retention interval for the next due date.
 *
 * The classic 1/3/7/14 ladder above stays as the FALLBACK: it sets a fresh
 * doubt's first due date on save; from the first graded review onward the
 * FSRS state exists and overrides it. The FIRST rating lands on an explicit
 * rung — Hard 1 day, Good 4 days, Easy 14 days (RECALL_INTERVAL_DAYS) — while
 * Again is a same-SESSION re-queue (~AGAIN_REQUEUE_MINUTES minutes) that also
 * lapses the card into 'Relearning'. The state SCHEMA lives in fsrsTypes.ts
 * so every feature imports the same shape; the maths lives only here (the ONE
 * scheduler).
 */

/** FSRS-4.5 default parameters (w0…w16, the published defaults). */
const FSRS_W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;
const FSRS_DECAY = -0.5;
/** 19/81 makes the 90%-retention interval come out ≈ the stability itself. */
const FSRS_FACTOR = 19 / 81;
const FSRS_REQUEST_RETENTION = 0.9;
const FSRS_MAX_INTERVAL_DAYS = 365;

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO.slice(0, 10)}T12:00:00`);
  const to = new Date(`${toISO.slice(0, 10)}T12:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function clampDifficulty(d: number): number {
  return Math.min(10, Math.max(1, d));
}

/** Initial stability after the very first rating: S0(G) = w[G-1]. */
function fsrsInitialStability(grade: FsrsGrade): number {
  return Math.max(0.1, FSRS_W[grade - 1]);
}

/** Initial difficulty after the very first rating: D0(G) = w4 - (G-3)·w5. */
function fsrsInitialDifficulty(grade: FsrsGrade): number {
  return clampDifficulty(FSRS_W[4] - (grade - 3) * FSRS_W[5]);
}

/** Retrievability after `elapsedDays` at stability `s` (power forgetting curve). */
function fsrsRetrievability(elapsedDays: number, s: number): number {
  if (s <= 0) return 1;
  return Math.pow(1 + (FSRS_FACTOR * Math.max(0, elapsedDays)) / s, FSRS_DECAY);
}

/** Difficulty update with mean reversion towards D0(Good). */
function fsrsNextDifficulty(d: number, grade: FsrsGrade): number {
  const shifted = d - FSRS_W[6] * (grade - 3);
  return clampDifficulty(FSRS_W[7] * fsrsInitialDifficulty(3) + (1 - FSRS_W[7]) * shifted);
}

/** Stability growth after a SUCCESSFUL recall (grade 2/3/4). */
function fsrsRecallStability(d: number, s: number, r: number, grade: FsrsGrade): number {
  const hardPenalty = grade === 2 ? FSRS_W[15] : 1;
  const easyBonus = grade === 4 ? FSRS_W[16] : 1;
  return s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) * (Math.exp(FSRS_W[10] * (1 - r)) - 1) * hardPenalty * easyBonus);
}

/** Post-lapse stability after FORGETTING (grade 1 / Again) — never grows. */
function fsrsForgetStability(d: number, s: number, r: number): number {
  const next = FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp(FSRS_W[14] * (1 - r));
  return Math.min(Math.max(0.1, next), s > 0 ? s : next);
}

/** Solve the request-retention interval for a stability, in whole days. */
export function fsrsIntervalDays(stability: number): number {
  const interval = (stability / FSRS_FACTOR) * (Math.pow(FSRS_REQUEST_RETENTION, 1 / FSRS_DECAY) - 1);
  return Math.min(FSRS_MAX_INTERVAL_DAYS, Math.max(1, Math.round(interval)));
}

export interface FsrsReviewResult {
  /** The card's new stored state — persist this to fsrs_json verbatim. */
  state: FsrsCardState;
  /** The FSRS-scheduled next due date (before any pile-up chunking). */
  dueOn: string;
  /** The interval (days) behind dueOn. 0 for a same-session re-queue. */
  intervalDays: number;
  /** Minutes until the card comes back, for a same-session re-queue only. */
  intervalMinutes: number;
  /** True for an 'Again' rating: the card returns LATER TODAY (roughly
   * AGAIN_REQUEUE_MINUTES from now), not tomorrow. */
  sameSessionRequeue: boolean;
  /** True when the memory is stable enough for the card to leave rotation
   * (Review state with an interval past DOUBT_FSRS_CLEAR_DAYS). */
  mastered: boolean;
}

/** The entry rung a FIRST rating produces, in days (Hard 1 / Good 4 / Easy
 * 14). Grade 1 (Again) never resolves to a day — it re-queues in-session. */
function firstRatingIntervalDays(grade: FsrsGrade): number {
  if (grade === 2) return RECALL_INTERVAL_DAYS.hard;
  if (grade === 3) return RECALL_INTERVAL_DAYS.good;
  return RECALL_INTERVAL_DAYS.easy;
}

/**
 * THE FSRS transition: one graded review of one doubt card.
 *  - a New card initialises stability/difficulty from the grade, and its
 *    interval is the explicit entry rung (Hard 1 / Good 4 / Easy 14 days —
 *    config/revision.RECALL_INTERVAL_DAYS);
 *  - a successful recall (grade ≥ 2) on a card that already has state grows
 *    stability and lands in 'Review', with the solved retention interval;
 *  - Again (grade 1) is a SAME-SESSION re-queue: the card comes back about
 *    AGAIN_REQUEUE_MINUTES later today rather than tomorrow. Out of 'Review'
 *    it also counts as a lapse (lapses + 1, stability shrinks) and escalates
 *    into 'Relearning'.
 * Pass `prior = null` for a card with no stored state (first-ever review).
 */
export function fsrsReview(prior: FsrsCardState | null, grade: FsrsGrade, reviewedOn: string): FsrsReviewResult {
  const previous = prior ?? newFsrsCardState();
  const elapsedDays = previous.last_review ? Math.max(0, daysBetween(previous.last_review, reviewedOn)) : 0;
  const isNew = previous.state === 'New' || previous.stability <= 0;

  let stability: number;
  let difficulty: number;
  let stateName: FsrsCardState['state'];
  let lapses = previous.lapses;

  if (isNew) {
    stability = fsrsInitialStability(grade);
    difficulty = fsrsInitialDifficulty(grade);
    stateName = grade === 1 ? 'Learning' : 'Review';
  } else {
    const retrievability = fsrsRetrievability(elapsedDays, previous.stability);
    difficulty = fsrsNextDifficulty(previous.difficulty, grade);
    if (grade === 1) {
      stability = fsrsForgetStability(previous.difficulty, previous.stability, retrievability);
      if (previous.state === 'Review') lapses += 1;
      stateName = 'Relearning';
    } else {
      stability = fsrsRecallStability(previous.difficulty, previous.stability, retrievability, grade);
      stateName = 'Review';
    }
  }

  /* Again re-queues WITHIN the session (0 days, ~10 minutes). A first rating
     takes its explicit entry rung; later successful recalls take the solved
     retention interval. */
  const sameSessionRequeue = grade === 1;
  const intervalDays = sameSessionRequeue ? 0 : isNew ? firstRatingIntervalDays(grade) : fsrsIntervalDays(stability);
  const state: FsrsCardState = {
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: intervalDays,
    reps: previous.reps + 1,
    lapses,
    state: stateName,
    last_review: reviewedOn.slice(0, 10),
  };
  return {
    state,
    dueOn: addDays(reviewedOn, intervalDays),
    intervalDays,
    intervalMinutes: sameSessionRequeue ? AGAIN_REQUEUE_MINUTES : 0,
    sameSessionRequeue,
    mastered: !sameSessionRequeue && stateName === 'Review' && intervalDays > DOUBT_FSRS_CLEAR_DAYS,
  };
}

/* ------------------------------------------------------------------ */
/*  Time saved by a timely revision — the payback figure               */
/* ------------------------------------------------------------------ */
/**
 * "2 minutes now — about 40 minutes of relearning saved later."
 *
 * The estimate reads the SAME forgetting curve that drives scheduling
 * (fsrsRetrievability): the lower the card's current retention, the closer a
 * recall is to a full relearn — and relearning a fully-decayed topic costs
 * roughly 8–10x a timely refresh. The relearn factor therefore scales from
 * 2x (recalled at 90% retention — the scheduling target) up to 10x (fully
 * decayed), and the saved figure is the relearn cost minus the minutes just
 * spent. Deterministic — zero AI.
 */
const RELEARN_MAX_FACTOR = 10;
const RELEARN_MIN_FACTOR = 2;

export interface TimeSavedEstimate {
  /** Minutes the revision just cost. */
  nowMinutes: number;
  /** Minutes of future relearning this timely refresh avoided. */
  savedMinutes: number;
  /** The retention (0–1) the estimate was read from. */
  retention: number;
}

/** Retention right now for a scheduled revision without stored FSRS state:
 * the ladder interval stands in for stability (a day-14 rung IS a two-week
 * memory), elapsed days come from the actual study date. */
export function estimateRetention(elapsedDays: number, stabilityDays: number): number {
  return fsrsRetrievability(Math.max(0, elapsedDays), Math.max(1, stabilityDays));
}

/** The payback estimate for one completed revision. */
export function estimateTimeSaved(reviewMinutes: number, retention: number): TimeSavedEstimate {
  const nowMinutes = Math.max(1, Math.round(reviewMinutes));
  const r = Math.max(0, Math.min(1, retention));
  /* r = 0.9 (reviewed on time) -> ~2x; r = 0 (fully decayed) -> 10x. */
  const factor = RELEARN_MIN_FACTOR + (RELEARN_MAX_FACTOR - RELEARN_MIN_FACTOR) * Math.min(1, (1 - r) / 0.9);
  const savedMinutes = Math.max(0, Math.round(nowMinutes * factor - nowMinutes));
  return { nowMinutes, savedMinutes, retention: r };
}

function roundedDuration(minutes: number): string {
  if (minutes >= 55) {
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;
    return `about ${rounded === 1 ? 'an hour' : `${rounded} hours`}`;
  }
  /* Round to a friendly 5 — an estimate should read like one. */
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  return `about ${rounded} minutes`;
}

/** The single line shown after a completed revision. */
export function timeSavedLine(estimate: TimeSavedEstimate): string {
  const now = estimate.nowMinutes === 1 ? '1 minute' : `${estimate.nowMinutes} minutes`;
  return `${now} now — ${roundedDuration(estimate.savedMinutes)} of relearning saved later.`;
}
