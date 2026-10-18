/**
 * PYQ data access — a thin, typed wrapper over the platform-injected
 * WorkspaceDB SDK (window.__workspaceDb).
 *
 * Every PYQ table is SHARED REFERENCE DATA (rows are written with the shared
 * scope so every student reads the same official question bank), so all reads
 * and writes here use `{ shared: true }`.
 *
 * This module deliberately does NOT extend the global Window declaration —
 * services/database/dbClient.ts already declares a narrower shape for the
 * student tables; the accessor below casts locally instead of conflicting.
 */
import { TABLES } from '../services/database/tables';

/** Central names of the PYQ tables (from the one table registry). */
export const PYQ_TABLES = {
  exams: TABLES.pyqExams,
  examYears: TABLES.pyqExamYears,
  subjects: TABLES.pyqSubjects,
  chapters: TABLES.pyqChapters,
  topics: TABLES.pyqTopics,
  concepts: TABLES.pyqConcepts,
  questions: TABLES.pyqQuestions,
  options: TABLES.pyqOptions,
  answers: TABLES.pyqAnswers,
  sources: TABLES.pyqSources,
  importBatches: TABLES.pyqImportBatches,
  duplicateCandidates: TABLES.pyqDuplicateCandidates,
} as const;

export interface PYQFilter {
  column: string;
  /** eq | neq | gt | gte | lt | lte | like | ilike */
  operator: string;
  value: unknown;
}

interface SdkQuery {
  where: (column: string, operator: string, value: unknown) => SdkQuery;
  orderBy: (column: string, direction: 'asc' | 'desc') => SdkQuery;
  limit: (n: number) => SdkQuery;
  offset: (n: number) => SdkQuery;
  select: (...columns: string[]) => SdkQuery;
  get: () => Promise<{ data: unknown[]; total?: number }>;
  insert: (row: Record<string, unknown>) => Promise<unknown>;
  update: (id: string | number, patch: Record<string, unknown>) => Promise<unknown>;
}

interface SdkClient {
  from: (table: string, options?: { shared?: boolean }) => SdkQuery;
}

/** The injected client, or null while the platform runtime is still loading. */
export function pyqClient(): SdkClient | null {
  if (typeof window === 'undefined') return null;
  const client = (window as unknown as { __workspaceDb?: SdkClient }).__workspaceDb;
  return client && typeof client.from === 'function' ? client : null;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

export interface PYQReadOptions {
  filters?: PYQFilter[];
  orderBy?: { column: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
  columns?: string[];
}

function buildQuery(table: string, options: PYQReadOptions): SdkQuery | null {
  const client = pyqClient();
  if (!client) return null;
  let query = client.from(table, { shared: true });
  if (options.columns && options.columns.length > 0) query = query.select(...options.columns);
  for (const filter of options.filters ?? []) {
    query = query.where(filter.column, filter.operator, filter.value);
  }
  const order = options.orderBy ?? { column: 'created_at', direction: 'asc' as const };
  return query.orderBy(order.column, order.direction);
}

/** One-page read (caller controls limit/offset). Returns [] with no client. */
export async function pyqSelect<T>(table: string, options: PYQReadOptions = {}): Promise<T[]> {
  const query = buildQuery(table, options);
  if (!query) return [];
  const { data } = await query
    .limit(Math.min(options.limit ?? PAGE_SIZE, PAGE_SIZE))
    .offset(options.offset ?? 0)
    .get();
  return data as T[];
}

/** Read every matching row, paging past the per-request cap. */
export async function pyqSelectAll<T>(table: string, options: PYQReadOptions = {}): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = buildQuery(table, options);
    if (!query) return rows;
    const { data } = await query.limit(PAGE_SIZE).offset(page * PAGE_SIZE).get();
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) return rows;
  }
  return rows;
}

/** Count of matching rows (server-reported total). 0 with no client. */
export async function pyqTotal(table: string, filters: PYQFilter[] = []): Promise<number> {
  const query = buildQuery(table, { filters });
  if (!query) return 0;
  const { data, total } = await query.limit(1).offset(0).get();
  return typeof total === 'number' ? total : data.length;
}

/** Insert one row into the workspace-shared scope. Throws with no client. */
export async function pyqInsertShared(table: string, row: Record<string, unknown>): Promise<void> {
  const client = pyqClient();
  if (!client) throw new Error('The data client is still loading — try again in a second.');
  await client.from(table, { shared: true }).insert(row);
}

/** Update one row by id. Throws with no client. */
export async function pyqUpdate(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const client = pyqClient();
  if (!client) throw new Error('The data client is still loading — try again in a second.');
  await client.from(table, { shared: true }).update(id, patch);
}

/** Client-generated UUID so child rows can reference a parent just inserted. */
export function pyqRandomId(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
  // RFC4122-ish fallback for older engines.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ---------- raw row shapes (as stored in WorkspaceDB) ---------- */

export interface PYQExamRow {
  id: string;
  name: string;
  code: string;
  country: string;
  category?: string | null;
  is_active?: boolean | null;
}

export interface PYQExamYearRow {
  id: string;
  exam_id: string | null;
  year: number;
  status: string | null;
  total_questions: number | null;
  imported_questions: number | null;
  verified_questions: number | null;
  source_url?: string | null;
  notes?: string | null;
}

export interface PYQSubjectRow { id: string; exam_id: string | null; name: string; code: string; }
export interface PYQChapterRow { id: string; subject_id: string | null; name: string; order_index: number | null; }
export interface PYQTopicRow { id: string; chapter_id: string | null; subject_id: string | null; name: string; }
export interface PYQConceptRow { id: string; topic_id: string | null; subject_id: string | null; name: string; }

export interface PYQQuestionRow {
  id: string;
  exam_id: string | null;
  exam_year_id: string | null;
  session: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  concept_id: string | null;
  question_text: string;
  question_text_normalized: string;
  question_type: string | null;
  difficulty: string | null;
  marks: number | string | null;
  negative_marks: number | string | null;
  language: string | null;
  verification_status: string | null;
  origin_type: string | null;
  is_duplicate_of: string | null;
  duplicate_review_status: string | null;
  import_batch_id: string | null;
  tags: unknown;
  import_timestamp: string | null;
  verification_timestamp: string | null;
}

export interface PYQOptionRow {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  is_correct: boolean | null;
}

export interface PYQAnswerRow {
  id: string;
  question_id: string;
  correct_option_key: string | null;
  correct_value: string | null;
  source_type: string | null;
  source_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface PYQSourceRow {
  id: string;
  question_id: string;
  source_type: string | null;
  source_url: string | null;
  source_name: string | null;
  accessed_at: string | null;
  raw_context: string | null;
}

export interface PYQImportBatchRow {
  id: string;
  batch_id: string;
  exam_id: string | null;
  exam_year_id: string | null;
  status: string | null;
  total_records: number | null;
  processed_records: number | null;
  failed_records: number | null;
  error_log: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string;
}

export interface PYQDuplicateCandidateRow {
  id: string;
  question_id_a: string | null;
  question_id_b: string | null;
  similarity_score: number | string;
  status: string | null;
  reviewed_at: string | null;
}
