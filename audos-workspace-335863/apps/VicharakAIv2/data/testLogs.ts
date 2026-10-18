/** Test-loop persistence: per-concept test scores (§ product thesis, loop 2). */
import { STORES, dbPut, dbGetAllByIndex } from './db';
import type { TestLog } from './types';
import { assertConceptId } from './concepts';
import { newId } from '../lib/id';
import { nowIso } from '../lib/dates';

export async function addTestLog(examId: string, conceptId: string, scorePct: number): Promise<TestLog> {
  await assertConceptId(examId, conceptId);
  const log: TestLog = {
    test_id: newId('test'),
    exam_id: examId,
    concept_id: conceptId,
    score_pct: Math.max(0, Math.min(100, Math.round(scorePct))),
    taken_at: nowIso(),
  };
  await dbPut(STORES.testLogs, log);
  return log;
}

export async function listTestLogs(examId: string): Promise<TestLog[]> {
  return dbGetAllByIndex<TestLog>(STORES.testLogs, 'by_exam', examId);
}
