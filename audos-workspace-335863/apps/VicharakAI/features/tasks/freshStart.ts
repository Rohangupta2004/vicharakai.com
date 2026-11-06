/**
 * Fresh Start — the one-tap reset Today offers once missed work has sat
 * unfinished for FRESH_START_MIN_DAYS or more. Pure planning only: no React,
 * no data access. useTasks owns the writes.
 *
 * The bounded-revision-budget rule: the pile never comes back as a pile.
 * Every upcoming day receives exactly ONE task from it, weakest topic first,
 * and nothing is ever placed on or after the exam date. When the days before
 * the exam cannot hold the whole pile, the lightest tasks (shortest, then
 * easiest) are the ones kept; the rest are archived, history intact.
 */
import { addDaysISO, diffDays, type StudyItem } from '../../engine';

/** Missed work this many days old (or older) unlocks the Fresh Start button. */
export const FRESH_START_MIN_DAYS = 5;

export interface FreshStartBacklog {
  /** Every pending task or revision still sitting on a past day, plus the
   * ones carried onto today under "From yesterday". */
  items: StudyItem[];
  /** Whole days since the oldest missed item was due (0 when none). */
  missedDays: number;
  eligible: boolean;
}

export function findFreshStartBacklog(
  studentItems: StudyItem[],
  carriedIds: Set<number>,
  today: string,
): FreshStartBacklog {
  const items = studentItems.filter(
    (item) =>
      item.status === 'pending' &&
      !item.pending_sync &&
      item.id > 0 &&
      (item.scheduled_for < today || (item.scheduled_for === today && carriedIds.has(item.id))),
  );
  const oldest = items
    .map((item) => item.scheduled_for)
    .filter((date) => date < today)
    .sort()[0];
  const missedDays = oldest ? Math.max(0, diffDays(oldest, today)) : 0;
  return { items, missedDays, eligible: Boolean(oldest) && missedDays >= FRESH_START_MIN_DAYS };
}

export interface FreshStartPlan {
  /** One item per upcoming day, starting tomorrow, weakest topic first. */
  moves: Array<{ item: StudyItem; date: string }>;
  /** Items that could not fit before the exam — archived, never deleted. */
  archived: StudyItem[];
  /** The last day an item may land on (the day before the exam), if bounded. */
  lastDay: string | null;
}

export function planFreshStart({
  backlog,
  today,
  examDate,
  minutesOf,
  easeOf,
  weaknessOf,
}: {
  backlog: StudyItem[];
  today: string;
  /** The fixed exam date, or null when the student has none. A date already
   * in the past is stale and does not bound the plan. */
  examDate: string | null;
  /** Estimated minutes for the item — shorter is lighter. */
  minutesOf: (item: StudyItem) => number;
  /** How hard the topic felt — lower is easier (0 easy · 1 unknown · 2 hard). */
  easeOf: (item: StudyItem) => number;
  /** How weak the topic is — higher is weaker. */
  weaknessOf: (item: StudyItem) => number;
}): FreshStartPlan {
  const lastDay = examDate && examDate > today ? addDaysISO(examDate, -1) : null;
  const capacity = lastDay ? Math.max(0, diffDays(today, lastDay)) : backlog.length;

  const byOldest = (a: StudyItem, b: StudyItem) => a.scheduled_for.localeCompare(b.scheduled_for) || a.id - b.id;
  const lightestFirst = [...backlog].sort(
    (a, b) =>
      minutesOf(a) - minutesOf(b) ||
      easeOf(a) - easeOf(b) ||
      weaknessOf(b) - weaknessOf(a) ||
      byOldest(a, b),
  );
  const kept = lightestFirst.slice(0, capacity);
  const archived = lightestFirst.slice(capacity);

  const ordered = [...kept].sort(
    (a, b) =>
      weaknessOf(b) - weaknessOf(a) ||
      minutesOf(a) - minutesOf(b) ||
      easeOf(a) - easeOf(b) ||
      byOldest(a, b),
  );
  const moves = ordered.map((item, index) => ({ item, date: addDaysISO(today, index + 1) }));
  return { moves, archived, lastDay };
}
