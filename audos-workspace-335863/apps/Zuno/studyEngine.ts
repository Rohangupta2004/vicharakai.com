/**
 * VicharakAI's unified study-state + planning engine (deterministic — no LLM).
 *
 * This module is the single place where "what is the student's preparation
 * state right now?" is answered, and every consumer — Today, the coach's
 * deterministic quick answers, and the AI layer's system context — reads the
 * SAME snapshot, so Dashboard ≠ Calendar ≠ AI ≠ Syllabus can never happen.
 *
 * It builds ONLY on the existing sources of truth:
 *   • zuno_items rows (tasks + spaced revisions)          — engine.ts shapes
 *   • zuno_sessions rows (recorded study time)            — engine.ts shapes
 *   • zuno_test_scores / zuno_scores (merged ScoreEntry)  — engine.ts shapes
 *   • zuno_test_results (Test Mode breakdowns)            — mcq.ts shapes
 *   • zuno_question_queue (saved doubts)                  — mcq.ts shapes
 *   • zuno_task_feedback (hard/medium/easy)               — App.tsx feelings map
 *   • zuno_weak_topics / zuno_exam_progress via the       — adaptationEngine.ts
 *     WeakTopicInsight + ReadinessScore the app already computes
 *
 * Principle: the engine calculates reality; the AI only interprets and
 * communicates it. Nothing here writes to the database.
 */

import {
  completedSyllabusTopicCount,
  diffDays,
  dueRevisions as dueRevisionsOf,
  estimatedMinutes,
  formatDuration,
  inferDailyTargetMinutes,
  minutesOnDate,
  sessionMinutes,
  topicKey,
  type PaceSignal,
  type ScoreEntry,
  type StudyItem,
  type StudySession,
  type TaskAnnotation,
  type TaskFeeling,
} from './engine';
import { groupDoubtSignals } from './analytics';
import {
  WEAK_TOPIC_THRESHOLD,
  adaptiveContextForTopic,
  type FlaggedRow,
  type TestResultRow,
} from './mcq';
import type { ReadinessScore, WeakTopicInsight } from './adaptationEngine';
import { chapterWeightage } from './weightage';
import { examTopicCount, type ExamDef } from './syllabus';

/* ------------------------------------------------------------------ */
/*  Unified student state                                              */
/* ------------------------------------------------------------------ */

export interface StudentStateArgs {
  /** The student's real items (App.tsx's studentItems — already filtered). */
  items: StudyItem[];
  annotations: Map<string, TaskAnnotation>;
  sessions: StudySession[];
  scoreEntries: ScoreEntry[];
  testResults: TestResultRow[];
  /** Queued doubts (zuno_question_queue rows with status 'queued'). */
  doubts: FlaggedRow[];
  /** Post-task difficulty signals keyed by source_key. */
  feelings: Map<string, TaskFeeling>;
  weakInsights: WeakTopicInsight[];
  readiness: ReadinessScore | null;
  examDef: ExamDef | undefined;
  /** The profile exam id — drives static weightage lookups. */
  examId: string;
  examDate: string;
  today: string;
  /** Student-set daily hour goal, in minutes (null when unset). */
  dailyGoalMinutes: number | null;
  /** "I only have 2 hours today" — an explicit capacity override, minutes. */
  capacityOverrideMinutes: number | null;
}

export type CapacitySource = 'override' | 'goal' | 'recorded' | 'inferred';

