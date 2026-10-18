/**
 * Doubt (mistake) store. Enforces the closed concept enum at write time:
 * a doubt can only become 'active' through activateDoubt(), which validates
 * every concept_id against the enum before anything persists (§12).
 */
import { STORES, dbGet, dbPut, dbDelete, dbGetAllByIndex } from './db';
import type { Doubt, Difficulty, WhyWrongTag, OcrStatus } from './types';
import { assertConceptId } from './concepts';
import { deleteImage } from './images';
import { newId } from '../lib/id';
import { nowIso } from '../lib/dates';

/** Capture is non-blocking (§5): a pending doubt saves before OCR finishes. */
export async function addPendingDoubt(examId: string, imageId: string | null): Promise<Doubt> {
  const doubt: Doubt = {
    doubt_id: newId('doubt'),
    exam_id: examId,
    image_id: imageId,
    ocr_text: '',
    ocr_status: 'pending',
    primary_concept_id: null,
    secondary_concept_id: null,
    why_wrong_tag: null,
    difficulty: null,
    answer_text: null,
    status: 'pending',
    created_at: nowIso(),
    fsrs_due_date: null,
    fsrs_stability: 0,
    fsrs_difficulty: 0,
    fsrs_last_review: null,
    review_count: 0,
  };
  await dbPut(STORES.doubts, doubt);
  return doubt;
}

export async function getDoubt(doubtId: string): Promise<Doubt | undefined> {
  return dbGet<Doubt>(STORES.doubts, doubtId);
}

/** Doubts are scoped per exam (§13) — switching exams shows a fresh deck. */
export async function listDoubts(examId: string): Promise<Doubt[]> {
  return dbGetAllByIndex<Doubt>(STORES.doubts, 'by_exam', examId);
}

export async function setOcrResult(doubtId: string, text: string, status: OcrStatus): Promise<void> {
  const doubt = await getDoubt(doubtId);
  if (!doubt) return;
  await dbPut(STORES.doubts, { ...doubt, ocr_text: text, ocr_status: status });
}

/**
 * Confirm tagging and activate the FSRS card. Primary tag is required (§3.2);
 * both tags are validated against the closed enum before the write lands.
 */
export async function activateDoubt(
  doubtId: string,
  fields: {
    primary_concept_id: string;
    secondary_concept_id: string | null;
    difficulty: Difficulty;
    answer_text: string | null;
    fsrs_due_date: string;
    fsrs_stability: number;
    fsrs_difficulty: number;
  },
): Promise<Doubt> {
  const doubt = await getDoubt(doubtId);
  if (!doubt) throw new Error('doubt not found');
  await assertConceptId(doubt.exam_id, fields.primary_concept_id);
  if (fields.secondary_concept_id) await assertConceptId(doubt.exam_id, fields.secondary_concept_id);
  const next: Doubt = { ...doubt, ...fields, status: 'active' };
  await dbPut(STORES.doubts, next);
  return next;
}

export async function updateDoubt(doubt: Doubt): Promise<void> {
  if (doubt.primary_concept_id) await assertConceptId(doubt.exam_id, doubt.primary_concept_id);
  if (doubt.secondary_concept_id) await assertConceptId(doubt.exam_id, doubt.secondary_concept_id);
  await dbPut(STORES.doubts, doubt);
}

export async function setWhyWrong(doubtId: string, tag: WhyWrongTag): Promise<void> {
  const doubt = await getDoubt(doubtId);
  if (!doubt) return;
  await dbPut(STORES.doubts, { ...doubt, why_wrong_tag: tag });
}

/** Deletes the doubt AND its image bytes — the user's clear delete path (§5). */
export async function deleteDoubt(doubtId: string): Promise<void> {
  const doubt = await getDoubt(doubtId);
  if (doubt?.image_id) await deleteImage(doubt.image_id);
  await dbDelete(STORES.doubts, doubtId);
}
