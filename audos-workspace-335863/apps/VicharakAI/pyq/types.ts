/**
 * PYQ (Previous Year Questions) system — shared TypeScript contracts.
 *
 * NON-NEGOTIABLE INTEGRITY RULES the whole module enforces:
 *  1. A PYQ is a REAL question that was actually asked in the examination —
 *     nothing here ever invents a question and labels it a PYQ.
 *  2. Original question text, original options and the correct answer are
 *     preserved verbatim from the source.
 *  3. The correct answer comes from a pre-existing verified source (an
 *     official key or community verification) — NEVER from LLM generation.
 *  4. Complete source/provenance is preserved for every question.
 *  5. Unverified questions never silently appear as verified official PYQs.
 */

export interface PYQImportBatch {
  /** Stable caller-supplied ID for resume/idempotency. */
  batchId: string;
  /** e.g. 'neet_ug' — must match a pyq_exams.code row. */
  examCode: string;
  year: number;
  session?: string;
  sourceType: 'official_pdf' | 'official_website' | 'official_answer_key' | 'public_domain';
  sourceUrl: string;
  sourceName: string;
  questions: PYQImportQuestion[];
}

export interface PYQImportQuestion {
  questionText: string;
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
  /** 'A'|'B'|'C'|'D' or an integer string — from the verified source. */
  correctAnswer: string;
  answerSourceType: 'official_key' | 'community_verified' | 'inferred';
  answerSourceUrl?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  concept?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  marks?: number;
  negativeMarks?: number;
  tags?: string[];
  session?: string;
}

export interface PYQQuery {
  examCode?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  conceptId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  year?: number | number[];
  verificationStatus?: 'verified' | 'unverified' | 'all';
  limit?: number;
  offset?: number;
  excludeQuestionIds?: string[];
}

export interface PYQResult {
  id: string;
  examCode: string;
  examName: string;
  year: number;
  session?: string;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  conceptName?: string;
  questionText: string;
  questionType: 'mcq' | 'integer' | 'subjective';
  options: Array<{ key: string; text: string }>;
  verificationStatus: 'unverified' | 'verified' | 'flagged' | 'rejected';
  difficulty?: string;
  marks?: number;
  // The answer is NOT returned by default in retrieval — the student must
  // explicitly request it via getPYQAnswer().
}

export interface PYQAnswer {
  questionId: string;
  correctOptionKey?: string;
  correctValue?: string;
  sourceType: string;
  sourceUrl?: string;
}

export interface IngestionResult {
  batchId: string;
  status: 'complete' | 'error' | 'partial';
  imported: number;
  skipped: number;
  flaggedAsDuplicate: number;
  errors: number;
  errorDetails: string[];
}

export interface ExamInfo {
  id: string;
  name: string;
  code: string;
  country: string;
  category?: string;
  questionCount: number;
}

export interface SubjectInfo { id: string; name: string; code: string; }
export interface ChapterInfo { id: string; name: string; orderIndex: number; }
export interface TopicInfo { id: string; name: string; }
export interface ProgressReport { exam: string; year: number; status: string; imported: number; verified: number; total: number; }

/** Optional live-progress callback for importPYQBatch. */
export type IngestionProgress = (processed: number, total: number) => void;
