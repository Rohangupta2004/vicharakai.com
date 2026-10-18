/**
 * Exam-aware chat support — everything the Ask VicharakAI screen needs to be
 * grounded in the student's actual exam:
 *  • ExamContextPill — the chip at the top of the chat that names the active
 *    exam and opens a picker over the whole syllabus database.
 *  • buildExamChatContext — the system-prompt block: exam structure, top-5
 *    weak topics, readiness score and the syllabus chapters relevant to the
 *    question being asked.
 *  • suggestedExamQuestions — weak-topic-driven starter prompts for the
 *    empty state.
 *  • detectMentionedTopics + TopicActionCards — after an AI reply, the
 *    syllabus topics it mentioned become small action cards: “Add to study
 *    plan” and “Mark as weak”.
 */
import { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronDown, Flag, GraduationCap, Loader2, Plus, Search } from 'lucide-react';
import {
  AMBER,
  BORDER,
  CARD,
  DANGER,
  NAVY_ALT,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  tint,
} from './theme';
import {
  syllabusSlug,
  topicIdFor,
  type ExamSyllabus,
} from './data/syllabuses';
import { useSyllabusCatalog } from './data/syllabusRuntime';
import type { ReadinessScore, WeakTopicInsight } from './adaptationEngine';

/* ------------------------------------------------------------------ */
/*  Exam context pill + picker                                         */
/* ------------------------------------------------------------------ */

