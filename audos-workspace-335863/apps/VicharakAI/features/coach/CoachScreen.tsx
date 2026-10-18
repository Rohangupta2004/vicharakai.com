/**
 * CoachScreen — the Vicharree chat, redesigned as a full-screen, ChatGPT-style
 * conversation surface (2026-09-29, founder request):
 *
 *  - Fills the whole viewport above the bottom nav on mobile (the shell's
 *    overlay CSS owns the positioning); a tall floating panel on desktop.
 *  - Dark premium look: deep navy canvas, dark Vicharree bubbles with light
 *    text, electric-blue user bubbles — consistent with the brand accent.
 *  - The Vicharree mascot sits FIXED in the header inside a ringed disc, so
 *    the avatar is always visible (it used to be a bare lazy-loaded image).
 *  - Input bar pinned to the bottom with safe-area padding; quick-ask pills
 *    (ChatGPT-style) ride above it, including an explicit "Upload doubt"
 *    pill next to the composer's camera button.
 *
 * State and actions still come from the feature hooks via useApp(); the
 * backend, auth and API calls are unchanged. The reply STREAMS into a live
 * bubble; a failed reply leaves a one-tap "Try again"; the trash icon clears
 * the transcript after a confirm tap; swipe-down on the header closes the
 * sheet on mobile.
 *
 * Character choreography: 'thinking' while generating, 'talking' once tokens
 * stream, 'happy' 1.5s on landing, 'error' 2s on failure, 'greeting' 1s for
 * the once-per-session greeting, else 'idle'.
 */
/* eslint-disable */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, Loader2, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { RADIUS, TEXT, TEXT_MUTED, tint } from '../../theme';
import { Card } from '../../ui';
import MarkdownText from '../../MarkdownText';
import {
  detectMentionedTopics,
  ExamContextPill,
  suggestedExamQuestions,
  TopicActionCards,
  CHAT_EXAM_META_KEY,
} from '../../ExamChatSupport';
import { COACH_QUICK_REPLIES, type CoachMessage } from './coachConfig';
import { formatDuration } from '../../engine';
import { getSyllabus } from '../../data/syllabuses';
import YoutubeRecsCard from '../today/YoutubeRecs';
import { useApp } from '../../app/AppContext';
import VicharreeCharacter, { type VicharreeState } from '../../components/VicharreeCharacter';
import { getPYQAnswer } from '../../pyq/retrieval';
import type { PYQAnswer, PYQResult } from '../../pyq/types';

/* Vicharree chat palette — THEME-AWARE since the light/dark switch became
 * real (2026-09-30). Every value is a `--chat-*` CSS variable theme.ts owns:
 * light mode paints the chat on the same paper as the rest of the app; dark
 * mode restores the premium deep-navy chat surface. The fallbacks below are
 * the dark values, matching the variables' own dark set. */
const V_NAVY_DEEP = 'var(--chat-deep, #070C22)';
const V_NAVY = 'var(--chat-panel, #0D1430)';
const V_SURFACE = 'var(--chat-surface, rgba(148, 178, 255, 0.08))';
const V_SURFACE_STRONG = 'var(--chat-surface-strong, rgba(148, 178, 255, 0.14))';
const V_EDGE = 'var(--chat-edge, rgba(148, 178, 255, 0.22))';
const V_TEXT = 'var(--chat-text, #EAF0FF)';
const V_TEXT_DIM = 'var(--chat-dim, #93A5CE)';
const V_BLUE_SOFT = 'var(--chat-accent-soft, #6C9BFF)';
/** The exact primary and deep partner from the VicharakAI logo palette. */
const V_BLUE = '#0057FF';
const V_BLUE_DEEP = '#003AB0';
/** Semantic completion only — never used by the Vicharee avatar or status. */
const V_GREEN = 'var(--chat-green, #3ECF8E)';
/** The blurred veil behind the pinned header and composer. */
const V_VEIL = 'var(--chat-veil, rgba(7, 12, 34, 0.92))';
/** Quick-reply / retry pill ink — accent text that flips with the theme. */
const V_PILL_INK = 'var(--chat-accent-soft, #6C9BFF)';

