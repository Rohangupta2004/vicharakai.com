/**
 * Dashboard tab — the analytics hub. Everything quantitative lives here so the
 * Today screen can stay a single calm mission (no charts there, by design).
 *
 * Deliberately few cards, each earning its place: one hero (exam countdown +
 * the "Am I on track?" pace verdict), syllabus progress (ring + subject bars,
 * chapters behind a tap), the test hub (scores, mistake logs, accuracy trend),
 * weak chapters, study hours, and the Story of the Day to close.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import {
  formatDayLabel,
  formatDuration,
  minutesOnDate,
  scorePercent,
  type PaceSignal,
  type ScoreEntry,
  type StudyItem,
  type StudySession,
  type TaskAnnotation,
  type TestMistake,
} from './engine';
import type { ExamDef } from './syllabus';
import {
  buildAccuracyTrend,
  buildHoursLog,
  buildSubjectProgress,
  buildSubjectScores,
  buildWeakChapters,
  overallPercent as overallOf,
  type DoubtSignal,
} from './analytics';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  BRAND_GRADIENT_DEEP,
  CARD,
  CARD_SOFT,
  DANGER,
  HERO_SHADOW,
  NAVY_ALT,
  ON_AMBER,
  PAGE_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import { BarRow, Card, ProgressRing, SectionLabel, ShowMoreToggle, SubjectDot, TrendChart } from './ui';
import { storyOfTheDay } from './stories';

const STORY_IMAGE_URL = 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1786169647627-1uyo7w.png';

export interface ScoreDraft {
  subject: string;
  marks: number;
  total: number;
  testName: string;
}

export interface MistakeDraft {
  topic: string;
  description: string;
  correct: string;
}

const inputStyle = {
  background: NAVY_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS.sm,
  color: TEXT,
} as const;

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-extrabold uppercase tracking-[0.12em] mb-1.5"
      style={{ color: TEXT_MUTED }}
    >
      {children}
    </label>
  );
}

export default function DashboardTab({
  items,
  annotations,
  scoreEntries,
  mistakes,
  doubts,
  sessions,
  examDef,
  examName,
  studentName,
  examDate,
  pace,
  today,
  streak,
  subjectNames,
  onSaveScore,
  onDeleteScore,
  onAddMistake,
  onDeleteMistake,
}: {
  items: StudyItem[];
  annotations: Map<string, TaskAnnotation>;
  scoreEntries: ScoreEntry[];
  mistakes: TestMistake[];
  /** The student's saved doubts — they flag weak chapters here too. */
  doubts: DoubtSignal[];
  sessions: StudySession[];
  examDef: ExamDef | undefined;
  examName: string;
  studentName: string | null;
  examDate: string;
  pace: PaceSignal;
  today: string;
  streak: number;
  subjectNames: string[];
  onSaveScore: (draft: ScoreDraft, editing: ScoreEntry | null) => Promise<void>;
  onDeleteScore: (entry: ScoreEntry) => Promise<void>;
  onAddMistake: (entry: ScoreEntry, draft: MistakeDraft) => Promise<void>;
  onDeleteMistake: (mistake: TestMistake) => Promise<void>;
}) {
  /* score form: shared by "log a score" and the pencil on each row */
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScoreEntry | null>(null);
  const [scoreSubject, setScoreSubject] = useState('');
  const [scoreMarks, setScoreMarks] = useState('');
  const [scoreTotal, setScoreTotal] = useState('');
  const [scoreTestName, setScoreTestName] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  /* per-row state */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /* CHANGE 11: the weak-chapters list shows 5, the rest behind a toggle. */
  const [showAllWeak, setShowAllWeak] = useState(false);
  const [openMistakes, setOpenMistakes] = useState<string | null>(null);
  const [mistakeTopic, setMistakeTopic] = useState('');
  const [mistakeWhat, setMistakeWhat] = useState('');
  const [mistakeFix, setMistakeFix] = useState('');
  const [savingMistake, setSavingMistake] = useState(false);
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  /* Story of the Day — lives here, full text behind a full-screen sheet */
  const [storyOpen, setStoryOpen] = useState(false);
  const story = storyOfTheDay(today);

  const subjectProgress = useMemo(() => buildSubjectProgress(examDef, items), [examDef, items]);
  const overall = useMemo(() => overallOf(subjectProgress), [subjectProgress]);
  const subjectScores = useMemo(() => buildSubjectScores(scoreEntries), [scoreEntries]);
  const weakChapters = useMemo(
    () => buildWeakChapters(scoreEntries, subjectScores, subjectProgress, mistakes, doubts),
    [scoreEntries, subjectScores, subjectProgress, mistakes, doubts],
  );
  const accuracyTrend = useMemo(() => buildAccuracyTrend(scoreEntries), [scoreEntries]);
  const hoursLog = useMemo(() => buildHoursLog(items, annotations, today, sessions), [items, annotations, today, sessions]);
  const maxMinutes = Math.max(60, ...hoursLog.map((h) => h.minutes));
  const weekMinutes = hoursLog.reduce((sum, h) => sum + h.minutes, 0);
  const todayMinutes = useMemo(() => minutesOnDate(sessions, today), [sessions, today]);
  const anyRecorded = hoursLog.some((h) => h.logged);
  const recentTests = useMemo(() => [...scoreEntries].reverse().slice(0, 6), [scoreEntries]);
  const coverageNudge = useMemo(() => {
    const lowest = [...subjectProgress].sort((a, b) => a.percent - b.percent)[0];
    if (!lowest) return null;
    const last = items
      .filter((item) => item.subject === lowest.subject && item.status === 'done')
      .map((item) => (item.completed_at || item.studied_on || item.scheduled_for).slice(0, 10))
      .sort()
      .slice(-1)[0];
    const days = last ? Math.max(0, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86400000)) : null;
    return `${lowest.subject} is ${lowest.percent}% covered${days === null ? ' and untouched so far' : ` and has not been touched in ${days} day${days === 1 ? '' : 's'}`}. Add it to Today?`;
  }, [subjectProgress, items, today]);
  const mistakesByKey = useMemo(() => {
    const map = new Map<string, TestMistake[]>();
    for (const m of mistakes) {
      const key = m.score_key || (m.test_score_id ? `r${m.test_score_id}` : '');
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [mistakes]);

  const topicsStudied = items.filter((i) => i.kind === 'new' && i.status === 'done').length;
  const revisionsDone = items.filter((i) => i.kind === 'revision' && i.status === 'done').length;
  const daysToExam = Math.max(0, pace.daysToExam);
  const paceAccent = pace.status === 'green' ? SUCCESS : pace.status === 'amber' ? AMBER : DANGER;

  const marksValue = Number(scoreMarks);
  /** Full Marks is optional — left blank it falls back to a default of 100. */
  const totalValue = scoreTotal.trim() === '' ? 100 : Number(scoreTotal);
  const scoreFormValid =
    !!scoreSubject &&
    scoreMarks.trim() !== '' &&
    Number.isFinite(marksValue) &&
    Number.isFinite(totalValue) &&
    totalValue > 0 &&
    marksValue <= totalValue;

  const resetScoreForm = () => {
    setEditing(null);
    setScoreMarks('');
    setScoreTotal('');
    setScoreTestName('');
  };

  const openNewScoreForm = () => {
    resetScoreForm();
    setScoreSubject(scoreSubject || subjectNames[0] || '');
    setScoreFormOpen(true);
  };

  /** Pencil on a row: open the same form, pre-filled with the existing data. */
  const openEditForm = (entry: ScoreEntry) => {
    setEditing(entry);
    setScoreSubject(entry.subject);
    setScoreMarks(entry.marks !== null ? String(entry.marks) : String(entry.percent));
    setScoreTotal(entry.total !== null ? String(entry.total) : '100');
    setScoreTestName(entry.label ?? '');
    setScoreFormOpen(true);
    setConfirmDelete(null);
  };

  const submitScore = async () => {
    if (!scoreFormValid || savingScore) return;
    setSavingScore(true);
    try {
      await onSaveScore(
        { subject: scoreSubject, marks: marksValue, total: totalValue, testName: scoreTestName.trim() },
        editing,
      );
      setScoreFormOpen(false);
      resetScoreForm();
    } finally {
      setSavingScore(false);
    }
  };

  const submitMistake = async (entry: ScoreEntry) => {
    if (!mistakeTopic.trim() || !mistakeWhat.trim() || savingMistake) return;
    setSavingMistake(true);
    try {
      await onAddMistake(entry, {
        topic: mistakeTopic.trim(),
        description: mistakeWhat.trim(),
        correct: mistakeFix.trim(),
      });
      setMistakeTopic('');
      setMistakeWhat('');
      setMistakeFix('');
    } finally {
      setSavingMistake(false);
    }
  };

  return (
    <div className="px-4 sm:px-5 pt-6 pb-24 space-y-6">
      <header className="vicharak-rise">
        <h1 className="text-xl font-extrabold" style={{ color: TEXT }}>
          Dashboard
        </h1>
        <p className="text-[11px] mt-1.5" style={{ color: TEXT_MUTED }}>
          Your whole progress picture — syllabus, scores, gaps and pace.
        </p>
      </header>

      {/* the one hero: exam countdown + the pace verdict, together */}
      <section
        className="p-6 vicharak-rise"
        style={{ borderRadius: RADIUS.hero, background: BRAND_GRADIENT_DEEP, color: ON_AMBER, boxShadow: HERO_SHADOW, animationDelay: '30ms' }}
        data-testid="card-exam-countdown"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-80">Exam countdown</p>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold flex-shrink-0"
            style={{ background: 'rgba(3,18,57,0.45)', border: `1px solid ${tint(paceAccent, 0.55)}`, color: paceAccent }}
            data-testid="text-pace-label"
          >
            {pace.emoji} {pace.label}
          </span>
        </div>
        <p className="mt-2 text-5xl font-extrabold leading-none" data-testid="text-days-to-exam">
          {daysToExam}
          <span className="text-base font-extrabold ml-1.5">day{daysToExam === 1 ? '' : 's'} left</span>
        </p>
        <p className="mt-1.5 text-sm font-bold opacity-90">
          {examDef?.target.label ?? examName} ·{' '}
          {new Date(`${examDate}T12:00:00`).toLocaleDateString([], {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <p className="mt-4 text-xs leading-relaxed opacity-85" data-testid="text-pace-detail">
          {pace.detail}
        </p>
        {pace.hours && (
          <p className="text-[11px] mt-1.5 font-bold inline-flex items-center gap-1.5 opacity-75" data-testid="text-pace-hours">
            <Clock className="w-3 h-3" />
            {formatDuration(pace.hours.todayMinutes)} today · averaging {formatDuration(pace.hours.avgMinutes)} a day
            against {formatDuration(pace.hours.targetMinutes)}
          </p>
        )}
      </section>

      {/* syllabus progress — the ring and the subject bars, one card. Tap a
          subject to see its chapters; the coverage nudge closes the card. */}
      <Card radius={RADIUS.lg} className="p-5 vicharak-rise" style={{ animationDelay: '60ms' }} testId="card-syllabus-progress">
        <div className="flex items-center gap-5 mb-5">
          <ProgressRing percent={overall} size={116} />
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold" style={{ color: TEXT }}>
              Syllabus progress
            </h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              {subjectProgress.reduce((n, s) => n + s.done, 0)} of {subjectProgress.reduce((n, s) => n + s.total, 0)}{' '}
              topics covered.
            </p>
            <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
              {revisionsDone} revision{revisionsDone === 1 ? '' : 's'} locked in · {streak}-day streak
            </p>
          </div>
        </div>
        {subjectProgress.length === 0 ? (
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            Pick your exam and the full syllabus appears here, chapter by chapter.
          </p>
        ) : (
          <div className="space-y-3.5">
            {subjectProgress.map((s) => {
              const open = openSubject === s.subject;
              return (
                <div key={s.subject}>
                  <button
                    type="button"
                    onClick={() => setOpenSubject(open ? null : s.subject)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 text-left touch-manipulation"
                    data-testid={`subject-row-${s.subject}`}
                  >
                    <SubjectDot subject={s.subject} />
                    <span className="text-xs font-bold w-[86px] flex-shrink-0 truncate" style={{ color: TEXT_SECONDARY }}>
                      {s.subject}
                    </span>
                    <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${s.percent}%`, background: subjectColor(s.subject), transition: 'width 0.7s ease-out' }}
                      />
                    </span>
                    <span className="text-[11px] font-extrabold w-9 text-right flex-shrink-0" style={{ color: TEXT_MUTED }}>
                      {s.percent}%
                    </span>
                    <ChevronDown
                      className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                      style={{ color: TEXT_MUTED, transform: open ? 'rotate(180deg)' : undefined }}
                    />
                  </button>
                  {open && (
                    <ul className="mt-2 mb-1 ml-1 space-y-1 max-h-52 overflow-y-auto pr-1 vicharak-fade">
                      {s.chapters.map((c) => (
                        <li key={c.name} className="flex items-center gap-2">
                          <span
                            className={`text-[11px] flex-1 min-w-0 truncate ${c.done === c.total && c.total > 0 ? 'line-through' : ''}`}
                            style={{ color: c.done === c.total && c.total > 0 ? TEXT_MUTED : TEXT_SECONDARY }}
                          >
                            {c.name}
                          </span>
                          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: TEXT_MUTED }}>
                            {c.done}/{c.total}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {coverageNudge && (
          <p
            className="mt-4 p-3 text-xs leading-relaxed"
            style={{ borderRadius: RADIUS.md, background: tint(SUCCESS, 0.1), color: TEXT_SECONDARY }}
            data-testid="text-coverage-nudge"
          >
            {coverageNudge}
          </p>
        )}
      </Card>

      {/* subject-wise performance + score entry */}
      <Card radius={RADIUS.lg} className="p-5 vicharak-rise" style={{ animationDelay: '95ms' }} testId="card-performance">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-extrabold" style={{ color: TEXT }}>
            Subject-wise performance
          </h2>
          <button
            type="button"
            onClick={() => (scoreFormOpen && !editing ? setScoreFormOpen(false) : openNewScoreForm())}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1.5"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-log-score"
          >
            <Plus className="w-3 h-3" />
            Log a score
          </button>
        </div>

        {scoreFormOpen && (
          <div
            className="p-3.5 mb-3 space-y-3 vicharak-fade"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
            data-testid="form-score"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold" style={{ color: TEXT }}>
                {editing ? 'Edit this test' : 'Log a test score'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setScoreFormOpen(false);
                  resetScoreForm();
                }}
                aria-label="Close"
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: BORDER, color: TEXT_SECONDARY }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <FieldLabel htmlFor="score-subject">Subject</FieldLabel>
              <select
                id="score-subject"
                value={scoreSubject}
                onChange={(e) => setScoreSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm"
                style={inputStyle}
                data-testid="select-score-subject"
              >
                {(subjectNames.includes(scoreSubject) || !scoreSubject ? subjectNames : [scoreSubject, ...subjectNames]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <FieldLabel htmlFor="score-marks">Marks obtained</FieldLabel>
                <input
                  id="score-marks"
                  type="number"
                  inputMode="decimal"
                  value={scoreMarks}
                  onChange={(e) => setScoreMarks(e.target.value)}
                  placeholder="e.g. 148"
                  className="w-full px-3 py-2 text-sm"
                  style={inputStyle}
                  data-testid="input-score-marks"
                />
              </div>
              <div className="flex-1 min-w-0">
                <FieldLabel htmlFor="score-total">Full Marks (optional)</FieldLabel>
                <input
                  id="score-total"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={scoreTotal}
                  onChange={(e) => setScoreTotal(e.target.value)}
                  placeholder="e.g. 180 · blank = 100"
                  className="w-full px-3 py-2 text-sm"
                  style={inputStyle}
                  data-testid="input-score-total"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="score-test-name">Test name (optional)</FieldLabel>
              <input
                id="score-test-name"
                type="text"
                value={scoreTestName}
                onChange={(e) => setScoreTestName(e.target.value)}
                placeholder="e.g. Full Mock #3 or Kinematics chapter test"
                className="w-full px-3 py-2 text-sm"
                style={inputStyle}
                data-testid="input-score-test-name"
              />
            </div>

            <p className="text-[11px]" style={{ color: scoreFormValid ? AMBER : TEXT_MUTED }} data-testid="text-score-preview">
              {scoreFormValid
                ? `That's ${marksValue} / ${totalValue} — ${scorePercent(marksValue, totalValue)}%. I'll chart it against your other tests.`
                : 'Enter marks obtained — add Full Marks for the paper\u2019s total, or leave it blank to score out of 100.'}
            </p>

            <button
              type="button"
              disabled={!scoreFormValid || savingScore}
              onClick={() => void submitScore()}
              className="w-full py-2.5 text-xs font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-save-score"
            >
              {savingScore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingScore ? 'Saving…' : editing ? 'Save changes' : 'Save test score'}
            </button>
          </div>
        )}

        {subjectScores.length === 0 ? (
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            No test scores yet. Log one — marks out of total is all I need — and I'll start mapping your strong and weak
            zones.
          </p>
        ) : (
          <div className="space-y-2.5">
            {subjectScores.map((s) => (
              <BarRow
                key={s.subject}
                label={s.subject}
                percent={s.avg}
                color={s.avg < 60 ? DANGER : s.avg < 80 ? AMBER : SUCCESS}
                right={`${s.avg}% · ${s.n}`}
              />
            ))}
          </div>
        )}

        {/* recent tests — each row editable, deletable, with its own mistake log */}
        {recentTests.length > 0 && (
          <div className="mt-6">
            <SectionLabel>Recent tests</SectionLabel>
            <ul className="space-y-2.5">
              {recentTests.map((entry) => {
                const rowMistakes = mistakesByKey.get(entry.key) ?? [];
                const mistakesOpen = openMistakes === entry.key;
                const isBusy = busyKey === entry.key;
                return (
                  <li
                    key={entry.key}
                    style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                    data-testid={`test-row-${entry.key}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span
                        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                        style={{ borderRadius: 10, background: subjectTint(entry.subject) }}
                      >
                        <Trophy className="w-3.5 h-3.5" style={{ color: subjectColor(entry.subject) }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate" style={{ color: TEXT }}>
                          {entry.label || `${entry.subject} test`}
                        </span>
                        <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                          {entry.subject} · {formatDayLabel(entry.taken_on, today)}
                          {entry.marks === null ? ' · percentage only' : ''}
                        </span>
                      </span>
                      <span className="text-[11px] font-extrabold flex-shrink-0 text-right" style={{ color: AMBER }}>
                        {entry.marks !== null && entry.total !== null ? `${entry.marks}/${entry.total}` : `${entry.percent}%`}
                        <span className="block text-[9px] font-bold" style={{ color: TEXT_MUTED }}>
                          {entry.percent}%
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditForm(entry)}
                        aria-label={`Edit ${entry.label || entry.subject} test`}
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: BORDER, color: TEXT_SECONDARY }}
                        data-testid={`button-edit-test-${entry.key}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(confirmDelete === entry.key ? null : entry.key)}
                        aria-label={`Delete ${entry.label || entry.subject} test`}
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: tint(DANGER, 0.16), color: DANGER }}
                        data-testid={`button-delete-test-${entry.key}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {confirmDelete === entry.key && (
                      <div className="px-3 pb-3 vicharak-fade" data-testid={`confirm-delete-${entry.key}`}>
                        <div className="p-3" style={{ background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, borderRadius: RADIUS.sm }}>
                          <p className="text-[11px] font-bold" style={{ color: TEXT }}>
                            Delete this test permanently?
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>
                            Its score leaves your trend, averages and weak-chapter list. Any mistakes logged under it go too.
                          </p>
                          <div className="flex gap-2 mt-2.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setBusyKey(entry.key);
                                void onDeleteScore(entry).finally(() => {
                                  setBusyKey(null);
                                  setConfirmDelete(null);
                                  if (openMistakes === entry.key) setOpenMistakes(null);
                                });
                              }}
                              className="flex-1 py-2 text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                              style={{ borderRadius: RADIUS.sm, background: DANGER, color: '#2B0B0B' }}
                              data-testid={`button-confirm-delete-${entry.key}`}
                            >
                              {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                              Yes, delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="flex-1 py-2 text-[11px] font-extrabold"
                              style={{ borderRadius: RADIUS.sm, background: BORDER, color: TEXT }}
                            >
                              Keep it
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* mistake log accordion */}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMistakes(mistakesOpen ? null : entry.key);
                        setMistakeTopic('');
                        setMistakeWhat('');
                        setMistakeFix('');
                      }}
                      aria-expanded={mistakesOpen}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em]"
                      style={{ color: TEXT_MUTED, borderTop: `1px solid ${BORDER}` }}
                      data-testid={`button-mistakes-${entry.key}`}
                    >
                      <AlertTriangle className="w-3 h-3" style={{ color: rowMistakes.length ? AMBER : TEXT_MUTED }} />
                      Mistake log
                      {rowMistakes.length > 0 && (
                        <span
                          className="px-1.5 py-0.5 text-[9px]"
                          style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), color: AMBER }}
                        >
                          {rowMistakes.length}
                        </span>
                      )}
                      <ChevronDown
                        className="w-3 h-3 ml-auto transition-transform"
                        style={{ transform: mistakesOpen ? 'rotate(180deg)' : undefined }}
                      />
                    </button>

                    {mistakesOpen && (
                      <div className="px-3 pb-3 space-y-2 vicharak-fade">
                        {rowMistakes.length === 0 ? (
                          <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                            Nothing logged yet. Write down what went wrong while it's fresh — I use these to rank your weak
                            chapters.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {rowMistakes.map((m) => (
                              <li
                                key={m.id}
                                className="px-2.5 py-2 flex items-start gap-2"
                                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                                data-testid={`mistake-${m.id}`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[11px] font-bold" style={{ color: TEXT }}>
                                    {m.topic}
                                  </span>
                                  <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: TEXT_SECONDARY }}>
                                    {m.mistake_description}
                                  </span>
                                  {m.correct_approach && (
                                    <span className="block text-[11px] mt-1 leading-snug" style={{ color: SUCCESS }}>
                                      → {m.correct_approach}
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void onDeleteMistake(m)}
                                  aria-label={`Remove mistake: ${m.topic}`}
                                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: BORDER, color: TEXT_MUTED }}
                                  data-testid={`button-delete-mistake-${m.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={mistakeTopic}
                            onChange={(e) => setMistakeTopic(e.target.value)}
                            placeholder="Topic — e.g. Projectile motion"
                            className="w-full px-3 py-2 text-xs"
                            style={inputStyle}
                            data-testid="input-mistake-topic"
                          />
                          <textarea
                            value={mistakeWhat}
                            onChange={(e) => setMistakeWhat(e.target.value)}
                            rows={2}
                            placeholder="What went wrong? e.g. Used the wrong sign for downward acceleration"
                            className="w-full px-3 py-2 text-xs resize-none"
                            style={inputStyle}
                            data-testid="input-mistake-description"
                          />
                          <textarea
                            value={mistakeFix}
                            onChange={(e) => setMistakeFix(e.target.value)}
                            rows={2}
                            placeholder="Correct approach (optional) — e.g. Fix the axis first, then substitute"
                            className="w-full px-3 py-2 text-xs resize-none"
                            style={inputStyle}
                            data-testid="input-mistake-correct"
                          />
                          <button
                            type="button"
                            disabled={!mistakeTopic.trim() || !mistakeWhat.trim() || savingMistake}
                            onClick={() => void submitMistake(entry)}
                            className="w-full py-2 text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                            style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                            data-testid="button-save-mistake"
                          >
                            {savingMistake ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Log this mistake
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* accuracy trend */}
        <div className="mt-6">
          <SectionLabel icon={<TrendingUp className="w-3 h-3" />}>Accuracy trend</SectionLabel>
          {accuracyTrend.length >= 2 ? (
            <>
              <TrendChart points={accuracyTrend} />
              <div className="flex justify-between px-2">
                <span className="text-[10px]" style={{ color: TEXT_MUTED }}>
                  {accuracyTrend[0].label}
                </span>
                <span className="text-[10px]" style={{ color: TEXT_MUTED }}>
                  {accuracyTrend[accuracyTrend.length - 1].label}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: TEXT_MUTED }}>
              {accuracyTrend.length === 1
                ? `First test logged at ${accuracyTrend[0].value}% — log one more and the trend line appears here.`
                : 'Log two or more tests and your accuracy trend appears here.'}
            </p>
          )}
        </div>
      </Card>

      {/* weak chapters */}
      <Card radius={RADIUS.lg} className="p-5 vicharak-rise" style={{ animationDelay: '110ms' }} testId="card-weak-chapters">
        <h2 className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: TEXT }}>
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: DANGER }} />
          Weak chapters
        </h2>
        <p className="text-[11px] mt-1.5 mb-4" style={{ color: TEXT_MUTED }}>
          Most urgent first: mistakes you logged, then chapters your saved doubts flag, then low test scores, then the chapters you haven't touched yet.
        </p>
        {weakChapters.length === 0 ? (
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            Nothing to worry about — your coverage is even and no test has dipped below 60%. Keep going.
          </p>
        ) : (
          <>
            <ul className="space-y-2.5">
              {(showAllWeak ? weakChapters : weakChapters.slice(0, 5)).map((w, idx) => (
                <li key={`${w.subject}|${w.chapter}`} className="flex items-center gap-2.5 vicharak-fade">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                    style={{ background: tint(DANGER, 0.16), color: DANGER }}
                  >
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold truncate" style={{ color: TEXT }}>
                      {w.chapter}
                    </span>
                    <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                      {w.subject} · {w.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <ShowMoreToggle
              hiddenCount={Math.max(0, weakChapters.length - 5)}
              expanded={showAllWeak}
              onToggle={() => setShowAllWeak((v) => !v)}
              testId="toggle-weak-chapters"
            />
          </>
        )}
      </Card>

      {/* study hours */}
      <Card radius={RADIUS.lg} className="p-5 vicharak-rise" style={{ animationDelay: '130ms' }} testId="card-hours">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: TEXT }}>
            <Clock className="w-3.5 h-3.5" />
            Study hours · last 7 days
          </h2>
          <span className="text-sm font-extrabold" style={{ color: AMBER }} data-testid="text-week-hours">
            {(weekMinutes / 60).toFixed(1)}h
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-extrabold leading-none" style={{ color: TEXT }} data-testid="text-hours-today">
            {formatDuration(todayMinutes)}
          </span>
          <span className="text-[11px]" style={{ color: TEXT_MUTED }}>
            recorded today
            {pace.hours ? ` · ${formatDuration(pace.hours.targetMinutes)} a day keeps you on pace` : ''}
          </span>
        </div>
        <div className="flex items-end justify-between gap-2 h-24">
          {hoursLog.map((h) => (
            <div key={h.iso} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[9px] font-bold" style={{ color: TEXT_MUTED }}>
                {h.minutes > 0 ? `${(h.minutes / 60).toFixed(1)}h` : ''}
              </span>
              <div
                className="w-full max-w-[26px] rounded-t-lg"
                style={{
                  height: `${Math.max(3, (h.minutes / maxMinutes) * 64)}px`,
                  background: BRAND_GRADIENT,
                  opacity: h.minutes > 0 ? 1 : 0.2,
                  transition: 'height 0.7s ease-out',
                }}
              />
              <span className="text-[9px] uppercase" style={{ color: h.iso === today ? AMBER : TEXT_MUTED }}>
                {new Date(`${h.iso}T12:00:00`).toLocaleDateString([], { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-2" style={{ color: TEXT_MUTED }}>
          {anyRecorded
            ? 'Bars use the time you recorded. Days you never logged fall back to an estimate from what you checked off.'
            : 'Estimated from what you checked off — record real time on Today and these bars become exact.'}
        </p>
      </Card>

      {/* Story of the Day — the one non-stat card, closing the screen on a human note */}
      <Card radius={RADIUS.lg} className="p-5 vicharak-rise" style={{ animationDelay: '150ms' }} testId="card-stories">
        <SectionLabel icon={<BookOpen className="w-3.5 h-3.5" style={{ color: AMBER }} />}>Stories</SectionLabel>
        <button
          type="button"
          onClick={() => setStoryOpen(true)}
          className="w-full p-4 flex items-center gap-3.5 text-left transition-transform hover:-translate-y-0.5 touch-manipulation"
          style={{ background: CARD_SOFT, border: `1px solid ${tint(AMBER, 0.35)}`, borderRadius: RADIUS.md }}
          data-testid="button-view-story"
        >
          <img
            src={STORY_IMAGE_URL}
            alt="AI-generated study journey artwork"
            className="w-14 h-14 object-cover flex-shrink-0"
            style={{ borderRadius: RADIUS.md }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: AMBER }}>
              {story.name} · {story.category}
            </span>
            <span className="block text-sm font-extrabold mt-0.5 leading-snug" style={{ color: TEXT }}>
              {story.title}
            </span>
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
              View Story of the Day <ChevronRight className="w-3 h-3" />
            </span>
          </span>
        </button>
        <p className="text-[10px] mt-3" style={{ color: TEXT_MUTED }}>
          {studentName ? `${studentName}, this one is picked for your ${examName} journey.` : `Picked for your ${examName} journey.`} AI-generated artwork, real-person story.
        </p>
      </Card>

      {/* ---------------- STORY OF THE DAY — full-screen sheet ---------------- */}
      {storyOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col vicharak-fade"
          style={{ background: PAGE_BG }}
          role="dialog"
          aria-modal="true"
          aria-label="Story of the day"
          data-testid="overlay-story"
        >
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2 flex-shrink-0">
            <span
              className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]"
              style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), color: AMBER }}
            >
              Story of the day
            </span>
            <button
              type="button"
              onClick={() => setStoryOpen(false)}
              aria-label="Close story"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: BORDER, color: TEXT }}
              data-testid="button-close-story"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-10">
            <div className="max-w-md mx-auto vicharak-rise">
              <img
                src={STORY_IMAGE_URL}
                alt={`AI-generated ${examName} study journey artwork`}
                className="w-full h-44 object-cover mt-4"
                style={{ borderRadius: RADIUS.hero }}
              />
              <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.16em] mt-4" style={{ color: AMBER }}>
                {story.name} · {story.category}
              </p>
              <h2 className="text-center text-2xl font-extrabold mt-1.5 leading-tight" style={{ color: TEXT }} data-testid="text-story-title">
                {story.title}
              </h2>
              <p className="text-sm mt-4 font-bold" style={{ color: AMBER }}>
                {studentName ? `${studentName}, you've touched ${topicsStudied} topics so far — here's the mindset for your next one.` : `You've touched ${topicsStudied} topics so far — here's the mindset for your next one.`}
              </p>
              <p className="text-[15px] mt-3 leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-story-body">
                {story.story}
              </p>
              <p className="text-[11px] mt-4 text-center" style={{ color: TEXT_MUTED }}>
                A true story. A new one lands here every day.
              </p>
              <button
                type="button"
                onClick={() => setStoryOpen(false)}
                className="mt-6 w-full py-3 text-sm font-extrabold"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-story-back"
              >
                Back to my prep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
