import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Flame,
  GraduationCap,
  Loader2,
  LogOut,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wand2,
  X,
} from 'lucide-react';
import { tw, typography } from '../../lib/colors';
import { useSpaceRuntime } from '../../SpaceRuntimeContext';
import { defaultExamDate, EXAMS, getExam, inferSubjectForTopic, subjectTopics } from './syllabus';
import {
  addDaysISO,
  buildAnnotationMap,
  buildRevisionDrafts,
  buildTopicSequence,
  computePace,
  dailyFormula,
  dayNumber,
  DEFAULT_TASK_TYPE,
  diffDays,
  estimatedMinutes,
  formatDayLabel,
  isTaskType,
  mergeScoreEntries,
  normalizeTaskType,
  parseOneLiner,
  pickAiTask,
  proofText,
  scorePercent,
  taskTypeKey,
  TASK_TYPES,
  todayISO,
  topicKey,
  TOPICS_PER_DAY,
  type MetaRow,
  type StudyItem,
  type StudyItemDraft,
  type TaskAnnotation,
  type TaskType,
  type TestResult,
  type TestScore,
} from './engine';
import { completionQuote, dailyQuote, isStreakMilestone, streakMilestoneQuote, trackQuote } from './quotes';
import { consumeRequestedTab, ZunoAvatar, ZunoBottomNav, type ZunoTab } from './ui';
import { ZunoCalendarBody } from '../ZunoCalendar/App';

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

/* At most this many tasks are visible up front: 1 hero + 2 compact rows. */
const VISIBLE_TASK_CAP = 3;

/* Gentle, non-gimmicky motion. All of it collapses under prefers-reduced-motion. */
const MOTION_CSS = `
@keyframes zunoRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zunoPop { 0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes zunoToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zunoToastOut { to { opacity: 0; transform: translateY(6px); } }
@keyframes zunoFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zunoSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.zuno-rise { animation: zunoRise 0.38s ease-out both; }
.zuno-pop { animation: zunoPop 0.32s ease-out; }
.zuno-toast { animation: zunoToastIn 0.3s ease-out both, zunoToastOut 0.4s ease-in 2.7s both; }
.zuno-fade { animation: zunoFadeIn 0.45s ease-out both; }
.zuno-sheet { animation: zunoSheetUp 0.28s ease-out both; }
.zuno-scroll-x { scrollbar-width: none; -ms-overflow-style: none; }
.zuno-scroll-x::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .zuno-rise, .zuno-pop, .zuno-toast, .zuno-fade, .zuno-sheet { animation: none !important; }
}
`;

/* Warm page wash behind everything — VicharakAI's indigo-dawn gradient. */
const PAGE_GRADIENT =
  'bg-[linear-gradient(165deg,var(--space-surface-gradient-from)_0%,var(--space-surface-gradient-via)_45%,var(--space-surface-gradient-to)_100%)]';

/* Fixed accents that ride on top of the brand: amber for warnings, a plain red
 * for "behind" signals. No pink/rose anywhere — the brand is amber/orange gold. */
const AMBER = '#F59E0B';
const BEHIND_RED = '#F87171';

/* Best-effort first name from the signed-in session. Falls back to null → warm generic greeting. */
const GENERIC_EMAIL_WORDS = new Set([
  'info', 'hello', 'contact', 'admin', 'test', 'mail', 'email', 'support',
  'student', 'user', 'guest', 'team', 'the', 'and', 'study', 'exam',
]);

function cleanNameWord(raw: string): string | null {
  const word = raw.trim().split(/\s+/)[0];
  if (!/^[a-zA-Z]{2,}$/.test(word)) return null;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveStudentName(spaceId: string, sessionMetadata: Record<string, unknown>): string | null {
  const meta = sessionMetadata as Record<string, unknown>;
  for (const key of ['firstName', 'first_name', 'name']) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) {
      const cleaned = cleanNameWord(v);
      if (cleaned) return cleaned;
    }
  }
  try {
    const stored = localStorage.getItem(`space_session_${spaceId}`);
    if (!stored) return null;
    const session = JSON.parse(stored);
    for (const v of [session.firstName, session.name, session.metadata?.firstName, session.metadata?.name]) {
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
  } catch {
    /* greeting falls back to the generic warm one */
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
  return isTaskType(type) ? type : DEFAULT_TASK_TYPE;
}

/* ---------- tiny building blocks ---------- */

function StatChip({ children, tone }: { children: ReactNode; tone?: 'accent' | 'green' | 'amber' | 'red' }) {
  const style =
    tone === 'green'
      ? { color: 'var(--space-semantic-success)', background: 'color-mix(in srgb, var(--space-semantic-success) 12%, transparent)' }
      : tone === 'amber'
        ? { color: '#B45309', background: 'rgba(245,158,11,0.14)' }
        : tone === 'red'
          ? { color: 'var(--space-semantic-danger)', background: 'color-mix(in srgb, var(--space-semantic-danger) 10%, transparent)' }
          : tone === 'accent'
            ? { color: 'var(--space-text-accent)', background: 'var(--space-surface-accent-soft)' }
            : { color: 'var(--space-text-secondary)', background: 'var(--space-surface-muted)' };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0" style={style}>
      {children}
    </span>
  );
}

function CompactTaskRow({
  item,
  annotation,
  busy,
  onToggle,
  entranceDelayMs,
}: {
  item: StudyItem;
  annotation?: TaskAnnotation;
  busy: boolean;
  onToggle: (item: StudyItem) => void;
  entranceDelayMs?: number;
}) {
  const isRevision = item.kind === 'revision';
  return (
    <li
      className={`${tw.card.default} !rounded-2xl !shadow-[0_2px_8px_color-mix(in_srgb,var(--space-shell-shadow)_45%,transparent)] px-3.5 py-2.5 flex items-center gap-3 zuno-rise`}
      style={entranceDelayMs ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
      data-testid={`row-item-${item.id}`}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(item)}
        aria-label={`Mark ${item.topic} as done`}
        className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-200 touch-manipulation relative before:content-[''] before:absolute before:-inset-2 border-[var(--space-border-strong)] bg-[var(--space-surface-card)] hover:border-[var(--space-brand-highlight)] hover:scale-105"
        data-testid={`button-toggle-${item.id}`}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <span className={`block text-sm font-medium truncate ${typography.color.primary}`}>{item.topic}</span>
        {annotation?.ai && (
          <span className={`text-[10px] ${typography.color.muted}`}>added by Zuno</span>
        )}
      </div>
      <span
        className={`inline-flex items-center gap-1 flex-shrink-0 ${tw.badge.default} ${isRevision ? tw.badge.accent : tw.badge.primary}`}
      >
        {typeBadgeIcon(annotation?.type, item.kind)}
        {item.subject}
      </span>
    </li>
  );
}

/* Hand-rolled SVG line chart — keeps Progress dependency-free. */
function TrendChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const W = 320;
  const H = 120;
  const PAD = 14;
  if (points.length === 0) return null;
  const xs = points.map((_, i) => (points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1)));
  const ys = points.map((p) => H - PAD - ((Math.max(0, Math.min(100, p.value)) / 100) * (H - PAD * 2)));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Accuracy trend">
      {[25, 50, 75].map((g) => {
        const y = H - PAD - (g / 100) * (H - PAD * 2);
        return <line key={g} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="var(--space-border-default)" strokeDasharray="3 4" strokeWidth="1" />;
      })}
      <path d={path} fill="none" stroke="var(--space-brand-highlight)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="3.5" fill="var(--space-brand-highlight)" stroke="var(--space-surface-card)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

interface CoachMessage {
  role: 'user' | 'coach';
  text: string;
}

/* ==================================================================== */

