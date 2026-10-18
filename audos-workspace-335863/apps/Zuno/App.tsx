/**
 * VicharakAI — one app, four tabs: Today · Calendar · Ask VicharakAI · Me. Full screen
 * everywhere: no floating coach widget, no side panels. AI is the core engine —
 * photo→tasks, doubt-question extraction and tests, adaptive MCQ curation,
 * AI-picked weekly targets and a focus-mode timer all run through the platform
 * proxy (GPT-4o family), never a client key.
 *
 * Today carries one promise: here is your mission, log it when it's done. A
 * greeting, one line of context, ONE mission with a single full-width action,
 * at most three other feasible tasks, and the day's spaced revisions folded
 * behind a single row. Pace signals, plan lines, counters, charts, rings and
 * the Story of the Day all live behind Me → Performance dashboard — the
 * engine works in the background and Today only ever shows its outcome.
 * A once-per-day motivation popup greets the first open of each calendar day,
 * and the whole app can switch between dark (default) and light themes from
 * the Profile tab.
 *
 * VicharakAI's coaching starts on day one: 8 calendar days of full AI, no card. After
 * that VicharakAI Free keeps the whole planner plus 2 AI messages a day, and VicharakAI Pro
 * (₹149/month) is unlimited AI. Only the AI is ever metered — tasks, revisions,
 * streak, calendar and dashboard stay open to everyone, and access.ts is the
 * single place that decides any of it.
 *
 * TEMP: Paywall disabled 2026-08-08 — re-enable once payment is ready. The
 * `PAYWALL_DISABLED` flag in access.ts currently gives every student unlimited
 * AI; set it back to false to restore the trial/free metering described above.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  CloudRain,
  Crown,
  Flag,
  Flame,
  GraduationCap,
  Languages,
  LifeBuoy,
  Loader2,
  LogOut,
  Moon,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  Trophy,
  Wand2,
  X,
} from 'lucide-react';
import { useSpaceRuntime } from '../../SpaceRuntimeContext';
import { defaultExamDate, EXAMS, getExam, inferSubjectForTopic, subjectTopics, type ExamDef } from './syllabus';
import {
  CUSTOM_EXAM_META_KEY,
  EXAM_LABEL_META_KEY,
  countTopics,
  customExamMetaRows,
  examLabelFromId,
  isCustomExamId,
  resolveExamDef,
} from './customExam';
import CustomExamEntry from './CustomExamEntry';
import {
  aiImproveTask,
  aiStructurePlan,
  localStructurePlan,
  PlanDraftList,
  splitPlanText,
  type PlanDraft,
} from './PlanParser';
import {
  addDaysISO,
  buildAnnotationMap,
  buildDaySchedule,
  buildRevisionDrafts,
  buildTopicSequence,
  computePace,
  dailyFormula,
  dayNumber,
  diffDays,
  dueRevisions as dueRevisionsOf,
  estimatedMinutes,
  formatDuration,
  isTaskType,
  mergeScoreEntries,
  minutesOnDate,
  normalizeTaskType,
  overdueRevisions as overdueRevisionsOf,
  parseOneLiner,
  pickAiTask,
  pickLighterTask,
  proofText,
  revisionIntervalsForFeeling,
  scorePercent,
  taskTypeKey,
  TASK_TYPES,
  todayISO,
  topicKey,
  type MetaRow,
  type ScoreEntry,
  type StudyItem,
  type StudyItemDraft,
  type StudySession,
  type TaskFeeling,
  type TaskType,
  type TestMistake,
  type TestResult,
  type TestScore,
} from './engine';
import {
  buildHoursSnapshot,
  buildMetaMap,
  buildSubjectProgress,
  buildSubjectScores,
  buildWeakAreas,
  computeStreak,
  groupDoubtSignals,
} from './analytics';
import { completionQuote, feelingLowMessage, isStreakMilestone, streakMilestoneQuote, trackQuote } from './quotes';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  BRAND_GRADIENT_DEEP,
  CARD,
  CARD_SHADOW,
  DANGER,
  GLASS_BG,
  MOTION_CSS,
  NAVY,
  NAVY_ALT,
  ON_AMBER,
  ORANGE,
  OVERLAY_BG,
  PAGE_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import {
  AiLimitNotice,
  BarRow,
  Card,
  SectionLabel,
  ShowMoreToggle,
  SubjectDot,
  VicharakAvatar,
  VicharakBottomNav,
  consumeRequestedTab,
  type VicharakTab,
} from './ui';
import {
  LIMIT_MESSAGE,
  // TEMP: Paywall disabled 2026-08-08 — re-enable once payment is ready.
  PAYWALL_DISABLED,
  PRO_INTEREST_META_KEY,
  PRO_PRICE_MONTHLY,
  TRIAL_START_META_KEY,
  computeAiAccess,
  markTrialEndAnnounced,
  planDetail,
  planLabel,
  planStatusLine,
  readAiUsedToday,
  recordAiMessage,
  rememberTrialStart,
  resolveTrialStart,
  shouldAnnounceTrialEnd,
  subscriptionIsPro,
} from './access';
import UpgradeSheet, { type UpgradeReason } from './UpgradeSheet';
import CalendarTab from './CalendarTab';
import DashboardTab, { type MistakeDraft, type ScoreDraft } from './DashboardTab';
import { VicharakThemeProvider, useVicharakTheme } from './ThemeContext';
import DailyMotivationPopup, {
  markDailyPopupSeen,
  readTodaysVibe,
  shouldShowDailyPopup,
  type DailyVibe,
} from './DailyPopup';
import { DurationSheet } from './StudyTime';
import { FocusModeScreen } from './FocusTimer';
import HelpSupportSheet from './HelpSupport';
import {
  FLAG_REVISION_INTERVALS,
  MCQ_LETTERS,
  WEAK_TOPIC_THRESHOLD,
  adaptiveContextForTopic,
  convertFlaggedToMcqs,
  flaggedConceptLabel,
  flaggedDueOn,
  flaggedOptions,
  flaggedReviseCount,
  generateMcqs,
  parseBreakdown,
  percentOf,
  type AttachmentRow,
  type FlaggedMcqShape,
  type FlaggedRow,
  type McqDraft,
  type McqLetter,
  type McqQuestion,
  type TestResultRow,
  type TopicBreakdown,
  type WeeklyTargetRow,
} from './mcq';
import { GenerateQuizSheet, QuizPlayer, type PlayableQuestion, type QuizTarget } from './QuizSheets';
import { TestResultsView, TestRunner, TestSetupSheet, type TestConfig, type TestReview, type TestTopicOption } from './TestMode';
import { WeeklyGoalsCard, inWeek, weekStartISO } from './WeeklyGoals';
import { WeeklyTargetsScreen, chapterKey, type ChapterStat, type FocusChapter } from './WeeklyTargetsScreen';
import { FlagCaptureSheet, FlaggedSection, FlaggedTestSetupSheet, type FlaggedDraft } from './FlaggedQuestions';
import { PhotoTasksSheet } from './PhotoTasks';
import {
  GeneratedTestRunner,
  GenerateTestSheet,
  generateMixedQuestions,
  generateSimilarQuestions,
  questionsFromQueue,
  type GenerateTestMode,
  type GeneratedTestQuestion,
} from './GenerateTest';
import DoubtsTab from './DoubtsTab';
import AddTaskSheet from './AddTaskSheet';
import { chapterWeightage } from './weightage';
import { AttachImageButton, ImageLightbox, ImageThumbStrip, uploadImage } from './Attachments';
import {
  asNumber as engineNumber,
  getReadinessScore,
  getWeakTopics,
  markTopicWeak,
  matchTaskToChapter,
  persistReadiness,
  recordStudySession,
  recordTestResult,
  type ExamProgressRow,
  type ReadinessRow,
  type TopicAttemptRow,
  type WeakTopicInsight,
  type WeakTopicRow,
} from './adaptationEngine';
import {
  assessOnTrack,
  buildDailyPlan,
  buildStudentState,
  describeBacklog,
  formatDailyPlan,
  readinessLine,
  recurringDoubtLine,
  whatShouldIDoNow,
} from './studyEngine';
import {
  EXAM_SYLLABUSES,
  getSyllabus,
  syllabusForProfileExam,
  topicIdFor,
  type ExamSyllabus,
  type SyllabusChapter,
  type SyllabusSubject,
} from './data/syllabuses';
import ExamInsightsCard from './ExamInsights';
import {
  buildExamChatContext,
  CHAT_EXAM_META_KEY,
  detectMentionedTopics,
  ExamContextPill,
  suggestedExamQuestions,
  TopicActionCards,
  type MentionedTopic,
} from './ExamChatSupport';
import SyllabusScreen from './SyllabusScreen';

interface StudentProfile {
  id: number;
  exam: string;
  start_date: string;
  sleep_schedule?: string | null;
  study_hours?: string | null;
  subject_confidence?: string | null;
  coach_notes?: string | null;
}

declare global {
  interface Window {
    useWorkspaceDB: <T = unknown>(
      table: string,
      options?: {
        shared?: boolean;
        limit?: number;
        offset?: number;
        orderBy?: { column: string; direction: 'asc' | 'desc' };
        filters?: Array<{ column: string; operator: string; value: unknown }>;
      },
    ) => {
      data: T[];
      loading: boolean;
      error: Error | null;
      total: number;
      refresh: () => void;
    };
    __workspaceDb: {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<void>;
        update: (id: number, row: Record<string, unknown>) => Promise<void>;
        delete: (id: number) => Promise<void>;
      };
    };
    __signOut?: () => void;
  }
}

/**
 * How many secondary tasks Today shows before the "more waiting" link. Kept
 * deliberately small: the screen promises one mission, not a backlog.
 */
const VISIBLE_LATER_CAP = 3;

/**
 * CHANGE 2: warm, judgment-free completion toasts — rotated in order after
 * every checked-off task. Statements only, never questions.
 */
const ENCOURAGE_MESSAGES = [
  'Nice work! Keep going 🔥',
  "One down — you're building momentum!",
  'Solid! VicharakAI is tracking your progress.',
  'Crossed off — that momentum is real.',
  'Great work — one step closer to exam day.',
] as const;

/**
 * Builds before this date bulk-preloaded syllabus rows without annotations —
 * those stay hidden. Anything created on/after it is a real student task and
 * must always be visible, even when its annotation write failed.
 */
const PRELOAD_ERA_END = '2026-08-09';

type VicharakLanguage = 'english' | 'hindi' | 'hinglish';
type DailySection = 'Revision' | 'Lecture' | 'Self Study';
interface SectionDraft { open: boolean; subject: string; text: string }

/** What the “How long did you study?” sheet is currently recording time against. */
interface DurationPrompt {
  itemId: number | null;
  sourceKey: string | null;
  subject: string | null;
  topic: string | null;
  /** A warm line above the chips — the completion quote, when there is one. */
  note: string | null;
  prefillMinutes: number | null;
}

interface TaskFeedbackRow {
  id: number;
  item_id: number;
  source_key: string;
  subject: string;
  topic: string;
  feeling: TaskFeeling;
  created_on: string;
}

/** One explainability row (zuno_recommendation_log): what was recommended,
 * why, from which data — so "why this topic?" always has a stored answer. */
interface RecommendationLogRow {
  id: number;
  kind: string;
  recommendation: string;
  reason: string;
  data_used?: string | null;
  action_taken?: string | null;
  created_on: string;
}

const LANGUAGE_OPTIONS: Array<{ id: VicharakLanguage; label: string; helper: string }> = [
  { id: 'english', label: 'English', helper: 'Clear and direct' },
  { id: 'hindi', label: 'हिन्दी', helper: 'पूरी बातचीत हिन्दी में' },
  { id: 'hinglish', label: 'Hinglish', helper: 'Casual Hindi + English' },
];

function normalizeLanguage(value: unknown): VicharakLanguage {
  return value === 'hindi' || value === 'hinglish' ? value : 'english';
}

function localizedGreeting(name: string | null, language: VicharakLanguage): string {
  const hour = new Date().getHours();
  const english = hour < 5 ? 'Studying late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const hindi = hour < 5 ? 'देर रात की पढ़ाई' : hour < 12 ? 'सुप्रभात' : hour < 17 ? 'नमस्ते' : 'शुभ संध्या';
  const hinglish = hour < 5 ? 'Late-night padhai' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const part = language === 'hindi' ? hindi : language === 'hinglish' ? hinglish : english;
  return name ? `${part}, ${name} 👋` : `${part} 👋`;
}

function newSectionDrafts(): Record<DailySection, SectionDraft> {
  return {
    Revision: { open: true, subject: '', text: '' },
    Lecture: { open: false, subject: '', text: '' },
    'Self Study': { open: false, subject: '', text: '' },
  };
}

/* ---------- greeting helpers ---------- */

const GENERIC_EMAIL_WORDS = new Set([
  'info', 'hello', 'contact', 'admin', 'test', 'mail', 'email', 'support',
  'student', 'user', 'guest', 'team', 'the', 'and', 'study', 'exam',
]);

function cleanNameWord(raw: string): string | null {
  const word = raw.trim().split(/\s+/)[0];
  if (!/^[a-zA-Z]{2,}$/.test(word)) return null;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function readStoredSession(spaceId: string): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(`space_session_${spaceId}`);
    return stored ? (JSON.parse(stored) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function deriveStudentName(spaceId: string, sessionMetadata: Record<string, unknown>): string | null {
  for (const key of ['firstName', 'first_name', 'name']) {
    const v = sessionMetadata[key];
    if (typeof v === 'string' && v.trim()) {
      const cleaned = cleanNameWord(v);
      if (cleaned) return cleaned;
    }
  }
  const session = readStoredSession(spaceId);
  if (!session) return null;
  const metadata = (session.metadata as Record<string, unknown> | undefined) ?? {};
  for (const v of [session.firstName, session.name, metadata.firstName, metadata.name]) {
    if (typeof v === 'string' && v.trim()) {
      const cleaned = cleanNameWord(v);
      if (cleaned) return cleaned;
    }
  }
  if (typeof session.email === 'string' && session.email.includes('@')) {
    const token = session.email
      .split('@')[0]
      .split(/[._\-+0-9]+/)
      .find((t: string) => /^[a-zA-Z]{3,}$/.test(t) && !GENERIC_EMAIL_WORDS.has(t.toLowerCase()));
    if (token) return cleanNameWord(token);
  }
  return null;
}

function timeOfDayGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const part = hour < 5 ? 'Studying late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name} \uD83D\uDC4B` : `${part} \uD83D\uDC4B`;
}

function typeBadgeIcon(type: TaskType | undefined, kind: 'new' | 'revision') {
  if (kind === 'revision') return <RotateCcw className="w-3 h-3" />;
  if (type === 'Question Practice') return <Trophy className="w-3 h-3" />;
  if (type === 'Lecture') return <Play className="w-3 h-3" />;
  return <BookOpen className="w-3 h-3" />;
}

function typeLabel(type: TaskType | undefined, kind: 'new' | 'revision'): string {
  if (kind === 'revision') return 'Revision';
  return isTaskType(type) ? type : 'Self Study';
}

/** "First revision" / "3-day review" — the human name of a spaced interval. */
function revisionStageLabel(interval: number | null | undefined): string {
  if (interval === 1) return 'First revision';
  if (typeof interval === 'number' && interval > 0) return `${interval}-day review`;
  return 'Review';
}

const IS_IOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const IS_STANDALONE = typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);
/** iOS Safari outside an installed PWA exposes no Notification API at all. */
const IS_IOS_NO_PUSH = IS_IOS && !IS_STANDALONE && typeof Notification === 'undefined';

const inputStyle: CSSProperties = {
  background: NAVY_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS.sm,
  color: TEXT,
  width: '100%',
};

interface CoachMessage {
  role: 'user' | 'coach';
  text: string;
}

const COACH_QUICK_ASKS = [
  'What should I do today?',
  'Am I on track?',
  'What are my weak areas?',
  'Give me a revision plan',
] as const;

function quickAskLabel(question: string, language: VicharakLanguage): string {
  const hindi: Record<string, string> = {
    'What should I do today?': 'आज क्या पढ़ूँ?',
    'Am I on track?': 'क्या मैं सही गति पर हूँ?',
    'What are my weak areas?': 'मेरे कमजोर टॉपिक?',
    'Give me a revision plan': 'रिविज़न प्लान दो',
  };
  const hinglish: Record<string, string> = {
    'What should I do today?': 'Aaj kya karun?',
    'Am I on track?': 'Main track par hoon?',
    'What are my weak areas?': 'Weak topics kaunse hain?',
    'Give me a revision plan': 'Revision plan bana do',
  };
  return language === 'hindi' ? hindi[question] ?? question : language === 'hinglish' ? hinglish[question] ?? question : question;
}

/**
 * CHANGE 1: the coach's action tools — the exact same functions that power
 * the quick-add bar and the checklist, exposed to the AI so it acts directly
 * instead of telling the student to do things manually.
 */
