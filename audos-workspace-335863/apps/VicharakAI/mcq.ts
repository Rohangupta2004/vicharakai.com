/**
 * MCQ engine for VicharakAI — AI-generated multiple-choice questions, practice
 * quizzes and Test Mode share everything here.
 *
 * All AI traffic goes through the platform's server-side OpenAI proxy
 * (`/proxy/openai/...`) exactly like the coach — no keys ever live in the
 * client. Generation is adaptive: the last three Test Mode results for a topic
 * shift the difficulty mix the prompt asks for, so a struggling student gets
 * harder drilling WITH richer explanations instead of the same recycled set.
 */

import { topicKey } from './engine';
import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';
import { QUESTION_REVISION_INTERVALS } from './config/revision';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type McqDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type McqLetter = 'A' | 'B' | 'C' | 'D';

export const MCQ_LETTERS: McqLetter[] = ['A', 'B', 'C', 'D'];
export const QUIZ_COUNTS = [5, 10, 15] as const;
export const TEST_COUNTS = [10, 20, 30] as const;
export const TEST_TIME_LIMITS = [10, 20, 30] as const;
/** A topic scoring under this in Test Mode is flagged for priority revision. */
export const WEAK_TOPIC_THRESHOLD = 60;

/** A stored MCQ row (zuno_mcq_questions). */
export interface McqQuestion {
  id: number;
  subject: string;
  topic: string;
  source_key?: string | null;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  explanation?: string | null;
  difficulty?: string | null;
  /** The specific sub-concept tested (e.g. "Kirchhoff's loop rule") — powers verdicts. */
  concept?: string | null;
  image_url?: string | null;
  created_on?: string | null;
  /** Shared exam_questions_bank UUID when this question came from the vetted bank. */
  bank_question_id?: string | null;
  /** Official practice-page provenance copied from the shared bank. */
  source_url?: string | null;
}

export type McqDraft = Omit<McqQuestion, 'id'>;

/** A shared, server-written exam_questions_bank row. App code reads only. */
export interface ExamQuestionBankRow {
  id: string;
  exam_id: string;
  exam_name?: string | null;
  subject?: string | null;
  topic?: string | null;
  question_text: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
  difficulty?: string | null;
  source_url?: string | null;
}

export interface ExamBankSelection {
  drafts: McqDraft[];
  /** Exact difficulty slots the shared bank could not fill. */
  missingDifficulties: Array<'easy' | 'medium' | 'hard'>;
}

/** Per-topic slice of one Test Mode submission, stored as JSON in `topics`. */
export interface TopicBreakdown {
  subject: string;
  topic: string;
  correct: number;
  total: number;
}

/** A stored Test Mode result row (zuno_test_results). */
export interface TestResultRow {
  id: number;
  user_id?: string | null;
  topics: string;
  score: number | string;
  total: number | string;
  wrong_question_ids?: string | null;
  time_limit_minutes?: number | null;
  duration_seconds?: number | null;
  created_on: string;
  created_at?: string;
}

/** A weekly goals row (zuno_weekly_targets). */
export interface WeeklyTargetRow {
  id: number;
  user_id?: string | null;
  week_start_date: string;
  topic_target: number | string;
  test_target: number | string;
  topics_done: number | string;
  tests_done: number | string;
  summary_seen?: boolean | null;
  /** JSON array of {subject, chapter} the student (or AI) picked to focus on. */
  focus_chapters?: unknown;
  /** The AI's plain-language explanation of why those chapters were chosen. */
  focus_reason?: string | null;
}

