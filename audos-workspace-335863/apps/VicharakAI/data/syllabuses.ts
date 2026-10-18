/**
 * The exam-syllabus database — 30 exams across India, the USA, the UK and
 * Asia, embedded as typed constants so browsing works offline and instantly.
 *
 * Structure: ExamSyllabus → SyllabusSubject → SyllabusChapter → topics[],
 * with stable ids at every level (see data/syllabusTypes.ts). The adaptation
 * engine (../adaptationEngine.ts) stores those ids in zuno_exam_progress,
 * zuno_topic_attempts, zuno_weak_topics and zuno_readiness.
 */
import {
  examChapters,
  examSyllabusTopicCount,
  syllabusSlug,
  topicIdFor,
  type ChapterWeightage,
  type ExamSyllabus,
  type ExamSyllabusCategory,
  type SyllabusChapter,
  type SyllabusSubject,
} from './syllabusTypes';
import { JEE_ADVANCED, JEE_MAIN } from './examsIndiaEngineering';
import { FMGE, INICET, NEET_PG, NEET_UG } from './examsIndiaMedical';
import { AFCAT, CDS, MPSC, NDA, UPSC_CSE } from './examsIndiaCivilDefence';
import { CAT, CA_FINAL, CFA_LEVEL_1, CLAT, SSC_CGL } from './examsIndiaProfessional';
import {
  ACT,
  GAOKAO,
  GMAT_FOCUS,
  GRE_GENERAL,
  LNAT,
  MCAT,
  SAT,
  STEP,
  SUNEUNG,
  TMUA,
  TOPIK_II,
  UCAT,
  USMLE_STEP_1,
  USMLE_STEP_2_CK,
} from './examsGlobal';

export type { ChapterWeightage, ExamSyllabus, ExamSyllabusCategory, SyllabusChapter, SyllabusSubject };
export { examChapters, examSyllabusTopicCount, syllabusSlug, topicIdFor };

/** Every exam in the database, grouped roughly by region. */
export const EXAM_SYLLABUSES: ExamSyllabus[] = [
  // India — Engineering
  JEE_MAIN,
  JEE_ADVANCED,
  // India — Medical
  NEET_UG,
  NEET_PG,
  INICET,
  FMGE,
  // India — Civil Services
  UPSC_CSE,
  MPSC,
  // India — Defence
  AFCAT,
  NDA,
  CDS,
  // India — MBA / Law / Finance / Staff Selection
  CAT,
  CLAT,
  CA_FINAL,
  CFA_LEVEL_1,
  SSC_CGL,
  // Global — Medical
  USMLE_STEP_1,
  USMLE_STEP_2_CK,
  MCAT,
  UCAT,
  // Global — Business / Postgraduate
  GMAT_FOCUS,
  GRE_GENERAL,
  // Global — Undergraduate
  SAT,
  ACT,
  // UK
  LNAT,
  STEP,
  TMUA,
  // Asia
  GAOKAO,
  SUNEUNG,
  TOPIK_II,
];

export function getSyllabus(examId: string | null | undefined): ExamSyllabus | undefined {
  if (!examId) return undefined;
  return EXAM_SYLLABUSES.find((exam) => exam.id === examId);
}

/** Find one chapter (with its subject) by chapter id, across one exam. */
export function findChapter(
  exam: ExamSyllabus,
  chapterId: string,
): { subject: SyllabusSubject; chapter: SyllabusChapter } | undefined {
  for (const subject of exam.subjects) {
    const chapter = subject.chapters.find((c) => c.id === chapterId);
    if (chapter) return { subject, chapter };
  }
  return undefined;
}

/**
 * The app's planner exam ids (zuno_profile.exam — see ../syllabus.ts and
 * ../examCatalog.ts) mapped onto this database's exam ids, so the chat pill,
 * Exam Insights and the Syllabus Browser default to the student's own exam.
 */
const PROFILE_EXAM_TO_SYLLABUS: Record<string, string> = {
  jee: 'jee_main',
  'jee-advanced': 'jee_advanced',
  neet: 'neet_ug',
  upsc: 'upsc_cse',
  cat: 'cat',
  ssc: 'ssc_cgl',
  clat: 'clat',
  nda: 'nda',
  sat: 'sat',
  act: 'act',
  gre: 'gre_general',
  gmat: 'gmat_focus',
  mcat: 'mcat',
  ucat: 'ucat',
  lnat: 'lnat',
  usmle: 'usmle_step_1',
  gaokao: 'gaokao',
  'csat-kr': 'suneung',
};

/**
 * Resolve the student's planner exam id (including `custom:` typed exams) to
 * the closest exam in this database, falling back to a fuzzy name match and
 * then undefined when nothing fits.
 */
export function syllabusForProfileExam(profileExamId: string | null | undefined): ExamSyllabus | undefined {
  if (!profileExamId) return undefined;
  const direct = PROFILE_EXAM_TO_SYLLABUS[profileExamId];
  if (direct) return getSyllabus(direct);
  const exact = getSyllabus(profileExamId);
  if (exact) return exact;
  // Fuzzy: a typed exam like `custom:neet-pg` or `custom:cfa-level-1` still
  // finds its structured syllabus by slug overlap.
  const slug = syllabusSlug(profileExamId.replace(/^custom:/, ''));
  if (!slug) return undefined;
  return EXAM_SYLLABUSES.find((exam) => {
    const examSlug = syllabusSlug(exam.name);
    return (
      exam.id === slug ||
      examSlug === slug ||
      slug.includes(exam.id) ||
      exam.id.includes(slug) ||
      slug.includes(examSlug) ||
      examSlug.includes(slug)
    );
  });
}

/** Countries present in the database, for browser filter chips. */
export function syllabusCountries(): string[] {
  return Array.from(new Set(EXAM_SYLLABUSES.map((exam) => exam.country)));
}

/** Categories present in the database, for browser filter chips. */
export function syllabusCategories(): ExamSyllabusCategory[] {
  return Array.from(new Set(EXAM_SYLLABUSES.map((exam) => exam.category)));
}
