/**
 * Calendar tab — the big-picture screen, two ways to see the same journey.
 *
 *  • Calendar: a full-screen month grid at high information density. Every day
 *    carries dot indicators — blue for tasks, orange for tests, green for
 *    revision due. Tapping a day opens a COMPACT POPOVER over the grid — a
 *    date header, a summary line and a dense list of the day's tasks,
 *    revisions, tests and Mistake Book reviews; closing it stays on Calendar.
 *  • Road View: the entire prep arc as one linear journey — Started → week
 *    markers → chapter completions → tests → "You are here" → Exam Day. The road
 *    itself takes the colour of the pace signal.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  HelpCircle,
  MapPin,
  Mountain,
  Pencil,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import {
  addDaysISO,
  buildDaySchedule,
  diffDays,
  estimatedMinutes,
  formatDuration,
  localDayOf,
  topicKey,
  TASK_TYPES,
  type PaceSignal,
  type ScoreEntry,
  type StudyItem,
  type TaskType,
} from './engine';
import type { ExamDef } from './syllabus';
import type { FlaggedRow } from './mcq';
import { examLabelFromId, isCustomExamId } from './customExam';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND,
  BRAND_GRADIENT,
  CARD,
  CARD_SOFT,
  DANGER,
  DOUBT_ACCENT,
  DOUBT_GRADIENT,
  GONE,
  GONE_WASH,
  INK,
  INK_SOFT,
  KEPT,
  NAVY,
  ON_AMBER,
  PAGE_BG,
  PAPER,
  PAPER_SUNK,
  PENCIL,
  POPOVER_SHADOW,
  RADIUS,
  REVISION_GRADIENT,
  RULE,
  RULE_SOFT,
  SHEET,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  subjectColor,
  tint,
} from './theme';
import { Card, Chip, EmptyLine, PenUnderline, SubjectChip, TaskBox } from './ui';
import { getSystemDate } from './systemDate';

/* Day-dot categories, fixed so the legend always means the same thing. */
const TASK_BLUE = '#60A5FA';
const TEST_ORANGE = '#FB923C';
const REVISION_GREEN = SUCCESS;

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return addDaysISO(iso, -((d.getDay() + 6) % 7));
}

function addMonthsISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  const dayOfMonth = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dayOfMonth, maxDay));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], opts);
}

