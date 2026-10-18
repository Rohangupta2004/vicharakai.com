/**
 * VicharakAI's mastery + adaptation engine.
 *
 * Sits on top of the exam-syllabus database (data/syllabuses.ts) and four
 * WorkspaceDB tables:
 *   • zuno_exam_progress  — per-chapter mastery (0-100), attempts, last
 *     studied, spaced-revision due date (1 → 3 → 5 → 7 → 14 days).
 *   • zuno_topic_attempts — the event log: studied / correct / wrong.
 *   • zuno_weak_topics    — weakness scores; resolved when they hit zero.
 *   • zuno_readiness      — the latest readiness snapshot per exam.
 *
 * Writes go through window.__workspaceDb (the same client the rest of the
 * app uses); reads are handed in by the caller as rows from useWorkspaceDB,
 * matching the app's existing “hooks own the reads” architecture. This file
 * is placed next to engine.ts (NOT inside an engine/ directory) so the
 * existing `./engine` import specifier stays unambiguous.
 *
 * No payment logic anywhere — this is pure study functionality.
 */

import {
  findChapter,
  getSyllabus,
  syllabusSlug,
  topicIdFor,
  type ExamSyllabus,
  type SyllabusChapter,
  type SyllabusSubject,
} from './data/syllabuses';

/* ------------------------------------------------------------------ */
/*  Row shapes (as returned by useWorkspaceDB)                         */
/* ------------------------------------------------------------------ */

export interface ExamProgressRow {
  id: number;
  exam_id: string;
  subject_id?: string | null;
  chapter_id: string;
  chapter_name?: string | null;
  mastery_score: number | string;
  attempts: number | string;
  last_studied_at?: string | null;
  spaced_revision_due_at?: string | null;
}

export interface TopicAttemptRow {
  id: number;
  exam_id: string;
  topic_id: string;
  topic_name?: string | null;
  chapter_id?: string | null;
  result: string;
  difficulty_felt?: string | null;
  attempted_at: string;
}

export interface WeakTopicRow {
  id: number;
  exam_id: string;
  topic_id: string;
  topic_name?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  weakness_score: number | string;
  detected_at?: string | null;
  resolved_at?: string | null;
}

