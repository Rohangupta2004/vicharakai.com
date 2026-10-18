/**
 * [V2] Vicharee's daily targets — the auto-plan behind the Today tab.
 *
 * THE POINT: a student never has to type a task to get started. The moment
 * the mood check resolves, Today fills itself with targets Vicharee chose,
 * drawn in priority order from the student's own tracked data:
 *
 *   1. weak topics      — the adaptation engine's flagged weaknesses
 *   2. doubts logged    — concepts sitting in the Mistake Book
 *   3. spaced recall    — topics studied in the last few days with no
 *                         revision already due
 *   4. this week's plan — the focus chapters the weekly targets name
 *   5. the syllabus     — the next untouched chapters, heaviest weightage
 *                         first, so a brand-new student still gets a plan
 *
 * Nothing here writes: the builder is pure and returns intentions. The Today
 * screen hands each one to the SAME `addTask` path every other surface uses,
 * so duplicates are skipped automatically and a seeded target behaves like
 * any other task (edit it, delete it, tick it).
 *
 * How MANY targets come back is the mood's call (moodCheck.moodTargetCount):
 * energetic pushes harder with more new ground, down keeps it to one or two
 * revision items.
 */
import { addDaysISO, topicKey, type StudyItem, type TaskType } from '../../engine';
import type { WeakTopicInsight } from '../../adaptationEngine';
import { flaggedConceptLabel, type FlaggedRow } from '../../mcq';
import type { TopicPickerSubject } from '../../TopicPicker';

/** One target Vicharee wants on today's plate, and why. */
export interface VichareeTarget {
  /** topicKey(subject, topic) — the dedupe identity used everywhere. */
  key: string;
  subject: string;
  topic: string;
  type: TaskType;
  /** The evidence line shown under the task card. */
  reason: string;
}

export interface VichareeTargetInput {
  /** How many targets to return (moodTargetCount). */
  limit: number;
  today: string;
  studentItems: StudyItem[];
  /** Revisions already due today — their topics are covered, so skip them. */
  dueRevisions: StudyItem[];
  completedByDate: Map<string, StudyItem[]>;
  weakTopicInsights: WeakTopicInsight[];
  /** Queued Mistake Book rows — a logged doubt is a target in waiting. */
  flaggedRows: FlaggedRow[];
  /** The student's own exam syllabus, subject → chapter → topics. */
  syllabusSubjects: TopicPickerSubject[];
  /** This week's focus chapters, when the weekly targets name any. */
  focusChapters: Array<{ subject: string; chapter: string }>;
}

/** Heaviest-weightage chapters lead the untouched-syllabus fallback. */
const WEIGHT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Vicharee's picks for today, best evidence first and already de-duplicated
 * against everything the student has on (or has finished on) their plan.
 */
