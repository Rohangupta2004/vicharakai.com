/**
 * Vision Board — the data layer.
 *
 * ONE node per syllabus CHAPTER of the student's own exam, grouped into
 * subject clusters, every cluster wired back to their dream goal. Every
 * number a node shows comes from data the app already owns — nothing here is
 * generated, guessed or asked of an AI:
 *
 *   syllabus %  subtopics of the chapter actually covered — the studied rows
 *               of zuno_topic_attempts, plus completed zuno_items whose
 *               annotation carries the chapter/topic id (and the same
 *               "a chapter finished as one task covers its topics" rule the
 *               Tools → Syllabus view uses).
 *   accuracy %  graded rows of zuno_topic_attempts (correct vs wrong) for the
 *               chapter. Null until at least one graded answer exists — a
 *               made-up 0% would read as failure where there is no evidence.
 *   mastery %   zuno_exam_progress.mastery_score for the chapter.
 *   weakness    unresolved zuno_weak_topics rows on the chapter.
 *   marks lost  vicharakai_topic_mastery rows (the Test Analysis rollup)
 *               matched to the chapter or one of its subtopics BY NAME — that
 *               table is keyed by topic name, not by syllabus id. Its
 *               mastery_score column is deliberately ignored: only wrong
 *               questions get cropped into it, so it is structurally 0.
 *   revision    zuno_exam_progress.spaced_revision_due_at, falling back to
 *               the student's own pending revision tasks.
 *   section     vicharakai_exam_sections names the paper each subject sits in.
 *
 * Pure derivations plus two shared-table reads. No AI anywhere in this path.
 */
import { useMemo } from 'react';
import {
  asNumber,
  chapterIdOfTopic,
  type ExamProgressRow,
  type TopicAttemptRow,
  type WeakTopicRow,
} from '../../adaptationEngine';
import {
  syllabusSlug,
  topicIdFor,
  type ChapterWeightage,
  type ExamSyllabus,
  type SyllabusChapter,
  type SyllabusSubject,
} from '../../data/syllabuses';
import { diffDays, topicKey, type StudyItem, type TaskAnnotation } from '../../engine';
import type { TopicMasteryRow } from '../testAnalysis/taTypes';
import { EXAM_REGISTRY_META_KEY } from '../../data/examRegistry';
import { useAllRows } from '../../services/database/dbClient';
import { useAccountSessionIds } from '../../services/database/accountScope';
import { TABLES } from '../../services/database/tables';
import { useStudentData } from '../../app/StudentDataContext';
import { mapSubjectColor, type MapBand } from './visionBoardTheme';

/* ------------------------------------------------------------------ */
/*  Thresholds — the ONE place the map's colour coding is decided      */
/* ------------------------------------------------------------------ */

/** Green from here up. Same cut the Syllabus Browser uses. */
export const STRONG_AT = 70;
/** Amber from here up; below it is red. */
export const MODERATE_AT = 40;
/** Accuracy under this reads weak however healthy the coverage looks. */
export const WEAK_ACCURACY = 50;
/** Marks lost across logged mocks that alone marks a chapter weak. */
export const WEAK_MARKS_LOST = 4;

/* ------------------------------------------------------------------ */
/*  Row shapes                                                         */
/* ------------------------------------------------------------------ */

/** One row of vicharakai_exam_sections (shared, server-written). */
export interface ExamSectionRow {
  id: string;
  exam_id: string;
  section_name: string;
  /** JSON array of subject names — may arrive parsed or as a string. */
  subjects?: unknown;
  total_questions?: number | string | null;
  section_total_marks?: number | string | null;
  display_order?: number | string | null;
}

/* ------------------------------------------------------------------ */
/*  The model the screen renders                                       */
/* ------------------------------------------------------------------ */

export type RevisionState = 'due' | 'uptodate' | 'notstarted';

