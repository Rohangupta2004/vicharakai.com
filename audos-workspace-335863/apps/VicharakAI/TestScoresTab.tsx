/**
 * [FIX 7] Test Scores — the test screen: log a test, and see the score for it
 * right here rather than on a separate summary.
 *
 * 1 · Header: the student's exam and the subject(s) in play.
 * 2 · Latest result: test name, subject(s) and score/max with percentage,
 *     shown on this screen — plus "Upload Mistake", which opens the Mistake
 *     Book photo capture with this test recorded as the entry's source.
 * 3 · SCORE LOGGING MOVED: the standalone "Log a test" form is gone — score
 *     logging is now STEP 1 of the Test Analysis tab (features/testAnalysis),
 *     where a mock session also captures pages, crops and reason tags. This
 *     screen keeps a pointer card to that tab. (TEST_TYPES, TestScoreDraft
 *     and fullMockSubjects stay exported — useTests and the Test Analysis
 *     flow still log scores through the same engine path.)
 * 4 · History: every logged test, newest first — name, date, score/max with
 *     percentage, subject tag and a colour band (🟢 ≥ 75 / 🟡 50–74 / 🔴 < 50).
 * 5 · Analytics row: overall average, subject-wise averages, and a trend
 *     arrow comparing the last 5 tests with the previous 5.
 * 6 · THE CRITICAL LINK: saving goes through onLogTest, which inserts the
 *     zuno_test_scores row AND calls the adaptation engine's recordTestResult
 *     for every covered chapter under ITS OWN subject — so mastery and
 *     weakness scores move, and the engine's Today priorities react to real
 *     results.
 * 7 · Weekly-mock nudge: a deterministic reminder line (no AI) when no mock
 *     was logged in the last 7 days.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, LineChart, Minus, NotebookPen, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import { Card, SectionLabel, ShowMoreToggle, SubjectDot } from './ui';
import { type ScoreEntry, type TestResult } from './engine';
import type { ExamDef } from './syllabus';

export const TEST_TYPES = ['Chapter Test', 'Full Mock', 'Previous Year'] as const;
export type TestType = (typeof TEST_TYPES)[number];

/** One chapter of the test, kept with the subject it belongs to. */
export interface TestTopicPair {
  subject: string;
  topic: string;
}

export interface TestScoreDraft {
  /** Primary subject — what every existing average, colour and trend reads. */
  subject: string;
  /** Every subject the paper covered (one entry for a single-subject test). */
  subjects: string[];
  /** Display name, e.g. "NEET Full Mock #3". */
  testName: string;
  testType: TestType;
  takenOn: string;
  marks: number;
  total: number;
  topics: string[];
  /** The same chapters, each with its owning subject, for the mastery feed. */
  topicPairs: TestTopicPair[];
  notes: string;
}

/**
 * Which subjects a Full Mock covers. Engineering exams get Physics · Chemistry
 * · Mathematics, medical exams Physics · Chemistry · Biology, and anything else
 * every subject the exam has. Falls back to all subjects whenever the expected
 * trio isn't present in the syllabus, so no exam ends up with an empty pick.
 */
export function fullMockSubjects(examKey: string, subjects: string[]): string[] {
  const key = (examKey || '').toLowerCase();
  const find = (needle: string) => subjects.find((name) => name.toLowerCase().includes(needle));
  const trio = (third: string) => [find('physic'), find('chem'), find(third)].filter((n): n is string => !!n);
  const medical = /neet|medical|aiims|inicet|mbbs|nursing|pharm|bds/.test(key);
  const engineering = /jee|bitsat|viteee|wbjee|comedk|cet|engineer|gate/.test(key);
  if (medical) {
    const picked = trio('bio');
    if (picked.length === 3) return picked;
  }
  if (engineering) {
    const picked = trio('math');
    if (picked.length === 3) return picked;
  }
  return subjects;
}

/** 🟢 ≥ 75%, 🟡 50–74%, 🔴 < 50% — the performance band for one test. */
function band(percent: number): { emoji: string; color: string; label: string } {
  if (percent >= 75) return { emoji: '\uD83D\uDFE2', color: SUCCESS, label: 'Strong' };
  if (percent >= 50) return { emoji: '\uD83D\uDFE1', color: WARNING, label: 'Building' };
  return { emoji: '\uD83D\uDD34', color: DANGER, label: 'Needs work' };
}

