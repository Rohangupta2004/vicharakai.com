/**
 * Runtime reader for the shared `exam_metadata` table.
 *
 * exam_metadata holds the FORMAT facts about an exam — total testing time,
 * the section breakdown, how it is scored, who sits it — for every US exam
 * (36 AP subjects, SAT, ACT, LSAT, GRE, GMAT, MCAT, DAT). It is shared,
 * read-only reference data: only the workspace's server functions write it.
 *
 * WHY THE AI NEEDS IT: exam_syllabi answers "what is on the exam", but not
 * "how long is Section I" or "what counts as a passing score". Without those
 * facts the coach either stays vague or invents them.
 * formatExamMetadataForPrompt() turns one row into a compact prompt block, and
 * examSyllabusSourceLine() tells the model whether official synchronized
 * syllabus rows exist for this exam or whether it must fall back to its own
 * training knowledge.
 *
 * READ NOTE: this table is keyed by its text exam_id and has no integer id
 * column, so this module uses the platform hook directly with an explicit
 * exam_id ordering rather than services/database/dbClient's useAllRows, which
 * assumes a numeric id.
 */
import { useMemo } from 'react';
import { TABLES } from '../services/database/tables';

/** The five categories exam_metadata.category uses. */
export type ExamMetadataCategory = 'ap' | 'college_admissions' | 'law' | 'grad' | 'medical';

export interface ExamSection {
  name?: string;
  time_minutes?: number;
  questions?: number;
  format?: string;
}

export interface ExamScoring {
  scale?: string;
  passing_score?: string;
  notes?: string;
}

export interface ExamMetadataRow {
  exam_id: string;
  exam_name: string | null;
  category: string | null;
  country: string | null;
  total_time_minutes: number | null;
  /** json column — the SDK returns it already parsed. */
  sections_json: ExamSection[] | null;
  scoring_json: ExamScoring | null;
  official_url: string | null;
  description: string | null;
  target_age_range: string | null;
}

/** Read cap: the table holds a few dozen rows, never thousands. */
const METADATA_READ_LIMIT = 250;

/**
 * Stable identities handed to the platform hook and to consumers. A fresh
 * options object (and a fresh `[]` while data is absent) on every render made
 * the hook's inputs look changed on each pass, which could re-arm its internal
 * fetch effect and re-ran every downstream memo — the onboarding exam picker
 * visibly re-rendered its list several times while mounting. One module-level
 * identity means the catalogue is requested exactly once per mount.
 */
const EMPTY_ROWS: ExamMetadataRow[] = [];
const CATALOG_QUERY_OPTIONS = {
  shared: true,
  limit: METADATA_READ_LIMIT,
  orderBy: { column: 'exam_id', direction: 'asc' as const },
};

/**
 * Planner exam ids whose metadata lives under a different exam_id. The US ids
 * already match one-for-one (see data/examsUS.ts), so this only covers the
 * legacy aliases the app has carried since before that table existed.
 */
const METADATA_ALIASES: Record<string, string> = {
  'ap-exams': 'ap_calc_ab',
  psat: 'sat',
};

export interface ExamMetadataCatalog {
  rows: ExamMetadataRow[];
  byExamId: Map<string, ExamMetadataRow>;
  loading: boolean;
  refresh: () => void;
}

/** Every exam_metadata row, indexed by exam_id. Safe on an empty table. */
export function useExamMetadataCatalog(): ExamMetadataCatalog {
  const query = window.useWorkspaceDB<ExamMetadataRow>(TABLES.examMetadata, CATALOG_QUERY_OPTIONS);
  const rows = query.data ?? EMPTY_ROWS;
  const byExamId = useMemo(() => {
    const index = new Map<string, ExamMetadataRow>();
    for (const row of rows) {
      const examId = String(row?.exam_id ?? '').trim();
      if (examId) index.set(examId, row);
    }
    return index;
  }, [rows]);
  return useMemo(
    () => ({ rows, byExamId, loading: query.loading, refresh: query.refresh }),
    [rows, byExamId, query.loading, query.refresh],
  );
}

