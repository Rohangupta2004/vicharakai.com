import { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  MapPin,
  Mountain,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import {
  addDaysISO,
  computePace,
  diffDays,
  mergeScoreEntries,
  todayISO,
  topicKey,
  type ScoreEntry,
  type StudyItem,
  type TestResult,
  type TestScore,
} from '../ZunoPlan/engine';
import { defaultExamDate, getExam } from '../ZunoPlan/syllabus';
import { requestPlanTab, ZunoBottomNav } from '../ZunoPlan/ui';

/* =====================================================================
 * VicharakAI Calendar — the big-picture screen.
 *
 * Two ways to see the same journey:
 *  • Calendar — a full-screen month grid; every day carries dot indicators:
 *    tasks (blue) · tests (orange) · revision (green). Tap a day to expand.
 *  • Road View — the whole prep arc as a horizontal journey: Started →
 *    weeks → chapter completions → tests → You are here → Exam Day.
 *    The road itself is coloured by the pace signal.
 *
 * Reads the SAME WorkspaceDB data My Plan writes (`zuno_items`,
 * `zuno_scores`, `zuno_meta`), so everything stays in sync.
 *
 * Theme (deliberate, scoped): VicharakAI night mode — deep indigo/violet
 * gradients with warm amber accents, matching the brand.
 * =================================================================== */

const INDIGO = '#818CF8';
const VIOLET = '#A78BFA';
const AMBER = '#FBBF24';
const TASK_BLUE = '#60A5FA';
const TEST_ORANGE = '#FB923C';
const REVISION_GREEN = '#4ADE80';
const PAGE_BG = 'linear-gradient(180deg,#1E1B4B 0%,#171533 55%,#0B0A1A 100%)';
const CARD_BG = '#211E4A';
const CARD_BG_SOFT = '#262254';
const BORDER = 'rgba(129,140,248,0.18)';
const BORDER_STRONG = 'rgba(129,140,248,0.45)';
const TEXT_PRIMARY = '#EAE8FD';
const TEXT_SECONDARY = '#B0ACE0';
const TEXT_MUTED = '#7B77AD';

const MOTION_CSS = `
@keyframes zcalRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.zcal-rise { animation: zcalRise 0.32s ease-out both; }
@keyframes zcalPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.45); } 50% { box-shadow: 0 0 0 9px rgba(251,191,36,0); } }
.zcal-here { animation: zcalPulse 2.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .zcal-rise, .zcal-here { animation: none !important; } }
`;

/* ---------- date helpers ---------- */

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

/* ---------- sample NEET week (only when no real plan exists yet) ---------- */

function buildSampleWeek(today: string): StudyItem[] {
  type Spec = { off: number; subject: string; topic: string; interval?: number; doneToday?: boolean };
  const specs: Spec[] = [
    { off: -4, subject: 'Physics', topic: 'Motion in a straight line' },
    { off: -4, subject: 'Chemistry', topic: 'Mole concept & molar mass' },
    { off: -4, subject: 'Biology', topic: 'Taxonomy & nomenclature' },
    { off: -3, subject: 'Physics', topic: 'Projectile motion' },
    { off: -3, subject: 'Biology', topic: 'Five kingdom classification' },
    { off: -3, subject: 'Physics', topic: 'Motion in a straight line', interval: 1 },
    { off: -2, subject: 'Chemistry', topic: 'Bohr model & spectra' },
    { off: -2, subject: 'Biology', topic: 'Cell organelles' },
    { off: -2, subject: 'Chemistry', topic: 'Mole concept & molar mass', interval: 1 },
    { off: -1, subject: 'Physics', topic: "Newton's laws & applications" },
    { off: -1, subject: 'Biology', topic: 'Root, stem & leaf morphology' },
    { off: -1, subject: 'Physics', topic: 'Projectile motion', interval: 1 },
    { off: 0, subject: 'Physics', topic: 'Work-energy theorem', doneToday: true },
    { off: 0, subject: 'Chemistry', topic: 'Ionic & covalent bonds' },
    { off: 0, subject: 'Biology', topic: 'Photosynthesis' },
    { off: 0, subject: 'Physics', topic: 'Motion in a straight line', interval: 3 },
    { off: 0, subject: 'Biology', topic: 'Five kingdom classification', interval: 3 },
    { off: 1, subject: 'Physics', topic: 'Torque & angular momentum' },
    { off: 1, subject: 'Biology', topic: 'Digestive system' },
    { off: 1, subject: 'Chemistry', topic: 'Bohr model & spectra', interval: 3 },
    { off: 2, subject: 'Chemistry', topic: 'Enthalpy & Hess law' },
    { off: 2, subject: 'Biology', topic: 'Ecosystem structure & energy flow' },
    { off: 2, subject: 'Physics', topic: 'Projectile motion', interval: 3 },
    { off: 3, subject: 'Physics', topic: 'Simple harmonic motion' },
    { off: 3, subject: 'Biology', topic: 'Mendelian inheritance' },
    { off: 3, subject: 'Chemistry', topic: 'Mole concept & molar mass', interval: 5 },
    { off: 4, subject: 'Chemistry', topic: 'Oxidation numbers & balancing' },
    { off: 4, subject: 'Biology', topic: 'Root, stem & leaf morphology', interval: 5 },
    { off: 5, subject: 'Biology', topic: 'DNA structure & replication' },
    { off: 5, subject: 'Physics', topic: "Newton's laws & applications", interval: 5 },
    { off: 6, subject: 'Physics', topic: 'Motion in a straight line', interval: 7 },
    { off: 7, subject: 'Chemistry', topic: 'Rate of reaction & rate laws' },
    { off: 7, subject: 'Biology', topic: 'Origin of life & evidences' },
  ];
  return specs.map((s, idx) => {
    const scheduled = addDaysISO(today, s.off);
    const isRevision = typeof s.interval === 'number';
    const done = s.off < 0 || (s.off === 0 && !!s.doneToday);
    return {
      id: -(idx + 1),
      exam: 'neet',
      subject: s.subject,
      topic: s.topic,
      kind: isRevision ? 'revision' : 'new',
      day_number: null,
      scheduled_for: scheduled,
      status: done ? 'done' : 'pending',
      completed_at: done ? `${scheduled}T18:00:00.000Z` : null,
      studied_on: isRevision ? addDaysISO(scheduled, -(s.interval as number)) : done ? scheduled : null,
      interval_days: s.interval ?? null,
      source_key: topicKey(s.subject, s.topic),
    };
  });
}

/* ---------- small building blocks ---------- */

function CategoryDot({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: color, opacity: dim ? 0.35 : 1 }}
      aria-hidden="true"
    />
  );
}