/** A Mistake Book entry (zuno_question_queue). */
export interface FlaggedRow {
  id: number;
  source_type: string;
  /** Where the entry came from, e.g. "NEET Full Mock #3" — shown as "From: …". */
  source_label?: string | null;
  subject: string;
  topic?: string | null;
  question_text: string;
  image_url?: string | null;
  status: string;
  created_on: string;
  /** JSON array of 4 option texts when the question is an MCQ; null for open-ended. */
  options_json?: unknown;
  correct?: string | null;
  concept?: string | null;
  difficulty?: string | null;
  /** Times the student marked this question "Got it" — drives the spaced interval. */
  revise_count?: number | string | null;
  /** Next date it is due in Today's Question Revision (null = due immediately). */
  next_revision_on?: string | null;
  last_revised_on?: string | null;
  /** [FIX 6] Inline AI explanation from the Doubts tab (null until asked). */
  ai_explanation?: string | null;
  /** [FIX 6] When the student marked the doubt Resolved (null = open). */
  resolved_at?: string | null;
  /** FSRS card state (fsrsTypes.FsrsCardState as JSON) — written on every
   * graded review; null until the first review (the ladder is the fallback).
   * Parse with fsrsTypes.parseFsrsState, never by hand. */
  fsrs_json?: unknown;
  /** True when the student provided a complete solution/explanation — the
   * eligibility gate for the doubts-based Test Generator pool. */
  has_solution?: boolean | null;
  /** The student's own solution/explanation text, when provided. */
  solution_text?: string | null;
  /** Confidence (0–1) of the automatic subject/chapter tag. 1 = student-
   * confirmed; below the app's threshold the tag renders as an editable
   * suggestion chip. Null for legacy rows. */
  tag_confidence?: number | string | null;
  /** Optional reference link saved while resolving (YouTube with timestamp,
   * any URL). Shown alongside the student's written answer. */
  resolution_link?: string | null;
  /** Same-SESSION re-queue time written by an 'Again' rating: the card is
   * due today but held back until roughly this moment (config/revision
   * .AGAIN_REQUEUE_MINUTES later), so Again means "come back in ten minutes"
   * rather than "come back tomorrow". Null = nothing pending. */
  requeue_at?: string | null;
}