export function ExamContextPill({
  exam,
  onSelect,
  onDark = false,
}: {
  /** Null when the student's exam has no structured syllabus yet. */
  exam: ExamSyllabus | null;
  onSelect: (examId: string) => void;
  /** True when the pill sits on a dark surface (the Vicharree chat's navy
   * header) — brand-blue ink on navy fails contrast, so the trigger flips to
   * white text with a bright-blue edge. The dropdown panel stays light either way. */
  onDark?: boolean;
}) {
  const { exams: syllabusCatalog } = useSyllabusCatalog();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return syllabusCatalog;
    return syllabusCatalog.filter(
      (e) => e.name.toLowerCase().includes(q) || e.country.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
    );
  }, [query, syllabusCatalog]);

  return (
    /* min-w-0 so this pill YIELDS inside the Vicharree chat header instead of
       holding its full width: at 375px the header carries the mascot, the
       "Vicharree" title, this pill, clear and close, and an exam name like
       "UPSC Civil Services Examination" used to squeeze the title to nothing. */
    <div className="relative min-w-0" data-testid="exam-context-pill">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
        style={
          onDark
            ? {
                borderRadius: RADIUS.chip,
                background: 'var(--chat-surface-strong, rgba(255,255,255,0.10))',
                border: '1px solid var(--chat-edge, rgba(110,168,255,0.6))',
                color: 'var(--chat-text, #FFFFFF)',
              }
            : {
                borderRadius: RADIUS.chip,
                background: tint(AMBER, 0.12),
                border: `1px solid ${tint(AMBER, 0.4)}`,
                color: AMBER,
              }
        }
        data-testid="button-exam-context-pill"
      >
        <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
        {/* Inline overflow rules, not Tailwind's `truncate`: the app theme
            deliberately neutralises that class app-wide. */}
        <span className="min-w-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {exam ? exam.name : 'Set exam'}
        </span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-72 max-w-[80vw] p-2.5 z-30 vicharak-fade"
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, boxShadow: 'var(--popover-shadow, 0 12px 32px rgba(0,0,0,0.45))' }}
          data-testid="panel-exam-context-picker"
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}>
            <Search className="w-3 h-3 flex-shrink-0" style={{ color: TEXT_MUTED }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exams…"
              className="flex-1 min-w-0 bg-transparent text-[11px] outline-none"
              style={{ color: TEXT }}
              data-testid="input-exam-context-search"
            />
          </div>
          <div className="mt-1.5 max-h-52 overflow-y-auto space-y-0.5">
            {filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onSelect(e.id);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left touch-manipulation"
                style={{ borderRadius: RADIUS.sm, background: e.id === exam?.id ? tint(AMBER, 0.12) : 'transparent' }}
                data-testid={`exam-context-option-${e.id}`}
              >
                {e.id === exam?.id ? (
                  <Check className="w-3 h-3 flex-shrink-0" style={{ color: AMBER }} />
                ) : (
                  <span className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold truncate" style={{ color: e.id === exam?.id ? AMBER : TEXT }}>{e.name}</span>
                  <span className="block text-[9px]" style={{ color: TEXT_MUTED }}>{e.country} · {e.category}</span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-1.5 text-[10px]" style={{ color: TEXT_MUTED }}>No exams match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  System-prompt construction                                         */
/* ------------------------------------------------------------------ */

/** Syllabus chapters whose name or topics overlap the question's words. */
function relevantChapters(exam: ExamSyllabus, question: string, limit = 3): string[] {
  const words = syllabusSlug(question)
    .split('_')
    .filter((w) => w.length >= 4);
  if (words.length === 0) return [];
  const scored: Array<{ label: string; score: number }> = [];
  for (const subject of exam.subjects) {
    for (const chapter of subject.chapters) {
      const haystack = syllabusSlug(`${chapter.name} ${chapter.topics.join(' ')}`).replace(/_/g, ' ');
      let score = 0;
      for (const word of words) {
        if (haystack.includes(word)) score += word.length >= 6 ? 2 : 1;
      }
      if (score > 0) {
        scored.push({
          label: `${subject.name} › ${chapter.name} (topics: ${chapter.topics.slice(0, 5).join('; ')})`,
          score,
        });
      }
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.label);
}

/**
 * The exam-aware block appended to the coach's system prompt before every
 * AI call: exam structure, the student's top-5 weak topics, the readiness
 * score, and the chapters most relevant to the question just asked.
 */
export function buildExamChatContext(
  exam: ExamSyllabus,
  weakTopics: WeakTopicInsight[],
  readiness: ReadinessScore,
  question: string,
): string {
  const structure = exam.subjects
    .map((subject) => `${subject.name} (${subject.chapters.length} chapters: ${subject.chapters.slice(0, 6).map((c) => c.name).join(', ')}${subject.chapters.length > 6 ? ', …' : ''})`)
    .join(' | ');
  const weakLine =
    weakTopics.slice(0, 5).map((t) => `${t.topicName}${t.subjectName ? ` [${t.subjectName}]` : ''} (weakness ${t.weaknessScore})`).join('; ') ||
    'none detected yet';
  const readinessLine = `${readiness.readinessPct}% overall` +
    (readiness.weakAreas.length > 0 ? `; weakest subjects: ${readiness.weakAreas.map((s) => `${s.subject} ${s.pct}%`).join(', ')}` : '');
  const relevant = relevantChapters(exam, question);
  return [
    `ACTIVE EXAM: ${exam.name} (${exam.country} · ${exam.category}). Syllabus structure: ${structure}.`,
    `Top weak topics (adaptation engine): ${weakLine}.`,
    `Readiness score: ${readinessLine}.`,
    relevant.length > 0 ? `Syllabus chapters relevant to this question: ${relevant.join(' || ')}.` : '',
    'Ground every answer in THIS exam\u2019s syllabus — use its real chapter and topic names, prioritise the weak topics above when advising, and never quote another exam\u2019s pattern.',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/*  Suggested questions (empty state)                                  */
/* ------------------------------------------------------------------ */

/** Weak-topic-driven starter prompts; sensible defaults before any data. */
export function suggestedExamQuestions(exam: ExamSyllabus, weakTopics: WeakTopicInsight[]): string[] {
  const suggestions: string[] = [];
  const first = weakTopics[0];
  const second = weakTopics[1];
  if (first) suggestions.push(`Explain ${first.topicName} simply`);
  if (first?.chapterName) suggestions.push(`Key formulas for ${first.chapterName}?`);
  const subjectForImprove = second?.subjectName || first?.subjectName || exam.subjects[0]?.name;
  if (subjectForImprove) suggestions.push(`How to improve on ${subjectForImprove} for ${exam.name}?`);
  if (suggestions.length < 3) {
    const firstSubject = exam.subjects[0];
    const firstChapter = firstSubject?.chapters[0];
    if (firstChapter && suggestions.length < 3) suggestions.push(`Explain ${firstChapter.topics[0] ?? firstChapter.name} simply`);
    if (suggestions.length < 3) suggestions.push(`What should I study first for ${exam.name}?`);
  }
  return Array.from(new Set(suggestions)).slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  Post-response topic detection + action cards                       */
/* ------------------------------------------------------------------ */

export interface MentionedTopic {
  /** Stable id (chapter-level when the mention is a chapter). */
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectName: string;
}

/** Syllabus chapters/topics the AI reply mentions by name (longest first). */
export function detectMentionedTopics(replyText: string, exam: ExamSyllabus, limit = 2): MentionedTopic[] {
  const haystack = ` ${syllabusSlug(replyText).replace(/_/g, ' ')} `;
  const found: Array<MentionedTopic & { length: number }> = [];
  const seen = new Set<string>();
  for (const subject of exam.subjects) {
    for (const chapter of subject.chapters) {
      const candidates: Array<{ name: string; topicId: string }> = [
        { name: chapter.name, topicId: topicIdFor(chapter.id, chapter.name) },
        ...chapter.topics.map((topic) => ({ name: topic, topicId: topicIdFor(chapter.id, topic) })),
      ];
      for (const candidate of candidates) {
        const needle = ` ${syllabusSlug(candidate.name).replace(/_/g, ' ')} `;
        // Only multi-word or long names count — single short words over-match.
        if ((needle ?? '').trim().length < 8 || !needle.includes(' ')) continue;
        if (haystack.includes(needle) && !seen.has(candidate.topicId)) {
          seen.add(candidate.topicId);
          found.push({
            topicId: candidate.topicId,
            topicName: candidate.name,
            chapterId: chapter.id,
            chapterName: chapter.name,
            subjectName: subject.name,
            length: candidate.name.length,
          });
        }
      }
    }
  }
  return found
    .sort((a, b) => b.length - a.length)
    .slice(0, limit)
    .map(({ length: _length, ...topic }) => topic);
}

export function TopicActionCards({
  topics,
  busyTopicId,
  handledTopicIds,
  onAddToPlan,
  onMarkWeak,
}: {
  topics: MentionedTopic[];
  /** topicId with an in-flight action. */
  busyTopicId: string | null;
  /** topicIds already actioned (shows a quiet done state). */
  handledTopicIds: Set<string>;
  onAddToPlan: (topic: MentionedTopic) => void;
  onMarkWeak: (topic: MentionedTopic) => void;
}) {
  if (topics.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-1.5" data-testid="topic-action-cards">
      {topics.map((topic) => {
        const busy = busyTopicId === topic.topicId;
        const handled = handledTopicIds.has(topic.topicId);
        return (
          <div
            key={topic.topicId}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
            data-testid={`topic-card-${topic.topicId.slice(0, 32)}`}
          >
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold truncate" style={{ color: TEXT }}>{topic.topicName}</span>
              <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                {topic.subjectName} · {topic.chapterName}
              </span>
            </span>
            {handled ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold flex-shrink-0" style={{ color: SUCCESS }}>
                <Check className="w-3 h-3" />
                Done
              </span>
            ) : (
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAddToPlan(topic)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-extrabold disabled:opacity-60 touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.14), border: `1px solid ${tint(AMBER, 0.4)}`, color: AMBER }}
                  data-testid={`topic-card-add-${topic.topicId.slice(0, 24)}`}
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add to study plan
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onMarkWeak(topic)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-extrabold disabled:opacity-60 touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }}
                  data-testid={`topic-card-weak-${topic.topicId.slice(0, 24)}`}
                >
                  <Flag className="w-3 h-3" />
                  Mark as weak
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** zuno_meta key remembering which exam the chat pill is set to. */
export const CHAT_EXAM_META_KEY = 'chat_exam_id';
