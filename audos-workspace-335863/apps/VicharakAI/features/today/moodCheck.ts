/**
 * Vicharee mood check — the state behind the opening "how's your energy?"
 * question (MoodCheckOverlay.tsx) and the Today-screen plan shaping it drives.
 *
 * One mood per calendar day, stored device-side (localStorage — deliberately
 * NOT a database row: it is a presentation signal, not study history), and
 * broadcast on a window event so the overlay (mounted in AppShell) and the
 * Today screen stay in sync without threading new props through the shell.
 *
 *   energetic → full load: a bigger visible slice, hardest ground first
 *   regular   → the standard plan, untouched
 *   down      → light load: revision leads, a 2-item slice, easiest win first
 */
import { useEffect, useState } from 'react';
import { topicKey, type StudyItem, type TaskFeeling } from '../../engine';
import type { WeakTopicInsight } from '../../adaptationEngine';

export type VichareeMood = 'energetic' | 'regular' | 'down';

/** Fired on window whenever today's mood is written. */
export const MOOD_CHANGED_EVENT = 'vicharee:mood-changed';
/** Fired on window to re-open the mood question (the Today header chip). */
export const MOOD_RECHECK_EVENT = 'vicharee:mood-recheck';

/** The opening question shows once per calendar DAY (founder instruction,
 *  2026-09-30): the date it last showed is kept in localStorage under this
 *  key, compared as YYYY-MM-DD, and resets naturally on the next day. */
const MOOD_PROMPT_DATE_KEY = 'vicharee_mood_date';

export const MOOD_META: Record<
  VichareeMood,
  {
    emoji: string;
    label: string;
    /** The card's one-line subtitle in the mood picker. */
    sub: string;
    /** Vicharee's "Plan ready" confirmation line. */
    readyLine: string;
    /** The note under the Today card header once the mood is set. */
    planNote: string;
    /** Short label for the header chip. */
    chipLabel: string;
  }
> = {
  energetic: {
    emoji: '\uD83D\uDD25',
    label: 'Very Energetic',
    sub: 'Full power — give me the hard stuff',
    readyLine: "Full-load plan set — your toughest topics lead while the energy is high. Let's go! \uD83D\uDE80",
    planNote: 'Full-power day — hardest topics first, and a bigger slice than usual.',
    chipLabel: 'Full power',
  },
  regular: {
    emoji: '\uD83D\uDE10',
    label: 'Just Regular',
    sub: 'A normal, steady day',
    readyLine: 'Standard plan set — steady beats intense. One topic at a time. \u2705',
    planNote: 'Steady day — your standard plan, one topic at a time.',
    chipLabel: 'Steady',
  },
  down: {
    emoji: '\uD83D\uDE14',
    label: 'Very Down',
    sub: 'Go easy on me today',
    readyLine: 'Light day planned — mostly revision, easy win first. Showing up still counts. \uD83D\uDC99',
    planNote: 'Light day — revision first and one easy win. Showing up is the win today.',
    chipLabel: 'Taking it easy',
  },
};

function moodStorageKey(spaceId: string, date: string): string {
  return `vicharak_mood_${spaceId}_${date}`;
}

/** Today's stored mood, or null when the student hasn't answered today. */
export function readTodayMood(spaceId: string, date: string): VichareeMood | null {
  try {
    const value = localStorage.getItem(moodStorageKey(spaceId, date));
    return value === 'energetic' || value === 'regular' || value === 'down' ? value : null;
  } catch {
    return null;
  }
}

export function writeTodayMood(spaceId: string, date: string, mood: VichareeMood): void {
  try {
    localStorage.setItem(moodStorageKey(spaceId, date), mood);
  } catch {
    /* storage unavailable — the plan simply stays standard */
  }
  try {
    window.dispatchEvent(new CustomEvent(MOOD_CHANGED_EVENT));
  } catch {
    /* CustomEvent unavailable — the next mount reads storage anyway */
  }
}

