/**
 * Image attachments for tasks and question cards.
 *
 * Upload path mirrors the existing question-flagging photo flow: the file is
 * read as a data URL and posted to the platform's `/api/upload/image`
 * endpoint, which returns a hosted URL. If the upload endpoint is unavailable
 * and the image is small (<500KB), the data URL itself is stored — both render
 * identically in an <img>. Attachment rows live in zuno_attachments keyed by
 * parent_type ('task' | 'question') + parent_key.
 */

import { ImagePlus, Loader2, X } from 'lucide-react';
import { BORDER, BORDER_STRONG, OVERLAY_BG, RADIUS, TEXT_MUTED, TEXT_SECONDARY, tint } from './theme';

/** Below this size a failed upload falls back to storing the data URL itself. */
const BASE64_FALLBACK_LIMIT = 500 * 1024;

/** Read a File into a data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image and return a durable URL. Falls back to the raw data URL
 * for small files when the upload endpoint rejects, so attaching never dies
 * silently on flaky networks.
 */
export async function uploadImage(file: File, spaceId: string): Promise<string> {
  const imageData = await readFileAsDataUrl(file);
  try {
    const response = await fetch('/api/upload/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': ((window as unknown as { __APP_ID__?: string }).__APP_ID__) || spaceId,
      },
      body: JSON.stringify({ imageData, fileName: file.name }),
    });
    const uploaded = (await response.json()) as { imageUrl?: string };
    if (response.ok && uploaded.imageUrl) return uploaded.imageUrl;
    throw new Error('Upload failed');
  } catch (error) {
    if (imageData.length <= BASE64_FALLBACK_LIMIT) return imageData;
    throw error instanceof Error ? error : new Error('Upload failed');
  }
}

/* ------------------------------------------------------------------ */
/*  UI pieces                                                          */
/* ------------------------------------------------------------------ */

/** “Attach image” — a quiet labelled button wrapping a hidden file input. */
export function AttachImageButton({
  busy,
  onPick,
  label = 'Attach image',
  testId,
}: {
  busy: boolean;
  onPick: (file: File) => void;
  label?: string;
  testId?: string;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold cursor-pointer touch-manipulation"
      style={{
        borderRadius: RADIUS.chip,
        border: `1px dashed ${BORDER_STRONG}`,
        color: TEXT_SECONDARY,
        opacity: busy ? 0.6 : 1,
      }}
      data-testid={testId}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
      {busy ? 'Attaching…' : label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

/** Thumbnails on a card — tap one to expand it full-screen. */
export function ImageThumbStrip({
  urls,
  onExpand,
  onRemove,
  size = 52,
}: {
  urls: string[];
  onExpand: (url: string) => void;
  onRemove?: (url: string) => void;
  size?: number;
}) {
  if (urls.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {urls.map((url, index) => (
        <span key={`${url.slice(0, 48)}-${index}`} className="relative inline-block">
          <button
            type="button"
            onClick={() => onExpand(url)}
            aria-label="Expand attached image"
            className="block overflow-hidden touch-manipulation"
            style={{ width: size, height: size, borderRadius: RADIUS.sm, border: `1px solid ${BORDER}` }}
          >
            <img src={url} alt="Attachment" className="w-full h-full object-cover" loading="lazy" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label="Remove attached image"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center touch-manipulation"
              style={{ background: tint(TEXT_MUTED, 0.9), color: '#FFFFFF' }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** Full-screen viewer for one attached image. */
export function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 vicharak-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Attached image"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: OVERLAY_BG }} />
      <img
        src={url}
        alt="Attachment, expanded"
        className="relative max-w-full max-h-full object-contain vicharak-pop"
        style={{ borderRadius: RADIUS.md }}
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center touch-manipulation"
        style={{ background: 'rgba(0,0,0,0.55)', color: '#FFFFFF' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

