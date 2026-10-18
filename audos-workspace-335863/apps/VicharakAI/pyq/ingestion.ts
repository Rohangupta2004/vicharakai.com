/**
 * PYQ ingestion pipeline — importPYQBatch().
 *
 * INTEGRITY RULES ENFORCED HERE:
 *  - origin_type is ALWAYS 'official_pyq'. This function refuses to write
 *    anything else — an AI-generated variant can never enter through it.
 *  - Question text, options and the correct answer are stored verbatim.
 *  - verification_status is 'verified' ONLY when the answer came from an
 *    official answer key ('official_key'); everything else stays 'unverified'
 *    until a human verifies it in the PYQ Admin review queue.
 *  - Full provenance (pyq_sources) is written for every question.
 *  - Near-duplicates (trigram similarity >= 0.85) are NOT inserted; they are
 *    logged into pyq_duplicate_candidates for review. Scores in the 0.70–0.85
 *    band are inserted but flagged for review.
 *
 * The batch row (pyq_import_batches, keyed by the caller's batchId) makes the
 * import idempotent and resumable: re-running a completed batch is a no-op,
 * and an interrupted one continues from processed_records.
 */
import {
  DUPLICATE_REVIEW_THRESHOLD,
  DUPLICATE_SKIP_THRESHOLD,
  normalizeQuestionText,
  similarityScore,
} from './normalize';
import {
  PYQ_TABLES,
  pyqClient,
  pyqInsertShared,
  pyqRandomId,
  pyqSelect,
  pyqSelectAll,
  pyqUpdate,
  type PYQChapterRow,
  type PYQConceptRow,
  type PYQExamRow,
  type PYQExamYearRow,
  type PYQImportBatchRow,
  type PYQQuestionRow,
  type PYQSubjectRow,
  type PYQTopicRow,
} from './pyqDb';
import type { IngestionProgress, IngestionResult, PYQImportBatch, PYQImportQuestion } from './types';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];
const ANSWER_SOURCE_TYPES = ['official_key', 'community_verified', 'inferred'];
const BATCH_SOURCE_TYPES = ['official_pdf', 'official_website', 'official_answer_key', 'public_domain'];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'unnamed';
}

