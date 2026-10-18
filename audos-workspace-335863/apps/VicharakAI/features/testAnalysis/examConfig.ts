/**
 * ExamConfig — the marking scheme of ONE exam, and the only place marks
 * arithmetic for mock analysis happens.
 *
 * THE CONTRACT
 *  - The schemes themselves are DATA, not constants: they live as editable
 *    rows in `vicharakai_exam_configs`. The seeds below exist only so a fresh
 *    workspace has the shipped presets to start from; once seeded the student
 *    (or Otto) can edit any of them and the app reads the row, never the seed.
 *  - `marks_delta` is ALWAYS derived at read time (see `marksDelta`) and is
 *    never stored on an entry.
 *  - `unit_label` controls WORDING ONLY. No scheduling, ranking or arithmetic
 *    branches on it. For a no-penalty exam "lost 9 questions" and "missed 9
 *    questions" are the same number; only the noun differs.
 *  - `allows_partial_credit` is the ONLY reason the tagging flow ever asks for
 *    a number per question.
 *  - Scaled scores (LSAT/MCAT) are DISPLAY ONLY and must always be labelled
 *    'estimated'. Raw points are never summed across exams with different
 *    schemes.
 */

export type MarksUnit = 'marks' | 'questions' | 'percent';

export const MARKS_UNITS: MarksUnit[] = ['marks', 'questions', 'percent'];

/** The PRD schema, exactly. Everything downstream reads this shape. */
export interface ExamConfig {
  exam_type: string;
  marks_correct: number;
  /** 0 for no-penalty exams (LSAT, MCAT, USMLE, CAT non-MCQ...). */
  marks_incorrect: number;
  /** Typically 0. */
  marks_skipped: number;
  /** Wording only — never a branch on anything else. */
  unit_label: MarksUnit;
  allows_partial_credit: boolean;
  /** Display only. */
  scaled_min: number | null;
  /** Display only. */
  scaled_max: number | null;
  target_seconds_per_q: number;
}

/** A stored row of `vicharakai_exam_configs` (numerics may arrive as text). */
export interface ExamConfigRow {
  id: number;
  user_id?: string | null;
  exam_type: string;
  marks_correct: number | string;
  marks_incorrect: number | string;
  marks_skipped: number | string;
  unit_label: string;
  allows_partial_credit?: boolean | null;
  scaled_min?: number | string | null;
  scaled_max?: number | string | null;
  target_seconds_per_q: number | string;
  /** 'active' = usable; 'todo' = deliberately unfinished stub. */
  status?: string | null;
  /** True when a region/province must be picked before the scheme resolves. */
  requires_region?: boolean | null;
  is_preset?: boolean | null;
  notes?: string | null;
  updated_at_iso?: string | null;
}

/** One seed row. `match` only ever helps the initial lookup — the stored
 * `exam_type` is what the student sees and edits. */
export interface ExamConfigSeed extends ExamConfig {
  status: 'active' | 'todo';
  requires_region: boolean;
  notes: string | null;
  /** Keyword test so a free-typed exam label ('NEET UG 2027') still resolves. */
  match: RegExp | null;
}

function seed(
  exam_type: string,
  marks_correct: number,
  marks_incorrect: number,
  unit_label: MarksUnit,
  target_seconds_per_q: number,
  extra: Partial<ExamConfigSeed> = {},
): ExamConfigSeed {
  return {
    exam_type,
    marks_correct,
    marks_incorrect,
    marks_skipped: 0,
    unit_label,
    allows_partial_credit: false,
    scaled_min: null,
    scaled_max: null,
    target_seconds_per_q,
    status: 'active',
    requires_region: false,
    notes: null,
    match: null,
    ...extra,
  };
}

/**
 * The shipped presets. Written to the table once (see seedExamConfigs in
 * useTestAnalysis) and read from the table from then on.
 */
