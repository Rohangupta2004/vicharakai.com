/**
 * VicharakAI plan + spaced-revision engine (client side).
 *
 * Mirrors the logic in the server-function hooks (zuno-mark-done etc.) so the
 * app and VicharakAI Coach act on the same rules:
 *  - Week-1 targets are generated from the syllabus alone (no long forms).
 *  - Completing a topic stamps studied_on and queues revisions at
 *    +1, +3, +5, +7 and +14 days from the ACTUAL study date.
 *  - The Top-5 daily formula surfaces exactly five revision items every day.
 *  - The pace signal answers "Am I on track?" against the exam date.
 *
 * VicharakAI's coaching is fully available from Day 1 — there are no usage gates.
 * Personalization deepens silently as the student studies; it is never
 * surfaced as a countdown, unlock, or milestone.
 */

import { examTopicCount, inferSubjectForTopic, subjectTopics, type ExamDef } from './syllabus';

export const REVISION_INTERVALS = [1, 3, 5, 7, 14];
export const TOPICS_PER_DAY = 3;
/** Exactly this many spaced-revision items are shown every day (the daily formula). */
export const DAILY_FORMULA_COUNT = 5;

/**
 * The complete, closed set of task types. Nothing outside this list is a valid
 * task type anywhere in VicharakAI — the picker, the badges and stored annotations all
 * derive from it.
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
  status: 'pending' | 'done';
  completed_at?: string | null;
  studied_on?: string | null;
  interval_days?: number | null;
  source_key?: string | null;
  created_at?: string;
}

export type StudyItemDraft = Omit<StudyItem, 'id' | 'created_at'>;

/**
 * Legacy score row (zuno_scores): a bare percentage, kept so history logged
 * before marks/total existed still counts towards averages and trends.
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
 * A test result the way a student actually reads one off a paper: marks
 * obtained out of total marks, plus an optional exam/test name. `percent` is
 * derived on write so tests with different totals stay comparable.
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

/** One normalized test row for the dashboard, from either table. */
export interface ScoreEntry {
  key: string;
  subject: string;
  /** Exam/test name (or, for legacy rows, the topic the test covered). */
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
 * Logging a test writes to both tables (the percentage mirror keeps VicharakAI's
 * server-side history tools working), so a legacy row that matches a
 * marks-based one on subject + date + percentage is that same test and is
 * dropped rather than counted twice.
 */
export function mergeScoreEntries(results: TestResult[], legacy: TestScore[]): ScoreEntry[] {
  const entries: ScoreEntry[] = results.map((r) => {
    const marks = numeric(r.marks_obtained);
    const total = numeric(r.total_marks);
    const percent = numeric(r.percent);
    return {
      key: `r${r.id}`,
      subject: r.subject,
      label: r.test_name?.trim() || null,
      percent: percent ?? (marks !== null && total !== null ? scorePercent(marks, total) : 0),
      marks,
      total,
      taken_on: r.taken_on,
    };
  });
  const mirrored = new Set(entries.map((e) => `${e.subject}|${e.taken_on}|${e.percent}`));
  for (const s of legacy) {
    const percent = numeric(s.score) ?? 0;
    if (mirrored.has(`${s.subject}|${s.taken_on}|${percent}`)) continue;
    entries.push({
      key: `s${s.id}`,
      subject: s.subject,
      label: s.topic?.trim() || null,
      percent,
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
}

/** Build a source_key → annotation map from zuno_meta rows. */
export function buildAnnotationMap(meta: MetaRow[]): Map<string, TaskAnnotation> {
  const map = new Map<string, TaskAnnotation>();
  for (const row of meta) {
    if (!row.meta_key.startsWith('ttype|') || !row.meta_value) continue;
    try {
      const parsed = JSON.parse(row.meta_value) as TaskAnnotation;
      // Annotations written by older builds (or by a tool) can carry a type that
      // is no longer supported; those are dropped so retired values such as
      // "Play" can never surface as a task type in the UI.
      if (parsed && isTaskType(parsed.type)) {
        map.set(row.meta_key.slice('ttype|'.length), { type: parsed.type, ai: parsed.ai });
      }
    } catch {
      /* malformed annotation — item falls back to default type */
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

/** Round-robin granular topics across subjects so every day mixes 2–3 subjects. */
export function buildTopicSequence(exam: ExamDef): Array<{ subject: string; chapter: string; topic: string }> {
  const perSubject = exam.subjects.map((s) => ({
    name: s.name,
    list: subjectTopics(s),
  }));
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
 * daily ritual. Due/overdue revisions first (oldest first), then, if fewer
 * than five exist, the most recently studied topics as quick recall fillers.
 */
export function dailyFormula(items: StudyItem[], today: string): FormulaItem[] {
  const due = items
    .filter((i) => i.kind === 'revision' && i.status === 'pending' && i.scheduled_for <= today)
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
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

/* ------------------------------------------------------------------ */
/*  Pace signal — "Am I on track?"                                     */
/* ------------------------------------------------------------------ */

export type PaceStatus = 'green' | 'amber' | 'red';

export interface PaceSignal {
  status: PaceStatus;
  label: string;
  emoji: string;
  daysBehind: number;
  daysToExam: number;
  detail: string;
}

/** Realistic ceiling of granular topics a committed aspirant covers per day. */
const MAX_SUSTAINABLE_PER_DAY = 5;

export function computePace(items: StudyItem[], exam: ExamDef | undefined, examDate: string, today: string): PaceSignal {
  const daysToExam = Math.max(0, diffDays(today, examDate));
  const overdue = items.filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for < today).length;
  const daysBehind = Math.ceil(overdue / TOPICS_PER_DAY);

  const doneKeys = new Set(
    items.filter((i) => i.kind === 'new' && i.status === 'done').map((i) => i.source_key || topicKey(i.subject, i.topic)),
  );
  const totalTopics = exam ? examTopicCount(exam) : 0;
  const remaining = Math.max(0, totalTopics - doneKeys.size);
  const wontFinish = daysToExam > 0 && remaining > daysToExam * MAX_SUSTAINABLE_PER_DAY;

  if (wontFinish || (daysToExam === 0 && remaining > 0)) {
    return {
      status: 'red',
      emoji: '\uD83D\uDD34',
      label: "Won't finish by exam day",
      daysBehind,
      daysToExam,
      detail: 'At the current pace the full syllabus won\u2019t fit — time to prioritise high-weight chapters with VicharakAI.',
    };
  }
  if (daysBehind >= 1) {
    return {
      status: 'amber',
      emoji: '\uD83D\uDFE0',
      label: `${daysBehind} day${daysBehind === 1 ? '' : 's'} behind`,
      daysBehind,
      daysToExam,
      detail: `Clear ${overdue} carried-over topic${overdue === 1 ? '' : 's'} and you\u2019re back on pace — very recoverable.`,
    };
  }
  return {
    status: 'green',
    emoji: '\uD83D\uDFE2',
    label: 'On track',
    daysBehind: 0,
    daysToExam,
    detail: 'Your pace covers the syllabus before exam day. Keep the streak alive.',
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
 * Pick the smartest next task: the weakest subject (test scores first, then
 * least coverage) and its next unstudied granular topic.
 */
export function pickAiTask(
  items: StudyItem[],
  exam: ExamDef,
  scores: Array<Pick<TestScore, 'subject' | 'score'>>,
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

  const ranked = exam.subjects
    .map((s) => {
      const all = subjectTopics(s);
      const done = all.filter((t) => assigned.has(topicKey(s.name, t.topic))).length;
      const scoreEntry = bySubjectScore.get(s.name);
      const avg = scoreEntry && scoreEntry.n > 0 ? scoreEntry.sum / scoreEntry.n : null;
      return { subject: s, coverage: all.length === 0 ? 1 : done / all.length, avg };
    })
    .sort((a, b) => {
      if (a.avg !== null && b.avg !== null && a.avg !== b.avg) return a.avg - b.avg;
      if (a.avg !== null && b.avg === null) return a.avg < 60 ? -1 : 1;
      if (b.avg !== null && a.avg === null) return b.avg < 60 ? 1 : -1;
      return a.coverage - b.coverage;
    });

  for (const r of ranked) {
    const next = subjectTopics(r.subject).find((t) => !assigned.has(topicKey(r.subject.name, t.topic)));
    if (next) {
      const reason =
        r.avg !== null && r.avg < 60
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