function formatDate(iso: string): string {
  try {
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function asNum(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Average percent of a slice of chronological entries. */
function avgPercent(entries: ScoreEntry[]): number | null {
  if (entries.length === 0) return null;
  return Math.round(entries.reduce((sum, entry) => sum + entry.percent, 0) / entries.length);
}

/** Rows carry a few columns the shared TestResult type doesn't name. */
type TestResultExtras = TestResult & {
  test_type?: string | null;
  topics_covered?: unknown;
  subjects_covered?: unknown;
  notes?: string | null;
};

/** Parse a JSON-or-string array column into clean strings. */
function parseList(raw: unknown): string[] {
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

/** Every subject a logged row covered — the multi-subject list when present. */
function rowSubjects(row: TestResultExtras): string[] {
  const list = parseList(row.subjects_covered);
  return list.length > 0 ? list : [row.subject];
}

/** The name to show for a logged row (older rows carry no name at all). */
function rowTestName(row: TestResultExtras): string {
  return row.test_name?.trim() || row.test_type?.trim() || 'Test';
}

export default function TestScoresTab({
  examName,
  examId,
  examDef,
  results,
  scoreEntries,
  today,
  weeklyMockNudge,
  onOpenAnalysis,
  onNewTest,
  onUploadMistake,
}: {
  examName: string;
  /** Canonical exam id (e.g. 'neet') — decides the Full Mock subject trio. */
  examId?: string;
  examDef: ExamDef | undefined;
  /** Raw zuno_test_scores rows (with test_type / topics_covered / notes). */
  results: TestResult[];
  /** Merged chronological entries — drives the analytics row. */
  scoreEntries: ScoreEntry[];
  today: string;
  /** Deterministic weekly-mock reminder (null when a recent mock exists). */
  weeklyMockNudge: string | null;
  /** Opens the Test Analysis tab — where score logging (step 1) now lives. */
  onOpenAnalysis?: () => void;
  /** [Fix 4] Opens the Create Test flow — rendered as a prominent button
   * right under the header so it is never buried. */
  onNewTest?: () => void;
  /** Opens the Mistake Book photo capture for one logged test. */
  onUploadMistake?: (sourceLabel: string, subject: string) => void;
}) {
  const subjects = examDef?.subjects.map((s) => s.name) ?? [];
  const [showAllHistory, setShowAllHistory] = useState(false);

  /* History: raw rows, newest first — they carry test_type/topics/notes. */
  const history = useMemo(
    () => ([...results] as TestResultExtras[]).sort((a, b) => b.taken_on.localeCompare(a.taken_on) || b.id - a.id),
    [results],
  );
  const historyVisible = showAllHistory ? history : history.slice(0, 8);
  const latest = history[0] ?? null;

  /* ---------- analytics (pure arithmetic — no AI) ---------- */
  const chronological = scoreEntries; // already sorted oldest → newest
  const overallAvg = avgPercent(chronological);
  const last5 = avgPercent(chronological.slice(-5));
  const prev5 = avgPercent(chronological.slice(-10, -5));
  const trend: 'up' | 'down' | 'flat' | null =
    last5 === null || prev5 === null ? null : last5 > prev5 + 2 ? 'up' : last5 < prev5 - 2 ? 'down' : 'flat';
  const subjectAverages = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const entry of chronological) {
      const bucket = map.get(entry.subject) ?? { sum: 0, count: 0 };
      bucket.sum += entry.percent;
      bucket.count += 1;
      map.set(entry.subject, bucket);
    }
    return Array.from(map.entries())
      .map(([name, { sum, count }]) => ({ subject: name, avg: Math.round(sum / count), count }))
      .sort((a, b) => b.count - a.count);
  }, [chronological]);

  /** The subject line in the header: the exam's subjects. */
  const headerSubjects = subjects.join(' · ');

  const uploadMistakeButton = (row: TestResultExtras, compact: boolean) =>
    onUploadMistake ? (
      <button
        type="button"
        onClick={() => onUploadMistake(rowTestName(row), row.subject)}
        className={`inline-flex items-center justify-center gap-1.5 font-extrabold touch-manipulation ${
          compact ? 'px-2.5 py-1 text-[10px]' : 'w-full py-3 text-[13px]'
        }`}
        style={
          compact
            ? { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
            : { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
        }
        data-testid={`button-upload-mistake-${row.id}`}
      >
        <NotebookPen className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        Upload Mistake
      </button>
    ) : null;

  return (
    <div className="flex-1 w-full max-w-[600px] lg:max-w-[860px] mx-auto px-5 sm:px-8 vicharak-screen-pad">
      <header className="pt-6 vicharak-rise">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold leading-[1.12] tracking-tight" style={{ color: TEXT }} data-testid="text-scores-title">
            Test Scores
          </h1>
        </div>
        <p className="mt-1 text-[12px] font-extrabold" style={{ color: TEXT_SECONDARY }} data-testid="text-scores-exam-subjects">
          {examName}
          {headerSubjects ? ` · ${headerSubjects}` : ''}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          Every score you log updates your mastery and weak topics — the engine re-plans Today from real results.
        </p>
      </header>

      {/* ---------- the latest score, on the test screen itself ---------- */}
      {latest && (() => {
        const percent = asNum(latest.percent);
        const latestBand = band(percent);
        const latestSubjects = rowSubjects(latest);
        return (
          <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" style={{ animationDelay: '20ms' }} testId="card-latest-test">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
              Latest test
            </p>
            <div className="mt-1 flex flex-col sm:flex-row items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold" style={{ color: TEXT }} data-testid="text-latest-test-name">
                  {rowTestName(latest)}
                </span>
                <span className="mt-1 flex items-center gap-1.5 flex-wrap" data-testid="text-latest-test-subjects">
                  {latestSubjects.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold"
                      style={{ borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                    >
                      <SubjectDot subject={name} size={5} />
                      {name}
                    </span>
                  ))}
                  <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{formatDate(latest.taken_on)}</span>
                </span>
              </span>
              <span className="flex-shrink-0 text-left sm:text-right">
                <span className="block text-[22px] font-black leading-none tabular-nums" style={{ color: latestBand.color }} data-testid="text-latest-test-score">
                  {asNum(latest.marks_obtained)}/{asNum(latest.total_marks)}
                </span>
                <span className="block mt-1 text-[11px] font-extrabold tabular-nums" style={{ color: TEXT_MUTED }}>
                  {latestBand.emoji} {percent}% · {latestBand.label}
                </span>
              </span>
            </div>
            <div className="mt-3">{uploadMistakeButton(latest, false)}</div>
            {onUploadMistake && (
              <p className="mt-2 text-[10px] leading-relaxed text-center" style={{ color: TEXT_MUTED }}>
                Snap the questions you got wrong — they land in your Mistake Book tagged “From: {rowTestName(latest)}” and
                join the spaced revision queue.
              </p>
            )}
          </Card>
        );
      })()}

      {/* [Fix 4] Create Test — the one prominent, unmissable entry into the
          test-generation flow on the Test screen (also on the Dashboard). */}
      {onNewTest && (
        <button
          type="button"
          onClick={onNewTest}
          className="mt-3 w-full py-3.5 text-sm font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation transition-transform active:scale-[0.98] vicharak-rise"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 8px 20px rgba(0,151,184,0.24)' }}
          data-testid="button-scores-create-test"
        >
          <Plus className="w-4 h-4" />
          Create Test
        </button>
      )}

      {/* Weekly-mock nudge — deterministic, from your own test history. */}
      {weeklyMockNudge && (
        <section
          className="mt-3 flex items-start gap-2.5 px-4 py-3 vicharak-rise"
          style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.09), border: `1px solid ${tint(AMBER, 0.3)}` }}
          data-testid="banner-weekly-mock"
        >
          <CalendarDays className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: AMBER }} />
          <p className="text-[12px] leading-relaxed font-semibold" style={{ color: TEXT_SECONDARY }}>{weeklyMockNudge}</p>
        </section>
      )}

      {/* ---------- analytics row ---------- */}
      {overallAvg !== null && (
        <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" style={{ animationDelay: '40ms' }} testId="card-score-analytics">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>Overall avg</p>
              <p className="text-3xl font-black" style={{ color: TEXT }} data-testid="text-overall-average">{overallAvg}%</p>
            </div>
            {trend !== null && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderRadius: RADIUS.chip, background: trend === 'up' ? tint(SUCCESS, 0.14) : trend === 'down' ? tint(DANGER, 0.14) : tint(TEXT_MUTED, 0.12) }} data-testid="badge-score-trend">
                {trend === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: SUCCESS }} />
                ) : trend === 'down' ? (
                  <TrendingDown className="w-3.5 h-3.5" style={{ color: DANGER }} />
                ) : (
                  <Minus className="w-3.5 h-3.5" style={{ color: TEXT_MUTED }} />
                )}
                <span className="text-[10px] font-extrabold" style={{ color: trend === 'up' ? SUCCESS : trend === 'down' ? DANGER : TEXT_MUTED }}>
                  {trend === 'up' ? `Improving · ${prev5}% → ${last5}%` : trend === 'down' ? `Declining · ${prev5}% → ${last5}%` : 'Steady'}
                </span>
              </div>
            )}
          </div>
          {subjectAverages.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {subjectAverages.map(({ subject: name, avg, count }) => (
                <li key={name} className="flex items-center gap-2.5">
                  <SubjectDot subject={name} size={6} />
                  <span className="min-w-0 flex-1 text-[12px] font-bold leading-snug break-words" style={{ color: TEXT_SECONDARY }}>{name}</span>
                  <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{count} test{count === 1 ? '' : 's'}</span>
                  <span className="text-[12px] font-extrabold tabular-nums" style={{ color: band(avg).color }}>{avg}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ---------- score logging moved to Test Analysis (step 1) ---------- */}
      {onOpenAnalysis && (
        <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" style={{ animationDelay: '60ms' }} testId="card-log-moved">
          <button
            type="button"
            onClick={onOpenAnalysis}
            className="w-full flex items-center gap-2.5 text-left touch-manipulation"
            data-testid="button-open-test-analysis"
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND_GRADIENT, color: ON_AMBER }}>
              <LineChart className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-extrabold" style={{ color: TEXT }}>Log a mock in Test Analysis</span>
              <span className="block text-[11px]" style={{ color: TEXT_MUTED }}>
                Score logging now lives there — log the score, crop your paper, tag WHY each question went wrong.
              </span>
            </span>
            <Plus className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
          </button>
        </Card>
      )}

      {/* ---------- history ---------- */}
      <section className="mt-5 vicharak-rise" style={{ animationDelay: '80ms' }} data-testid="section-score-history">
        <SectionLabel>Score history{history.length > 0 ? ` · ${history.length}` : ''}</SectionLabel>
        {history.length === 0 ? (
          <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            No tests logged yet. Open Test Analysis below to log your first chapter test or mock — the engine starts adapting from the very first score.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {historyVisible.map((row) => {
              const percent = asNum(row.percent);
              const rowBand = band(percent);
              const coveredTopics = parseList(row.topics_covered);
              const covering = rowSubjects(row);
              return (
                <li
                  key={row.id}
                  className="px-3.5 py-3 vicharak-fade"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                  data-testid={`score-row-${row.id}`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[15px] flex-shrink-0" aria-label={rowBand.label}>{rowBand.emoji}</span>
                    <span className="min-w-0 flex-[1_1_150px]">
                      <span className="block text-[13px] font-extrabold leading-snug break-words" style={{ color: TEXT }}>
                        {rowTestName(row)}
                      </span>
                      <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>
                        {formatDate(row.taken_on)}{row.test_type && row.test_name ? ` · ${row.test_type}` : ''}
                      </span>
                    </span>
                    <span className="flex-shrink-0 flex items-center gap-1 flex-wrap justify-end" style={{ maxWidth: 160 }}>
                      {covering.map((name) => (
                        <span
                          key={name}
                          className="px-2 py-0.5 text-[10px] font-bold"
                          style={{ borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                        >
                          {name}
                        </span>
                      ))}
                    </span>
                    <span className="flex-shrink-0 text-right">
                      <span className="block text-[13px] font-extrabold tabular-nums" style={{ color: rowBand.color }}>
                        {asNum(row.marks_obtained)}/{asNum(row.total_marks)}
                      </span>
                      <span className="block text-[10px] font-bold tabular-nums" style={{ color: TEXT_MUTED }}>{percent}%</span>
                    </span>
                  </div>
                  {coveredTopics.length > 0 && (
                    <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                      Covered: {coveredTopics.slice(0, 4).join(' · ')}{coveredTopics.length > 4 ? ` +${coveredTopics.length - 4} more` : ''}
                    </p>
                  )}
                  {row.notes?.trim() && (
                    <p className="mt-1 text-[10px] italic leading-relaxed" style={{ color: TEXT_SECONDARY }}>“{(row.notes ?? '').trim()}”</p>
                  )}
                  {onUploadMistake && <div className="mt-2">{uploadMistakeButton(row, true)}</div>}
                </li>
              );
            })}
          </ul>
        )}
        <ShowMoreToggle
          hiddenCount={Math.max(0, history.length - 8)}
          expanded={showAllHistory}
          onToggle={() => setShowAllHistory((v) => !v)}
          testId="toggle-score-history"
        />
      </section>
    </div>
  );
}