export interface VisionNode {
  /** Syllabus chapter id (or a `sample-*` id on the illustrative map). */
  id: string;
  name: string;
  subject: string;
  subjectId: string;
  weightage: ChapterWeightage | null;
  topicsTotal: number;
  topicsCovered: number;
  syllabusPct: number;
  /** Null until the student has at least one graded answer on the chapter. */
  accuracyPct: number | null;
  gradedAnswers: number;
  /** zuno_exam_progress mastery, null when the chapter has no row yet. */
  masteryPct: number | null;
  weaknessScore: number;
  marksLost: number;
  doubtCount: number;
  /** The dominant error tag the Test Analysis rollup recorded, when any. */
  errorTag: string | null;
  band: MapBand;
  revision: RevisionState;
  revisionDueOn: string | null;
  overdueDays: number;
  /** Most recent real study/test activity on this chapter (YYYY-MM-DD). */
  lastStudiedOn: string | null;
  /** Present only for nodes built from the real syllabus — powers "add to plan". */
  chapterRef: SyllabusChapter | null;
  subjectRef: SyllabusSubject | null;
}

export interface VisionCluster {
  id: string;
  name: string;
  /** The exam paper/section this subject sits in, when the registry knows. */
  section: string | null;
  color: string;
  nodes: VisionNode[];
  syllabusPct: number;
  counts: Record<MapBand, number>;
  dueCount: number;
}

export interface VisionTotals {
  nodes: number;
  started: number;
  due: number;
  syllabusPct: number;
  counts: Record<MapBand, number>;
}

