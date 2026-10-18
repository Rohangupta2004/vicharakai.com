/**
 * SyllabusTaskPicker — the POWER add-task flow.
 *
 * A FULL-SCREEN picker over the exam syllabus: search at the top, then
 * subjects → chapters → topics as a browsable tree. Tapping topics ticks them
 * and the pinned "Add to Today" button drops every ticked topic onto today's
 * list in one go. Each topic shows an estimated study time so the student can
 * see what a day's worth of picks actually costs.
 *
 * This is deliberately separate from the quick inline add on the Today card:
 * that one is for typing a task in two seconds, this one is for planning from
 * the syllabus. Free text still has a home — "Type a custom task" hands over
 * to the classic add sheet.
 *
 * Data comes from the student's own exam (TopicPickerSubject tree). When no
 * structured syllabus is loaded for their exam, a compact built-in JEE / NEET
 * outline stands in so the flow is never empty.
 */
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '../../shared/useDebouncedValue';
import { BookOpen, Check, ChevronDown, Clock, Loader2, PenLine, Plus, Search, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  NAVY,
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
} from '../../theme';
import { SubjectDot } from '../../ui';
import { formatDuration } from '../../engine';
import type { TopicPickerSubject } from '../../TopicPicker';

export interface SyllabusTaskPick {
  subject: string;
  chapter: string;
  topic: string;
  /** The lecture/class number this topic maps to (sequential per subject). */
  lectureNo?: number;
}

/** "Lecture 03" — zero-padded so the badges line up in a dense list. */
function lectureLabel(n: number): string {
  return `Lec ${String(n).padStart(2, '0')}`;
}

/** Rows in the checklist use the same squared-off task-list radius. */
const ROW_RADIUS = 8;

/* ------------------------------------------------------------------ */
/*  Built-in outline — only used when the exam has no loaded syllabus  */
/* ------------------------------------------------------------------ */

const FALLBACK_JEE: TopicPickerSubject[] = [
  {
    name: 'Physics',
    chapters: [
      { name: 'Kinematics', weightage: 'medium', topics: ['Motion in a straight line', 'Motion in a plane', 'Relative velocity', 'Projectile motion'] },
      { name: 'Laws of Motion', weightage: 'high', topics: ['Newton’s laws', 'Friction', 'Circular motion dynamics'] },
      { name: 'Thermodynamics', weightage: 'high', topics: ['First law', 'Thermodynamic processes', 'Heat engines & efficiency'] },
      { name: 'Current Electricity', weightage: 'high', topics: ['Ohm’s law & resistivity', 'Kirchhoff’s laws', 'Wheatstone bridge', 'RC circuits'] },
    ],
  },
  {
    name: 'Chemistry',
    chapters: [
      { name: 'Chemical Bonding', weightage: 'high', topics: ['VSEPR theory', 'Hybridisation', 'Molecular orbital theory'] },
      { name: 'Thermodynamics & Equilibrium', weightage: 'medium', topics: ['Enthalpy & entropy', 'Gibbs free energy', 'Le Chatelier’s principle'] },
      { name: 'Organic Chemistry — Basics', weightage: 'high', topics: ['Reaction types', 'Inductive & resonance effects', 'Isomerism'] },
      { name: 'Coordination Compounds', weightage: 'medium', topics: ['Nomenclature', 'Crystal field theory', 'Isomerism in complexes'] },
    ],
  },
  {
    name: 'Mathematics',
    chapters: [
      { name: 'Quadratic Equations', weightage: 'medium', topics: ['Nature of roots', 'Common roots', 'Range of quadratic expressions'] },
      { name: 'Calculus — Differentiation', weightage: 'high', topics: ['Limits & continuity', 'Chain rule', 'Maxima & minima'] },
      { name: 'Integral Calculus', weightage: 'high', topics: ['Indefinite integrals', 'Definite integrals', 'Area under curves'] },
      { name: 'Coordinate Geometry', weightage: 'medium', topics: ['Straight lines', 'Circles', 'Parabola, ellipse & hyperbola'] },
    ],
  },
];

