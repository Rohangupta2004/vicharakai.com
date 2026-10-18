/**
 * VicharakAI's plan + spaced-revision engine (client side).
 *
 * Mirrors the logic in the server-function hooks (zuno-today, zuno-mark-done,
 * zuno-history) so the app and VicharakAI Coach act on exactly the same rules:
 *  - Week-1 targets come from the syllabus alone — no long forms.
 *  - Completing a topic stamps studied_on and queues revisions at
 *    +1, +3, +5, +7 and +14 days from the ACTUAL study date.
 *  - The Top-5 daily formula surfaces exactly five revision items every day.
 *  - The pace signal answers "Am I on track?" honestly against the exam date.
 *
 * VicharakAI's coaching is fully available from day one. There is no gate, unlock,
 * countdown or milestone anywhere in this file or the product; personalization
 * simply deepens as the student studies.
 */

import { examTopicCount, inferSubjectForTopic, subjectTopics, type ExamDef } from './syllabus';

export const REVISION_INTERVALS = [1, 3, 5, 7, 14];
export const TOPICS_PER_DAY = 3;
/** Exactly this many spaced-revision items are shown every day (the daily formula). */
export const DAILY_FORMULA_COUNT = 5;
/** A revision this many days past due earns the amber banner on Today. */
export const OVERDUE_ALERT_DAYS = 2;

/**
 * The complete, closed set of task types. Nothing outside this list is a valid
 * task type anywhere in VicharakAI — the picker, the badges, the stored annotations
 * and the agent tools all derive from it.
 */
export type TaskType = 'Question Practice' | 'Lecture' | 'Revision' | 'Self Study' | 'Custom';
export const TASK_TYPES: TaskType[] = ['Question Practice', 'Lecture', 'Revision', 'Self Study', 'Custom'];
export const DEFAULT_TASK_TYPE: TaskType = 'Self Study';

const TASK_TYPE_SET: ReadonlySet<string> = new Set<string>(TASK_TYPES);

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && TASK_TYPE_SET.has(value);
}

/** Coerce anything stored or received into a supported task type. */
export function normalizeTaskType(value: unknown): TaskType {
  return isTaskType(value) ? value : DEFAULT_TASK_TYPE;
}

export interface StudyItem {
  id: number;
  exam: string;
  subject: string;
  topic: string;
  kind: 'new' | 'revision';
  day_number?: number | null;
  scheduled_for: string;
  /** 'skipped' = archived by "Start fresh today" — never surfaces again. */
  status: 'pending' | 'done' | 'skipped';
  completed_at?: string | null;
  studied_on?: string | null;
  interval_days?: number | null;
  source_key?: string | null;
  created_at?: string;
}

export type StudyItemDraft = Omit<StudyItem, 'id' | 'created_at'>;

/**
 * Legacy score row (zuno_scores): a bare percentage, kept so tests logged before
 * marks/total existed still count towards averages and trends.
 */
export interface TestScore {
  id: number;
  exam?: string | null;
  subject: string;
  topic?: string | null;
  score: number;
  taken_on: string;
}

/**
 * A test result the way a student actually reads one off a paper: marks obtained
 * out of total marks, plus an optional test name. `percent` is derived on write
 * so tests with different totals stay comparable.
 */
export interface TestResult {
  id: number;
  exam?: string | null;
  subject: string;
  test_name?: string | null;
  marks_obtained: number | string;
  total_marks: number | string;
  percent: number | string;
  taken_on: string;
  created_at?: string;
}

/** A mistake the student logged against one test row. */
export interface TestMistake {
  id: number;
  test_score_id?: number | null;
  score_key?: string | null;
  subject: string;
  topic: string;
  mistake_description: string;
  correct_approach?: string | null;
  logged_on: string;
}

/** One normalized test row for the dashboard, from either table. */
export interface ScoreEntry {
  /** Stable display key: `r<id>` for a marks-based row, `s<id>` for a legacy one. */
  key: string;
  /** zuno_test_scores id, or null for a legacy percentage-only row. */
  resultId: number | null;
  /** zuno_scores id, or null for a marks-based row. */
  legacyId: number | null;
  subject: string;
  /** Test name (or, for legacy rows, the topic the test covered). */
  label: string | null;
  percent: number;
  marks: number | null;
  total: number | null;
  taken_on: string;
}

/** Percentage (0-100) for marks out of a total. */
export function scorePercent(marks: number, total: number): number {
  if (!Number.isFinite(marks) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((marks / total) * 100)));
}

/** Postgres hands decimals back as strings — coerce before any arithmetic. */
function numeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merge marks-based results and legacy percentage rows into one timeline.
 *
 * Logging a test writes to zuno_test_scores only — the old percentage mirror is
 * gone, and VicharakAI's history tool reads the same table — so every row here is a
 * distinct test and nothing has to be de-duplicated.
 */
