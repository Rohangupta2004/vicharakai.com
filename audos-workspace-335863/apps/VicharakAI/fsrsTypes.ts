/**
 * fsrsTypes — the FSRS (Free Spaced Repetition Scheduler) card-state SCHEMA,
 * shared across features. This file holds types and (de)serialisation only:
 * the FSRS algorithm itself lives in revisionEngine.ts (the ONE revision
 * scheduler), so no interval arithmetic ever happens outside it.
 *
 * One FsrsCardState is stored per doubt card (zuno_question_queue.fsrs_json,
 * written on every graded review). Any feature that needs a card's memory
 * state imports these types + parseFsrsState — never its own copy.
 */

/** FSRS rating: 1 = Again · 2 = Hard · 3 = Good · 4 = Easy. */
export type FsrsGrade = 1 | 2 | 3 | 4;

/** FSRS card lifecycle state. Hard-again cards lapse into 'Relearning'. */
export type FsrsStateName = 'New' | 'Learning' | 'Review' | 'Relearning';

export const FSRS_STATE_NAMES: readonly FsrsStateName[] = ['New', 'Learning', 'Review', 'Relearning'];

/** The per-card FSRS memory state (snake_case to match the stored JSON). */
export interface FsrsCardState {
  /** Memory stability — roughly the days until recall odds decay to 90%. */
  stability: number;
  /** FSRS item difficulty on its 1–10 scale (NOT the easy/medium/hard label). */
  difficulty: number;
  /** Days between the previous review and the latest one. */
  elapsed_days: number;
  /** Days the latest review scheduled until the next one. */
  scheduled_days: number;
  /** Total graded reviews recorded for this card. */
  reps: number;
  /** Times the card was forgotten (rated Again out of Review). */
  lapses: number;
  state: FsrsStateName;
  /** ISO date (YYYY-MM-DD) of the latest review; null before the first. */
  last_review: string | null;
}

/** A brand-new card that has never been reviewed. */
export function newFsrsCardState(): FsrsCardState {
  return {
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_review: null,
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value ?? NaN);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse a stored fsrs_json value (a JSON string OR an already-parsed object —
 * the WorkspaceDB SDK may hand back either) into a valid FsrsCardState.
 * Returns null for anything unusable, so callers fall back to the ladder.
 */
export function parseFsrsState(raw: unknown): FsrsCardState | null {
  let value: unknown = raw;
  if (typeof value === 'string') {
    if ((value ?? '').trim() === '') return null;
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const state = typeof record.state === 'string' && (FSRS_STATE_NAMES as string[]).includes(record.state)
    ? (record.state as FsrsStateName)
    : null;
  if (!state) return null;
  const lastReview = typeof record.last_review === 'string' && (record.last_review ?? '').trim() !== ''
    ? record.last_review.slice(0, 10)
    : null;
  return {
    stability: Math.max(0, toFiniteNumber(record.stability)),
    difficulty: Math.max(0, toFiniteNumber(record.difficulty)),
    elapsed_days: Math.max(0, toFiniteNumber(record.elapsed_days)),
    scheduled_days: Math.max(0, toFiniteNumber(record.scheduled_days)),
    reps: Math.max(0, Math.round(toFiniteNumber(record.reps))),
    lapses: Math.max(0, Math.round(toFiniteNumber(record.lapses))),
    state,
    last_review: lastReview,
  };
}

/** Serialise a card state for the fsrs_json column (stable key order). */
export function serializeFsrsState(state: FsrsCardState): string {
  return JSON.stringify({
    stability: Number(state.stability.toFixed(4)),
    difficulty: Number(state.difficulty.toFixed(4)),
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review,
  });
}
