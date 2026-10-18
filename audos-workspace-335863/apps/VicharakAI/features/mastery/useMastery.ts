/**
 * Mastery feature — the adaptation-engine wiring: feeding study sessions
 * into chapter mastery when tasks complete, and keeping the readiness
 * snapshot in sync. All writes flow through masteryService (serialized +
 * fresh-read safe). Extracted from App.tsx.
 */
import { useEffect, useRef } from 'react';
import { topicKey, type StudyItem } from '../../engine';
import { asNumber as engineNumber, type ExamProgressRow } from '../../adaptationEngine';
import { matchTaskToChapter } from '../../adaptationEngine';
import { persistReadiness, recordStudySession } from './masteryService';
import type { StudentData } from '../../app/StudentDataContext';

export interface MasteryFeature {
  /** Completed task → study session on its syllabus chapter (fire-and-forget). */
  feedAdaptationEngine: (item: StudyItem) => void;
}

/** The chapter a task belongs to: the STRUCTURED syllabus id stored on the
 * task's annotation when it was created from the syllabus (Phase 3 identity),
 * with fuzzy text matching kept only as the legacy fallback. */
export function chapterForTask(
  data: Pick<StudentData, 'annotations' | 'activeSyllabusExam'>,
  item: StudyItem,
): string | null {
  const { annotations, activeSyllabusExam } = data;
  if (!activeSyllabusExam) return null;
  const ann = annotations.get(item.source_key || topicKey(item.subject, item.topic));
  // Structured identity first — exact, never fuzzy, when the task was
  // created from the syllabus (browser, insights, chat cards, topic picker).
  if (ann?.syl?.cid) return ann.syl.cid;
  const matched = matchTaskToChapter(activeSyllabusExam, item.subject, item.topic);
  return matched?.chapterId ?? null;
}

export function useMastery(data: StudentData): MasteryFeature {
  const {
    dbSessionReady,
    activeSyllabusExam,
    readiness,
    readinessQ,
    examProgressQ,
    topicAttemptsQ,
    annotations,
    feelingByKey,
  } = data;

  /* Keep the zuno_readiness snapshot in sync — one upsert per real change. */
  const readinessSyncRef = useRef('');
  useEffect(() => {
    if (!dbSessionReady || !activeSyllabusExam || !readiness || readinessQ.loading || examProgressQ.loading) return;
    const stamp = `${activeSyllabusExam.id}:${readiness.readinessPct}:${readiness.weakAreas.map((w) => `${w.subject}${w.pct}`).join(',')}`;
    if (readinessSyncRef.current === stamp) return;
    const stored = (readinessQ.data ?? []).find((row) => row.exam_id === activeSyllabusExam.id);
    if (stored && engineNumber(stored.readiness_pct) === readiness.readinessPct) {
      readinessSyncRef.current = stamp;
      return;
    }
    readinessSyncRef.current = stamp;
    void persistReadiness(readiness)
      .then(() => readinessQ.refresh())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, activeSyllabusExam, readiness, readinessQ.loading, examProgressQ.loading, readinessQ.data]);

  /** Completed task → study session on its syllabus chapter (fire-and-forget).
   * Difficulty comes from any recorded feeling for the topic, else 'medium'. */
  const feedAdaptationEngine = (item: StudyItem) => {
    if (!activeSyllabusExam) return;
    const chapterId = chapterForTask({ annotations, activeSyllabusExam }, item);
    if (!chapterId) return;
    const feeling = feelingByKey.get(item.source_key || topicKey(item.subject, item.topic)) ?? 'medium';
    void recordStudySession(activeSyllabusExam.id, chapterId, [item.topic], feeling)
      .then(() => {
        examProgressQ.refresh();
        topicAttemptsQ.refresh();
      })
      .catch(() => undefined);
  };

  return { feedAdaptationEngine };
}

export type { ExamProgressRow };
