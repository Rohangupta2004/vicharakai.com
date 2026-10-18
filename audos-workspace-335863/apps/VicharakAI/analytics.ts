/**
 * Pure derivations behind the Dashboard — and behind anything the AI Coach says
 * about progress, so the two can never disagree. No React, no data access.
 */
import {
  addDaysISO,
  diffDays,
  estimatedMinutes,
  localDayOf,
  minutesOnDate,
  sessionMinutes,
  topicKey,
  type HoursSnapshot,
  type MetaRow,
  type ScoreEntry,
  type StudyItem,
  type StudySession,
  type TaskAnnotation,
  type TestMistake,
} from './engine';
import type { ExamDef } from './syllabus';

export interface ChapterProgress {
  name: string;
  done: number;
  total: number;
  percent: number;
}

export interface SubjectProgress {
  subject: string;
  done: number;
  total: number;
  percent: number;
  chapters: ChapterProgress[];
}

/** Chapter-wise syllabus coverage per subject, driven by completed new topics. */
export function buildSubjectProgress(examDef: ExamDef | undefined, items: StudyItem[]): SubjectProgress[] {
  if (!examDef) return [];
  const doneKeys = new Set(
    items.filter((i) => i.kind === 'new' && i.status === 'done').map((i) => i.source_key || topicKey(i.subject, i.topic)),
  );
  return examDef.subjects.map((s) => {
    const chapters = s.chapters.map((c) => {
      // A chapter added as a single task counts as fully covered.
      const chapterDone = doneKeys.has(topicKey(s.name, c.name));
      const done = chapterDone ? c.topics.length : c.topics.filter((t) => doneKeys.has(topicKey(s.name, t))).length;
      return { name: c.name, done, total: c.topics.length, percent: c.topics.length === 0 ? 0 : Math.round((done / c.topics.length) * 100) };
    });
    const done = chapters.reduce((n, c) => n + c.done, 0);
    const total = chapters.reduce((n, c) => n + c.total, 0);
    return { subject: s.name, done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100), chapters };
  });
}

