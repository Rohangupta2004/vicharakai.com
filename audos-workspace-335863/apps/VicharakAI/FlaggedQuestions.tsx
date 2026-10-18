/**
 * Mistake Book questions — the smart revision queue built from questions the
 * student found hard.
 *
 * Three pieces, all owned by App.tsx state:
 *  - FlaggedSection: the Today-screen section — queue count, a peek at the
 *    latest entries (photo and/or text), an "Add to Mistake Book" entry point
 *    and the "Practice saved questions" button.
 *  - FlagCaptureSheet: one sheet, both inputs at once — a text area to type
 *    or paste the question AND an optional photo. Nothing is AI-analysed on
 *    add (CHANGE 4): the photo simply attaches and the question saves exactly
 *    as the student entered it, under the subject they pick. At least one of
 *    text/photo is required.
 *  - FlaggedTestSetupSheet: pick concepts (filter chips) + question count +
 *    timer → App curates a timed test from the doubt pool (AI converts
 *    open-ended doubts into MCQs on the fly).
 */

import { useMemo, useState } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, Flag, Loader2, Plus, Trophy, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';
import { SubjectDot } from './ui';
import { extractJsonObject } from './customExam';
import { uploadImage } from './Attachments';
import { MCQ_LETTERS, flaggedConceptLabel, flaggedOptions, type FlaggedRow, type McqLetter } from './mcq';
import { ENABLE_AUTO_QUESTION_GEN } from './config/sharedConfig';

/* ------------------------------------------------------------------ */
/*  Draft shape shared with App.tsx                                    */
/* ------------------------------------------------------------------ */

export interface FlaggedDraft {
  question: string;
  subject: string;
  topic: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard' | '';
  options: string[] | null;
  correct: McqLetter | null;
  imageUrl: string | null;
  sourceType: 'photo' | 'manual';
  /** Where the entry came from, e.g. "NEET Full Mock #3". Optional. */
  sourceLabel?: string | null;
  /** The student's own complete solution/explanation — optional, never forced. */
  solutionText?: string | null;
  /** True when a complete solution was provided (gates the test pool). */
  hasSolution?: boolean;
  /** Confidence (0–1) of the subject/chapter tag. 1 = the student picked it
   * themselves; below the app's threshold the tag renders as an editable
   * suggestion chip. Omit for legacy callers (stored as null). */
  tagConfidence?: number | null;
}

const EMPTY_DRAFT: FlaggedDraft = {
  question: '',
  subject: '',
  topic: '',
  concept: '',
  difficulty: '',
  options: null,
  correct: null,
  imageUrl: null,
  sourceType: 'manual',
  sourceLabel: null,
  solutionText: null,
  hasSolution: false,
};

const EXTRACTION_PROMPT = [
  'This is a photo of an exam question (from a textbook, past paper or notes).',
  'Extract it and reply with STRICT JSON only — no prose, no markdown fences:',
  '{',
  '  "question": "the full question text, cleaned up",',
  '  "options": ["option A text", "option B text", "option C text", "option D text"] or null when no choices are visible,',
  '  "correct": "A"|"B"|"C"|"D" or null when the correct answer is not marked,',
  '  "concept": "the specific underlying concept being tested, e.g. Kirchhoff\'s Laws — loop rule",',
  '  "subject": "the school subject this belongs to, e.g. Physics",',
  '  "topic": "the chapter it maps to, e.g. Current Electricity",',
  '  "difficulty": "easy"|"medium"|"hard" (your estimate)',
  '}',
  'Do not solve the question. Transcribe faithfully; include essential diagram labels in the question text.',
].join('\n');

function normalizeDifficulty(value: unknown): FlaggedDraft['difficulty'] {
  const d = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return d === 'easy' || d === 'medium' || d === 'hard' ? d : '';
}

/* ------------------------------------------------------------------ */
/*  Today-screen section                                               */
/* ------------------------------------------------------------------ */