/** The metadata row for a profile exam id, following the legacy aliases. */
export function resolveExamMetadata(
  byExamId: Map<string, ExamMetadataRow>,
  profileExamId: string | null | undefined,
): ExamMetadataRow | null {
  if (!profileExamId) return null;
  const raw = (String(profileExamId).replace(/^custom:/, '') ?? '').trim();
  if (!raw) return null;
  return byExamId.get(raw) ?? byExamId.get(METADATA_ALIASES[raw] ?? '') ?? null;
}

function describeSection(section: ExamSection): string {
  const parts: string[] = [];
  if (typeof section.questions === 'number' && section.questions > 0) {
    parts.push(`${section.questions} question${section.questions === 1 ? '' : 's'}`);
  }
  if (typeof section.time_minutes === 'number' && section.time_minutes > 0) {
    parts.push(`${section.time_minutes} min`);
  }
  if (section.format) parts.push(String(section.format).replace(/_/g, ' '));
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `${section.name || 'Section'}${detail}`;
}

/** Minutes as a human duration — '3h 15m', '90m'. */
/** Adds a full stop unless the text already ends in punctuation. */
function endSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function prettyMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * One exam_metadata row as a prompt block. Returns '' when there is no row,
 * so the caller can drop it without a conditional of its own.
 */
export function formatExamMetadataForPrompt(row: ExamMetadataRow | null): string {
  if (!row) return '';
  const name = row.exam_name || row.exam_id;
  const where = [row.country, row.category ? String(row.category).replace(/_/g, ' ') : null]
    .filter(Boolean)
    .join(' · ');
  const sections = Array.isArray(row.sections_json) ? row.sections_json.filter(Boolean) : [];
  const scoring = row.scoring_json && typeof row.scoring_json === 'object' ? row.scoring_json : null;
  const scoringParts = scoring
    ? [
        scoring.scale ? `scale ${scoring.scale}` : '',
        scoring.passing_score ? `target score ${scoring.passing_score}` : '',
        scoring.notes || '',
      ].filter(Boolean)
    : [];
  return [
    'EXAM FORMAT (official reference data — quote these numbers, never invent them):',
    `${name}${where ? ` (${where})` : ''}${row.description ? `: ${row.description}` : ''}`,
    typeof row.total_time_minutes === 'number' && row.total_time_minutes > 0
      ? `Total testing time: ${row.total_time_minutes} minutes (${prettyMinutes(row.total_time_minutes)}).`
      : '',
    sections.length > 0 ? `Sections: ${sections.map(describeSection).join(' · ')}.` : '',
    scoringParts.length > 0 ? endSentence(`Scoring: ${scoringParts.join('; ')}`) : '',
    row.target_age_range ? `Typical candidates: ${row.target_age_range}.` : '',
    row.official_url ? `Official page: ${row.official_url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Tells the model where the syllabus it was handed came from, so it knows
 * whether it may lean on its own knowledge of the course. This is the
 * fallback rule for a US exam whose official rows have not been synchronized
 * yet: use the built-in outline, top it up from training knowledge, and never
 * invent a unit name to fill a gap.
 */
export function examSyllabusSourceLine(
  examId: string | null | undefined,
  officialRowsExist: boolean,
): string {
  if (!examId) return '';
  if (officialRowsExist) {
    return 'Syllabus source: official rows have been synchronized for this exam — prefer their exact subject, unit and topic wording.';
  }
  return [
    'Syllabus source: no official syllabus rows have been synchronized for this exam yet, so the',
    "structure above is the app's built-in course outline. Fill any gap from your own knowledge of",
    'this exam\u2019s official course description, and say plainly that you are unsure rather than',
    'inventing a unit name.',
  ].join(' ');
}
