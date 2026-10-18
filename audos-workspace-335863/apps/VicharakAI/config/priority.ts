/**
 * Central priority-scoring configuration — the weights behind the ONE
 * priority engine (engine in studyEngine.ts: buildPriorityQueue).
 *
 * Every surface that ranks study work (Today's mission ordering, the coach's
 * suggestions, "what should I do now?", the daily plan buckets) consumes the
 * queue built from these weights. No screen may re-derive its own priority
 * arithmetic.
 */

export const PRIORITY_WEIGHTS = {
  /** Base score for a revision that is overdue by 1+ days. */
  revisionOverdueBase: 40,
  /** Extra per day a revision is overdue. */
  revisionOverduePerDay: 6,
  /** A revision due exactly today. */
  revisionDueToday: 30,
  /** A new task planned for today. */
  plannedToday: 20,
  /** Base score for a carried-over (backlog) task. */
  carriedOverBase: 18,
  /** Extra per day late for a carried-over task (capped). */
  carriedOverPerDay: 2,
  carriedOverCap: 12,
  /** Weak-topic flag: weaknessScore / divisor, clamped to [min, max]. */
  weaknessDivisor: 3,
  weaknessMin: 10,
  weaknessMax: 30,
  /** Recent test accuracy below the weak threshold: (threshold − acc) / divisor. */
  accuracyDivisor: 2,
  /** Chapter weightage at or above this percent of the exam adds a bonus. */
  highWeightagePct: 5,
  highWeightageBonus: 8,
  /** Recurring saved doubts on the same ground: perDoubt × count (capped). */
  doubtPerSaved: 4,
  doubtCap: 12,
  /** The student's own "felt hard" signal. */
  feltHardBonus: 6,
} as const;

/** How many items the daily plan promotes to MUST DO. */
export const MUST_DO_CAP = 3;
/** How many overflow items surface as IF TIME before deferring the rest. */
export const IF_TIME_CAP = 3;
/** How many carried-over tasks land on each coming day when spreading backlog. */
export const BACKLOG_PER_DAY = 2;

/* ------------------------------------------------------------------ */
/*  Conditional exam-weightage triage                                  */
/* ------------------------------------------------------------------ */

/**
 * How many unfinished items (overdue tasks + slipped revisions) make a
 * backlog "heavy". Below this the student can realistically clear everything,
 * so every chapter is treated as equally worth doing and the existing order
 * (FSRS due date, the student's own starring, teacher input) is left alone.
 * At or above it there is no longer time for everything, and exam weightage
 * decides what gets done first. See studyEngine.getPriorityScore.
 */
export const HEAVY_BACKLOG_THRESHOLD = 5;

/**
 * Points per percent of the paper a chapter is worth, added once the backlog
 * is heavy. Chapter weights span roughly 0.1-6%, so this spreads the queue by
 * about 35 points — enough to reorder items inside the same band (all of
 * today's tasks, all the day's due revisions) without letting weightage
 * overrule a badly overdue revision.
 */
export const HEAVY_BACKLOG_WEIGHT_MULTIPLIER = 6;

/**
 * The same idea for the revision display slice (engine.prioritizeDueRevisions),
 * where scores are weakness points (0-100 in steps of 25). Kept smaller so one
 * real wrong answer still outranks pure weightage.
 */
export const REVISION_WEIGHT_MULTIPLIER = 3;

/** Human bucket assigned to each prioritized item (see buildPriorityQueue). */
export type PriorityLevel = 'must_do' | 'should_do' | 'if_time' | 'deferred';