export function FlaggedSection({
  rows,
  onAdd,
  onPractice,
  onRemove,
}: {
  /** Queued (not yet cleared) Mistake Book entries, newest first. */
  rows: FlaggedRow[];
  onAdd: () => void;
  onPractice: () => void;
  onRemove: (row: FlaggedRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = rows.slice(0, 5);

  return (
    <section className="mt-4 vicharak-fade" data-testid="section-flagged">
      <div
        className="px-4 py-3.5"
        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-3.5 text-left touch-manipulation"
          data-testid="button-toggle-flagged"
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(DANGER, 0.12), color: DANGER }}>
            <Flag className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold" style={{ color: TEXT }}>
              Question Revision
            </span>
            <span className="block text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>
              Hard questions you saved — they come back for spaced revision
            </span>
          </span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: open ? 'rotate(180deg)' : undefined }} />
        </button>

        {open && (
          <div className="mt-3 vicharak-fade">
            {preview.length === 0 ? (
              <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                Your Mistake Book is empty. When a question stumps you, add it — type it, snap it, or both — and I'll name the concept it tests and bring it back until you own it.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {preview.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-2.5 px-3 py-2.5"
                    style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                    data-testid={`flagged-row-${row.id}`}
                  >
                    <SubjectDot subject={row.subject} size={6} />
                    <span className="min-w-0 flex-1">
                      {row.image_url && (
                        <img
                          src={row.image_url}
                          alt="Mistake Book question photo"
                          className="mb-1.5 max-h-24 object-contain"
                          style={{ borderRadius: 8, border: `1px solid ${BORDER}` }}
                        />
                      )}
                      {(row.question_text ?? '').trim() !== '' && (
                        <span className="block text-[12px] font-semibold leading-snug" style={{ color: TEXT_SECONDARY, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.question_text}
                        </span>
                      )}
                      <span className="block text-[10px] mt-0.5 truncate" style={{ color: TEXT_MUTED }}>
                        {flaggedConceptLabel(row)}
                        {row.difficulty ? ` · ${row.difficulty}` : ''}
                        {flaggedOptions(row) ? ' · MCQ' : ' · open-ended'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(row)}
                      aria-label="Remove this Mistake Book entry"
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                      style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }}
                      data-testid={`flagged-remove-${row.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
                {rows.length > preview.length && (
                  <li className="text-[10px] text-center pt-1" style={{ color: TEXT_MUTED }}>
                    More come forward as these clear.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onAdd}
          className="mt-3 w-full py-2.5 text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
          data-testid="button-flag-add"
        >
          <Plus className="w-3.5 h-3.5" />
          Add question
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={onPractice}
            className="mt-2 w-full py-3 text-[13px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-practice-flagged"
          >
            <Trophy className="w-4 h-4" />
            Practice saved questions
          </button>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Capture sheet — text and photo, side by side                       */
/* ------------------------------------------------------------------ */

export function FlagCaptureSheet({
  subjects,
  spaceId,
  canAskAi,
  onAiCharged,
  saving,
  onSave,
  onClose,
}: {
  subjects: string[];
  spaceId: string;
  canAskAi: boolean;
  onAiCharged: () => void;
  saving: boolean;
  onSave: (draft: FlaggedDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FlaggedDraft>({ ...EMPTY_DRAFT });
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(false);

  const set = (patch: Partial<FlaggedDraft>) => setDraft((current) => ({ ...current, ...patch }));

  /** CHANGE 4: the photo just attaches — no AI reading, no auto-fill. */
  const attachPhoto = async (file: File) => {
    setReading(true);
    setError(null);
    setNote(null);
    setExtracted(false);
    try {
      const url = await uploadImage(file, spaceId);
      set({ imageUrl: url, sourceType: 'photo' });
      setNote('Photo attached — pick the subject and save.');
    } catch {
      setError("That photo didn't upload — mind trying once more?");
    } finally {
      setReading(false);
    }
  };

  /* At least one of text / photo is required — both are optional individually. */
  const canSave = ((draft.question ?? '').trim().length > 0 || !!draft.imageUrl) && !reading && !saving;

  const pill = (active: boolean) =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add a question for revision">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close question capture" />
      <div
        className="relative max-h-[90vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(DANGER, 0.12), color: DANGER }}>
            <Flag className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Add a question</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>Type it or attach a photo — it saves exactly as you enter it, under your subject.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block mt-4 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
          Your question
          <textarea
            value={draft.question}
            onChange={(event) => set({ question: event.target.value })}
            rows={4}
            placeholder="Type or paste the question you got wrong"
            className="mt-1 w-full px-3 py-2.5 text-sm resize-none"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
            data-testid="input-flag-question"
          />
        </label>

        <label
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3.5 text-center cursor-pointer"
          style={{ borderColor: BORDER_STRONG, background: NAVY_ALT, color: TEXT_SECONDARY, opacity: reading ? 0.7 : 1 }}
        >
          {reading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          <span className="text-xs font-extrabold">
            {reading ? 'Uploading your photo…' : draft.imageUrl ? 'Photo attached — tap to replace' : 'Attach photo (optional)'}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={reading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void attachPhoto(file);
            }}
            data-testid="input-flag-photo"
          />
        </label>

        {draft.imageUrl && !reading && (
          <div className="mt-2 relative">
            <img
              src={draft.imageUrl}
              alt="Attached question photo"
              className="max-h-36 mx-auto object-contain"
              style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }}
            />
            <button
              type="button"
              onClick={() => {
                set({ imageUrl: null, sourceType: 'manual' });
                setNote(null);
                setExtracted(false);
              }}
              aria-label="Remove attached photo"
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center touch-manipulation"
              style={{ background: OVERLAY_BG, color: '#FFFFFF' }}
              data-testid="button-flag-remove-photo"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-flag-error">
            {error}
          </p>
        )}

        {note && (
          <p className="mt-3 text-[11px] leading-relaxed px-3 py-2" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-flag-note">
            {note}
          </p>
        )}

        {extracted && (
          <p className="mt-3 text-[11px] font-bold px-3 py-2" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: AMBER }} data-testid="text-flag-extracted">
            ✓ Extracted from your photo — check the fields below and fix anything I misread before saving.
          </p>
        )}

        {draft.options && (
          <div className="mt-3">
            <p className="text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Options (tap the correct one, if you know it)</p>
            <div className="mt-1.5 space-y-1.5">
              {draft.options.map((option, index) => {
                const letter = MCQ_LETTERS[index];
                const isCorrect = draft.correct === letter;
                return (
                  <div key={letter} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => set({ correct: isCorrect ? null : letter })}
                      aria-pressed={isCorrect}
                      aria-label={`Mark option ${letter} correct`}
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold touch-manipulation"
                      style={{ background: isCorrect ? AMBER : BORDER, color: isCorrect ? '#FFFFFF' : TEXT_SECONDARY }}
                    >
                      {isCorrect ? <Check className="w-3.5 h-3.5" /> : letter}
                    </button>
                    <input
                      value={option}
                      onChange={(event) =>
                        set({ options: (draft.options ?? []).map((o, i) => (i === index ? event.target.value : o)) })
                      }
                      className="flex-1 min-w-0 px-3 py-2 text-[12px]"
                      style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
                      aria-label={`Option ${letter}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional solution — never a forced step. A saved solution makes the
            question eligible for the doubts-based Test Generator. */}
        <label className="block mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
          Your solution (optional)
          <textarea
            value={draft.solutionText ?? ''}
            onChange={(event) => set({ solutionText: event.target.value })}
            rows={3}
            placeholder="Solve it yourself and type your complete solution here"
            className="mt-1 w-full px-3 py-2.5 text-sm resize-none"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
            data-testid="input-flag-solution"
          />
        </label>
        {!String(draft.solutionText ?? '').trim() && (
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-flag-solution-hint">
            I'll save this question either way. Solve it yourself and type your solution here so VicharakAI can use it
            for future revision and tests.
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
            Subject
            <select
              value={draft.subject}
              onChange={(event) => set({ subject: event.target.value })}
              className="mt-1 w-full px-3 py-2 text-sm"
              style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
              data-testid="select-flag-subject"
            >
              <option value="">Choose</option>
              {Array.from(new Set([draft.subject, ...subjects, 'General'])).filter(Boolean).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
            Chapter / topic
            <input
              value={draft.topic}
              onChange={(event) => set({ topic: event.target.value })}
              placeholder="e.g. Current Electricity"
              className="mt-1 w-full px-3 py-2 text-sm"
              style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
              data-testid="input-flag-topic"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            onSave({
              ...draft,
              subject: draft.subject || 'General',
              sourceType: draft.imageUrl ? 'photo' : 'manual',
              solutionText: String(draft.solutionText ?? '').trim() || null,
              hasSolution: String(draft.solutionText ?? '').trim().length > 0,
              // A subject the student picked is certain; an unpicked one is a
              // General filing at zero confidence — never "the first subject".
              tagConfidence: draft.subject ? 1 : 0,
            })
          }
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-save-flag"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Flag className="w-4 h-4" />Save question</>}
        </button>
        {!(draft.question ?? '').trim() && !draft.imageUrl && (
          <p className="mt-2 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
            Type your question or attach a photo — at least one is needed to save.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Practice test setup — concepts + count + timer                     */
/* ------------------------------------------------------------------ */

export const FLAGGED_TEST_COUNTS = [5, 10, 15] as const;
export const FLAGGED_TIME_LIMITS = [10, 15, 20] as const;

export function FlaggedTestSetupSheet({
  rows,
  preparing,
  prepareNote,
  error,
  onStart,
  onClose,
}: {
  rows: FlaggedRow[];
  preparing: boolean;
  prepareNote: string | null;
  error: string | null;
  onStart: (selected: FlaggedRow[], count: number, timeLimitMinutes: number | null) => void;
  onClose: () => void;
}) {
  /** Concept filter chips — built from the queue itself. */
  const concepts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const label = flaggedConceptLabel(row);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [rows]);

  const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set());
  const [count, setCount] = useState<number>(5);
  const [timeLimit, setTimeLimit] = useState<number | null>(10);

  const pool = useMemo(
    () => (selectedConcepts.size === 0 ? rows : rows.filter((row) => selectedConcepts.has(flaggedConceptLabel(row)))),
    [rows, selectedConcepts],
  );

  const toggle = (label: string) =>
    setSelectedConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const pill = (active: boolean) =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  const effectiveCount = Math.min(count, pool.length);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Practice saved questions">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={preparing ? undefined : onClose} aria-label="Close question practice setup" />
      <div
        className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(DANGER, 0.12), color: DANGER }}>
            <Trophy className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Practice saved questions</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
              Timed test from your own hard questions. Answer one correctly and it leaves the queue.
            </p>
          </div>
          <button type="button" disabled={preparing} onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
          1 · Concepts ({selectedConcepts.size === 0 ? 'all included' : `${selectedConcepts.size} selected`})
        </p>
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {concepts.map(({ label, count: n }) => {
            const active = selectedConcepts.has(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                aria-pressed={active}
                className="px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                style={pill(active)}
                data-testid={`flagged-concept-${label.slice(0, 20)}`}
              >
                {label} · {n}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>2 · Questions ({pool.length} available)</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {FLAGGED_TEST_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} disabled={pool.length === 0} className="py-2.5 text-sm font-extrabold disabled:opacity-40 touch-manipulation" style={pill(count === n)} data-testid={`flagged-count-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>3 · Timer</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button type="button" onClick={() => setTimeLimit(null)} className="py-2.5 text-[13px] font-extrabold touch-manipulation" style={pill(timeLimit === null)} data-testid="flagged-time-none">
            None
          </button>
          {FLAGGED_TIME_LIMITS.map((m) => (
            <button key={m} type="button" onClick={() => setTimeLimit(m)} className="py-2.5 text-[13px] font-extrabold touch-manipulation" style={pill(timeLimit === m)} data-testid={`flagged-time-${m}`}>
              {m}m
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-flagged-test-error">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={preparing || pool.length === 0}
          onClick={() => onStart(pool, effectiveCount, timeLimit)}
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-start-flagged-test"
        >
          {preparing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{prepareNote || 'Preparing your test…'}</>
          ) : error ? (
            'Retry'
          ) : (
            <>Start {effectiveCount}-question test<ChevronRight className="w-4 h-4" /></>
          )}
        </button>
        {/* TODO: Re-enable once question generation is validated — currently producing incorrect answers.
            With generation off, open-ended doubts cannot be converted, so the caller only passes MCQ-shaped rows. */}
        {!preparing && ENABLE_AUTO_QUESTION_GEN && pool.some((row) => !flaggedOptions(row)) && (
          <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
            Open-ended questions are converted into MCQs by AI when the test starts.
          </p>
        )}
      </div>
    </div>
  );
}
