/**
 * Tasks feature — owns adding, editing, completing and deleting tasks, the
 * carry-over decision, post-task difficulty feedback and study-time logging.
 * All logic extracted verbatim from App.tsx; the database is reached only
 * through verifiedDbFrom / the data provider's upsertMeta.
 *
 * Phase 3 (syllabus identity): addTask accepts an optional structured
 * SyllabusRef; tasks created from the syllabus store stable ids in their
 * annotation, so mastery/coverage never fuzzy-match them again.
 */
import { useEffect, useRef, useState } from 'react';
import {
  addDaysISO,
  diffDays,
  formatDuration,
  nextTopicRevisionStep,
  normalizeTaskType,
  parseOneLiner,
  pickAiTask,
  buildRevisionDrafts,
  studyTaskTypeOf,
  studyTypeToTaskType,
  taskTypeKey,
  taskTypeToStudyType,
  topicKey,
  type StudyItem,
  type StudyTaskType,
  type SyllabusRef,
  type TaskFeeling,
  type TaskType,
  type TaskTypeDetails,
  type TopicRating,
} from '../../engine';
import { planBacklogRedistribution } from '../../studyEngine';
import { estimateRetention, estimateTimeSaved, nextOpenRevisionDay, timeSavedLine } from '../../revisionEngine';
import { REVISION_ITEM_MINUTES } from '../../config/revision';
import { inferSubjectForTopic, defaultExamDate, type ExamDef } from '../../syllabus';
import { customExamMetaRows } from '../../customExam';
import { CHAT_EXAM_META_KEY } from '../../ExamChatSupport';
import { aiImproveTask, aiStructurePlan, localStructurePlan, type PlanDraft } from '../../PlanParser';
import { flaggedConceptLabel } from '../../mcq';
import { completionQuote } from '../../quotes';
import { getSystemDate, getSystemTimestamp, localNoonTimestamp } from '../../systemDate';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { queueInsert } from '../../services/database/writeOutbox';
import { isSessionVerificationError } from '../../sessionGuard';
import { TABLES } from '../../services/database/tables';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import { trackEventOnce, trackedExamLabel } from '../../shared/track';
import { PWA_ENGAGEMENT_EVENT } from '../../shared/pwaInstall';
import type { MasteryFeature } from '../mastery/useMastery';
import type { AccessFeature } from '../access/useAccess';
import {
  ENCOURAGE_MESSAGES,
  newSectionDrafts,
  type DailySection,
  type DurationPrompt,
  type SectionDraft,
} from './taskTypes';
import {
  categoryFromTaskType,
  categoryToStudyType,
  readLastCategory,
  resolveTaskCategory,
  writeLastCategory,
  type TaskCategory,
} from './taskCategory';

/**
 * How a completion should behave. Screens that ask for the difficulty ON the
 * card (Today's inline Again/Hard/Good/Easy row) pass `skipFeedbackPrompt`
 * so the post-completion bottom sheet never opens over the answer the
 * student just gave.
 */
export interface CompleteOptions {
  skipFeedbackPrompt?: boolean;
}

export interface TasksFeature {
  /* row state */
  busyIds: Set<number>;
  setBusy: (id: number, on: boolean) => void;
  startedIds: Set<number>;
  markStarted: (id: number) => void;
  clearStarted: (id: number) => void;
  completingIds: Set<number>;

  /* core actions */
  addTask: (
    subject: string,
    topic: string,
    type: TaskType,
    ai: boolean,
    scheduledFor?: string,
    syl?: SyllabusRef,
    extras?: TaskTypeDetails,
    category?: TaskCategory,
  ) => Promise<boolean | null>;
  handleToggle: (item: StudyItem, options?: CompleteOptions) => Promise<void>;
  completeWithAnimation: (item: StudyItem, options?: CompleteOptions) => void;
  /** Inline rename from the Today list (double-tap edit) — title only. */
  renameTask: (item: StudyItem, newTitle: string) => Promise<boolean>;
  /** Implicit FSRS grade from timers — same signal path, never a button. */
  applyImplicitFeeling: (item: StudyItem, feeling: TaskFeeling) => Promise<void>;
  pinHero: (id: number | null) => void;
  togglePriority: (item: StudyItem) => Promise<void>;
  removeRevision: (item: StudyItem) => Promise<void>;
  switchToTypedExam: (exam: ExamDef) => Promise<void>;
  updateCalendarTask: (
    item: StudyItem,
    updates: { subject: string; topic: string; type: TaskType; time: string; minutes: number | null; scheduled_for: string },
  ) => Promise<void>;

  /* carry-over */
  carryoverPromptOpen: boolean;
  carryoverBusy: boolean;
  dismissCarryoverPrompt: () => void;
  decideCarryover: (decision: 'carry' | 'fresh' | 'spread' | 'done') => Promise<void>;
  deleteCarriedTask: (item: StudyItem) => Promise<void>;
  /** Delete any student task (and its pending revisions) — the task editor's
   * Remove button and the carried list both land here. Undoable via toast. */
  deleteTask: (item: StudyItem) => Promise<void>;

  /* add-task surfaces */
  addTaskOpen: boolean;
  setAddTaskOpen: (open: boolean) => void;
  /** The full-screen syllabus picker — the POWER add flow behind the '+'. */
  syllabusPickerOpen: boolean;
  setSyllabusPickerOpen: (open: boolean) => void;
  /** Queue several syllabus topics on today at once; resolves once saved. */
  addTopicsToToday: (picks: Array<{ subject: string; topic: string; chapter?: string }>) => Promise<void>;
  /** First-run "what have you studied lately?" backfill — student input only.
   * Returns how many topics were recorded (each starts revising tomorrow). */
  backfillStudiedTopics: (text: string) => Promise<number>;
  savingNewTask: boolean;
  handleAddTaskSave: (draft: {
    titles: string[];
    subject: string;
    imageDataUrl: string | null;
    taskType?: StudyTaskType;
    chapterName?: string | null;
    lectureNo?: number | null;
    syllabusTopic?: string | null;
    pageNo?: number | null;
    category?: TaskCategory;
  }) => Promise<void>;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  sheetMode: 'list' | 'form' | 'ai';
  setSheetMode: (mode: 'list' | 'form' | 'ai') => void;
  openTaskSheet: (mode: 'list' | 'form' | 'ai') => void;
  taskSections: Record<DailySection, SectionDraft>;
  setTaskSections: React.Dispatch<React.SetStateAction<Record<DailySection, SectionDraft>>>;
  ambientDismissed: boolean;
  setAmbientDismissed: (v: boolean) => void;
  formType: TaskType;
  setFormType: (t: TaskType) => void;
  formSubject: string;
  setFormSubject: (s: string) => void;
  formSubjectManual: boolean;
  setFormSubjectManual: (v: boolean) => void;
  formChapter: string;
  setFormChapter: (s: string) => void;
  formSearch: string;
  setFormSearch: (s: string) => void;
  formCustom: string;
  setFormCustom: (s: string) => void;
  addingTask: boolean;
  aiResult: string | null;
  setAiResult: (s: string | null) => void;
  quickTitle: string;
  setQuickTitle: React.Dispatch<React.SetStateAction<string>>;
  quickSubject: string;
  setQuickSubject: React.Dispatch<React.SetStateAction<string>>;
  /** The category the quick-add panel will apply, defaulting to last-used. */
  quickCategory: TaskCategory;
  setQuickCategory: React.Dispatch<React.SetStateAction<TaskCategory>>;
  topicPickerFor: 'quickadd' | null;
  setTopicPickerFor: (v: 'quickadd' | null) => void;
  quickAddTask: (subject: string) => Promise<void>;
  /** Saves one task per line. Pass `text` to submit a caller-local draft
   * (the Today inline add) without routing keystrokes through this hook. */
  /** Returns true only when every submitted line was saved or safely queued. */
  submitQuickTitle: (text?: string) => Promise<boolean>;
  submitTaskSections: () => Promise<void>;
  submitFormTask: (topic: string, selectedSubject?: string) => Promise<void>;
  submitAiTask: () => Promise<void>;

  /* plan parsing */
  planDrafts: PlanDraft[] | null;
  setPlanDrafts: (drafts: PlanDraft[] | null) => void;
  parsingPlan: boolean;
  savingPlan: boolean;
  parsePlanText: (text: string, segments: string[]) => Promise<void>;
  confirmPlanDrafts: () => Promise<void>;

  /* task editor */
  editTask: StudyItem | null;
  setEditTask: (item: StudyItem | null) => void;
  editTaskTitle: string;
  setEditTaskTitle: (s: string) => void;
  editTaskSubject: string;
  setEditTaskSubject: (s: string) => void;
  editTaskMinutes: string;
  setEditTaskMinutes: (s: string) => void;
  editTaskType: TaskType;
  setEditTaskType: (t: TaskType) => void;
  editTaskDate: string;
  setEditTaskDate: (s: string) => void;
  savingTaskEdit: boolean;
  improvingTask: boolean;
  openTaskEditor: (item: StudyItem) => void;
  saveTaskEdit: () => Promise<void>;
  improveEditedTask: () => Promise<void>;

