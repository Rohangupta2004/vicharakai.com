/**
 * Generate Test — a self-marked practice set targeted from the student's OWN
 * logged mock entries. The setup sheet explains the evidence gate and the
 * marks-lost weighting; useTests reuses the shared exam bank and generateMcqs
 * to build the questions instead of maintaining a second generator.
 *
 * Queue-backed legacy builders remain exported for the Mistake Book flows.
 * Bank/generated questions carry no queue source ids, so marking them feeds
 * mastery without accidentally clearing an unrelated saved doubt.
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
  type McqDraft,
  type McqLetter,
} from './mcq';
import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';
import { formatUnits, type ExamConfig } from './features/testAnalysis/examConfig';
import type { MockPracticePlan } from './features/testAnalysis/taSelectors';

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

/** Option 1 (default): the student's own saved questions, exactly as stored.
 * The student's own solution rides along as the explanation when present. */
export function questionsFromQueue(rows: FlaggedRow[], cap = MAX_TEST_QUESTIONS): GeneratedTestQuestion[] {
  return rows.slice(0, cap).map((row) => {
    const options = flaggedOptions(row);
    const correct = normalizeLetter(row.correct);
    return {
      question: (row.question_text ?? '').trim() || 'Photo question — read it from the image below.',
      options: options && correct ? options : null,
      correct: options && correct ? correct : null,
      explanation: String(row.solution_text ?? '').trim() || null,
      subject: row.subject || 'General',
      conceptLabel: flaggedConceptLabel(row),
      imageUrl: row.image_url ?? null,
      sourceIds: [row.id],
    };
  });
}

/** Shared-bank and generated drafts use the existing self-marked runner but
 * never resolve a Mistake Book row. */
export function questionsFromMcqDrafts(drafts: McqDraft[]): GeneratedTestQuestion[] {
  return drafts.slice(0, MAX_TEST_QUESTIONS).map((draft) => ({
    question: draft.question,
    options: [draft.option_a, draft.option_b, draft.option_c, draft.option_d],
    correct: draft.correct as McqLetter,
    explanation: draft.explanation ?? null,
    subject: draft.subject,
    conceptLabel: draft.topic,
    imageUrl: draft.image_url ?? null,
    sourceIds: [],
  }));
}

/** [Feature 3] Questions the student typed directly into the test — free
 * text, one per line. They run as open-ended, self-marked questions in the
 * same runner; they resolve no queue rows (sourceIds stays empty). */