const CHAT_CSS = `
@keyframes vicharreeMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.vicharree-msg-in { animation: vicharreeMsgIn 0.25s ease-out both; }
@keyframes vicharreeDot { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }
@keyframes vicharreeThinkIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.vicharree-typing-dot { width: 6px; height: 6px; border-radius: 999px; background: ${V_BLUE_SOFT}; display: inline-block; animation: vicharreeDot 1.1s ease-in-out infinite; will-change: transform; }
.vicharree-think-row { opacity: .42; transition: opacity .22s ease, transform .22s ease; }
.vicharree-think-row[data-active="true"] { opacity: 1; animation: vicharreeThinkIn .28s ease-out both; }
.vicharree-think-row[data-done="true"] { opacity: .72; }
.vicharree-dark textarea::placeholder { color: var(--chat-placeholder, rgba(178, 198, 255, 0.45)) !important; }
.vicharree-dark ::-webkit-scrollbar { width: 0; height: 0; }
@media (prefers-reduced-motion: reduce) {
  .vicharree-msg-in, .vicharree-think-row { animation: none; }
  .vicharree-typing-dot { animation: none; }
}
`;

/** Local wall-clock time for one message — '' when the stamp is unusable. */
function messageTime(at?: number): string {
  if (!at) return '';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const ANSWER_SOURCE_LABELS: Record<string, string> = {
  official_key: 'Official Answer Key',
  community_verified: 'Community Verified',
  inferred: 'Inferred Answer',
};

/**
 * One verified-PYQ card: original question + options; the answer is revealed
 * ONLY when the student taps "Show answer" (fetched on demand, never before).
 * Deliberately a LIGHT card on the dark chat — verified questions read like
 * paper, and the ink-on-white keeps every option legible.
 */
function PYQCard({ pyq }: { pyq: PYQResult }) {
  const [answer, setAnswer] = useState<PYQAnswer | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const reveal = async () => {
    if (revealed || loading) return;
    setLoading(true);
    try {
      const found = await getPYQAnswer(pyq.id);
      setAnswer(found);
      setRevealed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-3.5 vicharree-msg-in" testId={`pyq-card-${pyq.id}`}>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: V_BLUE }}>
        {pyq.examName} {pyq.year}
        {pyq.subjectName ? ` · ${pyq.subjectName}` : ''}
        {pyq.chapterName ? ` · ${pyq.chapterName}` : ''}
      </p>
      <p className="mt-1 leading-relaxed" style={{ fontSize: '0.88rem', fontWeight: 600, color: TEXT }}>
        {pyq.questionText}
      </p>
      {pyq.options.length > 0 && (
        <div className="mt-2 space-y-1">
          {pyq.options.map((option) => {
            const isCorrect = revealed && answer?.correctOptionKey === option.key;
            return (
              <p
                key={option.key}
                className="flex items-start gap-2 px-2 py-1"
                style={{
                  fontSize: '0.82rem',
                  color: isCorrect ? 'var(--kept, #1C6B4A)' : TEXT,
                  background: isCorrect ? tint('var(--kept, #1C6B4A)', 0.1) : 'transparent',
                  borderRadius: RADIUS.sm,
                  fontWeight: isCorrect ? 700 : 500,
                }}
              >
                <span style={{ fontWeight: 700 }}>{option.key}.</span>
                <span className="min-w-0 flex-1">{option.text}</span>
              </p>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {!revealed ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void reveal()}
            className="vicharak-btn vicharak-btn-ghost"
            style={{ minHeight: 30, padding: '4px 12px' }}
            data-testid={`pyq-show-answer-${pyq.id}`}
          >
            {loading ? 'Checking…' : 'Show answer'}
          </button>
        ) : answer ? (
          <>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--kept, #1C6B4A)' }}>
              Answer: {answer.correctOptionKey ?? answer.correctValue ?? '—'}
            </span>
            <span
              className="px-2 py-0.5"
              style={{
                borderRadius: RADIUS.chip,
                fontSize: '0.68rem',
                fontWeight: 700,
                color: V_BLUE,
                background: tint(V_BLUE, 0.1),
              }}
              data-testid={`pyq-source-badge-${pyq.id}`}
            >
              {pyq.examName} {pyq.year} • {ANSWER_SOURCE_LABELS[answer.sourceType] ?? answer.sourceType}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '0.78rem', color: TEXT_MUTED }}>
            The verified answer for this one isn't loaded yet — try again in a second.
          </span>
        )}
      </div>
    </Card>
  );
}

export default function CoachScreen({ onClose }: { onClose?: () => void }) {
  const { data, toast, access, coach, syllabus, tasks, setTab } = useApp();
  const {
    profile, examDef, activeSyllabusExam, weakTopicInsights,
    upsertMeta, doneToday, missionQueue, pace, streak, todayMinutes, items,
  } = data;
  const { showToast } = toast;
  const {
    coachMessages, coachThinking, coachEndRef, askCoach,
    coachSignal, historyLoading, sendSessionGreeting,
    coachStreaming, retryableAsk, retryLastAsk, clearCoachHistory, clearingHistory,
    handleSuggestion, completePlanTask, sendDoubtPhoto, doubtUploadBusy,
  } = coach;
  /* Two-tap clear: the trash icon arms it, a second tap confirms. A
   * window.confirm() inside a mobile bottom sheet is jarring. */
  const [confirmClear, setConfirmClear] = useState(false);
  /* PERF: the composer draft is LOCAL state — each keystroke re-renders only
   * this screen, never the whole app shell. askCoach receives the text on
   * send exactly as before. */
  const [draft, setDraft] = useState('');
  const { addTopicToPlanFromChat, markTopicWeakFromChat, topicActionBusy, handledTopicIds } = syllabus;

  /* ONE hidden file input, opened by both the composer camera button and the
   * "Upload doubt" pill — so the doubt path is impossible to miss. */
  const doubtInputRef = useRef<HTMLInputElement | null>(null);
  const openDoubtPicker = () => {
    if (!historyLoading && !doubtUploadBusy) doubtInputRef.current?.click();
  };

  /* [V2] Plan-task cards resolve live against zuno_items, so a card checked
   * here (or on Today) reads done everywhere. */
  const planItemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const close = () => {
    if (onClose) onClose();
    else setTab('today');
  };

  /* ---------- character choreography ---------- */
  const [headerPulse, setHeaderPulse] = useState<VicharreeState | null>(null);

  /* Once-per-session greeting — after history restore, so it is never wiped. */
  useEffect(() => {
    if (historyLoading) return;
    if (sendSessionGreeting()) {
      setHeaderPulse('greeting');
      const timer = window.setTimeout(() => setHeaderPulse(null), 1000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // Run when history finishes loading — sendSessionGreeting is self-gating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading]);

  /* Reply arrived → happy 1.5s. Failure → error 2s. */
  useEffect(() => {
    if (!coachSignal) return undefined;
    setHeaderPulse(coachSignal.kind === 'response' ? 'happy' : 'error');
    const timer = window.setTimeout(
      () => setHeaderPulse(null),
      coachSignal.kind === 'response' ? 1500 : 2000,
    );
    return () => window.clearTimeout(timer);
  }, [coachSignal]);

  /* 'talking' the moment the reply starts streaming, 'thinking' before the
   * first token, then the happy/error pulse, then idle. */
  const characterState: VicharreeState = coachStreaming !== null
    ? 'talking'
    : coachThinking
      ? 'thinking'
      : headerPulse ?? 'idle';

  /* A visible, truthful reasoning sequence. The answer is held for at least
   * 2.3s in useCoach; this rotates through the same data sources Vicharee's
   * context actually reads while the request is in flight. */
  const latestUserText = useMemo(
    () => [...coachMessages].reverse().find((message) => message.role === 'user')?.text ?? '',
    [coachMessages],
  );
  const thinkingSteps = useMemo(() => {
    const query = (latestUserText ?? '').toLowerCase();
    if (query.includes('test') || query.includes('mock')) {
      return ['Remembering your context…', 'Reading your latest test…', 'Checking weak-topic patterns…', 'Building the next step…'];
    }
    if (query.includes('weak')) {
      return ['Remembering your context…', 'Checking recent test data…', 'Ranking your weak topics…', 'Building your suggestion…'];
    }
    if (query.includes('plan') || query.includes('today') || query.includes('study')) {
      return ['Remembering your context…', "Checking today's tasks…", 'Looking at weak topics from your last test…', 'Building your suggestion…'];
    }
    return ['Remembering your context…', "Checking today's tasks…", 'Looking at your recent progress…', 'Building your suggestion…'];
  }, [latestUserText]);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [streamVisible, setStreamVisible] = useState(false);
  useEffect(() => {
    if (!coachThinking) {
      setThinkingStep(0);
      setStreamVisible(false);
      return undefined;
    }
    setThinkingStep(0);
    setStreamVisible(false);
    const interval = window.setInterval(
      () => setThinkingStep((step) => Math.min(thinkingSteps.length - 1, step + 1)),
      575,
    );
    const reveal = window.setTimeout(() => setStreamVisible(true), 2300);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(reveal);
    };
  }, [coachThinking, thinkingSteps.length]);

  /* Swipe-down on the header closes the sheet (mobile overlay callers only). */
  const touchStartY = useRef<number | null>(null);

  const handleCrossAppIntent = (text: string): boolean => {
    const command = (text ?? '').trim().toLowerCase();
    if (/\b(show|open|take me to)\b.*\bvision board\b/.test(command)) {
      setTab('vision');
      showToast('Opening your Vision Board.');
      return true;
    }
    if (/\b(update|edit|change|rebuild)\b.*\b(my )?plan\b/.test(command)) {
      setTab('today');
      window.setTimeout(() => tasks.setSyllabusPickerOpen(true), 0);
      showToast("Opening today's plan so you can update it.");
      return true;
    }
    if (/\b(open|show)\b.*\b(test )?analysis\b/.test(command)) {
      setTab('analysis');
      showToast('Opening Test Analysis.');
      return true;
    }
    return false;
  };

  const runQuickAction = (question: string) => {
    if (historyLoading) return;
    if (handleCrossAppIntent(question)) return;
    /* deterministic=false on purpose: askCoach routes the asks it can answer
       from the student's own data (instant, free) and sends the rest to
       Vicharree, so every quick reply gets a natural answer. */
    void askCoach(question, false);
  };

  const send = () => {
    const t = (draft ?? '').trim();
    if (historyLoading || !t) return;
    setDraft('');
    if (handleCrossAppIntent(t)) return;
    void askCoach(t, false);
  };

  const starterPillStyle = {
    borderRadius: 999,
    background: V_SURFACE,
    border: `1px solid ${V_EDGE}`,
    color: V_TEXT,
  } as const;

  return (
    <div
      className="vicharree-dark flex-1 flex flex-col min-h-0"
      style={{ background: `linear-gradient(180deg, ${V_NAVY_DEEP} 0%, ${V_NAVY} 100%)` }}
    >
      <style>{CHAT_CSS}</style>

      {/* ---------- fixed header: the mascot lives here, always visible ---------- */}
      <div
        className="flex-shrink-0 px-3.5 py-2.5 flex items-center gap-2.5"
        style={{
          background: V_VEIL,
          borderBottom: `1px solid ${V_EDGE}`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(event) => {
          const startY = touchStartY.current;
          const currentY = event.touches[0]?.clientY ?? null;
          if (onClose && startY !== null && currentY !== null && currentY - startY > 70) {
            touchStartY.current = null;
            close();
          }
        }}
        data-testid="vicharree-chat-header"
      >
        {/* The living Vicharree mascot — inside a ringed disc so the avatar
            slot is NEVER blank, even while the image is still loading. */}
        <span
          className="relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: V_SURFACE_STRONG, border: `1.5px solid ${tint(V_BLUE_SOFT, 0.55)}` }}
          aria-hidden="true"
        >
          <VicharreeCharacter size={38} state={characterState} />
          {/* online dot — always brand blue, including idle state */}
          <span
            className="absolute rounded-full"
            style={{
              right: -1,
              bottom: -1,
              width: 11,
              height: 11,
              background: V_BLUE,
              border: `2px solid ${V_NAVY_DEEP}`,
            }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p style={{ color: V_TEXT, fontWeight: 800, fontSize: '1rem', lineHeight: 1.15 }}>Vicharree</p>
          <p style={{ color: V_TEXT_DIM, fontSize: '0.7rem', lineHeight: 1.2 }}>
            {coachStreaming !== null && streamVisible
              ? 'typing…'
              : coachThinking
                ? thinkingSteps[thinkingStep]
                : 'Your AI study strategist'}
          </p>
        </div>
        {/* Exam context pill — which exam grounds every AI answer. onDark:
            it sits on the navy header, so it reads white with a blue edge. */}
        <ExamContextPill
          onDark
          exam={activeSyllabusExam ?? null}
          onSelect={(examId) => {
            void upsertMeta(CHAT_EXAM_META_KEY, examId);
            showToast(`Chat is now grounded in ${getSyllabus(examId)?.name ?? 'that exam'}.`);
          }}
        />
        {/* Clear chat — armed by the first tap, confirmed by the second. */}
        {coachMessages.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                disabled={clearingHistory}
                onClick={() => {
                  setConfirmClear(false);
                  void clearCoachHistory();
                }}
                className="px-2.5 py-1.5 text-[11px] font-extrabold touch-manipulation disabled:opacity-60"
                style={{ borderRadius: RADIUS.chip, background: 'var(--chat-danger, #FF6B35)', color: '#FFFFFF' }}
                data-testid="button-coach-clear-confirm"
              >
                {clearingHistory ? 'Clearing…' : 'Clear chat'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1.5 text-[11px] font-bold touch-manipulation"
                style={{ color: V_TEXT_DIM, background: 'transparent', border: 'none' }}
                data-testid="button-coach-clear-cancel"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              aria-label="Clear this chat"
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
              style={{ border: `1px solid ${V_EDGE}`, color: V_TEXT, background: 'transparent' }}
              data-testid="button-coach-clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )
        )}
        {onClose && (
          <button
            type="button"
            onClick={close}
            aria-label="Close Vicharree"
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
            style={{ border: `1px solid ${V_EDGE}`, color: V_TEXT, background: 'transparent' }}
            data-testid="button-coach-close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ---------- transcript ---------- */}
      <div
        className={`flex-1 min-h-0 w-full max-w-[760px] mx-auto overflow-y-auto px-4 sm:px-5 pb-0 flex flex-col ${
          coachMessages.length === 0 ? 'justify-center' : ''
        }`}
      >
        <div className={coachMessages.length === 0 ? 'space-y-3 py-4' : 'mt-auto space-y-3 py-4'}>
          {/* ---------- empty / first-run state ---------- */}
          {coachMessages.length === 0 && (
            <div className="flex flex-col items-center text-center px-2 vicharak-rise" data-testid="card-coach-empty-state">
              <span
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: V_SURFACE_STRONG, border: `1.5px solid ${tint(V_BLUE_SOFT, 0.5)}` }}
              >
                <VicharreeCharacter size={84} state="idle" />
              </span>
              <p className="mt-3 text-base font-extrabold" style={{ color: V_TEXT }}>
                {historyLoading ? 'Reconnecting your saved conversation…' : "I'm Vicharree — your study strategist."}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed max-w-[340px]" style={{ color: V_TEXT_DIM }}>
                {historyLoading
                  ? 'One moment while your authenticated chat history loads.'
                  : 'I remember your plan, scores, completed work and revision gaps — and I act directly. Try "add plane motion", "mark Optics done", or ask for verified PYQs.'}
              </p>
              {/* The three standing quick replies live in ONE place — the
                  pinned row above the composer, visible in every state of
                  the chat including this one. */}
              {/* Weak-topic starters — built from the adaptation engine. */}
              {activeSyllabusExam && (
                <div className="mt-2 w-full grid grid-cols-1 gap-2" data-testid="coach-exam-starters">
                  {suggestedExamQuestions(activeSyllabusExam, weakTopicInsights).map((q) => (
                    <button
                      key={`exam-q-${q}`}
                      type="button"
                      disabled={historyLoading}
                      onClick={() => void askCoach(q, false)}
                      className="px-3.5 py-3 text-left text-xs font-bold touch-manipulation transition-transform hover:-translate-y-px disabled:opacity-50"
                      style={{
                        borderRadius: 999,
                        background: 'transparent',
                        border: `1px solid ${V_EDGE}`,
                        color: V_TEXT_DIM,
                      }}
                      data-testid={`coach-exam-starter-${q.slice(0, 16)}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Today's state, said once — it steps aside as soon as you talk. */}
          {coachMessages.length === 0 && (
            <div
              className="p-3.5 vicharak-rise"
              style={{ background: V_SURFACE, border: `1px solid ${V_EDGE}`, borderRadius: 14 }}
              data-testid="card-daily-review"
            >
              <p className="text-[11px] font-extrabold" style={{ color: V_BLUE_SOFT }}>
                Today so far
              </p>
              <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: V_TEXT_DIM }}>
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
            </div>
          )}

          {/* Near the exam, the chat's empty state also surfaces the
              ranked YouTube revision picks — same cache as Today. */}
          {coachMessages.length === 0 && <YoutubeRecsCard compact />}

          {/* conversation — Vicharree bubbles left, student bubbles right */}
          {coachMessages.map((m: CoachMessage, idx: number) =>
            m.role === 'coach' ? (
              <div key={idx} className="vicharree-msg-in" data-testid={`coach-msg-${idx}`}>
                <div
                  className="px-3.5 py-3 max-w-[92%]"
                  style={{
                    background: V_SURFACE,
                    border: `1px solid ${V_EDGE}`,
                    borderRadius: '4px 16px 16px 16px',
                    color: V_TEXT,
                  }}
                >
                  <span className="flex items-center gap-2 text-[10px] font-extrabold mb-1" style={{ color: V_BLUE_SOFT }}>
                    Vicharree
                    {messageTime(m.at) && (
                      <span style={{ color: V_TEXT_DIM, fontWeight: 600 }}>{messageTime(m.at)}</span>
                    )}
                  </span>
                  {/* Rich markdown rendering — bold, lists, headings, code
                      pills — light text on the dark bubble. */}
                  <div className="text-sm" style={{ color: V_TEXT }}>
                    <MarkdownText text={m.text} color={V_TEXT} />
                  </div>
                </div>
                {/* [V2] Daily-plan task cards — the same zuno_items rows Today
                    shows: subject + topic, WHY it's here, expected time, and
                    a checkmark that completes the task right from chat. */}
                {m.planTasks && m.planTasks.length > 0 && (
                  <div className="mt-2 space-y-2" data-testid={`coach-plan-cards-${idx}`}>
                    {m.planTasks.map((task) => {
                      const row = planItemById.get(task.itemId);
                      const done = !row || row.status !== 'pending';
                      return (
                        <div
                          key={task.itemId}
                          className="p-3 flex items-center gap-3"
                          style={{
                            background: V_SURFACE,
                            border: `1px solid ${V_EDGE}`,
                            borderRadius: 14,
                            opacity: done ? 0.6 : 1,
                          }}
                          data-testid={`coach-plan-task-${task.itemId}`}
                        >
                          <button
                            type="button"
                            disabled={done}
                            onClick={() => void completePlanTask(task.itemId)}
                            aria-label={done ? `${task.topic} is done` : `Mark ${task.topic} complete`}
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                            style={
                              done
                                ? { background: tint(V_GREEN, 0.16), color: V_GREEN, border: `1px solid ${tint(V_GREEN, 0.5)}` }
                                : { background: 'transparent', color: V_BLUE_SOFT, border: `1.5px solid ${tint(V_BLUE_SOFT, 0.55)}` }
                            }
                            data-testid={`coach-plan-complete-${task.itemId}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-[13px] font-extrabold leading-tight"
                              style={{ color: V_TEXT, textDecoration: done ? 'line-through' : 'none' }}
                            >
                              {task.kind === 'revision' ? `Revise: ${task.topic}` : task.topic}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: V_TEXT_DIM }}>
                              {task.subject} · {task.reason} · ~{formatDuration(task.estMinutes)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Verified official PYQs — data cards, never generated text. */}
                {m.pyqs && m.pyqs.length > 0 && (
                  <div className="mt-2 space-y-2" data-testid={`coach-pyq-cards-${idx}`}>
                    {m.pyqs.map((pyq) => (
                      <PYQCard key={pyq.id} pyq={pyq} />
                    ))}
                  </div>
                )}
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
                {/* [V2] ChatGPT-style quick-reply pills — one-shot follow-ups
                    that clear the moment one is tapped. */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2" data-testid={`coach-suggestions-${idx}`}>
                    {m.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        type="button"
                        disabled={coachThinking}
                        onClick={() => handleSuggestion(idx, suggestion)}
                        className="px-3.5 py-2 text-xs font-bold touch-manipulation disabled:opacity-50"
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${tint(V_BLUE_SOFT, 0.5)}`,
                          background: tint(V_BLUE_SOFT, 0.12),
                          color: V_PILL_INK,
                        }}
                        data-testid={`coach-suggestion-${suggestion.label.slice(0, 14)}`}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key={idx} className="flex flex-col items-end vicharree-msg-in" data-testid={`coach-msg-${idx}`}>
                <div
                  className="px-3.5 py-3 max-w-[85%]"
                  style={{
                    background: `linear-gradient(135deg, ${V_BLUE}, ${V_BLUE_DEEP})`,
                    borderRadius: '16px 16px 4px 16px',
                    color: '#FFFFFF',
                  }}
                >
                  {/* [V2] Doubt photo sent from the composer — thumbnail in chat. */}
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Uploaded doubt"
                      className="mb-2 w-36 max-h-44 object-cover"
                      style={{ borderRadius: 10, border: `1px solid ${tint('#FFFFFF', 0.35)}` }}
                      data-testid={`coach-doubt-thumb-${idx}`}
                    />
                  )}
                  <p className="text-sm font-semibold">{m.text}</p>
                </div>
                {messageTime(m.at) && (
                  <span className="mt-1 text-[10px] font-semibold" style={{ color: V_TEXT_DIM }}>
                    {messageTime(m.at)}
                  </span>
                )}
              </div>
            ),
          )}
          {/* The reply as it arrives — the same bubble the finished message
              lands in, so there is no jump when the stream closes. */}
          {coachStreaming !== null && coachStreaming.length > 0 && streamVisible && (
            <div className="vicharree-msg-in" data-testid="coach-streaming">
              <div
                className="px-3.5 py-3 max-w-[92%]"
                style={{
                  background: V_SURFACE,
                  border: `1px solid ${V_EDGE}`,
                  borderRadius: '4px 16px 16px 16px',
                  color: V_TEXT,
                }}
              >
                <span className="block text-[10px] font-extrabold mb-1" style={{ color: V_BLUE_SOFT }}>
                  Vicharree
                </span>
                <div className="text-sm" style={{ color: V_TEXT }}>
                  <MarkdownText text={coachStreaming} color={V_TEXT} />
                </div>
              </div>
            </div>
          )}

          {/* Multi-step reasoning display. It names the real app data being
              read instead of hiding the work behind a generic spinner. */}
          {coachThinking && (!streamVisible || coachStreaming === null || coachStreaming.length === 0) && (
            <div
              className="px-3.5 py-3 max-w-[88%] vicharree-msg-in"
              style={{ background: V_SURFACE, border: `1px solid ${V_EDGE}`, borderRadius: '4px 16px 16px 16px' }}
              data-testid="coach-thinking-steps"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 mb-2">
                <VicharreeCharacter size={24} state="thinking" />
                <span className="text-[11px] font-extrabold" style={{ color: V_BLUE_SOFT }}>Vicharree is working through it</span>
              </div>
              <div className="space-y-1.5">
                {thinkingSteps.map((step, index) => (
                  <div
                    key={step}
                    className="vicharree-think-row flex items-center gap-2 text-xs"
                    data-active={index === thinkingStep ? 'true' : 'false'}
                    data-done={index < thinkingStep ? 'true' : 'false'}
                    style={{ color: index === thinkingStep ? V_TEXT : V_TEXT_DIM }}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: index <= thinkingStep ? tint(V_BLUE_SOFT, 0.2) : 'transparent',
                        border: `1px solid ${index <= thinkingStep ? tint(V_BLUE_SOFT, 0.55) : V_EDGE}`,
                        color: V_BLUE_SOFT,
                      }}
                    >
                      {index < thinkingStep ? <Check className="w-2.5 h-2.5" /> : index === thinkingStep ? <span className="vicharree-typing-dot" style={{ width: 4, height: 4 }} /> : null}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* One-tap retry after a failed reply — no retyping. */}
          {retryableAsk && !coachThinking && (
            <button
              type="button"
              onClick={retryLastAsk}
              className="self-start flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold touch-manipulation"
              style={{
                borderRadius: 999,
                border: `1px solid ${tint(V_BLUE_SOFT, 0.5)}`,
                background: tint(V_BLUE_SOFT, 0.12),
                color: V_PILL_INK,
              }}
              data-testid="coach-retry"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </button>
          )}
        </div>
        <div ref={coachEndRef} />
      </div>

      {/* ---------- bottom: quick-reply pills + composer, pinned ----------
          [V2] THREE quick replies are ALWAYS on screen — empty state and
          mid-conversation alike — so there is never a blank "what do I type"
          moment: "What should I focus on first?", "I finished a topic" and
          "I'm struggling with something". A tap sends the pill's text as a
          real user message; Vicharree answers the first two straight from
          the student's own data and the third from the model. The "Upload
          doubt" pill rides along so the doubt path is impossible to miss. */}
      <div
        className="w-full max-w-[760px] mx-auto px-3.5 sm:px-5 pt-2 flex-shrink-0"
        style={{
          borderTop: `1px solid ${V_EDGE}`,
          background: V_VEIL,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex gap-2 overflow-x-auto pb-2 vicharak-scroll-x" data-testid="coach-quick-asks">
          {COACH_QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={historyLoading || coachThinking}
              onClick={() => runQuickAction(q)}
              className="flex-shrink-0 px-3.5 py-2 text-xs font-bold touch-manipulation disabled:opacity-50"
              style={{
                borderRadius: 999,
                background: tint(V_BLUE_SOFT, 0.12),
                border: `1px solid ${tint(V_BLUE_SOFT, 0.5)}`,
                color: V_PILL_INK,
              }}
              data-testid={`quick-ask-${q.slice(0, 12)}`}
            >
              {q}
            </button>
          ))}
          <button
            type="button"
            onClick={openDoubtPicker}
            disabled={historyLoading || doubtUploadBusy}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold touch-manipulation disabled:opacity-60"
            style={starterPillStyle}
            data-testid="coach-doubt-upload-pill"
          >
            {doubtUploadBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            Upload doubt
          </button>
        </div>
        {/* No daily limit — subscribed and trial students alike have
            unlimited AI chat; the trial-expiry paywall covers locked. */}
        <div
          className="flex items-end gap-2 p-2 pl-2"
          style={{
            borderRadius: 24,
            background: V_SURFACE_STRONG,
            border: `1px solid ${V_EDGE}`,
          }}
        >
          {/* [V2] Doubt upload — camera or gallery, straight into the chat
              and the Mistake Book's spaced-revision pipeline. */}
          <button
            type="button"
            onClick={openDoubtPicker}
            disabled={historyLoading || doubtUploadBusy}
            aria-label="Upload a doubt photo"
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation disabled:opacity-60"
            style={{ border: `1px solid ${V_EDGE}`, color: V_BLUE_SOFT, background: 'transparent' }}
            data-testid="coach-doubt-upload"
          >
            {doubtUploadBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input
            ref={doubtInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={historyLoading || doubtUploadBusy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = '';
              if (file) void sendDoubtPhoto(file);
            }}
            data-testid="coach-doubt-input"
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={historyLoading ? 'Connecting your saved chat…' : 'Ask Vicharree anything…'}
            disabled={historyLoading}
            rows={1}
            className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none text-sm py-2 min-w-0 disabled:opacity-60"
            style={{ color: V_TEXT }}
            data-testid="coach-input"
          />
          <button
            type="button"
            disabled={historyLoading || !(draft ?? '').trim() || coachThinking}
            onClick={send}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${V_BLUE}, ${V_BLUE_DEEP})`, color: '#FFFFFF' }}
            data-testid="coach-send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