export function overallPercent(progress: SubjectProgress[]): number {
  const done = progress.reduce((n, s) => n + s.done, 0);
  const total = progress.reduce((n, s) => n + s.total, 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export interface SubjectScore {
  subject: string;
  avg: number;
  n: number;
}

/** Average test percentage per subject, weakest first. */
export function buildSubjectScores(entries: ScoreEntry[]): SubjectScore[] {
  const map = new Map<string, { sum: number; n: number }>();
  for (const entry of entries) {
    const cur = map.get(entry.subject) ?? { sum: 0, n: 0 };
    cur.sum += entry.percent;
    cur.n += 1;
    map.set(entry.subject, cur);
  }
  return [...map.entries()]
    .map(([subject, v]) => ({ subject, avg: Math.round(v.sum / v.n), n: v.n }))
    .sort((a, b) => a.avg - b.avg);
}

/**
 * The slice of a saved doubt the recommendation layer reads. Structurally
 * compatible with the flagged-question rows (zuno_question_queue), so callers
 * can pass those straight through.
 */
export interface DoubtSignal {
  subject: string;
  /** The chapter the doubt maps to (e.g. "Current Electricity"). */
  topic?: string | null;
  /** The specific concept (e.g. "Kirchhoff's Laws — loop rule"). */
  concept?: string | null;
  created_on: string;
}

/**
 * Group saved doubts by the chapter they flag, most doubts (then newest)
 * first. A doubt about Kirchhoff's Laws groups under Current Electricity —
 * that chapter is the weak area the doubt reveals.
 */
export function groupDoubtSignals(
  doubts: DoubtSignal[],
): Array<{ subject: string; chapter: string; count: number; latest: string }> {
  const map = new Map<string, { subject: string; chapter: string; count: number; latest: string }>();
  for (const d of doubts) {
    const subject = (d.subject || '').trim() || 'General';
    const chapter = (d.topic || '').trim() || (d.concept || '').trim() || subject;
    const key = `${subject}|${chapter}`.toLowerCase();
    const current = map.get(key);
    if (current) {
      current.count += 1;
      if (d.created_on > current.latest) current.latest = d.created_on;
    } else {
      map.set(key, { subject, chapter, count: 1, latest: d.created_on });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
}

/** Plain-language weak areas, used by the Coach's answers. */
export function buildWeakAreas(
  entries: ScoreEntry[],
  subjectScores: SubjectScore[],
  mistakes: TestMistake[] = [],
  doubts: DoubtSignal[] = [],
): Array<{ label: string; detail: string }> {
  const weak: Array<{ label: string; detail: string }> = [];
  // A logged mistake is the sharpest signal there is — the student named it.
  for (const m of mistakes.slice(0, 3)) {
    weak.push({ label: `${m.topic} (${m.subject})`, detail: `you logged: ${m.mistake_description}` });
  }
  // An uploaded doubt names a weak spot too — being stuck on a Kirchhoff's
  // Laws question flags Current Electricity even before any test is logged.
  for (const g of groupDoubtSignals(doubts).slice(0, 3)) {
    weak.push({
      label: `${g.chapter} (${g.subject})`,
      detail: g.count === 1 ? 'your Mistake Book flags this' : `${g.count} Mistake Book entries here`,
    });
  }
  for (const entry of entries) {
    if (entry.percent < 60 && entry.label) {
      const score = entry.marks !== null && entry.total !== null ? `${entry.marks}/${entry.total}` : `${entry.percent}%`;
      weak.push({ label: `${entry.label} (${entry.subject})`, detail: `${score} on ${entry.taken_on.slice(5)}` });
    }
  }
  for (const s of subjectScores) {
    if (s.avg < 60) weak.push({ label: s.subject, detail: `${s.avg}% average over ${s.n} test${s.n === 1 ? '' : 's'}` });
  }
  return weak.slice(0, 6);
}

export interface WeakChapter {
  subject: string;
  chapter: string;
  detail: string;
  rank: number;
}

/**
 * Chapter-level weak spots, sorted by urgency. Strongest signal first: a chapter
 * a logged mistake names, then chapters the student's saved doubts flag, then
 * a chapter a low test score points at, then
 * untouched chapters inside a subject the tests flag, then whatever is still
 * unstarted in the least-covered subjects — so the list is useful from day one.
 */
export function buildWeakChapters(
  entries: ScoreEntry[],
  subjectScores: SubjectScore[],
  subjectProgress: SubjectProgress[],
  mistakes: TestMistake[] = [],
  doubts: DoubtSignal[] = [],
): WeakChapter[] {
  const rows: WeakChapter[] = [];
  const seen = new Set<string>();
  const push = (row: WeakChapter) => {
    const key = `${row.subject}|${row.chapter}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };
  const avgBySubject = new Map(subjectScores.map((s) => [s.subject, s.avg]));

  for (const m of mistakes) {
    push({ subject: m.subject, chapter: m.topic, detail: `Mistake logged · ${m.logged_on.slice(5)}`, rank: 400 });
  }

  // Saved doubts sit just below logged mistakes: the student got stuck here,
  // so the chapter is flagged weak and prioritised for revision.
  for (const g of groupDoubtSignals(doubts)) {
    push({
      subject: g.subject,
      chapter: g.chapter,
      detail: `${g.count === 1 ? 'In your Mistake Book' : `${g.count} in your Mistake Book`} · ${g.latest.slice(5, 10)}`,
      rank: 350 + Math.min(40, g.count),
    });
  }

  for (const entry of entries) {
    if (entry.percent >= 60 || !entry.label) continue;
    const chapters = subjectProgress.find((s) => s.subject === entry.subject)?.chapters ?? [];
    const label = entry.label.toLowerCase();
    const matched = chapters.find((c) => label.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(label));
    push({
      subject: entry.subject,
      chapter: matched?.name ?? entry.label,
      detail:
        entry.marks !== null && entry.total !== null
          ? `${entry.marks}/${entry.total} · ${entry.percent}%`
          : `${entry.percent}% on ${entry.taken_on.slice(5)}`,
      rank: 300 + (60 - entry.percent),
    });
  }

  for (const s of subjectProgress) {
    const avg = avgBySubject.get(s.subject);
    if (avg === undefined || avg >= 60) continue;
    for (const c of s.chapters) {
      if (c.done > 0) continue;
      push({ subject: s.subject, chapter: c.name, detail: `Untouched · ${avg}% test average`, rank: 200 + (60 - avg) });
    }
  }

  for (const s of [...subjectProgress].sort((a, b) => a.percent - b.percent)) {
    for (const c of s.chapters) {
      if (c.done > 0) continue;
      push({ subject: s.subject, chapter: c.name, detail: `Not started · subject ${s.percent}% covered`, rank: 100 - s.percent });
    }
  }

  return rows.sort((a, b) => b.rank - a.rank).slice(0, 6);
}

/** Last ten tests as trend points. */
export function buildAccuracyTrend(entries: ScoreEntry[]): Array<{ label: string; value: number }> {
  return entries.slice(-10).map((entry) => ({ label: entry.taken_on.slice(5), value: entry.percent }));
}

/**
 * Minutes studied per day for the last seven days. Time the student recorded
 * always wins; the old per-task estimate is only a fallback for days they never
 * logged, so the chart is never empty and never overwrites a real number.
 */
export function buildHoursLog(
  items: StudyItem[],
  annotations: Map<string, TaskAnnotation>,
  today: string,
  sessions: StudySession[] = [],
): Array<{ iso: string; minutes: number; logged: boolean }> {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
  return days.map((iso) => {
    const recorded = minutesOnDate(sessions, iso);
    if (recorded > 0) return { iso, minutes: recorded, logged: true };
    const minutes = items
      .filter((i) => i.status === 'done' && localDayOf(i.completed_at) === iso)
      .reduce((sum, i) => {
        const ann = annotations.get(i.source_key || topicKey(i.subject, i.topic));
        // A duration the student set on the task beats the per-type estimate.
        return sum + (ann?.minutes && ann.minutes > 0 ? ann.minutes : estimatedMinutes(ann?.type, i.kind));
      }, 0);
    return { iso, minutes, logged: false };
  });
}

/**
 * Recorded study time, summarised for the pace signal. The window starts at the
 * student's first logged day (capped at seven), so someone who began recording
 * yesterday is judged on yesterday — not on five silent days before that.
 */
export function buildHoursSnapshot(
  sessions: StudySession[],
  today: string,
  targetMinutes: number | null,
): HoursSnapshot {
  const from = addDaysISO(today, -6);
  const inWindow = sessions.filter((s) => s.logged_on >= from && s.logged_on <= today);
  const firstLogged = inWindow.reduce<string | null>(
    (earliest, s) => (earliest === null || s.logged_on < earliest ? s.logged_on : earliest),
    null,
  );
  return {
    todayMinutes: minutesOnDate(sessions, today),
    windowMinutes: inWindow.reduce((sum, s) => sum + sessionMinutes(s), 0),
    windowDays: firstLogged ? Math.min(7, Math.max(1, diffDays(firstLogged, today) + 1)) : 1,
    targetMinutes,
  };
}

/** Consecutive days ending today (or yesterday) with at least one completion. */
export function computeStreak(items: StudyItem[], today: string): number {
  const doneDates = new Set(
    items.filter((i) => i.status === 'done' && i.completed_at).map((i) => localDayOf(i.completed_at)),
  );
  let cursor = doneDates.has(today) ? today : addDaysISO(today, -1);
  let count = 0;
  while (doneDates.has(cursor)) {
    count += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return count;
}

/** meta_key → row lookup for the small key-value store. */
export function buildMetaMap(rows: MetaRow[]): Map<string, MetaRow> {
  const map = new Map<string, MetaRow>();
  for (const row of rows) map.set(row.meta_key, row);
  return map;
}
