/**
 * StudentDataContext — the ONE place the student's state is loaded and
 * assembled (Phase 7: single source of truth; Phase 8: screens never touch
 * the database directly).
 *
 * Owns:
 *  - every WorkspaceDB read, through useAllRows (complete datasets — no
 *    silent 500-row truncation; see services/database/dbClient.ts);
 *  - the verified-session gate + the re-auth gate;
 *  - profile/exam resolution (catalogue, typed/custom, pending onboarding);
 *  - the core derived entities every feature consumes: studentItems,
 *    annotations, meta, score entries, revision queues, mission queue,
 *    weekly stats, mastery/readiness derivations, pace;
 *  - the data-layer self-heal effects (missing revision rows, missing
 *    annotations) and the deterministic exam-proximity / post-test
 *    re-surface passes.
 *
 * Business ACTIONS live in the feature hooks (features/*) — this provider
 * only loads, derives and repairs data.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSpaceRuntime } from '../../../SpaceRuntimeContext';
import { DOUBTS_DAILY_CAP, REVISION_ITEM_MINUTES } from '../config/revision';
import {
  addDaysISO,
  backlogSizeOf,
  buildAnnotationMap,
  buildDaySchedule,
  buildRevisionDrafts,
  computePace,
  dailyFormula,
  dayNumber,
  diffDays,
  dueRevisions as dueRevisionsOf,
  feedbackValueToFeeling,
  feedbackValueToRatingLabel,
  localDayOf,
  mergeScoreEntries,
  minutesOnDate,
  overdueRevisions as overdueRevisionsOf,
  parseOneLiner,
  prioritizeDueRevisions,
  studyTaskTypeOf,
  taskTypeKey,
  todayISO,
  topicKey,
  type MetaRow,
  type PaceSignal,
  type ScoreEntry,
  type StudyItem,
  type StudyItemDraft,
  type StudySession,
  type TaskAnnotation,
  type TaskFeeling,
  type TestMistake,
  type TestResult,
  type TestScore,
  type DayScheduleSlot,
  type FormulaItem,
  type HoursSnapshot,
} from '../engine';
import { buildHoursSnapshot, buildMetaMap, buildSubjectProgress, buildSubjectScores, buildWeakAreas, computeStreak, type SubjectProgress, type SubjectScore } from '../analytics';
import { defaultExamDate, type ExamDef } from '../syllabus';
import { CUSTOM_EXAM_META_KEY, EXAM_LABEL_META_KEY, parseCustomExam, resolveExamDef } from '../customExam';
import type { ExamSyllabus } from '../data/syllabuses';
import {
  getCatalogSyllabus,
  syllabusForProfileFromCatalog,
  useSyllabusCatalog,
} from '../data/syllabusRuntime';
import {
  resolveExamMetadata,
  useExamMetadataCatalog,
  type ExamMetadataRow,
} from '../data/examMetadata';
import {
  getReadinessScore,
  getWeakTopics,
  type ExamProgressRow,
  type ReadinessRow,
  type ReadinessScore,
  type TopicAttemptRow,
  type WeakTopicInsight,
  type WeakTopicRow,
} from '../adaptationEngine';
import { CHAT_EXAM_META_KEY } from '../ExamChatSupport';
import { buildChapterIndex, getPriorityScore, weeklyMockNudge } from '../studyEngine';
import { nextOpenRevisionDay } from '../revisionEngine';
import {
  flaggedDueOn,
  flaggedHasSolution,
  type AttachmentRow,
  type ExamQuestionBankRow,
  type FlaggedRow,
  type McqQuestion,
  type TestResultRow,
  type WeeklyTargetRow,
} from '../mcq';
import type { TopicPickerSubject } from '../TopicPicker';
import type { TestTopicOption } from '../TestMode';
import type { ChapterStat, FocusChapter } from '../WeeklyTargetsScreen';
import { weekStartISO } from '../WeeklyGoals';
import {
  isDbWriteReady,
  isSessionVerificationError,
  onSessionVerified,
  SESSION_UNVERIFIED_EVENT,
  verifiedDbFrom,
} from '../sessionGuard';
import { TABLES } from '../services/database/tables';
import { useAllRows, type AllRowsResult } from '../services/database/dbClient';
import { useAccountSessionIds } from '../services/database/accountScope';
import { flushOutbox, installOutboxAutoFlush, OUTBOX_FLUSHED_EVENT } from '../services/database/writeOutbox';
import { upsertMetaKey } from '../services/database/metaRepository';
import { deriveStudentName, readSessionEmail } from '../shared/sessionUtils';
import { type TaskFeedbackRow } from '../features/tasks/taskTypes';
import {
  buildCarriedPending,
  buildChecklistPending,
  buildFilterSubjects,
  buildMainPending,
  buildMissionQueue,
  buildQuickAddSubjects,
  buildRelatedCarryover,
} from '../features/tasks/taskSelectors';
import {
  buildAiFocusChips,
  buildChapterStats,
  buildTestTopicOptions,
  countWeeklyTestsDone,
  countWeeklyTopicsDone,
  findWeekRow,
  parseFocusChapters,
} from '../features/tests/testSelectors';
import { computeStudyMetrics, type StudyMetrics } from '../features/metrics/metrics';
import type { RecommendationLogRow } from '../features/plan/planTypes';
import {
  readPendingOnboarding,
  type PendingOnboarding,
} from '../features/onboarding/onboardingStorage';

/** One row of zuno_profile — the student's exam pick + plan start date. */
export interface StudentProfile {
  id: number;
  exam: string;
  start_date: string;
  sleep_schedule?: string | null;
  study_hours?: string | null;
  subject_confidence?: string | null;
  coach_notes?: string | null;
  /** Durable cross-session identity — lets a new login recover this profile
   * instead of re-running onboarding (features/onboarding/profileRecovery). */
  user_email?: string | null;
  /** Durable WorkspaceDB completion flag. Only completed profile rows may
   * satisfy AppShell's onboarding gate. */
  onboarding_complete: boolean;
}

/**
 * Builds before this date bulk-preloaded syllabus rows without annotations —
 * those stay hidden. Anything created on/after it is a real student task and
 * must always be visible, even when its annotation write failed.
 */
export const PRELOAD_ERA_END = '2026-08-09';

/**
 * How long an optimistic task draft may stay on screen without the database
 * confirming it. Failed inserts are queued in the durable write outbox and
 * retried automatically, so the window is generous — the draft usually gets
 * replaced by the real row; past this a still-unconfirmed draft retires (the
 * outbox keeps retrying in the background and re-surfaces the row on flush).
 */
const OPTIMISTIC_TTL_MS = 90_000;

export interface StudentData {
  /* runtime */
  spaceId: string;
  sessionMetadata: Record<string, unknown>;
  setSessionId: (id: string | null) => void;
  today: string;
  dbSessionReady: boolean;
  /** True only after the signed-in account scope and its cross-session meta rows have merged. */
  accountDataReady: boolean;
  authGateNeeded: boolean;
  setAuthGateNeeded: (on: boolean) => void;
  planSessionError: boolean;

  /* raw queries (loading flags + refresh) */
  profileQ: AllRowsResult<StudentProfile>;
  itemsQ: AllRowsResult<StudyItem>;
  metaQ: AllRowsResult<MetaRow>;
  scoresQ: AllRowsResult<TestScore>;
  resultsQ: AllRowsResult<TestResult>;
  mistakesQ: AllRowsResult<TestMistake>;
  sessionsQ: AllRowsResult<StudySession>;
  feedbackQ: AllRowsResult<TaskFeedbackRow>;
  mcqQ: AllRowsResult<McqQuestion>;
  examQuestionsQ: AllRowsResult<ExamQuestionBankRow>;
  testResultsQ: AllRowsResult<TestResultRow>;
  weeklyQ: AllRowsResult<WeeklyTargetRow>;
  attachmentsQ: AllRowsResult<AttachmentRow>;
  flaggedQ: AllRowsResult<FlaggedRow>;
  examProgressQ: AllRowsResult<ExamProgressRow>;
  topicAttemptsQ: AllRowsResult<TopicAttemptRow>;
  weakTopicsQ: AllRowsResult<WeakTopicRow>;
  readinessQ: AllRowsResult<ReadinessRow>;
  recommendationLogQ: {
    data: RecommendationLogRow[];
    loading: boolean;
    error: Error | null;
    total: number;
    refresh: () => void;
  };

  /* entities */
  profile: StudentProfile | undefined;
  dbProfile: StudentProfile | undefined;
  items: StudyItem[];
  studentItems: StudyItem[];
  mistakes: TestMistake[];
  sessions: StudySession[];
  scoreEntries: ScoreEntry[];
  day: number;
  metaMap: Map<string, MetaRow>;
  annotations: Map<string, TaskAnnotation>;
  taskDetails: Record<string, TaskAnnotation>;
  feelingByKey: Map<string, TaskFeeling>;
  /** Newest stored rating per topic, as its display label — “Last time you
   * rated this Hard — how do you feel now?” (legacy 'medium' reads Good). */
  lastRatingLabelByKey: Map<string, 'Again' | 'Hard' | 'Good' | 'Easy'>;
  streak: number;
  studentName: string | null;
  savedName: string | null;