export function mergeScoreEntries(results: TestResult[], legacy: TestScore[]): ScoreEntry[] {
  const entries: ScoreEntry[] = results.map((r) => {
    const marks = numeric(r.marks_obtained);
    const total = numeric(r.total_marks);
    const percent = numeric(r.percent);
    return {
      key: `r${r.id}`,
      resultId: r.id,
      legacyId: null,
      subject: r.subject,
      label: r.test_name?.trim() || null,
      percent: percent ?? (marks !== null && total !== null ? scorePercent(marks, total) : 0),
      marks,
      total,
      taken_on: r.taken_on,
    };
  });
  for (const s of legacy) {
    entries.push({
      key: `s${s.id}`,
      resultId: null,
      legacyId: s.id,
      subject: s.subject,
      label: s.topic?.trim() || null,
      percent: numeric(s.score) ?? 0,
      marks: null,
      total: null,
      taken_on: s.taken_on,
    });
  }
  return entries.sort((a, b) => a.taken_on.localeCompare(b.taken_on));
}

export interface MetaRow {
  id: number;
  meta_key: string;
  meta_value: string | null;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole days from `fromISO` to `toISO` (positive when toISO is later). */
export function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T12:00:00`).getTime();
  const b = new Date(`${toISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** 1-based prep day number relative to the plan start date. */
export function dayNumber(startDate: string, today: string): number {
  return Math.max(1, diffDays(startDate, today) + 1);
}

export function topicKey(subject: string, topic: string): string {
  return `${subject.trim().toLowerCase()}|${topic.trim().toLowerCase()}`;
}

/** zuno_meta key that carries a task's type annotation ({type, ai} JSON). */
export function taskTypeKey(sourceKey: string): string {
  return `ttype|${sourceKey}`;
}

export interface TaskAnnotation {
  type: TaskType;
  ai?: boolean;
  /** Optional preferred study time, stored as HH:MM for calendar editing. */
  time?: string;
  /** Optional student-set duration in minutes; overrides the per-type estimate. */
  minutes?: number;
  /** True when this task was auto-created from a saved doubt question. */
  doubt?: boolean;
}

/** Build a source_key → annotation map from zuno_meta rows. */
export function buildAnnotationMap(meta: MetaRow[]): Map<string, TaskAnnotation> {
  const map = new Map<string, TaskAnnotation>();
  for (const row of meta) {
    if (!row.meta_key.startsWith('ttype|') || !row.meta_value) continue;
    try {
      const parsed = JSON.parse(row.meta_value) as TaskAnnotation;
      // Annotations written by older builds (or by a tool) can carry a type that
      // is no longer supported; those are dropped so a retired value can never
      // surface as a task type in the UI.
      if (parsed && isTaskType(parsed.type)) {
        const minutes = typeof parsed.minutes === 'number' && Number.isFinite(parsed.minutes) && parsed.minutes > 0
          ? Math.round(parsed.minutes)
          : undefined;
        map.set(row.meta_key.slice('ttype|'.length), {
          type: parsed.type,
          ai: parsed.ai,
          time: parsed.time,
          minutes,
          doubt: parsed.doubt === true ? true : undefined,
        });
      }
    } catch {
      /* malformed annotation — item falls back to the default type */
    }
  }
  return map;
}

/** Rough minutes per task type — drives the estimated study-hours log. */
export function estimatedMinutes(type: TaskType | undefined, kind: 'new' | 'revision'): number {
  if (kind === 'revision') return 25;
  switch (type) {
    case 'Question Practice':
      return 50;
    case 'Lecture':
      return 60;
    case 'Revision':
      return 25;
    case 'Custom':
      return 40;
    default:
      return 45;
  }
}

/* ------------------------------------------------------------------ */
/*  Estimated day schedule — Road View timeline + task reminders       */
/* ------------------------------------------------------------------ */

export interface DayScheduleSlot {
  item: StudyItem;
  /** Estimated start, minutes from midnight. */
  startMinutes: number;
  durationMinutes: number;
}

/** Where the estimated study day begins when no task carries its own time. */
export const DAY_START_MINUTES = 8 * 60;
const SCHEDULE_GAP_MINUTES = 10;

function parseClockMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return Math.max(0, Math.min(23, h)) * 60 + (Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0);
}

/**
 * Lay the day's tasks on an estimated clock: a task with a student-set time
 * keeps it, everything else packs sequentially from DAY_START_MINUTES with a
 * short breather between tasks. Durations come from the student's own minutes
 * annotation when set, otherwise the per-type estimate. Powers the Road View
 * day timeline and the 15-minutes-before reminders — one clock, two surfaces.
 */
export function buildDaySchedule(
  tasks: StudyItem[],
  detailsFor: (item: StudyItem) => TaskAnnotation | undefined,
  dayStartMinutes = DAY_START_MINUTES,
): DayScheduleSlot[] {
  let cursor = dayStartMinutes;
  const slots: DayScheduleSlot[] = [];
  for (const item of tasks) {
    const details = detailsFor(item);
    const durationMinutes = details?.minutes ?? estimatedMinutes(details?.type, item.kind);
    const preferred = parseClockMinutes(details?.time);
    const startMinutes = preferred ?? cursor;
    cursor = Math.max(cursor, startMinutes + durationMinutes + SCHEDULE_GAP_MINUTES);
    slots.push({ item, startMinutes, durationMinutes });
  }
  return slots.sort((a, b) => a.startMinutes - b.startMinutes);
}

/* ------------------------------------------------------------------ */
/*  Study time the student actually recorded                           */
/* ------------------------------------------------------------------ */

/**
 * One recorded stretch of study time (a row of zuno_sessions). This is the one
 * number VicharakAI cannot infer from a checklist, so it is always the
 * student's own figure — typed, tapped, or measured by the optional timer.
 */
export interface StudySession {
  id: number;
  item_id?: number | null;
  source_key?: string | null;
  subject?: string | null;
  topic?: string | null;
  minutes: number | string;
  logged_on: string;
  entry_mode?: string | null;
  created_at?: string;
}

export type StudySessionDraft = Omit<StudySession, 'id' | 'created_at'>;

/** The quick-tap durations on the “How long did you study?” sheet. */
export const DURATION_CHIPS: ReadonlyArray<{ minutes: number; label: string }> = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hr' },
  { minutes: 90, label: '1.5 hrs' },
  { minutes: 120, label: '2 hrs' },
  { minutes: 180, label: '3 hrs' },
];

