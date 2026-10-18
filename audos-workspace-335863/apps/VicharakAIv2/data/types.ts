/**
 * Core domain types for VicharakAI v2.
 * Exam-agnostic by design: no exam name appears anywhere in code —
 * all exam data flows from the registry (see ../registry/).
 */

/* ---- Exam registry (§3.6) ---- */

export type ExamTier = 'light' | 'full';

export interface ExamRegistryEntry {
  exam_id: string;
  display_name: string;
  bundle_path: string;
  per_question_seconds: number;
  protected_subjects: string[];
}

/* ---- Syllabus / concepts (§3) ---- */

export interface Concept {
  /** Permanent — never changed after first write (§3.1). */
  concept_id: string;
  exam_id: string;
  name: string;
  subject: string;
  chapter: string;
  source_ref: string;
  est_hours: number;
  /** Trigger terms used for OCR matching. */
  triggers: string[];
}

export interface SyllabusChapter {
  subject: string;
  chapter: string;
  est_hours: number;
  concept_ids: string[];
}

export interface ExamBundle {
  exam_id: string;
  tier: ExamTier;
  chapters: SyllabusChapter[];
  concepts: Concept[];
}

/* ---- Plan loop (§4) ---- */

export interface StudyTask {
  task_id: string;
  exam_id: string;
  subject: string;
  chapter: string;
  /** Local YYYY-MM-DD the student planned this for. */
  planned_for: string;
  est_hours: number;
  created_at: string;
  completed_at: string | null;
  /** Minutes it actually took — feeds self-correcting estimates (§12). */
  actual_minutes: number | null;
}

/** Chapter revision on the fixed 1/3/7/14 ladder (§13). */
export interface RevisionTask {
  rev_id: string;
  exam_id: string;
  subject: string;
  chapter: string;
  /** 0..3 → +1, +3, +7, +14 days after chapter completion. */
  step: number;
  due_date: string;
  completed_at: string | null;
}

/* ---- Mistake loop (§5, §6) ---- */

export type Difficulty = 'easy' | 'medium' | 'hard';

export type WhyWrongTag =
  | 'silly_mistake'
  | 'concept_gap'
  | 'formula_forgot'
  | 'application_gap'
  | 'time_pressure'
  | 'misread_question'
  | 'guessed';

export type OcrStatus = 'pending' | 'done' | 'failed';

/**
 * 'pending' = captured, not yet concept-tagged (no FSRS card yet — §3.2
 *             requires a primary tag before the doubt is *saved* as a card).
 * 'active'  = primary concept confirmed; FSRS card is live.
 */
export type DoubtStatus = 'pending' | 'active';

export interface Doubt {
  doubt_id: string;
  exam_id: string;
  image_id: string | null;
  ocr_text: string;
  ocr_status: OcrStatus;
  primary_concept_id: string | null;
  secondary_concept_id: string | null;
  why_wrong_tag: WhyWrongTag | null;
  difficulty: Difficulty | null;
  answer_text: string | null;
  status: DoubtStatus;
  created_at: string;
  fsrs_due_date: string | null;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_last_review: string | null;
  review_count: number;
}

/* ---- Test loop ---- */

export interface TestLog {
  test_id: string;
  exam_id: string;
  concept_id: string;
  score_pct: number;
  taken_at: string;
}

/* ---- Consent (§17) ---- */

export interface ConsentRecord {
  consent_id: string;
  /** 'dpdp_basic' | 'product_development' | 'parental' | 'notifications' */
  kind: string;
  version: string;
  granted: boolean;
  at: string;
}

/* ---- Profile ---- */

export interface Profile {
  birth_year: number | null;
  is_minor: boolean;
  parental_consent_at: string | null;
  exam_id: string | null;
  exam_date: string | null;
  onboarding_complete: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
}
