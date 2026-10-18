/**
 * Pace engine (§4): "Am I on track?" nightly signal + self-correcting time
 * estimates (§12). Observed completion speed is a per-subject EMA of
 * actual/estimated time; the projection uses corrected hours.
 */
import type { StudyTask } from '../data/types';
import { kvGet, kvSet } from '../data/kv';
import { todayIso, diffDays } from '../lib/dates';

/* ---- Self-correcting speed stats (§12) ---- */

interface SpeedStats {
  /** subject → EMA of (actual hours / estimated hours). 1 = estimates are right. */
  factors: Record<string, number>;
  /** local date → corrected est_hours completed that day (rolling window). */
  daily: Record<string, number>;
}

const KEY = 'speed_stats';
const EMA_ALPHA = 0.3;
const WINDOW_DAYS = 14;

async function getStats(): Promise<SpeedStats> {
  return (await kvGet<SpeedStats>(KEY)) ?? { factors: {}, daily: {} };
}

/** Called by the scheduler whenever a study task completes. */
export async function recordCompletion(task: StudyTask): Promise<void> {
  const stats = await getStats();
  if (task.actual_minutes && task.est_hours > 0) {
    const ratio = task.actual_minutes / 60 / task.est_hours;
    const prev = stats.factors[task.subject] ?? 1;
    stats.factors[task.subject] = prev * (1 - EMA_ALPHA) + ratio * EMA_ALPHA;
  }
  const today = todayIso();
  stats.daily[today] = (stats.daily[today] ?? 0) + task.est_hours;
  // Trim the rolling window so the kv blob stays small.
  for (const date of Object.keys(stats.daily)) {
    if (diffDays(date, today) > WINDOW_DAYS * 3) delete stats.daily[date];
  }
  await kvSet(KEY, stats);
}

/** Corrected estimate for planning: bundle hours × observed subject factor. */
export async function effectiveEstHours(subject: string, estHours: number): Promise<number> {
  const stats = await getStats();
  return estHours * (stats.factors[subject] ?? 1);
}

/**
 * Remaining corrected study hours for an exam: chapters with no completed
 * study task, weighted by the observed per-subject speed factor.
 */
export async function remainingEstHoursForExam(examId: string): Promise<number> {
  const { listConcepts } = await import('../data/concepts');
  const { deriveChapters } = await import('../registry/syllabusParser');
  const { listStudyTasks } = await import('../data/tasks');
  const chapters = deriveChapters(await listConcepts(examId));
  const tasks = await listStudyTasks(examId);
  const covered = new Set(tasks.filter((t) => t.completed_at).map((t) => `${t.subject}::${t.chapter}`));
  let remaining = 0;
  for (const ch of chapters) {
    if (!covered.has(`${ch.subject}::${ch.chapter}`)) {
      remaining += await effectiveEstHours(ch.subject, ch.est_hours);
    }
  }
  return remaining;
}

/* ---- Pace signal (§4) ---- */

export type PaceLevel = 'green' | 'amber' | 'red' | 'none';

export interface PaceSignal {
  level: PaceLevel;
  label: string;
}

export async function computePaceSignal(input: {
  examDate: string | null;
  remainingEstHours: number;
}): Promise<PaceSignal> {
  const { examDate, remainingEstHours } = input;
  if (!examDate) return { level: 'none', label: 'Set your exam date in Settings to see pace.' };
  if (remainingEstHours <= 0) return { level: 'green', label: 'On track — syllabus covered.' };

  const stats = await getStats();
  const today = todayIso();
  const recent = Object.entries(stats.daily).filter(([d]) => diffDays(d, today) <= WINDOW_DAYS);
  const hoursLogged = recent.reduce((s, [, h]) => s + h, 0);
  if (hoursLogged <= 0) return { level: 'none', label: 'Complete a few tasks and pace shows up here.' };

  const dailyRate = hoursLogged / WINDOW_DAYS;
  const daysNeeded = Math.ceil(remainingEstHours / Math.max(0.1, dailyRate));
  const daysLeft = Math.max(0, diffDays(today, examDate));
  const delta = daysNeeded - daysLeft;

  if (delta <= 0) return { level: 'green', label: 'On track.' };
  if (delta <= 10) return { level: 'amber', label: `${delta} day${delta === 1 ? '' : 's'} behind.` };
  return { level: 'red', label: `At current pace you'll finish ${delta} days after your exam.` };
}