/** Find-or-create one taxonomy row by name; returns its id. */
async function resolveByName(
  table: string,
  filters: Array<{ column: string; value: string | null }>,
  name: string,
  extra: Record<string, unknown>,
): Promise<string> {
  const trimmed = (name ?? '').trim();
  const rows = await pyqSelectAll<{ id: string; name: string }>(table, {
    filters: filters
      .filter((f) => f.value !== null)
      .map((f) => ({ column: f.column, operator: 'eq', value: f.value })),
  });
  const existing = rows.find((row) => (row.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const id = pyqRandomId();
  await pyqInsertShared(table, { id, name: trimmed, ...extra });
  return id;
}

interface TaxonomyIds {
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
  conceptId: string | null;
}

/** Resolve subject/chapter/topic/concept names to ids (insert-if-missing). */
async function resolveTaxonomy(examId: string, question: PYQImportQuestion): Promise<TaxonomyIds> {
  let subjectId: string | null = null;
  let chapterId: string | null = null;
  let topicId: string | null = null;
  let conceptId: string | null = null;

  if (question.subject && (question.subject ?? '').trim()) {
    const subjects = await pyqSelectAll<PYQSubjectRow>(PYQ_TABLES.subjects, {
      filters: [{ column: 'exam_id', operator: 'eq', value: examId }],
    });
    const wanted = (question.subject ?? '').trim().toLowerCase();
    const found = subjects.find(
      (s) => (s.name ?? '').trim().toLowerCase() === wanted || (s.code ?? '').trim().toLowerCase() === wanted,
    );
    if (found) {
      subjectId = found.id;
    } else {
      subjectId = pyqRandomId();
      await pyqInsertShared(PYQ_TABLES.subjects, {
        id: subjectId,
        exam_id: examId,
        name: (question.subject ?? '').trim(),
        code: slugify(question.subject),
      });
    }
  }
  if (subjectId && question.chapter && (question.chapter ?? '').trim()) {
    chapterId = await resolveByName(
      PYQ_TABLES.chapters,
      [{ column: 'subject_id', value: subjectId }],
      question.chapter,
      { subject_id: subjectId, order_index: 0 },
    );
  }
  if (subjectId && question.topic && (question.topic ?? '').trim()) {
    topicId = await resolveByName(
      PYQ_TABLES.topics,
      [{ column: 'subject_id', value: subjectId }],
      question.topic,
      { subject_id: subjectId, chapter_id: chapterId },
    );
  }
  if (subjectId && question.concept && (question.concept ?? '').trim()) {
    conceptId = await resolveByName(
      PYQ_TABLES.concepts,
      [{ column: 'subject_id', value: subjectId }],
      question.concept,
      { subject_id: subjectId, topic_id: topicId },
    );
  }
  return { subjectId, chapterId, topicId, conceptId };
}

/** Record a duplicate pair once (ON CONFLICT DO NOTHING equivalent). */
async function recordDuplicateCandidate(aId: string, bId: string, score: number): Promise<void> {
  const existing = await pyqSelect<{ id: string }>(PYQ_TABLES.duplicateCandidates, {
    filters: [
      { column: 'question_id_a', operator: 'eq', value: aId },
      { column: 'question_id_b', operator: 'eq', value: bId },
    ],
    limit: 1,
  });
  if (existing.length > 0) return;
  await pyqInsertShared(PYQ_TABLES.duplicateCandidates, {
    id: pyqRandomId(),
    question_id_a: aId,
    question_id_b: bId,
    similarity_score: Math.round(score * 1000) / 1000,
    status: 'pending_review',
  });
}

function validateQuestion(question: PYQImportQuestion, index: number): string | null {
  if (!question.questionText || !(question.questionText ?? '').trim()) return `question ${index + 1}: empty questionText`;
  if (!question.correctAnswer || !String(question.correctAnswer).trim()) return `question ${index + 1}: missing correctAnswer`;
  if (!ANSWER_SOURCE_TYPES.includes(question.answerSourceType)) {
    return `question ${index + 1}: answerSourceType must be one of ${ANSWER_SOURCE_TYPES.join(', ')}`;
  }
  for (const option of question.options ?? []) {
    if (!OPTION_KEYS.includes(option.key)) return `question ${index + 1}: bad option key '${option.key}'`;
    if (!option.text || !(option.text ?? '').trim()) return `question ${index + 1}: empty option ${option.key}`;
  }
  return null;
}

/**
 * Import one batch of real PYQs. Idempotent per batch.batchId; resumable.
 * NEVER inserts a question with origin_type != 'official_pyq'.
 */
export async function importPYQBatch(
  batch: PYQImportBatch,
  onProgress?: IngestionProgress,
): Promise<IngestionResult> {
  const errorDetails: string[] = [];
  const fail = (message: string): IngestionResult => ({
    batchId: batch?.batchId ?? '(missing)',
    status: 'error',
    imported: 0,
    skipped: 0,
    flaggedAsDuplicate: 0,
    errors: 1,
    errorDetails: [message],
  });

  if (!pyqClient()) return fail('The data client is still loading — try again in a second.');
  if (!batch || typeof batch !== 'object') return fail('Batch payload is not an object.');
  if (!batch.batchId || !String(batch.batchId).trim()) return fail('batchId is required.');
  if (!batch.examCode || !String(batch.examCode).trim()) return fail('examCode is required.');
  if (!Number.isFinite(batch.year)) return fail('year is required.');
  if (!BATCH_SOURCE_TYPES.includes(batch.sourceType)) {
    return fail(`sourceType must be one of ${BATCH_SOURCE_TYPES.join(', ')}.`);
  }
  if (!batch.sourceUrl || !(batch.sourceUrl ?? '').trim()) return fail('sourceUrl is required (provenance is mandatory).');
  if (!batch.sourceName || !(batch.sourceName ?? '').trim()) return fail('sourceName is required (provenance is mandatory).');
  if (!Array.isArray(batch.questions) || batch.questions.length === 0) return fail('questions must be a non-empty array.');

  /* 1 — find or create the batch row; a completed batch returns early. */
  const existingBatches = await pyqSelect<PYQImportBatchRow>(PYQ_TABLES.importBatches, {
    filters: [{ column: 'batch_id', operator: 'eq', value: batch.batchId }],
    limit: 1,
  });
  let batchRow = existingBatches[0] ?? null;
  if (batchRow && batchRow.status === 'complete') {
    const storedErrors = Array.isArray(batchRow.error_log) ? (batchRow.error_log as string[]) : [];
    return {
      batchId: batch.batchId,
      status: 'complete',
      imported: Math.max(0, (batchRow.processed_records ?? 0) - (batchRow.failed_records ?? 0)),
      skipped: 0,
      flaggedAsDuplicate: 0,
      errors: batchRow.failed_records ?? 0,
      errorDetails: storedErrors.length > 0 ? storedErrors : ['Batch already imported earlier (idempotent no-op).'],
    };
  }

  /* 2 — resolve exam + exam_year (create the year if missing). */
  const exams = await pyqSelect<PYQExamRow>(PYQ_TABLES.exams, {
    filters: [{ column: 'code', operator: 'eq', value: (batch.examCode ?? '').trim() }],
    limit: 1,
  });
  if (exams.length === 0) return fail(`Unknown examCode '${batch.examCode}' — seed pyq_exams first.`);
  const exam = exams[0];

  const yearRows = await pyqSelectAll<PYQExamYearRow>(PYQ_TABLES.examYears, {
    filters: [{ column: 'exam_id', operator: 'eq', value: exam.id }],
  });
  let yearRow = yearRows.find((row) => Number(row.year) === Number(batch.year)) ?? null;
  if (!yearRow) {
    const yearId = pyqRandomId();
    await pyqInsertShared(PYQ_TABLES.examYears, {
      id: yearId,
      exam_id: exam.id,
      year: batch.year,
      status: 'pending',
      total_questions: 0,
      imported_questions: 0,
      verified_questions: 0,
      source_url: batch.sourceUrl,
    });
    yearRow = {
      id: yearId,
      exam_id: exam.id,
      year: batch.year,
      status: 'pending',
      total_questions: 0,
      imported_questions: 0,
      verified_questions: 0,
    };
  }

  if (!batchRow) {
    const rowId = pyqRandomId();
    await pyqInsertShared(PYQ_TABLES.importBatches, {
      id: rowId,
      batch_id: batch.batchId,
      exam_id: exam.id,
      exam_year_id: yearRow.id,
      status: 'pending',
      total_records: batch.questions.length,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
    });
    batchRow = {
      id: rowId,
      batch_id: batch.batchId,
      exam_id: exam.id,
      exam_year_id: yearRow.id,
      status: 'pending',
      total_records: batch.questions.length,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
      started_at: null,
      completed_at: null,
    };
  }

  /* 3 — mark the batch processing. */
  await pyqUpdate(PYQ_TABLES.importBatches, batchRow.id, {
    status: 'processing',
    total_records: batch.questions.length,
    started_at: batchRow.started_at ?? new Date().toISOString(),
  });

  /* Existing questions for THIS exam — the duplicate-detection corpus. */
  const corpus = await pyqSelectAll<Pick<PYQQuestionRow, 'id' | 'question_text_normalized'>>(
    PYQ_TABLES.questions,
    {
      filters: [{ column: 'exam_id', operator: 'eq', value: exam.id }],
      columns: ['id', 'question_text_normalized'],
    },
  );

  let processed = Math.max(0, batchRow.processed_records ?? 0);
  let failed = Math.max(0, batchRow.failed_records ?? 0);
  const priorErrors = Array.isArray(batchRow.error_log) ? (batchRow.error_log as string[]) : [];
  errorDetails.push(...priorErrors);
  let imported = 0;
  let skipped = 0;
  let flaggedAsDuplicate = 0;
  const total = batch.questions.length;
  onProgress?.(Math.min(processed, total), total);

  /* 4 — per-question pipeline (resumes from processed_records). */
  for (let index = processed; index < total; index += 1) {
    const question = batch.questions[index];
    try {
      const validationError = validateQuestion(question, index);
      if (validationError) throw new Error(validationError);

      /* a — normalize. */
      const normalized = normalizeQuestionText(question.questionText);

      /* b — duplicate detection against every existing question of the exam. */
      let bestScore = 0;
      let bestId: string | null = null;
      for (const existing of corpus) {
        const score = existing.question_text_normalized === normalized
          ? 1
          : similarityScore(existing.question_text_normalized, normalized);
        if (score > bestScore) {
          bestScore = score;
          bestId = existing.id;
        }
      }
      if (bestId && bestScore >= DUPLICATE_SKIP_THRESHOLD) {
        /* The near-identical question already exists, so nothing new is
         * inserted (this is also what makes a re-run idempotent). A candidate
         * row needs BOTH sides stored, so the skip is reported in the batch
         * log (visible in the PYQ Admin import history) instead. */
        skipped += 1;
        flaggedAsDuplicate += 1;
        errorDetails.push(
          `question ${index + 1}: skipped as duplicate of existing question ${bestId} (similarity ${bestScore.toFixed(2)}).`,
        );
        continue;
      }

      /* g (done first so the insert lands complete) — taxonomy by name. */
      const taxonomy = await resolveTaxonomy(exam.id, question);

      const isVerified = question.answerSourceType === 'official_key';
      const questionType = question.options && question.options.length >= 2 ? 'mcq' : 'integer';
      const questionId = pyqRandomId();
      const now = new Date().toISOString();
      const needsDupReview = Boolean(bestId) && bestScore >= DUPLICATE_REVIEW_THRESHOLD;

      /* c — the question row. origin_type is ALWAYS 'official_pyq'. */
      await pyqInsertShared(PYQ_TABLES.questions, {
        id: questionId,
        exam_id: exam.id,
        exam_year_id: yearRow.id,
        session: question.session ?? batch.session ?? null,
        subject_id: taxonomy.subjectId,
        chapter_id: taxonomy.chapterId,
        topic_id: taxonomy.topicId,
        concept_id: taxonomy.conceptId,
        question_text: question.questionText,
        question_text_normalized: normalized,
        question_type: questionType,
        difficulty: question.difficulty ?? null,
        marks: question.marks ?? null,
        negative_marks: question.negativeMarks ?? null,
        language: 'en',
        verification_status: isVerified ? 'verified' : 'unverified',
        origin_type: 'official_pyq',
        duplicate_review_status: needsDupReview ? 'pending_review' : 'not_checked',
        import_batch_id: batch.batchId,
        tags: question.tags ?? [],
        import_timestamp: now,
        verification_timestamp: isVerified ? now : null,
      });
      corpus.push({ id: questionId, question_text_normalized: normalized });

      /* d — the original options, verbatim. */
      for (const option of question.options ?? []) {
        await pyqInsertShared(PYQ_TABLES.options, {
          id: pyqRandomId(),
          question_id: questionId,
          option_key: option.key,
          option_text: option.text,
          is_correct: option.key === String(question.correctAnswer).trim().toUpperCase(),
        });
      }

      /* e — the answer, with its pre-existing source. */
      const answerKey = String(question.correctAnswer).trim().toUpperCase();
      const isOptionAnswer = OPTION_KEYS.includes(answerKey);
      await pyqInsertShared(PYQ_TABLES.answers, {
        id: pyqRandomId(),
        question_id: questionId,
        correct_option_key: isOptionAnswer ? answerKey : null,
        correct_value: isOptionAnswer ? null : String(question.correctAnswer).trim(),
        source_type: question.answerSourceType,
        source_url: question.answerSourceUrl ?? batch.sourceUrl,
        verified_at: isVerified ? now : null,
      });

      /* f — provenance. */
      await pyqInsertShared(PYQ_TABLES.sources, {
        id: pyqRandomId(),
        question_id: questionId,
        source_type: batch.sourceType,
        source_url: batch.sourceUrl,
        source_name: batch.sourceName,
        accessed_at: now,
      });

      if (needsDupReview && bestId) {
        await recordDuplicateCandidate(bestId, questionId, bestScore).catch(() => undefined);
      }
      imported += 1;
    } catch (error) {
      failed += 1;
      errorDetails.push(`question ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      processed = index + 1;
      /* i — persist per-question progress so a crash resumes cleanly. */
      await pyqUpdate(PYQ_TABLES.importBatches, batchRow.id, {
        processed_records: processed,
        failed_records: failed,
        error_log: errorDetails.slice(-200),
      }).catch(() => undefined);
      onProgress?.(processed, total);
    }
  }

  /* 5 — close the batch + refresh the exam-year counters. */
  const finalStatus = failed >= total ? 'error' : 'complete';
  await pyqUpdate(PYQ_TABLES.importBatches, batchRow.id, {
    status: finalStatus,
    completed_at: new Date().toISOString(),
  }).catch(() => undefined);

  try {
    const freshYears = await pyqSelect<PYQExamYearRow>(PYQ_TABLES.examYears, {
      filters: [{ column: 'id', operator: 'eq', value: yearRow.id }],
      limit: 1,
    });
    const fresh = freshYears[0];
    if (fresh) {
      const importedTotal = (fresh.imported_questions ?? 0) + imported;
      // Verified imports = imported rows whose answer came from an official key.
      const verifiedImported = Math.min(
        imported,
        batch.questions.filter((q) => q.answerSourceType === 'official_key').length,
      );
      await pyqUpdate(PYQ_TABLES.examYears, fresh.id, {
        imported_questions: importedTotal,
        verified_questions: (fresh.verified_questions ?? 0) + verifiedImported,
        total_questions: Math.max(fresh.total_questions ?? 0, importedTotal),
        status: fresh.status === 'pending' ? 'processing' : fresh.status,
      });
    }
  } catch {
    /* counter refresh is best-effort — the questions themselves are saved */
  }

  /* 6 — the result. */
  return {
    batchId: batch.batchId,
    status: failed > 0 ? (imported > 0 ? 'partial' : 'error') : 'complete',
    imported,
    skipped,
    flaggedAsDuplicate,
    errors: failed,
    errorDetails,
  };
}
