/**
 * metrics — the ONE module that computes every student-facing count.
 *
 * RULE: no screen calculates its own count. Every surface that quotes a
 * number (Today, Dashboard, Weekly Targets, the desktop rail, the coach)
 * reads the SAME StudyMetrics snapshot from StudentDataContext, so no two
 * screens can ever show different numbers for the same metric.
 *
 * Metric names are deliberate and distinct — use them verbatim in UI code so
 * a reader can tell WHICH number a surface is quoting:
 *   · topicsCovered      — lifetime distinct topics completed (never resets)
 *   · topicsDone7d       — distinct topics completed in the last 7 days
 *   · revisionsDueToday  — today's visible revision slice (the day's ask)
 *   · mistakesUnresolved — Mistake Book entries still without an answer
 *
 * Weekly targets CAP AT THE TARGET: a student who did 9 against a target of
 * 5 sees "5/5 · complete", never "9/5" — the extra work still counts in
 * topicsDone7d/topicsCovered, but a goal is either met or not.
 *
 * Pure derivations — no React, no data access, zero AI.
 */

import { diffDays, localDayOf, topicKey, type StudyItem, type TaskAnnotation } from '../../engine';
import { estimateRetention, estimateTimeSaved } from '../../revisionEngine';
import { REVISION_ITEM_MINUTES } from '../../config/revision';
import { flaggedHasSolution, type FlaggedRow, type WeeklyTargetRow } from '../../mcq';

/** True when `iso` falls inside the Mon→Sun week starting on `weekStart`.
 * (Local copy of WeeklyGoals.inWeek — kept here so metrics stays leaf-level
 * with no import cycle back into UI modules.) */
function inWeek(iso: string, weekStart: string): boolean {
  const diff = diffDays(weekStart, iso);
  return diff >= 0 && diff <= 6;
}

/* ------------------------------------------------------------------ */
/*  Goal display capping                                               */
/* ------------------------------------------------------------------ */

export interface GoalProgress {
  /** The real completion count (uncapped — for internal maths only). */
  done: number;
  target: number;
  /** What every screen RENDERS: min(done, target). 5/5, never 9/5. */
  display: number;
  /** Percent for progress bars, capped at 100. */
  percent: number;
  complete: boolean;
}

/** THE one way a weekly goal is turned into display numbers. */
export function goalProgress(done: number, target: number): GoalProgress {
  const safeTarget = Number.isFinite(target) && target > 0 ? Math.round(target) : 0;
  const safeDone = Number.isFinite(done) && done > 0 ? Math.round(done) : 0;
  const display = safeTarget > 0 ? Math.min(safeDone, safeTarget) : safeDone;
  return {
    done: safeDone,
    target: safeTarget,
    display,
    percent: safeTarget > 0 ? Math.min(100, Math.round((safeDone / safeTarget) * 100)) : 0,
    complete: safeTarget > 0 && safeDone >= safeTarget,
  };
}

/* ------------------------------------------------------------------ */
/*  The snapshot                                                       */
/* ------------------------------------------------------------------ */

export interface WeeklyTimeSaved {
  /** Minutes actually spent on completed revisions this week. */
  revisionMinutes: number;
  /** Estimated minutes of future relearning those revisions avoided. */
  relearnAvoidedMinutes: number;
  /** How many revisions were completed this week. */
  revisionsDone: number;
}

export interface StudyMetrics {
  /** Lifetime distinct topics completed — never resets, only grows. */
  topicsCovered: number;
  /** Distinct topics completed in the last 7 days (today inclusive). */
  topicsDone7d: number;
  /** Today's visible revision slice — the day's ask, never the backlog. */
  revisionsDueToday: number;
  /** Mistake Book entries still waiting for the student's own answer. */
  mistakesUnresolved: number;
  /** This week's topic goal, capped at the target for display. */
  weeklyTopics: GoalProgress;
  /** This week's test goal, capped at the target for display. */
  weeklyTests: GoalProgress;
  /** The week's revision payback — feeds the Dashboard roll-up line. */
  weeklyTimeSaved: WeeklyTimeSaved;
}

export interface MetricsArgs {
  studentItems: StudyItem[];
  annotations: Map<string, TaskAnnotation>;
  /** Today's prioritized revision slice (StudentDataContext.dueRevisions). */
  dueRevisions: StudyItem[];
  /** Queued Mistake Book rows (status 'queued'). */
  flaggedRows: FlaggedRow[];
  weeklyRow: WeeklyTargetRow | null;
  weeklyTopicsDone: number;
  weeklyTestsDone: number;
  weekStart: string;
  today: string;
}

function toCount(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Estimated payback of every revision completed this week — the same decay
 * model that schedules them (see revisionEngine.estimateTimeSaved). */
export function computeWeeklyTimeSaved(
  studentItems: StudyItem[],
  annotations: Map<string, TaskAnnotation>,
  weekStart: string,
  today: string,
): WeeklyTimeSaved {
  let revisionMinutes = 0;
  let relearnAvoidedMinutes = 0;
  let revisionsDone = 0;
  for (const item of studentItems) {
    if (item.kind !== 'revision' || item.status !== 'done' || !item.completed_at) continue;
    const completedOn = localDayOf(item.completed_at);
    if (!completedOn || !inWeek(completedOn, weekStart) || completedOn > today) continue;
    const ann = annotations.get(item.source_key || topicKey(item.subject, item.topic));
    const minutes = ann?.minutes && ann.minutes > 0 ? ann.minutes : REVISION_ITEM_MINUTES;
    const elapsed = item.studied_on ? Math.max(0, diffDays(item.studied_on, completedOn)) : 0;
    const stability = Number(item.interval_days) > 0 ? Number(item.interval_days) : 7;
    const estimate = estimateTimeSaved(minutes, estimateRetention(elapsed, stability));
    revisionMinutes += estimate.nowMinutes;
    relearnAvoidedMinutes += estimate.savedMinutes;
    revisionsDone += 1;
  }
  return { revisionMinutes, relearnAvoidedMinutes, revisionsDone };
}

/** Assemble the one metrics snapshot every screen reads. */
export function computeStudyMetrics(args: MetricsArgs): StudyMetrics {
  const { studentItems, annotations, dueRevisions, flaggedRows, weeklyRow, today, weekStart } = args;

  const coveredKeys = new Set<string>();
  const recentKeys = new Set<string>();
  for (const item of studentItems) {
    if (item.kind !== 'new' || item.status !== 'done') continue;
    const key = item.source_key || topicKey(item.subject, item.topic);
    coveredKeys.add(key);
    const completedOn = localDayOf(item.completed_at);
    if (completedOn && diffDays(completedOn, today) <= 6 && completedOn <= today) recentKeys.add(key);
  }

  const mistakesUnresolved = flaggedRows.filter((row) => !flaggedHasSolution(row)).length;

  return {
    topicsCovered: coveredKeys.size,
    topicsDone7d: recentKeys.size,
    revisionsDueToday: dueRevisions.length,
    mistakesUnresolved,
    weeklyTopics: goalProgress(args.weeklyTopicsDone, weeklyRow ? toCount(weeklyRow.topic_target) : 0),
    weeklyTests: goalProgress(args.weeklyTestsDone, weeklyRow ? toCount(weeklyRow.test_target) : 0),
    weeklyTimeSaved: computeWeeklyTimeSaved(studentItems, annotations, weekStart, today),
  };
}
