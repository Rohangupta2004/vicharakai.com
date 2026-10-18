/**
 * Runtime reader for the shared VicharakAI exam registry — `vicharakai_exams`
 * (one row per supported exam: identity, format, marking, scale) and
 * `vicharakai_exam_sections` (the papers each exam is made of, with the
 * subjects that sit inside them).
 *
 * WHY IT EXISTS: onboarding's exam picker is driven by this registry, and
 * picking an exam loads that exam's SECTIONS straight onto the student's
 * profile — so the app knows the real paper structure of any supported exam
 * without asking an AI for it. The Vision Board reads the same sections table
 * to label the paper each subject cluster belongs to.
 *
 * Both tables are shared, server-write-only reference data (session_id null):
 * nothing here writes, and every read passes `shared: true`.
 *
 * STABLE READ OPTIONS: the query option objects are module-level constants on
 * purpose. A fresh object per render makes the underlying WorkspaceDB hook's
 * inputs look changed on every pass, which re-arms its fetch effect and made
 * the onboarding picker re-render its list several times while mounting.
 */
import { useMemo } from 'react';
import { useAllRows } from '../services/database/dbClient';
import { TABLES } from '../services/database/tables';
import type { ExamSubject } from '../syllabus';

/** zuno_meta key holding the chosen exam's registry id (`vicharakai_exams.id`). */
export const EXAM_REGISTRY_META_KEY = 'exam_registry_id';
/** zuno_meta key holding that exam's section/paper structure, as JSON. */
export const EXAM_SECTIONS_META_KEY = 'exam_sections';

/** One row of `vicharakai_exams`. */
export interface ExamRegistryRow {
  /** Stable text id, e.g. 'neet_ug', 'jee_main', 'mcat'. */
  id: string;
  full_name?: string | null;
  short_name?: string | null;
  country?: string | null;
  region?: string | null;
  /** Machine key used to group and sort the onboarding picker. */
  category?: string | null;
  /** Human-readable second line shown on the onboarding exam card. */
  category_label?: string | null;
  target_audience?: string | null;
  total_questions?: number | null;
  total_marks?: number | null;
  duration_minutes?: number | null;
  typical_prep_duration_months?: number | null;
  is_active?: boolean | null;
}

/** One row of `vicharakai_exam_sections`. */
export interface ExamSectionRegistryRow {
  /** Auto-generated uuid. */
  id: string;
  exam_id: string;
  section_name: string;
  /** json column — the SDK returns it parsed, but a raw string is tolerated. */
  subjects?: unknown;
  total_questions?: number | string | null;
  duration_minutes?: number | string | null;
  section_total_marks?: number | string | null;
  display_order?: number | string | null;
}

const EXAM_READ_OPTIONS = {
  shared: true,
  orderBy: { column: 'id', direction: 'asc' as const },
};

const SECTION_READ_OPTIONS = {
  shared: true,
  orderBy: { column: 'display_order', direction: 'asc' as const },
};

const EMPTY_EXAMS: ExamRegistryRow[] = [];
const EMPTY_SECTIONS: ExamSectionRegistryRow[] = [];

export interface ExamRegistryCatalog {
  /** Active exams only, in registry order. */
  rows: ExamRegistryRow[];
  byId: Map<string, ExamRegistryRow>;
  loading: boolean;
  refresh: () => void;
}

/** Every active exam in the registry, indexed by id. Safe on an empty table. */
export function useExamRegistry(): ExamRegistryCatalog {
  const query = useAllRows<ExamRegistryRow>(TABLES.examRegistry, EXAM_READ_OPTIONS);
  const rows = useMemo(() => {
    const all = query.data ?? EMPTY_EXAMS;
    const active = all.filter(
      (row) => row && typeof row.id === 'string' && (row.id ?? '').trim() && row.is_active !== false,
    );
    return active.length > 0 ? active : EMPTY_EXAMS;
  }, [query.data]);
  const byId = useMemo(() => {
    const index = new Map<string, ExamRegistryRow>();
    for (const row of rows) index.set((row.id ?? '').trim(), row);
    return index;
  }, [rows]);
  return useMemo(
    () => ({ rows, byId, loading: query.loading, refresh: query.refresh }),
    [rows, byId, query.loading, query.refresh],
  );
}

