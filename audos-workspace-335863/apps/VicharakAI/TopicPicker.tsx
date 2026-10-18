/**
 * Topic Picker — syllabus-first task entry.
 *
 * A searchable bottom sheet over the student's own exam syllabus: subjects as
 * collapsible sections, chapters as collapsible groups inside them, and every
 * granular topic one tap away. Picking a topic hands `{ topic, subject }`
 * back to the caller, which fills the task form exactly as if the student had
 * typed it — so typed topic names stay consistent and trackable over time.
 *
 * Free text is never blocked: searching something outside the syllabus offers
 * a "use as custom topic" row, and the footer button returns the student to
 * the plain text box untouched.
 *
 * A pick has to LOOK like it landed. When the caller passes `pickedTopics` the
 * matching rows switch to a green ticked "Added" state, and with
 * `keepOpenOnPick` the sheet stays open so several topics can be ticked in a
 * row — previously the sheet closed instantly and dropped the topic into a
 * text box the student could not see, which read as "tapping does nothing".
 *
 * Data comes in as a plain subject → chapter → topics tree (TopicPickerSubject)
 * so App.tsx can feed it from the structured syllabus database
 * (data/syllabuses.ts) or fall back to the planner catalogue (syllabus.ts)
 * for custom exams. Opened from AddTaskSheet, the daily check-in and the
 * quick-add panel.
 */
import { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronDown, PenLine, Plus, Search, X } from 'lucide-react';
import { useDebouncedValue } from './shared/useDebouncedValue';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  NAVY,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import { SubjectDot } from './ui';

export interface TopicPickerSubject {
  name: string;
  chapters: Array<{ name: string; topics: string[]; weightage?: 'high' | 'medium' | 'low' }>;
}

export interface TopicPick {
  topic: string;
  /** Subject the topic belongs to — '' when the student typed a custom topic. */
  subject: string;
  /** Chapter the topic came from, when picked off the syllabus tree. */
  chapter?: string;
}

