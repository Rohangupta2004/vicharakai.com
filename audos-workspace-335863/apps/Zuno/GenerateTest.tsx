/**
 * Generate Test — a self-marked test compiled from the student's OWN material:
 * the spaced-repetition revision queue and the doubts they saved.
 *
 * Three generation options, always chosen explicitly (nothing auto-generates):
 *  • Use my revision questions (default) — the saved questions, exactly as stored.
 *  • Generate similar questions — AI writes ONE fresh question per queue item,
 *    matching its style and concept.
 *  • Mix 2 concepts — AI writes questions that each combine TWO of the
 *    student's saved concepts.
 *
 * After every question the student marks themselves: “Got it ✓” resolves the
 * underlying queue row(s) (they leave the revision loop); “Need revision ↩”
 * reschedules them for tomorrow. App.tsx owns the database writes.
 */

import { useState } from 'react';
import { Check, ChevronRight, Loader2, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
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
  extractJsonArray,
  flaggedConceptLabel,
  flaggedOptions,
  type FlaggedRow,
  type McqLetter,
} from './mcq';

export type GenerateTestMode = 'revision' | 'similar' | 'mix';

export interface GeneratedTestQuestion {
  question: string;
  /** Exactly four option texts when the question is an MCQ; null = open-ended. */
  options: string[] | null;
  correct: McqLetter | null;
  explanation: string | null;
  subject: string;
  conceptLabel: string;
  imageUrl: string | null;
  /** zuno_question_queue row ids this question resolves / reschedules. */
  sourceIds: number[];
}

const MAX_TEST_QUESTIONS = 10;

function normalizeLetter(value: unknown): McqLetter | null {
  if (typeof value !== 'string') return null;
  const letter = value.trim().toUpperCase().charAt(0);
  return (MCQ_LETTERS as string[]).includes(letter) ? (letter as McqLetter) : null;
}

/* ------------------------------------------------------------------ */
/*  Question builders                                                   */
/* ------------------------------------------------------------------ */

/** Option 1 (default): the student's own saved questions, exactly as stored. */
export function questionsFromQueue(rows: FlaggedRow[], cap = MAX_TEST_QUESTIONS): GeneratedTestQuestion[] {
  return rows.slice(0, cap).map((row) => {
    const options = flaggedOptions(row);
    const correct = normalizeLetter(row.correct);
    return {
      question: row.question_text.trim() || 'Photo question — read it from the image below.',
      options: options && correct ? options : null,
      correct: options && correct ? correct : null,
      explanation: null,
      subject: row.subject || 'General',
      conceptLabel: flaggedConceptLabel(row),
      imageUrl: row.image_url ?? null,
      sourceIds: [row.id],
    };
  });
}

interface RawAiQuestion {
  id?: unknown;
  ids?: unknown;
  question?: unknown;
  options?: unknown;
  correct?: unknown;
  explanation?: unknown;
}

function readAiOptions(record: RawAiQuestion): { options: string[]; correct: McqLetter } | null {
  const options = Array.isArray(record.options) ? record.options.map((o) => String(o ?? '').trim()) : [];
  const correct = normalizeLetter(record.correct);
  if (options.length < 4 || options.slice(0, 4).some((o) => !o) || !correct) return null;
  return { options: options.slice(0, 4), correct };
}

