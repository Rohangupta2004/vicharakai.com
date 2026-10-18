/**
 * Chapter scheduling (§13): the fixed 1/3/7/14 revision ladder — deliberately
 * simpler than FSRS. Completing a study task plants four revision tasks;
 * completing a revision just checks it off.
 */
import type { StudyTask, RevisionTask } from '../data/types';
import { addRevisions, listRevisions, updateRevision, getStudyTask, updateStudyTask, listStudyTasks } from '../data/tasks';
import { addDaysIso, todayIso, nowIso, isDueTodayOrEarlier } from '../lib/dates';
import { recordCompletion } from './pace';

export const CHAPTER_LADDER = [1, 3, 7, 14] as const;

/**
 * Mark a study task complete and inject the revision ladder (§4).
 * The ladder is planted once per chapter — completing a second task on the
 * same chapter doesn't duplicate revisions.
 */
export async function completeStudyTask(taskId: string, actualMinutes: number | null): Promise<void> {
  const task = await getStudyTask(taskId);
  if (!task || task.completed_at) return;
  const done: StudyTask = { ...task, completed_at: nowIso(), actual_minutes: actualMinutes };
  await updateStudyTask(done);
  await recordCompletion(done);

  const existing = await listRevisions(task.exam_id);
  const hasLadder = existing.some((r) => r.subject === task.subject && r.chapter === task.chapter);
  if (!hasLadder) {
    const base = todayIso();
    await addRevisions(
      CHAPTER_LADDER.map((days, step) => ({
        exam_id: task.exam_id,
        subject: task.subject,
        chapter: task.chapter,
        step,
        due_date: addDaysIso(base, days),
        completed_at: null,
      })),
    );
  }
}

export async function uncompleteStudyTask(taskId: string): Promise<void> {
  const task = await getStudyTask(taskId);
  if (!task) return;
  await updateStudyTask({ ...task, completed_at: null, actual_minutes: null });
}

export async function completeRevision(rev: RevisionTask): Promise<void> {
  await updateRevision({ ...rev, completed_at: nowIso() });
}

/* ---- Today view assembly (§4) ---- */

export interface TodayView {
  overdueTasks: StudyTask[];
  todayTasks: StudyTask[];
  completedToday: StudyTask[];
  revisionsDue: RevisionTask[];
}

export async function buildTodayView(examId: string): Promise<TodayView> {
  const today = todayIso();
  const tasks = await listStudyTasks(examId);
  const revisions = await listRevisions(examId);

  const open = tasks.filter((t) => !t.completed_at);
  return {
    // Overdue first, subtle — never guilt-inducing (§4).
    overdueTasks: open.filter((t) => t.planned_for < today).sort((a, b) => a.planned_for.localeCompare(b.planned_for)),
    todayTasks: open.filter((t) => t.planned_for === today),
    completedToday: tasks.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === today),
    revisionsDue: revisions
      .filter((r) => !r.completed_at && isDueTodayOrEarlier(r.due_date))
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
  };
}
