/**
 * Add Task — the compact bottom sheet behind the '+' button.
 *
 * Deliberately NOT full screen: the sheet occupies at most ~58% of the
 * viewport, keeps its rounded top corners over a dimmed backdrop, and closes
 * on a backdrop tap, the X, Escape or a downward swipe on its grab handle.
 * The body scrolls; the "Add task" button stays pinned to the bottom edge so
 * it is reachable without scrolling, whatever the student typed.
 *
 * One clear path to a manual task: one task per line, a subject chip, an
 * optional photo (camera capture or gallery pick), the photo→tasks scanner,
 * and "Pick from syllabus" — a searchable list of the chapters from the exam
 * chosen at onboarding, so a chapter is tapped in instead of typed by hand.
 *
 * The photo is kept as a compact JPEG data URI so it persists locally
 * alongside the task and renders as a thumbnail on the Today checklist — no
 * server upload required.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Camera, Check, ChevronLeft, ImagePlus, Loader2, Plus, Search, X } from 'lucide-react';
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
import { readFileAsDataUrl } from './Attachments';
import type { TopicPickerSubject } from './TopicPicker';
import {
  CATEGORY_EMOJI,
  TASK_CATEGORIES,
  readLastCategory,
  writeLastCategory,
  type TaskCategory,
} from './features/tasks/taskCategory';

export interface AddTaskDraft {
  /** One task per line typed in the sheet — each becomes its own task. */
  titles: string[];
  subject: string;
  /** Compact data URI of the attached photo, or null when none was added. */
  imageDataUrl: string | null;
  /** The category tag applied to every task added in this sheet. */
  category: TaskCategory;
}

/** Longest edge the stored image keeps — keeps the data URI small. */
const MAX_IMAGE_EDGE = 1000;
/** A data URI already under this size is stored as-is, without re-encoding. */
const KEEP_RAW_LIMIT = 400 * 1024;
/** Swipe further than this on the grab handle and the sheet dismisses. */
const SWIPE_CLOSE_PX = 90;
/** Chapters rendered at once — searching narrows a long syllabus down. */
const MAX_CHAPTER_ROWS = 60;

/** Read a photo and downscale it into a compact JPEG data URI. Never throws
 * for a decodable image — worst case the raw data URI comes back unchanged. */
async function fileToCompactDataUrl(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable image'));
      el.src = raw;
    });
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width || 1, img.height || 1));
    if (scale >= 1 && raw.length <= KEEP_RAW_LIMIT) return raw;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return raw;
  }
}

interface ChapterRow {
  subject: string;
  chapter: string;
  topics: number;
}