export const EXAM_CONFIG_PRESETS: ExamConfigSeed[] = [
  seed('JEE Main', 4, -1, 'marks', 180, { match: /\bjee\b/i }),
  seed('NEET UG', 4, -1, 'marks', 72, { match: /neet\s*ug|^neet$|neet(?!\s*pg)/i }),
  seed('UPSC Prelims GS', 2, -0.667, 'marks', 72, {
    match: /upsc.*(prelim|gs|general studies)|civil\s*services.*prelim/i,
    notes: 'Paper I (General Studies): one third of 2 marks deducted per wrong answer.',
  }),
  seed('UPSC Prelims CSAT', 2.5, -0.833, 'marks', 90, {
    match: /csat|upsc.*paper\s*(ii|2)/i,
    notes: 'Paper II (CSAT): one third of 2.5 marks deducted per wrong answer.',
  }),
  seed('CAT MCQ', 3, -1, 'marks', 110, { match: /\bcat\b(?!.*non)/i }),
  seed('CAT non-MCQ', 3, 0, 'marks', 110, {
    match: /cat.*non[\s-]*mcq|\btita\b/i,
    notes: 'TITA / type-in-the-answer questions carry no penalty.',
  }),
  seed('LSAT', 1, 0, 'questions', 60, {
    match: /\blsat\b/i,
    scaled_min: 120,
    scaled_max: 180,
    notes: 'No penalty for wrong answers. Any 120-180 figure shown is an estimate only.',
  }),
  seed('MCAT', 1, 0, 'questions', 95, {
    match: /\bmcat\b/i,
    scaled_min: 472,
    scaled_max: 528,
    notes: 'No penalty for wrong answers. Any 472-528 figure shown is an estimate only.',
  }),
  seed('USMLE Step 2 CK', 1, 0, 'questions', 95, { match: /usmle.*step\s*2|step\s*2\s*ck/i }),
  seed('USMLE Step 1', 1, 0, 'percent', 95, {
    match: /usmle.*step\s*1|step\s*1/i,
    notes: 'Reported pass/fail; percent-correct is the only meaningful unit here.',
  }),
];

/**
 * Verified additional schemes. Regional templates stay active but are never
 * resolved directly: the student must choose a state/province, which creates
 * an editable stored row such as `Gaokao — Jiangsu`.
 *
 * State papers and Gaokao cannot honestly share one flat per-question value.
 * Their templates therefore enable per-question earned/possible marks; the
 * 1/0 values are a neutral fallback only when an entry has no detailed marks.
 */
export const EXAM_CONFIG_ADDITIONAL_PRESETS: ExamConfigSeed[] = [
  seed('NEET PG', 4, -1, 'marks', 70, {
    match: /neet\s*pg/i,
    notes: 'NBEMS 2026: 180 MCQs in 210 minutes; +4 correct, -1 incorrect, 0 unattempted.',
  }),
  seed('INI-CET', 1, -0.333, 'marks', 54, {
    match: /ini[\s-]*cet/i,
    notes: 'AIIMS INI-CET: 200 questions in 180 minutes; +1 correct, -1/3 incorrect, 0 unanswered.',
  }),
  seed('State board / state PSC paper', 1, 0, 'marks', 90, {
    requires_region: true,
    allows_partial_credit: true,
    match: /state.*(?:board|psc|pcs|civil service)|\b(?:mpsc|bpsc|jpsc|kpsc|rpsc|uppsc|gpsc|hpsc|ppsc|tnpsc|ap(?:psc|spsc)|tspsc)\b/i,
    notes: 'Official rules vary by commission and paper (for example, 2026 Kerala PSC uses -1/3 while JPSC uses no negative marking). Choose a state, then keep the editable regional row aligned with that paper; enter earned and possible marks per question for mixed formats.',
  }),
  seed('Gaokao', 1, 0, 'marks', 120, {
    requires_region: true,
    allows_partial_credit: true,
    match: /\bgaokao\b|高考/i,
    notes: 'Provincial rules differ. Beijing and Jiangsu both report 750-point totals, but subject composition and score conversion vary; choose a province and enter earned and possible marks per question.',
  }),
  seed('UPSC Mains', 15, 0, 'marks', 540, {
    allows_partial_credit: true,
    match: /upsc.*mains?|civil\s*services.*main/i,
    notes: 'UPSC 2026: conventional written papers; merit papers are 250 marks and 3 hours. GS papers use 20 questions (10 × 10 marks, 10 × 15 marks), so enter earned and possible marks per answer.',
  }),
];