/** Lowercase, punctuation-free, single-spaced — the comparison form. */
function normalize(value: string): string {
  return (value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ') ?? '').trim();
}

/** Loose subsequence match — 'thrmdyn' still finds 'thermodynamics'. */
function fuzzyMatch(haystack: string, compactQuery: string): boolean {
  if (!compactQuery) return false;
  let i = 0;
  for (let j = 0; j < haystack.length && i < compactQuery.length; j += 1) {
    if (haystack[j] === compactQuery[i]) i += 1;
  }
  return i === compactQuery.length;
}

/** 0 = no match; higher scores sort first. Topic hits beat chapter/subject hits. */
function matchScore(query: string, topic: string, chapter: string, subject: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const t = normalize(topic);
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 80;
  const hay = `${t} ${normalize(chapter)} ${normalize(subject)}`;
  const tokens = q.split(' ');
  if (tokens.every((token) => hay.includes(token))) return 60;
  if (fuzzyMatch(t, q.replace(/\s+/g, ''))) return 30;
  return 0;
}

interface SearchHit {
  topic: string;
  chapter: string;
  subject: string;
  score: number;
}

const MAX_SEARCH_HITS = 80;

export default function TopicPicker({
  examLabel,
  subjects,
  onPick,
  onClose,
  pickedTopics,
  keepOpenOnPick = false,
}: {
  /** Human name of the exam whose syllabus is shown (e.g. "NEET UG"). */
  examLabel: string;
  subjects: TopicPickerSubject[];
  onPick: (pick: TopicPick) => void;
  onClose: () => void;
  /** Topics the caller has already taken — rendered as ticked “Added” rows. */
  pickedTopics?: string[];
  /** Keep the sheet open after a pick so several topics can be ticked. */
  keepOpenOnPick?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  /* PERF: the input (and the custom-topic footer) stays instant; only the
   * ranked full-syllabus scan waits for a 300 ms pause in typing. */
  const typedQuery = (query ?? '').trim();
  const trimmedQuery = useDebouncedValue(typedQuery);
  /** Case-insensitive so a topic typed by hand still shows as already taken. */
  const pickedSet = useMemo(
    () => new Set((pickedTopics ?? []).map((topic) => normalize(topic))),
    [pickedTopics],
  );

  const hits = useMemo<SearchHit[]>(() => {
    if (!trimmedQuery) return [];
    const found: SearchHit[] = [];
    for (const subject of subjects) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          const score = matchScore(trimmedQuery, topic, chapter.name, subject.name);
          if (score > 0) found.push({ topic, chapter: chapter.name, subject: subject.name, score });
        }
      }
    }
    found.sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));
    return found.slice(0, MAX_SEARCH_HITS);
  }, [subjects, trimmedQuery]);

  const totalTopics = useMemo(
    () => subjects.reduce((sum, subject) => sum + subject.chapters.reduce((n, chapter) => n + chapter.topics.length, 0), 0),
    [subjects],
  );

  const topicRow = (topic: string, chapter: string, subject: string, showContext: boolean) => {
    const added = pickedSet.has(normalize(topic));
    return (
      <button
        key={`${subject}|${chapter}|${topic}`}
        type="button"
        onClick={() => onPick({ topic, subject, chapter })}
        aria-pressed={added}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left touch-manipulation"
        style={{
          borderRadius: RADIUS.sm,
          background: added ? tint(SUCCESS, 0.12) : NAVY_ALT,
          border: `1px solid ${added ? tint(SUCCESS, 0.5) : BORDER}`,
        }}
        data-testid={`topic-picker-topic-${topic.slice(0, 32)}`}
      >
        <SubjectDot subject={subject} size={6} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>{topic}</span>
          {showContext && (
            <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
              {subject} · {chapter}
            </span>
          )}
        </span>
        {added ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold flex-shrink-0" style={{ color: SUCCESS }}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            Added
          </span>
        ) : (
          <Plus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Pick a topic from the syllabus">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close topic picker" />
      <div
        className="relative flex flex-col vicharak-sheet"
        style={{
          // Capped against the containing panel as well as the viewport — a
          // bare 82vh is measured on the whole window, so inside the app panel
          // the pinned footer (Done / custom topic) fell past the visible edge.
          height: 'min(82dvh, 100%)',
          background: CARD,
          borderTop: `1px solid ${BORDER_STRONG}`,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
        }}
      >
        {/* Header + search — pinned while the tree scrolls underneath. */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
              <BookOpen className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Pick a topic</h2>
              <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
                {totalTopics > 0 ? `${examLabel} syllabus · ${totalTopics} topics` : examLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              data-testid="button-topic-picker-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 px-3 py-2.5" style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}>
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics — thermodynamics, polity…"
              autoFocus
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: TEXT }}
              data-testid="input-topic-picker-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: tint(TEXT_MUTED, 0.14), color: TEXT_MUTED }}
                data-testid="button-topic-picker-clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {subjects.length === 0 ? (
            <p className="px-1 py-2 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-topic-picker-empty">
              No structured syllabus is loaded for your exam yet — type your topic in the search box above and use it as a custom topic, or close this and type it straight into the task box.
            </p>
          ) : trimmedQuery ? (
            /* Search mode — one flat, ranked list across every subject. */
            <div className="space-y-1.5 pb-2" data-testid="panel-topic-picker-results">
              {hits.map((hit) => topicRow(hit.topic, hit.chapter, hit.subject, true))}
              {hits.length === 0 && (
                <p className="px-1 py-2 text-[12px]" style={{ color: TEXT_MUTED }} data-testid="text-topic-picker-no-match">
                  No syllabus topics match “{trimmedQuery}” — use it as a custom topic below.
                </p>
              )}
            </div>
          ) : (
            /* Browse mode — subjects as collapsible sections, chapters inside. */
            <div className="space-y-2 pb-2">
              {subjects.map((subject) => {
                const subjectOpen = openSubject === subject.name;
                const subjectTopicCount = subject.chapters.reduce((n, chapter) => n + chapter.topics.length, 0);
                return (
                  <div key={subject.name} className="overflow-hidden" style={{ background: NAVY_ALT, border: `1px solid ${subjectOpen ? tint(AMBER, 0.4) : BORDER}`, borderRadius: RADIUS.md }}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSubject(subjectOpen ? null : subject.name);
                        setOpenChapter(null);
                      }}
                      aria-expanded={subjectOpen}
                      className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left touch-manipulation"
                      data-testid={`topic-picker-subject-${subject.name}`}
                    >
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: subjectTint(subject.name, 0.16), color: subjectColor(subject.name) }}>
                        <SubjectDot subject={subject.name} size={8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-extrabold" style={{ color: TEXT }}>{subject.name}</span>
                        <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>
                          {subject.chapters.length} chapters · {subjectTopicCount} topics
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: subjectOpen ? 'rotate(180deg)' : undefined }} />
                    </button>
                    {subjectOpen && (
                      <div className="px-2.5 pb-2.5 space-y-1.5 vicharak-fade">
                        {subject.chapters.map((chapter) => {
                          const chapterId = `${subject.name}|${chapter.name}`;
                          const chapterOpen = openChapter === chapterId;
                          return (
                            <div key={chapterId} className="overflow-hidden" style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}>
                              <button
                                type="button"
                                onClick={() => setOpenChapter(chapterOpen ? null : chapterId)}
                                aria-expanded={chapterOpen}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left touch-manipulation"
                                data-testid={`topic-picker-chapter-${chapter.name.slice(0, 32)}`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>{chapter.name}</span>
                                  <span className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    {chapter.weightage && (
                                      <span
                                        className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                                        style={{ borderRadius: RADIUS.chip, background: subjectTint(subject.name, 0.14), color: subjectColor(subject.name) }}
                                      >
                                        {chapter.weightage} weight
                                      </span>
                                    )}
                                    <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{chapter.topics.length} topics</span>
                                  </span>
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: chapterOpen ? 'rotate(180deg)' : undefined }} />
                              </button>
                              {chapterOpen && (
                                <div className="px-2 pb-2 space-y-1 vicharak-fade">
                                  {chapter.topics.map((topic) => topicRow(topic, chapter.name, subject.name, false))}
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

        {/* Free-text fallback — the syllabus never blocks a custom topic. */}
        <div className="flex-shrink-0 px-5 pt-2.5 pb-6 space-y-2" style={{ borderTop: `1px solid ${BORDER}`, background: CARD }}>
          {keepOpenOnPick && pickedSet.size > 0 && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 text-sm font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-topic-picker-done"
            >
              Done — {pickedSet.size} topic{pickedSet.size === 1 ? '' : 's'} added
            </button>
          )}
          {typedQuery && (
            <button
              type="button"
              onClick={() => onPick({ topic: typedQuery, subject: '' })}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.md, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
              data-testid="button-topic-picker-use-custom"
            >
              <PenLine className="w-4 h-4" />
              Use “{typedQuery.length > 34 ? `${typedQuery.slice(0, 34)}…` : typedQuery}” as a custom topic
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-[12px] font-bold touch-manipulation"
            style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: 'transparent' }}
            data-testid="button-topic-picker-type-own"
          >
            I’ll type my own topic instead
          </button>
        </div>
      </div>
    </div>
  );
}