/** A single sitting longer than this is a typo, not a study session. */
export const MAX_SESSION_MINUTES = 18 * 60;

/** Minutes on one session row, coerced — Postgres hands integers back as strings. */
export function sessionMinutes(session: StudySession): number {
  const n = numeric(session.minutes);
  return n === null || n < 0 ? 0 : Math.round(n);
}

/** Total minutes recorded on one ISO date. */
export function minutesOnDate(sessions: StudySession[], iso: string): number {
  return sessions.filter((s) => s.logged_on === iso).reduce((sum, s) => sum + sessionMinutes(s), 0);
}

/** “2h 30m” · “45m” · “3h” — how VicharakAI writes a duration everywhere. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** HH:MM:SS for the live timer. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Round-robin granular topics across subjects so every day mixes 2–3 subjects. */
export function buildTopicSequence(exam: ExamDef): Array<{ subject: string; chapter: string; topic: string }> {
  const perSubject = exam.subjects.map((s) => ({ name: s.name, list: subjectTopics(s) }));
  const seq: Array<{ subject: string; chapter: string; topic: string }> = [];
  const maxLen = Math.max(...perSubject.map((s) => s.list.length));
  for (let i = 0; i < maxLen; i++) {
    for (const s of perSubject) {
      if (i < s.list.length) {
        seq.push({ subject: s.name, chapter: s.list[i].chapter, topic: s.list[i].topic });
      }
    }
  }
  return seq;
}

/** Day-1 output: the full first-week plan, generated from just the exam pick. */
export function generateWeekPlan(exam: ExamDef, startDate: string): StudyItemDraft[] {
  const seq = buildTopicSequence(exam);
  const drafts: StudyItemDraft[] = [];
  for (let day = 1; day <= 7; day++) {
    const slice = seq.slice((day - 1) * TOPICS_PER_DAY, day * TOPICS_PER_DAY);
    for (const t of slice) {
      drafts.push({
        exam: exam.id,
        subject: t.subject,
        topic: t.topic,
        kind: 'new',
        day_number: day,
        scheduled_for: addDaysISO(startDate, day - 1),
        status: 'pending',
        source_key: topicKey(t.subject, t.topic),
      });
    }
  }
  return drafts;
}

export type TaskFeeling = 'hard' | 'medium' | 'easy';

/** Adaptive intervals used after the student's post-task difficulty signal. */
export function revisionIntervalsForFeeling(feeling: TaskFeeling): number[] {
  if (feeling === 'hard') return [1, 2, 4, 7, 12];
  if (feeling === 'easy') return [2, 5, 9, 14, 21];
  return [...REVISION_INTERVALS];
}

/** Revision rows for a topic studied on `studiedOn` (one per interval). */
export function buildRevisionDrafts(
  item: Pick<StudyItem, 'exam' | 'subject' | 'topic'>,
  studiedOn: string,
  skipIntervals: Set<number> = new Set(),
): StudyItemDraft[] {
  const key = topicKey(item.subject, item.topic);
  return REVISION_INTERVALS.filter((n) => !skipIntervals.has(n)).map((n) => ({
    exam: item.exam,
    subject: item.subject,
    topic: item.topic,
    kind: 'revision' as const,
    scheduled_for: addDaysISO(studiedOn, n),
    status: 'pending' as const,
    studied_on: studiedOn,
    interval_days: n,
    source_key: key,
  }));
}

