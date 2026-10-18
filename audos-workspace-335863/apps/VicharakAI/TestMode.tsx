/**
 * Test Mode — a curated MCQ test across the student's own topics.
 *
 * Three screens, all owned by App.tsx state:
 *  1. TestSetupSheet — pick topics (multi-select), question count (10/20/30)
 *     and an optional time limit. App curates from the zuno_mcq_questions bank
 *     and generates only what's missing.
 *  2. TestRunner — the exam name and the paper's subjects in the header, a
 *     countdown at the top when timed, one question at a time, free
 *     navigation, and NO answer reveal until the test is submitted.
 *  3. TestResultsView — the test's name, exam and subject(s) alongside the
 *     score, the per-topic breakdown, wrong answers with explanations, the
 *     weak topics (<60%) marked for priority revision, and "Upload Mistake",
 *     which photographs a wrong question straight into the Mistake Book.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, NotebookPen, Trophy, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  tint,
} from './theme';
import { SubjectDot } from './ui';
import {
  MCQ_LETTERS,
  TEST_COUNTS,
  TEST_TIME_LIMITS,
  WEAK_TOPIC_THRESHOLD,
  formatCountdown,
  optionText,
  percentOf,
  type McqLetter,
  type TopicBreakdown,
} from './mcq';
import { WRONG_REASONS, WRONG_REASON_FOLLOWUPS, type WrongReason } from './config/sharedConfig';
import type { PlayableQuestion } from './QuizSheets';

export interface TestTopicOption {
  subject: string;
  topic: string;
  key: string;
  /** Questions already in the bank for this topic. */
  bankCount: number;
}

export interface TestConfig {
  topics: TestTopicOption[];
  count: number;
  timeLimitMinutes: number | null;
}

/* ------------------------------------------------------------------ */
/*  1 · Setup                                                          */
/* ------------------------------------------------------------------ */