  /* exam */
  examDef: ExamDef | undefined;
  /**
   * The shared exam_metadata row for this student's exam (format, timing,
   * scoring) — null for an exam the table does not cover, e.g. the Indian
   * exams and typed custom exams.
   */
  examMetadata: ExamMetadataRow | null;
  /** True when exam_syllabi holds synchronized official rows for this exam. */
  examSyllabusSynced: boolean;
  savedExamLabel: string;
  storedCustomExam: string | null;
  examDate: string;
  examDateSet: boolean;
  goals: string;
  dailyGoal: string;
  weeklyGoal: string;
  daysToExam: number;
  examPickerVisible: boolean;

  /* onboarding bootstrap shared with the data layer */
  pendingOnboarding: PendingOnboarding | null;
  setPendingOnboarding: (pending: PendingOnboarding | null) => void;
  onboardingExamDraft: ExamDef | null;
  setOnboardingExamDraft: (exam: ExamDef | null) => void;

  /* revision + task queues */
  dueRevisionsAll: StudyItem[];
  dueRevisions: StudyItem[];
  queuedRevisionCount: number;
  overdueRevisions: StudyItem[];
  todayTargets: StudyItem[];
  carryOver: StudyItem[];
  doneToday: StudyItem[];
  completedByDate: Map<string, StudyItem[]>;
  doneTopicKeys: Set<string>;
  formula: FormulaItem[];
  daySchedule: DayScheduleSlot[];

  /* day-plan state shared across features */
  heroId: number | null;
  pinHeroId: (id: number | null) => void;
  carriedIds: Set<number>;
  setCarriedIdsPersist: (ids: Set<number>) => void;
  carryoverDecision: string | null;
  rememberCarryoverDecision: (decision: string) => void;
  missionQueue: StudyItem[];
  relatedCarryover: StudyItem[];
  checklistPending: StudyItem[];
  carriedPending: StudyItem[];
  mainPending: StudyItem[];
  quickAddSubjects: string[];
  filterSubjects: string[];

  /* attachments / questions */
  mcqBank: McqQuestion[];
  /** Shared, server-written reference questions; this app is read-only. */
  examQuestionsBank: ExamQuestionBankRow[];
  testResults: TestResultRow[];
  attachmentsBySourceKey: Map<string, string[]>;
  questionAttachments: Map<string, string[]>;
  flaggedRows: FlaggedRow[];
  dueFlagged: FlaggedRow[];
  /** Legacy entries with neither a student answer nor the new AI-draft flow. */
  resolveQueue: FlaggedRow[];

  /** THE one metrics snapshot every screen reads (features/metrics) — no
   * screen computes its own count. */
  metrics: StudyMetrics;

  /* weekly + monthly */
  weekStart: string;
  weekDays: string[];
  /** Current month key (YYYY-MM) — the monthly-focus meta rows key off it. */
  monthKey: string;
  /** Chapters picked as this month's focus (zuno_meta `monthly_targets|YYYY-MM`). */
  monthlyChapters: FocusChapter[];
  weeklyRow: WeeklyTargetRow | null;
  lastWeekRow: WeeklyTargetRow | null;
  weeklyTopicsDone: number;
  weeklyTestsDone: number;
  focusChapters: FocusChapter[];
  focusReason: string | null;
  chapterStats: Map<string, ChapterStat>;
  aiFocusChips: string[];
  testTopicOptions: TestTopicOption[];
  mockNudgeLine: string | null;

  /* mastery derivations (adaptation engine reads) */
  progressRows: ExamProgressRow[];
  weakTopicRows: WeakTopicRow[];
  attemptRows: TopicAttemptRow[];
  chatExamPref: string | null;
  activeSyllabusExam: ExamSyllabus | undefined;
  readiness: ReadinessScore | null;
  weakTopicInsights: WeakTopicInsight[];
  topicPickerSubjects: TopicPickerSubject[];
  topicPickerExamLabel: string;

  /* dashboard-prepared data */
  subjectProgress: SubjectProgress[];
  subjectScores: SubjectScore[];
  weakAreas: Array<{ label: string; detail: string }>;
  leastCoveredSubject: string | null;

  /* time */
  todayMinutes: number;
  hoursSnapshot: HoursSnapshot;
  pace: PaceSignal;
  capacityOverrideMinutes: number | null;

  /** Insert-or-update one zuno_meta key (serialized, duplicate-safe) and
   * refresh the reactive meta query. The ONE metadata write path. */
  upsertMeta: (key: string, value: string) => Promise<void>;

  /**
   * OPTIMISTIC INSERT — show a task the student just typed on Today before the
   * database has confirmed it. The draft is merged into `items` immediately
   * (so every derived queue sees it this render) and disappears on its own the
   * moment the real row arrives from the refreshed query. Returns the draft's
   * temporary negative id; pass it to `dropOptimisticItem` to roll back when
   * the write fails.
   */
  addOptimisticItem: (draft: Omit<StudyItem, 'id'>) => number;
  /** Remove one optimistic draft — the rollback half of the pair. */
  dropOptimisticItem: (tempId: number) => void;
  /**
   * OPTIMISTIC EDIT — patch an EXISTING task row on screen before the database
   * has confirmed the update. The patch is merged over the real row in `items`
   * immediately (so every derived queue reflects it this render) and clears
   * itself once the refreshed query shows the same values. Pair it with
   * `clearOptimisticPatch` to roll the edit back when the write fails.
   */
  applyOptimisticPatch: (id: number, patch: Partial<StudyItem>) => void;
  /** Drop one optimistic edit patch — the rollback half of the pair. */
  clearOptimisticPatch: (id: number) => void;
}

export const STUDENT_DATA_WRITE_FAILED_EVENT = 'vicharak:data-write-failed';

function reportStudentDataWriteFailure(message: string, error: unknown): void {
  console.warn('[vicharakai] durable student-data write failed', error);
  try {
    window.dispatchEvent(new CustomEvent(STUDENT_DATA_WRITE_FAILED_EVENT, { detail: { message } }));
  } catch {
    /* the warning above remains available when CustomEvent is unavailable */
  }
}

const StudentDataContext = createContext<StudentData | null>(null);

