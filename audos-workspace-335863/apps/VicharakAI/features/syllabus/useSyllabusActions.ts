/**
 * Syllabus feature actions — every "put this syllabus ground on my plan"
 * entry point: Exam Insights' "Study now", the Syllabus Browser's + button,
 * and the chat's topic action cards ("Add to study plan" / "Mark as weak").
 *
 * Phase 3: every task created here carries its STRUCTURED syllabus identity
 * (stable topic/chapter/subject ids) on the annotation, so the mastery and
 * coverage engines never fuzzy-match these tasks again.
 * Extracted from App.tsx.
 */
import { useState } from 'react';
import type { WeakTopicInsight } from '../../adaptationEngine';
import { chapterIdOfTopic } from '../../adaptationEngine';
import type { ExamSyllabus, SyllabusChapter, SyllabusSubject } from '../../data/syllabuses';
import type { MentionedTopic } from '../../ExamChatSupport';
import { markTopicWeak } from '../mastery/masteryService';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import type { TasksFeature } from '../tasks/useTasks';

export interface SyllabusActionsFeature {
  insightsAdding: string | null;
  syllabusBrowserOpen: boolean;
  setSyllabusBrowserOpen: (open: boolean) => void;
  browserAddingChapter: string | null;
  topicActionBusy: string | null;
  handledTopicIds: Set<string>;
  studyWeakTopicNow: (weak: WeakTopicInsight) => Promise<void>;
  studyChapterFromBrowser: (exam: ExamSyllabus, subject: SyllabusSubject, chapter: SyllabusChapter) => Promise<void>;
  addTopicToPlanFromChat: (mention: MentionedTopic) => Promise<void>;
  markTopicWeakFromChat: (mention: MentionedTopic) => Promise<void>;
}

export function useSyllabusActions(
  data: StudentData,
  toast: ToastFeature,
  tasks: TasksFeature,
): SyllabusActionsFeature {
  const { activeSyllabusExam, weakTopicsQ } = data;
  const { showToast } = toast;
  const { addTask } = tasks;

  const [insightsAdding, setInsightsAdding] = useState<string | null>(null);
  const [syllabusBrowserOpen, setSyllabusBrowserOpen] = useState(false);
  const [browserAddingChapter, setBrowserAddingChapter] = useState<string | null>(null);
  const [topicActionBusy, setTopicActionBusy] = useState<string | null>(null);
  const [handledTopicIds, setHandledTopicIds] = useState<Set<string>>(new Set());

  /** Exam Insights → "Study now": the weak topic becomes a task on Today. */
  const studyWeakTopicNow = async (weak: WeakTopicInsight) => {
    if (insightsAdding) return;
    setInsightsAdding(weak.topicId);
    try {
      const created = await addTask(weak.subjectName || 'General', weak.topicName, 'Revision', true, undefined, {
        tid: weak.topicId,
        cid: weak.chapterId,
      });
      showToast(created ? `Added ${weak.topicName} to today's plan.` : `${weak.topicName} is already on your plan.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setInsightsAdding(null);
    }
  };

  /** Syllabus Browser → the + on a chapter row queues it as a task. */
  const studyChapterFromBrowser = async (_exam: ExamSyllabus, subject: SyllabusSubject, chapter: SyllabusChapter) => {
    if (browserAddingChapter) return;
    setBrowserAddingChapter(chapter.id);
    try {
      const created = await addTask(subject.name, chapter.name, 'Self Study', false, undefined, {
        cid: chapter.id,
        sid: subject.id,
      });
      showToast(created ? `Added ${chapter.name} to today's plan.` : `${chapter.name} is already on your plan.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setBrowserAddingChapter(null);
    }
  };

  /** Chat topic card → "Add to study plan". */
  const addTopicToPlanFromChat = async (mention: MentionedTopic) => {
    if (topicActionBusy) return;
    setTopicActionBusy(mention.topicId);
    try {
      const created = await addTask(mention.subjectName, mention.topicName, 'Self Study', true, undefined, {
        tid: mention.topicId,
        cid: mention.chapterId || chapterIdOfTopic(mention.topicId),
      });
      setHandledTopicIds((prev) => new Set(prev).add(mention.topicId));
      showToast(created ? `Added ${mention.topicName} to today's plan.` : `${mention.topicName} is already on your plan.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setTopicActionBusy(null);
    }
  };

  /** Chat topic card → "Mark as weak" (writes the weakness row safely). */
  const markTopicWeakFromChat = async (mention: MentionedTopic) => {
    if (topicActionBusy || !activeSyllabusExam) return;
    setTopicActionBusy(mention.topicId);
    try {
      await markTopicWeak(activeSyllabusExam.id, mention.topicId, mention.topicName);
      weakTopicsQ.refresh();
      setHandledTopicIds((prev) => new Set(prev).add(mention.topicId));
      showToast(`Marked ${mention.topicName} as weak — it now ranks in your Exam Insights.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setTopicActionBusy(null);
    }
  };

  return {
    insightsAdding,
    syllabusBrowserOpen,
    setSyllabusBrowserOpen,
    browserAddingChapter,
    topicActionBusy,
    handledTopicIds,
    studyWeakTopicNow,
    studyChapterFromBrowser,
    addTopicToPlanFromChat,
    markTopicWeakFromChat,
  };
}
