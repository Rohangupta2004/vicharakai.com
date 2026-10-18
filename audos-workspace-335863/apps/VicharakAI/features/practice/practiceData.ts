/**
 * Practice (PYQ Q-Bank) — data layer.
 *
 * Owns:
 *  - the vicharakai_question_attempts writes (every answered question),
 *  - the adaptive "For You" selection: questions from the student's weakest
 *    chapters first (weakness rows + real answer accuracy), mixed questions
 *    when no weakness data exists yet,
 *  - the weak-chapter signal Vicharree's contextual tip reads, and
 *  - the tab-to-tab filter handoff (Vicharree tap → Practice pre-filtered).
 *
 * The QUESTIONS themselves come from two places: the hand-verified official
 * PYQs seeded in data/questionBank.ts, plus the shared pyq_* WorkspaceDB bank
 * (open-dataset imports served by the pyq-practice-pool server function) —
 * nothing here generates or invents question content.
 */
import { useEffect, useMemo, useState } from 'react';
import type { TopicAttemptRow, WeakTopicInsight } from '../../adaptationEngine';
import { TABLES } from '../../services/database/tables';
import { useAllRows, verifiedDbFrom } from '../../services/database/dbClient';
import type { VicharreeTip } from '../../components/VicharreeLauncher';
import {
  BANK_EXAM_TO_PYQ_CODE,
  QUESTION_BANK,
  QUESTION_BANK_EXAM_LABELS,
  bankExamForProfileExam,
  bankExamForPyqCode,
  examsWithQuestions,
  questionsForExam,
  type QuestionBankEntry,
  type QuestionBankExam,
  type QuestionOptionLetter,
} from '../../data/questionBank';

/* ------------------------------------------------------------------ */
/*  Attempt rows (vicharakai_question_attempts)                        */
/* ------------------------------------------------------------------ */

export interface QuestionAttemptRow {
  id: number;
  user_id?: string | null;
  question_id: string;
  exam: string;
  subject?: string | null;
  chapter?: string | null;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  time_taken_seconds?: number | string | null;
  attempted_at: string;
}

