/**
 * Task-feature types and small constants. Extracted from App.tsx.
 */
import type { TaskFeeling } from '../../engine';

/**
 * How many secondary tasks Today shows before the "more waiting" link. Kept
 * deliberately small: the screen promises one mission, not a backlog.
 */
export const VISIBLE_LATER_CAP = 3;

/**
 * Warm, judgment-free completion toasts — rotated in order after every
 * checked-off task. Statements only, never questions.
 */
export const ENCOURAGE_MESSAGES = [
  'Nice work! Keep going \uD83D\uDD25',
  "One down — you're building momentum!",
  'Solid! VicharakAI is tracking your progress.',
  'Crossed off — that momentum is real.',
  'Great work — one step closer to exam day.',
] as const;

export type DailySection = 'Revision' | 'Lecture' | 'Self Study';
export interface SectionDraft { open: boolean; subject: string; text: string }

export function newSectionDrafts(): Record<DailySection, SectionDraft> {
  return {
    Revision: { open: true, subject: '', text: '' },
    Lecture: { open: false, subject: '', text: '' },
    'Self Study': { open: false, subject: '', text: '' },
  };
}

/** What the "How long did you study?" sheet is currently recording time against. */
export interface DurationPrompt {
  itemId: number | null;
  sourceKey: string | null;
  subject: string | null;
  topic: string | null;
  /** A warm line above the chips — the completion quote, when there is one. */
  note: string | null;
  prefillMinutes: number | null;
}

export interface TaskFeedbackRow {
  id: number;
  item_id: number;
  source_key: string;
  subject: string;
  topic: string;
  feeling: TaskFeeling;
  created_on: string;
}
