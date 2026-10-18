/**
 * Pure Today-list selectors — how the day's queues are assembled from the
 * student's items. No React, no data access. Extracted verbatim from App.tsx.
 */
import { topicKey, type StudyItem } from '../../engine';
import type { ExamDef } from '../../syllabus';

/* Smart carryover: overdue tasks are NOT auto-dumped onto Today — the
 * checklist holds only what is scheduled for today. A starred task takes the
 * hero slot; everything else keeps plan order. */
export function buildMissionQueue(todayTargets: StudyItem[], heroId: number | null): StudyItem[] {
  const queue = [...todayTargets];
  if (heroId !== null) {
    const index = queue.findIndex((item) => item.id === heroId);
    if (index > 0) {
      const [pinned] = queue.splice(index, 1);
      queue.unshift(pinned);
    }
  }
  return queue;
}

/* Only carryover RELATED to today's planned subjects/topics is surfaced
 * (same subject, or meaningful word overlap with a today task). Everything
 * else stays quietly deferred — visible in the calendar, never dumped on
 * Today. */
export function buildRelatedCarryover(carryOver: StudyItem[], todayTargets: StudyItem[]): StudyItem[] {
  if (todayTargets.length === 0) return [];
  const todaySubjects = new Set(todayTargets.map((t) => (t.subject ?? '').trim().toLowerCase()));
  const todayWords = new Set(
    todayTargets.flatMap((t) => t.topic.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 4),
  );
  return carryOver.filter((item) => {
    if (todaySubjects.has((item.subject ?? '').trim().toLowerCase())) return true;
    return item.topic.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && todayWords.has(w));
  });
}

/* The single Today's Tasks checklist — new tasks first, then the day's due
 * revisions. Completed rows stay below with a strikethrough. */
export function buildChecklistPending(missionQueue: StudyItem[], dueRevisions: StudyItem[]): StudyItem[] {
  return [...missionQueue, ...dueRevisions];
}

/* Tasks the student carried over render in their own collapsible
 * "From yesterday" section (muted, tagged), not in the main list. */
export function buildCarriedPending(checklistPending: StudyItem[], carriedIds: Set<number>): StudyItem[] {
  return checklistPending.filter((item) => carriedIds.has(item.id));
}

/* The active checklist holds only new study tasks — due revisions render in
 * their own "Today's Priority Revisions" section. Starred tasks float first. */
export function buildMainPending(missionQueue: StudyItem[], carriedIds: Set<number>): StudyItem[] {
  const rows = missionQueue.filter((item) => !carriedIds.has(item.id));
  return [...rows.filter((item) => item.is_priority), ...rows.filter((item) => !item.is_priority)];
}

/* Personalised subject chips: the student's own tasks first, then the exam's. */
export function buildQuickAddSubjects(studentItems: StudyItem[], examDef: ExamDef | undefined): string[] {
  const counts = new Map<string, number>();
  for (const item of studentItems) {
    const name = (item.subject ?? '').trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const fromTasks = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const fromExam = (examDef?.subjects.map((s) => s.name) ?? []).filter((name) => !counts.has(name));
  return [...fromTasks, ...fromExam].slice(0, 6);
}

/* Filter chips: "All" + every subject with something on today's plate. */
export function buildFilterSubjects(
  missionQueue: StudyItem[],
  dueRevisions: StudyItem[],
  doneToday: StudyItem[],
): string[] {
  const set = new Set<string>();
  for (const item of [...missionQueue, ...dueRevisions, ...doneToday]) set.add(item.subject);
  return Array.from(set);
}

/** Shared key helper — a task's annotation/attachment key. */
export function itemKey(item: Pick<StudyItem, 'source_key' | 'subject' | 'topic'>): string {
  return item.source_key || topicKey(item.subject, item.topic);
}
