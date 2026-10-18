/**
 * Test Mode — a curated MCQ test across the student's own topics.
 *
 * Three screens, all owned by App.tsx state:
 *  1. TestSetupSheet — pick topics (multi-select), question count (10/20/30)
 *     and an optional time limit. App curates from the zuno_mcq_questions bank
 *     and generates only what's missing.
 *  2. TestRunner — countdown at the top when timed, one question at a time,
 *     free navigation, and NO answer reveal until the test is submitted.
 *  3. TestResultsView — score, per-topic breakdown, wrong answers with
 *     explanations, and the weak topics (<60%) that were marked for priority
 *     revision.
 */

import { useEffect, useRef, useState } from 'react';
import { AlarmClock, Check, ChevronLeft, ChevronRight, Loader2, Trophy, X } from 'lucide-react';
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
  onStart,
  onClose,
}: {
  topics: TestTopicOption[];
  preparing: boolean;
  /** Progress line while questions are being curated/generated. */
  prepareNote: string | null;
  error: string | null;
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
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            Add a topic or two to your plan first — the test pulls from what you're actually studying.
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

        <button
          type="button"
          disabled={preparing || selected.length === 0}
          onClick={() => onStart({ topics: selected, count, timeLimitMinutes: timeLimit })}
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-start-test"
        >
          {preparing ? <><Loader2 className="w-4 h-4 animate-spin" />{prepareNote || 'Preparing your test…'}</> : error ? 'Retry' : `Start ${count}-question test`}
        </button>
        {!preparing && (
          <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
            Existing bank questions are reused; anything missing is generated fresh.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · Runner — no reveal until submit                                */
/* ------------------------------------------------------------------ */

export function TestRunner({
  questions,
  timeLimitMinutes,
  onSubmit,
  onCancel,
}: {
  questions: PlayableQuestion[];
  timeLimitMinutes: number | null;
  onSubmit: (answers: Array<McqLetter | null>, durationSeconds: number) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<McqLetter | null>>(() => questions.map(() => null));
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes ? timeLimitMinutes * 60 : null);
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

  const choose = (letter: McqLetter) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? (a === letter ? null : letter) : a)));

  if (!question) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label="Test in progress" style={{ background: OVERLAY_BG }}>
      <div className="flex-1 flex flex-col max-w-[600px] w-full mx-auto min-h-0 px-4 py-5">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl px-5 py-6 vicharak-sheet" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: TEXT_MUTED }}>Test Mode</p>
              <p className="text-sm font-extrabold" style={{ color: TEXT }}>
                {answeredCount}/{questions.length} answered
              </p>
            </div>
            {secondsLeft !== null && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-extrabold flex-shrink-0"
                style={{ borderRadius: RADIUS.chip, background: tint(urgent ? DANGER : AMBER, 0.12), color: urgent ? DANGER : AMBER, border: `1px solid ${tint(urgent ? DANGER : AMBER, 0.4)}` }}
                data-testid="text-test-countdown"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                {formatCountdown(secondsLeft)}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Leave the test? Your answers will be lost.')) onCancel();
              }}
              aria-label="Abandon test"
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
            <div className="h-full rounded-full" style={{ width: `${((index + 1) / questions.length) * 100}%`, background: BRAND_GRADIENT, transition: 'width 0.3s ease' }} />
          </div>

          <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_MUTED }}>
            Question {index + 1} of {questions.length} · {question.subject} · {question.topic}
          </p>
          <h2 className="mt-2 text-[16px] font-extrabold leading-snug" style={{ color: TEXT }} data-testid="text-test-question">
            {question.question}
          </h2>

          {question.image_url && (
            <img src={question.image_url} alt="Question attachment" className="mt-3 max-h-44 object-contain" style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }} />
          )}

          <div className="mt-4 space-y-2">
            {MCQ_LETTERS.map((letter) => {
              const active = answers[index] === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => choose(letter)}
                  aria-pressed={active}
                  className="w-full flex items-start gap-3 px-3.5 py-3 text-left touch-manipulation"
                  style={{
                    borderRadius: RADIUS.md,
                    background: active ? tint(AMBER, 0.12) : NAVY_ALT,
                    border: `1.5px solid ${active ? tint(AMBER, 0.6) : BORDER}`,
                  }}
                  data-testid={`test-option-${letter}`}
                >
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold" style={{ background: active ? AMBER : BORDER, color: active ? '#FFFFFF' : TEXT_SECONDARY }}>
                    {letter}
                  </span>
                  <span className="text-[13px] font-semibold leading-snug pt-0.5" style={{ color: active ? TEXT : TEXT_SECONDARY }}>
                    {optionText(question, letter)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 px-4 py-2.5 text-[13px] font-extrabold disabled:opacity-40 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY }}
              data-testid="button-test-prev"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            {last ? (
              <button type="button" onClick={submit} className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-test-submit">
                <Check className="w-4 h-4" />
                Submit test
              </button>
            ) : (
              <button type="button" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} className="inline-flex items-center gap-1 px-6 py-2.5 text-sm font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-test-next">
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          {last && answeredCount < questions.length && (
            <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
              {questions.length - answeredCount} unanswered — they count as wrong once you submit.
            </p>
          )}
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
  breakdown: TopicBreakdown[];
  wrong: Array<{ question: PlayableQuestion; picked: McqLetter | null }>;
  weakTopics: string[];
  /** Why the AI weighted the paper the way it did — one line per topic picked. */
  curationNotes?: string[];
  /** The coach's closing analysis: the main gap, in plain student language. */
  analysis?: string | null;
  /** Doubt-test runs only: how many doubt questions were cleared. */
  clearedCount?: number;
}

export function TestResultsView({ review, onClose }: { review: TestReview; onClose: () => void }) {
  const percent = percentOf(review.score, review.total);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label="Test results" style={{ background: OVERLAY_BG }}>
      <div className="flex-1 flex flex-col max-w-[600px] w-full mx-auto min-h-0 px-4 py-5">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl px-5 py-6 vicharak-sheet" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}` }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: TEXT_MUTED }}>Test results</p>
            <button type="button" onClick={onClose} aria-label="Close results" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-5xl" aria-hidden="true">{percent >= 80 ? '🏆' : percent >= 60 ? '🎉' : '💪'}</p>
            <h2 className="mt-3 text-3xl font-extrabold" style={{ color: TEXT }} data-testid="text-test-score">
              {review.score} / {review.total}
            </h2>
            <p className="mt-1 text-[13px] font-bold" style={{ color: percent >= 60 ? SUCCESS : DANGER }}>{percent}% correct</p>
          </div>

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
                  </div>
                ))}
              </div>
            </>
          )}

          {typeof review.clearedCount === 'number' && review.clearedCount > 0 && (
            <p className="mt-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(SUCCESS, 0.08), border: `1px solid ${tint(SUCCESS, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-flagged-cleared">
              ✅ {review.clearedCount} doubt question{review.clearedCount === 1 ? '' : 's'} answered correctly — {review.clearedCount === 1 ? 'it leaves' : 'they leave'} your revision queue.
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
