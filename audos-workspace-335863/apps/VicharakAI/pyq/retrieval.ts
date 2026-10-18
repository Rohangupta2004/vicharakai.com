/**
 * PYQ retrieval — the ONLY read path the app uses for previous-year questions.
 *
 * EVERY query here filters origin_type = 'official_pyq' AND
 * verification_status != 'rejected', and confirmed duplicates are excluded —
 * an AI-generated variant or a rejected/duplicate row can never surface as a
 * PYQ. Answers are NOT included in getPYQs(): the student must explicitly
 * request one via getPYQAnswer().
 *
 * Sort order: verified questions first, then year DESC.
 * If window.__workspaceDb is unavailable, every function returns []/null/0
 * gracefully — never throws at the caller.
 */
import {
  PYQ_TABLES,
  pyqClient,
  pyqSelect,
  pyqSelectAll,
  pyqTotal,
  type PYQAnswerRow,
  type PYQChapterRow,
  type PYQConceptRow,
  type PYQExamRow,
  type PYQExamYearRow,
  type PYQFilter,
  type PYQOptionRow,
  type PYQQuestionRow,
  type PYQSubjectRow,
  type PYQTopicRow,
} from './pyqDb';
import type { ExamInfo, PYQAnswer, PYQQuery, PYQResult, ProgressReport, SubjectInfo, TopicInfo } from './types';

/** How many matching rows are scanned before sorting/paging client-side. */
const SCAN_CAP = 600;

/**
 * Map the student's profile exam id onto a pyq_exams.code. Returns null when
 * no PYQ exam covers it (retrieval then honestly returns nothing).
 */
export function pyqExamCodeForProfileExam(profileExam: string | null | undefined): string | null {
  const raw = String(profileExam ?? '').trim().toLowerCase();
  if (!raw) return null;
  const known = [
    'neet_ug', 'neet_pg', 'jee_main', 'jee_advanced', 'upsc_cse', 'mpsc', 'cat',
    // US exams (added with the open-dataset seeding). Their bank rows are
    // origin_type 'practice', so THIS official-PYQ-only surface honestly
    // returns nothing for them — the Practice tab serves them instead.
    'mcat', 'usmle', 'gre', 'lsat', 'sat', 'bar_exam',
  ];
  if (known.includes(raw)) return raw;
  if (raw.includes('usmle')) return 'usmle';
  if (raw.includes('neet') && raw.includes('pg')) return 'neet_pg';
  if (raw.includes('neet')) return 'neet_ug';
  if (raw.includes('jee') && (raw.includes('adv') || raw.includes('advanced'))) return 'jee_advanced';
  if (raw.includes('jee')) return 'jee_main';
  if (raw.includes('upsc') || raw.includes('cse') || raw.includes('ias')) return 'upsc_cse';
  if (raw.includes('mpsc')) return 'mpsc';
  if (raw === 'cat' || raw.includes('cat_') || raw.startsWith('cat')) return 'cat';
  return null;
}

interface QuestionContext {
  exams: Map<string, PYQExamRow>;
  years: Map<string, PYQExamYearRow>;
}

async function loadContext(): Promise<QuestionContext> {
  const [exams, years] = await Promise.all([
    pyqSelectAll<PYQExamRow>(PYQ_TABLES.exams),
    pyqSelectAll<PYQExamYearRow>(PYQ_TABLES.examYears),
  ]);
  return {
    exams: new Map(exams.map((row) => [row.id, row])),
    years: new Map(years.map((row) => [row.id, row])),
  };
}

async function nameById<T extends { id: string; name: string }>(
  table: string,
  id: string | null,
  cache: Map<string, string | undefined>,
): Promise<string | undefined> {
  if (!id) return undefined;
  if (cache.has(id)) return cache.get(id);
  const rows = await pyqSelect<T>(table, { filters: [{ column: 'id', operator: 'eq', value: id }], limit: 1 });
  const name = rows[0]?.name;
  cache.set(id, name);
  return name;
}

const subjectNameCache = new Map<string, string | undefined>();
const chapterNameCache = new Map<string, string | undefined>();
const topicNameCache = new Map<string, string | undefined>();
const conceptNameCache = new Map<string, string | undefined>();

