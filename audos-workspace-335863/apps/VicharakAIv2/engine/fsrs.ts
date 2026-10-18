/**
 * FSRS scheduling core (§13) — used for doubts and failed concepts.
 * Compact FSRS-4.5 with default weights. Pure functions: no I/O here.
 */
import { addDaysIso, elapsedDays, nowIso, todayIso } from '../lib/dates';

/** 1 Again · 2 Hard · 3 Good · 4 Easy */
export type Grade = 1 | 2 | 3 | 4;

export interface FsrsState {
  stability: number;
  difficulty: number;
  due_date: string;
  last_review: string | null;
  review_count: number;
}

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const TARGET_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 365;

const clampD = (d: number) => Math.min(10, Math.max(1, d));

function initialStability(g: Grade): number {
  return Math.max(0.1, W[g - 1]);
}

function initialDifficulty(g: Grade): number {
  return clampD(W[4] - (g - 3) * W[5]);
}

function nextDifficulty(d: number, g: Grade): number {
  const updated = d - W[6] * (g - 3);
  return clampD(W[7] * initialDifficulty(3) + (1 - W[7]) * updated);
}

function retrievability(elapsed: number, stability: number): number {
  return Math.pow(1 + elapsed / (9 * Math.max(0.1, stability)), -1);
}

function stabilityOnSuccess(s: number, d: number, r: number, g: Grade): number {
  const hardPenalty = g === 2 ? W[15] : 1;
  const easyBonus = g === 4 ? W[16] : 1;
  const growth = Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1);
  return s * (1 + growth * hardPenalty * easyBonus);
}

function stabilityOnLapse(s: number, d: number, r: number): number {
  return Math.max(0.1, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

function intervalDays(stability: number): number {
  const days = (stability * 9 * (1 / TARGET_RETENTION - 1));
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

/** First review — when a doubt is tagged, seeded from its marked difficulty. */
export function initialCard(grade: Grade): FsrsState {
  const stability = initialStability(grade);
  return {
    stability,
    difficulty: initialDifficulty(grade),
    due_date: addDaysIso(todayIso(), intervalDays(stability)),
    last_review: nowIso(),
    review_count: 0,
  };
}

/** Difficulty marked at capture → seed grade: hard cards come back sooner. */
export function seedGradeForDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Grade {
  return difficulty === 'easy' ? 4 : difficulty === 'medium' ? 3 : 2;
}

/** Apply a review outcome and compute the next due date. */
export function review(state: FsrsState, grade: Grade): FsrsState {
  const elapsed = state.last_review ? elapsedDays(state.last_review, nowIso()) : 0;
  const r = retrievability(elapsed, state.stability);
  const difficulty = nextDifficulty(state.difficulty, grade);
  const stability =
    grade === 1
      ? stabilityOnLapse(state.stability, difficulty, r)
      : stabilityOnSuccess(Math.max(0.1, state.stability), difficulty, r, grade);
  return {
    stability,
    difficulty,
    due_date: addDaysIso(todayIso(), grade === 1 ? 1 : intervalDays(stability)),
    last_review: nowIso(),
    review_count: state.review_count + 1,
  };
}

/** Test-win boost (§8.1): multiply stability and push the card out. */
export function boost(state: FsrsState, factor: number): FsrsState {
  const stability = Math.max(0.1, state.stability * factor);
  return { ...state, stability, due_date: addDaysIso(todayIso(), intervalDays(stability)) };
}
