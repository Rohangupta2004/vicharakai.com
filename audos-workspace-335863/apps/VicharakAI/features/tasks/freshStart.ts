/**
 * Fresh Start — the one-tap reset Today offers once missed work has sat
 * unfinished for FRESH_START_MIN_DAYS or more. Pure planning only: no React,
 * no data access. useTasks owns the writes.
 *
 * A FULL reset: every pending task and revision due today or earlier (the
 * missed pile, the carried-over rows and today's own unfinished list) is
 * cleared. The lightest of them (shortest, then easiest) come back as ONE
 * task per day — today first, weakest topic first — across the next
 * FRESH_START_SPREAD_DAYS free days, never on or after the exam date. Days
 * that already hold planned work are skipped so no day gets heavier. The
 * rest of the pile is archived, history intact.
 */
import { addDaysISO, diffDays, type StudyItem } from '../../engine';

/** Missed work this many days old (or older) unlocks the Fresh Start button. */
export const FRESH_START_MIN_DAYS = 5;

/** How many days (today first) receive one light task after a Fresh Start. */
export const FRESH_START_SPREAD_DAYS = 7;

/** zuno_meta key holding the light-days window a Fresh Start opened:
 * JSON `{ start, until }` (ISO dates). Today reads it to keep missed-day
 * counters from reaching back past the reset, and to hold Vicharee's own
 * target seeding off while the light days run. */
export const FRESH_START_WINDOW_KEY = 'fresh_start_window';

export interface FreshStartWindow {
  start: string;
  until: string;
}

export function parseFreshStartWindow(raw: string | null | undefined): FreshStartWindow | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { start?: unknown; until?: unknown };
    const start = typeof parsed.start === 'string' ? parsed.start.slice(0, 10) : '';
    const until = typeof parsed.until === 'string' ? parsed.until.slice(0, 10) : '';
    return start && until ? { start, until } : null;
  } catch {
    return null;
  }
}

export interface FreshStartBacklog {
  /** Every pending task or revision due today or earlier — the missed pile,
   * the rows carried onto today and today's own unfinished list. */
  items: StudyItem[];
  /** Whole days since the oldest missed item was due (0 when none). */
  missedDays: number;
  eligible: boolean;
}

export function findFreshStartBacklog(studentItems: StudyItem[], today: string): FreshStartBacklog {
  const items = studentItems.filter(
    (item) => item.status === 'pending' && !item.pending_sync && item.id > 0 && item.scheduled_for <= today,
  );
  const oldest = items
    .map((item) => item.scheduled_for)
    .filter((date) => date < today)
    .sort()[0];
  const missedDays = oldest ? Math.max(0, diffDays(oldest, today)) : 0;
  return { items, missedDays, eligible: Boolean(oldest) && missedDays >= FRESH_START_MIN_DAYS };
}

export interface FreshStartPlan {
  /** One item per free day, today first, weakest topic first. */
  moves: Array<{ item: StudyItem; date: string }>;
  /** The rest of the pile — archived, never deleted. */
  archived: StudyItem[];
  /** The last day that received a task (null when nothing was kept). */
  lastDay: string | null;
}

export function planFreshStart({
  backlog,
  today,
  examDate,
  busyDates,
  minutesOf,
  easeOf,
  weaknessOf,
}: {
  backlog: StudyItem[];
  today: string;
  /** The fixed exam date, or null when the student has none. A date already
   * in the past is stale and does not bound the plan. */
  examDate: string | null;
  /** Future days that already hold pending work outside the pile. */
  busyDates: Set<string>;
  /** Estimated minutes for the item — shorter is lighter. */
  minutesOf: (item: StudyItem) => number;
  /** How hard the topic felt — lower is easier (0 easy · 1 unknown · 2 hard). */
  easeOf: (item: StudyItem) => number;
  /** How weak the topic is — higher is weaker. */
  weaknessOf: (item: StudyItem) => number;
}): FreshStartPlan {
  const examEve = examDate && examDate > today ? addDaysISO(examDate, -1) : null;
  const dates: string[] = [];
  for (let offset = 0; dates.length < FRESH_START_SPREAD_DAYS && offset < FRESH_START_SPREAD_DAYS * 3; offset += 1) {
    const date = addDaysISO(today, offset);
    if (examEve && date > examEve) break;
    if (offset === 0 || !busyDates.has(date)) dates.push(date);
  }
  const capacity = Math.min(backlog.length, dates.length);

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
  const moves = ordered.map((item, index) => ({ item, date: dates[index] }));
  return { moves, archived, lastDay: moves.length > 0 ? moves[moves.length - 1].date : null };
}
