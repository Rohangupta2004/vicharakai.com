/** Study-task and chapter-revision CRUD. Pure persistence — scheduling logic lives in engine/. */
import { STORES, dbGet, dbPut, dbGetAllByIndex, dbDelete, dbBulkPut } from './db';
import type { StudyTask, RevisionTask } from './types';
import { newId } from '../lib/id';
import { nowIso } from '../lib/dates';

/* ---- Study tasks (plan loop) ---- */

export async function addStudyTask(input: {
  exam_id: string;
  subject: string;
  chapter: string;
  planned_for: string;
  est_hours: number;
}): Promise<StudyTask> {
  const task: StudyTask = {
    task_id: newId('task'),
    ...input,
    created_at: nowIso(),
    completed_at: null,
    actual_minutes: null,
  };
  await dbPut(STORES.tasks, task);
  return task;
}

export async function listStudyTasks(examId: string): Promise<StudyTask[]> {
  return dbGetAllByIndex<StudyTask>(STORES.tasks, 'by_exam', examId);
}

export async function getStudyTask(taskId: string): Promise<StudyTask | undefined> {
  return dbGet<StudyTask>(STORES.tasks, taskId);
}

export async function updateStudyTask(task: StudyTask): Promise<void> {
  await dbPut(STORES.tasks, task);
}

export async function deleteStudyTask(taskId: string): Promise<void> {
  await dbDelete(STORES.tasks, taskId);
}

/* ---- Chapter revisions (1/3/7/14 ladder) ---- */

export async function addRevisions(revs: Omit<RevisionTask, 'rev_id'>[]): Promise<void> {
  await dbBulkPut(
    STORES.revisions,
    revs.map((r) => ({ ...r, rev_id: newId('rev') })),
  );
}

export async function listRevisions(examId: string): Promise<RevisionTask[]> {
  return dbGetAllByIndex<RevisionTask>(STORES.revisions, 'by_exam', examId);
}

export async function updateRevision(rev: RevisionTask): Promise<void> {
  await dbPut(STORES.revisions, rev);
}