const FALLBACK_NEET: TopicPickerSubject[] = [
  {
    name: 'Physics',
    chapters: [
      { name: 'Laws of Motion', weightage: 'high', topics: ['Newton’s laws', 'Friction', 'Circular motion'] },
      { name: 'Current Electricity', weightage: 'high', topics: ['Ohm’s law', 'Kirchhoff’s laws', 'Meter bridge & potentiometer'] },
      { name: 'Optics', weightage: 'medium', topics: ['Reflection & refraction', 'Lenses', 'Wave optics basics'] },
    ],
  },
  {
    name: 'Chemistry',
    chapters: [
      { name: 'Chemical Bonding', weightage: 'high', topics: ['VSEPR theory', 'Hybridisation', 'Hydrogen bonding'] },
      { name: 'Organic Chemistry — Reaction Types', weightage: 'high', topics: ['Substitution reactions', 'Addition reactions', 'Elimination reactions'] },
      { name: 'Biomolecules', weightage: 'medium', topics: ['Carbohydrates', 'Proteins & enzymes', 'Nucleic acids'] },
    ],
  },
  {
    name: 'Biology',
    chapters: [
      { name: 'Cell Structure & Function', weightage: 'high', topics: ['Cell organelles', 'Cell cycle & division', 'Biomembranes'] },
      { name: 'Human Physiology', weightage: 'high', topics: ['Digestion & absorption', 'Breathing & exchange of gases', 'Neural control & coordination'] },
      { name: 'Genetics & Evolution', weightage: 'high', topics: ['Mendelian inheritance', 'Molecular basis of inheritance', 'Evolutionary evidence'] },
      { name: 'Ecology', weightage: 'medium', topics: ['Organisms & populations', 'Ecosystem', 'Biodiversity & conservation'] },
    ],
  },
];

function fallbackTreeFor(examLabel: string): TopicPickerSubject[] {
  return /neet|medic|mbbs|aiims/i.test(examLabel) ? FALLBACK_NEET : FALLBACK_JEE;
}

/** Rough per-topic study estimate — heavier chapters get a longer block. */
function estimateTopicMinutes(weightage?: 'high' | 'medium' | 'low'): number {
  if (weightage === 'high') return 60;
  if (weightage === 'low') return 30;
  return 45;
}

