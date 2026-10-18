/**
 * Test Analysis — shared types and constants for the mock-analysis feature.
 *
 * The four error tags are a FIXED taxonomy (product decision — no additions):
 *   careless · concept_gap · couldnt_apply · out_of_time
 * The coarse time buckets are equally fixed: under_2 · 2_4 · over_4.
 * Everything else in the feature imports these — never its own copies.
 */

/** {x, y, w, h} in the source image's NATURAL pixel space. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Exactly four reason tags — never extended (see the feature contract). */
export type ErrorTag = 'careless' | 'concept_gap' | 'couldnt_apply' | 'out_of_time';

export const ERROR_TAGS: ErrorTag[] = ['careless', 'concept_gap', 'couldnt_apply', 'out_of_time'];

/* Student-facing wording (2026-09-29 founder request): Careless mistake /
 * Concept unclear / Never studied this / Ran out of time. The four STORAGE
 * keys are unchanged — only the labels moved. */
export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  careless: 'Careless mistake',
  concept_gap: 'Concept unclear',
  couldnt_apply: 'Never studied this',
  out_of_time: 'Ran out of time',
};

export const ERROR_TAG_HELPERS: Record<ErrorTag, string> = {
  careless: 'Knew it — slip or misread',
  concept_gap: "The underlying idea isn't clear yet",
  couldnt_apply: "Hadn't studied or practised this yet",
  out_of_time: 'Rushed or never reached it',
};

export type QuestionOutcome = 'correct' | 'incorrect' | 'skipped';

export const OUTCOMES: QuestionOutcome[] = ['correct', 'incorrect', 'skipped'];

export const OUTCOME_LABELS: Record<QuestionOutcome, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  skipped: 'Skipped',
};

/** Coarse per-question time buckets (only for timing opt-in students). */
export type TimeBucket = 'under_2' | '2_4' | 'over_4';

export const TIME_BUCKETS: TimeBucket[] = ['under_2', '2_4', 'over_4'];

export const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  under_2: 'Under 2 min',
  '2_4': '2–4 min',
  over_4: 'Over 4 min',
};

/* ---------- table row shapes (vicharakai_* WorkspaceDB tables) ---------- */

export interface MockSessionRow {
  id: number;
  user_id?: string | null;
  exam_type?: string | null;
  name: string;
  date: string;
  total_questions: number | string;
  attempted: number | string;
  correct: number | string;
  incorrect: number | string;
  score: number | string;
  max_score: number | string;
  duration_minutes?: number | string | null;
  created_at?: string | null;
}

export type SourceImageStatus = 'unprocessed' | 'segmented' | 'whole_page_question';

export interface SourceImageRow {
  id: number;
  mock_session_id: number;
  user_id?: string | null;
  image_url: string;
  page_number: number | string;
  status: string;
  segmentation_attempted?: boolean | null;
  reminder_sent_at?: string | null;
  created_at?: string | null;
}

export interface QuestionEntryRow {
  id: number;
  mock_session_id: number;
  user_id?: string | null;
  source_image_id?: number | null;
  /** JSON {x,y,w,h} — may arrive as an object or a JSON string. */
  crop_coords?: unknown;
  crop_url?: string | null;
  is_whole_page?: boolean | null;
  question_number?: number | string | null;
  extracted_text?: string | null;
  subject?: string | null;
  chapter_id?: string | null;
  topic_id?: string | null;
  predicted_topic_id?: string | null;
  topic_confirmed_by_user?: boolean | null;
  outcome?: string | null;
  error_tag?: string | null;
  suggested_tag?: string | null;
  tag_overridden?: boolean | null;
  time_bucket?: string | null;
  time_seconds?: number | string | null;
  reason_note?: string | null;
  is_doubt?: boolean | null;
  doubt_status?: string | null;
  deck_row_id?: number | string | null;
  next_review_at?: string | null;
  review_count?: number | string | null;
  last_served_at?: string | null;
  created_at?: string | null;
  /** Student-entered marks for THIS question — only collected when the
   * exam's ExamConfig sets allows_partial_credit. marks_delta stays derived. */
  marks_awarded?: number | string | null;
  /** Maximum marks available for THIS question. Needed by written/mixed-value
   * papers so marks lost is derived from possible minus awarded, not a guess. */
  marks_possible?: number | string | null;
  /** Tesseract mean word confidence (0–100). Internal metric, never shown. */
  ocr_confidence?: number | string | null;
  /** True when the OCR cascade escalated this crop to the AI vision model. */
  ocr_escalated?: boolean | null;
  /** The concept THIS question tests, read off the crop by the AI vision
   * fallback when the Tesseract text is too garbled to keyword-match. */
  concept_being_tested?: string | null;
  /** One sentence: what the student likely misunderstood. Shown under a
   * concept_gap tag — never derived from Tesseract text alone. */
  concept_gap_description?: string | null;
  /** The concept-gap model's own 0–1 confidence. NOT ocr_confidence, which
   * stays Tesseract's 0–100 metric. */
  concept_gap_confidence?: number | string | null;
  /** ISO timestamp of the last concept-gap call, written even when it came
   * back empty so the same crop is never charged for twice. */
  concept_gap_analyzed_at?: string | null;
}

