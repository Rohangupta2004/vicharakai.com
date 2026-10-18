/**
 * Add Task — the floating '+' button's bottom sheet (CHANGE 1 + 8).
 *
 * One clear path to a manual task: a name, a subject chip, an optional photo
 * (camera capture or gallery pick), and Save / Cancel. The photo is kept as a
 * compact JPEG data URI so it persists locally alongside the task and renders
 * as a thumbnail on the Today checklist — no server upload required.
 */
import { useState } from 'react';
import { Camera, ImagePlus, Loader2, Plus, X } from 'lucide-react';
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
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import { SubjectDot } from './ui';
import { readFileAsDataUrl } from './Attachments';

export interface AddTaskDraft {
  /** One task per line typed in the sheet — each becomes its own task. */
  titles: string[];
  subject: string;
  /** Compact data URI of the attached photo, or null when none was added. */
  imageDataUrl: string | null;
}

/** Longest edge the stored image keeps — keeps the data URI small. */
const MAX_IMAGE_EDGE = 1000;
/** A data URI already under this size is stored as-is, without re-encoding. */
const KEEP_RAW_LIMIT = 400 * 1024;

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

export default function AddTaskSheet({
  subjects,
  saving,
  onSave,
  onClose,
  onScanPhoto,
}: {
  subjects: string[];
  saving: boolean;
  onSave: (draft: AddTaskDraft) => void;
  onClose: () => void;
  /** Opens the photo→tasks scanner instead (optional entry point). */
  onScanPhoto?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [readingImage, setReadingImage] = useState(false);

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
    .map((line) => line.trim())
    .filter(Boolean);
  const canSave = titleLines.length > 0 && !saving && !readingImage;
  const chipNames = Array.from(new Set([...subjects, 'General'])).filter(Boolean);

  const imagePickerStyle = {
    borderRadius: RADIUS.chip,
    border: `1px dashed ${BORDER_STRONG}`,
    color: TEXT_SECONDARY,
    opacity: readingImage ? 0.6 : 1,
  } as const;

  return (
    <div className="fixed inset-0 z-[66] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add a task">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Cancel adding a task" />
      <div
        className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND_GRADIENT, color: ON_AMBER }}>
            <Plus className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Add a task</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>Name it, pick a subject, attach a photo if it helps.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
            data-testid="button-add-task-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block mt-4 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
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

        {/* Photo → tasks: hand the whole list over to the scanner instead. */}
        {onScanPhoto && (
          <button
            type="button"
            onClick={onScanPhoto}
            title="Add tasks from photo"
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-extrabold touch-manipulation"
            style={{ borderRadius: RADIUS.md, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
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

        {/* CHANGE 8: attach a photo — camera when the device supports it, or gallery. */}
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
              className="max-h-36 mx-auto object-contain"
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

        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave({ titles: titleLines, subject, imageDataUrl })}
          className="mt-5 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-add-task-save"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
          ) : (
            <><Plus className="w-4 h-4" />{titleLines.length > 1 ? `Add All · ${titleLines.length} tasks` : 'Add task'}</>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 w-full py-2.5 text-[12px] font-bold touch-manipulation"
          style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: 'transparent' }}
          data-testid="button-add-task-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