export const EXAM_CONFIG_SEEDS: ExamConfigSeed[] = [...EXAM_CONFIG_PRESETS, ...EXAM_CONFIG_ADDITIONAL_PRESETS];

/** Neutral fallback: one question is worth one question, no penalty. Used
 * only until a scheme is resolved — it is never written to the table. */
export const NEUTRAL_EXAM_CONFIG: ExamConfig = {
  exam_type: 'Unset scheme',
  marks_correct: 1,
  marks_incorrect: 0,
  marks_skipped: 0,
  unit_label: 'questions',
  allows_partial_credit: false,
  scaled_min: null,
  scaled_max: null,
  target_seconds_per_q: 120,
};

/** A topic needs at least this many logged attempts before it can be called
 * weak — one miss is noise, not a pattern. */
export const WEAK_TOPIC_MIN_ATTEMPTS = 2;

/* ------------------------------------------------------------------ */
/*  Parsing + resolution                                               */
/* ------------------------------------------------------------------ */

function num(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asMarksUnit(value: unknown): MarksUnit {
  const clean = String(value ?? '').trim().toLowerCase();
  return (MARKS_UNITS as string[]).includes(clean) ? (clean as MarksUnit) : 'marks';
}

/** A stored row → the pure ExamConfig shape. */
export function parseExamConfigRow(row: ExamConfigRow): ExamConfig {
  return {
    exam_type: String(row.exam_type ?? '').trim() || NEUTRAL_EXAM_CONFIG.exam_type,
    marks_correct: num(row.marks_correct, 1),
    marks_incorrect: num(row.marks_incorrect, 0),
    marks_skipped: num(row.marks_skipped, 0),
    unit_label: asMarksUnit(row.unit_label),
    allows_partial_credit: row.allows_partial_credit === true,
    scaled_min: optionalNum(row.scaled_min),
    scaled_max: optionalNum(row.scaled_max),
    target_seconds_per_q: Math.max(1, Math.round(num(row.target_seconds_per_q, 120))),
  };
}

function normalizeName(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Whether a region-required template belongs to the student's current exam. */
export function regionalTemplateMatchesExam(
  template: Pick<ExamConfigRow, 'exam_type' | 'requires_region'>,
  examType: string | null | undefined,
): boolean {
  if (template.requires_region !== true) return false;
  if (normalizeName(template.exam_type) === normalizeName(examType)) return true;
  const preset = EXAM_CONFIG_SEEDS.find(
    (candidate) => candidate.requires_region && normalizeName(candidate.exam_type) === normalizeName(template.exam_type),
  );
  return Boolean(preset?.match?.test(String(examType ?? '')));
}

export interface ResolvedExamConfig {
  config: ExamConfig;
  /** The stored row the scheme came from, or null when nothing matched. */
  row: ExamConfigRow | null;
  /** True when no active scheme matched and the neutral fallback is in use. */
  unresolved: boolean;
}

/**
 * Resolve the marking scheme for an exam label against the STORED rows:
 * exact name first, then the seed keyword tests, and finally the neutral
 * fallback. Rows with status 'todo' and regional template rows are never
 * resolved automatically — a state/province must be chosen first.
 */
export function resolveExamConfig(rows: ExamConfigRow[], examType: string | null | undefined): ResolvedExamConfig {
  const usable = rows.filter(
    (row) => String(row.status ?? 'active') !== 'todo' && row.requires_region !== true,
  );
  const wanted = normalizeName(examType);
  if (wanted) {
    const exact = usable.find((row) => normalizeName(row.exam_type) === wanted);
    if (exact) return { config: parseExamConfigRow(exact), row: exact, unresolved: false };
    const haystack = String(examType ?? '');
    for (const preset of EXAM_CONFIG_SEEDS) {
      if (preset.requires_region || !preset.match || !preset.match.test(haystack)) continue;
      const stored = usable.find((row) => normalizeName(row.exam_type) === normalizeName(preset.exam_type));
      if (stored) return { config: parseExamConfigRow(stored), row: stored, unresolved: false };
    }
  }
  return { config: { ...NEUTRAL_EXAM_CONFIG }, row: null, unresolved: true };
}

/* ------------------------------------------------------------------ */
/*  Derived marks                                                      */
/* ------------------------------------------------------------------ */

export type MarksOutcome = 'correct' | 'incorrect' | 'skipped';

/**
 * THE derived marks delta for one question — never stored.
 * `awarded` is the student's own per-question figure and only ever arrives
 * for a partial-credit exam; anything else falls back to the flat scheme.
 */
export function marksDelta(
  config: ExamConfig,
  outcome: MarksOutcome | null | undefined,
  awarded?: number | string | null,
): number {
  if (config.allows_partial_credit) {
    const own = optionalNum(awarded ?? null);
    if (own !== null) return own;
  }
  if (outcome === 'correct') return config.marks_correct;
  if (outcome === 'incorrect') return config.marks_incorrect;
  if (outcome === 'skipped') return config.marks_skipped;
  return 0;
}

/**
 * What ONE wrong question cost, as a POSITIVE magnitude — the number every
 * "marks lost" figure is built from. For a penalty exam that is the marks
 * forfeited plus the penalty; for a no-penalty exam it is simply one
 * question's worth (so "lost 9 questions" and "missed 9 questions" agree).
 */
export function marksLostPerWrong(config: ExamConfig): number {
  return Math.abs(config.marks_correct) + Math.abs(config.marks_incorrect);
}

/** What ONE skipped question cost, as a positive magnitude. */
export function marksLostPerSkipped(config: ExamConfig): number {
  return Math.abs(config.marks_correct) - config.marks_skipped;
}

/** Marks lost by one entry, honouring partial credit when the exam allows it. */
export function entryMarksLost(
  config: ExamConfig,
  outcome: MarksOutcome | null | undefined,
  awarded?: number | string | null,
  possible?: number | string | null,
): number {
  if (!outcome || outcome === 'correct') return 0;
  if (config.allows_partial_credit) {
    const own = optionalNum(awarded ?? null);
    const maximum = optionalNum(possible ?? null) ?? config.marks_correct;
    if (own !== null) return Math.max(0, maximum - own);
  }
  return outcome === 'skipped' ? marksLostPerSkipped(config) : marksLostPerWrong(config);
}

/* ------------------------------------------------------------------ */
/*  Wording (unit_label and NOTHING else)                              */
/* ------------------------------------------------------------------ */

/** Round to at most one decimal, without trailing '.0'. */
export function roundMarks(value: number): number {
  return Math.round(value * 10) / 10;
}

/** "9 marks" · "9 questions" · "9%" — the ONLY thing unit_label changes. */
export function formatUnits(config: ExamConfig, value: number): string {
  const rounded = roundMarks(value);
  if (config.unit_label === 'percent') return `${rounded}%`;
  if (config.unit_label === 'questions') return `${rounded} question${rounded === 1 ? '' : 's'}`;
  return `${rounded} mark${rounded === 1 ? '' : 's'}`;
}

/** The bare noun, for sentences that supply their own number. */
export function unitNoun(config: ExamConfig): string {
  if (config.unit_label === 'percent') return 'percent';
  return config.unit_label === 'questions' ? 'questions' : 'marks';
}

/** The verb students expect: penalty exams "lose" marks, no-penalty exams
 * "miss" questions. Wording only. */
export function lostVerb(config: ExamConfig): string {
  return config.unit_label === 'questions' ? 'missed' : 'lost';
}

/**
 * A scaled-score estimate for exams that report one (LSAT 120-180, MCAT
 * 472-528). ALWAYS returned with the word 'estimated' in the label — it is a
 * linear read-off of the raw fraction, not the real conversion table.
 * Returns null when the exam has no scaled band.
 */
export function scaledScoreEstimate(
  config: ExamConfig,
  rawFraction: number,
): { value: number; label: string } | null {
  if (config.scaled_min === null || config.scaled_max === null) return null;
  const clamped = Math.max(0, Math.min(1, rawFraction));
  const value = Math.round(config.scaled_min + (config.scaled_max - config.scaled_min) * clamped);
  return { value, label: `${value} (estimated)` };
}
