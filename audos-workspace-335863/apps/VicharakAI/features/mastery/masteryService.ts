/**
 * Mastery feature — the ONLY writer of the adaptation tables
 * (zuno_exam_progress, zuno_topic_attempts, zuno_weak_topics, zuno_readiness
 * — physical names in services/database/tables.ts).
 *
 * Fixes the stale/concurrent-update bug the old adaptationEngine writers had:
 * they computed the next mastery from RENDER-TIME rows, so two quick
 * completions could both read mastery 50, both write 60, and lose an attempt
 * (production already holds one duplicated chapter row from that race).
 *
 * Every write here now:
 *  1. runs through `runExclusive` keyed by the logical row (one chapter's
 *     mastery, one topic's weakness, one exam's readiness), so rapid
 *     successive study actions apply strictly in order;
 *  2. re-reads the CURRENT row from the database inside the lock instead of
 *     trusting whatever the screen had loaded; and
 *  3. self-heals duplicates — when a past race left two rows for the same
 *     chapter/topic/exam, they are merged into one and the extras deleted.
 *
 * The maths (gain per difficulty, weakness dynamics, the spaced ladder) stays
 * in adaptationEngine.ts + config/revision.ts — this file only owns the safe
 * write orchestration.
 */

import {
  MASTERY_CORRECT,
  MASTERY_GAIN,
  MASTERY_WRONG,
  WEAKNESS_CAP,
  WEAKNESS_ON_CORRECT,
  WEAKNESS_ON_WRONG,
  asNumber,
  chapterIdOfTopic,
  nextRevisionDue,
  type ExamProgressRow,
  type ReadinessRow,
  type ReadinessScore,
  type SessionDifficulty,
  type WeakTopicRow,
} from '../../adaptationEngine';
import { findChapter, getSyllabus, topicIdFor } from '../../data/syllabuses';
import { getSystemDate } from '../../systemDate';
import { TABLES } from '../../services/database/tables';
import { fetchRowsWhere, runExclusive, verifiedDbFrom } from '../../services/database/dbClient';

