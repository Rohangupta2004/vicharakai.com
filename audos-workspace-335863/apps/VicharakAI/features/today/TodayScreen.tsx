/**
 * TodayScreen — the Today tab, kept deliberately SIMPLE: greeting, the task
 * checklist with its inline add box, due revisions and the doubt/question
 * decks. Analytics, weekly-plan detail, study tools and stat rails live on
 * their own tabs, so nothing here competes with see task → do task → done.
 */
/* eslint-disable */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
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
  Eye,
  Flag,
  Flame,
  GraduationCap,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Mail,
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
  Users,
  Wand2,
  X,
} from 'lucide-react';
import {
  addDaysISO,
  diffDays,
  estimatedMinutes,
  formatClock,
  formatDuration,
  pickLighterTask,
  topicKey,
  type StudyItem,
  type TaskFeeling,
  type TopicRating,
} from '../../engine';
import {
  AMBER,
  AMBER_BRIGHT,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  BRAND_GRADIENT_DEEP,
  CARD,
  CARD_SHADOW,
  CARD_SOFT,
  DANGER,
  GLASS_BG,
  HERO_SHADOW,
  NAVY,
  NAVY_ALT,
  ON_AMBER,
  ORANGE,
  OVERLAY_BG,
  PAGE_BG,
  RADIUS,
  SUCCESS,
  TASK_GRADIENT,
  REVISION_GRADIENT,
  DOUBT_GRADIENT,
  DOUBT_ACCENT,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  BRAND,
  GONE,
  GONE_WASH,
  INK,
  INK_SOFT,
  KEPT,
  PAPER,
  PAPER_SUNK,
  PENCIL,
  RULE,
  RULE_SOFT,
  SHEET,
  subjectColor,
  subjectTint,
  tint,
} from '../../theme';
import { Card, EmptyLine, SubjectDot, TaskBox, VicharakAvatar } from '../../ui';
import { AttachImageButton, ImageThumbStrip } from '../../Attachments';
import MarkdownText from '../../MarkdownText';
import { examLabelFromId, extractJsonObject } from '../../customExam';
import { AI_MODELS, OPENAI_PROXY_URL } from '../../config/models';
import { aiProxyHeaders } from '../../shared/platformAuth';
import { getSystemDate, getSystemNow } from '../../systemDate';
import { timeOfDayGreeting } from '../../shared/sessionUtils';
import {
  CATEGORY_EMOJI,
  cycleTaskCategory,
  resolveTaskCategory,
  writeLastCategory,
} from '../tasks/taskCategory';
import { planTodayRevisions, type TaskRevisionRow } from '../tasks/taskCards';
import { MCQ_LETTERS, flaggedConceptLabel, flaggedOptions, flaggedShortTitle, type FlaggedRow } from '../../mcq';
import { IS_IOS_NO_PUSH } from '../../shared/device';
import { handInputStyle } from '../../shared/styles';
import { readStartMode, spendStartNudge, startNudgeSpent } from '../onboarding/onboardingStorage';
import { VISIBLE_LATER_CAP } from '../tasks/taskTypes';
import { useApp } from '../../app/AppContext';
import {
  MOOD_META,
  moodTargetCount,
  moodVisibleCap,
  orderTasksForMood,
  requestMoodRecheck,
  useTodayMood,
} from './moodCheck';
import {
  buildVichareeTargets,
  markSeedPass,
  readSeededTargets,
  rememberSeededTargets,
  seedPassDone,
} from './vichareeTargets';

/** One face for the whole screen: the system sans stack, no handwriting. */
const TODAY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ---------- [Today] surfaces ----------
 * THEME-AWARE (2026-09-30): every value is a `--td-*` CSS variable theme.ts
 * owns — warm paper by day, deep navy by night — so this screen flips with
 * the sun/moon toggle like everything else. */
const TODAY_BG = 'var(--td-bg, #FCFBF8)';
/** The page itself — ambient light over the theme's page gradient. */
const TODAY_PAGE_BG = 'var(--td-page-bg)';
const TODAY_SURFACE = 'var(--td-surface, #FFFFFF)';
/** Every card sheet: a barely-there gradient instead of a flat fill. */
const TODAY_SURFACE_BG = 'var(--td-surface-bg)';
/** Paper grain, painted ONCE as a fixed overlay across the whole screen. */
const TODAY_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='vkn'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23vkn)'/%3E%3C/svg%3E\")";
/** The blue wash a rating chip picks up on hover — never a solid fill. */
const CHIP_HOVER_BG = 'var(--td-chip-hover-bg)';
const CHIP_HOVER_BORDER = 'var(--td-chip-hover-border, #8FB5FF)';
/** Filled primary actions use the electric brand blue; their text is white.
 * `--brand-action` stays #0057FF in BOTH themes — it is a fill colour. */
const ADD_BLUE = 'var(--brand-action, #0057FF)';
const BTN_PRIMARY_BG = ADD_BLUE;
const BTN_PRIMARY_SHADOW = '0 4px 12px rgba(0,87,255,.2)';
const ADD_BTN_BG = ADD_BLUE;
const ADD_BTN_SHADOW = '0 4px 12px rgba(0,87,255,.22)';
/** Sunk paper — progress tracks and the revision sub-rows inside a card. */
const TODAY_SUNK = 'var(--td-sunk, #F1EEE7)';
const TODAY_BORDER = 'var(--td-border, #E8E4DB)';
const TODAY_SHADOW = 'var(--td-shadow)';
/** A section panel sits a shade deeper than the cards it holds. */
const TODAY_PANEL_SHADOW = 'var(--td-panel-shadow)';
/** Readable electric-blue ink for links, outlines and compact labels —
 * `--brand` lifts to a lighter blue in dark mode so TEXT stays legible. */
const TODAY_BLUE = 'var(--brand, #0057FF)';
/** Completed work glows AMBER here. Nothing on this screen is ever green. */
const TODAY_AMBER = '#FFAA00';
/** Readable amber ink for text and outlines on the sheet. */
const TODAY_AMBER_INK = 'var(--td-amber-ink, #B07800)';

/* ---------- [Today] rating-chip grades ----------
 * One blue ladder, darkest for the answer that costs the most. A chip never
 * fills solid: the grade lives in the TEXT, the hover in a soft blue wash. */
const GRADE_AGAIN = 'var(--td-grade-again, #0039A8)';
const GRADE_HARD = 'var(--td-grade-hard, #0049D6)';
const GRADE_GOOD = TODAY_BLUE;
const GRADE_EASY = 'var(--td-grade-easy, #2E6FE8)';

/**
 * The four answers on a completed task, in FSRS order. On a REVISION the id
 * IS the rating (tasks.rateRevision): the topic rolls one step along the
 * 1→3→7→14→28 ladder — Again resets to day 1, Hard keeps the standard next
 * interval, Good lands a day sooner, Easy pushes it 1–2 days later (never
 * skipping the step). On a study task the mapped 3-value `feeling` is stored
 * as a prioritisation signal only.
 */
const RATING_CHOICES: ReadonlyArray<{
  id: TopicRating;
  label: string;
  feeling: TaskFeeling;
  hint: string;
}> = [
  { id: 'again', label: 'Again', feeling: 'hard', hint: "Didn't stick \u2014 back tomorrow" },
  { id: 'hard', label: 'Hard', feeling: 'hard', hint: 'A fight \u2014 keeps the standard next step' },
  { id: 'good', label: 'Good', feeling: 'medium', hint: 'Solid \u2014 back a day sooner so it sticks' },
  { id: 'easy', label: 'Easy', feeling: 'easy', hint: 'Owned it \u2014 pushed out a day or two' },
];

/* ---------- [Today] type scale — nothing here passes 18px ---------- */
const T_STAT = 18;
const T_HEAD = 13;
const T_TITLE = 14;
const T_BODY = 12;
const T_META = 11;

const FEED_TEXT = 'var(--td-text, #161F2B)';
const FEED_TEXT_DONE = 'var(--td-text-done, #999999)';
const FEED_MUTED = 'var(--td-muted, #6B7285)';
const FEED_FAINT = 'var(--td-faint, #A8ADBD)';
const FEED_ACCENT = TODAY_BLUE;
const FEED_ACCENT_SOFT = 'var(--td-grade-easy, #2E6FE8)';
const FEED_DONE = TODAY_AMBER;
/** Overdue reads deep blue here — this screen keeps red for nothing. */
const FEED_OVERDUE = 'var(--td-overdue, #0039A8)';
const FEED_OVERDUE_WASH = 'var(--td-overdue-wash, rgba(14,42,99,0.06))';
const FEED_ROW_BG = TODAY_SUNK;
const FEED_HAIRLINE = TODAY_BORDER;
const FEED_INPUT_BG = TODAY_SURFACE;
const FEED_INPUT_BORDER = `1px solid ${TODAY_BORDER}`;
/** Section labels: 13px, sentence case, 8px of air underneath. */
const FEED_LABEL_STYLE: CSSProperties = {
  fontSize: T_HEAD,
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: 'none',
  color: FEED_MUTED,
  marginBottom: 8,
};

/** [PERF] The Blank Recall clock ticks inside ITS OWN tiny component — the
 * old once-a-second tick re-rendered the entire Today screen while recall
 * was open. Behaviour is identical: elapsed time since `startedAt`. */