function TaskCard({ item, today }: { item: StudyItem; today: string }) {
  const done = item.status === 'done';
  const isRevision = item.kind === 'revision';
  const color = isRevision ? REVISION_GREEN : TASK_BLUE;
  const due = isRevision && item.status === 'pending' && item.scheduled_for <= today;
  return (
    <li
      className="rounded-2xl border px-3.5 py-3 flex items-start gap-3 zcal-rise"
      style={{
        background: done ? 'rgba(33,30,74,0.55)' : CARD_BG,
        borderColor: done ? 'rgba(129,140,248,0.08)' : BORDER,
      }}
      data-testid={`zcal-task-${item.id}`}
    >
      <span
        className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border"
        style={
          done
            ? { background: 'rgba(129,140,248,0.22)', borderColor: 'transparent', color: INDIGO }
            : { background: 'transparent', borderColor: color }
        }
        aria-hidden="true"
      >
        {done ? <Check className="w-3 h-3" /> : null}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold leading-snug ${done ? 'line-through' : ''}`}
          style={{ color: done ? TEXT_MUTED : TEXT_PRIMARY }}
        >
          {item.topic}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              color: done ? TEXT_MUTED : color,
              background: done ? 'rgba(123,119,173,0.12)' : `color-mix(in srgb, ${color} 14%, transparent)`,
            }}
          >
            <CategoryDot color={color} dim={done} />
            {item.subject}
          </span>
          {isRevision && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={
                done
                  ? { color: TEXT_MUTED, background: 'rgba(123,119,173,0.12)' }
                  : due
                    ? { color: '#1E1B4B', background: REVISION_GREEN }
                    : { color: REVISION_GREEN, background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.35)' }
              }
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

/* ---------- main app ---------- */

type DBHook = <T>(
  table: string,
  options?: {
    limit?: number;
    orderBy?: { column: string; direction: 'asc' | 'desc' };
  },
) => { data: T[]; loading: boolean; error: Error | null; refresh: () => void };

interface ZunoProfile {
  id: number;
  exam: string;
  start_date: string;
}

interface ZunoMetaRow {
  id: number;
  meta_key: string;
  meta_value: string | null;
}

interface Milestone {
  date: string;
  label: string;
  sub?: string;
  type: 'start' | 'week' | 'chapter' | 'test' | 'here' | 'exam';
}

export function ZunoCalendarBody({ embedded }: { embedded?: boolean }) {
  const db = (window as unknown as { useWorkspaceDB: DBHook }).useWorkspaceDB;
  const itemsQ = db<StudyItem>('zuno_items', { limit: 500, orderBy: { column: 'id', direction: 'asc' } });
  const profileQ = db<ZunoProfile>('zuno_profile', { limit: 1 });
  const scoresQ = db<TestScore>('zuno_scores', { limit: 200, orderBy: { column: 'id', direction: 'asc' } });
  const resultsQ = db<TestResult>('zuno_test_scores', { limit: 200, orderBy: { column: 'id', direction: 'asc' } });
  const metaQ = db<ZunoMetaRow>('zuno_meta', { limit: 200 });

  const today = todayISO();
  const [view, setView] = useState<'calendar' | 'road'>('calendar');
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const roadScrollRef = useRef<HTMLDivElement | null>(null);

  const usingSample = !itemsQ.loading && (itemsQ.data?.length ?? 0) === 0;
  const items = useMemo(
    () => (usingSample ? buildSampleWeek(today) : itemsQ.data ?? []),
    [usingSample, itemsQ.data, today],
  );
  const scores = useMemo(
    () => (usingSample ? [] : mergeScoreEntries(resultsQ.data ?? [], scoresQ.data ?? [])),
    [usingSample, resultsQ.data, scoresQ.data],
  );

  const profile = profileQ.data?.[0];
  const examId = profile?.exam || 'neet';
  const examDef = getExam(examId);
  const metaMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of metaQ.data ?? []) if (row.meta_value) m.set(row.meta_key, row.meta_value);
    return m;
  }, [metaQ.data]);
  const examDate = metaMap.get('exam_date') || (examDef ? defaultExamDate(examDef, today) : addDaysISO(today, 180));
  const pace = useMemo(() => computePace(items, examDef, examDate, today), [items, examDef, examDate, today]);
  const daysToExam = Math.max(0, diffDays(today, examDate));

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

  /* Month grid: Mon-start weeks covering the month of selectedDay. */
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

  /* Category dots for a day: tasks (blue) · tests (orange) · revision (green). */
  const dotsFor = (iso: string): Array<{ color: string; dim: boolean }> => {
    const dayItems = tasksByDate.get(iso) ?? [];
    const dots: Array<{ color: string; dim: boolean }> = [];
    const news = dayItems.filter((i) => i.kind === 'new');
    const revs = dayItems.filter((i) => i.kind === 'revision');
    if (news.length > 0) dots.push({ color: TASK_BLUE, dim: news.every((i) => i.status === 'done') });
    if (testsByDate.has(iso)) dots.push({ color: TEST_ORANGE, dim: false });
    if (revs.length > 0) dots.push({ color: REVISION_GREEN, dim: revs.every((i) => i.status === 'done') });
    return dots;
  };

  /* ---------- Road View data ---------- */

  const roadStart = profile?.start_date || items[0]?.scheduled_for || today;
  const milestones = useMemo<Milestone[]>(() => {
    const list: Milestone[] = [{ date: roadStart, label: 'Started', sub: fmt(roadStart, { month: 'short', day: 'numeric' }), type: 'start' }];

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
      list.push({ date: s.taken_on, label: s.label ? `${s.subject}: ${s.label}` : `${s.subject} test`, sub: `${s.percent}%`, type: 'test' });
    }

    list.push({ date: today, label: 'You are here', sub: fmt(today, { month: 'short', day: 'numeric' }), type: 'here' });
    list.push({ date: examDate, label: 'Exam Day', sub: `${examDef?.target.label ?? examId.toUpperCase()} · ${fmt(examDate, { month: 'short', day: 'numeric' })}`, type: 'exam' });

    return list.sort((a, b) => (a.date === b.date ? (a.type === 'here' ? 1 : -1) : a.date.localeCompare(b.date)));
  }, [roadStart, today, examDate, examDef, items, scores, examId]);

  const roadColor = pace.status === 'green' ? REVISION_GREEN : pace.status === 'amber' ? AMBER : '#F87171';

  const goToday = () => setSelectedDay(today);

  if (itemsQ.loading || profileQ.loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 py-20" style={{ background: PAGE_BG }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: BORDER, borderTopColor: INDIGO }} />
        <p className="text-sm" style={{ color: TEXT_MUTED }}>
          Opening your study calendar…
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-full flex flex-col w-full" style={{ background: PAGE_BG, color: TEXT_PRIMARY }}>
      <style>{MOTION_CSS}</style>

      {/* ---------- header ---------- */}
      <header className="px-4 sm:px-5 pt-4 pb-2 zcal-rise">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(129,140,248,0.16)', border: `1px solid ${BORDER}` }}
            >
              <CalendarDays style={{ color: INDIGO, width: 18, height: 18 }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight" style={{ color: TEXT_PRIMARY }}>
                Calendar
              </h1>
              <p className="text-[11px] leading-tight" style={{ color: TEXT_MUTED }}>
                Your whole prep, one glance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ color: roadColor, background: `color-mix(in srgb, ${roadColor} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${roadColor} 35%, transparent)` }}
              data-testid="zcal-pace-chip"
            >
              {pace.emoji} {pace.label}
            </span>
            {view === 'calendar' && (
              <button
                type="button"
                onClick={goToday}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-opacity hover:opacity-85"
                style={{ background: INDIGO, color: '#14122E' }}
                data-testid="zcal-button-today"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {usingSample && (
          <p
            className="mt-2.5 rounded-xl border px-3 py-2 text-[11px] flex items-center gap-1.5"
            style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', color: AMBER }}
            data-testid="zcal-sample-note"
          >
            <Sparkles className="w-3 h-3 flex-shrink-0" />
            Sample NEET week — pick your exam in Today and this fills with your real study data.
          </p>
        )}

        {/* Calendar / Road toggle */}
        <div
          className="mt-3 inline-flex rounded-full p-0.5 w-full"
          style={{ background: 'rgba(129,140,248,0.1)', border: `1px solid ${BORDER}` }}
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
              className="flex-1 py-1.5 rounded-full text-xs font-bold transition-all"
              style={view === v.id ? { background: INDIGO, color: '#14122E' } : { background: 'transparent', color: TEXT_SECONDARY }}
              data-testid={`zcal-tab-${v.id}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* month navigation (calendar view only) */}
        {view === 'calendar' && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedDay(addMonthsISO(selectedDay, -1))}
              aria-label="Previous month"
              className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors"
              style={{ borderColor: BORDER, background: CARD_BG, color: TEXT_SECONDARY }}
              data-testid="zcal-nav-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }} data-testid="zcal-period-label">
              {fmt(selectedDay, { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => setSelectedDay(addMonthsISO(selectedDay, 1))}
              aria-label="Next month"
              className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors"
              style={{ borderColor: BORDER, background: CARD_BG, color: TEXT_SECONDARY }}
              data-testid="zcal-nav-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* ---------- body ---------- */}
      <div className="flex-1 px-4 sm:px-5 pt-2 pb-4">
        {view === 'calendar' ? (
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-2.5 zcal-rise"
              style={{ background: CARD_BG_SOFT, borderColor: BORDER }}
              data-testid="zcal-month-grid"
            >
              <div className="grid grid-cols-7 mb-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
                  <span key={i} className="text-center text-[10px] font-bold uppercase" style={{ color: TEXT_MUTED }}>
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
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDay(iso)}
                      aria-label={`${fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' })}: ${count} entries`}
                      aria-pressed={isSelected}
                      className="rounded-xl py-1.5 flex flex-col items-center gap-1 border transition-all touch-manipulation"
                      style={{
                        borderColor: isSelected ? BORDER_STRONG : 'transparent',
                        background: isSelected ? 'rgba(129,140,248,0.12)' : 'transparent',
                        opacity: inMonth ? 1 : 0.32,
                      }}
                      data-testid={`zcal-month-cell-${iso}`}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={isToday ? { background: INDIGO, color: '#14122E' } : { color: inMonth ? TEXT_PRIMARY : TEXT_MUTED }}
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
                    { color: TASK_BLUE, label: 'tasks' },
                    { color: TEST_ORANGE, label: 'tests' },
                    { color: REVISION_GREEN, label: 'revision' },
                  ] as const
                ).map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: TEXT_MUTED }}>
                    <CategoryDot color={l.color} /> {l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* selected day detail */}
            <section className="zcal-rise" style={{ animationDelay: '60ms' }}>
              <h2 className="text-sm font-semibold mb-2 px-0.5" style={{ color: TEXT_PRIMARY }}>
                {dayTitle(selectedDay, today)}
              </h2>
              {selectedTests.length > 0 && (
                <ul className="space-y-2 mb-2">
                  {selectedTests.map((t) => (
                    <li
                      key={t.key}
                      className="rounded-2xl border px-3.5 py-3 flex items-center gap-3 zcal-rise"
                      style={{ background: CARD_BG, borderColor: 'rgba(251,146,60,0.35)' }}
                      data-testid={`zcal-test-${t.key}`}
                    >
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,146,60,0.15)' }}>
                        <Trophy className="w-4 h-4" style={{ color: TEST_ORANGE }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>
                          {t.label ? `${t.subject} · ${t.label}` : `${t.subject} test`}
                        </p>
                        <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                          {t.marks !== null && t.total !== null ? `${t.marks} / ${t.total} marks` : 'Logged score'}
                        </p>
                      </div>
                      <span className="text-base font-bold flex-shrink-0" style={{ color: TEST_ORANGE }}>
                        {t.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {selectedItems.length === 0 && selectedTests.length === 0 ? (
                <div
                  className="rounded-2xl border p-6 text-center zcal-rise"
                  style={{ background: CARD_BG, borderColor: BORDER }}
                  data-testid="zcal-empty-day"
                >
                  <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: TEXT_MUTED }} />
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>
                    {selectedDay < today
                      ? 'Nothing was scheduled this day — every prep journey needs quiet days.'
                      : 'Nothing scheduled this day yet — revisions land here as you finish topics.'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {[...selectedItems]
                    .sort((a, b) => {
                      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
                      if (a.kind !== b.kind) return a.kind === 'revision' ? -1 : 1;
                      return a.topic.localeCompare(b.topic);
                    })
                    .map((item) => (
                      <TaskCard key={item.id} item={item} today={today} />
                    ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          /* ---------- ROAD VIEW ---------- */
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-4 zcal-rise"
              style={{ background: CARD_BG_SOFT, borderColor: BORDER }}
              data-testid="zcal-road-view"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
                  Your journey to {examDef?.target.label ?? examId.toUpperCase()}
                </p>
                <span className="text-[11px] font-bold" style={{ color: roadColor }}>
                  {daysToExam} days left
                </span>
              </div>
              <p className="text-[11px] mb-4" style={{ color: TEXT_MUTED }}>
                {pace.detail}
              </p>

              <div ref={roadScrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
                <div className="flex items-stretch" style={{ minWidth: Math.max(640, milestones.length * 108) }}>
                  {milestones.map((m, idx) => {
                    const isLast = idx === milestones.length - 1;
                    const past = m.date <= today;
                    const isHere = m.type === 'here';
                    const nodeColor =
                      m.type === 'exam'
                        ? VIOLET
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
                          className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 ${isHere ? 'zcal-here' : ''}`}
                          style={{
                            background: isHere ? AMBER : past ? `color-mix(in srgb, ${nodeColor} 25%, #14122E)` : '#14122E',
                            borderColor: nodeColor,
                            color: isHere ? '#1E1B4B' : nodeColor,
                          }}
                        >
                          {m.type === 'start' ? (
                            <Flag className="w-3.5 h-3.5" />
                          ) : m.type === 'exam' ? (
                            <Target className="w-3.5 h-3.5" />
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
                          className="mt-2 text-[11px] font-bold text-center leading-tight px-1 max-w-[120px] truncate"
                          style={{ color: isHere ? AMBER : past ? TEXT_PRIMARY : TEXT_MUTED }}
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
                    { color: VIOLET, label: 'exam day' },
                  ] as const
                ).map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: TEXT_MUTED }}>
                    <CategoryDot color={l.color} /> {l.label}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-center px-4" style={{ color: TEXT_MUTED }}>
              The road takes the colour of your pace — keep checking topics off in Today and watch it stay green.
            </p>
          </div>
        )}

        {itemsQ.error && (
          <p className="text-xs text-center mt-4" style={{ color: '#F87171' }}>
            Couldn't sync your calendar: {itemsQ.error.message}
          </p>
        )}
      </div>

      {/* ---------- pinned exam countdown (embedded mode only; standalone shows nav) ---------- */}
      {embedded && (
        <div className="sticky bottom-0 z-10 px-4 sm:px-5 pt-2 pb-3" style={{ background: 'linear-gradient(to top, #0B0A1A 45%, transparent)' }}>
          <div
            className="rounded-full border px-4 py-2.5 flex items-center justify-center gap-2 backdrop-blur-md"
            style={{ borderColor: BORDER_STRONG, background: 'rgba(30,27,75,0.88)', boxShadow: '0 8px 28px rgba(129,140,248,0.18)' }}
            data-testid="zcal-exam-countdown"
          >
            <Target className="w-4 h-4 flex-shrink-0" style={{ color: INDIGO }} />
            <p className="text-sm font-bold tracking-wide" style={{ color: INDIGO }}>
              {examDef?.target.label ?? examId.toUpperCase()} · {daysToExam} day{daysToExam === 1 ? '' : 's'} remaining
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ZunoCalendar() {
  return (
    <div className="min-h-full flex flex-col w-full" style={{ background: PAGE_BG }}>
      <div className="flex-1">
        <ZunoCalendarBody />
      </div>
      <ZunoBottomNav
        active="calendar"
        variant="dark"
        onSelect={(tab) => {
          if (tab === 'calendar') return;
          requestPlanTab(tab);
        }}
      />
    </div>
  );
}