function clampMastery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDifficulty(value: string | null | undefined): SessionDifficulty {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

/* ------------------------------------------------------------------ */
/*  Fresh reads + duplicate self-heal                                   */
/* ------------------------------------------------------------------ */

/** Merge duplicate rows for one logical key: keep one, delete the rest. */
async function selfHeal<T extends { id: number }>(
  table: string,
  rows: T[],
  pickKeeper: (rows: T[]) => T,
  mergedPatch: (keeper: T, rows: T[]) => Record<string, unknown> | null,
): Promise<T> {
  const keeper = pickKeeper(rows);
  const extras = rows.filter((row) => row.id !== keeper.id);
  const guarded = verifiedDbFrom(table);
  const patch = mergedPatch(keeper, rows);
  if (patch) await guarded.update(keeper.id, patch).catch(() => undefined);
  for (const extra of extras) {
    await guarded.delete(extra.id).catch(() => undefined);
  }
  return patch ? ({ ...keeper, ...patch } as T) : keeper;
}

/** The current zuno_exam_progress row for one chapter — merged when a past
 * race duplicated it, null when the chapter was never touched. */
async function freshProgressRow(examId: string, chapterId: string): Promise<ExamProgressRow | null> {
  const rows = await fetchRowsWhere<ExamProgressRow>(TABLES.examProgress, [
    { column: 'exam_id', operator: 'eq', value: examId },
    { column: 'chapter_id', operator: 'eq', value: chapterId },
  ]);
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  return selfHeal(
    TABLES.examProgress,
    rows,
    (all) => [...all].sort((a, b) => asNumber(b.attempts) - asNumber(a.attempts) || a.id - b.id)[0],
    (keeper, all) => ({
      mastery_score: Math.max(...all.map((row) => asNumber(row.mastery_score))),
      attempts: Math.max(...all.map((row) => asNumber(row.attempts))),
      last_studied_at:
        all.map((row) => row.last_studied_at).filter(Boolean).sort().pop() ?? keeper.last_studied_at ?? null,
      spaced_revision_due_at:
        all.map((row) => row.spaced_revision_due_at).filter(Boolean).sort().shift() ??
        keeper.spaced_revision_due_at ??
        null,
    }),
  );
}

/** The current weakness row for one topic — merged when duplicated. */
async function freshWeakRow(examId: string, topicId: string): Promise<WeakTopicRow | null> {
  const rows = await fetchRowsWhere<WeakTopicRow>(TABLES.weakTopics, [
    { column: 'exam_id', operator: 'eq', value: examId },
    { column: 'topic_id', operator: 'eq', value: topicId },
  ]);
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  return selfHeal(
    TABLES.weakTopics,
    rows,
    (all) => [...all].sort((a, b) => asNumber(b.weakness_score) - asNumber(a.weakness_score) || a.id - b.id)[0],
    (keeper, all) => ({
      weakness_score: Math.max(...all.map((row) => asNumber(row.weakness_score))),
      resolved_at: all.every((row) => row.resolved_at) ? keeper.resolved_at ?? null : null,
    }),
  );
}

/** The current readiness snapshot row for one exam — merged when duplicated. */
async function freshReadinessRow(examId: string): Promise<ReadinessRow | null> {
  const rows = await fetchRowsWhere<ReadinessRow>(TABLES.readiness, [
    { column: 'exam_id', operator: 'eq', value: examId },
  ]);
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  return selfHeal(
    TABLES.readiness,
    rows,
    (all) => [...all].sort((a, b) => b.id - a.id)[0],
    () => null,
  );
}

/* ------------------------------------------------------------------ */
/*  1 · recordStudySession                                              */
/* ------------------------------------------------------------------ */

/**
 * A study session on a chapter: bumps chapter mastery (+15 easy / +10 medium /
 * +5 hard, capped at 100), advances the spaced-revision ladder by attempt
 * count and logs one topic-attempt row per topic studied. Serialized per
 * chapter and computed from a fresh database read, so rapid completions can
 * never lose attempts or mastery.
 */
export async function recordStudySession(
  examId: string,
  chapterId: string,
  topicsStudied: string[],
  difficultyFelt: SessionDifficulty | string,
  options: { now?: Date } = {},
): Promise<void> {
  const now = options.now ?? getSystemDate();
  const today = isoDate(now);
  const difficulty = normalizeDifficulty(typeof difficultyFelt === 'string' ? difficultyFelt : null);
  const gain = MASTERY_GAIN[difficulty];
  const syllabus = getSyllabus(examId);
  const located = syllabus ? findChapter(syllabus, chapterId) : undefined;

  await runExclusive(`mastery|${examId}|${chapterId}`, async () => {
    const existing = await freshProgressRow(examId, chapterId);
    const attempts = (existing ? asNumber(existing.attempts) : 0) + 1;
    const mastery = clampMastery((existing ? asNumber(existing.mastery_score) : 0) + gain);
    const dueAt = nextRevisionDue(today, attempts);
    const progress = verifiedDbFrom(TABLES.examProgress);
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
  });

  const attemptsTable = verifiedDbFrom(TABLES.topicAttempts);
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
/*  2 · recordTestResult                                                */
/* ------------------------------------------------------------------ */

/**
 * A test answer on a topic: logs the attempt, adjusts chapter mastery
 * (+5 correct / −10 wrong) and moves the topic's weakness score — wrong
 * answers create or reinforce a weakness row (+25, capped at 100); correct
 * answers reduce it by 20 and stamp resolved_at at zero. Serialized per
 * chapter and per topic, computed from fresh reads.
 */
export async function recordTestResult(
  examId: string,
  topicId: string,
  isCorrect: boolean,
  score: number | null,
  options: { topicName?: string | null; now?: Date } = {},
): Promise<void> {
  const now = options.now ?? getSystemDate();
  const chapterId = chapterIdOfTopic(topicId);
  const syllabus = getSyllabus(examId);
  const located = syllabus ? findChapter(syllabus, chapterId) : undefined;
  const topicName = (options.topicName ?? '').trim() || located?.chapter.name || null;

  await verifiedDbFrom(TABLES.topicAttempts).insert({
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
  await runExclusive(`mastery|${examId}|${chapterId}`, async () => {
    const existing = await freshProgressRow(examId, chapterId);
    const delta = isCorrect ? MASTERY_CORRECT : MASTERY_WRONG;
    const progress = verifiedDbFrom(TABLES.examProgress);
    if (existing) {
      await progress.update(existing.id, {
        mastery_score: clampMastery(asNumber(existing.mastery_score) + delta),
        attempts: asNumber(existing.attempts) + 1,
      });
    } else if (!isCorrect) {
      // A wrong answer on an unstudied chapter still creates a (low) mastery
      // row so the chapter surfaces in priorities; a lone correct one doesn't.
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
  });

  /* Weakness bookkeeping — serialized per topic. */
  await runExclusive(`weak|${examId}|${topicId}`, async () => {
    const weakExisting = await freshWeakRow(examId, topicId);
    const weakTable = verifiedDbFrom(TABLES.weakTopics);
    if (!isCorrect) {
      const nextScore = Math.min(
        WEAKNESS_CAP,
        (weakExisting ? asNumber(weakExisting.weakness_score) : 0) + WEAKNESS_ON_WRONG,
      );
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
  });

  void score; // reserved: percentage scores refine mastery in a later pass
}

/* ------------------------------------------------------------------ */
/*  3 · markTopicWeak                                                   */
/* ------------------------------------------------------------------ */

/** Manually flag a topic as weak (the chat's "Mark as weak" action). */
export async function markTopicWeak(examId: string, topicId: string, topicName: string): Promise<void> {
  const now = getSystemDate();
  const chapterId = chapterIdOfTopic(topicId);
  const syllabus = getSyllabus(examId);
  const located = syllabus ? findChapter(syllabus, chapterId) : undefined;
  await runExclusive(`weak|${examId}|${topicId}`, async () => {
    const existing = await freshWeakRow(examId, topicId);
    const weakTable = verifiedDbFrom(TABLES.weakTopics);
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
  });
}

/* ------------------------------------------------------------------ */
/*  4 · persistReadiness                                                */
/* ------------------------------------------------------------------ */

/** Persist the latest readiness snapshot (one row per exam, updated in place). */
export async function persistReadiness(readiness: ReadinessScore, now: Date = getSystemDate()): Promise<void> {
  await runExclusive(`readiness|${readiness.examId}`, async () => {
    const existing = await freshReadinessRow(readiness.examId);
    const table = verifiedDbFrom(TABLES.readiness);
    const payload = {
      readiness_pct: readiness.readinessPct,
      strong_areas: JSON.stringify(readiness.strongAreas.map(({ subject, pct }) => ({ subject, pct }))),
      weak_areas: JSON.stringify(readiness.weakAreas.map(({ subject, pct }) => ({ subject, pct }))),
      computed_at: now.toISOString(),
    };
    if (existing) await table.update(existing.id, payload);
    else await table.insert({ user_id: null, exam_id: readiness.examId, ...payload });
  });
}
