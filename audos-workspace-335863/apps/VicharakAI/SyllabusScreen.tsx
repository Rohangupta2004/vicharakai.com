/**
 * Syllabus Browser — a full-screen browsable tree over the embedded exam
 * database (data/syllabuses.ts): Exam → Subject → Chapter → Topics.
 *
 * Every chapter row shows its mastery from zuno_exam_progress, and every
 * topic row shows its mastery from the zuno_topic_attempts log when it has
 * been studied — colour-coded green (≥ 70%), orange (40-69%) and red (< 40%).
 * A quiet + button on each chapter drops it onto today's plan.
 *
 * Opened from Tools and from the exam-aware chat. Rendered as an overlay
 * screen exactly like WeeklyTargetsScreen — no nav changes required.
 */
import { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronLeft, Plus, Search } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  CARD,
  DANGER,
  NAVY,
  NAVY_ALT,
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
import {
  topicIdFor,
  type ExamSyllabus,
  type SyllabusChapter,
  type SyllabusSubject,
} from './data/syllabuses';
import { getCatalogSyllabus, useSyllabusCatalog } from './data/syllabusRuntime';
import {
  asNumber,
  masteryBand,
  topicMasteryMap,
  type ExamProgressRow,
  type MasteryBand,
  type TopicAttemptRow,
} from './adaptationEngine';

function bandColor(band: MasteryBand): string {
  if (band === 'strong') return SUCCESS;
  if (band === 'developing') return WARNING;
  if (band === 'weak') return DANGER;
  return TEXT_MUTED;
}