export interface VisionBoardModel {
  loading: boolean;
  /** True when the map is the illustrative sample, not the student's exam. */
  sample: boolean;
  examLabel: string;
  /** The exam's own id in the shared registry, when resolved. */
  examId: string | null;
  daysToExam: number;
  /** The dream goal from Profile (zuno_meta `goals`) — '' when never set. */
  goal: string;
  clusters: VisionCluster[];
  totals: VisionTotals;
  /** The three costliest nodes — the "start here" callout under the goal. */
  weakest: VisionNode[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function emptyCounts(): Record<MapBand, number> {
  return { weak: 0, moderate: 0, strong: 0, untouched: 0 };
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Latest calendar day from timestamps/dates that may be null. */
function latestDate(...values: Array<string | null | undefined>): string | null {
  let latest = '';
  for (const value of values) {
    const day = String(value ?? '').slice(0, 10);
    if (day > latest) latest = day;
  }
  return latest || null;
}

/** The `subjects` JSON column, however the driver hands it back. */
function sectionSubjects(raw: unknown): string[] {
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Shared reference reads                                             */
/* ------------------------------------------------------------------ */

export interface ExamSectionsResult {
  sections: ExamSectionRow[];
  /** syllabusSlug(subject name) → the section/paper it belongs to. */
  bySubjectSlug: Map<string, string>;
  loading: boolean;
}

/**
 * The sections/papers of one exam from the shared registry. The whole table
 * is under a hundred rows, so it is read once and filtered here rather than
 * re-querying whenever the student's exam changes.
 */
export function useExamSections(examId: string | null): ExamSectionsResult {
  const query = useAllRows<ExamSectionRow>(TABLES.examSections, {
    shared: true,
    orderBy: { column: 'display_order', direction: 'asc' },
  });

  return useMemo(() => {
    const sections = examId ? (query.data ?? []).filter((row) => row.exam_id === examId) : [];
    const bySubjectSlug = new Map<string, string>();
    for (const section of sections) {
      for (const subject of sectionSubjects(section.subjects)) {
        const slug = syllabusSlug(subject);
        if (slug && !bySubjectSlug.has(slug)) bySubjectSlug.set(slug, section.section_name);
      }
      // A single-subject paper is often named after the subject itself.
      const ownSlug = syllabusSlug(section.section_name);
      if (ownSlug && !bySubjectSlug.has(ownSlug)) bySubjectSlug.set(ownSlug, section.section_name);
    }
    return { sections, bySubjectSlug, loading: query.loading };
  }, [query.data, query.loading, examId]);
}

/* ------------------------------------------------------------------ */
/*  The build                                                          */
/* ------------------------------------------------------------------ */

export interface BuildVisionBoardArgs {
  exam: ExamSyllabus;
  progressRows: ExamProgressRow[];
  attemptRows: TopicAttemptRow[];
  weakTopicRows: WeakTopicRow[];
  /** vicharakai_topic_mastery rows — `topic_id` holds a topic NAME, not a
   * syllabus id, so they are matched to chapters by slug below. */
  mockRows: TopicMasteryRow[];
  studentItems: StudyItem[];
  annotations: Map<string, TaskAnnotation>;
  sectionBySubjectSlug: Map<string, string>;
  today: string;
}

/** Which colour a node wears. The single decision point for the whole map. */
export function bandFor(node: {
  started: boolean;
  masteryPct: number | null;
  accuracyPct: number | null;
  syllabusPct: number;
  weaknessScore: number;
  marksLost: number;
}): MapBand {
  if (!node.started) return 'untouched';
  if (
    node.weaknessScore > 0 ||
    (node.accuracyPct !== null && node.accuracyPct < WEAK_ACCURACY) ||
    node.marksLost >= WEAK_MARKS_LOST
  ) {
    return 'weak';
  }
  const score = node.masteryPct ?? node.accuracyPct ?? node.syllabusPct;
  if (score >= STRONG_AT) return 'strong';
  if (score >= MODERATE_AT) return 'moderate';
  return 'weak';
}

/** Assemble the subject clusters for one exam. Pure — no React, no reads. */
export function buildClusters(args: BuildVisionBoardArgs): VisionCluster[] {
  const {
    exam,
    progressRows,
    attemptRows,
    weakTopicRows,
    mockRows,
    studentItems,
    annotations,
    sectionBySubjectSlug,
    today,
  } = args;

  /* ---- chapter-level mastery + spaced revision ---- */
  const progressByChapter = new Map<string, ExamProgressRow>();
  for (const row of progressRows) {
    if (row.exam_id === exam.id) progressByChapter.set(row.chapter_id, row);
  }

  /* ---- the attempt log, bucketed per chapter ---- */
  const studiedTopicsByChapter = new Map<string, Set<string>>();
  const gradedByChapter = new Map<string, { correct: number; total: number }>();
  const lastAttemptByChapter = new Map<string, string>();
  for (const row of attemptRows) {
    if (row.exam_id !== exam.id) continue;
    const chapterId = row.chapter_id || chapterIdOfTopic(row.topic_id);
    if (!chapterId) continue;
    const attemptedOn = String(row.attempted_at ?? '').slice(0, 10);
    if (attemptedOn > (lastAttemptByChapter.get(chapterId) ?? '')) {
      lastAttemptByChapter.set(chapterId, attemptedOn);
    }
    if (row.result === 'studied' || row.result === 'correct') {
      const set = studiedTopicsByChapter.get(chapterId) ?? new Set<string>();
      set.add(row.topic_id);
      studiedTopicsByChapter.set(chapterId, set);
    }
    if (row.result === 'correct' || row.result === 'wrong') {
      const bucket = gradedByChapter.get(chapterId) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (row.result === 'correct') bucket.correct += 1;
      gradedByChapter.set(chapterId, bucket);
    }
  }

  /* ---- unresolved weakness, summed per chapter ---- */
  const weaknessByChapter = new Map<string, number>();
  for (const row of weakTopicRows) {
    if (row.exam_id !== exam.id || row.resolved_at) continue;
    const score = asNumber(row.weakness_score);
    if (score <= 0) continue;
    const chapterId = row.chapter_id || chapterIdOfTopic(row.topic_id);
    if (!chapterId) continue;
    weaknessByChapter.set(chapterId, (weaknessByChapter.get(chapterId) ?? 0) + score);
  }

  /* ---- the student's own completed work and pending revisions ---- */
  const doneKeys = new Set<string>();
  const doneChapterIds = new Set<string>();
  const doneTopicIds = new Set<string>();
  const revisionDueByKey = new Map<string, string>();
  const lastStudyByKey = new Map<string, string>();
  const lastStudyByChapter = new Map<string, string>();
  for (const item of studentItems) {
    const key = item.source_key || topicKey(item.subject, item.topic);
    const syl = annotations.get(key)?.syl;
    const activityOn = String(item.completed_at || item.studied_on || '').slice(0, 10);
    if (activityOn > (lastStudyByKey.get(key) ?? '')) lastStudyByKey.set(key, activityOn);
    if (syl?.cid && activityOn > (lastStudyByChapter.get(syl.cid) ?? '')) {
      lastStudyByChapter.set(syl.cid, activityOn);
    }
    if (item.kind === 'new' && item.status === 'done') {
      doneKeys.add(key);
      // A task pinned to ONE topic covers that topic only; a chapter-level
      // task covers the chapter (the Tools → Syllabus rule).
      if (syl?.tid) doneTopicIds.add(syl.tid);
      else if (syl?.cid) doneChapterIds.add(syl.cid);
      continue;
    }
    if (item.kind === 'revision' && item.status === 'pending') {
      for (const candidate of [syl?.cid ?? '', key]) {
        if (!candidate) continue;
        const existing = revisionDueByKey.get(candidate);
        if (!existing || item.scheduled_for < existing) revisionDueByKey.set(candidate, item.scheduled_for);
      }
    }
  }

  /* ---- the Test Analysis rollup, matched to chapters by NAME ---- */
  const slugToChapter = new Map<string, string>();
  for (const subject of exam.subjects) {
    for (const chapter of subject.chapters) {
      const chapterSlug = syllabusSlug(chapter.name);
      if (chapterSlug && !slugToChapter.has(chapterSlug)) slugToChapter.set(chapterSlug, chapter.id);
      for (const topic of chapter.topics) {
        const topicSlug = syllabusSlug(topic);
        if (topicSlug && !slugToChapter.has(topicSlug)) slugToChapter.set(topicSlug, chapter.id);
      }
    }
  }
  const mockByChapter = new Map<string, { marksLost: number; doubts: number; errorTag: string | null }>();
  for (const row of mockRows) {
    const chapterId = slugToChapter.get(syllabusSlug(String(row.topic_id ?? '')));
    if (!chapterId) continue;
    const bucket = mockByChapter.get(chapterId) ?? { marksLost: 0, doubts: 0, errorTag: null };
    bucket.marksLost += asNumber(row.marks_lost);
    bucket.doubts += asNumber(row.doubt_count);
    bucket.errorTag = bucket.errorTag ?? (row.dominant_error_tag || null);
    mockByChapter.set(chapterId, bucket);
  }

  /* ---- assemble ---- */
  return exam.subjects.map((subject) => {
    let clusterCovered = 0;
    let clusterTotal = 0;
    const counts = emptyCounts();
    let dueCount = 0;

    const nodes: VisionNode[] = subject.chapters.map((chapter) => {
      const topicsTotal = Math.max(1, chapter.topics.length);
      const nameKey = topicKey(subject.name, chapter.name);
      const wholeChapterDone = doneChapterIds.has(chapter.id) || doneKeys.has(nameKey);

      const covered = new Set(studiedTopicsByChapter.get(chapter.id) ?? []);
      for (const topic of chapter.topics) {
        const topicId = topicIdFor(chapter.id, topic);
        if (doneTopicIds.has(topicId) || doneKeys.has(topicKey(subject.name, topic))) covered.add(topicId);
      }
      const topicsCovered = wholeChapterDone ? topicsTotal : Math.min(covered.size, topicsTotal);
      const syllabusPct = pct(topicsCovered, topicsTotal);

      const graded = gradedByChapter.get(chapter.id);
      const accuracyPct = graded && graded.total > 0 ? pct(graded.correct, graded.total) : null;
      const progress = progressByChapter.get(chapter.id);
      const masteryPct = progress ? asNumber(progress.mastery_score) : null;
      const weaknessScore = weaknessByChapter.get(chapter.id) ?? 0;
      const mock = mockByChapter.get(chapter.id);
      const marksLost = mock ? Math.round(mock.marksLost * 10) / 10 : 0;

      const started = topicsCovered > 0 || (masteryPct !== null && masteryPct > 0) || (graded?.total ?? 0) > 0;
      const band = bandFor({
        started,
        masteryPct,
        accuracyPct,
        syllabusPct,
        weaknessScore,
        marksLost,
      });

      /* Revision: the engine's own due date first, then the student's own
       * pending revision task, then "nothing scheduled". A chapter the
       * student has never touched is 'not started', never "up to date". */
      const engineDue = progress?.spaced_revision_due_at
        ? String(progress.spaced_revision_due_at).slice(0, 10)
        : null;
      const taskDue = revisionDueByKey.get(chapter.id) ?? revisionDueByKey.get(nameKey) ?? null;
      const revisionDueOn = engineDue && taskDue ? (engineDue < taskDue ? engineDue : taskDue) : engineDue ?? taskDue;
      let revision: RevisionState = 'notstarted';
      let overdueDays = 0;
      if (started) {
        if (revisionDueOn) {
          const elapsed = diffDays(revisionDueOn, today);
          revision = elapsed >= 0 ? 'due' : 'uptodate';
          overdueDays = Math.max(0, elapsed);
        } else {
          revision = 'uptodate';
        }
      }
      const lastStudiedOn = latestDate(
        progress?.last_studied_at,
        lastAttemptByChapter.get(chapter.id),
        lastStudyByChapter.get(chapter.id),
        lastStudyByKey.get(nameKey),
      );

      clusterCovered += topicsCovered;
      clusterTotal += topicsTotal;
      counts[band] += 1;
      if (revision === 'due') dueCount += 1;

      return {
        id: chapter.id,
        name: chapter.name,
        subject: subject.name,
        subjectId: subject.id,
        weightage: chapter.weightage ?? null,
        topicsTotal,
        topicsCovered,
        syllabusPct,
        accuracyPct,
        gradedAnswers: graded?.total ?? 0,
        masteryPct,
        weaknessScore,
        marksLost,
        doubtCount: mock?.doubts ?? 0,
        errorTag: mock?.errorTag ?? null,
        band,
        revision,
        revisionDueOn,
        overdueDays,
        lastStudiedOn,
        chapterRef: chapter,
        subjectRef: subject,
      };
    });

    return {
      id: subject.id,
      name: subject.name,
      section: sectionBySubjectSlug.get(syllabusSlug(subject.name)) ?? null,
      color: mapSubjectColor(subject.name),
      nodes,
      syllabusPct: pct(clusterCovered, clusterTotal),
      counts,
      dueCount,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  The illustrative map                                               */
/* ------------------------------------------------------------------ */

interface SampleSeed {
  name: string;
  syllabusPct: number;
  accuracyPct: number | null;
  band: MapBand;
  revision: RevisionState;
}

const SAMPLE_CLUSTERS: Array<{ subject: string; section: string; chapters: SampleSeed[] }> = [
  {
    subject: 'Physics',
    section: 'Paper 1',
    chapters: [
      { name: 'Current Electricity', syllabusPct: 70, accuracyPct: 42, band: 'weak', revision: 'due' },
      { name: 'Thermodynamics', syllabusPct: 55, accuracyPct: 68, band: 'moderate', revision: 'uptodate' },
      { name: 'Optics', syllabusPct: 90, accuracyPct: 81, band: 'strong', revision: 'uptodate' },
      { name: 'Modern Physics', syllabusPct: 0, accuracyPct: null, band: 'untouched', revision: 'notstarted' },
    ],
  },
  {
    subject: 'Chemistry',
    section: 'Paper 2',
    chapters: [
      { name: 'Chemical Bonding', syllabusPct: 80, accuracyPct: 74, band: 'moderate', revision: 'uptodate' },
      { name: 'Organic Reaction Mechanisms', syllabusPct: 35, accuracyPct: 38, band: 'weak', revision: 'due' },
    ],
  },
];

/**
 * The map a student with no exam syllabus yet still sees — the same layout,
 * the same colour coding, filled with example chapters so the idea lands
 * before any data exists. Always labelled as an example in the UI.
 */
export function sampleClusters(): VisionCluster[] {
  return SAMPLE_CLUSTERS.map((seed) => {
    const counts = emptyCounts();
    let dueCount = 0;
    const nodes: VisionNode[] = seed.chapters.map((chapter, index) => {
      counts[chapter.band] += 1;
      if (chapter.revision === 'due') dueCount += 1;
      return {
        id: `sample-${syllabusSlug(seed.subject)}-${index}`,
        name: chapter.name,
        subject: seed.subject,
        subjectId: `sample-${syllabusSlug(seed.subject)}`,
        weightage: index === 0 ? 'high' : null,
        topicsTotal: 10,
        topicsCovered: Math.round(chapter.syllabusPct / 10),
        syllabusPct: chapter.syllabusPct,
        accuracyPct: chapter.accuracyPct,
        gradedAnswers: chapter.accuracyPct === null ? 0 : 12,
        masteryPct: chapter.band === 'untouched' ? null : chapter.syllabusPct,
        weaknessScore: chapter.band === 'weak' ? 50 : 0,
        marksLost: chapter.band === 'weak' ? 6 : 0,
        doubtCount: chapter.band === 'weak' ? 3 : 0,
        errorTag: null,
        band: chapter.band,
        revision: chapter.revision,
        revisionDueOn: null,
        overdueDays: chapter.revision === 'due' ? 2 : 0,
        lastStudiedOn: chapter.band === 'untouched' ? null : '2026-09-27',
        chapterRef: null,
        subjectRef: null,
      };
    });
    return {
      id: `sample-${syllabusSlug(seed.subject)}`,
      name: seed.subject,
      section: seed.section,
      color: mapSubjectColor(seed.subject),
      nodes,
      syllabusPct: pct(
        nodes.reduce((sum, node) => sum + node.topicsCovered, 0),
        nodes.reduce((sum, node) => sum + node.topicsTotal, 0),
      ),
      counts,
      dueCount,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Roll-ups                                                           */
/* ------------------------------------------------------------------ */

export function totalsFor(clusters: VisionCluster[]): VisionTotals {
  const counts = emptyCounts();
  let nodes = 0;
  let due = 0;
  let covered = 0;
  let total = 0;
  for (const cluster of clusters) {
    for (const node of cluster.nodes) {
      nodes += 1;
      counts[node.band] += 1;
      if (node.revision === 'due') due += 1;
      covered += node.topicsCovered;
      total += node.topicsTotal;
    }
  }
  return {
    nodes,
    started: nodes - counts.untouched,
    due,
    syllabusPct: pct(covered, total),
    counts,
  };
}

/**
 * The cards that actually pin to the board. A full syllabus is too many
 * notes for a static 375px pinboard, so we keep at most `limit` and mix
 * subjects — due/weak chapters first, then the strongest remaining so the
 * board still reads as a whole-prep picture.
 */
export function pinboardNodes(clusters: VisionCluster[], limit = 8): VisionNode[] {
  const all = clusters.flatMap((cluster) => cluster.nodes);
  if (all.length <= limit) return all;

  const score = (node: VisionNode): number => {
    let value = 0;
    if (node.revision === 'due') value += 80;
    if (node.accuracyPct !== null && node.accuracyPct < 50) value += 70;
    else if (node.accuracyPct !== null && node.accuracyPct <= 75) value += 40;
    if (node.band === 'weak') value += 30;
    value += node.marksLost;
    value += node.weaknessScore / 10;
    return value;
  };

  const bySubject = new Map<string, VisionNode[]>();
  for (const node of all) {
    const list = bySubject.get(node.subjectId) ?? [];
    list.push(node);
    bySubject.set(node.subjectId, list);
  }

  const picked: VisionNode[] = [];
  const pickedIds = new Set<string>();
  for (const nodes of bySubject.values()) {
    const best = [...nodes].sort((a, b) => score(b) - score(a))[0];
    if (best && picked.length < limit) {
      picked.push(best);
      pickedIds.add(best.id);
    }
  }
  const rest = all.filter((node) => !pickedIds.has(node.id)).sort((a, b) => score(b) - score(a));
  for (const node of rest) {
    if (picked.length >= limit) break;
    picked.push(node);
  }
  return picked;
}

/** The costliest nodes first — marks lost, then weakness, then low accuracy. */
export function weakestNodes(clusters: VisionCluster[], limit = 3): VisionNode[] {
  return clusters
    .flatMap((cluster) => cluster.nodes)
    .filter((node) => node.band === 'weak')
    .sort(
      (a, b) =>
        b.marksLost - a.marksLost ||
        b.weaknessScore - a.weaknessScore ||
        (a.accuracyPct ?? 100) - (b.accuracyPct ?? 100),
    )
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  The hook the screen reads                                          */
/* ------------------------------------------------------------------ */

/**
 * THE Vision Board model. Reads the student's state from StudentDataContext
 * (so no number here can disagree with Today, Progress or the Syllabus
 * Browser) and adds the two tables the provider does not already load: the
 * Test Analysis per-topic rollup and the shared exam-section registry.
 */
export function useVisionBoard(): VisionBoardModel {
  const data = useStudentData();
  const {
    spaceId,
    today,
    goals,
    metaMap,
    daysToExam,
    examDef,
    savedExamLabel,
    activeSyllabusExam,
    progressRows,
    attemptRows,
    weakTopicRows,
    studentItems,
    annotations,
    itemsQ,
    examProgressQ,
  } = data;

  const accountSessionIds = useAccountSessionIds(spaceId);
  const mockQ = useAllRows<TopicMasteryRow>(
    TABLES.mockTopicMastery,
    { orderBy: { column: 'id', direction: 'asc' } },
    accountSessionIds,
  );
  /* Which exam to read section labels for: the structured syllabus id when
   * one resolves, otherwise the `vicharakai_exams` id onboarding stamped on
   * the profile — so an exam with no local syllabus still names its papers.
   * Kept as two statements on purpose: `a ?? b || c` in one expression is a
   * SyntaxError (esbuild: "Cannot use '||' with '??' without parentheses"),
   * which fails the whole space compile, not just this screen. */
  const registryExamId = (metaMap.get(EXAM_REGISTRY_META_KEY)?.meta_value || '').trim();
  const examId = activeSyllabusExam?.id ?? (registryExamId || null);
  const sections = useExamSections(examId);

  const clusters = useMemo<VisionCluster[]>(() => {
    if (!activeSyllabusExam) return sampleClusters();
    const built = buildClusters({
      exam: activeSyllabusExam,
      progressRows,
      attemptRows,
      weakTopicRows,
      mockRows: mockQ.data ?? [],
      studentItems,
      annotations,
      sectionBySubjectSlug: sections.bySubjectSlug,
      today,
    }).filter((cluster) => cluster.nodes.length > 0);
    return built.length > 0 ? built : sampleClusters();
  }, [
    activeSyllabusExam,
    progressRows,
    attemptRows,
    weakTopicRows,
    mockQ.data,
    studentItems,
    annotations,
    sections.bySubjectSlug,
    today,
  ]);

  const sample = !activeSyllabusExam || clusters.every((cluster) => cluster.id.startsWith('sample-'));

  return useMemo(
    () => ({
      loading: itemsQ.loading || examProgressQ.loading || mockQ.loading,
      sample,
      examLabel: activeSyllabusExam?.name || examDef?.name || savedExamLabel || 'Your exam',
      examId,
      daysToExam,
      goal: (goals ?? '').trim(),
      clusters,
      totals: totalsFor(clusters),
      weakest: weakestNodes(clusters),
    }),
    [
      itemsQ.loading,
      examProgressQ.loading,
      mockQ.loading,
      sample,
      activeSyllabusExam,
      examDef,
      savedExamLabel,
      examId,
      daysToExam,
      goals,
      clusters,
    ],
  );
}

/* ------------------------------------------------------------------ */
/*  Filtering (the map's focus chips)                                  */
/* ------------------------------------------------------------------ */

export type NodeFilter = 'all' | 'weak' | 'due' | 'untouched';

export const FILTER_LABEL: Record<NodeFilter, string> = {
  all: 'Everything',
  weak: 'Needs work',
  due: 'Revision due',
  untouched: 'Not started',
};

/** Keep only the nodes a filter asks for; clusters left empty drop out. */
export function filterClusters(clusters: VisionCluster[], filter: NodeFilter): VisionCluster[] {
  if (filter === 'all') return clusters;
  const keep = (node: VisionNode): boolean => {
    if (filter === 'weak') return node.band === 'weak';
    if (filter === 'due') return node.revision === 'due';
    return node.band === 'untouched';
  };
  return clusters
    .map((cluster) => ({ ...cluster, nodes: cluster.nodes.filter(keep) }))
    .filter((cluster) => cluster.nodes.length > 0);
}
