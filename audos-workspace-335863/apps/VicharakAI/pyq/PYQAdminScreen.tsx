/**
 * PYQAdminScreen — the founder/admin console for the PYQ pipeline.
 * Reachable only through the admin-gated sidebar item (?admin=1 — the same
 * gate as the Sync Syllabi operations button).
 *
 * Four tabs:
 *  1. Import — paste a PYQImportBatch JSON, run importPYQBatch() with live
 *     progress, see the result summary and past batches.
 *  2. Progress — pyq_exam_years × pyq_exams with per-row status control.
 *  3. Review Queue — unverified questions with Verify / Reject / Edit
 *     Classification (subject/chapter/topic/concept).
 *  4. Duplicate Review — pending duplicate pairs side by side with the
 *     similarity score; Confirm sets is_duplicate_of on question B.
 *
 * INTEGRITY: this screen never creates questions itself — only the ingestion
 * pipeline (real, sourced PYQs) writes them.
 */
/* eslint-disable */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Database, Globe2, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { BRAND, GONE, INK, INK_SOFT, KEPT, PENCIL, RADIUS, RULE, RULE_SOFT, SHEET, tint } from '../theme';
import { Card, EmptyLine, SectionLabel } from '../ui';
import { importPYQBatch } from './ingestion';
import {
  PYQ_TABLES,
  pyqSelect,
  pyqSelectAll,
  pyqUpdate,
  type PYQAnswerRow,
  type PYQChapterRow,
  type PYQConceptRow,
  type PYQDuplicateCandidateRow,
  type PYQExamRow,
  type PYQExamYearRow,
  type PYQImportBatchRow,
  type PYQQuestionRow,
  type PYQSourceRow,
  type PYQSubjectRow,
  type PYQTopicRow,
} from './pyqDb';
import type { IngestionResult, PYQImportBatch } from './types';

type AdminTab = 'import' | 'progress' | 'review' | 'duplicates';

const YEAR_STATUSES = ['pending', 'processing', 'complete', 'error', 'skipped'] as const;
const REVIEW_PAGE_SIZE = 10;
const OFFICIAL_SYNC_EXAMS = [
  { code: 'neet_ug', name: 'NEET UG' },
  { code: 'jee_main', name: 'JEE Main' },
  { code: 'jee_advanced', name: 'JEE Advanced' },
  { code: 'neet_pg', name: 'NEET PG' },
  { code: 'upsc_cse', name: 'UPSC CSE' },
  { code: 'mpsc', name: 'MPSC' },
  { code: 'cat', name: 'CAT' },
] as const;
const OFFICIAL_SYNC_YEARS = [2025, 2024, 2023, 2022, 2021, 2020] as const;
const OFFICIAL_SYNC_URL = '/api/hooks/execute/workspace-335863/apify-pyq-official-sync';