export interface ReadinessRow {
  id: number;
  exam_id: string;
  readiness_pct: number | string;
  strong_areas?: unknown;
  weak_areas?: unknown;
  computed_at?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Tunables                                                           */
/* ------------------------------------------------------------------ */

export type SessionDifficulty = 'easy' | 'medium' | 'hard';

/** Mastery gained per study session, by how the session felt. */
export const MASTERY_GAIN: Record<SessionDifficulty, number> = { easy: 15, medium: 10, hard: 5 };
/** Mastery change per test answer. */
export const MASTERY_CORRECT = 5;
export const MASTERY_WRONG = -10;
/** Spaced-revision ladder, indexed by attempt count. */
export const SPACED_INTERVALS = [1, 3, 5, 7, 14];
/** Weakness dynamics. */
export const WEAKNESS_ON_WRONG = 25;
export const WEAKNESS_ON_CORRECT = -20;
export const WEAKNESS_CAP = 100;
/** Chapters at or above this mastery are skipped by the adapted plan. */
export const MASTERY_SKIP_THRESHOLD = 90;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

interface WorkspaceDbTable {
  insert: (row: Record<string, unknown>) => Promise<void>;
  update: (id: number, row: Record<string, unknown>) => Promise<void>;
  delete: (id: number) => Promise<void>;
}

function dbTable(table: string): WorkspaceDbTable {
  const client = (window as unknown as { __workspaceDb?: { from: (table: string) => WorkspaceDbTable } }).__workspaceDb;
  if (!client) throw new Error('WorkspaceDB client is not available');
  return client.from(table);
}

/** Postgres hands integers back as strings — coerce before arithmetic. */
export function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampMastery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Next spaced-revision due date for a chapter on its Nth attempt. */
export function nextRevisionDue(todayIso: string, attempts: number): string {
  const interval = SPACED_INTERVALS[Math.min(Math.max(0, attempts - 1), SPACED_INTERVALS.length - 1)];
  return addDays(todayIso, interval);
}

function normalizeDifficulty(value: string | null | undefined): SessionDifficulty {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

/** chapter_id is the first segment of a topic id (`<chapterId>|<slug>`). */
export function chapterIdOfTopic(topicId: string): string {
  const bar = topicId.lastIndexOf('|');
  return bar === -1 ? topicId : topicId.slice(0, bar);
}

export function progressForChapter(rows: ExamProgressRow[], examId: string, chapterId: string): ExamProgressRow | undefined {
  return rows.find((row) => row.exam_id === examId && row.chapter_id === chapterId);
}

/* ------------------------------------------------------------------ */
/*  1 · recordStudySession                                             */
/* ------------------------------------------------------------------ */

export interface EngineWriteContext {
  /** Current zuno_exam_progress rows (from useWorkspaceDB). */
  progressRows: ExamProgressRow[];
  /** Current zuno_weak_topics rows (needed by recordTestResult). */
  weakRows?: WeakTopicRow[];
  /** Override “now” in tests. */
  now?: Date;
}

/**
 * A study session on a chapter: bumps chapter mastery (+15 easy / +10 medium /
 * +5 hard, capped at 100), advances the spaced-revision ladder
 * (1 → 3 → 5 → 7 → 14 days by attempt count) and logs one zuno_topic_attempts
 * row per topic studied.
 */
export async function recordStudySession(
  examId: string,
  chapterId: string,
  topicsStudied: string[],
  difficultyFelt: SessionDifficulty | string,
  ctx: EngineWriteContext,
): Promise<void> {
  const now = ctx.now ?? new Date();
  const today = isoDate(now);
  const difficulty = normalizeDifficulty(typeof difficultyFelt === 'string' ? difficultyFelt : null);
  const gain = MASTERY_GAIN[difficulty];

  const syllabus = getSyllabus(examId);
  const located = syllabus ? findChapter(syllabus, chapterId) : undefined;

  const existing = progressForChapter(ctx.progressRows, examId, chapterId);
  const attempts = (existing ? asNumber(existing.attempts) : 0) + 1;
  const mastery = clampMastery((existing ? asNumber(existing.mastery_score) : 0) + gain);
  const dueAt = nextRevisionDue(today, attempts);

  const progress = dbTable('zuno_exam_progress');
  if (existing) {
    await progress.update(existing.id, {
      mastery_score: mastery,
      attempts,
      last_studied_at: now.toISOString(),
      spaced_revision_due_at: dueAt,
      ...(located ? { subject_id: located.subject.id, chapter_name: located.chapter.name } : {}),
    });
  } else {
    await progress.insert({
      user_id: null,
      exam_id: examId,
      subject_id: located?.subject.id ?? null,
      chapter_id: chapterId,
      chapter_name: located?.chapter.name ?? null,
      mastery_score: mastery,
      attempts,
      last_studied_at: now.toISOString(),
      spaced_revision_due_at: dueAt,
    });
  }

  const attemptsTable = dbTable('zuno_topic_attempts');
  const topics = topicsStudied.map((t) => (t ?? '').trim()).filter(Boolean);
  const list = topics.length > 0 ? topics : [located?.chapter.name ?? chapterId];
  for (const topic of list) {
    await attemptsTable.insert({
      user_id: null,
      exam_id: examId,
      topic_id: topicIdFor(chapterId, topic),
      topic_name: topic,
      chapter_id: chapterId,
      result: 'studied',
      difficulty_felt: difficulty,
      attempted_at: now.toISOString(),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  2 · recordTestResult                                               */
/* ------------------------------------------------------------------ */

/**
 * A test answer on a topic: logs the attempt, adjusts chapter mastery
 * (+5 correct / -10 wrong) and moves the topic's weakness score — wrong
 * answers create or reinforce a zuno_weak_topics row (+25, capped at 100);
 * correct answers reduce it by 20 and stamp resolved_at when it reaches 0.
 */
export async function recordTestResult(
  examId: string,
  topicId: string,
  isCorrect: boolean,
  score: number | null,
  ctx: EngineWriteContext & { topicName?: string | null },
): Promise<void> {
  const now = ctx.now ?? new Date();
  const chapterId = chapterIdOfTopic(topicId);
  const syllabus = getSyllabus(examId);
  const located = syllabus ? findChapter(syllabus, chapterId) : undefined;
  const topicName = (ctx.topicName ?? '').trim() || located?.chapter.name || null;

  await dbTable('zuno_topic_attempts').insert({
    user_id: null,
    exam_id: examId,
    topic_id: topicId,
    topic_name: topicName,
    chapter_id: chapterId,
    result: isCorrect ? 'correct' : 'wrong',
    difficulty_felt: null,
    attempted_at: now.toISOString(),
  });

  /* Mastery moves proportionally on the chapter the topic belongs to. */
  const existing = progressForChapter(ctx.progressRows, examId, chapterId);
  const delta = isCorrect ? MASTERY_CORRECT : MASTERY_WRONG;
  const progress = dbTable('zuno_exam_progress');
  if (existing) {
    await progress.update(existing.id, {
      mastery_score: clampMastery(asNumber(existing.mastery_score) + delta),
      attempts: asNumber(existing.attempts) + 1,
    });
  } else if (!isCorrect) {
    // A wrong answer on an unstudied chapter still creates a (low) mastery row
    // so the chapter surfaces in priorities; a lone correct answer does not.
    await progress.insert({
      user_id: null,
      exam_id: examId,
      subject_id: located?.subject.id ?? null,
      chapter_id: chapterId,
      chapter_name: located?.chapter.name ?? null,
      mastery_score: 0,
      attempts: 1,
      last_studied_at: null,
      spaced_revision_due_at: isoDate(now),
    });
  }

  /* Weakness bookkeeping. */
  const weakRows = ctx.weakRows ?? [];
  const weakExisting = weakRows.find((row) => row.exam_id === examId && row.topic_id === topicId);
  const weakTable = dbTable('zuno_weak_topics');
  if (!isCorrect) {
    const nextScore = Math.min(WEAKNESS_CAP, (weakExisting ? asNumber(weakExisting.weakness_score) : 0) + WEAKNESS_ON_WRONG);
    if (weakExisting) {
      await weakTable.update(weakExisting.id, {
        weakness_score: nextScore,
        resolved_at: null,
        detected_at: weakExisting.detected_at ?? now.toISOString(),
      });
    } else {
      await weakTable.insert({
        user_id: null,
        exam_id: examId,
        topic_id: topicId,
        topic_name: topicName,
        subject_id: located?.subject.id ?? null,
        chapter_id: chapterId,
        weakness_score: nextScore,
        detected_at: now.toISOString(),
        resolved_at: null,
      });
    }
  } else if (weakExisting && !weakExisting.resolved_at) {
    const nextScore = Math.max(0, asNumber(weakExisting.weakness_score) + WEAKNESS_ON_CORRECT);
    await weakTable.update(weakExisting.id, {
      weakness_score: nextScore,
      ...(nextScore === 0 ? { resolved_at: now.toISOString() } : {}),
    });
  }

  void score; // reserved: percentage scores refine mastery in a later pass
}

/** Manually flag a topic as weak (the chat's “Mark as weak” action). */
export async function markTopicWeak(
  examId: string,
  topicId: string,
  topicName: string,
  ctx: { weakRows: WeakTopicRow[]; now?: Date },
): Promise<void> {
  const now = ctx.now ?? new Date();
  const chapterId = chapterIdOfTopic(topicId);
  const syllabus = getSyllabus(examId);
  const located = syllabus ? findChapter(syllabus, chapterId) : undefined;
  const existing = ctx.weakRows.find((row) => row.exam_id === examId && row.topic_id === topicId);
  const weakTable = dbTable('zuno_weak_topics');
  if (existing) {
    await weakTable.update(existing.id, {
      weakness_score: Math.min(WEAKNESS_CAP, Math.max(asNumber(existing.weakness_score), 40)),
      resolved_at: null,
      detected_at: existing.detected_at ?? now.toISOString(),
    });
  } else {
    await weakTable.insert({
      user_id: null,
      exam_id: examId,
      topic_id: topicId,
      topic_name: topicName,
      subject_id: located?.subject.id ?? null,
      chapter_id: chapterId,
      weakness_score: 40,
      detected_at: now.toISOString(),
      resolved_at: null,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  3 · getWeakTopics                                                  */
/* ------------------------------------------------------------------ */

export interface WeakTopicInsight {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string | null;
  subjectName: string | null;
  weaknessScore: number;
  /** Why it surfaced — shown under the row. */
  reason: string;
}

/**
 * The student's weakest topics for one exam: unresolved zuno_weak_topics rows
 * first (highest weakness score wins), then low-mastery chapters whose spaced
 * revision is overdue — so the list is useful even before any test was taken.
 */
export function getWeakTopics(
  examId: string,
  weakRows: WeakTopicRow[],
  progressRows: ExamProgressRow[],
  limit = 5,
  todayIso: string = isoDate(new Date()),
): WeakTopicInsight[] {
  const syllabus = getSyllabus(examId);
  const insights: WeakTopicInsight[] = [];
  const seenChapters = new Set<string>();

  const active = weakRows
    .filter((row) => row.exam_id === examId && !row.resolved_at && asNumber(row.weakness_score) > 0)
    .sort((a, b) => asNumber(b.weakness_score) - asNumber(a.weakness_score));
  for (const row of active) {
    const chapterId = row.chapter_id || chapterIdOfTopic(row.topic_id);
    const located = syllabus ? findChapter(syllabus, chapterId) : undefined;
    seenChapters.add(chapterId);
    insights.push({
      topicId: row.topic_id,
      topicName: (row.topic_name || '').trim() || located?.chapter.name || row.topic_id,
      chapterId,
      chapterName: located?.chapter.name ?? null,
      subjectName: located?.subject.name ?? null,
      weaknessScore: asNumber(row.weakness_score),
      reason: 'flagged from your test answers',
    });
    if (insights.length >= limit) return insights;
  }

  /* Fill with overdue, low-mastery chapters. */
  const overdue = progressRows
    .filter(
      (row) =>
        row.exam_id === examId &&
        !!row.spaced_revision_due_at &&
        String(row.spaced_revision_due_at).slice(0, 10) <= todayIso &&
        asNumber(row.mastery_score) < 70 &&
        !seenChapters.has(row.chapter_id),
    )
    .sort((a, b) => asNumber(a.mastery_score) - asNumber(b.mastery_score));
  for (const row of overdue) {
    const located = syllabus ? findChapter(syllabus, row.chapter_id) : undefined;
    const name = (row.chapter_name || '').trim() || located?.chapter.name || row.chapter_id;
    insights.push({
      topicId: topicIdFor(row.chapter_id, name),
      topicName: name,
      chapterId: row.chapter_id,
      chapterName: located?.chapter.name ?? name,
      subjectName: located?.subject.name ?? null,
      weaknessScore: Math.max(0, 70 - asNumber(row.mastery_score)),
      reason: 'revision overdue with low mastery',
    });
    if (insights.length >= limit) break;
  }
  return insights;
}

/* ------------------------------------------------------------------ */
/*  4 · getReadinessScore                                              */
/* ------------------------------------------------------------------ */

export interface SubjectReadiness {
  subjectId: string;
  subject: string;
  pct: number;
}

export interface ReadinessScore {
  examId: string;
  /** Mastery-weighted readiness across the whole syllabus, 0-100. */
  readinessPct: number;
  subjects: SubjectReadiness[];
  strongAreas: SubjectReadiness[];
  weakAreas: SubjectReadiness[];
}

const WEIGHTAGE_FACTOR: Record<string, number> = { high: 3, medium: 2, low: 1 };

function chapterWeightFactor(chapter: SyllabusChapter): number {
  return WEIGHTAGE_FACTOR[chapter.weightage ?? 'medium'] ?? 2;
}

/**
 * Overall readiness for an exam: every syllabus chapter contributes its
 * mastery (0 when never studied), weighted by exam weightage, plus the same
 * number per subject. Strong areas are subjects ≥ 60%, weak areas < 40% (or
 * the bottom two while everything is early).
 */
export function getReadinessScore(
  examId: string,
  progressRows: ExamProgressRow[],
  syllabus?: ExamSyllabus,
): ReadinessScore {
  const exam = syllabus ?? getSyllabus(examId);
  const byChapter = new Map<string, number>();
  for (const row of progressRows) {
    if (row.exam_id === examId) byChapter.set(row.chapter_id, asNumber(row.mastery_score));
  }

  const subjects: SubjectReadiness[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  if (exam) {
    for (const subject of exam.subjects) {
      let subjectSum = 0;
      let subjectWeight = 0;
      for (const chapter of subject.chapters) {
        const factor = chapterWeightFactor(chapter);
        subjectSum += (byChapter.get(chapter.id) ?? 0) * factor;
        subjectWeight += factor;
      }
      const pct = subjectWeight > 0 ? Math.round(subjectSum / subjectWeight) : 0;
      subjects.push({ subjectId: subject.id, subject: subject.name, pct });
      weightedSum += subjectSum;
      weightTotal += subjectWeight;
    }
  }
  const readinessPct = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

  const sorted = [...subjects].sort((a, b) => b.pct - a.pct);
  const strongAreas = sorted.filter((s) => s.pct >= 60).slice(0, 3);
  let weakAreas = sorted.filter((s) => s.pct < 40).slice(-3).reverse();
  if (weakAreas.length === 0 && sorted.length > 0) {
    weakAreas = sorted.slice(-2).reverse();
  }
  return { examId, readinessPct, subjects, strongAreas, weakAreas };
}

/** Persist the latest readiness snapshot into zuno_readiness (upsert). */
export async function persistReadiness(
  readiness: ReadinessScore,
  readinessRows: ReadinessRow[],
  now: Date = new Date(),
): Promise<void> {
  const table = dbTable('zuno_readiness');
  const existing = readinessRows.find((row) => row.exam_id === readiness.examId);
  const payload = {
    readiness_pct: readiness.readinessPct,
    strong_areas: JSON.stringify(readiness.strongAreas.map(({ subject, pct }) => ({ subject, pct }))),
    weak_areas: JSON.stringify(readiness.weakAreas.map(({ subject, pct }) => ({ subject, pct }))),
    computed_at: now.toISOString(),
  };
  if (existing) await table.update(existing.id, payload);
  else await table.insert({ user_id: null, exam_id: readiness.examId, ...payload });
}

/* ------------------------------------------------------------------ */
/*  5 · getTodaysPriority                                              */
/* ------------------------------------------------------------------ */

export interface PriorityChapter {
  chapterId: string;
  chapterName: string;
  subjectName: string | null;
  masteryScore: number;
  dueDate: string;
  /** Higher = revise sooner. */
  urgency: number;
}

/**
 * Chapters whose spaced revision is due today or earlier, ranked by weakness:
 * summed weakness of their topics first, then lowest mastery, then oldest due
 * date.
 */
export function getTodaysPriority(
  examId: string,
  progressRows: ExamProgressRow[],
  weakRows: WeakTopicRow[],
  todayIso: string = isoDate(new Date()),
): PriorityChapter[] {
  const syllabus = getSyllabus(examId);
  const weaknessByChapter = new Map<string, number>();
  for (const row of weakRows) {
    if (row.exam_id !== examId || row.resolved_at) continue;
    const chapterId = row.chapter_id || chapterIdOfTopic(row.topic_id);
    weaknessByChapter.set(chapterId, (weaknessByChapter.get(chapterId) ?? 0) + asNumber(row.weakness_score));
  }
  return progressRows
    .filter(
      (row) =>
        row.exam_id === examId &&
        !!row.spaced_revision_due_at &&
        String(row.spaced_revision_due_at).slice(0, 10) <= todayIso,
    )
    .map((row) => {
      const located = syllabus ? findChapter(syllabus, row.chapter_id) : undefined;
      const mastery = asNumber(row.mastery_score);
      const weakness = weaknessByChapter.get(row.chapter_id) ?? 0;
      const overdueDays = Math.max(
        0,
        Math.round(
          (new Date(`${todayIso}T12:00:00`).getTime() -
            new Date(`${String(row.spaced_revision_due_at).slice(0, 10)}T12:00:00`).getTime()) /
            86400000,
        ),
      );
      return {
        chapterId: row.chapter_id,
        chapterName: (row.chapter_name || '').trim() || located?.chapter.name || row.chapter_id,
        subjectName: located?.subject.name ?? null,
        masteryScore: mastery,
        dueDate: String(row.spaced_revision_due_at).slice(0, 10),
        urgency: weakness * 2 + (100 - mastery) + overdueDays * 5,
      };
    })
    .sort((a, b) => b.urgency - a.urgency);
}

/* ------------------------------------------------------------------ */
/*  6 · getAdaptedPlan                                                 */
/* ------------------------------------------------------------------ */

export interface AdaptedPlanEntry {
  chapterId: string;
  chapterName: string;
  subjectName: string;
  why: string;
}

export interface AdaptedPlan {
  examId: string;
  daysUntilExam: number;
  /** Realistic granular topics per day for what's left. */
  topicsPerDay: number;
  /** The 1-2 subjects to lean into this week. */
  focusSubjects: string[];
  /** Chapters already at ≥ 90 mastery — deliberately skipped. */
  skippedChapters: string[];
  /** The ordered study queue: weak first, then due revision, then fresh high-weight chapters. */
  queue: AdaptedPlanEntry[];
  summary: string;
}

/**
 * A smart plan for the days remaining: how many topics a day the remaining
 * syllabus implies, which subjects deserve focus (lowest readiness first),
 * and an ordered chapter queue — weak chapters first, then overdue revisions,
 * then untouched high-weightage chapters. Mastered chapters (≥ 90) are
 * skipped outright.
 */
export function getAdaptedPlan(
  examId: string,
  daysUntilExam: number,
  progressRows: ExamProgressRow[],
  weakRows: WeakTopicRow[],
  todayIso: string = isoDate(new Date()),
): AdaptedPlan {
  const syllabus = getSyllabus(examId);
  const readiness = getReadinessScore(examId, progressRows, syllabus);
  const masteryByChapter = new Map<string, number>();
  for (const row of progressRows) {
    if (row.exam_id === examId) masteryByChapter.set(row.chapter_id, asNumber(row.mastery_score));
  }

  const skippedChapters: string[] = [];
  let remainingTopics = 0;
  const fresh: Array<{ subject: SyllabusSubject; chapter: SyllabusChapter; weight: number }> = [];
  if (syllabus) {
    for (const subject of syllabus.subjects) {
      for (const chapter of subject.chapters) {
        const mastery = masteryByChapter.get(chapter.id) ?? 0;
        if (mastery >= MASTERY_SKIP_THRESHOLD) {
          skippedChapters.push(chapter.name);
          continue;
        }
        remainingTopics += Math.max(1, Math.round(chapter.topics.length * (1 - mastery / 100)));
        if (mastery === 0) fresh.push({ subject, chapter, weight: chapterWeightFactor(chapter) });
      }
    }
  }
  const days = Math.max(1, daysUntilExam);
  const topicsPerDay = Math.max(2, Math.min(8, Math.ceil(remainingTopics / days)));

  const focusSubjects = [...readiness.subjects]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 2)
    .map((s) => s.subject);

  const queue: AdaptedPlanEntry[] = [];
  const queuedChapters = new Set<string>();
  const push = (chapterId: string, chapterName: string, subjectName: string, why: string) => {
    if (queuedChapters.has(chapterId)) return;
    queuedChapters.add(chapterId);
    queue.push({ chapterId, chapterName, subjectName, why });
  };

  for (const weak of getWeakTopics(examId, weakRows, progressRows, 5, todayIso)) {
    push(weak.chapterId, weak.chapterName ?? weak.topicName, weak.subjectName ?? '', `weak: ${weak.topicName}`);
  }
  for (const due of getTodaysPriority(examId, progressRows, weakRows, todayIso).slice(0, 5)) {
    push(due.chapterId, due.chapterName, due.subjectName ?? '', `revision due ${due.dueDate}`);
  }
  const focusSet = new Set(focusSubjects);
  fresh
    .sort(
      (a, b) =>
        Number(focusSet.has(b.subject.name)) - Number(focusSet.has(a.subject.name)) || b.weight - a.weight,
    )
    .slice(0, 8)
    .forEach(({ subject, chapter, weight }) =>
      push(
        chapter.id,
        chapter.name,
        subject.name,
        weight >= 3 ? 'untouched high-weightage chapter' : 'untouched chapter',
      ),
    );

  const summary =
    `${topicsPerDay} topic${topicsPerDay === 1 ? '' : 's'} a day covers what's left in ${days} day${days === 1 ? '' : 's'}. ` +
    (focusSubjects.length > 0 ? `Lean into ${focusSubjects.join(' and ')}. ` : '') +
    (skippedChapters.length > 0 ? `${skippedChapters.length} mastered chapter${skippedChapters.length === 1 ? '' : 's'} skipped.` : '');

  return { examId, daysUntilExam, topicsPerDay, focusSubjects, skippedChapters, queue, summary };
}

/* ------------------------------------------------------------------ */
/*  Topic-level mastery (Syllabus Browser colour coding)               */
/* ------------------------------------------------------------------ */

export type MasteryBand = 'strong' | 'developing' | 'weak' | 'untouched';

/** Colour band: green ≥ 70, orange 40-69, red < 40, grey when never touched. */
export function masteryBand(pct: number | null): MasteryBand {
  if (pct === null) return 'untouched';
  if (pct >= 70) return 'strong';
  if (pct >= 40) return 'developing';
  return 'weak';
}

/**
 * Per-topic mastery derived from the attempt log: studied sessions add the
 * same +15/+10/+5 the chapter earns, correct answers +10, wrong answers -15,
 * clamped to 0-100. Topics with no attempts return no entry (untouched).
 */
export function topicMasteryMap(examId: string, attempts: TopicAttemptRow[]): Map<string, number> {
  const map = new Map<string, number>();
  const ordered = [...attempts]
    .filter((row) => row.exam_id === examId)
    .sort((a, b) => String(a.attempted_at).localeCompare(String(b.attempted_at)));
  for (const row of ordered) {
    const current = map.get(row.topic_id) ?? 0;
    let delta = 0;
    if (row.result === 'studied') delta = MASTERY_GAIN[normalizeDifficulty(row.difficulty_felt)];
    else if (row.result === 'correct') delta = 10;
    else if (row.result === 'wrong') delta = -15;
    map.set(row.topic_id, clampMastery(current + delta));
  }
  return map;
}

/** Parse the strong/weak areas JSON off a zuno_readiness row, defensively. */
export function parseReadinessAreas(raw: unknown): Array<{ subject: string; pct: number }> {
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      subject: String((entry as { subject?: unknown })?.subject ?? '').trim(),
      pct: asNumber((entry as { pct?: unknown })?.pct as number | string | null | undefined),
    }))
    .filter((entry) => entry.subject);
}

/**
 * Map a planner task (subject + topic free text) onto the syllabus: the
 * best-matching chapter of the student's active exam, so completing a task
 * can feed recordStudySession automatically. Returns undefined when nothing
 * matches convincingly.
 */
export function matchTaskToChapter(
  exam: ExamSyllabus | undefined,
  subject: string,
  topic: string,
): { chapterId: string; chapterName: string; subjectName: string } | undefined {
  if (!exam) return undefined;
  const query = ` ${syllabusSlug(`${subject} ${topic}`).replace(/_/g, ' ')} `;
  const topicQuery = ` ${syllabusSlug(topic).replace(/_/g, ' ')} `;
  let best: { chapterId: string; chapterName: string; subjectName: string; score: number } | undefined;
  for (const subjectDef of exam.subjects) {
    for (const chapter of subjectDef.chapters) {
      let score = 0;
      const chapterSlug = ` ${syllabusSlug(chapter.name).replace(/_/g, ' ')} `;
      if ((topicQuery ?? '').trim() && (topicQuery.includes(chapterSlug) || chapterSlug.includes(topicQuery))) score += 60;
      const chapterWords = (chapterSlug ?? '').trim().split(' ').filter((w) => w.length >= 4);
      for (const word of chapterWords) {
        if (query.includes(` ${word} `) || query.includes(`${word} `)) score += word.length >= 6 ? 14 : 8;
      }
      for (const chapterTopic of chapter.topics) {
        const topicSlug = syllabusSlug(chapterTopic).replace(/_/g, ' ');
        const words = topicSlug.split(' ').filter((w) => w.length >= 5);
        let hits = 0;
        for (const word of words) if (query.includes(word)) hits += 1;
        if (hits >= 2) score += 20;
        else if (hits === 1) score += 6;
      }
      if (score > (best?.score ?? 0)) {
        best = { chapterId: chapter.id, chapterName: chapter.name, subjectName: subjectDef.name, score };
      }
    }
  }
  return best && best.score >= 20
    ? { chapterId: best.chapterId, chapterName: best.chapterName, subjectName: best.subjectName }
    : undefined;
}