export default function AddTaskSheet({
  subjects,
  syllabusSubjects = [],
  examLabel = 'Your exam',
  saving,
  onSave,
  onClose,
  onScanPhoto,
}: {
  subjects: string[];
  /** The student's exam syllabus (subject → chapter → topics) for the picker. */
  syllabusSubjects?: TopicPickerSubject[];
  /** Human name of that exam, shown above the chapter list. */
  examLabel?: string;
  saving: boolean;
  onSave: (draft: AddTaskDraft) => void;
  onClose: () => void;
  /** Opens the photo→tasks scanner instead (optional entry point). */
  onScanPhoto?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  /* Category defaults to the last one the student used, so repeat entry is
   * one tap. Stored on the task itself; the tag on the card is neutral. */
  const [category, setCategory] = useState<TaskCategory>(readLastCategory);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [readingImage, setReadingImage] = useState(false);
  /* Which face of the sheet is showing — the form, or the chapter picker. */
  const [view, setView] = useState<'form' | 'syllabus'>('form');
  const [chapterQuery, setChapterQuery] = useState('');
  const [pickedChapters, setPickedChapters] = useState<string[]>([]);
  /* Swipe-to-dismiss: how far the sheet has been dragged down, in px. */
  const [dragY, setDragY] = useState(0);
  const dragFromRef = useRef<number | null>(null);

  /* Escape closes the sheet, like the backdrop and the X do. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickImage = async (file: File) => {
    setReadingImage(true);
    try {
      setImageDataUrl(await fileToCompactDataUrl(file));
    } catch {
      /* unreadable file — the task can still save without a photo */
    } finally {
      setReadingImage(false);
    }
  };

  /** One task per line — pressing Enter starts the next task immediately. */
  const titleLines = title
    .split(/\n+/)
    .map((line) => (line ?? '').trim())
    .filter(Boolean);
  const canSave = titleLines.length > 0 && !saving && !readingImage;
  const chipNames = Array.from(new Set([...subjects, 'General'])).filter(Boolean);

  /* ---------- "Pick from syllabus": the flat chapter list ---------- */
  const chapterRows = useMemo<ChapterRow[]>(() => {
    const rows: ChapterRow[] = [];
    for (const syllabusSubject of syllabusSubjects) {
      for (const chapter of syllabusSubject.chapters) {
        rows.push({ subject: syllabusSubject.name, chapter: chapter.name, topics: chapter.topics.length });
      }
    }
    return rows;
  }, [syllabusSubjects]);

  const visibleChapters = useMemo<ChapterRow[]>(() => {
    const query = (chapterQuery ?? '').trim().toLowerCase();
    if (!query) return chapterRows.slice(0, MAX_CHAPTER_ROWS);
    return chapterRows
      .filter((row) => `${row.chapter} ${row.subject}`.toLowerCase().includes(query))
      .slice(0, MAX_CHAPTER_ROWS);
  }, [chapterRows, chapterQuery]);

  /** A tapped chapter lands in the task box as its own line, exactly as if
   * the student had typed it — and sets the subject when none was chosen. */
  const insertChapter = (row: ChapterRow) => {
    setTitle((current) => {
      const trimmed = current.replace(/\s+$/, '');
      return trimmed ? `${trimmed}\n${row.chapter}` : row.chapter;
    });
    setSubject((current) => current || (chipNames.includes(row.subject) ? row.subject : current));
    setPickedChapters((current) => (current.includes(row.chapter) ? current : [...current, row.chapter]));
  };

  /* ---------- swipe down to dismiss (on the grab handle) ---------- */
  const handleDragStart = (clientY: number) => {
    dragFromRef.current = clientY;
  };
  const handleDragMove = (clientY: number) => {
    if (dragFromRef.current === null) return;
    setDragY(Math.max(0, clientY - dragFromRef.current));
  };
  const handleDragEnd = () => {
    dragFromRef.current = null;
    if (dragY > SWIPE_CLOSE_PX) onClose();
    else setDragY(0);
  };

  const imagePickerStyle = {
    borderRadius: RADIUS.chip,
    border: `1px dashed ${BORDER_STRONG}`,
    color: TEXT_SECONDARY,
    opacity: readingImage ? 0.6 : 1,
  } as const;

  return (
    <div className="fixed inset-0 z-[66] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add a task">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: OVERLAY_BG }}
        onClick={onClose}
        aria-label="Cancel adding a task"
        data-testid="backdrop-add-task"
      />
      {/* The slide-up animation lives on this wrapper so the drag transform on
          the sheet itself is never overridden by the animation's fill mode.
          Height is capped at ~58% of the viewport — a partial sheet, never a
          full screen — and clamped to the app panel with the 100% term. */}
      <div
        className="relative w-full vicharak-sheet"
        style={{ height: 'min(58dvh, 100%)', maxHeight: 'min(60dvh, 100%)' }}
      >
        <div
          className="w-full h-full flex flex-col overflow-hidden"
          style={{
            background: CARD,
            borderTop: `1px solid ${BORDER_STRONG}`,
            borderTopLeftRadius: RADIUS.sheet,
            borderTopRightRadius: RADIUS.sheet,
            boxShadow: '0 -10px 40px rgba(0,0,0,0.45)',
            transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
            transition: dragFromRef.current === null ? 'transform 0.22s ease' : 'none',
          }}
          data-testid="sheet-add-task"
        >
          {/* ---------- pinned header + grab handle ---------- */}
          <div
            className="flex-shrink-0 px-5 pt-2.5 pb-3"
            style={{ borderBottom: `1px solid ${BORDER}` }}
            onTouchStart={(event) => handleDragStart(event.touches[0].clientY)}
            onTouchMove={(event) => handleDragMove(event.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
            onTouchCancel={handleDragEnd}
          >
            <div
              className="mx-auto h-1 w-11 rounded-full"
              style={{ background: BORDER_STRONG }}
              aria-hidden="true"
              data-testid="handle-add-task-sheet"
            />
            <div className="mt-2.5 flex items-start gap-3">
              {view === 'syllabus' ? (
                <button
                  type="button"
                  onClick={() => setView('form')}
                  aria-label="Back to the task list"
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 touch-manipulation"
                  style={{ background: tint(AMBER, 0.14), color: AMBER }}
                  data-testid="button-add-task-syllabus-back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : (
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: BRAND_GRADIENT, color: ON_AMBER }}
                  aria-hidden="true"
                >
                  <Plus className="w-5 h-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-extrabold" style={{ color: TEXT }}>
                  {view === 'syllabus' ? 'Pick from syllabus' : 'Add a task'}
                </h2>
                <p className="mt-0.5 text-[11px] truncate" style={{ color: TEXT_MUTED }}>
                  {view === 'syllabus'
                    ? `${examLabel} · ${chapterRows.length} chapters — tap one to add it as a task`
                    : 'Name it, pick a subject, attach a photo if it helps.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                data-testid="button-add-task-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ---------- scrolling body ---------- */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
            {view === 'syllabus' ? (
              <>
                <div
                  className="flex items-center gap-2 px-3 py-2.5"
                  style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                >
                  <Search className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                  <input
                    value={chapterQuery}
                    onChange={(event) => setChapterQuery(event.target.value)}
                    placeholder="Search chapters — thermodynamics, polity…"
                    autoFocus
                    className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                    style={{ color: TEXT }}
                    data-testid="input-add-task-chapter-search"
                  />
                  {chapterQuery && (
                    <button
                      type="button"
                      onClick={() => setChapterQuery('')}
                      aria-label="Clear chapter search"
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: tint(TEXT_MUTED, 0.14), color: TEXT_MUTED }}
                      data-testid="button-add-task-chapter-clear"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {chapterRows.length === 0 ? (
                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-add-task-no-syllabus">
                    No chapter list is loaded for {examLabel} yet — go back and type the chapter name into the task box
                    instead. It still tracks exactly the same.
                  </p>
                ) : (
                  <ul className="mt-2.5 space-y-1.5" data-testid="list-add-task-chapters">
                    {visibleChapters.map((row) => {
                      const added = pickedChapters.includes(row.chapter);
                      return (
                        <li key={`${row.subject}|${row.chapter}`}>
                          <button
                            type="button"
                            onClick={() => insertChapter(row)}
                            aria-pressed={added}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left touch-manipulation"
                            style={{
                              borderRadius: RADIUS.sm,
                              background: added ? tint(SUCCESS, 0.12) : NAVY_ALT,
                              border: `1px solid ${added ? tint(SUCCESS, 0.5) : BORDER}`,
                            }}
                            data-testid={`add-task-chapter-${row.chapter.slice(0, 32)}`}
                          >
                            <SubjectDot subject={row.subject} size={6} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>
                                {row.chapter}
                              </span>
                              <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                                {row.subject}
                                {row.topics > 0 ? ` · ${row.topics} topics` : ''}
                              </span>
                            </span>
                            {added ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold flex-shrink-0"
                                style={{ color: SUCCESS }}
                              >
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                Added
                              </span>
                            ) : (
                              <Plus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {visibleChapters.length === 0 && (
                      <li className="px-1 py-2 text-[12px]" style={{ color: TEXT_MUTED }} data-testid="text-add-task-chapter-no-match">
                        No chapter matches “{(chapterQuery ?? '').trim()}” — go back and type it in as a custom task.
                      </li>
                    )}
                  </ul>
                )}
              </>
            ) : (
              <>
                <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
                  Tasks — one per line
                  <textarea
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    rows={3}
                    autoFocus
                    placeholder={'e.g.\nRevise electrostatics — 20 solved examples\nSolve DPP 12 of thermodynamics'}
                    className="mt-1 w-full px-3 py-2.5 text-sm resize-none"
                    style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
                    data-testid="input-add-task-title"
                  />
                </label>
                <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
                  Press Enter for a new task line — add them all at once with one tap below.
                </p>

                {/* Category — a compact horizontal pill row right after the
                    title, so the whole add flow stays title → category → add.
                    Selection uses one neutral highlight; the card tag never
                    changes a task's colour by category. */}
                <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Category</p>
                <div
                  className="mt-1.5 -mx-1 px-1 flex gap-1.5 overflow-x-auto"
                  style={{ scrollbarWidth: 'none' }}
                  role="group"
                  aria-label="Task category"
                >
                  {TASK_CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        aria-pressed={active}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold flex-shrink-0 whitespace-nowrap touch-manipulation"
                        style={
                          active
                            ? { borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), color: AMBER, border: `1px solid ${tint(AMBER, 0.5)}` }
                            : { borderRadius: RADIUS.chip, background: NAVY_ALT, color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }
                        }
                        data-testid={`add-task-category-${cat}`}
                      >
                        <span aria-hidden="true">{CATEGORY_EMOJI[cat]}</span>
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Syllabus-first entry: tap a chapter instead of typing it. */}
                <button
                  type="button"
                  onClick={() => setView('syllabus')}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-extrabold touch-manipulation"
                  style={{ borderRadius: RADIUS.md, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
                  data-testid="button-add-task-pick-syllabus"
                >
                  <BookOpen className="w-4 h-4" />
                  Pick from syllabus
                  {pickedChapters.length > 0 ? ` · ${pickedChapters.length} added` : ''}
                </button>

                {/* Photo → tasks: hand the whole list over to the scanner instead. */}
                {onScanPhoto && (
                  <button
                    type="button"
                    onClick={onScanPhoto}
                    title="Add tasks from photo"
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-extrabold touch-manipulation"
                    style={{ borderRadius: RADIUS.md, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                    data-testid="button-add-task-scan-photo"
                  >
                    <Camera className="w-4 h-4" />
                    Scan tasks from a photo
                  </button>
                )}

                <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Subject</p>
                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                  {chipNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSubject((current) => (current === name ? '' : name))}
                      aria-pressed={subject === name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                      style={
                        subject === name
                          ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                          : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }
                      }
                      data-testid={`add-task-subject-${name}`}
                    >
                      <SubjectDot subject={name} size={6} />
                      {name}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px]" style={{ color: TEXT_MUTED }}>
                  {subject ? `Saving under ${subject}.` : 'No subject picked — I detect it from the task name.'}
                </p>

                {/* Attach a photo — camera when the device supports it, or gallery. */}
                <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Add image (optional)</p>
                <div className="mt-1.5 flex gap-2">
                  <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-extrabold cursor-pointer touch-manipulation" style={imagePickerStyle}>
                    {readingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={readingImage || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void pickImage(file);
                      }}
                      data-testid="input-add-task-camera"
                    />
                  </label>
                  <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-extrabold cursor-pointer touch-manipulation" style={imagePickerStyle}>
                    {readingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    Gallery
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={readingImage || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void pickImage(file);
                      }}
                      data-testid="input-add-task-gallery"
                    />
                  </label>
                </div>

                {imageDataUrl && !readingImage && (
                  <div className="mt-2.5 relative">
                    <img
                      src={imageDataUrl}
                      alt="Attached to this task"
                      className="max-h-28 mx-auto object-contain"
                      style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }}
                      data-testid="img-add-task-preview"
                    />
                    <button
                      type="button"
                      onClick={() => setImageDataUrl(null)}
                      aria-label="Remove attached image"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center touch-manipulation"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#FFFFFF' }}
                      data-testid="button-add-task-remove-image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ---------- pinned footer: the one primary action ---------- */}
          <div
            className="flex-shrink-0 px-5 pt-2.5"
            style={{
              borderTop: `1px solid ${BORDER}`,
              background: CARD,
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            }}
          >
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                writeLastCategory(category);
                onSave({ titles: titleLines, subject, imageDataUrl, category });
              }}
              className="w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation transition-transform active:scale-[0.98]"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-add-task-save"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : (
                <><Plus className="w-4 h-4" />{titleLines.length > 1 ? `Add All · ${titleLines.length} tasks` : 'Add task'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