export interface ExamSectionCatalog {
  rows: ExamSectionRegistryRow[];
  /** exam_id → that exam's sections, already sorted by display_order. */
  byExamId: Map<string, ExamSectionRegistryRow[]>;
  loading: boolean;
}

/**
 * Every section row, bucketed per exam. The whole table is under a hundred
 * rows, so it is read once and grouped here rather than re-queried whenever
 * the student's exam changes.
 */
export function useExamSectionRegistry(): ExamSectionCatalog {
  const query = useAllRows<ExamSectionRegistryRow>(TABLES.examSections, SECTION_READ_OPTIONS);
  const rows = query.data ?? EMPTY_SECTIONS;
  const byExamId = useMemo(() => {
    const index = new Map<string, ExamSectionRegistryRow[]>();
    for (const row of rows) {
      const examId = String(row?.exam_id ?? '').trim();
      if (!examId) continue;
      const bucket = index.get(examId);
      if (bucket) bucket.push(row);
      else index.set(examId, [row]);
    }
    for (const bucket of index.values()) {
      bucket.sort((a, b) => sectionOrder(a) - sectionOrder(b));
    }
    return index;
  }, [rows]);
  return useMemo(() => ({ rows, byExamId, loading: query.loading }), [rows, byExamId, query.loading]);
}

function sectionOrder(section: ExamSectionRegistryRow): number {
  const value = Number(section.display_order);
  return Number.isFinite(value) ? value : 0;
}

function toCount(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

/** The `subjects` json column, however the driver hands it back. */
export function sectionSubjects(raw: unknown): string[] {
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

/** The section shape written to the profile's `exam_sections` meta row. */
export interface ExamSectionSummary {
  name: string;
  subjects: string[];
  questions: number | null;
  marks: number | null;
  minutes: number | null;
}

/** Registry rows reduced to the facts worth keeping on the student's profile. */
export function summarizeSections(sections: ExamSectionRegistryRow[]): ExamSectionSummary[] {
  return sections
    .map((section) => ({
      name: String(section.section_name ?? '').trim(),
      subjects: sectionSubjects(section.subjects),
      questions: toCount(section.total_questions),
      marks: toCount(section.section_total_marks),
      minutes: toCount(section.duration_minutes),
    }))
    .filter((section) => section.name || section.subjects.length > 0);
}

/**
 * The exam's sections as the `ExamSubject[]` shape the planner already
 * consumes: one subject per distinct subject name, and the paper it sits in
 * as that subject's chapter. Topics are left empty — the registry describes
 * the exam's STRUCTURE, not its syllabus, and inventing chapter contents here
 * would put words in the examining body's mouth.
 */
export function sectionsToExamSubjects(sections: ExamSectionRegistryRow[]): ExamSubject[] {
  const bySubject = new Map<string, { name: string; chapters: string[] }>();
  for (const section of sections) {
    const paper = String(section.section_name ?? '').trim();
    const named = sectionSubjects(section.subjects);
    const subjectNames = named.length > 0 ? named : paper ? [paper] : [];
    for (const subjectName of subjectNames) {
      const key = subjectName.toLowerCase();
      const entry = bySubject.get(key) ?? { name: subjectName, chapters: [] };
      // A single-subject paper is usually named after the subject itself —
      // repeating it as the chapter reads as a duplicate, so keep one label.
      const chapter = paper && paper.toLowerCase() !== key ? paper : subjectName;
      if (!entry.chapters.includes(chapter)) entry.chapters.push(chapter);
      bySubject.set(key, entry);
    }
  }
  return Array.from(bySubject.values()).map((entry) => ({
    name: entry.name,
    chapters: entry.chapters.map((name) => ({ name, topics: [] })),
  }));
}

/** How an exam is titled on screen — short name first, then the official one. */
export function registryExamLabel(row: ExamRegistryRow | null | undefined): string {
  if (!row) return 'Your exam';
  return (row.short_name || '').trim() || (row.full_name || '').trim() || row.id;
}