function dayTitle(iso: string, today: string): string {
  const diff = diffDays(today, iso);
  const base = fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' });
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Tomorrow · ${base}`;
  if (diff === -1) return `Yesterday · ${base}`;
  return base;
}

function CategoryDot({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: color, opacity: dim ? 0.35 : 1 }}
      aria-hidden="true"
    />
  );
}

function TaskCard({ item, today, onEdit }: { item: StudyItem; today: string; onEdit: (item: StudyItem) => void }) {
  const done = item.status === 'done';
  const isRevision = item.kind === 'revision';
  const due = isRevision && !done && item.scheduled_for <= today;
  const overdue = !done && item.scheduled_for < today;
  return (
    <li
      className="px-3.5 py-3 flex items-start gap-3 vicharak-rise"
      style={{
        background: done ? tint(CARD, 0.55) : CARD,
        border: `1px solid ${done ? tint(BORDER, 0.5) : BORDER}`,
        borderRadius: RADIUS.md,
      }}
      data-testid={`cal-task-${item.id}`}
    >
      <span
        className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={
          done
            ? { background: tint(AMBER, 0.22), color: AMBER }
            : { border: `1px solid ${isRevision ? REVISION_GREEN : TASK_BLUE}` }
        }
        aria-hidden="true"
      >
        {done ? <Check className="w-3 h-3" /> : null}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
        <p
          className={`text-sm font-semibold leading-snug flex-1 ${done ? 'line-through' : ''}`}
          style={{ color: done ? TEXT_MUTED : TEXT }}
        >
          {item.topic}
        </p>
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }}
          aria-label={`Edit ${item.topic}`}
          data-testid={`cal-edit-${item.id}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <SubjectChip subject={item.subject} />
          {/* [Feature 2] Explicit status — done / pending / overdue. */}
          <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold"
            style={{
              borderRadius: RADIUS.chip,
              ...(done
                ? { color: SUCCESS, background: tint(SUCCESS, 0.14) }
                : overdue
                  ? { color: DANGER, background: tint(DANGER, 0.16) }
                  : { color: TASK_BLUE, background: tint(TASK_BLUE, 0.14) }),
            }}
            data-testid={`cal-task-status-${item.id}`}
          >
            {done ? 'Done' : overdue ? 'Overdue' : 'Pending'}
          </span>
          {isRevision && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold"
              style={{
                borderRadius: RADIUS.chip,
                ...(done
                  ? { color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.12) }
                  : due
                    ? { color: '#0A2416', background: REVISION_GREEN }
                    : { color: REVISION_GREEN, background: tint(REVISION_GREEN, 0.14) }),
              }}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              {done ? 'Revised' : due ? 'Revision due' : `Day-${item.interval_days ?? ''} revisit`}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

interface Milestone {
  date: string;
  label: string;
  sub?: string;
  type: 'start' | 'week' | 'chapter' | 'test' | 'here' | 'next' | 'exam';
}

export default function CalendarTab({
  items,
  scores,
  examDef,
  examId,
  examDate,
  pace,
  startDate,
  today,
  recommendedNext,
  taskDetails,
  onUpdateTask,
  doubts,
}: {
  items: StudyItem[];
  scores: ScoreEntry[];
  examDef: ExamDef | undefined;
  examId: string;
  examDate: string;
  pace: PaceSignal;
  startDate: string;
  today: string;
  recommendedNext?: { subject: string; topic: string };
  taskDetails: Record<string, { type: TaskType; time?: string; minutes?: number }>;
  onUpdateTask: (item: StudyItem, updates: { subject: string; topic: string; type: TaskType; time: string; minutes: number | null; scheduled_for: string }) => Promise<void>;
  /** Mistake Book entries — powers the past-7-days “mistakes solved” stat. */
  doubts?: FlaggedRow[];
}) {
  /* Week opens by default. A month grid of mostly-empty cells is the worst
   * first thing a new account can be shown; the week is where the work is. */
  const [view, setView] = useState<'calendar' | 'week' | 'road'>('week');
  const [selectedDay, setSelectedDay] = useState<string>(today);
  /* [Feature 2] Tapping a day tile opens the FULL-SCREEN day planner. */
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = getSystemDate();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [editing, setEditing] = useState<StudyItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editType, setEditType] = useState<TaskType>('Self Study');
  const [editTime, setEditTime] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [editDate, setEditDate] = useState(today);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditor = (item: StudyItem) => {
    setEditError(null);
    const details = taskDetails[item.source_key || topicKey(item.subject, item.topic)];
    setEditing(item);
    setEditSubject(item.subject);
    setEditTopic(item.topic);
    setEditType(details?.type ?? (item.kind === 'revision' ? 'Revision' : 'Self Study'));
    setEditTime(details?.time ?? '');
    setEditMinutes(details?.minutes ? String(details.minutes) : '');
    setEditDate(item.scheduled_for);
  };

  /* Keep the "Now" marker on the day road honest while the tab stays open. */
  useEffect(() => {
    const tick = window.setInterval(() => {
      const d = getSystemDate();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => window.clearInterval(tick);
  }, []);

  const daysToExam = Math.max(0, diffDays(today, examDate));
  const roadColor = pace.status === 'green' ? SUCCESS : pace.status === 'amber' ? AMBER : DANGER;
  // A typed exam's id is a slug, so only the pre-loaded ids read well upper-cased.
  const examFallbackLabel = isCustomExamId(examId) ? examLabelFromId(examId) : examId.toUpperCase();

  /* How far through the whole prep arc the student is — the road's progress marker. */
  const journeyStart = startDate || items[0]?.scheduled_for || today;
  const totalJourneyDays = Math.max(1, diffDays(journeyStart, examDate));
  const elapsedJourneyDays = Math.max(0, Math.min(totalJourneyDays, diffDays(journeyStart, today)));
  const journeyPercent = Math.min(100, Math.max(0, Math.round((elapsedJourneyDays / totalJourneyDays) * 100)));

  const tasksByDate = useMemo(() => {
    const map = new Map<string, StudyItem[]>();
    for (const it of items) {
      const list = map.get(it.scheduled_for) ?? [];
      list.push(it);
      map.set(it.scheduled_for, list);
    }
    return map;
  }, [items]);

  const testsByDate = useMemo(() => {
    const map = new Map<string, ScoreEntry[]>();
    for (const s of scores) {
      const list = map.get(s.taken_on) ?? [];
      list.push(s);
      map.set(s.taken_on, list);
    }
    return map;
  }, [scores]);

  /* CHANGE 7: study-day quality — tasks COMPLETED on each calendar day (by
   * completion date, not planned date). Colours the month cells: green = good
   * study day (3+ done), amber = partial (1–2), plain = nothing logged. */
  const completedByDate = useMemo(() => {
    const map = new Map<string, StudyItem[]>();
    for (const it of items) {
      if (it.status !== 'done' || !it.completed_at) continue;
      const date = localDayOf(it.completed_at);
      if (!date) continue;
      const list = map.get(date) ?? [];
      list.push(it);
      map.set(date, list);
    }
    return map;
  }, [items]);

  /* One chip per distinct subject on the student's plan. */
  const filterSubjects = useMemo(() => Array.from(new Set(items.map((item) => item.subject))), [items]);

  /* Today's items on an estimated clock — block heights follow durations. */
  const daySchedule = useMemo(() => {
    const todays = items
      .filter((item) => item.scheduled_for === today || (item.status === 'pending' && item.scheduled_for < today))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'done' ? -1 : 1;
        if (a.kind !== b.kind) return a.kind === 'revision' ? -1 : 1;
        return a.scheduled_for.localeCompare(b.scheduled_for);
      });
    return buildDaySchedule(todays, (item) => taskDetails[item.source_key || topicKey(item.subject, item.topic)]);
  }, [items, today, taskDetails]);

  /* Month grid: Monday-start weeks covering the month of selectedDay. */
  const monthCells = useMemo(() => {
    const first = `${selectedDay.slice(0, 7)}-01`;
    const d = new Date(`${first}T12:00:00`);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const gridStart = mondayOf(first);
    const leading = diffDays(gridStart, first);
    const weeks = Math.ceil((leading + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDaysISO(gridStart, i));
  }, [selectedDay]);

  /* [Feature 2] Week view: the Monday-start week containing selectedDay. */
  const weekCells = useMemo(() => {
    const start = mondayOf(selectedDay);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  }, [selectedDay]);

  const monthPrefix = selectedDay.slice(0, 7);
  const selectedItems = tasksByDate.get(selectedDay) ?? [];
  const selectedTests = testsByDate.get(selectedDay) ?? [];
  const visibleSelectedItems = subjectFilter === 'All' ? selectedItems : selectedItems.filter((item) => item.subject === subjectFilter);
  /* [Feature 2] The day planner's data for selectedDay: completions logged
   * on the day, and saved doubts whose spaced review lands on the day. */
  const selectedCompleted = completedByDate.get(selectedDay) ?? [];
  const selectedDoubtsDue = (doubts ?? []).filter(
    (row) => row.status === 'queued' && String(row.next_revision_on ?? '').slice(0, 10) === selectedDay,
  );

  /* One dot per subject makes the month scannable at a glance. */
  const dotsFor = (iso: string): Array<{ color: string; dim: boolean }> => {
    const dayItems = tasksByDate.get(iso) ?? [];
    const dots: Array<{ color: string; dim: boolean }> = [];
    const subjects = Array.from(new Set(dayItems.filter((item) => item.kind === 'new').map((item) => item.subject)));
    subjects.slice(0, 4).forEach((subject) => {
      const subjectItems = dayItems.filter((item) => item.kind === 'new' && item.subject === subject);
      dots.push({ color: subjectColor(subject), dim: subjectItems.every((item) => item.status === 'done') });
    });
    if (testsByDate.has(iso)) dots.push({ color: TEST_ORANGE, dim: false });
    const revisions = dayItems.filter((item) => item.kind === 'revision');
    if (revisions.length > 0) dots.push({ color: REVISION_GREEN, dim: revisions.every((item) => item.status === 'done') });
    return dots.slice(0, 5);
  };

  /* Month-at-a-glance numbers — completed, still pending, tests logged. */
  const monthStats = useMemo(() => {
    let pending = 0;
    let done = 0;
    let tests = 0;
    for (const [date, list] of tasksByDate) {
      if (date.slice(0, 7) !== monthPrefix) continue;
      pending += list.filter((item) => item.status === 'pending').length;
    }
    for (const [date, list] of completedByDate) {
      if (date.slice(0, 7) === monthPrefix) done += list.length;
    }
    for (const [date, list] of testsByDate) {
      if (date.slice(0, 7) === monthPrefix) tests += list.length;
    }
    return { pending, done, tests };
  }, [tasksByDate, completedByDate, testsByDate, monthPrefix]);

  /* [Feature 2] Past-7-days stats strip — topics completed, tests taken,
   * doubts solved (a doubt counts as "solved" the day it was revised or
   * marked resolved). */
  const weekStats = useMemo(() => {
    const windowDays = new Set(Array.from({ length: 7 }, (_, i) => addDaysISO(today, -i)));
    let topicsDone = 0;
    for (const [date, list] of completedByDate) {
      if (windowDays.has(date)) topicsDone += list.filter((item) => item.kind === 'new').length;
    }
    let testsTaken = 0;
    for (const [date, list] of testsByDate) {
      if (windowDays.has(date)) testsTaken += list.length;
    }
    let doubtsSolved = 0;
    for (const row of doubts ?? []) {
      const solvedOn = String(row.resolved_at ?? row.last_revised_on ?? '').slice(0, 10);
      if (solvedOn && windowDays.has(solvedOn)) doubtsSolved += 1;
    }
    return { topicsDone, testsTaken, doubtsSolved };
  }, [completedByDate, testsByDate, doubts, today]);

  /* Everything the student has slipped past. This is the one thing the week
   * view leads with, and the only place --gone is allowed to appear. */
  const behindItems = useMemo(
    () =>
      items
        .filter((item) => item.status === 'pending' && item.scheduled_for < today)
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.subject.localeCompare(b.subject)),
    [items, today],
  );
  const behindIds = useMemo(() => new Set(behindItems.map((item) => item.id)), [behindItems]);
  const weekItemCount = useMemo(
    () => weekCells.reduce((sum, iso) => sum + (tasksByDate.get(iso)?.length ?? 0), 0),
    [weekCells, tasksByDate],
  );

  /* One bar per task. Scheduled, overdue and done is the whole vocabulary —
   * subjects never colour a day, because a colour that means two things
   * means neither. */
  const loadFor = (iso: string) =>
    (tasksByDate.get(iso) ?? []).map((item) => ({
      id: item.id,
      done: item.status === 'done',
      color: item.status === 'done' ? KEPT : item.scheduled_for < today ? GONE : INK_SOFT,
    }));

  /** Stacked rules under a date. `width` fixed in the strip, varied in the grid. */
  const LoadBars = ({ iso, fixedWidth }: { iso: string; fixedWidth?: number }) => {
    const bars = loadFor(iso);
    if (bars.length === 0) return null;
    const ruled = ['70%', '52%', '62%'];
    return (
      <span className="flex flex-col items-start" style={{ gap: 2 }} aria-hidden="true">
        {bars.slice(0, 3).map((bar, index) => (
          <span
            key={`bar-${bar.id}`}
            style={{
              width: fixedWidth ?? ruled[index % ruled.length],
              height: 2.5,
              borderRadius: 2,
              background: bar.color,
              opacity: bar.done ? 0.55 : 1,
            }}
          />
        ))}
        {bars.length > 3 && (
          <span style={{ fontSize: '0.58rem', lineHeight: 1.1, color: INK_SOFT }}>+{bars.length - 3}</span>
        )}
      </span>
    );
  };

  const milestones = useMemo<Milestone[]>(() => {
    const roadStart = startDate || items[0]?.scheduled_for || today;
    const list: Milestone[] = [
      { date: roadStart, label: 'Started', sub: fmt(roadStart, { month: 'short', day: 'numeric' }), type: 'start' },
    ];

    // Week markers for the elapsed journey (capped so the road stays readable).
    const weeksElapsed = Math.floor(Math.max(0, diffDays(roadStart, today)) / 7);
    for (let w = 1; w <= Math.min(weeksElapsed, 8); w++) {
      list.push({ date: addDaysISO(roadStart, w * 7), label: `Week ${w}`, type: 'week' });
    }

    // Chapter completions — every chapter whose topics are all covered.
    if (examDef) {
      const doneByKey = new Map<string, string>();
      for (const i of items) {
        if (i.kind === 'new' && i.status === 'done') {
          const key = i.source_key || topicKey(i.subject, i.topic);
          const date = localDayOf(i.completed_at) || i.studied_on || i.scheduled_for;
          const prev = doneByKey.get(key);
          if (!prev || date > prev) doneByKey.set(key, date);
        }
      }
      for (const subject of examDef.subjects) {
        for (const chapter of subject.chapters) {
          const chapterAsItem = doneByKey.get(topicKey(subject.name, chapter.name));
          const topicDates = chapter.topics.map((t) => doneByKey.get(topicKey(subject.name, t)));
          const allTopicsDone = topicDates.length > 0 && topicDates.every((d) => !!d);
          if (chapterAsItem || allTopicsDone) {
            const when = chapterAsItem ?? (topicDates.filter(Boolean) as string[]).sort().slice(-1)[0];
            if (when) list.push({ date: when, label: chapter.name, sub: `${subject.name} · chapter done`, type: 'chapter' });
          }
        }
      }
    }

    for (const s of scores) {
      list.push({
        date: s.taken_on,
        label: s.label ? `${s.subject}: ${s.label}` : `${s.subject} test`,
        sub: s.marks !== null && s.total !== null ? `${s.marks}/${s.total}` : `${s.percent}%`,
        type: 'test',
      });
    }

    list.push({ date: today, label: 'You are here', sub: fmt(today, { month: 'short', day: 'numeric' }), type: 'here' });
    const nextStop = [...items]
      .filter((item) => item.status === 'pending' && item.scheduled_for > today)
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0];
    if (nextStop) {
      list.push({ date: nextStop.scheduled_for, label: `Next stop: ${nextStop.topic}`, sub: nextStop.subject, type: 'next' });
    } else if (recommendedNext) {
      list.push({ date: addDaysISO(today, 1), label: `Recommended: ${recommendedNext.topic}`, sub: recommendedNext.subject, type: 'next' });
    }
    list.push({
      date: examDate,
      label: 'Exam Day',
      sub: `${examDef?.target.label ?? examFallbackLabel} · ${fmt(examDate, { month: 'short', day: 'numeric' })}`,
      type: 'exam',
    });

    return list.sort((a, b) => (a.date === b.date ? (a.type === 'here' ? 1 : -1) : a.date.localeCompare(b.date)));
  }, [startDate, today, examDate, examDef, items, scores, examId, recommendedNext]);

  return (
    <div className="vicharak-margin px-4 sm:px-5 pt-4 vicharak-screen-pad">
      {/* Month cells grow at the tablet breakpoint, and the day popover is a
          bottom sheet on a phone but a floating panel from 40rem up. */}
      <style>{`
        .cal-cell { min-height: 58px; }
        .cal-popover { border-radius: 10px 10px 0 0; }
        @media (min-width: 40rem) {
          .cal-cell { min-height: 72px; }
          .cal-popover { border-radius: var(--r); }
        }
      `}</style>
      {/* Month title, the view toggle, and ONE status line. The three stat
          boxes that used to sit here are gone: three panels reading 0/0/0 is
          the worst first impression a new account can be given. */}
      <header className="vicharak-rise">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="vicharak-title truncate" data-testid="cal-period-label">
              {view === 'road' ? 'Your journey' : fmt(selectedDay, { month: 'long', year: 'numeric' })}
            </h1>
            <PenUnderline width={126} className="mt-1" />
          </div>
          {/* Segmented control: one rule around it, a hairline between
              segments, and the active one filled with ink. */}
          <div
            className="flex flex-shrink-0 overflow-hidden"
            style={{ border: `1px solid ${RULE}`, borderRadius: RADIUS.md }}
            role="tablist"
            aria-label="Calendar views"
          >
            {(
              [
                { id: 'week', label: 'Week' },
                { id: 'calendar', label: 'Month' },
                { id: 'road', label: 'Road' },
              ] as const
            ).map((v, index) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className="px-3 touch-manipulation"
                style={{
                  minHeight: 36,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderLeft: index > 0 ? `1px solid ${RULE}` : undefined,
                  background: view === v.id ? INK : 'transparent',
                  color: view === v.id ? PAPER : INK_SOFT,
                }}
                data-testid={`cal-view-${v.id}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* One status line. Behind is the only red thing on this screen. */}
        <p className="mt-2 leading-relaxed" style={{ fontSize: '0.82rem', color: INK_SOFT }} data-testid="cal-status-line">
          {behindItems.length > 0 && (
            <span style={{ color: GONE, fontWeight: 600 }}>
              {behindItems.length} behind
              {' · '}
            </span>
          )}
          {weekItemCount} this week · exam in {daysToExam} day{daysToExam === 1 ? '' : 's'}
        </p>

        {view !== 'road' && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDay(view === 'week' ? addDaysISO(selectedDay, -7) : addMonthsISO(selectedDay, -1))}
              aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
              className="vicharak-btn vicharak-btn-plain"
              style={{ minHeight: 36, minWidth: 36, padding: '0 0.5rem' }}
              data-testid="cal-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay(view === 'week' ? addDaysISO(selectedDay, 7) : addMonthsISO(selectedDay, 1))}
              aria-label={view === 'week' ? 'Next week' : 'Next month'}
              className="vicharak-btn vicharak-btn-plain"
              style={{ minHeight: 36, minWidth: 36, padding: '0 0.5rem' }}
              data-testid="cal-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setSelectedDay(today)}
              className="vicharak-btn vicharak-btn-ghost"
              style={{ minHeight: 36 }}
              data-testid="cal-button-today"
            >
              Today
            </button>
          </div>
        )}
      </header>

      {view !== 'road' ? (
        <div className="mt-3 space-y-3">
          {/* The week strip stays visible in both views: seven equal columns
              in one panel, each a date and the load sitting under it. */}
          <div
            className="grid grid-cols-7"
            style={{ background: SHEET, border: `1px solid ${RULE}`, borderRadius: RADIUS.md }}
            data-testid="cal-week-strip"
          >
            {weekCells.map((iso, index) => {
              const isToday = iso === today;
              const isSelected = iso === selectedDay;
              return (
                <button
                  key={`strip-${iso}`}
                  type="button"
                  onClick={() => {
                    setSelectedDay(iso);
                    setDayDetailOpen(true);
                  }}
                  aria-label={`Open ${fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                  aria-pressed={isSelected}
                  className="flex flex-col items-center gap-1 py-2 touch-manipulation"
                  style={{ minHeight: 62 }}
                  data-testid={`cal-strip-${iso}`}
                >
                  <span style={{ fontSize: '0.63rem', fontWeight: 600, color: INK_SOFT }}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                  </span>
                  {/* A CSS circle. Today is a ring, never a filled square. */}
                  <span
                    className="flex items-center justify-center tabular-nums"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      ...(isToday && isSelected
                        ? { background: BRAND, color: '#fff', border: '1.5px solid transparent' }
                        : isSelected
                          ? { background: INK, color: PAPER, border: '1.5px solid transparent' }
                          : isToday
                            ? { border: `1.5px solid ${BRAND}`, color: BRAND }
                            : { border: '1.5px solid transparent', color: INK }),
                    }}
                  >
                    {Number(iso.slice(8, 10))}
                  </span>
                  <LoadBars iso={iso} fixedWidth={15} />
                </button>
              );
            })}
          </div>

          {/* The month grid — one panel, cells ruled like a page. No subject
              dots, no completion washes: a day's load is read from its bars. */}
          {view === 'calendar' && (
            <>
              <div className="vicharak-panel vicharak-rise" data-testid="cal-month-grid">
                <div className="grid grid-cols-7" style={{ background: PAPER_SUNK }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
                    <span key={i} className="text-center py-1.5" style={{ fontSize: '0.63rem', fontWeight: 600, color: INK_SOFT }}>
                      {w}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells.map((iso, index) => {
                    const inMonth = iso.slice(0, 7) === monthPrefix;
                    const isToday = iso === today;
                    const isSelected = iso === selectedDay;
                    const dayItems = tasksByDate.get(iso) ?? [];
                    const hasOverdue = dayItems.some((item) => item.status === 'pending' && item.scheduled_for < today);
                    const edges: CSSProperties = {
                      borderTop: index >= 7 ? `1px solid ${RULE_SOFT}` : undefined,
                      borderLeft: index % 7 ? `1px solid ${RULE_SOFT}` : undefined,
                    };
                    /* Leading and trailing days belong to another month —
                       shown for the shape of the grid, not to be tapped. */
                    if (!inMonth) {
                      return (
                        <span
                          key={iso}
                          className="cal-cell block px-1.5 pt-1.5"
                          style={{ ...edges, color: '#C6C1B6', fontSize: '0.72rem' }}
                          aria-hidden="true"
                        >
                          {Number(iso.slice(8, 10))}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => {
                          setSelectedDay(iso);
                          setDayDetailOpen(true);
                        }}
                        aria-label={`Open the day plan for ${fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' })}: ${dayItems.length} entries`}
                        aria-pressed={isSelected}
                        className="cal-cell flex flex-col items-start gap-1 px-1.5 pt-1.5 pb-1 text-left touch-manipulation"
                        style={{ ...edges, background: isSelected ? PAPER_SUNK : 'transparent' }}
                        data-testid={`cal-cell-${iso}`}
                      >
                        <span
                          className="flex items-center justify-center tabular-nums flex-shrink-0"
                          style={{
                            width: 23,
                            height: 23,
                            borderRadius: '50%',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            border: isToday ? `1.5px solid ${BRAND}` : '1.5px solid transparent',
                            color: hasOverdue ? GONE : isToday ? BRAND : INK,
                          }}
                        >
                          {Number(iso.slice(8, 10))}
                        </span>
                        <LoadBars iso={iso} />
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Four entries, explaining the encoding — not a subject list. */}
              <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-0.5" data-testid="cal-legend">
                {(
                  [
                    { color: INK_SOFT, label: 'scheduled', dim: false },
                    { color: GONE, label: 'overdue', dim: false },
                    { color: KEPT, label: 'done', dim: true },
                  ] as const
                ).map((entry) => (
                  <span key={entry.label} className="inline-flex items-center gap-1.5" style={{ fontSize: '0.72rem', color: INK_SOFT }}>
                    <span style={{ width: 15, height: 2.5, borderRadius: 2, background: entry.color, opacity: entry.dim ? 0.55 : 1 }} />
                    {entry.label}
                  </span>
                ))}
                <span style={{ fontSize: '0.72rem', color: INK_SOFT }}>one line per task</span>
              </div>
            </>
          )}

          {view === 'week' && (
            <>
              {/* Behind leads the week, always — and when nothing is behind the
                  section is omitted entirely rather than reading zero. */}
              {behindItems.length > 0 && (
                <section data-testid="cal-behind">
                  <h2 className="mb-1.5" style={{ fontSize: '1rem', fontWeight: 600, color: GONE }}>
                    Behind · {behindItems.length}
                  </h2>
                  <ul
                    className="vicharak-rows overflow-hidden"
                    style={{ background: SHEET, border: '1px solid #E8C9C2', borderRadius: RADIUS.md }}
                  >
                    {behindItems.slice(0, 12).map((item) => {
                      const late = Math.max(1, diffDays(item.scheduled_for, today));
                      return (
                        <li key={`behind-${item.id}`}>
                          <button
                            type="button"
                            onClick={() => openEditor(item)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left touch-manipulation"
                            style={{ minHeight: 44, boxShadow: `inset 2.5px 0 0 ${GONE}` }}
                            data-testid={`cal-behind-${item.id}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block vicharak-hand truncate" style={{ color: INK }}>
                                {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                              </span>
                              <span className="block mt-0.5" style={{ fontSize: '0.72rem', color: INK_SOFT }}>
                                {item.subject} · <span style={{ color: GONE, fontWeight: 600 }}>{late} day{late === 1 ? '' : 's'} late</span>
                              </span>
                            </span>
                            <span className="flex-shrink-0 tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 600, color: INK_SOFT }}>
                              {formatDuration(estimatedMinutes(undefined, item.kind))}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* This week — one panel, all seven days. Anything already
                  listed under Behind does not repeat in its original day. */}
              <section data-testid="cal-this-week">
                <h2 className="mb-1.5" style={{ fontSize: '1rem', fontWeight: 600, color: INK }}>This week</h2>
                <div className="vicharak-panel">
                  {weekCells.map((iso) => {
                    const dayItems = (tasksByDate.get(iso) ?? []).filter(
                      (item) =>
                        !behindIds.has(item.id) && (subjectFilter === 'All' || item.subject === subjectFilter),
                    );
                    const isToday = iso === today;
                    return (
                      <div key={`week-${iso}`}>
                        <div
                          className="flex items-center justify-between gap-2 px-3 py-1.5"
                          style={{ background: PAPER_SUNK }}
                        >
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: INK_SOFT }}>
                            {isToday && <span style={{ color: BRAND }}>Today · </span>}
                            {fmt(iso, { weekday: 'long', day: 'numeric', month: 'short' })}
                          </span>
                          {dayItems.length > 0 && (
                            <span className="tabular-nums" style={{ fontSize: '0.72rem', color: INK_SOFT }}>
                              {dayItems.length}
                            </span>
                          )}
                        </div>
                        {dayItems.length === 0 ? (
                          <p className="px-3 py-2 vicharak-empty">
                            {iso < today ? 'Nothing logged.' : 'Free.'}
                          </p>
                        ) : (
                          <ul className="vicharak-rows">
                            {dayItems.map((item) => (
                              <li key={`weekrow-${item.id}`}>
                                <button
                                  type="button"
                                  onClick={() => openEditor(item)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left touch-manipulation"
                                  style={{ minHeight: 44 }}
                                  data-testid={`cal-week-item-${item.id}`}
                                >
                                  <TaskBox done={item.status === 'done'} dense />
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className="block vicharak-hand truncate"
                                      style={{ color: item.status === 'done' ? INK_SOFT : INK }}
                                    >
                                      {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                                    </span>
                                    <span className="block mt-0.5" style={{ fontSize: '0.72rem', color: INK_SOFT }}>
                                      {item.subject}
                                      {item.kind === 'revision' ? ' · revision' : ''}
                                    </span>
                                  </span>
                                  <span
                                    className="flex-shrink-0 tabular-nums"
                                    style={{ fontSize: '0.75rem', fontWeight: 600, color: item.status === 'done' ? KEPT : INK_SOFT }}
                                  >
                                    {formatDuration(estimatedMinutes(undefined, item.kind))}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Subject filter, at the foot of the screen. Outline-only pills
              carrying a coloured dot; only the selected one fills. */}
          {filterSubjects.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 vicharak-scroll-x" data-testid="cal-subject-filter">
              {['All', ...filterSubjects].map((name) => (
                <Chip
                  key={name}
                  color={name === 'All' ? undefined : subjectColor(name)}
                  selected={subjectFilter === name}
                  onClick={() => setSubjectFilter(name)}
                  testId={`cal-filter-${name}`}
                >
                  {name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ---------------- ROAD VIEW ---------------- */
        <div className="mt-3 space-y-4 flex flex-col">
          {/* Journey progress — how far through the prep arc the student is */}
          <Card radius={RADIUS.lg} className="p-4 vicharak-rise" style={{ background: CARD_SOFT }} testId="cal-road-progress">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
                Your journey to {examDef?.target.label ?? examFallbackLabel}
              </p>
              <span className="text-[11px] font-extrabold" style={{ color: roadColor }}>
                {daysToExam} days left
              </span>
            </div>
            <p className="text-[11px] mb-4" style={{ color: TEXT_MUTED }}>
              {pace.detail}
            </p>
            <div className="relative h-2.5 rounded-full" style={{ background: tint(TEXT_MUTED, 0.2) }}>
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${journeyPercent}%`, background: roadColor, transition: 'width 0.7s ease-out' }}
                aria-hidden="true"
              />
              <span
                className="absolute top-1/2 w-4 h-4 rounded-full vicharak-here"
                style={{ left: `calc(${journeyPercent}% - 8px)`, transform: 'translateY(-50%)', background: AMBER, border: `2px solid ${ON_AMBER}` }}
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center justify-between gap-2 mt-2 text-[10px] font-bold" style={{ color: TEXT_MUTED }}>
              <span>Started {fmt(journeyStart, { month: 'short', day: 'numeric' })}</span>
              <span style={{ color: TEXT_SECONDARY }} data-testid="cal-journey-percent">
                Day {elapsedJourneyDays + 1} of {totalJourneyDays + 1} · {journeyPercent}% through prep
              </span>
              <span>Exam {fmt(examDate, { month: 'short', day: 'numeric' })}</span>
            </div>
          </Card>

          {/* Today on the road — a full-day timeline, blocks sized to duration */}
          <Card
            radius={RADIUS.lg}
            className="p-4 vicharak-rise flex flex-col"
            style={{ background: CARD_SOFT, animationDelay: '50ms', minHeight: '55vh' }}
            testId="cal-day-road"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
                Today on the road
              </p>
              {daySchedule.length > 0 && (
                <span className="text-[11px] font-extrabold" style={{ color: TEXT_SECONDARY }}>
                  ~{formatDuration(daySchedule.reduce((sum, slot) => sum + slot.durationMinutes, 0))} planned
                </span>
              )}
            </div>
            <p className="text-[11px] mb-4" style={{ color: TEXT_MUTED }}>
              Each block's height follows its estimated length — longer tasks take a taller stretch of road.
            </p>
            {daySchedule.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <Sparkles className="w-5 h-5 mb-2" style={{ color: TEXT_MUTED }} />
                <p className="text-xs max-w-[240px]" style={{ color: TEXT_MUTED }}>
                  Nothing on today's road yet — tasks VicharakAI plans from your history and Mistake Book appear here, sized to their duration.
                </p>
              </div>
            ) : (() => {
              const scale = 1.8;
              const firstSlot = daySchedule[0];
              const lastSlot = daySchedule[daySchedule.length - 1];
              const roadStartMin = Math.min(firstSlot.startMinutes, nowMinutes) - 20;
              const roadEndMin = Math.max(lastSlot.startMinutes + lastSlot.durationMinutes, nowMinutes) + 20;
              const totalHeight = Math.max(320, (roadEndMin - roadStartMin) * scale);
              const clockLabel = (minutes: number) => {
                const h24 = Math.floor(minutes / 60) % 24;
                const mm = minutes % 60;
                const half = h24 >= 12 ? 'pm' : 'am';
                const h = h24 % 12 || 12;
                return `${h}:${String(mm).padStart(2, '0')} ${half}`;
              };
              return (
                <div className="relative flex-1" style={{ minHeight: totalHeight }} data-testid="cal-day-road-timeline">
                  {/* the road itself */}
                  <span
                    className="absolute top-0 bottom-0 w-1 rounded-full"
                    style={{ left: 57, background: tint(roadColor, 0.3) }}
                    aria-hidden="true"
                  />
                  {daySchedule.map((slot) => {
                    const done = slot.item.status === 'done';
                    const top = (slot.startMinutes - roadStartMin) * scale;
                    const height = Math.max(44, slot.durationMinutes * scale);
                    return (
                      <div key={slot.item.id} className="absolute left-0 right-0 flex items-stretch gap-2.5" style={{ top, height }}>
                        <span className="w-11 flex-shrink-0 text-right text-[10px] font-bold pt-1" style={{ color: TEXT_MUTED }}>
                          {clockLabel(slot.startMinutes)}
                        </span>
                        <span className="relative w-2.5 flex-shrink-0" aria-hidden="true">
                          <span
                            className="absolute left-1/2 top-1 bottom-1 w-1.5 rounded-full"
                            style={{
                              transform: 'translateX(-50%)',
                              background: done ? tint(subjectColor(slot.item.subject), 0.45) : subjectColor(slot.item.subject),
                            }}
                          />
                        </span>
                        <div
                          className="flex-1 min-w-0 px-3 py-1.5 flex flex-col justify-center"
                          style={{
                            background: done ? tint(CARD, 0.55) : CARD,
                            border: `1px solid ${done ? tint(BORDER, 0.5) : BORDER}`,
                            borderRadius: RADIUS.md,
                          }}
                        >
                          <p
                            className={`text-[12px] font-bold leading-snug truncate ${done ? 'line-through' : ''}`}
                            style={{ color: done ? TEXT_MUTED : TEXT }}
                          >
                            {slot.item.topic}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                            {slot.item.subject} · {slot.item.kind === 'revision' ? 'revision · ' : ''}~{formatDuration(slot.durationMinutes)}
                            {done ? ' · done' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* you are here — the current time on the road */}
                  <div
                    className="absolute left-0 right-0 flex items-center gap-1.5 pointer-events-none"
                    style={{ top: Math.max(0, Math.min(totalHeight, (nowMinutes - roadStartMin) * scale)) }}
                    data-testid="cal-road-now"
                  >
                    <span className="w-11 flex-shrink-0 text-right text-[10px] font-extrabold" style={{ color: AMBER }}>
                      {clockLabel(nowMinutes)}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 vicharak-here" style={{ background: AMBER }} aria-hidden="true" />
                    <span className="flex-1 h-px" style={{ background: AMBER, opacity: 0.7 }} aria-hidden="true" />
                    <span className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: AMBER }}>Now</span>
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* Milestones — the whole arc, start to exam day */}
          <Card radius={RADIUS.lg} className="p-4 vicharak-rise" style={{ background: CARD_SOFT, animationDelay: '90ms' }} testId="cal-road-view">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] mb-4" style={{ color: TEXT_MUTED }}>
              Milestones on the way
            </p>

            <div className="overflow-x-auto pb-2 -mx-1 px-1 vicharak-scroll-x">
              <div className="flex items-stretch" style={{ minWidth: Math.max(640, milestones.length * 108) }}>
                {milestones.map((m, idx) => {
                  const isLast = idx === milestones.length - 1;
                  const past = m.date <= today;
                  const isHere = m.type === 'here';
                  const nodeColor =
                    m.type === 'exam'
                      ? '#A78BFA'
                      : m.type === 'next'
                        ? '#60A5FA'
                      : m.type === 'test'
                        ? TEST_ORANGE
                        : m.type === 'chapter'
                          ? REVISION_GREEN
                          : isHere
                            ? AMBER
                            : past
                              ? roadColor
                              : TEXT_MUTED;
                  return (
                    <div key={`${m.type}-${m.date}-${idx}`} className="flex-1 min-w-[104px] relative flex flex-col items-center">
                      {/* road segment */}
                      {!isLast && (
                        <span
                          className="absolute top-[13px] left-1/2 w-full h-1 rounded-full"
                          style={{
                            background:
                              milestones[idx + 1].date <= today
                                ? roadColor
                                : `repeating-linear-gradient(90deg, ${TEXT_MUTED} 0 8px, transparent 8px 16px)`,
                            opacity: milestones[idx + 1].date <= today ? 0.85 : 0.4,
                          }}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center ${isHere ? 'vicharak-here' : ''}`}
                        style={{
                          border: `2px solid ${nodeColor}`,
                          background: isHere ? AMBER : past ? tint(nodeColor, 0.25) : NAVY,
                          color: isHere ? ON_AMBER : nodeColor,
                        }}
                      >
                        {m.type === 'start' ? (
                          <Flag className="w-3.5 h-3.5" />
                        ) : m.type === 'exam' ? (
                          <Target className="w-3.5 h-3.5" />
                        ) : m.type === 'next' ? (
                          <Sparkles className="w-3.5 h-3.5" />
                        ) : m.type === 'test' ? (
                          <Trophy className="w-3 h-3" />
                        ) : m.type === 'chapter' ? (
                          <Mountain className="w-3 h-3" />
                        ) : isHere ? (
                          <MapPin className="w-3.5 h-3.5" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                      <p
                        className="mt-2 text-[11px] font-extrabold text-center leading-tight px-1 max-w-[120px] truncate"
                        style={{ color: isHere ? AMBER : past ? TEXT : TEXT_MUTED }}
                        title={m.label}
                      >
                        {m.label}
                      </p>
                      {m.sub && (
                        <p className="text-[10px] text-center leading-tight px-1 max-w-[120px] truncate" style={{ color: TEXT_MUTED }}>
                          {m.sub}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3.5 flex-wrap mt-3">
              {(
                [
                  { color: REVISION_GREEN, label: 'chapter done' },
                  { color: TEST_ORANGE, label: 'test' },
                  { color: AMBER, label: 'you are here' },
                  { color: '#A78BFA', label: 'exam day' },
                ] as const
              ).map((l) => (
                <span key={l.label} className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: TEXT_MUTED }}>
                  <CategoryDot color={l.color} /> {l.label}
                </span>
              ))}
            </div>
          </Card>

          <p className="text-[11px] text-center px-4" style={{ color: TEXT_MUTED }}>
            The road takes the colour of your pace — keep checking topics off in Today and watch it stay green.
          </p>
        </div>
      )}

      {/* COMPACT DAY POPOVER — tapping a day opens a small popup anchored
          over the calendar (never a full-screen page): a date header, one
          summary line ("2 pending · 5 mistakes") and a dense list of the
          day's tasks, revisions, tests and Mistake Book reviews with an
          approximate time per item. Closing it leaves the student exactly
          where they were — on the Calendar. */}
      {dayDetailOpen && view !== 'road' && (() => {
        const pendingItems = selectedItems.filter((i) => i.status === 'pending');
        const doneItems = selectedItems.filter((i) => i.status === 'done');
        const summary =
          [
            pendingItems.length > 0 ? `${pendingItems.length} pending` : null,
            doneItems.length > 0 ? `${doneItems.length} done` : null,
            selectedTests.length > 0 ? `${selectedTests.length} test${selectedTests.length === 1 ? '' : 's'}` : null,
            selectedDoubtsDue.length > 0 ? `${selectedDoubtsDue.length} mistake${selectedDoubtsDue.length === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Nothing scheduled';
        const approx = (item: StudyItem) => `~${formatDuration(estimatedMinutes(undefined, item.kind))}`;
        return (
          <div
            className="fixed inset-0 z-[45] flex flex-col justify-end sm:items-center sm:justify-center sm:px-5"
            role="dialog"
            aria-modal="true"
            aria-label={`Day plan for ${dayTitle(selectedDay, today)}`}
            data-testid="cal-day-popover"
          >
            <button
              type="button"
              className="absolute inset-0"
              style={{ background: 'rgba(22,31,43,0.34)' }}
              onClick={() => setDayDetailOpen(false)}
              aria-label="Close day popup"
            />
            {/* The one place a shadow survives: this floats above the page. */}
            <div
              className="cal-popover relative w-full sm:max-w-sm max-h-[68vh] flex flex-col overflow-hidden vicharak-popup"
              style={{ background: SHEET, border: `1px solid ${RULE}`, boxShadow: POPOVER_SHADOW }}
            >
              {/* pinned header: date · summary · day hop · close */}
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 pt-3 pb-2.5" style={{ borderBottom: `1px solid ${RULE_SOFT}` }}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(addDaysISO(selectedDay, -1))}
                  aria-label="Previous day"
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                  style={{ border: `1px solid ${BORDER}`, background: CARD_SOFT, color: TEXT_SECONDARY }}
                  data-testid="cal-day-popover-prev"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <p
                    className="leading-tight truncate"
                    style={{ fontFamily: 'var(--f-head)', fontSize: '1.15rem', fontWeight: 800, color: INK }}
                    data-testid="cal-day-popover-title"
                  >
                    {fmt(selectedDay, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {selectedDay === today ? ' · Today' : ''}
                  </p>
                  <p className="truncate" style={{ fontSize: '0.75rem', color: INK_SOFT }} data-testid="cal-day-popover-summary">
                    {doneItems.length} of {selectedItems.length} done
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(addDaysISO(selectedDay, 1))}
                  aria-label="Next day"
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                  style={{ border: `1px solid ${BORDER}`, background: CARD_SOFT, color: TEXT_SECONDARY }}
                  data-testid="cal-day-popover-next"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDayDetailOpen(false)}
                  aria-label="Close"
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                  style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                  data-testid="cal-day-popover-close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* dense scrolling list — pending · tests · mistakes · completed */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                {pendingItems.length === 0 && selectedTests.length === 0 && selectedDoubtsDue.length === 0 && doneItems.length === 0 && (
                  <div className="px-1 py-3" data-testid="cal-day-popover-empty">
                    <EmptyLine>{selectedDay < today ? 'Nothing was scheduled here.' : 'Nothing here yet.'}</EmptyLine>
                  </div>
                )}
                <ul className="space-y-1">
                  {[...pendingItems]
                    .sort((a, b) => (a.kind !== b.kind ? (a.kind === 'revision' ? -1 : 1) : a.subject.localeCompare(b.subject)))
                    .map((item) => (
                      <li key={`pop-p-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => openEditor(item)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 text-left touch-manipulation"
                          style={{ minHeight: 44, borderTop: `1px solid ${RULE_SOFT}` }}
                          data-testid={`cal-day-popover-item-${item.id}`}
                        >
                          <span
                            className="flex-shrink-0"
                            style={{
                              width: 15,
                              height: 2.5,
                              borderRadius: 2,
                              background: selectedDay < today ? GONE : INK_SOFT,
                            }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block vicharak-hand truncate" style={{ color: INK }}>
                              {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                            </span>
                            <span className="block" style={{ fontSize: '0.72rem', color: INK_SOFT }}>
                              {item.subject}
                              {selectedDay < today ? <span style={{ color: GONE, fontWeight: 600 }}> · overdue</span> : ''}
                            </span>
                          </span>
                          <span className="tabular-nums flex-shrink-0" style={{ fontSize: '0.75rem', fontWeight: 600, color: INK_SOFT }}>
                            {approx(item)}
                          </span>
                        </button>
                      </li>
                    ))}
                  {selectedTests.map((t) => (
                    <li
                      key={`pop-t-${t.key}`}
                      className="flex items-center gap-2 px-2 py-1.5"
                      style={{ borderRadius: RADIUS.sm, background: CARD_SOFT, border: `1px solid ${tint(TEST_ORANGE, 0.35)}` }}
                      data-testid={`cal-day-popover-test-${t.key}`}
                    >
                      <Trophy className="w-3 h-3 flex-shrink-0" style={{ color: TEST_ORANGE }} />
                      <span className="min-w-0 flex-1 text-[12px] font-semibold truncate" style={{ color: TEXT }}>
                        {t.label ? `${t.subject} · ${t.label}` : `${t.subject} test`}
                      </span>
                      <span className="text-[10px] font-extrabold flex-shrink-0" style={{ color: TEST_ORANGE }}>{t.percent}%</span>
                    </li>
                  ))}
                  {selectedDoubtsDue.map((row) => (
                    <li
                      key={`pop-d-${row.id}`}
                      className="flex items-center gap-2 px-2 py-1.5"
                      style={{ borderRadius: RADIUS.sm, background: CARD_SOFT, border: `1px solid ${tint(DOUBT_ACCENT, 0.35)}` }}
                      data-testid={`cal-day-popover-doubt-${row.id}`}
                    >
                      <HelpCircle className="w-3 h-3 flex-shrink-0" style={{ color: DOUBT_ACCENT }} />
                      <span className="min-w-0 flex-1 text-[12px] font-semibold truncate" style={{ color: TEXT }}>
                        {(row.question_text ?? '').trim() || 'Photo mistake to review'}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: TEXT_MUTED }}>~3m</span>
                    </li>
                  ))}
                  {doneItems.map((item) => (
                    <li
                      key={`pop-c-${item.id}`}
                      className="flex items-center gap-2.5 px-2 py-2"
                      style={{ borderTop: `1px solid ${RULE_SOFT}` }}
                      data-testid={`cal-day-popover-done-${item.id}`}
                    >
                      <span
                        className="flex-shrink-0"
                        style={{ width: 15, height: 2.5, borderRadius: 2, background: KEPT, opacity: 0.55 }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 vicharak-hand truncate line-through" style={{ color: INK_SOFT }}>
                        {item.kind === 'revision' ? `Revised: ${item.topic}` : item.topic}
                      </span>
                      <span className="flex-shrink-0" style={{ fontSize: '0.72rem', color: INK_SOFT }}>{item.subject}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}



      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit calendar task">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(2,8,23,0.74)' }} onClick={() => setEditing(null)} aria-label="Close editor" />
          <div className="relative px-5 pt-5 pb-7 vicharak-sheet" style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }}> 
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-base font-extrabold" style={{ color: TEXT }}>Edit task</p>
                <p className="text-[11px]" style={{ color: TEXT_MUTED }}>Subject, topic, type, duration, date and time — all editable, nothing locked.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="text-xs font-bold px-2 py-1" style={{ color: TEXT_MUTED }}>Cancel</button>
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Subject
                <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="mt-1 w-full px-3 py-2.5 text-sm" style={{ background: NAVY, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }} />
              </label>
              <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Topic
                <input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} className="mt-1 w-full px-3 py-2.5 text-sm" style={{ background: NAVY, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Date
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="mt-1 w-full px-2 py-2.5 text-sm" style={{ background: NAVY, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }} />
                </label>
                <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Time
                  <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="mt-1 w-full px-2 py-2.5 text-sm" style={{ background: NAVY, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Type
                  <select value={editType} onChange={(e) => setEditType(e.target.value as TaskType)} className="mt-1 w-full px-3 py-2.5 text-sm" style={{ background: NAVY, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}>
                    {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Duration (min)
                  <input type="number" inputMode="numeric" min={5} max={1080} value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} placeholder="e.g. 45" className="mt-1 w-full px-3 py-2.5 text-sm" style={{ background: NAVY, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }} data-testid="cal-edit-minutes" />
                </label>
              </div>
              {editError && (
                <div
                  className="px-3.5 py-3"
                  role="alert"
                  style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.08), border: `1px solid ${tint(DANGER, 0.3)}` }}
                  data-testid="cal-edit-error"
                >
                  <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>{editError}</p>
                </div>
              )}
              <button
                type="button"
                disabled={savingEdit || !(editSubject ?? '').trim() || !(editTopic ?? '').trim() || !editDate}
                onClick={() => {
                  if (!editing) return;
                  const parsedMinutes = Math.round(Number(editMinutes));
                  setSavingEdit(true);
                  setEditError(null);
                  void onUpdateTask(editing, {
                    subject: (editSubject ?? '').trim(),
                    topic: (editTopic ?? '').trim(),
                    type: editType,
                    time: editTime,
                    minutes: (editMinutes ?? '').trim() !== '' && Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? Math.min(1080, parsedMinutes) : null,
                    scheduled_for: editDate,
                  })
                    .then(() => { setSelectedDay(editDate); setEditing(null); })
                    .catch(() => setEditError("That change didn't save. Check your connection and try again."))
                    .finally(() => setSavingEdit(false));
                }}
                className="w-full py-3 text-sm font-extrabold disabled:opacity-50"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="cal-save-task-edit"
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
