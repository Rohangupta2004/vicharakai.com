/**
 * Calendar tab — the big-picture screen, two ways to see the same journey.
 *
 *  • Calendar: a full-screen month grid at high information density. Every day
 *    carries dot indicators — blue for tasks, orange for tests, green for
 *    revision due. Tapping a day expands its full list underneath.
 *  • Road View: the entire prep arc as one linear journey — Started → week
 *    markers → chapter completions → tests → "You are here" → Exam Day. The road
 *    itself takes the colour of the pace signal.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  MapPin,
  Mountain,
  Pencil,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import {
  addDaysISO,
  buildDaySchedule,
  diffDays,
  formatDuration,
  topicKey,
  TASK_TYPES,
  type PaceSignal,
  type ScoreEntry,
  type StudyItem,
  type TaskType,
} from './engine';
import type { ExamDef } from './syllabus';
import { examLabelFromId, isCustomExamId } from './customExam';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  CARD,
  CARD_SOFT,
  DANGER,
  NAVY,
  ON_AMBER,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  subjectColor,
  tint,
} from './theme';
import { Card, SubjectChip } from './ui';

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
}) {
  const [view, setView] = useState<'calendar' | 'road'>('calendar');
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
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

  const openEditor = (item: StudyItem) => {
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
      const d = new Date();
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
      const date = it.completed_at.slice(0, 10);
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

  const monthPrefix = selectedDay.slice(0, 7);
  const selectedItems = tasksByDate.get(selectedDay) ?? [];
  const selectedTests = testsByDate.get(selectedDay) ?? [];
  const visibleSelectedItems = subjectFilter === 'All' ? selectedItems : selectedItems.filter((item) => item.subject === subjectFilter);

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

  /* "Next Study" — the single next thing on the plan (next task due, next
   * revision due, or the AI's recommended next topic), pinned prominently at
   * the top of the calendar so students never hunt for what's coming. */
  const nextStudy = useMemo(() => {
    const upcoming = items
      .filter((item) => item.status === 'pending' && item.scheduled_for >= today)
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.id - b.id);
    const first = upcoming[0];
    if (first) {
      return {
        date: first.scheduled_for,
        title: first.kind === 'revision' ? `Revise: ${first.topic}` : first.topic,
        subject: first.subject,
        detail: first.kind === 'revision' ? 'Revision due' : 'Study task',
      };
    }
    if (recommendedNext) {
      return {
        date: addDaysISO(today, 1),
        title: recommendedNext.topic,
        subject: recommendedNext.subject,
        detail: 'AI-recommended next topic',
      };
    }
    return null;
  }, [items, today, recommendedNext]);

  const nextStudyWhen = nextStudy
    ? nextStudy.date === today
      ? 'Today'
      : nextStudy.date === addDaysISO(today, 1)
        ? 'Tomorrow'
        : fmt(nextStudy.date, { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

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
          const date = (i.completed_at || '').slice(0, 10) || i.studied_on || i.scheduled_for;
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
    <div className="px-4 sm:px-5 pt-4 pb-24">
      {/* header: pace chip + view toggle */}
      <header className="vicharak-rise">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight" style={{ color: TEXT }}>
              Study Calendar
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>
              Your whole prep, one glance
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold"
              style={{
                borderRadius: RADIUS.chip,
                color: roadColor,
                background: tint(roadColor, 0.14),
                border: `1px solid ${tint(roadColor, 0.4)}`,
              }}
              data-testid="cal-pace-chip"
            >
              {pace.emoji} {pace.label}
            </span>
            {view === 'calendar' && (
              <button
                type="button"
                onClick={() => setSelectedDay(today)}
                className="px-3.5 py-1.5 text-xs font-extrabold transition-opacity hover:opacity-85"
                style={{ borderRadius: RADIUS.chip, background: AMBER, color: ON_AMBER }}
                data-testid="cal-button-today"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Calendar / Road toggle */}
        <div
          className="mt-3 inline-flex p-0.5 w-full"
          style={{ borderRadius: RADIUS.chip, background: tint(BORDER, 0.5), border: `1px solid ${BORDER}` }}
          role="tablist"
          aria-label="Calendar views"
        >
          {(
            [
              { id: 'calendar', label: 'Calendar' },
              { id: 'road', label: 'Road View' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className="flex-1 py-1.5 text-xs font-extrabold transition-all"
              style={
                view === v.id
                  ? { borderRadius: RADIUS.chip, background: AMBER, color: ON_AMBER }
                  : { borderRadius: RADIUS.chip, background: 'transparent', color: TEXT_SECONDARY }
              }
              data-testid={`cal-view-${v.id}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* NEXT STUDY — always visible: what's coming next, no hunting. */}
      <section
        className="mt-3 px-4 py-3.5 vicharak-rise"
        style={{
          borderRadius: RADIUS.lg,
          background: tint(AMBER, 0.1),
          border: `1px solid ${tint(AMBER, 0.4)}`,
        }}
        data-testid="card-next-study"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: AMBER }}>
          <Sparkles className="w-3 h-3" />
          Next Study
        </p>
        {nextStudy ? (
          <div className="mt-1.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-snug truncate" style={{ color: TEXT }} data-testid="text-next-study-title">
                {nextStudy.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: subjectColor(nextStudy.subject) }}>
                <span
                  className="rounded-full inline-block flex-shrink-0"
                  style={{ width: 6, height: 6, background: subjectColor(nextStudy.subject) }}
                  aria-hidden="true"
                />
                {nextStudy.subject}
                <span style={{ color: TEXT_MUTED }}>· {nextStudy.detail}</span>
              </p>
            </div>
            <span
              className="px-2.5 py-1 text-[11px] font-extrabold flex-shrink-0"
              style={{ borderRadius: RADIUS.chip, background: AMBER, color: ON_AMBER }}
              data-testid="chip-next-study-when"
            >
              {nextStudyWhen}
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-[13px] font-bold leading-snug" style={{ color: TEXT }}>
            Nothing scheduled yet — snap a doubt or ask the coach, and your next session appears here.
          </p>
        )}
        <p className="mt-1.5 text-[10px] font-bold" style={{ color: TEXT_MUTED }}>
          Exam Day · {fmt(examDate, { month: 'short', day: 'numeric' })} · {daysToExam} day{daysToExam === 1 ? '' : 's'} to go
        </p>
      </section>

      {view === 'calendar' ? (
        <div className="mt-3 space-y-4">
          {/* month navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedDay(addMonthsISO(selectedDay, -1))}
              aria-label="Previous month"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ border: `1px solid ${BORDER}`, background: CARD, color: TEXT_SECONDARY }}
              data-testid="cal-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-bold" style={{ color: TEXT }} data-testid="cal-period-label">
              {fmt(selectedDay, { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => setSelectedDay(addMonthsISO(selectedDay, 1))}
              aria-label="Next month"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ border: `1px solid ${BORDER}`, background: CARD, color: TEXT_SECONDARY }}
              data-testid="cal-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* the big month grid */}
          <Card radius={RADIUS.lg} className="p-2.5 vicharak-rise" style={{ background: CARD_SOFT }} testId="cal-month-grid">
            <div className="grid grid-cols-7 mb-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
                <span key={i} className="text-center text-[10px] font-extrabold uppercase" style={{ color: TEXT_MUTED }}>
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((iso) => {
                const inMonth = iso.slice(0, 7) === monthPrefix;
                const isToday = iso === today;
                const isSelected = iso === selectedDay;
                const dots = dotsFor(iso);
                const count = (tasksByDate.get(iso)?.length ?? 0) + (testsByDate.get(iso)?.length ?? 0);
                // CHANGE 7: cell colour follows the day's completed-task count.
                const doneCount = (completedByDate.get(iso) ?? []).length;
                const dayBg = doneCount >= 3 ? tint(SUCCESS, 0.2) : doneCount > 0 ? tint(WARNING, 0.18) : 'transparent';
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDay(iso)}
                    aria-label={`${fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' })}: ${count} entries, ${doneCount} completed`}
                    aria-pressed={isSelected}
                    className="py-1.5 flex flex-col items-center gap-1 transition-all touch-manipulation"
                    style={{
                      borderRadius: RADIUS.sm,
                      border: `1px solid ${isSelected ? BORDER_STRONG : 'transparent'}`,
                      background: isSelected ? tint(AMBER, 0.1) : dayBg,
                      opacity: inMonth ? 1 : 0.32,
                    }}
                    data-testid={`cal-cell-${iso}`}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={isToday ? { background: AMBER, color: ON_AMBER } : { color: inMonth ? TEXT : TEXT_MUTED }}
                    >
                      {Number(iso.slice(8, 10))}
                    </span>
                    <span className="flex items-center gap-0.5 h-1.5">
                      {dots.map((d, i) => (
                        <CategoryDot key={i} color={d.color} dim={d.dim} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-3.5 flex-wrap mt-2 pb-0.5">
              {(
                [
                  ...Array.from(new Set(items.map((item) => item.subject))).slice(0, 4).map((subject) => ({ color: subjectColor(subject), label: subject })),
                  { color: TEST_ORANGE, label: 'tests' },
                  { color: REVISION_GREEN, label: 'revision due' },
                  { color: SUCCESS, label: 'good day · 3+ done' },
                  { color: WARNING, label: 'partial day' },
                ] as const
              ).map((l) => (
                <span key={l.label} className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: TEXT_MUTED }}>
                  <CategoryDot color={l.color} /> {l.label}
                </span>
              ))}
            </div>
          </Card>

          {/* subject filter — chips appear once the plan spans 2+ subjects */}
          {filterSubjects.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 vicharak-scroll-x" data-testid="cal-subject-filter">
              {['All', ...filterSubjects].map((name) => {
                const active = subjectFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSubjectFilter(name)}
                    aria-pressed={active}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-all touch-manipulation"
                    style={active
                      ? { borderRadius: RADIUS.chip, background: AMBER, color: ON_AMBER, border: '1px solid transparent' }
                      : { borderRadius: RADIUS.chip, background: 'transparent', color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
                    data-testid={`cal-filter-${name}`}
                  >
                    {name !== 'All' && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectColor(name) }} aria-hidden="true" />
                    )}
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {/* selected day detail */}
          <section className="vicharak-rise" style={{ animationDelay: '60ms' }}>
            <h2 className="text-sm font-bold mb-2 px-0.5" style={{ color: TEXT }}>
              {dayTitle(selectedDay, today)}
            </h2>
            {/* CHANGE 7: what was actually completed on this day — the study
                history at a glance, shown before the planned list. */}
            {(completedByDate.get(selectedDay) ?? []).length > 0 && (
              <div
                className="mb-2 px-3.5 py-3 vicharak-rise"
                style={{ background: tint(SUCCESS, 0.08), border: `1px solid ${tint(SUCCESS, 0.3)}`, borderRadius: RADIUS.md }}
                data-testid="cal-completed-day"
              >
                <p className="text-[11px] font-extrabold" style={{ color: SUCCESS }}>
                  Completed this day · {(completedByDate.get(selectedDay) ?? []).length}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {(completedByDate.get(selectedDay) ?? []).slice(0, 8).map((item) => (
                    <li key={`done-${item.id}`} className="flex items-center gap-2 text-[12px]" style={{ color: TEXT_SECONDARY }}>
                      <Check className="w-3 h-3 flex-shrink-0" style={{ color: SUCCESS }} />
                      <span className="line-through truncate">{item.kind === 'revision' ? `Revised: ${item.topic}` : item.topic}</span>
                      <span className="text-[10px] flex-shrink-0" style={{ color: TEXT_MUTED }}>{item.subject}</span>
                    </li>
                  ))}
                  {(completedByDate.get(selectedDay) ?? []).length > 8 && (
                    <li className="text-[10px]" style={{ color: TEXT_MUTED }}>
                      +{(completedByDate.get(selectedDay) ?? []).length - 8} more
                    </li>
                  )}
                </ul>
              </div>
            )}
            {selectedTests.length > 0 && (
              <ul className="space-y-2 mb-2">
                {selectedTests.map((t) => (
                  <li
                    key={t.key}
                    className="px-3.5 py-3 flex items-center gap-3 vicharak-rise"
                    style={{ background: CARD, border: `1px solid ${tint(TEST_ORANGE, 0.35)}`, borderRadius: RADIUS.md }}
                    data-testid={`cal-test-${t.key}`}
                  >
                    <span
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{ borderRadius: RADIUS.sm, background: tint(TEST_ORANGE, 0.16) }}
                    >
                      <Trophy className="w-4 h-4" style={{ color: TEST_ORANGE }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: TEXT }}>
                        {t.label ? `${t.subject} · ${t.label}` : `${t.subject} test`}
                      </p>
                      <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                        {t.marks !== null && t.total !== null ? `${t.marks} / ${t.total} marks` : 'Logged score'}
                      </p>
                    </div>
                    <span className="text-base font-extrabold flex-shrink-0" style={{ color: TEST_ORANGE }}>
                      {t.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {visibleSelectedItems.length === 0 && selectedTests.length === 0 ? (
              <div
                className="p-6 text-center vicharak-rise"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="cal-empty-day"
              >
                <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: TEXT_MUTED }} />
                <p className="text-xs" style={{ color: TEXT_MUTED }}>
                  {subjectFilter !== 'All' && selectedItems.length > 0
                    ? `Nothing in ${subjectFilter} this day — tap All to see the full list.`
                    : selectedDay < today
                      ? 'Nothing was scheduled this day — every prep journey needs quiet days.'
                      : 'Nothing scheduled this day yet — revisions land here as you finish topics.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {[...visibleSelectedItems]
                  .sort((a, b) => {
                    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
                    if (a.kind !== b.kind) return a.kind === 'revision' ? -1 : 1;
                    return a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic);
                  })
                  .map((item) => (
                    <TaskCard key={item.id} item={item} today={today} onEdit={openEditor} />
                  ))}
              </ul>
            )}
          </section>
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
                  Nothing on today's road yet — tasks VicharakAI plans from your history and doubts appear here, sized to their duration.
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

      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit calendar task">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(2,8,23,0.74)' }} onClick={() => setEditing(null)} aria-label="Close editor" />
          <div className="relative px-5 pt-5 pb-7" style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }}>
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
              <button
                type="button"
                disabled={savingEdit || !editSubject.trim() || !editTopic.trim() || !editDate}
                onClick={() => {
                  if (!editing) return;
                  const parsedMinutes = Math.round(Number(editMinutes));
                  setSavingEdit(true);
                  void onUpdateTask(editing, {
                    subject: editSubject.trim(),
                    topic: editTopic.trim(),
                    type: editType,
                    time: editTime,
                    minutes: editMinutes.trim() !== '' && Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? Math.min(1080, parsedMinutes) : null,
                    scheduled_for: editDate,
                  })
                    .then(() => { setSelectedDay(editDate); setEditing(null); })
                    .finally(() => setSavingEdit(false));
                }}
                className="w-full py-3 text-sm font-extrabold disabled:opacity-50"
                style={{ borderRadius: RADIUS.chip, background: AMBER, color: ON_AMBER }}
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