export function useStudentData(): StudentData {
  const value = useContext(StudentDataContext);
  if (!value) throw new Error('useStudentData must be used inside StudentDataProvider');
  return value;
}

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { spaceId, sessionMetadata, setSessionId } = useSpaceRuntime();
  const { exams: syllabusCatalog, syncedExamIds } = useSyllabusCatalog();
  const examMetadataCatalog = useExamMetadataCatalog();
  const today = todayISO();

  /* ---------- reads (complete datasets — see dbClient.useAllRows) ---------- */

  /* Session ids PROVEN to belong to the signed-in account (via email-stamped
   * profile rows and the trial record) — merged into every per-student read
   * below, so study data follows the LOGIN, not the browser session. Empty
   * for guests, which keeps reads exactly as before. The profile query is
   * account-scoped too (2026-09-29 duplicate-profile fix): the signed-in
   * email is the single source of truth, so every device reads the SAME
   * newest profile row instead of a per-session copy that could drift —
   * recovery (features/onboarding/profileRecovery) now ADOPTS that row via
   * the account-row-update hook rather than inserting a duplicate. */
  const accountSessionIds = useAccountSessionIds(spaceId);
  const accountEmail = (readSessionEmail(spaceId) || '').trim().toLowerCase();

  const profileQ = useAllRows<StudentProfile>(TABLES.profile, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const itemsQ = useAllRows<StudyItem>(TABLES.items, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const metaQ = useAllRows<MetaRow>(TABLES.meta, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const scoresQ = useAllRows<TestScore>(TABLES.legacyScores, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const resultsQ = useAllRows<TestResult>(TABLES.testScores, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const mistakesQ = useAllRows<TestMistake>(TABLES.mistakes, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const sessionsQ = useAllRows<StudySession>(TABLES.sessions, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const feedbackQ = useAllRows<TaskFeedbackRow>(TABLES.taskFeedback, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const mcqQ = useAllRows<McqQuestion>(TABLES.mcqQuestions, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const examQuestionsQ = useAllRows<ExamQuestionBankRow>(TABLES.examQuestionsBank, {
    shared: true,
    orderBy: { column: 'id', direction: 'asc' },
  });
  const testResultsQ = useAllRows<TestResultRow>(TABLES.testResults, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const weeklyQ = useAllRows<WeeklyTargetRow>(TABLES.weeklyTargets, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const attachmentsQ = useAllRows<AttachmentRow>(TABLES.attachments, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const flaggedQ = useAllRows<FlaggedRow>(TABLES.questionQueue, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  /* Adaptation engine tables — mastery, attempts, weak topics, readiness. */
  const examProgressQ = useAllRows<ExamProgressRow>(TABLES.examProgress, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const topicAttemptsQ = useAllRows<TopicAttemptRow>(TABLES.topicAttempts, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const weakTopicsQ = useAllRows<WeakTopicRow>(TABLES.weakTopics, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const readinessQ = useAllRows<ReadinessRow>(TABLES.readiness, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  /* Explainability log — deliberately only the newest slice: it feeds the
   * "why this plan?" panel, which reads recent entries, never the archive. */
  const recommendationLogQ = window.useWorkspaceDB<RecommendationLogRow>(TABLES.recommendationLog, {
    limit: 30,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const accountDataReady =
    !accountEmail ||
    (accountSessionIds.length > 0 && !profileQ.loading && !metaQ.loading && !profileQ.error && !metaQ.error);

  /* ---------- durable write outbox (failed saves retry themselves) ---------- */

  const outboxRefreshRef = useRef<() => void>(() => undefined);
  outboxRefreshRef.current = () => {
    itemsQ.refresh();
    metaQ.refresh();
  };
  useEffect(() => {
    installOutboxAutoFlush();
    void flushOutbox();
    const onFlushed = () => outboxRefreshRef.current();
    window.addEventListener(OUTBOX_FLUSHED_EVENT, onFlushed);
    return () => window.removeEventListener(OUTBOX_FLUSHED_EVENT, onFlushed);
  }, []);

  /* ---------- verified-session gate ---------- */

  /* WRITE-READY, not server-confirmed. This flag gates every self-heal and
   * sync pass in this file (the annotation backfill, the revision self-heal,
   * the weekly-target rollup, last_open, and the onboarding sync in
   * features/onboarding). It used to read isDbSessionVerified(), which stays
   * false for real logins the OTP auth record does not vouch for — so for
   * those students every one of those passes was dead code, and a brand-new
   * student's onboarding never left localStorage. */
  const [dbSessionReady, setDbSessionReady] = useState(() => isDbWriteReady());
  useEffect(() => {
    if (dbSessionReady) return undefined;
    if (isDbWriteReady()) {
      setDbSessionReady(true);
      return undefined;
    }
    const unsubscribe = onSessionVerified(() => {
      if (isDbWriteReady()) setDbSessionReady(true);
    });
    const intervalId = window.setInterval(() => {
      if (isDbWriteReady()) setDbSessionReady(true);
    }, 300);
    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [dbSessionReady]);

  /* Session re-auth gate: a session the platform refuses (pending OTP,
   * expired) routes the student back to sign-in instead of a raw error. */
  const [authGateNeeded, setAuthGateNeeded] = useState(false);
  const planSessionError =
    isSessionVerificationError(profileQ.error) || isSessionVerificationError(itemsQ.error);
  useEffect(() => {
    const handler = () => setAuthGateNeeded(true);
    window.addEventListener(SESSION_UNVERIFIED_EVENT, handler);
    return () => window.removeEventListener(SESSION_UNVERIFIED_EVENT, handler);
  }, []);
  /* Self-heal: the moment the verified session lands, drop the gate and
   * reload the plan queries that failed — at most one retry per visit. */
  const authRetryRef = useRef(false);
  useEffect(() => {
    if (!dbSessionReady) {
      authRetryRef.current = false;
      return;
    }
    if ((!authGateNeeded && !planSessionError) || authRetryRef.current) return;
    authRetryRef.current = true;
    setAuthGateNeeded(false);
    profileQ.refresh();
    itemsQ.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, authGateNeeded, planSessionError]);

  /* ---------- onboarding bootstrap shared with the data layer ---------- */

  const [pendingOnboarding, setPendingOnboarding] = useState<PendingOnboarding | null>(() =>
    readPendingOnboarding(spaceId, accountEmail),
  );
  const [onboardingExamDraft, setOnboardingExamDraft] = useState<ExamDef | null>(null);
  useEffect(() => {
    if (pendingOnboarding || !accountEmail) return;
    const stored = readPendingOnboarding(spaceId, accountEmail);
    if (stored) setPendingOnboarding(stored);
  }, [accountEmail, pendingOnboarding, spaceId]);

  /* ---------- entities ---------- */

  /* ONE exam per student. zuno_profile should hold a single row per session,
   * but historical bugs (an onboarding re-run, a recovery race) could leave
   * several — and the app used to read the OLDEST one, so a student's newer
   * exam pick silently lost to a stale row. The NEWEST row (the most recent
   * choice) wins, and the self-heal below deletes the stale ones. */
  const profileRows = profileQ.data ?? [];
  /* WorkspaceDB is authoritative: an existing row only skips onboarding when
   * its durable completion flag is true. Legacy rows received true when the
   * column was added because profile creation was already the completion
   * marker. */
  const completedProfileRows = profileRows.filter((row) => row.onboarding_complete === true);
  const dbProfile =
    completedProfileRows.length > 0 ? completedProfileRows[completedProfileRows.length - 1] : undefined;
  /* While a pending Day-1 plan waits for the verified session, a local profile
   * stands in so the student proceeds straight into the app — no frozen screen. */
  const profile: StudentProfile | undefined =
    dbProfile ??
    (pendingOnboarding
      ? {
          id: -1,
          exam: pendingOnboarding.examId ?? 'general',
          start_date: pendingOnboarding.start,
          onboarding_complete: true,
        }
      : undefined);

  /* Self-heal: a student who somehow accumulated MULTIPLE profile rows keeps
   * only the newest (their latest exam selection); the older duplicates are
   * deleted once per visit so every surface agrees on ONE active exam. The
   * profile read is account-scoped now, so this also merges duplicates left
   * behind by old logins on other devices — a delete on a row another session
   * owns falls back to the account-row-update hook (same-email verified).
   * Each delete is tried independently: one refused row must not keep the
   * rest of the duplicates alive. */
  const profileDedupeRef = useRef(false);
  useEffect(() => {
    if (profileDedupeRef.current || !dbSessionReady || profileQ.loading) return;
    const rows = profileQ.data ?? [];
    if (rows.length <= 1) return;
    profileDedupeRef.current = true;
    const keeperId = rows[rows.length - 1].id;
    void (async () => {
      const db = verifiedDbFrom(TABLES.profile);
      let deleted = 0;
      for (const row of rows) {
        if (row.id === keeperId || typeof row.id !== 'number' || row.id <= 0) continue;
        try {
          await db.delete(row.id);
          deleted += 1;
        } catch {
          /* a refused delete keeps its row — the next visit tries again */
        }
      }
      if (deleted > 0) profileQ.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, profileQ.loading, profileQ.data]);
  /* ---------- optimistic inserts (instant task add) ----------
   * A task the student just submitted is merged into `items` synchronously so
   * the card is on screen before the insert round-trip finishes. Drafts carry
   * a negative id and `pending_sync`, and self-retire as soon as the real row
   * for the same topic appears — or after OPTIMISTIC_TTL_MS, so a silently
   * failed write can never leave a ghost card on the list forever. */
  const [optimisticItems, setOptimisticItems] = useState<StudyItem[]>([]);
  const optimisticIdRef = useRef(-1);
  /* OPTIMISTIC EDITS — id → the fields to show over the real row until the
   * refreshed query confirms them. A parallel timestamp map lets a patch that
   * never confirms (a silently dropped update) retire itself, exactly like the
   * optimistic-insert TTL below. */
  const [optimisticPatches, setOptimisticPatches] = useState<Map<number, Partial<StudyItem>>>(() => new Map());
  const patchTimesRef = useRef<Map<number, number>>(new Map());

  const addOptimisticItem = (draft: Omit<StudyItem, 'id'>): number => {
    const tempId = optimisticIdRef.current;
    optimisticIdRef.current -= 1;
    setOptimisticItems((current) => [...current, { ...draft, id: tempId, pending_sync: true }]);
    return tempId;
  };
  const dropOptimisticItem = (tempId: number) => {
    setOptimisticItems((current) =>
      current.some((row) => row.id === tempId) ? current.filter((row) => row.id !== tempId) : current,
    );
  };
  const applyOptimisticPatch = (id: number, patch: Partial<StudyItem>) => {
    patchTimesRef.current.set(id, Date.now());
    setOptimisticPatches((current) => {
      const next = new Map(current);
      next.set(id, { ...(next.get(id) ?? {}), ...patch });
      return next;
    });
  };
  const clearOptimisticPatch = (id: number) => {
    patchTimesRef.current.delete(id);
    setOptimisticPatches((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };

  const realItems = itemsQ.data || [];
  /* A draft is superseded once a real pending study row exists for its topic. */
  const liveOptimistic = useMemo(() => {
    if (optimisticItems.length === 0) return optimisticItems;
    const landed = new Set(
      realItems
        .filter((row) => row.kind === 'new' && row.status === 'pending')
        .map((row) => row.source_key || topicKey(row.subject, row.topic)),
    );
    return optimisticItems.filter((row) => !landed.has(row.source_key || topicKey(row.subject, row.topic)));
  }, [optimisticItems, realItems]);
  useEffect(() => {
    if (liveOptimistic.length === optimisticItems.length) return;
    const keep = new Set(liveOptimistic.map((row) => row.id));
    setOptimisticItems((current) => current.filter((row) => keep.has(row.id)));
  }, [liveOptimistic, optimisticItems]);
  useEffect(() => {
    if (optimisticItems.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      const cutoff = Date.now() - OPTIMISTIC_TTL_MS;
      setOptimisticItems((current) => {
        const kept = current.filter((row) => Date.parse(row.created_at || '') > cutoff);
        return kept.length === current.length ? current : kept;
      });
    }, OPTIMISTIC_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [optimisticItems]);

  /* A confirmed edit clears its own patch: once the refreshed query shows the
   * same values (or the row is gone), the override is no longer needed. */
  useEffect(() => {
    if (optimisticPatches.size === 0) return;
    setOptimisticPatches((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const next = new Map(current);
      for (const [id, patch] of current) {
        const real = realItems.find((row) => (row.id as number) === id);
        if (!real) {
          next.delete(id);
          patchTimesRef.current.delete(id);
          changed = true;
          continue;
        }
        const settled = Object.entries(patch).every(
          ([key, value]) => (real as unknown as Record<string, unknown>)[key] === value,
        );
        if (settled) {
          next.delete(id);
          patchTimesRef.current.delete(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [realItems, optimisticPatches]);
  /* Safety valve: a patch whose update failed WITHOUT throwing (a dropped
   * connection) can never confirm — retire it so an edit never sticks on
   * screen forever, mirroring the optimistic-insert TTL. */
  useEffect(() => {
    if (optimisticPatches.size === 0) return undefined;
    const timer = window.setTimeout(() => {
      const cutoff = Date.now() - OPTIMISTIC_TTL_MS;
      setOptimisticPatches((current) => {
        if (current.size === 0) return current;
        let changed = false;
        const next = new Map(current);
        for (const id of current.keys()) {
          if ((patchTimesRef.current.get(id) ?? 0) < cutoff) {
            next.delete(id);
            patchTimesRef.current.delete(id);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, OPTIMISTIC_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [optimisticPatches]);

  const items = useMemo(() => {
    const base =
      optimisticPatches.size === 0
        ? realItems
        : realItems.map((row) => {
            const patch = optimisticPatches.get(row.id as number);
            return patch ? { ...row, ...patch } : row;
          });
    return liveOptimistic.length === 0 ? base : [...base, ...liveOptimistic];
  }, [realItems, liveOptimistic, optimisticPatches]);
  const mistakes = mistakesQ.data || [];
  const sessions = sessionsQ.data || [];
  const scoreEntries = useMemo(
    () => mergeScoreEntries(resultsQ.data || [], scoresQ.data || []),
    [resultsQ.data, scoresQ.data],
  );
  const day = profile ? dayNumber(profile.start_date, today) : 1;

  const metaMap = useMemo(() => buildMetaMap(metaQ.data ?? []), [metaQ.data]);
  const annotations = useMemo(() => buildAnnotationMap(metaQ.data ?? []), [metaQ.data]);

  /* One exam id, two possible sources: the pre-loaded catalogue, or an exam
   * the student typed in — whose syllabus is stored next to their profile. */
  const storedCustomExam = metaMap.get(CUSTOM_EXAM_META_KEY)?.meta_value ?? null;
  const savedExamLabel = metaMap.get(EXAM_LABEL_META_KEY)?.meta_value?.trim() || '';
  const examDef = useMemo(() => {
    const resolved = resolveExamDef(profile?.exam ?? null, storedCustomExam, today);
    if (resolved) return resolved;
    if (onboardingExamDraft && onboardingExamDraft.id === profile?.exam) return onboardingExamDraft;
    // A typed exam still waiting in the pending Day-1 sync keeps its syllabus.
    if (pendingOnboarding?.customExamJson && pendingOnboarding.examId === profile?.exam) {
      return parseCustomExam(pendingOnboarding.customExamJson, today);
    }
    return undefined;
  }, [profile?.exam, storedCustomExam, onboardingExamDraft, pendingOnboarding, today]);

  /* Old builds preloaded syllabus rows into the checklist. Real student tasks
   * have annotations; completed history and its revision children stay visible. */
  const studentItems = useMemo(() => {
    const studiedKeys = new Set(
      items
        .filter((item) => item.kind === 'new' && item.status === 'done')
        .map((item) => item.source_key || topicKey(item.subject, item.topic)),
    );
    return items.filter((item) => {
      const key = item.source_key || topicKey(item.subject, item.topic);
      // A pending revision may only surface for a topic with completed study
      // history — a student cannot revise something they haven't studied yet.
      if (item.kind === 'revision' && item.status !== 'done') return studiedKeys.has(key);
      if (item.status === 'done' || annotations.has(key)) return true;
      // A task created after the preload era is a real student task — it
      // shows on Today even when its annotation write failed.
      return (item.created_at || '') >= PRELOAD_ERA_END;
    });
  }, [items, annotations]);

  const savedName = metaMap.get('name')?.meta_value || null;
  const sessionName = useMemo(() => deriveStudentName(spaceId, sessionMetadata), [spaceId, sessionMetadata]);
  const studentName = savedName || sessionName;

  const storedExamDate = metaMap.get('exam_date')?.meta_value;
  const examDateSet = metaQ.loading || Boolean(storedExamDate || examDef);
  const examDate = storedExamDate || (examDef ? defaultExamDate(examDef, today) : addDaysISO(today, 180));
  const goals = metaMap.get('goals')?.meta_value || '';
  const dailyGoal = metaMap.get('goal_daily_hours')?.meta_value || '';
  const weeklyGoal = metaMap.get('goal_weekly_hours')?.meta_value || '';

  /* Recorded study time: today's total, plus the hours half of the pace signal. */
  const todayMinutes = useMemo(() => minutesOnDate(sessions, today), [sessions, today]);
  const hoursSnapshot = useMemo(() => {
    const goalHours = Number(dailyGoal);
    const target = Number.isFinite(goalHours) && goalHours > 0 ? Math.round(goalHours * 60) : null;
    return buildHoursSnapshot(sessions, today, target);
  }, [sessions, today, dailyGoal]);
  const pace = useMemo(
    () => computePace(studentItems, examDef, examDate, today, hoursSnapshot),
    [studentItems, examDef, examDate, today, hoursSnapshot],
  );
  const daysToExam = Math.max(0, diffDays(today, examDate));
  const examPickerVisible = !profileQ.loading && !profile;

  /* "I only have 2 hours today" — an explicit per-day capacity override the
   * coach writes into zuno_meta; it expires naturally with the date key. */
  const capacityOverrideMinutes = useMemo(() => {
    const raw = metaMap.get(`capacity_${today}`)?.meta_value;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }, [metaMap, today]);

  /* ---------- adaptation-engine derivations ---------- */

  const progressRows = examProgressQ.data ?? [];
  const weakTopicRows = weakTopicsQ.data ?? [];
  const attemptRows = topicAttemptsQ.data ?? [];
  const chatExamPref = metaMap.get(CHAT_EXAM_META_KEY)?.meta_value || null;
  const activeSyllabusExam = useMemo(
    () =>
      (chatExamPref ? getCatalogSyllabus(syllabusCatalog, chatExamPref) : undefined) ??
      syllabusForProfileFromCatalog(syllabusCatalog, profile?.exam ?? null),
    [chatExamPref, profile?.exam, syllabusCatalog],
  );
  const topicPickerSubjects = useMemo<TopicPickerSubject[]>(() => {
    if (activeSyllabusExam) {
      return activeSyllabusExam.subjects.map((subject) => ({
        name: subject.name,
        chapters: subject.chapters.map((chapter) => ({ name: chapter.name, topics: chapter.topics, weightage: chapter.weightage })),
      }));
    }
    return (examDef?.subjects ?? []).map((subject) => ({
      name: subject.name,
      chapters: subject.chapters.map((chapter) => ({ name: chapter.name, topics: chapter.topics })),
    }));
  }, [activeSyllabusExam, examDef]);
  const topicPickerExamLabel = activeSyllabusExam?.name || examDef?.target.label || savedExamLabel || 'Your exam';
  /* Shared exam-format reference data, read once here so every screen and the
   * AI coach quote the same official numbers. */
  const examMetadata = useMemo(
    () => resolveExamMetadata(examMetadataCatalog.byExamId, profile?.exam ?? null),
    [examMetadataCatalog.byExamId, profile?.exam],
  );
  const examSyllabusSynced = useMemo(() => {
    const candidates = [profile?.exam, activeSyllabusExam?.id].filter(Boolean).map(String);
    return candidates.some((examId) => syncedExamIds.includes(examId));
  }, [profile?.exam, activeSyllabusExam?.id, syncedExamIds]);
  const readiness = useMemo(
    () => (activeSyllabusExam ? getReadinessScore(activeSyllabusExam.id, progressRows, activeSyllabusExam) : null),
    [activeSyllabusExam, progressRows],
  );
  const weakTopicInsights = useMemo(
    () => (activeSyllabusExam ? getWeakTopics(activeSyllabusExam.id, weakTopicRows, progressRows, 5, today) : []),
    [activeSyllabusExam, weakTopicRows, progressRows, today],
  );

  /* ---------- data-layer self-heal effects ---------- */

  // Heal revision rows for completed work, but never preload syllabus tasks.
  // Every healed topic gets the one canonical 1→3→7→14→28 ladder from its
  // study date (the meta query is awaited only for the annotation read).
  const ensuredRef = useRef(false);
  useEffect(() => {
    if (ensuredRef.current) return;
    if (!dbSessionReady || profileQ.loading || itemsQ.loading || metaQ.loading || !profile) return;
    ensuredRef.current = true;

    void (async () => {
      const inserts: StudyItemDraft[] = [];
      // ANY revision row (pending, done or skipped) means a schedule already
      // exists for that topic. Under the rolling rating model a topic's
      // ladder is deliberately PARTIAL — one next row at a time after its
      // first rating — so healing may only fill topics with NO revision rows
      // at all; topping up a partial ladder would undo every rating.
      const scheduledKeys = new Set<string>();
      for (const i of items) {
        if (i.kind !== 'revision') continue;
        scheduledKeys.add(i.source_key || topicKey(i.subject, i.topic));
      }
      for (const it of items) {
        if (it.pending_sync) continue;
        if (it.kind !== 'new' || it.status !== 'done' || !it.studied_on) continue;
        const key = it.source_key || topicKey(it.subject, it.topic);
        if (scheduledKeys.has(key)) continue;
        scheduledKeys.add(key);
        const bucket = studyTaskTypeOf(annotations.get(key));
        for (const draft of buildRevisionDrafts(it, it.studied_on, new Set(), bucket)) {
          inserts.push(draft);
        }
      }
      if (inserts.length) {
        await Promise.all(inserts.map((row) => verifiedDbFrom(TABLES.items).insert(row as Record<string, unknown>)));
        itemsQ.refresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, profileQ.loading, itemsQ.loading, metaQ.loading, profile?.id]);

  /* Self-heal: a student task whose annotation write failed earlier gets a
   * default one, so its type badge, duration estimate and calendar editing
   * all work again. Runs once per visit, quietly. */
  const annotationHealRef = useRef(false);
  useEffect(() => {
    if (annotationHealRef.current) return;
    if (!dbSessionReady || itemsQ.loading || metaQ.loading || !profile) return;
    const missing = items.filter(
      (item) =>
        !item.pending_sync &&
        item.kind === 'new' &&
        item.status === 'pending' &&
        (item.created_at || '') >= PRELOAD_ERA_END &&
        !annotations.has(item.source_key || topicKey(item.subject, item.topic)),
    );
    annotationHealRef.current = true;
    if (missing.length === 0) return;
    void (async () => {
      try {
        for (const item of missing.slice(0, 30)) {
          const key = item.source_key || topicKey(item.subject, item.topic);
          await verifiedDbFrom(TABLES.meta).insert({
            meta_key: taskTypeKey(key),
            meta_value: JSON.stringify({ type: parseOneLiner(item.topic, examDef).type, ai: false }),
          });
        }
        metaQ.refresh();
      } catch {
        /* storage hiccup — the next visit tries again */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, itemsQ.loading, metaQ.loading, profile?.id, items, annotations, examDef]);

  /* ---------- derived queues ---------- */

  const dueRevisionsAll = useMemo(() => dueRevisionsOf(studentItems, today), [studentItems, today]);
  /* topicKey → the syllabus chapter a task sits in, so the queue can be scored
   * on the chapter's exam weightage rather than the student's free text. */
  const chapterByTopicKey = useMemo(
    () => buildChapterIndex(examDef, profile?.exam ?? 'general'),
    [examDef, profile?.exam],
  );
  /* How far behind the student is — the switch that turns exam-weightage
   * triage on (see config/priority.HEAVY_BACKLOG_THRESHOLD). */
  const backlogSize = useMemo(() => backlogSizeOf(studentItems, today), [studentItems, today]);
  /* Weakest/most-overdue first, cut by BOTH daily ceilings — the item cap and
   * the 60-minute budget. A recall costs the student's own stored duration
   * when they set one, else the shared REVISION_ITEM_MINUTES assumption (so a
   * default day still surfaces the full five). Once the backlog is heavy,
   * heavier-weightage chapters take those slots first; while it is light this
   * term is constant and the weakness-then-oldest order is unchanged. */
  const dueRevisions = useMemo(
    () =>
      prioritizeDueRevisions(
        dueRevisionsAll,
        weakTopicRows,
        (item) => {
          const annotation = annotations.get(item.source_key || topicKey(item.subject, item.topic));
          return annotation?.minutes ?? REVISION_ITEM_MINUTES;
        },
        (item) =>
          // getPriorityScore takes (examId, chapterName, pendingCount). This
          // call used to pass a {name, subject} object first, so the weight
          // lookup never matched and every chapter scored the neutral 1.0 —
          // the exam-weightage triage under heavy backlog was silently dead.
          getPriorityScore(
            profile?.exam ?? 'general',
            chapterByTopicKey.get(item.source_key || topicKey(item.subject, item.topic))?.chapter ?? item.topic,
            backlogSize,
          ),
      ),
    [dueRevisionsAll, weakTopicRows, annotations, chapterByTopicKey, backlogSize, profile?.exam],
  );
  const queuedRevisionCount = Math.max(0, dueRevisionsAll.length - dueRevisions.length);
  const overdueRevisions = useMemo(() => overdueRevisionsOf(studentItems, today), [studentItems, today]);
  const todayTargets = useMemo(
    () => studentItems.filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for === today),
    [studentItems, today],
  );
  const carryOver = useMemo(
    () =>
      studentItems
        .filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for < today)
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)),
    [studentItems, today],
  );
  /* localDayOf, never a raw slice: a completion stamped in UTC by an older
   * build resolves to the LOCAL day it actually happened on, so a task ticked
   * after midnight still shows up here instead of silently disappearing. */
  const doneToday = useMemo(
    () => studentItems.filter((i) => i.status === 'done' && localDayOf(i.completed_at) === today),
    [studentItems, today],
  );
  const completedByDate = useMemo(() => {
    const map = new Map<string, StudyItem[]>();
    for (const item of studentItems) {
      if (item.status !== 'done' || !item.completed_at) continue;
      const date = localDayOf(item.completed_at);
      if (!date) continue;
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    }
    return map;
  }, [studentItems]);
  const doneTopicKeys = useMemo(
    () =>
      new Set(
        studentItems
          .filter((i) => i.kind === 'new' && i.status === 'done')
          .map((i) => i.source_key || topicKey(i.subject, i.topic)),
      ),
    [studentItems],
  );

  /* Newest stored signal per topic (feedbackQ reads newest-first).
   * feelingByKey NORMALISES the 4-value revision ratings onto the legacy
   * 3-value feeling (again→hard, good→medium) for prioritisation consumers;
   * lastRatingLabelByKey keeps the display label for the contextual prompt
   * “Last time you rated this X — how do you feel now?”. */
  const feelingByKey = useMemo(() => {
    const map = new Map<string, TaskFeeling>();
    for (const row of feedbackQ.data ?? []) {
      if (!map.has(row.source_key)) map.set(row.source_key, feedbackValueToFeeling(row.feeling));
    }
    return map;
  }, [feedbackQ.data]);
  const lastRatingLabelByKey = useMemo(() => {
    const map = new Map<string, 'Again' | 'Hard' | 'Good' | 'Easy'>();
    for (const row of feedbackQ.data ?? []) {
      if (map.has(row.source_key)) continue;
      const label = feedbackValueToRatingLabel(row.feeling);
      if (label) map.set(row.source_key, label);
    }
    return map;
  }, [feedbackQ.data]);
  const formula = useMemo(() => dailyFormula(studentItems, today, feelingByKey), [studentItems, today, feelingByKey]);
  const taskDetails = useMemo(() => Object.fromEntries(annotations.entries()), [annotations]);
  const streak = useMemo(() => computeStreak(studentItems, today), [studentItems, today]);

  /* ---------- CROSS-DEVICE day-plan state (Phase 10) ----------
   * The carry-over decision and the "From yesterday" ids used to live ONLY
   * in localStorage — a second device re-asked the question and lost the
   * carried section. They are now durable in zuno_meta (key carryover|<date>),
   * with localStorage kept as a same-visit cache. */

  const carryoverMetaKey = `carryover|${today}`;
  const carryoverLocalKey = accountEmail ? `carryover_decision_${spaceId}_${accountEmail}_${today}` : null;
  const carriedLocalKey = accountEmail ? `carryover_carried_${spaceId}_${accountEmail}_${today}` : null;

  const storedCarryover = useMemo(() => {
    const raw = metaMap.get(carryoverMetaKey)?.meta_value;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { decision?: unknown; carried?: unknown };
      return {
        decision: typeof parsed.decision === 'string' ? parsed.decision : null,
        carried: Array.isArray(parsed.carried)
          ? parsed.carried.filter((n): n is number => typeof n === 'number')
          : [],
      };
    } catch {
      return null;
    }
  }, [metaMap, carryoverMetaKey]);

  const [carryoverDecisionLocal, setCarryoverDecisionLocal] = useState<string | null>(() => {
    if (!carryoverLocalKey) return null;
    try {
      return localStorage.getItem(carryoverLocalKey);
    } catch {
      return null;
    }
  });
  const [carriedIdsLocal, setCarriedIdsLocal] = useState<Set<number>>(() => {
    if (!carriedLocalKey) return new Set();
    try {
      const raw = localStorage.getItem(carriedLocalKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []);
    } catch {
      return new Set();
    }
  });

  const carryoverDirtyRef = useRef(false);
  const dbCarryoverReady = accountDataReady && !metaQ.loading;
  const carryoverDecision =
    dbCarryoverReady && !carryoverDirtyRef.current
      ? storedCarryover?.decision ?? null
      : carryoverDecisionLocal ?? storedCarryover?.decision ?? null;
  const carriedIds = useMemo(
    () =>
      dbCarryoverReady && !carryoverDirtyRef.current
        ? new Set(storedCarryover?.carried ?? [])
        : carriedIdsLocal.size > 0
          ? carriedIdsLocal
          : new Set(storedCarryover?.carried ?? []),
    [carriedIdsLocal, storedCarryover, dbCarryoverReady],
  );

  useEffect(() => {
    if (!dbCarryoverReady || carryoverDirtyRef.current || !storedCarryover) return;
    setCarryoverDecisionLocal(storedCarryover.decision);
    setCarriedIdsLocal(new Set(storedCarryover.carried));
  }, [dbCarryoverReady, storedCarryover]);

  const persistCarryoverMeta = (decision: string | null, ids: Set<number>) => {
    void upsertMetaKey(carryoverMetaKey, JSON.stringify({ decision, carried: Array.from(ids) }))
      .then(() => metaQ.refresh())
      .catch((error) => {
        carryoverDirtyRef.current = false;
        setCarryoverDecisionLocal(storedCarryover?.decision ?? null);
        setCarriedIdsLocal(new Set(storedCarryover?.carried ?? []));
        reportStudentDataWriteFailure("That day-plan choice didn't save — your saved plan has been restored. Try once more.", error);
      });
  };

  const rememberCarryoverDecision = (decision: string) => {
    carryoverDirtyRef.current = true;
    setCarryoverDecisionLocal(decision);
    try {
      if (carryoverLocalKey) localStorage.setItem(carryoverLocalKey, decision);
    } catch {
      /* state alone still prevents a re-ask this visit */
    }
    persistCarryoverMeta(decision, carriedIds);
  };

  const setCarriedIdsPersist = (ids: Set<number>) => {
    carryoverDirtyRef.current = true;
    setCarriedIdsLocal(ids);
    try {
      if (carriedLocalKey) localStorage.setItem(carriedLocalKey, JSON.stringify(Array.from(ids)));
    } catch {
      /* the section still renders for this visit */
    }
    persistCarryoverMeta(carryoverDecisionLocal ?? storedCarryover?.decision ?? null, ids);
  };

  /* Hero pin: a starred task takes the mission slot. ACCOUNT-KEYED in
   * zuno_meta (key hero_pin, '' = unpinned) so the star follows the login
   * across devices and sign-ins; localStorage stays as this device's
   * instant-boot cache. A local decision made THIS visit always wins on
   * screen; with none, the account's stored pin applies. */
  const heroLocalKey = accountEmail ? `vicharak_hero_${spaceId}_${accountEmail}_${today}` : null;
  const [heroIdLocal, setHeroIdLocal] = useState<number | null | undefined>(() => {
    if (!heroLocalKey) return undefined;
    try {
      const raw = localStorage.getItem(heroLocalKey);
      if (raw === null) return undefined; // no device copy — defer to the stored pin
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  });
  const storedHeroId = useMemo(() => {
    const raw = metaMap.get('hero_pin')?.meta_value ?? '';
    const parsed = Number(raw);
    return raw !== '' && Number.isFinite(parsed) ? parsed : null;
  }, [metaMap]);
  const heroDirtyRef = useRef(false);
  const heroId =
    accountDataReady && !heroDirtyRef.current
      ? storedHeroId
      : heroIdLocal !== undefined
        ? heroIdLocal
        : storedHeroId;
  useEffect(() => {
    if (!accountDataReady || heroDirtyRef.current) return;
    setHeroIdLocal(storedHeroId);
    if (!heroLocalKey) return;
    try {
      if (storedHeroId === null) localStorage.removeItem(heroLocalKey);
      else localStorage.setItem(heroLocalKey, String(storedHeroId));
    } catch {
      /* durable state is already in memory */
    }
  }, [accountDataReady, storedHeroId, heroLocalKey]);
  const pinHeroId = (id: number | null) => {
    heroDirtyRef.current = true;
    setHeroIdLocal(id);
    try {
      if (heroLocalKey) {
        if (id === null) localStorage.removeItem(heroLocalKey);
        else localStorage.setItem(heroLocalKey, String(id));
      }
    } catch {
      /* cache write failed — the durable meta write below can still land */
    }
    void upsertMetaKey('hero_pin', id === null ? '' : String(id))
      .then(() => metaQ.refresh())
      .catch((error) => {
        heroDirtyRef.current = false;
        setHeroIdLocal(storedHeroId);
        reportStudentDataWriteFailure("That pinned task didn't save — your saved pin has been restored. Try once more.", error);
      });
  };

  const missionQueue = useMemo(() => buildMissionQueue(todayTargets, heroId), [todayTargets, heroId]);
  const relatedCarryover = useMemo(() => buildRelatedCarryover(carryOver, todayTargets), [carryOver, todayTargets]);
  const checklistPending = useMemo(
    () => buildChecklistPending(missionQueue, dueRevisions),
    [missionQueue, dueRevisions],
  );
  const carriedPending = useMemo(
    () => buildCarriedPending(checklistPending, carriedIds),
    [checklistPending, carriedIds],
  );
  const mainPending = useMemo(() => buildMainPending(missionQueue, carriedIds), [missionQueue, carriedIds]);
  const quickAddSubjects = useMemo(
    () => buildQuickAddSubjects(studentItems, examDef),
    [studentItems, examDef],
  );
  const filterSubjects = useMemo(
    () => buildFilterSubjects(missionQueue, dueRevisions, doneToday),
    [missionQueue, dueRevisions, doneToday],
  );
  /* Estimated clock for today — shared by the Road timeline and reminders. */
  const daySchedule = useMemo(
    () =>
      buildDaySchedule([...dueRevisions, ...missionQueue], (item) =>
        annotations.get(item.source_key || topicKey(item.subject, item.topic)),
      ),
    [dueRevisions, missionQueue, annotations],
  );

  /* ---------- exam-proximity & post-test re-surface (pure algorithm) ----------
   * Two deterministic re-queue rules — no AI anywhere in this path:
   *  - EXAM ≤ 14 DAYS AWAY: every studied topic with no pending revision row
   *    re-queues, weakest first (lowest stored rating, then longest since
   *    reviewed), labelled “Exam in X days — time to revisit” on Today.
   *  - A TEST WAS LOGGED (today or yesterday): studied topics from that
   *    test's subjects re-surface, labelled “Flagged for review after your
   *    test”.
   * Both feed the existing bounded revision budget: inserts are chunked with
   * nextOpenRevisionDay (never more than REVISION_DAILY_CAP land on one day)
   * and the Today display slice still applies prioritizeDueRevisions, so
   * nothing can pile up. Idempotent by construction — a topic with ANY
   * pending revision row is never re-queued, so each pass fills only
   * genuine gaps. */
  const resurfaceBusyRef = useRef(false);
  const resurfaceRunKeyRef = useRef('');
  useEffect(() => {
    if (!dbSessionReady || itemsQ.loading || feedbackQ.loading || !profile) return;

    const EXAM_WINDOW_DAYS = 14;
    const examMode = daysToExam <= EXAM_WINDOW_DAYS;
    const runKey = `${profile.id}|${today}|${examMode}|${scoreEntries.map((entry) => entry.key).join(',')}`;
    if (resurfaceBusyRef.current || resurfaceRunKeyRef.current === runKey) return;
    resurfaceRunKeyRef.current = runKey;
    const testsSince = addDaysISO(today, -1);
    const recentTestSubjects = new Set<string>();
    for (const entry of scoreEntries) {
      if ((entry.taken_on || '') >= testsSince && entry.subject) {
        recentTestSubjects.add((entry.subject ?? '').trim().toLowerCase());
      }
    }
    if (!examMode && recentTestSubjects.size === 0) return;

    /* A topic with a pending revision row is already coming back. */
    const pendingRevKeys = new Set<string>();
    const revisionLoadByDate = new Map<string, number>();
    for (const row of studentItems) {
      if (row.kind !== 'revision' || row.status !== 'pending') continue;
      pendingRevKeys.add(row.source_key || topicKey(row.subject, row.topic));
      revisionLoadByDate.set(row.scheduled_for, (revisionLoadByDate.get(row.scheduled_for) ?? 0) + 1);
    }
    /* The ladder rung and the date each topic last completed a revision on —
     * the re-queued row keeps its step, and staleness ranks the queue. */
    const lastStepByKey = new Map<string, number>();
    const lastReviewedByKey = new Map<string, string>();
    for (const row of studentItems) {
      if (row.kind !== 'revision' || row.status !== 'done') continue;
      const key = row.source_key || topicKey(row.subject, row.topic);
      const interval = Number(row.interval_days);
      if (Number.isFinite(interval) && interval > (lastStepByKey.get(key) ?? 0)) lastStepByKey.set(key, interval);
      const when = localDayOf(row.completed_at) || row.scheduled_for;
      if (when > (lastReviewedByKey.get(key) ?? '')) lastReviewedByKey.set(key, when);
    }

    const seen = new Set<string>();
    const candidates: Array<{ item: StudyItem; key: string; reason: 'exam_proximity' | 'post_test' }> = [];
    for (const row of studentItems) {
      if (row.pending_sync || row.kind !== 'new' || row.status !== 'done' || !row.studied_on) continue;
      const key = row.source_key || topicKey(row.subject, row.topic);
      if (seen.has(key) || pendingRevKeys.has(key)) continue;
      seen.add(key);
      const fromTest = recentTestSubjects.has((row.subject || '').trim().toLowerCase());
      if (!examMode && !fromTest) continue;
      candidates.push({ item: row, key, reason: fromTest ? 'post_test' : 'exam_proximity' });
    }
    if (candidates.length === 0) return;

    /* WEAKEST FIRST: lowest stored rating, then longest since reviewed. The
     * insertion order sets the chunked dates, so the weakest topics land on
     * the earliest open days. */
    const feelingRank: Record<TaskFeeling, number> = { hard: 0, medium: 1, easy: 2 };
    candidates.sort((a, b) => {
      const ra = feelingRank[feelingByKey.get(a.key) ?? 'medium'];
      const rb = feelingRank[feelingByKey.get(b.key) ?? 'medium'];
      if (ra !== rb) return ra - rb;
      const la = lastReviewedByKey.get(a.key) || a.item.studied_on || '';
      const lb = lastReviewedByKey.get(b.key) || b.item.studied_on || '';
      return la.localeCompare(lb);
    });

    resurfaceBusyRef.current = true;
    void (async () => {
      try {
        const db = verifiedDbFrom(TABLES.items);
        for (const candidate of candidates) {
          const dueOn = nextOpenRevisionDay(today, revisionLoadByDate);
          await db.insert({
            exam: candidate.item.exam,
            subject: candidate.item.subject,
            topic: candidate.item.topic,
            kind: 'revision',
            scheduled_for: dueOn,
            status: 'pending',
            studied_on: candidate.item.studied_on,
            interval_days: lastStepByKey.get(candidate.key) ?? 1,
            source_key: candidate.key,
            category: candidate.item.category ?? null,
            is_auto_revision: true,
            resurface_reason: candidate.reason,
          });
        }
        itemsQ.refresh();
      } catch (error) {
        console.warn('[vicharakai] re-surface pass failed — the next visit retries', error);
      } finally {
        resurfaceBusyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, itemsQ.loading, feedbackQ.loading, profile?.id, daysToExam, scoreEntries, today]);

  /* ---------- MCQ bank, attachments, weekly, tests ---------- */

  const mcqBank = mcqQ.data ?? [];
  const examQuestionsBank = examQuestionsQ.data ?? [];
  const testResults = testResultsQ.data ?? [];
  const mockNudgeLine = useMemo(
    () => weeklyMockNudge(scoreEntries, testResults, today, doneTopicKeys.size, daysToExam),
    [scoreEntries, testResults, today, doneTopicKeys, daysToExam],
  );
  /* Task attachments are keyed by source_key so revision rows share them. */
  const attachmentsBySourceKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of attachmentsQ.data ?? []) {
      if (row.parent_type !== 'task') continue;
      const list = map.get(row.parent_key) ?? [];
      list.push(row.image_url);
      map.set(row.parent_key, list);
    }
    return map;
  }, [attachmentsQ.data]);
  const questionAttachments = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of attachmentsQ.data ?? []) {
      if (row.parent_type !== 'question') continue;
      const list = map.get(row.parent_key) ?? [];
      list.push(row.image_url);
      map.set(row.parent_key, list);
    }
    return map;
  }, [attachmentsQ.data]);

  const weekStart = weekStartISO(today);
  /* Monthly focus — a light JSON list of {subject, chapter} in zuno_meta, so
   * the Monthly → Weekly → Today hierarchy needs no extra table. */
  const monthKey = today.slice(0, 7);
  const monthlyChapters = useMemo<FocusChapter[]>(() => {
    const raw = metaMap.get(`monthly_targets|${monthKey}`)?.meta_value;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { chapters?: unknown };
      if (!Array.isArray(parsed.chapters)) return [];
      return parsed.chapters
        .map((entry) => ({
          subject: String((entry as { subject?: unknown })?.subject ?? '').trim(),
          chapter: String((entry as { chapter?: unknown })?.chapter ?? '').trim(),
        }))
        .filter((c) => c.subject && c.chapter);
    } catch {
      return [];
    }
  }, [metaMap, monthKey]);
  const weeklyRow = useMemo(() => findWeekRow(weeklyQ.data ?? [], weekStart), [weeklyQ.data, weekStart]);
  const lastWeekRow = useMemo(
    () => findWeekRow(weeklyQ.data ?? [], addDaysISO(weekStart, -7)),
    [weeklyQ.data, weekStart],
  );
  const weeklyTopicsDone = useMemo(
    () => countWeeklyTopicsDone(studentItems, weekStart),
    [studentItems, weekStart],
  );
  const weeklyTestsDone = useMemo(() => {
    const weekEnd = addDaysISO(weekStart, 6);
    const loggedScores = scoreEntries.filter(
      (entry) => entry.taken_on >= weekStart && entry.taken_on <= weekEnd,
    ).length;
    return countWeeklyTestsDone(testResults, weekStart) + loggedScores;
  }, [testResults, scoreEntries, weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);

  /* The flagged-question pool — only rows still queued. */
  const flaggedRows = useMemo(
    () => (flaggedQ.data ?? []).filter((row) => row.status === 'queued'),
    [flaggedQ.data],
  );
  /* Every saved question enters revision immediately. AI drafting and student
     confirmation are useful metadata, never gates on the scheduler. */
  const dueFlagged = useMemo(
    () =>
      flaggedRows
        .filter((row) => flaggedDueOn(row, today))
        .sort(
          (a, b) =>
            String(a.next_revision_on ?? '').slice(0, 10).localeCompare(String(b.next_revision_on ?? '').slice(0, 10)) ||
            a.id - b.id,
        )
        .slice(0, DOUBTS_DAILY_CAP),
    [flaggedRows, today],
  );
  /* Only legacy rows without either answer path keep the optional Resolve
   * prompt. New snaps use ai_draft_status and never stall here. */
  const resolveQueue = useMemo(
    () =>
      flaggedRows
        .filter((row) => !flaggedHasSolution(row) && !row.ai_draft_status)
        .sort((a, b) => b.id - a.id),
    [flaggedRows],
  );

  /* ---------- THE metrics snapshot (features/metrics) ---------- */
  const metrics = useMemo(
    () =>
      computeStudyMetrics({
        studentItems,
        annotations,
        dueRevisions,
        flaggedRows,
        weeklyRow,
        weeklyTopicsDone,
        weeklyTestsDone,
        weekStart,
        today,
      }),
    [studentItems, annotations, dueRevisions, flaggedRows, weeklyRow, weeklyTopicsDone, weeklyTestsDone, weekStart, today],
  );

  const focusChapters = useMemo<FocusChapter[]>(() => parseFocusChapters(weeklyRow), [weeklyRow]);
  const focusReason = weeklyRow?.focus_reason ?? null;
  const chapterStats = useMemo(
    () => buildChapterStats(examDef, studentItems, testResults),
    [examDef, studentItems, testResults],
  );
  const aiFocusChips = useMemo(() => buildAiFocusChips(focusChapters, testResults), [focusChapters, testResults]);
  const testTopicOptions = useMemo(
    () => buildTestTopicOptions(studentItems, mcqBank, examQuestionsBank, profile?.exam),
    [studentItems, mcqBank, examQuestionsBank, profile?.exam],
  );

  /* Weekly counters also live on the row — keep them synced to the live
   * numbers derived from the actual data, one write per change. */
  const weeklySyncRef = useRef('');
  useEffect(() => {
    if (!dbSessionReady || !weeklyRow) return;
    const storedTopics = Number(weeklyRow.topics_done ?? 0);
    const storedTests = Number(weeklyRow.tests_done ?? 0);
    const stamp = `${weeklyRow.id}:${weeklyTopicsDone}:${weeklyTestsDone}`;
    if ((storedTopics === weeklyTopicsDone && storedTests === weeklyTestsDone) || weeklySyncRef.current === stamp) return;
    weeklySyncRef.current = stamp;
    void verifiedDbFrom(TABLES.weeklyTargets)
      .update(weeklyRow.id, { topics_done: weeklyTopicsDone, tests_done: weeklyTestsDone })
      .then(() => weeklyQ.refresh())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dbSessionReady,
    weeklyRow?.id,
    weeklyRow?.topics_done,
    weeklyRow?.tests_done,
    weeklyTopicsDone,
    weeklyTestsDone,
  ]);

  /* [Return triggers + cross-session save proof] Durable last-open marker.
   *
   * ONE zuno_meta row, TWO consumers:
   *  1. The scheduled lapse-email hook reads `.on` to notice a 3-day absence
   *     (and to stop mailing the moment the student returns).
   *  2. The account-row-update server hook reads `.email` as its FOURTH
   *     caller-identity proof — the one that saves a RETURNING STUDENT ON A
   *     NEW DEVICE. Full save flow for a Mistake Book grade (Got it / Again)
   *     on a row saved under a previous login:
   *       verifiedDbFrom(...).update() → the platform scopes the write to
   *       the caller's own session, matches nothing → 404 → sessionGuard's
   *       accountRowFallback POSTs the account-row-update hook
   *       (X-Session-Id: current session) → the hook resolves BOTH sessions
   *       to an email (check-session → zuno_profile → vicharakai_trials →
   *       zuno_meta last_open, i.e. THIS stamp) → same email ⇒ the row is
   *       updated AND adopted onto the current session → the next direct
   *       write succeeds without the hook.
   *     A fresh-device session has no profile/trial row of its own yet and
   *     check-session rarely vouches for it, so this stamp is often the
   *     ONLY proof tying the session to the student's email.
   *
   * Hard-won rules (each fixed a live "Couldn't save" failure):
   *  - do NOT wait for `profile` — the fresh-device session that needs the
   *    proof most is exactly the one whose profile row has not been adopted
   *    yet (the profile read is deliberately session-scoped);
   *  - re-stamp when the resolved email CHANGES (null → real address as the
   *    session/profile data loads in) instead of latching after one attempt;
   *  - never downgrade a same-day stamp that already carries an email;
   *  - a failed write releases the latch so a later render retries it.
   */
  const lastOpenStampRef = useRef<string | null>(null);
  const sessionEmailRaw = typeof sessionMetadata?.email === 'string' ? sessionMetadata.email : '';
  const profileEmailRaw = typeof profile?.user_email === 'string' ? profile.user_email : '';
  useEffect(() => {
    if (!dbSessionReady) return;
    const metaEmail = (sessionEmailRaw ?? '').trim().toLowerCase();
    const profileEmail = (profileEmailRaw ?? '').trim().toLowerCase();
    const email =
      (metaEmail.includes('@') ? metaEmail : '') ||
      readSessionEmail(spaceId) ||
      (profileEmail.includes('@') ? profileEmail : '') ||
      null;
    const stamp = `${today}|${email ?? ''}`;
    const previous = lastOpenStampRef.current;
    if (previous === stamp) return; // this exact stamp already committed today
    if (!email && previous?.startsWith(`${today}|`)) return; // never downgrade to an email-less stamp
    lastOpenStampRef.current = stamp;
    upsertMetaKey('last_open', JSON.stringify({ on: today, email, ts: Date.now() }))
      .then(() => {
        if (email) console.info('[vicharakai] last_open stamped with email — cross-session saves are verifiable this visit');
      })
      .catch(() => {
        /* Without this stamp a new-device session cannot pass the
         * account-row-update identity check — release the latch so a later
         * render retries instead of leaving the visit unproven. */
        if (lastOpenStampRef.current === stamp) lastOpenStampRef.current = previous;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, sessionEmailRaw, profileEmailRaw, today]);

  /* ---------- dashboard-prepared data ---------- */

  const subjectProgress = useMemo(() => buildSubjectProgress(examDef, studentItems), [examDef, studentItems]);
  const subjectScores = useMemo(() => buildSubjectScores(scoreEntries), [scoreEntries]);
  const weakAreas = useMemo(
    () => buildWeakAreas(scoreEntries, subjectScores, mistakes, flaggedRows),
    [scoreEntries, subjectScores, mistakes, flaggedRows],
  );
  const leastCoveredSubject = useMemo(
    () => [...subjectProgress].sort((a, b) => a.percent - b.percent)[0]?.subject ?? null,
    [subjectProgress],
  );

  /** The ONE metadata write path — serialized per key, duplicate-healing. */
  const upsertMeta = async (key: string, value: string) => {
    await upsertMetaKey(key, value);
    metaQ.refresh();
  };

  /* Ask the shell to hide its header extras while onboarding is visible. */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vicharak:exam-picker', { detail: examPickerVisible }));
    return () => {
      window.dispatchEvent(new CustomEvent('vicharak:exam-picker', { detail: false }));
    };
  }, [examPickerVisible]);

  const value: StudentData = {
    spaceId,
    sessionMetadata,
    setSessionId,
    today,
    dbSessionReady,
    accountDataReady,
    authGateNeeded,
    setAuthGateNeeded,
    planSessionError,
    profileQ,
    itemsQ,
    metaQ,
    scoresQ,
    resultsQ,
    mistakesQ,
    sessionsQ,
    feedbackQ,
    mcqQ,
    examQuestionsQ,
    testResultsQ,
    weeklyQ,
    attachmentsQ,
    flaggedQ,
    examProgressQ,
    topicAttemptsQ,
    weakTopicsQ,
    readinessQ,
    recommendationLogQ,
    profile,
    dbProfile,
    items,
    studentItems,
    mistakes,
    sessions,
    scoreEntries,
    day,
    metaMap,
    annotations,
    taskDetails,
    feelingByKey,
    lastRatingLabelByKey,
    streak,
    studentName,
    savedName,
    examDef,
    examMetadata,
    examSyllabusSynced,
    savedExamLabel,
    storedCustomExam,
    examDate,
    examDateSet,
    goals,
    dailyGoal,
    weeklyGoal,
    daysToExam,
    examPickerVisible,
    pendingOnboarding,
    setPendingOnboarding,
    onboardingExamDraft,
    setOnboardingExamDraft,
    dueRevisionsAll,
    dueRevisions,
    queuedRevisionCount,
    overdueRevisions,
    todayTargets,
    carryOver,
    doneToday,
    completedByDate,
    doneTopicKeys,
    formula,
    daySchedule,
    heroId,
    pinHeroId,
    carriedIds,
    setCarriedIdsPersist,
    carryoverDecision,
    rememberCarryoverDecision,
    missionQueue,
    relatedCarryover,
    checklistPending,
    carriedPending,
    mainPending,
    quickAddSubjects,
    filterSubjects,
    mcqBank,
    examQuestionsBank,
    testResults,
    attachmentsBySourceKey,
    questionAttachments,
    flaggedRows,
    dueFlagged,
    resolveQueue,
    metrics,
    weekStart,
    weekDays,
    monthKey,
    monthlyChapters,
    weeklyRow,
    lastWeekRow,
    weeklyTopicsDone,
    weeklyTestsDone,
    focusChapters,
    focusReason,
    chapterStats,
    aiFocusChips,
    testTopicOptions,
    mockNudgeLine,
    progressRows,
    weakTopicRows,
    attemptRows,
    chatExamPref,
    activeSyllabusExam,
    readiness,
    weakTopicInsights,
    topicPickerSubjects,
    topicPickerExamLabel,
    subjectProgress,
    subjectScores,
    weakAreas,
    leastCoveredSubject,
    todayMinutes,
    hoursSnapshot,
    pace,
    capacityOverrideMinutes,
    upsertMeta,
    addOptimisticItem,
    dropOptimisticItem,
    applyOptimisticPatch,
    clearOptimisticPatch,
  };

  return <StudentDataContext.Provider value={value}>{children}</StudentDataContext.Provider>;
}
