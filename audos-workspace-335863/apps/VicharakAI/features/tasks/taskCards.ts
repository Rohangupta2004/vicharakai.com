/**
 * Task cards — how Today decides what belongs INSIDE each task card.
 *
 * A spaced revision is never its own entry in the list. It is a sub-row of the
 * card for the topic it belongs to:
 *
 *     🔄 Revision due Tomorrow · Why: Studied 3 days ago — spaced review
 *
 * `planTodayRevisions` is the single place that decides which card owns which
 * revision, so the same revision can never render twice:
 *
 *  - a topic renders AT MOST ONE revision sub-row: the NEXT (earliest)
 *    pending rung of its spaced ladder. Later rungs stay silently scheduled
 *    in storage and surface here one at a time as each earlier rung is
 *    completed — the student never sees the future dates as extra rows;
 *  - every pending revision belongs to ONE owner card, resolved in priority
 *    order (an active task for the topic → a carried task → the completed
 *    study task it came from);
 *  - a revision that is DUE and whose topic has no card on Today at all gets
 *    an `orphanCard`: the parent topic rendered as the card head (not
 *    completable — the sub-row is what the student taps), with the revision
 *    inside it.
 *
 * Pure functions only — no React, no data access.
 */
import { diffDays, formatDayLabel, topicKey, type StudyItem } from '../../engine';
import { adaptiveContextForTopic, type TestResultRow } from '../../mcq';

/** A revision rendered as a sub-row inside its parent task's card. */
export interface TaskRevisionRow {
  item: StudyItem;
  /** "Today" / "Tomorrow" / "12 Sep" — the date the sub-row leads with. */
  dueLabel: string;
  /** The plain-English "Why:" behind this revision landing when it does. */
  reason: string;
  /** Due today or earlier — the sub-row highlights (never a colour change). */
  due: boolean;
  /** Strictly before today — the student has slipped past it. */
  overdue: boolean;
}

/** A card built for a topic whose only business on Today is a due revision. */
export interface OrphanRevisionCard {
  /** The study task the revision came from, used as the card's head. */
  head: StudyItem;
  revisions: TaskRevisionRow[];
}

export interface TodayRevisionPlan {
  /** Owning task row id → the single next-revision sub-row inside its card. */
  byItemId: Map<number, TaskRevisionRow[]>;
  /** Cards for due revisions whose topic has no other card on Today. */
  orphanCards: OrphanRevisionCard[];
}

/** The weak-topic fields the "Why:" line reads (a subset of WeakTopicInsight). */
export interface WeakTopicNameRow {
  topicName: string;
}

function keyOf(item: Pick<StudyItem, 'source_key' | 'subject' | 'topic'>): string {
  return item.source_key || topicKey(item.subject, item.topic);
}