export function buildVichareeTargets(input: VichareeTargetInput): VichareeTarget[] {
  const {
    limit,
    today,
    studentItems,
    dueRevisions,
    completedByDate,
    weakTopicInsights,
    flaggedRows,
    syllabusSubjects,
    focusChapters,
  } = input;
  const targets: VichareeTarget[] = [];
  if (limit <= 0) return targets;

  /* Anything already queued, already finished, or already coming back today
   * is covered — Vicharee never proposes work the student can already see. */
  const taken = new Set<string>();
  for (const item of studentItems) {
    taken.add(item.source_key || topicKey(item.subject, item.topic));
  }
  for (const item of dueRevisions) {
    taken.add(item.source_key || topicKey(item.subject, item.topic));
  }

  const push = (subject: string, topic: string, type: TaskType, reason: string): void => {
    if (targets.length >= limit) return;
    const topicName = clean(topic);
    if (!topicName) return;
    const subjectName = clean(subject) || 'General';
    const key = topicKey(subjectName, topicName);
    if (taken.has(key)) return;
    taken.add(key);
    targets.push({ key, subject: subjectName, topic: topicName, type, reason });
  };

  /* 1 · weak topics — the strongest evidence the app has. */
  for (const weak of weakTopicInsights) {
    push(
      clean(weak.subjectName),
      clean(weak.topicName) || clean(weak.chapterName),
      'Revision',
      `Weak area — ${weak.reason || 'your own test data flags it'}`,
    );
  }

  /* 2 · doubts the student logged — a saved mistake is an unfinished topic. */
  for (const row of flaggedRows) {
    if (row.status !== 'queued') continue;
    push(clean(row.subject), clean(flaggedConceptLabel(row)), 'Question Practice', 'From a doubt you logged');
  }

  /* 3 · recall is slipping — studied in the last five days, nothing due. */
  for (let back = 1; back <= 5 && targets.length < limit; back += 1) {
    for (const item of completedByDate.get(addDaysISO(today, -back)) ?? []) {
      push(
        item.subject,
        item.topic,
        'Revision',
        back === 1 ? 'Studied yesterday — recall it now' : `Studied ${back} days ago — spaced recall`,
      );
    }
  }

  /* 4 · this week's named focus chapters. */
  for (const focus of focusChapters) {
    push(clean(focus.subject), clean(focus.chapter), 'Self Study', "This week's focus chapter");
  }

  /* 5 · the syllabus itself — heaviest chapters first. This is the rung that
   * gives a BRAND-NEW student a real plan on day one, with no history and
   * nothing typed. */
  if (targets.length < limit) {
    const fresh: Array<{ subject: string; topic: string; rank: number }> = [];
    for (const subject of syllabusSubjects) {
      for (const chapter of subject.chapters) {
        fresh.push({
          subject: subject.name,
          topic: clean(chapter.topics?.[0]) || chapter.name,
          rank: WEIGHT_RANK[chapter.weightage ?? 'medium'] ?? 1,
        });
      }
    }
    fresh.sort((a, b) => a.rank - b.rank);
    for (const entry of fresh) {
      push(entry.subject, entry.topic, 'Self Study', 'Next up in your syllabus');
    }
  }

  return targets;
}

/* ------------------------------------------------------------------ */
/*  Device-side memory: which targets Vicharee seeded, and when        */
/* ------------------------------------------------------------------ */

/* Deliberately localStorage, not a table: this is presentation state (which
 * card wears the "Vicharee decided this" badge today), not study history. */
function seedKey(spaceId: string, date: string): string {
  return `vicharak_vicharee_seed_${spaceId}_${date}`;
}
function passKey(spaceId: string, date: string): string {
  return `vicharak_vicharee_seedpass_${spaceId}_${date}`;
}

/** topicKey → the reason Vicharee gave, for every target it seeded today. */
export function readSeededTargets(spaceId: string, date: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(seedKey(spaceId, date));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return new Map();
    return new Map(Object.entries(parsed as Record<string, string>));
  } catch {
    return new Map();
  }
}

export function rememberSeededTargets(spaceId: string, date: string, picks: VichareeTarget[]): void {
  if (picks.length === 0) return;
  try {
    const merged = readSeededTargets(spaceId, date);
    for (const pick of picks) merged.set(pick.key, pick.reason);
    localStorage.setItem(seedKey(spaceId, date), JSON.stringify(Object.fromEntries(merged)));
  } catch {
    /* storage unavailable — the tasks still land, only the badge is lost */
  }
}

/**
 * True when Vicharee has already generated the day's targets for this mood.
 * Keyed by mood as well as date, so answering the mood check AFTER an opener
 * tops the plan up to the new energy level exactly once.
 */
export function seedPassDone(spaceId: string, date: string, mood: string | null): boolean {
  try {
    const raw = localStorage.getItem(passKey(spaceId, date)) ?? '';
    return raw.split(',').includes(mood ?? 'none');
  } catch {
    /* no storage: treat it as done so a private-mode session cannot loop */
    return true;
  }
}

export function markSeedPass(spaceId: string, date: string, mood: string | null): void {
  try {
    const raw = localStorage.getItem(passKey(spaceId, date)) ?? '';
    const done = new Set(raw.split(',').filter(Boolean));
    done.add(mood ?? 'none');
    localStorage.setItem(passKey(spaceId, date), [...done].join(','));
  } catch {
    /* seedPassDone answers true without storage, so nothing can loop */
  }
}