  /* feedback + study time */
  feedbackPrompt: StudyItem | null;
  setFeedbackPrompt: (item: StudyItem | null) => void;
  savingFeeling: boolean;
  saveFeeling: (feeling: TaskFeeling) => Promise<void>;
  /** The completed REVISION awaiting its Again/Hard/Good/Easy rating — the
   * rating sheet in TaskOverlays. Mandatory (no dismiss) on the topic's very
   * first rating; later revisits may be dismissed (skipRevisionRating). */
  revisionRatingPrompt: StudyItem | null;
  setRevisionRatingPrompt: (item: StudyItem | null) => void;
  savingRating: boolean;
  /** Rate a completed revision: stores the rating per topic per student and
   * immediately schedules the ONE next revision on the 1→3→7→14→28 ladder
   * (Again resets to day 1 · Hard keeps the standard step · Good lands a day
   * sooner · Easy pushes 1–2 days later, never skipping the step). Nothing
   * else follows — no duration sheet, no extra exercise. */
  rateRevision: (item: StudyItem, rating: TopicRating) => Promise<void>;
  /** Dismiss the rating sheet WITHOUT a rating — offered only once a previous
   * rating exists. The chain never breaks: the standard next step is
   * scheduled anyway, just with no new signal stored. */
  skipRevisionRating: (item: StudyItem) => Promise<void>;
  /** The ON-CARD answer used by Today: the same signal and the same ladder
   * realignment as the sheet, minus the follow-up duration popup — the whole
   * point of the on-card control is that one tap finishes the job.
   * `'none'` is the No-revision answer. */
  answerFeelingInline: (item: StudyItem, feeling: TaskFeeling | 'none') => Promise<void>;
  /** "No Revision" on the completion prompt — removes the topic's pending
   * spaced-revision rows, so no revision entry is kept for it. */
  declineRevision: () => Promise<void>;
  /** Dismiss the completion difficulty prompt without a signal — the default
   * ladder stays; the duration sheet still follows. */
  skipFeedback: () => void;
  savingToolsFeeling: boolean;
  markToolsDifficulty: (feeling: TaskFeeling) => Promise<void>;
  durationPrompt: DurationPrompt | null;
  setDurationPrompt: (p: DurationPrompt | null) => void;
  savingDuration: boolean;
  promptForDuration: (item: StudyItem) => void;
  promptForStudyTime: () => void;
  saveDuration: (minutes: number, fromTimer: boolean) => Promise<void>;
  logFocusSession: (minutes: number) => Promise<void>;

  /* focus mode (full-screen timer overlay) */
  focusOpen: boolean;
  setFocusOpen: (open: boolean) => void;

  /* exam switch (Profile) */
  examSwitchOpen: boolean;
  setExamSwitchOpen: (open: boolean) => void;
  changingExam: boolean;
  setChangingExam: (v: boolean) => void;
}

/** How long a completing row may stay mid-animation before its flag is
 * force-released (see the effect that clears completingIds). */
const COMPLETING_RELEASE_MS = 6000;