async function toResult(row: PYQQuestionRow, context: QuestionContext): Promise<PYQResult> {
  const exam = row.exam_id ? context.exams.get(row.exam_id) : undefined;
  const yearRow = row.exam_year_id ? context.years.get(row.exam_year_id) : undefined;
  const [subjectName, chapterName, topicName, conceptName, options] = await Promise.all([
    nameById<PYQSubjectRow>(PYQ_TABLES.subjects, row.subject_id, subjectNameCache),
    nameById<PYQChapterRow>(PYQ_TABLES.chapters, row.chapter_id, chapterNameCache),
    nameById<PYQTopicRow>(PYQ_TABLES.topics, row.topic_id, topicNameCache),
    nameById<PYQConceptRow>(PYQ_TABLES.concepts, row.concept_id, conceptNameCache),
    pyqSelectAll<PYQOptionRow>(PYQ_TABLES.options, {
      filters: [{ column: 'question_id', operator: 'eq', value: row.id }],
      orderBy: { column: 'option_key', direction: 'asc' },
    }),
  ]);
  const questionType = row.question_type === 'integer' || row.question_type === 'subjective' ? row.question_type : 'mcq';
  const verification =
    row.verification_status === 'verified' || row.verification_status === 'flagged' || row.verification_status === 'rejected'
      ? row.verification_status
      : 'unverified';
  return {
    id: row.id,
    examCode: exam?.code ?? '',
    examName: exam?.name ?? '',
    year: Number(yearRow?.year ?? 0),
    session: row.session ?? undefined,
    subjectName,
    chapterName,
    topicName,
    conceptName,
    questionText: row.question_text,
    questionType,
    // NOTE: deliberately no is_correct here — answers only via getPYQAnswer().
    options: options.map((option) => ({ key: option.option_key, text: option.option_text })),
    verificationStatus: verification,
    difficulty: row.difficulty ?? undefined,
    marks: row.marks !== null && row.marks !== undefined ? Number(row.marks) : undefined,
  };
}

interface BuiltFilters {
  filters: PYQFilter[];
  /** When the query names years, the allowed exam_year_id set (else null). */
  yearIds: string[] | null;
  /** False when a named examCode/year cannot match anything. */
  possible: boolean;
}

async function buildFilters(query: PYQQuery, context: QuestionContext): Promise<BuiltFilters> {
  const filters: PYQFilter[] = [
    { column: 'origin_type', operator: 'eq', value: 'official_pyq' },
  ];
  const status = query.verificationStatus ?? 'all';
  if (status === 'verified') filters.push({ column: 'verification_status', operator: 'eq', value: 'verified' });
  else if (status === 'unverified') filters.push({ column: 'verification_status', operator: 'eq', value: 'unverified' });
  else filters.push({ column: 'verification_status', operator: 'neq', value: 'rejected' });

  let examId: string | null = null;
  if (query.examCode) {
    const exam = [...context.exams.values()].find((row) => row.code === query.examCode);
    if (!exam) return { filters, yearIds: null, possible: false };
    examId = exam.id;
    filters.push({ column: 'exam_id', operator: 'eq', value: exam.id });
  }
  if (query.subjectId) filters.push({ column: 'subject_id', operator: 'eq', value: query.subjectId });
  if (query.chapterId) filters.push({ column: 'chapter_id', operator: 'eq', value: query.chapterId });
  if (query.topicId) filters.push({ column: 'topic_id', operator: 'eq', value: query.topicId });
  if (query.conceptId) filters.push({ column: 'concept_id', operator: 'eq', value: query.conceptId });
  if (query.difficulty) filters.push({ column: 'difficulty', operator: 'eq', value: query.difficulty });

  let yearIds: string[] | null = null;
  if (query.year !== undefined) {
    const wanted = new Set((Array.isArray(query.year) ? query.year : [query.year]).map(Number));
    yearIds = [...context.years.values()]
      .filter((row) => wanted.has(Number(row.year)) && (examId === null || row.exam_id === examId))
      .map((row) => row.id);
    if (yearIds.length === 0) return { filters, yearIds, possible: false };
    if (yearIds.length === 1) {
      filters.push({ column: 'exam_year_id', operator: 'eq', value: yearIds[0] });
      yearIds = null; // already narrowed server-side
    }
  }
  return { filters, yearIds, possible: true };
}