const COACH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: "Add a study task to the student's list for today. Use whenever the student asks to add, queue or plan a topic (e.g. \"add plane motion\").",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The task title, exactly as the student phrased it' },
          subject: { type: 'string', description: 'Optional subject, only when clearly stated' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_task_done',
      description: 'Mark a task on the student\'s list as done (e.g. "mark Optics done", "I finished thermodynamics").',
      parameters: {
        type: 'object',
        properties: { task: { type: 'string', description: 'The task or topic name the student mentioned' } },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_task',
      description: 'Remove a task from the student\'s list (e.g. "remove thermodynamics").',
      parameters: {
        type: 'object',
        properties: { task: { type: 'string', description: 'The task or topic name the student mentioned' } },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_todays_tasks',
      description: "Read out today's task list — pending and completed.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_next',
      description: 'Suggest the single smartest thing to do right now ("what should I do now").',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'postpone_task',
      description: 'Move a pending task or revision to a later day (e.g. "move optics to tomorrow", "push this revision by 2 days"). The engine validates the task exists before anything changes.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The task or topic name the student mentioned' },
          days: { type: 'number', description: 'How many days to push it — 1 (tomorrow) when unspecified' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skip_revision',
      description: 'Skip ONE revision that is due today (e.g. "skip this revision", "I already know optics"). Destructive: only call when the student explicitly asks. Later spaced revisions of the topic stay untouched.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string', description: 'The revision topic to skip; empty means the one due now' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_todays_capacity',
      description: 'Record how much study time the student actually has today (e.g. "I only have 2 hours today", "I am tired, keep it light"). The daily plan re-fits itself to this time.',
      parameters: {
        type: 'object',
        properties: { minutes: { type: 'number', description: 'Available study time today, in minutes' } },
        required: ['minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_backlog',
      description: 'List exactly what the student is behind on — overdue revisions and carried-over tasks, with how late each one is ("show me what I\'m behind on").',
      parameters: { type: 'object', properties: {} },
    },
  },
];

/* ==================================================================== */

export default function Vicharak() {
  return (
    <VicharakThemeProvider>
      <VicharakApp />
    </VicharakThemeProvider>
  );
}

function VicharakApp() {
  const { spaceId, sessionMetadata, setSessionId } = useSpaceRuntime();
  const { mode: themeMode, setMode: setThemeMode } = useVicharakTheme();
  const profileQ = window.useWorkspaceDB<StudentProfile>('zuno_profile', { limit: 1 });
  const itemsQ = window.useWorkspaceDB<StudyItem>('zuno_items', {
    limit: 500,
    orderBy: { column: 'id', direction: 'asc' },
  });
  const metaQ = window.useWorkspaceDB<MetaRow>('zuno_meta', { limit: 200 });
  const scoresQ = window.useWorkspaceDB<TestScore>('zuno_scores', {
    limit: 200,
    orderBy: { column: 'id', direction: 'asc' },
  });
  const resultsQ = window.useWorkspaceDB<TestResult>('zuno_test_scores', {
    limit: 200,
    orderBy: { column: 'id', direction: 'asc' },
  });
  const mistakesQ = window.useWorkspaceDB<TestMistake>('zuno_mistakes', {
    limit: 200,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const sessionsQ = window.useWorkspaceDB<StudySession>('zuno_sessions', {
    limit: 300,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const feedbackQ = window.useWorkspaceDB<TaskFeedbackRow>('zuno_task_feedback', {
    limit: 300,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const mcqQ = window.useWorkspaceDB<McqQuestion>('zuno_mcq_questions', {
    limit: 500,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const testResultsQ = window.useWorkspaceDB<TestResultRow>('zuno_test_results', {
    limit: 100,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const weeklyQ = window.useWorkspaceDB<WeeklyTargetRow>('zuno_weekly_targets', {
    limit: 60,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const attachmentsQ = window.useWorkspaceDB<AttachmentRow>('zuno_attachments', {
    limit: 300,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const flaggedQ = window.useWorkspaceDB<FlaggedRow>('zuno_question_queue', {
    limit: 200,
    orderBy: { column: 'id', direction: 'desc' },
  });
  /* Adaptation engine tables — mastery, attempts, weak topics, readiness. */
  const examProgressQ = window.useWorkspaceDB<ExamProgressRow>('zuno_exam_progress', {
    limit: 400,
    orderBy: { column: 'id', direction: 'asc' },
  });
  const topicAttemptsQ = window.useWorkspaceDB<TopicAttemptRow>('zuno_topic_attempts', {
    limit: 500,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const weakTopicsQ = window.useWorkspaceDB<WeakTopicRow>('zuno_weak_topics', {
    limit: 300,
    orderBy: { column: 'id', direction: 'desc' },
  });
  const readinessQ = window.useWorkspaceDB<ReadinessRow>('zuno_readiness', { limit: 40 });
  /* Explainability log — every important recommendation, with its reason. */
  const recommendationLogQ = window.useWorkspaceDB<RecommendationLogRow>('zuno_recommendation_log', {
    limit: 30,
    orderBy: { column: 'id', direction: 'desc' },
  });

  const today = todayISO();
  const [tab, setTab] = useState<VicharakTab>('today');
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  /* Tasks the student has marked "in session" — the mission or any Today row. */
  const [startedIds, setStartedIds] = useState<Set<number>>(new Set());
  const [showAllLater, setShowAllLater] = useState(false);
  /* Hero pin (#1): a starred task takes the mission slot, remembered per browser. */
  const [heroId, setHeroId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(`vicharak_hero_${spaceId}`);
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });
  /* Subject filter (#4): narrows the Today lists, resets to All on tab change. */
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
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
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [milestoneStreak, setMilestoneStreak] = useState<number | null>(null);
  const ensuredRef = useRef(false);

  /* Study time — the manual sheet stays; the focus-mode timer auto-logs itself. */
  const [durationPrompt, setDurationPrompt] = useState<DurationPrompt | null>(null);
  const [savingDuration, setSavingDuration] = useState(false);
  /* Focus mode — opened from the Dashboard header's Focus button. */
  const [focusOpen, setFocusOpen] = useState(false);

  /* Daily motivation popup — first open of each calendar day */
  const [dailyPopupOpen, setDailyPopupOpen] = useState(false);
  const [todayVibe, setTodayVibe] = useState<DailyVibe | null>(() => readTodaysVibe(today));

  /* Today-screen surfaces that stay folded away until asked for */
  const [reviseOpen, setReviseOpen] = useState(false);
  const [lowMode, setLowMode] = useState(false);

  /* CHANGE 1: the '+' FAB's add-task sheet. */
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [savingNewTask, setSavingNewTask] = useState(false);
  /* CHANGE 6: daily topic check-in — the primary task-entry ritual, once per day. */
  const [checkinVisible, setCheckinVisible] = useState(() => {
    try {
      return localStorage.getItem(`vicharak_checkin_${spaceId}_${today}`) !== '1';
    } catch {
      return true;
    }
  });
  const [checkinText, setCheckinText] = useState('');
  const [checkinSubject, setCheckinSubject] = useState('');
  const [checkinSaving, setCheckinSaving] = useState(false);
  /* FIX 6: the once-per-day carry-over decision for yesterday's unfinished
   * tasks — 'carry' | 'fresh' | 'dismissed', stored with a date key so the
   * modal only ever shows on the FIRST open of a new day. */
  const carryoverDecisionKey = `carryover_decision_${spaceId}_${today}`;
  const [carryoverDecision, setCarryoverDecision] = useState<string | null>(() => {
    try {
      return localStorage.getItem(carryoverDecisionKey);
    } catch {
      return null;
    }
  });
  const [carryoverPromptOpen, setCarryoverPromptOpen] = useState(false);
  const [carryoverBusy, setCarryoverBusy] = useState(false);
  /* Tasks carried into today — rendered inside the "From yesterday" section. */
  const [carriedIds, setCarriedIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`carryover_carried_${spaceId}_${today}`);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []);
    } catch {
      return new Set();
    }
  });
  /* "From yesterday" is collapsed by default. */
  const [fromYesterdayOpen, setFromYesterdayOpen] = useState(false);

  /* CHANGE 3/15: expandable lists on Today — 5 active, 3 completed visible. */
  const [showAllActive, setShowAllActive] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAllFlagged, setShowAllFlagged] = useState(false);
  /* CHANGE 1: rows mid strikethrough animation, before the DB write lands */
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());
  const encourageIndexRef = useRef(0);
  /* CHANGE 6: tapped week-strip day — a popup shows what was completed then */
  const [weekDayDetail, setWeekDayDetail] = useState<string | null>(null);
  /* CHANGE 6: the tapped saved question, opened as a bottom-sheet card */
  const [flaggedDetail, setFlaggedDetail] = useState<FlaggedRow | null>(null);
  const [savingFlaggedDetail, setSavingFlaggedDetail] = useState(false);
  /* FIX 3: Tools tab — menu plus the Weightage / Syllabus views. Road View
   * and Calendar were removed from Tools: the calendar already lives in the
   * bottom nav, so nothing is duplicated or buried. */
  const [toolView, setToolView] = useState<'menu' | 'weightage' | 'syllabus'>('menu');
  const [toolSubject, setToolSubject] = useState('');
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [showAllToolRows, setShowAllToolRows] = useState(false);

  /* onboarding — exam + exam date + Day-1 topics (CHANGE 13); each step skippable */
  const [obStep, setObStep] = useState(1);
  const [obExam, setObExam] = useState<string | null>(null);
  const [obDate, setObDate] = useState('');
  const [obTopics, setObTopics] = useState('');
  const [obCustomExam, setObCustomExam] = useState<ExamDef | null>(null);
  const [obCustomOpen, setObCustomOpen] = useState(false);
  /* CHANGE 11: search + country/category filters over the expanded exam catalogue. */
  const [obSearch, setObSearch] = useState('');
  const [obCountry, setObCountry] = useState('All');
  const [obCategory, setObCategory] = useState('All');
  const [creating, setCreating] = useState(false);
  /* the AI's personalised welcome + first-week plan, shown once onboarding lands */
  const [welcome, setWelcome] = useState<{ loading: boolean; text: string } | null>(null);

  /* compact multi-entry task bottom sheet */
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

  /* fast task creation (#2) + inline task edit (#1) */
  const [quickTitle, setQuickTitle] = useState('');
  /* Smart plan parsing (#2): a pasted block becomes individual, reviewable
   * tasks the student confirms, edits or deletes before anything is saved. */
  const [planDrafts, setPlanDrafts] = useState<PlanDraft[] | null>(null);
  const [parsingPlan, setParsingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [improvingTask, setImprovingTask] = useState(false);
  const [quickSubject, setQuickSubject] = useState('');
  const [editTask, setEditTask] = useState<StudyItem | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskSubject, setEditTaskSubject] = useState('');
  const [editTaskMinutes, setEditTaskMinutes] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  /* adaptive feedback, question capture and focused question sets */
  const [feedbackPrompt, setFeedbackPrompt] = useState<StudyItem | null>(null);
  const [savingFeeling, setSavingFeeling] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  /* flagged-question practice test */
  const [flaggedTestOpen, setFlaggedTestOpen] = useState(false);
  const [flaggedPreparing, setFlaggedPreparing] = useState(false);
  const [flaggedPrepareNote, setFlaggedPrepareNote] = useState<string | null>(null);
  const [flaggedTestError, setFlaggedTestError] = useState<string | null>(null);
  const [activeFlaggedTest, setActiveFlaggedTest] = useState<{
    questions: PlayableQuestion[];
    timeLimitMinutes: number | null;
    flaggedIds: Array<number | null>;
  } | null>(null);
  const adaptiveSyncingRef = useRef(new Set<string>());

  /* MCQ practice, Test Mode, photo tasks, weekly goals and attachments */
  const [quizTarget, setQuizTarget] = useState<QuizTarget | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; questions: PlayableQuestion[] } | null>(null);
  const [testSetupOpen, setTestSetupOpen] = useState(false);
  const [testPreparing, setTestPreparing] = useState(false);
  const [testPrepareNote, setTestPrepareNote] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<{ questions: PlayableQuestion[]; timeLimitMinutes: number | null; curationNotes: string[] } | null>(null);
  const [testReview, setTestReview] = useState<TestReview | null>(null);
  const [photoTasksOpen, setPhotoTasksOpen] = useState(false);
  const [addingPhotoTasks, setAddingPhotoTasks] = useState(false);
  const [weeklyScreenOpen, setWeeklyScreenOpen] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);
  /* The performance dashboard is a bottom-nav tab now (CHANGE 7). */
  const [attachBusy, setAttachBusy] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  /* FIX 8: Generate Test — compiled from the revision queue + saved doubts. */
  const [generateTestOpen, setGenerateTestOpen] = useState(false);
  const [generateTestPreparing, setGenerateTestPreparing] = useState(false);
  const [generateTestError, setGenerateTestError] = useState<string | null>(null);
  const [activeGeneratedTest, setActiveGeneratedTest] = useState<GeneratedTestQuestion[] | null>(null);
  /* FIX 1: Reset All Data / Delete Account — confirmation-gated. */
  const [dangerAction, setDangerAction] = useState<'reset' | 'delete' | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const weeklySyncRef = useRef('');
  const weeklyPromptShownRef = useRef(false);

  /* local PWA notifications */
  const [notificationsOn, setNotificationsOn] = useState(() => localStorage.getItem(`vicharak_notifications_${spaceId}`) === 'on');
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem(`vicharak_reminder_time_${spaceId}`) || '19:00');
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(
    () => localStorage.getItem(`vicharak_notif_banner_${spaceId}`) === 'dismissed',
  );
  const autoNotifRef = useRef(false);

  /* adaptation engine + syllabus browser UI state */
  const [insightsAdding, setInsightsAdding] = useState<string | null>(null);
  const [syllabusBrowserOpen, setSyllabusBrowserOpen] = useState(false);
  const [browserAddingChapter, setBrowserAddingChapter] = useState<string | null>(null);
  const [topicActionBusy, setTopicActionBusy] = useState<string | null>(null);
  const [handledTopicIds, setHandledTopicIds] = useState<Set<string>>(new Set());

  /* coach */
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachThinking, setCoachThinking] = useState(false);
  const coachEndRef = useRef<HTMLDivElement | null>(null);

  /* profile edits */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [goalsDraft, setGoalsDraft] = useState<string | null>(null);
  const [examDateDraft, setExamDateDraft] = useState<string | null>(null);
  const [dailyGoalDraft, setDailyGoalDraft] = useState<string | null>(null);
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingExam, setChangingExam] = useState(false);
  const [examSwitchOpen, setExamSwitchOpen] = useState(false);

  /* help & support — FAQs plus a mailto, opened from the Profile settings list */
  const [helpOpen, setHelpOpen] = useState(false);

  /* plan + today's AI budget */
  const [isPro, setIsPro] = useState(false);
  const [aiUsedToday, setAiUsedToday] = useState(0);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [proInterest, setProInterest] = useState<'idle' | 'saving' | 'saved'>('idle');
  const trialStartWrittenRef = useRef(false);

  const profile = profileQ.data?.[0];
  const items = itemsQ.data || [];
  const mistakes = mistakesQ.data || [];
  const sessions = sessionsQ.data || [];
  const scoreEntries = useMemo(
    () => mergeScoreEntries(resultsQ.data || [], scoresQ.data || []),
    [resultsQ.data, scoresQ.data],
  );
  const day = profile ? dayNumber(profile.start_date, today) : 1;

  const metaMap = useMemo(() => buildMetaMap(metaQ.data ?? []), [metaQ.data]);
  const annotations = useMemo(() => buildAnnotationMap(metaQ.data ?? []), [metaQ.data]);
  const language = normalizeLanguage(metaMap.get('language')?.meta_value);

  /* One exam id, two possible sources: the pre-loaded catalogue, or an exam the
   * student typed in — whose syllabus is stored next to their profile. The draft
   * from onboarding is the third fallback, so the very first render after saving
   * already has a syllabus instead of waiting for the meta query to come back. */
  const storedCustomExam = metaMap.get(CUSTOM_EXAM_META_KEY)?.meta_value ?? null;
  const savedExamLabel = metaMap.get(EXAM_LABEL_META_KEY)?.meta_value?.trim() || '';
  const examDef = useMemo(() => {
    const resolved = resolveExamDef(profile?.exam ?? null, storedCustomExam, today);
    if (resolved) return resolved;
    return obCustomExam && obCustomExam.id === profile?.exam ? obCustomExam : undefined;
  }, [profile?.exam, storedCustomExam, obCustomExam, today]);

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
      // This is checked BEFORE the annotation escape hatch so an annotated but
      // never-completed topic can't sneak into the revision queue.
      if (item.kind === 'revision' && item.status !== 'done') return studiedKeys.has(key);
      if (item.status === 'done' || annotations.has(key)) return true;
      // FIX: a task created after the preload era is a real student task — it
      // shows on Today even when its annotation write failed, so a submitted
      // task can never silently vanish.
      return (item.created_at || '') >= PRELOAD_ERA_END;
    });
  }, [items, annotations]);

  const savedName = metaMap.get('name')?.meta_value || null;
  const sessionName = useMemo(() => deriveStudentName(spaceId, sessionMetadata), [spaceId, sessionMetadata]);
  const studentName = savedName || sessionName;

  const storedExamDate = metaMap.get('exam_date')?.meta_value;
  // Avoid a false setup warning while saved metadata is loading. Pre-loaded exams
  // also carry an official date until the student overrides it.
  const examDateSet = metaQ.loading || Boolean(storedExamDate || examDef);
  const examDate = storedExamDate || (examDef ? defaultExamDate(examDef, today) : addDaysISO(today, 180));
  const goals = metaMap.get('goals')?.meta_value || '';
  const dailyGoal = metaMap.get('goal_daily_hours')?.meta_value || '';
  const weeklyGoal = metaMap.get('goal_weekly_hours')?.meta_value || '';

  /* Recorded study time: today's total, plus the hours half of the pace signal. */
  const todayMinutes = useMemo(() => minutesOnDate(sessions, today), [sessions, today]);
  const hoursSnapshot = useMemo(() => {
    // A goal the student happened to set is used as their target; when there
    // isn't one, computePace infers it from the syllabus instead of asking.
    const goalHours = Number(dailyGoal);
    const target = Number.isFinite(goalHours) && goalHours > 0 ? Math.round(goalHours * 60) : null;
    return buildHoursSnapshot(sessions, today, target);
  }, [sessions, today, dailyGoal]);
  // Pace reads the SAME filtered items every visible surface reads (hidden
  // preload-era rows excluded), so "days behind" always matches the checklist.
  const pace = useMemo(
    () => computePace(studentItems, examDef, examDate, today, hoursSnapshot),
    [studentItems, examDef, examDate, today, hoursSnapshot],
  );
  const daysToExam = Math.max(0, diffDays(today, examDate));

  /* ---------- adaptation engine: active exam, readiness, weak topics ---------- */

  const progressRows = examProgressQ.data ?? [];
  const weakTopicRows = weakTopicsQ.data ?? [];
  const attemptRows = topicAttemptsQ.data ?? [];
  /* The chat pill's explicit pick wins; otherwise the profile exam resolves
   * onto the structured syllabus database (jee → jee_main, neet → neet_ug…). */
  const chatExamPref = metaMap.get(CHAT_EXAM_META_KEY)?.meta_value || null;
  const activeSyllabusExam = useMemo(
    () => (chatExamPref ? getSyllabus(chatExamPref) : undefined) ?? syllabusForProfileExam(profile?.exam ?? null),
    [chatExamPref, profile?.exam],
  );
  const readiness = useMemo(
    () => (activeSyllabusExam ? getReadinessScore(activeSyllabusExam.id, progressRows, activeSyllabusExam) : null),
    [activeSyllabusExam, progressRows],
  );
  const weakTopicInsights = useMemo(
    () => (activeSyllabusExam ? getWeakTopics(activeSyllabusExam.id, weakTopicRows, progressRows, 5, today) : []),
    [activeSyllabusExam, weakTopicRows, progressRows, today],
  );

  /* Keep the zuno_readiness snapshot in sync — one upsert per real change. */
  const readinessSyncRef = useRef('');
  useEffect(() => {
    if (!activeSyllabusExam || !readiness || readinessQ.loading || examProgressQ.loading) return;
    const stamp = `${activeSyllabusExam.id}:${readiness.readinessPct}:${readiness.weakAreas.map((w) => `${w.subject}${w.pct}`).join(',')}`;
    if (readinessSyncRef.current === stamp) return;
    const stored = (readinessQ.data ?? []).find((row) => row.exam_id === activeSyllabusExam.id);
    if (stored && engineNumber(stored.readiness_pct) === readiness.readinessPct) {
      readinessSyncRef.current = stamp;
      return;
    }
    readinessSyncRef.current = stamp;
    void persistReadiness(readiness, readinessQ.data ?? [])
      .then(() => readinessQ.refresh())
      .catch(() => undefined);
  }, [activeSyllabusExam, readiness, readinessQ.loading, examProgressQ.loading, readinessQ.data]);

  /** Completed task → study session on its syllabus chapter (fire-and-forget).
   * Difficulty comes from any recorded feeling for the topic, else 'medium'. */
  const feedAdaptationEngine = (item: StudyItem) => {
    if (!activeSyllabusExam) return;
    const matched = matchTaskToChapter(activeSyllabusExam, item.subject, item.topic);
    if (!matched) return;
    const feeling = feelingByKey.get(item.source_key || topicKey(item.subject, item.topic)) ?? 'medium';
    void recordStudySession(activeSyllabusExam.id, matched.chapterId, [item.topic], feeling, { progressRows })
      .then(() => {
        examProgressQ.refresh();
        topicAttemptsQ.refresh();
      })
      .catch(() => undefined);
  };

  /** Exam Insights → “Study now”: the weak topic becomes a task on Today. */
  const studyWeakTopicNow = async (weak: WeakTopicInsight) => {
    if (insightsAdding) return;
    setInsightsAdding(weak.topicId);
    try {
      const created = await addTask(weak.subjectName || 'General', weak.topicName, 'Revision', true);
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
      const created = await addTask(subject.name, chapter.name, 'Self Study', false);
      showToast(created ? `Added ${chapter.name} to today's plan.` : `${chapter.name} is already on your plan.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setBrowserAddingChapter(null);
    }
  };

  /** Chat topic card → “Add to study plan”. */
  const addTopicToPlanFromChat = async (mention: MentionedTopic) => {
    if (topicActionBusy) return;
    setTopicActionBusy(mention.topicId);
    try {
      const created = await addTask(mention.subjectName, mention.topicName, 'Self Study', true);
      setHandledTopicIds((prev) => new Set(prev).add(mention.topicId));
      showToast(created ? `Added ${mention.topicName} to today's plan.` : `${mention.topicName} is already on your plan.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setTopicActionBusy(null);
    }
  };

  /** Chat topic card → “Mark as weak” (writes zuno_weak_topics). */
  const markTopicWeakFromChat = async (mention: MentionedTopic) => {
    if (topicActionBusy || !activeSyllabusExam) return;
    setTopicActionBusy(mention.topicId);
    try {
      await markTopicWeak(activeSyllabusExam.id, mention.topicId, mention.topicName, { weakRows: weakTopicRows });
      weakTopicsQ.refresh();
      setHandledTopicIds((prev) => new Set(prev).add(mention.topicId));
      showToast(`Marked ${mention.topicName} as weak — it now ranks in your Exam Insights.`);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setTopicActionBusy(null);
    }
  };

  /* ---------- plan: 5-day trial → VicharakAI Free / VicharakAI Pro ---------- */

  const savedTrialStart = metaMap.get(TRIAL_START_META_KEY)?.meta_value || null;
  const trialStart = useMemo(
    () => resolveTrialStart({ spaceId, savedTrialStart, planStartDate: profile?.start_date ?? null, today }),
    [spaceId, savedTrialStart, profile?.start_date, today],
  );
  const access = useMemo(
    () => computeAiAccess({ isPro, trialStart, today, usedToday: aiUsedToday }),
    [isPro, trialStart, today, aiUsedToday],
  );
  const proInterestSaved = proInterest === 'saved' || !!metaMap.get(PRO_INTEREST_META_KEY)?.meta_value;

  // Re-read when the session lands too: the per-student key needs the email.
  useEffect(() => {
    setAiUsedToday(readAiUsedToday(spaceId, today));
  }, [spaceId, today, sessionMetadata]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  /* Tab requests left by a deep link or an older build's bottom nav. */
  useEffect(() => {
    const apply = () => {
      const t = consumeRequestedTab();
      if (t) setTab(t);
    };
    apply();
    window.addEventListener('openApp', apply);
    return () => window.removeEventListener('openApp', apply);
  }, []);

  /* The subject filter always starts fresh on All when the tab changes (#4);
   * the Tools tab also resets to its menu. */
  useEffect(() => {
    setSubjectFilter('All');
    setToolView('menu');
    setShowAllToolRows(false);
    setOpenChapter(null);
  }, [tab]);

  /* Daily motivation popup — once per calendar day, before the tabs. */
  useEffect(() => {
    if (profileQ.loading || !profile) return;
    if (shouldShowDailyPopup(today)) {
      setDailyPopupOpen(true);
    }
  }, [profileQ.loading, profile?.id, today]);

  /* Re-check when returning-user identity arrives. The old mount-only effect
   * often ran before email was restored, leaving paid students on Go Pro. */
  useEffect(() => {
    const session = readStoredSession(spaceId);
    const metadata = (session?.metadata as Record<string, unknown> | undefined) ?? sessionMetadata;
    const email = typeof session?.email === 'string' ? session.email.trim().toLowerCase() : '';
    if (!email.includes('@')) {
      setIsPro(subscriptionIsPro(metadata));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/space/${spaceId}/subscription-status?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          if (!cancelled) setIsPro(subscriptionIsPro(metadata));
          return;
        }
        const data = (await res.json()) as unknown;
        if (!cancelled) setIsPro(subscriptionIsPro(data) || subscriptionIsPro(metadata));
      } catch {
        if (!cancelled) setIsPro(subscriptionIsPro(metadata));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, sessionMetadata]);

  // Heal revision rows for completed work, but never preload syllabus tasks.
  useEffect(() => {
    if (ensuredRef.current) return;
    if (profileQ.loading || itemsQ.loading || !profile) return;
    ensuredRef.current = true;

    void (async () => {
      const inserts: StudyItemDraft[] = [];
      const revKeys = new Set(items.filter((i) => i.kind === 'revision').map((i) => `${i.source_key}|${i.interval_days}`));
      for (const it of items) {
        if (it.kind !== 'new' || it.status !== 'done' || !it.studied_on) continue;
        const key = it.source_key || topicKey(it.subject, it.topic);
        const have = new Set([1, 3, 5, 7, 14].filter((n) => revKeys.has(`${key}|${n}`)));
        for (const draft of buildRevisionDrafts(it, it.studied_on, have)) {
          revKeys.add(`${draft.source_key}|${draft.interval_days}`);
          inserts.push(draft);
        }
      }
      if (inserts.length) {
        await Promise.all(inserts.map((row) => window.__workspaceDb.from('zuno_items').insert(row as Record<string, unknown>)));
        itemsQ.refresh();
      }
    })();
  }, [profileQ.loading, itemsQ.loading, profile?.id]);

  /* Self-heal: a student task whose annotation write failed earlier gets a
   * default one, so its type badge, duration estimate and calendar editing
   * all work again. Runs once per visit, quietly. */
  const annotationHealRef = useRef(false);
  useEffect(() => {
    if (annotationHealRef.current) return;
    if (itemsQ.loading || metaQ.loading || !profile) return;
    const missing = items.filter(
      (item) =>
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
          await window.__workspaceDb.from('zuno_meta').insert({
            meta_key: taskTypeKey(key),
            meta_value: JSON.stringify({ type: parseOneLiner(item.topic, examDef).type, ai: false }),
          });
        }
        metaQ.refresh();
      } catch {
        /* storage hiccup — the next visit tries again */
      }
    })();
  }, [itemsQ.loading, metaQ.loading, profile?.id, items, annotations, examDef]);

  /* ---------- derived queues ---------- */

  const dueRevisions = useMemo(() => dueRevisionsOf(studentItems, today), [studentItems, today]);
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
  /* FIX 6: on the FIRST open of a new day with unfinished tasks from earlier,
   * ask ONCE — carry them over, or start fresh. The stored decision keeps the
   * modal from ever re-appearing the same day. */
  useEffect(() => {
    if (itemsQ.loading || !profile || dailyPopupOpen) return;
    if (carryoverDecision || carryoverPromptOpen) return;
    if (carryOver.length === 0) return;
    setCarryoverPromptOpen(true);
  }, [itemsQ.loading, profile?.id, dailyPopupOpen, carryoverDecision, carryoverPromptOpen, carryOver.length]);
  const doneToday = useMemo(
    () => studentItems.filter((i) => i.status === 'done' && (i.completed_at || '').slice(0, 10) === today),
    [studentItems, today],
  );
  /* CHANGE 2 (smart carryover): overdue tasks are NOT auto-dumped onto Today
   * any more — the checklist holds only what is scheduled for today. Related
   * carryover is offered back via the dismissible banner below. */
  const missionQueue = useMemo(() => {
    const queue = [...todayTargets];
    // A starred task takes the hero slot; everything else keeps plan order (#1).
    if (heroId !== null) {
      const index = queue.findIndex((item) => item.id === heroId);
      if (index > 0) {
        const [pinned] = queue.splice(index, 1);
        queue.unshift(pinned);
      }
    }
    return queue;
  }, [todayTargets, heroId]);
  /* CHANGE 2: only carryover RELATED to today's planned subjects/topics is
   * surfaced (same subject, or meaningful word overlap with a today task).
   * Everything else stays quietly deferred — visible in the calendar, never
   * dumped on Today. */
  const relatedCarryover = useMemo(() => {
    if (todayTargets.length === 0) return [] as StudyItem[];
    const todaySubjects = new Set(todayTargets.map((t) => t.subject.trim().toLowerCase()));
    const todayWords = new Set(
      todayTargets.flatMap((t) => t.topic.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 4),
    );
    return carryOver.filter((item) => {
      if (todaySubjects.has(item.subject.trim().toLowerCase())) return true;
      return item.topic.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && todayWords.has(w));
    });
  }, [carryOver, todayTargets]);
  /* CHANGE 1: the single Today's Tasks checklist — new tasks first, then the
   * day's due revisions. Completed rows stay below with a strikethrough. */
  const checklistPending = useMemo(
    () => [...missionQueue, ...dueRevisions],
    [missionQueue, dueRevisions],
  );
  /* FIX 6: tasks the student carried over render in their own collapsible
   * "From yesterday" section (muted, tagged), not in the main list. */
  const carriedPending = useMemo(
    () => checklistPending.filter((item) => carriedIds.has(item.id)),
    [checklistPending, carriedIds],
  );
  const mainPending = useMemo(
    () => checklistPending.filter((item) => !carriedIds.has(item.id)),
    [checklistPending, carriedIds],
  );
  /* CHANGE 1: once a completing row has really left the pending list (the DB
   * write landed and the query refreshed), drop its animation flag. */
  useEffect(() => {
    if (completingIds.size === 0) return;
    const pendingIds = new Set(checklistPending.map((item) => item.id));
    const stale = Array.from(completingIds).filter((id) => !pendingIds.has(id));
    if (stale.length === 0) return;
    setCompletingIds((prev) => {
      const next = new Set(prev);
      for (const id of stale) next.delete(id);
      return next;
    });
  }, [checklistPending, completingIds]);
  const feelingByKey = useMemo(() => {
    const map = new Map<string, TaskFeeling>();
    for (const row of feedbackQ.data ?? []) if (!map.has(row.source_key)) map.set(row.source_key, row.feeling);
    return map;
  }, [feedbackQ.data]);
  const formula = useMemo(() => dailyFormula(studentItems, today, feelingByKey), [studentItems, today, feelingByKey]);
  const taskDetails = useMemo(() => Object.fromEntries(annotations.entries()), [annotations]);
  const streak = useMemo(() => computeStreak(studentItems, today), [studentItems, today]);

  /* Tools tab — Syllabus and Weightage views read coverage from here. */
  const doneTopicKeys = useMemo(
    () => new Set(
      studentItems
        .filter((i) => i.kind === 'new' && i.status === 'done')
        .map((i) => i.source_key || topicKey(i.subject, i.topic)),
    ),
    [studentItems],
  );

  /* ---------- MCQ bank, attachments, weekly goals: derived views ---------- */

  const mcqBank = mcqQ.data ?? [];
  const testResults = testResultsQ.data ?? [];
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
  const weeklyRow = useMemo(
    () => (weeklyQ.data ?? []).find((row) => row.week_start_date === weekStart) ?? null,
    [weeklyQ.data, weekStart],
  );
  const lastWeekRow = useMemo(
    () => (weeklyQ.data ?? []).find((row) => row.week_start_date === addDaysISO(weekStart, -7)) ?? null,
    [weeklyQ.data, weekStart],
  );
  const weeklyTopicsDone = useMemo(
    () =>
      studentItems.filter(
        (i) => i.kind === 'new' && i.status === 'done' && !!i.completed_at && inWeek((i.completed_at || '').slice(0, 10), weekStart),
      ).length,
    [studentItems, weekStart],
  );
  const weeklyTestsDone = useMemo(
    () => testResults.filter((row) => inWeek(row.created_on, weekStart)).length,
    [testResults, weekStart],
  );

  /* CHANGE 6: completions keyed by the calendar day they happened on — feeds
   * the Mon–Sun strip and its "what did I do that day" popup. */
  const completedByDate = useMemo(() => {
    const map = new Map<string, StudyItem[]>();
    for (const item of studentItems) {
      if (item.status !== 'done' || !item.completed_at) continue;
      const date = item.completed_at.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    }
    return map;
  }, [studentItems]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);

  /* The flagged-question pool — only rows still queued (correct answers clear them). */
  const flaggedRows = useMemo(
    () => (flaggedQ.data ?? []).filter((row) => row.status === 'queued'),
    [flaggedQ.data],
  );

  /* CHANGE 6: only questions DUE by their spaced schedule (1-3-7-14-30 days)
   * surface on Today — the section hides entirely when nothing is due. */
  const dueFlagged = useMemo(
    () => flaggedRows.filter((row) => flaggedDueOn(row, today)),
    [flaggedRows, today],
  );

  /* This week's focus chapters (student- or AI-picked), parsed defensively. */
  const focusChapters = useMemo<FocusChapter[]>(() => {
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
  }, [weeklyRow]);
  const focusReason = weeklyRow?.focus_reason ?? null;

  /* Per-chapter stats for Weekly Targets: accuracy folded from test-result
   * breakdowns (topics mapped into their syllabus chapter) + topic coverage. */
  const chapterStats = useMemo(() => {
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
  }, [examDef, studentItems, testResults]);

  /* "AI focus this week" on Today — saved focus chapters first, else the 2–3
   * weakest tested topics (accuracy < 60%), never more than three chips. */
  const aiFocusChips = useMemo(() => {
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
  }, [focusChapters, testResults]);

  /* Test Mode topic picker: the student's own topics, plus bank coverage counts. */
  const testTopicOptions = useMemo(() => {
    const seen = new Map<string, TestTopicOption>();
    for (const item of studentItems) {
      if (item.kind !== 'new') continue;
      const key = item.source_key || topicKey(item.subject, item.topic);
      if (!seen.has(key)) seen.set(key, { subject: item.subject, topic: item.topic, key, bankCount: 0 });
    }
    for (const q of mcqBank) {
      const key = q.source_key || topicKey(q.subject, q.topic);
      const existing = seen.get(key);
      if (existing) existing.bankCount += 1;
      else seen.set(key, { subject: q.subject, topic: q.topic, key, bankCount: 1 });
    }
    return Array.from(seen.values());
  }, [studentItems, mcqBank]);

  /* Personalised subject chips (#2): the student's own tasks first, then the exam's. */
  const quickAddSubjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of studentItems) {
      const name = item.subject.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const fromTasks = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const fromExam = (examDef?.subjects.map((s) => s.name) ?? []).filter((name) => !counts.has(name));
    return [...fromTasks, ...fromExam].slice(0, 6);
  }, [studentItems, examDef]);

  /* Filter chips (#4): "All" + every subject with something on today's plate. */
  const filterSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const item of [...missionQueue, ...dueRevisions, ...doneToday]) set.add(item.subject);
    return Array.from(set);
  }, [missionQueue, dueRevisions, doneToday]);

  /* Estimated clock for today — shared by the Road timeline and reminders (#3, #6). */
  const daySchedule = useMemo(
    () => buildDaySchedule(
      [...dueRevisions, ...missionQueue],
      (item) => annotations.get(item.source_key || topicKey(item.subject, item.topic)),
    ),
    [dueRevisions, missionQueue, annotations],
  );

  /* Keep already-created revision rows aligned with the latest difficulty signal. */
  useEffect(() => {
    const updates: Array<Promise<void>> = [];
    for (const [key, feeling] of feelingByKey) {
      if (adaptiveSyncingRef.current.has(key)) continue;
      const revisions = studentItems
        .filter((item) => item.kind === 'revision' && item.status === 'pending' && item.source_key === key && item.studied_on)
        .sort((a, b) => (a.interval_days ?? 0) - (b.interval_days ?? 0));
      const desired = revisionIntervalsForFeeling(feeling);
      const changed = revisions.filter((item, index) => item.studied_on && item.scheduled_for !== addDaysISO(item.studied_on, desired[index] ?? desired[desired.length - 1]));
      if (changed.length === 0) continue;
      adaptiveSyncingRef.current.add(key);
      updates.push(
        Promise.all(changed.map((item) => {
          const index = revisions.findIndex((revision) => revision.id === item.id);
          return window.__workspaceDb.from('zuno_items').update(item.id, {
            scheduled_for: addDaysISO(item.studied_on as string, desired[index] ?? desired[desired.length - 1]),
          });
        })).then(() => undefined).finally(() => adaptiveSyncingRef.current.delete(key)),
      );
    }
    if (updates.length > 0) void Promise.all(updates).then(() => itemsQ.refresh());
  }, [feelingByKey, studentItems]);

  /* Browser/PWA reminders: immediate revision alert plus the chosen daily time. */
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (notificationsOn && Notification.permission !== 'granted') {
      setNotificationsOn(false);
      localStorage.setItem(`vicharak_notifications_${spaceId}`, 'off');
    }
  }, [notificationsOn, spaceId]);

  /* Auto-enable reminders (#6): ask once, as soon as the student has a plan.
   * Granted → reminders just work; dismissed or denied → the Today banner
   * offers a retry and the Profile toggle stays available. An explicit "off"
   * choice is always respected. */
  useEffect(() => {
    if (autoNotifRef.current || !profile || typeof Notification === 'undefined') return;
    autoNotifRef.current = true;
    if (Notification.permission === 'granted') {
      if (localStorage.getItem(`vicharak_notifications_${spaceId}`) !== 'off') {
        setNotificationsOn(true);
        localStorage.setItem(`vicharak_notifications_${spaceId}`, 'on');
      }
      return;
    }
    if (Notification.permission === 'denied') return;
    if (localStorage.getItem(`vicharak_notif_prompted_${spaceId}`)) return;
    localStorage.setItem(`vicharak_notif_prompted_${spaceId}`, '1');
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setNotificationsOn(true);
        localStorage.setItem(`vicharak_notifications_${spaceId}`, 'on');
      }
    });
  }, [profile?.id, spaceId]);

  useEffect(() => {
    if (!notificationsOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const revisionKey = `vicharak_revision_notice_${spaceId}_${today}`;
    const dueCount = formula.filter((entry) => !entry.recall).length;
    if (dueCount > 0 && localStorage.getItem(revisionKey) !== 'sent') {
      new Notification('Revision due today', { body: `${dueCount} spaced revision${dueCount === 1 ? '' : 's'} are ready in VicharakAI.` });
      localStorage.setItem(revisionKey, 'sent');
    }
  }, [notificationsOn, formula, spaceId, today]);

  const missionQueueRef = useRef(missionQueue);
  missionQueueRef.current = missionQueue;
  const dayTaskCountRef = useRef(0);
  dayTaskCountRef.current = missionQueue.length + dueRevisions.length;
  const missionReminderTag = `vicharak-mission-reminder-${spaceId}`;
  const nextReminderDate = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours || 0, minutes || 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    return next;
  };
  const showMissionReminder = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const mission = missionQueueRef.current[0];
      new Notification("Today's VicharakAI mission", {
        body: mission ? `${mission.subject}: ${mission.topic}` : 'Open your plan and set one clear task for today.',
      });
    } catch {
      /* Permission can be revoked while an open-tab reminder is waiting. */
    }
  };
  const cancelPersistentMissionReminder = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      const scheduled = await registration.getNotifications({ tag: missionReminderTag });
      scheduled.forEach((notification) => notification.close());
    } catch {
      /* No active service worker — the in-tab fallback remains available. */
    }
  };
  const scheduleMissionReminder = async (): Promise<() => void> => {
    const at = nextReminderDate(reminderTime);
    const TimestampTrigger = (globalThis as typeof globalThis & {
      TimestampTrigger?: new (timestamp: number) => unknown;
    }).TimestampTrigger;

    if ('serviceWorker' in navigator && TimestampTrigger) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const scheduled = await registration.getNotifications({ tag: missionReminderTag });
          scheduled.forEach((notification) => notification.close());
          await registration.showNotification("Today's VicharakAI mission", {
            tag: missionReminderTag,
            body: 'Open VicharakAI for today\'s mission.',
            trigger: new TimestampTrigger(at.getTime()),
          } as NotificationOptions);
          return () => {
            void registration.getNotifications({ tag: missionReminderTag }).then((notifications) => {
              notifications.forEach((notification) => notification.close());
            });
          };
        }
      } catch {
        /* Notification Triggers are optional; fall through to an open-tab timer. */
      }
    }

    const timeout = window.setTimeout(showMissionReminder, Math.max(0, at.getTime() - Date.now()));
    return () => window.clearTimeout(timeout);
  };

  useEffect(() => {
    if (!notificationsOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined;
    let cancelled = false;
    let cleanup = () => undefined;
    void scheduleMissionReminder().then((scheduledCleanup) => {
      if (cancelled) scheduledCleanup();
      else cleanup = scheduledCleanup;
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [notificationsOn, reminderTime, spaceId, today]);

  /* Task-by-task reminders (#6): 15 minutes before each estimated start, plus
   * an 8am morning summary. Open-tab timers, deduped per day via localStorage. */
  useEffect(() => {
    if (!notificationsOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined;
    const timeouts: number[] = [];
    const fire = (title: string, body: string, dedupeKey: string) => {
      try {
        if (localStorage.getItem(dedupeKey)) return;
        localStorage.setItem(dedupeKey, '1');
        const notice = new Notification(title, { body });
        notice.onclick = () => {
          try {
            window.focus();
          } catch {
            /* focus can be refused */
          }
          notice.close();
        };
      } catch {
        /* Notification construction can throw on some mobile browsers. */
      }
    };
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    for (const slot of daySchedule) {
      if (slot.item.status !== 'pending') continue;
      const delay = midnight.getTime() + (slot.startMinutes - 15) * 60000 - Date.now();
      if (delay <= 0 || delay > 86400000) continue;
      timeouts.push(window.setTimeout(() => fire(
        `Up next: ${slot.item.topic}`,
        `${slot.item.subject} · about ${formatDuration(slot.durationMinutes)} — starts in 15 minutes. Tap to open VicharakAI.`,
        `vicharak_task_notice_${spaceId}_${slot.item.id}_${today}`,
      ), delay));
    }
    const summarize = () => {
      const count = dayTaskCountRef.current;
      if (count > 0) {
        fire(
          '\uD83D\uDCDA Your VicharakAI day is ready',
          `You have ${count} task${count === 1 ? '' : 's'} today — tap to open VicharakAI.`,
          `vicharak_daily_summary_${spaceId}_${todayISO()}`,
        );
      }
    };
    const now = new Date();
    const eightToday = new Date();
    eightToday.setHours(8, 0, 0, 0);
    // Opening after 8am (but before noon) still earns today's summary, once.
    if (now.getTime() >= eightToday.getTime() && now.getHours() < 12) {
      timeouts.push(window.setTimeout(summarize, 4000));
    }
    const nextEight = new Date(eightToday);
    if (nextEight.getTime() <= now.getTime()) nextEight.setDate(nextEight.getDate() + 1);
    timeouts.push(window.setTimeout(summarize, nextEight.getTime() - Date.now()));
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [notificationsOn, daySchedule, spaceId, today]);

  const subjectProgress = useMemo(() => buildSubjectProgress(examDef, studentItems), [examDef, studentItems]);
  const subjectScores = useMemo(() => buildSubjectScores(scoreEntries), [scoreEntries]);
  /* Doubts are weak-area signals: a saved doubt about Kirchhoff's Laws flags
   * Current Electricity, so the coach and the pickers prioritise it. */
  const weakAreas = useMemo(
    () => buildWeakAreas(scoreEntries, subjectScores, mistakes, flaggedRows),
    [scoreEntries, subjectScores, mistakes, flaggedRows],
  );
  const leastCoveredSubject = useMemo(
    () => [...subjectProgress].sort((a, b) => a.percent - b.percent)[0]?.subject ?? null,
    [subjectProgress],
  );

  /* ---------- unified student state (deterministic study engine) ----------
   * ONE snapshot assembled from the same rows every screen already reads —
   * Today, the coach's quick answers and the AI context all consume it, so
   * no feature can ever show a number that disagrees with another. */

  /* "I only have 2 hours today" — an explicit per-day capacity override the
   * coach writes into zuno_meta; it expires naturally with the date key. */
  const capacityOverrideMinutes = useMemo(() => {
    const raw = metaMap.get(`capacity_${today}`)?.meta_value;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }, [metaMap, today]);

  const studentState = useMemo(
    () =>
      buildStudentState({
        items: studentItems,
        annotations,
        sessions,
        scoreEntries,
        testResults,
        doubts: flaggedRows,
        feelings: feelingByKey,
        weakInsights: weakTopicInsights,
        readiness,
        examDef,
        examId: profile?.exam ?? 'general',
        examDate,
        today,
        dailyGoalMinutes: (() => {
          const hours = Number(dailyGoal);
          return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
        })(),
        capacityOverrideMinutes,
      }),
    [studentItems, annotations, sessions, scoreEntries, testResults, flaggedRows, feelingByKey, weakTopicInsights, readiness, examDef, profile?.exam, examDate, today, dailyGoal, capacityOverrideMinutes],
  );
  /* Capacity-aware MUST DO / SHOULD DO / IF TIME plan — never an impossible day. */
  const dailyPlan = useMemo(() => buildDailyPlan(studentState), [studentState]);
  /* The "what should I do now?" pick, computed from actual current state. */
  const nowPick = useMemo(() => whatShouldIDoNow(studentState), [studentState]);
  /* The multi-signal "Am I on track?" verdict (never just the streak). */
  const onTrack = useMemo(() => assessOnTrack(studentState, pace), [studentState, pace]);

  /** Explainability: store what was recommended, why, and from which data. */
  const logRecommendation = (
    kind: string,
    recommendation: string,
    reason: string,
    dataUsed: string,
    actionTaken: string,
  ) => {
    void window.__workspaceDb
      .from('zuno_recommendation_log')
      .insert({ kind, recommendation, reason, data_used: dataUsed, action_taken: actionTaken, created_on: today })
      .then(() => recommendationLogQ.refresh())
      .catch(() => undefined);
  };

  /* The day's plan is logged once per day — so "why this plan?" always has a
   * stored, data-grounded answer, even after the plan itself has moved on. */
  const planLogRef = useRef('');
  useEffect(() => {
    if (!profile || itemsQ.loading || recommendationLogQ.loading) return;
    if (dailyPlan.mustDo.length === 0) return;
    const stamp = `${today}:${dailyPlan.mustDo.map((entry) => entry.item.id).join(',')}`;
    if (planLogRef.current === stamp) return;
    planLogRef.current = stamp;
    const already = (recommendationLogQ.data ?? []).some((row) => row.kind === 'daily-plan' && row.created_on === today);
    if (already) return;
    logRecommendation(
      'daily-plan',
      dailyPlan.mustDo.map((entry) => entry.item.topic).join(' · '),
      dailyPlan.mustDo.map((entry) => entry.reasons[0] ?? '').filter(Boolean).join(' · '),
      `capacity ~${dailyPlan.capacityMinutes}m (${dailyPlan.capacitySource}) · ${studentState.dueRevisions.length} revisions due · ${studentState.overdueTasks.length} carried tasks`,
      'planned',
    );
  }, [profile?.id, itemsQ.loading, recommendationLogQ.loading, dailyPlan, today]);

  /* CHANGE 5: VicharakAI's proactive "what to do now" pick — deterministic,
   * built from the student's own data, shown while nothing is in session. */
  const nowSuggestion = useMemo(() => {
    // The deterministic study engine's pick — the spec'd priority ladder:
    // critical overdue revision → high-value weak topic → exam-critical
    // unfinished topic → today's task → recurring doubt → a test.
    if (nowPick) return `${nowPick.headline} ${nowPick.reason}`;
    if (flaggedRows.length > 0) {
      return flaggedRows.length === 1
        ? 'Nothing queued — revise the question you saved below.'
        : `Nothing queued — revise one of your ${flaggedRows.length} saved questions below.`;
    }
    if (weakAreas.length > 0) {
      return `Nothing queued — ${weakAreas[0].label} is your weakest area right now; ask the coach and it lands on your plan.`;
    }
    return null;
  }, [nowPick, flaggedRows, weakAreas]);

  const tomorrowPicks = useMemo(() => {
    if (!examDef) return [] as Array<{ subject: string; topic: string; reason: string }>;
    const picks: Array<{ subject: string; topic: string; reason: string }> = [];
    const seen = new Set<string>();
    const add = (subject: string, topic: string, reason: string) => {
      const key = topicKey(subject, topic);
      if (!seen.has(key)) {
        seen.add(key);
        picks.push({ subject, topic, reason });
      }
    };
    const tomorrow = addDaysISO(today, 1);
    studentItems
      .filter((item) => item.status === 'pending' && item.scheduled_for === tomorrow)
      .forEach((item) => add(item.subject, item.topic, 'already queued for tomorrow'));
    // Chapters the student's saved doubts flag come right after what's already
    // queued — a doubt about Kirchhoff's Laws pushes Current Electricity up.
    groupDoubtSignals(flaggedRows)
      .slice(0, 2)
      .forEach((g) =>
        add(
          g.subject,
          g.chapter,
          g.count === 1 ? 'you saved a doubt here — clear the weak spot' : `${g.count} saved doubts flag this — clear the weak spot`,
        ),
      );
    overdueRevisions.slice(0, 1).forEach((item) => add(item.subject, item.topic, 'a revision is due'));
    const assigned = new Set(studentItems.map((item) => item.source_key || topicKey(item.subject, item.topic)));
    const fresh = buildTopicSequence(examDef).filter((entry) => !assigned.has(topicKey(entry.subject, entry.topic)));
    fresh
      .sort((a, b) => Number(b.subject === leastCoveredSubject) - Number(a.subject === leastCoveredSubject))
      .slice(0, 4)
      .forEach((entry) => add(entry.subject, entry.topic, entry.subject === leastCoveredSubject ? 'closes your biggest coverage gap' : 'keeps your syllabus moving'));
    return picks.slice(0, 3);
  }, [examDef, studentItems, overdueRevisions, leastCoveredSubject, flaggedRows, today]);

  const hasTaskDraft = Object.values(taskSections).some((section) => section.text.trim());
  const ambientSuggestion = hasTaskDraft && !ambientDismissed
    ? overdueRevisions[0]
      ? { section: 'Revision' as DailySection, subject: overdueRevisions[0].subject, topic: overdueRevisions[0].topic, reason: 'This revision is due from your 1-3-5-7 cycle.' }
      : tomorrowPicks[0]
        ? { section: 'Self Study' as DailySection, ...tomorrowPicks[0] }
        : null
    : null;

  useEffect(() => {
    if (!profile || !isStreakMilestone(streak)) return;
    const flag = `vicharak_streak_milestone_${streak}`;
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch {
      return;
    }
    setMilestoneStreak(streak);
  }, [streak, profile]);

  /* Weekly counters also live on the row (topics_done / tests_done) — keep them
   * synced to the live numbers derived from the actual data, one write per change. */
  useEffect(() => {
    if (!weeklyRow) return;
    const storedTopics = Number(weeklyRow.topics_done ?? 0);
    const storedTests = Number(weeklyRow.tests_done ?? 0);
    const stamp = `${weeklyRow.id}:${weeklyTopicsDone}:${weeklyTestsDone}`;
    if ((storedTopics === weeklyTopicsDone && storedTests === weeklyTestsDone) || weeklySyncRef.current === stamp) return;
    weeklySyncRef.current = stamp;
    void window.__workspaceDb
      .from('zuno_weekly_targets')
      .update(weeklyRow.id, { topics_done: weeklyTopicsDone, tests_done: weeklyTestsDone })
      .then(() => weeklyQ.refresh())
      .catch(() => undefined);
  }, [weeklyRow, weeklyTopicsDone, weeklyTestsDone]);

  /* First open of a new week without targets → offer the goals sheet, once. */
  useEffect(() => {
    if (!profile || weeklyQ.loading || weeklyRow || dailyPopupOpen || weeklyPromptShownRef.current) return;
    const flag = `vicharak_weekly_prompt_${spaceId}_${weekStart}`;
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch {
      return;
    }
    weeklyPromptShownRef.current = true;
    setWeeklyScreenOpen(true);
  }, [profile?.id, weeklyQ.loading, weeklyRow, dailyPopupOpen, spaceId, weekStart]);

  /* FIX 6: the one-time daily carry-over decision. "Carry them over" moves
   * yesterday's unfinished tasks onto today (into the "From yesterday"
   * section); "Start fresh" archives them as skipped — never resurfaced. */
  const rememberCarryoverDecision = (decision: string) => {
    setCarryoverDecision(decision);
    try {
      localStorage.setItem(carryoverDecisionKey, decision);
    } catch {
      /* state alone still prevents a re-ask this visit */
    }
  };

  const dismissCarryoverPrompt = () => {
    setCarryoverPromptOpen(false);
    rememberCarryoverDecision('dismissed');
  };

  const decideCarryover = async (decision: 'carry' | 'fresh') => {
    if (carryoverBusy) return;
    const tasks = [...carryOver];
    if (tasks.length === 0) {
      dismissCarryoverPrompt();
      return;
    }
    setCarryoverBusy(true);
    try {
      if (decision === 'carry') {
        await Promise.all(
          tasks.map((item) =>
            window.__workspaceDb.from('zuno_items').update(item.id, { scheduled_for: today, day_number: day }),
          ),
        );
        const ids = new Set(tasks.map((task) => task.id));
        setCarriedIds(ids);
        try {
          localStorage.setItem(`carryover_carried_${spaceId}_${today}`, JSON.stringify(Array.from(ids)));
        } catch {
          /* the section still renders for this visit */
        }
        showToast(`Carried ${tasks.length} task${tasks.length === 1 ? '' : 's'} over — find them under “From yesterday”.`);
      } else {
        // Archive: skipped tasks never surface on Today again.
        await Promise.all(
          tasks.map((item) => window.__workspaceDb.from('zuno_items').update(item.id, { status: 'skipped' })),
        );
        showToast("Starting fresh — yesterday's unfinished tasks are archived.");
      }
      itemsQ.refresh();
      rememberCarryoverDecision(decision);
      setCarryoverPromptOpen(false);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setCarryoverBusy(false);
    }
  };

  /* FIX 6: carried tasks can be deleted normally from "From yesterday". */
  const deleteCarriedTask = async (item: StudyItem) => {
    if (busyIds.has(item.id)) return;
    setBusy(item.id, true);
    try {
      const db = window.__workspaceDb.from('zuno_items');
      await db.delete(item.id);
      if (item.kind === 'new') {
        const key = item.source_key || topicKey(item.subject, item.topic);
        const pendingRevs = items.filter((i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending');
        await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
      }
      itemsQ.refresh();
      showToast('Task removed.');
    } finally {
      setBusy(item.id, false);
    }
  };

  /* ---------- shared actions ---------- */

  const showToast = (text: string, undo: (() => void) | null = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(text);
    setToastUndo(() => undo);
    toastTimerRef.current = setTimeout(() => {
      setToastText(null);
      setToastUndo(null);
    }, undo ? 5200 : 2500);
  };

  const setBusy = (id: number, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * The moment something is checked off, ask for the one number VicharakAI
   * can't infer. The task is already saved by then, so this never blocks the
   * completion — and if the optional timer was running, its reading arrives
   * pre-filled.
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

  /**
   * The study-time chip: a log that stands on its own, so time spent on
   * something that was never a task still counts. A timer that has been
   * running arrives pre-filled and credited to the task it was measuring —
   * otherwise its reading would only be bankable by checking that task off.
   */
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
      await window.__workspaceDb.from('zuno_sessions').insert({
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

  const saveFeeling = async (feeling: TaskFeeling) => {
    if (!feedbackPrompt || savingFeeling) return;
    const item = feedbackPrompt;
    const key = item.source_key || topicKey(item.subject, item.topic);
    setSavingFeeling(true);
    try {
      await window.__workspaceDb.from('zuno_task_feedback').insert({
        item_id: item.id,
        source_key: key,
        subject: item.subject,
        topic: item.topic,
        feeling,
        created_on: today,
      });
      const revisions = studentItems
        .filter((row) => row.kind === 'revision' && row.status === 'pending' && row.source_key === key && row.studied_on)
        .sort((a, b) => (a.interval_days ?? 0) - (b.interval_days ?? 0));
      const desired = revisionIntervalsForFeeling(feeling);
      await Promise.all(revisions.map((row, index) => window.__workspaceDb.from('zuno_items').update(row.id, {
        scheduled_for: addDaysISO(row.studied_on as string, desired[index] ?? desired[desired.length - 1]),
      })));
      feedbackQ.refresh();
      itemsQ.refresh();
      setFeedbackPrompt(null);
      promptForDuration(item);
      showToast(feeling === 'hard' ? "Noted — this comes back sooner." : feeling === 'easy' ? "Got it — I'll space this one further out." : 'Saved — the standard revision rhythm stays on.');
    } catch {
      showToast("That signal didn't save — mind tapping it once more?");
    } finally {
      setSavingFeeling(false);
    }
  };

  /** One re-usable enable path — the banner, the auto-prompt fallback and the
   * Profile toggle all land here (#6). */
  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast(IS_IOS
        ? 'On iPhone, add VicharakAI to your Home Screen first (Share → Add to Home Screen) — then reminders can reach you.'
        : 'Notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Allow notifications in your browser settings to turn reminders on.');
      return;
    }
    setNotificationsOn(true);
    localStorage.setItem(`vicharak_notifications_${spaceId}`, 'on');
    showToast('Reminders are on — 15 minutes before each task, plus a morning summary.');
  };

  const toggleNotifications = async () => {
    if (notificationsOn) {
      setNotificationsOn(false);
      localStorage.setItem(`vicharak_notifications_${spaceId}`, 'off');
      void cancelPersistentMissionReminder();
      return;
    }
    await enableNotifications();
  };

  /* ---------- doubt questions: capture → queue → practice test ---------- */

  /** CHANGE 4: save the question exactly as the student entered it — typed
   * text and/or a photo, filed under their chosen subject. No AI processing
   * on add; it shows in the Today screen's Question Revision section. */
  const saveFlagged = async (draft: FlaggedDraft) => {
    if (savingFlag) return;
    setSavingFlag(true);
    try {
      await window.__workspaceDb.from('zuno_question_queue').insert({
        source_type: draft.sourceType,
        subject: draft.subject,
        topic: draft.topic.trim() || null,
        question_text: draft.question.trim(),
        image_url: draft.imageUrl,
        status: 'queued',
        created_on: today,
        options_json: draft.options ? JSON.stringify(draft.options) : null,
        correct: draft.correct,
        concept: draft.concept.trim() || null,
        difficulty: draft.difficulty || null,
        // CHANGE 6: spaced repetition — the question first comes due tomorrow.
        revise_count: 0,
        next_revision_on: addDaysISO(today, FLAG_REVISION_INTERVALS[0]),
      });
      flaggedQ.refresh();
      setFlagOpen(false);
      showToast(`Saved under ${draft.subject || 'General'} — it comes back tomorrow for revision.`);
    } catch {
      showToast("That question didn't save — mind tapping it once more?");
    } finally {
      setSavingFlag(false);
    }
  };

  const removeFlagged = async (row: FlaggedRow) => {
    await window.__workspaceDb.from('zuno_question_queue').delete(row.id);
    flaggedQ.refresh();
    showToast('Removed from your question list.');
  };

  /** CHANGE 6: "Got it" — the question moves to its next spaced interval
   * (1 → 3 → 7 → 14 → 30 days); after the last one it clears for good. */
  const advanceFlagged = async (row: FlaggedRow) => {
    if (savingFlaggedDetail) return;
    setSavingFlaggedDetail(true);
    try {
      const nextIndex = flaggedReviseCount(row) + 1;
      if (nextIndex >= FLAG_REVISION_INTERVALS.length) {
        await window.__workspaceDb.from('zuno_question_queue').update(row.id, {
          status: 'cleared',
          revise_count: nextIndex,
          last_revised_on: today,
        });
        showToast('That question is mastered — it leaves your revision loop.');
      } else {
        const days = FLAG_REVISION_INTERVALS[nextIndex];
        await window.__workspaceDb.from('zuno_question_queue').update(row.id, {
          revise_count: nextIndex,
          last_revised_on: today,
          next_revision_on: addDaysISO(today, days),
        });
        showToast(`Nice — it comes back in ${days} day${days === 1 ? '' : 's'}.`);
      }
      flaggedQ.refresh();
      setFlaggedDetail(null);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setSavingFlaggedDetail(false);
    }
  };

  /** CHANGE 6: "Revise again" — back tomorrow, without advancing the spacing. */
  const repeatFlagged = async (row: FlaggedRow) => {
    if (savingFlaggedDetail) return;
    setSavingFlaggedDetail(true);
    try {
      await window.__workspaceDb.from('zuno_question_queue').update(row.id, {
        last_revised_on: today,
        next_revision_on: addDaysISO(today, 1),
      });
      flaggedQ.refresh();
      setFlaggedDetail(null);
      showToast('No stress — it comes back tomorrow.');
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setSavingFlaggedDetail(false);
    }
  };

  /** Any practice question answered wrong is auto-added to the revision queue —
   * silently, no confirmation prompt. A previously cleared duplicate re-queues
   * instead of piling up as a second row. */
  const autoQueueWrongQuestion = async (question: PlayableQuestion) => {
    const stem = question.question.trim();
    if (!stem) return;
    try {
      const existing = (flaggedQ.data ?? []).find((row) => row.question_text.trim() === stem);
      if (existing) {
        if (existing.status === 'queued') return;
        await window.__workspaceDb.from('zuno_question_queue').update(existing.id, {
          status: 'queued',
          next_revision_on: addDaysISO(today, FLAG_REVISION_INTERVALS[0]),
        });
      } else {
        await window.__workspaceDb.from('zuno_question_queue').insert({
          source_type: 'quiz',
          subject: question.subject,
          topic: question.topic || null,
          question_text: stem,
          image_url: question.image_url ?? null,
          status: 'queued',
          created_on: today,
          options_json: JSON.stringify([question.option_a, question.option_b, question.option_c, question.option_d]),
          correct: question.correct,
          concept: question.concept ?? null,
          difficulty: question.difficulty ?? null,
          revise_count: 0,
          next_revision_on: addDaysISO(today, FLAG_REVISION_INTERVALS[0]),
        });
      }
      flaggedQ.refresh();
    } catch {
      /* silent by design — the quiz keeps playing either way */
    }
  };

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
      if (needConversion.length > 0) {
        if (!access.canAskAi) {
          setUpgradeReason('limit');
          throw new Error('ai-limit');
        }
        setFlaggedPrepareNote(`Turning ${needConversion.length} doubt question${needConversion.length === 1 ? '' : 's'} into MCQs…`);
        converted = await convertFlaggedToMcqs(
          needConversion,
          examDef?.target.label || savedExamLabel || profile?.exam || 'your exam',
        );
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
          concept: row.concept ?? null,
          image_url: row.image_url ?? null,
        });
        flaggedIds.push(row.id);
      }
      if (questions.length === 0) throw new Error('no-questions');
      setFlaggedTestOpen(false);
      setActiveFlaggedTest({ questions, timeLimitMinutes, flaggedIds });
    } catch (error) {
      if ((error as Error).message !== 'ai-limit') {
        setFlaggedTestError("I couldn't build the practice test — usually a hiccup converting a doubt into an MCQ. Tap retry.");
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
        ? `Your main gap is ${worst.topic} — you got ${worst.total - worst.correct}/${worst.total} question${worst.total === 1 ? '' : 's'} on it wrong. Focus here next: revise it today, then re-run this doubt test to clear the queue.`
        : 'Clean sweep — every doubt question fell. Keep adding the ones that stump you and this loop keeps working.';

    setActiveFlaggedTest(null);
    setTestReview({
      score,
      total: questions.length,
      breakdown,
      wrong,
      weakTopics: weak.map((w) => w.topic),
      curationNotes: [],
      analysis,
      clearedCount: clearedIds.length,
    });

    try {
      /* Correct answers demote the doubt out of the queue. */
      await Promise.all(
        clearedIds.map((id) => window.__workspaceDb.from('zuno_question_queue').update(id, { status: 'cleared' })),
      );
      flaggedQ.refresh();
      /* The run counts as a real test: history, weekly goal, adaptive curation. */
      await window.__workspaceDb.from('zuno_test_results').insert({
        user_id: null,
        topics: JSON.stringify(breakdown),
        score,
        total: questions.length,
        wrong_question_ids: JSON.stringify([]),
        time_limit_minutes: timeLimitMinutes,
        duration_seconds: durationSeconds,
        created_on: today,
      });
      testResultsQ.refresh();

      /* Closed loop: the doubt test counts like any other test — one mastery +
       * weakness update per tested topic, exactly the Test Mode rule. */
      if (activeSyllabusExam) {
        try {
          for (const entry of breakdown) {
            const matched = matchTaskToChapter(activeSyllabusExam, entry.subject, entry.topic);
            if (!matched) continue;
            const pct = percentOf(entry.correct, entry.total);
            await recordTestResult(
              activeSyllabusExam.id,
              topicIdFor(matched.chapterId, entry.topic),
              pct >= WEAK_TOPIC_THRESHOLD,
              pct,
              { progressRows, weakRows: weakTopicRows, topicName: entry.topic },
            );
          }
          examProgressQ.refresh();
          topicAttemptsQ.refresh();
          weakTopicsQ.refresh();
        } catch {
          /* silent — the visible result is already on screen */
        }
      }

      /* Weak topics (<60%) jump the spaced-revision queue — same as Test Mode.
       * Only topics with completed study history enter the revision pipeline. */
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
            await window.__workspaceDb.from('zuno_items').update(pendingRevs[0].id, { scheduled_for: today });
          }
        } else if (profile && studiedParent) {
          await window.__workspaceDb.from('zuno_items').insert({
            exam: profile.exam,
            subject: entry.subject,
            topic: entry.topic,
            kind: 'revision',
            scheduled_for: addDaysISO(today, 1),
            status: 'pending',
            studied_on: studiedParent.studied_on ?? today,
            interval_days: 1,
            source_key: key,
          });
        }
      }
      if (weak.length > 0) itemsQ.refresh();

      if (weeklyRow) {
        await window.__workspaceDb.from('zuno_weekly_targets').update(weeklyRow.id, { tests_done: weeklyTestsDone + 1 });
        weeklyQ.refresh();
      }
    } catch {
      showToast('Your score is shown, but saving the doubt-test result hiccuped.');
    }
  };

  /** CHANGE 2: checking off is instant — no feeling prompt, no duration sheet. */
  const handleToggle = async (item: StudyItem) => {
    if (busyIds.has(item.id)) return;
    setBusy(item.id, true);
    try {
      const db = window.__workspaceDb.from('zuno_items');
      if (item.status === 'pending') {
        const now = new Date().toISOString();
        await db.update(item.id, {
          status: 'done',
          completed_at: now,
          studied_on: item.kind === 'new' ? today : item.studied_on ?? null,
        });
        if (item.kind === 'new') {
          const key = item.source_key || topicKey(item.subject, item.topic);
          const have = new Set(
            items.filter((i) => i.kind === 'revision' && i.source_key === key).map((i) => i.interval_days as number),
          );
          // FIX 5: also skip a draft when an identical pending revision for
          // this topic already sits on the same date — never a duplicate row.
          const pendingDates = new Set(
            items
              .filter((i) => i.kind === 'revision' && i.status === 'pending' && i.source_key === key)
              .map((i) => i.scheduled_for),
          );
          await Promise.all(
            buildRevisionDrafts(item, today, have)
              .filter((d) => !pendingDates.has(d.scheduled_for))
              .map((d) => db.insert(d as Record<string, unknown>)),
          );
        }
        clearStarted(item.id);
        // Adaptation engine: the completed task counts as a study session on
        // its syllabus chapter — mastery, attempts and spaced revision update.
        feedAdaptationEngine(item);
        // CHANGE 2: a warm rotating encouragement — a statement, never a question.
        showToast(ENCOURAGE_MESSAGES[encourageIndexRef.current % ENCOURAGE_MESSAGES.length]);
        encourageIndexRef.current += 1;
      } else {
        await db.update(item.id, {
          status: 'pending',
          completed_at: null,
          ...(item.kind === 'new' ? { studied_on: null } : {}),
        });
        if (item.kind === 'new') {
          const key = item.source_key || topicKey(item.subject, item.topic);
          const pendingRevs = items.filter((i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending');
          await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
        }
      }
      itemsQ.refresh();
    } finally {
      setBusy(item.id, false);
    }
  };

  /** CHANGE 1: a tapped checkbox first draws a slow strikethrough across the
   * task text (~600ms ease-in-out), lets the row fade slightly, and only then
   * moves it to the Completed section — like crossing it off a paper list. */
  const completeWithAnimation = (item: StudyItem) => {
    if (item.status !== 'pending') {
      void handleToggle(item);
      return;
    }
    if (busyIds.has(item.id) || completingIds.has(item.id)) return;
    setCompletingIds((prev) => new Set(prev).add(item.id));
    window.setTimeout(() => {
      void handleToggle(item).catch(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        showToast("That didn't save — mind tapping it once more?");
      });
    }, 950);
  };

  /** Star a queued task to make it the hero mission; null clears the choice (#1). */
  const pinHero = (id: number | null) => {
    setHeroId(id);
    try {
      if (id === null) localStorage.removeItem(`vicharak_hero_${spaceId}`);
      else localStorage.setItem(`vicharak_hero_${spaceId}`, String(id));
    } catch {
      /* storage unavailable — the choice still applies for this visit */
    }
    if (id !== null) showToast("Starred — that's your mission now.");
  };

  /** Drop one auto-scheduled revision — quick, silent, always undoable (#7, #8). */
  const removeRevision = async (item: StudyItem) => {
    if (busyIds.has(item.id)) return;
    setBusy(item.id, true);
    try {
      await window.__workspaceDb.from('zuno_items').delete(item.id);
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
      };
      showToast('Revision removed.', () => {
        void window.__workspaceDb.from('zuno_items').insert(clone).then(() => itemsQ.refresh());
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  const upsertMeta = async (key: string, value: string) => {
    const db = window.__workspaceDb.from('zuno_meta');
    const existing = metaMap.get(key);
    if (existing) await db.update(existing.id, { meta_value: value });
    else await db.insert({ meta_key: key, meta_value: value });
    metaQ.refresh();
  };

  /**
   * Move an existing student onto an exam they typed in. The syllabus is stored
   * BEFORE the profile points at it, so there is never a moment where the app
   * holds an exam id it cannot explain.
   */
  const switchToTypedExam = async (exam: ExamDef) => {
    if (!profile) return;
    for (const [key, value] of customExamMetaRows(exam)) {
      await upsertMeta(key, value);
    }
    await window.__workspaceDb.from('zuno_profile').update(profile.id, { exam: exam.id });
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

  /* Anchor the trial once per student: mirror the resolved first day into this
   * browser and the database, so clearing storage can't buy a second trial. */
  useEffect(() => {
    rememberTrialStart(spaceId, trialStart);
    if (!profile || metaQ.loading || trialStartWrittenRef.current || savedTrialStart === trialStart) return;
    trialStartWrittenRef.current = true;
    void upsertMeta(TRIAL_START_META_KEY, trialStart).catch(() => {
      // Storage-only for now; the next visit tries again.
      trialStartWrittenRef.current = false;
    });
  }, [spaceId, trialStart, savedTrialStart, metaQ.loading, profile?.id]);

  /* The day the trial wraps, say so once — warmly, and never again. */
  useEffect(() => {
    // TEMP: Paywall disabled 2026-08-08 — re-enable once payment is ready.
    // Nothing wraps while the paywall is off, so the sheet never self-opens.
    if (PAYWALL_DISABLED) return;
    if (profileQ.loading || !profile || dailyPopupOpen) return;
    if (access.tier !== 'free' || !shouldAnnounceTrialEnd(spaceId)) return;
    markTrialEndAnnounced(spaceId);
    setUpgradeReason('trial-ended');
  }, [profileQ.loading, profile?.id, dailyPopupOpen, access.tier, spaceId]);

  const addTask = async (
    subject: string,
    topic: string,
    type: TaskType,
    ai: boolean,
    scheduledFor: string = today,
  ): Promise<boolean> => {
    if (!profile) return false;
    const key = topicKey(subject, topic);
    // FIX 5: never create a duplicate — when an identical task is already
    // pending (on today's list or upcoming, revisions included), skip the
    // insert instead of stacking a second copy of the same topic.
    const duplicate = items.some(
      (item) => item.status === 'pending' && (item.source_key || topicKey(item.subject, item.topic)) === key,
    );
    if (duplicate) return false;
    await window.__workspaceDb.from('zuno_items').insert({
      exam: profile.exam,
      subject,
      topic,
      kind: 'new',
      day_number: Math.max(1, day + diffDays(today, scheduledFor)),
      scheduled_for: scheduledFor,
      status: 'pending',
      source_key: key,
    });
    try {
      await upsertMeta(taskTypeKey(key), JSON.stringify({ type: normalizeTaskType(type), ai }));
    } catch {
      /* The task still shows on Today; the self-heal pass retries this later. */
    }
    itemsQ.refresh();
    return true;
  };

  /* Doubts feed the plan: each fresh doubt's topic surfaces as a priority
   * "Clear doubt: …" revision task on Today — automatically, no manual entry.
   * A simple heuristic stands in for full AI inference: the doubt's concept /
   * chapter / subject label becomes the revision task's topic. */
  const doubtTaskKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!profile || itemsQ.loading || flaggedQ.loading) return;
    const since = addDaysISO(today, -7);
    const candidates = new Map<string, { subject: string; topic: string; latest: string }>();
    for (const row of flaggedRows) {
      if ((row.created_on || '') < since) continue;
      const subject = (row.subject || '').trim() || 'General';
      const topic = `Clear doubt: ${flaggedConceptLabel(row)}`;
      const key = topicKey(subject, topic);
      const current = candidates.get(key);
      if (!current || row.created_on > current.latest) candidates.set(key, { subject, topic, latest: row.created_on });
    }
    const inserts: Array<{ subject: string; topic: string }> = [];
    for (const [key, group] of candidates) {
      if (doubtTaskKeysRef.current.has(key)) continue;
      doubtTaskKeysRef.current.add(key);
      const already = items.some((item) => {
        if ((item.source_key || topicKey(item.subject, item.topic)) !== key) return false;
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
          /* the doubt itself is saved — the next visit tries the task again */
        }
      }
    })();
  }, [profile?.id, itemsQ.loading, flaggedQ.loading, flaggedRows, items, today]);

  /** One-tap subject task (#2): created instantly with a rename-friendly name. */
  const quickAddTask = async (subject: string) => {
    if (addingTask || !profile) return;
    setAddingTask(true);
    try {
      await addTask(subject, `${subject} study session`, 'Self Study', false);
      setSheetOpen(false);
      showToast(`Added a ${subject} task — tap its pencil to rename.`);
    } finally {
      setAddingTask(false);
    }
  };

  /* CHANGE 6: daily topic check-in — once per day the student says what
   * they're studying and the day's plan is built from exactly that. */
  const markCheckinDone = () => {
    setCheckinVisible(false);
    try {
      localStorage.setItem(`vicharak_checkin_${spaceId}_${today}`, '1');
    } catch {
      /* state alone still hides it for this visit */
    }
  };

  const submitCheckin = async () => {
    const text = checkinText.trim();
    if (!text || checkinSaving || !profile) return;
    setCheckinSaving(true);
    try {
      const segments = splitPlanText(text);
      const lines = (segments.length > 0 ? segments : [text]).slice(0, 10);
      for (const line of lines) {
        const parsed = parseOneLiner(line, examDef);
        await addTask(checkinSubject || parsed.subject || 'General', line, parsed.type, false);
      }
      markCheckinDone();
      setCheckinText('');
      setCheckinSubject('');
      showToast(`Day started — ${lines.length} task${lines.length === 1 ? '' : 's'} on today's plan.`);
    } catch {
      showToast("That didn't save — mind tapping Start once more?");
    } finally {
      setCheckinSaving(false);
    }
  };

  /* CHANGE 1/8 + FIX 4: the '+' FAB modal — ONE TASK PER LINE, all saved with
   * a single "Add All" tap. The optional photo persists as a compact data URI
   * in zuno_attachments next to the first task. */
  const handleAddTaskSave = async (draft: { titles: string[]; subject: string; imageDataUrl: string | null }) => {
    if (savingNewTask || !profile) return;
    const titles = draft.titles.map((line) => line.trim()).filter(Boolean).slice(0, 20);
    if (titles.length === 0) return;
    setSavingNewTask(true);
    try {
      let added = 0;
      let firstKey: string | null = null;
      for (const title of titles) {
        const parsed = parseOneLiner(title, examDef);
        const subject = draft.subject || parsed.subject || 'General';
        const created = await addTask(subject, title, parsed.type, false);
        if (created) {
          added += 1;
          if (!firstKey) firstKey = topicKey(subject, title);
        }
      }
      if (draft.imageDataUrl && firstKey) {
        try {
          await window.__workspaceDb.from('zuno_attachments').insert({
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
      markCheckinDone();
      setAddTaskOpen(false);
      const skipped = titles.length - added;
      showToast(
        added === 0
          ? 'Those tasks are already on your plan — no duplicates added.'
          : `Added ${added} task${added === 1 ? '' : 's'}${skipped > 0 ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`,
      );
    } catch {
      showToast("Those tasks didn't save — mind trying once more?");
    } finally {
      setSavingNewTask(false);
    }
  };

  /** FIX 4: the quick-add box takes ONE TASK PER LINE — pressing Enter starts
   * the next task, and one "Add All" tap saves every line at once. Commas
   * never split a line into multiple tasks. */
  const submitQuickTitle = async () => {
    const lines = quickTitle.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
    if (lines.length === 0 || addingTask || !profile) return;
    setAddingTask(true);
    try {
      let added = 0;
      for (const line of lines) {
        const parsed = parseOneLiner(line, examDef);
        const subject = quickSubject || parsed.subject || 'General';
        if (await addTask(subject, line, parsed.type, false)) added += 1;
      }
      setQuickTitle('');
      showToast(
        added === 0
          ? 'Already on your plan — no duplicates added.'
          : `Added ${added} task${added === 1 ? '' : 's'} to today.`,
      );
    } finally {
      setAddingTask(false);
    }
  };

  /** Block of text → structured drafts: AI restructures and labels each task
   * (subject, chapter, type) and flags only genuinely confusing phrases; the
   * local parser is the silent fallback so this never dead-ends. */
  const parsePlanText = async (text: string, segments: string[]) => {
    setParsingPlan(true);
    try {
      let drafts: PlanDraft[] | null = null;
      if (access.canAskAi) {
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
      if (!drafts || drafts.length === 0) drafts = localStructurePlan(segments, examDef);
      // The chip the student tapped fills any subject the parse couldn't name.
      if (quickSubject) drafts = drafts.map((d) => (d.subject ? d : { ...d, subject: quickSubject }));
      setPlanDrafts(drafts);
      setQuickTitle('');
    } finally {
      setParsingPlan(false);
    }
  };

  /** Save every kept, subject-complete draft — each lands on Today at once. */
  const confirmPlanDrafts = async () => {
    if (!planDrafts || savingPlan) return;
    const rows = planDrafts.filter((d) => d.keep && d.title.trim() && d.subject.trim());
    if (rows.length === 0) return;
    setSavingPlan(true);
    try {
      for (const row of rows) await addTask(row.subject.trim(), row.title.trim(), row.type, true);
      setPlanDrafts(null);
      setSheetOpen(false);
      showToast(`Added ${rows.length} task${rows.length === 1 ? '' : 's'} to today.`);
    } finally {
      setSavingPlan(false);
    }
  };

  /** One-tap AI polish inside the task editor (#2): tightens the title and
   * fixes the subject; the student still reviews before saving. */
  const improveEditedTask = async () => {
    if (!editTask || improvingTask || !editTaskTitle.trim()) return;
    if (!access.canAskAi) {
      setUpgradeReason('limit');
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

  /** Open the light edit sheet for a task row — title, subject, duration (#1). */
  const openTaskEditor = (item: StudyItem) => {
    const ann = annotations.get(item.source_key || topicKey(item.subject, item.topic));
    setEditTask(item);
    setEditTaskTitle(item.topic);
    setEditTaskSubject(item.subject);
    setEditTaskMinutes(ann?.minutes ? String(ann.minutes) : '');
  };

  const saveTaskEdit = async () => {
    if (!editTask || savingTaskEdit) return;
    const title = editTaskTitle.trim();
    const subject = editTaskSubject.trim();
    if (!title || !subject) return;
    setSavingTaskEdit(true);
    try {
      const oldKey = editTask.source_key || topicKey(editTask.subject, editTask.topic);
      const nextKey = topicKey(subject, title);
      await window.__workspaceDb.from('zuno_items').update(editTask.id, {
        subject,
        topic: title,
        source_key: nextKey,
      });
      const prev = annotations.get(oldKey);
      const minutes = Math.round(Number(editTaskMinutes));
      await upsertMeta(taskTypeKey(nextKey), JSON.stringify({
        type: prev?.type ?? 'Self Study',
        ai: prev?.ai ?? false,
        time: prev?.time,
        minutes: editTaskMinutes.trim() !== '' && Number.isFinite(minutes) && minutes > 0 ? Math.min(1080, minutes) : undefined,
      }));
      itemsQ.refresh();
      setEditTask(null);
      showToast('Task updated.');
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const updateCalendarTask = async (
    item: StudyItem,
    updates: { subject: string; topic: string; type: TaskType; time: string; minutes: number | null; scheduled_for: string },
  ) => {
    const nextKey = topicKey(updates.subject, updates.topic);
    await window.__workspaceDb.from('zuno_items').update(item.id, {
      subject: updates.subject,
      topic: updates.topic,
      scheduled_for: updates.scheduled_for,
      source_key: nextKey,
      day_number: item.kind === 'new' ? Math.max(1, day + diffDays(today, updates.scheduled_for)) : item.day_number ?? null,
    });
    await upsertMeta(
      taskTypeKey(nextKey),
      JSON.stringify({ type: updates.type, ai: false, time: updates.time || undefined, minutes: updates.minutes ?? undefined }),
    );
    itemsQ.refresh();
    showToast('Calendar task updated.');
  };

  const submitTaskSections = async () => {
    if (addingTask || !profile) return;
    const rows = (Object.entries(taskSections) as Array<[DailySection, SectionDraft]>).flatMap(([section, draft]) =>
      draft.text
        .split(/\n+/)
        .map((text) => text.trim())
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
    // Never block the whole entry (#3): rows with a clear subject save now;
    // the rest become inline review drafts the student fixes one by one.
    const ready = prepared.filter((row) => row.subject);
    const missing = prepared.filter((row) => !row.subject);

    setAddingTask(true);
    try {
      for (const row of ready) await addTask(row.subject, row.topic, row.type, false);
      setTaskSections(newSectionDrafts());
      if (missing.length === 0) {
        setSheetOpen(false);
        showToast(`Added ${ready.length} task${ready.length === 1 ? '' : 's'} to today.`);
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
    const subject = selectedSubject || inferSubjectForTopic(examDef, topic) || formSubject;
    if (!subject) {
      showToast('Pick a subject — this topic could belong to more than one.');
      return;
    }
    setAddingTask(true);
    try {
      await addTask(subject, topic, formType, false);
      setFormSearch('');
      setFormCustom('');
      setFormSubject('');
      setFormSubjectManual(false);
      setFormChapter('');
      setSheetOpen(false);
      showToast(`Added: ${topic} · ${subject}`);
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
      await addTask(pick.subject, pick.topic, 'Self Study', true);
      setAiResult(`Added “${pick.topic}” (${pick.subject}) — ${pick.reason}.`);
    } finally {
      setAddingTask(false);
    }
  };

  /* ---------- MCQ quizzes, Test Mode, photo tasks, weekly goals ---------- */

  /** Every metered AI trip lands here — same daily budget as the coach. */
  const chargeAi = () => setAiUsedToday(recordAiMessage(spaceId, today));

  /* FIX 8: Generate Test — the student always picks HOW first (their own
   * revision questions, AI-written similar questions, or two-concept mixes);
   * nothing generates until they tap the button. */
  const startGenerateTest = async (mode: GenerateTestMode) => {
    if (generateTestPreparing) return;
    setGenerateTestPreparing(true);
    setGenerateTestError(null);
    try {
      const pool = flaggedRows;
      if (pool.length === 0) throw new Error('empty-queue');
      let questions: GeneratedTestQuestion[];
      if (mode === 'revision') {
        questions = questionsFromQueue(pool);
      } else {
        if (!access.canAskAi) {
          setUpgradeReason('limit');
          throw new Error('ai-limit');
        }
        const examLabel = examDef?.target.label || savedExamLabel || profile?.exam || 'your exam';
        questions =
          mode === 'similar'
            ? await generateSimilarQuestions(pool, examLabel)
            : await generateMixedQuestions(pool, examLabel);
        chargeAi();
      }
      if (questions.length === 0) throw new Error('no-questions');
      setGenerateTestOpen(false);
      setActiveGeneratedTest(questions);
    } catch (error) {
      const message = (error as Error).message;
      if (message !== 'ai-limit') {
        setGenerateTestError(
          message === 'empty-queue'
            ? 'Your revision queue is empty — save a doubt or get a practice question wrong first, then I can build a test from it.'
            : "I couldn't build that test — usually a hiccup writing the questions. Tap Generate again.",
        );
      }
    } finally {
      setGenerateTestPreparing(false);
    }
  };

  /** FIX 8: “Got it ✓” resolves the underlying queue row(s) for good;
   * “Need revision ↩” reschedules them for tomorrow. Fire-and-forget — the
   * test keeps moving either way. */
  const resolveGeneratedQuestion = (question: GeneratedTestQuestion, remembered: boolean) => {
    void (async () => {
      try {
        await Promise.all(
          question.sourceIds.map((id) =>
            remembered
              ? window.__workspaceDb.from('zuno_question_queue').update(id, { status: 'cleared', last_revised_on: today })
              : window.__workspaceDb.from('zuno_question_queue').update(id, {
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
              { progressRows, weakRows: weakTopicRows, topicName: question.conceptLabel },
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

  /** Past-performance context for the Generate Quiz sheet (adaptive curation). */
  const quizAdaptive = useMemo(
    () => (quizTarget ? adaptiveContextForTopic(testResults, quizTarget.subject, quizTarget.topic) : null),
    [quizTarget, testResults],
  );

  /** Bank rows for one topic — reused by tests, passed as no-repeat context. */
  const bankQuestionsFor = (subject: string, topic: string): McqQuestion[] => {
    const key = topicKey(subject, topic);
    return mcqBank.filter((q) => (q.source_key || topicKey(q.subject, q.topic)) === key);
  };

  /** Freshly generated questions: open the player at once, bank them behind it. */
  const handleQuizGenerated = async (drafts: McqDraft[]) => {
    if (!quizTarget) return;
    const title = `${quizTarget.subject} · ${quizTarget.topic}`;
    setQuizTarget(null);
    setActiveQuiz({ title, questions: drafts.map((draft) => ({ ...draft, id: null })) });
    try {
      await Promise.all(
        drafts.map((draft) => window.__workspaceDb.from('zuno_mcq_questions').insert(draft as unknown as Record<string, unknown>)),
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
      await window.__workspaceDb.from('zuno_attachments').insert({
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
      await window.__workspaceDb.from('zuno_attachments').insert({
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
    await window.__workspaceDb.from('zuno_attachments').delete(row.id);
    attachmentsQ.refresh();
  };

  /** Photo → tasks: create every kept task with the AI's time estimate, and
   * store the photo next to each one. */
  const handlePhotoTasks = async (
    tasks: Array<{ title: string; subject: string; difficulty: string; minutes: number }>,
    imageUrl: string,
  ) => {
    if (addingPhotoTasks || !profile) return;
    setAddingPhotoTasks(true);
    try {
      for (const task of tasks) {
        const key = topicKey(task.subject, task.title);
        await addTask(task.subject, task.title, 'Self Study', true);
        await upsertMeta(
          taskTypeKey(key),
          JSON.stringify({
            type: 'Self Study',
            ai: true,
            minutes: Math.max(5, Math.min(1080, Math.round(task.minutes) || 45)),
          }),
        );
        await window.__workspaceDb.from('zuno_attachments').insert({
          parent_type: 'task',
          parent_key: key,
          image_url: imageUrl,
          created_on: today,
        });
      }
      attachmentsQ.refresh();
      setPhotoTasksOpen(false);
      setSheetOpen(false);
      showToast(`Added ${tasks.length} task${tasks.length === 1 ? '' : 's'} from your photo — with AI time estimates.`);
    } catch {
      showToast("Those tasks didn't save — mind trying once more?");
    } finally {
      setAddingPhotoTasks(false);
    }
  };

  /** Curate a test: reuse the bank per topic, generate only the shortfall.
   * Adaptive curation — weak topics (<60% recent accuracy) carry 2× weight,
   * consistently strong topics (>85%) drop to half weight, and the results
   * screen explains exactly why each topic got its share. */
  const startTest = async (config: TestConfig) => {
    if (testPreparing) return;
    setTestPreparing(true);
    setTestError(null);
    try {
      const weighted = config.topics.map((topicOption) => {
        const ctx = adaptiveContextForTopic(testResults, topicOption.subject, topicOption.topic);
        const weight = ctx === null ? 1 : ctx.accuracy < WEAK_TOPIC_THRESHOLD ? 2 : ctx.accuracy > 85 ? 0.5 : 1;
        return { topicOption, ctx, weight, share: 0 };
      });
      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0) || 1;
      for (const w of weighted) w.share = Math.floor((config.count * w.weight) / totalWeight);
      let allocated = weighted.reduce((sum, w) => sum + w.share, 0);
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
      let generatedAny = false;
      for (const { topicOption, share } of weighted) {
        if (share === 0) continue;
        const bank = bankQuestionsFor(topicOption.subject, topicOption.topic);
        const chosen = [...bank].sort(() => Math.random() - 0.5).slice(0, share);
        questions.push(...chosen.map((q) => ({ ...q, id: q.id as number | null })));
        const missing = share - chosen.length;
        if (missing > 0) {
          if (!access.canAskAi) {
            setUpgradeReason('limit');
            throw new Error('ai-limit');
          }
          setTestPrepareNote(`Writing ${missing} fresh ${topicOption.topic} question${missing === 1 ? '' : 's'}…`);
          const drafts = await generateMcqs({
            examLabel: examDef?.target.label || savedExamLabel || profile?.exam || 'Competitive exam',
            subject: topicOption.subject,
            topic: topicOption.topic,
            count: missing,
            difficulty: 'medium',
            adaptive: adaptiveContextForTopic(testResults, topicOption.subject, topicOption.topic),
            today,
            avoidQuestions: bank.map((q) => q.question),
          });
          generatedAny = true;
          try {
            await Promise.all(
              drafts.map((draft) => window.__workspaceDb.from('zuno_mcq_questions').insert(draft as unknown as Record<string, unknown>)),
            );
          } catch {
            /* the test still runs from memory */
          }
          questions.push(...drafts.map((draft) => ({ ...draft, id: null })));
        }
      }
      if (generatedAny) {
        chargeAi();
        mcqQ.refresh();
      }
      if (questions.length === 0) throw new Error('no-questions');
      questions.sort(() => Math.random() - 0.5);
      setTestSetupOpen(false);
      setActiveTest({ questions, timeLimitMinutes: config.timeLimitMinutes, curationNotes });
    } catch (error) {
      if ((error as Error).message !== 'ai-limit') {
        setTestError("I couldn't put the test together — usually a hiccup writing fresh questions. Tap retry and it almost always works.");
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
    const analysis =
      worst && worstPercent < 100
        ? `Your main gap is ${worst.topic} — you got ${worst.total - worst.correct}/${worst.total} question${worst.total === 1 ? '' : 's'} on it wrong${worstPercent < WEAK_TOPIC_THRESHOLD ? ", so it's marked for priority revision" : ''}. Focus here next: one revision session, then retest with 10 questions.`
        : 'Every topic held up — a clean run. Raise the difficulty or bring in fresh topics to keep stretching.';

    setActiveTest(null);
    setTestReview({
      score,
      total: questions.length,
      breakdown,
      wrong,
      weakTopics: weak.map((w) => w.topic),
      curationNotes: activeTest.curationNotes,
      analysis,
    });

    /* Adaptation engine: one mastery + weakness update per tested topic. */
    if (activeSyllabusExam) {
      void (async () => {
        try {
          for (const entry of breakdown) {
            const matched = matchTaskToChapter(activeSyllabusExam, entry.subject, entry.topic);
            if (!matched) continue;
            const pct = percentOf(entry.correct, entry.total);
            await recordTestResult(
              activeSyllabusExam.id,
              topicIdFor(matched.chapterId, entry.topic),
              pct >= WEAK_TOPIC_THRESHOLD,
              pct,
              { progressRows, weakRows: weakTopicRows, topicName: entry.topic },
            );
          }
          examProgressQ.refresh();
          topicAttemptsQ.refresh();
          weakTopicsQ.refresh();
        } catch {
          /* silent — the visible result is already on screen */
        }
      })();
    }

    try {
      await window.__workspaceDb.from('zuno_test_results').insert({
        user_id: null,
        topics: JSON.stringify(breakdown),
        score,
        total: questions.length,
        wrong_question_ids: JSON.stringify(wrongIds),
        time_limit_minutes: activeTest.timeLimitMinutes,
        duration_seconds: durationSeconds,
        created_on: today,
      });
      testResultsQ.refresh();

      /* Weak topics (<60%) jump the spaced-revision queue: the next pending
       * revision moves to today. Only topics the student has actually
       * completed enter the revision pipeline — an unstudied weak topic stays
       * in the weak-chapters list instead of being queued for revision (you
       * can't revise what you haven't studied yet). */
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
            await window.__workspaceDb.from('zuno_items').update(pendingRevs[0].id, { scheduled_for: today });
          }
        } else if (profile && studiedParent) {
          await window.__workspaceDb.from('zuno_items').insert({
            exam: profile.exam,
            subject: entry.subject,
            topic: entry.topic,
            kind: 'revision',
            scheduled_for: addDaysISO(today, 1),
            status: 'pending',
            studied_on: studiedParent.studied_on ?? today,
            interval_days: 1,
            source_key: key,
          });
        }
      }
      if (weak.length > 0) itemsQ.refresh();

      /* tests_done ticks up immediately; the sync effect keeps it honest. */
      if (weeklyRow) {
        await window.__workspaceDb.from('zuno_weekly_targets').update(weeklyRow.id, { tests_done: weeklyTestsDone + 1 });
        weeklyQ.refresh();
      }
    } catch {
      showToast('Your score is in view, but saving the result hiccuped — it may not count towards weekly goals.');
    }
  };

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
        await window.__workspaceDb.from('zuno_weekly_targets').update(weeklyRow.id, {
          topic_target: topicTarget,
          test_target: testTarget,
          ...focusPayload,
        });
      } else {
        await window.__workspaceDb.from('zuno_weekly_targets').insert({
          user_id: null,
          week_start_date: weekStart,
          topic_target: topicTarget,
          test_target: testTarget,
          topics_done: weeklyTopicsDone,
          tests_done: weeklyTestsDone,
          ...focusPayload,
        });
        if (lastWeekRow && !lastWeekRow.summary_seen) {
          await window.__workspaceDb.from('zuno_weekly_targets').update(lastWeekRow.id, { summary_seen: true });
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

  /** How last week ended — shown once inside the new week's goals sheet. */
  const lastWeekLine = useMemo(() => {
    if (!lastWeekRow || lastWeekRow.summary_seen) return null;
    const target = Number(lastWeekRow.topic_target ?? 0);
    const done = Number(lastWeekRow.topics_done ?? 0);
    if (target > 0 && done >= target) return `Last week: ${done}/${target} topics — you hit your goal. Well done! 🎉`;
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
      await window.__workspaceDb.from('zuno_test_scores').update(editing.resultId, row);
      showToast(`Updated to ${draft.marks}/${draft.total} — ${percent}%.`);
    } else if (editing?.legacyId) {
      // Editing a percentage-only row upgrades it into a real marks-based result,
      // keeping the date it was taken on.
      await window.__workspaceDb.from('zuno_test_scores').insert({ ...row, taken_on: editing.taken_on });
      await window.__workspaceDb.from('zuno_scores').delete(editing.legacyId);
      showToast(`Saved with real marks: ${draft.marks}/${draft.total} — ${percent}%.`);
    } else {
      await window.__workspaceDb.from('zuno_test_scores').insert({ ...row, taken_on: today });
      showToast(`Logged ${draft.marks}/${draft.total} in ${draft.subject} — I factor this into your weak chapters.`);
    }
    resultsQ.refresh();
    scoresQ.refresh();
  };

  const handleDeleteScore = async (entry: ScoreEntry) => {
    // Mistakes logged under this test go with it, otherwise they'd be orphaned.
    const owned = mistakes.filter((m) => (m.score_key || (m.test_score_id ? `r${m.test_score_id}` : '')) === entry.key);
    await Promise.all(owned.map((m) => window.__workspaceDb.from('zuno_mistakes').delete(m.id)));

    if (entry.resultId !== null) {
      await window.__workspaceDb.from('zuno_test_scores').delete(entry.resultId);
      // Builds before this one mirrored every test into zuno_scores as a bare
      // percentage; remove that twin so the test can't come back as a ghost row.
      const twin = (scoresQ.data || []).find(
        (s) => s.subject === entry.subject && s.taken_on === entry.taken_on && Number(s.score) === entry.percent,
      );
      if (twin) await window.__workspaceDb.from('zuno_scores').delete(twin.id);
    } else if (entry.legacyId !== null) {
      await window.__workspaceDb.from('zuno_scores').delete(entry.legacyId);
    }
    resultsQ.refresh();
    scoresQ.refresh();
    mistakesQ.refresh();
    showToast('Test removed. Your averages and trend just updated.');
  };

  const handleAddMistake = async (entry: ScoreEntry, draft: MistakeDraft) => {
    await window.__workspaceDb.from('zuno_mistakes').insert({
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
    await window.__workspaceDb.from('zuno_mistakes').delete(mistake.id);
    mistakesQ.refresh();
  };

  const handleSignOut = () => {
    window.__signOut?.();
    try {
      localStorage.removeItem(`space_session_${spaceId}`);
    } catch {
      /* storage unavailable — the reload below still resets the in-memory session */
    }
    setSessionId('');
    window.location.reload();
  };

  /* ---------- FIX 1: Reset All Data / Delete Account ---------- */

  /** Delete every stored row this student has, then clear the app's
   * localStorage state — the exact scope of the confirmation warning. */
  const wipeAllData = async () => {
    const db = window.__workspaceDb;
    const tables: Array<[string, Array<{ id: number }>]> = [
      ['zuno_items', itemsQ.data ?? []],
      ['zuno_sessions', sessionsQ.data ?? []],
      ['zuno_scores', scoresQ.data ?? []],
      ['zuno_test_scores', resultsQ.data ?? []],
      ['zuno_mistakes', mistakesQ.data ?? []],
      ['zuno_task_feedback', feedbackQ.data ?? []],
      ['zuno_mcq_questions', mcqQ.data ?? []],
      ['zuno_test_results', testResultsQ.data ?? []],
      ['zuno_weekly_targets', weeklyQ.data ?? []],
      ['zuno_attachments', attachmentsQ.data ?? []],
      ['zuno_question_queue', flaggedQ.data ?? []],
      ['zuno_recommendation_log', recommendationLogQ.data ?? []],
      ['zuno_meta', metaQ.data ?? []],
      // Profile last — while it exists the app still renders normally.
      ['zuno_profile', (profileQ.data ?? []) as Array<{ id: number }>],
    ];
    for (const [table, rows] of tables) {
      await Promise.all(rows.map((row) => db.from(table).delete(row.id).catch(() => undefined)));
    }
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('vicharak') || key.includes('vicharakai') || key.startsWith('carryover_'))) {
          doomed.push(key);
        }
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage unavailable — the reload still resets in-memory state */
    }
  };

  const confirmDangerAction = async () => {
    if (!dangerAction || dangerBusy) return;
    setDangerBusy(true);
    try {
      await wipeAllData();
      if (dangerAction === 'delete') {
        // Delete Account also ends the session before the app resets.
        handleSignOut();
      } else {
        window.location.reload();
      }
    } catch {
      setDangerBusy(false);
      showToast("That didn't finish — mind trying once more?");
    }
  };

  /* ---------- onboarding: essentials only, both screens skippable ---------- */

  /** A typed exam joins the draft and then behaves exactly like a pre-loaded one. */
  const acceptTypedExam = (exam: ExamDef) => {
    setObCustomExam(exam);
    setObExam(exam.id);
    setObDate(defaultExamDate(exam, today));
    setObCustomOpen(false);
    setObStep(2);
  };

  /** The AI's first words: "You have X days until [exam]" + a first-week plan.
   * CHANGE 13: when the student listed Day-1 topics, the welcome is grounded in
   * ONLY those topics — the AI never invents or adds topics of its own. */
  const generateWelcome = async (exam: ExamDef | null, date: string | null, start: string, topics: string[] = []) => {
    const days = date ? Math.max(0, diffDays(start, date)) : null;
    const welcomeExamName = exam?.fullName ?? exam?.name ?? null;
    const fallback = [
      welcomeExamName && days !== null
        ? `You have ${days} days until ${welcomeExamName}. Here's how we'll approach your prep:`
        : "Welcome in. Here's how we'll approach your prep:",
      topics.length > 0
        ? `• Today's checklist holds exactly what you told me — ${topics.slice(0, 3).join(', ')}${topics.length > 3 ? ` and ${topics.length - 3} more` : ''} — nothing I invented.`
        : '• Week one is about momentum, not volume — one honest topic a day.',
      '• Every topic you finish comes back for revision at exactly the right intervals; I handle the scheduling.',
      '• Take one short test by Sunday so I can find your weak spots and weight your practice around them.',
    ].join('\n');
    setWelcome({ loading: true, text: fallback });
    try {
      const response = await fetch('/proxy/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'X-Workspace-DB-Token': (window as any).__workspaceDb?.token ?? '',  'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are VicharakAI, a warm study coach for Indian competitive-exam aspirants. Write a short personalised welcome (70–120 words) for a student who just finished setup. ' +
                'When the exam and days are known, start with exactly "You have X days until [exam]." using the real numbers given. Otherwise open with one warm welcoming line. ' +
                'Then write "Here\'s how we\'ll approach your prep:" followed by a brief first-week plan as exactly 3 short bullet lines starting with "• ": momentum over volume (one topic a day), spaced revision handled automatically by the app, and one short test by Sunday to find weak areas. ' +
                'When "Topics the student chose for today" are listed, the first bullet must reference those topics BY NAME and nothing else — never suggest, add or invent any topic the student did not list. ' +
                'Plain text only, no markdown headers, no sign-off.',
            },
            {
              role: 'user',
              content: `Exam: ${welcomeExamName ?? 'not chosen yet'}. Days until exam: ${days ?? 'unknown'}. Exam date: ${date ?? 'not set'}. Topics the student chose for today: ${topics.length > 0 ? topics.join('; ') : 'none listed — VicharakAI will plan for them'}.`,
            },
          ],
          max_tokens: 300,
          temperature: 0.6,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error('welcome failed');
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const reply = String(data.choices?.[0]?.message?.content || '').trim();
      setWelcome({ loading: false, text: reply || fallback });
    } catch {
      setWelcome({ loading: false, text: fallback });
    }
  };

  /**
   * Create the profile from whatever the onboarding screens collected. `exam`
   * and `date` are both optional — Skip is a first-class path, and everything
   * can be set later from the Me tab. CHANGE 13: the Day-1 checklist is built
   * ONLY from the topics the student typed on the last screen (one line = one
   * task, commas never split) — no AI guesses, no random syllabus picks.
   */
  const finishOnboarding = async (exam: ExamDef | null, date: string | null, topics: string[] = []) => {
    if (creating) return;
    setCreating(true);
    try {
      const start = todayISO();
      await window.__workspaceDb.from('zuno_profile').insert({
        exam: exam?.id ?? 'general',
        start_date: start,
      });
      const metaRows: Array<[string, string]> = [
        ...(date
          ? ([['exam_date', date]] as Array<[string, string]>)
          : exam
            ? ([['exam_date', defaultExamDate(exam, start)]] as Array<[string, string]>)
            : []),
        ...(exam ? [] : ([[EXAM_LABEL_META_KEY, 'Your exam']] as Array<[string, string]>)),
        ...(exam && isCustomExamId(exam.id) ? customExamMetaRows(exam) : []),
      ];
      await Promise.all(
        metaRows.map(([meta_key, meta_value]) =>
          window.__workspaceDb.from('zuno_meta').insert({ meta_key, meta_value }),
        ),
      );
      // CHANGE 13: Day-1 tasks come ONLY from what the student typed — one
      // line is one task, exactly as written. Nothing is guessed for them.
      const dayOneTopics = topics.map((line) => line.trim()).filter(Boolean).slice(0, 20);
      for (const line of dayOneTopics) {
        const parsed = parseOneLiner(line, exam ?? undefined);
        const subject = parsed.subject || 'General';
        const key = topicKey(subject, line);
        await window.__workspaceDb.from('zuno_items').insert({
          exam: exam?.id ?? 'general',
          subject,
          topic: line,
          kind: 'new',
          day_number: 1,
          scheduled_for: start,
          status: 'pending',
          source_key: key,
        });
        try {
          await window.__workspaceDb.from('zuno_meta').insert({
            meta_key: taskTypeKey(key),
            meta_value: JSON.stringify({ type: parsed.type, ai: false }),
          });
        } catch {
          /* the annotation self-heal pass retries this later */
        }
      }
      profileQ.refresh();
      metaQ.refresh();
      itemsQ.refresh();
      void generateWelcome(exam, date ?? (exam ? defaultExamDate(exam, start) : null), start, dayOneTopics);
    } finally {
      setCreating(false);
    }
  };

  /* ---------- focus mode: the session logs itself ---------- */

  const logFocusSession = async (minutes: number) => {
    const focusItem = missionQueue[0] ?? null;
    try {
      await window.__workspaceDb.from('zuno_sessions').insert({
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

  /* ---------- coach ---------- */

  const coachContext = () => {
    const mission = missionQueue[0];
    const weakList = weakAreas.map((w) => `${w.label} (${w.detail})`).join('; ') || 'none identified yet';
    const recentTests =
      scoreEntries
        .slice(-3)
        .map((e) =>
          e.marks !== null && e.total !== null
            ? `${e.label || e.subject}: ${e.marks}/${e.total} (${e.percent}%) on ${e.taken_on}`
            : `${e.label || e.subject}: ${e.percent}% on ${e.taken_on}`,
        )
        .join('; ') || 'no tests logged yet';
    return [
      `Exam: ${examDef?.fullName ?? (savedExamLabel || profile?.exam) ?? 'not chosen'}. Exam date: ${examDate} (${daysToExam} days away). Prep day ${day}. Streak: ${streak} days.`,
      `Pace: ${pace.label}. ${pace.detail}`,
      `Today's mission: ${mission ? `${mission.topic} (${mission.subject})` : 'nothing pending'}. Pending today: ${missionQueue.length}. Done today: ${doneToday.length}.`,
      `Revisions due today: ${dueRevisions.length} (${overdueRevisions.length} of them 2+ days overdue).`,
      `Study time recorded today: ${todayMinutes > 0 ? formatDuration(todayMinutes) : 'none yet'}${
        pace.hours
          ? `; averaging ${formatDuration(pace.hours.avgMinutes)} a day against a ${formatDuration(pace.hours.targetMinutes)} daily target${
              pace.hours.targetInferred ? ' inferred from the syllabus' : ' they set themselves'
            }`
          : ''
      }.`,
      `Last 3 tests: ${recentTests}.`,
      `Weak areas: ${weakList}.`,
      `On-track verdict (engine-calculated): ${onTrack.label}. ${onTrack.reasons.slice(0, 3).join(' ')}`,
      readinessLine(studentState),
      `Today's capacity: ~${formatDuration(studentState.capacityMinutes)} (${
        studentState.capacitySource === 'override'
          ? 'the student said this is all the time they have today'
          : studentState.capacitySource === 'goal'
            ? 'their own daily goal'
            : studentState.capacitySource === 'recorded'
              ? 'their recorded average'
              : 'inferred from the syllabus and exam date'
      }).`,
      `Capacity-aware plan for today (engine-calculated — recommend from THIS, in this order):\n${formatDailyPlan(dailyPlan)}`,
      recurringDoubtLine(studentState) ?? '',
      (recommendationLogQ.data ?? []).length > 0
        ? `Recent engine recommendations with stored reasons (quote these when asked "why"):\n${(recommendationLogQ.data ?? [])
            .slice(0, 5)
            .map((row) => `- [${row.created_on}] ${row.recommendation} — because ${row.reason}${row.data_used ? ` (data: ${row.data_used})` : ''}`)
            .join('\n')}`
        : '',
      goals ? `Student's goal: ${goals}` : '',
      dailyGoal ? `Daily study-hour goal: ${dailyGoal}h.` : '',
      studentItems.length === 0 && scoreEntries.length === 0
        ? 'FIRST SESSION (Day 1): this student has ZERO tasks and ZERO history. NEVER invent, guess or suggest any topic they have not themselves mentioned in this conversation. Ask what THEY want to study today, then add exactly what they name with add_task — nothing more.'
        : '',
      `Language preference: ${language}. Reply in ${language === 'hindi' ? 'natural Hindi' : language === 'hinglish' ? 'casual Hinglish (Hindi + English)' : 'English'}.`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const quickAnswer = (question: string): string => {
    const missionNow = missionQueue[0];
    if (language === 'hindi') {
      if (question === 'What should I do today?') return missionNow ? `आज पहले ${missionNow.topic} (${missionNow.subject}) पर एक फोकस्ड सेशन करो।` : 'आज की सूची खाली है — + दबाकर अपना पहला टास्क जोड़ो।';
      if (question === 'Am I on track?') return `${pace.emoji} ${pace.label} — परीक्षा में ${daysToExam} दिन बाकी हैं। ${pace.detail}`;
      if (question === 'What are my weak areas?') return weakAreas.length ? `अभी सबसे पहले ${weakAreas.slice(0, 3).map((area) => area.label).join(', ')} पर ध्यान दो।` : 'अभी पर्याप्त टेस्ट डेटा नहीं है — एक स्कोर लॉग करो, फिर मैं सही पैटर्न बताऊँगा।';
      return formula.length ? `आज का रिविज़न क्रम: ${formula.slice(0, 5).map((entry) => entry.item.topic).join(', ')}।` : 'पहला टॉपिक पूरा करो — 1-3-5-7 रिविज़न अपने आप जुड़ जाएगा।';
    }
    if (language === 'hinglish') {
      if (question === 'What should I do today?') return missionNow ? `Aaj pehle ${missionNow.topic} (${missionNow.subject}) ka ek focused session karo.` : 'Aaj ki list clear hai — + tap karke apna first task add karo.';
      if (question === 'Am I on track?') return `${pace.emoji} ${pace.label} — exam tak ${daysToExam} days hain. ${pace.detail}`;
      if (question === 'What are my weak areas?') return weakAreas.length ? `Abhi priority: ${weakAreas.slice(0, 3).map((area) => area.label).join(', ')}.` : 'Abhi test data kam hai — ek score log karo, phir pattern clear hoga.';
      return formula.length ? `Aaj ka revision order: ${formula.slice(0, 5).map((entry) => entry.item.topic).join(', ')}.` : 'Pehla topic complete karo — 1-3-5-7 revision automatically add ho jayega.';
    }
    if (question === 'What should I do today?') {
      // The engine's capacity-aware plan: MUST DO / SHOULD DO / IF TIME, with
      // an honest backlog note — never the whole backlog dumped into one day.
      if (dailyPlan.mustDo.length === 0 && doneToday.length > 0) {
        return `Your list is clear — ${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} done today. If you have fuel left, say "pick something for me" and I'll queue something smart.`;
      }
      if (dailyPlan.mustDo.length === 0) {
        return "Nothing queued yet — tell me what you're studying, or say \"pick for me\" and I'll queue it myself.";
      }
      return `Here's today, fitted to your ~${formatDuration(dailyPlan.capacityMinutes)}:\n\n${formatDailyPlan(dailyPlan)}`;
    }
    if (question === 'Am I on track?') {
      const last = scoreEntries.slice(-3);
      const trend =
        last.length >= 2
          ? ` Your last ${last.length} tests: ${last
              .map((e) => (e.marks !== null && e.total !== null ? `${e.marks}/${e.total}` : `${e.percent}%`))
              .join(', ')}.`
          : '';
      // Multi-signal verdict: coverage + hours + revision backlog + test trend.
      return `${pace.emoji} ${onTrack.label} — ${onTrack.reasons.slice(0, 3).join(' ')} ${daysToExam} days to ${examDef?.target.label ?? 'exam day'}.${trend} ${trackQuote(pace.status)}`;
    }
    if (question === 'What are my weak areas?') {
      if (weakAreas.length === 0) {
        return `I don't have test data yet, so I won't invent a weak area. Log a test score on the Dashboard tab — even a rough mock — and note what went wrong in its mistake log; I'll start spotting patterns immediately. For now, ${leastCoveredSubject ? `${leastCoveredSubject} has the least coverage, so that's where I'd lean` : 'keep covering fresh ground'}.`;
      }
      return `Based on your own numbers: ${weakAreas
        .slice(0, 3)
        .map((w) => `${w.label} — ${w.detail}`)
        .join('; ')}. Want me to queue practice on the top one? Just say “add task: …” with that topic and I'll put it on Today.`;
    }
    // Give me a revision plan
    if (formula.length === 0) {
      return "Nothing is in your revision cycle yet — finish one topic today and it comes back at 1, 3, 5, 7 and 14 days automatically. That's the whole plan; you don't have to schedule anything.";
    }
    const lines = formula
      .slice(0, 5)
      .map((f, idx) => `${idx + 1}. ${f.item.topic} (${f.item.subject})${f.recall ? ' — quick recall' : ` — day-${f.item.interval_days} revisit`}`)
      .join('\n');
    return `Here's today's five, in order:\n${lines}\n${overdueRevisions.length > 0 ? `${overdueRevisions.length} of these slipped 2+ days — clear those first.` : 'Do them before new learning; recall fades fastest.'}`;
  };

  /* ---------- coach actions (CHANGE 1): the AI acts, never deflects ---------- */

  /** Fuzzy-match a spoken task name onto a pending checklist row. */
  const findPendingTask = (query: string): StudyItem | undefined => {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    const pool = [...missionQueue, ...dueRevisions, ...carryOver];
    const exact = pool.find((i) => i.topic.toLowerCase() === q);
    if (exact) return exact;
    const contains = pool.find((i) => i.topic.toLowerCase().includes(q) || q.includes(i.topic.toLowerCase()));
    if (contains) return contains;
    const words = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    let best: StudyItem | undefined;
    let bestScore = 0;
    for (const item of pool) {
      const topic = item.topic.toLowerCase();
      const score = words.reduce((sum, w) => sum + (topic.includes(w) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return bestScore > 0 ? best : undefined;
  };

  const coachAddTask = async (title: string, subjectHint?: string): Promise<string> => {
    const parsed = parseOneLiner(title, examDef);
    const subject = (subjectHint || '').trim() || parsed.subject || 'General';
    const created = await addTask(subject, title.trim(), parsed.type, true);
    if (created) {
      logRecommendation('coach-action', `Added task: ${title.trim()} (${subject})`, 'student asked for it in chat', 'chat request, validated against the pending list for duplicates', 'task created');
    }
    return created
      ? `Done — I've added ${title.trim()} to today's list under ${subject}.`
      : `“${title.trim()}” is already on your plan — I skipped the duplicate.`;
  };

  const coachMarkDone = async (query: string): Promise<string> => {
    const item = findPendingTask(query);
    if (!item) return `I couldn't find a pending task matching “${query}” on today's list. Ask me to "list my tasks" and I'll read them out.`;
    await handleToggle(item);
    logRecommendation('coach-action', `Marked done: ${item.topic} (${item.subject})`, 'student said they finished it in chat', `pending item #${item.id}, matched from "${query}"`, 'completed — history, mastery and revisions updated');
    return `Done — “${item.topic}” is checked off.${item.kind === 'new' ? ' Its spaced revisions are queued.' : ''}`;
  };

  const coachRemoveTask = async (query: string): Promise<string> => {
    const item = findPendingTask(query);
    if (!item) return `I couldn't find a pending task matching “${query}”. Ask me to "list my tasks" to see what's queued.`;
    const db = window.__workspaceDb.from('zuno_items');
    await db.delete(item.id);
    if (item.kind === 'new') {
      const key = item.source_key || topicKey(item.subject, item.topic);
      const pendingRevs = items.filter((i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending');
      await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
    }
    itemsQ.refresh();
    logRecommendation('coach-action', `Removed task: ${item.topic} (${item.subject})`, 'student asked to remove it in chat', `pending item #${item.id}, matched from "${query}"`, 'task removed');
    return `Done — I've removed “${item.topic}” from your list.`;
  };

  /** Move a pending task/revision to a later day — validated against real
   * state first; the AI only ever hands over intent, never writes directly. */
  const coachPostponeTask = async (query: string, days: number): Promise<string> => {
    const item = findPendingTask(query);
    if (!item) {
      return `I couldn't find a pending task matching “${query}” on your list, so nothing was moved. Ask me to "list my tasks" and I'll read out what's queued.`;
    }
    const safeDays = Number.isFinite(days) && days >= 1 ? Math.min(30, Math.round(days)) : 1;
    const target = addDaysISO(today, safeDays);
    await window.__workspaceDb.from('zuno_items').update(item.id, {
      scheduled_for: target,
      ...(item.kind === 'new' ? { day_number: Math.max(1, day + safeDays) } : {}),
    });
    itemsQ.refresh();
    logRecommendation('coach-action', `Postponed: ${item.topic} → ${target}`, 'student asked to move it in chat', `pending item #${item.id}, matched from "${query}"`, 'rescheduled');
    return `Done — “${item.topic}” is moved to ${safeDays === 1 ? 'tomorrow' : target}. ${
      item.kind === 'revision'
        ? 'Only this revision moved — the rest of its spaced ladder is untouched.'
        : 'Its spaced revisions will still queue from the day you actually finish it.'
    }`;
  };

  /** Skip ONE due revision ("I already know this") — the topic's later
   * intervals stay queued, so nothing is erased from the schedule. */
  const coachSkipRevision = async (query: string): Promise<string> => {
    const q = query.trim().toLowerCase();
    const item = q
      ? dueRevisions.find((i) => i.topic.toLowerCase().includes(q) || q.includes(i.topic.toLowerCase()))
      : dueRevisions[0];
    if (!item) {
      return q
        ? `No revision matching “${query}” is due today, so nothing was skipped. Ask me to "list my tasks" to see what is due.`
        : 'No revisions are due today — nothing to skip.';
    }
    await window.__workspaceDb.from('zuno_items').update(item.id, { status: 'skipped' });
    itemsQ.refresh();
    logRecommendation('coach-action', `Skipped revision: ${item.topic} (${item.subject})`, 'student said they already know it / asked to skip', `due revision #${item.id}`, 'revision skipped');
    return `Okay — today's ${item.topic} revision is skipped. Its later spaced revisions stay queued, so if a test ever says otherwise, the topic comes straight back.`;
  };

  /** "I only have 2 hours today" — record today's real capacity; the daily
   * plan re-fits itself, prioritising the highest-impact items. */
  const coachSetCapacity = async (minutes: number): Promise<string> => {
    const n = Math.round(Number(minutes));
    if (!Number.isFinite(n) || n < 15 || n > 1080) {
      return 'Tell me the time you actually have — like "I have 2 hours today" — and I\'ll re-plan the day around it.';
    }
    await upsertMeta(`capacity_${today}`, String(n));
    // Preview the re-fitted plan immediately (pure recompute, no extra reads).
    const preview = buildDailyPlan(
      buildStudentState({ ...studentState.args, capacityOverrideMinutes: n }),
    );
    logRecommendation('coach-action', `Capacity set: ${formatDuration(n)} today`, "student told me their available time", 'chat request', 'daily plan re-fitted');
    const top = preview.mustDo.map((entry) => `${entry.item.kind === 'revision' ? 'Revise ' : ''}${entry.item.topic} (~${formatDuration(entry.estMinutes)})`);
    return `Got it — planning today around ${formatDuration(n)}.${
      top.length > 0 ? ` The highest-impact fit: ${top.join(' · ')}.` : ''
    }${preview.backlogNote ? ` ${preview.backlogNote}` : ' Everything pending fits in that time.'}`;
  };

  /** "Show me what I'm behind on" — the honest backlog, straight from the engine. */
  const coachShowBacklog = (): string => describeBacklog(studentState);

  const coachListToday = (): string => {
    const pending = [...missionQueue, ...dueRevisions];
    if (pending.length === 0 && doneToday.length === 0) {
      return 'Today\'s list is empty — tell me what to add (e.g. "add plane motion") and it\'s in.';
    }
    if (pending.length === 0) {
      return `Everything is done — ${doneToday.length} task${doneToday.length === 1 ? '' : 's'} completed today. Want me to add something more?`;
    }
    const lines = pending.map((i, idx) => `${idx + 1}. ${i.kind === 'revision' ? `Revise: ${i.topic}` : i.topic} (${i.subject})`);
    const doneLine = doneToday.length > 0 ? `\nDone today: ${doneToday.length}.` : '';
    return `On today's list:\n${lines.join('\n')}${doneLine}`;
  };

  const coachSuggestNext = (): string =>
    nowSuggestion ?? "Nothing is queued and no weak area stands out yet — tell me what you want to study and I'll add it for you.";

  const askCoach = async (text: string, deterministic: boolean) => {
    if (!text.trim() || coachThinking) return;
    // CHANGE 1: "add task: …" — the coach creates the task directly, no forms.
    const addCommand = text.match(/^\s*add\s+(?:a\s+)?task\s*[:\-]?\s*(.+)$/i);
    if (addCommand && profile) {
      const name = addCommand[1].trim();
      setCoachMessages((prev) => [...prev, { role: 'user', text }]);
      try {
        const confirmation = await coachAddTask(name);
        setCoachMessages((prev) => [
          ...prev,
          { role: 'coach', text: `${confirmation} Tell me when it's finished — or just say "mark it done".` },
        ]);
      } catch {
        setCoachMessages((prev) => [
          ...prev,
          { role: 'coach', text: "That task didn't save — mind sending it once more?" },
        ]);
      }
      return;
    }
    // The quick asks are answered from the student's own data, so they stay free
    // forever. Only a real trip to the model counts against the daily budget.
    if (deterministic) {
      setCoachMessages((prev) => [...prev, { role: 'user', text }, { role: 'coach', text: quickAnswer(text) }]);
      return;
    }
    // TEMP: Paywall disabled 2026-08-08 — re-enable once payment is ready.
    // `canAskAi` is always true while the flag is on, so this gate never fires;
    // it is left in place so flipping the flag back restores the daily limit.
    if (!access.canAskAi) {
      setUpgradeReason('limit');
      return;
    }
    setCoachMessages((prev) => [...prev, { role: 'user', text }]);
    setCoachThinking(true);
    try {
      /* Exam-aware grounding: structure, weak topics, readiness and the
       * syllabus chapters relevant to THIS question. */
      const examChatBlock = activeSyllabusExam && readiness
        ? `\n\nEXAM CONTEXT:\n${buildExamChatContext(activeSyllabusExam, weakTopicInsights, readiness, text)}`
        : '';
      const history = coachMessages.slice(-10).map((m) => ({
        role: m.role === 'coach' ? 'assistant' : 'user',
        content: m.text,
      }));
      const response = await fetch('/proxy/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'X-Workspace-DB-Token': (window as any).__workspaceDb?.token ?? '',  'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are VicharakAI (Your Second Mind) — a proactive study companion for competitive-exam aspirants (JEE, NEET, UPSC, CAT, SSC, or any other exam the student set up — use the exam named in STUDENT DATA and never assume a different one). You have FULL ability to modify the student's task list through your tools: add_task, mark_task_done, remove_task, postpone_task, skip_revision, set_todays_capacity, show_backlog, list_todays_tasks and suggest_next — the very same functions behind the app's quick-add bar and checklist. You interpret the student's intent into a tool call; the app's deterministic engine validates it against their actual state and executes it — you never write to storage directly, and a tool may refuse with an explanation. When the user asks you to add, remove, move, mark done, skip or suggest tasks — DO IT by calling the right tool. Never say "you can add it yourself", never say "please do this manually", and never send them to a form. Examples: "add plane motion" → add_task; "mark Optics done" → mark_task_done; "move optics to tomorrow" → postpone_task; "I already know this / skip this revision" → skip_revision; "I only have 2 hours today / I'm tired, keep it light" → set_todays_capacity; "what am I behind on" → show_backlog; "what should I do now" → suggest_next. remove_task and skip_revision are destructive — call them ONLY when the student explicitly asks; if ambiguous, ask one short clarifying question instead. When the student overrides a recommendation, accept it and adapt — never push the same recommendation again. Always follow the student's language preference in STUDENT DATA; Hinglish means a casual natural mix of Hindi and English. Talk like a senior who cracked the exam: encouraging but honest, peer-to-peer, no lectures, no guilt-tripping. Keep answers short (2-5 sentences), concrete, and action-oriented — push the student toward studying, not toward more chatting.\n\nDATA RULES (strict): everything in STUDENT DATA is measured from the student's own tracked data or calculated by the engine. Ground every claim ONLY in it — NEVER invent scores, study history, syllabus content, exam dates, official weightages, revision history or test results. When you cite a test, use the real marks (e.g. "148/180 in Mock #3"), not just a percentage. When recommending what to study, follow the engine's capacity-aware plan and its stated reasons — always give the WHY from the data (e.g. "overdue by 2 days + 42% accuracy"), never a bare "revise this". If the data can't answer something, say exactly what's missing (e.g. "log one test and I can tell you") instead of guessing. Suggest at most one action at a time. Never discuss pricing, plans or message limits — the app handles that.\n\nSTUDENT DATA:\n${coachContext()}${examChatBlock}`,
            },
            ...history,
            { role: 'user', content: text },
          ],
          tools: COACH_TOOLS,
          tool_choice: 'auto',
          max_tokens: 400,
          temperature: 0.7,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();
      const message = data?.choices?.[0]?.message ?? {};
      // Only a delivered answer is charged — a failed request is on us.
      setAiUsedToday(recordAiMessage(spaceId, today));

      // CHANGE 1: the model asked to ACT — run the same functions the app's
      // own buttons use, then confirm briefly. Never deflect to manual steps.
      const toolCalls: Array<{ function?: { name?: string; arguments?: string } }> =
        Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (toolCalls.length > 0) {
        const confirmations: string[] = [];
        for (const call of toolCalls) {
          const name = call?.function?.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call?.function?.arguments || '{}') as Record<string, unknown>;
          } catch {
            /* malformed args — treated as empty */
          }
          try {
            if (name === 'add_task' && String(args.title ?? '').trim()) {
              confirmations.push(await coachAddTask(String(args.title), typeof args.subject === 'string' ? args.subject : undefined));
            } else if (name === 'mark_task_done') {
              confirmations.push(await coachMarkDone(String(args.task ?? '')));
            } else if (name === 'remove_task') {
              confirmations.push(await coachRemoveTask(String(args.task ?? '')));
            } else if (name === 'list_todays_tasks') {
              confirmations.push(coachListToday());
            } else if (name === 'suggest_next') {
              confirmations.push(coachSuggestNext());
            } else if (name === 'postpone_task') {
              confirmations.push(await coachPostponeTask(String(args.task ?? ''), Number(args.days ?? 1)));
            } else if (name === 'skip_revision') {
              confirmations.push(await coachSkipRevision(String(args.topic ?? '')));
            } else if (name === 'set_todays_capacity') {
              confirmations.push(await coachSetCapacity(Number(args.minutes)));
            } else if (name === 'show_backlog') {
              confirmations.push(coachShowBacklog());
            }
          } catch {
            confirmations.push("That action didn't go through — mind asking once more?");
          }
        }
        const spoken = typeof message.content === 'string' && message.content.trim() ? `${message.content.trim()}\n\n` : '';
        setCoachMessages((prev) => [
          ...prev,
          { role: 'coach', text: `${spoken}${confirmations.join('\n\n')}`.trim() || 'Done.' },
        ]);
        return;
      }

      const reply = message.content;
      setCoachMessages((prev) => [
        ...prev,
        {
          role: 'coach',
          text: typeof reply === 'string' && reply.trim() ? reply : 'Hmm, I lost my train of thought — ask me that once more?',
        },
      ]);
    } catch {
      setCoachMessages((prev) => [
        ...prev,
        {
          role: 'coach',
          text: "I couldn't reach my thinking cap just now — check your connection and ask again. Meanwhile, the quick questions above always work.",
        },
      ]);
    } finally {
      setCoachThinking(false);
    }
  };

  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coachMessages, coachThinking]);

  /* ================= render ================= */

  const rootClass = themeMode === 'light' ? 'vicharak-app vicharak-light' : 'vicharak-app';
  const shellStyle: CSSProperties = { background: PAGE_BG, color: TEXT, minHeight: '100%' };

  if (profileQ.loading || (profile && itemsQ.loading && items.length === 0)) {
    return (
      <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 w-full`} style={shellStyle}>
        <style>{MOTION_CSS}</style>
        <div
          className="animate-spin rounded-full h-8 w-8"
          style={{ border: `2px solid ${BORDER}`, borderTopColor: AMBER }}
        />
        <p className="text-sm" style={{ color: TEXT_MUTED }}>
          One sec — remembering where we left off…
        </p>
      </div>
    );
  }

  if (profileQ.error) {
    return (
      <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 px-6 text-center w-full`} style={shellStyle}>
        <style>{MOTION_CSS}</style>
        <p className="text-sm" style={{ color: DANGER }}>
          I couldn't load your plan: {profileQ.error.message}
        </p>
        <button
          type="button"
          onClick={() => {
            profileQ.refresh();
            itemsQ.refresh();
          }}
          className="px-4 py-2 text-sm font-bold"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
        >
          Let's try that again
        </button>
      </div>
    );
  }

  /* ---------- ONBOARDING: essentials only — exam + date, both skippable ---------- */
  if (!profile) {
    const draftExam = obCustomExam ?? (obExam ? getExam(obExam) : undefined);
    /* CHANGE 11: search + country/category filters over the expanded catalogue. */
    const OB_CATEGORIES = ['All', 'Engineering', 'Medical', 'Law', 'Business', 'Government', 'General'];
    const obCountries = ['All', ...Array.from(new Set(EXAMS.map((exam) => exam.country ?? 'Other')))];
    const obQuery = obSearch.trim().toLowerCase();
    const obFiltered = EXAMS.filter((exam) => {
      if (obCountry !== 'All' && (exam.country ?? 'Other') !== obCountry) return false;
      if (obCategory !== 'All' && (exam.category ?? 'General') !== obCategory) return false;
      if (!obQuery) return true;
      return (
        exam.name.toLowerCase().includes(obQuery) ||
        exam.fullName.toLowerCase().includes(obQuery) ||
        (exam.country ?? '').toLowerCase().includes(obQuery) ||
        (exam.category ?? '').toLowerCase().includes(obQuery)
      );
    });
    const obPill = (active: boolean): CSSProperties =>
      active
        ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
        : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };
    return (
      <div className={`${rootClass} w-full flex flex-col items-center px-5 py-8`} style={shellStyle}>
        <style>{MOTION_CSS}</style>
        <div className="w-full max-w-md vicharak-rise">
          {/* Skip is always visible — nothing here is mandatory. */}
          <div className="flex items-center justify-between mb-4">
            <span className="w-14" aria-hidden="true" />
            <VicharakAvatar size="lg" />
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                if (obStep === 1) {
                  setObExam(null);
                  setObCustomExam(null);
                  setObCustomOpen(false);
                  setObStep(2);
                } else if (obStep === 2) {
                  setObStep(3);
                } else {
                  void finishOnboarding(draftExam ?? null, obDate || null, []);
                }
              }}
              className="w-14 px-3 py-1.5 text-xs font-extrabold disabled:opacity-50 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
              data-testid="button-ob-skip"
            >
              Skip
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-5" aria-label={`Step ${obStep} of 3`}>
            {[1, 2, 3].map((step) => (
              <span key={step} className="h-1.5 rounded-full transition-all" style={{ width: step === obStep ? 24 : 8, background: step <= obStep ? AMBER : BORDER }} />
            ))}
          </div>

          {obStep === 1 && (
            <div>
              <h1 className="text-2xl font-extrabold text-center" style={{ color: TEXT }}>Choose your exam</h1>
              <p className="text-sm text-center mt-2" style={{ color: TEXT_SECONDARY }}>
                So VicharakAI knows what to prioritise for you.
              </p>
              {/* CHANGE 11: search + filters, then the filtered catalogue. */}
              <input
                value={obSearch}
                onChange={(event) => setObSearch(event.target.value)}
                placeholder="Search exams — JEE, SAT, GRE, Gaokao…"
                className="mt-4 px-3 py-2.5 text-sm"
                style={inputStyle}
                data-testid="input-exam-search"
              />
              <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 vicharak-scroll-x" data-testid="filter-exam-country">
                {obCountries.map((countryName) => (
                  <button
                    key={`c-${countryName}`}
                    type="button"
                    onClick={() => setObCountry(countryName)}
                    className="flex-shrink-0 px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                    style={obPill(obCountry === countryName)}
                    data-testid={`exam-country-${countryName}`}
                  >
                    {countryName}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 vicharak-scroll-x" data-testid="filter-exam-category">
                {OB_CATEGORIES.map((categoryName) => (
                  <button
                    key={`k-${categoryName}`}
                    type="button"
                    onClick={() => setObCategory(categoryName)}
                    className="flex-shrink-0 px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                    style={obPill(obCategory === categoryName)}
                    data-testid={`exam-category-${categoryName}`}
                  >
                    {categoryName}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2.5 max-h-[42vh] overflow-y-auto pr-0.5" data-testid="list-exams">
                {obFiltered.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => {
                      setObCustomExam(null);
                      setObCustomOpen(false);
                      setObExam(exam.id);
                      setObDate(defaultExamDate(exam, today));
                      setObStep(2);
                    }}
                    className="w-full p-3.5 flex items-center gap-3 text-left"
                    style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.hero }}
                    data-testid={`button-exam-${exam.id}`}
                  >
                    <GraduationCap className="w-5 h-5 flex-shrink-0" style={{ color: AMBER }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold" style={{ color: TEXT }}>{exam.name}</span>
                      <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>{exam.fullName}</span>
                      <span className="block text-[9px] mt-0.5 font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        {exam.country ?? 'Other'} · {exam.category ?? 'General'}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: TEXT_MUTED }} />
                  </button>
                ))}
                {obFiltered.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: TEXT_MUTED }} data-testid="text-exam-no-match">
                    No exams match that search — pick “Other” below and type it; I’ll fetch the syllabus.
                  </p>
                )}
              </div>
              {/* "Other": any exam the student types — syllabus fetched for them. */}
              <div className="mt-2.5">
                {obCustomOpen ? (
                  <CustomExamEntry today={today} onReady={acceptTypedExam} onCancel={() => setObCustomOpen(false)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setObCustomOpen(true)}
                    className="w-full p-3.5 flex items-center gap-3 text-left"
                    style={{ background: CARD, border: `1px dashed ${tint(AMBER, 0.55)}`, borderRadius: RADIUS.hero }}
                    data-testid="button-exam-custom"
                  >
                    <Wand2 className="w-5 h-5" style={{ color: AMBER }} />
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold" style={{ color: TEXT }}>Other — type your exam</span>
                      <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>Any other exam — I’ll fetch its syllabus</span>
                    </span>
                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: TEXT_MUTED }} />
                  </button>
                )}
              </div>
            </div>
          )}

          {obStep === 2 && (
            <div>
              <h1 className="text-2xl font-extrabold text-center" style={{ color: TEXT }}>When is your exam?</h1>
              <p className="text-sm text-center mt-2" style={{ color: TEXT_SECONDARY }}>
                So we know how much time you have and can set your weekly targets.
              </p>
              {draftExam && (
                <p className="text-[11px] text-center mt-3" style={{ color: TEXT_MUTED }} data-testid="text-ob-exam-summary">
                  {draftExam.fullName}
                  {draftExam.custom ? ` · ${countTopics(draftExam.subjects)} topics fetched` : ''}
                </p>
              )}
              <div className="p-4 mt-4" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.hero }}>
                <label className="block text-xs font-extrabold mb-2" style={{ color: TEXT_MUTED }} htmlFor="ob-exam-date">Exam date</label>
                <input id="ob-exam-date" type="date" value={obDate} min={today} onChange={(event) => setObDate(event.target.value)} className="px-3 py-2.5" style={inputStyle} />
              </div>
              <button
                type="button"
                onClick={() => setObStep(3)}
                className="mt-4 w-full py-3.5 text-sm font-extrabold inline-flex items-center justify-center gap-2"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-ob-next"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setObStep(1)} className="mt-4 w-full text-xs font-semibold" style={{ color: TEXT_MUTED }}>← Back</button>
            </div>
          )}

          {/* CHANGE 13: Day-1 topics — the student says what to study; the plan
              is built from ONLY that. One line = one task, commas never split. */}
          {obStep === 3 && (
            <div>
              <h1 className="text-2xl font-extrabold text-center" style={{ color: TEXT }}>What do you want to study today?</h1>
              <p className="text-sm text-center mt-2" style={{ color: TEXT_SECONDARY }}>
                Your Day-1 plan is built only from what you write here — nothing is guessed for you.
              </p>
              <div className="p-4 mt-4" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.hero }}>
                <label className="block text-xs font-extrabold mb-2" style={{ color: TEXT_MUTED }} htmlFor="ob-topics">Today's topics — one per line</label>
                <textarea
                  id="ob-topics"
                  value={obTopics}
                  onChange={(event) => setObTopics(event.target.value)}
                  rows={5}
                  placeholder={'e.g.\nPlane motion, waves\nOrganic chemistry basics'}
                  className="px-3 py-2.5 text-sm resize-none"
                  style={inputStyle}
                  data-testid="input-ob-topics"
                />
                <p className="text-[10px] mt-1.5" style={{ color: TEXT_MUTED }}>Each line becomes one task — a comma stays inside the same task.</p>
              </div>
              <button
                type="button"
                disabled={creating || !obTopics.trim()}
                onClick={() => void finishOnboarding(draftExam ?? null, obDate || null, obTopics.split(/\n+/))}
                className="mt-4 w-full py-3.5 text-sm font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-2"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-ob-finish"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {creating ? 'Building your Day-1 plan…' : 'Build my Day-1 plan'}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => void finishOnboarding(draftExam ?? null, obDate || null, [])}
                className="mt-3 w-full text-xs font-semibold disabled:opacity-50"
                style={{ color: TEXT_MUTED }}
                data-testid="button-ob-no-topics"
              >
                I'll add my topics later
              </button>
              <button type="button" onClick={() => setObStep(2)} className="mt-4 w-full text-xs font-semibold" style={{ color: TEXT_MUTED }}>← Back</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- shared per-render values ---------- */

  const baseMission = missionQueue[0];
  const lighter = lowMode ? pickLighterTask(studentItems, baseMission, today) : null;
  const lowReadFallback = Boolean(lowMode && lighter && !lighter.item && baseMission);
  const mission = lowMode && lighter?.item ? lighter.item : baseMission;
  const missionAnn = mission ? annotations.get(mission.source_key || topicKey(mission.subject, mission.topic)) : undefined;
  const missionStarted = mission ? startedIds.has(mission.id) : false;
  const matchesSubjectFilter = (item: StudyItem) => subjectFilter === 'All' || item.subject === subjectFilter;
  const laterAll = missionQueue.filter((i) => i.id !== mission?.id && matchesSubjectFilter(i));
  const laterVisible = showAllLater ? laterAll : laterAll.slice(0, VISIBLE_LATER_CAP);
  const formulaVisible = formula.filter(({ item }) => matchesSubjectFilter(item));
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const examName = examDef?.name ?? (savedExamLabel || examLabelFromId(profile.exam));

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

  const formSubjectDef = examDef?.subjects.find((subject) => subject.name === formSubject);
  const formTopics = (formSubjectDef
    ? subjectTopics(formSubjectDef).map((entry) => ({ ...entry, subject: formSubjectDef.name }))
    : examDef?.subjects.flatMap((subject) => subjectTopics(subject).map((entry) => ({ ...entry, subject: subject.name }))) ?? []
  ).filter((entry) => {
    if (formChapter && entry.chapter !== formChapter) return false;
    if (formSearch.trim()) {
      const query = formSearch.trim().toLowerCase();
      return (
        entry.topic.toLowerCase().includes(query) ||
        entry.chapter.toLowerCase().includes(query) ||
        entry.subject.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const pillStyle = (active: boolean): CSSProperties =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  return (
    <div className={`${rootClass} relative flex flex-col w-full`} style={shellStyle}>
      <style>{MOTION_CSS}</style>

      <div className="flex-1 flex flex-col min-h-0">
        {/* ================= TODAY ================= */}
        {tab === 'today' && (
          <div className="flex-1 w-full max-w-[600px] mx-auto px-5 sm:px-8 pb-28">
            {/* The date header is a plain, non-interactive text line — no
                buttons, tap handlers or actions live on it. */}
            <header
              className="sticky top-0 z-20 -mx-5 sm:-mx-8 px-5 sm:px-8 pt-6 pb-2"
              style={{ background: PAGE_BG }}
              data-testid="header-today"
            >
              <h1
                className="min-w-0 text-[22px] sm:text-[26px] font-extrabold leading-[1.12] tracking-tight truncate"
                style={{ color: TEXT }}
                data-testid="text-today-date"
              >
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </h1>
            </header>

            {/* CHANGE 6 — the weekly target strip: Mon–Sun circles, filled on
                days with completed tasks, today ringed. Tap a day for details. */}
            <div className="mt-1 flex items-stretch justify-between gap-1" data-testid="week-strip">
              {weekDays.map((iso, index) => {
                const doneCount = (completedByDate.get(iso) ?? []).length;
                const isToday = iso === today;
                const isFuture = iso > today;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isFuture}
                    onClick={() => setWeekDayDetail(iso)}
                    className="flex-1 flex flex-col items-center gap-1 py-1 touch-manipulation disabled:opacity-40"
                    aria-label={`${iso}: ${doneCount} task${doneCount === 1 ? '' : 's'} completed`}
                    data-testid={`week-day-${iso}`}
                  >
                    <span className="text-[9px] font-extrabold uppercase" style={{ color: isToday ? AMBER : TEXT_MUTED }}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                    </span>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                      style={{
                        background: doneCount > 0 ? SUCCESS : 'transparent',
                        color: doneCount > 0 ? '#06281A' : TEXT_MUTED,
                        border: doneCount > 0 ? '1.5px solid transparent' : `1.5px solid ${BORDER_STRONG}`,
                        boxShadow: isToday ? `0 0 0 2px ${AMBER}` : undefined,
                      }}
                    >
                      {doneCount > 0 ? doneCount : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* FIX 6 — the carry-over question is now a ONE-TIME bottom-sheet
                modal (rendered near the other sheets); carried tasks live in
                the "From yesterday" section inside the tasks card below. */}

            {/* CHANGE 6 — the daily topic check-in: "What are you studying
                today?" — shown until answered, once per day. */}
            {checkinVisible && (
              <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-daily-checkin">
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-extrabold" style={{ color: TEXT }}>What are you studying today?</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>One line per topic — I'll build today's plan from it.</p>
                  </div>
                  <button
                    type="button"
                    onClick={markCheckinDone}
                    aria-label="Skip today's check-in"
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                    style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                    data-testid="button-checkin-skip"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <textarea
                  value={checkinText}
                  onChange={(event) => setCheckinText(event.target.value)}
                  rows={2}
                  placeholder="e.g. Revise electrostatics"
                  className="mt-3 w-full px-3 py-2.5 text-sm resize-none"
                  style={inputStyle}
                  data-testid="input-daily-checkin"
                />
                {quickAddSubjects.length > 0 && (
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {quickAddSubjects.map((name) => (
                      <button
                        key={`ci-${name}`}
                        type="button"
                        onClick={() => setCheckinSubject((current) => (current === name ? '' : name))}
                        aria-pressed={checkinSubject === name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold touch-manipulation"
                        style={checkinSubject === name
                          ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                          : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                        data-testid={`checkin-subject-${name}`}
                      >
                        <SubjectDot subject={name} size={5} />
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!checkinText.trim() || checkinSaving}
                  onClick={() => void submitCheckin()}
                  className="mt-3 w-full py-3 text-sm font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-2 touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                  data-testid="button-checkin-start"
                >
                  {checkinSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start
                </button>
              </Card>
            )}

            {/* CHANGE 1/3/4 — every task for today in ONE card: checkbox + name,
                nothing else per row. Checking off draws a slow strikethrough,
                then the row settles into the visible Completed section below. */}
            <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" style={{ animationDelay: '40ms' }} testId="card-todays-tasks">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-extrabold" style={{ color: TEXT }}>Today's Tasks</h2>
                {/* Task entry lives in the '+' FAB and the daily check-in —
                    nothing text-based sits in this header (CHANGE 1/7). */}
              </div>
              {mainPending.length === 0 && carriedPending.length === 0 && doneToday.length === 0 ? (
                <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: TEXT_MUTED }}>
                  Nothing on today yet — answer the check-in above or tap the '+' button to add your first task.
                  VicharakAI also plans from your history and doubts as they build up.
                </p>
              ) : (
                <>
                  {mainPending.length === 0 ? (
                    carriedPending.length === 0 ? (
                      <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: TEXT_MUTED }}>
                        All done for today — brilliant. New AI-suggested work lands here as your plan and doubts evolve.
                      </p>
                    ) : null
                  ) : (
                    <>
                      {/* CHANGE 3/15 — top 5 active tasks grouped under small
                          subject headers, the rest behind an animated toggle. */}
                      {(() => {
                        const visible = showAllActive ? mainPending : mainPending.slice(0, 5);
                        const groups: Array<{ subject: string; rows: StudyItem[] }> = [];
                        for (const item of visible) {
                          const group = groups.find((entry) => entry.subject === item.subject);
                          if (group) group.rows.push(item);
                          else groups.push({ subject: item.subject, rows: [item] });
                        }
                        const showHeaders = groups.length > 1;
                        const renderRow = (item: StudyItem) => {
                          const busy = busyIds.has(item.id);
                          const completing = completingIds.has(item.id);
                          // CHANGE 8: an attached photo shows as a thumbnail on the row.
                          const thumb = (attachmentsBySourceKey.get(item.source_key || topicKey(item.subject, item.topic)) ?? [])[0];
                          return (
                            <li key={`p-${item.id}`} className={completing ? 'vicharak-completing' : 'vicharak-fade'}>
                              <div className="w-full flex items-center gap-3 px-1 py-2.5">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => completeWithAnimation(item)}
                                  className="min-w-0 flex-1 flex items-center gap-3 text-left disabled:opacity-60 touch-manipulation"
                                  data-testid={`task-check-${item.id}`}
                                >
                                  {busy ? (
                                    <Loader2 className="w-[18px] h-[18px] animate-spin flex-shrink-0" style={{ color: TEXT_MUTED }} />
                                  ) : completing ? (
                                    <span
                                      className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 vicharak-pop"
                                      style={{ background: SUCCESS, color: '#FFFFFF' }}
                                      aria-hidden="true"
                                    >
                                      <Check className="w-3 h-3" />
                                    </span>
                                  ) : (
                                    <span
                                      className="w-[18px] h-[18px] rounded-[5px] flex-shrink-0"
                                      style={{ border: `1.5px solid ${BORDER_STRONG}` }}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span
                                    className={`min-w-0 flex-1 text-[14px] font-semibold truncate ${completing ? 'vicharak-strike' : ''}`}
                                    style={{ color: TEXT }}
                                  >
                                    {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                                  </span>
                                </button>
                                {thumb && (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(thumb)}
                                    aria-label="View the image attached to this task"
                                    className="flex-shrink-0 touch-manipulation"
                                    data-testid={`task-thumb-${item.id}`}
                                  >
                                    <img
                                      src={thumb}
                                      alt="Task attachment"
                                      className="w-9 h-9 object-cover"
                                      style={{ borderRadius: 8, border: `1px solid ${BORDER}` }}
                                      loading="lazy"
                                    />
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        };
                        return (
                          <div className="mt-1.5" data-testid="list-todays-tasks">
                            {groups.map((group) => (
                              <div key={`group-${group.subject}`}>
                                {showHeaders && (
                                  <p
                                    className="flex items-center gap-1.5 px-1 pt-2 pb-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]"
                                    style={{ color: subjectColor(group.subject) }}
                                  >
                                    <SubjectDot subject={group.subject} size={5} />
                                    {group.subject}
                                  </p>
                                )}
                                <ul>{group.rows.map(renderRow)}</ul>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <ShowMoreToggle
                        hiddenCount={Math.max(0, mainPending.length - 5)}
                        expanded={showAllActive}
                        onToggle={() => setShowAllActive((v) => !v)}
                        testId="toggle-active-tasks"
                      />
                    </>
                  )}

                  {/* FIX 6 — "From yesterday": carried-over tasks in their own
                      collapsible section (collapsed by default), visually muted
                      with a small grey “carried” tag; complete or delete them
                      like any other row. */}
                  {carriedPending.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${BORDER}` }} data-testid="section-from-yesterday">
                      <button
                        type="button"
                        onClick={() => setFromYesterdayOpen((v) => !v)}
                        aria-expanded={fromYesterdayOpen}
                        className="w-full flex items-center gap-2 px-1 py-1 text-left touch-manipulation"
                        data-testid="button-toggle-from-yesterday"
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                          From yesterday · {carriedPending.length}
                        </span>
                        <span className="flex-1" />
                        <ChevronDown
                          className="w-3.5 h-3.5 transition-transform"
                          style={{ color: TEXT_MUTED, transform: fromYesterdayOpen ? 'rotate(180deg)' : undefined }}
                        />
                      </button>
                      {fromYesterdayOpen && (
                        <ul className="vicharak-fade" data-testid="list-from-yesterday">
                          {carriedPending.map((item) => {
                            const busy = busyIds.has(item.id);
                            const completing = completingIds.has(item.id);
                            return (
                              <li key={`carried-${item.id}`} className={completing ? 'vicharak-completing' : 'vicharak-fade'} style={{ opacity: 0.75 }}>
                                <div className="w-full flex items-center gap-3 px-1 py-2.5">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => completeWithAnimation(item)}
                                    className="min-w-0 flex-1 flex items-center gap-3 text-left disabled:opacity-60 touch-manipulation"
                                    data-testid={`carried-check-${item.id}`}
                                  >
                                    {busy ? (
                                      <Loader2 className="w-[18px] h-[18px] animate-spin flex-shrink-0" style={{ color: TEXT_MUTED }} />
                                    ) : completing ? (
                                      <span
                                        className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 vicharak-pop"
                                        style={{ background: SUCCESS, color: '#FFFFFF' }}
                                        aria-hidden="true"
                                      >
                                        <Check className="w-3 h-3" />
                                      </span>
                                    ) : (
                                      <span
                                        className="w-[18px] h-[18px] rounded-[5px] flex-shrink-0"
                                        style={{ border: `1.5px solid ${BORDER_STRONG}` }}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span
                                      className={`min-w-0 flex-1 text-[14px] font-semibold truncate ${completing ? 'vicharak-strike' : ''}`}
                                      style={{ color: TEXT_SECONDARY }}
                                    >
                                      {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                                    </span>
                                  </button>
                                  <span
                                    className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide flex-shrink-0"
                                    style={{ borderRadius: RADIUS.chip, background: tint(TEXT_MUTED, 0.14), color: TEXT_MUTED }}
                                  >
                                    carried
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void deleteCarriedTask(item)}
                                    aria-label={`Delete “${item.topic}”`}
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                                    style={{ background: tint(TEXT_MUTED, 0.1), color: TEXT_MUTED }}
                                    data-testid={`carried-delete-${item.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* CHANGE 4/15 — completed tasks STAY VISIBLE below the active
                      list: first 3 always shown, the rest behind Show more. */}
                  {doneToday.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${BORDER}` }}>
                      <p className="px-1 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                        Completed today · {doneToday.length}
                      </p>
                      <ul data-testid="list-completed-tasks">
                        {(showCompleted ? doneToday : doneToday.slice(0, 3)).map((item) => {
                          const busy = busyIds.has(item.id);
                          return (
                            <li key={`d-${item.id}`} className="vicharak-fade" style={{ opacity: 0.65 }}>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleToggle(item)}
                                className="w-full flex items-center gap-3 px-1 py-2.5 text-left disabled:opacity-60 touch-manipulation"
                                data-testid={`task-check-${item.id}`}
                              >
                                <span
                                  className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                                  style={{ background: SUCCESS, color: '#FFFFFF' }}
                                  aria-hidden="true"
                                >
                                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </span>
                                <span className="min-w-0 flex-1 text-[14px] font-semibold truncate line-through" style={{ color: TEXT_MUTED }}>
                                  {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <ShowMoreToggle
                        hiddenCount={Math.max(0, doneToday.length - 3)}
                        expanded={showCompleted}
                        onToggle={() => setShowCompleted((v) => !v)}
                        testId="toggle-completed-tasks"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Capacity honesty (deterministic engine): when the backlog
                  exceeds today's realistic time, say so — the plan leads with
                  the highest-impact items instead of dumping everything. */}
              {dailyPlan.backlogNote && mainPending.length > 0 && (
                <p
                  className="text-[11px] mt-2.5 leading-relaxed px-3 py-2.5"
                  style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }}
                  data-testid="text-capacity-note"
                >
                  {dailyPlan.backlogNote}
                </p>
              )}

              {/* Revisions only ever come from completed work, so before the
                  first completion the card says exactly that instead of
                  showing unstudied topics in the revision queue. */}
              {doneTopicKeys.size === 0 && (
                <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-revision-empty">
                  Complete your first study session — then we'll schedule your revisions automatically.
                </p>
              )}
            </Card>

            {/* Exam Insights — readiness bar, top weak topics with Study Now,
                and the exam countdown, all from the adaptation engine. */}
            {activeSyllabusExam && readiness && (
              <ExamInsightsCard
                examName={activeSyllabusExam.name}
                daysToExam={daysToExam}
                readiness={readiness}
                weakTopics={weakTopicInsights}
                addingTopicId={insightsAdding}
                onStudyNow={(weakTopic) => void studyWeakTopicNow(weakTopic)}
                onOpenSyllabus={() => setSyllabusBrowserOpen(true)}
              />
            )}

            {/* CHANGE 6 — Question Revision: shown ONLY when questions are due
                by their spaced schedule. Tapping a card opens it as a popup. */}
            {dueFlagged.length > 0 && (
              <section className="mt-5 vicharak-rise" style={{ animationDelay: '70ms' }} data-testid="section-question-revision">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
                    Question Revision · {dueFlagged.length} due
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab('doubts')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold touch-manipulation"
                    style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
                    data-testid="button-open-doubts"
                  >
                    <Plus className="w-3 h-3" />
                    My Doubts
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {(showAllFlagged ? dueFlagged : dueFlagged.slice(0, 3)).map((row) => (
                    <li key={row.id} className="vicharak-fade">
                      <button
                        type="button"
                        onClick={() => setFlaggedDetail(row)}
                        className="w-full flex items-center gap-3 px-3.5 py-3 text-left touch-manipulation"
                        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                        data-testid={`question-revision-${row.id}`}
                      >
                        {row.image_url && (
                          <img
                            src={row.image_url}
                            alt="Question"
                            className="w-12 h-12 object-cover flex-shrink-0"
                            style={{ borderRadius: 8, border: `1px solid ${BORDER}` }}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-[12px] leading-snug"
                            style={{ color: TEXT_SECONDARY, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          >
                            {row.question_text.trim() || 'Photo question'}
                          </span>
                          <span
                            className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold"
                            style={{ color: subjectColor(row.subject || 'General') }}
                          >
                            <SubjectDot subject={row.subject || 'General'} size={5} />
                            {row.subject || 'General'}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                      </button>
                    </li>
                  ))}
                </ul>
                <ShowMoreToggle
                  hiddenCount={Math.max(0, dueFlagged.length - 3)}
                  expanded={showAllFlagged}
                  onToggle={() => setShowAllFlagged((v) => !v)}
                  testId="toggle-question-revision"
                />
              </section>
            )}

            {itemsQ.error && (
              <p className="text-xs text-center mt-5" style={{ color: DANGER }}>
                I couldn't sync your checklist: {itemsQ.error.message}
              </p>
            )}
          </div>
        )}

        {/* ================= CALENDAR ================= */}
        {tab === 'calendar' && (
          <div className="flex-1 min-h-0">
            <CalendarTab
              items={studentItems}
              scores={scoreEntries}
              examDef={examDef}
              examId={profile.exam}
              examDate={examDate}
              pace={pace}
              startDate={profile.start_date}
              today={today}
              recommendedNext={tomorrowPicks[0]}
              taskDetails={taskDetails}
              onUpdateTask={updateCalendarTask}
            />
          </div>
        )}

        {/* ================= MY DOUBTS ================= */}
        {tab === 'doubts' && (
          <DoubtsTab
            rows={flaggedRows}
            spaceId={spaceId}
            subjects={subjectNames.length > 0 ? subjectNames : quickAddSubjects}
            canAskAi={access.canAskAi}
            onAiCharged={chargeAi}
            saving={savingFlag}
            onSave={saveFlagged}
            onRemove={(row) => void removeFlagged(row)}
          />
        )}

        {/* ================= ASK VICHARAKAI ================= */}
        {tab === 'coach' && (
          <div
            className="flex-1 flex flex-col min-h-0"
            style={{ background: `linear-gradient(180deg, ${tint(ORANGE, 0.1)} 0%, ${NAVY} 45%)` }}
          >
            <div className="px-4 sm:px-5 pt-5 pb-3 flex flex-shrink-0 items-center gap-3 vicharak-rise">
              <button
                type="button"
                onClick={() => setTab('today')}
                aria-label="Back to today"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                data-testid="button-coach-back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <VicharakAvatar />
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold leading-tight" style={{ color: TEXT }}>
                  Your Second Mind
                </h1>
                <p className="text-[11px]" style={{ color: TEXT_MUTED }} data-testid="text-coach-plan">
                  {planStatusLine(access)}
                </p>
              </div>
              <span className="flex-1" aria-hidden="true" />
              {/* Exam context pill — which exam grounds every AI answer. */}
              <ExamContextPill
                exam={activeSyllabusExam ?? null}
                onSelect={(examId) => {
                  void upsertMeta(CHAT_EXAM_META_KEY, examId);
                  showToast(`Chat is now grounded in ${getSyllabus(examId)?.name ?? 'that exam'}.`);
                }}
              />
            </div>

            {/* The transcript is bottom-anchored and scrolls inside its own box,
                so it always sits flush on the composer — no dead band under a
                short conversation, and none between the composer and the nav. */}
            <div
              className={`flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 pb-0 flex flex-col ${
                coachMessages.length === 0 ? 'justify-center' : ''
              }`}
            >
              <div className={coachMessages.length === 0 ? 'space-y-3' : 'mt-auto space-y-3'}>
              {/* Today's state, said once — it steps aside as soon as you talk. */}
              {coachMessages.length === 0 && (
              <Card
                radius={RADIUS.hero}
                className="p-4 vicharak-rise"
                style={{ background: `linear-gradient(135deg, ${tint(AMBER, 0.16)}, ${CARD})` }}
                testId="card-daily-review"
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                  Today so far
                </p>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: TEXT }}>
                  {doneToday.length === 0
                    ? `Nothing checked off yet — no stress. ${
                        missionQueue.length > 0
                          ? `Your mission is ${missionQueue[0].topic}, and`
                          : 'Your plan fills in from your history and doubts, and'
                      } your daily 5 revisions are waiting.`
                    : `${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} done — ${
                        doneToday.filter((i) => i.kind === 'revision').length
                      } revision${doneToday.filter((i) => i.kind === 'revision').length === 1 ? '' : 's'} locked in. ${
                        missionQueue.length > 0 ? `${missionQueue.length} still queued.` : 'List is clear — strong day.'
                      }`}{' '}
                  {pace.emoji} {pace.label}, {streak}-day streak.
                  {todayMinutes > 0 ? ` ${formatDuration(todayMinutes)} of study time recorded today.` : ''}
                </p>
              </Card>
              )}

              {coachMessages.length === 0 && (
            <Card
              radius={RADIUS.hero}
              className="p-4 vicharak-rise"
              style={{ background: CARD }}
              testId="card-coach-empty-state"
            >
              <div className="flex items-start gap-3">
                <VicharakAvatar size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold" style={{ color: TEXT }}>
                    Ask me anything about your prep…
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                    I remember your plan, scores, completed work and revision gaps — and I act directly. Try “add plane motion”, “mark Optics done”, “remove thermodynamics” or “what should I do now”.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COACH_QUICK_ASKS.slice(0, 4).map((q) => (
                  <button
                    key={`empty-${q}`}
                    type="button"
                    onClick={() => void askCoach(q, true)}
                    className="px-3 py-2.5 text-left text-xs font-bold touch-manipulation transition-transform hover:-translate-y-px"
                    style={{
                      borderRadius: RADIUS.md,
                      background: tint(AMBER, 0.1),
                      border: `1px solid ${tint(AMBER, 0.3)}`,
                      color: AMBER,
                    }}
                    data-testid={`coach-starter-${q.slice(0, 12)}`}
                  >
                    {quickAskLabel(q, language)}
                  </button>
                ))}
              </div>
              {/* Weak-topic starters — built from the adaptation engine. */}
              {activeSyllabusExam && (
                <div className="mt-2 grid grid-cols-1 gap-2" data-testid="coach-exam-starters">
                  {suggestedExamQuestions(activeSyllabusExam, weakTopicInsights).map((q) => (
                    <button
                      key={`exam-q-${q}`}
                      type="button"
                      onClick={() => void askCoach(q, false)}
                      className="px-3 py-2.5 text-left text-xs font-bold touch-manipulation transition-transform hover:-translate-y-px"
                      style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
                      data-testid={`coach-exam-starter-${q.slice(0, 16)}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* conversation — full-bleed cards, never chat bubbles */}
              {coachMessages.map((m, idx) =>
                m.role === 'coach' ? (
                  <Card key={idx} radius={RADIUS.hero} className="p-4 vicharak-rise" testId={`coach-msg-${idx}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <VicharakAvatar size="sm" />
                      <span className="text-xs font-extrabold" style={{ color: AMBER }}>
                        VicharakAI
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TEXT }}>
                      {m.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                    {/* Topics the reply mentioned → one-tap follow-through. */}
                    {activeSyllabusExam && (
                      <TopicActionCards
                        topics={detectMentionedTopics(m.text, activeSyllabusExam)}
                        busyTopicId={topicActionBusy}
                        handledTopicIds={handledTopicIds}
                        onAddToPlan={(mention) => void addTopicToPlanFromChat(mention)}
                        onMarkWeak={(mention) => void markTopicWeakFromChat(mention)}
                      />
                    )}
                  </Card>
                ) : (
                  <div key={idx} className="pl-10 vicharak-rise" data-testid={`coach-msg-${idx}`}>
                    <div
                      className="p-3.5"
                      style={{ borderRadius: RADIUS.hero, background: NAVY_ALT, border: `1px solid ${BORDER}` }}
                    >
                      <span
                        className="block text-[10px] font-extrabold uppercase tracking-wide mb-0.5"
                        style={{ color: TEXT_MUTED }}
                      >
                        You
                      </span>
                      <p className="text-sm" style={{ color: TEXT }}>
                        {m.text}
                      </p>
                    </div>
                  </div>
                ),
              )}
              {coachThinking && (
                <Card radius={RADIUS.hero} className="p-4 flex items-center gap-2.5">
                  <VicharakAvatar size="sm" />
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: AMBER }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: AMBER, animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: AMBER, animationDelay: '0.3s' }} />
                  </span>
                  <span className="text-xs" style={{ color: TEXT_MUTED }}>
                    VicharakAI is thinking…
                  </span>
                </Card>
              )}
              </div>
              <div ref={coachEndRef} />
            </div>

            {/* quick-ask chips + warm composer */}
            <div className="px-4 sm:px-5 pb-0 pt-2 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1.5 vicharak-scroll-x" data-testid="coach-quick-asks">
                {COACH_QUICK_ASKS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void askCoach(q, true)}
                    className="flex-shrink-0 px-3.5 py-2 text-xs font-bold"
                    style={{
                      borderRadius: RADIUS.chip,
                      background: CARD,
                      border: `1px solid ${tint(AMBER, 0.35)}`,
                      color: AMBER,
                    }}
                    data-testid={`quick-ask-${q.slice(0, 12)}`}
                  >
                    {quickAskLabel(q, language)}
                  </button>
                ))}
              </div>
              {!access.canAskAi && (
                <div className="mb-2">
                  <AiLimitNotice
                    message={LIMIT_MESSAGE}
                    priceLine={`Continue with VicharakAI AI — ${PRO_PRICE_MONTHLY}`}
                    onUpgrade={() => setUpgradeReason('limit')}
                  />
                </div>
              )}
              <div
                className="flex items-end gap-2 p-2 pl-4"
                style={{
                  borderRadius: RADIUS.hero,
                  background: CARD,
                  border: `1px solid ${BORDER_STRONG}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <textarea
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const t = coachInput.trim();
                      if (t) {
                        setCoachInput('');
                        void askCoach(t, false);
                      }
                    }
                  }}
                  placeholder={access.canAskAi ? 'Tell VicharakAI how prep is going…' : 'Free AI messages come back tomorrow'}
                  disabled={!access.canAskAi}
                  rows={1}
                  className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none text-sm py-2 min-w-0 disabled:opacity-60"
                  style={{ color: TEXT }}
                  data-testid="coach-input"
                />
                <button
                  type="button"
                  disabled={!coachInput.trim() || coachThinking || !access.canAskAi}
                  onClick={() => {
                    const t = coachInput.trim();
                    if (t) {
                      setCoachInput('');
                      void askCoach(t, false);
                    }
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                  style={{ background: BRAND_GRADIENT, color: ON_AMBER }}
                  data-testid="coach-send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= DASHBOARD (bottom-nav tab, CHANGE 7) ================= */}
        {tab === 'dashboard' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-2 flex-wrap px-4 pt-5 pb-2 flex-shrink-0">
              <h1 className="text-lg font-extrabold" style={{ color: TEXT }}>Dashboard</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={promptForStudyTime}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                  data-testid="button-log-study-time"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {todayMinutes > 0 ? formatDuration(todayMinutes) : 'Log time'}
                </button>
                <button
                  type="button"
                  onClick={() => setFocusOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                  data-testid="button-focus-mode"
                >
                  <Timer className="w-3.5 h-3.5" />
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestError(null);
                    setTestSetupOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.14), border: `1px solid ${tint(AMBER, 0.35)}`, color: AMBER }}
                  data-testid="button-take-test"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Take a Test
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <DashboardTab
                items={studentItems}
                annotations={annotations}
                scoreEntries={scoreEntries}
                mistakes={mistakes}
                doubts={flaggedRows}
                sessions={sessions}
                examDef={examDef}
                examName={examName}
                studentName={studentName}
                examDate={examDate}
                pace={pace}
                today={today}
                streak={streak}
                subjectNames={subjectNames}
                onSaveScore={handleSaveScore}
                onDeleteScore={handleDeleteScore}
                onAddMistake={handleAddMistake}
                onDeleteMistake={handleDeleteMistake}
              />
            </div>
          </div>
        )}

        {/* ================= TOOLS (CHANGE 9) ================= */}
        {tab === 'tools' && (
          <div className="flex-1 w-full max-w-[600px] mx-auto px-5 sm:px-8 pt-6 pb-28">
            {toolView === 'menu' ? (
              <>
                <h1 className="text-lg font-extrabold vicharak-rise" style={{ color: TEXT }}>Tools</h1>
                <p className="mt-1 text-[11px] vicharak-rise" style={{ color: TEXT_MUTED }}>
                  Everything one tap away — no menus inside menus.
                </p>
                {/* FIX 8: Generate Test — the hero tool, front and centre. */}
                <button
                  type="button"
                  onClick={() => {
                    setGenerateTestError(null);
                    setGenerateTestOpen(true);
                  }}
                  className="mt-4 w-full p-4 flex items-center gap-3 text-left vicharak-rise touch-manipulation"
                  style={{ background: BRAND_GRADIENT, borderRadius: RADIUS.lg, color: ON_AMBER, boxShadow: '0 10px 26px rgba(0,87,255,0.35)' }}
                  data-testid="tool-generate-test"
                >
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                    <Trophy className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold">Generate Test</span>
                    <span className="block text-[11px] mt-0.5 opacity-85">
                      A self-marked test from your revision queue &amp; doubts
                      {flaggedRows.length > 0 ? ` · ${flaggedRows.length} question${flaggedRows.length === 1 ? '' : 's'} ready` : ''}
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 flex-shrink-0" />
                </button>
                {/* FIX 3: big tappable cards — Road View and Calendar removed
                    (the calendar already sits in the bottom nav). */}
                <div className="mt-3 grid grid-cols-2 gap-2.5 vicharak-rise" style={{ animationDelay: '30ms' }}>
                  {([
                    { id: 'timer', label: 'Focus Timer', helper: 'Full-screen countdown — logs itself', Icon: Timer, action: () => setFocusOpen(true) },
                    { id: 'test-mode', label: 'Take a Test', helper: 'Timed MCQ test on your topics', Icon: GraduationCap, action: () => { setTestError(null); setTestSetupOpen(true); } },
                    { id: 'weightage', label: 'Weightage', helper: 'Where the marks are in your exam', Icon: BarChart3, action: () => { setToolView('weightage'); setShowAllToolRows(false); } },
                    { id: 'syllabus', label: 'Syllabus', helper: 'Every chapter and your coverage', Icon: BookOpen, action: () => { setToolView('syllabus'); setShowAllToolRows(false); setOpenChapter(null); } },
                    { id: 'syllabus-browser', label: 'Syllabus Browser', helper: `${EXAM_SYLLABUSES.length} exams — mastery colour-coded`, Icon: GraduationCap, action: () => setSyllabusBrowserOpen(true) },
                  ] as const).map(({ id, label, helper, Icon, action }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={action}
                      className="p-4 flex flex-col items-start gap-2.5 text-left touch-manipulation"
                      style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, boxShadow: CARD_SHADOW }}
                      data-testid={`tool-${id}`}
                    >
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold" style={{ color: TEXT }}>{label}</span>
                        <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: TEXT_MUTED }}>{helper}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 vicharak-rise">
                  <button
                    type="button"
                    onClick={() => setToolView('menu')}
                    aria-label="Back to tools"
                    className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                    data-testid="button-tool-back"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-lg font-extrabold" style={{ color: TEXT }}>
                    {toolView === 'weightage' ? 'Weightage' : 'Syllabus'}
                  </h1>
                </div>

                {toolView === 'weightage' && (
                  <div className="mt-4">
                    <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                      Approximate exam weightage per chapter — highest first, so you always know where the marks are in {examName}.
                    </p>
                    {!examDef ? (
                      <p className="text-xs mt-3" style={{ color: TEXT_MUTED }}>No syllabus is loaded for this exam yet.</p>
                    ) : (
                      <>
                        <div className="flex gap-1.5 flex-wrap mt-3">
                          {subjectNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => { setToolSubject(name); setShowAllToolRows(false); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                              style={(toolSubject || subjectNames[0]) === name
                                ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                                : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                              data-testid={`weightage-subject-${name}`}
                            >
                              <SubjectDot subject={name} size={5} />
                              {name}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const subjectDef = examDef.subjects.find((s) => s.name === (toolSubject || subjectNames[0]));
                          if (!subjectDef) return null;
                          const total = subjectDef.chapters.reduce((sum, c) => sum + c.topics.length, 0) || 1;
                          // CHANGE 10: static JEE/NEET weightage first, topic-count estimate as fallback.
                          const rows = [...subjectDef.chapters]
                            .map((c) => ({
                              name: c.name,
                              percent:
                                chapterWeightage(profile.exam, subjectDef.name, c.name) ??
                                Math.max(1, Math.round((c.topics.length / total) * 100)),
                            }))
                            .sort((a, b) => b.percent - a.percent);
                          const visible = showAllToolRows ? rows : rows.slice(0, 6);
                          return (
                            <Card radius={RADIUS.lg} className="mt-3 p-4 space-y-2.5" testId="card-weightage">
                              {visible.map((row) => (
                                <BarRow key={row.name} label={row.name} percent={row.percent} color={subjectColor(subjectDef.name)} right={`${row.percent}% of ${examDef.name}`} />
                              ))}
                              <ShowMoreToggle
                                hiddenCount={Math.max(0, rows.length - 6)}
                                expanded={showAllToolRows}
                                onToggle={() => setShowAllToolRows((v) => !v)}
                                testId="toggle-weightage"
                              />
                            </Card>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {toolView === 'syllabus' && (
                  <div className="mt-4">
                    {!examDef ? (
                      <p className="text-xs" style={{ color: TEXT_MUTED }}>No syllabus is loaded for this exam yet.</p>
                    ) : (
                      <>
                        <div className="flex gap-1.5 flex-wrap">
                          {subjectNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => { setToolSubject(name); setShowAllToolRows(false); setOpenChapter(null); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                              style={(toolSubject || subjectNames[0]) === name
                                ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                                : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                              data-testid={`syllabus-subject-${name}`}
                            >
                              <SubjectDot subject={name} size={5} />
                              {name}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const subjectDef = examDef.subjects.find((s) => s.name === (toolSubject || subjectNames[0]));
                          if (!subjectDef) return null;
                          const subjectTopicTotal = subjectDef.chapters.reduce((sum, c) => sum + c.topics.length, 0) || 1;
                          const weightOf = (chapter: (typeof subjectDef.chapters)[number]) =>
                            chapterWeightage(profile.exam, subjectDef.name, chapter.name) ??
                            Math.max(1, Math.round((chapter.topics.length / subjectTopicTotal) * 100));
                          // CHANGE 10: highest-weight chapters first.
                          const chapters = [...subjectDef.chapters].sort((a, b) => weightOf(b) - weightOf(a));
                          const visible = showAllToolRows ? chapters : chapters.slice(0, 8);
                          return (
                            <div className="mt-3 space-y-2">
                              {visible.map((chapter) => {
                                // Same rule as the Dashboard: a chapter completed
                                // as one task counts as covering all its topics.
                                const chapterDone = doneTopicKeys.has(topicKey(subjectDef.name, chapter.name));
                                const covered = chapterDone
                                  ? chapter.topics.length
                                  : chapter.topics.filter((t) => doneTopicKeys.has(topicKey(subjectDef.name, t))).length;
                                const open = openChapter === chapter.name;
                                return (
                                  <div key={chapter.name} className="overflow-hidden vicharak-fade" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}>
                                    <button
                                      type="button"
                                      onClick={() => setOpenChapter(open ? null : chapter.name)}
                                      aria-expanded={open}
                                      className="w-full px-3.5 py-3 flex items-center gap-3 text-left touch-manipulation"
                                      data-testid={`syllabus-chapter-${chapter.name.slice(0, 20)}`}
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-semibold truncate" style={{ color: TEXT }}>{chapter.name}</span>
                                        <span className="mt-1 flex items-center gap-1.5 flex-wrap">
                                          <span
                                            className="px-1.5 py-0.5 text-[9px] font-extrabold"
                                            style={{ borderRadius: RADIUS.chip, background: subjectTint(subjectDef.name, 0.14), color: subjectColor(subjectDef.name) }}
                                            data-testid={`weightage-pill-${chapter.name.slice(0, 20)}`}
                                          >
                                            {weightOf(chapter)}% of {examDef.name}
                                          </span>
                                          <span className="text-[10px]" style={{ color: covered === chapter.topics.length && covered > 0 ? SUCCESS : TEXT_MUTED }}>
                                            {covered}/{chapter.topics.length} topics covered
                                          </span>
                                        </span>
                                      </span>
                                      <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: open ? 'rotate(180deg)' : undefined }} />
                                    </button>
                                    {open && (
                                      <ul className="px-3.5 pb-3 space-y-1.5 vicharak-fade">
                                        {chapter.topics.map((topicName) => {
                                          const done = chapterDone || doneTopicKeys.has(topicKey(subjectDef.name, topicName));
                                          return (
                                            <li key={topicName} className="flex items-center gap-2 text-[12px]" style={{ color: done ? TEXT_MUTED : TEXT_SECONDARY }}>
                                              {done ? (
                                                <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SUCCESS }} />
                                              ) : (
                                                <span className="w-3.5 h-3.5 rounded-[4px] flex-shrink-0" style={{ border: `1px solid ${BORDER_STRONG}` }} aria-hidden="true" />
                                              )}
                                              <span className={done ? 'line-through' : ''}>{topicName}</span>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                              <ShowMoreToggle
                                hiddenCount={Math.max(0, chapters.length - 8)}
                                expanded={showAllToolRows}
                                onToggle={() => setShowAllToolRows((v) => !v)}
                                testId="toggle-syllabus"
                              />
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= ME ================= */}
        {tab === 'profile' && (
          <div className="flex-1 px-4 sm:px-5 pt-5 pb-24 space-y-4">
            <header className="flex items-center gap-3 vicharak-rise">
              <VicharakAvatar size="lg" />
              <div className="min-w-0 flex-1">
                {nameDraft === null ? (
                  <button
                    type="button"
                    onClick={() => setNameDraft(studentName ?? '')}
                    className="flex items-center gap-1.5 group"
                    data-testid="button-edit-name"
                  >
                    <h1 className="text-xl font-extrabold" style={{ color: TEXT }}>
                      {studentName ?? 'Add your name'}
                    </h1>
                    <Pencil className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" style={{ color: TEXT_MUTED }} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="px-3 py-1.5 text-sm"
                      style={inputStyle}
                      placeholder="Your name"
                      autoFocus
                      data-testid="input-name"
                    />
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        const v = nameDraft.trim();
                        setSavingProfile(true);
                        void upsertMeta('name', v).finally(() => {
                          setSavingProfile(false);
                          setNameDraft(null);
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-extrabold flex-shrink-0"
                      style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid="button-save-name"
                    >
                      Save
                    </button>
                  </div>
                )}
                <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
                  Day {day} of prep · {examName} aspirant
                </p>
              </div>
            </header>

            {/* exam countdown — the one number that frames everything */}
            <Card radius={RADIUS.lg} className="p-4 text-center vicharak-rise" style={{ animationDelay: '20ms' }} testId="card-exam-countdown">
              <p className="text-3xl font-extrabold" style={{ color: AMBER }} data-testid="text-days-to-exam">{daysToExam}</p>
              <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>days until {examName}</p>
            </Card>

            {/* exam date nudge — a prompt, never a blocking gate */}
            {!examDateSet && (
              <Card
                radius={RADIUS.md}
                className="p-3.5 vicharak-rise"
                style={{ background: tint(AMBER, 0.1), borderColor: tint(AMBER, 0.4) }}
                testId="card-exam-date-prompt"
              >
                <p className="text-xs font-bold" style={{ color: AMBER }}>
                  Set your exam date to switch the pace signal on
                </p>
                <p className="text-[11px] mt-1" style={{ color: TEXT_SECONDARY }}>
                  I'm using {examDate} as a guess for now. Set the real date below and “Am I on track?” becomes accurate.
                </p>
              </Card>
            )}

            {/* streak & stats */}
            <Card radius={RADIUS.lg} className="p-4 vicharak-rise" style={{ animationDelay: '40ms' }} testId="card-profile-stats">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Streak', value: `${streak}\uD83D\uDD25` },
                  { label: 'Topics', value: studentItems.filter((i) => i.kind === 'new' && i.status === 'done').length },
                  { label: 'Revisions', value: studentItems.filter((i) => i.kind === 'revision' && i.status === 'done').length },
                  { label: 'Tests', value: scoreEntries.length },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-lg font-extrabold" style={{ color: AMBER }}>
                      {s.value}
                    </p>
                    <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* exam settings + goals */}
            <Card radius={RADIUS.lg} className="p-5 space-y-4 vicharak-rise" style={{ animationDelay: '70ms' }} testId="card-exam-settings">
              <div>
                <SectionLabel>Exam</SectionLabel>
                {changingExam ? (
                  <div>
                    <div className="flex gap-1.5 flex-wrap">
                      {EXAMS.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            void (async () => {
                              await window.__workspaceDb.from('zuno_profile').update(profile.id, { exam: e.id });
                              await upsertMeta('exam_date', defaultExamDate(e, today));
                              // Recommendations recalculate against the NEW exam:
                              // a pinned chat exam would keep insights on the old one.
                              if (metaMap.get(CHAT_EXAM_META_KEY)?.meta_value) await upsertMeta(CHAT_EXAM_META_KEY, '');
                              profileQ.refresh();
                              setChangingExam(false);
                              setExamSwitchOpen(false);
                              showToast(`Switched to ${e.name} — your history stays safe.`);
                            })();
                          }}
                          className="px-3 py-1.5 text-xs font-bold transition-all"
                          style={pillStyle(e.id === profile.exam)}
                          data-testid={`button-switch-exam-${e.id}`}
                        >
                          {e.name}
                        </button>
                      ))}
                      {examDef?.custom && (
                        <span className="px-3 py-1.5 text-xs font-bold" style={pillStyle(true)} data-testid="pill-current-typed-exam">
                          {examDef.name}
                        </span>
                      )}
                    </div>
                    {examSwitchOpen ? (
                      <div className="mt-2.5">
                        <CustomExamEntry
                          today={today}
                          confirmLabel="Switch to this exam"
                          onReady={(exam) => void switchToTypedExam(exam)}
                          onCancel={() => setExamSwitchOpen(false)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExamSwitchOpen(true)}
                        className="mt-2.5 text-[11px] font-bold hover:underline"
                        style={{ color: AMBER }}
                        data-testid="button-switch-exam-custom"
                      >
                        + Type another exam
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: TEXT }}>
                      {examDef?.fullName ?? examName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChangingExam(true)}
                      className="text-[11px] font-bold hover:underline"
                      style={{ color: AMBER }}
                      data-testid="button-change-exam"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div>
                <SectionLabel>Exam date</SectionLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={examDateDraft ?? storedExamDate ?? (examDef ? examDate : '')}
                    min={today}
                    onChange={(e) => setExamDateDraft(e.target.value)}
                    className="px-3 py-2 text-sm flex-1"
                    style={inputStyle}
                    data-testid="input-profile-exam-date"
                  />
                  {examDateDraft !== null && examDateDraft !== examDate && (
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        setSavingProfile(true);
                        void upsertMeta('exam_date', examDateDraft).finally(() => {
                          setSavingProfile(false);
                          setExamDateDraft(null);
                          showToast('Exam date updated — pace recalculated.');
                        });
                      }}
                      className="px-3 py-2 text-xs font-extrabold flex-shrink-0"
                      style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid="button-save-exam-date"
                    >
                      Save
                    </button>
                  )}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: TEXT_MUTED }}>
                  {daysToExam} days away · drives your pace signal
                </p>
              </div>

              <div>
                <SectionLabel>Your goal</SectionLabel>
                <textarea
                  value={goalsDraft ?? goals}
                  onChange={(e) => setGoalsDraft(e.target.value)}
                  onBlur={() => {
                    if (goalsDraft !== null && goalsDraft !== goals) {
                      void upsertMeta('goals', goalsDraft).then(() => showToast('Goal saved.'));
                    }
                    setGoalsDraft(null);
                  }}
                  rows={2}
                  placeholder='e.g. "AIR under 500" or "Government college seat"'
                  className="px-3 py-2 text-sm resize-none"
                  style={inputStyle}
                  data-testid="input-goals"
                />
              </div>

              <div>
                <SectionLabel>Study-hour goals</SectionLabel>
                <div className="flex gap-2">
                  {(
                    [
                      { key: 'goal_daily_hours', label: 'Daily', value: dailyGoal, draft: dailyGoalDraft, set: setDailyGoalDraft, placeholder: 'e.g. 6' },
                      { key: 'goal_weekly_hours', label: 'Weekly', value: weeklyGoal, draft: weeklyGoalDraft, set: setWeeklyGoalDraft, placeholder: 'e.g. 40' },
                    ] as const
                  ).map((field) => (
                    <div key={field.key} className="flex-1 min-w-0">
                      <label
                        className="block text-[10px] font-bold mb-1"
                        style={{ color: TEXT_MUTED }}
                        htmlFor={`input-${field.key}`}
                      >
                        {field.label} hours
                      </label>
                      <input
                        id={`input-${field.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={field.draft ?? field.value}
                        onChange={(e) => field.set(e.target.value)}
                        onBlur={() => {
                          if (field.draft !== null && field.draft !== field.value) {
                            void upsertMeta(field.key, field.draft).then(() => showToast('Study-hour goal saved.'));
                          }
                          field.set(null);
                        }}
                        placeholder={field.placeholder}
                        className="px-3 py-2 text-sm"
                        style={inputStyle}
                        data-testid={`input-${field.key}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: TEXT_MUTED }}>
                  I compare these against the study-hours chart in your performance dashboard.
                </p>
              </div>
            </Card>

            {/* plan */}
            <Card radius={RADIUS.lg} className="p-4 vicharak-rise" style={{ animationDelay: '90ms' }} testId="card-tier">
              <div className="flex items-center gap-3">
                <span
                  className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] flex-shrink-0"
                  style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                  data-testid="text-plan-label"
                >
                  {planLabel(access)}
                </span>
                <p className="text-xs" style={{ color: TEXT_SECONDARY }}>
                  {planDetail(access)}
                </p>
              </div>
              {access.tier !== 'pro' && (
                <button
                  type="button"
                  onClick={() => setUpgradeReason('browse')}
                  className="mt-3 w-full py-2.5 text-xs font-extrabold inline-flex items-center justify-center gap-2"
                  style={{
                    borderRadius: RADIUS.chip,
                    background: tint(AMBER, 0.14),
                    border: `1px solid ${tint(AMBER, 0.35)}`,
                    color: AMBER,
                  }}
                  data-testid="button-see-pro"
                >
                  <Crown className="w-3.5 h-3.5" />
                  VicharakAI Pro — {PRO_PRICE_MONTHLY}
                </button>
              )}
            </Card>

            {/* settings + sign out */}
            <section className="space-y-2 vicharak-rise" style={{ animationDelay: '110ms' }}>
              <div
                className="w-full px-4 py-3.5 flex items-center gap-3"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="row-theme"
              >
                {themeMode === 'dark' ? (
                  <Moon className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                ) : (
                  <Sun className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                )}
                <span className="text-sm font-semibold flex-1" style={{ color: TEXT }}>
                  Theme
                </span>
                <div
                  className="inline-flex p-0.5"
                  role="radiogroup"
                  aria-label="App theme"
                  style={{ borderRadius: RADIUS.chip, background: BORDER }}
                >
                  {(
                    [
                      { id: 'dark', label: '\uD83C\uDF19 Dark' },
                      { id: 'light', label: '\u2600\uFE0F Light' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={themeMode === t.id}
                      onClick={() => setThemeMode(t.id)}
                      className="px-3 py-1.5 text-xs font-extrabold transition-all"
                      style={
                        themeMode === t.id
                          ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                          : { borderRadius: RADIUS.chip, background: 'transparent', color: TEXT_SECONDARY }
                      }
                      data-testid={`button-theme-${t.id}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="w-full px-4 py-3.5"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="row-language"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4" style={{ color: TEXT_MUTED }} />
                  <span className="text-sm font-semibold" style={{ color: TEXT }}>Language</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void upsertMeta('language', option.id)}
                      className="px-2 py-1.5 text-[10px] font-extrabold"
                      style={pillStyle(language === option.id)}
                      aria-pressed={language === option.id}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="w-full px-4 py-3.5"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="row-notifications"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 flex-shrink-0" style={{ color: notificationsOn ? AMBER : TEXT_MUTED }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>Study reminders</p>
                    <p className="text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Daily mission + revision-due alerts</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleNotifications()}
                    className="px-3 py-1.5 text-xs font-extrabold"
                    style={pillStyle(notificationsOn)}
                    aria-pressed={notificationsOn}
                    data-testid="button-toggle-notifications"
                  >
                    {notificationsOn ? 'On' : 'Turn on'}
                  </button>
                </div>
                {notificationsOn && (
                  <label className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
                    Daily reminder time
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(event) => {
                        setReminderTime(event.target.value);
                        localStorage.setItem(`vicharak_reminder_time_${spaceId}`, event.target.value);
                      }}
                      className="px-2.5 py-1.5 text-xs"
                      style={inputStyle}
                      data-testid="input-reminder-time"
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTab('calendar')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-calendar"
              >
                <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Study calendar</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Month view of your plan — every task stays editable</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setWeeklyScreenOpen(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-weekly-targets"
              >
                <Target className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Weekly targets</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Focus chapters, topic + test goals — AI can pick for you</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-help"
              >
                <LifeBuoy className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                <span className="text-sm font-semibold flex-1" style={{ color: TEXT }}>
                  Help &amp; Support
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('openApp', { detail: { appId: 'settings' } }))}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-settings"
              >
                <SettingsIcon className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                <span className="text-sm font-semibold flex-1" style={{ color: TEXT }}>
                  Account &amp; subscription settings
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              {/* FIX 1: Reset All Data / Delete Account — both confirmation-gated. */}
              <button
                type="button"
                onClick={() => setDangerAction('reset')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${tint(DANGER, 0.35)}`, borderRadius: RADIUS.md }}
                data-testid="button-reset-all-data"
              >
                <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: DANGER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: DANGER }}>Reset All Data</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Wipe tasks, revisions, scores and doubts — start over</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setDangerAction('delete')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${tint(DANGER, 0.35)}`, borderRadius: RADIUS.md }}
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 flex-shrink-0" style={{ color: DANGER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: DANGER }}>Delete Account</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Erase your data and sign out for good</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-sign-out"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: DANGER }} />
                <span className="text-sm font-semibold" style={{ color: DANGER }}>
                  Sign out
                </span>
              </button>
            </section>
          </div>
        )}
      </div>

      {/* toast — with a one-tap Undo when the action is reversible */}
      {toastText && (
        <div
          className={`pointer-events-none fixed bottom-24 left-0 right-0 flex justify-center z-40 px-6 ${toastUndo ? 'vicharak-fade' : 'vicharak-toast'}`}
          role="status"
          data-testid="toast-quote"
        >
          <div
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 backdrop-blur-md"
            style={{
              borderRadius: RADIUS.chip,
              border: `1px solid ${BORDER_STRONG}`,
              background: GLASS_BG,
              boxShadow: CARD_SHADOW,
            }}
          >
            <p className="text-xs italic" style={{ color: TEXT_SECONDARY }}>
              “{toastText}”
            </p>
            {toastUndo && (
              <button
                type="button"
                onClick={() => {
                  const undo = toastUndo;
                  setToastText(null);
                  setToastUndo(null);
                  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                  undo();
                }}
                className="text-xs font-extrabold uppercase tracking-wide flex-shrink-0 touch-manipulation"
                style={{ color: AMBER }}
                data-testid="toast-undo"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {/* CHANGE 1/4/9: exactly two floating buttons — the '+' add-task FAB
          (bottom-right) and the AI assistant (bottom-left) — both sitting just
          above the bottom nav and never overlapping it or each other. */}
      {tab !== 'coach' && (
        <>
          <button
            type="button"
            onClick={() => setTab('coach')}
            aria-label="Open the AI assistant"
            className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center touch-manipulation transition-transform active:scale-95"
            style={{
              left: 18,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
              background: BRAND_GRADIENT,
              color: ON_AMBER,
              boxShadow: '0 8px 22px rgba(0,87,255,0.45)',
            }}
            data-testid="fab-ai"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setAddTaskOpen(true)}
            aria-label="Add a task"
            className="fixed z-40 w-14 h-14 rounded-full flex items-center justify-center touch-manipulation transition-transform active:scale-95"
            style={{
              right: 18,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
              background: BRAND_GRADIENT,
              color: ON_AMBER,
              boxShadow: '0 10px 26px rgba(0,87,255,0.5)',
            }}
            data-testid="fab-add-task"
          >
            <Plus className="w-7 h-7" />
          </button>
        </>
      )}

      {/* CHANGE 1/8: the '+' FAB's add-task sheet — name, subject, photo. */}
      {addTaskOpen && (
        <AddTaskSheet
          subjects={quickAddSubjects.length > 0 ? quickAddSubjects : subjectNames}
          saving={savingNewTask}
          onSave={(draft) => void handleAddTaskSave(draft)}
          onClose={() => setAddTaskOpen(false)}
          onScanPhoto={() => {
            setAddTaskOpen(false);
            setPhotoTasksOpen(true);
          }}
        />
      )}

      {/* ---------------- TASK ENTRY BOTTOM SHEET ---------------- */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add a task">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 vicharak-fade"
            style={{ background: OVERLAY_BG }}
          />
          <div
            className="relative max-h-[72vh] flex flex-col vicharak-sheet"
            style={{
              borderTopLeftRadius: RADIUS.sheet,
              borderTopRightRadius: RADIUS.sheet,
              background: `linear-gradient(180deg, ${NAVY_ALT} 0%, ${NAVY} 48%)`,
              borderTop: `1px solid ${BORDER_STRONG}`,
              boxShadow: CARD_SHADOW,
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-extrabold" style={{ color: TEXT }}>
                Add to today
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: BORDER, color: TEXT }}
                data-testid="button-close-sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* three clear paths */}
            <div className="px-5 pb-3">
              <div
                className="inline-flex p-0.5 w-full"
                style={{ borderRadius: RADIUS.chip, background: BORDER }}
                role="tablist"
                aria-label="Ways to add a task"
              >
                {(
                  [
                    { id: 'list', label: 'Daily list' },
                    { id: 'form', label: 'Pick topic' },
                    { id: 'ai', label: 'VicharakAI picks' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={sheetMode === m.id}
                    onClick={() => {
                      setSheetMode(m.id);
                      setAiResult(null);
                    }}
                    className="flex-1 py-2 text-xs font-extrabold transition-all"
                    style={pillStyle(sheetMode === m.id)}
                    data-testid={`sheet-mode-${m.id}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {sheetMode === 'list' && (
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-extrabold" style={{ color: '#EFF6FF' }}>
                      {language === 'hindi' ? 'आज क्या पढ़ना है?' : language === 'hinglish' ? 'Aaj kya padhna hai?' : 'What are you studying today?'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#93C5FD' }}>All sections are optional · one task per line</p>
                  </div>

                  {/* Photo → tasks: snap notes, VicharakAI extracts the topics. */}
                  <button
                    type="button"
                    onClick={() => setPhotoTasksOpen(true)}
                    className="mb-3 w-full flex items-center justify-center gap-2 py-3 text-[13px] font-extrabold touch-manipulation"
                    style={{ borderRadius: RADIUS.md, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
                    data-testid="button-add-from-photo"
                  >
                    <Camera className="w-4 h-4" />
                    Add from photo
                  </button>

                  {/* CHANGE 10: the question-revision entry lives here too. */}
                  <button
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      setFlagOpen(true);
                    }}
                    className="mb-3 w-full flex items-center justify-center gap-2 py-3 text-[13px] font-extrabold touch-manipulation"
                    style={{ borderRadius: RADIUS.md, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                    data-testid="button-add-question-from-sheet"
                  >
                    <Flag className="w-4 h-4" />
                    Add a question for revision
                  </button>

                  {/* Quick add (#2) — one line, Enter saves; chips set or create in one tap */}
                  <div className="mb-3 p-3.5" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }} data-testid="quick-add-panel">
                    <p className="text-xs font-extrabold" style={{ color: TEXT }}>Quick add</p>
                    <textarea
                      value={quickTitle}
                      onChange={(event) => setQuickTitle(event.target.value)}
                      rows={2}
                      placeholder={'One task per line, e.g.\nSolve 30 Thermodynamics questions'}
                      autoFocus
                      className="mt-2 w-full px-3 py-2.5 text-sm resize-none"
                      style={inputStyle}
                      data-testid="input-quick-add"
                    />
                    {quickAddSubjects.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {quickAddSubjects.map((name) => (
                          <button
                            key={`qs-${name}`}
                            type="button"
                            onClick={() => setQuickSubject((current) => (current === name ? '' : name))}
                            aria-pressed={quickSubject === name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold touch-manipulation"
                            style={quickSubject === name
                              ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                              : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                            data-testid={`quick-subject-${name}`}
                          >
                            <SubjectDot subject={name} size={5} />
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!quickTitle.trim() || addingTask}
                      onClick={() => void submitQuickTitle()}
                      className="mt-2 w-full py-2.5 text-[12px] font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-1.5 touch-manipulation"
                      style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid="button-quick-add-all"
                    >
                      {addingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {quickTitle.split(/\n+/).filter((line) => line.trim()).length > 1
                        ? `Add All · ${quickTitle.split(/\n+/).filter((line) => line.trim()).length} tasks`
                        : 'Add task'}
                    </button>
                    <p className="text-[10px] mt-2" style={{ color: TEXT_MUTED }}>
                      {quickSubject
                        ? `Saving under ${quickSubject} — Enter starts a new task line.`
                        : 'Enter starts a new task line — I detect each subject, or tap a chip to set it.'}
                    </p>
                    {quickAddSubjects.length > 0 && (
                      <div className="mt-2.5 pt-2.5 flex gap-1.5 flex-wrap items-center" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Quick Add</span>
                        {quickAddSubjects.slice(0, 4).map((name) => (
                          <button
                            key={`qa-${name}`}
                            type="button"
                            disabled={addingTask}
                            onClick={() => void quickAddTask(name)}
                            className="px-2.5 py-1 text-[10px] font-bold disabled:opacity-50 touch-manipulation"
                            style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: 'transparent' }}
                            data-testid={`quick-add-${name}`}
                          >
                            + {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Parsed-plan review (#2, #3): confirm, edit or delete each task. */}
                  {parsingPlan && (
                    <div className="mb-3 flex items-center gap-2 px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }} data-testid="plan-parsing">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: AMBER }} />
                      <p className="text-[12px] font-bold" style={{ color: TEXT_SECONDARY }}>Reading your plan — splitting it into tasks…</p>
                    </div>
                  )}
                  {planDrafts && !parsingPlan && (
                    <PlanDraftList
                      drafts={planDrafts}
                      onChange={setPlanDrafts}
                      subjects={subjectNames}
                      saving={savingPlan}
                      onConfirm={() => void confirmPlanDrafts()}
                      onCancel={() => setPlanDrafts(null)}
                    />
                  )}

                  <div className="space-y-2">
                    {(Object.keys(taskSections) as DailySection[]).map((section) => {
                      const draft = taskSections[section];
                      return (
                        <div key={section} className="overflow-hidden" style={{ borderRadius: RADIUS.md, border: '1px solid rgba(147,197,253,0.28)', background: 'rgba(30,64,175,0.22)' }}>
                          <button
                            type="button"
                            onClick={() => setTaskSections((current) => ({ ...current, [section]: { ...current[section], open: !current[section].open } }))}
                            className="w-full px-3 py-2.5 flex items-center justify-between text-left"
                          >
                            <span className="text-xs font-extrabold" style={{ color: '#DBEAFE' }}>{section}</span>
                            <span className="text-[10px]" style={{ color: '#93C5FD' }}>{draft.text.split(/\n+/).filter((line) => line.trim()).length || 'optional'} {draft.open ? '▴' : '▾'}</span>
                          </button>
                          {draft.open && (
                            <div className="px-3 pb-3">
                              <select
                                value={draft.subject}
                                onChange={(event) => setTaskSections((current) => ({ ...current, [section]: { ...current[section], subject: event.target.value } }))}
                                className="w-full px-2.5 py-2 text-xs"
                                style={{ ...inputStyle, background: '#0F172A' }}
                                aria-label={`${section} subject`}
                              >
                                <option value="">Auto-detect subject</option>
                                {subjectNames.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                              </select>
                              <textarea
                                value={draft.text}
                                onChange={(event) => setTaskSections((current) => ({ ...current, [section]: { ...current[section], text: event.target.value } }))}
                                rows={2}
                                placeholder={section === 'Revision' ? 'Revise Kinematics\nRevise Cell Cycle' : section === 'Lecture' ? 'Watch Electrostatics lecture' : 'Solve 30 Probability questions'}
                                className="mt-2 px-3 py-2 text-sm resize-none"
                                style={{ ...inputStyle, background: '#0F172A' }}
                                data-testid={`tasks-${section.replace(/\s/g, '-').toLowerCase()}`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {ambientSuggestion && (
                    <div className="mt-3 p-3" style={{ borderRadius: RADIUS.md, background: 'rgba(59,130,246,0.22)', border: '1px solid #60A5FA' }} data-testid="ambient-ai-suggestion">
                      <div className="flex items-start gap-2">
                        <Brain className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#93C5FD' }} />
                        <div className="flex-1 min-w-0"><p className="text-xs font-extrabold" style={{ color: '#EFF6FF' }}>Second Mind noticed something</p><p className="text-[10px] mt-0.5" style={{ color: '#BFDBFE' }}>{ambientSuggestion.topic} · {ambientSuggestion.reason}</p></div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => { const suggestion = ambientSuggestion; setTaskSections((current) => ({ ...current, [suggestion.section]: { ...current[suggestion.section], open: true, subject: suggestion.subject, text: [current[suggestion.section].text, suggestion.topic].filter(Boolean).join('\n') } })); setAmbientDismissed(true); }} className="px-3 py-1.5 text-[10px] font-extrabold rounded-full" style={{ background: '#DBEAFE', color: '#1E3A8A' }}>Add it</button>
                        <button type="button" onClick={() => setAmbientDismissed(true)} className="px-3 py-1.5 text-[10px] font-bold" style={{ color: '#BFDBFE' }}>Not today</button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!hasTaskDraft || addingTask}
                    onClick={() => void submitTaskSections()}
                    className="mt-3 w-full py-2.5 text-sm font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-2"
                    style={{ borderRadius: RADIUS.chip, background: '#2563EB', color: '#EFF6FF' }}
                    data-testid="button-add-daily-list"
                  >
                    {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add all to today
                  </button>
                  <p className="text-[9px] mt-2 text-center" style={{ color: '#93C5FD' }}>When you finish a topic, 1-3-5-7 spaced revisions are queued quietly.</p>
                </div>
              )}

              {sheetMode === 'form' && (
                <div className="space-y-4">
                  <div>
                    <SectionLabel>1 · Task type</SectionLabel>
                    <div className="flex gap-1.5 flex-wrap">
                      {TASK_TYPES.map((taskType) => (
                        <button
                          key={taskType}
                          type="button"
                          onClick={() => {
                            setFormType(taskType);
                            setFormCustom('');
                            if (!formSubjectManual) {
                              setFormSubject('');
                              setFormChapter('');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-bold transition-all"
                          style={pillStyle(formType === taskType)}
                          data-testid={`type-pill-${taskType}`}
                        >
                          {taskType}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>2 · Subject</SectionLabel>
                      {!formSubject && (
                        <span className="text-[10px] mb-2" style={{ color: TEXT_MUTED }}>
                          Auto-fills from a clear topic
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {subjectNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setFormSubject(name);
                            setFormSubjectManual(true);
                            setFormChapter('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all"
                          style={
                            formSubject === name
                              ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                              : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }
                          }
                          data-testid={`subject-pill-${name}`}
                        >
                          <SubjectDot subject={name} size={6} />
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>3 · Topic</SectionLabel>
                      {formType !== 'Custom' && (
                        <select
                          value={formChapter}
                          onChange={(event) => setFormChapter(event.target.value)}
                          disabled={!formSubjectDef}
                          className="text-[11px] px-2 py-1 mb-2 max-w-[55%] disabled:opacity-50"
                          style={{ ...inputStyle, width: 'auto', borderRadius: RADIUS.chip }}
                          aria-label="Optional chapter filter"
                          data-testid="select-chapter-filter"
                        >
                          <option value="">{formSubjectDef ? 'All chapters' : 'Pick subject to filter'}</option>
                          {(formSubjectDef?.chapters ?? []).map((chapter) => (
                            <option key={chapter.name} value={chapter.name}>
                              {chapter.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {formType === 'Custom' ? (
                      <div className="space-y-2">
                        <textarea
                          value={formCustom}
                          onChange={(event) => {
                            const value = event.target.value;
                            setFormCustom(value);
                            if (formSubjectManual) return;
                            setFormSubject(inferSubjectForTopic(examDef, value));
                            setFormChapter('');
                          }}
                          placeholder="Describe exactly what you want to do — for example, ‘Make notes on Haloalkanes SN1 reactions’…"
                          rows={5}
                          autoFocus
                          className="px-3 py-3 text-sm resize-y"
                          style={{ ...inputStyle, minHeight: 120 }}
                          data-testid="textarea-custom-task"
                        />
                        <p className="text-[10px]" style={{ color: formSubject ? TEXT_SECONDARY : TEXT_MUTED }}>
                          {formSubject ? `Subject: ${formSubject}` : 'If VicharakAI cannot identify one subject confidently, choose it above.'}
                        </p>
                        <button
                          type="button"
                          disabled={!formCustom.trim() || addingTask}
                          onClick={() => void submitFormTask(formCustom.trim())}
                          className="w-full px-4 py-2.5 text-xs font-extrabold disabled:opacity-50"
                          style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                          data-testid="button-add-custom"
                        >
                          Add custom task
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={formSearch}
                          onChange={(event) => setFormSearch(event.target.value)}
                          placeholder={formSubject ? `Search ${formSubject} topics…` : 'Search every subject and topic…'}
                          className="px-3 py-2 text-sm mb-2"
                          style={inputStyle}
                          data-testid="input-topic-search"
                        />
                        <ul
                          className="overflow-hidden max-h-56 overflow-y-auto"
                          style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                        >
                          {formTopics.slice(0, 100).map((topicEntry) => (
                            <li key={`${topicEntry.subject}|${topicEntry.chapter}|${topicEntry.topic}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                              <button
                                type="button"
                                disabled={addingTask}
                                onClick={() => void submitFormTask(topicEntry.topic, topicEntry.subject)}
                                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                                style={{ background: CARD }}
                                data-testid={`topic-option-${topicEntry.topic.slice(0, 24)}`}
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold truncate" style={{ color: TEXT }}>
                                    {topicEntry.topic}
                                  </span>
                                  <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                                    {topicEntry.subject} · {topicEntry.chapter}
                                  </span>
                                </span>
                                <Plus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
                              </button>
                            </li>
                          ))}
                          {formTopics.length === 0 && (
                            <li className="px-3.5 py-3 text-xs" style={{ background: CARD, color: TEXT_MUTED }}>
                              No topics match — type a granular topic below.
                            </li>
                          )}
                        </ul>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={formCustom}
                            onChange={(event) => {
                              const value = event.target.value;
                              setFormCustom(value);
                              if (formSubjectManual) return;
                              setFormSubject(inferSubjectForTopic(examDef, value));
                              setFormChapter('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && formCustom.trim()) void submitFormTask(formCustom.trim());
                            }}
                            placeholder="Or type a granular topic…"
                            className="px-3 py-2 text-sm flex-1"
                            style={inputStyle}
                            data-testid="input-custom-topic"
                          />
                          <button
                            type="button"
                            disabled={!formCustom.trim() || addingTask}
                            onClick={() => void submitFormTask(formCustom.trim())}
                            className="px-4 py-2 text-xs font-extrabold disabled:opacity-50 flex-shrink-0"
                            style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                            data-testid="button-add-typed-topic"
                          >
                            Add
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {sheetMode === 'ai' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-3">
                    <VicharakAvatar size="lg" />
                  </div>
                  {aiResult ? (
                    <>
                      <p className="text-sm font-semibold px-2" style={{ color: TEXT }} data-testid="text-ai-result">
                        {aiResult}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        className="mt-5 px-6 py-2.5 text-sm font-extrabold"
                        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                        data-testid="button-ai-done"
                      >
                        Nice — done
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm px-4" style={{ color: TEXT_SECONDARY }}>
                        I'll weigh your pace, weak areas and what's due for revision — then queue the smartest next task.
                      </p>
                      <button
                        type="button"
                        disabled={addingTask}
                        onClick={() => void submitAiTask()}
                        className="mt-5 px-6 py-3 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                        data-testid="button-ai-add"
                      >
                        {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        Let VicharakAI add a task for me
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* streak milestone — a calm full-screen pause, shown once per milestone */}
      {milestoneStreak !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center vicharak-fade"
          style={{ background: BRAND_GRADIENT_DEEP, color: ON_AMBER }}
          role="dialog"
          aria-modal="true"
          aria-label={`${milestoneStreak}-day streak milestone`}
          data-testid="overlay-streak-milestone"
        >
          <Flame className="w-12 h-12 vicharak-pop" />
          <p className="mt-3 text-6xl font-extrabold leading-none vicharak-rise">{milestoneStreak}</p>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.22em] opacity-75">day streak</p>
          <p className="mt-6 max-w-xs text-base italic font-semibold leading-relaxed opacity-90 vicharak-rise" style={{ animationDelay: '140ms' }}>
            “{streakMilestoneQuote(milestoneStreak)}”
          </p>
          <button
            type="button"
            onClick={() => setMilestoneStreak(null)}
            className="mt-9 px-6 py-2.5 text-sm font-extrabold"
            style={{ borderRadius: RADIUS.chip, background: '#FFFFFF', color: '#0041CC' }}
            data-testid="button-dismiss-milestone"
          >
            Keep it going
          </button>
        </div>
      )}

      {/* upgrade — on the day the trial wraps, when the free AI budget runs out, or on request */}
      {upgradeReason && (
        <UpgradeSheet
          access={access}
          reason={upgradeReason}
          notified={proInterestSaved}
          saving={proInterest === 'saving'}
          onNotify={() => {
            if (proInterestSaved || proInterest === 'saving') return;
            setProInterest('saving');
            void upsertMeta(PRO_INTEREST_META_KEY, new Date().toISOString())
              .then(() => setProInterest('saved'))
              .catch(() => {
                setProInterest('idle');
                showToast("That didn't save — mind tapping it once more?");
              });
          }}
          onClose={() => setUpgradeReason(null)}
        />
      )}

      {/* CHANGE 2: no "How did it feel?" sheet — completion is one tap. */}

      {/* Add a question — typed text and/or a photo, saved exactly as entered
          (CHANGE 4: no AI processing on add). */}
      {flagOpen && (
        <FlagCaptureSheet
          subjects={subjectNames.length > 0 ? subjectNames : quickAddSubjects}
          spaceId={spaceId}
          canAskAi={access.canAskAi}
          onAiCharged={chargeAi}
          saving={savingFlag}
          onSave={(draft) => void saveFlagged(draft)}
          onClose={() => setFlagOpen(false)}
        />
      )}

      {/* CHANGE 6/10: a tapped saved question opens as a bottom-sheet card —
          the full question, its subject tag, and Got it / Revise again. */}
      {flaggedDetail && (
        <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Revise this question">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={() => setFlaggedDetail(null)} aria-label="Close question" />
          <div
            className="relative max-h-[85vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-extrabold"
                style={{ borderRadius: RADIUS.chip, background: subjectTint(flaggedDetail.subject || 'General', 0.14), color: subjectColor(flaggedDetail.subject || 'General') }}
                data-testid="chip-flagged-detail-subject"
              >
                <SubjectDot subject={flaggedDetail.subject || 'General'} size={6} />
                {flaggedDetail.subject || 'General'}
                {flaggedDetail.topic ? ` · ${flaggedDetail.topic}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setFlaggedDetail(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {flaggedDetail.image_url && (
              <button
                type="button"
                onClick={() => setLightboxUrl(flaggedDetail.image_url ?? null)}
                className="mt-3 w-full touch-manipulation"
                aria-label="Expand question photo"
              >
                <img
                  src={flaggedDetail.image_url}
                  alt="Question"
                  className="max-h-56 mx-auto object-contain"
                  style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }}
                />
              </button>
            )}
            {flaggedDetail.question_text.trim() !== '' && (
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TEXT }} data-testid="text-flagged-detail-question">
                {flaggedDetail.question_text}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={savingFlaggedDetail}
                onClick={() => void advanceFlagged(flaggedDetail)}
                className="py-3 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-flagged-got-it"
              >
                <Check className="w-4 h-4" />
                Got it
              </button>
              <button
                type="button"
                disabled={savingFlaggedDetail}
                onClick={() => void repeatFlagged(flaggedDetail)}
                className="py-3 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-flagged-revise-again"
              >
                <RotateCcw className="w-4 h-4" />
                Revise again
              </button>
            </div>
            <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
              “Got it” spaces it further out (1 → 3 → 7 → 14 → 30 days); “Revise again” brings it back tomorrow.
            </p>
          </div>
        </div>
      )}

      {/* FIX 6: the ONE-TIME daily carry-over decision — carry yesterday's
          unfinished tasks into today, or start fresh (archived as skipped).
          Shown only on the first open of a new day; the choice is stored. */}
      {carryoverPromptOpen && carryOver.length > 0 && (
        <div className="fixed inset-0 z-[64] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Unfinished tasks from yesterday">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: OVERLAY_BG }}
            onClick={carryoverBusy ? undefined : dismissCarryoverPrompt}
            aria-label="Close carry-over prompt"
          />
          <div
            className="relative max-h-[75vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold" style={{ color: TEXT }} data-testid="text-carryover-title">
                You have {carryOver.length} unfinished task{carryOver.length === 1 ? '' : 's'} from yesterday
              </h2>
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={dismissCarryoverPrompt}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-1.5" data-testid="list-carryover-preview">
              {carryOver.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                >
                  <SubjectDot subject={item.subject} size={6} />
                  <span className="min-w-0 flex-1 text-[13px] font-semibold truncate" style={{ color: TEXT }}>
                    {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: TEXT_MUTED }}>planned {item.scheduled_for}</span>
                </li>
              ))}
              {carryOver.length > 5 && (
                <li className="text-[10px] text-center" style={{ color: TEXT_MUTED }}>+{carryOver.length - 5} more</li>
              )}
            </ul>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={() => void decideCarryover('carry')}
                className="w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-carryover-carry"
              >
                {carryoverBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Carry them over
              </button>
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={() => void decideCarryover('fresh')}
                className="w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-carryover-fresh"
              >
                Start fresh today
              </button>
            </div>
            <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
              Carried tasks land in a “From yesterday” section on Today. Starting fresh archives them — they won't come back.
            </p>
          </div>
        </div>
      )}

      {/* CHANGE 6: tapping a week-strip day shows what was completed then. */}
      {weekDayDetail && (
        <div className="fixed inset-0 z-[64] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Completed that day">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={() => setWeekDayDetail(null)} aria-label="Close day summary" />
          <div
            className="relative max-h-[70vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold" style={{ color: TEXT }} data-testid="text-week-day-title">
                {new Date(`${weekDayDetail}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </h2>
              <button
                type="button"
                onClick={() => setWeekDayDetail(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {(completedByDate.get(weekDayDetail) ?? []).length === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-week-day-empty">
                Nothing was completed this day{weekDayDetail === today ? ' yet — the day is still young' : ''}.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5" data-testid="list-week-day-completed">
                {(completedByDate.get(weekDayDetail) ?? []).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2.5 px-3 py-2.5"
                    style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                  >
                    <span
                      className="w-[16px] h-[16px] rounded-[4px] flex items-center justify-center flex-shrink-0"
                      style={{ background: SUCCESS, color: '#FFFFFF' }}
                      aria-hidden="true"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-semibold truncate" style={{ color: TEXT }}>
                      {item.kind === 'revision' ? `Revised: ${item.topic}` : item.topic}
                    </span>
                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: subjectColor(item.subject) }}>
                      {item.subject}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}


      {/* Light task editor (#1) — fix a title, subject or duration, no ceremony */}
      {editTask && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit task">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={() => setEditTask(null)} aria-label="Close editor" />
          <div className="relative px-5 pt-5 pb-8 vicharak-sheet" style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-base font-extrabold" style={{ color: TEXT }}>Edit task</p>
                <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>Title, subject and duration — nothing else moves.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditTask(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Title
              <input
                value={editTaskTitle}
                onChange={(event) => setEditTaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveTaskEdit();
                  }
                }}
                autoFocus
                enterKeyHint="done"
                className="mt-1 px-3 py-2.5 text-sm"
                style={inputStyle}
                data-testid="input-edit-task-title"
              />
            </label>
            <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Subject</p>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {Array.from(new Set([editTask.subject, ...quickAddSubjects])).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setEditTaskSubject(name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                  style={editTaskSubject === name
                    ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                    : { borderRadius: RADIUS.chip, background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
                  data-testid={`edit-subject-${name}`}
                >
                  <SubjectDot subject={name} size={6} />
                  {name}
                </button>
              ))}
            </div>
            <label className="block mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Duration (minutes)
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={1080}
                value={editTaskMinutes}
                onChange={(event) => setEditTaskMinutes(event.target.value)}
                placeholder="e.g. 45"
                className="mt-1 px-3 py-2.5 text-sm"
                style={inputStyle}
                data-testid="input-edit-task-minutes"
              />
            </label>
            {/* Task-detail extras: attach an image, or drill it with MCQs. */}
            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
              <AttachImageButton
                busy={attachBusy}
                onPick={(file) => void attachImageToTask(editTask, file)}
                testId="button-attach-task-image"
              />
              <button
                type="button"
                disabled={improvingTask}
                onClick={() => void improveEditedTask()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold disabled:opacity-60 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER, border: `1px solid ${tint(AMBER, 0.4)}` }}
                data-testid="button-task-ai-improve"
              >
                {improvingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {improvingTask ? 'Tidying…' : 'AI tidy-up'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const task = editTask;
                  setEditTask(null);
                  setQuizTarget({ subject: task.subject, topic: task.topic });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER, border: `1px solid ${tint(AMBER, 0.4)}` }}
                data-testid="button-task-generate-questions"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Questions
                {adaptiveContextForTopic(testResults, editTask.subject, editTask.topic) && (
                  <span aria-label="Adapted to your level">· 📊 Adapted</span>
                )}
              </button>
            </div>
            {(attachmentsBySourceKey.get(editTask.source_key || topicKey(editTask.subject, editTask.topic)) ?? []).length > 0 && (
              <div className="mt-3">
                <ImageThumbStrip
                  urls={attachmentsBySourceKey.get(editTask.source_key || topicKey(editTask.subject, editTask.topic)) ?? []}
                  onExpand={setLightboxUrl}
                  onRemove={(url) => void removeTaskAttachment(editTask, url)}
                />
              </div>
            )}
            <button
              type="button"
              disabled={savingTaskEdit || !editTaskTitle.trim() || !editTaskSubject.trim()}
              onClick={() => void saveTaskEdit()}
              className="mt-4 w-full py-3 text-sm font-extrabold disabled:opacity-50"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-save-task-edit"
            >
              {savingTaskEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* “How long did you study?” — one tap after a completion, always skippable */}
      {durationPrompt && (
        <DurationSheet
          topic={durationPrompt.topic}
          subject={durationPrompt.subject}
          note={durationPrompt.note}
          prefillMinutes={durationPrompt.prefillMinutes}
          saving={savingDuration}
          onSave={(minutes, fromTimer) => void saveDuration(minutes, fromTimer)}
          onSkip={() => setDurationPrompt(null)}
        />
      )}

      {/* help & support — FAQs and a mailto, from the Profile settings list */}
      {helpOpen && (
        <HelpSupportSheet
          onClose={() => setHelpOpen(false)}
          onAskCoach={() => {
            setHelpOpen(false);
            setTab('coach');
          }}
        />
      )}

      {/* daily motivation — full-screen, first open of the day only */}
      {dailyPopupOpen && (
        <DailyMotivationPopup
          today={today}
          name={studentName}
          onClose={() => {
            markDailyPopupSeen(today);
            setDailyPopupOpen(false);
          }}
          onPickVibe={(vibe) => {
            markDailyPopupSeen(today);
            setTodayVibe(vibe);
            setDailyPopupOpen(false);
          }}
        />
      )}

      {/* Photo → tasks — snap notes, review the extracted checklist, add all */}
      {photoTasksOpen && (
        <PhotoTasksSheet
          subjects={quickAddSubjects.length > 0 ? quickAddSubjects : subjectNames}
          inferSubject={(title) => inferSubjectForTopic(examDef, title)}
          spaceId={spaceId}
          canAskAi={access.canAskAi}
          onAiBlocked={() => setUpgradeReason('limit')}
          onAiCharged={chargeAi}
          adding={addingPhotoTasks}
          onAdd={(tasks, imageUrl) => void handlePhotoTasks(tasks, imageUrl)}
          onClose={() => setPhotoTasksOpen(false)}
        />
      )}

      {/* Generate Quiz — from the mission, a task row or the task editor */}
      {quizTarget && (
        <GenerateQuizSheet
          target={quizTarget}
          examLabel={examDef?.target.label || savedExamLabel || profile.exam}
          adaptive={quizAdaptive}
          avoidQuestions={bankQuestionsFor(quizTarget.subject, quizTarget.topic).map((q) => q.question)}
          today={today}
          canAskAi={access.canAskAi}
          onAiBlocked={() => setUpgradeReason('limit')}
          onAiCharged={chargeAi}
          onGenerated={(drafts) => void handleQuizGenerated(drafts)}
          onClose={() => setQuizTarget(null)}
        />
      )}

      {/* Practice quiz — one question at a time, instant feedback */}
      {activeQuiz && (
        <QuizPlayer
          questions={activeQuiz.questions}
          title={activeQuiz.title}
          attachmentsFor={attachmentsForQuestion}
          attachBusy={attachBusy}
          onAttachImage={(question, file) => void attachImageToQuestion(question, file)}
          onExpandImage={setLightboxUrl}
          onWrong={(question) => void autoQueueWrongQuestion(question)}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      {/* Test Mode — setup, timed runner, results */}
      {testSetupOpen && (
        <TestSetupSheet
          topics={testTopicOptions}
          preparing={testPreparing}
          prepareNote={testPrepareNote}
          error={testError}
          onStart={(config) => void startTest(config)}
          onClose={() => setTestSetupOpen(false)}
        />
      )}
      {activeTest && (
        <TestRunner
          questions={activeTest.questions}
          timeLimitMinutes={activeTest.timeLimitMinutes}
          onSubmit={(answers, durationSeconds) => void handleTestSubmit(answers, durationSeconds)}
          onCancel={() => setActiveTest(null)}
        />
      )}
      {testReview && <TestResultsView review={testReview} onClose={() => setTestReview(null)} />}

      {/* FIX 8: Generate Test — the student picks an option, then marks each
          question “Got it ✓” (resolved) or “Need revision ↩” (rescheduled). */}
      {generateTestOpen && (
        <GenerateTestSheet
          queueCount={flaggedRows.length}
          preparing={generateTestPreparing}
          error={generateTestError}
          onStart={(mode) => void startGenerateTest(mode)}
          onClose={() => setGenerateTestOpen(false)}
        />
      )}
      {activeGeneratedTest && (
        <GeneratedTestRunner
          questions={activeGeneratedTest}
          onResolve={resolveGeneratedQuestion}
          onClose={() => setActiveGeneratedTest(null)}
        />
      )}

      {/* Weekly Targets — a dedicated FULL SCREEN: syllabus chapter chips,
          "Let AI choose for me", topic + test goals. Never a popup. */}
      {weeklyScreenOpen && (
        <WeeklyTargetsScreen
          examLabel={examDef?.target.label || savedExamLabel || examName}
          daysToExam={daysToExam}
          subjects={(examDef?.subjects ?? []).map((subject) => ({
            name: subject.name,
            chapters: subject.chapters.map((chapter) => chapter.name),
          }))}
          stats={chapterStats}
          initialSelected={focusChapters}
          initialReason={focusReason}
          initialTopicTarget={weeklyRow ? Math.max(1, Number(weeklyRow.topic_target)) : 5}
          initialTestTarget={weeklyRow ? Math.max(1, Number(weeklyRow.test_target)) : 1}
          topicsDone={weeklyTopicsDone}
          testsDone={weeklyTestsDone}
          lastWeekLine={weeklyRow ? null : lastWeekLine}
          saving={savingWeekly}
          canAskAi={access.canAskAi}
          onAiBlocked={() => setUpgradeReason('limit')}
          onAiCharged={chargeAi}
          onSave={(topicTarget, testTarget, chapters, reason) =>
            void saveWeeklyTargets(topicTarget, testTarget, chapters, reason)}
          onClose={() => setWeeklyScreenOpen(false)}
        />
      )}

      {/* Syllabus Browser — every exam in the database, mastery colour-coded. */}
      {syllabusBrowserOpen && (
        <SyllabusScreen
          initialExamId={activeSyllabusExam?.id ?? null}
          progressRows={progressRows}
          attemptRows={attemptRows}
          addingChapter={browserAddingChapter}
          onStudyChapter={(browsedExam, browsedSubject, browsedChapter) =>
            void studyChapterFromBrowser(browsedExam, browsedSubject, browsedChapter)}
          onClose={() => setSyllabusBrowserOpen(false)}
        />
      )}

      {/* Focus mode — full-screen countdown; sessions auto-log. */}
      {focusOpen && (
        <FocusModeScreen
          taskName={missionQueue[0]?.topic ?? null}
          subject={missionQueue[0]?.subject ?? null}
          onLog={(minutes) => void logFocusSession(minutes)}
          onClose={() => setFocusOpen(false)}
        />
      )}

      {/* The AI's welcome — personalised the moment onboarding completes. */}
      {welcome && (
        <div
          className="fixed inset-0 z-[72] flex flex-col items-center justify-center px-6 vicharak-fade"
          role="dialog"
          aria-modal="true"
          aria-label="Your prep plan"
          style={{ background: OVERLAY_BG }}
        >
          <div className="w-full max-w-md p-6 vicharak-rise" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}`, borderRadius: RADIUS.hero, boxShadow: CARD_SHADOW }}>
            <div className="flex justify-center"><VicharakAvatar size="lg" /></div>
            <h2 className="mt-4 text-xl font-extrabold text-center" style={{ color: TEXT }}>Your plan is ready</h2>
            {welcome.loading ? (
              <p className="mt-3 text-[13px] w-full inline-flex items-center justify-center gap-2" style={{ color: TEXT_MUTED }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Writing your first-week plan…
              </p>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: TEXT_SECONDARY }} data-testid="text-ai-welcome">
                {welcome.text}
              </p>
            )}
            <button
              type="button"
              onClick={() => setWelcome(null)}
              className="mt-5 w-full py-3.5 text-sm font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-welcome-go"
            >
              Open Today
            </button>
          </div>
        </div>
      )}

      {/* FIX 1: confirmation for Reset All Data / Delete Account. */}
      {dangerAction && (
        <div
          className="fixed inset-0 z-[78] flex items-center justify-center px-6 vicharak-fade"
          role="dialog"
          aria-modal="true"
          aria-label={dangerAction === 'reset' ? 'Reset all data' : 'Delete account'}
        >
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: OVERLAY_BG }}
            onClick={dangerBusy ? undefined : () => setDangerAction(null)}
            aria-label="Cancel"
          />
          <div
            className="relative w-full max-w-sm p-5 vicharak-rise"
            style={{ background: CARD, border: `1px solid ${tint(DANGER, 0.45)}`, borderRadius: RADIUS.hero, boxShadow: CARD_SHADOW }}
            data-testid="modal-danger-confirm"
          >
            <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: tint(DANGER, 0.14), color: DANGER }}>
              {dangerAction === 'reset' ? <RotateCcw className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </span>
            <h2 className="mt-3 text-lg font-extrabold" style={{ color: TEXT }}>
              {dangerAction === 'reset' ? 'Reset all data?' : 'Delete your account?'}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-danger-warning">
              This will permanently delete all your tasks, revision history, test scores, and doubts. This cannot be undone.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => void confirmDangerAction()}
                className="w-full py-3 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: DANGER, color: '#2B0B0B' }}
                data-testid="button-danger-confirm"
              >
                {dangerBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {dangerBusy
                  ? dangerAction === 'reset' ? 'Resetting…' : 'Deleting…'
                  : dangerAction === 'reset' ? 'Yes, Reset Everything' : 'Yes, Delete My Account'}
              </button>
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => setDangerAction(null)}
                className="w-full py-3 text-sm font-extrabold disabled:opacity-50 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-danger-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded view of any attached image */}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* The coach opens from the floating AI button (bottom-left); while the
          student chats the nav highlights Today. No strips float above the
          pill any more (CHANGE 9). */}
      <VicharakBottomNav active={tab === 'coach' ? 'today' : tab} onSelect={setTab} language={language} />
    </div>
  );
}