function looselyMatches(a: string, b: string): boolean {
  const na = (a ?? '').trim().toLowerCase();
  const nb = (b ?? '').trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** A test score low enough to be worth naming on the revision sub-row. */
const WEAK_SCORE_CEILING = 70;

/**
 * Why this revision is on the plan, in the student's own terms. A deliberate
 * RE-SURFACE (exam ≤ 14 days away, or a freshly logged test) states its own
 * reason first; then the strongest available signal wins: a topic the engine
 * flagged as weak, then a low recent test score, then the plain spacing
 * story from the study date.
 */
export function revisionReason(
  revision: StudyItem,
  today: string,
  weakTopics: WeakTopicNameRow[],
  testResults: TestResultRow[],
  daysToExam?: number,
): string {
  if (revision.resurface_reason === 'exam_proximity') {
    const days = Number(daysToExam);
    return Number.isFinite(days) && days >= 0
      ? `Exam in ${days} day${days === 1 ? '' : 's'} — time to revisit`
      : 'Exam is close — time to revisit';
  }
  if (revision.resurface_reason === 'post_test') {
    return 'Flagged for review after your test';
  }
  if (weakTopics.some((weak) => looselyMatches(weak.topicName, revision.topic))) {
    return 'Flagged as weak topic';
  }
  const recent = adaptiveContextForTopic(testResults, revision.subject, revision.topic);
  if (recent && recent.accuracy < WEAK_SCORE_CEILING) {
    return `Scored ${recent.accuracy}% on last test`;
  }
  const studiedOn = (revision.studied_on || '').slice(0, 10);
  if (studiedOn) {
    const days = Math.max(0, diffDays(studiedOn, today));
    if (days === 0) return 'Studied today \u2014 spaced review';
    if (days === 1) return 'Studied yesterday \u2014 spaced review';
    return `Studied ${days} days ago \u2014 spaced review`;
  }
  const interval = Number(revision.interval_days);
  if (Number.isFinite(interval) && interval > 0) {
    return `Day ${interval} of your spaced review`;
  }
  return 'Spaced review';
}

export interface PlanTodayRevisionsArgs {
  /** Active study tasks on Today, in the order they render. */
  mainPending: StudyItem[];
  /** Carried-over study tasks (the "From yesterday" section). */
  carriedPending: StudyItem[];
  /** Everything checked off today — the usual parent of a due revision. */
  doneToday: StudyItem[];
  /** The prioritised slice of revisions due today (one row per topic). */
  dueRevisions: StudyItem[];
  /** Every visible row for this student. */
  studentItems: StudyItem[];
  today: string;
  weakTopics: WeakTopicNameRow[];
  testResults: TestResultRow[];
  /** Days until the exam — read by the exam-proximity re-surface label. */
  daysToExam?: number;
}

/**
 * Assign every pending revision to exactly one card. See the module comment
 * for the ownership rules.
 */
export function planTodayRevisions(args: PlanTodayRevisionsArgs): TodayRevisionPlan {
  const { mainPending, carriedPending, doneToday, dueRevisions, studentItems, today, weakTopics, testResults, daysToExam } = args;

  const toRow = (item: StudyItem): TaskRevisionRow => {
    const dueOn = item.scheduled_for;
    return {
      item,
      dueLabel: formatDayLabel(dueOn, today),
      reason: revisionReason(item, today, weakTopics, testResults, daysToExam),
      due: dueOn <= today,
      overdue: dueOn < today,
    };
  };

  /* Every pending revision, grouped by the topic it revises. */
  const pendingByKey = new Map<string, StudyItem[]>();
  for (const item of studentItems) {
    if (item.kind !== 'revision' || item.status !== 'pending') continue;
    const key = keyOf(item);
    const list = pendingByKey.get(key);
    if (list) list.push(item);
    else pendingByKey.set(key, [item]);
  }
  for (const list of pendingByKey.values()) {
    list.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.id - b.id);
    /* ONE revision line per topic: only the next (earliest) pending rung
       renders. The rest of the ladder stays silently scheduled in storage —
       completing this rung is what brings the next one forward. */
    if (list.length > 1) list.length = 1;
  }

  /* One owner per topic, in priority order. Only study rows own a topic. */
  const ownerByKey = new Map<string, StudyItem>();
  for (const row of [...mainPending, ...carriedPending, ...doneToday]) {
    if (row.kind !== 'new') continue;
    const key = keyOf(row);
    if (!ownerByKey.has(key)) ownerByKey.set(key, row);
  }

  const byItemId = new Map<number, TaskRevisionRow[]>();
  for (const [key, owner] of ownerByKey) {
    const revisions = pendingByKey.get(key);
    if (revisions && revisions.length > 0) byItemId.set(owner.id, revisions.map(toRow));
  }

  /* A due revision with no card of its own gets its parent topic as a card. */
  const orphanCards: OrphanRevisionCard[] = [];
  const seenOrphan = new Set<string>();
  for (const revision of dueRevisions) {
    const key = keyOf(revision);
    if (ownerByKey.has(key) || seenOrphan.has(key)) continue;
    seenOrphan.add(key);
    const head =
      studentItems.find((item) => item.kind === 'new' && keyOf(item) === key) ?? revision;
    const revisions = pendingByKey.get(key) ?? [revision];
    orphanCards.push({ head, revisions: revisions.map(toRow) });
  }

  return { byItemId, orphanCards };
}