/** Persist one answered question (fire-and-forget safe — callers catch). */
export async function recordQuestionAttempt(
  entry: QuestionBankEntry,
  selected: QuestionOptionLetter,
  timeTakenSeconds: number | null,
): Promise<void> {
  await verifiedDbFrom(TABLES.questionAttempts).insert({
    user_id: null,
    question_id: entry.id,
    exam: entry.exam,
    subject: entry.subject,
    chapter: entry.chapter,
    selected_option: selected,
    correct_option: entry.correct_option,
    is_correct: selected === entry.correct_option,
    time_taken_seconds:
      timeTakenSeconds !== null && Number.isFinite(timeTakenSeconds)
        ? Math.max(0, Math.round(timeTakenSeconds))
        : null,
    attempted_at: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/*  Label matching (bank chapters ↔ syllabus chapter ids/names)        */
/* ------------------------------------------------------------------ */

function normalizeLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The normalized key chapterAccuracyFromAttempts buckets by — exported so
 * screens look stats up with exactly the same normalization. */
export function chapterKey(label: string | null | undefined): string {
  return normalizeLabel(label);
}

/** Loose two-way containment match between a bank label and any study label
 * (chapter name, topic name, or a chapter_id slug like
 * 'neet_ug_physics_kinematics'). */
export function labelsRoughlyMatch(bankLabel: string, studyLabel: string | null | undefined): boolean {
  const left = normalizeLabel(bankLabel);
  const right = normalizeLabel(studyLabel);
  if (!left || !right) return false;
  if (left === right) return true;
  return (
    Math.min(left.length, right.length) >= 6 && (left.includes(right) || right.includes(left)) ||
    right.split(' ').filter((w) => w.length >= 5).some((w) => left.includes(w)) &&
      left.split(' ').filter((w) => w.length >= 5).some((w) => right.includes(w))
  );
}

/* ------------------------------------------------------------------ */
/*  Accuracy — per bank chapter                                        */
/* ------------------------------------------------------------------ */

export interface ChapterAccuracy {
  correct: number;
  total: number;
  /** 0–100. */
  accuracy: number;
}

/** Per-chapter accuracy from the practice attempt log (bank chapters only). */
export function chapterAccuracyFromAttempts(rows: QuestionAttemptRow[]): Map<string, ChapterAccuracy> {
  const map = new Map<string, ChapterAccuracy>();
  for (const row of rows) {
    const key = normalizeLabel(row.chapter);
    if (!key) continue;
    const bucket = map.get(key) ?? { correct: 0, total: 0, accuracy: 0 };
    bucket.total += 1;
    if (row.is_correct) bucket.correct += 1;
    map.set(key, bucket);
  }
  for (const bucket of map.values()) {
    bucket.accuracy = bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : 0;
  }
  return map;
}

/** Accuracy (0–100) of the STUDY attempt log (zuno_topic_attempts) restricted
 * to rows matching one bank chapter label — null when nothing matches. */
export function studyAccuracyForChapter(bankChapter: string, attempts: TopicAttemptRow[]): number | null {
  let correct = 0;
  let total = 0;
  for (const row of attempts) {
    if (row.result !== 'correct' && row.result !== 'wrong') continue;
    if (
      !labelsRoughlyMatch(bankChapter, row.topic_name) &&
      !labelsRoughlyMatch(bankChapter, row.chapter_id)
    ) continue;
    total += 1;
    if (row.result === 'correct') correct += 1;
  }
  if (total === 0) return null;
  return Math.round((correct / total) * 100);
}

/* ------------------------------------------------------------------ */
/*  "For You" — adaptive selection                                     */
/* ------------------------------------------------------------------ */

/** Accuracy below this marks a chapter weak for "For You" ordering. */
export const FOR_YOU_WEAK_ACCURACY = 70;
/** Accuracy below this makes Vicharree speak up about the chapter. */
export const VICHARREE_WEAK_ACCURACY = 60;
/** How many questions the Recommended queue holds per pass. */
export const FOR_YOU_COUNT = 10;

export interface ForYouArgs {
  exam: QuestionBankExam;
  /** The question pool to pick from (merged static + DB bank). Falls back to
   * the static bank when omitted. */
  pool?: QuestionBankEntry[];
  /** Adaptation-engine weak topics (already sorted, weakest first). */
  weakInsights: WeakTopicInsight[];
  /** zuno_topic_attempts rows (study/test history). */
  topicAttempts: TopicAttemptRow[];
  /** vicharakai_question_attempts rows (this feature's own history). */
  bankAttempts: QuestionAttemptRow[];
}

export interface ForYouResult {
  questions: QuestionBankEntry[];
  /** True when weakness data drove the pick (false = mixed starter set). */
  personalized: boolean;
  /** Plain-language WHY per recommended question id — shown on the card and
   * written to the explainability log (zuno_recommendation_log). */
  reasonById: Record<string, string>;
}

/** Deterministic shuffle so the mixed set is stable within a day. */
function daySeededShuffle<T>(rows: T[]): T[] {
  const day = new Date();
  let seed = day.getFullYear() * 372 + (day.getMonth() + 1) * 31 + day.getDate();
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The "For You" queue: PYQs from chapters the student is measurably weak in —
 * unresolved weakness rows first, then chapters answered below 70% accuracy
 * (practice or study history). Questions already answered CORRECTLY are held
 * back until everything else ran out. With no weakness data at all, a mixed
 * day-stable starter set from their exam is returned instead.
 */
export function selectForYouQuestions(args: ForYouArgs): ForYouResult {
  const pool = args.pool && args.pool.length > 0 ? args.pool : questionsForExam(args.exam);
  if (pool.length === 0) return { questions: [], personalized: false, reasonById: {} };

  const practiceAccuracy = chapterAccuracyFromAttempts(
    args.bankAttempts.filter((row) => row.exam === args.exam),
  );
  const answeredCorrectly = new Set(
    args.bankAttempts.filter((row) => row.is_correct).map((row) => row.question_id),
  );

  let personalized = false;
  const reasonById: Record<string, string> = {};
  const scored = pool.map((entry) => {
    let score = 0;
    let reason: string | null = null;
    /* 1 — adaptation-engine weakness rows (weakest first, strongest signal). */
    for (const weak of args.weakInsights) {
      if (
        labelsRoughlyMatch(entry.chapter, weak.chapterName) ||
        labelsRoughlyMatch(entry.chapter, weak.topicName) ||
        entry.tags.some((tag) => labelsRoughlyMatch(tag.replace(/-/g, ' '), weak.topicName))
      ) {
        score += 100 + Math.min(100, weak.weaknessScore);
        reason = `You're slipping on ${weak.chapterName || weak.topicName} — this question targets it`;
        personalized = true;
        break;
      }
    }
    /* 2 — low accuracy in THIS practice bank. */
    const practice = practiceAccuracy.get(normalizeLabel(entry.chapter));
    if (practice && practice.total >= 2 && practice.accuracy < FOR_YOU_WEAK_ACCURACY) {
      score += 80 + (FOR_YOU_WEAK_ACCURACY - practice.accuracy);
      if (!reason) reason = `You're at ${practice.accuracy}% in ${entry.chapter} here — let's raise it`;
      personalized = true;
    }
    /* 3 — low accuracy in the study/test history. */
    const study = studyAccuracyForChapter(entry.chapter, args.topicAttempts);
    if (study !== null && study < FOR_YOU_WEAK_ACCURACY) {
      score += 40 + (FOR_YOU_WEAK_ACCURACY - study);
      if (!reason) reason = `Your tests show ${entry.chapter} needs work (${study}% accuracy)`;
      personalized = true;
    }
    /* Already answered correctly → hold back. */
    if (answeredCorrectly.has(entry.id)) score -= 500;
    return { entry, score, reason };
  });

  if (!personalized) {
    const questions = daySeededShuffle(pool.filter((entry) => !answeredCorrectly.has(entry.id)))
      .concat(daySeededShuffle(pool.filter((entry) => answeredCorrectly.has(entry.id))))
      .slice(0, FOR_YOU_COUNT);
    for (const entry of questions) {
      reasonById[entry.id] = `New for you — from ${entry.chapter}. Answering teaches me your weak spots`;
    }
    return { questions, personalized: false, reasonById };
  }

  const ranked = scored.sort((a, b) => b.score - a.score).slice(0, FOR_YOU_COUNT);
  for (const item of ranked) {
    reasonById[item.entry.id] =
      item.reason ?? `Fresh practice from ${item.entry.chapter} to keep your coverage broad`;
  }
  return { questions: ranked.map((item) => item.entry), personalized: true, reasonById };
}

/* ------------------------------------------------------------------ */
/*  DB-backed question pool (pyq_* tables via pyq-practice-pool)       */
/* ------------------------------------------------------------------ */

/**
 * Since the open-dataset seeding (2026-09-25) the Practice tab serves the
 * shared pyq_* WorkspaceDB bank — MedMCQA (real previous-year AIIMS/NEET PG
 * MCQs), MedQA and MMLU open-dataset practice questions — on top of the
 * hand-verified static bank. The pyq-practice-pool server function joins
 * questions + options + answers + sources server-side, so the browser makes
 * ONE request per exam instead of N+1 table reads. Every DB entry names its
 * source dataset on the card, and a network failure never blanks the tab —
 * the static bank is the floor.
 */

interface PracticePoolWireEntry {
  id: string;
  subject: string;
  chapter: string;
  year: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  official_source: string;
  difficulty: string;
  tags: string[];
}

const POOL_FETCH_LIMIT = 200;
const POOL_TIMEOUT_MS = 10_000;

function hooksSpaceId(): string | null {
  try {
    const w = window as unknown as { __SPACE_ID__?: unknown; __WORKSPACE_ID__?: unknown };
    if (typeof w.__SPACE_ID__ === 'string' && w.__SPACE_ID__) return w.__SPACE_ID__;
    if (typeof w.__WORKSPACE_ID__ === 'string' && w.__WORKSPACE_ID__) return w.__WORKSPACE_ID__;
  } catch {
    /* no window globals — the static bank covers it */
  }
  return null;
}

function poolEndpoint(): string | null {
  const spaceId = hooksSpaceId();
  return spaceId ? `/api/hooks/execute/${spaceId}/pyq-practice-pool` : null;
}

function poolAbortSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(POOL_TIMEOUT_MS)
    : undefined;
}

function isOptionLetter(value: unknown): value is QuestionOptionLetter {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

function poolDifficulty(value: unknown): QuestionBankEntry['difficulty'] {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

function wireToEntry(exam: QuestionBankExam, wire: PracticePoolWireEntry): QuestionBankEntry | null {
  if (!wire || !wire.id || !wire.question_text) return null;
  if (!isOptionLetter(wire.correct_option)) return null;
  if (!wire.option_a || !wire.option_b || !wire.option_c || !wire.option_d) return null;
  return {
    id: wire.id,
    exam,
    subject: wire.subject || 'General',
    chapter: wire.chapter || wire.subject || 'General',
    year: Number(wire.year) || 2024,
    question_text: wire.question_text,
    option_a: wire.option_a,
    option_b: wire.option_b,
    option_c: wire.option_c,
    option_d: wire.option_d,
    correct_option: wire.correct_option,
    explanation:
      wire.explanation || `The source dataset's answer key marks option ${wire.correct_option} as correct.`,
    official_source: wire.official_source || 'Open dataset',
    difficulty: poolDifficulty(wire.difficulty),
    tags: Array.isArray(wire.tags) ? wire.tags.map(String) : [],
  };
}

/** Session-scoped caches — one successful fetch per exam per page load. */
const poolCache = new Map<QuestionBankExam, QuestionBankEntry[]>();
let examCountsCache: Map<QuestionBankExam, number> | null = null;

/** Merged question pool for one exam: hand-verified static entries first,
 * then DB bank entries (text-deduped against the static ones). */
export async function loadPracticePool(exam: QuestionBankExam): Promise<QuestionBankEntry[]> {
  const cached = poolCache.get(exam);
  if (cached) return cached;
  const staticEntries = questionsForExam(exam);
  const endpoint = poolEndpoint();
  if (!endpoint) return staticEntries;
  try {
    const code = BANK_EXAM_TO_PYQ_CODE[exam];
    const signal = poolAbortSignal();
    const res = await fetch(
      `${endpoint}?exam=${encodeURIComponent(code)}&limit=${POOL_FETCH_LIMIT}`,
      signal ? { signal } : undefined,
    );
    if (!res.ok) return staticEntries;
    const payload = (await res.json()) as { entries?: unknown; data?: { entries?: unknown } };
    // The hook runner may wrap the payload under `data` alongside its `_meta`.
    const wires = (Array.isArray(payload.entries) ? payload.entries : payload.data?.entries) as
      | PracticePoolWireEntry[]
      | undefined;
    if (!Array.isArray(wires)) return staticEntries;
    const seen = new Set(staticEntries.map((entry) => chapterKey(entry.question_text)));
    const merged = [...staticEntries];
    for (const wire of wires) {
      const entry = wireToEntry(exam, wire);
      if (!entry) continue;
      const key = chapterKey(entry.question_text);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
    poolCache.set(exam, merged);
    return merged;
  } catch {
    return staticEntries; // network failure — the static bank is the floor
  }
}

/** React hook: the merged pool for the selected exam. Static entries render
 * immediately; the DB bank arrives when the fetch lands. */
export function usePracticePool(exam: QuestionBankExam | null): {
  questions: QuestionBankEntry[];
  loading: boolean;
} {
  const [state, setState] = useState<{
    exam: QuestionBankExam | null;
    questions: QuestionBankEntry[];
    loading: boolean;
  }>(() => ({
    exam,
    questions: exam ? poolCache.get(exam) ?? questionsForExam(exam) : [],
    loading: exam ? !poolCache.has(exam) : false,
  }));
  useEffect(() => {
    if (!exam) {
      setState({ exam: null, questions: [], loading: false });
      return;
    }
    const cached = poolCache.get(exam);
    if (cached) {
      setState({ exam, questions: cached, loading: false });
      return;
    }
    let cancelled = false;
    setState({ exam, questions: questionsForExam(exam), loading: true });
    void loadPracticePool(exam).then((questions) => {
      if (!cancelled) setState({ exam, questions, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [exam]);
  if (state.exam !== exam) {
    return { questions: exam ? poolCache.get(exam) ?? questionsForExam(exam) : [], loading: Boolean(exam) };
  }
  return { questions: state.questions, loading: state.loading };
}

/** DB bank question counts per bank exam (pyq-practice-pool mode 'exams'). */
export async function fetchPracticeExamCounts(): Promise<Map<QuestionBankExam, number>> {
  if (examCountsCache) return examCountsCache;
  const counts = new Map<QuestionBankExam, number>();
  const endpoint = poolEndpoint();
  if (!endpoint) return counts;
  try {
    const signal = poolAbortSignal();
    const res = await fetch(`${endpoint}?mode=exams`, signal ? { signal } : undefined);
    if (!res.ok) return counts;
    const payload = (await res.json()) as { exams?: unknown; data?: { exams?: unknown } };
    const rows = (Array.isArray(payload.exams) ? payload.exams : payload.data?.exams) as
      | Array<{ code?: unknown; questionCount?: unknown }>
      | undefined;
    if (!Array.isArray(rows)) return counts;
    for (const row of rows) {
      const bankExam = bankExamForPyqCode(typeof row.code === 'string' ? row.code : null);
      const count = Number(row.questionCount) || 0;
      if (bankExam && count > 0) counts.set(bankExam, count);
    }
    examCountsCache = counts;
    return counts;
  } catch {
    return counts;
  }
}

/** React hook: bank exams that actually hold questions (static or DB), in
 * the stable label order. */
export function useAvailableBankExams(): QuestionBankExam[] {
  const [dbExams, setDbExams] = useState<QuestionBankExam[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchPracticeExamCounts().then((counts) => {
      if (!cancelled) setDbExams([...counts.keys()]);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => {
    const available = new Set(examsWithQuestions());
    for (const exam of dbExams) available.add(exam);
    const ordered = Object.keys(QUESTION_BANK_EXAM_LABELS) as QuestionBankExam[];
    return ordered.filter((exam) => available.has(exam));
  }, [dbExams]);
}

/* ------------------------------------------------------------------ */
/*  Browse structure + paged chapter questions (server-side bank)      */
/* ------------------------------------------------------------------ */

export interface PracticeChapterInfo {
  name: string;
  questionCount: number;
}

export interface PracticeSubjectInfo {
  subject: string;
  questionCount: number;
  /** Chapters that exist in the bank (the list below is capped server-side). */
  totalChapters: number;
  chapters: PracticeChapterInfo[];
}

const structureCache = new Map<QuestionBankExam, PracticeSubjectInfo[]>();
const pageCache = new Map<string, { entries: QuestionBankEntry[]; total: number }>();

/** How many questions a browse runner loads per page. */
export const CHAPTER_PAGE_SIZE = 20;

/** Subjects + top chapters (with FULL-bank question counts) for one exam. */
export async function fetchPracticeStructure(exam: QuestionBankExam): Promise<PracticeSubjectInfo[]> {
  const cached = structureCache.get(exam);
  if (cached) return cached;
  const endpoint = poolEndpoint();
  if (!endpoint) return [];
  try {
    const code = BANK_EXAM_TO_PYQ_CODE[exam];
    const signal = poolAbortSignal();
    const res = await fetch(
      `${endpoint}?exam=${encodeURIComponent(code)}&mode=structure`,
      signal ? { signal } : undefined,
    );
    if (!res.ok) return [];
    const payload = (await res.json()) as { subjects?: unknown; data?: { subjects?: unknown } };
    const rows = (Array.isArray(payload.subjects) ? payload.subjects : payload.data?.subjects) as
      | PracticeSubjectInfo[]
      | undefined;
    if (!Array.isArray(rows)) return [];
    structureCache.set(exam, rows);
    return rows;
  } catch {
    return [];
  }
}

/** React hook: the browse structure for the selected exam. */
export function usePracticeStructure(exam: QuestionBankExam | null): {
  subjects: PracticeSubjectInfo[];
  loading: boolean;
} {
  const [state, setState] = useState<{
    exam: QuestionBankExam | null;
    subjects: PracticeSubjectInfo[];
    loading: boolean;
  }>(() => ({
    exam,
    subjects: (exam && structureCache.get(exam)) || [],
    loading: exam ? !structureCache.has(exam) : false,
  }));
  useEffect(() => {
    if (!exam) {
      setState({ exam: null, subjects: [], loading: false });
      return;
    }
    const cached = structureCache.get(exam);
    if (cached) {
      setState({ exam, subjects: cached, loading: false });
      return;
    }
    let cancelled = false;
    setState({ exam, subjects: [], loading: true });
    void fetchPracticeStructure(exam).then((subjects) => {
      if (!cancelled) setState({ exam, subjects, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [exam]);
  if (state.exam !== exam) {
    return { subjects: (exam && structureCache.get(exam)) || [], loading: Boolean(exam) };
  }
  return { subjects: state.subjects, loading: state.loading };
}

/** One page of bank questions for a subject and/or chapter (server-filtered,
 * so even a 4,500-question exam browses in small bites, never all at once). */
export async function fetchQuestionPage(
  exam: QuestionBankExam,
  opts: { subject?: string | null; chapter?: string | null; offset?: number; limit?: number },
): Promise<{ entries: QuestionBankEntry[]; total: number }> {
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, opts.limit ?? CHAPTER_PAGE_SIZE);
  const cacheKey = [exam, opts.subject ?? '', opts.chapter ?? '', offset, limit].join('|');
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;
  const endpoint = poolEndpoint();
  if (!endpoint) return { entries: [], total: 0 };
  try {
    const code = BANK_EXAM_TO_PYQ_CODE[exam];
    const params = new URLSearchParams({ exam: code, limit: String(limit), offset: String(offset) });
    if (opts.subject) params.set('subject', opts.subject);
    if (opts.chapter) params.set('chapter', opts.chapter);
    const signal = poolAbortSignal();
    const res = await fetch(`${endpoint}?${params.toString()}`, signal ? { signal } : undefined);
    if (!res.ok) return { entries: [], total: 0 };
    const payload = (await res.json()) as {
      entries?: unknown;
      total?: unknown;
      data?: { entries?: unknown; total?: unknown };
    };
    const wires = (Array.isArray(payload.entries) ? payload.entries : payload.data?.entries) as
      | PracticePoolWireEntry[]
      | undefined;
    const total = Number(payload.total ?? payload.data?.total) || 0;
    if (!Array.isArray(wires)) return { entries: [], total: 0 };
    const entries: QuestionBankEntry[] = [];
    for (const wire of wires) {
      const entry = wireToEntry(exam, wire);
      if (entry) entries.push(entry);
    }
    const page = { entries, total };
    pageCache.set(cacheKey, page);
    return page;
  } catch {
    return { entries: [], total: 0 };
  }
}

/* ------------------------------------------------------------------ */
/*  Recommendation logging (intelligence-layer explainability)         */
/* ------------------------------------------------------------------ */

const loggedRecommendations = new Set<string>();

/** Log one SHOWN question recommendation to the explainability log
 * (zuno_recommendation_log) — the same place the daily planner and coach
 * record WHY they picked something. Deduped per question per day; write is
 * fire-and-forget and never blocks the card. */
export function logQuestionRecommendation(entry: QuestionBankEntry, reason: string): void {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${entry.id}|${day}`;
  if (loggedRecommendations.has(key)) return;
  loggedRecommendations.add(key);
  void verifiedDbFrom(TABLES.recommendationLog)
    .insert({
      kind: 'now-pick',
      recommendation: `Practice question: ${entry.chapter} (${entry.subject}, ${QUESTION_BANK_EXAM_LABELS[entry.exam]})`,
      reason,
      data_used: 'practice-bank attempts + weakness scores + test history',
      action_taken: 'question recommended',
      created_on: day,
    })
    .catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/*  Vicharree's weak-chapter signal                                    */
/* ------------------------------------------------------------------ */

export interface VicharreeWeakSignal {
  /** Human chapter/topic label to show in the tip. */
  label: string;
  /** True when the seeded bank holds questions for it (tip can deep-link). */
  hasBankQuestions: boolean;
  /** The bank exam + chapter to pre-filter Practice with, when available. */
  exam: QuestionBankExam | null;
  chapter: string | null;
}

/**
 * The one chapter Vicharree should nudge about: the weakest unresolved topic
 * from the adaptation engine, or any bank chapter the student answers below
 * 60% accuracy. Null when the student has no measurable weak spot yet.
 */
export function vicharreeWeakSignal(args: {
  profileExamId: string | null | undefined;
  weakInsights: WeakTopicInsight[];
  topicAttempts: TopicAttemptRow[];
  bankAttempts: QuestionAttemptRow[];
}): VicharreeWeakSignal | null {
  const bankExam = bankExamForProfileExam(args.profileExamId);

  /* Weakness rows first — they are already sorted weakest-first. */
  const top = args.weakInsights[0];
  if (top && top.weaknessScore >= 40) {
    const label = top.chapterName || top.topicName;
    const bankMatch = QUESTION_BANK.find(
      (entry) =>
        (bankExam === null || entry.exam === bankExam) &&
        (labelsRoughlyMatch(entry.chapter, top.chapterName) || labelsRoughlyMatch(entry.chapter, top.topicName)),
    );
    return {
      label,
      hasBankQuestions: Boolean(bankMatch),
      exam: bankMatch ? bankMatch.exam : bankExam,
      chapter: bankMatch ? bankMatch.chapter : null,
    };
  }

  /* Then: any bank chapter with real attempts and sub-60% accuracy. */
  const accuracy = chapterAccuracyFromAttempts(args.bankAttempts);
  let worst: { chapter: string; accuracy: number } | null = null;
  for (const entry of QUESTION_BANK) {
    if (bankExam !== null && entry.exam !== bankExam) continue;
    const key = normalizeLabel(entry.chapter);
    const bucket = accuracy.get(key);
    if (!bucket || bucket.total < 2 || bucket.accuracy >= VICHARREE_WEAK_ACCURACY) continue;
    if (!worst || bucket.accuracy < worst.accuracy) worst = { chapter: entry.chapter, accuracy: bucket.accuracy };
  }
  if (worst) {
    const entry = QUESTION_BANK.find(
      (q) => (bankExam === null || q.exam === bankExam) && q.chapter === worst.chapter,
    );
    return {
      label: worst.chapter,
      hasBankQuestions: true,
      exam: entry ? entry.exam : bankExam,
      chapter: worst.chapter,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Tab-to-tab filter handoff (Vicharree tap → Practice pre-filtered)  */
/* ------------------------------------------------------------------ */

/**
 * zuno_meta key holding the exam the student chose to practise, when it is
 * NOT simply their profile exam. It lives in the database (never only in
 * localStorage) so "I'm practising JEE questions" survives a reload and
 * follows the account onto another device.
 */
export const PRACTICE_EXAM_META_KEY = 'practice_exam_id';

const PRACTICE_FILTER_KEY = 'vicharak_practice_filter';

/** Fired after a filter request lands, so an already-mounted screen re-reads. */
export const PRACTICE_FILTER_EVENT = 'vicharak:practice-filter';

export interface PracticeFilterRequest {
  exam?: QuestionBankExam;
  subject?: string;
  chapter?: string;
}

/** Leave a filter request for the Practice screen (read on its next mount, or
 * immediately when the screen is already open). */
export function requestPracticeFilter(filter: PracticeFilterRequest): void {
  try {
    window.localStorage.setItem(PRACTICE_FILTER_KEY, JSON.stringify(filter));
    window.dispatchEvent(new CustomEvent(PRACTICE_FILTER_EVENT));
  } catch {
    /* storage unavailable — Practice simply opens unfiltered */
  }
}

/** Consume (read + clear) a pending Practice filter request. */
export function consumePracticeFilter(): PracticeFilterRequest | null {
  try {
    const raw = window.localStorage.getItem(PRACTICE_FILTER_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(PRACTICE_FILTER_KEY);
    const parsed = JSON.parse(raw) as PracticeFilterRequest;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Vicharree's contextual tip                                         */
/* ------------------------------------------------------------------ */

export interface VicharreeTipInputs {
  /** The student's chosen exam id (profile.exam). */
  profileExam: string | null;
  /** data.weakTopicInsights — adaptation-engine weak topics, weakest first. */
  weakInsights: WeakTopicInsight[];
  /** data.attemptRows — zuno_topic_attempts. */
  topicAttempts: TopicAttemptRow[];
  /** data.todayTargets.length — today's still-pending targets. */
  todayCount: number;
  /** data.doneToday.length — tasks completed today. */
  doneCount: number;
}

/**
 * The contextual tip Vicharree shows after the one-time intro, in priority
 * order: nothing planned yet → weak topic detected (deep-links into Practice)
 * → everything done. Null when no state is worth a nudge.
 */
export function useVicharreeTip(
  inputs: VicharreeTipInputs,
  openPractice: (filter?: PracticeFilterRequest) => void,
): VicharreeTip | null {
  const attemptsQ = useAllRows<QuestionAttemptRow>(TABLES.questionAttempts, {
    orderBy: { column: 'id', direction: 'asc' },
  });
  const bankAttempts = attemptsQ.data;

  return useMemo(() => {
    if (inputs.todayCount === 0 && inputs.doneCount === 0) {
      return {
        id: 'no-tasks',
        text: "Add today's topics and I'll track what's slipping! \uD83D\uDCD6",
      };
    }
    const weak = vicharreeWeakSignal({
      profileExamId: inputs.profileExam,
      weakInsights: inputs.weakInsights,
      topicAttempts: inputs.topicAttempts,
      bankAttempts,
    });
    if (weak) {
      if (weak.hasBankQuestions && weak.chapter) {
        const filter: PracticeFilterRequest = {
          ...(weak.exam ? { exam: weak.exam } : {}),
          chapter: weak.chapter,
        };
        return {
          id: `weak|${weak.chapter}`,
          text: `You're slipping on ${weak.label}. Tap to practice a PYQ! \uD83D\uDCA1`,
          onTap: () => openPractice(filter),
        };
      }
      return {
        id: `weak|${weak.label}`,
        text: `You're slipping on ${weak.label}. Want to practice a question? \uD83D\uDCA1`,
        onTap: () => openPractice(),
      };
    }
    if (inputs.todayCount === 0 && inputs.doneCount > 0) {
      return {
        id: 'all-done',
        text: 'You crushed today! Come back tomorrow \uD83D\uDD25',
      };
    }
    return null;
    // openPractice is a stable shell callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputs.todayCount,
    inputs.doneCount,
    inputs.profileExam,
    inputs.weakInsights,
    inputs.topicAttempts,
    bankAttempts,
  ]);
}