export interface StudentState {
  args: StudentStateArgs;
  today: string;
  daysToExam: number;
  /** Revisions due or overdue today (deduped, oldest first — engine.ts rules). */
  dueRevisions: StudyItem[];
  /** Subset of dueRevisions that slipped 1+ days, with how late each is. */
  overdueRevisions: Array<{ item: StudyItem; overdueDays: number }>;
  /** New tasks scheduled for today, still pending. */
  todayTasks: StudyItem[];
  /** New tasks scheduled before today, still pending (the backlog). */
  overdueTasks: Array<{ item: StudyItem; daysLate: number }>;
  /** Minutes the student can realistically study today. */
  capacityMinutes: number;
  capacitySource: CapacitySource;
  /** Minutes already recorded today. */
  recordedTodayMinutes: number;
  /** Recurring doubt groups, most doubts first (from analytics). */
  doubtGroups: Array<{ subject: string; chapter: string; count: number; latest: string }>;
  /** topicKey → chapter name + static weightage % (when the syllabus knows it). */
  chapterByTopicKey: Map<string, { chapter: string; weightPct: number | null }>;
  /** Topics completed at least once (you can only revise what you studied). */
  studiedKeys: Set<string>;
  /** Coverage: completed new-topic keys vs the exam's total granular topics. */
  coverage: { done: number; total: number; percent: number };
}

/** Minutes one pending item is expected to take (student's own value wins). */
export function estimateItemMinutes(
  item: StudyItem,
  annotations: Map<string, TaskAnnotation>,
): number {
  const ann = annotations.get(item.source_key || topicKey(item.subject, item.topic));
  return ann?.minutes && ann.minutes > 0 ? ann.minutes : estimatedMinutes(ann?.type, item.kind);
}

