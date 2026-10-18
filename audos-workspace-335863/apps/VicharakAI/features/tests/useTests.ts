/**
 * Tests feature — practice quizzes, Test Mode (curated + adaptive), the
 * Mistake Book practice test, Generate Test, photo→tasks, weekly targets
 * and the test-score log. Extracted from App.tsx; the repeated post-test
 * bookkeeping now lives once in testService.ts.
 */
import { useMemo, useState } from 'react';
import {
  scorePercent,
  taskTypeKey,
  topicKey,
  type ScoreEntry,
  type StudyItem,
  type TestMistake,
} from '../../engine';
import {
  MCQ_LETTERS,
  WEAK_TOPIC_THRESHOLD,
  adaptiveContextForTopic,
  bankExamIdForProfile,
  convertFlaggedToMcqs,
  flaggedConceptLabel,
  flaggedOptions,
  generateMcqs,
  percentOf,
  selectExamBankQuestions,
  type FlaggedMcqShape,
  type FlaggedRow,
  type McqDifficulty,
  type McqDraft,
  type McqLetter,
  type McqQuestion,
  type TopicBreakdown,
} from '../../mcq';
import type { PlayableQuestion, QuizTarget } from '../../QuizSheets';
import type { TestConfig, TestReview } from '../../TestMode';
import {
  questionsFromMcqDrafts,
  type GeneratedTestQuestion,
} from '../../GenerateTest';
import type { MockPracticePlan } from '../testAnalysis/taSelectors';
import type { FocusChapter } from '../../WeeklyTargetsScreen';
import type { MistakeDraft, ScoreDraft } from '../../DashboardTab';
import type { TestScoreDraft } from '../../TestScoresTab';
import { uploadImage } from '../../Attachments';
import { addDaysISO } from '../../engine';
import { matchTaskToChapter } from '../../adaptationEngine';
import { topicIdFor } from '../../data/syllabuses';
import { recordTestResult } from '../mastery/masteryService';
import { feedBreakdownToMastery, insertTestResultRow, promoteWeakTopicsToRevision } from './testService';
import { ENABLE_AUTO_QUESTION_GEN, WRONG_REASON_FOLLOWUPS, tagConcept, type WrongReason } from '../../config/sharedConfig';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import type { AccessFeature } from '../access/useAccess';
import type { TasksFeature } from '../tasks/useTasks';

export interface TestsFeature {
  /* quizzes */
  quizTarget: QuizTarget | null;
  setQuizTarget: (target: QuizTarget | null) => void;
  activeQuiz: { title: string; questions: PlayableQuestion[] } | null;
  setActiveQuiz: (quiz: { title: string; questions: PlayableQuestion[] } | null) => void;
  quizAdaptive: ReturnType<typeof adaptiveContextForTopic>;
  bankQuestionsFor: (subject: string, topic: string) => McqQuestion[];
  prepareQuizQuestions: (target: QuizTarget, count: number, difficulty: McqDifficulty) => Promise<McqDraft[]>;
  handleQuizGenerated: (drafts: McqDraft[]) => Promise<void>;
  attachmentsForQuestion: (question: PlayableQuestion) => string[];
  attachImageToQuestion: (question: PlayableQuestion, file: File) => Promise<void>;
  attachBusy: boolean;
  attachImageToTask: (item: StudyItem, file: File) => Promise<void>;
  removeTaskAttachment: (item: StudyItem, url: string) => Promise<void>;
  lightboxUrl: string | null;
  setLightboxUrl: (url: string | null) => void;

  /* Test Mode */
  testSetupOpen: boolean;
  setTestSetupOpen: (open: boolean) => void;
  /** Open the test setup sheet, or explain why there is nothing to test yet. */
  openTestSetup: () => void;
  testPreparing: boolean;
  testPrepareNote: string | null;
  testError: string | null;
  setTestError: (e: string | null) => void;
  activeTest: { questions: PlayableQuestion[]; timeLimitMinutes: number | null; curationNotes: string[] } | null;
  setActiveTest: (t: { questions: PlayableQuestion[]; timeLimitMinutes: number | null; curationNotes: string[] } | null) => void;
  testReview: TestReview | null;
  setTestReview: (review: TestReview | null) => void;
  startTest: (config: TestConfig) => Promise<void>;
  handleTestSubmit: (answers: Array<McqLetter | null>, durationSeconds: number) => Promise<void>;

  /* flagged (Mistake Book) test */
  flaggedTestOpen: boolean;
  setFlaggedTestOpen: (open: boolean) => void;
  flaggedPreparing: boolean;
  flaggedPrepareNote: string | null;
  flaggedTestError: string | null;
  activeFlaggedTest: { questions: PlayableQuestion[]; timeLimitMinutes: number | null; flaggedIds: Array<number | null> } | null;
  setActiveFlaggedTest: (t: { questions: PlayableQuestion[]; timeLimitMinutes: number | null; flaggedIds: Array<number | null> } | null) => void;
  startFlaggedTest: (pool: FlaggedRow[], count: number, timeLimitMinutes: number | null) => Promise<void>;
  handleFlaggedTestSubmit: (answers: Array<McqLetter | null>, durationSeconds: number) => Promise<void>;
  doubtTestBusyId: number | null;
  startDoubtPracticeTest: (row: FlaggedRow) => Promise<void>;

  /* Generate Test */
  generateTestOpen: boolean;
  setGenerateTestOpen: (open: boolean) => void;
  generateTestPreparing: boolean;
  generateTestError: string | null;
  setGenerateTestError: (e: string | null) => void;
  activeGeneratedTest: GeneratedTestQuestion[] | null;
  setActiveGeneratedTest: (qs: GeneratedTestQuestion[] | null) => void;
  startGenerateTest: (plan: MockPracticePlan) => Promise<void>;
  resolveGeneratedQuestion: (question: GeneratedTestQuestion, remembered: boolean) => void;

  /* photo tasks */
  photoTasksOpen: boolean;
  setPhotoTasksOpen: (open: boolean) => void;
  addingPhotoTasks: boolean;
  handlePhotoTasks: (
    tasks: Array<{ title: string; subject: string; difficulty: string; minutes: number }>,
    imageUrl: string,
  ) => Promise<boolean>;

  /* weekly + monthly targets */
  weeklyScreenOpen: boolean;
  setWeeklyScreenOpen: (open: boolean) => void;
  /** Which scope the Targets screen opens on — 'week' (default) or 'month'. */
  targetsScope: 'week' | 'month';
  /** Open the Targets full screen on a given scope. */
  openTargetsScreen: (scope: 'week' | 'month') => void;
  savingWeekly: boolean;
  saveWeeklyTargets: (topicTarget: number, testTarget: number, chapters: FocusChapter[], reason: string | null) => Promise<void>;
  savingMonthly: boolean;
  saveMonthlyTargets: (chapters: FocusChapter[]) => Promise<void>;
  lastWeekLine: string | null;

  /* scores + mistakes */
  savingTestScore: boolean;
  handleSaveScore: (draft: ScoreDraft, editing: ScoreEntry | null) => Promise<void>;
  handleLogTestScore: (draft: TestScoreDraft) => Promise<void>;
  handleDeleteScore: (entry: ScoreEntry) => Promise<void>;
  handleAddMistake: (entry: ScoreEntry, draft: MistakeDraft) => Promise<void>;
  handleDeleteMistake: (mistake: TestMistake) => Promise<void>;
  /** [Feature 3] One reason per wrong answer — files it into the digital
   * mistake book with a rule-based concept tag. */
  logWrongAnswerReason: (question: PlayableQuestion, picked: McqLetter | null, reason: WrongReason) => Promise<void>;
}