export function TestSetupSheet({
  topics,
  preparing,
  prepareNote,
  error,
  completedTopicKeys,
  onStart,
  onClose,
}: {
  topics: TestTopicOption[];
  preparing: boolean;
  /** Progress line while questions are being curated/generated. */
  prepareNote: string | null;
  error: string | null;
  /** topicKey()s the student has already studied — drives the 80% readiness
   * meter and the “Revise theory, then attempt” recommendations. */
  completedTopicKeys?: Set<string>;
  onStart: (config: TestConfig) => void;
  onClose: () => void;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [count, setCount] = useState<number>(10);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);

  const toggle = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selected = topics.filter((t) => selectedKeys.has(t.key));

  /* [Feature 3] Syllabus readiness while picking topics — the target is
   * 80% of the test's syllabus completed before test day. */
  const READINESS_TARGET = 80;
  const studiedCount = completedTopicKeys ? selected.filter((t) => completedTopicKeys.has(t.key)).length : 0;
  const notStudied = completedTopicKeys ? selected.filter((t) => !completedTopicKeys.has(t.key)) : [];
  const readinessPercent = selected.length > 0 ? Math.round((studiedCount / selected.length) * 100) : 0;
  const chunkPerDay = Math.max(1, Math.ceil(selected.length / 7));

  const pill = (active: boolean) =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Take a test">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={preparing ? undefined : onClose} aria-label="Close test setup" />
      <div
        className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Trophy className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Take a Test</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>Curated MCQs — answers revealed only after you submit.</p>
          </div>
          <button type="button" disabled={preparing} onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
          1 · Topics ({selected.length} selected)
        </p>
        {topics.length === 0 ? (
          <p
            className="mt-2 px-3.5 py-3 text-[12px] leading-relaxed"
            style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.1), border: `1px solid ${tint(AMBER, 0.35)}`, color: TEXT_SECONDARY }}
            data-testid="text-test-no-topics"
          >
            Add topics to your plan first — the test pulls from what you're actually studying.
          </p>
        ) : (
          <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
            {topics.map((t) => {
              const active = selectedKeys.has(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggle(t.key)}
                  aria-pressed={active}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left touch-manipulation"
                  style={{
                    borderRadius: RADIUS.md,
                    background: active ? tint(AMBER, 0.1) : NAVY_ALT,
                    border: `1.5px solid ${active ? tint(AMBER, 0.55) : BORDER}`,
                  }}
                  data-testid={`test-topic-${t.key}`}
                >
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? AMBER : BORDER, color: active ? '#FFFFFF' : TEXT_MUTED }}
                  >
                    {active && <Check className="w-3 h-3" />}
                  </span>
                  <SubjectDot subject={t.subject} size={6} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate" style={{ color: TEXT }}>{t.topic}</span>
                    <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                      {t.subject}{t.bankCount > 0 ? ` · ${t.bankCount} in bank` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* [Feature 3] 80% readiness target + outside-current-plan topics as
            “Revise theory, then attempt” recommendation cards. */}
        {selected.length > 0 && (
          <div className="mt-3 px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }} data-testid="test-readiness">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold" style={{ color: TEXT_SECONDARY }}>Test syllabus completed</p>
              <p className="text-[11px] font-extrabold tabular-nums" style={{ color: readinessPercent >= READINESS_TARGET ? SUCCESS : WARNING }} data-testid="test-readiness-percent">
                {readinessPercent}% · target {READINESS_TARGET}%
              </p>
            </div>
            <div className="mt-1.5 relative h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
              <div className="h-full rounded-full" style={{ width: `${readinessPercent}%`, background: readinessPercent >= READINESS_TARGET ? SUCCESS : BRAND_GRADIENT, transition: 'width 0.4s ease' }} />
              <span className="absolute top-0 bottom-0 w-[2px]" style={{ left: `${READINESS_TARGET}%`, background: TEXT_MUTED }} aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
              Aim for {READINESS_TARGET}% of the test's topics studied before test day. Start about a week early —
              subject-wise, or ~{chunkPerDay} topic{chunkPerDay === 1 ? '' : 's'} a day (n/7).
            </p>
            {notStudied.length > 0 && (
              <div className="mt-2 space-y-1.5" data-testid="test-revise-first">
                {notStudied.slice(0, 4).map((t) => (
                  <p key={t.key} className="flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold" style={{ borderRadius: RADIUS.sm, background: tint(WARNING, 0.1), border: `1px solid ${tint(WARNING, 0.35)}`, color: TEXT_SECONDARY }}>
                    <span aria-hidden="true">📖</span>
                    <span className="min-w-0 flex-1 truncate">{t.topic}</span>
                    <span className="flex-shrink-0 font-extrabold" style={{ color: WARNING }}>Revise theory, then attempt</span>
                  </p>
                ))}
                {notStudied.length > 4 && (
                  <p className="text-[10px]" style={{ color: TEXT_MUTED }}>+{notStudied.length - 4} more not studied yet</p>
                )}
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>2 · Questions</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {TEST_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(count === n)} data-testid={`test-count-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>3 · Time limit (optional)</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button type="button" onClick={() => setTimeLimit(null)} className="py-2.5 text-[13px] font-extrabold touch-manipulation" style={pill(timeLimit === null)} data-testid="test-time-none">
            None
          </button>
          {TEST_TIME_LIMITS.map((m) => (
            <button key={m} type="button" onClick={() => setTimeLimit(m)} className="py-2.5 text-[13px] font-extrabold touch-manipulation" style={pill(timeLimit === m)} data-testid={`test-time-${m}`}>
              {m}m
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-test-error">
            {error}
          </p>
        )}

        {/* With nothing selected the button says so and reads as unavailable
            — it used to look live, and tapping it did nothing at all. */}
        <button
          type="button"
          disabled={preparing || selected.length === 0}
          aria-disabled={preparing || selected.length === 0}
          onClick={() => onStart({ topics: selected, count, timeLimitMinutes: timeLimit })}
          className="mt-5 w-full py-4 text-base font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation"
          style={
            selected.length === 0 && !preparing
              ? { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_MUTED, cursor: 'not-allowed' }
              : { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, opacity: preparing ? 0.6 : 1 }
          }
          data-testid="button-start-test"
        >
          {preparing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{prepareNote || 'Preparing your test…'}</>
          ) : selected.length === 0 ? (
            topics.length === 0 ? 'Add topics to your plan first' : 'Pick at least one topic'
          ) : error ? (
            'Retry'
          ) : (
            `Start ${count}-question test`
          )}
        </button>
        {!preparing && (
          <p className="mt-2.5 text-[11px] text-center" style={{ color: TEXT_MUTED }} data-testid="hint-start-test">
            {selected.length === 0
              ? topics.length === 0
                ? 'Add a task or two on Today, then come back — the test is built from your own plan.'
                : 'Tick the topics above to build your test.'
              : 'Vetted exam-bank questions come first; anything missing is generated fresh.'}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · Runner — no reveal until submit                                */
/* ------------------------------------------------------------------ */

/** Swipe further than this (px) and the deck moves to the next/previous question. */
const SWIPE_NAV_PX = 56;

/**
 * The deck's own surface: the same premium dark card the Mistake Book's
 * single-question review uses, so a saved question looks the same whether it
 * is reviewed on its own or inside a practice run. Scoped to `.vk-run` — no
 * other screen inherits any of it.
 */
const RUNNER_CSS = `
.vk-run { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.vk-run * { font-family: inherit; }
.vk-run-sheet { position: absolute; border-radius: 16px; height: 44px; background: #232744; border: 1px solid rgba(255,255,255,0.07); }
.vk-run-sheet-1 { top: -9px; left: 14px; right: 14px; opacity: 0.9; }
.vk-run-sheet-2 { top: -18px; left: 30px; right: 30px; opacity: 0.55; }
.vk-run-card { position: relative; display: flex; flex-direction: column; overflow: hidden; background: #1A1A2E; border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; box-shadow: 0 28px 70px rgba(6,8,24,0.55); }
.vk-run-head { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 14px 20px 0; }
.vk-run-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: rgba(77,141,255,0.14); border: 1px solid rgba(77,141,255,0.45); color: #9DBFFF; font-size: 12px; font-weight: 700; }
.vk-run-count { font-size: 12px; font-weight: 600; color: #9AA2C4; font-variant-numeric: tabular-nums; }
.vk-run-clock { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #9AA2C4; font-variant-numeric: tabular-nums; }
.vk-run-clock-urgent { color: #FF8E7E; }
.vk-run-icon { width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); color: #C6CCE8; flex-shrink: 0; transition: background-color 0.18s ease; }
.vk-run-icon:hover { background: rgba(255,255,255,0.17); }
.vk-run-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px 20px 18px; }
.vk-run-question { color: #F4F6FF; font-size: 17px; line-height: 1.45; font-weight: 600; white-space: pre-wrap; }
.vk-run-option { width: 100%; display: flex; align-items: flex-start; gap: 12px; min-height: 48px; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.12); color: #D6DAF0; text-align: left; font-size: 14px; font-weight: 500; line-height: 1.4; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.14s ease; }
.vk-run-option:hover { border-color: rgba(77,141,255,0.55); background: rgba(77,141,255,0.10); }
.vk-run-option:active { transform: scale(0.99); }
.vk-run-option-on { background: #0057FF; border-color: #0057FF; color: #FFFFFF; }
.vk-run-letter { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.10); color: #B9C0DE; }
.vk-run-option-on .vk-run-letter { background: rgba(255,255,255,0.18); color: #FFFFFF; }
.vk-run-foot { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 20px 14px; }
.vk-run-nav { display: inline-flex; align-items: center; gap: 5px; min-height: 48px; padding: 0 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #D6DAF0; font-size: 13px; font-weight: 700; transition: background-color 0.16s ease; }
.vk-run-nav:not(:disabled):hover { background: rgba(255,255,255,0.13); }
.vk-run-nav:disabled { opacity: 0.35; }
.vk-run-go { display: inline-flex; align-items: center; gap: 6px; min-height: 48px; padding: 0 22px; border-radius: 12px; background: #0057FF; border: 1px solid #0057FF; color: #FFFFFF; font-size: 13px; font-weight: 700; transition: background-color 0.16s ease; }
.vk-run-go:hover { background: #2E6FE8; }
/* Submit is deliberately NOT the same blue as Next — a green, so the last
   tap of the paper can never be mistaken for one more page turn. */
.vk-run-go-submit { background: #1F9D63; border-color: #1F9D63; }
.vk-run-go-submit:hover { background: #17814F; }
.vk-run-bar { flex-shrink: 0; height: 4px; background: rgba(255,255,255,0.08); }
.vk-run-bar > span { display: block; height: 100%; background: #4D8DFF; border-radius: 0 999px 999px 0; transition: width 0.25s ease; }
.vk-run-bar-urgent > span { background: #E24A3A; }
.vk-run-body::-webkit-scrollbar { width: 6px; }
.vk-run-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
`;

/**
 * One question's stem, image and options — memoized (PERF) so the once-a-
 * second countdown tick and the swipe-drag frames re-render only the card
 * chrome, never the question text and four option buttons. Its props only
 * change when the student moves to another question or picks an answer.
 */
const RunnerQuestionBody = memo(function RunnerQuestionBody({
  question,
  picked,
  onChoose,
}: {
  question: PlayableQuestion;
  picked: McqLetter | null;
  onChoose: (letter: McqLetter) => void;
}) {
  return (
    <>
      <h2 className="vk-run-question" data-testid="text-test-question">
        {question.question}
      </h2>

      {question.image_url && (
        <img
          src={question.image_url}
          alt="Question attachment"
          className="mt-3 max-h-44 object-contain"
          style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: '#0F1120' }}
        />
      )}

      <div className="mt-4 space-y-2">
        {MCQ_LETTERS.map((letter) => {
          const active = picked === letter;
          return (
            <button
              key={letter}
              type="button"
              onClick={() => onChoose(letter)}
              aria-pressed={active}
              className={`vk-run-option${active ? ' vk-run-option-on' : ''} touch-manipulation`}
              data-testid={`test-option-${letter}`}
            >
              <span className="vk-run-letter">{letter}</span>
              <span className="pt-0.5">{optionText(question, letter)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
});

/**
 * The FOCUSED QUESTION DECK (exam-like by design): one centred card holding
 * ONLY the question text, the A–D options and the answer interaction. No
 * source names, no subject/topic lines, no metadata — all of that stays on
 * the record and the results screen. A small unobtrusive timer sits in the
 * top corner, and a horizontal swipe moves between questions with a fast,
 * subtle slide — no bouncing, no scaling.
 */
export function TestRunner({
  questions,
  timeLimitMinutes,
  examName,
  testName,
  onSubmit,
  onCancel,
}: {
  questions: PlayableQuestion[];
  timeLimitMinutes: number | null;
  /** Kept on the record for results — deliberately NOT shown while solving. */
  examName?: string | null;
  /** Kept on the record for results — deliberately NOT shown while solving. */
  testName?: string | null;
  onSubmit: (answers: Array<McqLetter | null>, durationSeconds: number) => void;
  onCancel: () => void;
}) {
  /* Provenance stays off the solving screen by design. */
  void examName;
  void testName;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<McqLetter | null>>(() => questions.map(() => null));
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes ? timeLimitMinutes * 60 : null);
  /* Swipe state: live drag offset + the short settle animation direction. */
  const [dragX, setDragX] = useState(0);
  const [slideFrom, setSlideFrom] = useState<0 | 1 | -1>(0);
  const dragFromRef = useRef<number | null>(null);
  const startedAtRef = useRef(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);

  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answersRef.current, Math.round((Date.now() - startedAtRef.current) / 1000));
  };

  /* The countdown — hits zero, the test submits itself with whatever is filled. */
  useEffect(() => {
    if (secondsLeft === null) return undefined;
    if (secondsLeft <= 0) {
      submit();
      return undefined;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const question = questions[index];
  const answeredCount = answers.filter((a) => a !== null).length;
  const last = index === questions.length - 1;
  const urgent = secondsLeft !== null && secondsLeft <= 60;

  /* Stable per-question handler so the memoized question body only re-renders
   * when the question (or the picked answer) actually changes. */
  const choose = useCallback(
    (letter: McqLetter) =>
      setAnswers((prev) => prev.map((a, i) => (i === index ? (a === letter ? null : letter) : a))),
    [index],
  );

  /** Controlled slide to another question — fast and subtle, never dramatic. */
  const goTo = (nextIndex: number, direction: 1 | -1) => {
    if (nextIndex < 0 || nextIndex > questions.length - 1 || nextIndex === index) return;
    setIndex(nextIndex);
    setSlideFrom(direction);
    requestAnimationFrame(() => requestAnimationFrame(() => setSlideFrom(0)));
  };

  const handleDragStart = (clientX: number) => {
    dragFromRef.current = clientX;
  };
  const handleDragMove = (clientX: number) => {
    if (dragFromRef.current === null) return;
    const delta = clientX - dragFromRef.current;
    // Resist at the deck's edges so the first/last card doesn't fly away.
    const blocked = (delta > 0 && index === 0) || (delta < 0 && last);
    setDragX(blocked ? delta * 0.25 : delta * 0.6);
  };
  const handleDragEnd = () => {
    if (dragFromRef.current === null) return;
    const delta = dragX;
    dragFromRef.current = null;
    setDragX(0);
    if (delta <= -SWIPE_NAV_PX && !last) goTo(index + 1, 1);
    else if (delta >= SWIPE_NAV_PX && index > 0) goTo(index - 1, -1);
  };

  if (!question) {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Test unavailable"
        style={{ background: OVERLAY_BG }}
      >
        <div className="w-full max-w-sm p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}`, borderRadius: RADIUS.lg }}>
          <Trophy className="w-7 h-7 mx-auto" style={{ color: AMBER }} />
          <h2 className="mt-3 text-base font-extrabold" style={{ color: TEXT }}>This test has no questions yet</h2>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            Go back and choose another topic, then try preparing the test again.
          </p>
          <button type="button" onClick={onCancel} className="vicharak-btn vicharak-btn-primary mt-4 w-full">
            Back to test setup
          </button>
        </div>
      </div>
    );
  }

  const dragging = dragFromRef.current !== null;
  const cardTransform = dragging
    ? `translateX(${dragX}px)`
    : slideFrom !== 0
      ? `translateX(${slideFrom * 24}px)`
      : 'translateX(0)';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Test in progress"
      style={{
        background: 'rgba(8, 10, 24, 0.72)',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <style>{RUNNER_CSS}</style>
      {/* THE DECK — two sheets peeking out behind the live card, so the run
          reads as a pile of questions rather than a form. */}
      <div className="vk-run relative w-full" style={{ maxWidth: 560 }}>
        <span className="vk-run-sheet vk-run-sheet-2" aria-hidden="true" />
        <span className="vk-run-sheet vk-run-sheet-1" aria-hidden="true" />
        <div
          className="vk-run-card"
          style={{
            maxHeight: '88vh',
            transform: cardTransform,
            opacity: dragging ? Math.max(0.75, 1 - Math.abs(dragX) / 400) : slideFrom !== 0 ? 0.6 : 1,
            transition: dragging ? 'none' : 'transform 0.18s ease-out, opacity 0.18s ease-out',
            touchAction: 'pan-y',
          }}
          onTouchStart={(event) => handleDragStart(event.touches[0].clientX)}
          onTouchMove={(event) => handleDragMove(event.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
          onTouchCancel={handleDragEnd}
          data-testid="card-test-question"
        >
          <div className="vk-run-head">
            <span className="vk-run-badge">Q{index + 1}</span>
            <span className="vk-run-count" data-testid="text-test-progress">
              {index + 1} / {questions.length}
            </span>
            <span className="flex-1" aria-hidden="true" />
            {secondsLeft !== null && (
              <span
                className={`vk-run-clock${urgent ? ' vk-run-clock-urgent' : ''}`}
                data-testid="text-test-countdown"
              >
                {formatCountdown(secondsLeft)}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Leave the test? Your answers will be lost.')) onCancel();
              }}
              aria-label="Abandon test"
              className="vk-run-icon touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nothing but the question and its choices — swipe moves the deck. */}
          <div className="vk-run-body">
            <RunnerQuestionBody question={question} picked={answers[index]} onChoose={choose} />

            {last && answeredCount < questions.length && (
              <p className="mt-3 text-[11px] text-center" style={{ color: '#7F88AC' }}>
                {questions.length - answeredCount} unanswered — they count as wrong once you submit.
              </p>
            )}
          </div>

          {/* Minimal controls — swipe does the same job. */}
          <div className="vk-run-foot">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => goTo(index - 1, -1)}
              aria-label="Previous question"
              className="vk-run-nav touch-manipulation"
              data-testid="button-test-prev"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            {last ? (
              <button type="button" onClick={submit} className="vk-run-go vk-run-go-submit touch-manipulation" data-testid="button-test-submit">
                <Check className="w-4 h-4" />
                Submit · {answeredCount}/{questions.length}
              </button>
            ) : (
              <button type="button" onClick={() => goTo(index + 1, 1)} className="vk-run-go touch-manipulation" data-testid="button-test-next">
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress — a slim rule across the foot of the card. */}
          <div className={`vk-run-bar${urgent ? ' vk-run-bar-urgent' : ''}`} aria-hidden="true" data-testid="test-progress-bar">
            <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3 · Results                                                        */
/* ------------------------------------------------------------------ */

export interface TestReview {
  score: number;
  total: number;
  /** Wall-clock seconds the run took — shown as “Time taken” on results. */
  durationSeconds?: number | null;
  breakdown: TopicBreakdown[];
  wrong: Array<{ question: PlayableQuestion; picked: McqLetter | null }>;
  weakTopics: string[];
  /** Why the AI weighted the paper the way it did — one line per topic picked. */
  curationNotes?: string[];
  /** The coach's closing analysis: the main gap, in plain student language. */
  analysis?: string | null;
  /** Unique official practice pages used by shared-bank questions in this paper. */
  officialSources?: Array<{ label: string; url: string }>;
  /** Mistake Book runs only: how many entries were cleared. */
  clearedCount?: number;
  /** The student's exam, shown on the results header. */
  examName?: string | null;
  /** This paper's name, e.g. "NEET Test #4" — also the Mistake Book source. */
  testName?: string | null;
}

/** Colour banding for the results screen — green ≥70%, amber 50–69%, red <50%. */
function scoreAccent(percent: number): string {
  if (percent >= 70) return SUCCESS;
  if (percent >= 50) return WARNING;
  return DANGER;
}

/** Large circular progress ring — the hero of the results screen. */
function ScoreRing({ percent, size = 148 }: { percent: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const accent = scoreAccent(clamped);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% accuracy`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: BORDER }} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ stroke: accent, transition: 'stroke-dasharray 0.8s ease-out' }}
      />
      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fill: TEXT, fontSize: size * 0.24, fontWeight: 800 }}>
        {clamped}%
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" style={{ fill: TEXT_MUTED, fontSize: size * 0.08, fontWeight: 700, letterSpacing: 1 }}>
        ACCURACY
      </text>
    </svg>
  );
}

export function TestResultsView({
  review,
  onClose,
  onLogWrongReason,
  onUploadMistake,
}: {
  review: TestReview;
  onClose: () => void;
  /** Opens the Mistake Book photo capture, tagged with this test. */
  onUploadMistake?: (sourceLabel: string, subject: string) => void;
  /** [Feature 3] Files the wrong answer + its ONE reason into the mistake
   * book (and triggers the reason's side effects). Optional — older callers
   * without it simply hide the reason chips. */
  onLogWrongReason?: (question: PlayableQuestion, picked: McqLetter | null, reason: WrongReason) => Promise<void>;
}) {
  const percent = percentOf(review.score, review.total);
  /* One reason per wrong answer — chips lock in once picked. */
  const [reasonByIndex, setReasonByIndex] = useState<Record<number, WrongReason>>({});
  const [savingReasonIndex, setSavingReasonIndex] = useState<number | null>(null);

  const pickReason = async (index: number, question: PlayableQuestion, picked: McqLetter | null, reason: WrongReason) => {
    if (!onLogWrongReason || reasonByIndex[index] || savingReasonIndex !== null) return;
    setSavingReasonIndex(index);
    try {
      await onLogWrongReason(question, picked, reason);
      setReasonByIndex((prev) => ({ ...prev, [index]: reason }));
    } catch {
      /* the hook already toasted — the chips stay tappable for a retry */
    } finally {
      setSavingReasonIndex(null);
    }
  };

  const accent = scoreAccent(percent);
  /* The paper's subjects come straight from its own per-topic breakdown. */
  const paperSubjects = Array.from(new Set(review.breakdown.map((entry) => entry.subject).filter(Boolean)));
  const testLabel = review.testName?.trim() || `${review.examName?.trim() || 'Test'} result`;
  const weakAreas = review.breakdown
    .map((entry) => ({ ...entry, percent: percentOf(entry.correct, entry.total) }))
    .filter((entry) => entry.percent < 70)
    .sort((a, b) => a.percent - b.percent);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label="Test results" style={{ background: OVERLAY_BG }}>
      <div
        className="flex-1 flex flex-col max-w-[600px] w-full mx-auto min-h-0 px-4 py-5"
        style={{
          paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl px-5 py-6 vicharak-sheet" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] truncate" style={{ color: TEXT_MUTED }} data-testid="text-results-header-exam">
                {review.examName || 'Test results'}
                {paperSubjects.length > 0 ? ` · ${paperSubjects.join(' · ')}` : ''}
              </p>
              <p className="text-sm font-extrabold truncate" style={{ color: TEXT }} data-testid="text-results-test-name">
                {testLabel}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close results" className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center text-center">
            <ScoreRing percent={percent} />
            <h2 className="mt-3 text-[15px] font-extrabold" style={{ color: accent }} data-testid="text-test-score">
              {percent >= 70 ? '🏆 Strong run' : percent >= 50 ? '🎉 Getting there' : '💪 Keep at it'} — {review.score} / {review.total} correct
            </h2>
          </div>

          {/* Upload Mistake — the same camera/gallery capture the Mistake Book
              uses; the saved entry is tagged with this test. */}
          {onUploadMistake && (
            <>
              <button
                type="button"
                onClick={() => onUploadMistake(testLabel, paperSubjects[0] || review.breakdown[0]?.subject || 'General')}
                className="mt-4 w-full py-3.5 text-sm font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation transition-transform active:scale-[0.98]"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 8px 20px rgba(0,87,255,0.32)' }}
                data-testid="button-results-upload-mistake"
              >
                <NotebookPen className="w-4 h-4" />
                Upload Mistake
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-center" style={{ color: TEXT_MUTED }}>
                Snap the questions you got wrong — they save to your Mistake Book as “From: {testLabel}” and join the
                spaced revision queue.
              </p>
            </>
          )}

          {/* Correct · Time taken · Accuracy — one glanceable stats row. */}
          <div className="mt-4 grid grid-cols-3 gap-2" data-testid="test-score-stats">
            {[
              { label: 'Correct', value: `${review.score}/${review.total}`, tone: TEXT },
              {
                label: 'Time taken',
                value:
                  typeof review.durationSeconds === 'number' && review.durationSeconds > 0
                    ? formatCountdown(review.durationSeconds)
                    : '—',
                tone: TEXT,
              },
              { label: 'Accuracy', value: `${percent}%`, tone: accent },
            ].map((stat) => (
              <div
                key={stat.label}
                className="px-2 py-3 text-center"
                style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }}
              >
                <p className="text-[16px] font-extrabold leading-none" style={{ color: stat.tone }}>{stat.value}</p>
                <p className="mt-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Weak areas — called out right under the score when accuracy < 70%. */}
          {percent < 70 && (
            <div
              className="mt-4 px-3.5 py-3"
              style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.08), border: `1px solid ${tint(DANGER, 0.3)}` }}
              data-testid="section-weak-areas"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: DANGER }}>Weak areas detected</p>
              {weakAreas.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {weakAreas.map((w) => (
                    <li key={`${w.subject}|${w.topic}`} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate font-bold" style={{ color: TEXT }}>{w.topic}</span>
                      <span className="flex-shrink-0 font-extrabold" style={{ color: w.percent < 50 ? DANGER : WARNING }}>
                        {w.correct}/{w.total} · {w.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                  Accuracy is under 70% — review the wrong answers below and revise those topics before the next attempt.
                </p>
              )}
            </div>
          )}

          {(review.curationNotes ?? []).length > 0 && (
            <div className="mt-6" data-testid="test-curation-notes">
              <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Why these questions</p>
              <ul className="mt-2 space-y-1.5">
                {(review.curationNotes ?? []).map((note, i) => (
                  <li key={i} className="text-[12px] leading-relaxed flex gap-2" style={{ color: TEXT_SECONDARY }}>
                    <span aria-hidden="true" style={{ color: AMBER }}>•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(review.officialSources ?? []).length > 0 && (
            <div className="mt-5" data-testid="test-official-sources">
              <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Official practice sources</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(review.officialSources ?? []).map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-[11px] font-bold underline underline-offset-2"
                    style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.1), color: AMBER, border: `1px solid ${tint(AMBER, 0.35)}` }}
                  >
                    {source.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>By topic</p>
          <div className="mt-2 space-y-2.5">
            {review.breakdown.map((entry) => {
              const topicPercent = percentOf(entry.correct, entry.total);
              const weak = topicPercent < WEAK_TOPIC_THRESHOLD;
              return (
                <div key={`${entry.subject}|${entry.topic}`} data-testid={`test-breakdown-${entry.topic.slice(0, 24)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold truncate" style={{ color: TEXT }}>
                      <SubjectDot subject={entry.subject} size={6} />
                      {entry.topic}
                    </span>
                    <span className="text-[11px] font-extrabold flex-shrink-0" style={{ color: weak ? DANGER : SUCCESS }}>
                      {entry.correct}/{entry.total} · {topicPercent}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                    <div className="h-full rounded-full" style={{ width: `${topicPercent}%`, background: weak ? DANGER : SUCCESS }} />
                  </div>
                </div>
              );
            })}
          </div>

          {review.weakTopics.length > 0 && (
            <p className="mt-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-weak-topics">
              📌 <strong style={{ color: TEXT }}>{review.weakTopics.join(', ')}</strong> scored under {WEAK_TOPIC_THRESHOLD}% — {review.weakTopics.length === 1 ? "it's" : "they're"} now marked for priority revision and will surface sooner in your plan.
            </p>
          )}

          {review.wrong.length > 0 && (
            <>
              <p className="mt-6 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Wrong answers ({review.wrong.length})
              </p>
              <div className="mt-2 space-y-3">
                {review.wrong.map(({ question, picked }, i) => (
                  <div key={i} className="px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }} data-testid={`test-wrong-${i}`}>
                    <p className="text-[13px] font-bold leading-snug" style={{ color: TEXT }}>{question.question}</p>
                    <p className="mt-2 text-[12px]" style={{ color: DANGER }}>
                      Your answer: {picked ? `${picked} · ${optionText(question, picked)}` : 'left blank'}
                    </p>
                    <p className="mt-1 text-[12px]" style={{ color: SUCCESS }}>
                      Correct: {question.correct} · {optionText(question, question.correct as McqLetter)}
                    </p>
                    {question.explanation && (
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>{question.explanation}</p>
                    )}
                    {question.source_url && (
                      <a
                        href={question.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-[11px] font-bold underline underline-offset-2"
                        style={{ color: AMBER }}
                        data-testid={`link-test-official-source-${i}`}
                      >
                        Official practice source ↗
                      </a>
                    )}
                    {/* [Feature 3] Why did this go wrong? — exactly one reason
                        from the shared taxonomy; picking one files the mistake
                        into the digital mistake book with its concept tag and
                        shows the reason's follow-up guidance. */}
                    {onLogWrongReason && (
                      <div className="mt-3 pt-2.5" style={{ borderTop: `1px dashed ${BORDER}` }} data-testid={`test-wrong-reason-${i}`}>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                          Why did this go wrong?
                        </p>
                        {reasonByIndex[i] ? (
                          <div className="mt-1.5 vicharak-fade">
                            <span
                              className="inline-flex px-2.5 py-1 text-[11px] font-extrabold"
                              style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.14), color: AMBER, border: `1px solid ${tint(AMBER, 0.4)}` }}
                              data-testid={`test-wrong-reason-picked-${i}`}
                            >
                              {reasonByIndex[i]} · in your mistake book
                            </span>
                            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                              {WRONG_REASON_FOLLOWUPS[reasonByIndex[i]]
                                .split('{concept}')
                                .join((question.concept || '').trim() || question.topic)}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {WRONG_REASONS.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                disabled={savingReasonIndex !== null}
                                onClick={() => void pickReason(i, question, picked, reason)}
                                className="px-2.5 py-1.5 text-[10px] font-extrabold disabled:opacity-50 touch-manipulation"
                                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                                data-testid={`test-wrong-reason-${i}-${reason.slice(0, 10)}`}
                              >
                                {savingReasonIndex === i ? '…' : reason}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {typeof review.clearedCount === 'number' && review.clearedCount > 0 && (
            <p className="mt-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(SUCCESS, 0.08), border: `1px solid ${tint(SUCCESS, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-flagged-cleared">
              ✅ {review.clearedCount} Mistake Book question{review.clearedCount === 1 ? '' : 's'} answered correctly — {review.clearedCount === 1 ? 'it leaves' : 'they leave'} your revision queue.
            </p>
          )}

          {review.analysis && (
            <p className="mt-4 text-[13px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-test-analysis">
              🧠 <strong style={{ color: AMBER }}>Coach's analysis:</strong> {review.analysis}
            </p>
          )}

          <button type="button" onClick={onClose} className="mt-6 w-full py-3.5 text-sm font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-close-results">
            Done — back to Today
          </button>
        </div>
      </div>
    </div>
  );
}
