/**
 * Backlog recovery (§8). Rules encoded here:
 *  - NEVER expose the total backlog count — callers get today's slice only.
 *  - Overdue reviews are silently spread across upcoming days in chunks.
 *  - >50 unreviewed doubts → suggest a "clear session" before adding more (§12).
 */
import type { Doubt } from '../data/types';
import { updateDoubt } from '../data/doubts';
import { addDaysIso, todayIso, isDueTodayOrEarlier } from '../lib/dates';

export const DAILY_REVIEW_CAP = 10;
export const DRAIN_THRESHOLD = 50;

/**
 * Pick today's review queue from all active doubts. Anything due beyond the
 * cap is rescheduled forward in cap-sized chunks — quietly, and persisted so
 * tomorrow's queue is already sane. Returns ONLY today's cards.
 */
export async function planTodaysReviews(activeDoubts: Doubt[]): Promise<Doubt[]> {
  const due = activeDoubts
    .filter((d) => d.status === 'active' && isDueTodayOrEarlier(d.fsrs_due_date))
    .sort((a, b) => (a.fsrs_due_date ?? '').localeCompare(b.fsrs_due_date ?? ''));

  const today = due.slice(0, DAILY_REVIEW_CAP);
  const overflow = due.slice(DAILY_REVIEW_CAP);

  // Silent spread: chunk the overflow across the next days.
  const base = todayIso();
  for (let i = 0; i < overflow.length; i++) {
    const daysAhead = Math.floor(i / DAILY_REVIEW_CAP) + 1;
    const newDue = addDaysIso(base, daysAhead);
    if (overflow[i].fsrs_due_date !== newDue) {
      await updateDoubt({ ...overflow[i], fsrs_due_date: newDue });
    }
  }
  return today;
}

/** 50-doubt drain policy (§12): true → surface a clear session before adding more. */
export function needsDrainSession(activeDoubts: Doubt[]): boolean {
  return activeDoubts.filter((d) => d.status === 'active' && d.review_count === 0).length > DRAIN_THRESHOLD;
}