/** The stored tag confidence as a number 0–1 (null = untagged legacy row). */
export function flaggedTagConfidence(row: FlaggedRow): number | null {
  if (row.tag_confidence === null || row.tag_confidence === undefined || row.tag_confidence === '') return null;
  const n = typeof row.tag_confidence === 'number' ? row.tag_confidence : Number(row.tag_confidence);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

/** Eligibility gate for the Test Generator: only doubts the student has
 * solved (a complete solution/explanation saved) may enter the test pool. */
export function flaggedHasSolution(row: FlaggedRow): boolean {
  return row.has_solution === true && String(row.solution_text ?? '').trim().length > 0;
}

/** Spaced-repetition intervals (days) for saved questions: save → due next day.
 * FALLBACK ONLY since the FSRS integration — once a card has been reviewed at
 * least once its stored FSRS state (revisionEngine.fsrsReview) sets every
 * next date. The ladder lives in config/revision.ts (the ONE revision config). */
export const FLAG_REVISION_INTERVALS = QUESTION_REVISION_INTERVALS;

export function flaggedReviseCount(row: FlaggedRow): number {
  const n = typeof row.revise_count === 'number' ? row.revise_count : Number(row.revise_count ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** True when an 'Again' rating is still holding the card back inside this
 * session (its re-queue moment has not arrived yet). */
export function flaggedRequeuePending(row: FlaggedRow, nowMs: number = Date.now()): boolean {
  if (!row.requeue_at) return false;
  const at = new Date(String(row.requeue_at)).getTime();
  return Number.isFinite(at) && at > nowMs;
}

/** True when a saved question is due for revision on `today` (YYYY-MM-DD).
 * A card re-queued by 'Again' is due the same day but stays hidden until its
 * re-queue moment passes. */
export function flaggedDueOn(row: FlaggedRow, today: string, nowMs: number = Date.now()): boolean {
  if (row.status !== 'queued') return false;
  if (flaggedRequeuePending(row, nowMs)) return false;
  if (!row.next_revision_on) return true; // legacy rows: due immediately
  return String(row.next_revision_on).slice(0, 10) <= today;
}

/** Parse a flagged row's options into exactly 4 strings, or null when open-ended. */
export function flaggedOptions(row: FlaggedRow): string[] | null {
  let raw: unknown = row.options_json;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const options = raw.map((o) => String(o ?? '').trim()).filter(Boolean);
  return options.length >= 4 ? options.slice(0, 4) : null;
}

/** The revision label a flagged question groups under: concept → topic → subject. */
export function flaggedConceptLabel(row: FlaggedRow): string {
  return (row.concept || '').trim() || (row.topic || '').trim() || row.subject;
}

/** Word-boundary truncation with a real ellipsis — never a mid-word cut. */
export function truncateLabel(text: string, budget = 64): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= budget) return clean;
  const slice = clean.slice(0, Math.max(1, budget));
  const cut = slice.lastIndexOf(' ');
  return `${(cut > budget * 0.5 ? slice.slice(0, cut) : slice).replace(/[\s.,;:—-]+$/, '')}…`;
}

/**
 * Short display title for a Mistake Book card: generated label (concept or
 * chapter + question ref), never the raw OCR text — that stays stored for
 * search and test generation but is not a title.
 */
export function flaggedShortTitle(row: FlaggedRow): string {
  const label = (row.concept || '').trim() || (row.topic || '').trim();
  if (label) return `${truncateLabel(label, 48)} · Q${row.id}`;
  const stem = truncateLabel(row.question_text, 56);
  return stem || `Photo question · Q${row.id}`;
}

/** An image attached to a task or question (zuno_attachments). */
export interface AttachmentRow {
  id: number;
  parent_type: string;
  parent_key: string;
  image_url: string;
  created_on?: string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Parse the `topics` JSON of a test result, tolerating malformed rows. */
export function parseBreakdown(row: TestResultRow): TopicBreakdown[] {
  try {
    const parsed = JSON.parse(row.topics) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is TopicBreakdown =>
        !!entry && typeof entry === 'object' &&
        typeof (entry as TopicBreakdown).subject === 'string' &&
        typeof (entry as TopicBreakdown).topic === 'string')
      .map((entry) => ({
        subject: entry.subject,
        topic: entry.topic,
        correct: toNumber(entry.correct),
        total: Math.max(1, toNumber(entry.total)),
      }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Adaptive curation — Feature: questions calibrated to real level    */
/* ------------------------------------------------------------------ */

export interface AdaptiveContext {
  /** How many recent tests touched this topic (max 3 considered). */
  attempts: number;
  /** 0–100 accuracy across those attempts. */
  accuracy: number;
  /** Human line describing the calibration, also embedded in the prompt. */
  summary: string;
}

/**
 * Look at the student's last 3 Test Mode results that covered this topic and
 * summarise their real accuracy. Null when there is no history yet — the
 * caller shows no badge and the prompt stays neutral.
 */
export function adaptiveContextForTopic(
  results: TestResultRow[],
  subject: string,
  topic: string,
): AdaptiveContext | null {
  const key = topicKey(subject, topic);
  const touching = results
    .slice()
    .sort((a, b) => (b.created_on || '').localeCompare(a.created_on || '') || b.id - a.id)
    .map((row) => parseBreakdown(row).find((entry) => topicKey(entry.subject, entry.topic) === key))
    .filter((entry): entry is TopicBreakdown => !!entry)
    .slice(0, 3);
  if (touching.length === 0) return null;
  const correct = touching.reduce((sum, entry) => sum + entry.correct, 0);
  const total = touching.reduce((sum, entry) => sum + entry.total, 0);
  if (total <= 0) return null;
  const accuracy = Math.round((correct / total) * 100);
  const summary =
    accuracy < 50
      ? `Recent accuracy ${accuracy}% — drilling fundamentals hard, with extra-detailed explanations.`
      : accuracy <= 75
        ? `Recent accuracy ${accuracy}% — mixing medium and hard questions.`
        : `Recent accuracy ${accuracy}% — pushing hard and edge-case questions.`;
  return { attempts: touching.length, accuracy, summary };
}

/** The difficulty instruction the AI receives, calibrated by past accuracy. */
export function adaptivePromptFragment(requested: McqDifficulty, ctx: AdaptiveContext | null): string {
  if (!ctx) {
    if (requested === 'mixed') {
      return 'Difficulty: mixed — spread the set roughly evenly across easy, medium and hard questions, and label each element\'s "difficulty" accordingly.';
    }
    return `Difficulty: ${requested}. Keep every question at ${requested} level for this exam.`;
  }
  if (ctx.accuracy < 50) {
    return (
      `The student scored ${ctx.accuracy}% on this topic across their last ${ctx.attempts} test(s), so they are struggling. ` +
      'Generate HARD questions that target the core misconceptions, and make every explanation extra detailed — ' +
      'walk through WHY the right answer is right and why each trap is wrong.'
    );
  }
  if (ctx.accuracy <= 75) {
    return (
      `The student scored ${ctx.accuracy}% on this topic across their last ${ctx.attempts} test(s). ` +
      'Generate a roughly even mix of MEDIUM and HARD questions to stretch them without overwhelming.'
    );
  }
  return (
    `The student scored ${ctx.accuracy}% on this topic across their last ${ctx.attempts} test(s) — they know the basics. ` +
    'Generate HARD, edge-case and trap questions only; skip anything a strong student would find routine.'
  );
}

/* ------------------------------------------------------------------ */
/*  Robust JSON extraction                                             */
/* ------------------------------------------------------------------ */

/** Raised when the model's reply cannot be shaped into valid questions. */
export class McqParseError extends Error {
  constructor() {
    super('The AI reply was not valid question JSON');
    this.name = 'McqParseError';
  }
}

/** Pull the first JSON array out of a model reply that may include fences or prose. */
export function extractJsonArray(raw: string): unknown[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) throw new McqParseError();
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) throw new McqParseError();
    return parsed;
  } catch {
    throw new McqParseError();
  }
}

function normalizeDifficulty(value: unknown): 'easy' | 'medium' | 'hard' | null {
  if (typeof value !== 'string') return null;
  const d = value.trim().toLowerCase();
  return d === 'easy' || d === 'medium' || d === 'hard' ? d : null;
}

function normalizeLetter(value: unknown): McqLetter | null {
  if (typeof value !== 'string') return null;
  const letter = value.trim().toUpperCase().charAt(0);
  return (MCQ_LETTERS as string[]).includes(letter) ? (letter as McqLetter) : null;
}

/** Validate one raw model item into an insert-ready draft, or null to drop it. */
function toDraft(
  item: unknown,
  subject: string,
  topic: string,
  difficulty: McqDifficulty,
  createdOn: string,
): McqDraft | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const question = typeof record.question === 'string' ? record.question.trim() : '';
  const options = Array.isArray(record.options) ? record.options.map((o) => String(o ?? '').trim()) : [];
  const correct = normalizeLetter(record.correct);
  if (!question || options.length < 4 || options.slice(0, 4).some((o) => !o) || !correct) return null;
  const explanation = typeof record.explanation === 'string' ? record.explanation.trim() : '';
  const concept = typeof record.concept === 'string' ? record.concept.trim().slice(0, 90) : '';
  const itemDifficulty =
    difficulty === 'mixed' ? (normalizeDifficulty(record.difficulty) ?? 'medium') : difficulty;
  return {
    subject,
    topic,
    source_key: topicKey(subject, topic),
    question,
    option_a: options[0],
    option_b: options[1],
    option_c: options[2],
    option_d: options[3],
    correct,
    explanation: explanation || null,
    difficulty: itemDifficulty,
    concept: concept || null,
    image_url: null,
    created_on: createdOn,
  };
}

/* ------------------------------------------------------------------ */
/*  Shared US-exam bank — vetted questions before AI fallback          */
/* ------------------------------------------------------------------ */

const BANK_EXAM_ALIASES: Record<string, string> = {
  gre_general: 'gre',
};

/** Match profile ids to the stable ids used by exam_questions_bank. */
export function bankExamIdForProfile(profileExamId: string | null | undefined): string {
  const clean = String(profileExamId ?? '').trim().toLowerCase();
  return BANK_EXAM_ALIASES[clean] ?? clean;
}

function normalizedBankLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function labelsMatch(requested: string, stored: string | null | undefined): boolean {
  const left = normalizedBankLabel(requested);
  const right = normalizedBankLabel(stored);
  if (!left || !right) return false;
  return left === right || (Math.min(left.length, right.length) >= 8 && (left.includes(right) || right.includes(left)));
}

/** The exact slots a set owes each difficulty; mixed rotates evenly. */
export function bankDifficultyPlan(count: number, difficulty: McqDifficulty): Array<'easy' | 'medium' | 'hard'> {
  const safeCount = Math.max(0, Math.floor(count));
  if (difficulty !== 'mixed') return Array.from({ length: safeCount }, () => difficulty);
  const rotation: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
  return Array.from({ length: safeCount }, (_, index) => rotation[index % rotation.length]);
}

function shuffle<T>(rows: T[]): T[] {
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function validBankRow(row: ExamQuestionBankRow): boolean {
  return Boolean(
    String(row.question_text || '').trim() &&
    String(row.option_a || '').trim() &&
    String(row.option_b || '').trim() &&
    String(row.option_c || '').trim() &&
    String(row.option_d || '').trim() &&
    String(row.explanation || '').trim() &&
    String(row.source_url || '').trim() &&
    normalizeLetter(row.correct_answer) &&
    normalizeDifficulty(row.difficulty),
  );
}

/** True when a valid shared row belongs to this profile exam and target. */
export function examBankRowMatchesTarget(
  row: ExamQuestionBankRow,
  profileExamId: string | null | undefined,
  subject: string,
  topic: string,
): boolean {
  return row.exam_id === bankExamIdForProfile(profileExamId) &&
    validBankRow(row) &&
    labelsMatch(subject, row.subject) &&
    labelsMatch(topic, row.topic);
}

/**
 * Pick only rows that match this profile exam, subject/topic and requested
 * difficulty. Missing slots are intentionally returned to the caller so AI
 * fills precisely those slots instead of substituting unrelated bank rows.
 */
export function selectExamBankQuestions(args: {
  rows: ExamQuestionBankRow[];
  profileExamId: string | null | undefined;
  subject: string;
  topic: string;
  count: number;
  difficulty: McqDifficulty;
  answeredIds: Set<string>;
  today: string;
}): ExamBankSelection {
  const eligible = args.rows.filter((row) =>
    !args.answeredIds.has(row.id) &&
    examBankRowMatchesTarget(row, args.profileExamId, args.subject, args.topic),
  );
  const pools = new Map<'easy' | 'medium' | 'hard', ExamQuestionBankRow[]>([
    ['easy', shuffle(eligible.filter((row) => normalizeDifficulty(row.difficulty) === 'easy'))],
    ['medium', shuffle(eligible.filter((row) => normalizeDifficulty(row.difficulty) === 'medium'))],
    ['hard', shuffle(eligible.filter((row) => normalizeDifficulty(row.difficulty) === 'hard'))],
  ]);
  const selected: ExamQuestionBankRow[] = [];
  const missingDifficulties: Array<'easy' | 'medium' | 'hard'> = [];
  for (const slot of bankDifficultyPlan(args.count, args.difficulty)) {
    const row = pools.get(slot)?.shift();
    if (row) selected.push(row);
    else missingDifficulties.push(slot);
  }
  const drafts = selected.map<McqDraft>((row) => ({
    subject: args.subject,
    topic: args.topic,
    source_key: topicKey(args.subject, args.topic),
    question: (row.question_text ?? '').trim(),
    option_a: String(row.option_a).trim(),
    option_b: String(row.option_b).trim(),
    option_c: String(row.option_c).trim(),
    option_d: String(row.option_d).trim(),
    correct: normalizeLetter(row.correct_answer) as McqLetter,
    explanation: String(row.explanation ?? '').trim() || null,
    difficulty: normalizeDifficulty(row.difficulty),
    concept: String(row.topic ?? '').trim() || null,
    image_url: null,
    created_on: args.today,
    bank_question_id: row.id,
    source_url: String(row.source_url ?? '').trim() || null,
  }));
  return { drafts, missingDifficulties };
}

/* ------------------------------------------------------------------ */
/*  Generation — server-proxied, never a raw key in the client         */
/* ------------------------------------------------------------------ */

export interface GenerateMcqArgs {
  examLabel: string;
  subject: string;
  topic: string;
  count: number;
  difficulty: McqDifficulty;
  adaptive: AdaptiveContext | null;
  today: string;
  /** Stems already in the bank for this topic, so the model doesn't repeat them. */
  avoidQuestions?: string[];
}

/**
 * One round trip to the platform's OpenAI proxy → validated MCQ drafts.
 * Throws McqParseError when the reply cannot be repaired into at least one
 * valid question — callers show a friendly retry, never a blank screen.
 */
export async function generateMcqs(args: GenerateMcqArgs): Promise<McqDraft[]> {
  const { examLabel, subject, topic, count, difficulty, adaptive, today, avoidQuestions } = args;
  const avoid = (avoidQuestions ?? []).slice(0, 20).map((q) => q.slice(0, 120));
  // A hung generation request must never spin the preparing state forever —
  // abort after 90s so the caller's error + retry UI takes over.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: await aiProxyHeaders(),
    body: JSON.stringify({
      model: AI_MODELS.standard,
      reasoning_effort: 'none',
      messages: [
        {
          role: 'system',
          content:
            'You write exam-grade multiple-choice questions for students preparing for the exam named by the user. ' +
            'Return ONLY a valid JSON array — no prose, no markdown fences. Each element must be exactly: ' +
            '{"question": string, "options": [string, string, string, string], "correct": "A"|"B"|"C"|"D", "explanation": string, "concept": string, "difficulty": "easy"|"medium"|"hard"}. ' +
            'Options are the texts for A, B, C, D in order. Exactly one option is correct. ' +
            '"concept" is the SPECIFIC sub-concept the question tests (e.g. "Kirchhoff\'s loop rule", not just the topic name). ' +
            'Explanations teach: state why the answer is right and briefly why the traps are wrong. ' +
            'Randomise which letter is correct across the set.',
        },
        {
          role: 'user',
          content: [
            `Exam: ${examLabel}. Subject: ${subject}. Topic: ${topic}.`,
            `Write exactly ${count} questions.`,
            adaptivePromptFragment(difficulty, adaptive),
            avoid.length > 0 ? `Do NOT repeat these existing questions: ${JSON.stringify(avoid)}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
      max_completion_tokens: 2600,
      stream: false,
    }),
  }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`Generation failed (${response.status})`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const raw = String(data.choices?.[0]?.message?.content || '');
  const items = extractJsonArray(raw);
  const drafts = items
    .map((item) => toDraft(item, subject, topic, difficulty, today))
    .filter((draft): draft is McqDraft => draft !== null)
    .slice(0, count);
  if (drafts.length === 0) throw new McqParseError();
  return drafts;
}

/* ------------------------------------------------------------------ */
/*  Flagged questions → playable MCQs                                  */
/* ------------------------------------------------------------------ */

export interface FlaggedMcqShape {
  options: string[];
  correct: McqLetter;
  explanation: string | null;
}

/**
 * Turn flagged questions that lack MCQ options (open-ended, or extracted
 * without visible choices) into strict four-option MCQs in ONE proxy trip.
 * Returns a map of flagged-row id → options/correct/explanation. Rows the
 * model could not convert are simply absent — the caller skips them.
 */
export async function convertFlaggedToMcqs(
  rows: FlaggedRow[],
  examLabel: string,
): Promise<Map<number, FlaggedMcqShape>> {
  const result = new Map<number, FlaggedMcqShape>();
  if (rows.length === 0) return result;
  const payload = rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    concept: flaggedConceptLabel(row),
    question: row.question_text.slice(0, 600),
  }));
  // Same guard as generateMcqs: a hung conversion aborts after 90s so the
  // flagged-test preparing state always resolves into retry, never a freeze.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: await aiProxyHeaders(),
    body: JSON.stringify({
      model: AI_MODELS.standard,
      reasoning_effort: 'none',
      messages: [
        {
          role: 'system',
          content:
            `You convert a student's flagged exam questions into strict four-option MCQs for ${examLabel} practice. ` +
            'Return ONLY a valid JSON array — no prose, no fences. Each element: ' +
            '{"id": number (copy from input), "question": string (a clean, self-contained MCQ stem based on the flagged question), ' +
            '"options": [string, string, string, string], "correct": "A"|"B"|"C"|"D", "explanation": string}. ' +
            'Keep the original question\'s intent — test the SAME concept. For open-ended questions, write an MCQ that tests the same concept. ' +
            'Exactly one option is correct; distractors must be plausible. Randomise which letter is correct.',
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      max_completion_tokens: 2600,
      stream: false,
    }),
  }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`Conversion failed (${response.status})`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const raw = String(data.choices?.[0]?.message?.content || '');
  const items = extractJsonArray(raw);
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = Number(record.id);
    if (!Number.isFinite(id) || !rows.some((row) => row.id === id)) continue;
    const options = Array.isArray(record.options) ? record.options.map((o) => String(o ?? '').trim()) : [];
    const correct = normalizeLetter(record.correct);
    if (options.length < 4 || options.slice(0, 4).some((o) => !o) || !correct) continue;
    const question = typeof record.question === 'string' ? record.question.trim() : '';
    const explanation = typeof record.explanation === 'string' ? record.explanation.trim() : '';
    result.set(id, { options: options.slice(0, 4), correct, explanation: explanation || null });
    // A cleaned-up stem replaces a messy transcription for the test run only.
    if (question) {
      const row = rows.find((r) => r.id === id);
      if (row && question.length >= 12) row.question_text = question;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Small shared helpers                                               */
/* ------------------------------------------------------------------ */

export function optionText(question: Pick<McqQuestion, 'option_a' | 'option_b' | 'option_c' | 'option_d'>, letter: McqLetter): string {
  switch (letter) {
    case 'A':
      return question.option_a;
    case 'B':
      return question.option_b;
    case 'C':
      return question.option_c;
    default:
      return question.option_d;
  }
}

/** Percent 0–100, safe against zero totals. */
export function percentOf(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/** MM:SS for the test countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