export default function ZunoPlan() {
  const { spaceId, sessionMetadata, setSessionId } = useSpaceRuntime();
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

  const today = todayISO();
  const [tab, setTab] = useState<ZunoTab>('today');
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [startedId, setStartedId] = useState<number | null>(null);
  const [showAllToday, setShowAllToday] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [milestoneStreak, setMilestoneStreak] = useState<number | null>(null);
  const ensuredRef = useRef(false);

  /* onboarding state */
  const [obStep, setObStep] = useState(1);
  const [obExam, setObExam] = useState<string | null>(null);
  const [obDate, setObDate] = useState('');
  const [obFirstTask, setObFirstTask] = useState('');
  const [creating, setCreating] = useState(false);

  /* task-entry bottom sheet */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'oneliner' | 'form' | 'ai'>('oneliner');
  const [olText, setOlText] = useState('');
  const [formType, setFormType] = useState<TaskType>('Question Practice');
  const [formSubject, setFormSubject] = useState('');
  const [formSubjectManual, setFormSubjectManual] = useState(false);
  const [formChapter, setFormChapter] = useState('');
  const [formSearch, setFormSearch] = useState('');
  const [formCustom, setFormCustom] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  /* dashboard: test score logging (subject · marks · total · optional test name) */
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [scoreSubject, setScoreSubject] = useState('');
  const [scoreMarks, setScoreMarks] = useState('');
  const [scoreTotal, setScoreTotal] = useState('');
  const [scoreTestName, setScoreTestName] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  /* coach chat */
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachThinking, setCoachThinking] = useState(false);
  const coachEndRef = useRef<HTMLDivElement | null>(null);

  /* profile edits */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [goalsDraft, setGoalsDraft] = useState<string | null>(null);
  const [examDateDraft, setExamDateDraft] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingExam, setChangingExam] = useState(false);

  const profile = profileQ.data?.[0];
  const examDef = profile ? getExam(profile.exam) : undefined;
  const items = itemsQ.data || [];
  /** Marks-based results plus any legacy percentage-only rows, oldest first. */
  const scoreEntries = useMemo(
    () => mergeScoreEntries(resultsQ.data || [], scoresQ.data || []),
    [resultsQ.data, scoresQ.data],
  );
  const day = profile ? dayNumber(profile.start_date, today) : 1;

  const metaMap = useMemo(() => {
    const m = new Map<string, MetaRow>();
    for (const row of metaQ.data ?? []) m.set(row.meta_key, row);
    return m;
  }, [metaQ.data]);
  const annotations = useMemo(() => buildAnnotationMap(metaQ.data ?? []), [metaQ.data]);

  const savedName = metaMap.get('name')?.meta_value || null;
  const sessionName = useMemo(() => deriveStudentName(spaceId, sessionMetadata), [spaceId, sessionMetadata]);
  const studentName = savedName || sessionName;

  const examDate = metaMap.get('exam_date')?.meta_value || (examDef ? defaultExamDate(examDef, today) : addDaysISO(today, 180));
  const goals = metaMap.get('goals')?.meta_value || '';
  const pace = useMemo(() => computePace(items, examDef, examDate, today), [items, examDef, examDate, today]);
  const daysToExam = Math.max(0, diffDays(today, examDate));

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  /* Tab requests coming from the standalone Calendar app's bottom nav. */
  useEffect(() => {
    const apply = () => {
      const t = consumeRequestedTab();
      if (t) setTab(t);
    };
    apply();
    window.addEventListener('openApp', apply);
    return () => window.removeEventListener('openApp', apply);
  }, []);

  // Idempotent maintenance pass, once per mount:
  //  1. heal missing revision rows for anything studied earlier
  //  2. after week 1, generate today's targets from the next unassigned syllabus topics
  useEffect(() => {
    if (ensuredRef.current) return;
    if (profileQ.loading || itemsQ.loading || !profile || !examDef) return;
    ensuredRef.current = true;

    void (async () => {
      const inserts: StudyItemDraft[] = [];
      const revKeys = new Set(
        items.filter((i) => i.kind === 'revision').map((i) => `${i.source_key}|${i.interval_days}`),
      );
      for (const it of items) {
        if (it.kind !== 'new' || it.status !== 'done' || !it.studied_on) continue;
        const key = it.source_key || topicKey(it.subject, it.topic);
        const have = new Set(
          [1, 3, 5, 7, 14].filter((n) => revKeys.has(`${key}|${n}`)),
        );
        for (const draft of buildRevisionDrafts(it, it.studied_on, have)) {
          revKeys.add(`${draft.source_key}|${draft.interval_days}`);
          inserts.push(draft);
        }
      }

      const currentDay = dayNumber(profile.start_date, today);
      const hasTodayNew = items.some((i) => i.kind === 'new' && i.scheduled_for === today);
      if (currentDay > 7 && !hasTodayNew) {
        const assigned = new Set(
          items.filter((i) => i.kind === 'new').map((i) => i.source_key || topicKey(i.subject, i.topic)),
        );
        buildTopicSequence(examDef)
          .filter((t) => !assigned.has(topicKey(t.subject, t.topic)))
          .slice(0, TOPICS_PER_DAY)
          .forEach((t) =>
            inserts.push({
              exam: profile.exam,
              subject: t.subject,
              topic: t.topic,
              kind: 'new',
              day_number: currentDay,
              scheduled_for: today,
              status: 'pending',
              source_key: topicKey(t.subject, t.topic),
            }),
          );
      }

      if (inserts.length) {
        await Promise.all(
          inserts.map((row) => window.__workspaceDb.from('zuno_items').insert(row as Record<string, unknown>)),
        );
        itemsQ.refresh();
      }
    })();
  }, [profileQ.loading, itemsQ.loading, profile?.id, examDef?.id]);

  /* ---------- derived queues ---------- */

  const dueRevisions = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'revision' && i.status === 'pending' && i.scheduled_for <= today)
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)),
    [items, today],
  );
  const todayTargets = useMemo(
    () => items.filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for === today),
    [items, today],
  );
  const carryOver = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'new' && i.status === 'pending' && i.scheduled_for < today)
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)),
    [items, today],
  );
  const doneToday = useMemo(
    () => items.filter((i) => i.status === 'done' && (i.completed_at || '').slice(0, 10) === today),
    [items, today],
  );
  /* One calm queue: carry-overs and today's new topics (revisions live in the Top-5 strip). */
  const missionQueue = useMemo(() => [...carryOver, ...todayTargets], [carryOver, todayTargets]);
  const formula = useMemo(() => dailyFormula(items, today), [items, today]);

  const topicsStudied = useMemo(
    () => items.filter((i) => i.kind === 'new' && i.status === 'done').length,
    [items],
  );
  const revisionsDone = useMemo(
    () => items.filter((i) => i.kind === 'revision' && i.status === 'done').length,
    [items],
  );

  const streak = useMemo(() => {
    const doneDates = new Set(
      items.filter((i) => i.status === 'done' && i.completed_at).map((i) => (i.completed_at || '').slice(0, 10)),
    );
    let cursor = doneDates.has(today) ? today : addDaysISO(today, -1);
    let count = 0;
    while (doneDates.has(cursor)) {
      count += 1;
      cursor = addDaysISO(cursor, -1);
    }
    return count;
  }, [items, today]);

  useEffect(() => {
    if (!profile || !isStreakMilestone(streak)) return;
    const flag = `zuno_streak_milestone_${streak}`;
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch {
      return;
    }
    setMilestoneStreak(streak);
  }, [streak, profile]);

  /* ---------- shared actions ---------- */

  const showToast = (text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(text);
    toastTimerRef.current = setTimeout(() => setToastText(null), 3150);
  };

  const setBusy = (id: number, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

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
            items
              .filter((i) => i.kind === 'revision' && i.source_key === key)
              .map((i) => i.interval_days as number),
          );
          await Promise.all(
            buildRevisionDrafts(item, today, have).map((d) => db.insert(d as Record<string, unknown>)),
          );
        }
        if (startedId === item.id) setStartedId(null);
        showToast(completionQuote());
      } else {
        await db.update(item.id, {
          status: 'pending',
          completed_at: null,
          ...(item.kind === 'new' ? { studied_on: null } : {}),
        });
        if (item.kind === 'new') {
          const key = item.source_key || topicKey(item.subject, item.topic);
          const pendingRevs = items.filter(
            (i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending',
          );
          await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
        }
      }
      itemsQ.refresh();
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

  const addTask = async (subject: string, topic: string, type: TaskType, ai: boolean) => {
    if (!profile) return;
    const key = topicKey(subject, topic);
    const db = window.__workspaceDb.from('zuno_items');
    await db.insert({
      exam: profile.exam,
      subject,
      topic,
      kind: 'new',
      day_number: day,
      scheduled_for: today,
      status: 'pending',
      source_key: key,
    });
    await upsertMeta(taskTypeKey(key), JSON.stringify({ type: normalizeTaskType(type), ai }));
    itemsQ.refresh();
  };

  const submitOneLiner = async () => {
    const text = olText.trim();
    if (!text || addingTask || !profile) return;
    const parsed = parseOneLiner(text, examDef);
    if (!parsed.subject) {
      setFormType(parsed.type);
      setFormCustom(parsed.topic);
      setFormSubject('');
      setFormSubjectManual(false);
      setFormChapter('');
      setSheetMode('form');
      showToast('Choose a subject to finish adding this task.');
      return;
    }
    setAddingTask(true);
    try {
      await addTask(parsed.subject, parsed.topic, parsed.type, false);
      setOlText('');
      setSheetOpen(false);
      showToast(`Added: ${parsed.topic} · ${parsed.subject}`);
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
        scoreEntries.map((entry) => ({ subject: entry.subject, score: entry.percent })),
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

  const handleSignOut = () => {
    window.__signOut?.();
    try {
      localStorage.removeItem(`space_session_${spaceId}`);
    } catch {
      /* storage unavailable — reload below still resets the in-memory session */
    }
    setSessionId('');
    window.location.reload();
  };

  /* ---------- onboarding ---------- */

  const finishOnboarding = async () => {
    if (!obExam || creating) return;
    const exam = getExam(obExam);
    if (!exam) return;
    setCreating(true);
    try {
      const start = todayISO();
      const drafts = (await Promise.resolve(buildTopicSequence(exam)))
        .slice(0, 7 * TOPICS_PER_DAY)
        .map((t, idx) => ({
          exam: exam.id,
          subject: t.subject,
          topic: t.topic,
          kind: 'new' as const,
          day_number: Math.floor(idx / TOPICS_PER_DAY) + 1,
          scheduled_for: addDaysISO(start, Math.floor(idx / TOPICS_PER_DAY)),
          status: 'pending' as const,
          source_key: topicKey(t.subject, t.topic),
        }));
      await window.__workspaceDb.from('zuno_profile').insert({ exam: exam.id, start_date: start });
      await Promise.all(
        drafts.map((d) => window.__workspaceDb.from('zuno_items').insert(d as Record<string, unknown>)),
      );
      const chosenDate = obDate || defaultExamDate(exam, start);
      await window.__workspaceDb.from('zuno_meta').insert({ meta_key: 'exam_date', meta_value: chosenDate });
      const first = obFirstTask.trim();
      if (first) {
        const parsed = parseOneLiner(first, exam);
        if (parsed.subject) {
          const key = topicKey(parsed.subject, parsed.topic);
          await window.__workspaceDb.from('zuno_items').insert({
            exam: exam.id,
            subject: parsed.subject,
            topic: parsed.topic,
            kind: 'new',
            day_number: 1,
            scheduled_for: start,
            status: 'pending',
            source_key: key,
          });
          await window.__workspaceDb.from('zuno_meta').insert({
            meta_key: taskTypeKey(key),
            meta_value: JSON.stringify({ type: normalizeTaskType(parsed.type), ai: false }),
          });
        } else {
          setFormType(parsed.type);
          setFormCustom(parsed.topic);
          setFormSubject('');
          setFormSubjectManual(false);
          setFormChapter('');
          setSheetMode('form');
          setSheetOpen(true);
          showToast('Choose a subject to add your first custom task.');
        }
      }
      profileQ.refresh();
      itemsQ.refresh();
      metaQ.refresh();
    } finally {
      setCreating(false);
    }
  };

  /* ---------- coach ---------- */

  const coachContext = () => {
    const mission = missionQueue[0];
    const weakList = weakAreas.map((w) => w.label).join('; ') || 'none identified yet';
    return [
      `Exam: ${examDef?.fullName ?? profile?.exam ?? 'not chosen'}. Exam date: ${examDate} (${daysToExam} days away). Prep day ${day}. Streak: ${streak} days.`,
      `Pace: ${pace.label}. ${pace.detail}`,
      `Today's mission: ${mission ? `${mission.topic} (${mission.subject})` : 'nothing pending'}. Pending today: ${missionQueue.length}. Done today: ${doneToday.length}.`,
      `Revisions due today: ${dueRevisions.length}. Topics studied so far: ${topicsStudied}. Revisions completed: ${revisionsDone}.`,
      `Weak areas: ${weakList}.`,
      goals ? `Student's goal: ${goals}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const quickAnswer = (question: string): string => {
    if (question === 'What should I do today?') {
      const mission = missionQueue[0];
      const parts: string[] = [];
      if (dueRevisions.length > 0) {
        parts.push(
          `Start with your ${dueRevisions.length} revision${dueRevisions.length === 1 ? '' : 's'} in the “Revise today” strip — memory first, always.`,
        );
      }
      if (mission) {
        parts.push(`Then your mission: **${mission.topic}** (${mission.subject}). One honest session on it beats three scattered ones.`);
      } else if (doneToday.length > 0) {
        parts.push(`Your list is clear — ${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} done today. If you have fuel left, tap + and I'll pick something smart.`);
      } else {
        parts.push(`Nothing queued yet — tap the + button and either tell me what you're studying or let me pick for you.`);
      }
      return parts.join(' ');
    }
    if (question === 'Am I on track?') {
      return `${pace.emoji} **${pace.label}** — ${pace.detail} ${daysToExam} days to ${examDef?.target.label ?? 'exam day'}. ${trackQuote(pace.status === 'green' ? 'on_track' : pace.status === 'amber' ? 'behind_recoverable' : 'behind_critical')}`;
    }
    // What's my weakest topic?
    if (weakAreas.length === 0) {
      return `I don't have test data yet, so I can't point at a weak topic honestly. Log a test score on your Dashboard — even a rough mock — and I'll start spotting patterns. For now, ${leastCoveredSubject ? `**${leastCoveredSubject}** has the least coverage, so that's where I'd lean` : 'keep covering fresh ground'}.`;
    }
    const top = weakAreas.slice(0, 3).map((w) => `**${w.label}** (${w.detail})`).join(', ');
    return `Based on your scores: ${top}. Want me to add a practice task? Tap + and choose “Let VicharakAI decide” — I factor these in.`;
  };

  const askCoach = async (text: string, deterministic: boolean) => {
    if (!text.trim() || coachThinking) return;
    setCoachMessages((prev) => [...prev, { role: 'user', text }]);
    if (deterministic) {
      setCoachMessages((prev) => [...prev, { role: 'coach', text: quickAnswer(text) }]);
      return;
    }
    setCoachThinking(true);
    try {
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
              content: `You are VicharakAI — a warm, direct study coach for Indian competitive-exam aspirants (JEE/NEET/UPSC/CAT/SSC). Talk like a senior who cracked the exam: encouraging but honest, peer-to-peer, no lectures, no guilt-tripping. Keep answers short (2-5 sentences), concrete, and grounded ONLY in the student data below — never invent history. Suggest at most one action at a time. You are fully available from day 1; never mention unlocks, gates, or countdowns.\n\nSTUDENT DATA:\n${coachContext()}`,
            },
            ...history,
            { role: 'user', content: text },
          ],
          max_tokens: 400,
          temperature: 0.7,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      setCoachMessages((prev) => [
        ...prev,
        { role: 'coach', text: typeof reply === 'string' && reply.trim() ? reply : "Hmm, I lost my train of thought — ask me that once more?" },
      ]);
    } catch {
      setCoachMessages((prev) => [
        ...prev,
        { role: 'coach', text: "I couldn't reach my thinking cap just now — check your connection and ask again. Meanwhile, the quick questions above always work." },
      ]);
    } finally {
      setCoachThinking(false);
    }
  };

  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coachMessages, coachThinking]);

  /* ---------- progress derivations ---------- */

  const subjectProgress = useMemo(() => {
    if (!examDef) return [];
    const doneKeys = new Set(
      items.filter((i) => i.kind === 'new' && i.status === 'done').map((i) => i.source_key || topicKey(i.subject, i.topic)),
    );
    return examDef.subjects.map((s) => {
      const chapters = s.chapters.map((c) => {
        const chapterDone = doneKeys.has(topicKey(s.name, c.name));
        const done = chapterDone ? c.topics.length : c.topics.filter((t) => doneKeys.has(topicKey(s.name, t))).length;
        return { name: c.name, done, total: c.topics.length };
      });
      const done = chapters.reduce((n, c) => n + c.done, 0);
      const total = chapters.reduce((n, c) => n + c.total, 0);
      return { subject: s.name, done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100), chapters };
    });
  }, [examDef, items]);

  const overallPercent = useMemo(() => {
    const done = subjectProgress.reduce((n, s) => n + s.done, 0);
    const total = subjectProgress.reduce((n, s) => n + s.total, 0);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [subjectProgress]);

  const subjectScores = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const entry of scoreEntries) {
      const cur = map.get(entry.subject) ?? { sum: 0, n: 0 };
      cur.sum += entry.percent;
      cur.n += 1;
      map.set(entry.subject, cur);
    }
    return [...map.entries()]
      .map(([subject, v]) => ({ subject, avg: Math.round(v.sum / v.n), n: v.n }))
      .sort((a, b) => a.avg - b.avg);
  }, [scoreEntries]);

  const weakAreas = useMemo(() => {
    const weak: Array<{ label: string; detail: string }> = [];
    for (const entry of scoreEntries) {
      if (entry.percent < 60 && entry.label) {
        weak.push({ label: `${entry.label} (${entry.subject})`, detail: `${entry.percent}% on ${entry.taken_on.slice(5)}` });
      }
    }
    for (const s of subjectScores) {
      if (s.avg < 60) weak.push({ label: s.subject, detail: `${s.avg}% average over ${s.n} test${s.n === 1 ? '' : 's'}` });
    }
    return weak.slice(0, 6);
  }, [scoreEntries, subjectScores]);

  /**
   * Chapter-level weak spots for the dashboard. Strongest signal first: a
   * chapter a low test score points at, then untouched chapters inside a
   * subject the tests flag, then whatever is still unstarted in the
   * least-covered subjects — so the list is useful from day one.
   */
  const weakChapters = useMemo(() => {
    type Row = { subject: string; chapter: string; detail: string; rank: number };
    const rows: Row[] = [];
    const seen = new Set<string>();
    const push = (row: Row) => {
      const key = `${row.subject}|${row.chapter}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    };
    const avgBySubject = new Map(subjectScores.map((s) => [s.subject, s.avg]));

    for (const entry of scoreEntries) {
      if (entry.percent >= 60 || !entry.label) continue;
      const chapters = subjectProgress.find((s) => s.subject === entry.subject)?.chapters ?? [];
      const label = entry.label.toLowerCase();
      const matched = chapters.find(
        (c) => label.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(label),
      );
      push({
        subject: entry.subject,
        chapter: matched?.name ?? entry.label,
        detail:
          entry.marks !== null && entry.total !== null
            ? `${entry.marks}/${entry.total} · ${entry.percent}%`
            : `${entry.percent}% on ${entry.taken_on.slice(5)}`,
        rank: 300 + (60 - entry.percent),
      });
    }

    for (const s of subjectProgress) {
      const avg = avgBySubject.get(s.subject);
      if (avg === undefined || avg >= 60) continue;
      for (const c of s.chapters) {
        if (c.done > 0) continue;
        push({ subject: s.subject, chapter: c.name, detail: `Untouched · ${avg}% test average`, rank: 200 + (60 - avg) });
      }
    }

    for (const s of [...subjectProgress].sort((a, b) => a.percent - b.percent)) {
      for (const c of s.chapters) {
        if (c.done > 0) continue;
        push({ subject: s.subject, chapter: c.name, detail: `Not started · subject ${s.percent}% covered`, rank: 100 - s.percent });
      }
    }

    return rows.sort((a, b) => b.rank - a.rank).slice(0, 6);
  }, [scoreEntries, subjectScores, subjectProgress]);

  const leastCoveredSubject = useMemo(() => {
    const ranked = [...subjectProgress].sort((a, b) => a.percent - b.percent);
    return ranked[0]?.subject ?? null;
  }, [subjectProgress]);

  const accuracyTrend = useMemo(
    () => scoreEntries.slice(-10).map((entry) => ({ label: entry.taken_on.slice(5), value: entry.percent })),
    [scoreEntries],
  );

  /** Newest tests first — shows the marks exactly as the student entered them. */
  const recentTests = useMemo(() => [...scoreEntries].reverse().slice(0, 5), [scoreEntries]);

  const hoursLog = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
    return days.map((iso) => {
      const minutes = items
        .filter((i) => i.status === 'done' && (i.completed_at || '').slice(0, 10) === iso)
        .reduce((sum, i) => {
          const ann = annotations.get(i.source_key || topicKey(i.subject, i.topic));
          return sum + estimatedMinutes(ann?.type, i.kind);
        }, 0);
      return { iso, minutes };
    });
  }, [items, annotations, today]);
  const maxMinutes = Math.max(60, ...hoursLog.map((h) => h.minutes));

  /* A score is only valid as marks out of a positive total — no percentage cap. */
  const scoreMarksValue = Number(scoreMarks);
  const scoreTotalValue = Number(scoreTotal);
  const scoreFormValid =
    !!scoreSubject &&
    scoreMarks.trim() !== '' &&
    scoreTotal.trim() !== '' &&
    Number.isFinite(scoreMarksValue) &&
    Number.isFinite(scoreTotalValue) &&
    scoreTotalValue > 0 &&
    scoreMarksValue <= scoreTotalValue;

  const logScore = async () => {
    if (!scoreFormValid || savingScore || !profile) return;
    setSavingScore(true);
    const percent = scorePercent(scoreMarksValue, scoreTotalValue);
    try {
      await window.__workspaceDb.from('zuno_test_scores').insert({
        exam: profile.exam,
        subject: scoreSubject,
        test_name: scoreTestName.trim() || null,
        marks_obtained: scoreMarksValue,
        total_marks: scoreTotalValue,
        percent,
        taken_on: today,
      });
      // Percentage mirror so VicharakAI's server-side history keeps seeing this test.
      await window.__workspaceDb.from('zuno_scores').insert({
        exam: profile.exam,
        subject: scoreSubject,
        topic: scoreTestName.trim() || null,
        score: percent,
        taken_on: today,
      });
      resultsQ.refresh();
      scoresQ.refresh();
      setScoreFormOpen(false);
      setScoreMarks('');
      setScoreTotal('');
      setScoreTestName('');
      showToast(
        `Logged ${scoreMarksValue}/${scoreTotalValue} in ${scoreSubject} — I factor this into your weak chapters.`,
      );
    } finally {
      setSavingScore(false);
    }
  };

  /* ================= render ================= */

  if (profileQ.loading || (profile && itemsQ.loading && items.length === 0)) {
    return (
      <div className={`min-h-full flex flex-col items-center justify-center gap-3 py-20 ${PAGE_GRADIENT}`}>
        <style>{MOTION_CSS}</style>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--space-border-default)] border-t-[var(--space-brand-highlight)]" />
        <p className={`text-sm ${typography.color.muted}`}>One sec — remembering where we left off…</p>
      </div>
    );
  }

  if (profileQ.error) {
    return (
      <div className={`min-h-full flex flex-col items-center justify-center gap-3 py-20 px-6 text-center ${PAGE_GRADIENT}`}>
        <p className={`text-sm ${typography.color.danger}`}>I couldn't load your plan: {profileQ.error.message}</p>
        <button
          type="button"
          onClick={() => {
            profileQ.refresh();
            itemsQ.refresh();
          }}
          className={`px-4 py-2 rounded-xl text-sm ${tw.button.secondary}`}
        >
          Let's try that again
        </button>
      </div>
    );
  }

  /* ---------- ONBOARDING: choose exam → exam date → first task ---------- */
  if (!profile) {
    const draftExam = obExam ? getExam(obExam) : undefined;
    return (
      <div className={`min-h-full w-full flex flex-col items-center px-5 py-10 ${PAGE_GRADIENT}`}>
        <style>{MOTION_CSS}</style>
        <div className="w-full max-w-md zuno-rise">
          <div className="flex justify-center mb-4">
            <ZunoAvatar size="lg" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-6" aria-label={`Step ${obStep} of 3`}>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: s === obStep ? 24 : 8,
                  background: s <= obStep ? 'var(--space-brand-highlight)' : 'var(--space-surface-muted)',
                }}
              />
            ))}
          </div>

          {obStep === 1 && (
            <div className="text-center">
              <h1 className={`text-2xl font-bold ${typography.color.primary}`}>Hey, I'm VicharakAI.</h1>
              <p className={`text-sm mt-2 ${typography.color.secondary}`}>
                Which exam are we taking on together?
              </p>
              <div className="mt-6 space-y-3 text-left">
                {EXAMS.map((exam, idx) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => {
                      setObExam(exam.id);
                      setObDate(defaultExamDate(exam, today));
                      setObStep(2);
                    }}
                    className={`w-full ${tw.card.default} !rounded-3xl !shadow-[0_2px_12px_color-mix(in_srgb,var(--space-shell-shadow)_55%,transparent)] p-4 flex items-center gap-4 text-left transition-all duration-200 hover:shadow-lg hover:border-[var(--space-brand-highlight-200)] hover:-translate-y-0.5 zuno-rise`}
                    style={{ animationDelay: `${80 + idx * 60}ms` }}
                    data-testid={`button-exam-${exam.id}`}
                  >
                    <span className="w-11 h-11 rounded-2xl bg-[var(--space-surface-accent-soft)] flex items-center justify-center flex-shrink-0">
                      <GraduationCap className={`w-5 h-5 ${tw.icon.primary}`} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-base font-bold ${typography.color.primary}`}>{exam.name}</span>
                      <span className={`block text-xs mt-0.5 ${typography.color.muted}`}>
                        {exam.fullName} · {exam.blurb}
                      </span>
                    </span>
                    <ChevronRight className={`w-4 h-4 ml-auto flex-shrink-0 ${tw.icon.muted}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {obStep === 2 && draftExam && (
            <div className="text-center">
              <h1 className={`text-2xl font-bold ${typography.color.primary}`}>When is {draftExam.name}?</h1>
              <p className={`text-sm mt-2 ${typography.color.secondary}`}>
                I pace your whole plan around this date — you can change it anytime in Profile.
              </p>
              <div className={`${tw.card.default} !rounded-3xl p-5 mt-6 text-left`}>
                <label className={`block text-xs font-bold uppercase tracking-[0.12em] mb-2 ${typography.color.muted}`} htmlFor="ob-exam-date">
                  Exam date
                </label>
                <input
                  id="ob-exam-date"
                  type="date"
                  value={obDate}
                  min={today}
                  onChange={(e) => setObDate(e.target.value)}
                  className={`${tw.input.base} ${tw.input.default} !rounded-xl text-base`}
                  data-testid="input-exam-date"
                />
                <p className={`text-[11px] mt-2 ${typography.color.muted}`}>
                  {obDate ? `${Math.max(0, diffDays(today, obDate))} days from today` : `Usually around ${defaultExamDate(draftExam, today)}`}
                </p>
              </div>
              <button
                type="button"
                disabled={!obDate}
                onClick={() => setObStep(3)}
                className={`mt-5 w-full py-3 rounded-full text-sm font-bold ${tw.button.accent} disabled:opacity-50`}
                data-testid="button-ob-continue"
              >
                Continue
              </button>
              <button type="button" onClick={() => setObStep(1)} className={`mt-3 text-xs font-medium ${typography.color.muted} hover:underline`}>
                ← Different exam
              </button>
            </div>
          )}

          {obStep === 3 && draftExam && (
            <div className="text-center">
              <h1 className={`text-2xl font-bold ${typography.color.primary}`}>What are you studying today?</h1>
              <p className={`text-sm mt-2 ${typography.color.secondary}`}>
                Type it in your own words — I'll structure it. Or skip and start with my plan.
              </p>
              <div className={`${tw.card.default} !rounded-3xl p-5 mt-6 text-left`}>
                <input
                  type="text"
                  value={obFirstTask}
                  onChange={(e) => setObFirstTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void finishOnboarding();
                  }}
                  placeholder="e.g. Organic chemistry reaction mechanisms practice"
                  className={`${tw.input.base} ${tw.input.default} !rounded-xl text-base`}
                  data-testid="input-first-task"
                />
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={() => void finishOnboarding()}
                className={`mt-5 w-full py-3 rounded-full text-sm font-bold ${tw.button.accent} disabled:opacity-60 inline-flex items-center justify-center gap-2`}
                data-testid="button-ob-finish"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {creating ? 'Setting up your week…' : obFirstTask.trim() ? "Let's go" : 'Skip — start with your plan'}
              </button>
              <p className={`text-[11px] mt-4 ${typography.color.muted}`}>
                I remember every topic you study and bring each one back at the right moments — 1, 3, 5, 7 and 14 days later — so nothing slips.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const mission = missionQueue[0];
  const missionAnn = mission ? annotations.get(mission.source_key || topicKey(mission.subject, mission.topic)) : undefined;
  const laterToday = missionQueue.slice(1, VISIBLE_TASK_CAP);
  const overflow = missionQueue.slice(VISIBLE_TASK_CAP);
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const examName = examDef?.name ?? profile.exam.toUpperCase();
  const paceAccent =
    pace.status === 'green' ? 'var(--space-semantic-success)' : pace.status === 'amber' ? AMBER : BEHIND_RED;
  const weekMinutes = hoursLog.reduce((sum, h) => sum + h.minutes, 0);
  const missionStarted = mission && startedId === mission.id;

  const formSubjectDef = examDef?.subjects.find((subject) => subject.name === formSubject);
  const formTopics = (formSubjectDef
    ? subjectTopics(formSubjectDef).map((entry) => ({ ...entry, subject: formSubjectDef.name }))
    : examDef?.subjects.flatMap((subject) =>
        subjectTopics(subject).map((entry) => ({ ...entry, subject: subject.name })),
      ) ?? []
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

  return (
    <div className={`relative min-h-full flex flex-col w-full ${PAGE_GRADIENT}`}>
      <style>{MOTION_CSS}</style>

      {/* ==================== TAB CONTENT ==================== */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* ---------------- TODAY ---------------- */}
        {tab === 'today' && (
          <div className="flex-1 px-5 pt-5 pb-4">
            {/* warm entry: greeting · quote · nudge */}
            <header className="zuno-rise">
              <h1 className={`text-xl font-bold leading-tight ${typography.color.primary}`}>
                {timeOfDayGreeting(studentName)}
              </h1>
              <p className={`text-xs italic mt-1.5 zuno-fade ${typography.color.muted}`} data-testid="text-daily-quote">
                “{dailyQuote(today)}”
              </p>
              <p className={`text-sm font-medium mt-2 ${typography.color.secondary}`}>Ready to make today count?</p>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <StatChip tone="amber">
                  <Flame className="w-3 h-3" style={{ color: AMBER }} />
                  Day {streak} streak {streak > 0 ? '\uD83D\uDD25' : ''}
                </StatChip>
                <StatChip tone="accent">
                  <Target className="w-3 h-3" />
                  {daysToExam} days to {examName}
                </StatChip>
                <StatChip tone={pace.status === 'green' ? 'green' : pace.status === 'amber' ? 'amber' : 'red'}>
                  {pace.emoji} {pace.label}
                </StatChip>
              </div>
            </header>

            {/* Today's Mission hero */}
            <section className="mt-5 zuno-rise" style={{ animationDelay: '50ms' }} data-testid="card-today-focus">
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-2 ${typography.color.muted}`}>
                Today's mission
              </p>
              {mission ? (
                <div className="rounded-[28px] p-6 bg-[linear-gradient(140deg,var(--space-brand-primary),var(--space-brand-highlight))] text-[var(--space-text-on-highlight)] shadow-[0_12px_32px_color-mix(in_srgb,var(--space-brand-highlight)_30%,transparent)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[color-mix(in_srgb,var(--space-text-on-highlight)_18%,transparent)]">
                      {typeBadgeIcon(missionAnn?.type, mission.kind)}
                      {typeLabel(missionAnn?.type, mission.kind)}
                    </span>
                    <span className="text-[11px] font-semibold opacity-90">{mission.subject}</span>
                    {mission.scheduled_for < today && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[color-mix(in_srgb,var(--space-text-on-highlight)_18%,transparent)]">
                        carried over
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-bold leading-tight" data-testid="text-focus-topic">
                    {mission.topic}
                  </h2>
                  <p className="mt-1.5 text-sm opacity-90">
                    {missionStarted
                      ? "You're in session — full focus. Mark it done when you surface."
                      : 'One session, full attention. Everything else can wait.'}
                  </p>
                  <button
                    type="button"
                    disabled={busyIds.has(mission.id)}
                    onClick={() => {
                      if (missionStarted) void handleToggle(mission);
                      else setStartedId(mission.id);
                    }}
                    className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold bg-[var(--space-text-on-highlight)] text-[var(--space-brand-highlight)] shadow-[0_6px_18px_color-mix(in_srgb,var(--space-brand-highlight-900)_25%,transparent)] hover:opacity-90 transition-opacity disabled:opacity-60 touch-manipulation"
                    data-testid={`button-mission-${mission.id}`}
                  >
                    {busyIds.has(mission.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : missionStarted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {missionStarted ? 'Mark as done' : 'Start'}
                  </button>
                </div>
              ) : (
                <div className={`${tw.card.default} !rounded-[28px] p-6 text-center`}>
                  {doneToday.length > 0 ? (
                    <>
                      <CalendarCheck className={`w-8 h-8 mx-auto mb-2 ${tw.icon.success}`} />
                      <h2 className={`text-xl font-bold ${typography.color.primary}`}>
                        Mission complete{studentName ? `, ${studentName}` : ''} ✨
                      </h2>
                      <p className={`text-sm mt-1.5 ${typography.color.muted}`}>
                        {doneToday.length} thing{doneToday.length === 1 ? '' : 's'} done today. Want more? Tap + and I'll pick something smart.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <ZunoAvatar />
                      </div>
                      <h2 className={`text-xl font-bold mt-3 ${typography.color.primary}`}>A clear runway</h2>
                      <p className={`text-sm mt-1.5 ${typography.color.muted}`}>
                        Nothing queued yet. Tap + below — type what you're studying, pick from the syllabus, or let me decide.
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Later Today — compact, capped, never overwhelming */}
            {laterToday.length > 0 && (
              <section className="mt-5 zuno-rise" style={{ animationDelay: '90ms' }} data-testid="section-later-today">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${typography.color.muted}`}>
                    Later today
                  </p>
                  {overflow.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllToday((v) => !v)}
                      className={`text-[11px] font-semibold ${typography.color.accent} hover:underline inline-flex items-center gap-0.5`}
                      data-testid="button-see-all"
                    >
                      {showAllToday ? 'Show fewer' : `See all (${missionQueue.length - 1})`}
                      {showAllToday ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <ul className="space-y-2">
                  {laterToday.map((item, idx) => (
                    <CompactTaskRow
                      key={item.id}
                      item={item}
                      annotation={annotations.get(item.source_key || topicKey(item.subject, item.topic))}
                      busy={busyIds.has(item.id)}
                      onToggle={handleToggle}
                      entranceDelayMs={idx * 50}
                    />
                  ))}
                </ul>
                {showAllToday && overflow.length > 0 && (
                  <ul className="mt-2 space-y-2 max-h-72 overflow-y-auto pr-0.5">
                    {overflow.map((item, idx) => (
                      <CompactTaskRow
                        key={item.id}
                        item={item}
                        annotation={annotations.get(item.source_key || topicKey(item.subject, item.topic))}
                        busy={busyIds.has(item.id)}
                        onToggle={handleToggle}
                        entranceDelayMs={idx * 40}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Top 5 daily formula — always visible */}
            <section className="mt-5 zuno-rise" style={{ animationDelay: '120ms' }} data-testid="section-revise-today">
              <div className="flex items-center gap-1.5 mb-2">
                <RotateCcw className="w-3.5 h-3.5" style={{ color: AMBER }} />
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${typography.color.muted}`}>
                  Revise today · your daily 5
                </p>
              </div>
              {formula.length === 0 ? (
                <p className={`text-xs px-1 ${typography.color.muted}`}>
                  Finish your first topic and your daily revision ritual starts here — 5 quick recalls, every day.
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 zuno-scroll-x">
                  {formula.map(({ item, recall }) => {
                    const busy = busyIds.has(item.id);
                    return (
                      <button
                        key={`${item.id}-${recall ? 'r' : 'd'}`}
                        type="button"
                        disabled={busy || recall}
                        onClick={() => {
                          if (!recall) void handleToggle(item);
                        }}
                        className={`${tw.card.default} !rounded-2xl px-3.5 py-2.5 flex-shrink-0 w-[168px] text-left transition-all ${recall ? '' : 'hover:border-[var(--space-brand-highlight-200)] hover:-translate-y-0.5'}`}
                        title={recall ? 'Quick recall — no checkbox needed, just replay it in your head' : proofText(item, today)}
                        data-testid={`formula-chip-${item.id}`}
                      >
                        <span className="flex items-center gap-1.5">
                          {busy ? (
                            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                          ) : (
                            <span
                              className="w-3 h-3 rounded-full border flex-shrink-0"
                              style={{ borderColor: AMBER, background: recall ? 'transparent' : 'rgba(245,158,11,0.15)' }}
                            />
                          )}
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${typography.color.muted}`}>
                            {recall ? 'recall' : `day-${item.interval_days ?? '—'}`}
                          </span>
                        </span>
                        <span className={`block text-xs font-semibold mt-1.5 leading-snug line-clamp-2 ${typography.color.primary}`}>
                          {item.topic}
                        </span>
                        <span className={`${tw.badge.default} ${tw.badge.primary} mt-1.5 inline-block`}>{item.subject}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* quiet done-today footer line */}
            {doneToday.length > 0 && (
              <p className={`text-[11px] mt-5 text-center ${typography.color.muted}`}>
                <Check className="w-3 h-3 inline mr-1" style={{ color: 'var(--space-semantic-success)' }} />
                {doneToday.length} done today — tap Dashboard to see the bigger picture
              </p>
            )}

            {itemsQ.error && (
              <p className={`text-xs text-center mt-4 ${typography.color.danger}`}>
                I couldn't sync your checklist: {itemsQ.error.message}
              </p>
            )}
          </div>
        )}

        {/* ---------------- CALENDAR ---------------- */}
        {tab === 'calendar' && (
          <div className="flex-1 min-h-0">
            <ZunoCalendarBody embedded />
          </div>
        )}

        {/* ---------------- DASHBOARD ---------------- */}
        {tab === 'dashboard' && (
          <div className="flex-1 px-5 pt-5 pb-4 space-y-4">
            <header className="zuno-rise">
              <h1 className={`text-xl font-bold ${typography.color.primary}`}>Dashboard</h1>
              <p className={`text-xs mt-1 ${typography.color.muted}`}>
                Your whole progress picture — syllabus, scores, gaps and pace.
              </p>
            </header>

            {/* exam countdown */}
            <section
              className="rounded-3xl p-5 bg-[linear-gradient(135deg,var(--space-brand-primary),var(--space-brand-highlight))] text-[var(--space-text-on-highlight)] shadow-[0_12px_30px_color-mix(in_srgb,var(--space-brand-highlight)_28%,transparent)] zuno-rise"
              style={{ animationDelay: '30ms' }}
              data-testid="card-exam-countdown"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-85">Exam countdown</p>
              <p className="mt-1 text-4xl font-bold leading-none" data-testid="text-days-to-exam">
                {daysToExam}
                <span className="text-base font-bold ml-1.5">day{daysToExam === 1 ? '' : 's'} left</span>
              </p>
              <p className="mt-1.5 text-sm font-semibold opacity-90">
                {examDef?.target.label ?? examName} ·{' '}
                {new Date(`${examDate}T12:00:00`).toLocaleDateString([], {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </section>

            {/* are you on track? */}
            <section
              className={`${tw.card.default} !rounded-3xl p-5 flex items-start gap-3.5 zuno-rise`}
              style={{ animationDelay: '50ms', borderColor: paceAccent }}
              data-testid="card-pace-signal"
            >
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                style={{ background: `color-mix(in srgb, ${paceAccent} 14%, transparent)` }}
                aria-hidden="true"
              >
                {pace.emoji}
              </span>
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${typography.color.muted}`}>
                  Are you on track?
                </p>
                <p className="text-lg font-bold leading-tight" style={{ color: paceAccent }} data-testid="text-pace-label">
                  {pace.label}
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${typography.color.secondary}`}>{pace.detail}</p>
              </div>
            </section>

            {/* syllabus completion */}
            <section className={`${tw.card.default} !rounded-3xl p-5 zuno-rise`} style={{ animationDelay: '70ms' }} data-testid="card-syllabus-progress">
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-sm font-bold ${typography.color.primary}`}>Syllabus completion</h2>
                <span className={`text-lg font-bold ${typography.color.brand}`}>{overallPercent}%</span>
              </div>
              <div className="space-y-3">
                {subjectProgress.map((s) => (
                  <details key={s.subject} className="group">
                    <summary className="flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <span className={`text-xs font-semibold w-24 flex-shrink-0 truncate ${typography.color.secondary}`}>{s.subject}</span>
                      <span className="flex-1 h-2 rounded-full bg-[var(--space-surface-muted)] overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-[linear-gradient(90deg,var(--space-brand-primary),var(--space-brand-highlight))] transition-all duration-700"
                          style={{ width: `${s.percent}%` }}
                        />
                      </span>
                      <span className={`text-[11px] font-bold w-9 text-right flex-shrink-0 ${typography.color.muted}`}>{s.percent}%</span>
                      <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform group-open:rotate-180 ${tw.icon.muted}`} />
                    </summary>
                    <ul className="mt-2 mb-1 ml-1 space-y-1 max-h-44 overflow-y-auto pr-1">
                      {s.chapters.map((c) => (
                        <li key={c.name} className="flex items-center gap-2">
                          <span className={`text-[11px] flex-1 min-w-0 truncate ${c.done === c.total && c.total > 0 ? `line-through ${typography.color.muted}` : typography.color.secondary}`}>
                            {c.name}
                          </span>
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${typography.color.muted}`}>
                            {c.done}/{c.total}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>

            {/* subject-wise performance + accuracy trend */}
            <section className={`${tw.card.default} !rounded-3xl p-5 zuno-rise`} style={{ animationDelay: '90ms' }} data-testid="card-performance">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className={`text-sm font-bold ${typography.color.primary}`}>Subject-wise performance</h2>
                <button
                  type="button"
                  onClick={() => {
                    setScoreFormOpen((v) => !v);
                    if (!scoreSubject && subjectNames[0]) setScoreSubject(subjectNames[0]);
                  }}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${tw.button.accent}`}
                  data-testid="button-log-score"
                >
                  + Log a score
                </button>
              </div>

              {scoreFormOpen && (
                <div className="rounded-2xl border border-[var(--space-border-default)] p-3.5 mb-3 space-y-3 bg-[var(--space-surface-panel)]">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${typography.color.muted}`} htmlFor="score-subject">
                      Subject
                    </label>
                    <select
                      id="score-subject"
                      value={scoreSubject}
                      onChange={(e) => setScoreSubject(e.target.value)}
                      className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm w-full`}
                      data-testid="select-score-subject"
                    >
                      {subjectNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${typography.color.muted}`} htmlFor="score-marks">
                        Marks obtained
                      </label>
                      <input
                        id="score-marks"
                        type="number"
                        inputMode="decimal"
                        value={scoreMarks}
                        onChange={(e) => setScoreMarks(e.target.value)}
                        placeholder="e.g. 148"
                        className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm w-full`}
                        data-testid="input-score-marks"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${typography.color.muted}`} htmlFor="score-total">
                        Total marks
                      </label>
                      <input
                        id="score-total"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        value={scoreTotal}
                        onChange={(e) => setScoreTotal(e.target.value)}
                        placeholder="e.g. 180"
                        className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm w-full`}
                        data-testid="input-score-total"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${typography.color.muted}`} htmlFor="score-test-name">
                      Test name <span className="font-semibold normal-case tracking-normal">(optional)</span>
                    </label>
                    <input
                      id="score-test-name"
                      type="text"
                      value={scoreTestName}
                      onChange={(e) => setScoreTestName(e.target.value)}
                      placeholder="e.g. Full Mock #3 or Kinematics chapter test"
                      className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm w-full`}
                      data-testid="input-score-test-name"
                    />
                  </div>

                  <p className={`text-[11px] ${scoreFormValid ? typography.color.brand : typography.color.muted}`} data-testid="text-score-preview">
                    {scoreFormValid
                      ? `That's ${scorePercent(scoreMarksValue, scoreTotalValue)}% — I'll chart it against your other tests.`
                      : 'Enter marks out of the paper’s total — I work out the percentage for you.'}
                  </p>

                  <button
                    type="button"
                    disabled={!scoreFormValid || savingScore}
                    onClick={() => void logScore()}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold ${tw.button.primary} disabled:opacity-50`}
                    data-testid="button-save-score"
                  >
                    {savingScore ? 'Saving…' : 'Save test score'}
                  </button>
                </div>
              )}

              {subjectScores.length === 0 ? (
                <p className={`text-xs ${typography.color.muted}`}>
                  No test scores yet. Log one — marks out of total is all I need — and I'll start mapping your strong and weak zones.
                </p>
              ) : (
                <div className="space-y-2">
                  {subjectScores.map((s) => (
                    <div key={s.subject} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold w-24 flex-shrink-0 truncate ${typography.color.secondary}`}>{s.subject}</span>
                      <span className="flex-1 h-2 rounded-full bg-[var(--space-surface-muted)] overflow-hidden">
                        <span
                          className="block h-full rounded-full transition-all duration-700"
                          style={{ width: `${s.avg}%`, background: s.avg < 60 ? BEHIND_RED : s.avg < 80 ? AMBER : 'var(--space-semantic-success)' }}
                        />
                      </span>
                      <span className={`text-[11px] font-bold w-16 text-right flex-shrink-0 ${typography.color.muted}`}>
                        {s.avg}% · {s.n}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {recentTests.length > 0 && (
                <div className="mt-4">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-1.5 ${typography.color.muted}`}>Recent tests</p>
                  <ul className="space-y-1.5">
                    {recentTests.map((entry) => (
                      <li key={entry.key} className="flex items-center gap-2">
                        <Trophy className="w-3 h-3 flex-shrink-0" style={{ color: AMBER }} />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-xs font-semibold truncate ${typography.color.primary}`}>
                            {entry.label || `${entry.subject} test`}
                          </span>
                          <span className={`block text-[10px] truncate ${typography.color.muted}`}>
                            {entry.subject} · {formatDayLabel(entry.taken_on, today)}
                          </span>
                        </span>
                        <span className={`text-[11px] font-bold flex-shrink-0 ${typography.color.brand}`}>
                          {entry.marks !== null && entry.total !== null ? `${entry.marks}/${entry.total}` : `${entry.percent}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4">
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5 ${typography.color.muted}`}>
                  <TrendingUp className="w-3 h-3" />
                  Accuracy trend
                </p>
                {accuracyTrend.length >= 2 ? (
                  <>
                    <TrendChart points={accuracyTrend} />
                    <div className="flex justify-between px-2">
                      <span className={`text-[10px] ${typography.color.muted}`}>{accuracyTrend[0].label}</span>
                      <span className={`text-[10px] ${typography.color.muted}`}>
                        {accuracyTrend[accuracyTrend.length - 1].label}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className={`text-xs ${typography.color.muted}`}>
                    {accuracyTrend.length === 1
                      ? `First test logged at ${accuracyTrend[0].value}% — log one more and the trend line appears here.`
                      : 'Log two or more tests and your accuracy trend appears here.'}
                  </p>
                )}
              </div>
            </section>

            {/* weak chapters */}
            <section className={`${tw.card.default} !rounded-3xl p-5 zuno-rise`} style={{ animationDelay: '110ms' }} data-testid="card-weak-chapters">
              <h2 className={`text-sm font-bold flex items-center gap-1.5 ${typography.color.primary}`}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: BEHIND_RED }} />
                Weak chapters
              </h2>
              <p className={`text-[11px] mt-1 mb-3 ${typography.color.muted}`}>
                Ranked from your test scores first, then the chapters you haven’t touched yet.
              </p>
              {weakChapters.length === 0 ? (
                <p className={`text-xs ${typography.color.muted}`}>
                  Nothing flagged — your coverage is even and no test has dipped below 60%. Keep going.
                </p>
              ) : (
                <ul className="space-y-2">
                  {weakChapters.map((w, idx) => (
                    <li key={`${w.subject}|${w.chapter}`} className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${BEHIND_RED} 16%, transparent)`, color: BEHIND_RED }}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs font-semibold truncate ${typography.color.primary}`}>{w.chapter}</span>
                        <span className={`block text-[10px] truncate ${typography.color.muted}`}>
                          {w.subject} · {w.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* study hours */}
            <section className={`${tw.card.default} !rounded-3xl p-5 zuno-rise`} style={{ animationDelay: '130ms' }} data-testid="card-hours">
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-sm font-bold flex items-center gap-1.5 ${typography.color.primary}`}>
                  <Clock className="w-3.5 h-3.5" />
                  Study hours · last 7 days
                </h2>
                <span className={`text-sm font-bold ${typography.color.brand}`} data-testid="text-week-hours">
                  {(weekMinutes / 60).toFixed(1)}h
                </span>
              </div>
              <div className="flex items-end justify-between gap-2 h-24">
                {hoursLog.map((h) => (
                  <div key={h.iso} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className={`text-[9px] font-semibold ${typography.color.muted}`}>
                      {h.minutes > 0 ? `${(h.minutes / 60).toFixed(1)}h` : ''}
                    </span>
                    <div
                      className="w-full max-w-[26px] rounded-t-lg bg-[linear-gradient(180deg,var(--space-brand-primary),var(--space-brand-highlight))] transition-all duration-700"
                      style={{ height: `${Math.max(3, (h.minutes / maxMinutes) * 64)}px`, opacity: h.minutes > 0 ? 1 : 0.18 }}
                    />
                    <span className={`text-[9px] uppercase ${h.iso === today ? typography.color.accent : typography.color.muted}`}>
                      {new Date(`${h.iso}T12:00:00`).toLocaleDateString([], { weekday: 'narrow' })}
                    </span>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] mt-2 ${typography.color.muted}`}>Estimated from what you checked off — revisions ~25 min, lectures ~60, practice ~50.</p>
            </section>

            <div className="grid grid-cols-4 gap-2 zuno-rise" style={{ animationDelay: '160ms' }}>
              {[
                { label: 'Topics studied', value: topicsStudied },
                { label: 'Revisions done', value: revisionsDone },
                { label: 'Tests logged', value: scoreEntries.length },
                { label: 'Day streak', value: streak },
              ].map((s) => (
                <div key={s.label} className={`${tw.card.default} !rounded-2xl p-3 text-center`}>
                  <p className={`text-xl font-bold ${typography.color.brand}`}>{s.value}</p>
                  <p className={`text-[10px] mt-0.5 ${typography.color.muted}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- COACH ---------------- */}
        {tab === 'coach' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* coach header */}
            <div className="px-5 pt-5 pb-3 flex items-center gap-3 zuno-rise">
              <ZunoAvatar />
              <div className="min-w-0">
                <h1 className={`text-lg font-bold leading-tight ${typography.color.primary}`}>Zuno</h1>
                <p className={`text-[11px] ${typography.color.muted}`}>Your coach — here from day one</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
              {/* daily review summary card */}
              <div
                className="rounded-3xl p-4 border border-[var(--space-border-default)] bg-[linear-gradient(135deg,var(--space-surface-accent-soft),var(--space-surface-card))] zuno-rise"
                data-testid="card-daily-review"
              >
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${typography.color.muted}`}>Today so far</p>
                <p className={`text-sm mt-1.5 leading-relaxed ${typography.color.primary}`}>
                  {doneToday.length === 0
                    ? `Nothing checked off yet — no stress. ${missionQueue.length > 0 ? `Your mission is ${missionQueue[0].topic}, and` : 'Tap + on Today to queue something, and'} your daily 5 revisions are waiting.`
                    : `${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} done — ${doneToday.filter((i) => i.kind === 'revision').length} revision${doneToday.filter((i) => i.kind === 'revision').length === 1 ? '' : 's'} locked in. ${missionQueue.length > 0 ? `${missionQueue.length} still queued.` : 'List is clear — strong day.'}`}
                  {' '}{pace.emoji} {pace.label}, day {streak} streak.
                </p>
              </div>

              {/* conversation — full-bleed cards, never chat bubbles */}
              {coachMessages.map((m, idx) =>
                m.role === 'coach' ? (
                  <div
                    key={idx}
                    className="rounded-3xl border border-[var(--space-border-default)] bg-[var(--space-surface-card)] p-4 shadow-sm zuno-rise"
                    data-testid={`coach-msg-${idx}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <ZunoAvatar size="sm" />
                      <span className={`text-xs font-bold ${typography.color.brand}`}>Zuno</span>
                    </div>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${typography.color.primary}`}>
                      {m.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                  </div>
                ) : (
                  <div key={idx} className="pl-10 zuno-rise" data-testid={`coach-msg-${idx}`}>
                    <div className="rounded-3xl bg-[var(--space-surface-accent-soft)] border border-[var(--space-brand-primary-100)] p-3.5">
                      <span className={`block text-[10px] font-bold uppercase tracking-wide mb-0.5 ${typography.color.muted}`}>You</span>
                      <p className={`text-sm ${typography.color.primary}`}>{m.text}</p>
                    </div>
                  </div>
                ),
              )}
              {coachThinking && (
                <div className="rounded-3xl border border-[var(--space-border-default)] bg-[var(--space-surface-card)] p-4 flex items-center gap-2.5">
                  <ZunoAvatar size="sm" />
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--space-brand-highlight)] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--space-brand-highlight)] animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--space-brand-highlight)] animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </span>
                  <span className={`text-xs ${typography.color.muted}`}>VicharakAI is thinking…</span>
                </div>
              )}
              <div ref={coachEndRef} />
            </div>

            {/* quick-ask chips + warm composer */}
            <div className="px-5 pb-3 pt-1">
              <div className="flex gap-2 overflow-x-auto pb-2 zuno-scroll-x" data-testid="coach-quick-asks">
                {['What should I do today?', 'Am I on track?', "What's my weakest topic?"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void askCoach(q, true)}
                    className="flex-shrink-0 rounded-full border border-[var(--space-brand-primary-200)] bg-[var(--space-surface-card)] px-3.5 py-2 text-xs font-semibold text-[var(--space-text-brand)] shadow-sm transition hover:bg-[var(--space-surface-accent-soft)]"
                    data-testid={`quick-ask-${q.slice(0, 12)}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="rounded-[24px] border border-[var(--space-border-default)] bg-[var(--space-surface-card)] shadow-[0_8px_24px_color-mix(in_srgb,var(--space-shell-shadow-strong)_45%,transparent)] flex items-end gap-2 p-2 pl-4">
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
                  placeholder="Tell VicharakAI how prep is going…"
                  rows={1}
                  className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none text-sm py-2 min-w-0"
                  data-testid="coach-input"
                />
                <button
                  type="button"
                  disabled={!coachInput.trim() || coachThinking}
                  onClick={() => {
                    const t = coachInput.trim();
                    if (t) {
                      setCoachInput('');
                      void askCoach(t, false);
                    }
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[linear-gradient(135deg,var(--space-brand-primary),var(--space-brand-highlight))] text-[var(--space-text-on-highlight)] shadow-[0_4px_12px_color-mix(in_srgb,var(--space-brand-highlight)_35%,transparent)] disabled:opacity-40 transition-opacity"
                  data-testid="coach-send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PROFILE ---------------- */}
        {tab === 'profile' && (
          <div className="flex-1 px-5 pt-5 pb-4 space-y-4">
            <header className="flex items-center gap-3 zuno-rise">
              <ZunoAvatar size="lg" />
              <div className="min-w-0 flex-1">
                {nameDraft === null ? (
                  <button
                    type="button"
                    onClick={() => setNameDraft(studentName ?? '')}
                    className="flex items-center gap-1.5 group"
                    data-testid="button-edit-name"
                  >
                    <h1 className={`text-xl font-bold ${typography.color.primary}`}>{studentName ?? 'Add your name'}</h1>
                    <Pencil className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 ${tw.icon.muted}`} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-1.5 text-sm`}
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 ${tw.button.accent}`}
                      data-testid="button-save-name"
                    >
                      Save
                    </button>
                  </div>
                )}
                <p className={`text-xs mt-0.5 ${typography.color.muted}`}>
                  Day {day} of prep · {examName} aspirant
                </p>
              </div>
            </header>

            {/* streak & stats */}
            <section className={`${tw.card.default} !rounded-3xl p-4 zuno-rise`} style={{ animationDelay: '40ms' }} data-testid="card-profile-stats">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Streak', value: `${streak}\uD83D\uDD25` },
                  { label: 'Topics', value: topicsStudied },
                  { label: 'Revisions', value: revisionsDone },
                  { label: 'Tests', value: scoreEntries.length },
                ].map((s) => (
                  <div key={s.label}>
                    <p className={`text-lg font-bold ${typography.color.brand}`}>{s.value}</p>
                    <p className={`text-[10px] ${typography.color.muted}`}>{s.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* exam settings */}
            <section className={`${tw.card.default} !rounded-3xl p-5 space-y-4 zuno-rise`} style={{ animationDelay: '70ms' }} data-testid="card-exam-settings">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ${typography.color.muted}`}>Exam</p>
                {changingExam ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {EXAMS.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          void (async () => {
                            await window.__workspaceDb.from('zuno_profile').update(profile.id, { exam: e.id });
                            await upsertMeta('exam_date', defaultExamDate(e, today));
                            profileQ.refresh();
                            setChangingExam(false);
                            showToast(`Switched to ${e.name} — your history stays safe.`);
                          })();
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          e.id === profile.exam
                            ? 'bg-[var(--space-brand-primary)] text-[var(--space-text-on-primary)]'
                            : `${tw.bg.muted} ${typography.color.secondary} hover:brightness-95`
                        }`}
                        data-testid={`button-switch-exam-${e.id}`}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${typography.color.primary}`}>{examDef?.fullName ?? examName}</span>
                    <button
                      type="button"
                      onClick={() => setChangingExam(true)}
                      className={`text-[11px] font-semibold ${typography.color.accent} hover:underline`}
                      data-testid="button-change-exam"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ${typography.color.muted}`}>Exam date</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={examDateDraft ?? examDate}
                    min={today}
                    onChange={(e) => setExamDateDraft(e.target.value)}
                    className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm flex-1`}
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
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 ${tw.button.accent}`}
                      data-testid="button-save-exam-date"
                    >
                      Save
                    </button>
                  )}
                </div>
                <p className={`text-[11px] mt-1.5 ${typography.color.muted}`}>{daysToExam} days away · drives your pace signal</p>
              </div>

              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ${typography.color.muted}`}>Your goal</p>
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
                  className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm resize-none`}
                  data-testid="input-goals"
                />
              </div>
            </section>

            {/* settings + sign out */}
            <section className="space-y-2 zuno-rise" style={{ animationDelay: '100ms' }}>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('openApp', { detail: { appId: 'settings' } }))}
                className={`w-full ${tw.card.default} !rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left hover:bg-[var(--space-surface-card-hover)] transition-colors`}
                data-testid="button-open-settings"
              >
                <SettingsIcon className={`w-4 h-4 flex-shrink-0 ${tw.icon.muted}`} />
                <span className={`text-sm font-medium flex-1 ${typography.color.primary}`}>Account & subscription settings</span>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${tw.icon.muted}`} />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className={`w-full ${tw.card.default} !rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left hover:bg-[var(--space-surface-card-hover)] transition-colors`}
                data-testid="button-sign-out"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--space-semantic-danger)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--space-semantic-danger)' }}>
                  Sign out
                </span>
              </button>
            </section>
          </div>
        )}
      </div>

      {/* toast */}
      {toastText && (
        <div className="pointer-events-none fixed bottom-24 left-0 right-0 flex justify-center z-40 px-6 zuno-toast" role="status" data-testid="toast-quote">
          <p className={`rounded-full px-4 py-2 text-xs italic border border-[var(--space-border-default)] bg-[color-mix(in_srgb,var(--space-surface-panel-strong)_94%,transparent)] backdrop-blur-md shadow-[0_6px_20px_color-mix(in_srgb,var(--space-shell-shadow-strong)_50%,transparent)] ${typography.color.secondary}`}>
            “{toastText}”
          </p>
        </div>
      )}

      {/* Secondary add action — available on Today without competing with the mission. */}
      {tab === 'today' && (
        <button
          type="button"
          onClick={() => {
            setSheetOpen(true);
            setSheetMode('oneliner');
            setAiResult(null);
            setFormSubject('');
            setFormSubjectManual(false);
            setFormChapter('');
            setFormSearch('');
            setFormCustom('');
          }}
          aria-label="Add a task"
          className="fixed bottom-24 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center border border-[var(--space-border-default)] bg-[color-mix(in_srgb,var(--space-surface-card)_88%,transparent)] text-[var(--space-text-muted)] shadow-[0_3px_10px_color-mix(in_srgb,var(--space-shell-shadow)_35%,transparent)] backdrop-blur-sm hover:text-[var(--space-text-brand)] hover:border-[var(--space-border-strong)] transition-colors touch-manipulation"
          data-testid="fab-add-task"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {/* ---------------- TASK ENTRY BOTTOM SHEET ---------------- */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add a task">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px] zuno-fade"
          />
          <div className="relative rounded-t-[28px] bg-[var(--space-surface-panel-strong)] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] max-h-[85vh] flex flex-col zuno-sheet">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className={`text-base font-bold ${typography.color.primary}`}>Add to today</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className={`w-8 h-8 rounded-full flex items-center justify-center ${tw.button.secondary}`}
                data-testid="button-close-sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* three clear paths */}
            <div className="px-5 pb-3">
              <div className="inline-flex rounded-full p-0.5 w-full bg-[var(--space-surface-muted)]" role="tablist" aria-label="Ways to add a task">
                {(
                  [
                    { id: 'oneliner', label: 'One-liner' },
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
                    className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
                      sheetMode === m.id
                        ? 'bg-[var(--space-surface-panel-strong)] shadow-sm text-[var(--space-text-brand)]'
                        : 'text-[var(--space-text-muted)]'
                    }`}
                    data-testid={`sheet-mode-${m.id}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {sheetMode === 'oneliner' && (
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${typography.color.primary}`} htmlFor="ol-input">
                    What are you studying today?
                  </label>
                  <textarea
                    id="ol-input"
                    value={olText}
                    onChange={(e) => setOlText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void submitOneLiner();
                      }
                    }}
                    rows={2}
                    placeholder="e.g. Organic chemistry reaction mechanisms practice"
                    className={`${tw.input.base} ${tw.input.default} !rounded-2xl text-base resize-none`}
                    autoFocus
                    data-testid="input-oneliner"
                  />
                  <p className={`text-[11px] mt-2 ${typography.color.muted}`}>
                    Type it in your own words — I'll work out the subject, topic and type silently.
                  </p>
                  <button
                    type="button"
                    disabled={!olText.trim() || addingTask}
                    onClick={() => void submitOneLiner()}
                    className={`mt-4 w-full py-3 rounded-full text-sm font-bold ${tw.button.accent} disabled:opacity-50 inline-flex items-center justify-center gap-2`}
                    data-testid="button-add-oneliner"
                  >
                    {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add task
                  </button>
                </div>
              )}

              {sheetMode === 'form' && (
                <div className="space-y-4">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ${typography.color.muted}`}>1 · Task type</p>
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
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            formType === taskType
                              ? 'bg-[var(--space-brand-primary)] text-[var(--space-text-on-primary)]'
                              : `${tw.bg.muted} ${typography.color.secondary} hover:brightness-95`
                          }`}
                          data-testid={`type-pill-${taskType}`}
                        >
                          {taskType}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${typography.color.muted}`}>2 · Subject</p>
                      {!formSubject && (
                        <span className={`text-[10px] ${typography.color.muted}`}>Auto-fills from a clear topic</span>
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
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            formSubject === name
                              ? 'bg-[var(--space-brand-primary)] text-[var(--space-text-on-primary)]'
                              : `${tw.bg.muted} ${typography.color.secondary} hover:brightness-95`
                          }`}
                          data-testid={`subject-pill-${name}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${typography.color.muted}`}>3 · Topic</p>
                      {formType !== 'Custom' && (
                        <select
                          value={formChapter}
                          onChange={(event) => setFormChapter(event.target.value)}
                          disabled={!formSubjectDef}
                          className="text-[11px] rounded-full border border-[var(--space-border-default)] bg-[var(--space-surface-card)] px-2 py-1 text-[var(--space-text-secondary)] max-w-[55%] disabled:opacity-50"
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
                            const inferred = inferSubjectForTopic(examDef, value);
                            setFormSubject(inferred);
                            setFormChapter('');
                          }}
                          placeholder="Describe exactly what you want to do — for example, ‘Make notes on Haloalkanes SN1 reactions’…"
                          rows={5}
                          autoFocus
                          className={`${tw.input.base} ${tw.input.default} !rounded-2xl !py-3 text-sm resize-y min-h-[120px]`}
                          data-testid="textarea-custom-task"
                        />
                        <p className={`text-[10px] ${formSubject ? typography.color.secondary : typography.color.muted}`}>
                          {formSubject
                            ? `Subject: ${formSubject}`
                            : 'If VicharakAI cannot identify one subject confidently, choose it above.'}
                        </p>
                        <button
                          type="button"
                          disabled={!formCustom.trim() || addingTask}
                          onClick={() => void submitFormTask(formCustom.trim())}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold ${tw.button.accent} disabled:opacity-50`}
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
                          className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm mb-2`}
                          data-testid="input-topic-search"
                        />
                        <ul className="divide-y divide-[var(--space-border-default)] rounded-2xl border border-[var(--space-border-default)] overflow-hidden max-h-56 overflow-y-auto">
                          {formTopics.slice(0, 100).map((topicEntry) => (
                            <li key={`${topicEntry.subject}|${topicEntry.chapter}|${topicEntry.topic}`}>
                              <button
                                type="button"
                                disabled={addingTask}
                                onClick={() => void submitFormTask(topicEntry.topic, topicEntry.subject)}
                                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[var(--space-surface-card)] hover:bg-[var(--space-surface-card-hover)] text-left transition-colors"
                                data-testid={`topic-option-${topicEntry.topic.slice(0, 24)}`}
                              >
                                <span className="min-w-0">
                                  <span className={`block text-xs font-medium truncate ${typography.color.primary}`}>{topicEntry.topic}</span>
                                  <span className={`block text-[10px] truncate ${typography.color.muted}`}>
                                    {topicEntry.subject} · {topicEntry.chapter}
                                  </span>
                                </span>
                                <Plus className={`w-3.5 h-3.5 flex-shrink-0 ${tw.icon.accent}`} />
                              </button>
                            </li>
                          ))}
                          {formTopics.length === 0 && (
                            <li className={`px-3.5 py-3 text-xs bg-[var(--space-surface-card)] ${typography.color.muted}`}>
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
                              const inferred = inferSubjectForTopic(examDef, value);
                              setFormSubject(inferred);
                              setFormChapter('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && formCustom.trim()) void submitFormTask(formCustom.trim());
                            }}
                            placeholder="Or type a granular topic…"
                            className={`${tw.input.base} ${tw.input.default} !rounded-xl !py-2 text-sm flex-1`}
                            data-testid="input-custom-topic"
                          />
                          <button
                            type="button"
                            disabled={!formCustom.trim() || addingTask}
                            onClick={() => void submitFormTask(formCustom.trim())}
                            className={`px-4 py-2 rounded-xl text-xs font-bold ${tw.button.accent} disabled:opacity-50 flex-shrink-0`}
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
                    <ZunoAvatar size="lg" />
                  </div>
                  {aiResult ? (
                    <>
                      <p className={`text-sm font-semibold px-2 ${typography.color.primary}`} data-testid="text-ai-result">
                        {aiResult}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        className={`mt-5 px-6 py-2.5 rounded-full text-sm font-bold ${tw.button.primary}`}
                        data-testid="button-ai-done"
                      >
                        Nice — done
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={`text-sm px-4 ${typography.color.secondary}`}>
                        I'll weigh your pace, weak areas and what's due for revision — then queue the smartest next task.
                      </p>
                      <button
                        type="button"
                        disabled={addingTask}
                        onClick={() => void submitAiTask()}
                        className={`mt-5 px-6 py-3 rounded-full text-sm font-bold ${tw.button.accent} disabled:opacity-60 inline-flex items-center justify-center gap-2`}
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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center zuno-fade bg-[linear-gradient(165deg,var(--space-brand-primary),var(--space-brand-highlight-900,var(--space-brand-highlight)))]"
          role="dialog"
          aria-modal="true"
          aria-label={`${milestoneStreak}-day streak milestone`}
          data-testid="overlay-streak-milestone"
        >
          <Flame className="w-12 h-12 text-[var(--space-text-on-highlight)] zuno-pop" />
          <p className="mt-3 text-6xl font-bold leading-none text-[var(--space-text-on-highlight)] zuno-rise">{milestoneStreak}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--space-text-on-highlight)] opacity-75">day streak</p>
          <p className="mt-6 max-w-xs text-base italic font-medium leading-relaxed text-[var(--space-text-on-highlight)] opacity-90 zuno-rise" style={{ animationDelay: '140ms' }}>
            “{streakMilestoneQuote(milestoneStreak)}”
          </p>
          <button
            type="button"
            onClick={() => setMilestoneStreak(null)}
            className="mt-9 px-6 py-2.5 rounded-full text-sm font-bold bg-[var(--space-text-on-highlight)] text-[var(--space-brand-highlight)] hover:opacity-90 transition-opacity"
            data-testid="button-dismiss-milestone"
          >
            Keep it going
          </button>
        </div>
      )}

      {/* ==================== BOTTOM NAV ==================== */}
      <ZunoBottomNav active={tab} onSelect={setTab} variant={tab === 'calendar' ? 'dark' : 'light'} />
    </div>
  );
}
