/**
 * Mistake Book — the dedicated bank of questions the student got wrong or
 * got stuck on, reached from the bottom nav. (Internally the feature is still
 * "doubts": the display label changed, the storage keys and identifiers did
 * not.)
 *
 * Capture paths (CAPTURE-FIRST):
 *  - CAMERA (snap): the photo saves to the Mistake Book the moment it is
 *    taken (EXIF-stripped on-device, under 3 seconds). Upload, OCR and the
 *    CONSTRAINED tagging (features/doubts/autoTag — the exam's own chapter
 *    list only, with a confidence score; never a free-invented name) all run
 *    BEHIND the save; a failed upload queues locally and retries when the
 *    network returns, so a snap is never lost and never blocks. No answer is
 *    required at capture — resolving is a task on Today.
 *  - GALLERY (upload a screenshot / photo of a PRINTED question): read
 *    locally with Tesseract.js in a Web Worker (doubtOcr.ts). Each picked
 *    image becomes its own card with a "Reading text…" state; the extracted
 *    text pre-fills an editable box for the student to confirm, with Retry on
 *    failure or timeout. The image is EXIF-stripped via canvas before any
 *    processing. If the local read fails or is too low-confidence, an AI
 *    vision fallback (doubtOcr.aiOcrText) quietly reads the clean JPEG before
 *    the manual-typing prompt appears. Several screenshots can process at
 *    once — local OCR runs one page at a time off-thread.
 * Saved entries land in the existing question queue, and the app's planner
 * surfaces a "Clear doubt: …" revision task on Today automatically.
 *
 * Mistake Book entries live in the same zuno_question_queue rows as Question
 * Revision, so the spaced-revision loop and practice tests keep working
 * unchanged — only the display labels moved.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, NotebookPen, Pencil, RefreshCw, RotateCcw, Search, Sparkles, Target, Timer, Trophy, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  DANGER,
  DOUBT_ACCENT,
  DOUBT_GRADIENT,
  NAVY_ALT,
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
import { Card, SubjectDot } from './ui';
import { uploadImage } from './Attachments';
import { OCR_MIN_CONFIDENCE, aiOcrText, cleanOcrQuestionText, dataUrlToJpegFile, fileToCleanJpeg, recognizeText, tidyOcrText } from './doubtOcr';
import { ENABLE_AUTO_QUESTION_GEN, clearPyqConcept, duePyqConcepts } from './config/sharedConfig';
import { todayISO } from './engine';
import { TAG_CONFIDENCE_THRESHOLD, autoTagQuestion, type CatalogSubject } from './features/doubts/autoTag';
import { MCQ_LETTERS, flaggedConceptLabel, flaggedOptions, flaggedShortTitle, flaggedTagConfidence, type FlaggedRow, type McqLetter } from './mcq';
import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';
import type { FlaggedDraft } from './FlaggedQuestions';

/** One uploaded screenshot working its way through local OCR. */
interface ScreenshotCard {
  key: string;
  /** Clean (EXIF-stripped) JPEG data URL — the preview AND the OCR input. */
  previewUrl: string | null;
  /** Hosted URL once the background storage upload finishes. */
  hostedUrl: string | null;
  /** 'ai' = the silent AI-vision fallback is reading after a weak local pass;
   * 'cleaning' = the low-cost cleanup model is fixing OCR mistakes. */
  status: 'reading' | 'ai' | 'cleaning' | 'ready' | 'failed';
  text: string;
  /** True once the student typed — an arriving OCR result must not overwrite it. */
  edited: boolean;
  confidence: number | null;
  /** The student's own solution — optional; saving one gates the test pool. */
  solution: string;
  saving: boolean;
}

let shotCounter = 0;
const makeShotKey = () => `shot-${Date.now()}-${++shotCounter}`;

function formatEntryDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

/**
 * The editable tag chip on every card. Confident tags read as a plain chip;
 * below-threshold tags read as a dashed SUGGESTION ("subject?"). Tapping
 * either opens a one-tap subject picker right under the card - one tap on a
 * subject corrects the tag (and logs the correction upstream).
 */