function normalize(value: string): string {
  return (value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ') ?? '').trim();
}

interface FlatTopic {
  subject: string;
  chapter: string;
  topic: string;
  minutes: number;
  /** Sequential lecture number within the subject (chapter order). */
  lectureNo: number;
}

const MAX_SEARCH_HITS = 60;

export default function SyllabusTaskPicker({
  examLabel,
  subjects,
  queuedTopics = [],
  saving = false,
  onAdd,
  onClose,
  onCustomTask,
}: {
  /** Human name of the exam whose syllabus is shown (e.g. "NEET UG"). */
  examLabel: string;
  subjects: TopicPickerSubject[];
  /** Topics already queued on today — rendered as ticked “already on today”. */
  queuedTopics?: string[];
  saving?: boolean;
  onAdd: (picks: SyllabusTaskPick[]) => void;
  onClose: () => void;
  /** Hands over to the classic add sheet for a free-text task. */
  onCustomTask?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [picked, setPicked] = useState<SyllabusTaskPick[]>([]);

  const usingFallback = subjects.length === 0;
  const tree = usingFallback ? fallbackTreeFor(examLabel) : subjects;

  /* Every topic flattened WITH its lecture number: lectures run sequentially
   * through each subject in chapter order, so "Kinematics → Lecture 03 →
   * Motion in a Straight Line" reads exactly like the class schedule. */
  const flat = useMemo<FlatTopic[]>(() => {
    const rows: FlatTopic[] = [];
    for (const subject of tree) {
      let lecture = 0;
      for (const chapter of subject.chapters) {
        const minutes = estimateTopicMinutes(chapter.weightage);
        for (const topic of chapter.topics) {
          lecture += 1;
          rows.push({ subject: subject.name, chapter: chapter.name, topic, minutes, lectureNo: lecture });
        }
      }
    }
    return rows;
  }, [tree]);

  /** subject|chapter|topic → the flat row (lecture number + estimate). */
  const flatByKey = useMemo(() => {
    const map = new Map<string, FlatTopic>();
    for (const row of flat) map.set(`${row.subject}|${row.chapter}|${row.topic}`, row);
    return map;
  }, [flat]);

  const alreadyOnToday = useMemo(() => new Set(queuedTopics.map((topic) => normalize(topic))), [queuedTopics]);
  const pickedKeys = useMemo(() => new Set(picked.map((p) => `${p.subject}|${p.chapter}|${p.topic}`)), [picked]);
  const pickedMinutes = picked.reduce(
    (sum, pick) => sum + (flat.find((row) => row.topic === pick.topic && row.chapter === pick.chapter)?.minutes ?? 45),
    0,
  );

  /* PERF: the input stays instant; the full-syllabus scan below waits for a
   * 300 ms pause in typing instead of running on every keystroke. */
  const trimmedQuery = useDebouncedValue((query ?? '').trim());
  const hits = useMemo<FlatTopic[]>(() => {
    const q = normalize(trimmedQuery);
    if (!q) return [];
    return flat
      .filter((row) => `${normalize(row.topic)} ${normalize(row.chapter)} ${normalize(row.subject)}`.includes(q))
      .slice(0, MAX_SEARCH_HITS);
  }, [flat, trimmedQuery]);

  const toggle = (row: FlatTopic) => {
    const key = `${row.subject}|${row.chapter}|${row.topic}`;
    setPicked((current) =>
      pickedKeys.has(key)
        ? current.filter((pick) => `${pick.subject}|${pick.chapter}|${pick.topic}` !== key)
        : [...current, { subject: row.subject, chapter: row.chapter, topic: row.topic, lectureNo: row.lectureNo }],
    );
  };

  /** Whole-chapter selection: one tap ticks (or unticks) every topic of the
   * chapter that isn't already on today. */
  const toggleChapter = (subjectName: string, chapterName: string) => {
    const rows = flat.filter(
      (row) => row.subject === subjectName && row.chapter === chapterName && !alreadyOnToday.has(normalize(row.topic)),
    );
    if (rows.length === 0) return;
    const allPicked = rows.every((row) => pickedKeys.has(`${row.subject}|${row.chapter}|${row.topic}`));
    setPicked((current) => {
      const without = current.filter((pick) => !(pick.subject === subjectName && pick.chapter === chapterName));
      return allPicked
        ? without
        : [...without, ...rows.map((row) => ({ subject: row.subject, chapter: row.chapter, topic: row.topic, lectureNo: row.lectureNo }))];
    });
  };

  const topicRow = (row: FlatTopic, showContext: boolean) => {
    const key = `${row.subject}|${row.chapter}|${row.topic}`;
    const isPicked = pickedKeys.has(key);
    const onToday = alreadyOnToday.has(normalize(row.topic));
    return (
      <button
        key={key}
        type="button"
        disabled={onToday}
        onClick={() => toggle(row)}
        aria-pressed={isPicked}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left touch-manipulation disabled:opacity-55"
        style={{
          borderRadius: ROW_RADIUS,
          background: isPicked ? tint(AMBER, 0.12) : NAVY_ALT,
          border: `1px solid ${isPicked ? tint(AMBER, 0.5) : BORDER}`,
        }}
        data-testid={`syllabus-pick-${row.topic.slice(0, 32)}`}
      >
        <span
          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
          style={{
            borderRadius: 6,
            background: isPicked || onToday ? (onToday ? SUCCESS : AMBER) : 'transparent',
            border: isPicked || onToday ? '1.5px solid transparent' : `1.5px solid ${BORDER_STRONG}`,
            color: ON_AMBER,
          }}
          aria-hidden="true"
        >
          {(isPicked || onToday) && <Check className="w-3 h-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug" style={{ color: TEXT }}>
            {row.topic}
          </span>
          <span className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide"
              style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER }}
              data-testid={`syllabus-lecture-${row.lectureNo}-${row.topic.slice(0, 16)}`}
            >
              {lectureLabel(row.lectureNo)}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: TEXT_MUTED }}>
              <Clock className="w-3 h-3" />~{formatDuration(row.minutes)}
            </span>
            {showContext && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: subjectColor(row.subject) }}>
                <SubjectDot subject={row.subject} size={5} />
                {row.subject} · {row.chapter}
              </span>
            )}
          </span>
        </span>
        {onToday && (
          <span className="text-[9px] font-extrabold uppercase tracking-wide flex-shrink-0" style={{ color: SUCCESS }}>
            on today
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[68] flex flex-col vicharak-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Add tasks from the syllabus"
      style={{ background: PAGE_BG }}
      data-testid="screen-syllabus-picker"
    >
      {/* ---------- pinned header + search ---------- */}
      <div
        className="flex-shrink-0 px-5 pb-3"
        style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-start gap-3">
          <span
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: 12, background: BRAND_GRADIENT, color: ON_AMBER }}
            aria-hidden="true"
          >
            <BookOpen className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-extrabold" style={{ color: TEXT }}>Add from syllabus</h2>
            <p className="mt-0.5 text-[11px] truncate" style={{ color: TEXT_MUTED }} data-testid="text-syllabus-picker-subtitle">
              {examLabel} · {flat.length} topics{usingFallback ? ' · sample outline' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
            style={{ background: tint(TEXT_MUTED, 0.14), color: TEXT_MUTED }}
            data-testid="button-syllabus-picker-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="mt-3 flex items-center gap-2 px-3 py-2.5"
          style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: ROW_RADIUS }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics — thermodynamics, genetics…"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            style={{ color: TEXT }}
            data-testid="input-syllabus-picker-search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: tint(TEXT_MUTED, 0.16), color: TEXT_MUTED }}
              data-testid="button-syllabus-picker-clear"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ---------- the tree ---------- */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
        {trimmedQuery ? (
          <div className="space-y-1.5 pb-2" data-testid="list-syllabus-search-results">
            {hits.map((row) => topicRow(row, true))}
            {hits.length === 0 && (
              <p className="px-1 py-2 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-syllabus-picker-no-match">
                Nothing in the syllabus matches “{trimmedQuery}”. Add it as a custom task below — it tracks exactly the same.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-2" data-testid="list-syllabus-subjects">
            {tree.map((subject) => {
              const subjectOpen = openSubject === subject.name;
              const topicCount = subject.chapters.reduce((n, chapter) => n + chapter.topics.length, 0);
              return (
                <div
                  key={subject.name}
                  className="overflow-hidden"
                  style={{ background: CARD, border: `1px solid ${subjectOpen ? tint(AMBER, 0.4) : BORDER}`, borderRadius: 12 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSubject(subjectOpen ? null : subject.name);
                      setOpenChapter(null);
                    }}
                    aria-expanded={subjectOpen}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left touch-manipulation"
                    data-testid={`syllabus-subject-${subject.name}`}
                  >
                    <span
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                      style={{ borderRadius: 8, background: subjectTint(subject.name, 0.16), color: subjectColor(subject.name) }}
                    >
                      <SubjectDot subject={subject.name} size={8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold" style={{ color: TEXT }}>{subject.name}</span>
                      <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>
                        {subject.chapters.length} chapters · {topicCount} topics
                      </span>
                    </span>
                    <ChevronDown
                      className="w-4 h-4 flex-shrink-0 transition-transform"
                      style={{ color: TEXT_MUTED, transform: subjectOpen ? 'rotate(180deg)' : undefined }}
                    />
                  </button>
                  {subjectOpen && (
                    <div className="px-2.5 pb-2.5 space-y-1.5 vicharak-fade">
                      {subject.chapters.map((chapter) => {
                        const chapterId = `${subject.name}|${chapter.name}`;
                        const chapterOpen = openChapter === chapterId;
                        const minutes = estimateTopicMinutes(chapter.weightage);
                        const chapterRows = chapter.topics
                          .map((topic) => flatByKey.get(`${subject.name}|${chapter.name}|${topic}`))
                          .filter((row): row is FlatTopic => !!row);
                        const selectable = chapterRows.filter((row) => !alreadyOnToday.has(normalize(row.topic)));
                        const allPicked =
                          selectable.length > 0 &&
                          selectable.every((row) => pickedKeys.has(`${row.subject}|${row.chapter}|${row.topic}`));
                        const firstLecture = chapterRows[0]?.lectureNo;
                        const lastLecture = chapterRows[chapterRows.length - 1]?.lectureNo;
                        return (
                          <div
                            key={chapterId}
                            className="overflow-hidden"
                            style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: ROW_RADIUS }}
                          >
                            {/* Header row: expand on the left, whole-chapter tick on the right. */}
                            <div className="flex items-stretch">
                              <button
                                type="button"
                                onClick={() => setOpenChapter(chapterOpen ? null : chapterId)}
                                aria-expanded={chapterOpen}
                                className="min-w-0 flex-1 flex items-center gap-2 px-3 py-2 text-left touch-manipulation"
                                data-testid={`syllabus-chapter-${chapter.name.slice(0, 32)}`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>{chapter.name}</span>
                                  <span className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    {firstLecture !== undefined && lastLecture !== undefined && (
                                      <span
                                        className="px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide"
                                        style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER }}
                                      >
                                        {firstLecture === lastLecture
                                          ? lectureLabel(firstLecture)
                                          : `${lectureLabel(firstLecture)}–${String(lastLecture).padStart(2, '0')}`}
                                      </span>
                                    )}
                                    {chapter.weightage && (
                                      <span
                                        className="px-1.5 py-px text-[9px] font-extrabold uppercase"
                                        style={{ borderRadius: RADIUS.chip, background: subjectTint(subject.name, 0.14), color: subjectColor(subject.name) }}
                                      >
                                        {chapter.weightage} weight
                                      </span>
                                    )}
                                    <span className="text-[10px]" style={{ color: TEXT_MUTED }}>
                                      {chapter.topics.length} topics · ~{formatDuration(minutes)} each
                                    </span>
                                  </span>
                                </span>
                                <ChevronDown
                                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                                  style={{ color: TEXT_MUTED, transform: chapterOpen ? 'rotate(180deg)' : undefined }}
                                />
                              </button>
                              {/* Entire-chapter pick — one tap adds every topic. */}
                              <button
                                type="button"
                                disabled={selectable.length === 0}
                                onClick={() => toggleChapter(subject.name, chapter.name)}
                                aria-pressed={allPicked}
                                aria-label={allPicked ? `Remove all of ${chapter.name}` : `Add all of ${chapter.name}`}
                                className="flex-shrink-0 px-2.5 my-1.5 mr-1.5 text-[10px] font-extrabold disabled:opacity-40 touch-manipulation"
                                style={allPicked
                                  ? { borderRadius: RADIUS.chip, background: tint(SUCCESS, 0.14), border: `1px solid ${tint(SUCCESS, 0.45)}`, color: SUCCESS }
                                  : { borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: 'transparent' }}
                                data-testid={`syllabus-chapter-all-${chapter.name.slice(0, 24)}`}
                              >
                                {allPicked ? 'Added ✓' : '+ Chapter'}
                              </button>
                            </div>
                            {chapterOpen && (
                              <div className="px-2 pb-2 space-y-1 vicharak-fade">
                                {chapterRows.map((row) => topicRow(row, false))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- pinned footer: the one primary action ---------- */}
      <div
        className="flex-shrink-0 px-5 pt-3 space-y-2"
        style={{
          background: CARD,
          borderTop: `1px solid ${BORDER}`,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        {picked.length > 0 && (
          <p className="text-[11px] font-bold text-center" style={{ color: TEXT_SECONDARY }} data-testid="text-syllabus-picked-summary">
            {picked.length} topic{picked.length === 1 ? '' : 's'} selected · about {formatDuration(pickedMinutes)} of study
          </p>
        )}
        <button
          type="button"
          disabled={picked.length === 0 || saving}
          onClick={() => onAdd(picked)}
          className="w-full py-3.5 text-sm font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-2 touch-manipulation transition-transform active:scale-[0.98]"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-syllabus-add-to-today"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {picked.length > 1 ? `Add ${picked.length} to Today` : 'Add to Today'}
        </button>
        {onCustomTask && (
          <button
            type="button"
            onClick={onCustomTask}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-extrabold touch-manipulation"
            style={{ borderRadius: ROW_RADIUS, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
            data-testid="button-syllabus-custom-task"
          >
            <PenLine className="w-4 h-4" />
            Type a custom task instead
          </button>
        )}
      </div>
    </div>
  );
}