function excludeAndOrder(rows: PYQQuestionRow[], query: PYQQuery, context: QuestionContext): PYQQuestionRow[] {
  const excluded = new Set(query.excludeQuestionIds ?? []);
  const kept = rows.filter(
    (row) => !excluded.has(row.id) && row.duplicate_review_status !== 'confirmed_duplicate' && !row.is_duplicate_of,
  );
  return kept.sort((a, b) => {
    const aVerified = a.verification_status === 'verified' ? 0 : 1;
    const bVerified = b.verification_status === 'verified' ? 0 : 1;
    if (aVerified !== bVerified) return aVerified - bVerified;
    const aYear = Number(context.years.get(a.exam_year_id ?? '')?.year ?? 0);
    const bYear = Number(context.years.get(b.exam_year_id ?? '')?.year ?? 0);
    return bYear - aYear;
  });
}

/** Retrieve PYQs. Verified first, then year DESC. Answers never included. */
export async function getPYQs(query: PYQQuery): Promise<PYQResult[]> {
  try {
    if (!pyqClient()) return [];
    const context = await loadContext();
    const built = await buildFilters(query ?? {}, context);
    if (!built.possible) return [];
    let rows = await pyqSelect<PYQQuestionRow>(PYQ_TABLES.questions, {
      filters: built.filters,
      orderBy: { column: 'import_timestamp', direction: 'desc' },
      limit: SCAN_CAP,
    });
    if (built.yearIds) {
      const allowed = new Set(built.yearIds);
      rows = rows.filter((row) => row.exam_year_id !== null && allowed.has(row.exam_year_id));
    }
    const ordered = excludeAndOrder(rows, query ?? {}, context);
    const offset = Math.max(0, query?.offset ?? 0);
    const limit = Math.max(1, Math.min(query?.limit ?? 20, 100));
    const page = ordered.slice(offset, offset + limit);
    return await Promise.all(page.map((row) => toResult(row, context)));
  } catch (error) {
    console.warn('[pyq] getPYQs failed', error);
    return [];
  }
}

/** One PYQ by id — still guarded by the origin/verification filters. */
export async function getPYQById(id: string): Promise<PYQResult | null> {
  try {
    if (!pyqClient() || !id) return null;
    const rows = await pyqSelect<PYQQuestionRow>(PYQ_TABLES.questions, {
      filters: [
        { column: 'id', operator: 'eq', value: id },
        { column: 'origin_type', operator: 'eq', value: 'official_pyq' },
        { column: 'verification_status', operator: 'neq', value: 'rejected' },
      ],
      limit: 1,
    });
    if (rows.length === 0) return null;
    const context = await loadContext();
    return await toResult(rows[0], context);
  } catch (error) {
    console.warn('[pyq] getPYQById failed', error);
    return null;
  }
}

/** The verified answer for one question — only on explicit request. */
export async function getPYQAnswer(questionId: string): Promise<PYQAnswer | null> {
  try {
    if (!pyqClient() || !questionId) return null;
    const rows = await pyqSelect<PYQAnswerRow>(PYQ_TABLES.answers, {
      filters: [{ column: 'question_id', operator: 'eq', value: questionId }],
      limit: 1,
    });
    const row = rows[0];
    if (!row) return null;
    return {
      questionId: row.question_id,
      correctOptionKey: row.correct_option_key ?? undefined,
      correctValue: row.correct_value ?? undefined,
      sourceType: row.source_type ?? 'inferred',
      sourceUrl: row.source_url ?? undefined,
    };
  } catch (error) {
    console.warn('[pyq] getPYQAnswer failed', error);
    return null;
  }
}

