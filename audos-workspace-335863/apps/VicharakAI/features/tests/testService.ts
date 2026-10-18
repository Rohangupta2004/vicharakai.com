/**
 * Tests feature service — the shared post-test bookkeeping every test flow
 * uses (Test Mode, the doubt practice test and the Test Scores tab). The old
 * App.tsx repeated these loops three times; they live ONCE here (Phase 6).
 */
import { addDaysISO, topicKey, type StudyItem } from '../../engine';
import { matchTaskToChapter } from '../../adaptationEngine';
import { topicIdFor, type ExamSyllabus } from '../../data/syllabuses';
import { WEAK_TOPIC_THRESHOLD, percentOf, type TopicBreakdown } from '../../mcq';
import { recordTestResult } from '../mastery/masteryService';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';

/**
 * One mastery + weakness update per tested topic — the closed loop between
 * any test surface and the adaptation engine. Chapter resolution uses the
 * canonical syllabus; free-text topics fall back to the legacy fuzzy match.
 */
export async function feedBreakdownToMastery(
  activeSyllabusExam: ExamSyllabus | undefined,
  breakdown: TopicBreakdown[],
): Promise<void> {
  if (!activeSyllabusExam) return;
  for (const entry of breakdown) {
    const matched = matchTaskToChapter(activeSyllabusExam, entry.subject, entry.topic);
    if (!matched) continue;
    const pct = percentOf(entry.correct, entry.total);
    await recordTestResult(
      activeSyllabusExam.id,
      topicIdFor(matched.chapterId, entry.topic),
      pct >= WEAK_TOPIC_THRESHOLD,
      pct,
      { topicName: entry.topic },
    );
  }
}

/**
 * Weak topics (<60%) jump the spaced-revision queue: the next pending
 * revision moves to today, or — when none is pending but the topic HAS
 * completed study history — a fresh next-day revision row is created.
 * An unstudied weak topic stays in the weak-chapters list instead (you
 * can't revise what you haven't studied yet). Returns true when any
 * revision row changed.
 */
export async function promoteWeakTopicsToRevision(
  weak: TopicBreakdown[],
  items: StudyItem[],
  profileExam: string | null,
  today: string,
): Promise<boolean> {
  let changed = false;
  for (const entry of weak) {
    const key = topicKey(entry.subject, entry.topic);
    const pendingRevs = items
      .filter((i) => i.kind === 'revision' && i.status === 'pending' && (i.source_key || topicKey(i.subject, i.topic)) === key)
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
    const studiedParent = items.find(
      (i) => i.kind === 'new' && i.status === 'done' && (i.source_key || topicKey(i.subject, i.topic)) === key,
    );
    if (pendingRevs.length > 0) {
      if (pendingRevs[0].scheduled_for > today) {
        await verifiedDbFrom(TABLES.items).update(pendingRevs[0].id, { scheduled_for: today });
        changed = true;
      }
    } else if (profileExam && studiedParent) {
      await verifiedDbFrom(TABLES.items).insert({
        exam: profileExam,
        subject: entry.subject,
        topic: entry.topic,
        kind: 'revision',
        scheduled_for: addDaysISO(today, 1),
        status: 'pending',
        studied_on: studiedParent.studied_on ?? today,
        interval_days: 1,
        source_key: key,
      });
      changed = true;
    }
  }
  return changed;
}

/** Store one test run in zuno_test_results (Test Mode and doubt tests alike). */
export async function insertTestResultRow(args: {
  breakdown: TopicBreakdown[];
  score: number;
  total: number;
  wrongIds: number[];
  timeLimitMinutes: number | null;
  durationSeconds: number;
  today: string;
}): Promise<void> {
  await verifiedDbFrom(TABLES.testResults).insert({
    user_id: null,
    topics: JSON.stringify(args.breakdown),
    score: args.score,
    total: args.total,
    wrong_question_ids: JSON.stringify(args.wrongIds),
    time_limit_minutes: args.timeLimitMinutes,
    duration_seconds: args.durationSeconds,
    created_on: args.today,
  });
}