/* ------------------------------------------------------------------ */
/*  Top-5 daily formula                                                */
/* ------------------------------------------------------------------ */

export interface FormulaItem {
  item: StudyItem;
  /** true when this is a filler recall (nothing scheduled — recall a recent topic). */
  recall: boolean;
}

/**
 * Exactly DAILY_FORMULA_COUNT spaced-revision items for today — the passive
 * daily ritual. Due/overdue revisions first (oldest first), then, if fewer than
 * five exist, the most recently studied topics as quick recall fillers.
 */
export function dailyFormula(
  items: StudyItem[],
  today: string,
  feelings: Map<string, TaskFeeling> = new Map(),
): FormulaItem[] {
  const rank: Record<TaskFeeling, number> = { hard: 0, medium: 1, easy: 2 };
  const due = dueRevisions(items, today)
    .sort((a, b) => {
      const aFeeling = feelings.get(a.source_key || topicKey(a.subject, a.topic)) ?? 'medium';
      const bFeeling = feelings.get(b.source_key || topicKey(b.subject, b.topic)) ?? 'medium';
      return rank[aFeeling] - rank[bFeeling] || a.scheduled_for.localeCompare(b.scheduled_for);
    })
    .map((item) => ({ item, recall: false }));
  if (due.length >= DAILY_FORMULA_COUNT) return due.slice(0, DAILY_FORMULA_COUNT);

  const usedKeys = new Set(due.map((f) => f.item.source_key));
  const revisedTodayKeys = new Set(
    items
      .filter((i) => i.kind === 'revision' && i.status === 'done' && (i.completed_at || '').slice(0, 10) === today)
      .map((i) => i.source_key),
  );
  const fillers = items
    .filter(
      (i) =>
        i.kind === 'new' &&
        i.status === 'done' &&
        !!i.studied_on &&
        i.studied_on < today &&
        !usedKeys.has(i.source_key) &&
        !revisedTodayKeys.has(i.source_key),
    )
    .sort((a, b) => (b.studied_on || '').localeCompare(a.studied_on || ''))
    .filter((i, idx, arr) => arr.findIndex((x) => x.source_key === i.source_key) === idx)
    .slice(0, DAILY_FORMULA_COUNT - due.length)
    .map((item) => ({ item, recall: true }));
  return [...due, ...fillers];
}

/** Keys of topics the student has actually completed at least once. */
export function completedTopicKeys(items: StudyItem[]): Set<string> {
  return new Set(
    items
      .filter((i) => i.kind === 'new' && i.status === 'done')
      .map((i) => i.source_key || topicKey(i.subject, i.topic)),
  );
}

/**
 * Completed granular topics counted against the exam syllabus — the SAME rule
 * the Dashboard's subject progress uses (analytics.buildSubjectProgress): a
 * chapter completed as one task covers all of its topics, otherwise topics
 * count individually, and free-text tasks that match nothing in the syllabus
 * count towards neither. Every surface that quotes syllabus coverage (the
 * pace signal, capacity inference, the coach's context) derives from this one
 * function, so the Dashboard and the AI can never quote different numbers.
 */
export function completedSyllabusTopicCount(exam: ExamDef | undefined, items: StudyItem[]): number {
  if (!exam) return 0;
  const doneKeys = completedTopicKeys(items);
  let covered = 0;
  for (const subject of exam.subjects) {
    for (const chapter of subject.chapters) {
      if (doneKeys.has(topicKey(subject.name, chapter.name))) {
        covered += chapter.topics.length;
      } else {
        for (const topic of chapter.topics) {
          if (doneKeys.has(topicKey(subject.name, topic))) covered += 1;
        }
      }
    }
  }
  return covered;
}

/**
 * Every revision that is due or overdue today, oldest first. Only topics the
 * student has actually completed qualify — a revision row whose topic has no
 * completed study history is never surfaced (you can't revise what you
 * haven't studied yet), even if such a row exists in storage.
 */