/** Count of questions matching the query (same guards as getPYQs). */
export async function getPYQCount(query: PYQQuery): Promise<number> {
  try {
    if (!pyqClient()) return 0;
    const context = await loadContext();
    const built = await buildFilters(query ?? {}, context);
    if (!built.possible) return 0;
    if (!built.yearIds) return await pyqTotal(PYQ_TABLES.questions, built.filters);
    const rows = await pyqSelect<PYQQuestionRow>(PYQ_TABLES.questions, {
      filters: built.filters,
      limit: SCAN_CAP,
      columns: ['id', 'exam_year_id', 'verification_status', 'duplicate_review_status', 'is_duplicate_of'],
    });
    const allowed = new Set(built.yearIds);
    return rows.filter((row) => row.exam_year_id !== null && allowed.has(row.exam_year_id)).length;
  } catch (error) {
    console.warn('[pyq] getPYQCount failed', error);
    return 0;
  }
}

/** Active exams with their retrievable question counts. */
export async function getPYQExams(): Promise<ExamInfo[]> {
  try {
    if (!pyqClient()) return [];
    const exams = await pyqSelectAll<PYQExamRow>(PYQ_TABLES.exams, {
      filters: [{ column: 'is_active', operator: 'eq', value: true }],
      orderBy: { column: 'name', direction: 'asc' },
    });
    return await Promise.all(
      exams.map(async (exam) => ({
        id: exam.id,
        name: exam.name,
        code: exam.code,
        country: exam.country,
        category: exam.category ?? undefined,
        questionCount: await pyqTotal(PYQ_TABLES.questions, [
          { column: 'exam_id', operator: 'eq', value: exam.id },
          { column: 'origin_type', operator: 'eq', value: 'official_pyq' },
          { column: 'verification_status', operator: 'neq', value: 'rejected' },
        ]),
      })),
    );
  } catch (error) {
    console.warn('[pyq] getPYQExams failed', error);
    return [];
  }
}

/** Subjects of one exam (by exam code). */
export async function getPYQSubjects(examCode: string): Promise<SubjectInfo[]> {
  try {
    if (!pyqClient() || !examCode) return [];
    const exams = await pyqSelect<PYQExamRow>(PYQ_TABLES.exams, {
      filters: [{ column: 'code', operator: 'eq', value: examCode }],
      limit: 1,
    });
    if (exams.length === 0) return [];
    const subjects = await pyqSelectAll<PYQSubjectRow>(PYQ_TABLES.subjects, {
      filters: [{ column: 'exam_id', operator: 'eq', value: exams[0].id }],
      orderBy: { column: 'name', direction: 'asc' },
    });
    return subjects.map((row) => ({ id: row.id, name: row.name, code: row.code }));
  } catch (error) {
    console.warn('[pyq] getPYQSubjects failed', error);
    return [];
  }
}

/** Topics of one subject. */
export async function getPYQTopics(subjectId: string): Promise<TopicInfo[]> {
  try {
    if (!pyqClient() || !subjectId) return [];
    const topics = await pyqSelectAll<PYQTopicRow>(PYQ_TABLES.topics, {
      filters: [{ column: 'subject_id', operator: 'eq', value: subjectId }],
      orderBy: { column: 'name', direction: 'asc' },
    });
    return topics.map((row) => ({ id: row.id, name: row.name }));
  } catch (error) {
    console.warn('[pyq] getPYQTopics failed', error);
    return [];
  }
}

/** Exam-year progress report (pyq_exam_years joined with pyq_exams). */
export async function getIngestionProgress(): Promise<ProgressReport[]> {
  try {
    if (!pyqClient()) return [];
    const [exams, years] = await Promise.all([
      pyqSelectAll<PYQExamRow>(PYQ_TABLES.exams),
      pyqSelectAll<PYQExamYearRow>(PYQ_TABLES.examYears),
    ]);
    const examById = new Map(exams.map((row) => [row.id, row]));
    return years
      .map((row) => ({
        exam: (row.exam_id ? examById.get(row.exam_id)?.name : undefined) ?? 'Unknown exam',
        year: Number(row.year),
        status: row.status ?? 'pending',
        imported: Number(row.imported_questions ?? 0),
        verified: Number(row.verified_questions ?? 0),
        total: Number(row.total_questions ?? 0),
      }))
      .sort((a, b) => (a.exam === b.exam ? b.year - a.year : a.exam.localeCompare(b.exam)));
  } catch (error) {
    console.warn('[pyq] getIngestionProgress failed', error);
    return [];
  }
}
