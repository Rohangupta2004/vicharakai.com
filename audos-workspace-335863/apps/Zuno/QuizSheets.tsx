/**
 * Practice MCQs — the “Generate Questions” sheet and the one-at-a-time quiz
 * player with immediate feedback (green right / red wrong + explanation).
 *
 * The sheet only talks to the AI (via mcq.ts → the platform proxy) and hands
 * validated drafts back to App.tsx, which owns every database write. When the
 * student has Test Mode history on the topic, the “📊 Adapted to your level”
 * badge appears and the prompt is calibrated by their real accuracy.
 */

import { useState, type CSSProperties } from 'react';
import { Check, ChevronRight, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
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
import {
  MCQ_LETTERS,
  QUIZ_COUNTS,
  generateMcqs,
  optionText,
  type AdaptiveContext,
  type McqDifficulty,
  type McqDraft,
  type McqLetter,
  type McqQuestion,
} from './mcq';
import { AttachImageButton, ImageThumbStrip } from './Attachments';

export interface QuizTarget {
  subject: string;
  topic: string;
}

const DIFFICULTIES: Array<{ id: McqDifficulty; label: string }> = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'mixed', label: 'Mixed' },
];

/**
 * The coach's one-paragraph verdict after a quiz — names the exact sub-concept
 * that cost the most marks (from each generated question's `concept`), or
 * declares the topic solid, always ending with a concrete next step.
 */