function statusColor(status: string): string {
  if (status === 'complete') return KEPT;
  if (status === 'processing') return BRAND;
  if (status === 'error') return GONE;
  return INK_SOFT; // pending / skipped / paused
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      className="px-2 py-0.5 inline-block"
      style={{ borderRadius: RADIUS.chip, fontSize: '0.7rem', fontWeight: 700, color, background: tint(color, 0.12) }}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 1 — Import                                                     */
/* ------------------------------------------------------------------ */

function ImportTab() {
  const [draft, setDraft] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [batches, setBatches] = useState<PYQImportBatchRow[]>([]);
  const [examsById, setExamsById] = useState<Map<string, PYQExamRow>>(new Map());
  const [yearsById, setYearsById] = useState<Map<string, PYQExamYearRow>>(new Map());
  const [officialExam, setOfficialExam] = useState<(typeof OFFICIAL_SYNC_EXAMS)[number]['code']>('neet_ug');
  const [officialYear, setOfficialYear] = useState<number>(2025);
  const [officialBusy, setOfficialBusy] = useState<'discover' | 'ingest' | null>(null);
  const [officialMessage, setOfficialMessage] = useState<string | null>(null);

  const refreshBatches = useCallback(async () => {
    const [rows, exams, years] = await Promise.all([
      pyqSelectAll<PYQImportBatchRow>(PYQ_TABLES.importBatches, {
        orderBy: { column: 'created_at', direction: 'desc' },
      }),
      pyqSelectAll<PYQExamRow>(PYQ_TABLES.exams),
      pyqSelectAll<PYQExamYearRow>(PYQ_TABLES.examYears),
    ]);
    setBatches(rows);
    setExamsById(new Map(exams.map((row) => [row.id, row])));
    setYearsById(new Map(years.map((row) => [row.id, row])));
  }, []);

  useEffect(() => {
    void refreshBatches().catch(() => undefined);
  }, [refreshBatches]);

  const runImport = async () => {
    if (running) return;
    setParseError(null);
    setResult(null);
    let parsed: PYQImportBatch;
    try {
      parsed = JSON.parse(draft) as PYQImportBatch;
    } catch (error) {
      setParseError(`That is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setRunning(true);
    setProgress({ processed: 0, total: Array.isArray(parsed?.questions) ? parsed.questions.length : 0 });
    try {
      const outcome = await importPYQBatch(parsed, (processed, total) => setProgress({ processed, total }));
      setResult(outcome);
      await refreshBatches().catch(() => undefined);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const runOfficialSync = async (action: 'discover' | 'ingest') => {
    if (officialBusy) return;
    setOfficialBusy(action);
    setOfficialMessage(null);
    try {
      const response = await fetch(OFFICIAL_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, examCode: officialExam, year: officialYear }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error || `Official sync failed (HTTP ${response.status}).`);
      }
      const report = payload.report ?? {};
      if (action === 'discover') {
        const coverage = Array.isArray(report.reports) ? report.reports[0] : null;
        setOfficialMessage(
          coverage?.ready
            ? `Official pair ready: ${coverage.papers} paper source(s), ${coverage.keys} key source(s). You can now ingest.`
            : `Discovery finished: ${coverage?.papers ?? 0} paper source(s), ${coverage?.keys ?? 0} key source(s). Nothing will import until both are official and matched.`,
        );
      } else {
        setOfficialMessage(
          `${report.imported ?? 0} transcribed question(s) imported; ${report.skipped ?? 0} skipped. New rows are held in Review Queue for spot-checking.`,
        );
        await refreshBatches().catch(() => undefined);
      }
    } catch (error) {
      setOfficialMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setOfficialBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionLabel icon={<Globe2 className="w-4 h-4" style={{ color: BRAND }} />}>Official archive sync (Apify)</SectionLabel>
        <p className="-mt-1 mb-3" style={{ fontSize: '0.78rem', color: INK_SOFT }}>
          Searches only approved exam-owner domains, then transcribes a matched official paper and official answer key.
          Missing or ambiguous sources are refused; machine-transcribed rows stay in Review Queue until spot-checked.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={officialExam}
            onChange={(event) => setOfficialExam(event.target.value as (typeof OFFICIAL_SYNC_EXAMS)[number]['code'])}
            disabled={officialBusy !== null}
            style={{ border: `1px solid ${RULE}`, borderRadius: RADIUS.sm, fontSize: '0.76rem', padding: '6px 8px', background: SHEET }}
          >
            {OFFICIAL_SYNC_EXAMS.map((exam) => <option key={exam.code} value={exam.code}>{exam.name}</option>)}
          </select>
          <select
            value={officialYear}
            onChange={(event) => setOfficialYear(Number(event.target.value))}
            disabled={officialBusy !== null}
            style={{ border: `1px solid ${RULE}`, borderRadius: RADIUS.sm, fontSize: '0.76rem', padding: '6px 8px', background: SHEET }}
          >
            {OFFICIAL_SYNC_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button type="button" disabled={officialBusy !== null} onClick={() => void runOfficialSync('discover')} className="vicharak-btn vicharak-btn-plain">
            {officialBusy === 'discover' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />}
            {officialBusy === 'discover' ? 'Discovering…' : 'Discover official sources'}
          </button>
          <button type="button" disabled={officialBusy !== null} onClick={() => void runOfficialSync('ingest')} className="vicharak-btn vicharak-btn-primary">
            {officialBusy === 'ingest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {officialBusy === 'ingest' ? 'Extracting…' : 'Ingest matched pair'}
          </button>
        </div>
        {officialMessage && (
          <p className="mt-2" style={{ fontSize: '0.76rem', color: INK_SOFT }} data-testid="pyq-official-sync-message">
            {officialMessage}
          </p>
        )}
      </Card>
      <Card className="p-4">
        <SectionLabel icon={<Upload className="w-4 h-4" style={{ color: BRAND }} />}>Import a PYQ batch</SectionLabel>
        <p className="-mt-1 mb-2" style={{ fontSize: '0.78rem', color: INK_SOFT }}>
          Paste a PYQImportBatch JSON (batchId, examCode, year, sourceType, sourceUrl, sourceName, questions[]).
          Only REAL previous-year questions with a pre-existing answer source belong here — the pipeline stores
          them verbatim with full provenance and never invents anything.
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={10}
          placeholder='{"batchId":"neet_ug_2024_v1","examCode":"neet_ug","year":2024,"sourceType":"official_pdf","sourceUrl":"https://…","sourceName":"NTA NEET UG 2024 paper","questions":[…]}'
          className="w-full font-mono"
          style={{
            fontSize: '0.75rem',
            border: `1px solid ${RULE}`,
            borderRadius: RADIUS.md,
            background: SHEET,
            color: INK,
            padding: 10,
          }}
          data-testid="pyq-import-json"
        />
        {parseError && (
          <p className="mt-2" style={{ fontSize: '0.78rem', color: GONE }} data-testid="pyq-import-parse-error">
            {parseError}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            disabled={running || !(draft ?? '').trim()}
            onClick={() => void runImport()}
            className="vicharak-btn vicharak-btn-primary"
            data-testid="pyq-import-run"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {running ? 'Importing…' : 'Import'}
          </button>
          {running && progress && (
            <span style={{ fontSize: '0.8rem', color: INK_SOFT }} data-testid="pyq-import-progress">
              {progress.processed}/{progress.total} records processed
            </span>
          )}
        </div>
        {result && (
          <div
            className="mt-3 p-3"
            style={{ borderRadius: RADIUS.md, border: `1px solid ${RULE_SOFT}`, background: tint(result.errors > 0 ? GONE : KEPT, 0.06) }}
            data-testid="pyq-import-result"
          >
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: INK }}>
              Batch {result.batchId} — {result.status}
            </p>
            <p className="mt-0.5" style={{ fontSize: '0.78rem', color: INK_SOFT }}>
              {result.imported} imported · {result.skipped} skipped · {result.flaggedAsDuplicate} flagged as duplicate ·{' '}
              {result.errors} error{result.errors === 1 ? '' : 's'}
            </p>
            {result.errorDetails.length > 0 && (
              <ul className="mt-1.5 space-y-0.5" style={{ fontSize: '0.72rem', color: PENCIL }}>
                {result.errorDetails.slice(0, 8).map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
                {result.errorDetails.length > 8 && <li>…and {result.errorDetails.length - 8} more.</li>}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionLabel icon={<Database className="w-4 h-4" style={{ color: INK_SOFT }} />}>Past batches</SectionLabel>
        {batches.length === 0 ? (
          <EmptyLine>No batches imported yet.</EmptyLine>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: '0.76rem', color: INK }}>
              <thead>
                <tr style={{ color: INK_SOFT, textAlign: 'left' }}>
                  <th className="py-1.5 pr-3 font-semibold">Batch</th>
                  <th className="py-1.5 pr-3 font-semibold">Exam</th>
                  <th className="py-1.5 pr-3 font-semibold">Year</th>
                  <th className="py-1.5 pr-3 font-semibold">Status</th>
                  <th className="py-1.5 pr-3 font-semibold">Imported</th>
                  <th className="py-1.5 pr-3 font-semibold">Errors</th>
                  <th className="py-1.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const exam = batch.exam_id ? examsById.get(batch.exam_id) : undefined;
                  const year = batch.exam_year_id ? yearsById.get(batch.exam_year_id) : undefined;
                  const imported = Math.max(0, (batch.processed_records ?? 0) - (batch.failed_records ?? 0));
                  return (
                    <tr key={batch.id} style={{ borderTop: `1px solid ${RULE_SOFT}` }}>
                      <td className="py-1.5 pr-3 font-mono">{batch.batch_id}</td>
                      <td className="py-1.5 pr-3">{exam?.name ?? '—'}</td>
                      <td className="py-1.5 pr-3">{year ? year.year : '—'}</td>
                      <td className="py-1.5 pr-3"><StatusBadge status={batch.status ?? 'pending'} /></td>
                      <td className="py-1.5 pr-3 tabular-nums">{imported}/{batch.total_records ?? 0}</td>
                      <td className="py-1.5 pr-3 tabular-nums" style={{ color: (batch.failed_records ?? 0) > 0 ? GONE : INK_SOFT }}>
                        {batch.failed_records ?? 0}
                      </td>
                      <td className="py-1.5" style={{ color: PENCIL }}>
                        {batch.created_at ? new Date(batch.created_at).toLocaleString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 2 — Progress                                                   */
/* ------------------------------------------------------------------ */

function ProgressTab() {
  const [rows, setRows] = useState<Array<PYQExamYearRow & { examName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [years, exams] = await Promise.all([
        pyqSelectAll<PYQExamYearRow>(PYQ_TABLES.examYears),
        pyqSelectAll<PYQExamRow>(PYQ_TABLES.exams),
      ]);
      const examById = new Map(exams.map((row) => [row.id, row]));
      setRows(
        years
          .map((row) => ({ ...row, examName: (row.exam_id ? examById.get(row.exam_id)?.name : undefined) ?? '—' }))
          .sort((a, b) => (a.examName === b.examName ? b.year - a.year : a.examName.localeCompare(b.examName))),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const changeStatus = async (row: PYQExamYearRow, status: string) => {
    setSavingId(row.id);
    try {
      await pyqUpdate(PYQ_TABLES.examYears, row.id, { status });
      await refresh();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card className="p-4">
      <SectionLabel icon={<ShieldCheck className="w-4 h-4" style={{ color: BRAND }} />}>Coverage progress</SectionLabel>
      {loading ? (
        <p className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: INK_SOFT }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading exam years…
        </p>
      ) : rows.length === 0 ? (
        <EmptyLine>No exam years yet — run the seed first.</EmptyLine>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '0.76rem', color: INK }}>
            <thead>
              <tr style={{ color: INK_SOFT, textAlign: 'left' }}>
                <th className="py-1.5 pr-3 font-semibold">Exam</th>
                <th className="py-1.5 pr-3 font-semibold">Year</th>
                <th className="py-1.5 pr-3 font-semibold">Status</th>
                <th className="py-1.5 pr-3 font-semibold">Total</th>
                <th className="py-1.5 pr-3 font-semibold">Imported</th>
                <th className="py-1.5 pr-3 font-semibold">Verified</th>
                <th className="py-1.5 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: `1px solid ${RULE_SOFT}` }}>
                  <td className="py-1.5 pr-3 font-semibold">{row.examName}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{row.year}</td>
                  <td className="py-1.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusBadge status={row.status ?? 'pending'} />
                      <select
                        value={row.status ?? 'pending'}
                        disabled={savingId === row.id}
                        onChange={(event) => void changeStatus(row, event.target.value)}
                        style={{ border: `1px solid ${RULE}`, borderRadius: RADIUS.sm, fontSize: '0.72rem', padding: '2px 4px', background: SHEET }}
                        data-testid={`pyq-year-status-${row.id}`}
                      >
                        {YEAR_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{row.total_questions ?? 0}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{row.imported_questions ?? 0}</td>
                  <td className="py-1.5 pr-3 tabular-nums" style={{ color: KEPT }}>{row.verified_questions ?? 0}</td>
                  <td className="py-1.5 truncate" style={{ maxWidth: 180, color: PENCIL }}>
                    {row.source_url ? (
                      <a href={row.source_url} target="_blank" rel="noreferrer" style={{ color: BRAND }}>
                        source
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3 — Review Queue                                               */
/* ------------------------------------------------------------------ */

interface ReviewRow {
  question: PYQQuestionRow;
  examName: string;
  year: number | null;
  subjectName: string | null;
  source: PYQSourceRow | null;
  answer: PYQAnswerRow | null;
}

function ClassificationEditor({
  question,
  onSaved,
  onCancel,
}: {
  question: PYQQuestionRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [subjects, setSubjects] = useState<PYQSubjectRow[]>([]);
  const [chapters, setChapters] = useState<PYQChapterRow[]>([]);
  const [topics, setTopics] = useState<PYQTopicRow[]>([]);
  const [concepts, setConcepts] = useState<PYQConceptRow[]>([]);
  const [subjectId, setSubjectId] = useState(question.subject_id ?? '');
  const [chapterId, setChapterId] = useState(question.chapter_id ?? '');
  const [topicId, setTopicId] = useState(question.topic_id ?? '');
  const [conceptId, setConceptId] = useState(question.concept_id ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!question.exam_id) return;
    void pyqSelectAll<PYQSubjectRow>(PYQ_TABLES.subjects, {
      filters: [{ column: 'exam_id', operator: 'eq', value: question.exam_id }],
    }).then(setSubjects).catch(() => undefined);
  }, [question.exam_id]);

  useEffect(() => {
    if (!subjectId) { setChapters([]); setTopics([]); setConcepts([]); return; }
    void Promise.all([
      pyqSelectAll<PYQChapterRow>(PYQ_TABLES.chapters, { filters: [{ column: 'subject_id', operator: 'eq', value: subjectId }] }),
      pyqSelectAll<PYQTopicRow>(PYQ_TABLES.topics, { filters: [{ column: 'subject_id', operator: 'eq', value: subjectId }] }),
      pyqSelectAll<PYQConceptRow>(PYQ_TABLES.concepts, { filters: [{ column: 'subject_id', operator: 'eq', value: subjectId }] }),
    ]).then(([chapterRows, topicRows, conceptRows]) => {
      setChapters(chapterRows);
      setTopics(topicRows);
      setConcepts(conceptRows);
    }).catch(() => undefined);
  }, [subjectId]);

  const save = async () => {
    setSaving(true);
    try {
      await pyqUpdate(PYQ_TABLES.questions, question.id, {
        subject_id: subjectId || null,
        chapter_id: chapterId || null,
        topic_id: topicId || null,
        concept_id: conceptId || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    border: `1px solid ${RULE}`,
    borderRadius: RADIUS.sm,
    fontSize: '0.74rem',
    padding: '4px 6px',
    background: SHEET,
    minWidth: 130,
  } as const;

  return (
    <div className="mt-2 p-2.5 flex flex-wrap items-center gap-2" style={{ border: `1px solid ${RULE_SOFT}`, borderRadius: RADIUS.md, background: tint(BRAND, 0.04) }}>
      <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(''); setTopicId(''); setConceptId(''); }} style={selectStyle}>
        <option value="">Subject…</option>
        {subjects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} style={selectStyle}>
        <option value="">Chapter…</option>
        {chapters.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      <select value={topicId} onChange={(e) => setTopicId(e.target.value)} style={selectStyle}>
        <option value="">Topic…</option>
        {topics.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      <select value={conceptId} onChange={(e) => setConceptId(e.target.value)} style={selectStyle}>
        <option value="">Concept…</option>
        {concepts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      <button type="button" disabled={saving} onClick={() => void save()} className="vicharak-btn vicharak-btn-primary" style={{ minHeight: 30, padding: '4px 12px' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} className="vicharak-btn vicharak-btn-plain" style={{ minHeight: 30, padding: '4px 12px' }}>
        Cancel
      </button>
    </div>
  );
}

function ReviewTab() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [questions, exams, years] = await Promise.all([
        pyqSelect<PYQQuestionRow>(PYQ_TABLES.questions, {
          filters: [
            { column: 'origin_type', operator: 'eq', value: 'official_pyq' },
            { column: 'verification_status', operator: 'eq', value: 'unverified' },
          ],
          orderBy: { column: 'import_timestamp', direction: 'asc' },
          limit: REVIEW_PAGE_SIZE + 1,
          offset: page * REVIEW_PAGE_SIZE,
        }),
        pyqSelectAll<PYQExamRow>(PYQ_TABLES.exams),
        pyqSelectAll<PYQExamYearRow>(PYQ_TABLES.examYears),
      ]);
      setHasMore(questions.length > REVIEW_PAGE_SIZE);
      const pageRows = questions.slice(0, REVIEW_PAGE_SIZE);
      const examById = new Map(exams.map((row) => [row.id, row]));
      const yearById = new Map(years.map((row) => [row.id, row]));
      const detailed = await Promise.all(
        pageRows.map(async (question) => {
          const [sources, answers, subjects] = await Promise.all([
            pyqSelect<PYQSourceRow>(PYQ_TABLES.sources, {
              filters: [{ column: 'question_id', operator: 'eq', value: question.id }],
              limit: 1,
            }),
            pyqSelect<PYQAnswerRow>(PYQ_TABLES.answers, {
              filters: [{ column: 'question_id', operator: 'eq', value: question.id }],
              limit: 1,
            }),
            question.subject_id
              ? pyqSelect<PYQSubjectRow>(PYQ_TABLES.subjects, {
                  filters: [{ column: 'id', operator: 'eq', value: question.subject_id }],
                  limit: 1,
                })
              : Promise.resolve([] as PYQSubjectRow[]),
          ]);
          return {
            question,
            examName: (question.exam_id ? examById.get(question.exam_id)?.name : undefined) ?? '—',
            year: question.exam_year_id ? Number(yearById.get(question.exam_year_id)?.year ?? 0) || null : null,
            subjectName: subjects[0]?.name ?? null,
            source: sources[0] ?? null,
            answer: answers[0] ?? null,
          };
        }),
      );
      setRows(detailed);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const setStatus = async (question: PYQQuestionRow, status: 'verified' | 'rejected') => {
    setBusyId(question.id);
    try {
      await pyqUpdate(PYQ_TABLES.questions, question.id, {
        verification_status: status,
        verification_timestamp: new Date().toISOString(),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4">
      <SectionLabel icon={<CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} />}>Review queue (unverified)</SectionLabel>
      {loading ? (
        <p className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: INK_SOFT }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
        </p>
      ) : rows.length === 0 ? (
        <EmptyLine>Nothing awaiting review — every imported question is verified or rejected.</EmptyLine>
      ) : (
        <div className="space-y-3">
          {rows.map(({ question, examName, year, subjectName, source, answer }) => (
            <div key={question.id} className="p-3" style={{ border: `1px solid ${RULE_SOFT}`, borderRadius: RADIUS.md }}>
              <p style={{ fontSize: '0.84rem', fontWeight: 600, color: INK }}>
                {question.question_text.length > 220 ? `${question.question_text.slice(0, 220)}…` : question.question_text}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ fontSize: '0.72rem', color: INK_SOFT }}>
                <span>{examName}{year ? ` · ${year}` : ''}</span>
                <span>Subject: {subjectName ?? 'unclassified'}</span>
                <span>
                  Answer: {answer ? (answer.correct_option_key ?? answer.correct_value ?? '—') : '—'}
                  {answer?.source_type ? ` (${answer.source_type})` : ''}
                </span>
                {source?.source_name && (
                  <span>
                    Source:{' '}
                    {source.source_url ? (
                      <a href={source.source_url} target="_blank" rel="noreferrer" style={{ color: BRAND }}>
                        {source.source_name}
                      </a>
                    ) : (
                      source.source_name
                    )}
                  </span>
                )}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={busyId === question.id}
                  onClick={() => void setStatus(question, 'verified')}
                  className="vicharak-btn vicharak-btn-primary"
                  style={{ minHeight: 30, padding: '4px 12px' }}
                  data-testid={`pyq-verify-${question.id}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark verified
                </button>
                <button
                  type="button"
                  disabled={busyId === question.id}
                  onClick={() => void setStatus(question, 'rejected')}
                  className="vicharak-btn vicharak-btn-plain"
                  style={{ minHeight: 30, padding: '4px 12px', color: GONE }}
                  data-testid={`pyq-reject-${question.id}`}
                >
                  <XCircle className="w-3.5 h-3.5" /> Mark rejected
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === question.id ? null : question.id)}
                  className="vicharak-btn vicharak-btn-ghost"
                  style={{ minHeight: 30, padding: '4px 12px' }}
                >
                  Edit classification
                </button>
              </div>
              {editingId === question.id && (
                <ClassificationEditor
                  question={question}
                  onSaved={() => {
                    setEditingId(null);
                    void refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          disabled={page === 0 || loading}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          className="vicharak-btn vicharak-btn-plain"
          style={{ minHeight: 30 }}
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span style={{ fontSize: '0.74rem', color: PENCIL }}>Page {page + 1}</span>
        <button
          type="button"
          disabled={!hasMore || loading}
          onClick={() => setPage((current) => current + 1)}
          className="vicharak-btn vicharak-btn-plain"
          style={{ minHeight: 30 }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 4 — Duplicate Review                                           */
/* ------------------------------------------------------------------ */

interface DuplicatePair {
  candidate: PYQDuplicateCandidateRow;
  questionA: PYQQuestionRow | null;
  questionB: PYQQuestionRow | null;
}

function DuplicatesTab() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const candidates = await pyqSelect<PYQDuplicateCandidateRow>(PYQ_TABLES.duplicateCandidates, {
        filters: [{ column: 'status', operator: 'eq', value: 'pending_review' }],
        orderBy: { column: 'created_at', direction: 'asc' },
        limit: 30,
      });
      const detailed = await Promise.all(
        candidates.map(async (candidate) => {
          const fetchQuestion = async (id: string | null): Promise<PYQQuestionRow | null> => {
            if (!id) return null;
            const rows = await pyqSelect<PYQQuestionRow>(PYQ_TABLES.questions, {
              filters: [{ column: 'id', operator: 'eq', value: id }],
              limit: 1,
            });
            return rows[0] ?? null;
          };
          const [questionA, questionB] = await Promise.all([
            fetchQuestion(candidate.question_id_a),
            fetchQuestion(candidate.question_id_b),
          ]);
          return { candidate, questionA, questionB };
        }),
      );
      setPairs(detailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const resolve = async (pair: DuplicatePair, confirmed: boolean) => {
    setBusyId(pair.candidate.id);
    try {
      const now = new Date().toISOString();
      if (confirmed && pair.questionA && pair.questionB) {
        await pyqUpdate(PYQ_TABLES.questions, pair.questionB.id, {
          is_duplicate_of: pair.questionA.id,
          duplicate_review_status: 'confirmed_duplicate',
        });
      } else if (pair.questionB) {
        await pyqUpdate(PYQ_TABLES.questions, pair.questionB.id, {
          duplicate_review_status: 'not_duplicate',
        }).catch(() => undefined);
      }
      await pyqUpdate(PYQ_TABLES.duplicateCandidates, pair.candidate.id, {
        status: confirmed ? 'confirmed_duplicate' : 'not_duplicate',
        reviewed_at: now,
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4">
      <SectionLabel icon={<Database className="w-4 h-4" style={{ color: BRAND }} />}>Duplicate review</SectionLabel>
      {loading ? (
        <p className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: INK_SOFT }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading candidates…
        </p>
      ) : pairs.length === 0 ? (
        <EmptyLine>No duplicate pairs waiting for review.</EmptyLine>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => (
            <div key={pair.candidate.id} className="p-3" style={{ border: `1px solid ${RULE_SOFT}`, borderRadius: RADIUS.md }}>
              <p style={{ fontSize: '0.74rem', fontWeight: 700, color: BRAND }}>
                Similarity {Math.round(Number(pair.candidate.similarity_score) * 100)}%
              </p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { label: 'Question A (kept)', row: pair.questionA },
                  { label: 'Question B (suspected duplicate)', row: pair.questionB },
                ].map(({ label, row }) => (
                  <div key={label} className="p-2.5" style={{ background: tint(BRAND, 0.04), borderRadius: RADIUS.md }}>
                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: INK_SOFT }}>{label}</p>
                    <p className="mt-1" style={{ fontSize: '0.8rem', color: INK }}>
                      {row ? row.question_text : '(question no longer exists)'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === pair.candidate.id || !pair.questionA || !pair.questionB}
                  onClick={() => void resolve(pair, true)}
                  className="vicharak-btn vicharak-btn-primary"
                  style={{ minHeight: 30, padding: '4px 12px' }}
                >
                  Confirm duplicate
                </button>
                <button
                  type="button"
                  disabled={busyId === pair.candidate.id}
                  onClick={() => void resolve(pair, false)}
                  className="vicharak-btn vicharak-btn-plain"
                  style={{ minHeight: 30, padding: '4px 12px' }}
                >
                  Not a duplicate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  The screen                                                         */
/* ------------------------------------------------------------------ */

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'progress', label: 'Progress' },
  { id: 'review', label: 'Review Queue' },
  { id: 'duplicates', label: 'Duplicate Review' },
];

export default function PYQAdminScreen() {
  const [tab, setTab] = useState<AdminTab>('import');
  const tabButtons = useMemo(() => ADMIN_TABS, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto w-full lg:max-w-[1000px] lg:mx-auto">
      <div className="px-4 pt-5 pb-32">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: BRAND }} />
          <h1 className="text-lg font-extrabold" style={{ color: INK }}>PYQ Admin</h1>
        </div>
        <p className="mt-0.5" style={{ fontSize: '0.8rem', color: INK_SOFT }}>
          Authentic previous-year questions only — imported from official sources, verified by a human, never invented.
        </p>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto vicharak-scroll-x pb-1">
          {tabButtons.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`vicharak-chip${tab === id ? ' vicharak-chip-on' : ''} flex-shrink-0 touch-manipulation`}
              style={{ minHeight: 30 }}
              data-testid={`pyq-admin-tab-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'import' && <ImportTab />}
          {tab === 'progress' && <ProgressTab />}
          {tab === 'review' && <ReviewTab />}
          {tab === 'duplicates' && <DuplicatesTab />}
        </div>
      </div>
    </div>
  );
}