export interface TopicMasteryRow {
  id: number;
  user_id?: string | null;
  topic_id: string;
  subject?: string | null;
  attempts: number | string;
  correct: number | string;
  last_seen_at?: string | null;
  consecutive_misses: number | string;
  /** DEPRECATED — an entry-derived accuracy is structurally always 0 here. */
  mastery_score?: number | string | null;
  dominant_error_tag?: string | null;
  /** Marks (or questions) this topic has cost — THE weak-topic ranking key. */
  marks_lost?: number | string | null;
  /** How many deck cards/doubts this topic has produced. */
  doubt_count?: number | string | null;
}

export interface AnalysisPrefsRow {
  id: number;
  user_id?: string | null;
  /** null = never asked; true = show buckets; false = hide timing entirely. */
  tracks_timing?: boolean | null;
  exam_type?: string | null;
  suggest_tags_disabled?: boolean | null;
  updated_at_iso?: string | null;
}

export interface AnalysisShareRow {
  id: number;
  user_id?: string | null;
  scope: string;
  mock_session_id?: number | null;
  range_start?: string | null;
  range_end?: string | null;
  include_reason_notes?: boolean | null;
  token: string;
  created_at_iso?: string | null;
  revoked_at?: string | null;
}

/* ---------- small parsing helpers ---------- */