export function quizVerdict(
  title: string,
  total: number,
  wrong: Array<{ concept?: string | null; topic: string }>,
): string {
  const correct = total - wrong.length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  if (wrong.length === 0) {
    return `You're solid on ${title} — a perfect run. Next step: raise the bar with a Hard set, or point Test Mode at your next weak topic.`;
  }
  const counts = new Map<string, number>();
  for (const q of wrong) {
    const concept = (q.concept || q.topic || '').trim();
    if (concept) counts.set(concept, (counts.get(concept) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (percent >= 80) {
    return top
      ? `You're solid on ${title} (${percent}%). The one thing to tighten: ${top[0]} — it came up in ${top[1]} question${top[1] === 1 ? '' : 's'} you got wrong. Reread that bit, then move on.`
      : `You're solid on ${title} (${percent}%). Skim the explanations you missed and move on — this topic is close to done.`;
  }
  return top
    ? `Revise ${top[0]} — it came up in ${top[1]} question${top[1] === 1 ? '' : 's'} you got wrong. Reread that section of ${title}, then run this quiz again — beating your ${percent}% is the goal.`
    : `${percent}% on ${title} — the explanations above are where the marks are. Reread them, then run this quiz again.`;
}

/* ------------------------------------------------------------------ */
/*  Generate Quiz sheet                                                */
/* ------------------------------------------------------------------ */

export function GenerateQuizSheet({
  target,
  examLabel,
  adaptive,
  avoidQuestions,
  today,
  canAskAi,
  onAiBlocked,
  onAiCharged,
  onGenerated,
  onClose,
}: {
  target: QuizTarget;
  examLabel: string;
  adaptive: AdaptiveContext | null;
  /** Existing stems in the bank for this topic — the model must not repeat them. */
  avoidQuestions: string[];
  today: string;
  canAskAi: boolean;
  onAiBlocked: () => void;
  onAiCharged: () => void;
  /** Parent stores the drafts and opens the quiz player. */
  onGenerated: (drafts: McqDraft[]) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<McqDifficulty>('medium');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (generating) return;
    if (!canAskAi) {
      onAiBlocked();
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const drafts = await generateMcqs({
        examLabel,
        subject: target.subject,
        topic: target.topic,
        count,
        difficulty,
        adaptive,
        today,
        avoidQuestions,
      });
      onAiCharged();
      onGenerated(drafts);
    } catch {
      setError("The questions didn't come back in a usable shape. This happens sometimes — tap retry and I'll have another go.");
    } finally {
      setGenerating(false);
    }
  };

  const pill = (active: boolean): CSSProperties =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Generate quiz">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close quiz generator" />
      <div
        className="relative max-h-[86vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Generate Quiz</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>{target.subject} · {target.topic}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {adaptive && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}` }} data-testid="badge-adaptive">
            <span className="text-sm" aria-hidden="true">📊</span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold" style={{ color: AMBER }}>Adapted to your level</p>
              <p className="text-[10px] mt-0.5 leading-snug" style={{ color: TEXT_SECONDARY }}>{adaptive.summary}</p>
            </div>
          </div>
        )}

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>How many questions?</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {QUIZ_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(count === n)} data-testid={`quiz-count-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Difficulty{adaptive ? ' (auto-calibrated)' : ''}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} type="button" onClick={() => setDifficulty(d.id)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(difficulty === d.id)} data-testid={`quiz-difficulty-${d.id}`}>
              {d.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-quiz-error">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={generating}
          onClick={() => void generate()}
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-generate-quiz"
        >
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Writing your questions…</> : error ? <><RotateCcw className="w-4 h-4" />Retry</> : <><Sparkles className="w-4 h-4" />Generate {count} questions</>}
        </button>
        <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
          Questions are saved to your bank — Test Mode reuses them later.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Practice quiz player — immediate feedback                          */
/* ------------------------------------------------------------------ */

export interface PlayableQuestion extends Omit<McqQuestion, 'id'> {
  /** Bank id when known; null right after generation until the query refreshes. */
  id: number | null;
}

export function QuizPlayer({
  questions,
  title,
  attachmentsFor,
  attachBusy,
  onAttachImage,
  onExpandImage,
  onWrong,
  onClose,
}: {
  questions: PlayableQuestion[];
  title: string;
  /** Attached image URLs for a question (bank image + zuno_attachments rows). */
  attachmentsFor: (question: PlayableQuestion) => string[];
  attachBusy: boolean;
  /** Null id means the bank row isn't resolved yet — App matches by stem. */
  onAttachImage: (question: PlayableQuestion, file: File) => void;
  onExpandImage: (url: string) => void;
  /** Fired once per wrongly answered question — the parent auto-queues it for
   * revision silently, with no confirmation prompt. */
  onWrong?: (question: PlayableQuestion) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<McqLetter | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<PlayableQuestion[]>([]);
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const answered = picked !== null;

  const choose = (letter: McqLetter) => {
    if (answered || !question) return;
    setPicked(letter);
    if (letter === question.correct) {
      setCorrectCount((n) => n + 1);
    } else {
      setWrongQuestions((prev) => [...prev, question]);
      onWrong?.(question);
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label="Practice quiz" style={{ background: OVERLAY_BG }}>
      <div className="flex-1 flex flex-col max-w-[600px] w-full mx-auto min-h-0 px-4 py-5">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl px-5 py-6 vicharak-sheet" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: TEXT_MUTED }}>Practice quiz</p>
              <p className="text-sm font-extrabold truncate" style={{ color: TEXT }}>{title}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close quiz" className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {finished || !question ? (
            <div className="mt-8 text-center pb-4">
              <p className="text-5xl" aria-hidden="true">{correctCount === questions.length ? '🏆' : correctCount / Math.max(1, questions.length) >= 0.6 ? '🎉' : '💪'}</p>
              <h2 className="mt-4 text-2xl font-extrabold" style={{ color: TEXT }} data-testid="text-quiz-score">
                {correctCount} / {questions.length} correct
              </h2>
              <p
                className="mt-4 text-[13px] leading-relaxed text-left px-3.5 py-3"
                style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }}
                data-testid="text-quiz-verdict"
              >
                🧠 <strong style={{ color: AMBER }}>Coach's verdict:</strong>{' '}
                {quizVerdict(title, questions.length, wrongQuestions)}
              </p>
              <button type="button" onClick={onClose} className="mt-7 px-8 py-3 text-sm font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-quiz-done">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                <div className="h-full rounded-full" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%`, background: BRAND_GRADIENT, transition: 'width 0.3s ease' }} />
              </div>
              <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_MUTED }}>
                Question {index + 1} of {questions.length}
                {question.difficulty ? ` · ${question.difficulty}` : ''}
              </p>
              <h2 className="mt-2 text-[16px] font-extrabold leading-snug" style={{ color: TEXT }} data-testid="text-quiz-question">
                {question.question}
              </h2>

              {attachmentsFor(question).length > 0 && (
                <div className="mt-3">
                  <ImageThumbStrip urls={attachmentsFor(question)} onExpand={onExpandImage} />
                </div>
              )}

              <div className="mt-4 space-y-2">
                {MCQ_LETTERS.map((letter) => {
                  const isPicked = picked === letter;
                  const isCorrect = question.correct === letter;
                  const showState = answered && (isPicked || isCorrect);
                  const color = showState ? (isCorrect ? SUCCESS : DANGER) : BORDER;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={answered}
                      onClick={() => choose(letter)}
                      className="w-full flex items-start gap-3 px-3.5 py-3 text-left touch-manipulation"
                      style={{
                        borderRadius: RADIUS.md,
                        background: showState ? tint(color, 0.12) : NAVY_ALT,
                        border: `1.5px solid ${showState ? tint(color, 0.6) : BORDER}`,
                      }}
                      data-testid={`quiz-option-${letter}`}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
                        style={{ background: showState ? color : BORDER, color: showState ? '#FFFFFF' : TEXT_SECONDARY }}
                      >
                        {showState ? (isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />) : letter}
                      </span>
                      <span className="text-[13px] font-semibold leading-snug pt-0.5" style={{ color: showState ? TEXT : TEXT_SECONDARY }}>
                        {optionText(question, letter)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className="mt-4 px-3.5 py-3 vicharak-fade" style={{ borderRadius: RADIUS.md, background: tint(picked === question.correct ? SUCCESS : DANGER, 0.08), border: `1px solid ${tint(picked === question.correct ? SUCCESS : DANGER, 0.3)}` }} data-testid="quiz-feedback">
                  <p className="text-[12px] font-extrabold" style={{ color: picked === question.correct ? SUCCESS : DANGER }}>
                    {picked === question.correct ? 'Correct!' : `Not quite — the answer is ${question.correct}.`}
                  </p>
                  {question.explanation && (
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>{question.explanation}</p>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <AttachImageButton
                  busy={attachBusy}
                  onPick={(file) => onAttachImage(question, file)}
                  testId="button-attach-question-image"
                />
                {answered && (
                  <button type="button" onClick={next} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-quiz-next">
                    {index + 1 >= questions.length ? 'See score' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