export function useTasks(
  data: StudentData,
  toast: ToastFeature,
  mastery: MasteryFeature,
  access: AccessFeature,
): TasksFeature {
  const {
    spaceId,
    today,
    day,
    profile,
    examDef,
    items,
    studentItems,
    annotations,
    metaMap,
    savedExamLabel,
    scoreEntries,
    flaggedRows,
    carryOver,
    todayTargets,
    missionQueue,
    checklistPending,
    feelingByKey,
    todayMinutes,
    dbSessionReady,
    itemsQ,
    metaQ,
    profileQ,
    flaggedQ,
    sessionsQ,
    attachmentsQ,
    feedbackQ,
    upsertMeta,
    carryoverDecision,
    rememberCarryoverDecision,
    setCarriedIdsPersist,
    pinHeroId,
    addOptimisticItem,
    dropOptimisticItem,
    applyOptimisticPatch,
    clearOptimisticPatch,
  } = data;
  const { showToast } = toast;
  const { chargeAi, openPaywall } = access;
  const canAskAi = access.access.canAskAi;

  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];

  /* ---------- row state ---------- */

  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const setBusy = (id: number, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  /* Tasks the student has marked "in session" — the mission or any Today row. */
  const [startedIds, setStartedIds] = useState<Set<number>>(new Set());
  const markStarted = (id: number) =>
    setStartedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  const clearStarted = (id: number) =>
    setStartedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  /* Rows mid strikethrough animation, before the DB write lands. */
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());
  const encourageIndexRef = useRef(0);

  /* Once a completing row has really left the pending list (the DB write
   * landed and the query refreshed), drop its animation flag. A row that is
   * STILL pending after the grace period below gets its flag released too:
   * the strikethrough animation ends on opacity 0 (fill-mode `both`), so a
   * flag that never clears would leave an invisible ghost row where the task
   * should be — releasing it puts the real, un-ticked row back on screen. */
  useEffect(() => {
    if (completingIds.size === 0) return undefined;
    const pendingIds = new Set(checklistPending.map((item) => item.id));
    const stale = Array.from(completingIds).filter((id) => !pendingIds.has(id));
    if (stale.length > 0) {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        for (const id of stale) next.delete(id);
        return next;
      });
      return undefined;
    }
    const stuck = Array.from(completingIds);
    const release = window.setTimeout(() => {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        for (const id of stuck) next.delete(id);
        return next.size === prev.size ? prev : next;
      });
    }, COMPLETING_RELEASE_MS);
    return () => window.clearTimeout(release);
  }, [checklistPending, completingIds]);

  /* ---------- add-task surface state ---------- */

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [syllabusPickerOpen, setSyllabusPickerOpen] = useState(false);
  const [savingNewTask, setSavingNewTask] = useState(false);
  const [topicPickerFor, setTopicPickerFor] = useState<'quickadd' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'list' | 'form' | 'ai'>('list');
  const [taskSections, setTaskSections] = useState<Record<DailySection, SectionDraft>>(newSectionDrafts);
  const [ambientDismissed, setAmbientDismissed] = useState(false);
  const [formType, setFormType] = useState<TaskType>('Question Practice');
  const [formSubject, setFormSubject] = useState('');
  const [formSubjectManual, setFormSubjectManual] = useState(false);
  const [formChapter, setFormChapter] = useState('');
  const [formSearch, setFormSearch] = useState('');
  const [formCustom, setFormCustom] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [planDrafts, setPlanDrafts] = useState<PlanDraft[] | null>(null);
  const [parsingPlan, setParsingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [improvingTask, setImprovingTask] = useState(false);
  const [quickSubject, setQuickSubject] = useState('');
  const [quickCategory, setQuickCategory] = useState<TaskCategory>(readLastCategory);
  const [editTask, setEditTask] = useState<StudyItem | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskSubject, setEditTaskSubject] = useState('');
  const [editTaskMinutes, setEditTaskMinutes] = useState('');
  const [editTaskType, setEditTaskType] = useState<TaskType>('Self Study');
  const [editTaskDate, setEditTaskDate] = useState(today);
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState<StudyItem | null>(null);
  const [savingFeeling, setSavingFeeling] = useState(false);
  const [revisionRatingPrompt, setRevisionRatingPrompt] = useState<StudyItem | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [savingToolsFeeling, setSavingToolsFeeling] = useState(false);
  const [durationPrompt, setDurationPrompt] = useState<DurationPrompt | null>(null);
  const [savingDuration, setSavingDuration] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [carryoverPromptOpen, setCarryoverPromptOpen] = useState(false);
  const [carryoverBusy, setCarryoverBusy] = useState(false);
  const [examSwitchOpen, setExamSwitchOpen] = useState(false);
  const [changingExam, setChangingExam] = useState(false);

  /* On the FIRST open of a new day with unfinished tasks from earlier, ask
   * ONCE — carry them over, or start fresh. The stored decision keeps the
   * modal from ever re-appearing the same day.
   *
   * SILENT RE-PLAN AFTER A GAP: when the oldest carried task is 2+ days old
   * (the student was away), the missed work is folded back into the schedule
   * automatically — redistributed a couple of tasks per day — with no
   * question asked and nothing shown as overdue or arrears. Elapsed time is
   * simply a longer interval; the return screen states what's next. The
   * one-time prompt remains only for the ordinary one-day carry-over. */
  const silentReplanRef = useRef(false);
  useEffect(() => {
    if (itemsQ.loading || !profile) return;
    if (carryoverDecision || carryoverPromptOpen) return;
    if (carryOver.length === 0) return;
    const gapDays = diffDays(carryOver[0].scheduled_for, today);
    if (gapDays >= 2) {
      if (!silentReplanRef.current && !carryoverBusy) {
        silentReplanRef.current = true;
        void decideCarryover('spread');
      }
      return;
    }
    setCarryoverPromptOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsQ.loading, profile?.id, carryoverDecision, carryoverPromptOpen, carryOver.length]);

  /* ---------- core actions ---------- */

  /* Topics whose insert is still in flight. The duplicate check below reads
   * studentItems, which cannot have refreshed yet when the student chain-adds
   * several tasks in a row — this keeps a repeated title from landing twice. */
  const inFlightKeysRef = useRef<Set<string>>(new Set());
  const releaseInFlightKey = (key: string, afterMs = 0) => {
    if (afterMs <= 0) {
      inFlightKeysRef.current.delete(key);
      return;
    }
    window.setTimeout(() => inFlightKeysRef.current.delete(key), afterMs);
  };

  /**
   * Add one study task — OPTIMISTICALLY. The row is shown on Today
   * immediately (a draft merged into the data layer), while this promise
   * resolves only after the insert either lands, is safely queued for retry,
   * or definitively fails. Callers can therefore keep the student's input on
   * a real failure without sacrificing the instant UI update.
   */
  const addTask = async (
    subject: string,
    topic: string,
    type: TaskType,
    ai: boolean,
    scheduledFor: string = today,
    syl?: SyllabusRef,
    extras?: TaskTypeDetails,
    category?: TaskCategory,
  ): Promise<boolean | null> => {
    if (!data.dbSessionReady) {
      console.warn('[vicharakai] addTask called before session ready — skipping');
      return null;
    }
    if (!profile) return false;
    // Read the count BEFORE the optimistic draft goes on the list, so the
    // retention event below can tell a 0 → 1 transition from any later add.
    const isFirstTask = studentItems.length === 0;
    const key = topicKey(subject, topic);
    // Duplicate check runs against the VISIBLE list (studentItems) and counts
    // ONLY queued study twins (kind 'new') — pending spaced-REVISION rows
    // never block re-adding a topic.
    const duplicate = studentItems.some(
      (item) =>
        item.kind === 'new' &&
        item.status === 'pending' &&
        (item.source_key || topicKey(item.subject, item.topic)) === key,
    );
    if (duplicate || inFlightKeysRef.current.has(key)) return false;
    const row = {
      exam: profile.exam,
      subject,
      topic,
      kind: 'new' as const,
      day_number: Math.max(1, day + diffDays(today, scheduledFor)),
      scheduled_for: scheduledFor,
      status: 'pending' as const,
      source_key: key,
      // A student-facing category rides on every task — the explicit pick
      // when there is one, otherwise derived from the task type so existing
      // add flows still get a sensible tag.
      category: category ?? categoryFromTaskType(type),
    };
    inFlightKeysRef.current.add(key);
    const tempId = addOptimisticItem({ ...row, created_at: getSystemDate().toISOString() });
    // Phase 3: a task born from the syllabus stores its structured identity.
    // The add-task extras (task_type, chapter_name, lecture_no,
    // syllabus_topic, page_no) persist in the same annotation.
    const annotationValue = JSON.stringify({ type: normalizeTaskType(type), ai, ...(syl ? { syl } : {}), ...(extras ?? {}) });
    /* The card is already visible, but the caller does not discard its draft
     * until this block reaches a durable outcome. Transient failures enter the
     * local outbox and count as accepted; an expired session rolls the draft
     * back and reports a real failure so every input surface can stay open. */
    try {
      await verifiedDbFrom(TABLES.items).insert(row as Record<string, unknown>);
    } catch (error) {
      console.error(`[vicharakai] task insert failed for "${topic}"`, error);
      if (isSessionVerificationError(error)) {
        dropOptimisticItem(tempId);
        showToast(`Sign in again to save \u201C${topic}\u201D — your session expired.`);
        releaseInFlightKey(key);
        return null;
      }
      const queued = queueInsert(TABLES.items, row as Record<string, unknown>, { key: taskTypeKey(key), value: annotationValue });
      if (!queued) {
        dropOptimisticItem(tempId);
        showToast(`Couldn't save \u201C${topic}\u201D — your task is still in the box. Check storage space and tap Add once more.`);
        releaseInFlightKey(key);
        return null;
      }
      showToast(`Saving \u201C${topic}\u201D is slow right now — it's kept safe and will sync automatically.`);
      // Keep duplicate protection through the next query/render cycle.
      releaseInFlightKey(key, 5000);
      return true;
    }
    // Retention signal: the first study task this student ever saved. The
    // once-guard is written synchronously, so a bulk add whose rows all
    // land in the same tick still reports exactly one.
    if (isFirstTask) {
      try {
        trackEventOnce(spaceId, 'first_task_logged_fired', 'first_task_logged', {
          exam: trackedExamLabel(examDef, savedExamLabel, row.exam),
          subject: (subject ?? '').trim() || null,
        });
      } catch (error) {
        console.warn('[vicharakai] first-task analytics did not record', error);
      }
    }
    try {
      await upsertMeta(taskTypeKey(key), annotationValue);
    } catch (error) {
      /* The task itself saved; the self-heal pass retries its annotation. */
      console.warn('[vicharakai] task annotation write failed — self-heal will retry', error);
    }
    itemsQ.refresh();
    // `studentItems` is render-time state; keep the key guarded until the
    // refreshed row has had time to enter that state.
    releaseInFlightKey(key, 5000);
    return true;
  };

  const handleToggle = async (item: StudyItem, options?: CompleteOptions) => {
    // An optimistic draft has no database row yet — nothing to update.
    if (item.pending_sync) return;
    if (busyIds.has(item.id)) return;
    setBusy(item.id, true);
    /* Set while an optimistic patch is on screen, so the catch below knows to
     * roll it back whichever step failed. */
    let optimisticallyDone = false;
    try {
      const db = verifiedDbFrom(TABLES.items);
      if (item.status === 'pending') {
        /* A LOCAL-offset stamp, so the day this row reads as completed on is
         * the same day the checklist calls today (systemDate.getSystemTimestamp). */
        const now = getSystemTimestamp();
        /* OPTIMISTIC COMPLETE: ticking a task is the most-used action in the
         * app, and it used to sit through the update AND the revision-draft
         * inserts — two round trips — before the checkbox moved, which is
         * what made saving feel slow on a phone. The row reads as done at
         * once now; every failure path clears the patch again (see the catch),
         * so a write that never lands still returns the checkbox to its real
         * state. Mirrors the un-complete branch below. */
        const donePatch = {
          status: 'done' as const,
          completed_at: now,
          studied_on: item.kind === 'new' ? today : item.studied_on ?? null,
        };
        applyOptimisticPatch(item.id, donePatch);
        optimisticallyDone = true;
        await db.update(item.id, donePatch);
        if (item.kind === 'new') {
          const key = item.source_key || topicKey(item.subject, item.topic);
          const have = new Set(
            items.filter((i) => i.kind === 'revision' && i.source_key === key).map((i) => i.interval_days as number),
          );
          // Also skip a draft when an identical pending revision for this
          // topic already sits on the same date — never a duplicate row.
          const pendingDates = new Set(
            items
              .filter((i) => i.kind === 'revision' && i.status === 'pending' && i.source_key === key)
              .map((i) => i.scheduled_for),
          );
          // PILE-UP PROTECTION: never more than REVISION_DAILY_CAP revisions
          // scheduled on one day — overflow chunks forward to the nearest
          // open day (nextOpenRevisionDay walks the per-day load map).
          const revisionLoadByDate = new Map<string, number>();
          for (const row of items) {
            if (row.kind !== 'revision' || row.status !== 'pending') continue;
            revisionLoadByDate.set(row.scheduled_for, (revisionLoadByDate.get(row.scheduled_for) ?? 0) + 1);
          }
          // Every topic follows the ONE canonical 1→3→7→14→28 ladder from
          // its study date; the post-revision rating chips roll it one step
          // at a time from there.
          // Auto-revisions inherit the parent task's category and are flagged
          // internally as auto-revisions — they render identically to a normal
          // task of the same category, no different colour.
          const parentCategory = resolveTaskCategory(item, annotations.get(key)?.type);
          await Promise.all(
            buildRevisionDrafts(item, today, have, studyTaskTypeOf(annotations.get(key)), null)
              .filter((d) => !pendingDates.has(d.scheduled_for))
              .map((d) => ({
                ...d,
                scheduled_for: nextOpenRevisionDay(d.scheduled_for, revisionLoadByDate),
                category: parentCategory,
                is_auto_revision: true,
              }))
              .map((d) => db.insert(d as Record<string, unknown>)),
          );
        }
        clearStarted(item.id);
        // Adaptation engine: the completed task counts as a study session on
        // its syllabus chapter — mastery, attempts and spaced revision update.
        mastery.feedAdaptationEngine(item);
        // First meaningful action — the engagement signal the PWA install
        // popup (components/PWAInstallPrompt) waits for before it may show.
        try {
          window.dispatchEvent(new CustomEvent(PWA_ENGAGEMENT_EVENT));
        } catch {
          /* nothing depends on this signal — the popup's own timer covers it */
        }
        if (item.kind === 'revision') {
          // [Time saved] Every completed revision returns an immediate,
          // specific payback figure — read from the SAME decay model that
          // scheduled it (revisionEngine.estimateTimeSaved).
          const key = item.source_key || topicKey(item.subject, item.topic);
          const ann = annotations.get(key);
          const minutes = ann?.minutes && ann.minutes > 0 ? ann.minutes : REVISION_ITEM_MINUTES;
          const elapsed = item.studied_on ? Math.max(0, diffDays(item.studied_on, today)) : 0;
          const stability = Number(item.interval_days) > 0 ? Number(item.interval_days) : 7;
          showToast(timeSavedLine(estimateTimeSaved(minutes, estimateRetention(elapsed, stability))));
          // [Rating chips] Every completed revision asks Again / Hard / Good /
          // Easy — the rating schedules the next revision, and nothing else
          // follows it. Mandatory (no dismiss) on the topic's first rating.
          // A surface that rates INLINE (Today's on-card chips) passes
          // skipFeedbackPrompt so the sheet never doubles the question.
          if (!options?.skipFeedbackPrompt) setRevisionRatingPrompt(item);
        } else {
          // A warm rotating encouragement — a statement, never a question.
          showToast(ENCOURAGE_MESSAGES[encourageIndexRef.current % ENCOURAGE_MESSAGES.length]);
          encourageIndexRef.current += 1;
        }
        // [Feature 1] Completion difficulty prompt — a bottom sheet asking
        // Easy / Medium / Hard / No Revision (rendered in TaskOverlays).
        // The implicit grade above already scheduled a sensible default, so
        // the prompt is always skippable; an explicit answer realigns the
        // topic's revision ladder (saveFeeling) or removes it entirely
        // (declineRevision). The duration sheet follows either way.
        // A surface that rates INLINE (Today's on-card Again/Hard/Good/Easy
        // row) asks for the sheet to stay shut — the answer is already there
        // on the card, so a popup would only repeat the question.
        if (item.kind === 'new' && !options?.skipFeedbackPrompt) setFeedbackPrompt(item);
      } else {
        if (feedbackPrompt?.id === item.id) setFeedbackPrompt(null);
        if (revisionRatingPrompt?.id === item.id) setRevisionRatingPrompt(null);
        /* OPTIMISTIC UN-COMPLETE: the row returns to the pending list at
         * once; the write runs behind it and rolls back on failure. */
        const pendingPatch = {
          status: 'pending' as const,
          completed_at: null,
          ...(item.kind === 'new' ? { studied_on: null } : {}),
        };
        applyOptimisticPatch(item.id, pendingPatch);
        try {
          await db.update(item.id, pendingPatch);
        } catch (error) {
          clearOptimisticPatch(item.id);
          throw error;
        }
        if (item.kind === 'new') {
          const key = item.source_key || topicKey(item.subject, item.topic);
          const pendingRevs = items.filter((i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending');
          await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
        }
      }
      itemsQ.refresh();
    } catch (error) {
      /* NOTHING IS EVER LEFT LOOKING SAVED WHEN IT IS NOT. Both directions
       * render optimistically and both roll back here: the complete path
       * clears its patch below, the un-complete path cleared its own before
       * rethrowing, so the checkbox returns to its real state either way.
       * Releasing the strikethrough flag puts the un-ticked row back on
       * screen at once instead of waiting out the grace period.
       *
       * Handled HERE rather than at each call site: every surface that ticks
       * a task (Today, the calendar, the recall card, the dashboard) went
       * through this function, and only one of them was catching. */
      if (optimisticallyDone) clearOptimisticPatch(item.id);
      console.error('[vicharakai] task toggle failed', error);
      setCompletingIds((prev) => {
        if (!prev.has(item.id)) return prev;
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      showToast(
        isSessionVerificationError(error) && error instanceof Error
          ? error.message
          : "Couldn't save — please try again.",
      );
    } finally {
      setBusy(item.id, false);
    }
  };

  /** A tapped checkbox first draws a slow strikethrough across the task text,
   * lets the row fade slightly, and only then moves it to Completed. */
  const completeWithAnimation = (item: StudyItem, options?: CompleteOptions) => {
    if (item.pending_sync) return;
    if (item.status !== 'pending') {
      void handleToggle(item, options);
      return;
    }
    if (busyIds.has(item.id) || completingIds.has(item.id)) return;
    setCompletingIds((prev) => new Set(prev).add(item.id));
    window.setTimeout(() => {
      /* handleToggle reports and recovers from its own failures — it
       * un-ticks the row, releases this animation flag and raises the
       * toast — so nothing is swallowed by the missing catch here. */
      void handleToggle(item, options);
    }, 950);
  };

  /** Star a queued task to make it the hero mission; null clears the choice. */
  const pinHero = (id: number | null) => {
    pinHeroId(id);
    if (id !== null) showToast("Starred — that's your mission now.");
  };

  /** Toggle the student's own priority star on a Today task. Persisted on the
   * row itself (zuno_items.is_priority) so it survives refreshes and devices. */
  const togglePriority = async (item: StudyItem) => {
    if (item.pending_sync || busyIds.has(item.id)) return;
    const next = !item.is_priority;
    /* OPTIMISTIC STAR: the pin flips on screen immediately; the write runs
     * behind it and rolls back on failure. */
    applyOptimisticPatch(item.id, { is_priority: next });
    showToast(next ? 'Prioritized — pinned to the top of your list.' : 'Priority removed.');
    try {
      await verifiedDbFrom(TABLES.items).update(item.id, { is_priority: next });
      itemsQ.refresh();
    } catch (error) {
      console.error('[vicharakai] priority toggle failed', error);
      clearOptimisticPatch(item.id);
      showToast("That didn't save — mind tapping the star once more?");
    }
  };

  /** Drop one auto-scheduled revision — quick, silent, always undoable. */
  const removeRevision = async (item: StudyItem) => {
    if (item.pending_sync || busyIds.has(item.id)) return;
    setBusy(item.id, true);
    try {
      await verifiedDbFrom(TABLES.items).delete(item.id);
      itemsQ.refresh();
      const clone: Record<string, unknown> = {
        exam: item.exam,
        subject: item.subject,
        topic: item.topic,
        kind: 'revision',
        scheduled_for: item.scheduled_for,
        status: 'pending',
        studied_on: item.studied_on ?? null,
        interval_days: item.interval_days ?? null,
        source_key: item.source_key || topicKey(item.subject, item.topic),
        day_number: item.day_number ?? null,
        category: item.category ?? null,
        is_auto_revision: item.is_auto_revision ?? false,
      };
      showToast('Revision removed.', () => {
        void verifiedDbFrom(TABLES.items).insert(clone).then(() => itemsQ.refresh()).catch(() => undefined);
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  /**
   * Move an existing student onto an exam they typed in. The syllabus is
   * stored BEFORE the profile points at it, so there is never a moment where
   * the app holds an exam id it cannot explain.
   */
  const switchToTypedExam = async (exam: ExamDef) => {
    if (!profile) return;
    for (const [key, value] of customExamMetaRows(exam)) {
      await upsertMeta(key, value);
    }
    await verifiedDbFrom(TABLES.profile).update(profile.id, { exam: exam.id });
    await upsertMeta('exam_date', defaultExamDate(exam, today));
    // The chat's pinned exam must follow the switch — otherwise readiness,
    // weak topics and Exam Insights stay grounded in the previous exam.
    if (metaMap.get(CHAT_EXAM_META_KEY)?.meta_value) await upsertMeta(CHAT_EXAM_META_KEY, '');
    profileQ.refresh();
    metaQ.refresh();
    setExamSwitchOpen(false);
    setChangingExam(false);
    showToast(`Switched to ${exam.name} \u2014 your history stays safe.`);
  };

  /* ---------- carry-over ---------- */

  const dismissCarryoverPrompt = () => {
    setCarryoverPromptOpen(false);
    rememberCarryoverDecision('dismissed');
  };

  const decideCarryover = async (decision: 'carry' | 'fresh' | 'spread' | 'done') => {
    if (carryoverBusy) return;
    const tasks = [...carryOver];
    if (tasks.length === 0) {
      dismissCarryoverPrompt();
      return;
    }
    setCarryoverBusy(true);
    try {
      if (decision === 'spread') {
        // Smart spread: the deterministic engine distributes the backlog a
        // couple of tasks per day over the coming days — related topics land
        // first, so momentum carries and no day becomes impossible.
        const moves = planBacklogRedistribution(tasks, todayTargets, today);
        await Promise.all(
          moves.map(({ item, newDate }) =>
            verifiedDbFrom(TABLES.items).update(item.id, {
              scheduled_for: newDate,
              day_number: Math.max(1, day + diffDays(today, newDate)),
            }),
          ),
        );
        // TONE: what's next, never what was missed — no counts, no arrears.
        showToast('Your plan is refreshed — a little every day, nothing lost.');
      } else if (decision === 'carry') {
        await Promise.all(
          tasks.map((item) =>
            verifiedDbFrom(TABLES.items).update(item.id, { scheduled_for: today, day_number: day }),
          ),
        );
        setCarriedIdsPersist(new Set(tasks.map((task) => task.id)));
        showToast(`Carried ${tasks.length} task${tasks.length === 1 ? '' : 's'} over — find them under \u201CFrom yesterday\u201D.`);
      } else if (decision === 'done') {
        // "I actually finished these — I just forgot to tick them off."
        // Close each task as done ON ITS PLANNED DAY: completed_at and
        // studied_on point at the original scheduled date, so the history
        // and streaks credit the day the work really happened and nothing
        // lands on Today. Deliberately NO revision drafts and no difficulty
        // prompt here — this is a bulk catch-up tick, not a fresh study
        // session; the carry/spread/fresh paths are untouched.
        await Promise.all(
          tasks.map((item) =>
            verifiedDbFrom(TABLES.items).update(item.id, {
              status: 'done',
              completed_at: localNoonTimestamp(item.scheduled_for),
              studied_on: item.scheduled_for,
            }),
          ),
        );
        // Chapter mastery still counts the studying, exactly as a same-day
        // checkbox tick would (fire-and-forget, never blocks the dismiss).
        for (const item of tasks) mastery.feedAdaptationEngine(item);
        showToast(`Nice — marked ${tasks.length} task${tasks.length === 1 ? '' : 's'} as done. It all counts.`);
      } else {
        // Archive: skipped tasks never surface on Today again.
        await Promise.all(
          tasks.map((item) => verifiedDbFrom(TABLES.items).update(item.id, { status: 'skipped' })),
        );
        showToast("Starting fresh — yesterday's unfinished tasks are archived.");
      }
      itemsQ.refresh();
      rememberCarryoverDecision(decision);
      setCarryoverPromptOpen(false);
    } catch (error) {
      console.error('[vicharakai] carry-over decision failed to save', error);
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setCarryoverBusy(false);
    }
  };

  /** Delete a task row (and, for a study task, its pending spaced revisions).
   * Used by the "From yesterday" list AND the task editor's Remove button.
   * The toast offers a one-tap Undo that re-inserts everything deleted, so an
   * accidental remove is never permanent. */
  const deleteTask = async (item: StudyItem) => {
    if (item.pending_sync || busyIds.has(item.id)) return;
    setBusy(item.id, true);
    try {
      const db = verifiedDbFrom(TABLES.items);
      const key = item.source_key || topicKey(item.subject, item.topic);
      const pendingRevs =
        item.kind === 'new'
          ? items.filter((i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending')
          : [];
      await db.delete(item.id);
      await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
      itemsQ.refresh();
      // Undo re-creates the exact rows (new ids); meta/annotations are keyed
      // by source_key, so the task type and minutes survive automatically.
      const clones: Array<Record<string, unknown>> = [item, ...pendingRevs].map((row) => ({
        exam: row.exam,
        subject: row.subject,
        topic: row.topic,
        kind: row.kind,
        day_number: row.day_number ?? null,
        scheduled_for: row.scheduled_for,
        status: row.status,
        source_key: row.source_key || topicKey(row.subject, row.topic),
        studied_on: row.studied_on ?? null,
        interval_days: row.interval_days ?? null,
        is_priority: row.is_priority ?? false,
        category: row.category ?? null,
        is_auto_revision: row.is_auto_revision ?? false,
      }));
      showToast('Task removed.', () => {
        void Promise.all(clones.map((clone) => verifiedDbFrom(TABLES.items).insert(clone)))
          .then(() => itemsQ.refresh())
          .catch(() => undefined);
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  /** Carried tasks can be deleted normally from "From yesterday". */
  const deleteCarriedTask = deleteTask;

  /** Inline rename from the Today list (double-tap edit) — title only. The
   * topic's source_key, pending revision rows and annotation all move with
   * the new name so the spaced schedule is never orphaned. */
  const renameTask = async (item: StudyItem, newTitle: string): Promise<boolean> => {
    const title = (newTitle ?? '').trim();
    if (item.pending_sync || !title) return false;
    if (title === item.topic) return true;
    const oldKey = item.source_key || topicKey(item.subject, item.topic);
    const nextKey = topicKey(item.subject, title);
    if (nextKey !== oldKey) {
      const collision = studentItems.some(
        (row) =>
          row.id !== item.id &&
          row.kind === 'new' &&
          row.status === 'pending' &&
          (row.source_key || topicKey(row.subject, row.topic)) === nextKey,
      );
      if (collision) {
        showToast('A task with that title is already on your plan.');
        return false;
      }
    }
    // OPTIMISTIC RENAME: the title changes on the card immediately; the write
    // runs behind it and rolls back on failure.
    applyOptimisticPatch(item.id, { topic: title, source_key: nextKey });
    try {
      const db = verifiedDbFrom(TABLES.items);
      await db.update(item.id, { topic: title, source_key: nextKey });
      if (nextKey !== oldKey) {
        const siblings = items.filter(
          (row) => row.id !== item.id && row.kind === 'revision' && (row.source_key || topicKey(row.subject, row.topic)) === oldKey,
        );
        await Promise.all(siblings.map((row) => db.update(row.id, { topic: title, source_key: nextKey })));
        const prev = annotations.get(oldKey);
        if (prev) await upsertMeta(taskTypeKey(nextKey), JSON.stringify(prev));
      }
      itemsQ.refresh();
      showToast('Task renamed.');
      return true;
    } catch (error) {
      console.error('[vicharakai] task rename failed', error);
      clearOptimisticPatch(item.id);
      showToast("That rename didn't save — your text is still here. Mind trying once more?");
      return false;
    }
  };

  /* ---------- the Mistake Book feeds the plan ---------- */

  /* Each fresh Mistake Book entry's topic surfaces as a priority
   * "Clear mistake: …" revision task on Today — automatically, no manual
   * entry. Builds before the Doubts → Mistake Book rename wrote the same task
   * as "Clear doubt: …"; that legacy title is still matched here so a
   * concept already on the plan never gets a second, duplicate task. */
  const doubtTaskKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!dbSessionReady || !profile || itemsQ.loading || flaggedQ.loading) return;
    const since = addDaysISO(today, -7);
    const candidates = new Map<string, { subject: string; topic: string; legacyKey: string; latest: string }>();
    for (const row of flaggedRows) {
      if ((row.created_on || '') < since) continue;
      const subject = (row.subject || '').trim() || 'General';
      const concept = flaggedConceptLabel(row);
      const topic = `Clear mistake: ${concept}`;
      const key = topicKey(subject, topic);
      const legacyKey = topicKey(subject, `Clear doubt: ${concept}`);
      const current = candidates.get(key);
      if (!current || row.created_on > current.latest) {
        candidates.set(key, { subject, topic, legacyKey, latest: row.created_on });
      }
    }
    const inserts: Array<{ subject: string; topic: string }> = [];
    for (const [key, group] of candidates) {
      if (doubtTaskKeysRef.current.has(key)) continue;
      doubtTaskKeysRef.current.add(key);
      const already = items.some((item) => {
        const itemKey = item.source_key || topicKey(item.subject, item.topic);
        if (itemKey !== key && itemKey !== group.legacyKey) return false;
        if (item.status === 'pending') return true;
        return ((item.created_at || '').slice(0, 10) || item.scheduled_for) >= group.latest;
      });
      if (!already) inserts.push({ subject: group.subject, topic: group.topic });
    }
    if (inserts.length === 0) return;
    void (async () => {
      for (const draft of inserts.slice(0, 3)) {
        try {
          await addTask(draft.subject, draft.topic, 'Revision', true);
        } catch {
          /* the entry itself is saved — the next visit tries the task again */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, profile?.id, itemsQ.loading, flaggedQ.loading, flaggedRows, items, today]);

  /* ---------- add-task flows ---------- */

  /** Opens the add-task sheet on one of its three paths, cleared of any old draft. */
  const openTaskSheet = (mode: 'list' | 'form' | 'ai') => {
    setSheetOpen(true);
    setSheetMode(mode);
    setAmbientDismissed(false);
    setAiResult(null);
    setFormSubject('');
    setFormSubjectManual(false);
    setFormChapter('');
    setFormSearch('');
    setFormCustom('');
  };

  /** One-tap subject task: created instantly with a rename-friendly name. */
  const quickAddTask = async (subject: string) => {
    if (addingTask) return;
    if (!profile) {
      showToast('Your plan is still loading — give it a second, then try again.');
      return;
    }
    setAddingTask(true);
    try {
      const created = await addTask(subject, `${subject} study session`, 'Self Study', false);
      if (created === null) return;
      setSheetOpen(false);
      showToast(
        created
          ? `Added a ${subject} task — tap its pencil to rename.`
          : 'That task is already on your plan — no duplicate added.',
      );
    } catch (error) {
      console.error('[vicharakai] quick-add failed', error);
      showToast("That task didn't save — mind tapping it once more?");
    } finally {
      setAddingTask(false);
    }
  };

  /* The '+' FAB modal — ONE TASK PER LINE, all saved with a single "Add All"
   * tap. The optional photo persists in zuno_attachments next to the first task. */
  const handleAddTaskSave = async (draft: {
    titles: string[];
    subject: string;
    imageDataUrl: string | null;
    taskType?: StudyTaskType;
    chapterName?: string | null;
    lectureNo?: number | null;
    syllabusTopic?: string | null;
    pageNo?: number | null;
    category?: TaskCategory;
  }) => {
    if (savingNewTask) return;
    if (!profile) {
      showToast('Your plan is still loading — give it a second, then tap Add again.');
      return;
    }
    const titles = draft.titles.map((line) => (line ?? '').trim()).filter(Boolean).slice(0, 20);
    if (titles.length === 0) return;
    setSavingNewTask(true);
    try {
      let added = 0;
      let failed = 0;
      let firstKey: string | null = null;
      // The sheet's picked category maps to a revision-ladder bucket when the
      // student didn't pick an explicit study type, so a completed task still
      // schedules sensibly-spaced FSRS revisions. The optional extras
      // (chapter, lecture #, syllabus topic, page) ride along on every line.
      const ladderBucket = draft.taskType ?? (draft.category ? categoryToStudyType(draft.category) : undefined);
      const extras: TaskTypeDetails | undefined = ladderBucket
        ? {
            task_type: ladderBucket,
            chapter_name: draft.chapterName || undefined,
            lecture_no: draft.lectureNo || undefined,
            syllabus_topic: draft.syllabusTopic || undefined,
            page_no: draft.pageNo || undefined,
          }
        : undefined;
      for (const title of titles) {
        const parsed = parseOneLiner(title, examDef);
        const subject = draft.subject || parsed.subject || 'General';
        const type = ladderBucket ? studyTypeToTaskType(ladderBucket) : parsed.type;
        try {
          const created = await addTask(subject, title, type, false, today, undefined, extras, draft.category);
          if (created) {
            added += 1;
            if (!firstKey) firstKey = topicKey(subject, title);
          } else if (created === null) {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        showToast(
          added > 0
            ? `Added ${added}; ${failed} didn't save. Your task list is still here so you can retry safely.`
            : "Those tasks couldn't be added — your task list is still here. Mind tapping Add once more?",
        );
        return;
      }
      if (draft.imageDataUrl && firstKey) {
        try {
          await verifiedDbFrom(TABLES.attachments).insert({
            parent_type: 'task',
            parent_key: firstKey,
            image_url: draft.imageDataUrl,
            created_on: today,
          });
          attachmentsQ.refresh();
        } catch {
          /* the tasks saved — only the photo missed; attach it via Edit later */
        }
      }
      setAddTaskOpen(false);
      const skipped = titles.length - added - failed;
      showToast(
        added === 0
          ? 'Those tasks are already on your plan — no duplicates added.'
          : `✓ Logged! VicharakAI is updating your plan.${skipped > 0 ? ` ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.` : ''}${failed > 0 ? ` ${failed} didn't save.` : ''}`,
      );
    } catch (error) {
      console.error('[vicharakai] add-task save failed', error);
      showToast("Those tasks didn't save — mind trying once more?");
    } finally {
      setSavingNewTask(false);
    }
  };

  /** The full-screen syllabus picker's "Add to Today" — every ticked topic
   * goes through the SAME addTask path as every other surface, so duplicates
   * are skipped and revision scheduling behaves identically. The selected
   * syllabus identity (chapter · lecture number · topic) rides on the task
   * annotation, so the engine knows exactly what the task refers to. */
  const addTopicsToToday = async (picks: Array<{ subject: string; topic: string; chapter?: string; lectureNo?: number }>) => {
    if (picks.length === 0 || savingNewTask) return;
    if (!profile) {
      showToast('Your plan is still loading — give it a second, then add them again.');
      return;
    }
    setSavingNewTask(true);
    try {
      let added = 0;
      let failed = 0;
      for (const pick of picks) {
        try {
          const created = await addTask(
            pick.subject || 'General',
            pick.topic,
            'Self Study',
            false,
            today,
            undefined,
            pick.chapter || pick.lectureNo
              ? ({
                  chapter_name: pick.chapter || undefined,
                  syllabus_topic: pick.topic,
                  lecture_no: pick.lectureNo || undefined,
                } as TaskTypeDetails)
              : undefined,
          );
          if (created) added += 1;
          else if (created === null) failed += 1;
        } catch {
          failed += 1;
        }
      }
      if (failed === 0) setSyllabusPickerOpen(false);
      showToast(
        added === 0
          ? failed > 0
            ? "Those topics couldn't be added — mind trying once more?"
            : 'Already on your plan — no duplicates added.'
          : `Added ${added} topic${added === 1 ? '' : 's'} to today${failed > 0 ? ` · ${failed} didn't save` : ''}.`,
      );
    } finally {
      setSavingNewTask(false);
    }
  };

  /**
   * The quick-add box takes ONE TASK PER LINE — one "Add All" saves every line.
   *
   * Tasks appear on Today optimistically, but the box clears only after every
   * line has landed or entered the durable retry queue. A definitive failure
   * leaves the original text untouched for a safe retry.
   */
  const submitQuickTitle = async (text?: string): Promise<boolean> => {
    const source = text ?? quickTitle;
    const lines = source.split(/\n+/).map((line) => (line ?? '').trim()).filter(Boolean).slice(0, 20);
    if (lines.length === 0) return false;
    if (!profile) {
      showToast('Your plan is still loading — give it a second, then tap Add again.');
      return false;
    }
    setAddingTask(true);
    try {
      let added = 0;
      let failed = 0;
      writeLastCategory(quickCategory);
      for (const line of lines) {
        const parsed = parseOneLiner(line, examDef);
        const subject = quickSubject || parsed.subject || 'General';
        try {
          const created = await addTask(subject, line, parsed.type, false, today, undefined, undefined, quickCategory);
          if (created) added += 1;
          else if (created === null) failed += 1;
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        showToast(
          added > 0
            ? `Added ${added}; ${failed} didn't save. Your text is still here so you can retry safely.`
            : "Those tasks couldn't be added — your text is still here. Mind tapping Add once more?",
        );
        return false;
      }
      if (text === undefined) setQuickTitle((current) => (current === source ? '' : current));
      showToast(
        added === 0
          ? 'Already on your plan — no duplicates added.'
          : `Added ${added} task${added === 1 ? '' : 's'} to today.`,
      );
      return true;
    } catch (error) {
      console.error('[vicharakai] quick-title save failed', error);
      showToast("Those tasks didn't save — your text is still here. Mind trying once more?");
      return false;
    } finally {
      setAddingTask(false);
    }
  };

  /** Block of text → structured drafts: AI restructures and labels each task;
   * the local parser is the silent fallback so this never dead-ends. */
  const parsePlanText = async (text: string, segments: string[]) => {
    setParsingPlan(true);
    try {
      let drafts: PlanDraft[] | null = null;
      if (canAskAi) {
        try {
          drafts = await aiStructurePlan({
            rawText: text,
            segments,
            examLabel: examDef?.target.label || savedExamLabel || profile?.exam || 'Competitive exam',
            subjects: subjectNames,
          });
          chargeAi();
        } catch {
          drafts = null;
        }
      }
      let ready: PlanDraft[] = drafts && drafts.length > 0 ? drafts : localStructurePlan(segments, examDef);
      // The chip the student tapped fills any subject the parse couldn't name.
      if (quickSubject) ready = ready.map((d) => (d.subject ? d : { ...d, subject: quickSubject }));
      setPlanDrafts(ready);
      setQuickTitle('');
    } finally {
      setParsingPlan(false);
    }
  };

  /** Save every kept, subject-complete draft — each lands on Today at once. */
  const confirmPlanDrafts = async () => {
    if (!planDrafts || savingPlan) return;
    const rows = planDrafts.filter((d) => d.keep && (d.title ?? '').trim() && (d.subject ?? '').trim());
    if (rows.length === 0) return;
    setSavingPlan(true);
    try {
      let failed = 0;
      let added = 0;
      for (const row of rows) {
        const created = await addTask((row.subject ?? '').trim(), (row.title ?? '').trim(), row.type, true);
        if (created) added += 1;
        else if (created === null) failed += 1;
      }
      if (failed > 0) {
        showToast(`${failed} task${failed === 1 ? '' : 's'} didn't save — the review list is still here so you can retry.`);
        return;
      }
      setPlanDrafts(null);
      setSheetOpen(false);
      showToast(added > 0 ? `Added ${added} task${added === 1 ? '' : 's'} to today.` : 'Those tasks are already on your plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  /** One-tap AI polish inside the task editor: tightens the title and fixes
   * the subject; the student still reviews before saving. */
  const improveEditedTask = async () => {
    if (!editTask || improvingTask || !(editTaskTitle ?? '').trim()) return;
    if (!canAskAi) {
      openPaywall('chat');
      return;
    }
    setImprovingTask(true);
    try {
      const suggestion = await aiImproveTask({
        title: editTaskTitle,
        subject: editTaskSubject,
        examLabel: examDef?.target.label || savedExamLabel || profile?.exam || 'Competitive exam',
        subjects: subjectNames,
      });
      if (suggestion) {
        setEditTaskTitle(suggestion.title);
        if (suggestion.subject) setEditTaskSubject(suggestion.subject);
        chargeAi();
        showToast('Tidied — check it reads right, then save.');
      } else {
        showToast('That title already reads well.');
      }
    } catch {
      showToast("The AI tidy-up didn't go through — mind trying once more?");
    } finally {
      setImprovingTask(false);
    }
  };

  /** Open the light edit sheet for a task row — title, subject, duration. */
  const openTaskEditor = (item: StudyItem) => {
    if (item.pending_sync) return;
    const ann = annotations.get(item.source_key || topicKey(item.subject, item.topic));
    setEditTask(item);
    setEditTaskTitle(item.topic);
    setEditTaskSubject(item.subject);
    setEditTaskMinutes(ann?.minutes ? String(ann.minutes) : '');
    setEditTaskType(ann?.type ?? (item.kind === 'revision' ? 'Revision' : 'Self Study'));
    setEditTaskDate(item.scheduled_for);
  };

  const saveTaskEdit = async () => {
    if (!editTask || savingTaskEdit) return;
    const title = (editTaskTitle ?? '').trim();
    const subject = (editTaskSubject ?? '').trim();
    if (!title || !subject) return;
    setSavingTaskEdit(true);
    const targetId = editTask.id;
    const oldKey = editTask.source_key || topicKey(editTask.subject, editTask.topic);
    const nextKey = topicKey(subject, title);
    // Renaming onto a task that already exists would leave two identical
    // pending rows — refuse instead of creating a duplicate.
    if (nextKey !== oldKey) {
      const collision = studentItems.some(
        (row) =>
          row.id !== editTask.id &&
          row.kind === 'new' &&
          row.status === 'pending' &&
          (row.source_key || topicKey(row.subject, row.topic)) === nextKey,
      );
      if (collision) {
        showToast('A task with that subject and title is already on your plan.');
        setSavingTaskEdit(false);
        return;
      }
    }
    const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(editTaskDate) ? editTaskDate : editTask.scheduled_for;
    const movedDate = nextDate !== editTask.scheduled_for;
    const rowPatch: Partial<StudyItem> = {
      subject,
      topic: title,
      source_key: nextKey,
      scheduled_for: nextDate,
      ...(editTask.kind === 'new' && movedDate
        ? { day_number: Math.max(1, day + diffDays(today, nextDate)) }
        : {}),
    };
    // OPTIMISTIC EDIT: the row updates at once. The sheet closes only after
    // the database confirms the change; failures roll back the visible patch
    // while preserving every field for retry.
    applyOptimisticPatch(targetId, rowPatch);
    try {
      const db = verifiedDbFrom(TABLES.items);
      await db.update(targetId, rowPatch as Record<string, unknown>);
      // A rename moves this topic's revision rows with it, so the spaced
      // schedule is never orphaned under the old key.
      if (nextKey !== oldKey) {
        const siblings = items.filter(
          (row) => row.kind === 'revision' && (row.source_key || topicKey(row.subject, row.topic)) === oldKey,
        );
        await Promise.all(
          siblings.map((row) => db.update(row.id, { subject, topic: title, source_key: nextKey })),
        );
      }
      const prev = annotations.get(oldKey);
      const minutes = Math.round(Number(editTaskMinutes));
      const nextType = normalizeTaskType(editTaskType);
      // The stored task_type bucket follows an explicit type change (Lecture →
      // Self Study re-buckets the revision spacing too); otherwise it and the
      // add-task extras are preserved untouched.
      const nextBucket = prev?.task_type
        ? (prev.type === nextType ? prev.task_type : taskTypeToStudyType(nextType))
        : undefined;
      await upsertMeta(taskTypeKey(nextKey), JSON.stringify({
        type: nextType,
        ai: prev?.ai ?? false,
        time: prev?.time,
        minutes: (editTaskMinutes ?? '').trim() !== '' && Number.isFinite(minutes) && minutes > 0 ? Math.min(1080, minutes) : undefined,
        // An edited title may no longer match the stored syllabus topic —
        // keep the chapter anchor (it still identifies the ground being studied).
        syl: prev?.syl,
        task_type: nextBucket,
        chapter_name: prev?.chapter_name,
        lecture_no: prev?.lecture_no,
        syllabus_topic: prev?.syllabus_topic,
        page_no: prev?.page_no,
      }));
      itemsQ.refresh();
      setEditTask(null);
      showToast(movedDate ? `Task updated — moved to ${nextDate === today ? 'today' : nextDate}.` : 'Task updated.');
    } catch (error) {
      console.error('[vicharakai] task edit failed', error);
      // Roll the visible edit back to the confirmed server state while the
      // editor stays open with every field the student entered.
      clearOptimisticPatch(targetId);
      showToast("That didn't save — your edits are still here. Mind tapping Save once more?");
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const updateCalendarTask = async (
    item: StudyItem,
    updates: { subject: string; topic: string; type: TaskType; time: string; minutes: number | null; scheduled_for: string },
  ) => {
    const oldKey = item.source_key || topicKey(item.subject, item.topic);
    const nextKey = topicKey(updates.subject, updates.topic);
    await verifiedDbFrom(TABLES.items).update(item.id, {
      subject: updates.subject,
      topic: updates.topic,
      scheduled_for: updates.scheduled_for,
      source_key: nextKey,
      day_number: item.kind === 'new' ? Math.max(1, day + diffDays(today, updates.scheduled_for)) : item.day_number ?? null,
    });
    const prev = annotations.get(oldKey);
    const calendarBucket = prev?.task_type
      ? (prev.type === updates.type ? prev.task_type : taskTypeToStudyType(updates.type))
      : undefined;
    await upsertMeta(
      taskTypeKey(nextKey),
      JSON.stringify({
        type: updates.type,
        ai: false,
        time: updates.time || undefined,
        minutes: updates.minutes ?? undefined,
        syl: prev?.syl,
        task_type: calendarBucket,
        chapter_name: prev?.chapter_name,
        lecture_no: prev?.lecture_no,
        syllabus_topic: prev?.syllabus_topic,
        page_no: prev?.page_no,
      }),
    );
    itemsQ.refresh();
    showToast('Calendar task updated.');
  };

  const submitTaskSections = async () => {
    if (addingTask || !profile) return;
    const rows = (Object.entries(taskSections) as Array<[DailySection, SectionDraft]>).flatMap(([section, draft]) =>
      draft.text
        .split(/\n+/)
        .map((text) => (text ?? '').trim())
        .filter(Boolean)
        .map((text) => ({ section, draft, text })),
    );
    if (rows.length === 0) return;

    const prepared = rows.map(({ section, draft, text }) => {
      const parsed = parseOneLiner(text, examDef);
      return {
        subject: draft.subject || parsed.subject || '',
        topic: text,
        type: section as TaskType,
      };
    });
    // Never block the whole entry: rows with a clear subject save now; the
    // rest become inline review drafts the student fixes one by one.
    const ready = prepared.filter((row) => row.subject);
    const missing = prepared.filter((row) => !row.subject);

    setAddingTask(true);
    try {
      let saveFailed = false;
      let saved = 0;
      for (const row of ready) {
        const created = await addTask(row.subject, row.topic, row.type, false);
        if (created) saved += 1;
        else if (created === null) saveFailed = true;
      }
      if (saveFailed) {
        showToast("Some tasks didn't save — your daily list is still here so you can retry.");
        return;
      }
      setTaskSections(newSectionDrafts());
      if (missing.length === 0) {
        setSheetOpen(false);
        showToast(saved > 0 ? `Added ${saved} task${saved === 1 ? '' : 's'} to today.` : 'Those tasks are already on your plan.');
      } else {
        setPlanDrafts(
          missing.map((row) => ({
            original: row.topic,
            title: row.topic,
            subject: '',
            chapter: '',
            type: row.type,
            keep: true,
            flag: { text: '', hint: "I couldn't tell the subject — pick one and this task is in." },
          })),
        );
        showToast(
          ready.length > 0
            ? `Added ${ready.length} — ${missing.length} just need${missing.length === 1 ? 's' : ''} a subject.`
            : 'Almost there — each task just needs a subject below.',
        );
      }
    } finally {
      setAddingTask(false);
    }
  };

  const submitFormTask = async (topic: string, selectedSubject = '') => {
    if (addingTask || !profile) return;
    const subject = selectedSubject || formSubject || inferSubjectForTopic(examDef, topic);
    if (!subject) {
      showToast('Pick a subject — this topic could belong to more than one.');
      return;
    }
    setAddingTask(true);
    try {
      const created = await addTask(subject, topic, formType, false);
      if (created === null) {
        showToast("That task didn't save — your entry is still here. Mind trying once more?");
        return;
      }
      setFormSearch('');
      setFormCustom('');
      setFormSubject('');
      setFormSubjectManual(false);
      setFormChapter('');
      setSheetOpen(false);
      showToast(created ? `Added: ${topic} · ${subject}` : 'That task is already on your plan.');
    } finally {
      setAddingTask(false);
    }
  };

  const submitAiTask = async () => {
    if (addingTask || !profile || !examDef) return;
    setAddingTask(true);
    try {
      const pick = pickAiTask(
        items,
        examDef,
        scoreEntries.map((e) => ({ subject: e.subject, score: e.percent })),
        flaggedRows.map((row) => row.subject),
      );
      if (!pick) {
        setAiResult('Your whole syllabus is already in the plan — nothing left for me to add. Incredible.');
        return;
      }
      const created = await addTask(pick.subject, pick.topic, 'Self Study', true);
      if (created === null) {
        showToast("That task didn't save — mind tapping once more?");
        return;
      }
      setAiResult(
        created
          ? `Added \u201C${pick.topic}\u201D (${pick.subject}) — ${pick.reason}.`
          : `\u201C${pick.topic}\u201D is already on your plan — no duplicate added.`,
      );
    } finally {
      setAddingTask(false);
    }
  };

  /* ---------- first-run backfill ---------- */

  /**
   * "What have you studied in the last two weeks?" — the optional, skippable
   * first-run question. Each line the STUDENT types becomes a completed topic
   * studied today, so spaced revision starts tomorrow. Student input only —
   * the app never seeds or guesses a syllabus.
   */
  const backfillStudiedTopics = async (text: string): Promise<number> => {
    if (!profile) return 0;
    const lines = text.split(/\n+|,/).map((line) => (line ?? '').trim()).filter(Boolean).slice(0, 12);
    if (lines.length === 0) return 0;
    const db = verifiedDbFrom(TABLES.items);
    const revisionLoadByDate = new Map<string, number>();
    for (const row of items) {
      if (row.kind !== 'revision' || row.status !== 'pending') continue;
      revisionLoadByDate.set(row.scheduled_for, (revisionLoadByDate.get(row.scheduled_for) ?? 0) + 1);
    }
    let added = 0;
    let failed = 0;
    for (const line of lines) {
      const parsed = parseOneLiner(line, examDef);
      const subject = parsed.subject || 'General';
      const topic = parsed.matchedSyllabus ? parsed.topic : line;
      const key = topicKey(subject, topic);
      const duplicate = studentItems.some(
        (item) => (item.source_key || topicKey(item.subject, item.topic)) === key,
      );
      if (duplicate) continue;
      try {
        await db.insert({
          exam: profile.exam,
          subject,
          topic,
          kind: 'new',
          day_number: day,
          scheduled_for: today,
          status: 'done',
          completed_at: getSystemTimestamp(),
          studied_on: today,
          source_key: key,
        });
        await Promise.all(
          buildRevisionDrafts({ exam: profile.exam, subject, topic }, today, new Set(), null)
            .map((draft) => ({
              ...draft,
              scheduled_for: nextOpenRevisionDay(draft.scheduled_for, revisionLoadByDate),
              is_auto_revision: true,
            }))
            .map((draft) => db.insert(draft as Record<string, unknown>)),
        );
        added += 1;
      } catch {
        failed += 1;
      }
    }
    if (added > 0) itemsQ.refresh();
    if (failed > 0) throw new Error('backfill-save-failed');
    return added;
  };

  /* ---------- feedback + study time ---------- */

  /** Write one zuno_task_feedback row — the per-topic-per-student signal
   * every prompt funnels through (4-value ratings and legacy feelings share
   * the same column; the newest row per topic is the one that is read back). */
  const writeFeedbackRow = async (item: StudyItem, value: TaskFeeling | TopicRating) => {
    const key = item.source_key || topicKey(item.subject, item.topic);
    await verifiedDbFrom(TABLES.taskFeedback).insert({
      item_id: item.id,
      source_key: key,
      subject: item.subject,
      topic: item.topic,
      feeling: value,
      created_on: today,
    });
  };

  /** Post-task Hard/Medium/Easy on a STUDY task — a prioritisation signal
   * only (dailyFormula ordering, weakest-first queues, 'felt hard' badges).
   * It does NOT rewrite revision dates: every topic follows the one
   * 1→3→7→14→28 ladder, and only the post-REVISION rating chips move a
   * topic along it (rateRevision). */
  const submitTaskFeedback = async (item: StudyItem, feeling: TaskFeeling) => {
    await writeFeedbackRow(item, feeling);
    feedbackQ.refresh();
  };

  /**
   * Schedule the ONE next revision for a topic whose revision was just
   * completed — the rolling half of the spaced-repetition model. Any other
   * pending revision rows for the topic (older pre-materialised rungs) are
   * replaced by the single next row, so the ladder can never double up, and
   * the due date respects the daily revision budget (nextOpenRevisionDay).
   */
  const scheduleNextRevision = async (item: StudyItem, rating: TopicRating) => {
    const key = item.source_key || topicKey(item.subject, item.topic);
    const db = verifiedDbFrom(TABLES.items);
    const step = nextTopicRevisionStep(item.interval_days ?? null, rating, today);
    const leftovers = studentItems.filter(
      (row) =>
        row.kind === 'revision' &&
        row.status === 'pending' &&
        row.id !== item.id &&
        !row.pending_sync &&
        (row.source_key || topicKey(row.subject, row.topic)) === key,
    );
    await Promise.all(leftovers.map((row) => db.delete(row.id)));
    const dropped = new Set(leftovers.map((row) => row.id));
    const revisionLoadByDate = new Map<string, number>();
    for (const row of studentItems) {
      if (row.kind !== 'revision' || row.status !== 'pending') continue;
      if (dropped.has(row.id) || row.id === item.id) continue;
      revisionLoadByDate.set(row.scheduled_for, (revisionLoadByDate.get(row.scheduled_for) ?? 0) + 1);
    }
    const dueOn = nextOpenRevisionDay(step.dueOn, revisionLoadByDate);
    await db.insert({
      exam: item.exam,
      subject: item.subject,
      topic: item.topic,
      kind: 'revision',
      scheduled_for: dueOn,
      status: 'pending',
      studied_on: item.studied_on ?? today,
      interval_days: step.stepDays,
      source_key: key,
      category: item.category ?? null,
      is_auto_revision: true,
    });
    itemsQ.refresh();
    return { ...step, dueOn };
  };

  const ratingToast = (rating: TopicRating, dueInDays: number) => {
    const when = dueInDays === 1 ? 'tomorrow' : `in ${dueInDays} days`;
    if (rating === 'again') return `No stress — it comes back ${when} for a rebuild.`;
    if (rating === 'hard') return `Noted — back ${when}, right on rhythm.`;
    if (rating === 'good') return `Good — back ${when}, a day early so it sticks.`;
    return `Owned it — next revisit ${when}.`;
  };

  /** A tapped rating chip on a completed revision: store the rating, roll the
   * topic one ladder step, close the sheet — and NOTHING else follows (no
   * duration sheet, no extra exercise, no second prompt). */
  const rateRevision = async (item: StudyItem, rating: TopicRating) => {
    if (savingRating) return;
    setSavingRating(true);
    try {
      await writeFeedbackRow(item, rating);
      const step = await scheduleNextRevision(item, rating);
      feedbackQ.refresh();
      setRevisionRatingPrompt((current) => (current?.id === item.id ? null : current));
      showToast(ratingToast(rating, step.dueInDays));
    } catch {
      showToast("That rating didn't save — mind tapping it once more?");
    } finally {
      setSavingRating(false);
    }
  };

  /** Dismissing the sheet — offered only once a previous rating exists. No
   * rating is stored, but the chain never breaks: the standard next step is
   * scheduled exactly as a Hard answer would schedule it. */
  const skipRevisionRating = async (item: StudyItem) => {
    if (savingRating) return;
    setSavingRating(true);
    try {
      const step = await scheduleNextRevision(item, 'hard');
      setRevisionRatingPrompt(null);
      showToast(`Next revisit in ${step.dueInDays} day${step.dueInDays === 1 ? '' : 's'}.`);
    } catch {
      setRevisionRatingPrompt(null);
    } finally {
      setSavingRating(false);
    }
  };

  const feelingToast = (feeling: TaskFeeling) =>
    feeling === 'hard'
      ? 'Noted — flagged as tricky; it gets priority when revisions queue up.'
      : feeling === 'easy'
        ? 'Got it — logged as a strength.'
        : 'Saved — revision follows the 1·3·7·14·28 rhythm.';

  const saveFeeling = async (feeling: TaskFeeling) => {
    if (!feedbackPrompt || savingFeeling) return;
    const item = feedbackPrompt;
    setSavingFeeling(true);
    try {
      await submitTaskFeedback(item, feeling);
      setFeedbackPrompt(null);
      promptForDuration(item);
      showToast(feelingToast(feeling));
    } catch {
      showToast("That signal didn't save — mind tapping it once more?");
    } finally {
      setSavingFeeling(false);
    }
  };

  /**
   * "No Revision" on the completion prompt: delete the topic's pending
   * revision rows so nothing is kept on the spaced ladder. The completed
   * task row itself is untouched.
   */
  const declineRevision = async () => {
    if (!feedbackPrompt || savingFeeling) return;
    const item = feedbackPrompt;
    setSavingFeeling(true);
    try {
      const key = item.source_key || topicKey(item.subject, item.topic);
      const pendingRevs = studentItems.filter(
        (row) => row.kind === 'revision' && row.status === 'pending' && row.source_key === key,
      );
      await Promise.all(pendingRevs.map((row) => verifiedDbFrom(TABLES.items).delete(row.id)));
      itemsQ.refresh();
      setFeedbackPrompt(null);
      promptForDuration(item);
      showToast('No revision kept for this one — it stays done and gone.');
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setSavingFeeling(false);
    }
  };

  /**
   * The on-card answer (Today's inline chips). Same write path as the sheet —
   * submitTaskFeedback for a difficulty, or dropping the topic's pending
   * revision rows for 'none' — but it does NOT open the duration sheet
   * afterwards, so answering is a single tap with nothing to dismiss.
   */
  const answerFeelingInline = async (item: StudyItem, feeling: TaskFeeling | 'none') => {
    if (feeling !== 'none' && item.kind === 'revision') {
      // A revision's inline answer IS a rating — the same path as the sheet's
      // chips (store the rating, roll the ladder one step, nothing after).
      await rateRevision(item, feeling === 'medium' ? 'good' : feeling);
      return;
    }
    if (savingFeeling) return;
    setSavingFeeling(true);
    try {
      if (feeling === 'none') {
        const key = item.source_key || topicKey(item.subject, item.topic);
        const pendingRevs = studentItems.filter(
          (row) => row.kind === 'revision' && row.status === 'pending' && row.source_key === key,
        );
        await Promise.all(pendingRevs.map((row) => verifiedDbFrom(TABLES.items).delete(row.id)));
        itemsQ.refresh();
        showToast('No revision kept for this one — it stays done and gone.');
      } else {
        await submitTaskFeedback(item, feeling);
        showToast(feelingToast(feeling));
      }
      if (feedbackPrompt?.id === item.id) setFeedbackPrompt(null);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setSavingFeeling(false);
    }
  };

  /** Close the completion prompt without a difficulty signal — the default
   * ladder from completion stays on; the duration sheet still follows. */
  const skipFeedback = () => {
    if (!feedbackPrompt) return;
    const item = feedbackPrompt;
    setFeedbackPrompt(null);
    promptForDuration(item);
  };

  /** Implicit grade from silent timers (Blank Recall) — the timing decides
   * the answer, no buttons. For a REVISION it acts exactly like a tapped
   * rating chip (stores the rating, rolls the ladder one step); for a study
   * task it stays a prioritisation signal. */
  const applyImplicitFeeling = async (item: StudyItem, feeling: TaskFeeling) => {
    try {
      if (item.kind === 'revision') {
        const rating: TopicRating = feeling === 'easy' ? 'easy' : feeling === 'hard' ? 'hard' : 'good';
        await writeFeedbackRow(item, rating);
        await scheduleNextRevision(item, rating);
        feedbackQ.refresh();
      } else {
        await submitTaskFeedback(item, feeling);
      }
    } catch {
      /* silent — the completion itself already saved */
    }
  };

  /** Hard/Medium/Easy from the Tools panel — the SAME signal, same engine. */
  const markToolsDifficulty = async (feeling: TaskFeeling) => {
    const item = studentItems.find((i) => i.status === 'pending' && startedIds.has(i.id)) ?? missionQueue[0];
    if (!item || savingToolsFeeling) return;
    setSavingToolsFeeling(true);
    try {
      await submitTaskFeedback(item, feeling);
      showToast(feelingToast(feeling));
    } catch {
      showToast("That signal didn't save — mind tapping it once more?");
    } finally {
      setSavingToolsFeeling(false);
    }
  };

  /**
   * The moment something is checked off, ask for the one number VicharakAI
   * can't infer. The task is already saved by then, so this never blocks the
   * completion.
   */
  const promptForDuration = (item: StudyItem) => {
    setDurationPrompt({
      itemId: item.id,
      sourceKey: item.source_key || topicKey(item.subject, item.topic),
      subject: item.subject,
      topic: item.topic,
      note: completionQuote(),
      prefillMinutes: null,
    });
  };

  /** The study-time chip: a log that stands on its own. */
  const promptForStudyTime = () => {
    setDurationPrompt({
      itemId: null,
      sourceKey: null,
      subject: null,
      topic: null,
      note: null,
      prefillMinutes: null,
    });
  };

  const saveDuration = async (minutes: number, fromTimer: boolean) => {
    if (!durationPrompt || savingDuration) return;
    setSavingDuration(true);
    try {
      await verifiedDbFrom(TABLES.sessions).insert({
        item_id: durationPrompt.itemId,
        source_key: durationPrompt.sourceKey,
        subject: durationPrompt.subject,
        topic: durationPrompt.topic,
        minutes,
        logged_on: today,
        entry_mode: fromTimer ? 'timer' : 'manual',
      });
      sessionsQ.refresh();
      setDurationPrompt(null);
      showToast(`${formatDuration(minutes)} logged — ${formatDuration(todayMinutes + minutes)} studied today.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setSavingDuration(false);
    }
  };

  /** Focus mode: the session logs itself. */
  const logFocusSession = async (minutes: number) => {
    const focusItem = missionQueue[0] ?? null;
    try {
      await verifiedDbFrom(TABLES.sessions).insert({
        item_id: focusItem?.id ?? null,
        source_key: focusItem ? focusItem.source_key || topicKey(focusItem.subject, focusItem.topic) : null,
        subject: focusItem?.subject ?? null,
        topic: focusItem?.topic ?? null,
        minutes,
        logged_on: today,
        entry_mode: 'timer',
      });
      sessionsQ.refresh();
    } catch {
      showToast("That focus session didn't log — add it via 'Log study time'.");
    }
  };

  return {
    busyIds,
    setBusy,
    startedIds,
    markStarted,
    clearStarted,
    completingIds,
    addTask,
    handleToggle,
    completeWithAnimation,
    renameTask,
    applyImplicitFeeling,
    pinHero,
    togglePriority,
    removeRevision,
    switchToTypedExam,
    updateCalendarTask,
    carryoverPromptOpen,
    carryoverBusy,
    dismissCarryoverPrompt,
    decideCarryover,
    deleteCarriedTask,
    deleteTask,
    addTaskOpen,
    setAddTaskOpen,
    syllabusPickerOpen,
    setSyllabusPickerOpen,
    addTopicsToToday,
    backfillStudiedTopics,
    savingNewTask,
    handleAddTaskSave,
    sheetOpen,
    setSheetOpen,
    sheetMode,
    setSheetMode,
    openTaskSheet,
    taskSections,
    setTaskSections,
    ambientDismissed,
    setAmbientDismissed,
    formType,
    setFormType,
    formSubject,
    setFormSubject,
    formSubjectManual,
    setFormSubjectManual,
    formChapter,
    setFormChapter,
    formSearch,
    setFormSearch,
    formCustom,
    setFormCustom,
    addingTask,
    aiResult,
    setAiResult,
    quickTitle,
    setQuickTitle,
    quickSubject,
    setQuickSubject,
    quickCategory,
    setQuickCategory,
    topicPickerFor,
    setTopicPickerFor,
    quickAddTask,
    submitQuickTitle,
    submitTaskSections,
    submitFormTask,
    submitAiTask,
    planDrafts,
    setPlanDrafts,
    parsingPlan,
    savingPlan,
    parsePlanText,
    confirmPlanDrafts,
    editTask,
    setEditTask,
    editTaskTitle,
    setEditTaskTitle,
    editTaskSubject,
    setEditTaskSubject,
    editTaskMinutes,
    setEditTaskMinutes,
    editTaskType,
    setEditTaskType,
    editTaskDate,
    setEditTaskDate,
    savingTaskEdit,
    improvingTask,
    openTaskEditor,
    saveTaskEdit,
    improveEditedTask,
    feedbackPrompt,
    answerFeelingInline,
    setFeedbackPrompt,
    declineRevision,
    skipFeedback,
    savingFeeling,
    saveFeeling,
    revisionRatingPrompt,
    setRevisionRatingPrompt,
    savingRating,
    rateRevision,
    skipRevisionRating,
    savingToolsFeeling,
    markToolsDifficulty,
    durationPrompt,
    setDurationPrompt,
    savingDuration,
    promptForDuration,
    promptForStudyTime,
    saveDuration,
    logFocusSession,
    focusOpen,
    setFocusOpen,
    examSwitchOpen,
    setExamSwitchOpen,
    changingExam,
    setChangingExam,
  };
}