function MasteryPill({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const color = bandColor(masteryBand(pct));
  return (
    <span
      className="px-1.5 py-0.5 text-[9px] font-extrabold flex-shrink-0"
      style={{ borderRadius: RADIUS.chip, background: tint(color, 0.14), color }}
    >
      {pct}%
    </span>
  );
}

export default function SyllabusScreen({
  initialExamId,
  progressRows,
  attemptRows,
  addingChapter,
  onStudyChapter,
  onClose,
}: {
  /** The syllabus exam to open on (usually the student's own exam). */
  initialExamId: string | null;
  progressRows: ExamProgressRow[];
  attemptRows: TopicAttemptRow[];
  /** Chapter id currently being added as a task, for the row spinner state. */
  addingChapter: string | null;
  /** “Study this” — parent creates a task for the chapter. */
  onStudyChapter: (exam: ExamSyllabus, subject: SyllabusSubject, chapter: SyllabusChapter) => void;
  onClose: () => void;
}) {
  const { exams: syllabusCatalog } = useSyllabusCatalog();
  const [examId, setExamId] = useState<string>(
    initialExamId && getCatalogSyllabus(syllabusCatalog, initialExamId)
      ? initialExamId
      : syllabusCatalog[0]?.id ?? '',
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [examSearch, setExamSearch] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [openChapterId, setOpenChapterId] = useState<string | null>(null);

  const exam = getCatalogSyllabus(syllabusCatalog, examId) ?? syllabusCatalog[0]!;
  const subject = exam.subjects.find((s) => s.id === subjectId) ?? exam.subjects[0];

  const chapterMastery = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of progressRows) {
      if (row.exam_id === exam.id) map.set(row.chapter_id, asNumber(row.mastery_score));
    }
    return map;
  }, [progressRows, exam.id]);

  const topicMastery = useMemo(() => topicMasteryMap(exam.id, attemptRows), [attemptRows, exam.id]);

  const filteredExams = useMemo(() => {
    const query = (examSearch ?? '').trim().toLowerCase();
    if (!query) return syllabusCatalog;
    return syllabusCatalog.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.country.toLowerCase().includes(query) ||
        e.category.toLowerCase().includes(query),
    );
  }, [examSearch, syllabusCatalog]);

  const studiedChapters = exam.subjects.reduce(
    (n, s) => n + s.chapters.filter((c) => (chapterMastery.get(c.id) ?? 0) > 0).length,
    0,
  );
  const totalChapters = exam.subjects.reduce((n, s) => n + s.chapters.length, 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" role="dialog" aria-modal="true" aria-label="Syllabus browser" style={{ background: NAVY }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center touch-manipulation"
          style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_SECONDARY }}
          data-testid="button-syllabus-browser-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold leading-tight" style={{ color: TEXT }}>Syllabus Browser</h1>
          <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
            {syllabusCatalog.length} exams · mastery colour-coded from your own study data
          </p>
        </div>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
          <BookOpen className="w-4 h-4" />
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 w-full max-w-[640px] mx-auto">
        {/* Exam picker */}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="w-full flex items-center gap-3 px-3.5 py-3 text-left touch-manipulation"
          style={{ background: CARD, border: `1px solid ${pickerOpen ? tint(AMBER, 0.5) : BORDER}`, borderRadius: RADIUS.md }}
          data-testid="button-syllabus-exam-picker"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>Exam</span>
            <span className="block text-[14px] font-extrabold truncate" style={{ color: TEXT }}>{exam.name}</span>
            <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>
              {exam.country} · {exam.category} · {studiedChapters}/{totalChapters} chapters touched
            </span>
          </span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: pickerOpen ? 'rotate(180deg)' : undefined }} />
        </button>

        {pickerOpen && (
          <div className="mt-2 p-3 vicharak-fade" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }} data-testid="panel-syllabus-exam-list">
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              <input
                value={examSearch}
                onChange={(event) => setExamSearch(event.target.value)}
                placeholder="Search exams — NEET PG, USMLE, Gaokao…"
                className="flex-1 min-w-0 bg-transparent text-[12px] outline-none"
                style={{ color: TEXT }}
                data-testid="input-syllabus-exam-search"
              />
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
              {filteredExams.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setExamId(e.id);
                    setSubjectId(null);
                    setOpenChapterId(null);
                    setPickerOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left touch-manipulation"
                  style={{ borderRadius: RADIUS.sm, background: e.id === exam.id ? tint(AMBER, 0.12) : 'transparent' }}
                  data-testid={`syllabus-exam-${e.id}`}
                >
                  {e.id === exam.id ? (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
                  ) : (
                    <span className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold truncate" style={{ color: e.id === exam.id ? AMBER : TEXT }}>{e.name}</span>
                    <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>{e.country} · {e.category}</span>
                  </span>
                </button>
              ))}
              {filteredExams.length === 0 && (
                <p className="px-2.5 py-2 text-[11px]" style={{ color: TEXT_MUTED }}>No exams match that search.</p>
              )}
            </div>
          </div>
        )}

        {/* Subject chips */}
        <div className="mt-4 flex gap-1.5 flex-wrap">
          {exam.subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSubjectId(s.id);
                setOpenChapterId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
              style={subject.id === s.id
                ? { borderRadius: RADIUS.chip, background: subjectColor(s.name), color: NAVY }
                : { borderRadius: RADIUS.chip, background: subjectTint(s.name, 0.14), color: subjectColor(s.name) }}
              data-testid={`syllabus-browser-subject-${s.id}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Chapters → topics */}
        <div className="mt-3 space-y-2 pb-8">
          {subject.chapters.map((chapter) => {
            const mastery = chapterMastery.has(chapter.id) ? (chapterMastery.get(chapter.id) as number) : null;
            const open = openChapterId === chapter.id;
            const busy = addingChapter === chapter.id;
            return (
              <div key={chapter.id} className="overflow-hidden vicharak-fade" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}>
                <div className="w-full px-3.5 py-3 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenChapterId(open ? null : chapter.id)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 flex items-center gap-2.5 text-left touch-manipulation"
                    data-testid={`syllabus-browser-chapter-${chapter.id}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug" style={{ color: TEXT }}>{chapter.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {chapter.weightage && (
                          <span
                            className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                            style={{
                              borderRadius: RADIUS.chip,
                              background: subjectTint(subject.name, 0.14),
                              color: subjectColor(subject.name),
                            }}
                          >
                            {chapter.weightage} weight
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{chapter.topics.length} topics</span>
                      </span>
                    </span>
                    <MasteryPill pct={mastery} />
                    <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: open ? 'rotate(180deg)' : undefined }} />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onStudyChapter(exam, subject, chapter)}
                    aria-label={`Add ${chapter.name} to today's plan`}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 touch-manipulation"
                    style={{ background: tint(AMBER, 0.12), border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER }}
                    data-testid={`syllabus-browser-study-${chapter.id}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {open && (
                  <ul className="px-3.5 pb-3 space-y-1.5 vicharak-fade">
                    {chapter.topics.map((topicName) => {
                      const topicId = topicIdFor(chapter.id, topicName);
                      const pct = topicMastery.has(topicId) ? (topicMastery.get(topicId) as number) : null;
                      const color = bandColor(masteryBand(pct));
                      return (
                        <li key={topicId} className="flex items-center gap-2 text-[12px]">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: pct === null ? BORDER_STRONG : color }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1" style={{ color: pct !== null && pct >= 70 ? TEXT_MUTED : TEXT_SECONDARY }}>
                            {topicName}
                          </span>
                          {pct !== null && (
                            <span className="text-[10px] font-extrabold flex-shrink-0" style={{ color }}>
                              {pct}%
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
