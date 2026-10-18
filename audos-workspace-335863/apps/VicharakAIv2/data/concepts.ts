/**
 * Concept store — the closed concept enum for each exam (§3.1).
 * The enum is enforced at WRITE time (§12): any code persisting a concept_id
 * must go through assertConceptId(); free-text ids never reach the database.
 */
import { STORES, dbBulkPut, dbDeleteByIndex, dbGet, dbGetAllByIndex } from './db';
import type { Concept } from './types';

type ConceptRow = Concept & { db_key: string };

const dbKey = (examId: string, conceptId: string) => `${examId}:${conceptId}`;

/**
 * Install a bundle's concepts for an exam. concept_id is permanent (§3.1):
 * existing rows are upserted under the same key, never re-keyed. Concepts no
 * longer present in a re-loaded bundle are kept (doubts may reference them).
 */
export async function installConcepts(examId: string, concepts: Concept[]): Promise<void> {
  const rows: ConceptRow[] = concepts.map((c) => ({ ...c, exam_id: examId, db_key: dbKey(examId, c.concept_id) }));
  await dbBulkPut(STORES.concepts, rows);
}

export async function listConcepts(examId: string): Promise<Concept[]> {
  const rows = await dbGetAllByIndex<ConceptRow>(STORES.concepts, 'by_exam', examId);
  return rows.map(({ db_key, ...c }) => c);
}

export async function getConcept(examId: string, conceptId: string): Promise<Concept | undefined> {
  const row = await dbGet<ConceptRow>(STORES.concepts, dbKey(examId, conceptId));
  if (!row) return undefined;
  const { db_key, ...c } = row;
  return c;
}

export async function countConcepts(examId: string): Promise<number> {
  return (await dbGetAllByIndex<ConceptRow>(STORES.concepts, 'by_exam', examId)).length;
}

/**
 * Write-time enum enforcement (§12). Throws when the id is not part of the
 * exam's closed enum — callers must catch this as a programming error, not
 * silently swallow it.
 */
export async function assertConceptId(examId: string, conceptId: string): Promise<void> {
  const found = await getConcept(examId, conceptId);
  if (!found) {
    throw new Error(`concept_id "${conceptId}" is not in the concept enum for exam "${examId}"`);
  }
}

/** Used only when the founder swaps a corrupt bundle in dev — not exposed in UI. */
export async function clearConcepts(examId: string): Promise<void> {
  await dbDeleteByIndex(STORES.concepts, 'by_exam', examId);
}
