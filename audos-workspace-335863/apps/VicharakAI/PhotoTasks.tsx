/**
 * Add from photo — snap a study plan, task list, whiteboard, screenshot or
 * textbook page, and VicharakAI extracts it into a reviewable checklist of
 * ready-to-add tasks.
 *
 * Vision runs through PLATFORM endpoints only — no workspace secret needed:
 *  1. the platform OpenAI proxy (`/proxy/openai/v1/chat/completions`), the
 *     same route every other AI feature in this app uses, with the photo
 *     inlined as a compact JPEG data URL;
 *  2. if that route can't take the image, the platform's document-analysis
 *     endpoint (`POST /api/analyze-document`) — the exact route the Doubts
 *     tab already uses to read question photos — after uploading the photo
 *     for a hosted URL.
 * The durable copy stored next to each task is uploaded when the student
 * confirms.
 */

import { useState, type ChangeEvent } from 'react';
import { Camera, Check, ImagePlus, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
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
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';
import { extractJsonArray } from './mcq';
import { extractJsonObject } from './customExam';
import { readFileAsDataUrl, uploadImage } from './Attachments';
import { fileToCleanJpeg, recognizeText, tidyOcrText } from './doubtOcr';
import { OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';

export interface PhotoTaskDraft {
  title: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** AI-estimated study time for this task, in minutes. */
  minutes: number;
  keep: boolean;
}

/** Photos above this size are compressed client-side before the vision call. */
const COMPRESS_THRESHOLD_BYTES = 4 * 1024 * 1024;
/** Longest edge the image keeps when sent to the model — enough for
 * handwriting OCR while keeping the base64 payload small. */
const MAX_IMAGE_EDGE = 1400;

/** The platform proxy's supported vision-capable model. The legacy 'gpt-4o'
 * this call used before routinely replied {"tasks": []} for perfectly
 * readable photos — the current-generation model reads them reliably. */
const VISION_MODEL = 'gpt-5.6-terra';

const ERROR_READ_FAILED = "Couldn't process the photo — check your connection and tap retry, or type the tasks yourself below.";
const ERROR_NO_TASKS = "I couldn't find readable tasks in that photo. Bright light and clear text help — or type the tasks yourself below.";

/** Deliberately lenient: even a partially blurry photo should yield whatever
 * items ARE readable — an error is only allowed when NOTHING can be read. */
const EXTRACTION_PROMPT = [
  'This is a photo of a study plan, to-do list, whiteboard, screenshot, handwritten notes, a textbook page or an exam question.',
  'Extract ANY text that looks like a study topic, chapter name, subject, or task. Even if the image is partially',
  'blurry, extract what you can. Do NOT return an error if you can read at least 1 item.',
  'If the photo shows an exam question (or several), turn EACH into a practice task naming its concept,',
  'e.g. "Practice: block on a frictionless incline — speed from energy conservation".',
  'Infer which school subject each item belongs to, estimate its difficulty from the content (easy / medium / hard)',
  'and how many minutes it needs (15–120).',
  'Return ONLY strict JSON — no prose, no fences — shaped exactly:',
  '{"tasks": [{"title": "specific study task, e.g. Revise Kirchhoff\'s loop rule with 5 solved examples", "subject": "e.g. Physics", "difficulty": "easy"|"medium"|"hard", "minutes": number}], "unclear": true|false}',
  'Set "unclear" to true when parts of the image could not be read confidently.',
  'Only when NOTHING at all is readable, return {"tasks": [], "unclear": true}.',
].join('\n');

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

function normalizeDifficulty(value: unknown): PhotoTaskDraft['difficulty'] {
  const d = typeof value === 'string' ? (value ?? '').trim().toLowerCase() : '';
  return d === 'easy' || d === 'hard' ? d : 'medium';
}

function normalizeMinutes(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 5 ? Math.min(240, n) : 45;
}

/** Fallback for replies that came back as prose or bullet lines, not JSON. */
function parseLooseTitles(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((line) => (line.replace(/^[\s\d.)\-*•"']+/, '').replace(/["',]+$/, '') ?? '').trim())
    .filter((line) => line.length >= 3 && line.length <= 140)
    .slice(0, 10);
}

/** Read a photo and downscale it into a compact JPEG data URL for the model. */
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
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return raw;
  }
}

/** Distinguishes "the model saw the photo but found nothing" from a hard failure. */
class NoTasksFoundError extends Error {
  constructor() {
    super('No tasks found');
    this.name = 'NoTasksFoundError';
  }
}

/**
 * Read the photo with the platform's vision model. Two independent platform
 * routes are tried in order, so one unavailable backend never kills the feature — and
 * neither route needs a workspace secret:
 *  1. the platform OpenAI proxy (the route every other AI call here uses),
 *     with the compact data URL inlined;
 *  2. the platform document-analysis endpoint (the Doubts tab's proven photo
 *     reader), after uploading the photo for a hosted URL.
 * Returns the raw model reply text; throws only when BOTH routes fail.
 */
async function callVision(dataUrl: string, file: File | null, spaceId: string): Promise<string> {
  // Route 1: the platform OpenAI proxy — same as every other AI trip here.
  try {
    const response = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: await aiProxyHeaders(),
      body: JSON.stringify({
        model: VISION_MODEL,
        reasoning_effort: 'none',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_completion_tokens: 800,
        stream: false,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const raw = String(data.choices?.[0]?.message?.content || '');
      if ((raw ?? '').trim()) return raw;
    }
  } catch {
    /* fall through to the document-analysis route */
  }

  // Route 2: hosted URL + /api/analyze-document (the Doubts tab's route).
  let documentUrl = dataUrl;
  if (file) {
    try {
      documentUrl = await uploadImage(file, spaceId);
    } catch {
      /* keep the data URL — small images still analyze fine */
    }
  }
  const response = await fetch('/api/analyze-document', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': ((window as unknown as { __APP_ID__?: string }).__APP_ID__) || spaceId,
    },
    body: JSON.stringify({ documentUrl, documentType: 'image', analysisPrompt: EXTRACTION_PROMPT }),
  });
  if (!response.ok) throw new Error(`Vision call failed (${response.status})`);
  const data = (await response.json()) as { analysis?: unknown };
  const raw = String(data.analysis || '');
  if (!(raw ?? '').trim()) throw new Error('Empty analysis reply');
  return raw;
}

/** Shape the model reply into editable drafts. Throws NoTasksFoundError when
 * the model (correctly) reported an empty list. `partial` is true when only
 * some of the image's text was readable. */
function parseDrafts(
  raw: string,
  subjects: string[],
  inferSubject: (title: string) => string,
): { drafts: PhotoTaskDraft[]; partial: boolean } {
  const mapItem = (item: unknown): PhotoTaskDraft | null => {
    if (typeof item === 'string') {
      const title = (item ?? '').trim();
      return title
        ? { title, subject: inferSubject(title) || subjects[0] || 'General', difficulty: 'medium' as const, minutes: 45, keep: true }
        : null;
    }
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    const title = typeof record.title === 'string' ? (record.title ?? '').trim() : '';
    if (!title) return null;
    const aiSubject = typeof record.subject === 'string' ? (record.subject ?? '').trim() : '';
    const matched = subjects.find((name) => name.toLowerCase() === aiSubject.toLowerCase()) || aiSubject;
    return {
      title,
      subject: matched || inferSubject(title) || subjects[0] || 'General',
      difficulty: normalizeDifficulty(record.difficulty),
      minutes: normalizeMinutes(record.minutes),
      keep: true,
    };
  };

  let drafts: PhotoTaskDraft[] = [];
  let partial = false;
  const parsedObject = extractJsonObject(raw) as { tasks?: unknown; unclear?: unknown } | null;
  if (parsedObject && typeof parsedObject === 'object' && Array.isArray((parsedObject as { tasks?: unknown }).tasks)) {
    drafts = ((parsedObject as { tasks: unknown[] }).tasks).map(mapItem).filter((d): d is PhotoTaskDraft => d !== null);
    partial = (parsedObject as { unclear?: unknown }).unclear === true;
  } else {
    try {
      drafts = extractJsonArray(raw).map(mapItem).filter((d): d is PhotoTaskDraft => d !== null);
    } catch {
      drafts = parseLooseTitles(raw).map((title) => ({
        title,
        subject: inferSubject(title) || subjects[0] || 'General',
        difficulty: 'medium' as const,
        minutes: 45,
        keep: true,
      }));
      partial = drafts.length > 0;
    }
  }
  drafts = drafts.slice(0, 10);
  if (drafts.length === 0) throw new NoTasksFoundError();
  return { drafts, partial };
}

export function PhotoTasksSheet({
  subjects,
  inferSubject,
  spaceId,
  canAskAi,
  onAiBlocked,
  onAiCharged,
  adding,
  onAdd,
  onClose,
}: {
  subjects: string[];
  /** Best-guess subject for an extracted title (syllabus inference). */
  inferSubject: (title: string) => string;
  spaceId: string;
  canAskAi: boolean;
  onAiBlocked: () => void;
  onAiCharged: () => void;
  adding: boolean;
  /** Parent creates the tasks and stores the image reference next to them. */
  onAdd: (
    tasks: Array<{ title: string; subject: string; difficulty: string; minutes: number }>,
    imageUrl: string,
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<PhotoTaskDraft[]>([]);
  const [reading, setReading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialNote, setPartialNote] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** True when the checklist was opened by hand after a failed scan. */
  const [manualEntry, setManualEntry] = useState(false);

  /* The paywall path is gone from this sheet — photos without AI access are
   * read on-device instead (localOcrDrafts below), so the prop stays only
   * for interface compatibility with the caller. */
  void onAiBlocked;

  /**
   * [Feature 1] On-device extraction — Tesseract.js inside the existing OCR
   * Web Worker (doubtOcr.ts), so the UI never blocks and ZERO AI calls are
   * made: EXIF-strip → recognise → each readable line becomes an editable
   * task row. Used whenever AI is unavailable, and as the automatic
   * fallback when the vision route fails.
   */
  const localOcrDrafts = async (file: File): Promise<PhotoTaskDraft[]> => {
    const clean = await fileToCleanJpeg(file);
    setImageDataUrl(clean);
    const { text } = await recognizeText(clean);
    return parseLooseTitles(tidyOcrText(text)).map((title) => ({
      title,
      subject: inferSubject(title) || subjects[0] || 'General',
      difficulty: 'medium' as const,
      minutes: 45,
      keep: true,
    }));
  };

  const analyze = async (file: File) => {
    setReading(true);
    // Oversized photos are no longer refused — they are compressed instead.
    setCompressing(file.size > COMPRESS_THRESHOLD_BYTES);
    setError(null);
    setPartialNote(null);
    setDrafts([]);
    setLastFile(file);
    setManualEntry(false);
    try {
      if (!canAskAi) {
        // No AI access — the photo is still read, entirely on this device.
        const drafts = await localOcrDrafts(file);
        setCompressing(false);
        if (drafts.length === 0) throw new NoTasksFoundError();
        setDrafts(drafts);
        setPartialNote('Read on your device — no AI used. Check each line below, then add.');
        return;
      }
      const dataUrl = await fileToCompactDataUrl(file);
      setCompressing(false);
      setImageDataUrl(dataUrl);
      const raw = await callVision(dataUrl, file, spaceId);
      const parsed = parseDrafts(raw, subjects, inferSubject);
      setDrafts(parsed.drafts);
      setPartialNote(
        parsed.partial
          ? `Extracted ${parsed.drafts.length} task${parsed.drafts.length === 1 ? '' : 's'} — some text was unclear`
          : null,
      );
      onAiCharged();
    } catch (err) {
      // Vision failed — before surfacing an error, try the on-device OCR
      // worker. Printed lists and screenshots usually still come through.
      if (canAskAi && !(err instanceof NoTasksFoundError)) {
        try {
          const drafts = await localOcrDrafts(file);
          if (drafts.length > 0) {
            setDrafts(drafts);
            setPartialNote('The AI reader was unavailable, so this was read on your device — give each line a quick check.');
            return;
          }
        } catch {
          /* fall through to the shared error state below */
        }
      }
      setError(err instanceof NoTasksFoundError ? ERROR_NO_TASKS : ERROR_READ_FAILED);
    } finally {
      setReading(false);
      setCompressing(false);
    }
  };

  const selected = drafts.filter((d) => d.keep && (d.title ?? '').trim());
  const busy = adding || submitting;

  /** Manual fallback when the scan fails or finds nothing: clear the error
   * and open the same editable checklist with one empty row to type into. */
  const startManualEntry = () => {
    setError(null);
    setPartialNote(null);
    setManualEntry(true);
    setDrafts([{ title: '', subject: subjects[0] || 'General', difficulty: 'medium', minutes: 45, keep: true }]);
  };

  /** Upload the photo for a durable attachment URL (compact data URL as a
   * fallback so confirming never dies on a flaky upload), then hand over.
   * Manually typed tasks save without a photo — the image is optional. */
  const confirmAdd = async () => {
    if (busy || selected.length === 0) return;
    setSubmitting(true);
    try {
      let url = imageDataUrl || '';
      if (lastFile) {
        try {
          url = await uploadImage(lastFile, spaceId);
        } catch {
          /* keep the compact data URL — it renders identically in <img> */
        }
      }
      await onAdd(
        selected.map(({ title, subject, difficulty, minutes }) => ({
          title: (title ?? '').trim(),
          subject,
          difficulty,
          minutes,
        })),
        url,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      setImageDataUrl(null);
      void analyze(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add tasks from a photo">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close photo tasks" />
      <div className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet" style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}>
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Camera className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Add tasks from photo</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>A study plan, notes or a whiteboard → I turn it into tasks.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* [Fix 2] Scan UI — a large camera hero plus two unmistakable
            actions: 'Take Photo' (opens the camera) and 'Choose from
            Gallery'. The selected photo previews below before anything is
            added, so the student always sees what was scanned. */}
        {!imageDataUrl && drafts.length === 0 && !reading && (
          <div className="mt-4 flex flex-col items-center" data-testid="photo-tasks-hero">
            <span
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: tint(AMBER, 0.12), border: `1.5px dashed ${tint(AMBER, 0.45)}`, color: AMBER }}
              aria-hidden="true"
            >
              <Camera className="w-9 h-9" strokeWidth={1.8} />
            </span>
            <p className="mt-2 text-[11px] font-bold text-center" style={{ color: TEXT_MUTED }}>
              Point at a study plan, notes or a whiteboard
            </p>
          </div>
        )}
        <div className="mt-4 space-y-2">
          <label
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold cursor-pointer touch-manipulation transition-transform active:scale-[0.98]"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, opacity: reading || busy ? 0.6 : 1, boxShadow: '0 6px 16px rgba(0,87,255,0.3)' }}
            title="Take a photo of your tasks"
          >
            {reading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            Take Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={reading || busy}
              onChange={onFilePicked}
              data-testid="input-photo-tasks-camera"
            />
          </label>
          <label
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold cursor-pointer touch-manipulation transition-transform active:scale-[0.98]"
            style={{ borderRadius: RADIUS.chip, border: `1.5px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT, opacity: reading || busy ? 0.6 : 1 }}
            title="Choose a photo from your gallery"
          >
            {reading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            Choose from Gallery
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={reading || busy}
              onChange={onFilePicked}
              data-testid="input-photo-tasks"
            />
          </label>
        </div>
        <p className="mt-1.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>Any size works — large photos are compressed automatically.</p>

        {imageDataUrl && (
          <img src={imageDataUrl} alt="Your study notes" className="mt-3 max-h-36 mx-auto object-contain" style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, opacity: reading ? 0.6 : 1 }} data-testid="img-photo-tasks-preview" />
        )}

        {reading && (
          <div className="mt-3 flex items-center justify-center gap-2 py-2" data-testid="text-photo-reading">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: AMBER }} />
            <span className="text-[12px] font-bold" style={{ color: TEXT_SECONDARY }}>
              {compressing ? 'Compressing your photo…' : 'Reading your tasks…'}
            </span>
          </div>
        )}

        {error && !reading && (
          <div className="mt-4">
            <p className="text-[12px] leading-relaxed px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-photo-error">
              {error}
            </p>
            <div className="mt-2.5 flex gap-2">
              {lastFile && (
                <button type="button" onClick={() => void analyze(lastFile)} className="flex-1 py-2.5 text-[13px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BORDER, color: TEXT }} data-testid="button-photo-retry">
                  <RotateCcw className="w-4 h-4" />
                  Retry the same photo
                </button>
              )}
              <label className="flex-1 py-2.5 text-[13px] font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer touch-manipulation" style={{ borderRadius: RADIUS.chip, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY }} data-testid="button-photo-try-different">
                <ImagePlus className="w-4 h-4" />
                Try a different photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={reading || busy}
                  onChange={onFilePicked}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={startManualEntry}
              className="mt-2 w-full py-2.5 text-[13px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(AMBER, 0.45)}`, color: AMBER, background: tint(AMBER, 0.07) }}
              data-testid="button-photo-manual-entry"
            >
              <Pencil className="w-4 h-4" />
              Type the tasks yourself
            </button>
          </div>
        )}

        {drafts.length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }} data-testid="text-photo-found">
              {imageDataUrl && !manualEntry
                ? `I found ${drafts.length} task${drafts.length === 1 ? '' : 's'} in this photo:`
                : 'Type your tasks:'}
            </p>
            {partialNote && (
              <p className="mt-1.5 text-[11px] leading-relaxed px-3 py-2" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-photo-partial">
                {partialNote}
              </p>
            )}
            <p className="mt-1 text-[11px]" style={{ color: TEXT_MUTED }}>Edit anything, remove what you don't want. Tap the subject, difficulty or minutes to adjust.</p>
            <div className="mt-2 space-y-2">
              {drafts.map((draft, index) => (
                <div key={index} className="flex items-start gap-2.5 p-3" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}`, opacity: draft.keep ? 1 : 0.55 }} data-testid={`photo-task-${index}`}>
                  <button
                    type="button"
                    onClick={() => setDrafts((current) => current.map((d, i) => (i === index ? { ...d, keep: !d.keep } : d)))}
                    aria-pressed={draft.keep}
                    aria-label={`Keep “${draft.title}”`}
                    className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 touch-manipulation"
                    style={{ background: draft.keep ? AMBER : BORDER, color: draft.keep ? '#FFFFFF' : TEXT_MUTED }}
                  >
                    {draft.keep && <Check className="w-3 h-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <input
                      value={draft.title}
                      onChange={(event) => setDrafts((current) => current.map((d, i) => (i === index ? { ...d, title: event.target.value } : d)))}
                      placeholder="Describe the task…"
                      className="w-full bg-transparent text-[13px] font-bold outline-none"
                      style={{ color: TEXT }}
                      aria-label={`Task ${index + 1} title`}
                    />
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <select
                        value={draft.subject}
                        onChange={(event) => setDrafts((current) => current.map((d, i) => (i === index ? { ...d, subject: event.target.value } : d)))}
                        className="px-2 py-1 text-[11px]"
                        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.chip, color: TEXT_SECONDARY }}
                        aria-label={`Task ${index + 1} subject`}
                      >
                        {Array.from(new Set([draft.subject, ...subjects, 'General'])).filter(Boolean).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((current) =>
                            current.map((d, i) => {
                              if (i !== index) return d;
                              const next = DIFFICULTY_LEVELS[(DIFFICULTY_LEVELS.indexOf(d.difficulty) + 1) % DIFFICULTY_LEVELS.length];
                              return { ...d, difficulty: next };
                            }),
                          )
                        }
                        className="px-2 py-1 text-[10px] font-extrabold capitalize touch-manipulation"
                        style={{
                          borderRadius: RADIUS.chip,
                          background: tint(draft.difficulty === 'hard' ? DANGER : draft.difficulty === 'easy' ? SUCCESS : AMBER, 0.14),
                          color: draft.difficulty === 'hard' ? DANGER : draft.difficulty === 'easy' ? SUCCESS : AMBER,
                        }}
                        aria-label={`Task ${index + 1} difficulty — tap to change`}
                        title="AI-estimated difficulty — tap to change"
                        data-testid={`photo-task-difficulty-${index}`}
                      >
                        {draft.difficulty}
                      </button>
                      <label className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: TEXT_MUTED }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={5}
                          max={240}
                          value={draft.minutes}
                          onChange={(event) => setDrafts((current) => current.map((d, i) => (i === index ? { ...d, minutes: Math.max(5, Math.min(240, Math.round(Number(event.target.value)) || 45)) } : d)))}
                          className="w-12 px-1.5 py-1 text-[10px] text-center"
                          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.chip, color: TEXT_SECONDARY }}
                          aria-label={`Task ${index + 1} estimated minutes`}
                        />
                        min
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Delete “${draft.title || `task ${index + 1}`}”`}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                    style={{ background: tint(TEXT_MUTED, 0.1), color: TEXT_MUTED }}
                    data-testid={`photo-task-delete-${index}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setDrafts((current) => [
                  ...current,
                  { title: '', subject: subjects[0] || 'General', difficulty: 'medium', minutes: 45, keep: true },
                ])
              }
              className="mt-2.5 w-full py-2.5 text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
              data-testid="button-photo-add-another"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another
            </button>
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void confirmAdd()}
              className="mt-3 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-add-photo-tasks"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</> : <><Plus className="w-4 h-4" />Add {selected.length} task{selected.length === 1 ? '' : 's'}</>}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2.5 w-full py-2.5 text-[12px] font-bold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: 'transparent' }}
              data-testid="button-photo-tasks-cancel"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