export function questionsFromCustom(lines: string[]): GeneratedTestQuestion[] {
  return lines
    .map((line) => (line ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_TEST_QUESTIONS)
    .map((question) => ({
      question,
      options: null,
      correct: null,
      explanation: null,
      subject: 'General',
      conceptLabel: 'Your own question',
      imageUrl: null,
      sourceIds: [],
    }));
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
  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    headers: await aiProxyHeaders(),
    body: JSON.stringify({
      model: AI_MODELS.standard,
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_completion_tokens: 2400,
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
/*  Setup sheet — mock evidence in, weighted practice set out           */
/* ------------------------------------------------------------------ */

export function GenerateTestSheet({
  plan,
  examConfig,
  loading,
  preparing,
  error,
  onStart,
  onClose,
}: {
  plan: MockPracticePlan;
  examConfig: ExamConfig;
  loading: boolean;
  preparing: boolean;
  error: string | null;
  onStart: () => void;
  onClose: () => void;
}) {
  const blocked = loading || !plan.ready;

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
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Mock-targeted test</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
              {plan.ready
                ? `${plan.questionCount} questions weighted towards the topics costing you the most.`
                : 'Your own logged mock patterns decide what belongs in this set.'}
            </p>
          </div>
          <button type="button" disabled={preparing} onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <p className="mt-4 inline-flex items-center gap-2 text-[12px]" style={{ color: TEXT_SECONDARY }} data-testid="text-generate-test-loading">
            <Loader2 className="w-4 h-4 animate-spin" /> Reading your logged mocks…
          </p>
        ) : plan.remainingEntries > 0 ? (
          <div className="mt-4 px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}` }} data-testid="text-generate-test-evidence-gate">
            <p className="text-[12px] font-extrabold" style={{ color: TEXT }}>
              Tag {plan.remainingEntries} more mock question{plan.remainingEntries === 1 ? '' : 's'} first
            </p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              I need {plan.minimumEntries} logged questions with both a syllabus topic and an error reason before the targeting is meaningful. You have {plan.meaningfulEntries}.
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (plan.meaningfulEntries / plan.minimumEntries) * 100)}%`, background: BRAND_GRADIENT }} />
            </div>
          </div>
        ) : plan.targets.length === 0 ? (
          <p className="mt-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-generate-test-empty">
            {plan.behaviouralTopics.length > 0
              ? "Your repeated costly topics are mostly careless or out-of-time errors. I won't turn those into extra study — keep logging until a concept-gap or couldn't-apply pattern appears."
              : 'There is enough total data, but no syllabus topic has repeated enough to target yet. Log another question on a topic already seen — one miss alone never counts as weakness.'}
          </p>
        ) : null}

        {plan.targets.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
              Question weighting
            </p>
            <ul className="mt-2 space-y-1.5" data-testid="list-generate-test-targets">
              {plan.targets.map((target) => (
                <li key={`${target.subject}|${target.topic}`} className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}>
                  <SubjectDot subject={target.subject} size={6} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-extrabold truncate" style={{ color: TEXT_SECONDARY }}>{target.topic}</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>
                      {formatUnits(examConfig, target.marksLost)} lost across {target.attempts} logged attempts
                    </span>
                  </span>
                  <span className="text-[11px] font-extrabold flex-shrink-0" style={{ color: AMBER }}>
                    {target.questionCount} q
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.behaviouralTopics.length > 0 && (
          <div className="mt-3 px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(SUCCESS, 0.07), border: `1px solid ${tint(SUCCESS, 0.28)}` }} data-testid="text-generate-test-behavioural">
            <p className="text-[11px] font-extrabold" style={{ color: SUCCESS }}>Behavioural nudge — not extra study</p>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              {plan.behaviouralTopics.map((topic) => topic.topic).join(', ')} {plan.behaviouralTopics.length === 1 ? 'is' : 'are'} mostly careless or out-of-time. Slow the first pass and check the final line; these topics get no questions just for a habit error.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-generate-test-error">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={preparing || blocked}
          onClick={onStart}
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-generate-test-start"
        >
          {preparing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Compiling your test…</>
          ) : error && plan.ready ? (
            <><RotateCcw className="w-4 h-4" />Retry</>
          ) : (
            <><Trophy className="w-4 h-4" />Generate my test · {plan.questionCount} questions</>
          )}
        </button>
        <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
          Shared exam-bank questions come first; AI fills only the exact gaps. Every topic stays inside your syllabus.
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
  const queueBacked = questions.some((item) => item.sourceIds.length > 0);
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
                {queueBacked ? (
                  <>
                    {gotCount > 0 ? `${gotCount} question${gotCount === 1 ? '' : 's'} left your revision queue for good. ` : ''}
                    {againCount > 0
                      ? `${againCount} come${againCount === 1 ? 's' : ''} back tomorrow — the loop keeps working until you own them.`
                      : 'Nothing left to revise from this set — brilliant.'}
                  </>
                ) : againCount > 0 ? (
                  `${againCount} question${againCount === 1 ? '' : 's'} still need work. Your self-marks have updated those topics in mastery.`
                ) : (
                  'Every target held up. Your self-marks have updated those topics in mastery.'
                )}
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

              {/* Solving view stays clean: question, options and the mark —
                  subject/concept provenance lives in the record, not here. */}
              <h2 className="mt-4 text-[16px] font-extrabold leading-snug whitespace-pre-wrap" style={{ color: TEXT }} data-testid="text-generated-test-question">
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
                  {queueBacked
                    ? '“Got it” clears it from your revision queue · “Need revision” brings it back tomorrow'
                    : 'Your self-mark updates topic mastery · no saved doubt is cleared by this generated set'}
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