const RecallClock = memo(function RecallClock({ startedAt }: { startedAt: number | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <>{formatClock(startedAt ? Date.now() - startedAt : 0)}</>;
});

/* ------------------------------------------------------------------ */
/*  [Deck] Question Revision — a casual, swipeable card deck            */
/* ------------------------------------------------------------------ */

/** Releasing a horizontal drag past this many pixels commits the swipe. */
const QDECK_COMMIT_PX = 90;
/** How long a swiped card takes to fly out before the next one rises. */
const QDECK_LEAVE_MS = 300;

/** Deck styling: soft rounded cards, the next 1–2 peeking out behind the
 * live card, and a springy (never stiff) rise as a new card takes the front. */
const QDECK_CSS = `
.vk-qdeck { position: relative; touch-action: pan-y; }
.vk-qdeck-sheet { position: absolute; inset: 0; background: ${TODAY_SURFACE}; border: 1px solid ${TODAY_BORDER}; border-radius: 16px; box-shadow: ${TODAY_SHADOW}; pointer-events: none; }
.vk-qdeck-card { position: relative; z-index: 2; background: ${TODAY_SURFACE_BG}; border: 1px solid ${TODAY_BORDER}; border-radius: 16px; box-shadow: 0 12px 26px rgba(22,31,43,.13), 0 2px 6px rgba(22,31,43,.07); transform: rotate(-0.8deg); user-select: none; -webkit-user-select: none; cursor: grab; }
.vk-qdeck-card:active { cursor: grabbing; }
.vk-qdeck-enter { animation: vkQdeckIn 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes vkQdeckIn { from { opacity: 0.4; transform: translateY(12px) scale(0.965) rotate(1.2deg); } to { opacity: 1; transform: rotate(-0.8deg); } }
.vk-qdeck-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border-radius: 999px; font-size: 12px; font-weight: 700; transition: transform 0.12s ease, filter 0.15s ease; }
.vk-qdeck-btn:not(:disabled):hover { filter: brightness(1.04); }
.vk-qdeck-btn:not(:disabled):active { transform: scale(0.96); }
.vk-qdeck-btn:disabled { opacity: 0.55; }
`;

/** "12 Aug" for the why-line — tolerant of odd stored dates. */
function deckDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Why this card is in front of the student — one small, friendly line. */
function deckWhyLine(row: FlaggedRow): string {
  const from = String(row.source_label ?? '').trim();
  if (from) return `You got this type wrong in ${from}`;
  if (row.source_type === 'quiz') return 'You answered this one wrong in a practice test';
  const when = deckDate(row.created_on);
  if (row.source_type === 'photo') return when ? `You snapped this mistake on ${when}` : 'You snapped this mistake';
  return when ? `You saved this on ${when} — due for a quick recall` : 'Due for a quick recall today';
}

/**
 * One card at a time, the rest waiting quietly behind it. Swipe left = Again
 * (it lapsed — back in about ten minutes), swipe right = Got it (the FSRS
 * scheduler spaces it out); the same responses sit underneath as buttons, so
 * swiping is never required. Tapping the card expands the full question, and
 * Explain writes a short AI explanation onto the card without grading it.
 * Every review still funnels through the ONE scheduler (doubts.gradeFlagged).
 */
function QuestionRevisionDeck({
  rows,
  saving,
  canAskAi,
  onGrade,
  onExplainBlocked,
  onAiCharged,
  onPersistExplanation,
}: {
  /** Today's due questions, in scheduler order. */
  rows: FlaggedRow[];
  /** True while a grade write is in flight (spinner only — writes queue). */
  saving: boolean;
  canAskAi: boolean;
  /** Commits one review through the FSRS scheduler (doubts.gradeFlagged).
   * Resolving false means the write failed — the deck restores the card. */
  onGrade: (row: FlaggedRow, grade: 'again' | 'good') => void | Promise<boolean>;
  /** Explain without AI access opens the paywall, like the review popup. */
  onExplainBlocked: () => void;
  onAiCharged: () => void;
  /** Saves a fetched AI explanation onto the row (best-effort). */
  onPersistExplanation?: (row: FlaggedRow, text: string) => void;
}) {
  /* Cards this visit has already graded — hidden locally once their write
   * has COMMITTED, so the deck never runs ahead of the database. */
  const [swipedIds, setSwipedIds] = useState<Set<number>>(() => new Set());
  const [reviewed, setReviewed] = useState(0);
  const [leaving, setLeaving] = useState<{ id: number; dir: 'left' | 'right' } | null>(null);
  /* A grade write is in flight for the live card: it stays put, under the
   * Got it spinner, until the write resolves either way. */
  const [committing, setCommitting] = useState(false);
  /* Tapping the live card toggles the full question open. */
  const [expanded, setExpanded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  /* Explain — the same short AI explanation the review popup writes, shown
   * inline on the card. It never grades. */
  const [explainId, setExplainId] = useState<number | null>(null);
  const [explainText, setExplainText] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);

  const queue = rows.filter((row) => !swipedIds.has(row.id));
  const card = queue[0] ?? null;
  const total = reviewed + queue.length;

  /**
   * THE DECK WAITS FOR THE WRITE.
   *
   * It used to fly the card out immediately and let the save land behind it,
   * pulling the card back on failure. That made a failed response look like
   * a saved one for a third of a second, and on a slow or refused write the
   * student had already answered the next card before the toast appeared.
   * Now the card holds its place under the Got it spinner until gradeFlagged
   * resolves — it owns the toast, the FSRS write and its one automatic
   * retry. Only a COMMITTED write flies the card out and brings up the next
   * one; a write that failed leaves the card exactly where it is, still due.
   */
  const commit = (dir: 'left' | 'right') => {
    if (!card || leaving || committing) return;
    const row = card;
    setCommitting(true);
    setDragging(false);
    setDragX(0);
    setExpanded(false);
    setExplainId(null);
    setExplainText('');
    void (async () => {
      const saved = await Promise.resolve(onGrade(row, dir === 'right' ? 'good' : 'again'));
      setCommitting(false);
      if (saved === false) return; // stays at the head of the deck, still due
      setLeaving({ id: row.id, dir });
      window.setTimeout(() => {
        setLeaving(null);
        setSwipedIds((prev) => new Set(prev).add(row.id));
        setReviewed((n) => n + 1);
      }, QDECK_LEAVE_MS);
    })();
  };

  /* ---------- swipe — vertical scrolling always wins ----------
   * Pointer events where the browser has them (they cover touch AND mouse);
   * raw touch events step in ONLY on browsers without PointerEvent, so the
   * two paths never both fire for one gesture. */
  const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
  const dragBegin = (x: number, y: number) => {
    if (!card || leaving || committing) return;
    dragStart.current = { x, y };
    movedRef.current = false;
  };
  const dragMove = (x: number, y: number) => {
    const start = dragStart.current;
    if (!start || leaving || committing) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (!movedRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragStart.current = null; // a scroll, not a swipe
        return;
      }
      movedRef.current = true;
      setDragging(true);
    }
    setDragX(dx);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragBegin(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragMove(event.clientX, event.clientY);
  };
  const onTouchStart = supportsPointer
    ? undefined
    : (event: ReactTouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (touch) dragBegin(touch.clientX, touch.clientY);
      };
  const onTouchMove = supportsPointer
    ? undefined
    : (event: ReactTouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (touch) dragMove(touch.clientX, touch.clientY);
      };
  const endDrag = () => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || leaving || committing) return;
    if (movedRef.current) {
      setDragging(false);
      if (dragX > QDECK_COMMIT_PX) commit('right');
      else if (dragX < -QDECK_COMMIT_PX) commit('left');
      else setDragX(0);
    } else {
      // A clean tap — expand / collapse the full question.
      setExpanded((v) => !v);
    }
  };
  const onPointerCancel = () => {
    dragStart.current = null;
    setDragging(false);
    setDragX(0);
  };
  const onTouchEnd = supportsPointer ? undefined : () => endDrag();
  const onTouchCancel = supportsPointer ? undefined : () => onPointerCancel();

  /* Explain — plain prose onto the card; the student still grades it. */
  const explain = async (row: FlaggedRow) => {
    if (explainId === row.id) {
      setExplainId(null);
      return;
    }
    /* An explanation saved on a previous visit shows instantly — free. */
    const stored = String(row.ai_explanation ?? '').trim();
    if (stored) {
      setExpanded(true);
      setExplainId(row.id);
      setExplainText(stored);
      setExplainLoading(false);
      return;
    }
    if (!canAskAi) {
      onExplainBlocked();
      return;
    }
    setExpanded(true);
    setExplainId(row.id);
    setExplainText('');
    setExplainLoading(true);
    try {
      const options = flaggedOptions(row);
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: AI_MODELS.standard,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content:
                'You explain exam questions to Indian competitive-exam aspirants. Reply in PLAIN PROSE only — no ' +
                'markdown, no headings, no bullet characters, no bold. Under 110 words: state the correct answer, ' +
                'the one principle it turns on, and the trap that catches most students.',
            },
            {
              role: 'user',
              content:
                `Concept: ${flaggedConceptLabel(row)}. Subject: ${row.subject || 'this exam'}.` +
                `\nQuestion: ${row.question_text.slice(0, 900)}` +
                (options ? `\nOptions: ${options.join(' | ')}` : ''),
            },
          ],
          max_completion_tokens: 420,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const text = String(payload.choices?.[0]?.message?.content || '').trim();
      onAiCharged();
      setExplainText(text || "Nothing came back this time — check your own notes for this one.");
      /* PERSIST the explanation onto the row — the next Explain is free. */
      if (text) onPersistExplanation?.(row, text);
    } catch {
      setExplainText("That explanation didn't come through — mind tapping Explain once more?");
    } finally {
      setExplainLoading(false);
    }
  };

  if (!card) {
    return (
      <p className="px-1.5 leading-relaxed vicharak-fade" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-question-deck-done">
        Deck cleared — every question due today is reviewed. New ones surface as they come due.
      </p>
    );
  }

  const leaveDir = leaving && leaving.id === card.id ? leaving.dir : null;
  const cardStyle: CSSProperties = leaveDir
    ? {
        transform: `translateX(${leaveDir === 'right' ? '115%' : '-115%'}) rotate(${leaveDir === 'right' ? 10 : -10}deg)`,
        opacity: 0,
        transition: `transform ${QDECK_LEAVE_MS}ms ease-in-out, opacity ${QDECK_LEAVE_MS}ms ease-in-out`,
      }
    : {
        transform: dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX / 18}deg)` : undefined,
        transition: dragging ? 'none' : 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      };
  const options = expanded ? flaggedOptions(card) : null;
  const hasFullText = (card.question_text ?? '').trim() !== '';

  return (
    <div data-testid="question-revision-deck">
      <style>{QDECK_CSS}</style>
      {/* Progress — subtle, never a pressure gauge. */}
      <p className="px-1 pb-1.5 tabular-nums" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-question-deck-progress">
        {Math.min(reviewed + 1, total)} / {total}
      </p>
      <div className="vk-qdeck" style={{ paddingBottom: queue.length > 2 ? 18 : queue.length > 1 ? 10 : 2 }}>
        {/* The next 1–2 cards peeking out behind the live one — a soft pile,
            not a rigid stack. */}
        {queue.length > 2 && (
          <span className="vk-qdeck-sheet" style={{ transform: 'translateY(16px) scale(0.94) rotate(2.1deg)', opacity: 0.5, zIndex: 0 }} aria-hidden="true" />
        )}
        {queue.length > 1 && (
          <span className="vk-qdeck-sheet" style={{ transform: 'translateY(8px) scale(0.97) rotate(-1.6deg)', opacity: 0.85, zIndex: 1 }} aria-hidden="true" />
        )}
        <div
          key={card.id}
          role="button"
          tabIndex={0}
          className="vk-qdeck-card vk-qdeck-enter touch-manipulation"
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={onPointerCancel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse this question' : 'Expand this question'}
          data-testid={`question-deck-card-${card.id}`}
        >
          {/* Drag verdicts — they fade in with the pull. */}
          {dragX > 14 && (
            <span
              className="absolute top-3 left-3 z-10 px-2.5 py-1"
              style={{ borderRadius: 999, background: tint(TODAY_BLUE, 0.14), border: `1px solid ${tint(TODAY_BLUE, 0.4)}`, color: TODAY_BLUE, fontSize: 10, fontWeight: 800, opacity: Math.min(1, dragX / QDECK_COMMIT_PX) }}
              aria-hidden="true"
            >
              Got it
            </span>
          )}
          {dragX < -14 && (
            <span
              className="absolute top-3 right-3 z-10 px-2.5 py-1"
              style={{ borderRadius: 999, background: FEED_OVERDUE_WASH, border: `1px solid ${tint(FEED_OVERDUE, 0.3)}`, color: FEED_OVERDUE, fontSize: 10, fontWeight: 800, opacity: Math.min(1, -dragX / QDECK_COMMIT_PX) }}
              aria-hidden="true"
            >
              Again
            </span>
          )}
          <div className="px-4 pt-3.5 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: T_META, fontWeight: 600, color: subjectColor(card.subject || 'General') }}>
                <SubjectDot subject={card.subject || 'General'} size={5} />
                {card.subject || 'General'}
              </span>
              <span className="flex-1" aria-hidden="true" />
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-300 ease-out"
                style={{ color: FEED_FAINT, transform: expanded ? 'rotate(180deg)' : undefined }}
                aria-hidden="true"
              />
            </div>
            {card.image_url && (
              <img
                src={card.image_url}
                alt="Question"
                draggable={false}
                className={expanded ? 'mt-2.5 max-h-56 mx-auto object-contain' : 'mt-2.5 w-14 h-14 object-cover'}
                style={{ borderRadius: 10, border: `1px solid ${TODAY_BORDER}`, pointerEvents: 'none' }}
              />
            )}
            {expanded && hasFullText ? (
              <p className="mt-2 whitespace-pre-wrap" style={{ fontSize: T_TITLE, lineHeight: 1.5, fontWeight: 500, color: FEED_TEXT }} data-testid="text-question-deck-full">
                {card.question_text}
              </p>
            ) : (
              <p className="mt-2 leading-snug" style={{ fontSize: T_TITLE, fontWeight: 600, color: FEED_TEXT }} data-testid="text-question-deck-title">
                {flaggedShortTitle(card)}
              </p>
            )}
            {options && (
              <ul className="mt-2 space-y-1" data-testid="question-deck-options">
                {options.map((option, index) => (
                  <li key={MCQ_LETTERS[index]} className="flex gap-2" style={{ fontSize: T_BODY, lineHeight: 1.45, color: FEED_MUTED }}>
                    <span style={{ fontWeight: 700 }}>{MCQ_LETTERS[index]}.</span>
                    <span className="min-w-0 flex-1">{option}</span>
                  </li>
                ))}
              </ul>
            )}
            {!expanded && (hasFullText || card.image_url) && (
              <p className="mt-1" style={{ fontSize: T_META, color: FEED_FAINT }}>
                Tap the card to see the whole question
              </p>
            )}
            {/* Why you're seeing this — small, muted, on every card. */}
            <p className="mt-2.5" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-question-deck-why">
              {deckWhyLine(card)}
            </p>
            {explainId === card.id && (
              <div
                className="mt-2.5 px-3 py-2.5 whitespace-pre-wrap vicharak-fade"
                style={{ borderRadius: 10, background: TODAY_SUNK, fontSize: T_BODY, lineHeight: 1.55, color: FEED_TEXT }}
                data-testid="text-question-deck-explain"
              >
                {explainLoading ? (
                  <span className="inline-flex items-center gap-2" style={{ color: FEED_MUTED }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Working through it…
                  </span>
                ) : (
                  explainText
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* The same three responses as buttons — swiping is never required. */}
      <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-label="How did this one go?">
        <button
          type="button"
          disabled={leaving !== null || committing}
          onClick={() => commit('left')}
          className="vk-qdeck-btn touch-manipulation"
          style={{ background: TODAY_SUNK, border: `1px solid ${TODAY_BORDER}`, color: FEED_MUTED }}
          data-testid="button-question-deck-again"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Again
        </button>
        <button
          type="button"
          disabled={leaving !== null || committing}
          onClick={() => commit('right')}
          className="vk-qdeck-btn touch-manipulation"
          style={{ background: ADD_BTN_BG, boxShadow: ADD_BTN_SHADOW, border: '1px solid transparent', color: '#FFFFFF' }}
          data-testid="button-question-deck-got"
        >
          {committing || saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
          Got it
        </button>
        <button
          type="button"
          disabled={leaving !== null || committing}
          onClick={() => void explain(card)}
          aria-expanded={explainId === card.id}
          className="vk-qdeck-btn touch-manipulation"
          style={{ background: 'transparent', border: `1px dashed ${tint(TODAY_BLUE, 0.5)}`, color: TODAY_BLUE }}
          data-testid="button-question-deck-explain"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          Explain
        </button>
      </div>
      <p className="mt-1.5 text-center" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-question-deck-hint">
        Swipe right for Got it · swipe left for Again
      </p>
    </div>
  );
}

export default function TodayScreen() {
  const { data, toast, access, plan, tasks, syllabus, doubts, tests, notifications, settings, setTab } = useApp();
  const {
    spaceId, today, day, profile, examDef, savedExamLabel, examDate, examDateSet, daysToExam,
    studentItems, annotations, metaMap, streak, studentName, missionQueue, mainPending,
    carriedPending, relatedCarryover, carryOver, dueRevisions, dueRevisionsAll, queuedRevisionCount,
    overdueRevisions, doneToday, formula, taskDetails, weekDays, weekStart, completedByDate,
    dueFlagged, flaggedRows, resolveQueue, metrics, aiFocusChips, weeklyRow, weeklyTopicsDone, weeklyTestsDone, doneTopicKeys,
    attachmentsBySourceKey, quickAddSubjects, filterSubjects, todayMinutes, pace,
    weakTopicInsights, readiness, activeSyllabusExam, itemsQ, dbSessionReady, dailyGoal, testResults, upsertMeta,
  } = data;
  const { showToast } = toast;
  const { accessStatus, access: aiAccess, openPaywall, chargeAi } = access;
  const { dailyPlan, nowPick, nowSuggestion, onTrack } = plan;
  const {
    addTask, busyIds, startedIds, markStarted, clearStarted, completingIds,
    handleToggle, completeWithAnimation, renameTask, applyImplicitFeeling,
    decideCarryover, carryoverBusy, pinHero, togglePriority, removeRevision,
    deleteCarriedTask, openTaskSheet, quickTitle, setQuickTitle, quickSubject, setQuickSubject,
    submitQuickTitle, parsePlanText, planDrafts, setPlanDrafts, parsingPlan, savingPlan,
    confirmPlanDrafts, addingTask, openTaskEditor, promptForDuration, promptForStudyTime,
    setAddTaskOpen, setSyllabusPickerOpen, backfillStudiedTopics, setTopicPickerFor, markToolsDifficulty, savingToolsFeeling, deleteTask,
    setFeedbackPrompt, saveFeeling, savingFeeling, feedbackPrompt, setDurationPrompt,
    answerFeelingInline, rateRevision, savingRating,
    setFocusOpen, quickCategory, setQuickCategory,
  } = tasks;
  const { setFlagOpen, setFlaggedDetail, saveQuickDoubt, gradeFlagged, savingFlaggedDetail, updateDoubt } = doubts;
  const { setFlaggedTestOpen, openTargetsScreen, setQuizTarget, attachImageToTask, removeTaskAttachment, attachBusy, setLightboxUrl, setGenerateTestOpen, setGenerateTestError, setTestSetupOpen, setPhotoTasksOpen } = tests;
  const { studyWeakTopicNow, insightsAdding, setSyllabusBrowserOpen } = syllabus;
  const { notificationsOn, notifBannerDismissed, dismissNotifBanner, enableNotifications } = notifications;
  const { setShowTimeMachine, weekMilestoneOpen, dismissWeekMilestone } = settings;
  const { removeFlagged } = doubts;

  /* ---------- Today-screen local UI state (was app-level; resets on tab
   * change automatically now that the screen unmounts) ---------- */
  const [showAllLater, setShowAllLater] = useState(false);
  /* Which row has had its "why it came back" strip opened by hand, on a day
   * busy enough that the strips start collapsed. */
  const [whyOpenId, setWhyOpenId] = useState<number | null>(null);
  /* [Start fresh] The one suggestion a student who chose "start fresh" gets.
   * It is a suggestion, not a task: nothing is written until they tap it,
   * and tapping OR dismissing retires it for good. */
  const [startNudgeDone, setStartNudgeDone] = useState(() => startNudgeSpent(spaceId));
  const startedFresh = useMemo(() => readStartMode(spaceId) === 'fresh', [spaceId]);
  /* The quick-add field, so submitting can hand focus straight back to it. */
  const inlineAddRef = useRef<HTMLInputElement | null>(null);
  /* PERF: the inline add draft is LOCAL state — each keystroke re-renders
   * only this screen, never the whole app shell. The text is handed to
   * submitQuickTitle explicitly on save. */
  const [inlineDraft, setInlineDraft] = useState('');
  /* [V2 Mood check] Vicharee's opening question shapes today's plate:
   * energetic = a bigger slice with the hardest ground first, down = a light
   * 2-item day (easiest win first) with revision leading, regular = the
   * standard plan. The header chip re-asks the question at any time. */
  const mood = useTodayMood(spaceId, today);
  const moodMeta = mood ? MOOD_META[mood] : null;
  /* [V2 Chat-first targets] Vicharee's plan is the day's primary source —
   * the typed add box now waits behind one small "Add manually" link. */
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const seedPassBusyRef = useRef(false);

  /* [Completion moment] A brief checkmark-and-confetti burst with the day's
   * real summary, fired each time a task lands in Completed. Pure CSS, gone
   * in ~1.8s, and it never blocks a tap (pointer-events: none). */
  const [celebration, setCelebration] = useState<{ topics: number } | null>(null);
  const prevDoneCountRef = useRef(doneToday.length);
  useEffect(() => {
    const prev = prevDoneCountRef.current;
    prevDoneCountRef.current = doneToday.length;
    if (doneToday.length > prev && doneToday.length > 0) {
      setCelebration({ topics: doneToday.length });
      const timer = window.setTimeout(() => setCelebration(null), 1900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [doneToday.length]);

  /* [Empty state] The optional, skippable first-run question — "What have
   * you studied in the last two weeks?" Student input only; the app never
   * guesses. Answered or skipped once, it never reappears. */
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDraft, setBackfillDraft] = useState('');
  const [savingBackfill, setSavingBackfill] = useState(false);
  const [backfillDone, setBackfillDone] = useState(() => {
    try {
      return localStorage.getItem(`vicharak_backfill_done_${spaceId}`) === '1';
    } catch {
      return false;
    }
  });
  const finishBackfill = () => {
    setBackfillDone(true);
    setBackfillOpen(false);
    try {
      localStorage.setItem(`vicharak_backfill_done_${spaceId}`, '1');
    } catch {
      /* the question may reappear next visit — harmless */
    }
  };
  const submitBackfill = async () => {
    if (savingBackfill) return;
    const text = (backfillDraft ?? '').trim();
    if (!text) {
      finishBackfill();
      return;
    }
    setSavingBackfill(true);
    try {
      const added = await backfillStudiedTopics(text);
      showToast(added > 0 ? 'Noted — revision on those starts tomorrow.' : 'Those are already on your plan.');
      finishBackfill();
    } catch {
      showToast("That didn't save — mind trying once more?");
    } finally {
      setSavingBackfill(false);
    }
  };

  /* One radius, everywhere. Pills are the only exception in the system. */
  const ROW_RADIUS = 3;
  const CHECK_RADIUS = 3;
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [lowMode, setLowMode] = useState(false);
  const [fromYesterdayOpen, setFromYesterdayOpen] = useState(false);
  /* [Compact Today] No "Show more / Show less" controls anywhere on this
   * screen — every list renders in full and the compact cards keep it dense. */
  /* A spaced revision is NEVER its own entry in the list. This decides which
   * task card owns each pending revision, and builds a parent card for a due
   * revision whose topic has nothing else on Today. */
  /* PERF: memoized — this walks every pending revision and student item, so
   * it must not rerun on unrelated re-renders (typing, toasts, timers). */
  const revisionPlan = useMemo(
    () =>
      planTodayRevisions({
        mainPending,
        carriedPending,
        doneToday,
        dueRevisions,
        studentItems,
        today,
        weakTopics: weakTopicInsights,
        testResults,
        daysToExam,
      }),
    [mainPending, carriedPending, doneToday, dueRevisions, studentItems, today, weakTopicInsights, testResults, daysToExam],
  );
  /* More than about four revisions is a heavy day: the why-strips collapse to
   * the overdue ones so the list still reads as a list, not an explanation. */
  const heavyRevisionDay = dueRevisions.length > 4;

  /* [V2] item.id → the engine's own evidence for putting it on today's plate
   * ("revision overdue by 2 days", "recent test accuracy 42%", "flagged weak
   * — …"). Only evidence-based reasons qualify: a task that is merely
   * "planned for today" (usually the student's own entry) never carries a
   * "Suggested by Vicharee" line just for existing. */
  const vichareeReasonById = useMemo(() => {
    const map = new Map<number, string>();
    const entries = [...dailyPlan.mustDo, ...dailyPlan.shouldDo, ...dailyPlan.ifTime, ...dailyPlan.deferred];
    for (const entry of entries) {
      const evidence = entry.reasons.find(
        (reason) => !reason.startsWith('planned for today') && !reason.startsWith('carried over'),
      );
      if (evidence) map.set(entry.item.id, evidence);
    }
    return map;
  }, [dailyPlan]);

  /* The revision sub-rows that live INSIDE a task card:
   *   ↺  Day-3 pass · Why: Studied 3 days ago — spaced review
   * A due or overdue row reads bolder and carries an accent dot; the card's
   * own colour never changes. Tapping a due row completes it inline. */
  /** The bold half of the why-strip: how late this is, or which pass it is. */
  const whyPhrase = (row: TaskRevisionRow): string => {
    if (row.overdue) return 'Due today';
    if (row.due) {
      const pass = Number(row.item.interval_days);
      return Number.isFinite(pass) && pass > 0 ? `Day-${pass} pass` : 'Due today';
    }
    return `Back ${row.dueLabel.toLowerCase()}`;
  };

  /**
   * Why a revision-due card is back, in one short line: how late it is (or
   * simply that it is due) and when the topic was last studied. This is a
   * LABEL — the card's own checkbox is what completes the revision.
   */
  const revisionNote = (row: TaskRevisionRow): string => {
    const studied = (row.item.studied_on || '').slice(0, 10);
    const ago = studied ? Math.max(0, diffDays(studied, today)) : null;
    const studiedText =
      ago === null ? '' : ago === 0 ? 'studied today' : ago === 1 ? 'studied yesterday' : `studied ${ago} days ago`;
    const head = 'Due for revision';
    return studiedText ? `${head} \u00B7 ${studiedText}` : head;
  };

  /* [Completion] A TICK ALONE NEVER FINISHES A TASK. Tapping a row checks
   * its box and opens the "How did that go?" chips IN PLACE on that card —
   * the card does not move, nothing is written, and no sheet opens. Choosing
   * Again/Hard/Good/Easy is what completes it and settles it into Completed.
   * These are the ids that have been ticked and are waiting on their answer. */
  const [awaitingRating, setAwaitingRating] = useState<Set<number>>(new Set());
  const toggleTick = (id: number) =>
    setAwaitingRating((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearTick = (id: number) =>
    setAwaitingRating((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  /* A rating tapped on a STILL-PENDING card has to wait its turn: a topic's
   * revision rows are only written when the task is completed, so answering
   * first would realign nothing and the ladder would stay on its default.
   * The answer is parked here and written the moment the row comes back as
   * done — which is also when the card lands in Completed. */
  const queuedRatings = useRef(new Map<number, { rating: TopicRating; feeling: TaskFeeling }>());
  useEffect(() => {
    if (queuedRatings.current.size === 0 || savingFeeling || savingRating) return;
    for (const [id, choice] of queuedRatings.current) {
      const row = studentItems.find((item) => item.id === id);
      if (!row) continue;
      if (row.status !== 'done') continue;
      queuedRatings.current.delete(id);
      /* A revision's answer IS its rating — it rolls the topic one ladder
         step (Again 1 · Hard standard · Good −1 day · Easy +1–2 days). A
         study task's answer stays a prioritisation signal. */
      if (row.kind === 'revision') void rateRevision(row, choice.rating);
      else void answerFeelingInline(row, choice.feeling);
      return;
    }
  }, [studentItems, savingFeeling, savingRating]);

  /**
   * "How did that go?" — Again · Hard · Good · Easy, ON the card and expanded
   * directly under the task row. Never a popup, never a bottom sheet, never
   * a tap away: this is the whole rating surface, and on a pending task it is
   * also the ONLY way to finish it — the tick opens these chips, the chosen
   * chip completes the task and moves the card into Completed.
   */
  const renderRatingRow = (row: StudyItem) => {
    const key = row.source_key || topicKey(row.subject, row.topic);
    const pending = row.status === 'pending';
    /* PENDING: the chips only appear once the row has been TICKED. The tick
       asks the question; these chips are the answer that finishes it. */
    if (pending && !awaitingRating.has(row.id)) return null;
    /* DONE: a topic that already has its answer needs no row — the question
       was asked and answered. */
    if (!pending && (feelingByKey.get(key) || queuedRatings.current.has(row.id))) return null;
    const locked = savingFeeling || savingRating || busyIds.has(row.id) || completingIds.has(row.id);
    /* [Contextual prompt] A revision reads its stored history back: the
       previous rating (per topic per student) frames the question; a
       first-time rating asks plainly. Study tasks keep the classic ask. */
    const lastLabel = row.kind === 'revision' ? lastRatingLabelByKey.get(key) ?? null : null;
    const ask =
      row.kind !== 'revision'
        ? 'How did that go?'
        : lastLabel
          ? `Last time you rated this ${lastLabel} — how do you feel now?`
          : 'How did this feel?';
    return (
      <div className="vk-rate" data-testid={`task-rate-${row.id}`}>
        <span className="vk-rate-ask">{ask}</span>
        {RATING_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={locked}
            onClick={(event) => {
              event.stopPropagation();
              if (pending) {
                queuedRatings.current.set(row.id, { rating: choice.id, feeling: choice.feeling });
                clearTick(row.id);
                completeWithAnimation(row, { skipFeedbackPrompt: true });
              } else if (row.kind === 'revision') {
                void rateRevision(row, choice.id);
              } else {
                void answerFeelingInline(row, choice.feeling);
              }
            }}
            title={choice.hint}
            className={`vk-rate-chip vk-rate-${choice.id} touch-manipulation`}
            data-testid={`button-rate-${choice.id}-${row.id}`}
          >
            {choice.label}
          </button>
        ))}
        {/* Said plainly, because the tick on its own deliberately does
            nothing until one of these is chosen. */}
        {pending && <span className="vk-rate-need">Pick one to finish</span>}
      </div>
    );
  };

  const renderRevisionRows = (
    rows: TaskRevisionRow[] | undefined,
    options?: { readOnly?: boolean; collapsed?: boolean },
  ) => {
    if (!rows || rows.length === 0) return null;
    /* Heavy revision day: only the overdue strips stay open. The rest wait
       behind the row's own "Why?" tap, so a normal day never reads as a wall
       of explanations. */
    if (options?.collapsed && !rows.some((row) => row.overdue)) return null;
    return (
      <span className="flex flex-col gap-1" style={{ marginLeft: 29, marginTop: '0.32rem' }}>
        {rows.map((row) => {
          const busy = busyIds.has(row.item.id);
          const completing = completingIds.has(row.item.id);
          /* Read-only lists still let a DUE revision be ticked off — only the
             not-yet-due preview rows are inert. */
          const inert = options?.readOnly === true && !row.due;
          const body = (
            <>
              <span className="flex items-center flex-shrink-0" aria-hidden="true">
                {busy || completing ? (
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: FEED_MUTED }} />
                ) : (
                  <RotateCcw className="w-3 h-3" style={{ color: FEED_MUTED }} />
                )}
              </span>
              <span
                className={`min-w-0 flex-1 leading-snug ${completing ? 'line-through' : ''}`}
                style={{ fontSize: T_META, fontWeight: 400, color: FEED_MUTED }}
              >
                <span style={{ fontWeight: 600, color: FEED_TEXT }}>{whyPhrase(row)}</span>
                {' · Why: '}
                {row.reason}
              </span>
            </>
          );
          if (inert) {
            return (
              <span
                key={`rev-row-${row.item.id}`}
                className="flex items-center gap-1.5 px-2 py-1"
                style={{ borderRadius: 8, background: FEED_ROW_BG }}
                data-testid={`task-revision-${row.item.id}`}
              >
                {body}
              </span>
            );
          }
          return (
            <button
              key={`rev-row-${row.item.id}`}
              type="button"
              disabled={busy || completing}
              onClick={(event) => {
                event.stopPropagation();
                completeWithAnimation(row.item);
              }}
              aria-label={`Mark the revision of “${row.item.topic}” done`}
              title="Tap to mark this revision done"
              className="w-full flex items-center gap-1.5 px-2 text-left touch-manipulation disabled:opacity-60"
              style={{
                minHeight: 36,
                paddingTop: 5,
                paddingBottom: 5,
                borderRadius: 8,
                background: FEED_ROW_BG,
              }}
              data-testid={`task-revision-${row.item.id}`}
            >
              {body}
            </button>
          );
        })}
      </span>
    );
  };

  /**
   * ONE task = ONE ROW inside the day's single panel. The title is the
   * student's own words, so it is set in the handwriting face; everything
   * else on the row is the app talking. Tapping ANYWHERE on the row TICKS it
   * and opens the rating chips in place — the chosen chip is what finishes
   * it. The pencil is a separate button pinned top-right, outside that
   * target, which is what the row's right padding clears.
   *
   * `readOnlyHead` renders the parent topic of a due revision: the head is
   * already studied, so it shows a settled tick and the why-strip beneath it
   * is the thing the student taps.
   */
  const renderTaskCard = (
    item: StudyItem,
    options?: {
      hideSubject?: boolean;
      readOnlyHead?: boolean;
      revisions?: TaskRevisionRow[];
      testId?: string;
      /** Heavy revision day — hold the why-strip behind a "Why?" tap. */
      collapseWhy?: boolean;
    },
  ) => {
    const revisions = options?.revisions ?? revisionPlan.byItemId.get(item.id);
    /* The revision this card is waiting on — the earliest rung that is due
       or already late. */
    const dueRevision = (revisions ?? []).find((row) => row.due || row.overdue) ?? null;
    const revisionDue = dueRevision !== null;
    /* REVISION-DUE CARD: a topic studied days ago whose only business today
       is its revision. That is ACTIVE, PENDING work — the box is empty and
       ticking it completes the revision, not the long-finished study task. */
    const isRevisionCard = options?.readOnlyHead === true && dueRevision !== null;
    const target = isRevisionCard && dueRevision ? dueRevision.item : item;
    const busy = busyIds.has(target.id) || busyIds.has(item.id);
    const completing = completingIds.has(target.id) || completingIds.has(item.id);
    /* An optimistic draft has no database row yet — its controls stay inert
       for the moment the insert is in flight. */
    const syncing = item.pending_sync === true;
    const rowKey = item.source_key || topicKey(item.subject, item.topic);
    const ann = annotations.get(rowKey);
    const rowMinutes = ann?.minutes ?? estimatedMinutes(ann?.type, item.kind);
    const feltNow = feelingByKey.get(rowKey);
    const editing = inlineEditId === item.id;
    const category = resolveTaskCategory(item, ann?.type);
    const headActionable = options?.readOnlyHead !== true || isRevisionCard;
    const editable = options?.readOnlyHead !== true && !syncing && item.kind === 'new';
    /* STRIKETHROUGH MEANS DONE, and nothing else. A revision-due card is
       still active work — even though its head topic was studied days ago,
       so `status` alone would read as done. It carries the amber glow, and
       its title and box stay normal: never struck, never greyed, never
       ticked. */
    const isDone = completing || (item.status === 'done' && !revisionDue);
    /* A REVISION is never struck through, finished or not — its glow is the
       whole signal. Only a regular study task earns the line. */
    const struck = isDone && item.kind !== 'revision' && !isRevisionCard;
    const settled = isDone || (options?.readOnlyHead === true && !revisionDue);
    const whyCollapsed = (options?.collapseWhy ?? false) && whyOpenId !== item.id;
    const hasHiddenWhy =
      !isRevisionCard && whyCollapsed && (revisions ?? []).length > 0 && !(revisions ?? []).some((row) => row.overdue);
    /* [Completion] Ticked, waiting on its answer: the box reads checked and
       the rating chips are open below, but the card has not moved and
       nothing has been written. Tapping again takes the tick back. */
    const awaiting = headActionable && awaitingRating.has(target.id);
    const tickRow = () => {
      if (busy || syncing) return;
      toggleTick(target.id);
    };
    return (
      <li key={`p-${item.id}`} className="vicharak-fade">
        {/* The WHOLE row is the mark-done target. The pencil is a real button
            sitting outside it, top-right, so editing never ticks anything. */}
        <div
          role={headActionable ? 'button' : undefined}
          tabIndex={headActionable && !editing ? 0 : undefined}
          onClick={headActionable && !editing ? tickRow : undefined}
          onKeyDown={
            headActionable && !editing
              ? (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  tickRow();
                }
              : undefined
          }
          aria-label={
            headActionable
              ? awaiting
                ? `Undo the tick on \u201C${item.topic}\u201D`
                : isRevisionCard
                  ? `Tick the revision of \u201C${item.topic}\u201D and rate it to finish`
                  : `Tick \u201C${item.topic}\u201D and rate it to finish`
              : undefined
          }
          aria-expanded={headActionable && !editing ? awaiting : undefined}
          aria-busy={syncing || undefined}
          className={`relative w-full touch-manipulation vk-feed-card${completing ? ' vk-card-glow' : ''}${isDone && !completing ? ' vk-feed-card--done' : ''}${revisionDue && !isDone ? ' vk-feed-card--revision' : ''}${awaiting && !isDone && !completing ? ' vk-feed-card--ticked' : ''}`}
          style={{
            padding: '12px 16px',
            /* The right side clears the 44px pencil pinned outside the row —
               but only on rows that actually carry one. */
            paddingRight: editable ? 36 : 16,
            minHeight: 44,
            cursor: headActionable && !editing ? 'pointer' : 'default',
            opacity: syncing ? 0.6 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}
          data-testid={options?.testId ?? `task-card-${item.id}`}
        >
          <div className="flex items-start gap-2.5">
            <span
              className="flex items-center flex-shrink-0"
              style={{ height: 23 }}
              data-testid={`task-check-${item.id}`}
            >
              {busy || syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: FEED_MUTED }} />
              ) : (
                <TaskBox done={settled || awaiting} />
              )}
            </span>
            {editing ? (
              <input
                autoFocus
                type="text"
                value={inlineEditText}
                onChange={(e) => setInlineEditText(e.target.value)}
                onKeyDown={(e) => handleInlineKeyDown(e, item)}
                onBlur={() => void commitInlineEdit(item)}
                onClick={(e) => e.stopPropagation()}
                disabled={savingInlineEdit}
                className="min-w-0 flex-1 outline-none disabled:opacity-60"
                style={{ ...handInputStyle, fontFamily: TODAY_FONT, fontSize: T_TITLE, fontWeight: 500, background: FEED_INPUT_BG, border: FEED_INPUT_BORDER, color: FEED_TEXT }}
                data-testid={`task-inline-edit-${item.id}`}
              />
            ) : (
              <span className="min-w-0 flex-1 select-none" data-testid={`task-label-${item.id}`}>
                {/* The student's own words — 14px/500, struck through ONLY
                    once the task is genuinely done. */}
                <span
                  className={`block vicharak-hand${struck ? ' vicharak-struck' : ''}`}
                  style={{
                    fontFamily: TODAY_FONT,
                    fontSize: T_TITLE,
                    fontWeight: 500,
                    lineHeight: 1.35,
                    color: struck ? FEED_TEXT_DONE : FEED_TEXT,
                  }}
                >
                  {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                </span>
                {/* ONE subordinate meta line, in the app's own voice. */}
                <span
                  className="mt-0.5 flex items-center gap-2 flex-wrap"
                  style={{ fontSize: T_META, fontWeight: 400, color: FEED_MUTED }}
                >
                  {/* No date on a card — the day is stated once, in the
                      compact header at the top of this screen. */}
                  <span data-testid={`task-category-${item.id}`}>
                    {category}
                  </span>
                  {!options?.hideSubject && item.subject && item.subject !== 'General' && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: FEED_ACCENT_SOFT, fontWeight: 600 }}>
                      <SubjectDot subject={item.subject} size={6} />
                      {item.subject}
                    </span>
                  )}
                  <span
                    className="tabular-nums"
                    style={{ color: settled ? FEED_DONE : FEED_MUTED }}
                    data-testid={`task-duration-${item.id}`}
                  >
                    {formatDuration(rowMinutes)}
                  </span>
                  {feltNow && (
                    <span data-testid={`task-difficulty-${item.id}`}>felt {feltNow}</span>
                  )}
                  {hasHiddenWhy && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setWhyOpenId(item.id);
                      }}
                      className="underline underline-offset-2 touch-manipulation"
                      style={{ fontSize: T_META, fontWeight: 600, color: FEED_ACCENT }}
                      data-testid={`task-why-${item.id}`}
                    >
                      Why?
                    </button>
                  )}
                </span>
                {/* [V2] Vicharee's own targets say so out loud, with the
                    evidence behind the pick (weak flag, overdue revision,
                    test accuracy, a doubt you logged). */}
                {!isRevisionCard && !isDone && (vichareeReasonById.has(target.id) || seededReasons.has(rowKey)) && (
                  <span className="vk-vicharee-line" data-testid={`task-vicharee-${item.id}`}>
                    <span className="vk-vicharee-badge">Vicharee decided this {'\u2726'}</span>
                    {vichareeReasonById.get(target.id) ?? seededReasons.get(rowKey)}
                  </span>
                )}
                {/* WHY IT IS BACK — a label, never a button. The checkbox is
                    the one control that completes a revision-due card. */}
                {isRevisionCard && dueRevision && (
                  <span className="vk-why" data-testid={`task-revision-note-${item.id}`}>
                    <span className="vk-vicharee-badge vk-vicharee-badge--amber">Vicharee decided this {'\u2726'}</span>
                    {revisionNote(dueRevision)}
                  </span>
                )}
              </span>
            )}
            {/* The star (the student's own pin) sits inside the mark target
                and stops the tap from ticking the row. The duration lives on
                the meta line under the title, where it reads as metadata —
                the title keeps the full width of the row. */}
            {!completing && !editing && headActionable && (
              <button
                type="button"
                disabled={syncing}
                onClick={(event) => {
                  event.stopPropagation();
                  void togglePriority(item);
                }}
                aria-pressed={Boolean(item.is_priority)}
                aria-label={item.is_priority ? 'Remove your priority from this task' : 'Prioritize this task'}
                className="w-11 h-11 -my-2.5 -mr-2 flex items-center justify-center flex-shrink-0 touch-manipulation disabled:opacity-40"
                style={{ color: item.is_priority ? FEED_ACCENT : FEED_FAINT, opacity: item.is_priority ? 1 : 0.6 }}
                data-testid={`task-priority-${item.id}`}
              >
                <Star className="w-4 h-4" fill={item.is_priority ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
          {/* The topic's spaced revisions — inside this row, never beside it.
              A revision-due card states its own reason above instead. */}
          {!completing && !isRevisionCard && renderRevisionRows(revisions, { collapsed: whyCollapsed })}
          {/* How did that go? — on the card, at all times. */}
          {!completing && !editing && renderRatingRow(target)}
          {/* Pencil: absolutely positioned, outside the mark target. */}
          {editable && !editing && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openInlineEdit(item);
              }}
              aria-label={`Edit \u201C${item.topic}\u201D`}
              title="Edit · Backspace on an empty row deletes it"
              className="vk-edit-btn absolute flex items-center justify-center touch-manipulation"
              style={{ top: 2, right: -6, width: 44, height: 44 }}
              data-testid={`task-edit-${item.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </li>
    );
  };
  /* This Week's Plan card — which focus chapter is expanded to its topics. */
  const [weeklyChapterOpen, setWeeklyChapterOpen] = useState<string | null>(null);
  /* Topic currently being added to today from the weekly plan (its key). */
  const [addingWeeklyTopic, setAddingWeeklyTopic] = useState<string | null>(null);
  /* [§1] Double-tap inline edit — which row is editing + its draft text. */
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineEditText, setInlineEditText] = useState('');
  const [savingInlineEdit, setSavingInlineEdit] = useState(false);
  /* [§5] Welcome-back card — dismissed for this visit only. */
  const [backlogDismissed, setBacklogDismissed] = useState(false);
  /* [§6] Blank Recall — overlay state, snapshot queue and the silent timer. */
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallQueue, setRecallQueue] = useState<StudyItem[]>([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const [recallStartedAt, setRecallStartedAt] = useState<number | null>(null);
  const [recallRevealedAt, setRecallRevealedAt] = useState<number | null>(null);
  const [recallPoints, setRecallPoints] = useState<string | null>(null);
  const [recallLoading, setRecallLoading] = useState(false);
  /* What the student typed from memory, and the score AI gave it (0–100). */
  const [recallText, setRecallText] = useState('');
  const [recallScore, setRecallScore] = useState<number | null>(null);

  /* ---------- shared per-render values (extracted verbatim) ---------- */
  const trialExpiresMs = accessStatus.trialExpiresAt ? Date.parse(accessStatus.trialExpiresAt) : NaN;
  const trialLastDay = Number.isFinite(trialExpiresMs) && trialExpiresMs - getSystemNow() < 86_400_000;
  const trialDaysLeftCount = accessStatus.daysLeftInTrial ?? 0;
  const trialBannerText = trialLastDay
    ? 'Trial ends today — upgrade to keep access'
    : `${trialDaysLeftCount} ${trialDaysLeftCount === 1 ? 'day' : 'days'} of free access remaining`;

  const baseMission = missionQueue[0];
  const lighter = lowMode ? pickLighterTask(studentItems, baseMission, today) : null;
  const lowReadFallback = Boolean(lowMode && lighter && !lighter.item && baseMission);
  const mission = lowMode && lighter?.item ? lighter.item : baseMission;
  const missionAnn = mission ? annotations.get(mission.source_key || topicKey(mission.subject, mission.topic)) : undefined;
  const missionStarted = mission ? startedIds.has(mission.id) : false;
  // The task the Focus Timer credits: a started task first, else the mission.
  const activeToolsTask = studentItems.find((i) => i.status === 'pending' && startedIds.has(i.id)) ?? mission ?? null;
  const activeToolsKey = activeToolsTask ? activeToolsTask.source_key || topicKey(activeToolsTask.subject, activeToolsTask.topic) : null;
  const matchesSubjectFilter = (item: StudyItem) => subjectFilter === 'All' || item.subject === subjectFilter;
  const laterAll = missionQueue.filter((i) => i.id !== mission?.id && matchesSubjectFilter(i));
  const laterVisible = showAllLater ? laterAll : laterAll.slice(0, VISIBLE_LATER_CAP);
  const formulaVisible = formula.filter(({ item }) => matchesSubjectFilter(item));
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const examName = examDef?.name ?? (savedExamLabel || (profile ? examLabelFromId(profile.exam) : 'Your exam'));
  const feelingByKey = data.feelingByKey;
  const lastRatingLabelByKey = data.lastRatingLabelByKey;
  const { monthlyChapters, chapterStats, focusChapters } = data;

  /* Glance-card numbers — today's plate and the weekly target, in one look. */
  const todayTaskTotal = mainPending.length + carriedPending.length + dueRevisions.length + doneToday.length;
  const toTarget = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };
  const weeklyTopicTarget = weeklyRow ? toTarget(weeklyRow.topic_target) : 0;
  const weeklyTestTarget = weeklyRow ? toTarget(weeklyRow.test_target) : 0;
  const monthLabel = getSystemDate().toLocaleDateString('en-IN', { month: 'long' });
  /* Verdict tint for the "Am I on track?" chip. Behind is the one state that
   * has genuinely lost the student ground, so it is the only one in --gone. */
  const paceTone = pace.status === 'green' ? TODAY_AMBER : pace.status === 'amber' ? INK_SOFT : GONE;

  /* [Pace signal] Never claim green/amber/red before there is evidence. A
   * new student gets a neutral, actionable state instead of a false verdict. */
  const hasPaceEvidence = doneTopicKeys.size > 0 || doneToday.length > 0 || todayMinutes > 0;
  const paceAccentColor = !hasPaceEvidence
    ? BRAND
    : pace.status === 'green'
      ? SUCCESS
      : pace.status === 'amber'
        ? WARNING
        : DANGER;
  const paceHeadline = !hasPaceEvidence
    ? 'Complete or log one study session today. Your on-track signal will appear as soon as there is real progress to measure.'
    : pace.status === 'green'
      ? 'On track — your current pace covers the syllabus before exam day.'
      : pace.status === 'amber'
        ? `${pace.daysBehind} day${pace.daysBehind === 1 ? '' : 's'} behind — ${pace.alert}.`
        : pace.daysBehind >= 1
          ? `At the current pace you'll finish about ${pace.daysBehind} day${pace.daysBehind === 1 ? '' : 's'} after your exam — prioritise high-weight chapters to pull it back.`
          : "At the current pace the syllabus won't be covered before exam day — prioritise high-weight chapters now.";

  /* ONE status line under the date. Each clause only appears when the value
   * behind it actually exists — nothing here is derived to fill the space. */
  const todayStatusLine = [
    examDateSet && daysToExam > 0 ? `${daysToExam} days to ${examName}` : null,
    hasPaceEvidence ? pace.label : null,
    todayTaskTotal > 0 ? `${doneToday.length} of ${todayTaskTotal} done` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /* How much of today is done — drives the progress rule AND the day panel's
   * progress aura: faint and cool at 0%, warm by halfway, and a vibrant
   * gradient ring around the card once everything is done. */
  const taskProgress = todayTaskTotal > 0 ? doneToday.length / todayTaskTotal : 0;

  /* One tap on a weekly-plan topic queues it for today via the SAME addTask
   * path every other surface uses — duplicates are skipped automatically. */
  const addWeeklyTopic = async (subject: string, topic: string) => {
    const key = topicKey(subject, topic);
    if (addingWeeklyTopic) return;
    setAddingWeeklyTopic(key);
    try {
      const created = await addTask(subject, topic, 'Self Study', false);
      showToast(
        created === null
          ? "That didn't save — mind tapping it once more?"
          : created
            ? `Added to today: ${topic}`
            : 'Already on your plan — no duplicate added.',
      );
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    } finally {
      setAddingWeeklyTopic(null);
    }
  };

  /* ---------- [§1] tap-to-edit ---------- */
  /* The checkbox completes a task; a single tap on its TEXT opens inline edit
   * (only for student-created 'new' tasks). */
  const openInlineEdit = (item: StudyItem) => {
    if (item.kind !== 'new') return;
    setInlineEditId(item.id);
    setInlineEditText(item.topic);
  };
  const commitInlineEdit = async (item: StudyItem) => {
    if (savingInlineEdit) return;
    const text = (inlineEditText ?? '').trim();
    if (!text) return;
    setSavingInlineEdit(true);
    try {
      const saved = text === item.topic ? true : await renameTask(item, text);
      if (saved) setInlineEditId(null);
    } finally {
      setSavingInlineEdit(false);
    }
  };
  /* Enter (or tapping away) saves; Escape abandons the edit; and Backspace on
   * an already-empty row deletes the task outright — through the same delete
   * path whose toast offers a one-tap Undo, so nothing is lost for good. */
  const handleInlineKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, item: StudyItem) => {
    if (event.key === 'Enter') {
      void commitInlineEdit(item);
      return;
    }
    if (event.key === 'Escape') {
      setInlineEditId(null);
      return;
    }
    if (event.key === 'Backspace' && inlineEditText.length === 0) {
      event.preventDefault();
      setInlineEditId(null);
      void deleteTask(item);
    }
  };

  /* ---------- [§5/§6] return detection — calm, forward-facing ---------- */
  /* A multi-day gap is already SILENTLY re-planned by useTasks (missed work
   * folds back into the schedule, redistributed — never shown as overdue).
   * All that remains on screen is ONE gentle welcome-back card that states
   * what's NEXT — never a days-behind number, never a pending total. */
  const idleDays = (() => {
    let days = 0;
    for (let i = 1; i <= 14; i += 1) {
      if ((completedByDate.get(addDaysISO(today, -i)) ?? []).length > 0) break;
      days += 1;
    }
    return days;
  })();
  const freshStartApplied = metaMap.get(`fresh_start|${today}`)?.meta_value === '1';
  const showBacklogAlert = !backlogDismissed && (freshStartApplied || (idleDays >= 2 && day > 2));
  /* What's next — the card names the first topic of today's slice. */
  const welcomeNext = mainPending[0] ?? dueRevisions[0] ?? null;

  /* ---------- [§6] Blank Recall ---------- */
  const recallItem = recallOpen ? recallQueue[recallIndex] ?? null : null;
  const startBlankRecall = () => {
    setRecallQueue(dueRevisions);
    setRecallIndex(0);
    setRecallStartedAt(Date.now());
    setRecallRevealedAt(null);
    setRecallPoints(null);
    setRecallText('');
    setRecallScore(null);
    setRecallOpen(true);
  };
  /* The once-a-second timer tick lives in <RecallClock/> — see above. */
  /* The student's typed recall is compared against the concept: AI returns a
   * simple 0–100 score plus the key points they missed. Without AI access the
   * student's own quick note for the topic stands in as the answer key. The
   * time BEFORE submitting is what feeds the FSRS grade, so a slow typist is
   * never punished for the scoring round-trip. */
  const submitRecall = async () => {
    if (!recallItem || recallRevealedAt) return;
    setRecallRevealedAt(Date.now());
    const key = recallItem.source_key || topicKey(recallItem.subject, recallItem.topic);
    /* The topic's Quick Note is account-keyed in zuno_meta (key note|<key>) —
     * the durable copy wins. The legacy device-local copy is only a fallback,
     * and when it is still the only copy it is migrated up in the background
     * so the next device sees it too. */
    let note = metaMap.get(`note|${key}`)?.meta_value ?? '';
    if (!note) {
      try {
        note = localStorage.getItem(`vicharak_note_${spaceId}_${key}`) ?? '';
      } catch {
        note = '';
      }
      if ((note ?? '').trim()) void upsertMeta(`note|${key}`, note).catch(() => undefined);
    }
    const written = (recallText ?? '').trim();
    if (!aiAccess.canAskAi) {
      setRecallScore(null);
      setRecallPoints((note ?? '').trim() || 'No stored notes for this topic yet — open your material and check what you missed.');
      return;
    }
    setRecallLoading(true);
    try {
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: AI_MODELS.fast,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content:
                'You grade a blind recall attempt for an exam aspirant. Reply with STRICT JSON only — no prose, ' +
                'no markdown fences: {"score": number 0-100, "feedback": string, "missed": string[]}. ' +
                '"score" is how much of the topic they recalled correctly (0 when they wrote nothing). ' +
                '"feedback" is ONE encouraging sentence naming their biggest gap. ' +
                '"missed" is 3–5 short key points they should have recalled.',
            },
            {
              role: 'user',
              content:
                `Exam: ${examName}. Subject: ${recallItem.subject}. Topic: ${recallItem.topic}.` +
                ((note ?? '').trim() ? ` The student's own note on it: ${(note ?? '').trim().slice(0, 500)}.` : '') +
                (written
                  ? ` What they recalled from memory: "${written.slice(0, 1200)}"`
                  : ' They could not recall anything at all.'),
            },
          ],
          max_completion_tokens: 500,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const dataJson = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const parsed = extractJsonObject(String(dataJson.choices?.[0]?.message?.content || ''));
      const record = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const rawScore = Number(record.score);
      const feedback = typeof record.feedback === 'string' ? (record.feedback ?? '').trim() : '';
      const missed = Array.isArray(record.missed)
        ? record.missed.map((entry) => String(entry ?? '').trim()).filter(Boolean).slice(0, 5)
        : [];
      chargeAi();
      setRecallScore(Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : written ? null : 0);
      setRecallPoints(
        [feedback, missed.map((entry) => `• ${entry}`).join('\n')].filter(Boolean).join('\n\n') ||
          (note ?? '').trim() ||
          'No feedback came back — check your material and fill the gaps.',
      );
    } catch {
      setRecallScore(null);
      setRecallPoints((note ?? '').trim() || "The scoring didn't come through — check your material and fill the gaps you missed.");
    } finally {
      setRecallLoading(false);
    }
  };
  /* Completing a card: the time spent BEFORE the reveal sets the implicit
   * FSRS grade (<20s Easy · ≤2min Good · >2min Hard), then the revision
   * completes through the exact same path a checkbox tap uses. */
  const finishRecallCard = () => {
    if (!recallItem) return;
    const thinkSeconds = recallStartedAt
      ? Math.floor(((recallRevealedAt ?? Date.now()) - recallStartedAt) / 1000)
      : 0;
    const feeling: TaskFeeling = thinkSeconds < 20 ? 'easy' : thinkSeconds <= 120 ? 'medium' : 'hard';
    /* The recall timing IS the rating (applyImplicitFeeling rolls a revision
       one ladder step), so the rating sheet must not ask again. */
    void applyImplicitFeeling(recallItem, feeling);
    completeWithAnimation(recallItem, { skipFeedbackPrompt: true });
    if (recallIndex + 1 < recallQueue.length) {
      setRecallIndex((i) => i + 1);
      setRecallStartedAt(Date.now());
      setRecallRevealedAt(null);
      setRecallPoints(null);
      setRecallText('');
      setRecallScore(null);
    } else {
      setRecallOpen(false);
    }
  };

  /* The ultimate-goal strip that used to sit under the date is GONE: Today
   * opens on the greeting and the list, and the goal is edited on Profile. */

  /* ---------- [V2] Vicharee GENERATES the day's targets ----------
   * Today fills ITSELF — a student never has to type a task to get started.
   * As soon as the mood check resolves, Vicharee seeds the day's plate from
   * the weakness engine, the doubts logged in the Mistake Book, topics whose
   * recall is slipping, this week's focus chapters and — for a brand-new
   * student with no history at all — the next chapters of their own syllabus
   * (features/today/vichareeTargets.ts).
   *
   * Every target lands through the SAME addTask path a typed task uses, so
   * duplicates are skipped and the student edits, deletes or ticks them like
   * anything else. ONE pass per mood per calendar day, with the flag written
   * BEFORE the inserts so no re-render can double-add — and a target the
   * student deletes never comes back the same day. Answering the mood check
   * after an opener tops the plan up to the new energy level exactly once. */
  const [seededReasons, setSeededReasons] = useState<Map<string, string>>(() =>
    readSeededTargets(spaceId, today),
  );
  const vichareeTargets = useMemo(
    () =>
      buildVichareeTargets({
        limit: moodTargetCount(mood),
        today,
        studentItems,
        dueRevisions,
        completedByDate,
        weakTopicInsights,
        flaggedRows,
        syllabusSubjects: data.topicPickerSubjects,
        focusChapters,
      }),
    [
      mood,
      today,
      studentItems,
      dueRevisions,
      completedByDate,
      weakTopicInsights,
      flaggedRows,
      data.topicPickerSubjects,
      focusChapters,
    ],
  );
  const dbReady = dbSessionReady && Boolean(profile) && !itemsQ.loading;
  useEffect(() => {
    if (seedPassDone(spaceId, today, mood)) return;
    /* Wait for the real list — seeding against a half-loaded plan would
       propose work the student already has queued. */
    if (!dbReady || seedPassBusyRef.current) return;
    seedPassBusyRef.current = true;
    markSeedPass(spaceId, today, mood);
    void (async () => {
      try {
        const planned = mainPending.length + carriedPending.length + dueRevisions.length;
        const room = moodTargetCount(mood) - planned;
        if (room <= 0) return;
        const picks = vichareeTargets.slice(0, room);
        if (picks.length === 0) return;
        rememberSeededTargets(spaceId, today, picks);
        setSeededReasons((previous) => {
          const next = new Map(previous);
          for (const pick of picks) next.set(pick.key, pick.reason);
          return next;
        });
        for (const pick of picks) {
          try {
            await addTask(pick.subject, pick.topic, pick.type, true);
          } catch {
            /* insert failed — the target is simply not added; never a prompt */
          }
        }
      } finally {
        seedPassBusyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, today, mood, dbReady]);

  if (!profile) return null;

  return (
    <>
          {/* Hairline separators between task rows. */}
          <style>{`
            .vicharak-task-list > li + li { border-top: 1px solid ${RULE_SOFT}; }
            /* [Today] Every rule below is scoped to .vk-today / .vk-feed, so
               no other screen inherits this screen's type or its surfaces. */
            /* overflow-x: clip — nothing inside this screen may widen the
               page; a child that overshoots is clipped instead of dragging
               the whole layout sideways. */
            .vk-today { font-family: ${TODAY_FONT}; background: ${TODAY_PAGE_BG}; overflow-x: clip; }
            /* Paper grain across the whole page — fixed, never per card. */
            .vk-today::before { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: .05; mix-blend-mode: multiply; background-image: ${TODAY_NOISE}; }
            /* At night the multiply grain would read as dirt — flip to a faint screen blend. */
            .vicharak-dark .vk-today::before { mix-blend-mode: screen; opacity: .035; }
            /* [Order] The screen and the day's column are flex stacks purely
               so the task feed can be ordered to the top. flex-shrink: 0 is
               load-bearing: a column taller than the viewport must SCROLL,
               never squash its cards. */
            .vk-today .vk-stack { display: flex; flex-direction: column; }
            .vk-today .vk-stack > * { flex-shrink: 0; }
            /* Same specificity as the app-wide field rule, declared later, so
               a field on Today reads 13px instead of the global 0.87rem. */
            .vk-today button { font-family: inherit; font-size: ${T_TITLE}px; }
            .vk-today input, .vk-today textarea, .vk-today select { font-family: inherit; font-size: 16px !important; }
            .vk-today .vicharak-hand { font-family: inherit; font-size: ${T_TITLE}px; font-weight: 500; line-height: 1.35; }
            .vk-today .vicharak-empty { font-family: inherit; font-size: ${T_BODY}px; font-weight: 400; color: ${FEED_MUTED}; }
            .vk-today .vicharak-title { font-family: inherit; font-size: ${T_BODY}px; font-weight: 500; line-height: 1.4; letter-spacing: 0; }
            /* SCREEN HEADER — 1.1rem on a phone, 1.25rem at desk width, and
               never larger. The date is its 0.72rem muted sub-label. */
            .vk-today .vk-greeting { font-family: inherit; font-size: 1.1rem; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; color: ${FEED_TEXT}; }
            @media (min-width: 640px) { .vk-today .vk-greeting { font-size: 1.25rem; } }
            .vk-today .vk-datestamp { font-size: 0.72rem; font-weight: 500; line-height: 1.3; color: ${FEED_MUTED}; }
            /* Scan: sits BESIDE the Add button at the foot of the feed — the
               same 40px height and pill radius, outlined where Add is filled,
               so the pair reads as one row of equals. Icon-only on phones;
               the "Scan" label appears from 640px up. */
            .vk-today .vk-add-scan { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; min-height: 40px; min-width: 40px; padding: 0 12px; border-radius: 999px; border: 1px solid ${tint(ADD_BLUE, 0.4)}; background: ${TODAY_SURFACE}; color: ${ADD_BLUE}; font-size: ${T_META}px; font-weight: 600; transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease, transform 0.12s ease; }
            .vk-today .vk-add-scan:hover { border-color: ${ADD_BLUE}; background: ${CHIP_HOVER_BG}; }
            .vk-today .vk-add-scan:active { transform: translateY(1px); }
            /* The feed spans the SAME column as every other section — one
               consistent left/right alignment down the whole screen. */
            .vk-feed { max-width: 100%; }
            /* Bottom clearance: the sticky nav and the floating Timer/AI
               pills never cover the last card, and the safe area counts. */
            .vk-today .vk-page-pad { padding-bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }
            @media (min-width: 1024px) { .vk-today .vk-page-pad { padding-bottom: 2.5rem; } }
            /* [Aura] The day panel's progress-aware halo: three blurred
               gradient layers behind the sheet (cool, then warm, then
               vibrant) plus a gradient ring on its edge. Only their OPACITY
               ever changes, so the glow grows smoothly per checked-off task. */
            .vk-feed .vk-aura { position: relative; }
            .vk-feed .vk-aura > section { position: relative; z-index: 1; }
            .vk-feed .vk-aura-glow { position: absolute; inset: -9px; border-radius: 16px; pointer-events: none; filter: blur(16px); transition: opacity 0.9s ease; z-index: 0; }
            .vk-feed .vk-aura-cool { background: linear-gradient(135deg, rgba(108,155,255,.5), rgba(0,87,255,.3) 55%, rgba(122,160,247,.45)); }
            .vk-feed .vk-aura-warm { background: linear-gradient(135deg, rgba(0,87,255,.45), rgba(108,155,255,.4) 45%, rgba(255,170,0,.5)); }
            .vk-feed .vk-aura-bright { background: linear-gradient(135deg, rgba(255,179,0,.7), rgba(255,122,0,.5) 35%, rgba(0,87,255,.55) 70%, rgba(108,155,255,.65)); }
            .vk-feed .vk-aura-ring { position: absolute; inset: -2px; border-radius: 11px; padding: 2px; background: linear-gradient(135deg, #FFB300, #FF7A00 30%, #0057FF 65%, #6EA8FF); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; pointer-events: none; transition: opacity 0.9s ease; z-index: 2; }
            .vk-feed-card { position: relative; overflow: hidden; background: var(--td-card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid var(--td-card-border); border-radius: 8px; box-shadow: var(--td-card-shadow); transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease; }
            .vk-feed-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 8px 0 0 8px; background: ${TODAY_BLUE}; z-index: 1; }
            /* A light glint sweeps the sheet on hover — depth, not decoration. */
            .vk-feed-card::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,.65) 45%, transparent 70%); transform: translateX(-100%); transition: transform .55s ease; opacity: .25; }
            .vk-feed-card:hover::after { transform: translateX(100%); }
            .vk-feed-card--overdue::before { background: ${FEED_OVERDUE}; }
            /* REVISION DUE — the ONLY amber-glow state. The topic was studied
               days ago and is now back on the plate: active, unticked work.
               Never struck through (see renderTaskCard). */
            .vk-feed-card--revision { background: rgba(255, 170, 0, 0.08); border: 1px solid rgba(255, 170, 0, 0.3); box-shadow: 0 0 14px rgba(255, 170, 0, 0.22); }
            .vk-feed-card--revision::before { background: ${TODAY_AMBER}; }
            /* DONE — quiet about it. No glow: the amber halo means "this needs
               you", not "this is finished". Secondary: 0.85 opacity, 13px. */
            .vk-feed-card--done { background: var(--td-done-bg); border: 1px solid ${TODAY_BORDER}; box-shadow: none; opacity: .85; font-size: 13px; }
            .vk-feed-card--done::before { background: var(--td-done-line); }
            .vk-feed-card--done::after { display: none; }
            /* TICKED, NOT YET FINISHED — the box reads checked and the rating
               chips are open in place. The card stays exactly where it is
               until one of them is chosen. */
            .vk-feed-card--ticked { border-color: ${tint(TODAY_BLUE, 0.5)}; box-shadow: 0 0 0 2px ${tint(TODAY_BLUE, 0.12)}, ${TODAY_SHADOW}; }
            /* COMPLETION — the WHOLE card glows, lifts and settles back; only
               then does the row move down into Completed. Never the box alone. */
            @keyframes vkCardGlow {
              0% { box-shadow: ${TODAY_SHADOW}; transform: translateY(0); }
              18% { box-shadow: 0 0 0 3px rgba(0,87,255,.22), 0 12px 32px rgba(0,87,255,.16); transform: translateY(-1px); }
              72% { box-shadow: 0 0 0 3px rgba(0,87,255,.22), 0 12px 32px rgba(0,87,255,.16); transform: translateY(-1px); }
              100% { box-shadow: ${TODAY_SHADOW}; transform: translateY(0); }
            }
            @keyframes vkCardWash {
              0% { background: ${TODAY_SURFACE_BG}; }
              18% { background: ${CHIP_HOVER_BG}; }
              72% { background: ${CHIP_HOVER_BG}; }
              100% { background: ${TODAY_SURFACE_BG}; }
            }
            .vk-feed .vk-card-glow { animation: vkCardGlow 0.9s cubic-bezier(.2,.75,.25,1) both, vkCardWash 0.9s cubic-bezier(.2,.75,.25,1) both; }
            .vk-feed .vk-card-glow::after { display: none; }
            /* The reason a revision-due card is here — a LABEL, never a
               button: the checkbox is what completes it. */
            .vk-feed .vk-why { display: block; margin-top: 5px; font-size: ${T_META}px; font-weight: 500; line-height: 1.35; color: ${TODAY_AMBER_INK}; }
            /* [V2] Vicharee's evidence line under a task the engine itself
               put on today's plate. */
            .vk-feed .vk-vicharee-line { display: block; margin-top: 4px; font-size: ${T_META}px; font-weight: 500; line-height: 1.35; color: ${TODAY_BLUE}; overflow-wrap: anywhere; }
            /* [V2] The badge that makes the AI feel alive: every target
               Vicharee chose for the day wears it, with the evidence it
               used printed right after. */
            .vk-feed .vk-vicharee-badge { display: inline-flex; align-items: center; margin-right: 6px; padding: 1px 8px; border-radius: 999px; background: ${tint(TODAY_BLUE, 0.1)}; border: 1px solid ${tint(TODAY_BLUE, 0.3)}; font-size: 10px; font-weight: 700; color: ${TODAY_BLUE}; white-space: nowrap; }
            .vk-feed .vk-vicharee-badge--amber { background: ${tint(TODAY_AMBER, 0.14)}; border-color: ${tint(TODAY_AMBER, 0.34)}; color: ${TODAY_AMBER_INK}; }
            /* HOW DID THAT GO? — Again · Hard · Good · Easy, expanded on the
               card itself. There is no popup and no sheet behind any of it. */
            .vk-feed .vk-rate { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 8px 0 0 29px; }
            .vk-feed .vk-rate-ask { font-size: ${T_META}px; font-weight: 500; color: ${FEED_MUTED}; margin-right: 2px; }
            /* A rating chip NEVER fills solid: hover is a soft blue-tinted
               gradient, and the grade stays in the chip's own ink. */
            .vk-feed .vk-rate-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 0 11px; border-radius: 999px; border: 1px solid ${TODAY_BORDER}; background: ${TODAY_SURFACE}; font-size: ${T_META}px; font-weight: 600; line-height: 1; transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease; }
            .vk-feed .vk-rate-chip:hover { background: ${CHIP_HOVER_BG}; border-color: ${CHIP_HOVER_BORDER}; }
            .vk-feed .vk-rate-chip:active { transform: translateY(1px); }
            .vk-feed .vk-rate-chip:disabled { opacity: 0.5; }
            /* The grade lives in the ink — one blue ladder, never a fill. */
            .vk-feed .vk-rate-again, .vk-feed .vk-rate-again:hover { color: ${GRADE_AGAIN}; }
            .vk-feed .vk-rate-hard, .vk-feed .vk-rate-hard:hover { color: ${GRADE_HARD}; }
            .vk-feed .vk-rate-good, .vk-feed .vk-rate-good:hover { color: ${GRADE_GOOD}; }
            .vk-feed .vk-rate-easy, .vk-feed .vk-rate-easy:hover { color: ${GRADE_EASY}; }
            /* The tick on its own finishes nothing — so say so. */
            .vk-feed .vk-rate-need { font-size: ${T_META}px; font-weight: 500; color: ${TODAY_BLUE}; }
            /* ADD TASK — the one blue block, at the HEAD of the feed, with
               both ways in visible at once. */
            .vk-feed .vk-add { border: 1px solid ${tint(ADD_BLUE, 0.26)}; border-radius: 10px; background: var(--td-add-bg); box-shadow: ${TODAY_PANEL_SHADOW}; padding: 10px; }
            .vk-feed .vk-add-input { flex: 1 1 auto; min-width: 0; padding: 9px 11px; border-radius: 8px; background: ${TODAY_SURFACE}; border: 1px solid ${tint(ADD_BLUE, 0.32)}; color: ${FEED_TEXT}; font-size: ${T_TITLE}px; font-weight: 500; outline: none; }
            .vk-feed .vk-add-go { flex-shrink: 0; min-height: 44px; padding: 0 18px; border-radius: 999px; background: ${ADD_BTN_BG}; box-shadow: ${ADD_BTN_SHADOW}; color: #FFFFFF; font-size: ${T_META}px; font-weight: 600; transition: filter 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease; }
            .vk-feed .vk-add-go:hover { filter: brightness(1.07); box-shadow: 0 6px 16px rgba(0,87,255,.3); }
            .vk-feed .vk-add-go:active { transform: translateY(1px); }
            .vk-feed .vk-add-go:disabled { opacity: 0.45; box-shadow: none; }
            .vk-feed .vk-add-syllabus { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; margin-top: 8px; font-size: ${T_META}px; font-weight: 600; color: ${ADD_BLUE}; }
            .vk-feed .vk-add-syllabus:hover { text-decoration: underline; text-underline-offset: 2px; }
            .vk-feed .vicharak-task-cards { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
            .vk-feed .vicharak-task-cards > li + li { border-top: none; }
            .vk-feed .vicharak-task-list { display: flex; flex-direction: column; gap: 8px; }
            .vk-feed .vicharak-task-list > li + li { border-top: none; }
            .vk-feed .vicharak-box { border-color: var(--td-box-border); }
            .vk-feed .vicharak-box-done { border-color: ${TODAY_AMBER}; }
            .vk-feed .vicharak-tick { stroke: ${TODAY_AMBER}; }
            .vk-feed .vicharak-chip { border-color: ${TODAY_BORDER}; color: ${FEED_MUTED}; font-size: ${T_META}px; }
            .vk-feed .vicharak-empty { color: ${FEED_MUTED}; }
            .vk-feed .vicharak-btn-ghost { border-color: ${TODAY_BLUE}; color: ${TODAY_BLUE}; }
            .vk-feed .vicharak-btn-ghost:hover { background: var(--td-ghost-hover); }
            .vk-feed .vicharak-btn-plain { border-color: ${TODAY_BORDER}; color: ${FEED_MUTED}; }
            .vk-feed .vicharak-btn-plain:hover { background: ${TODAY_BG}; }
            .vk-feed .vk-edit-btn { color: var(--td-edit); transition: color 0.2s ease; }
            .vk-feed .vk-edit-btn:hover { color: ${FEED_MUTED}; }
            /* Add task is the one blue control on the feed — and it gradients. */
            .vk-feed .vk-add-row { border: 1px solid ${ADD_BLUE}; border-radius: 8px; color: #FFFFFF; background: ${ADD_BTN_BG}; box-shadow: ${ADD_BTN_SHADOW}; font-weight: 600; transition: filter 0.2s ease, box-shadow 0.2s ease; }
            .vk-feed .vk-add-row:hover { filter: brightness(1.07); }
            .vk-today .vicharak-btn-primary { background: ${BTN_PRIMARY_BG}; border-color: ${TODAY_BLUE}; box-shadow: ${BTN_PRIMARY_SHADOW}; }
            .vk-today .vicharak-btn-primary:hover { filter: brightness(1.07); background: ${BTN_PRIMARY_BG}; border-color: ${TODAY_BLUE}; }
            /* COMPLETED — its own quiet section under everything still active. */
            .vk-feed .vk-done-head { display: flex; align-items: center; gap: 8px; padding: 0 4px 6px; }
            .vk-feed .vk-done-head h3 { margin: 0; font-size: ${T_HEAD}px; font-weight: 600; color: ${FEED_MUTED}; }
            .vk-feed .vk-done-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px; background: ${TODAY_SUNK}; border: 1px solid ${TODAY_BORDER}; color: ${FEED_MUTED}; font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
            .vicharak-app .vk-feed input:focus, .vicharak-app .vk-feed input:focus-visible,
            .vicharak-app .vk-feed textarea:focus, .vicharak-app .vk-feed textarea:focus-visible { outline: 2px solid ${ADD_BLUE} !important; outline-offset: 2px; }
            .vicharak-app .vk-feed input::placeholder, .vicharak-app .vk-feed textarea::placeholder { color: ${FEED_FAINT}; }
          `}</style>
          {/* ONE near-white page under the whole screen. The old notebook
              rule (the blue vertical line down the content column) is gone. */}
          <div className="vk-today flex-1 flex flex-col w-full" style={{ background: TODAY_PAGE_BG }}>
          {/* [Today] The column is a FLEX COLUMN so the task feed can be
              ordered first: the header, then the tasks, then everything the
              day is measured by. Nothing is allowed to push the list down. */}
          <div className={`vk-stack vk-page-pad flex-1 w-full mx-auto px-4 sm:px-5 ${dueFlagged.length > 0 ? 'max-w-[520px] md:max-w-[880px]' : 'max-w-[520px]'}`}>
            {/* The screen header: the greeting and the ONE date this screen
                states. Scan moved to the FOOT of the feed, beside the Add
                button. The focus timer also lives at the FOOT of the screen. */}
            <header
              className="-mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 pb-2"
              style={{ background: TODAY_BG }}
              data-testid="header-today"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {/* The headline, and under it the only date on this screen:
                      no task card ever repeats it. */}
                  <h1 className="vk-greeting truncate" data-testid="text-today-greeting">
                    {timeOfDayGreeting(studentName)}
                  </h1>
                  <p className="vk-datestamp mt-0.5 truncate" data-testid="text-today-date">
                    {getSystemDate().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {/* The streak, where a student actually looks. It was only
                      on Profile before, which is the one screen nobody opens
                      daily — and a streak you cannot see does not motivate
                      anyone. Appears from day two, never as a scolding. */}
                  {streak > 0 && (
                    <span
                      className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5"
                      style={{
                        borderRadius: 999,
                        background: tint(TODAY_AMBER, 0.12),
                        border: `1px solid ${tint(TODAY_AMBER, 0.3)}`,
                        fontSize: T_META,
                        fontWeight: 600,
                        color: TODAY_AMBER_INK,
                      }}
                      data-testid="chip-today-streak"
                    >
                      <Flame className="w-3 h-3" aria-hidden="true" />
                      {streak}-day streak
                    </span>
                  )}
                  {/* [V2] Today's mood — set by Vicharee's opening question;
                      one tap re-asks it and reshapes the plan. */}
                  {moodMeta && (
                    <button
                      type="button"
                      onClick={requestMoodRecheck}
                      className="mt-1.5 ml-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 touch-manipulation"
                      style={{
                        borderRadius: 999,
                        background: tint(TODAY_BLUE, 0.07),
                        border: `1px solid ${tint(TODAY_BLUE, 0.3)}`,
                        fontSize: T_META,
                        fontWeight: 600,
                        color: TODAY_BLUE,
                      }}
                      aria-label={`Today's mood: ${moodMeta.label}. Tap to change it.`}
                      data-testid="chip-today-mood"
                    >
                      {moodMeta.emoji} {moodMeta.chipLabel}
                    </button>
                  )}
                </div>
              </div>
              {todayStatusLine && (
                <p className="mt-1.5 leading-relaxed" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-today-status">
                  {todayStatusLine}
                </p>
              )}
            </header>

            {showBacklogAlert && (
              <div
                className="mt-2 flex items-start gap-2.5 px-3.5 py-3 vicharak-rise"
                style={{ borderRadius: 8, background: TODAY_SURFACE_BG, border: `1px solid ${tint(TODAY_BLUE, 0.3)}`, boxShadow: TODAY_SHADOW }}
                data-testid="banner-fresh-start"
              >
                <VicharakAvatar size="sm" />
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: T_HEAD, fontWeight: 700, color: FEED_TEXT }}>
                    Welcome back — I've reset your plan, here's today's focus.
                  </p>
                  <p className="mt-0.5 leading-relaxed" style={{ fontSize: T_META, color: FEED_MUTED }}>
                    Your history is safe. The rest has been spread across the coming days.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBacklogDismissed(true)}
                  aria-label="Dismiss welcome back message"
                  className="w-8 h-8 -mt-1 -mr-1 flex items-center justify-center flex-shrink-0 touch-manipulation"
                  style={{ color: FEED_MUTED }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* No ultimate-goal strip here by design — Today opens on the
                greeting, the date and the list. The goal lives on Profile. */}

            {/* Premium lives in the small top-right app-header pill. Today
                deliberately carries no upgrade banner of its own. */}


            {/* ONE calm centred column — except when questions are due:
                from 768px the question deck sits as a side panel to the
                RIGHT of this main column (stacked below it on phones). */}
            <div className={`lg:mt-2${dueFlagged.length > 0 ? ' md:flex md:items-start md:gap-5' : ''}`}>
            {/* Flex column again, so the task feed sits at the very top of
                the day's column and the measurement cards follow it. */}
            <div className="min-w-0 vk-stack md:flex-1 md:max-w-[520px]">



            {/* Today's plan summary — how much of today is done, time studied
                and what's still pending. The one quiet stat surface this
                screen keeps, on every size (the desktop stat rail is gone).

                ORDER (2026-09-27): this and the pace card below carried no
                `order` at all while the task feed carried -2, so the flex
                column printed BOTH of them underneath the entire list. On a
                phone with a full day planned, the day's progress bar and the
                “Am I on track?” verdict — the product's whole promise — sat
                several screens down and were never seen. They now lead. */}
            <Card
              radius={8}
              className="mt-2 px-3.5 py-2.5 vicharak-rise"
              style={{ order: -4, background: TODAY_SURFACE_BG, border: `1px solid ${TODAY_BORDER}`, boxShadow: TODAY_PANEL_SHADOW }}
              testId="card-today-glance"
            >
              <div className="flex items-center justify-between gap-3">
                <p style={{ fontSize: T_HEAD, fontWeight: 600, color: FEED_TEXT }}>Today's plan</p>
                {/* TONE: never "0m studied" beside completed work — the line
                    only appears once real minutes exist. */}
                {todayMinutes > 0 && (
                  <p className="flex-shrink-0" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="glance-studied">
                    {formatDuration(todayMinutes)} studied
                  </p>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden" style={{ background: TODAY_SUNK, borderRadius: 2 }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round(Math.min(1, taskProgress) * 100)}%`,
                    background: TODAY_AMBER,
                    borderRadius: 2,
                    transition: 'width 0.5s ease-out',
                  }}
                />
              </div>
              {/* [Metrics] Today's slice only — revisionsDueToday is the day's
                  ask, never a backlog total. */}
              {(metrics.revisionsDueToday > 0 || dueFlagged.length > 0) && (
                <p className="mt-2" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="glance-pending">
                  Up next: {[
                    metrics.revisionsDueToday > 0 ? `${metrics.revisionsDueToday} revision${metrics.revisionsDueToday === 1 ? '' : 's'}` : null,
                    dueFlagged.length > 0 ? `${Math.min(5, dueFlagged.length)} question${Math.min(5, dueFlagged.length) === 1 ? '' : 's'} to re-solve` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </Card>

            {/* [Day 1] The first-open welcome — the plan the preview promised
                is real and waiting. Renders only on prep day 1 before the
                first completion, ABOVE the task feed (order -3), with a
                gentle pulse guiding the very first log. */}
            {day <= 1 && doneToday.length === 0 && (
              <div
                className="mt-3 px-4 py-3.5 vicharak-rise"
                style={{ order: -6, borderRadius: 8, background: TODAY_SURFACE_BG, border: `1px solid ${tint(TODAY_BLUE, 0.35)}`, boxShadow: TODAY_PANEL_SHADOW }}
                data-testid="banner-day-one-welcome"
              >
                <style>{`
                  @keyframes vkDayOnePulse { 0%, 100% { box-shadow: 0 0 0 0 ${tint(TODAY_BLUE, 0.35)}; } 50% { box-shadow: 0 0 0 7px rgba(108, 155, 255, 0); } }
                  .vk-day1-dot { animation: vkDayOnePulse 1.8s ease-in-out infinite; }
                  @media (prefers-reduced-motion: reduce) { .vk-day1-dot { animation: none; } }
                `}</style>
                <p style={{ fontSize: T_HEAD, fontWeight: 700, color: FEED_TEXT }}>
                  Your first study plan is ready {'\uD83C\uDF89'}
                </p>
                <p className="mt-1 leading-relaxed" style={{ fontSize: T_BODY, color: FEED_MUTED }}>
                  Let's log today's session — study a topic, then tap its row when you finish. I'll schedule its
                  revisions automatically.
                </p>
                <p className="mt-2 inline-flex items-center gap-2" style={{ fontSize: T_META, fontWeight: 600, color: TODAY_BLUE }}>
                  <span className="vk-day1-dot inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: TODAY_BLUE }} aria-hidden="true" />
                  {mainPending.length > 0 ? 'Start with your first topic below' : 'Add your first topic below to begin'}
                </p>
              </div>
            )}

            {/* [Day 7] The personalisation-unlock moment — one full-width
                celebration card (electric-blue #0057FF accent, subtle sheen) the first
                week earns. The once-only marker lives in useSettings; this is
                the one place it renders. */}
            {weekMilestoneOpen && (
              <div
                className="mt-3 px-4 py-4 vicharak-rise"
                style={{
                  order: -6,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(108, 155, 255, 0.10), rgba(108, 155, 255, 0.06))',
                  border: '1px solid rgba(108, 155, 255, 0.45)',
                  boxShadow: '0 8px 24px rgba(108, 155, 255, 0.14)',
                }}
                data-testid="card-week-milestone"
              >
                <style>{`
                  @keyframes vkMilestoneSheen { from { transform: translateX(-140%); } to { transform: translateX(360%); } }
                  .vk-milestone-sheen { position: relative; overflow: hidden; }
                  .vk-milestone-sheen::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 34%; background: linear-gradient(105deg, transparent, rgba(108, 155, 255, 0.16), transparent); animation: vkMilestoneSheen 2.6s ease-in-out 0.4s 2 both; }
                  @media (prefers-reduced-motion: reduce) { .vk-milestone-sheen::after { animation: none; display: none; } }
                `}</style>
                <div className="vk-milestone-sheen -m-1 p-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="inline-flex items-center gap-2" style={{ fontSize: T_META, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FEED_ACCENT_SOFT }}>
                      <Sparkles className="w-3.5 h-3.5" style={{ color: FEED_ACCENT_SOFT }} />
                      One week in
                    </p>
                    <button
                      type="button"
                      onClick={dismissWeekMilestone}
                      aria-label="Dismiss"
                      className="w-8 h-8 -mt-1.5 -mr-1.5 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                      style={{ color: FEED_MUTED }}
                      data-testid="button-dismiss-week-milestone"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="mt-1.5" style={{ fontSize: T_HEAD, fontWeight: 700, color: FEED_TEXT }}>
                    I've observed your study habits for a week.
                  </p>
                  <p className="mt-1 leading-relaxed" style={{ fontSize: T_BODY, color: FEED_MUTED }}>
                    From today, my recommendations are based on your actual learning pattern — not generic advice.
                  </p>
                </div>
              </div>
            )}

            {/* [Pace signal] "Am I on track?" is always present once the exam
                date is known, and now sits directly above the day's list
                rather than below it. Before the first log it is neutral and
                names the exact next action; only real activity unlocks
                green/amber/red. */}
            {examDateSet && (
              <Card
                radius={8}
                className="mt-3 px-3.5 py-3 vicharak-rise"
                style={{ order: -3, background: TODAY_SURFACE_BG, border: `1px solid ${tint(paceAccentColor, 0.35)}`, boxShadow: TODAY_PANEL_SHADOW }}
                testId="card-pace-signal"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{hasPaceEvidence ? pace.emoji : '○'}</span>
                  <p className="min-w-0 flex-1" style={{ fontSize: T_HEAD, fontWeight: 600, color: FEED_TEXT }}>Am I on track?</p>
                  <span
                    className="flex-shrink-0 px-2 py-0.5"
                    style={{ borderRadius: 999, fontSize: T_META, fontWeight: 700, background: tint(paceAccentColor, 0.12), color: paceAccentColor }}
                    data-testid="badge-pace-verdict"
                  >
                    {hasPaceEvidence ? pace.label : 'Waiting for first log'}
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed" style={{ fontSize: T_BODY, color: FEED_MUTED }} data-testid="text-pace-detail">
                  {paceHeadline}
                </p>
              </Card>
            )}

            {/* FIX 6 — the carry-over question is now a ONE-TIME bottom-sheet
                modal (rendered near the other sheets); carried tasks live in
                the "From yesterday" section inside the tasks card below. */}

            {/* The daily "What are you studying today?" check-in was removed
                (PART 6) — tasks come from the plan, the '+' sheet and the coach. */}

            {/* CHANGE 1/3/4 — every task for today in ONE card: checkbox + name,
                nothing else per row. Checking off draws a slow strikethrough,
                then the row settles into the visible Completed section below. */}
            {/* The hero card of the screen. One flat surface — plus a gradient
                aura behind it: a blurred blue→warm halo whose brightness
                tracks today's completion (dim at 0%, fully lit at 100%). The
                opacity-only CSS transition means it glows up smoothly with
                each checked-off task instead of jumping. */}
            {/* [Feature 3] Test-day rule — a test was taken today, so today
                stays test-only; pending items were shifted to tomorrow. */}
            {/* Order -5: the notice explains why today's list looks the way
                it does, so it has to arrive BEFORE the list. At -1 it printed
                underneath the list it was explaining. */}
            {testResults.some((r) => String(r.created_on || '').slice(0, 10) === today) && (
              <p
                className="mt-3 flex items-center gap-2 px-3.5 py-2.5 vicharak-rise"
                style={{ borderRadius: 8, background: TODAY_SURFACE_BG, border: `1px solid ${TODAY_BORDER}`, boxShadow: TODAY_SHADOW, fontSize: T_BODY, color: FEED_MUTED, order: -5 }}
                data-testid="banner-test-day"
              >
                Test day — today stays test-only; other pending items move to tomorrow.
              </p>
            )}

            {/* [AI prioritisation] The one thing to do first, and why. The
                pick comes from the same deterministic engine the coach uses
                (whatShouldIDoNow in studyEngine.ts) — it is never a guess,
                so it can state a reason. Sits directly above the list and
                only when there is something to prioritise. */}
            {nowPick && (mainPending.length > 0 || dueRevisions.length > 0) && (
              <button
                type="button"
                onClick={() => setTab('coach')}
                className="mt-3 w-full px-3.5 py-3 text-left vicharak-rise touch-manipulation"
                style={{
                  order: -3,
                  borderRadius: 8,
                  background: TODAY_SURFACE_BG,
                  border: `1px solid ${tint(TODAY_BLUE, 0.35)}`,
                  boxShadow: TODAY_PANEL_SHADOW,
                  minHeight: 56,
                }}
                data-testid="card-ai-focus"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TODAY_BLUE }} aria-hidden="true" />
                  <span style={{ fontSize: T_META, fontWeight: 600, color: TODAY_BLUE }}>
                    AI says: focus on this first
                  </span>
                </span>
                <span className="block mt-1.5" style={{ fontSize: T_HEAD, fontWeight: 600, color: FEED_TEXT }} data-testid="text-ai-focus-headline">
                  {nowPick.headline}
                </span>
                <span className="block mt-1 leading-relaxed" style={{ fontSize: T_BODY, color: FEED_MUTED }} data-testid="text-ai-focus-reason">
                  {nowPick.reason}
                </span>
              </button>
            )}

            <div className="mt-3 vicharak-rise vk-feed" style={{ animationDelay: '40ms', order: -2 }}>
            {/* ONE glass sheet for the day, capped at 480px and centered.
                Around it, the progress aura: a faint cool glow with nothing
                done, warming through the middle, and a vibrant gradient ring
                once everything is checked off. The layers cross-fade on
                opacity alone, so the glow grows smoothly per completion. */}
            <div className="vk-aura">
              <span className="vk-aura-glow vk-aura-cool" style={{ opacity: 0.55 * Math.max(0, 1 - taskProgress * 2) }} aria-hidden="true" />
              <span className="vk-aura-glow vk-aura-warm" style={{ opacity: 0.7 * Math.max(0, 1 - Math.abs(taskProgress - 0.5) * 2) }} aria-hidden="true" />
              <span className="vk-aura-glow vk-aura-bright" style={{ opacity: 0.85 * Math.max(0, (taskProgress - 0.5) * 2) }} aria-hidden="true" />
              <span className="vk-aura-ring" style={{ opacity: Math.max(0, (taskProgress - 0.4) / 0.6) }} aria-hidden="true" />
            <Card
              radius={8}
              className="relative px-2.5 pt-0 pb-2.5 overflow-hidden"
              style={{
                background: 'var(--td-glance-bg)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid var(--td-glance-border)',
                borderRadius: 8,
                boxShadow: TODAY_PANEL_SHADOW,
              }}
              testId="card-todays-tasks"
            >
              <div
                className="-mx-2.5 px-3.5 py-2 flex items-center justify-between gap-2"
                style={{ borderBottom: `1px solid ${FEED_HAIRLINE}` }}
              >
                <h2 className="min-w-0 truncate" style={{ fontSize: T_HEAD, fontWeight: 600, color: FEED_TEXT }}>Today</h2>
                {todayTaskTotal > 0 && (
                  <span className="flex-shrink-0 tabular-nums" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="glance-tasks-done">
                    {doneToday.length} of {todayTaskTotal} done
                  </span>
                )}
              </div>
              {/* [V2] The mood's one-line plan framing, from the opening check. */}
              {moodMeta && (
                <p className="px-1 pt-2" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-mood-plan-note">
                  {moodMeta.emoji} {moodMeta.planNote}
                </p>
              )}
              {mainPending.length === 0 && dueRevisions.length === 0 && carriedPending.length === 0 && doneToday.length === 0 ? (
                /* A first-run student needs one obvious thing to do, not a
                   paragraph explaining that there is nothing here. */
                <div className="mt-3 px-1.5" data-testid="empty-state-today">
                  <EmptyLine testId="text-today-empty">
                    {day <= 1
                      ? "Your first study plan starts here — add today's topic and I'll schedule the revisions."
                      : 'Nothing here yet — today is yours to fill.'}
                  </EmptyLine>
                  {/* [Start fresh] ONE suggestion from VicharakAI, never a task
                      written on the student's behalf. Tapping it opens the
                      picker so THEY choose; ignoring it costs nothing. Either
                      way it retires and never asks again. */}
                  {startedFresh && !startNudgeDone && (
                    <div className="mt-4 flex items-start gap-2.5" data-testid="bubble-start-suggestion">
                      <VicharakAvatar size="sm" />
                      <div
                        className="min-w-0 flex-1 px-3 py-2.5"
                        style={{ background: TODAY_BG, border: `1px solid ${TODAY_BORDER}`, borderRadius: 8 }}
                      >
                        <p className="leading-relaxed" style={{ fontSize: T_BODY, color: FEED_TEXT }}>
                          Want me to suggest where to start?
                        </p>
                        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              spendStartNudge(spaceId);
                              setStartNudgeDone(true);
                              setSyllabusPickerOpen(true);
                            }}
                            className="vicharak-btn vicharak-btn-primary"
                            style={{ minHeight: 40 }}
                            data-testid="button-start-suggestion-accept"
                          >
                            Yes, show me
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              spendStartNudge(spaceId);
                              setStartNudgeDone(true);
                            }}
                            className="vicharak-btn vicharak-btn-plain"
                            style={{ minHeight: 40 }}
                            data-testid="button-start-suggestion-dismiss"
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSyllabusPickerOpen(true)}
                      className={`vicharak-btn vicharak-btn-ghost${day <= 1 ? ' vk-day1-dot' : ''}`}
                      style={{ minHeight: 44 }}
                      data-testid="button-today-empty-add-task"
                    >
                      <Plus className="w-4 h-4" />
                      Add today's topic
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('doubts')}
                      className="vicharak-btn vicharak-btn-plain"
                      style={{ minHeight: 44 }}
                      data-testid="button-today-empty-snap"
                    >
                      <Camera className="w-4 h-4" />
                      Snap a mistake
                    </button>
                  </div>
                  {/* Optional and skippable — the app never guesses what was studied. */}
                  {!backfillDone && (
                    backfillOpen ? (
                      <div className="mt-3 vicharak-fade" data-testid="backfill-editor">
                        <textarea
                          autoFocus
                          value={backfillDraft}
                          onChange={(event) => setBackfillDraft(event.target.value)}
                          rows={3}
                          placeholder="One topic per line — e.g. Chemical bonding"
                          className="w-full px-3 py-2.5 resize-none"
                          style={{ fontSize: T_BODY, background: FEED_INPUT_BG, border: FEED_INPUT_BORDER, borderRadius: 8, color: FEED_TEXT }}
                          data-testid="input-backfill"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={savingBackfill}
                            onClick={() => void submitBackfill()}
                            className="flex-1 py-2.5 text-[11px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 touch-manipulation"
                            style={{ borderRadius: RADIUS.chip, background: ADD_BLUE, color: '#FFFFFF' }}
                            data-testid="button-backfill-save"
                          >
                            {savingBackfill ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add — revision starts tomorrow'}
                          </button>
                          <button
                            type="button"
                            onClick={finishBackfill}
                            className="px-4 py-2.5 text-[11px] font-semibold touch-manipulation"
                            style={{ borderRadius: RADIUS.chip, border: `1px solid ${TODAY_BORDER}`, color: FEED_MUTED, background: 'transparent' }}
                            data-testid="button-backfill-skip"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBackfillOpen(true)}
                        className="mt-3 text-[11px] font-semibold underline underline-offset-2 touch-manipulation"
                        style={{ color: FEED_MUTED }}
                        data-testid="button-backfill-open"
                      >
                        What have you studied in the last two weeks?
                      </button>
                    )
                  )}
                </div>
              ) : (
                <>
                  {/* [Revisions first] Due spaced revisions lead the day's card
                      — visually distinct (amber wash) with a count badge, so
                      they are never buried under new tasks. The weakness-first
                      top-5 slice of everything due (overdue included);
                      deferred revisions stay scheduled in storage and
                      resurface as these complete. */}
                  {dueRevisions.length > 0 && (
                    <div
                      className="mt-2 px-2 pt-1.5 pb-1.5"
                      style={{ background: tint(TODAY_AMBER, 0.07), border: `1px solid ${tint(TODAY_AMBER, 0.3)}`, borderRadius: 8 }}
                      data-testid="section-priority-revisions"
                    >
                      <div className="px-1 pt-0.5 pb-0.5 flex items-center justify-between gap-2">
                        <p style={FEED_LABEL_STYLE}>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="px-2 py-0.5 tabular-nums"
                              style={{ borderRadius: 999, fontSize: T_META, fontWeight: 700, background: tint(TODAY_AMBER, 0.2), color: TODAY_AMBER_INK }}
                              data-testid="badge-revisions-due-count"
                            >
                              {dueRevisions.length}
                            </span>
                            topic{dueRevisions.length === 1 ? '' : 's'} due for revision today
                          </span>
                        </p>
                        {/* Blank recall — recall blind, then reveal key points. */}
                        <button
                          type="button"
                          onClick={startBlankRecall}
                          className="inline-flex items-center gap-1 flex-shrink-0 underline underline-offset-2 touch-manipulation"
                          style={{ fontSize: T_META, fontWeight: 600, color: FEED_ACCENT, minHeight: 32 }}
                          data-testid="button-blank-recall"
                        >
                          <Brain className="w-3 h-3" />
                          Blank recall
                        </button>
                      </div>
                      {revisionPlan.orphanCards.length > 0 ? (
                        <ul className="vicharak-task-cards" data-testid="list-priority-revisions">
                          {revisionPlan.orphanCards.map((card) =>
                            renderTaskCard(card.head, {
                              readOnlyHead: true,
                              revisions: card.revisions,
                              testId: `revision-card-${card.head.id}`,
                            }),
                          )}
                        </ul>
                      ) : (
                        <p
                          className="mt-1 px-1.5 leading-relaxed"
                          style={{ fontSize: T_META, color: FEED_MUTED }}
                          data-testid="text-revisions-in-cards"
                        >
                          Today's revisions sit under their own task rows below — tap a why strip to mark one done.
                        </p>
                      )}
                    </div>
                  )}

                  {mainPending.length === 0 ? (
                    carriedPending.length === 0 && dueRevisions.length === 0 ? (
                      /* [FIX 8] Friendly caught-up state with a motivational sub-line. */
                      <div className="mt-3 px-1.5" data-testid="empty-state-caught-up">
                        <EmptyLine>
                          You&rsquo;re caught up — check back tomorrow. Nothing is due, and everything you&rsquo;ve
                          studied is already scheduled to come back.
                        </EmptyLine>
                      </div>
                    ) : null
                  ) : (
                    <>
                      {/* Every active task, grouped under small subject
                          headers — nothing hidden behind a toggle. */}
                      {(() => {
                        /* [§5] ONE SLICE ONLY: at most 6–8 items on Today —
                         * revisions take up to their daily cap, tasks fill the
                         * rest. Everything else stays scheduled out of view
                         * and comes forward as these complete; the held-back
                         * total is never rendered. */
                        /* [V2] The mood check widens, narrows and re-orders
                         * the slice: energetic = more items, hardest first;
                         * down = 2 items, easiest win first. */
                        const visible = orderTasksForMood(mainPending, mood, {
                          feelingByKey,
                          weakInsights: weakTopicInsights,
                        }).slice(0, moodVisibleCap(mood, dueRevisions.length));
                        const groups: Array<{ subject: string; rows: StudyItem[] }> = [];
                        for (const item of visible) {
                          const group = groups.find((entry) => entry.subject === item.subject);
                          if (group) group.rows.push(item);
                          else groups.push({ subject: item.subject, rows: [item] });
                        }
                        const showHeaders = groups.length > 1;
                        return (
                          <div className="mt-1" data-testid="list-todays-tasks">
                            {groups.map((group) => (
                              <div key={`group-${group.subject}`}>
                                {showHeaders && (
                                  <p
                                    className="px-1 pt-2 pb-0.5 flex items-center gap-1.5"
                                    style={FEED_LABEL_STYLE}
                                  >
                                    <SubjectDot subject={group.subject} size={6} />
                                    {group.subject}
                                  </p>
                                )}
                                <ul className="vicharak-task-cards">
                                  {group.rows.map((item) =>
                                    renderTaskCard(item, { hideSubject: showHeaders, collapseWhy: heavyRevisionDay }),
                                  )}
                                </ul>
                              </div>
                            ))}
                            {mainPending.length > visible.length && (
                              <p className="px-1.5 pt-2 leading-relaxed" style={{ fontSize: T_META, color: FEED_MUTED }} data-testid="text-tasks-slice">
                                This is today's slice — finish these and the next ones come forward on their own.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* FIX 6 — "From yesterday": carried-over tasks in their own
                      collapsible section (collapsed by default), visually muted.
                      The section header already says they were carried, so the
                      rows carry no extra tag. Complete or delete them like any
                      other task; their revisions sit inside them too. */}
                  {carriedPending.length > 0 && (
                    <div className="mt-3 pt-2" style={{ borderTop: `1px dashed ${FEED_HAIRLINE}` }} data-testid="section-from-yesterday">
                      <button
                        type="button"
                        onClick={() => setFromYesterdayOpen((v) => !v)}
                        aria-expanded={fromYesterdayOpen}
                        className="w-full flex items-center gap-2 px-1 py-1 text-left touch-manipulation"
                        data-testid="button-toggle-from-yesterday"
                      >
                        <span style={FEED_LABEL_STYLE}>
                          From yesterday
                        </span>
                        <span className="flex-1" />
                        <ChevronDown
                          className="w-3.5 h-3.5 transition-transform duration-300 ease-out"
                          style={{ color: FEED_MUTED, transform: fromYesterdayOpen ? 'rotate(180deg)' : undefined }}
                        />
                      </button>
                      {fromYesterdayOpen && (
                        <ul className="vicharak-fade vicharak-task-list" data-testid="list-from-yesterday">
                          {carriedPending.map((item) => {
                            const busy = busyIds.has(item.id);
                            const completing = completingIds.has(item.id);
                            const editing = inlineEditId === item.id;
                            const awaiting = awaitingRating.has(item.id);
                            return (
                              <li key={`carried-${item.id}`} className="vicharak-fade" style={{ opacity: 0.75 }}>
                                {/* Same sheet as today's rows; the section header and reduced opacity mark them as carried. */}
                                <div className={`w-full vk-feed-card${completing ? ' vk-card-glow' : ''}${awaiting && !completing ? ' vk-feed-card--ticked' : ''}`} style={{ padding: '12px 16px' }}>
                                <div className="flex items-center gap-3">
                                  {/* [§1] The checkbox TICKS the row and opens the rating
                                      chips below; the chosen chip is what finishes it.
                                      Double-tap the text to edit. */}
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => { if (!busy) toggleTick(item.id); }}
                                    aria-label={awaiting ? `Undo the tick on “${item.topic}”` : `Tick “${item.topic}” and rate it to finish`}
                                    aria-expanded={awaiting}
                                    className="w-11 h-11 -my-3 -ml-2 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-60 touch-manipulation transition-transform active:scale-90"
                                    data-testid={`carried-check-${item.id}`}
                                  >
                                    {busy ? (
                                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: FEED_MUTED }} />
                                    ) : completing || awaiting ? (
                                      <span
                                        className="w-5 h-5 flex items-center justify-center vicharak-pop"
                                        style={{ borderRadius: CHECK_RADIUS, background: TODAY_AMBER, color: '#FFFFFF', animationDuration: '0.24s' }}
                                        aria-hidden="true"
                                      >
                                        <Check className="w-3 h-3" />
                                      </span>
                                    ) : (
                                      <span
                                        className="w-5 h-5 transition-colors"
                                        style={{ borderRadius: CHECK_RADIUS, border: '2px solid #C4C9D8', background: TODAY_SURFACE }}
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                  {editing ? (
                                    <input
                                      autoFocus
                                      type="text"
                                      value={inlineEditText}
                                      onChange={(e) => setInlineEditText(e.target.value)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, item)}
                                      onBlur={() => void commitInlineEdit(item)}
                                      disabled={savingInlineEdit}
                                      className="min-w-0 flex-1 px-2.5 py-1.5 text-[13px] font-medium outline-none disabled:opacity-60"
                                      style={{ borderRadius: 6, background: FEED_INPUT_BG, border: FEED_INPUT_BORDER, color: FEED_TEXT }}
                                      data-testid={`carried-inline-edit-${item.id}`}
                                    />
                                  ) : (
                                    <span
                                      className={`min-w-0 flex-1 text-[14px] font-medium truncate select-none ${completing && item.kind !== 'revision' ? 'vicharak-strike' : ''}${item.kind === 'new' ? ' cursor-pointer transition-opacity active:opacity-60' : ''}`}
                                      style={{ color: FEED_TEXT }}
                                      onClick={() => openInlineEdit(item)}
                                      onDoubleClick={() => openInlineEdit(item)}
                                      title={item.kind === 'new' ? 'Tap to edit' : undefined}
                                      data-testid={`carried-label-${item.id}`}
                                    >
                                      {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void deleteCarriedTask(item)}
                                    aria-label={`Delete “${item.topic}”`}
                                    className="w-11 h-11 -my-3 -mr-2 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                                    style={{ color: FEED_MUTED }}
                                    data-testid={`carried-delete-${item.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                {renderRevisionRows(revisionPlan.byItemId.get(item.id))}
                                {renderRatingRow(item)}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* There is no check-in strip and no completion sheet:
                      difficulty is answered by the "How did that go?" chips
                      that sit on each card, and nowhere else. */}

                  {/* COMPLETED — a section of its own, below EVERY active
                      group. A finished card moves here (never a copy), reads
                      at 0.85 opacity and 13px, and the whole block goes to
                      display:none the moment nothing is done. */}
                  <div
                    className="mt-3 pt-2"
                    style={{ display: doneToday.length > 0 ? 'block' : 'none', borderTop: `1px solid ${FEED_HAIRLINE}` }}
                    data-testid="section-completed"
                  >
                      <div className="vk-done-head">
                        <h3>Completed</h3>
                        <span className="vk-done-count" data-testid="count-completed">{doneToday.length}</span>
                      </div>
                      <ul className="vicharak-task-list" data-testid="list-completed-tasks">
                        {doneToday.map((item) => {
                          const busy = busyIds.has(item.id);
                          /* The rating row stays until the topic HAS an
                             answer — it decides when the topic comes back.
                             Once answered it retires itself, so a finished
                             card never carries two rows of buttons. */
                          return (
                            <li key={`d-${item.id}`} className="vicharak-fade">
                              <div className="w-full vk-feed-card vk-feed-card--done" style={{ padding: '12px 16px' }}>
                                <div className="flex items-start gap-2.5">
                                {/* [§1] Only the checkbox toggles — tap to un-complete. */}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleToggle(item)}
                                  aria-label={`Mark “${item.topic}” as not done`}
                                  className="w-11 h-11 -my-3 -ml-2 flex items-center justify-center flex-shrink-0 disabled:opacity-60 touch-manipulation"
                                  data-testid={`task-check-${item.id}`}
                                >
                                  <span
                                    className="w-5 h-5 flex items-center justify-center"
                                    style={{ borderRadius: CHECK_RADIUS, background: 'rgba(255,165,0,0.18)', color: TODAY_AMBER }}
                                    aria-hidden="true"
                                  >
                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  </span>
                                </button>
                                <span className="min-w-0 flex-1 select-none">
                                  {/* A finished REVISION keeps its normal ink and no line
                                      through it; a finished study task gets both. */}
                                  <span
                                    className={`block text-[13px] font-medium truncate${item.kind === 'revision' ? '' : ' line-through'}`}
                                    style={{ color: item.kind === 'revision' ? FEED_TEXT : FEED_TEXT_DONE }}
                                  >
                                    {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                                  </span>
                                  {item.kind === 'new' &&
                                    renderRevisionRows(revisionPlan.byItemId.get(item.id), { readOnly: true })}
                                </span>
                                </div>
                                {renderRatingRow(item)}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                  </div>
                </>
              )}


              {/* ADD TASK — the FOOT of the feed: it sits BELOW the last
                  item of the day's list (never above the first), set off by
                  its own rule. The text field is always open: type a name,
                  press Enter, and it lands on today's list. The syllabus
                  picker sits directly under it, visible at the same time —
                  neither way in waits behind a tap. */}
              <div
                className="-mx-2.5 px-2.5 pt-1.5 pb-1.5 mt-2"
                style={{ borderTop: `1px solid ${FEED_HAIRLINE}` }}
                data-testid="inline-add-task"
              >
                {/* [V2] Vicharee generates the day's targets; typing a task is
                    the SECONDARY path — one quiet link that expands the add
                    box (with Scan and the syllabus picker inside it). */}
                {!manualAddOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setManualAddOpen(true);
                      requestAnimationFrame(() => inlineAddRef.current?.focus());
                    }}
                    className="w-full flex items-center justify-center gap-1.5 touch-manipulation"
                    style={{
                      minHeight: 44,
                      borderRadius: 999,
                      border: `1px dashed ${tint(ADD_BLUE, 0.45)}`,
                      fontSize: T_META,
                      fontWeight: 600,
                      color: ADD_BLUE,
                    }}
                    data-testid="button-add-manually"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add your own task
                  </button>
                ) : (
                <div className="vk-add vicharak-fade">
                  <div className="flex items-center gap-2">
                    {/* ONE tap cycles Lecture, Self-Study, Practice,
                        Revision, Other. The mousedown guard keeps the
                        field focused so the keyboard never drops. */}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const next = cycleTaskCategory(quickCategory);
                        setQuickCategory(next);
                        writeLastCategory(next);
                      }}
                      aria-label={`Category: ${quickCategory}. Tap to change.`}
                      title={`${quickCategory} — tap to change category`}
                      className="w-11 h-11 flex items-center justify-center flex-shrink-0 touch-manipulation transition-transform active:scale-90"
                      style={{ borderRadius: 8, background: TODAY_BG, border: `1px solid ${TODAY_BORDER}` }}
                      data-testid="button-inline-add-category"
                    >
                      <span className="leading-none" style={{ fontSize: T_TITLE }} aria-hidden="true">
                        {CATEGORY_EMOJI[quickCategory]}
                      </span>
                    </button>
                    {/* Mode 1 — type a name, press Enter, it lands on
                        today's list. No picker, no sheet, no second tap. */}
                    <input
                      ref={inlineAddRef}
                      type="text"
                      value={inlineDraft}
                      onChange={(e) => setInlineDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (inlineDraft ?? '').trim() && !addingTask) {
                          const draft = inlineDraft;
                          void submitQuickTitle(draft).then((saved) => {
                            if (saved) setInlineDraft((current) => (current === draft ? '' : current));
                            requestAnimationFrame(() => inlineAddRef.current?.focus());
                          });
                        }
                        if (e.key === 'Escape') setInlineDraft('');
                      }}
                      placeholder="Type a task, press Enter…"
                      className="vk-add-input"
                      data-testid="input-inline-add-task"
                    />
                    <button
                      type="button"
                      disabled={(inlineDraft ?? '').trim().length === 0 || addingTask}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const draft = inlineDraft;
                        void submitQuickTitle(draft).then((saved) => {
                          if (saved) setInlineDraft((current) => (current === draft ? '' : current));
                          requestAnimationFrame(() => inlineAddRef.current?.focus());
                        });
                      }}
                      className="vk-add-go touch-manipulation"
                      data-testid="button-inline-add-task-save"
                    >
                      Add
                    </button>
                    {/* Scan lives HERE — beside Add, so both ways of putting
                        work on today's list sit together at the foot. */}
                    <button
                      type="button"
                      onClick={() => setPhotoTasksOpen(true)}
                      aria-label="Scan a page into tasks"
                      title="Scan a page into tasks"
                      className="vk-add-scan touch-manipulation"
                      data-testid="button-scan-inline"
                    >
                      <Camera className="w-4 h-4" />
                      <span className="hidden sm:inline">Scan</span>
                    </button>
                  </div>
                  {/* Mode 2 — the syllabus picker, visible at the SAME time
                      as the text field: never instead of it, never behind
                      a tap. */}
                  <button
                    type="button"
                    onClick={() => setSyllabusPickerOpen(true)}
                    className="vk-add-syllabus touch-manipulation"
                    data-testid="button-inline-add-from-syllabus"
                  >
                    Or choose from syllabus
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                )}
              </div>

              {/* Revisions only ever come from completed work, so before the
                  first completion the card says exactly that instead of
                  showing unstudied topics in the revision queue. */}
              {doneTopicKeys.size === 0 && (
                <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: FEED_MUTED }} data-testid="text-revision-empty">
                  Complete your first study session — then we'll schedule your revisions automatically.
                </p>
              )}
            </Card>
            </div>
            </div>


            {/* This Week's Plan — ONE quiet line. The full targets screen
                (focus chapters, topic/test goals) opens from here; the old
                card with progress bars and chapter accordions moved off
                Today so the task list keeps the whole stage. */}
            <button
              type="button"
              onClick={() => openTargetsScreen('week')}
              className="mt-3 w-full px-3.5 py-2.5 flex items-center gap-3 text-left touch-manipulation"
              style={{ background: TODAY_SURFACE_BG, border: `1px solid ${TODAY_BORDER}`, borderRadius: 8, boxShadow: TODAY_SHADOW }}
              data-testid="button-weekly-plan"
            >
              <Target className="w-4 h-4 flex-shrink-0" style={{ color: FEED_MUTED }} />
              <span className="min-w-0 flex-1" style={{ fontSize: T_HEAD, fontWeight: 600, color: FEED_TEXT }}>
                {weeklyRow ? "This week's plan" : 'Plan your week'}
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: FEED_MUTED }} />
            </button>


            {/* Legacy answer queue only. New snaps receive an AI draft and
                enter revision immediately, so they never wait here. */}
            {resolveQueue.length > 0 && (
              <section className="mt-3 vicharak-rise" style={{ animationDelay: '130ms' }} data-testid="section-resolve-queue">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-[13px] font-semibold" style={{ color: FEED_MUTED }}>
                    Add your answer (optional)
                  </h2>
                  <button
                    type="button"
                    onClick={() => void doubts.bulkDismissUnresolved(resolveQueue)}
                    className="text-[11px] font-semibold touch-manipulation"
                    style={{ color: FEED_MUTED }}
                    data-testid="button-resolve-dismiss-all"
                  >
                    Dismiss all
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {resolveQueue.slice(0, 5).map((row) => (
                    <li key={`resolve-${row.id}`} className="vicharak-fade">
                      <button
                        type="button"
                        onClick={() => doubts.setResolveTarget(row)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left touch-manipulation"
                        style={{ background: TODAY_SURFACE_BG, border: `1px dashed ${TODAY_BORDER}`, borderRadius: 8, boxShadow: TODAY_SHADOW }}
                        data-testid={`resolve-row-${row.id}`}
                      >
                        {row.image_url && (
                          <img
                            src={row.image_url}
                            alt="Question"
                            className="w-12 h-12 object-cover flex-shrink-0"
                            style={{ borderRadius: 6, border: `1px solid ${TODAY_BORDER}` }}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium leading-snug" style={{ color: FEED_TEXT }}>
                            {flaggedShortTitle(row)}
                          </span>
                          <span className="block text-[11px] mt-0.5" style={{ color: FEED_MUTED }}>
                            Already scheduled — add your own answer if you want to replace the draft
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: FEED_MUTED }} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            </div>

            {/* Question Revision — shown ONLY when questions are due by
                their spaced schedule; with none due this panel does not
                render at all. From 768px it is a side panel to the RIGHT of
                the main list; below that it stacks under the list. The deck:
                one physical-feeling card (slight tilt, real shadow) with the
                next couple peeking out behind it. Swipe left = Again, swipe
                right = Got it (the same buttons sit underneath), tapping
                expands the question, Explain writes a short AI note on it. */}
            {dueFlagged.length > 0 && (
              <aside className="md:w-[300px] md:flex-shrink-0 md:sticky md:top-20" data-testid="panel-question-deck">
                <section className="mt-3 md:mt-2 vicharak-rise" style={{ animationDelay: '120ms' }} data-testid="section-question-revision">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-[13px] font-semibold" style={{ color: FEED_MUTED }}>
                      Question Revision
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('doubts')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold touch-manipulation"
                      style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(TODAY_BLUE, 0.5)}`, color: TODAY_BLUE, background: tint(TODAY_BLUE, 0.06) }}
                      data-testid="button-open-doubts"
                    >
                      <Plus className="w-3 h-3" />
                      Mistake Book
                    </button>
                  </div>
                  <QuestionRevisionDeck
                    rows={dueFlagged}
                    saving={savingFlaggedDetail}
                    canAskAi={aiAccess.canAskAi}
                    onGrade={(row, grade) => gradeFlagged(row, grade)}
                    onExplainBlocked={() => openPaywall('chat')}
                    onAiCharged={chargeAi}
                    onPersistExplanation={(row, text) => void updateDoubt(row, { ai_explanation: text }).catch(() => undefined)}
                  />
                </section>
              </aside>
            )}

            </div>

            {itemsQ.error && (
              <div
                className="mt-4 px-3.5 py-3 text-center"
                style={{ order: 3, borderRadius: 8, background: tint(DANGER, 0.08), border: `1px solid ${tint(DANGER, 0.3)}` }}
                role="alert"
                data-testid="today-sync-error"
              >
                <p style={{ fontSize: T_BODY, color: FEED_TEXT }}>
                  Your checklist couldn't refresh just now. Your saved work is still safe.
                </p>
                <button
                  type="button"
                  onClick={() => itemsQ.refresh()}
                  className="vicharak-btn vicharak-btn-primary mt-2"
                  data-testid="button-today-sync-retry"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* FOCUS TIMER — at the BOTTOM of the screen: one small, quiet pill
              floating just above the bottom nav, on the right so it never
              fights the AI button on the left. Same full-screen focus mode as
              before — only the entry point moved down here. */}
          <button
            type="button"
            onClick={() => setFocusOpen(true)}
            aria-label="Open the focus timer"
            title="Focus timer"
            className="fixed z-40 inline-flex items-center gap-1.5 px-3.5 touch-manipulation"
            style={{
              right: 16,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
              height: 34,
              borderRadius: 999,
              background: TODAY_SURFACE_BG,
              border: `1px solid ${TODAY_BORDER}`,
              boxShadow: '0 2px 8px rgba(22,31,43,.10)',
              color: FEED_MUTED,
              fontSize: T_META,
              fontWeight: 600,
            }}
            data-testid="button-focus-timer-card"
          >
            <Timer className="w-3.5 h-3.5" aria-hidden="true" />
            Timer
          </button>
          </div>

      {/* [Completion moment] A brief checkmark + confetti burst with the
          day's real summary, fired when a task lands in Completed. Pointer
          events pass through; it dismisses itself after ~1.9s. */}
      {celebration && (
        <div
          className="fixed inset-x-0 z-[64] flex justify-center pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
          aria-live="polite"
          data-testid="overlay-completion-celebration"
        >
          <style>{`
            @keyframes vkCelebratePop { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 18% { opacity: 1; transform: translateY(0) scale(1.02); } 26% { transform: scale(1); } 82% { opacity: 1; } 100% { opacity: 0; transform: translateY(-6px); } }
            @keyframes vkCelebrateTick { from { stroke-dashoffset: 22; } to { stroke-dashoffset: 0; } }
            @keyframes vkConfettiFall { 0% { opacity: 0; transform: translateY(-2px) rotate(0deg); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateY(26px) rotate(200deg); } }
            .vk-celebrate-card { animation: vkCelebratePop 1.9s ease-out both; }
            .vk-celebrate-tick { stroke-dasharray: 22; animation: vkCelebrateTick 0.4s ease-out 0.15s both; }
            .vk-confetti { position: absolute; top: 4px; width: 5px; height: 8px; border-radius: 1px; animation: vkConfettiFall 1.3s ease-in 0.1s both; }
            @media (prefers-reduced-motion: reduce) { .vk-celebrate-card { animation: none; } .vk-confetti { display: none; } .vk-celebrate-tick { animation: none; stroke-dashoffset: 0; } }
          `}</style>
          <div
            className="vk-celebrate-card relative flex items-center gap-3 px-4 py-3 mx-4"
            style={{ borderRadius: 10, background: TODAY_SURFACE_BG, border: `1px solid ${tint(SUCCESS, 0.4)}`, boxShadow: '0 10px 30px rgba(22, 31, 43, 0.18)' }}
          >
            {['#0057FF', '#0057FF', '#22C55E', '#FBBF24', '#F97316', '#0057FF'].map((color, index) => (
              <span
                key={index}
                className="vk-confetti"
                style={{ left: `${12 + index * 15}%`, background: color, animationDelay: `${0.08 * index}s` }}
                aria-hidden="true"
              />
            ))}
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: tint(SUCCESS, 0.15), color: SUCCESS }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                <path
                  className="vk-celebrate-tick"
                  d="M4 10.6 L8.1 14.6 L16 5.4"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block" style={{ fontSize: T_HEAD, fontWeight: 700, color: FEED_TEXT }}>
                Today you studied {celebration.topics} topic{celebration.topics === 1 ? '' : 's'}
              </span>
              <span className="block mt-0.5" style={{ fontSize: T_META, color: FEED_MUTED }}>
                {metrics.revisionsDueToday > 0
                  ? `${metrics.revisionsDueToday} revision${metrics.revisionsDueToday === 1 ? '' : 's'} still due today · the next one lands tomorrow`
                  : 'Next revision lands tomorrow — already scheduled.'}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* [§6] Blank Recall — topic name only; the student recalls everything,
          then reveals the key points. The silent think-timer sets the FSRS
          grade with the same implicit ladder used everywhere else. */}
      {recallOpen && (
        <div className="fixed inset-0 z-[66] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Blank recall revision">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={() => setRecallOpen(false)} aria-label="Close blank recall" />
          <div
            className="relative max-h-[85vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: TODAY_SURFACE_BG, borderTop: `1px solid ${TODAY_BORDER}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
          >
            {!recallItem ? (
              <div className="py-6 text-center" data-testid="blank-recall-done">
                <p className="text-[13px] font-semibold" style={{ color: FEED_TEXT }}>All recalled {'\uD83C\uDF89'}</p>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: FEED_MUTED }}>
                  Every due revision went through blank recall — the schedule updates itself from your timing.
                </p>
                <button
                  type="button"
                  onClick={() => setRecallOpen(false)}
                  className="mt-4 px-6 py-2.5 text-[12px] font-semibold touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, background: ADD_BLUE, color: '#FFFFFF' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: TODAY_BLUE }}>
                    <Brain className="w-3.5 h-3.5" />
                    Blank Recall · {Math.min(recallIndex + 1, recallQueue.length)}/{recallQueue.length}
                  </p>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: FEED_MUTED }} data-testid="blank-recall-timer">
                    <RecallClock startedAt={recallStartedAt} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecallOpen(false)}
                    aria-label="Close"
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-4 text-[16px] font-semibold leading-snug" style={{ color: FEED_TEXT }} data-testid="blank-recall-topic">
                  {recallItem.topic}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: subjectColor(recallItem.subject) }}>
                  <SubjectDot subject={recallItem.subject} size={5} />
                  {recallItem.subject}
                </p>
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: FEED_MUTED }}>
                  No notes, no hints — write everything you remember about this topic, then submit and I'll score it
                  against the concept. Your time before submitting sets the next revision automatically.
                </p>
                {!recallRevealedAt ? (
                  <>
                    <textarea
                      value={recallText}
                      onChange={(event) => setRecallText(event.target.value)}
                      rows={6}
                      placeholder="Everything you remember — definitions, formulas, steps, exceptions…"
                      className="mt-3 w-full px-3 py-2.5 text-[12px] resize-none"
                      style={{ background: TODAY_SURFACE_BG, border: `1px solid ${TODAY_BORDER}`, borderRadius: 6, color: FEED_TEXT }}
                      data-testid="input-blank-recall"
                    />
                    <button
                      type="button"
                      onClick={() => void submitRecall()}
                      className="mt-3 w-full py-3 text-[13px] font-semibold inline-flex items-center justify-center gap-2 touch-manipulation"
                      style={{ borderRadius: RADIUS.chip, background: ADD_BLUE, color: '#FFFFFF' }}
                      data-testid="button-blank-recall-submit"
                    >
                      <Eye className="w-4 h-4" />
                      {(recallText ?? '').trim() ? 'Check my recall' : "I can't recall this one"}
                    </button>
                  </>
                ) : (
                  <>
                    {/* The simple score — how much of the concept came back. */}
                    {recallScore !== null && (
                      <div className="mt-4 flex items-center gap-2.5 flex-wrap vicharak-fade" data-testid="blank-recall-score">
                        <span
                          className="px-3 py-1 text-[12px] font-semibold"
                          style={{
                            borderRadius: RADIUS.chip,
                            background: tint(recallScore >= 70 ? TODAY_AMBER : recallScore >= 40 ? WARNING : DANGER, 0.14),
                            color: recallScore >= 70 ? TODAY_AMBER_INK : recallScore >= 40 ? WARNING : DANGER,
                          }}
                        >
                          {recallScore}/100 recalled
                        </span>
                        <span className="text-[11px]" style={{ color: FEED_MUTED }}>
                          {recallScore >= 70
                            ? 'Strong recall — this one is sticking.'
                            : recallScore >= 40
                              ? 'Half there — close the gaps below.'
                              : 'Worth a proper re-read before the next round.'}
                        </span>
                      </div>
                    )}
                    <div
                      className="mt-3 px-3.5 py-3 vicharak-fade"
                      style={{ borderRadius: 8, background: 'rgba(255, 165, 0, 0.07)', border: '1px solid rgba(255, 165, 0, 0.28)' }}
                      data-testid="blank-recall-points"
                    >
                      {recallLoading ? (
                        <p className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: FEED_MUTED }}>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scoring your recall…
                        </p>
                      ) : (
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: FEED_TEXT }}>
                          {recallPoints}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={recallLoading}
                      onClick={() => finishRecallCard()}
                      className="mt-3 w-full py-3 text-[13px] font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                      style={{ borderRadius: RADIUS.chip, background: TODAY_AMBER, color: '#FFFFFF', boxShadow: TODAY_SHADOW }}
                      data-testid="button-blank-recall-done"
                    >
                      <Check className="w-4 h-4" />
                      {recallIndex + 1 < recallQueue.length ? 'Got it — next topic' : 'Got it — finish'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