/** Assemble the one snapshot every intelligent feature reads. */
export function buildStudentState(args: StudentStateArgs): StudentState {
  const { items, examDef, today, sessions } = args;

  const due = dueRevisionsOf(items, today);
  const overdueRevisions = due
    .map((item) => ({ item, overdueDays: Math.max(0, diffDays(item.scheduled_for, today)) }))
    .filter((entry) => entry.overdueDays >= 1)
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const todayTasks = items.filter(
    (i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for === today,
  );
  const overdueTasks = items
    .filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for < today)
    .map((item) => ({ item, daysLate: Math.max(1, diffDays(item.scheduled_for, today)) }))
    .sort((a, b) => b.daysLate - a.daysLate);

  /* Capacity — explicit override > the student's own goal > what they have
   * actually been recording > what the syllabus-vs-exam-date maths implies. */
  const studiedKeys = new Set(
    items
      .filter((i) => i.kind === 'new' && i.status === 'done')
      .map((i) => i.source_key || topicKey(i.subject, i.topic)),
  );
  const totalTopics = examDef ? examTopicCount(examDef) : 0;
  const daysToExam = Math.max(0, diffDays(today, args.examDate));
  /* Coverage counts against the syllabus with the SAME rule the Dashboard's
   * subject progress uses (chapter-as-one-task covers its topics; free-text
   * tasks that match nothing count towards neither), so the coach can never
   * quote a coverage percent that disagrees with the Dashboard. */
  const coveredTopics = completedSyllabusTopicCount(examDef, items);
  const remainingTopics = Math.max(0, totalTopics - coveredTopics);

  let capacityMinutes: number;
  let capacitySource: CapacitySource;
  if (args.capacityOverrideMinutes && args.capacityOverrideMinutes > 0) {
    capacityMinutes = args.capacityOverrideMinutes;
    capacitySource = 'override';
  } else if (args.dailyGoalMinutes && args.dailyGoalMinutes > 0) {
    capacityMinutes = args.dailyGoalMinutes;
    capacitySource = 'goal';
  } else {
    /* Average of the last 7 days of recorded time, when the habit exists. */
    let windowMinutes = 0;
    const loggedDays = new Set<string>();
    for (const s of sessions) {
      if (s.logged_on <= today && diffDays(s.logged_on, today) <= 6) {
        windowMinutes += sessionMinutes(s);
        loggedDays.add(s.logged_on);
      }
    }
    if (loggedDays.size >= 2) {
      capacityMinutes = Math.max(30, Math.round(windowMinutes / Math.max(1, loggedDays.size)));
      capacitySource = 'recorded';
    } else {
      capacityMinutes = inferDailyTargetMinutes(remainingTopics, daysToExam);
      capacitySource = 'inferred';
    }
  }

  /* topicKey → chapter + weightage, so priorities can cite "where the marks are". */
  const chapterByTopicKey = new Map<string, { chapter: string; weightPct: number | null }>();
  if (examDef) {
    for (const subject of examDef.subjects) {
      for (const chapter of subject.chapters) {
        const weightPct = chapterWeightage(args.examId, subject.name, chapter.name);
        chapterByTopicKey.set(topicKey(subject.name, chapter.name), { chapter: chapter.name, weightPct });
        for (const topic of chapter.topics) {
          chapterByTopicKey.set(topicKey(subject.name, topic), { chapter: chapter.name, weightPct });
        }
      }
    }
  }

  return {
    args,
    today,
    daysToExam,
    dueRevisions: due,
    overdueRevisions,
    todayTasks,
    overdueTasks,
    capacityMinutes,
    capacitySource,
    recordedTodayMinutes: minutesOnDate(sessions, today),
    doubtGroups: groupDoubtSignals(args.doubts),
    chapterByTopicKey,
    studiedKeys,
    coverage: {
      done: coveredTopics,
      total: totalTopics,
      percent: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Priority engine — scores stay internal, reasons are human          */
/* ------------------------------------------------------------------ */

export interface PrioritizedItem {
  item: StudyItem;
  /** Internal ranking score — never shown raw to the student. */
  score: number;
  /** Human, data-grounded reasons ("revision overdue by 2 days", …). */
  reasons: string[];
  estMinutes: number;
}

/** Fuzzy word-overlap match between a weak-topic name and an item topic. */
function topicMatches(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const words = na.split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
  return words.length > 0 && words.some((w) => nb.includes(w));
}

/**
 * Rank every actionable pending item (today's tasks, due revisions, the
 * backlog) by evidence: overdue days, weakness signals, recent test accuracy,
 * exam weightage, recurring doubts and the student's own "felt hard" signal.
 */
export function buildPriorityQueue(state: StudentState): PrioritizedItem[] {
  const { args } = state;
  const overdueDaysByItem = new Map<number, number>();
  for (const entry of state.overdueRevisions) overdueDaysByItem.set(entry.item.id, entry.overdueDays);
  for (const entry of state.overdueTasks) overdueDaysByItem.set(entry.item.id, entry.daysLate);

  const pending: StudyItem[] = [
    ...state.dueRevisions,
    ...state.todayTasks,
    ...state.overdueTasks.map((entry) => entry.item),
  ];

  const seen = new Set<number>();
  const queue: PrioritizedItem[] = [];
  for (const item of pending) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const key = item.source_key || topicKey(item.subject, item.topic);
    let score = 0;
    const reasons: string[] = [];

    if (item.kind === 'revision') {
      const late = overdueDaysByItem.get(item.id) ?? 0;
      if (late >= 1) {
        score += 40 + late * 6;
        reasons.push(`revision overdue by ${late} day${late === 1 ? '' : 's'}`);
      } else {
        score += 30;
        const ago = item.studied_on ? diffDays(item.studied_on, state.today) : null;
        reasons.push(
          ago !== null && ago > 0
            ? `revision due today — you last studied it ${ago} day${ago === 1 ? '' : 's'} ago`
            : 'revision due today',
        );
      }
    } else if (item.scheduled_for === state.today) {
      score += 20;
      reasons.push('planned for today');
    } else {
      const late = overdueDaysByItem.get(item.id) ?? 1;
      score += 18 + Math.min(12, late * 2);
      reasons.push(`carried over — planned ${late} day${late === 1 ? '' : 's'} ago`);
    }

    /* Weakness evidence: the adaptation engine's flags first, then accuracy. */
    const weak = args.weakInsights.find(
      (w) => topicMatches(w.topicName, item.topic) || (w.chapterName ? topicMatches(w.chapterName, item.topic) : false),
    );
    if (weak) {
      score += Math.min(30, Math.max(10, Math.round(weak.weaknessScore / 3)));
      reasons.push(`flagged weak — ${weak.reason}`);
    }
    const ctx = adaptiveContextForTopic(args.testResults, item.subject, item.topic);
    if (ctx && ctx.accuracy < WEAK_TOPIC_THRESHOLD) {
      score += Math.round((WEAK_TOPIC_THRESHOLD - ctx.accuracy) / 2);
      reasons.push(`recent test accuracy ${ctx.accuracy}%`);
    }

    /* Exam weightage — where the marks actually are. */
    const chapterInfo = state.chapterByTopicKey.get(key);
    if (chapterInfo?.weightPct && chapterInfo.weightPct >= 5) {
      score += 8;
      reasons.push(`high-weightage chapter (~${chapterInfo.weightPct}% of the exam)`);
    }

    /* Recurring doubts on this ground. */
    const doubtGroup = state.doubtGroups.find(
      (g) => g.subject.toLowerCase() === item.subject.toLowerCase() && topicMatches(g.chapter, item.topic),
    );
    if (doubtGroup) {
      score += Math.min(12, doubtGroup.count * 4);
      reasons.push(`${doubtGroup.count} doubt${doubtGroup.count === 1 ? '' : 's'} saved here recently`);
    }

    /* The student's own difficulty signal. */
    if (args.feelings.get(key) === 'hard') {
      score += 6;
      reasons.push('you marked this hard last time');
    }

    queue.push({ item, score, reasons, estMinutes: estimateItemMinutes(item, args.annotations) });
  }
  return queue.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/*  Capacity-aware daily plan — never an impossible day                */
/* ------------------------------------------------------------------ */

export interface DailyPlan {
  mustDo: PrioritizedItem[];
  shouldDo: PrioritizedItem[];
  ifTime: PrioritizedItem[];
  /** Everything that did NOT fit today — stays scheduled, never deleted. */
  deferred: PrioritizedItem[];
  capacityMinutes: number;
  capacitySource: CapacitySource;
  plannedMinutes: number;
  totalPendingMinutes: number;
  /** Honest line shown when the backlog exceeds today's capacity. */
  backlogNote: string | null;
}

const MUST_DO_CAP = 3;
const IF_TIME_CAP = 3;

/**
 * Fit the priority queue into today's realistic capacity. The full backlog is
 * NEVER dumped into one day: what doesn't fit is deferred (still scheduled,
 * still visible in the calendar) and the plan says so honestly.
 */
export function buildDailyPlan(state: StudentState): DailyPlan {
  const queue = buildPriorityQueue(state);
  const capacity = state.capacityMinutes;
  const mustDo: PrioritizedItem[] = [];
  const shouldDo: PrioritizedItem[] = [];
  const ifTime: PrioritizedItem[] = [];
  const deferred: PrioritizedItem[] = [];
  let used = 0;

  for (const entry of queue) {
    if (mustDo.length < MUST_DO_CAP && (used + entry.estMinutes <= capacity || mustDo.length === 0)) {
      mustDo.push(entry);
      used += entry.estMinutes;
    } else if (used + entry.estMinutes <= capacity) {
      shouldDo.push(entry);
      used += entry.estMinutes;
    } else if (ifTime.length < IF_TIME_CAP) {
      ifTime.push(entry);
    } else {
      deferred.push(entry);
    }
  }

  const totalPendingMinutes = queue.reduce((sum, entry) => sum + entry.estMinutes, 0);
  const overflowCount = ifTime.length + deferred.length;
  const backlogNote =
    overflowCount > 0 && totalPendingMinutes > capacity
      ? `You have ${queue.length} pending items (~${formatDuration(totalPendingMinutes)}) against ~${formatDuration(capacity)} available today. Doing everything today isn't realistic, so the ${mustDo.length + shouldDo.length} highest-impact items lead — the rest stay scheduled, nothing is lost.`
      : null;

  return {
    mustDo,
    shouldDo,
    ifTime,
    deferred,
    capacityMinutes: capacity,
    capacitySource: state.capacitySource,
    plannedMinutes: used,
    totalPendingMinutes,
    backlogNote,
  };
}

/** Compact, human rendering of the plan — for the coach and quick answers. */
export function formatDailyPlan(plan: DailyPlan): string {
  const line = (entry: PrioritizedItem) =>
    `${entry.item.kind === 'revision' ? 'Revise ' : ''}${entry.item.topic} (${entry.item.subject}) — ~${formatDuration(entry.estMinutes)} — ${entry.reasons[0] ?? 'on your plan'}`;
  const sections: string[] = [];
  if (plan.mustDo.length > 0) sections.push(`MUST DO:\n${plan.mustDo.map((e, i) => `${i + 1}. ${line(e)}`).join('\n')}`);
  if (plan.shouldDo.length > 0) sections.push(`SHOULD DO:\n${plan.shouldDo.map((e, i) => `${i + 1}. ${line(e)}`).join('\n')}`);
  if (plan.ifTime.length > 0) sections.push(`IF TIME:\n${plan.ifTime.map((e, i) => `${i + 1}. ${line(e)}`).join('\n')}`);
  if (plan.backlogNote) sections.push(plan.backlogNote);
  return sections.join('\n\n') || 'Nothing pending today — add a topic or ask for a pick.';
}

/* ------------------------------------------------------------------ */
/*  "What should I do now?" — inspects the actual current state        */
/* ------------------------------------------------------------------ */

export interface NowRecommendation {
  headline: string;
  reason: string;
  /** What data produced this — for the explainability log. */
  dataUsed: string;
}

/**
 * The spec'd priority ladder: critical overdue revision → high-value weak
 * topic → exam-critical unfinished topic → today's scheduled task →
 * recurring unresolved doubt → a test → lower-priority work.
 */
export function whatShouldIDoNow(state: StudentState): NowRecommendation | null {
  const queue = buildPriorityQueue(state);

  /* 1 · Critical overdue revision. */
  const overdueRev = queue.find((e) => e.item.kind === 'revision' && (state.overdueRevisions.some((o) => o.item.id === e.item.id)));
  if (overdueRev) {
    const late = state.overdueRevisions.find((o) => o.item.id === overdueRev.item.id)?.overdueDays ?? 1;
    return {
      headline: `Revise ${overdueRev.item.topic} (${overdueRev.item.subject}) for ~${formatDuration(overdueRev.estMinutes)} now.`,
      reason: `It's ${late} day${late === 1 ? '' : 's'} overdue${overdueRev.reasons.length > 1 ? ` and ${overdueRev.reasons.slice(1).join(', ')}` : ''} — memory fades fastest right after the due date.`,
      dataUsed: 'your spaced-revision schedule (zuno_items) and its overdue days',
    };
  }

  /* 2 · High-value weak topic that is actionable on the plan. */
  const weakEntry = queue.find((e) => e.reasons.some((r) => r.startsWith('flagged weak') || r.startsWith('recent test accuracy')));
  if (weakEntry) {
    return {
      headline: `${weakEntry.item.kind === 'revision' ? 'Revise' : 'Start'} ${weakEntry.item.topic} (${weakEntry.item.subject}) — ~${formatDuration(weakEntry.estMinutes)}.`,
      reason: `${weakEntry.reasons.join('; ')}. Fixing weak ground moves your score fastest.`,
      dataUsed: 'your weak-topic flags and recent test accuracy',
    };
  }

  /* 3 · Exam-critical unfinished topic (high weightage). */
  const heavy = queue.find((e) => e.reasons.some((r) => r.startsWith('high-weightage')));
  if (heavy) {
    return {
      headline: `Start ${heavy.item.topic} (${heavy.item.subject}) — ~${formatDuration(heavy.estMinutes)}.`,
      reason: `${heavy.reasons.join('; ')}.`,
      dataUsed: "your exam's chapter weightage and your pending plan",
    };
  }

  /* 4 · Today's scheduled task. */
  const planned = queue.find((e) => e.item.kind === 'new');
  if (planned) {
    return {
      headline: `Start ${planned.item.topic} (${planned.item.subject}) — ~${formatDuration(planned.estMinutes)}.`,
      reason: `${planned.reasons.join('; ')}. One focused session clears your biggest task.`,
      dataUsed: "today's plan (zuno_items)",
    };
  }

  /* 4b · Any remaining due revision. */
  if (queue.length > 0) {
    const next = queue[0];
    return {
      headline: `${next.item.kind === 'revision' ? 'Revise' : 'Start'} ${next.item.topic} (${next.item.subject}) — ~${formatDuration(next.estMinutes)}.`,
      reason: `${next.reasons.join('; ')}.`,
      dataUsed: 'your pending plan and revision queue',
    };
  }

  /* 5 · Unresolved recurring doubt. */
  const doubtGroup = state.doubtGroups.find((g) => g.count >= 2) ?? state.doubtGroups[0];
  if (doubtGroup) {
    return {
      headline: `Do a focused ${doubtGroup.chapter} (${doubtGroup.subject}) session — your saved doubts point there.`,
      reason: `You've saved ${doubtGroup.count} doubt${doubtGroup.count === 1 ? '' : 's'} from ${doubtGroup.chapter} recently — clearing the concept beats collecting more doubts.`,
      dataUsed: 'your saved doubts (zuno_question_queue)',
    };
  }

  /* 6 · A test, when the plan is clear and enough is studied. */
  const lastTest = state.args.testResults[0]?.created_on ?? state.args.scoreEntries[state.args.scoreEntries.length - 1]?.taken_on;
  const daysSinceTest = lastTest ? diffDays(String(lastTest).slice(0, 10), state.today) : null;
  if (state.studiedKeys.size >= 3 && (daysSinceTest === null || daysSinceTest >= 7)) {
    return {
      headline: 'Take a short test — 10 questions on your recent topics.',
      reason:
        daysSinceTest === null
          ? `You've completed ${state.studiedKeys.size} topics but never tested them — a test is what turns coverage into marks.`
          : `Your last test was ${daysSinceTest} days ago — fresh accuracy data keeps your weak-topic detection honest.`,
      dataUsed: 'your test history and completed topics',
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  "Am I on track?" — multi-signal verdict, never just the streak     */
/* ------------------------------------------------------------------ */

export type OnTrackLevel = 'on-track' | 'slightly-behind' | 'at-risk' | 'critical';

export interface OnTrackVerdict {
  level: OnTrackLevel;
  label: string;
  /** WHY, with specifics — one line per signal that contributed. */
  reasons: string[];
}

const LEVEL_LABEL: Record<OnTrackLevel, string> = {
  'on-track': 'On track',
  'slightly-behind': 'Slightly behind',
  'at-risk': 'At risk',
  critical: 'Critical',
};

/** Average percent of the last `n` score entries (chronological input). */
function recentAverage(entries: ScoreEntry[], n: number, skip = 0): number | null {
  const slice = entries.slice(Math.max(0, entries.length - n - skip), entries.length - skip);
  if (slice.length === 0) return null;
  return Math.round(slice.reduce((sum, e) => sum + e.percent, 0) / slice.length);
}

/**
 * Fold syllabus pace (computePace — coverage + hours) together with revision
 * backlog, test trend and weak-topic pressure into one honest verdict.
 */
export function assessOnTrack(state: StudentState, pace: PaceSignal): OnTrackVerdict {
  let severity = pace.status === 'green' ? 0 : pace.status === 'amber' ? 1 : 2;
  const reasons: string[] = [];

  reasons.push(pace.detail);
  if (pace.hours) reasons.push(pace.hours.line);

  /* Revision backlog pressure. */
  const overdueCount = state.overdueRevisions.length;
  const backlogMinutes = state.overdueRevisions.reduce(
    (sum, entry) => sum + estimateItemMinutes(entry.item, state.args.annotations),
    0,
  );
  if (overdueCount >= 3) {
    reasons.push(
      `${overdueCount} revisions are overdue (~${formatDuration(backlogMinutes)} of recall work) — overdue revisions decay fastest.`,
    );
    if (overdueCount >= 8 || backlogMinutes > state.capacityMinutes * 2) severity += 1;
  } else if (overdueCount > 0) {
    reasons.push(`${overdueCount} revision${overdueCount === 1 ? '' : 's'} overdue — clear ${overdueCount === 1 ? 'it' : 'them'} first today.`);
  }

  /* Test trend. */
  const recent = recentAverage(state.args.scoreEntries, 3);
  const previous = recentAverage(state.args.scoreEntries, 3, 3);
  if (recent !== null && previous !== null) {
    if (recent + 8 < previous) {
      reasons.push(`Your test average slipped from ${previous}% to ${recent}% over the last few tests.`);
      severity += 1;
    } else if (recent > previous + 5) {
      reasons.push(`Your test average climbed from ${previous}% to ${recent}% — the work is landing.`);
    }
  } else if (recent !== null) {
    reasons.push(`Recent test average: ${recent}%.`);
  }

  /* Weak-topic pressure. */
  const weakCount = state.args.weakInsights.length;
  if (weakCount >= 4) {
    reasons.push(`${weakCount} topics are currently flagged weak — worth a weak-topic test this week.`);
  }

  const level: OnTrackLevel =
    severity <= 0 ? 'on-track' : severity === 1 ? 'slightly-behind' : severity === 2 ? 'at-risk' : 'critical';
  return { level, label: LEVEL_LABEL[level], reasons };
}

/* ------------------------------------------------------------------ */
/*  Readiness estimate — always labelled as an estimate                */
/* ------------------------------------------------------------------ */

/**
 * One honest line about estimated readiness. Never a predicted score — the
 * label always says what it is based on, and says when data is missing.
 */
export function readinessLine(state: StudentState): string {
  const readiness = state.args.readiness;
  const tests = state.args.scoreEntries.length + state.args.testResults.length;
  if (!readiness || (readiness.readinessPct === 0 && state.coverage.done === 0)) {
    return 'Not enough data for a readiness estimate yet — complete a few topics and take one test, and it unlocks.';
  }
  const parts = [`tracked chapter mastery`, `${state.coverage.percent}% syllabus coverage`];
  if (tests > 0) parts.push(`${tests} logged test${tests === 1 ? '' : 's'}`);
  return `Estimated preparation readiness: ${readiness.readinessPct}% — based on your ${parts.join(', ')}. This is an estimate from your own tracked data, not a predicted exam score.`;
}

/* ------------------------------------------------------------------ */
/*  Backlog listing — for "show me what I'm behind on"                 */
/* ------------------------------------------------------------------ */

export function describeBacklog(state: StudentState): string {
  const rows: string[] = [];
  for (const entry of state.overdueRevisions) {
    rows.push(`Revise: ${entry.item.topic} (${entry.item.subject}) — ${entry.overdueDays} day${entry.overdueDays === 1 ? '' : 's'} overdue`);
  }
  for (const entry of state.overdueTasks) {
    rows.push(`${entry.item.topic} (${entry.item.subject}) — planned ${entry.daysLate} day${entry.daysLate === 1 ? '' : 's'} ago`);
  }
  if (rows.length === 0) {
    return "You're not behind on anything — no overdue revisions and no carried-over tasks. Today's plan is all that's on your plate.";
  }
  const shown = rows.slice(0, 8);
  const more = rows.length - shown.length;
  return `You're behind on ${rows.length} item${rows.length === 1 ? '' : 's'}:\n${shown.map((r, i) => `${i + 1}. ${r}`).join('\n')}${more > 0 ? `\n…and ${more} more.` : ''}\nSay "postpone <task>" to move one, or ask me to plan your day and I'll fit the highest-impact ones into your time.`;
}

/* ------------------------------------------------------------------ */
/*  Doubt-recurrence surfacing                                         */
/* ------------------------------------------------------------------ */

/** "You've had 3 doubts from Kinematics this week" — or null when quiet. */
export function recurringDoubtLine(state: StudentState): string | null {
  const hot = state.doubtGroups.find((g) => g.count >= 2 && diffDays(g.latest.slice(0, 10), state.today) <= 7);
  if (!hot) return null;
  return `You've saved ${hot.count} doubts from ${hot.chapter} (${hot.subject}) recently — it may be worth a focused revision on that chapter before moving on.`;
}
