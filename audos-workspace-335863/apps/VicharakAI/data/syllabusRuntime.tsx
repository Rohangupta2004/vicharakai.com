/**
 * Runtime syllabus catalogue.
 *
 * Official rows synchronized into exam_syllabi replace the embedded tree for
 * the same exam. Exams with no synchronized rows continue to use the existing
 * hardcoded catalogue, so a scraper outage can never empty the app.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAllRows } from '../services/database/dbClient';
import { TABLES } from '../services/database/tables';
import { EXTRA_EXAMS } from '../examCatalog';
import { EXAM_SYLLABUSES, syllabusSlug } from './syllabuses';
import type { ExamSyllabus, ExamSyllabusCategory, SyllabusSubject } from './syllabusTypes';

export const EXAM_SYLLABI_TABLE = TABLES.examSyllabi;
export const SYLLABI_SYNCED_EVENT = 'vicharak:syllabi-synced';

export interface ExamSyllabusDbRow {
  id: number;
  exam_id: string;
  subject: string;
  topic: string;
  subtopic: string;
  source_url: string;
  scraped_at: string;
}

interface ExamMeta {
  name: string;
  country: string;
  category: ExamSyllabusCategory;
}

const EXTRA_META: Record<string, ExamMeta> = {
  rrb_ntpc: { name: 'RRB NTPC', country: 'India', category: 'Staff Selection' },
  ibps_po_clerk: { name: 'IBPS PO / Clerk', country: 'India', category: 'Staff Selection' },
  nda_cds: { name: 'NDA / CDS', country: 'India', category: 'Defence' },
  gate_cs: { name: 'GATE Computer Science', country: 'India', category: 'Engineering' },
  lsat: { name: 'LSAT', country: 'USA', category: 'Law' },
  a_levels: { name: 'A-Levels', country: 'UK', category: 'Undergraduate' },
  gamsat: { name: 'GAMSAT', country: 'Australia', category: 'Medical' },
};

const SOURCE_URLS: Record<string, string> = {
  jee_main: 'https://jeemain.nta.nic.in/',
  jee_advanced: 'https://jeeadv.ac.in/',
  neet_ug: 'https://neet.nta.nic.in/',
  neet_pg: 'https://natboard.edu.in/viewnbeexam?exam=neetpg',
  inicet: 'https://www.aiimsexams.ac.in/',
  upsc_cse: 'https://upsc.gov.in/examinations/active-examinations',
  mpsc: 'https://mpsc.gov.in/',
  cat: 'https://iimcat.ac.in/',
  clat: 'https://consortiumofnlus.ac.in/clat-2026/ug-syllabus.html',
  ssc_cgl: 'https://ssc.gov.in/',
  rrb_ntpc: 'https://www.rrbapply.gov.in/',
  ibps_po_clerk: 'https://www.ibps.in/',
  nda_cds: 'https://upsc.gov.in/examinations/active-examinations',
  gate_cs: 'https://gate2025.iitr.ac.in/exam-papers-and-syllabus.html',
  mcat: 'https://students-residents.aamc.org/prepare-mcat-exam/whats-mcat-exam',
  gre_general: 'https://www.ets.org/gre/test-takers/general-test/prepare/content.html',
  gmat_focus: 'https://www.mba.com/exams/gmat-exam/about/exam-content',
  lsat: 'https://www.lsac.org/lsat/about/types-lsat-questions',
  usmle_step_1: 'https://www.usmle.org/prepare-your-exam/step-1-materials',
  sat: 'https://satsuite.collegeboard.org/sat/whats-on-the-test',
  act: 'https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/description-of-the-act.html',
  a_levels: 'https://www.aqa.org.uk/subjects',
  ucat: 'https://www.ucat.ac.uk/about-ucat/test-format/',
  gamsat: 'https://gamsat.acer.org/prepare',
  lnat: 'https://lnat.ac.uk/what-is-lnat/what-does-it-test/',
};

export const SYNC_EXAM_IDS = Object.keys(SOURCE_URLS);

function metaFor(examId: string): ExamMeta {
  const embedded = EXAM_SYLLABUSES.find((exam) => exam.id === examId);
  if (embedded) return { name: embedded.name, country: embedded.country, category: embedded.category };
  return EXTRA_META[examId] ?? {
    name: examId.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    country: 'Global',
    category: 'Postgraduate',
  };
}

function runtimeExam(examId: string, rows: ExamSyllabusDbRow[]): ExamSyllabus | null {
  const bySubject = new Map<string, Map<string, string[]>>();
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const subject = String(row.subject || '').trim();
    const topic = String(row.topic || '').trim();
    const subtopic = String(row.subtopic || '').trim();
    if (!subject || !topic || !subtopic) continue;
    const topics = bySubject.get(subject) ?? new Map<string, string[]>();
    const subtopics = topics.get(topic) ?? [];
    if (!subtopics.some((value) => value.toLowerCase() === subtopic.toLowerCase())) subtopics.push(subtopic);
    topics.set(topic, subtopics);
    bySubject.set(subject, topics);
  }
  if (bySubject.size === 0) return null;
  const subjects: SyllabusSubject[] = Array.from(bySubject.entries()).map(([subjectName, topics]) => {
    const subjectId = `${examId}_${syllabusSlug(subjectName)}`;
    return {
      id: subjectId,
      name: subjectName,
      chapters: Array.from(topics.entries()).map(([topicName, subtopics]) => ({
        id: `${subjectId}_${syllabusSlug(topicName)}`,
        name: topicName,
        topics: subtopics,
      })),
    };
  });
  const meta = metaFor(examId);
  return { id: examId, ...meta, subjects };
}

export function mergeSyllabusRows(rows: ExamSyllabusDbRow[]): ExamSyllabus[] {
  if (!rows.length) return EXAM_SYLLABUSES;
  const grouped = new Map<string, ExamSyllabusDbRow[]>();
  for (const row of rows) {
    const examId = String(row.exam_id || '').trim();
    if (!examId) continue;
    const list = grouped.get(examId) ?? [];
    list.push(row);
    grouped.set(examId, list);
  }
  const replacements = new Map<string, ExamSyllabus>();
  for (const [examId, examRows] of grouped) {
    const exam = runtimeExam(examId, examRows);
    if (exam) replacements.set(examId, exam);
  }
  const merged = EXAM_SYLLABUSES.map((exam) => replacements.get(exam.id) ?? exam);
  for (const [examId, exam] of replacements) {
    if (!EXAM_SYLLABUSES.some((embedded) => embedded.id === examId)) merged.push(exam);
  }
  return merged;
}

export function getCatalogSyllabus(exams: ExamSyllabus[], examId: string | null | undefined): ExamSyllabus | undefined {
  return examId ? exams.find((exam) => exam.id === examId) : undefined;
}

const PROFILE_ALIASES: Record<string, string> = {
  jee: 'jee_main',
  'jee-advanced': 'jee_advanced',
  neet: 'neet_ug',
  upsc: 'upsc_cse',
  ssc: 'ssc_cgl',
  gre: 'gre_general',
  gmat: 'gmat_focus',
  usmle: 'usmle_step_1',
  'a-levels': 'a_levels',
};

export function syllabusForProfileFromCatalog(
  exams: ExamSyllabus[],
  profileExamId: string | null | undefined,
): ExamSyllabus | undefined {
  if (!profileExamId) return undefined;
  const direct = getCatalogSyllabus(exams, PROFILE_ALIASES[profileExamId] ?? profileExamId);
  if (direct) return direct;
  const slug = syllabusSlug(profileExamId.replace(/^custom:/, ''));
  return exams.find((exam) => {
    const examSlug = syllabusSlug(exam.name);
    return exam.id === slug || examSlug === slug || slug.includes(exam.id) || exam.id.includes(slug) ||
      slug.includes(examSlug) || examSlug.includes(slug);
  });
}

interface CatalogContextValue {
  exams: ExamSyllabus[];
  /**
   * Exam ids that actually have synchronized rows in exam_syllabi. Everything
   * else in `exams` is the app's embedded outline, which is what the AI
   * planner needs to know before it decides whether to trust the wording or
   * top it up from its own knowledge of the course.
   */
  syncedExamIds: string[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const CatalogContext = createContext<CatalogContextValue>({
  exams: EXAM_SYLLABUSES,
  syncedExamIds: [],
  loading: false,
  error: null,
  refresh: () => undefined,
});

export function SyllabusCatalogProvider({ children }: { children: ReactNode }) {
  const query = useAllRows<ExamSyllabusDbRow>(EXAM_SYLLABI_TABLE, {
    shared: true,
    orderBy: { column: 'id', direction: 'asc' },
  });
  const exams = useMemo(() => mergeSyllabusRows(query.data ?? []), [query.data]);
  const syncedExamIds = useMemo(
    () =>
      Array.from(
        new Set(
          (query.data ?? [])
            .map((row) => String(row.exam_id || '').trim())
            .filter(Boolean),
        ),
      ),
    [query.data],
  );
  useEffect(() => {
    const refresh = () => query.refresh();
    window.addEventListener(SYLLABI_SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYLLABI_SYNCED_EVENT, refresh);
  }, [query.refresh]);
  /* PERF: a stable context value — catalog consumers (StudentDataProvider,
   * screens) re-render only when the catalog itself changes. */
  const value = useMemo(
    () => ({ exams, syncedExamIds, loading: query.loading, error: query.error, refresh: query.refresh }),
    [exams, syncedExamIds, query.loading, query.error, query.refresh],
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useSyllabusCatalog(): CatalogContextValue {
  return useContext(CatalogContext);
}

interface FallbackRow {
  subject: string;
  topic: string;
  subtopic: string;
  source_url: string;
}

function rowsFromExam(examId: string, exam: ExamSyllabus): FallbackRow[] {
  const source_url = SOURCE_URLS[examId] ?? '';
  return exam.subjects.flatMap((subject) =>
    subject.chapters.flatMap((chapter) => {
      const leaves = chapter.topics.length > 0 ? chapter.topics : [chapter.name];
      return leaves.map((subtopic) => ({ subject: subject.name, topic: chapter.name, subtopic, source_url }));
    }),
  );
}

function rowsFromPlannerExam(examId: string, plannerId: string): FallbackRow[] {
  const exam = EXTRA_EXAMS.find((entry) => entry.id === plannerId);
  if (!exam) return [];
  const source_url = SOURCE_URLS[examId] ?? '';
  return exam.subjects.flatMap((subject) =>
    subject.chapters.flatMap((chapter) => {
      const leaves = chapter.topics.length > 0 ? chapter.topics : [chapter.name];
      return leaves.map((subtopic) => ({ subject: subject.name, topic: chapter.name, subtopic, source_url }));
    }),
  );
}

const MANUAL_FALLBACKS: Record<string, Array<[string, string, string[]]>> = {
  rrb_ntpc: [
    ['General Awareness', 'General Awareness', ['Current events', 'Indian history and freedom struggle', 'Geography', 'Indian polity and governance', 'General science']],
    ['Mathematics', 'Arithmetic', ['Number system', 'Percentages', 'Ratio and proportion', 'Time and work', 'Time, speed and distance']],
    ['General Intelligence & Reasoning', 'Reasoning', ['Analogies', 'Coding and decoding', 'Syllogisms', 'Puzzles', 'Data sufficiency']],
  ],
  gamsat: [
    ['Section I', 'Reasoning in Humanities and Social Sciences', ['Comprehension and interpretation', 'Written and visual stimulus analysis', 'Logical inference', 'Author purpose and tone']],
    ['Section II', 'Written Communication', ['Task A argumentative writing', 'Task B reflective writing', 'Idea development', 'Structure and expression']],
    ['Section III', 'Reasoning in Biological and Physical Sciences', ['Biology reasoning', 'Chemistry reasoning', 'Physics reasoning', 'Data interpretation and experimental design']],
  ],
};

export function hardcodedFallbackByExam(): Record<string, FallbackRow[]> {
  const out: Record<string, FallbackRow[]> = {};
  for (const examId of SYNC_EXAM_IDS) {
    const embedded = EXAM_SYLLABUSES.find((exam) => exam.id === examId);
    if (embedded) out[examId] = rowsFromExam(examId, embedded);
  }
  out.ibps_po_clerk = rowsFromPlannerExam('ibps_po_clerk', 'ibps-po');
  out.gate_cs = rowsFromPlannerExam('gate_cs', 'gate');
  out.lsat = rowsFromPlannerExam('lsat', 'lsat');
  out.a_levels = rowsFromPlannerExam('a_levels', 'a-levels');
  const nda = EXAM_SYLLABUSES.find((exam) => exam.id === 'nda');
  const cds = EXAM_SYLLABUSES.find((exam) => exam.id === 'cds');
  out.nda_cds = [...(nda ? rowsFromExam('nda_cds', nda) : []), ...(cds ? rowsFromExam('nda_cds', cds) : [])];
  for (const [examId, groups] of Object.entries(MANUAL_FALLBACKS)) {
    const source_url = SOURCE_URLS[examId] ?? '';
    out[examId] = groups.flatMap(([subject, topic, subtopics]) =>
      subtopics.map((subtopic) => ({ subject, topic, subtopic, source_url })),
    );
  }
  return out;
}