export function useTests(
  data: StudentData,
  toast: ToastFeature,
  access: AccessFeature,
  tasks: TasksFeature,
): TestsFeature {
  const {
    spaceId,
    today,
    profile,
    examDef,
    savedExamLabel,
    items,
    mistakes,
    mcqBank,
    examQuestionsBank,
    testResults,
    testTopicOptions,
    flaggedRows,
    questionAttachments,
    activeSyllabusExam,
    weekStart,
    weeklyRow,
    lastWeekRow,
    weeklyTopicsDone,
    weeklyTestsDone,
    mcqQ,
    examQuestionsQ,
    flaggedQ,
    testResultsQ,
    weeklyQ,
    attachmentsQ,
    resultsQ,
    scoresQ,
    mistakesQ,
    itemsQ,
    examProgressQ,
    topicAttemptsQ,
    weakTopicsQ,
    upsertMeta,
  } = data;
  const { showToast } = toast;
  const { chargeAi, openPaywall } = access;
  const premiumUnlocked = access.access.premiumUnlocked;
  const { addTask, setSheetOpen } = tasks;

  const [quizTarget, setQuizTarget] = useState<QuizTarget | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; questions: PlayableQuestion[] } | null>(null);
  const [testSetupOpen, setTestSetupOpen] = useState(false);

  /**
   * Every “Take a Test” entry point goes through here. The setup sheet builds
   * its topic list from the student's own plan, so with an empty plan it used
   * to open onto nothing: the Start button looked live, tapping it did nothing,
   * and no message explained why. Now the dead end is named up front.
   */
  const openTestSetup = () => {
    if (testTopicOptions.length === 0) {
      showToast("Add topics to your plan first — a test is built from what you're studying.");
      return;
    }
    setTestError(null);
    setTestSetupOpen(true);
  };
  const [testPreparing, setTestPreparing] = useState(false);
  const [testPrepareNote, setTestPrepareNote] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<{ questions: PlayableQuestion[]; timeLimitMinutes: number | null; curationNotes: string[] } | null>(null);
  const [testReview, setTestReview] = useState<TestReview | null>(null);
  const [flaggedTestOpen, setFlaggedTestOpen] = useState(false);
  const [doubtTestBusyId, setDoubtTestBusyId] = useState<number | null>(null);
  const [flaggedPreparing, setFlaggedPreparing] = useState(false);
  const [flaggedPrepareNote, setFlaggedPrepareNote] = useState<string | null>(null);
  const [flaggedTestError, setFlaggedTestError] = useState<string | null>(null);
  const [activeFlaggedTest, setActiveFlaggedTest] = useState<{
    questions: PlayableQuestion[];
    timeLimitMinutes: number | null;
    flaggedIds: Array<number | null>;
  } | null>(null);
  const [generateTestOpen, setGenerateTestOpen] = useState(false);
  const [generateTestPreparing, setGenerateTestPreparing] = useState(false);
  const [generateTestError, setGenerateTestError] = useState<string | null>(null);
  const [activeGeneratedTest, setActiveGeneratedTest] = useState<GeneratedTestQuestion[] | null>(null);
  const [photoTasksOpen, setPhotoTasksOpen] = useState(false);
  const [addingPhotoTasks, setAddingPhotoTasks] = useState(false);
  const [weeklyScreenOpen, setWeeklyScreenOpen] = useState(false);
  const [targetsScope, setTargetsScope] = useState<'week' | 'month'>('week');
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [savingTestScore, setSavingTestScore] = useState(false);

  const examLabel = () => examDef?.target.label || savedExamLabel || profile?.exam || 'Competitive exam';

  /* ---------- quizzes + attachments ---------- */

  /** Past-performance context for the Generate Quiz sheet (adaptive curation). */
  const quizAdaptive = useMemo(
    () => (quizTarget ? adaptiveContextForTopic(testResults, quizTarget.subject, quizTarget.topic) : null),
    [quizTarget, testResults],
  );

  /** Shared-bank UUIDs already served to this student, persisted as local rows. */
  const answeredBankIds = useMemo(
    () => new Set(mcqBank.map((question) => question.bank_question_id).filter((id): id is string => Boolean(id))),
    [mcqBank],
  );

  /** Local AI rows for one topic. Shared-bank history rows are not reusable. */
  const bankQuestionsFor = (subject: string, topic: string): McqQuestion[] => {
    const key = topicKey(subject, topic);
    return mcqBank.filter(
      (q) => !q.bank_question_id && (q.source_key || topicKey(q.subject, q.topic)) === key,
    );
  };

  /**
   * Build a practice quiz from vetted shared rows first. AI is called only for
   * the exact shortfall; an exam with no shared rows follows the old one-call
   * generation path unchanged.
   */
  const prepareQuizQuestions = async (
    target: QuizTarget,
    count: number,
    difficulty: McqDifficulty,
  ): Promise<McqDraft[]> => {
    if (examQuestionsQ.loading) throw new Error('bank-loading');
    const selected = selectExamBankQuestions({
      rows: examQuestionsBank,
      profileExamId: profile?.exam,
      subject: target.subject,
      topic: target.topic,
      count,
      difficulty,
      answeredIds: answeredBankIds,
      today,
    });
    if (selected.missingDifficulties.length === 0) return selected.drafts;
    if (!premiumUnlocked) {
      openPaywall('test');
      throw new Error('ai-limit');
    }
    const local = bankQuestionsFor(target.subject, target.topic);
    const avoidQuestions = [...local.map((question) => question.question), ...selected.drafts.map((draft) => draft.question)];
    const generated: McqDraft[] = [];
    if (selected.drafts.length === 0) {
      generated.push(...(await generateMcqs({
        examLabel: examLabel(),
        subject: target.subject,
        topic: target.topic,
        count,
        difficulty,
        adaptive: adaptiveContextForTopic(testResults, target.subject, target.topic),
        today,
        avoidQuestions,
      })));
    } else {
      for (const level of ['easy', 'medium', 'hard'] as const) {
        const missing = selected.missingDifficulties.filter((slot) => slot === level).length;
        if (missing === 0) continue;
        const drafts = await generateMcqs({
          examLabel: examLabel(),
          subject: target.subject,
          topic: target.topic,
          count: missing,
          difficulty: level,
          adaptive: null,
          today,
          avoidQuestions: [...avoidQuestions, ...generated.map((draft) => draft.question)],
        });
        generated.push(...drafts);
      }
    }
    chargeAi();
    return [...selected.drafts, ...generated].slice(0, count);
  };

  /** Freshly selected/generated questions: open the player and store history. */
  const handleQuizGenerated = async (drafts: McqDraft[]) => {
    if (!quizTarget) return;
    const title = `${quizTarget.subject} · ${quizTarget.topic}`;
    setQuizTarget(null);
    setActiveQuiz({ title, questions: drafts.map((draft) => ({ ...draft, id: null })) });
    try {
      await Promise.all(
        drafts.map((draft) => verifiedDbFrom(TABLES.mcqQuestions).insert(draft as unknown as Record<string, unknown>)),
      );
      mcqQ.refresh();
    } catch {
      /* The quiz still plays from memory; only the bank misses this set. */
    }
  };

  /** Resolve a played question to its bank row (fresh sets start without ids). */
  const resolveBankId = (question: PlayableQuestion): number | null => {
    if (question.id !== null) return question.id;
    const match = mcqBank.find((q) => q.question === question.question && q.topic === question.topic);
    return match ? match.id : null;
  };

  const attachmentsForQuestion = (question: PlayableQuestion): string[] => {
    const urls: string[] = [];
    if (question.image_url) urls.push(question.image_url);
    const id = resolveBankId(question);
    if (id !== null) urls.push(...(questionAttachments.get(String(id)) ?? []));
    return urls;
  };

  /** Attach an image to a question card in the quiz player. */
  const attachImageToQuestion = async (question: PlayableQuestion, file: File) => {
    if (attachBusy) return;
    const id = resolveBankId(question);
    if (id === null) {
      showToast('One second — this question is still saving. Try again in a moment.');
      return;
    }
    setAttachBusy(true);
    try {
      const url = await uploadImage(file, spaceId);
      await verifiedDbFrom(TABLES.attachments).insert({
        parent_type: 'question',
        parent_key: String(id),
        image_url: url,
        created_on: today,
      });
      attachmentsQ.refresh();
      showToast('Image attached to this question.');
    } catch {
      showToast("That image didn't attach — mind trying once more?");
    } finally {
      setAttachBusy(false);
    }
  };

  /** Attach an image to a task. Keyed by source_key so revisions share it. */
  const attachImageToTask = async (item: StudyItem, file: File) => {
    if (attachBusy) return;
    setAttachBusy(true);
    try {
      const url = await uploadImage(file, spaceId);
      await verifiedDbFrom(TABLES.attachments).insert({
        parent_type: 'task',
        parent_key: item.source_key || topicKey(item.subject, item.topic),
        image_url: url,
        created_on: today,
      });
      attachmentsQ.refresh();
      showToast('Image attached to this task.');
    } catch {
      showToast("That image didn't attach — mind trying once more?");
    } finally {
      setAttachBusy(false);
    }
  };

  const removeTaskAttachment = async (item: StudyItem, url: string) => {
    const key = item.source_key || topicKey(item.subject, item.topic);
    const row = (attachmentsQ.data ?? []).find((a) => a.parent_type === 'task' && a.parent_key === key && a.image_url === url);
    if (!row) return;
    await verifiedDbFrom(TABLES.attachments).delete(row.id);
    attachmentsQ.refresh();
  };

  /* ---------- Test Mode ---------- */

  /** Curate a test: reuse the bank per topic, generate only the shortfall.
   * Adaptive curation — weak topics (<60% recent accuracy) carry 2× weight,
   * consistently strong topics (>85%) drop to half weight, and the results
   * screen explains exactly why each topic got its share. */
  const startTest = async (config: TestConfig) => {
    if (testPreparing) return;
    setTestPreparing(true);
    setTestError(null);
    try {
      if (examQuestionsQ.loading) throw new Error('bank-loading');
      const weighted = config.topics.map((topicOption: { subject: string; topic: string }) => {
        const ctx = adaptiveContextForTopic(testResults, topicOption.subject, topicOption.topic);
        const weight = ctx === null ? 1 : ctx.accuracy < WEAK_TOPIC_THRESHOLD ? 2 : ctx.accuracy > 85 ? 0.5 : 1;
        return { topicOption, ctx, weight, share: 0 };
      });
      const totalWeight = weighted.reduce((sum: number, w: { weight: number }) => sum + w.weight, 0) || 1;
      for (const w of weighted) w.share = Math.floor((config.count * w.weight) / totalWeight);
      let allocated = weighted.reduce((sum: number, w: { share: number }) => sum + w.share, 0);
      const byWeightDesc = [...weighted].sort((a, b) => b.weight - a.weight);
      let cursor = 0;
      while (allocated < config.count && byWeightDesc.length > 0) {
        byWeightDesc[cursor % byWeightDesc.length].share += 1;
        allocated += 1;
        cursor += 1;
      }
      const curationNotes: string[] = [];
      for (const w of weighted) {
        if (w.share <= 0 || !w.ctx) continue;
        if (w.ctx.accuracy < WEAK_TOPIC_THRESHOLD) {
          curationNotes.push(
            `${w.topicOption.subject} › ${w.topicOption.topic} had your lowest recent accuracy (${w.ctx.accuracy}%), so I gave it double weight — ${w.share} question${w.share === 1 ? '' : 's'}.`,
          );
        } else if (w.ctx.accuracy > 85) {
          curationNotes.push(
            `You're consistently strong on ${w.topicOption.topic} (${w.ctx.accuracy}%), so I dialled it down to ${w.share} question${w.share === 1 ? '' : 's'}.`,
          );
        }
      }
      const questions: PlayableQuestion[] = [];
      const reservedBankIds = new Set(answeredBankIds);
      let generatedAny = false;
      let servedSharedAny = false;
      let officialCount = 0;
      for (const { topicOption, share } of weighted) {
        if (share === 0) continue;
        const official = selectExamBankQuestions({
          rows: examQuestionsBank,
          profileExamId: profile?.exam,
          subject: topicOption.subject,
          topic: topicOption.topic,
          count: share,
          difficulty: 'medium',
          answeredIds: reservedBankIds,
          today,
        });
        for (const draft of official.drafts) {
          if (draft.bank_question_id) reservedBankIds.add(draft.bank_question_id);
        }
        questions.push(...official.drafts.map((draft) => ({ ...draft, id: null })));
        officialCount += official.drafts.length;
        if (official.drafts.length > 0) {
          servedSharedAny = true;
          try {
            await Promise.all(
              official.drafts.map((draft) => verifiedDbFrom(TABLES.mcqQuestions).insert(draft as unknown as Record<string, unknown>)),
            );
          } catch {
            /* The in-memory test still runs; only durable repeat history misses this set. */
          }
        }
        const localBank = bankQuestionsFor(topicOption.subject, topicOption.topic);
        const profileHasSharedBank = examQuestionsBank.some(
          (row) => row.exam_id === bankExamIdForProfile(profile?.exam),
        );
        const bank = profileHasSharedBank
          ? localBank.filter((question) => String(question.difficulty ?? '').toLowerCase() === 'medium')
          : localBank;
        const localNeeded = share - official.drafts.length;
        const chosen = [...bank].sort(() => Math.random() - 0.5).slice(0, localNeeded);
        questions.push(...chosen.map((q) => ({ ...q, id: q.id as number | null })));
        const missing = share - official.drafts.length - chosen.length;
        // TODO: Re-enable once question generation is validated — currently producing incorrect answers
        if (missing > 0 && ENABLE_AUTO_QUESTION_GEN) {
          // Writing fresh test questions is AI test generation — Premium after trial.
          if (!premiumUnlocked) {
            openPaywall('test');
            throw new Error('ai-limit');
          }
          setTestPrepareNote(`Writing ${missing} fresh ${topicOption.topic} question${missing === 1 ? '' : 's'}…`);
          const drafts = await generateMcqs({
            examLabel: examLabel(),
            subject: topicOption.subject,
            topic: topicOption.topic,
            count: missing,
            difficulty: 'medium',
            adaptive: adaptiveContextForTopic(testResults, topicOption.subject, topicOption.topic),
            today,
            avoidQuestions: [
              ...bank.map((q) => q.question),
              ...official.drafts.map((draft) => draft.question),
            ],
          });
          generatedAny = true;
          try {
            await Promise.all(
              drafts.map((draft) => verifiedDbFrom(TABLES.mcqQuestions).insert(draft as unknown as Record<string, unknown>)),
            );
          } catch {
            /* the test still runs from memory */
          }
          questions.push(...drafts.map((draft) => ({ ...draft, id: null })));
        }
      }
      if (officialCount > 0) {
        curationNotes.unshift(
          `${officialCount} question${officialCount === 1 ? '' : 's'} came from the vetted official-practice bank before any AI fallback.`,
        );
      }
      if (generatedAny) chargeAi();
      if (generatedAny || servedSharedAny) mcqQ.refresh();
      if (questions.length === 0) throw new Error('no-questions');
      questions.sort(() => Math.random() - 0.5);
      setTestSetupOpen(false);
      setActiveTest({ questions, timeLimitMinutes: config.timeLimitMinutes, curationNotes });
    } catch (error) {
      if ((error as Error).message !== 'ai-limit') {
        setTestError(
          (error as Error).message === 'bank-loading'
            ? 'The official question bank is still loading — give it a moment, then tap retry.'
            : (error as Error).message === 'no-questions' && !ENABLE_AUTO_QUESTION_GEN
              ? 'No saved questions exist for those topics yet — play a practice quiz on them first, then come back.'
              : "I couldn't put the test together — usually a hiccup writing fresh questions. Tap retry and it almost always works.",
        );
      }
    } finally {
      setTestPreparing(false);
      setTestPrepareNote(null);
    }
  };

  /** Score, store, flag weak topics for priority revision, update weekly goals. */
  const handleTestSubmit = async (answers: Array<McqLetter | null>, durationSeconds: number) => {
    if (!activeTest) return;
    const questions = activeTest.questions;
    const byTopic = new Map<string, TopicBreakdown>();
    const wrong: TestReview['wrong'] = [];
    const wrongIds: number[] = [];
    let score = 0;
    questions.forEach((question, index) => {
      const picked = answers[index] ?? null;
      const isCorrect = picked === question.correct;
      if (isCorrect) score += 1;
      const key = topicKey(question.subject, question.topic);
      const entry = byTopic.get(key) ?? { subject: question.subject, topic: question.topic, correct: 0, total: 0 };
      entry.total += 1;
      if (isCorrect) entry.correct += 1;
      byTopic.set(key, entry);
      if (!isCorrect) {
        wrong.push({ question, picked });
        const id = resolveBankId(question);
        if (id !== null) wrongIds.push(id);
      }
    });
    const breakdown = Array.from(byTopic.values());
    const weak = breakdown.filter((entry) => percentOf(entry.correct, entry.total) < WEAK_TOPIC_THRESHOLD);
    const worst = [...breakdown].sort((a, b) => percentOf(a.correct, a.total) - percentOf(b.correct, b.total))[0];
    const worstPercent = worst ? percentOf(worst.correct, worst.total) : 100;
    /* [Feature 3] A test that went badly overall (<50%) gets NO coaching tip
     * on the day — just a gentle no-timer reattempt task queued below. */
    const wentBadly = percentOf(score, questions.length) < 50;
    const analysis = wentBadly
      ? null
      : worst && worstPercent < 100
        ? `Your main gap is ${worst.topic} — you got ${worst.total - worst.correct}/${worst.total} question${worst.total === 1 ? '' : 's'} on it wrong${worstPercent < WEAK_TOPIC_THRESHOLD ? ", so it's marked for priority revision" : ''}. Focus here next: one revision session, then retest with 10 questions.`
        : 'Every topic held up — a clean run. Raise the difficulty or bring in fresh topics to keep stretching.';
    const officialSources = Array.from(
      new Map(
        questions
          .filter((question) => Boolean(question.source_url))
          .map((question) => [
            question.source_url as string,
            { label: `${question.subject} practice`, url: question.source_url as string },
          ] as const),
      ).values(),
    );

    setActiveTest(null);
    setTestReview({
      score,
      total: questions.length,
      durationSeconds,
      breakdown,
      wrong,
      weakTopics: weak.map((w) => w.topic),
      curationNotes: activeTest.curationNotes,
      analysis,
      officialSources,
      examName: examLabel(),
      testName: `${examLabel()} Test #${testResults.length + 1}`,
    });

    /* Adaptation engine: one mastery + weakness update per tested topic. */
    if (activeSyllabusExam) {
      void feedBreakdownToMastery(activeSyllabusExam, breakdown)
        .then(() => {
          examProgressQ.refresh();
          topicAttemptsQ.refresh();
          weakTopicsQ.refresh();
        })
        .catch(() => undefined);
    }

    try {
      await insertTestResultRow({
        breakdown,
        score,
        total: questions.length,
        wrongIds,
        timeLimitMinutes: activeTest.timeLimitMinutes,
        durationSeconds,
        today,
      });
      testResultsQ.refresh();

      /* [Feature 3] Test-day rule: the day a test is taken stays test-only —
       * revisions and tasks still pending for today shift to tomorrow. */
      let dayShifted = false;
      try {
        const pendingToday = items.filter((item) => item.status === 'pending' && item.scheduled_for === today);
        if (pendingToday.length > 0) {
          await Promise.all(
            pendingToday.map((item) => verifiedDbFrom(TABLES.items).update(item.id, { scheduled_for: addDaysISO(today, 1) })),
          );
          dayShifted = true;
          showToast(
            `Test day — ${pendingToday.length} pending item${pendingToday.length === 1 ? '' : 's'} moved to tomorrow so today stays test-only.`,
          );
        }
      } catch {
        /* non-fatal — the plan simply stays as it was */
      }

      /* [Feature 3] Bad run → no tip today, just a no-timer reattempt task. */
      if (wentBadly) {
        try {
          await addTask(
            worst?.subject || breakdown[0]?.subject || 'General',
            `Reattempt test on ${worst?.topic || breakdown[0]?.topic || 'the same topics'} — no timer`,
            'Question Practice',
            true,
          );
        } catch {
          /* the result is saved; the reattempt nudge is best-effort */
        }
      }

      const revisionChanged = await promoteWeakTopicsToRevision(weak, items, profile?.exam ?? null, today);
      if (revisionChanged || dayShifted) itemsQ.refresh();

      /* tests_done ticks up immediately; the sync effect keeps it honest. */
      if (weeklyRow) {
        await verifiedDbFrom(TABLES.weeklyTargets).update(weeklyRow.id, { tests_done: weeklyTestsDone + 1 });
        weeklyQ.refresh();
      }
    } catch {
      showToast('Your score is in view, but saving the result hiccuped — it may not count towards weekly goals.');
    }
  };

  /* ---------- flagged (doubt) practice test ---------- */

  /** A flagged MCQ is directly playable only when options AND answer are known. */
  const flaggedLetter = (row: FlaggedRow): McqLetter | null => {
    const letter = (row.correct || '').trim().toUpperCase().charAt(0);
    return (MCQ_LETTERS as string[]).includes(letter) ? (letter as McqLetter) : null;
  };

  /** Build the timed flagged-question test: weak concepts first, AI converts
   * open-ended flags (or flags without a known answer) into MCQs on the fly. */
  const startFlaggedTest = async (pool: FlaggedRow[], count: number, timeLimitMinutes: number | null) => {
    if (flaggedPreparing) return;
    setFlaggedPreparing(true);
    setFlaggedTestError(null);
    try {
      /* Adaptive weighting: flags on concepts with recent accuracy <60% draw first. */
      const chosen = [...pool]
        .map((row) => {
          const ctx = adaptiveContextForTopic(testResults, row.subject, flaggedConceptLabel(row));
          return { row, weak: ctx !== null && ctx.accuracy < WEAK_TOPIC_THRESHOLD ? 0 : 1, jitter: Math.random() };
        })
        .sort((a, b) => a.weak - b.weak || a.jitter - b.jitter)
        .slice(0, count)
        .map((entry) => entry.row);

      const needConversion = chosen.filter((row) => !flaggedOptions(row) || !flaggedLetter(row));
      let converted = new Map<number, FlaggedMcqShape>();
      // TODO: Re-enable once question generation is validated — currently producing incorrect answers
      // (with the flag off, doubts without stored options are skipped instead of AI-converted)
      if (needConversion.length > 0 && ENABLE_AUTO_QUESTION_GEN) {
        // Converting doubts into MCQs is AI test generation — Premium after trial.
        if (!premiumUnlocked) {
          openPaywall('test');
          throw new Error('ai-limit');
        }
        setFlaggedPrepareNote(`Turning ${needConversion.length} Mistake Book question${needConversion.length === 1 ? '' : 's'} into MCQs…`);
        converted = await convertFlaggedToMcqs(needConversion, examLabel());
        chargeAi();
      }

      const questions: PlayableQuestion[] = [];
      const flaggedIds: Array<number | null> = [];
      for (const row of chosen) {
        const directOptions = flaggedOptions(row);
        const directLetter = flaggedLetter(row);
        const shape: FlaggedMcqShape | null =
          directOptions && directLetter
            ? { options: directOptions, correct: directLetter, explanation: null }
            : converted.get(row.id) ?? null;
        if (!shape) continue;
        questions.push({
          id: null,
          subject: row.subject,
          topic: flaggedConceptLabel(row),
          source_key: null,
          question: row.question_text,
          option_a: shape.options[0],
          option_b: shape.options[1],
          option_c: shape.options[2],
          option_d: shape.options[3],
          correct: shape.correct,
          explanation: shape.explanation,
          difficulty: row.difficulty ?? null,
          /* [Concept-tag fix] Legacy rows saved without a concept still get a
           * rule-based tag here, so EVERY question in the practice test carries
           * one for the results screen and the mistake log — never just the
           * rows that happened to be tagged at capture time. */
          concept:
            (row.concept || '').trim() ||
            tagConcept(`${row.question_text} ${row.topic ?? ''} ${row.subject}`) ||
            null,
          image_url: row.image_url ?? null,
        });
        flaggedIds.push(row.id);
      }
      if (questions.length === 0) throw new Error('no-questions');
      setFlaggedTestOpen(false);
      setActiveFlaggedTest({ questions, timeLimitMinutes, flaggedIds });
    } catch (error) {
      if ((error as Error).message !== 'ai-limit') {
        setFlaggedTestError("I couldn't build the practice test — usually a hiccup converting a Mistake Book entry into an MCQ. Tap retry.");
      }
    } finally {
      setFlaggedPreparing(false);
      setFlaggedPrepareNote(null);
    }
  };

  /** Score the flagged test, demote cleared flags, and write the coach's analysis. */
  const handleFlaggedTestSubmit = async (answers: Array<McqLetter | null>, durationSeconds: number) => {
    if (!activeFlaggedTest) return;
    const { questions, flaggedIds, timeLimitMinutes } = activeFlaggedTest;
    const byTopic = new Map<string, TopicBreakdown>();
    const wrong: TestReview['wrong'] = [];
    const clearedIds: number[] = [];
    let score = 0;
    questions.forEach((question, index) => {
      const picked = answers[index] ?? null;
      const isCorrect = picked === question.correct;
      if (isCorrect) {
        score += 1;
        const fid = flaggedIds[index];
        if (fid !== null) clearedIds.push(fid);
      }
      const key = topicKey(question.subject, question.topic);
      const entry = byTopic.get(key) ?? { subject: question.subject, topic: question.topic, correct: 0, total: 0 };
      entry.total += 1;
      if (isCorrect) entry.correct += 1;
      byTopic.set(key, entry);
      if (!isCorrect) wrong.push({ question, picked });
    });
    const breakdown = Array.from(byTopic.values());
    const weak = breakdown.filter((entry) => percentOf(entry.correct, entry.total) < WEAK_TOPIC_THRESHOLD);
    const worst = [...breakdown].sort((a, b) => percentOf(a.correct, a.total) - percentOf(b.correct, b.total))[0];
    const analysis =
      worst && percentOf(worst.correct, worst.total) < 100
        ? `Your main gap is ${worst.topic} — you got ${worst.total - worst.correct}/${worst.total} question${worst.total === 1 ? '' : 's'} on it wrong. Focus here next: revise it today, then re-run this Mistake Book test to clear the queue.`
        : 'Clean sweep — every Mistake Book question fell. Keep adding the ones that stump you and this loop keeps working.';

    setActiveFlaggedTest(null);
    setTestReview({
      score,
      total: questions.length,
      durationSeconds,
      breakdown,
      wrong,
      weakTopics: weak.map((w) => w.topic),
      curationNotes: [],
      analysis,
      clearedCount: clearedIds.length,
      examName: examLabel(),
      testName: `${examLabel()} Mistake Book Test #${testResults.length + 1}`,
    });

    try {
      /* Correct answers demote the entry out of the queue. */
      await Promise.all(
        clearedIds.map((id) => verifiedDbFrom(TABLES.questionQueue).update(id, { status: 'cleared' })),
      );
      flaggedQ.refresh();
      /* The run counts as a real test: history, weekly goal, adaptive curation. */
      await insertTestResultRow({
        breakdown,
        score,
        total: questions.length,
        wrongIds: [],
        timeLimitMinutes,
        durationSeconds,
        today,
      });
      testResultsQ.refresh();

      /* Closed loop: the doubt test counts like any other test — one mastery +
       * weakness update per tested topic, exactly the Test Mode rule. */
      if (activeSyllabusExam) {
        try {
          await feedBreakdownToMastery(activeSyllabusExam, breakdown);
          examProgressQ.refresh();
          topicAttemptsQ.refresh();
          weakTopicsQ.refresh();
        } catch {
          /* silent — the visible result is already on screen */
        }
      }

      const revisionChanged = await promoteWeakTopicsToRevision(weak, items, profile?.exam ?? null, today);
      if (revisionChanged) itemsQ.refresh();

      if (weeklyRow) {
        await verifiedDbFrom(TABLES.weeklyTargets).update(weeklyRow.id, { tests_done: weeklyTestsDone + 1 });
        weeklyQ.refresh();
      }
    } catch {
      showToast('Your score is shown, but saving the Mistake Book test result hiccuped.');
    }
  };

  /** One tap on a doubt card → up to 5 MCQs on that doubt's topic. Vetted
   * shared rows are free and first; only a shortfall needs Premium AI. */
  const startDoubtPracticeTest = async (row: FlaggedRow) => {
    if (doubtTestBusyId !== null) return;
    setDoubtTestBusyId(row.id);
    try {
      if (examQuestionsQ.loading) throw new Error('bank-loading');
      const topic = flaggedConceptLabel(row);
      const official = selectExamBankQuestions({
        rows: examQuestionsBank,
        profileExamId: profile?.exam,
        subject: row.subject,
        topic,
        count: 5,
        difficulty: 'medium',
        answeredIds: answeredBankIds,
        today,
      });
      const drafts = [...official.drafts];
      const missing = 5 - drafts.length;
      // TODO: Re-enable once AI question generation is validated.
      if (missing > 0 && ENABLE_AUTO_QUESTION_GEN) {
        if (!premiumUnlocked) {
          openPaywall('test');
          return;
        }
        const generated = await generateMcqs({
          examLabel: examLabel(),
          subject: row.subject,
          topic,
          count: missing,
          difficulty: 'medium',
          adaptive: adaptiveContextForTopic(testResults, row.subject, topic),
          today,
          avoidQuestions: [
            ...bankQuestionsFor(row.subject, topic).map((question) => question.question),
            ...drafts.map((draft) => draft.question),
          ],
        });
        drafts.push(...generated);
        chargeAi();
      }
      if (drafts.length === 0) {
        showToast('Fresh practice-question generation is switched off for now — revise this mistake from its card instead.');
        return;
      }
      try {
        await Promise.all(
          drafts.map((draft) => verifiedDbFrom(TABLES.mcqQuestions).insert(draft as unknown as Record<string, unknown>)),
        );
        mcqQ.refresh();
      } catch {
        /* the test still runs from memory */
      }
      setActiveTest({
        questions: drafts.map((draft) => ({ ...draft, id: null })),
        timeLimitMinutes: null,
        curationNotes: [
          official.drafts.length > 0
            ? `${official.drafts.length} vetted official-practice question${official.drafts.length === 1 ? '' : 's'} target ${topic}; AI filled only the shortfall.`
            : `All ${drafts.length} questions target ${topic} — the topic of the mistake you saved.`,
        ],
      });
    } catch (error) {
      showToast(
        (error as Error).message === 'bank-loading'
          ? 'The official question bank is still loading — try again in a moment.'
          : "I couldn't build that practice test — mind tapping it once more?",
      );
    } finally {
      setDoubtTestBusyId(null);
    }
  };

  /* ---------- Generate Test (mock-log targeted) ---------- */

  /**
   * Build one weighted practice set from the pure mock-analysis plan. Shared
   * exam-bank rows are selected first for every target; reusable local rows
   * come next; generateMcqs fills only the exact remaining slots. The plan has
   * already applied the evidence, minimum-attempts, syllabus and behavioural
   * gates, so this function owns question assembly rather than re-ranking.
   */
  const startGenerateTest = async (plan: MockPracticePlan) => {
    if (generateTestPreparing) return;
    setGenerateTestPreparing(true);
    setGenerateTestError(null);
    try {
      if (!plan.ready || plan.targets.length === 0) throw new Error('not-ready');
      if (examQuestionsQ.loading) throw new Error('bank-loading');

      const assembled: McqDraft[] = [];
      const toStore: McqDraft[] = [];
      const reservedBankIds = new Set(answeredBankIds);
      let generatedAny = false;

      for (const target of plan.targets) {
        const official = selectExamBankQuestions({
          rows: examQuestionsBank,
          profileExamId: profile?.exam,
          subject: target.subject,
          topic: target.topic,
          count: target.questionCount,
          difficulty: 'mixed',
          answeredIds: reservedBankIds,
          today,
        });
        for (const draft of official.drafts) {
          if (draft.bank_question_id) reservedBankIds.add(draft.bank_question_id);
        }
        assembled.push(...official.drafts);
        toStore.push(...official.drafts);

        const localNeeded = target.questionCount - official.drafts.length;
        const local = [...bankQuestionsFor(target.subject, target.topic)]
          .sort(() => Math.random() - 0.5)
          .slice(0, localNeeded)
          .map((question) => {
            const { id: _id, ...draft } = question;
            return draft;
          });
        assembled.push(...local);

        const missing = target.questionCount - official.drafts.length - local.length;
        if (missing <= 0) continue;
        if (!premiumUnlocked) {
          openPaywall('test');
          throw new Error('ai-limit');
        }
        const generated = await generateMcqs({
          examLabel: examLabel(),
          subject: target.subject,
          topic: target.topic,
          count: missing,
          difficulty: 'mixed',
          adaptive: null,
          today,
          avoidQuestions: [
            ...bankQuestionsFor(target.subject, target.topic).map((question) => question.question),
            ...official.drafts.map((draft) => draft.question),
          ],
        });
        assembled.push(...generated);
        toStore.push(...generated);
        generatedAny = true;
      }

      if (assembled.length !== plan.questionCount) throw new Error('thin-set');
      if (generatedAny) chargeAi();
      if (toStore.length > 0) {
        try {
          await Promise.all(
            toStore.map((draft) => verifiedDbFrom(TABLES.mcqQuestions).insert(draft as unknown as Record<string, unknown>)),
          );
          mcqQ.refresh();
        } catch {
          /* The complete in-memory set still runs; only repeat history misses it. */
        }
      }
      assembled.sort(() => Math.random() - 0.5);
      setGenerateTestOpen(false);
      setActiveGeneratedTest(questionsFromMcqDrafts(assembled));
    } catch (error) {
      const message = (error as Error).message;
      if (message !== 'ai-limit') {
        setGenerateTestError(
          message === 'bank-loading'
            ? 'The shared exam bank is still loading — give it a moment, then tap retry.'
            : message === 'not-ready'
              ? 'Your mock log changed before the set was built. Add the remaining tagged entries shown above, then retry.'
              : message === 'thin-set'
                ? "I couldn't make a complete 10-question set without thinning the targeting. Nothing started — tap retry for a full set."
                : "I couldn't build that test — usually a hiccup filling the last few questions. Tap Generate again.",
        );
      }
    } finally {
      setGenerateTestPreparing(false);
    }
  };

  /** "Got it ✓" resolves the underlying queue row(s) for good; "Need revision ↩"
   * reschedules them for tomorrow. Fire-and-forget — the test keeps moving. */
  const resolveGeneratedQuestion = (question: GeneratedTestQuestion, remembered: boolean) => {
    void (async () => {
      try {
        await Promise.all(
          question.sourceIds.map((id: number) =>
            remembered
              ? verifiedDbFrom(TABLES.questionQueue).update(id, { status: 'cleared', last_revised_on: today })
              : verifiedDbFrom(TABLES.questionQueue).update(id, {
                  last_revised_on: today,
                  next_revision_on: addDaysISO(today, 1),
                }),
          ),
        );
        flaggedQ.refresh();
        /* Closed loop: the self-marked verdict feeds the same mastery/weakness
         * engine as Test Mode — "Got it" counts correct, "Need revision" wrong. */
        if (activeSyllabusExam) {
          const matched = matchTaskToChapter(activeSyllabusExam, question.subject, question.conceptLabel);
          if (matched) {
            await recordTestResult(
              activeSyllabusExam.id,
              topicIdFor(matched.chapterId, question.conceptLabel),
              remembered,
              remembered ? 100 : 0,
              { topicName: question.conceptLabel },
            );
            examProgressQ.refresh();
            topicAttemptsQ.refresh();
            weakTopicsQ.refresh();
          }
        }
      } catch {
        /* silent — the run continues; the row simply stays queued */
      }
    })();
  };

  /* ---------- photo → tasks ---------- */

  /** Create every kept task with the AI's time estimate, and store the photo
   * next to each one. */
  const handlePhotoTasks = async (
    photoTasks: Array<{ title: string; subject: string; difficulty: string; minutes: number }>,
    imageUrl: string,
  ): Promise<boolean> => {
    if (addingPhotoTasks || !profile) return false;
    setAddingPhotoTasks(true);
    try {
      let added = 0;
      let failed = 0;
      let duplicates = 0;
      for (const task of photoTasks) {
        const key = topicKey(task.subject, task.title);
        const created = await addTask(task.subject, task.title, 'Self Study', true);
        if (created === null) {
          failed += 1;
          continue;
        }
        if (!created) {
          duplicates += 1;
          continue;
        }
        added += 1;
        try {
          await upsertMeta(
            taskTypeKey(key),
            JSON.stringify({
              type: 'Self Study',
              ai: true,
              minutes: Math.max(5, Math.min(1080, Math.round(task.minutes) || 45)),
            }),
          );
        } catch (error) {
          console.warn('[vicharakai] photo-task estimate annotation did not save', error);
        }
        // Manually typed tasks (the scan-failed fallback) carry no photo.
        if (imageUrl) {
          try {
            await verifiedDbFrom(TABLES.attachments).insert({
              parent_type: 'task',
              parent_key: key,
              image_url: imageUrl,
              created_on: today,
            });
          } catch (error) {
            console.warn('[vicharakai] photo-task attachment did not save', error);
          }
        }
      }
      attachmentsQ.refresh();
      if (failed > 0) {
        showToast(
          added > 0
            ? `Added ${added}; ${failed} didn't save. Your review list is still here so you can retry.`
            : "Those tasks didn't save — your review list is still here. Mind trying once more?",
        );
        return false;
      }
      setPhotoTasksOpen(false);
      setSheetOpen(false);
      showToast(
        added > 0
          ? imageUrl
            ? `Added ${added} task${added === 1 ? '' : 's'} from your photo — with AI time estimates.`
            : `Added ${added} task${added === 1 ? '' : 's'} to your plan.`
          : duplicates > 0
            ? 'Those tasks are already on your plan — no duplicates added.'
            : 'No tasks were selected.',
      );
      return true;
    } catch (error) {
      console.error('[vicharakai] photo-task save failed', error);
      showToast("Those tasks didn't save — your review list is still here. Mind trying once more?");
      return false;
    } finally {
      setAddingPhotoTasks(false);
    }
  };

  /* ---------- weekly targets ---------- */

  const saveWeeklyTargets = async (
    topicTarget: number,
    testTarget: number,
    chapters: FocusChapter[],
    reason: string | null,
  ) => {
    if (savingWeekly) return;
    setSavingWeekly(true);
    try {
      const focusPayload = {
        focus_chapters: chapters.length > 0 ? JSON.stringify(chapters) : null,
        focus_reason: reason,
      };
      if (weeklyRow) {
        await verifiedDbFrom(TABLES.weeklyTargets).update(weeklyRow.id, {
          topic_target: topicTarget,
          test_target: testTarget,
          ...focusPayload,
        });
      } else {
        await verifiedDbFrom(TABLES.weeklyTargets).insert({
          user_id: null,
          week_start_date: weekStart,
          topic_target: topicTarget,
          test_target: testTarget,
          topics_done: weeklyTopicsDone,
          tests_done: weeklyTestsDone,
          ...focusPayload,
        });
        if (lastWeekRow && !lastWeekRow.summary_seen) {
          await verifiedDbFrom(TABLES.weeklyTargets).update(lastWeekRow.id, { summary_seen: true });
        }
      }
      weeklyQ.refresh();
      setWeeklyScreenOpen(false);
      showToast(
        `Weekly targets set — ${topicTarget} topics, ${testTarget} test${testTarget === 1 ? '' : 's'}${chapters.length > 0 ? `, focused on ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}` : ''}.`,
      );
    } catch {
      showToast("Those goals didn't save — mind tapping it once more?");
    } finally {
      setSavingWeekly(false);
    }
  };

  const openTargetsScreen = (scope: 'week' | 'month') => {
    setTargetsScope(scope);
    setWeeklyScreenOpen(true);
  };

  /** Save this month's focus chapters (zuno_meta `monthly_targets|YYYY-MM`) —
   * the monthly layer of the Monthly → Weekly → Today hierarchy. */
  const saveMonthlyTargets = async (chapters: FocusChapter[]) => {
    if (savingMonthly) return;
    setSavingMonthly(true);
    try {
      await upsertMeta(`monthly_targets|${data.monthKey}`, JSON.stringify({ chapters }));
      showToast(
        chapters.length > 0
          ? `Monthly focus saved — ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}. Pick from them when you set the week.`
          : 'Monthly focus cleared.',
      );
    } catch {
      showToast("That monthly plan didn't save — mind tapping it once more?");
    } finally {
      setSavingMonthly(false);
    }
  };

  /** How last week ended — shown once inside the new week's goals sheet. */
  const lastWeekLine = useMemo(() => {
    if (!lastWeekRow || lastWeekRow.summary_seen) return null;
    const target = Number(lastWeekRow.topic_target ?? 0);
    const done = Number(lastWeekRow.topics_done ?? 0);
    if (target > 0 && done >= target) return `Last week: ${done}/${target} topics — you hit your goal. Well done! \uD83C\uDF89`;
    if (target > 0) return `Last week you completed ${done}/${target} topics — the ${target - done} you missed have been carried into this week.`;
    return null;
  }, [lastWeekRow]);

  /* ---------- test scores + mistake log ---------- */

  const handleSaveScore = async (draft: ScoreDraft, editing: ScoreEntry | null) => {
    if (!profile) return;
    const percent = scorePercent(draft.marks, draft.total);
    const row = {
      exam: profile.exam,
      subject: draft.subject,
      test_name: draft.testName || null,
      marks_obtained: draft.marks,
      total_marks: draft.total,
      percent,
    };
    if (editing?.resultId) {
      await verifiedDbFrom(TABLES.testScores).update(editing.resultId, row);
      showToast(`Updated to ${draft.marks}/${draft.total} — ${percent}%.`);
    } else if (editing?.legacyId) {
      // Editing a percentage-only row upgrades it into a real marks-based
      // result, keeping the date it was taken on.
      await verifiedDbFrom(TABLES.testScores).insert({ ...row, taken_on: editing.taken_on });
      await verifiedDbFrom(TABLES.legacyScores).delete(editing.legacyId);
      showToast(`Saved with real marks: ${draft.marks}/${draft.total} — ${percent}%.`);
    } else {
      await verifiedDbFrom(TABLES.testScores).insert({ ...row, taken_on: today });
      showToast(`Logged ${draft.marks}/${draft.total} in ${draft.subject} — I factor this into your weak chapters.`);
    }
    resultsQ.refresh();
    scoresQ.refresh();
  };

  /* Test Scores tab: insert the row AND feed the adaptation engine — every
   * covered topic updates mastery + weakness, so logged scores change what
   * the engine prioritises tomorrow. */
  const handleLogTestScore = async (draft: TestScoreDraft) => {
    if (!profile || savingTestScore) return;
    setSavingTestScore(true);
    try {
      const percent = scorePercent(draft.marks, draft.total);
      /* A Full Mock spans several subjects. `subject` keeps holding ONE name so
       * every existing average, colour and trend keeps working; the full list
       * rides along in subjects_covered and drives the score display. */
      const subjects = draft.subjects && draft.subjects.length > 0 ? draft.subjects : [draft.subject];
      /* Each covered chapter is fed to mastery under ITS OWN subject — a
       * multi-subject mock must not file Biology chapters under Physics. */
      const topicPairs =
        draft.topicPairs && draft.topicPairs.length > 0
          ? draft.topicPairs
          : draft.topics.map((topicName: string) => ({ subject: draft.subject, topic: topicName }));
      await verifiedDbFrom(TABLES.testScores).insert({
        exam: profile.exam,
        subject: draft.subject,
        test_name: draft.testName?.trim() || null,
        test_type: draft.testType,
        marks_obtained: draft.marks,
        total_marks: draft.total,
        percent,
        taken_on: draft.takenOn,
        topics_covered: draft.topics.length > 0 ? JSON.stringify(draft.topics) : null,
        subjects_covered: subjects.length > 1 ? JSON.stringify(subjects) : null,
        notes: draft.notes || null,
      });
      resultsQ.refresh();
      scoresQ.refresh();
      // THE CRITICAL LINK: covered topics move mastery/weakness in the engine.
      if (activeSyllabusExam && topicPairs.length > 0) {
        try {
          await feedBreakdownToMastery(
            activeSyllabusExam,
            topicPairs.map((pair: { subject: string; topic: string }) => ({
              subject: pair.subject,
              topic: pair.topic,
              correct: percent >= WEAK_TOPIC_THRESHOLD ? 1 : 0,
              total: 1,
            })),
          );
          examProgressQ.refresh();
          topicAttemptsQ.refresh();
          weakTopicsQ.refresh();
        } catch {
          /* the score is saved — mastery sync retries with the next test */
        }
      }
      if (weeklyRow) {
        try {
          await verifiedDbFrom(TABLES.weeklyTargets).update(weeklyRow.id, { tests_done: weeklyTestsDone + 1 });
          weeklyQ.refresh();
        } catch {
          /* weekly counter is cosmetic — the score itself is saved */
        }
      }
      showToast(`Logged ${draft.marks}/${draft.total} — ${percent}%. Weak topics and priorities just updated.`);
    } catch (error) {
      showToast("That score didn't save — mind trying once more?");
      throw error;
    } finally {
      setSavingTestScore(false);
    }
  };

  const handleDeleteScore = async (entry: ScoreEntry) => {
    // Mistakes logged under this test go with it, otherwise they'd be orphaned.
    const owned = mistakes.filter((m) => (m.score_key || (m.test_score_id ? `r${m.test_score_id}` : '')) === entry.key);
    await Promise.all(owned.map((m) => verifiedDbFrom(TABLES.mistakes).delete(m.id)));

    if (entry.resultId !== null) {
      await verifiedDbFrom(TABLES.testScores).delete(entry.resultId);
      // Builds before this one mirrored every test into zuno_scores as a bare
      // percentage; remove that twin so the test can't come back as a ghost row.
      const twin = (scoresQ.data || []).find(
        (s) => s.subject === entry.subject && s.taken_on === entry.taken_on && Number(s.score) === entry.percent,
      );
      if (twin) await verifiedDbFrom(TABLES.legacyScores).delete(twin.id);
    } else if (entry.legacyId !== null) {
      await verifiedDbFrom(TABLES.legacyScores).delete(entry.legacyId);
    }
    resultsQ.refresh();
    scoresQ.refresh();
    mistakesQ.refresh();
    showToast('Test removed. Your averages and trend just updated.');
  };

  const handleAddMistake = async (entry: ScoreEntry, draft: MistakeDraft) => {
    await verifiedDbFrom(TABLES.mistakes).insert({
      test_score_id: entry.resultId,
      score_key: entry.key,
      subject: entry.subject,
      topic: draft.topic,
      mistake_description: draft.description,
      correct_approach: draft.correct || null,
      logged_on: today,
    });
    mistakesQ.refresh();
    showToast('Noted. That topic moves up your weak-chapter list.');
  };

  const handleDeleteMistake = async (mistake: TestMistake) => {
    await verifiedDbFrom(TABLES.mistakes).delete(mistake.id);
    mistakesQ.refresh();
  };

  /**
   * [Feature 3] Post-test analysis: exactly ONE reason per wrong answer
   * (WRONG_REASONS in config/sharedConfig.ts). The wrong answer lands in the
   * digital mistake book (zuno_mistakes) tagged with:
   *  - the picked reason,
   *  - a concept tag — the question's own concept when the bank has one,
   *    otherwise rule-based from the shared keyword map (zero AI calls),
   *  - the reason's follow-up guidance as the "correct approach" note.
   * The 'No Revision' side effect (re-queue into spaced revision) is wired
   * where the results screen renders (TestOverlays), which owns the doubts
   * feature handle.
   */
  const logWrongAnswerReason = async (question: PlayableQuestion, picked: McqLetter | null, reason: WrongReason) => {
    const concept =
      (question.concept || '').trim() ||
      tagConcept(`${question.question} ${question.topic} ${question.subject}`) ||
      null;
    const followup = (WRONG_REASON_FOLLOWUPS[reason] || '').split('{concept}').join(concept ?? question.topic);
    try {
      await verifiedDbFrom(TABLES.mistakes).insert({
        test_score_id: null,
        score_key: null,
        subject: question.subject,
        topic: question.topic,
        mistake_description: `${question.question.slice(0, 220)} — answered ${picked ?? 'blank'}, correct ${question.correct}.`,
        correct_approach: followup || null,
        logged_on: today,
        reason,
        concept,
      });
      mistakesQ.refresh();
      /* [Feature 3] 'No concept' → a concrete “Learn {concept}” task lands on
       * the plan, so the coaching tip's link points at real work. */
      if (reason === 'No Concept / Not Learnt') {
        try {
          await addTask(question.subject, `Learn ${concept ?? question.topic}`, 'Self Study', true);
        } catch {
          /* the mistake is filed; the task nudge is best-effort */
        }
      }
    } catch {
      showToast("That reason didn't save — mind tapping it once more?");
      throw new Error('mistake-save-failed');
    }
  };

  return {
    quizTarget,
    setQuizTarget,
    activeQuiz,
    setActiveQuiz,
    quizAdaptive,
    bankQuestionsFor,
    prepareQuizQuestions,
    handleQuizGenerated,
    attachmentsForQuestion,
    attachImageToQuestion,
    attachBusy,
    attachImageToTask,
    removeTaskAttachment,
    lightboxUrl,
    setLightboxUrl,
    testSetupOpen,
    setTestSetupOpen,
    openTestSetup,
    testPreparing,
    testPrepareNote,
    testError,
    setTestError,
    activeTest,
    setActiveTest,
    testReview,
    setTestReview,
    startTest,
    handleTestSubmit,
    flaggedTestOpen,
    setFlaggedTestOpen,
    flaggedPreparing,
    flaggedPrepareNote,
    flaggedTestError,
    activeFlaggedTest,
    setActiveFlaggedTest,
    startFlaggedTest,
    handleFlaggedTestSubmit,
    doubtTestBusyId,
    startDoubtPracticeTest,
    generateTestOpen,
    setGenerateTestOpen,
    generateTestPreparing,
    generateTestError,
    setGenerateTestError,
    activeGeneratedTest,
    setActiveGeneratedTest,
    startGenerateTest,
    resolveGeneratedQuestion,
    photoTasksOpen,
    setPhotoTasksOpen,
    addingPhotoTasks,
    handlePhotoTasks,
    weeklyScreenOpen,
    setWeeklyScreenOpen,
    targetsScope,
    openTargetsScreen,
    savingWeekly,
    saveWeeklyTargets,
    savingMonthly,
    saveMonthlyTargets,
    lastWeekLine,
    savingTestScore,
    handleSaveScore,
    handleLogTestScore,
    handleDeleteScore,
    handleAddMistake,
    handleDeleteMistake,
    logWrongAnswerReason,
  };
}