export function dueRevisions(items: StudyItem[], today: string): StudyItem[] {
  const studied = completedTopicKeys(items);
  // FIX: deduplicate by topic — when several intervals of the same topic are
  // overdue at once, only ONE "Revise: …" row surfaces (oldest first). The
  // other rows stay in storage and take over once this one is completed.
  const seen = new Set<string>();
  return items
    .filter(
      (i) =>
        i.kind === 'revision' &&
        i.status === 'pending' &&
        i.scheduled_for <= today &&
        studied.has(i.source_key || topicKey(i.subject, i.topic)),
    )
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
    .filter((i) => {
      const key = i.source_key || topicKey(i.subject, i.topic);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Revisions that slipped far enough to deserve the gentle amber banner on Today
 * (default: two or more days past their scheduled date).
 */
export function overdueRevisions(items: StudyItem[], today: string, minDays = OVERDUE_ALERT_DAYS): StudyItem[] {
  return dueRevisions(items, today).filter((i) => diffDays(i.scheduled_for, today) >= minDays);
}

/** Group pending tasks by subject, keeping the plan's own ordering inside each. */
export function groupBySubject(items: StudyItem[]): Array<{ subject: string; items: StudyItem[] }> {
  const order: string[] = [];
  const map = new Map<string, StudyItem[]>();
  for (const item of items) {
    const list = map.get(item.subject);
    if (list) {
      list.push(item);
    } else {
      map.set(item.subject, [item]);
      order.push(item.subject);
    }
  }
  return order.map((subject) => ({ subject, items: map.get(subject) as StudyItem[] }));
}

/* ------------------------------------------------------------------ */
/*  "Feeling low" — one lighter task, not a new day                    */
/* ------------------------------------------------------------------ */

export interface LighterTask {
  /** An existing item to do instead, when there is a genuinely lighter one queued. */
  item: StudyItem | null;
  /** What VicharakAI suggests, phrased as one small ask. */
  suggestion: string;
  /** Why this is the lighter option — shown quietly under the suggestion. */
  reason: string;
}

/**
 * Pick ONE lighter thing to do instead of today's mission. Deliberately narrow:
 * the rest of the day's plan is untouched, so a low day costs the student one
 * swapped task, not their momentum.
 *
 * Preference order, most restorative first:
 *  1. a revision that's already due in the SAME subject (familiar ground),
 *  2. any revision that's due (recall beats new learning on a hard day),
 *  3. another pending task in the same subject,
 *  4. nothing queued — offer a 15-minute read of the mission topic.
 */
export function pickLighterTask(
  items: StudyItem[],
  mission: StudyItem | undefined,
  today: string,
): LighterTask {
  const due = dueRevisions(items, today);
  const sameSubjectRevision = mission ? due.find((i) => i.subject === mission.subject) : undefined;
  const anyRevision = due[0];
  const sameSubjectPending = mission
    ? items.find(
        (i) =>
          i.kind === 'new' &&
          i.status === 'pending' &&
          i.id !== mission.id &&
          i.subject === mission.subject,
      )
    : undefined;

  const pick = sameSubjectRevision ?? anyRevision ?? sameSubjectPending ?? null;

  if (pick && pick.kind === 'revision') {
    return {
      item: pick,
      suggestion: `Just revise ${pick.topic} for 15 minutes instead.`,
      reason:
        pick.subject === mission?.subject
          ? `Same subject, already familiar — you studied it before, so it's recall, not new ground.`
          : `It's recall, not new learning — much lighter than starting a fresh topic.`,
    };
  }
  if (pick) {
    return {
      item: pick,
      suggestion: `Swap to ${pick.topic} — 15 minutes of reading is enough.`,
      reason: `Same subject as your mission, and a gentler place to start.`,
    };
  }
  return {
    item: null,
    suggestion: mission
      ? `Just read ${mission.topic} for 15 minutes. No solving, no notes.`
      : `Just read one page of anything on your syllabus for 15 minutes.`,
    reason: 'Showing up small still counts — the rest of your day stays exactly as it was.',
  };
}

/* ------------------------------------------------------------------ */
/*  Pace signal — "Am I on track?"                                     */
/* ------------------------------------------------------------------ */

export type PaceStatus = 'green' | 'amber' | 'red';

/** Recorded study time, summarised for the pace signal. */
export interface HoursSnapshot {
  /** Minutes recorded today. */
  todayMinutes: number;
  /** Minutes recorded across the recent window. */
  windowMinutes: number;
  /** Calendar days that window covers (1–7). */
  windowDays: number;
  /** Daily target in minutes when the student set one; null to infer it. */
  targetMinutes: number | null;
}

/** The study-hours half of “Am I on track?”. */
export interface HoursPace {
  todayMinutes: number;
  /** Recorded minutes per day across the window. */
  avgMinutes: number;
  targetMinutes: number;
  /** True when the target came from the syllabus rather than the student. */
  targetInferred: boolean;
  /** Hours before exam day at the current average, and at the target. */
  projectedHours: number;
  neededHours: number;
  status: PaceStatus;
  line: string;
}

export interface PaceSignal {
  status: PaceStatus;
  label: string;
  emoji: string;
  /** Short, direct line for the Today chip — the alert version of `label`. */
  alert: string;
  daysBehind: number;
  daysToExam: number;
  detail: string;
  /** Hours read — null until the student has recorded any study time. */
  hours: HoursPace | null;
}

/** Realistic ceiling of granular topics a committed aspirant covers per day. */
const MAX_SUSTAINABLE_PER_DAY = 5;

/** Rough minutes one granular topic takes end to end. */
const MINUTES_PER_TOPIC = 45;

const PACE_RANK: Record<PaceStatus, number> = { green: 0, amber: 1, red: 2 };

/**
 * The daily hours the syllabus itself implies: whatever is left, spread across
 * the days that remain. This is why VicharakAI never has to open with a form
 * asking how many hours a student plans to put in.
 */
export function inferDailyTargetMinutes(remainingTopics: number, daysToExam: number): number {
  if (daysToExam <= 0 || remainingTopics <= 0) return 120;
  const raw = (remainingTopics * MINUTES_PER_TOPIC) / daysToExam;
  return Math.round(Math.min(600, Math.max(60, raw)) / 15) * 15;
}

function computeHoursPace(
  snapshot: HoursSnapshot,
  targetMinutes: number,
  targetInferred: boolean,
  daysToExam: number,
): HoursPace | null {
  // Say nothing at all until the student has recorded something — an invented
  // “you studied nothing” verdict would be a lie about a feature they haven't used.
  if (snapshot.windowMinutes <= 0) return null;

  const windowDays = Math.max(1, Math.min(7, snapshot.windowDays));
  const avgMinutes = Math.round(snapshot.windowMinutes / windowDays);
  const projectedHours = Math.round((avgMinutes * daysToExam) / 60);
  const neededHours = Math.round((targetMinutes * daysToExam) / 60);
  const shortfall = Math.max(0, neededHours - projectedHours);
  const goal = targetInferred
    ? `the ${formatDuration(targetMinutes)} a day your exam date needs`
    : `your ${formatDuration(targetMinutes)} daily goal`;
  const average = formatDuration(avgMinutes);
  const ratio = avgMinutes / targetMinutes;
  const base = { todayMinutes: snapshot.todayMinutes, avgMinutes, targetMinutes, targetInferred, projectedHours, neededHours };

  // On exam day itself there is nothing left to project, so the copy drops the
  // hours-by-exam-day tail rather than quoting a hollow “0 hours”.
  const projection = daysToExam > 0 ? ` — about ${projectedHours} hours of prep before exam day` : '';
  const gap = daysToExam > 0 ? ` — roughly ${shortfall} hours short by exam day` : '';

  if (ratio >= 0.85) {
    return {
      ...base,
      status: 'green',
      line: `You're averaging ${average} a day against ${goal}${projection}.`,
    };
  }
  if (ratio >= 0.55) {
    return {
      ...base,
      status: 'amber',
      line: `You're averaging ${average} a day, under ${goal}${gap}.`,
    };
  }
  return {
    ...base,
    status: 'red',
    line: `You're averaging ${average} a day against ${goal}${gap}. That gap won't close on its own.`,
  };
}

/**
 * “Am I on track?”, answered on two axes: syllabus coverage against the exam
 * date, and — once the student records study time — hours put in against the
 * hours the exam date needs. Whichever tells the harder truth leads.
 */
export function computePace(
  items: StudyItem[],
  exam: ExamDef | undefined,
  examDate: string,
  today: string,
  hours?: HoursSnapshot,
): PaceSignal {
  const daysToExam = Math.max(0, diffDays(today, examDate));
  const overdue = items.filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for < today).length;
  const daysBehind = Math.ceil(overdue / TOPICS_PER_DAY);

  const totalTopics = exam ? examTopicCount(exam) : 0;
  // Coverage follows the same syllabus-aware rule as the Dashboard, so "Am I
  // on track?" and the subject-progress bars can never disagree.
  const remaining = Math.max(0, totalTopics - completedSyllabusTopicCount(exam, items));
  const wontFinish = daysToExam > 0 && remaining > daysToExam * MAX_SUSTAINABLE_PER_DAY;

  let base: Omit<PaceSignal, 'hours'>;
  if (wontFinish || (daysToExam === 0 && remaining > 0)) {
    base = {
      status: 'red',
      emoji: '\uD83D\uDD34',
      label: "Won't finish by exam day",
      alert: "At this pace you'll miss your exam date",
      daysBehind,
      daysToExam,
      detail:
        'At the current pace the full syllabus won\u2019t fit — time to prioritise high-weight chapters with VicharakAI.',
    };
  } else if (daysBehind >= 1) {
    base = {
      status: 'amber',
      emoji: '\uD83D\uDFE0',
      label: `${daysBehind} day${daysBehind === 1 ? '' : 's'} behind`,
      alert: `You're ${daysBehind} day${daysBehind === 1 ? '' : 's'} behind — adjust this week`,
      daysBehind,
      daysToExam,
      detail: `Clear ${overdue} carried-over topic${overdue === 1 ? '' : 's'} and you\u2019re back on pace — very recoverable.`,
    };
  } else {
    base = {
      status: 'green',
      emoji: '\uD83D\uDFE2',
      label: 'On track',
      alert: 'On track for exam day',
      daysBehind: 0,
      daysToExam,
      detail: 'Your pace covers the syllabus before exam day. Keep the streak alive.',
    };
  }

  if (!hours) return { ...base, hours: null };

  const targetInferred = !hours.targetMinutes || hours.targetMinutes <= 0;
  const targetMinutes = targetInferred
    ? inferDailyTargetMinutes(remaining, daysToExam)
    : (hours.targetMinutes as number);
  const hoursPace = computeHoursPace(hours, targetMinutes, targetInferred, daysToExam);
  if (!hoursPace) return { ...base, hours: null };

  if (PACE_RANK[hoursPace.status] <= PACE_RANK[base.status]) {
    return { ...base, hours: hoursPace, detail: `${base.detail} ${hoursPace.line}` };
  }
  const amber = hoursPace.status === 'amber';
  return {
    ...base,
    hours: hoursPace,
    status: hoursPace.status,
    emoji: amber ? '\uD83D\uDFE0' : '\uD83D\uDD34',
    label: amber ? 'Short on study hours' : 'Well short on study hours',
    alert: amber
      ? 'Your hours are under what your exam date needs'
      : "At these hours the syllabus won't be covered",
    detail: `${hoursPace.line} ${base.detail}`,
  };
}

/* ------------------------------------------------------------------ */
/*  One-liner parsing (Option A of task entry)                         */
/* ------------------------------------------------------------------ */

export interface ParsedTask {
  type: TaskType;
  subject: string;
  topic: string;
  matchedSyllabus: boolean;
}

const SUBJECT_ALIASES: Record<string, string[]> = {
  physics: ['physics', 'phy'],
  chemistry: ['chemistry', 'chem', 'organic chemistry', 'inorganic chemistry', 'physical chemistry'],
  biology: ['biology', 'botany', 'zoology', 'plant biology', 'animal biology', 'human physiology'],
  mathematics: ['mathematics', 'maths', 'math'],
  'history & culture': ['history', 'culture', 'art and culture'],
  geography: ['geography'],
  'indian society': ['indian society', 'society'],
  'polity & governance': ['polity', 'governance', 'constitution'],
  'international relations': ['international relations', 'world affairs'],
  'economy & agriculture': ['economy', 'economics', 'agriculture'],
  'environment & ecology': ['environment', 'ecology'],
  'science & technology': ['science and technology', 'science tech', 'sci tech'],
  'internal security': ['internal security', 'security'],
  'disaster management': ['disaster management'],
  'ethics, integrity & aptitude': ['ethics', 'integrity', 'aptitude'],
  'current affairs': ['current affairs'],
  csat: ['csat', 'general studies paper two'],
  varc: ['varc', 'verbal ability', 'reading comprehension', 'rc'],
  dilr: ['dilr', 'logical reasoning', 'data interpretation', 'lr', 'di'],
  quant: ['quant', 'quantitative aptitude', 'qa'],
  'quantitative aptitude': ['quantitative aptitude', 'quant', 'qa'],
  english: ['english', 'grammar', 'vocabulary'],
  'general awareness': ['general awareness', 'general knowledge', 'gk', 'ga', 'current affairs'],
  reasoning: ['reasoning', 'general intelligence'],
};

function containsAlias(text: string, alias: string): boolean {
  const normalizedText = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return normalizedAlias.length > 0 && normalizedText.includes(` ${normalizedAlias} `);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'today', 'tomorrow', 'practice', 'questions', 'question', 'lecture',
  'class', 'video', 'revise', 'revision', 'review', 'study', 'studying', 'chapter', 'topic', 'some',
  'from', 'want', 'will', 'need', 'session', 'hour', 'hours', 'doing', 'solve', 'solving', 'watch',
]);

function detectType(text: string): TaskType {
  const t = text.toLowerCase();
  if (/(practice|question|mcq|pyq|mock|test|solve|dpp)/.test(t)) return 'Question Practice';
  if (/(lecture|class|video|watch|one[- ]?shot)/.test(t)) return 'Lecture';
  if (/(revis|recall|review|re-?read)/.test(t)) return 'Revision';
  return 'Self Study';
}

/** Parse a free-text one-liner into a structured task, silently. */
export function parseOneLiner(text: string, exam: ExamDef | undefined): ParsedTask {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const type = detectType(lower);

  let explicitSubject = '';
  if (exam) {
    const explicitMatches = exam.subjects.filter((subject) => {
      const aliases = SUBJECT_ALIASES[subject.name.toLowerCase()] ?? [subject.name.toLowerCase()];
      return aliases.some((alias) => containsAlias(lower, alias));
    });
    if (explicitMatches.length === 1) explicitSubject = explicitMatches[0].name;
  }

  // Syllabus lookup considers both chapter names and granular topic labels.
  // It deliberately returns blank when two subjects are equally plausible.
  const inferredSubject = inferSubjectForTopic(exam, raw);
  const subject = inferredSubject || explicitSubject;

  // Snap recognisable text onto a granular syllabus topic. Once inference has
  // identified a subject, never let a weaker cross-subject word overlap win.
  let bestTopic = '';
  let bestSubject = '';
  let bestScore = 0;
  let bestIsTied = false;
  if (exam) {
    const words = lower.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
    for (const syllabusSubject of exam.subjects) {
      if (subject && syllabusSubject.name !== subject) continue;
      for (const { topic } of subjectTopics(syllabusSubject)) {
        const topicLower = topic.toLowerCase();
        let score = 0;
        for (const word of words) {
          if (topicLower.includes(word)) score += word.length >= 6 ? 2 : 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topic;
          bestSubject = syllabusSubject.name;
          bestIsTied = false;
        } else if (score > 0 && score === bestScore && syllabusSubject.name !== bestSubject) {
          bestIsTied = true;
        }
      }
    }
  }

  if (bestScore >= 2 && !bestIsTied) {
    return { type, subject: bestSubject, topic: bestTopic, matchedSyllabus: true };
  }

  const cleaned = raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
  return { type, subject, topic: cleaned, matchedSyllabus: false };
}

/* ------------------------------------------------------------------ */
/*  "Let VicharakAI decide" (Option C of task entry)                         */
/* ------------------------------------------------------------------ */

export interface AiPick {
  subject: string;
  chapter: string;
  topic: string;
  reason: string;
}

/**
 * Pick the smartest next task: subjects the student's saved doubts flag come
 * first (a doubt is the freshest "I'm stuck here" signal there is), then the
 * weakest subject (test scores first, then least coverage) and its next
 * unstudied granular topic.
 */
export function pickAiTask(
  items: StudyItem[],
  exam: ExamDef,
  scores: Array<{ subject: string; score: number }>,
  doubtSubjects: string[] = [],
): AiPick | null {
  const assigned = new Set(
    items.filter((i) => i.kind === 'new').map((i) => i.source_key || topicKey(i.subject, i.topic)),
  );

  // Rank subjects: worst average test score first; subjects without scores
  // ranked by least syllabus coverage.
  const bySubjectScore = new Map<string, { sum: number; n: number }>();
  for (const s of scores) {
    const cur = bySubjectScore.get(s.subject) ?? { sum: 0, n: 0 };
    cur.sum += s.score;
    cur.n += 1;
    bySubjectScore.set(s.subject, cur);
  }

  const doubtSet = new Set(doubtSubjects.map((s) => s.trim().toLowerCase()).filter(Boolean));

  const ranked = exam.subjects
    .map((s) => {
      const all = subjectTopics(s);
      const done = all.filter((t) => assigned.has(topicKey(s.name, t.topic))).length;
      const scoreEntry = bySubjectScore.get(s.name);
      const avg = scoreEntry && scoreEntry.n > 0 ? scoreEntry.sum / scoreEntry.n : null;
      return { subject: s, coverage: all.length === 0 ? 1 : done / all.length, avg, hasDoubts: doubtSet.has(s.name.toLowerCase()) };
    })
    .sort((a, b) => {
      // A subject the student is actively saving doubts in outranks everything.
      if (a.hasDoubts !== b.hasDoubts) return a.hasDoubts ? -1 : 1;
      if (a.avg !== null && b.avg !== null && a.avg !== b.avg) return a.avg - b.avg;
      if (a.avg !== null && b.avg === null) return a.avg < 60 ? -1 : 1;
      if (b.avg !== null && a.avg === null) return b.avg < 60 ? 1 : -1;
      return a.coverage - b.coverage;
    });

  for (const r of ranked) {
    const next = subjectTopics(r.subject).find((t) => !assigned.has(topicKey(r.subject.name, t.topic)));
    if (next) {
      const reason = r.hasDoubts
        ? `you've been saving doubts in ${r.subject.name} — clearing that weak spot first`
        : r.avg !== null && r.avg < 60
          ? `your ${r.subject.name} test average is ${Math.round(r.avg)}% — worth extra reps`
          : r.coverage < 0.999
            ? `${r.subject.name} has the least coverage so far`
            : 'next in your syllabus sequence';
      return { subject: r.subject.name, chapter: next.chapter, topic: next.topic, reason };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

/** Proof string shown on revision tasks: grounds the ask in the student's own history. */
export function proofText(item: StudyItem, today: string): string {
  if (!item.studied_on) return 'Time to revisit this one';
  const ago = diffDays(item.studied_on, today);
  if (ago <= 0) return `You studied ${item.topic} earlier today — a quick recall now makes it stick`;
  if (ago === 1) return `You studied ${item.topic} yesterday — let's make sure it stuck`;
  return `You studied ${item.topic} ${ago} days ago — let's lock it in today`;
}

export function formatDayLabel(iso: string, today: string): string {
  const diff = diffDays(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