export function asCount(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function isErrorTag(value: unknown): value is ErrorTag {
  return typeof value === 'string' && (ERROR_TAGS as string[]).includes(value);
}

/**
 * Placeholder strings that must NEVER be stored as a topic. 'General' used to
 * leak in from the OCR/auto-tag fallback and made whole mocks look like they
 * belonged to one imaginary topic. There is no silent fallback topic any more:
 * when matching fails the student picks from their own syllabus, and until
 * they do the entry simply carries no topic.
 */
const FORBIDDEN_TOPIC_NAMES = new Set(['general', 'untagged', 'unknown', 'n/a', 'na', 'other', 'misc', 'miscellaneous']);

/** A storable topic name, or null. The ONE gate every topic write goes through. */
export function sanitizeTopicName(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return FORBIDDEN_TOPIC_NAMES.has(clean.toLowerCase()) ? null : clean;
}

/** True when a value would be refused as a topic. */
export function isPlaceholderTopic(value: unknown): boolean {
  return String(value ?? '').trim().length > 0 && sanitizeTopicName(value) === null;
}

/** A storable subject name, or null — same placeholder rules as topics, so a
 * mock entry never files itself under an invented subject either. */
export function sanitizeSubjectName(value: unknown): string | null {
  return sanitizeTopicName(value);
}

/** Shown wherever a subject is structurally required but genuinely unknown
 * (e.g. the deck row's NOT NULL subject column). Never a topic. */
export const SUBJECT_UNASSIGNED = 'Unassigned';

export function parseCropRect(raw: unknown): CropRect | null {
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  const w = Number(record.w);
  const h = Number(record.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return { x, y, w, h };
}

/** True once the entry carries everything analysis needs: an outcome, and —
 * when incorrect — one of the four error tags plus a TOPIC-level tag
 * (chapter-only is never a valid final tag). */
export function entryFullyTagged(entry: QuestionEntryRow): boolean {
  if (!entry.outcome) return false;
  if (entry.outcome !== 'incorrect') return true;
  return isErrorTag(entry.error_tag) && Boolean(String(entry.topic_id ?? '').trim());
}

/** After this many fully tagged entries the error-tag pre-selection kicks in. */
export const SUGGESTION_MIN_TAGGED = 20;
/** Pre-selection is disabled for a student whose override rate exceeds this. */
export const SUGGESTION_MAX_OVERRIDE_RATE = 0.3;
/** At most this many remediation deck cards are generated per mock. */
export const REMEDIATION_CAP_PER_MOCK = 5;
/** Unprocessed pages older than this many days earn ONE reminder, then rest. */
export const UNPROCESSED_REMINDER_DAYS = 7;
/** Coverage below this share of wrong questions triggers the tagging prompt. */
export const COVERAGE_GATE_THRESHOLD = 0.8;

/* ---------- OCR cascade (§4.1) ---------- */

/** Tesseract runs on EVERY crop first. It escalates to the AI vision model
 * only when the local read fails one of these three gates. */
export const OCR_ESCALATE_BELOW_CONFIDENCE = 60;
export const OCR_ESCALATE_BELOW_CHARS = 15;
/** A sustained escalation rate above this is a capture-guidance problem, not
 * a model problem. Internal cost metric — never shown to the student. */
export const OCR_ESCALATION_ALERT_RATE = 0.25;
/** zuno_meta key holding the rolling {reads, escalations} cost counter. */
export const OCR_ESCALATION_META_KEY = 'ta_ocr_escalation';

/** The rolling OCR cost metric stored under OCR_ESCALATION_META_KEY. */
export interface OcrEscalationMetric {
  reads: number;
  escalations: number;
}

export function ocrEscalationRate(metric: OcrEscalationMetric): number {
  return metric.reads <= 0 ? 0 : metric.escalations / metric.reads;
}

/* ---------- concept-gap enrichment (the AI vision fallback) ---------- */

/**
 * Tesseract still runs on every crop and still stores `extracted_text` — but
 * that text is NO LONGER the primary signal for concept detection. A garbled
 * read ('across the four beats, exactly described…') keyword-matches to
 * nothing, which left `predicted_topic_id` null and a concept_gap tag with
 * nothing behind it. When the local read cannot carry the match, the CROP
 * goes to the AI vision model, which names the concept and what the student
 * likely misunderstood (see conceptGap.ts). The syllabus keyword match still
 * runs FIRST — this is the fallback and the enricher, not a replacement.
 */

/** Below this share of Tesseract's confidence scale the local read cannot be
 * trusted to carry concept detection on its own. */
export const CONCEPT_GAP_OCR_CONFIDENCE_FLOOR = 0.6;
/** At or above this the AI's syllabus-matched topic may be written to
 * predicted_topic_id; below it the topic stays a UI suggestion only. */
export const CONCEPT_GAP_WRITE_CONFIDENCE = 0.8;
/** Below this the gap reads as a hint ('Possible gap') rather than a claim. */
export const CONCEPT_GAP_SOFT_CONFIDENCE = 0.5;
/** Vision calls the automatic analyser may spend per mock, per mount. */
export const CONCEPT_GAP_AUTO_CAP_PER_MOCK = 5;

/** Tesseract's 0–100 confidence as a 0–1 fraction; null when unrecorded. A
 * value already on the 0–1 scale passes through, so a row written by any
 * build reads the same way. */
export function ocrConfidenceFraction(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n <= 1 ? n : Math.min(1, n / 100);
}

/**
 * Does this entry need the AI vision pass? ANY of: no predicted topic, a
 * missing or untrustworthy local OCR confidence, a concept_gap tag, or a
 * read that already escalated once.
 */
export function needsConceptGapAnalysis(entry: QuestionEntryRow): boolean {
  const confidence = ocrConfidenceFraction(entry.ocr_confidence);
  return (
    !String(entry.predicted_topic_id ?? '').trim() ||
    confidence === null ||
    confidence < CONCEPT_GAP_OCR_CONFIDENCE_FLOOR ||
    entry.error_tag === 'concept_gap' ||
    entry.ocr_escalated === true
  );
}

/** True once the vision pass has run on this entry, whatever it returned. */
export function conceptGapAnalyzed(entry: QuestionEntryRow): boolean {
  return String(entry.concept_gap_analyzed_at ?? '').trim().length > 0;
}

/** The stored gap line, and how firmly the UI may state it. */
export interface ConceptGapDisplay {
  label: 'Concept gap' | 'Possible gap';
  description: string;
  confidence: number | null;
}

/**
 * What the student reads under the error-tag pill. A confident reading is
 * stated ('Concept gap: …'); below CONCEPT_GAP_SOFT_CONFIDENCE it softens to
 * 'Possible gap: …' instead of asserting something the model half-guessed.
 */
export function conceptGapDisplay(entry: QuestionEntryRow): ConceptGapDisplay | null {
  const description = String(entry.concept_gap_description ?? '').replace(/\s+/g, ' ').trim();
  if (!description) return null;
  const raw = entry.concept_gap_confidence;
  const parsed = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  const confidence = parsed !== null && Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
  return {
    label: confidence !== null && confidence < CONCEPT_GAP_SOFT_CONFIDENCE ? 'Possible gap' : 'Concept gap',
    description,
    confidence,
  };
}