function TagChip({
  row,
  subjects,
  open,
  onToggle,
  onPick,
}: {
  row: FlaggedRow;
  subjects: string[];
  open: boolean;
  onToggle: () => void;
  onPick: (subject: string) => void;
}) {
  const confidence = flaggedTagConfidence(row);
  const uncertain = confidence !== null && confidence < TAG_CONFIDENCE_THRESHOLD;
  const subject = row.subject || 'General';
  const color = subjectColor(subject);
  const choices = Array.from(new Set([...subjects, 'General'])).filter(Boolean);
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-expanded={open}
        aria-label={uncertain ? `Suggested subject ${subject} - tap to confirm or change` : `Subject ${subject} - tap to change`}
        title={uncertain ? 'My best guess - tap to confirm or fix' : 'Tap to change the subject'}
        className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold touch-manipulation"
        style={
          uncertain
            ? { borderRadius: RADIUS.chip, border: `1px dashed ${tint(WARNING, 0.6)}`, background: tint(WARNING, 0.08), color: WARNING }
            : { borderRadius: RADIUS.chip, border: `1px solid ${tint(color, 0.35)}`, background: tint(color, 0.08), color }
        }
        data-testid={`tag-chip-${row.id}`}
      >
        <SubjectDot subject={subject} size={5} />
        {subject}
        {uncertain ? '?' : ''}
        <Pencil className="w-2.5 h-2.5 opacity-70" aria-hidden="true" />
      </button>
      {open && (
        <span className="mt-1.5 flex flex-wrap gap-1.5 vicharak-fade" data-testid={`tag-picker-${row.id}`}>
          {choices.map((name) => {
            const active = name === subject;
            return (
              <button
                key={name}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPick(name);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-extrabold touch-manipulation"
                style={
                  active
                    ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                    : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT }
                }
                data-testid={`tag-pick-${row.id}-${name.slice(0, 16)}`}
              >
                {active && <Check className="w-3 h-3" />}
                {name}
              </button>
            );
          })}
        </span>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid → Deck — the Mistake Book's two-state card UI (Change 1)      */
/* ------------------------------------------------------------------ */

/** Releasing a horizontal drag past this many pixels commits the swipe. */
const MB_COMMIT_PX = 90;
/** How long a swiped card takes to fly out before the next one rises. */
const MB_LEAVE_MS = 300;

/** Grid tiles read like a spread of sticky notes; tapping one springs it to
 * centre-front while the rest collapse into a fanned deck behind it. All
 * colours come from the existing theme tokens — nothing new. */
const MB_DECK_CSS = `
.vk-mb-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.vk-mb-tile { position: relative; display: flex; flex-direction: column; text-align: left; padding: 12px; border-radius: 16px; box-shadow: 0 3px 12px rgba(3, 6, 15, 0.35); animation: vkMbRise 0.34s cubic-bezier(0.22, 1, 0.36, 1) both; }
.vk-mb-tile-tap { transition: transform 0.15s ease; }
.vk-mb-tile-tap:active { transform: scale(0.97); }
@keyframes vkMbRise { from { opacity: 0; transform: translateY(10px) scale(0.94); } to { opacity: 1; transform: none; } }
.vk-mb-stage { position: relative; touch-action: pan-y; }
.vk-mb-sheet { position: absolute; inset: 0; border-radius: 18px; pointer-events: none; }
.vk-mb-card { position: relative; z-index: 2; border-radius: 18px; overflow: hidden; user-select: none; -webkit-user-select: none; cursor: grab; touch-action: pan-y; }
.vk-mb-card:active { cursor: grabbing; }
.vk-mb-card-in { animation: vkMbDeckIn 0.46s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes vkMbDeckIn { from { opacity: 0.25; transform: translateY(34px) scale(0.6); } to { opacity: 1; transform: none; } }
.vk-mb-act { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 46px; border-radius: 999px; font-size: 12px; font-weight: 800; transition: transform 0.12s ease, filter 0.15s ease; }
.vk-mb-act:not(:disabled):hover { filter: brightness(1.08); }
.vk-mb-act:not(:disabled):active { transform: scale(0.96); }
.vk-mb-act:disabled { opacity: 0.55; }
`;

/** The small difficulty dot on tiles and cards — theme semantics only. */
function difficultyColor(difficulty: string | null | undefined): string {
  const d = String(difficulty ?? '').toLowerCase();
  if (d === 'easy') return SUCCESS;
  if (d === 'medium') return WARNING;
  if (d === 'hard') return DANGER;
  return TEXT_MUTED;
}

/** Why this card is in front of the student — one small, friendly line. */
function mistakeWhyLine(row: FlaggedRow): string {
  const from = String(row.source_label ?? '').trim();
  if (from) return `You got this wrong in ${from}`;
  if (row.source_type === 'quiz') return 'You answered this one wrong in a practice test';
  const when = formatEntryDate(row.created_on);
  if (row.source_type === 'photo') return when ? `You snapped this mistake on ${when}` : 'You snapped this mistake';
  return when ? `You saved this on ${when} — here for a quick recall` : 'Saved for a quick recall';
}

/** CHANGE 2 — the session clock ticks in its OWN tiny component so the
 * once-a-second tick never re-renders the deck (or the card mid-drag). */
function DeckSessionClock({ startedAt }: { startedAt: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const tick = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(tick);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return (
    <>
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </>
  );
}

/** Per-card clock — "12s" — restarts whenever a new card takes the front.
 * Its own tiny component for the same reason as DeckSessionClock: the
 * once-a-second tick must never re-render the deck (or the card mid-drag). */
function CardSecondsClock({ cardKey }: { cardKey: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const tick = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(tick);
  }, [cardKey]);
  if (seconds < 60) return <>{seconds}s</>;
  return (
    <>
      {Math.floor(seconds / 60)}m {seconds % 60}s
    </>
  );
}

/**
 * One grid tile — memoized (PERF) so typing in the capture box, opening one
 * tile's tag picker or any other DoubtsTab state change re-renders only the
 * tiles whose props actually changed, never the whole spread.
 */
const MistakeTile = memo(function MistakeTile({
  row,
  index,
  subjects,
  retagOpen,
  onToggleRetag,
  onRetag,
  onRemove,
  onOpen,
  onUpdateDraft,
}: {
  row: FlaggedRow;
  index: number;
  subjects: string[];
  retagOpen: boolean;
  onToggleRetag: (id: number) => void;
  onRetag: (row: FlaggedRow, subject: string) => void;
  onRemove: (row: FlaggedRow) => void;
  onOpen: (row: FlaggedRow) => void;
  onUpdateDraft: (row: FlaggedRow, patch: Record<string, unknown>) => void;
}) {
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText] = useState(() => String(row.ai_draft_answer ?? ''));
  const aiDraft = String(row.ai_draft_answer ?? '').trim();
  const draftReady = aiDraft.length > 0 && ['ready', 'confirmed', 'edited'].includes(String(row.ai_draft_status));
  return (
    <div
      className="vk-mb-tile"
      style={{
        background: DOUBT_GRADIENT,
        border: `1px solid ${tint(DOUBT_ACCENT, 0.35)}`,
        animationDelay: `${Math.min(index, 9) * 28}ms`,
      }}
      data-testid={`mistake-tile-${row.id}`}
    >
      <button
        type="button"
        onClick={() => onRemove(row)}
        aria-label="Remove this mistake"
        className="absolute top-2 right-2 z-[2] w-6 h-6 rounded-full flex items-center justify-center touch-manipulation"
        style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.12) }}
        data-testid={`mistake-tile-remove-${row.id}`}
      >
        <X className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="vk-mb-tile-tap flex-1 min-w-0 text-left touch-manipulation"
        aria-label="Open this card — the rest stack behind it as a deck"
        data-testid={`mistake-tile-open-${row.id}`}
      >
        {row.image_url && (
          <img
            src={row.image_url}
            alt="Mistake Book question photo"
            className="w-full h-16 object-cover mb-2"
            style={{ borderRadius: 10, border: `1px solid ${BORDER}` }}
          />
        )}
        <span
          className="block text-[12px] font-semibold leading-snug pr-4"
          style={{ color: TEXT_SECONDARY, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {flaggedShortTitle(row)}
        </span>
        <span className="block text-[9px] mt-1" style={{ color: TEXT_MUTED }}>
          Added {formatEntryDate(row.created_on)} · revision scheduled
        </span>
      </button>
      {row.source_type === 'photo' && (
        <div
          className="mt-2 px-2.5 py-2"
          style={{ borderRadius: 10, background: tint(DOUBT_ACCENT, 0.08), border: `1px solid ${tint(DOUBT_ACCENT, 0.28)}` }}
          data-testid={`ai-draft-${row.id}`}
        >
          <p className="text-[10px] font-extrabold" style={{ color: DOUBT_ACCENT }}>
            {row.ai_draft_status === 'confirmed' || row.ai_draft_status === 'edited'
              ? 'AI draft confirmed'
              : draftReady
                ? 'AI draft - confirm?'
                : row.ai_draft_status === 'failed'
                  ? 'AI draft pending retry'
                  : 'AI drafting answer…'}
          </p>
          {draftReady && (
            editingDraft ? (
              <>
                <textarea
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  rows={4}
                  className="mt-1.5 w-full px-2 py-1.5 text-[11px] resize-none"
                  style={{ borderRadius: 8, background: NAVY_ALT, border: `1px solid ${BORDER}`, color: TEXT }}
                  data-testid={`input-ai-draft-${row.id}`}
                />
                <button
                  type="button"
                  disabled={!draftText.trim()}
                  onClick={() => {
                    const answer = draftText.trim();
                    if (!answer) return;
                    onUpdateDraft(row, {
                      ai_draft_answer: answer,
                      ai_draft_status: 'edited',
                      solution_text: answer,
                      has_solution: true,
                      resolved_at: new Date().toISOString(),
                    });
                    setEditingDraft(false);
                  }}
                  className="mt-1.5 px-2.5 py-1.5 text-[10px] font-extrabold disabled:opacity-50"
                  style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                  data-testid={`button-save-ai-draft-${row.id}`}
                >
                  Save edit
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_SECONDARY, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {aiDraft}
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  {row.ai_draft_status !== 'confirmed' && row.ai_draft_status !== 'edited' && (
                    <button
                      type="button"
                      onClick={() => onUpdateDraft(row, {
                        ai_draft_status: 'confirmed',
                        solution_text: aiDraft,
                        has_solution: true,
                        resolved_at: new Date().toISOString(),
                      })}
                      className="px-2.5 py-1.5 text-[10px] font-extrabold"
                      style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid={`button-confirm-ai-draft-${row.id}`}
                    >
                      Looks right
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDraftText(aiDraft);
                      setEditingDraft(true);
                    }}
                    className="px-2.5 py-1.5 text-[10px] font-extrabold"
                    style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY }}
                    data-testid={`button-edit-ai-draft-${row.id}`}
                  >
                    Edit
                  </button>
                </div>
              </>
            )
          )}
          {row.ai_draft_status === 'failed' && (
            <p className="mt-1 text-[9px] leading-relaxed" style={{ color: TEXT_MUTED }}>
              The card is saved and already in revision. VicharakAI will retry the draft later.
            </p>
          )}
        </div>
      )}
      {/* ONE-TAP TAG CORRECTION stays on every tile, plus the
          difficulty dot beside it. */}
      <span className="flex items-center gap-1.5 flex-wrap">
        <TagChip
          row={row}
          subjects={subjects}
          open={retagOpen}
          onToggle={() => onToggleRetag(row.id)}
          onPick={(subject) => {
            onToggleRetag(row.id);
            onRetag(row, subject);
          }}
        />
        <span
          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: difficultyColor(row.difficulty) }}
          title={row.difficulty ? `Difficulty: ${row.difficulty}` : 'Difficulty not set'}
          aria-hidden="true"
        />
      </span>
    </div>
  );
});