export function moodPromptSeenToday(date: string): boolean {
  try {
    return window.localStorage.getItem(MOOD_PROMPT_DATE_KEY) === date;
  } catch {
    return false;
  }
}

export function markMoodPromptSeen(date: string): void {
  try {
    window.localStorage.setItem(MOOD_PROMPT_DATE_KEY, date);
  } catch {
    /* private mode — the question may repeat, nothing breaks */
  }
}

/** Re-open the mood question from anywhere (the Today header chip). */
export function requestMoodRecheck(): void {
  try {
    window.dispatchEvent(new CustomEvent(MOOD_RECHECK_EVENT));
  } catch {
    /* cosmetic — never load-bearing */
  }
}

/** Reactive read of today's mood — updates the moment the overlay writes it. */
export function useTodayMood(spaceId: string, date: string): VichareeMood | null {
  const [mood, setMood] = useState<VichareeMood | null>(() => readTodayMood(spaceId, date));
  useEffect(() => {
    const sync = () => setMood(readTodayMood(spaceId, date));
    sync();
    window.addEventListener(MOOD_CHANGED_EVENT, sync);
    return () => window.removeEventListener(MOOD_CHANGED_EVENT, sync);
  }, [spaceId, date]);
  return mood;
}

/**
 * How many targets Vicharee GENERATES for the day at this energy level.
 * This is the auto-plan size (features/today/vichareeTargets.ts), not the
 * display cap: energetic pushes harder with more new ground, down keeps it
 * to one or two revision items.
 */
export function moodTargetCount(mood: VichareeMood | null): number {
  if (mood === 'energetic') return 5;
  if (mood === 'down') return 2;
  return 3;
}

/**
 * How many pending tasks Today shows for this mood. Revisions occupy their
 * own leading section, so the cap shrinks as more revisions are due — except
 * on a down day, which is capped hard at two: revision plus one easy win.
 */
export function moodVisibleCap(mood: VichareeMood | null, dueRevisionCount: number): number {
  if (mood === 'energetic') return Math.max(4, 10 - dueRevisionCount);
  if (mood === 'down') return 2;
  return Math.max(3, 8 - dueRevisionCount);
}

/**
 * Order today's pending tasks for the mood. Energetic days lead with the
 * hardest evidence-backed ground (weak-flagged topics, topics the student
 * marked hard, their own pins); down days lead with the easiest win. Regular
 * days keep the engine's own order untouched. The sort is stable, so equal
 * items never jump around between renders.
 */
export function orderTasksForMood(
  items: StudyItem[],
  mood: VichareeMood | null,
  signals: {
    feelingByKey: Map<string, TaskFeeling>;
    weakInsights: WeakTopicInsight[];
  },
): StudyItem[] {
  if (!mood || mood === 'regular' || items.length <= 1) return items;
  const weakNames: string[] = [];
  for (const insight of signals.weakInsights) {
    for (const name of [insight.topicName, insight.chapterName]) {
      const clean = String(name ?? '').trim().toLowerCase();
      if (clean) weakNames.push(clean);
    }
  }
  const difficultyOf = (item: StudyItem): number => {
    const key = item.source_key || topicKey(item.subject, item.topic);
    const felt = signals.feelingByKey.get(key);
    const topic = (item.topic ?? '').trim().toLowerCase();
    const isWeak = weakNames.some((name) => topic.includes(name) || name.includes(topic));
    let score = 0;
    if (isWeak) score += 2;
    if (felt === 'hard') score += 2;
    if (felt === 'easy') score -= 1;
    if (item.is_priority) score += 1;
    return score;
  };
  const ranked = items.map((item, index) => ({ item, index, score: difficultyOf(item) }));
  ranked.sort((a, b) => (mood === 'energetic' ? b.score - a.score : a.score - b.score) || a.index - b.index);
  return ranked.map((entry) => entry.item);
}