async function callGenerationModel(system: string, user: string): Promise<unknown[]> {
  const response = await fetch('/proxy/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'X-Workspace-DB-Token': (window as any).__workspaceDb?.token ?? '',  'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 2400,
      temperature: 0.5,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Generation failed (${response.status})`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  return extractJsonArray(String(data.choices?.[0]?.message?.content || ''));
}

/** Option 2: AI writes ONE fresh question per queue item — same concept & style. */
export async function generateSimilarQuestions(rows: FlaggedRow[], examLabel: string): Promise<GeneratedTestQuestion[]> {
  const pool = rows.slice(0, 8);
  const payload = pool.map((row) => ({
    id: row.id,
    subject: row.subject,
    concept: flaggedConceptLabel(row),
    question: row.question_text.slice(0, 400),
  }));
  const items = await callGenerationModel(
    `You write exam-grade practice questions for ${examLabel} aspirants. For EACH input item, write ONE NEW ` +
      'four-option MCQ that tests the SAME concept and matches the original question\u2019s style and difficulty — ' +
      'never repeat the original wording. Return ONLY a valid JSON array — no prose, no markdown fences. Each element: ' +
      '{"id": number (copied from the input item it is based on), "question": string, ' +
      '"options": [string, string, string, string], "correct": "A"|"B"|"C"|"D", "explanation": string}. ' +
      'Exactly one option is correct; randomise which letter is correct across the set.',
    JSON.stringify(payload),
  );
  const questions: GeneratedTestQuestion[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as RawAiQuestion;
    const source = pool.find((row) => row.id === Number(record.id));
    const question = typeof record.question === 'string' ? record.question.trim() : '';
    const shape = readAiOptions(record);
    if (!source || !question || !shape) continue;
    questions.push({
      question,
      options: shape.options,
      correct: shape.correct,
      explanation: typeof record.explanation === 'string' ? record.explanation.trim() || null : null,
      subject: source.subject || 'General',
      conceptLabel: flaggedConceptLabel(source),
      imageUrl: null,
      sourceIds: [source.id],
    });
  }
  return questions.slice(0, MAX_TEST_QUESTIONS);
}

/** Option 3: AI writes questions that each combine TWO of the student's concepts. */
export async function generateMixedQuestions(rows: FlaggedRow[], examLabel: string): Promise<GeneratedTestQuestion[]> {
  const pool = rows.slice(0, 10);
  const payload = pool.map((row) => ({
    id: row.id,
    subject: row.subject,
    concept: flaggedConceptLabel(row),
    question: row.question_text.slice(0, 300),
  }));
  const items = await callGenerationModel(
    `You write exam-grade practice questions for ${examLabel} aspirants. Create up to 5 four-option MCQs. ` +
      'EACH question must genuinely COMBINE TWO DIFFERENT concepts from the input list in one problem. ' +
      'Return ONLY a valid JSON array — no prose, no markdown fences. Each element: ' +
      '{"ids": [number, number] (the two input ids the question combines), "question": string, ' +
      '"options": [string, string, string, string], "correct": "A"|"B"|"C"|"D", "explanation": string}. ' +
      'Exactly one option is correct; randomise which letter is correct across the set.',
    JSON.stringify(payload),
  );
  const questions: GeneratedTestQuestion[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as RawAiQuestion;
    const ids = Array.isArray(record.ids) ? record.ids.map(Number).filter((n) => pool.some((row) => row.id === n)) : [];
    const question = typeof record.question === 'string' ? record.question.trim() : '';
    const shape = readAiOptions(record);
    if (ids.length === 0 || !question || !shape) continue;
    const sources = pool.filter((row) => ids.includes(row.id));
    questions.push({
      question,
      options: shape.options,
      correct: shape.correct,
      explanation: typeof record.explanation === 'string' ? record.explanation.trim() || null : null,
      subject: sources[0]?.subject || 'General',
      conceptLabel: sources.map((row) => flaggedConceptLabel(row)).join(' × '),
      imageUrl: null,
      sourceIds: sources.map((row) => row.id),
    });
  }
  return questions.slice(0, MAX_TEST_QUESTIONS);
}

/* ------------------------------------------------------------------ */
/*  Setup sheet — the student ALWAYS chooses an option first            */
/* ------------------------------------------------------------------ */

const MODE_OPTIONS: Array<{ id: GenerateTestMode; label: string; helper: string; ai: boolean }> = [
  { id: 'revision', label: 'Use my revision questions', helper: 'Your saved doubts and wrong answers, exactly as saved', ai: false },
  { id: 'similar', label: 'Generate similar questions', helper: 'AI writes fresh questions in the same style and topics', ai: true },
  { id: 'mix', label: 'Mix 2 concepts', helper: 'AI writes questions that combine two of your topics', ai: true },
];

export function GenerateTestSheet({
  queueCount,
  preparing,
  error,
  onStart,
  onClose,
}: {
  /** Questions available in the revision queue (due + upcoming). */
  queueCount: number;
  preparing: boolean;
  error: string | null;
  onStart: (mode: GenerateTestMode) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<GenerateTestMode>('revision');

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Generate a test">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={preparing ? undefined : onClose} aria-label="Close test generator" />
      <div
        className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Generate Test</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
              Built from your revision queue and saved doubts — {queueCount} question{queueCount === 1 ? '' : 's'} available.
            </p>
          </div>
          <button type="button" disabled={preparing} onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>How should I build it?</p>
        <div className="mt-2 space-y-2">
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                aria-pressed={active}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left touch-manipulation"
                style={{
                  borderRadius: RADIUS.md,
                  background: active ? tint(AMBER, 0.1) : NAVY_ALT,
                  border: `1.5px solid ${active ? tint(AMBER, 0.55) : BORDER}`,
                }}
                data-testid={`generate-test-mode-${option.id}`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? AMBER : BORDER, color: active ? '#FFFFFF' : TEXT_MUTED }}
                  aria-hidden="true"
                >
                  {active && <Check className="w-3 h-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold" style={{ color: TEXT }}>
                    {option.label}
                    {option.id === 'revision' ? ' · default' : ''}
                  </span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>{option.helper}</span>
                </span>
                {option.ai && <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />}
              </button>
            );
          })}
        </div>

        {queueCount === 0 && (
          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-generate-test-empty">
            Your revision queue is empty. Save a doubt (Doubts tab) or answer a practice question wrong first — then I can
            build a test from your own weak spots.
          </p>
        )}

        {error && (
          <p className="mt-4 text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-generate-test-error">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={preparing || queueCount === 0}
          onClick={() => onStart(mode)}
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-generate-test-start"
        >
          {preparing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'revision' ? 'Compiling your test…' : 'Writing your questions…'}</>
          ) : error ? (
            <><RotateCcw className="w-4 h-4" />Retry</>
          ) : (
            <><Trophy className="w-4 h-4" />Generate my test</>
          )}
        </button>
        <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
          After each question you mark yourself — “Got it” clears it from the queue, “Need revision” brings it back.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Runner — one question at a time, self-marked                        */
/* ------------------------------------------------------------------ */

export function GeneratedTestRunner({
  questions,
  onResolve,
  onClose,
}: {
  questions: GeneratedTestQuestion[];
  /** Fired once per question when the student marks it. */
  onResolve: (question: GeneratedTestQuestion, remembered: boolean) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<McqLetter | null>(null);
  const [gotCount, setGotCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const isMcq = !!question && question.options !== null && question.correct !== null;
  const answered = picked !== null;
  /** MCQs unlock the self-mark after an answer; open-ended marks straight away. */
  const canMark = !isMcq || answered;

  const mark = (remembered: boolean) => {
    if (!question || !canMark) return;
    onResolve(question, remembered);
    if (remembered) setGotCount((n) => n + 1);
    else setAgainCount((n) => n + 1);
    if (index + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label="Generated test" style={{ background: OVERLAY_BG }}>
      <div className="flex-1 flex flex-col max-w-[600px] w-full mx-auto min-h-0 px-4 py-5">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl px-5 py-6 vicharak-sheet" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: TEXT_MUTED }}>Generated test</p>
              <p className="text-sm font-extrabold" style={{ color: TEXT }}>
                {finished ? 'Done' : `Question ${index + 1} of ${questions.length}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close generated test"
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {finished || !question ? (
            <div className="mt-8 text-center pb-4">
              <p className="text-5xl" aria-hidden="true">{againCount === 0 ? '\uD83C\uDFC6' : '\uD83D\uDCAA'}</p>
              <h2 className="mt-4 text-2xl font-extrabold" style={{ color: TEXT }} data-testid="text-generated-test-summary">
                {gotCount} remembered · {againCount} to revise
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                {gotCount > 0 ? `${gotCount} question${gotCount === 1 ? '' : 's'} left your revision queue for good. ` : ''}
                {againCount > 0
                  ? `${againCount} come${againCount === 1 ? 's' : ''} back tomorrow — the loop keeps working until you own them.`
                  : 'Nothing left to revise from this set — brilliant.'}
              </p>
              <button type="button" onClick={onClose} className="mt-7 px-8 py-3 text-sm font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-generated-test-done">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                <div className="h-full rounded-full" style={{ width: `${((index + 1) / questions.length) * 100}%`, background: BRAND_GRADIENT, transition: 'width 0.3s ease' }} />
              </div>

              <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: TEXT_MUTED }}>
                <SubjectDot subject={question.subject} size={6} />
                {question.subject} · {question.conceptLabel}
              </p>
              <h2 className="mt-2 text-[16px] font-extrabold leading-snug whitespace-pre-wrap" style={{ color: TEXT }} data-testid="text-generated-test-question">
                {question.question}
              </h2>
              {question.imageUrl && (
                <img src={question.imageUrl} alt="Question attachment" className="mt-3 max-h-44 object-contain" style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }} />
              )}

              {isMcq ? (
                <div className="mt-4 space-y-2">
                  {MCQ_LETTERS.map((letter, letterIndex) => {
                    const isPicked = picked === letter;
                    const isCorrect = question.correct === letter;
                    const showState = answered && (isPicked || isCorrect);
                    const color = showState ? (isCorrect ? SUCCESS : DANGER) : BORDER;
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={answered}
                        onClick={() => setPicked(letter)}
                        className="w-full flex items-start gap-3 px-3.5 py-3 text-left touch-manipulation"
                        style={{
                          borderRadius: RADIUS.md,
                          background: showState ? tint(color, 0.12) : NAVY_ALT,
                          border: `1.5px solid ${showState ? tint(color, 0.6) : BORDER}`,
                        }}
                        data-testid={`generated-test-option-${letter}`}
                      >
                        <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold" style={{ background: showState ? color : BORDER, color: showState ? '#FFFFFF' : TEXT_SECONDARY }}>
                          {showState ? (isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />) : letter}
                        </span>
                        <span className="text-[13px] font-semibold leading-snug pt-0.5" style={{ color: showState ? TEXT : TEXT_SECONDARY }}>
                          {(question.options as string[])[letterIndex]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}>
                  Answer it in your head or on paper — then mark yourself honestly below.
                </p>
              )}

              {answered && question.explanation && (
                <p className="mt-3 text-[12px] leading-relaxed px-3.5 py-3 vicharak-fade" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }}>
                  {question.explanation}
                </p>
              )}

              <div className="mt-5" data-testid="generated-test-mark">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-center" style={{ color: TEXT_MUTED }}>
                  Mark as remembered?
                </p>
                {!canMark && (
                  <p className="mt-1 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
                    Pick an answer first — then mark yourself.
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canMark}
                    onClick={() => mark(true)}
                    className="py-3 text-sm font-extrabold disabled:opacity-40 inline-flex items-center justify-center gap-2 touch-manipulation"
                    style={{ borderRadius: RADIUS.chip, background: tint(SUCCESS, 0.16), border: `1px solid ${tint(SUCCESS, 0.5)}`, color: SUCCESS }}
                    data-testid="button-generated-test-got-it"
                  >
                    <Check className="w-4 h-4" />
                    Got it ✓
                  </button>
                  <button
                    type="button"
                    disabled={!canMark}
                    onClick={() => mark(false)}
                    className="py-3 text-sm font-extrabold disabled:opacity-40 inline-flex items-center justify-center gap-2 touch-manipulation"
                    style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), border: `1px solid ${tint(AMBER, 0.45)}`, color: AMBER }}
                    data-testid="button-generated-test-need-revision"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Need revision ↩
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
                  “Got it” clears it from your revision queue · “Need revision” brings it back tomorrow
                </p>
              </div>
              {index + 1 < questions.length && (
                <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: TEXT_MUTED }}>
                  Next up after you mark this one
                  <ChevronRight className="w-3 h-3" />
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