/**
 * State A — GRID: every saved card as a lightweight 2-column tile (question
 * preview, subject tag, difficulty dot). State B — DECK: tapping a tile
 * springs that card to centre-front with the rest fanned behind it; swipe
 * left = Again, swipe right = Got it (the same responses sit underneath as
 * pill buttons, with Explain beside them), '3 / 12' progress on top, a back
 * button (top-left) collapses the deck to the grid with a reverse feel, and
 * the session timer sits in a quiet strip at the BOTTOM of the deck screen
 * (Change 2). Every grade funnels through the ONE FSRS scheduler
 * (doubts.gradeFlagged, reached via onGrade).
 */
function MistakeGridDeck({
  rows,
  subjects,
  canAskAi,
  gradeSaving,
  onGrade,
  onExplainBlocked,
  onAiCharged,
  onPersistExplanation,
  onRetag,
  onRemove,
  onUpdateDraft,
  retagOpenId,
  onToggleRetag,
}: {
  rows: FlaggedRow[];
  subjects: string[];
  canAskAi: boolean;
  gradeSaving: boolean;
  /** Commits one review. When it resolves false the write FAILED — the deck
   * brings the card back instead of silently losing the response. */
  onGrade: (row: FlaggedRow, grade: 'again' | 'good') => void | Promise<boolean>;
  onExplainBlocked: () => void;
  onAiCharged: () => void;
  /** Saves a fetched AI explanation onto the row (best-effort). */
  onPersistExplanation?: (row: FlaggedRow, text: string) => void;
  onRetag: (row: FlaggedRow, subject: string) => void;
  onRemove: (row: FlaggedRow) => void;
  onUpdateDraft: (row: FlaggedRow, patch: Record<string, unknown>) => void;
  retagOpenId: number | null;
  onToggleRetag: (id: number) => void;
}) {
  const [mode, setMode] = useState<'grid' | 'deck'>('grid');
  /** The deck order fixed at open time — the tapped card first. */
  const [deckIds, setDeckIds] = useState<number[]>([]);
  const [deckStartedAt, setDeckStartedAt] = useState(0);
  /** Cards this deck session has graded — hidden locally the moment they fly
   * out, so the deck advances instantly while the write lands behind it. */
  const [swiped, setSwiped] = useState<Set<number>>(() => new Set());
  const [reviewed, setReviewed] = useState(0);
  const [leaving, setLeaving] = useState<{ id: number; dir: 'left' | 'right' } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  /** A photo card with a saved answer keeps it hidden until self-check. */
  const [answerRevealed, setAnswerRevealed] = useState(false);
  /** The transcript/options/answer wait behind ONE small toggle — the image
   * is the card's primary content, so text never sits under it by default. */
  const [detailOpen, setDetailOpen] = useState(false);
  /** Explain — a short AI explanation written onto the card; never grades. */
  const [explainId, setExplainId] = useState<number | null>(null);
  const [explainText, setExplainText] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);

  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row] as const)), [rows]);
  const queue = mode === 'deck' ? deckIds.filter((id) => byId.has(id) && !swiped.has(id)).map((id) => byId.get(id) as FlaggedRow) : [];
  const card = queue[0] ?? null;
  const total = reviewed + queue.length;

  /* Stable per rows-change (PERF) so the memoized grid tiles skip
   * re-rendering when only unrelated deck state (drag, explain) changes. */
  const openDeck = useCallback((row: FlaggedRow) => {
    const index = Math.max(0, rows.findIndex((r) => r.id === row.id));
    setDeckIds([...rows.slice(index), ...rows.slice(0, index)].map((r) => r.id));
    setSwiped(new Set());
    setReviewed(0);
    setLeaving(null);
    setDragX(0);
    setAnswerRevealed(false);
    setExplainId(null);
    setExplainText('');
    setDeckStartedAt(Date.now());
    setMode('deck');
  }, [rows]);

  const closeDeck = () => {
    setMode('grid');
    setLeaving(null);
    setDragX(0);
    setExplainId(null);
    setExplainText('');
  };

  /* A fresh front card never inherits the previous card's revealed answer. */
  useEffect(() => {
    setAnswerRevealed(false);
    setDetailOpen(false);
  }, [card?.id]);

  /* Every card in the deck reviewed → collapse back to the grid on its own. */
  useEffect(() => {
    if (mode !== 'deck' || queue.length > 0) return;
    const t = window.setTimeout(() => closeDeck(), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, queue.length]);

  /* Book-keeping for failed grade writes: `counted` = cards the deck already
   * advanced past; `failed` = cards whose write failed BEFORE the fly-out
   * finished, so the timeout must not count them. Either way a failed card
   * returns to the deck — a response is never silently lost. */
  const countedRef = useRef<Set<number>>(new Set());
  const failedRef = useRef<Set<number>>(new Set());

  const commit = (dir: 'left' | 'right') => {
    if (!card || leaving) return;
    const row = card;
    setLeaving({ id: row.id, dir });
    setDragging(false);
    setExplainId(null);
    setExplainText('');
    /* The write starts while the card flies out — gradeFlagged owns the
     * toast, the FSRS write and the queue refresh. Writes are serialized in
     * useDoubts, so grading the next card immediately is safe. If THIS write
     * ultimately fails, the card comes back into the deck. */
    void Promise.resolve(onGrade(row, dir === 'right' ? 'good' : 'again')).then((saved) => {
      if (saved !== false) return;
      if (countedRef.current.has(row.id)) {
        countedRef.current.delete(row.id);
        setSwiped((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
        setReviewed((n) => Math.max(0, n - 1));
      } else {
        failedRef.current.add(row.id);
      }
    });
    window.setTimeout(() => {
      setLeaving(null);
      setDragX(0);
      if (failedRef.current.has(row.id)) {
        failedRef.current.delete(row.id);
        return;
      }
      countedRef.current.add(row.id);
      setSwiped((prev) => new Set(prev).add(row.id));
      setReviewed((n) => n + 1);
    }, MB_LEAVE_MS);
  };

  /* ---------- swipe — vertical scrolling always wins ----------
   * Pointer events where the browser has them (they cover touch AND mouse);
   * raw touch events step in ONLY on browsers without PointerEvent, so the
   * two paths never both fire for one gesture. */
  const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
  const dragBegin = (x: number, y: number) => {
    if (!card || leaving) return;
    dragStart.current = { x, y };
    movedRef.current = false;
  };
  const dragMove = (x: number, y: number) => {
    const start = dragStart.current;
    if (!start || leaving) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (!movedRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragStart.current = null; // a scroll, not a swipe
        return;
      }
      movedRef.current = true;
      setDragging(true);
    }
    setDragX(dx);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragBegin(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragMove(event.clientX, event.clientY);
  };
  const onTouchStart = supportsPointer
    ? undefined
    : (event: ReactTouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (touch) dragBegin(touch.clientX, touch.clientY);
      };
  const onTouchMove = supportsPointer
    ? undefined
    : (event: ReactTouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (touch) dragMove(touch.clientX, touch.clientY);
      };
  const endDrag = () => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || leaving) return;
    if (movedRef.current) {
      setDragging(false);
      if (dragX > MB_COMMIT_PX) commit('right');
      else if (dragX < -MB_COMMIT_PX) commit('left');
      else setDragX(0);
    }
  };
  const onPointerCancel = () => {
    dragStart.current = null;
    setDragging(false);
    setDragX(0);
  };
  const onTouchEnd = supportsPointer ? undefined : () => endDrag();
  const onTouchCancel = supportsPointer ? undefined : () => onPointerCancel();

  /* Explain — plain prose onto the card; the student still grades it. */
  const explain = async (row: FlaggedRow) => {
    if (explainId === row.id) {
      setExplainId(null);
      return;
    }
    /* An explanation saved on a previous visit shows instantly — free. */
    const stored = String(row.ai_explanation ?? '').trim();
    if (stored) {
      setExplainId(row.id);
      setExplainText(stored);
      setExplainLoading(false);
      return;
    }
    if (!canAskAi) {
      onExplainBlocked();
      return;
    }
    setExplainId(row.id);
    setExplainText('');
    setExplainLoading(true);
    try {
      const options = flaggedOptions(row);
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: AI_MODELS.standard,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content:
                'You explain exam questions to Indian competitive-exam aspirants. Reply in PLAIN PROSE only — no ' +
                'markdown, no headings, no bullet characters, no bold. Under 110 words: state the correct answer, ' +
                'the one principle it turns on, and the trap that catches most students.',
            },
            {
              role: 'user',
              content:
                `Concept: ${flaggedConceptLabel(row)}. Subject: ${row.subject || 'this exam'}.` +
                `\nQuestion: ${row.question_text.slice(0, 900)}` +
                (options ? `\nOptions: ${options.join(' | ')}` : ''),
            },
          ],
          max_completion_tokens: 420,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const text = String(payload.choices?.[0]?.message?.content || '').trim();
      onAiCharged();
      setExplainText(text || "Nothing came back this time — check your own notes for this one.");
      /* PERSIST the explanation onto the row — it survives the session and
       * the next Explain tap costs nothing. Best-effort by design. */
      if (text) onPersistExplanation?.(row, text);
    } catch {
      setExplainText("That explanation didn't come through — mind tapping Explain once more?");
    } finally {
      setExplainLoading(false);
    }
  };

  const cardOptions = card ? flaggedOptions(card) : null;
  const cardOwnAnswer = card ? String(card.solution_text ?? '').trim() : '';
  const cardAiDraft = card ? String(card.ai_draft_answer ?? '').trim() : '';
  const cardAnswer = cardOwnAnswer || cardAiDraft;
  const cardHasSolution = cardAnswer !== '';
  const cardHasText = card ? (card.question_text ?? '').trim() !== '' : false;
  /* The stored correct letter for MCQ cards — revealed only on self-check,
   * so the card can show the RIGHT answer alongside the student's own. */
  const cardCorrectLetter: McqLetter | null = (() => {
    if (!card || !cardOptions) return null;
    const letter = String(card.correct ?? '').trim().toUpperCase().charAt(0);
    return (MCQ_LETTERS as string[]).includes(letter) ? (letter as McqLetter) : null;
  })();
  /* The concept this card tests — shown as a chip when it adds information
   * beyond the subject itself. */
  const cardConcept = card ? flaggedConceptLabel(card) : '';
  const showCardConcept = Boolean(card && cardConcept && cardConcept !== (card.subject || 'General'));
  /* What the small bottom-right toggle can reveal: a photo card's transcript,
   * the MCQ options, or the student's own saved answer. */
  const hasDetail = card ? Boolean((card.image_url && cardHasText) || cardOptions || cardHasSolution) : false;
  const leaveDir = card && leaving && leaving.id === card.id ? leaving.dir : null;
  const cardMotionStyle: CSSProperties = leaveDir
    ? {
        transform: `translateX(${leaveDir === 'right' ? '115%' : '-115%'}) rotate(${leaveDir === 'right' ? 10 : -10}deg)`,
        opacity: 0,
        transition: `transform ${MB_LEAVE_MS}ms ease-in-out, opacity ${MB_LEAVE_MS}ms ease-in-out`,
      }
    : {
        transform: dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX / 18}deg)` : undefined,
        transition: dragging ? 'none' : 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      };

  return (
    <div>
      <style>{MB_DECK_CSS}</style>

      {mode === 'grid' ? (
        /* STATE A — the grid: a casual spread of card thumbnails. */
        <div className="vk-mb-grid" data-testid="mistake-grid">
          {rows.map((row, index) => (
            <MistakeTile
              key={row.id}
              row={row}
              index={index}
              subjects={subjects}
              retagOpen={retagOpenId === row.id}
              onToggleRetag={onToggleRetag}
              onRetag={onRetag}
              onRemove={onRemove}
              onOpen={openDeck}
              onUpdateDraft={onUpdateDraft}
            />
          ))}
        </div>
      ) : (
        /* STATE B — the deck: one card at centre-front, the rest fanned
           behind it, the grid one tap (top-left) away. */
        <div className="vicharak-fade" data-testid="mistake-deck">
          <div className="flex items-center gap-2 pb-2.5">
            <button
              type="button"
              onClick={closeDeck}
              aria-label="Back to all cards"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
              style={{ background: NAVY_ALT, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY }}
              data-testid="button-mistake-deck-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p
              className="flex-1 text-center text-[12px] font-extrabold tabular-nums"
              style={{ color: TEXT_SECONDARY }}
              data-testid="text-mistake-deck-progress"
            >
              {Math.min(reviewed + 1, Math.max(total, 1))} / {Math.max(total, 1)}
            </p>
            <span className="w-9 flex-shrink-0" aria-hidden="true" />
          </div>

          {card ? (
            <>
              <div className="vk-mb-stage" style={{ paddingBottom: queue.length > 2 ? 24 : queue.length > 1 ? 14 : 4 }}>
                {queue.length > 2 && (
                  <span
                    className="vk-mb-sheet"
                    style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, transform: 'translateY(20px) rotate(2deg) scale(0.93)', opacity: 0.55, zIndex: 0 }}
                    aria-hidden="true"
                  />
                )}
                {queue.length > 1 && (
                  <span
                    className="vk-mb-sheet"
                    style={{ background: NAVY_ALT, border: `1px solid ${tint(DOUBT_ACCENT, 0.3)}`, transform: 'translateY(10px) rotate(-1.7deg) scale(0.97)', opacity: 0.85, zIndex: 1 }}
                    aria-hidden="true"
                  />
                )}
                <div
                  key={card.id}
                  className="vk-mb-card vk-mb-card-in touch-manipulation"
                  style={{
                    ...cardMotionStyle,
                    background: DOUBT_GRADIENT,
                    border: `1px solid ${tint(DOUBT_ACCENT, 0.45)}`,
                    boxShadow: '0 14px 34px rgba(3, 6, 15, 0.5)',
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={onPointerCancel}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  onTouchCancel={onTouchCancel}
                  data-testid={`mistake-deck-card-${card.id}`}
                >
                  {/* Drag verdicts — they fade in with the pull. */}
                  {dragX > 14 && (
                    <span
                      className="absolute top-3 left-3 z-10 px-2.5 py-1"
                      style={{ borderRadius: RADIUS.chip, background: tint(SUCCESS, 0.14), border: `1px solid ${tint(SUCCESS, 0.45)}`, color: SUCCESS, fontSize: 10, fontWeight: 800, opacity: Math.min(1, dragX / MB_COMMIT_PX) }}
                      aria-hidden="true"
                    >
                      Got it
                    </span>
                  )}
                  {dragX < -14 && (
                    <span
                      className="absolute top-3 right-3 z-10 px-2.5 py-1"
                      style={{ borderRadius: RADIUS.chip, background: tint(DANGER, 0.14), border: `1px solid ${tint(DANGER, 0.45)}`, color: DANGER, fontSize: 10, fontWeight: 800, opacity: Math.min(1, -dragX / MB_COMMIT_PX) }}
                      aria-hidden="true"
                    >
                      Again
                    </span>
                  )}
                  <div className="px-4 pt-3.5 pb-3.5 flex flex-col" style={{ minHeight: card.image_url ? 300 : 220 }}>
                    {/* TOP — one small context line, with the difficulty dot. */}
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[10px] font-bold" style={{ color: TEXT_MUTED }} data-testid="text-mistake-deck-why">
                        {mistakeWhyLine(card)}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: difficultyColor(card.difficulty) }}
                        title={card.difficulty || undefined}
                        aria-hidden="true"
                      />
                    </div>

                    {/* CENTRE — the image IS the card. No question text under
                        it: the transcript waits behind the small toggle below.
                        A text-only entry centres its question here instead. */}
                    {card.image_url ? (
                      <div className="flex-1 flex items-center justify-center mt-3 min-h-0">
                        <img
                          src={card.image_url}
                          alt="Question"
                          draggable={false}
                          className="max-w-full object-contain"
                          style={{ maxHeight: 'min(44vh, 340px)', borderRadius: 12, border: `1px solid ${BORDER}`, pointerEvents: 'none' }}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center mt-3 min-h-0">
                        <p
                          className="w-full text-[15px] leading-relaxed font-semibold whitespace-pre-wrap"
                          style={{ color: TEXT, maxHeight: '38vh', overflowY: 'auto' }}
                          data-testid="text-mistake-deck-question"
                        >
                          {card.question_text}
                        </p>
                      </div>
                    )}

                    {/* ON DEMAND — transcript, options and the self-check
                        answer, one tap away, scrolling inside the card. */}
                    {detailOpen && hasDetail && (
                      <div className="mt-3 vicharak-fade" style={{ maxHeight: '32vh', overflowY: 'auto' }} data-testid="mistake-deck-detail">
                        {card.image_url && cardHasText && (
                          <p
                            className="text-[13px] leading-relaxed font-semibold whitespace-pre-wrap"
                            style={{ color: TEXT }}
                            data-testid="text-mistake-deck-question"
                          >
                            {card.question_text}
                          </p>
                        )}
                        {cardOptions && (
                          <ul className="mt-2.5 space-y-1" data-testid="mistake-deck-options">
                            {cardOptions.map((option, index) => {
                              const isRevealedCorrect = answerRevealed && cardCorrectLetter === MCQ_LETTERS[index];
                              return (
                                <li
                                  key={MCQ_LETTERS[index]}
                                  className="flex gap-2 text-[12px] leading-relaxed"
                                  style={{ color: isRevealedCorrect ? SUCCESS : TEXT_SECONDARY, fontWeight: isRevealedCorrect ? 700 : undefined }}
                                >
                                  <span className="font-extrabold">{MCQ_LETTERS[index]}.</span>
                                  <span className="min-w-0 flex-1">{option}</span>
                                  {isRevealedCorrect && <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {(cardHasSolution || cardCorrectLetter) && (
                          answerRevealed ? (
                            <div
                              className="mt-2.5 px-3 py-2.5 vicharak-fade"
                              style={{ borderRadius: RADIUS.sm, background: NAVY_ALT, border: `1px solid ${BORDER}` }}
                              data-testid="text-mistake-deck-answer"
                            >
                              {cardCorrectLetter && (
                                <>
                                  <p className="text-[10px] font-extrabold" style={{ color: SUCCESS }}>Correct answer</p>
                                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                                    {cardCorrectLetter}. {cardOptions?.[(MCQ_LETTERS as readonly string[]).indexOf(cardCorrectLetter)] ?? ''}
                                  </p>
                                </>
                              )}
                              {cardHasSolution && (
                                <>
                                  <p className={cardCorrectLetter ? 'mt-2.5 text-[10px] font-extrabold' : 'text-[10px] font-extrabold'} style={{ color: SUCCESS }}>
                                    {cardOwnAnswer ? 'Your answer' : 'AI draft'}
                                  </p>
                                  <p className="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: TEXT_SECONDARY }}>
                                    {cardAnswer}
                                  </p>
                                  {!cardOwnAnswer && card?.ai_draft_status === 'ready' && (
                                    <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>Confirm or edit this draft from the card grid.</p>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAnswerRevealed(true);
                              }}
                              className="mt-2.5 w-full py-2.5 text-[12px] font-bold touch-manipulation"
                              style={{ borderRadius: RADIUS.sm, border: `1px dashed ${BORDER_STRONG}`, background: NAVY_ALT, color: TEXT_SECONDARY }}
                              data-testid="button-mistake-deck-reveal"
                            >
                              Solve it in your head, then tap to check the answer
                            </button>
                          )
                        )}
                      </div>
                    )}
                    {explainId === card.id && (
                      <div
                        className="mt-3 px-3 py-2.5 whitespace-pre-wrap vicharak-fade text-[12px] leading-relaxed"
                        style={{ borderRadius: RADIUS.sm, background: NAVY_ALT, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, maxHeight: '30vh', overflowY: 'auto' }}
                        data-testid="text-mistake-deck-explain"
                      >
                        {explainLoading ? (
                          <span className="inline-flex items-center gap-2" style={{ color: TEXT_MUTED }}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            Working through it…
                          </span>
                        ) : (
                          explainText
                        )}
                      </div>
                    )}

                    {/* BOTTOM — compact metadata (category + time on this
                        card) bottom-left; the one detail toggle bottom-right. */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold flex-shrink-0"
                          style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, background: NAVY_ALT, color: subjectColor(card.subject || 'General') }}
                          data-testid="text-mistake-deck-meta"
                        >
                          <SubjectDot subject={card.subject || 'General'} size={5} />
                          {card.subject || 'General'}
                          <span className="tabular-nums" style={{ color: TEXT_MUTED }}>
                            · <CardSecondsClock cardKey={card.id} />
                          </span>
                        </span>
                        {/* The concept this card tests — always on the card,
                            so a mock-test question names exactly what it cost. */}
                        {showCardConcept && (
                          <span
                            className="inline-flex min-w-0 max-w-[180px] px-2.5 py-1 text-[10px] font-bold"
                            style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(AMBER, 0.35)}`, background: tint(AMBER, 0.07), color: AMBER }}
                            data-testid="text-mistake-deck-concept"
                          >
                            <span className="truncate">{cardConcept}</span>
                          </span>
                        )}
                      </span>
                      {hasDetail && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailOpen((v) => !v);
                          }}
                          aria-expanded={detailOpen}
                          className="flex-shrink-0 inline-flex items-center gap-1 px-3 text-[10px] font-extrabold touch-manipulation"
                          style={{ borderRadius: RADIUS.chip, border: `1px dashed ${BORDER_STRONG}`, background: 'transparent', color: TEXT_SECONDARY, minHeight: 32 }}
                          data-testid="button-mistake-deck-detail"
                        >
                          {detailOpen ? 'Hide' : card.image_url && cardHasText ? 'Question' : 'Details'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* The same three responses as pill buttons — swiping is never
                  required. */}
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="How did this one go?">
                <button
                  type="button"
                  disabled={leaving !== null}
                  onClick={() => commit('left')}
                  className="vk-mb-act touch-manipulation"
                  style={{ background: tint(DANGER, 0.12), border: `1px solid ${tint(DANGER, 0.5)}`, color: DANGER }}
                  data-testid="button-mistake-deck-again"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Again
                </button>
                <button
                  type="button"
                  disabled={leaving !== null}
                  onClick={() => commit('right')}
                  className="vk-mb-act touch-manipulation"
                  style={{ background: BRAND_GRADIENT, border: '1px solid transparent', color: ON_AMBER }}
                  data-testid="button-mistake-deck-got"
                >
                  {gradeSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                  Got it
                </button>
                <button
                  type="button"
                  disabled={leaving !== null}
                  onClick={() => void explain(card)}
                  aria-expanded={explainId === card.id}
                  className="vk-mb-act touch-manipulation"
                  style={{ background: tint(AMBER, 0.06), border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER }}
                  data-testid="button-mistake-deck-explain"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Explain
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px]" style={{ color: TEXT_MUTED }}>
                Swipe right for Got it · swipe left for Again
              </p>

              {/* CHANGE 2 — the session timer lives at the BOTTOM of the deck
                  screen: a quiet strip, less dominant but always visible. */}
              <div
                className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-2"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, background: NAVY_ALT, color: TEXT_MUTED, fontSize: 11, fontWeight: 700 }}
                data-testid="mistake-deck-timer"
              >
                <Timer className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular-nums">
                  <DeckSessionClock startedAt={deckStartedAt} />
                </span>
                <span>this session</span>
              </div>
            </>
          ) : (
            <p
              className="text-[12px] leading-relaxed text-center py-6 vicharak-fade"
              style={{ color: TEXT_SECONDARY }}
              data-testid="text-mistake-deck-cleared"
            >
              Deck cleared — every card here is reviewed. Back to the grid…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DoubtsTab({
  rows,
  spaceId,
  subjects,
  catalog,
  examLabel,
  canAskAi,
  onAiCharged,
  saving,
  onSave,
  onSnap,
  onRetag,
  onRemove,
  onUpdateDraft,
  gradeSaving,
  onGrade,
  onExplainBlocked,
  onPersistExplanation,
  onPracticeTest,
}: {
  /** Queued Mistake Book entries, newest first. */
  rows: FlaggedRow[];
  spaceId: string;
  subjects: string[];
  /** The selected exam's own subject -> chapter catalog — the ONLY set the
   * auto-tagger may answer from. */
  catalog: CatalogSubject[];
  examLabel: string;
  canAskAi: boolean;
  onAiCharged: () => void;
  saving: boolean;
  onSave: (draft: FlaggedDraft) => Promise<void>;
  /** CAPTURE-FIRST camera snap: saves instantly, everything else follows. */
  onSnap: (cleanDataUrl: string) => Promise<boolean>;
  /** One-tap tag correction — updates the row and logs the correction. */
  onRetag: (row: FlaggedRow, subject: string) => void;
  onRemove: (row: FlaggedRow) => void;
  /** Confirms or edits the AI draft without changing its existing due date. */
  onUpdateDraft: (row: FlaggedRow, patch: Record<string, unknown>) => void;
  /** True while a deck grade write is in flight. */
  gradeSaving: boolean;
  /** Commits one deck review through the FSRS scheduler (doubts.gradeFlagged).
   * Resolving false means the write failed — the deck restores the card. */
  onGrade: (row: FlaggedRow, grade: 'again' | 'good') => void | Promise<boolean>;
  /** Explain without AI access opens the paywall, like the review popup. */
  onExplainBlocked: () => void;
  /** Saves a fetched AI explanation onto the row (best-effort). */
  onPersistExplanation?: (row: FlaggedRow, text: string) => void;
  /** Opens the timed practice-test setup built from these saved entries. */
  onPracticeTest?: () => void;
}) {
  const [note, setNote] = useState('');
  const [snapBusy, setSnapBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which card's one-tap tag picker is open (row id). */
  const [retagOpenId, setRetagOpenId] = useState<number | null>(null);
  /** Uploaded screenshots being OCR'd locally — newest last. */
  const [shots, setShots] = useState<ScreenshotCard[]>([]);

  /* Stable references (PERF) — the memoized grid tiles compare these by
   * identity, so they must not be re-created on every DoubtsTab render. */
  const gridSubjects = useMemo(
    () => (catalog.length > 0 ? catalog.map((entry) => entry.subject) : subjects),
    [catalog, subjects],
  );
  const toggleRetag = useCallback(
    (id: number) => setRetagOpenId((current) => (current === id ? null : id)),
    [],
  );

  /* Rule-based concept tags from earlier days queue PYQ practice for today
   * (config/sharedConfig.ts, stored locally — zero AI, zero server). */
  const today = useMemo(() => todayISO(), []);
  const [pyqDismissed, setPyqDismissed] = useState<Set<string>>(new Set());
  const pyqDue = useMemo(
    () => duePyqConcepts(spaceId, today).filter((concept) => !pyqDismissed.has(concept)).slice(0, 4),
    [spaceId, today, pyqDismissed, rows.length],
  );

  const busy = snapBusy || savingNote || saving;

  /** CONSTRAINED auto-tag for a piece of text — exam catalog only, with a
   * confidence score. Charges the wallet only when the AI path answered. */
  const tagText = async (text: string) => {
    const tag = await autoTagQuestion(text, catalog, examLabel, canAskAi);
    if (tag.source === 'ai') onAiCharged();
    return tag;
  };

  /* ---------- CAMERA — capture-first, under 3 seconds ---------- */

  const snapPhoto = async (file: File) => {
    if (snapBusy) return;
    setSnapBusy(true);
    setError(null);
    try {
      // EXIF strip on-device, then SAVE — upload/OCR/tagging follow behind.
      const clean = await fileToCleanJpeg(file);
      await onSnap(clean);
    } catch {
      setError("That snap didn't save — mind taking it once more?");
    } finally {
      setSnapBusy(false);
    }
  };

  /* ---------- TYPED note ---------- */

  const saveNote = async () => {
    const text = (note ?? '').trim();
    if (!text || busy) return;
    setSavingNote(true);
    setError(null);
    try {
      const tag = await tagText(text);
      await onSave({
        question: text,
        subject: tag.subject,
        topic: tag.chapter,
        concept: tag.concept,
        difficulty: '',
        options: null,
        correct: null,
        imageUrl: null,
        sourceType: 'manual',
        tagConfidence: tag.confidence,
      });
      setNote('');
    } catch {
      setError("That didn't save — mind tapping it once more?");
    } finally {
      setSavingNote(false);
    }
  };

  /* ---------- Gallery / screenshot path — local OCR, nothing sent to a
     server for text reading (doubtOcr.ts Web Worker) ---------- */

  const patchShot = (key: string, patch: Partial<ScreenshotCard>) =>
    setShots((prev) => prev.map((card) => (card.key === key ? { ...card, ...patch } : card)));

  const removeShot = (key: string) => setShots((prev) => prev.filter((card) => card.key !== key));

  /** Run (or re-run via Retry) the OCR pass for one card: on-device Tesseract
   * first; if it errors, returns nothing, or scores below OCR_MIN_CONFIDENCE,
   * the AI-vision fallback quietly tries next. Manual typing is the last
   * resort — the student never sees the local failure itself. */
  const ocrShot = async (key: string, imageData: string) => {
    patchShot(key, { status: 'reading' });
    let text = '';
    let confidence: number | null = null;
    try {
      const local = await recognizeText(imageData);
      text = tidyOcrText(local.text);
      confidence = local.confidence;
    } catch {
      /* local OCR failed — the AI fallback below gets its turn */
    }
    const localFailed = !(text ?? '').trim() || (confidence !== null && confidence < OCR_MIN_CONFIDENCE);
    if (localFailed) {
      patchShot(key, { status: 'ai' });
      // aiOcrText never throws — '' means the fallback also came up empty.
      const aiText = tidyOcrText(await aiOcrText(imageData));
      if (aiText) {
        text = aiText;
        confidence = null; // AI text carries no Tesseract confidence score
      }
    } else if ((text ?? '').trim()) {
      // Local OCR succeeded — a low-cost model fixes OCR mistakes, keeps the
      // maths notation and MCQ options, drops noise, never invents content.
      patchShot(key, { status: 'cleaning' });
      const cleaned = await cleanOcrQuestionText(text);
      if (cleaned) text = cleaned;
    }
    if ((text ?? '').trim()) {
      const finalText = text;
      const finalConfidence = confidence;
      setShots((prev) =>
        prev.map((card) =>
          card.key === key
            ? { ...card, status: 'ready', confidence: finalConfidence, text: card.edited && (card.text ?? '').trim() ? card.text : finalText }
            : card,
        ),
      );
    } else {
      setShots((prev) => prev.map((card) => (card.key === key ? { ...card, status: 'failed' } : card)));
    }
  };

  /** Background storage upload of the CLEAN jpeg (EXIF already stripped) so
   * the saved doubt keeps its thumbnail. Failure is non-fatal — the doubt
   * can still save as text-only. */
  const uploadShot = async (key: string, imageData: string) => {
    try {
      const hosted = await uploadImage(await dataUrlToJpegFile(imageData, 'doubt-screenshot.jpg'), spaceId);
      patchShot(key, { hostedUrl: hosted });
    } catch {
      /* text-only save still works */
    }
  };

  /** Gallery selection — each file gets its own card immediately; EXIF strip,
   * OCR and the storage upload all run in the background, so the student can
   * keep picking more screenshots while earlier ones process. */
  const addScreenshots = (files: File[]) => {
    for (const file of files) {
      const key = makeShotKey();
      setShots((prev) => [
        ...prev,
        { key, previewUrl: null, hostedUrl: null, status: 'reading', text: '', edited: false, confidence: null, solution: '', saving: false },
      ]);
      void (async () => {
        let clean: string;
        try {
          clean = await fileToCleanJpeg(file);
        } catch {
          patchShot(key, { status: 'failed' });
          return;
        }
        patchShot(key, { previewUrl: clean });
        void uploadShot(key, clean);
        await ocrShot(key, clean);
      })();
    }
  };

  /** Save one screenshot card — the student has confirmed/fixed the text.
   * The subject/chapter come from the CONSTRAINED tagger (exam catalog only,
   * with a confidence score) — NEVER "the first subject in the list" (that
   * default is how an organic chemistry question got filed under Physics).
   * A typed solution rides along and marks the question test-eligible. */
  const saveShot = async (card: ScreenshotCard) => {
    const text = (card.text ?? '').trim();
    if ((!text && !card.hostedUrl) || saving || card.saving) return;
    patchShot(card.key, { saving: true });
    setError(null);
    try {
      const solution = (card.solution ?? '').trim();
      const tag = text
        ? await tagText(text)
        : { subject: 'General', chapter: '', concept: '', confidence: 0, source: 'none' as const };
      await onSave({
        question: text,
        subject: tag.subject,
        topic: tag.chapter,
        concept: tag.concept,
        difficulty: '',
        options: null,
        correct: null,
        imageUrl: card.hostedUrl,
        sourceType: 'photo',
        solutionText: solution || null,
        hasSolution: solution.length > 0,
        tagConfidence: tag.confidence,
      });
      removeShot(card.key);
    } catch {
      setError("That screenshot didn't save. Your text is still here — tap Add to Mistake Book to try again.");
      patchShot(card.key, { saving: false });
    }
  };

  return (
    <div className="flex-1 w-full max-w-[600px] mx-auto px-5 sm:px-8 vicharak-screen-pad">
      <header className="pt-6 vicharak-rise">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold leading-[1.12] tracking-tight" style={{ color: TEXT }} data-testid="text-doubts-title">
            Mistake Book
          </h1>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          Got it wrong, or got stuck? Snap it — revision starts instantly while AI drafts the answer and concept.
        </p>
      </header>

      {/* Capture card — photo first (camera OR gallery), note optional, one Save. */}
      <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" style={{ animationDelay: '40ms' }} testId="card-doubt-capture">
        <p className="text-xs font-extrabold text-center" style={{ color: TEXT_SECONDARY }}>
          Snap the question you got wrong — it saves instantly
        </p>
        <div className="mt-2.5 flex gap-2">
          {/* One-handed capture: the big camera button, reachable by thumb
              with the book flat on a desk. Saves the instant it is taken. */}
          <label
            className="flex-[3] flex flex-col items-center justify-center gap-1.5 px-3 py-5 text-center cursor-pointer touch-manipulation"
            style={{ borderRadius: RADIUS.md, background: BRAND_GRADIENT, color: ON_AMBER, opacity: snapBusy ? 0.7 : 1 }}
          >
            {snapBusy ? <Loader2 className="w-7 h-7 animate-spin" /> : <Camera className="w-7 h-7" />}
            <span className="text-sm font-extrabold">{snapBusy ? 'Saving your snap…' : 'Snap a mistake'}</span>
            <span className="text-[9px] font-bold opacity-85">saves instantly — AI drafts the answer</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={snapBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void snapPhoto(file);
              }}
              data-testid="input-doubt-photo"
            />
          </label>
          <label
            className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-3 py-4 text-center cursor-pointer touch-manipulation"
            style={{ borderColor: BORDER_STRONG, background: NAVY_ALT, color: TEXT_SECONDARY }}
          >
            <ImagePlus className="w-6 h-6" />
            <span className="text-xs font-extrabold">Choose from Gallery</span>
            <span className="text-[9px] font-bold" style={{ color: TEXT_MUTED }}>
              reads text on your device
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={saving}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length > 0) addScreenshots(files);
              }}
              data-testid="input-doubt-photo-gallery"
            />
          </label>
        </div>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Or type the question / what confused you — saves as its own entry"
          className="mt-3 w-full px-3 py-2.5 text-sm resize-none"
          style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
          data-testid="input-doubt-note"
        />

        {error && (
          <p
            className="mt-3 text-[12px] leading-relaxed px-3 py-2.5"
            style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }}
            data-testid="text-doubt-error"
          >
            {error}
          </p>
        )}

        {(note ?? '').trim() !== '' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveNote()}
            className="mt-3 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-save-doubt"
          >
            {savingNote ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <NotebookPen className="w-4 h-4" />
                Add to Mistake Book
              </>
            )}
          </button>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          <Sparkles className="w-3 h-3 flex-shrink-0 mt-px" style={{ color: AMBER }} />
          Tags come from your own exam's chapter list — tap any card's subject chip to fix a tag in one tap.
        </p>
      </Card>

      {/* Next-day PYQ practice — concepts tagged on earlier days come due
          here the following day (rule-based tags, stored on this device). */}
      {pyqDue.length > 0 && (
        <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" style={{ animationDelay: '55ms' }} testId="card-pyq-due">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: AMBER }}>
            <Target className="w-3 h-3" />
            PYQ practice due today
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            You tagged these concepts recently — attempt a previous-year question on each. Open the matching entry below,
            or tick a concept off once you've practised it.
          </p>
          <ul className="mt-2 space-y-1.5">
            {pyqDue.map((concept) => (
              <li
                key={concept}
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                data-testid={`pyq-due-${concept.slice(0, 24)}`}
              >
                <span className="min-w-0 flex-1 text-[12px] font-bold truncate" style={{ color: TEXT_SECONDARY }}>
                  {concept}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearPyqConcept(spaceId, concept);
                    setPyqDismissed((prev) => new Set(prev).add(concept));
                  }}
                  className="flex-shrink-0 px-2.5 py-1 text-[10px] font-extrabold touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                  data-testid={`pyq-done-${concept.slice(0, 24)}`}
                >
                  Practised ✓
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Uploaded screenshots — one card each, OCR'd locally in a Web Worker. */}
      {shots.map((card) => (
        <Card key={card.key} radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId={`card-doubt-shot-${card.key}`}>
          <div className="flex items-start gap-3">
            {card.previewUrl ? (
              <img
                src={card.previewUrl}
                alt="Uploaded question screenshot"
                className="w-16 h-16 object-cover flex-shrink-0"
                style={{ borderRadius: RADIUS.sm, border: `1px solid ${BORDER}` }}
              />
            ) : (
              <span
                className="w-16 h-16 flex items-center justify-center flex-shrink-0"
                style={{ borderRadius: RADIUS.sm, background: NAVY_ALT, border: `1px solid ${BORDER}` }}
              >
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: TEXT_MUTED }} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {(card.status === 'reading' || card.status === 'ai' || card.status === 'cleaning') && (
                <p className="inline-flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: TEXT_SECONDARY }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {card.status === 'reading' ? 'Reading question…' : card.status === 'ai' ? 'Reading question with AI…' : 'Tidying up the question…'}
                </p>
              )}
              {card.status === 'ready' && (
                <p className="text-[12px] font-extrabold" style={{ color: TEXT_SECONDARY }}>
                  {card.confidence !== null && card.confidence < 60
                    ? 'Text read — it looks blurry, so give it a quick proofread below.'
                    : 'Text read — check it below, then save.'}
                </p>
              )}
              {card.status === 'failed' && (
                <p className="text-[12px] font-extrabold" style={{ color: DANGER }}>
                  Couldn't read the text — type it below{card.previewUrl ? ' or retry' : ''}.
                </p>
              )}
              <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                Read on your device first — AI steps in only if the local read struggles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeShot(card.key)}
              aria-label="Discard this screenshot"
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
              style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }}
              data-testid="button-doubt-shot-discard"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <textarea
            value={card.text}
            onChange={(event) => patchShot(card.key, { text: event.target.value, edited: true })}
            rows={3}
            placeholder={
              card.status === 'reading' || card.status === 'ai' || card.status === 'cleaning'
                ? 'Extracted text will appear here — you can start typing too'
                : 'Type or fix the question text'
            }
            className="mt-3 w-full px-3 py-2.5 text-sm resize-none"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
            data-testid="input-doubt-shot-text"
          />

          {/* Google Lens — opens the uploaded image in Lens in a new tab; no
              inline results, just the hand-off. Needs the hosted URL. */}
          {card.hostedUrl && (
            <a
              href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(card.hostedUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT }}
              data-testid="button-doubt-shot-lens"
            >
              <Search className="w-3.5 h-3.5" />
              Search with Google Lens
            </a>
          )}

          {/* Optional student solution — AI drafts one after save. */}
          <textarea
            value={card.solution}
            onChange={(event) => patchShot(card.key, { solution: event.target.value })}
            rows={2}
            placeholder="Your own solution (optional) — AI will draft one after save"
            className="mt-2 w-full px-3 py-2.5 text-sm resize-none"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
            data-testid="input-doubt-shot-solution"
          />
          {!(card.solution ?? '').trim() && (
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-doubt-shot-solution-hint">
              Leave this blank if you want — it enters revision now, and AI drafts an answer for you to confirm or edit.
            </p>
          )}

          <div className="mt-2.5 flex gap-2">
            {card.status === 'failed' && card.previewUrl && (
              <button
                type="button"
                onClick={() => void ocrShot(card.key, card.previewUrl as string)}
                className="px-4 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-1.5 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT }}
                data-testid="button-doubt-shot-retry"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}
            <button
              type="button"
              disabled={(!(card.text ?? '').trim() && !card.hostedUrl) || saving || card.saving}
              onClick={() => void saveShot(card)}
              className="flex-1 py-3 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-doubt-shot-save"
            >
              {card.saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <NotebookPen className="w-4 h-4" />
                  Add to Mistake Book
                </>
              )}
            </button>
          </div>
        </Card>
      ))}

      {/* The Mistake Book itself — a 2-column GRID of card thumbnails by
          default; tapping any tile springs the spread into a swipeable DECK
          with the tapped card at centre-front (Change 1). */}
      <section className="mt-5 vicharak-rise" style={{ animationDelay: '70ms' }} data-testid="section-doubt-list">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] mb-2.5" style={{ color: TEXT_MUTED }}>
          Your Mistake Book
        </h2>
        {/* [Feature 4] Timed practice test from the saved doubts. With AI
            generation off, only MCQ-shaped doubts (options + known answer)
            can run — the button appears once at least one exists. */}
        {onPracticeTest && (() => {
          const testable = ENABLE_AUTO_QUESTION_GEN
            ? rows
            : rows.filter((row) => {
                const letter = String(row.correct ?? '').trim().toUpperCase().charAt(0);
                return !!flaggedOptions(row) && (MCQ_LETTERS as string[]).includes(letter);
              });
          if (testable.length === 0) return null;
          return (
            <button
              type="button"
              onClick={onPracticeTest}
              className="mb-3 w-full py-3 text-[13px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation transition-transform active:scale-[0.98]"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 6px 16px rgba(0,87,255,0.22)' }}
              data-testid="button-practice-doubts"
            >
              <Trophy className="w-4 h-4" />
              Practice saved questions
            </button>
          );
        })()}
        {rows.length === 0 ? (
          <div
            className="px-5 py-8 text-center"
            style={{ borderRadius: RADIUS.md, border: `1px dashed ${BORDER_STRONG}`, background: NAVY_ALT }}
            data-testid="mistake-book-empty"
          >
            <span
              className="mx-auto w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: tint(AMBER, 0.1), color: AMBER }}
            >
              <NotebookPen className="w-5 h-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[13px] font-extrabold" style={{ color: TEXT }}>
              No mistakes yet — that's a clean slate, not an empty page.
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              The next time a question stumps you, snap it above. It saves and enters spaced revision instantly while
              AI drafts the correct answer and underlying concept for you to confirm.
            </p>
          </div>
        ) : (
          <MistakeGridDeck
            rows={rows}
            subjects={gridSubjects}
            canAskAi={canAskAi}
            gradeSaving={gradeSaving}
            onGrade={onGrade}
            onExplainBlocked={onExplainBlocked}
            onAiCharged={onAiCharged}
            onPersistExplanation={onPersistExplanation}
            onRetag={onRetag}
            onRemove={onRemove}
            onUpdateDraft={onUpdateDraft}
            retagOpenId={retagOpenId}
            onToggleRetag={toggleRetag}
          />
        )}
      </section>
    </div>
  );
}
