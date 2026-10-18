/**
 * Pure test/weekly selectors — chapter stats, focus chips, test-topic
 * options and weekly counters. No React, no data access. Extracted verbatim
 * from App.tsx.
 */
import { localDayOf, topicKey, type StudyItem } from '../../engine';
import type { ExamDef } from '../../syllabus';
import {
  WEAK_TOPIC_THRESHOLD,
  adaptiveContextForTopic,
  examBankRowMatchesTarget,
  parseBreakdown,
  type ExamQuestionBankRow,
  type McqQuestion,
  type TestResultRow,
  type WeeklyTargetRow,
} from '../../mcq';
import { chapterKey, type ChapterStat, type FocusChapter } from '../../WeeklyTargetsScreen';
import { inWeek } from '../../WeeklyGoals';
import type { TestTopicOption } from '../../TestMode';

export function findWeekRow(rows: WeeklyTargetRow[], weekStartDate: string): WeeklyTargetRow | null {
  return rows.find((row) => row.week_start_date === weekStartDate) ?? null;
}

export function countWeeklyTopicsDone(studentItems: StudyItem[], weekStart: string): number {
  return studentItems.filter(
    (i) => i.kind === 'new' && i.status === 'done' && !!i.completed_at && inWeek(localDayOf(i.completed_at), weekStart),
  ).length;
}

export function countWeeklyTestsDone(testResults: TestResultRow[], weekStart: string): number {
  return testResults.filter((row) => inWeek(row.created_on, weekStart)).length;
}

/** This week's focus chapters (student- or AI-picked), parsed defensively. */
export function parseFocusChapters(weeklyRow: WeeklyTargetRow | null): FocusChapter[] {
  let raw: unknown = weeklyRow?.focus_chapters;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      subject: String((entry as { subject?: unknown })?.subject ?? '').trim(),
      chapter: String((entry as { chapter?: unknown })?.chapter ?? '').trim(),
    }))
    .filter((c) => c.subject && c.chapter);
}

/** Per-chapter stats for Weekly Targets: accuracy folded from test-result
 * breakdowns (topics mapped into their syllabus chapter) + topic coverage. */
export function buildChapterStats(
  examDef: ExamDef | undefined,
  studentItems: StudyItem[],
  testResults: TestResultRow[],
): Map<string, ChapterStat> {
  const map = new Map<string, ChapterStat>();
  if (!examDef) return map;
  const doneKeys = new Set(
    studentItems
      .filter((i) => i.kind === 'new' && i.status === 'done')
      .map((i) => i.source_key || topicKey(i.subject, i.topic)),
  );
  const topicToChapter = new Map<string, { subject: string; chapter: string }>();
  for (const subject of examDef.subjects) {
    for (const chapter of subject.chapters) {
      const key = chapterKey(subject.name, chapter.name);
      let covered = 0;
      for (const topic of chapter.topics) {
        topicToChapter.set(topicKey(subject.name, topic), { subject: subject.name, chapter: chapter.name });
        if (doneKeys.has(topicKey(subject.name, topic))) covered += 1;
      }
      topicToChapter.set(topicKey(subject.name, chapter.name), { subject: subject.name, chapter: chapter.name });
      map.set(key, { accuracy: null, attempts: 0, covered, total: chapter.topics.length });
    }
  }
  const agg = new Map<string, { correct: number; total: number; attempts: number }>();
  for (const row of testResults) {
    for (const entry of parseBreakdown(row)) {
      const mapped = topicToChapter.get(topicKey(entry.subject, entry.topic));
      if (!mapped) continue;
      const key = chapterKey(mapped.subject, mapped.chapter);
      const cur = agg.get(key) ?? { correct: 0, total: 0, attempts: 0 };
      cur.correct += entry.correct;
      cur.total += entry.total;
      cur.attempts += 1;
      agg.set(key, cur);
    }
  }
  for (const [key, cur] of agg) {
    const stat = map.get(key);
    if (!stat || cur.total <= 0) continue;
    stat.accuracy = Math.round((cur.correct / cur.total) * 100);
    stat.attempts = cur.attempts;
  }
  return map;
}

/** "AI focus this week" on Today — saved focus chapters first, else the 2–3
 * weakest tested topics (accuracy < 60%), never more than three chips. */
export function buildAiFocusChips(focusChapters: FocusChapter[], testResults: TestResultRow[]): string[] {
  if (focusChapters.length > 0) return focusChapters.slice(0, 3).map((c) => c.chapter);
  const weak: Array<{ topic: string; accuracy: number }> = [];
  const seen = new Set<string>();
  for (const row of testResults) {
    for (const entry of parseBreakdown(row)) {
      const key = topicKey(entry.subject, entry.topic);
      if (seen.has(key)) continue;
      seen.add(key);
      const ctx = adaptiveContextForTopic(testResults, entry.subject, entry.topic);
      if (ctx && ctx.accuracy < WEAK_TOPIC_THRESHOLD) weak.push({ topic: entry.topic, accuracy: ctx.accuracy });
    }
  }
  return weak.sort((a, b) => a.accuracy - b.accuracy).slice(0, 3).map((w) => w.topic);
}

/** Test Mode topic picker: the student's own topics, plus available coverage. */
export function buildTestTopicOptions(
  studentItems: StudyItem[],
  mcqBank: McqQuestion[],
  examQuestionsBank: ExamQuestionBankRow[] = [],
  profileExamId?: string | null,
): TestTopicOption[] {
  const seen = new Map<string, TestTopicOption>();
  for (const item of studentItems) {
    if (item.kind !== 'new') continue;
    const key = item.source_key || topicKey(item.subject, item.topic);
    if (!seen.has(key)) seen.set(key, { subject: item.subject, topic: item.topic, key, bankCount: 0 });
  }
  const answeredBankIds = new Set(
    mcqBank.map((question) => question.bank_question_id).filter((id): id is string => Boolean(id)),
  );
  for (const q of mcqBank) {
    if (q.bank_question_id) continue;
    const key = q.source_key || topicKey(q.subject, q.topic);
    const existing = seen.get(key);
    if (existing) existing.bankCount += 1;
    else seen.set(key, { subject: q.subject, topic: q.topic, key, bankCount: 1 });
  }
  for (const option of seen.values()) {
    option.bankCount += examQuestionsBank.filter(
      (row) =>
        !answeredBankIds.has(row.id) &&
        examBankRowMatchesTarget(row, profileExamId, option.subject, option.topic),
    ).length;
  }
  return Array.from(seen.values());
}
