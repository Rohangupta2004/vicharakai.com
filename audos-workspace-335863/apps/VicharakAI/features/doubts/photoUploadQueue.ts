/**
 * photoUploadQueue — offline-safe photo uploads for Mistake Book snaps.
 *
 * A snap SAVES INSTANTLY as a row; the photo upload is a background job. When
 * the upload fails (offline, flaky network), the clean JPEG data URL is
 * queued here in localStorage and retried when the network returns — a failed
 * upload never loses the photo and never blocks the student.
 *
 * The queue is deliberately small (a few entries): data URLs are heavy, and
 * localStorage quota is shared. The oldest entries are dropped first when the
 * cap is hit — the row itself (text + tags) is already saved either way.
 */

import { uploadImage } from '../../Attachments';
import { dataUrlToJpegFile } from '../../doubtOcr';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';

interface PendingPhoto {
  rowId: number;
  dataUrl: string;
  queuedAt: number;
}

const QUEUE_PREFIX = 'vicharak_photo_queue_';
/** At most this many photos wait in the retry queue (data URLs are heavy). */
const MAX_QUEUED = 4;

function queueKey(spaceId: string): string {
  return `${QUEUE_PREFIX}${spaceId}`;
}

function readQueue(spaceId: string): PendingPhoto[] {
  try {
    const raw = window.localStorage.getItem(queueKey(spaceId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PendingPhoto =>
        !!e && typeof e === 'object' && typeof (e as PendingPhoto).rowId === 'number' && typeof (e as PendingPhoto).dataUrl === 'string',
    );
  } catch {
    return [];
  }
}

function writeQueue(spaceId: string, entries: PendingPhoto[]): void {
  try {
    window.localStorage.setItem(queueKey(spaceId), JSON.stringify(entries.slice(-MAX_QUEUED)));
  } catch {
    /* Quota exceeded — drop the oldest and try once more; then give up
       quietly (the row is saved, only its thumbnail is lost). */
    try {
      window.localStorage.setItem(queueKey(spaceId), JSON.stringify(entries.slice(-1)));
    } catch {
      /* nothing more to do */
    }
  }
}

/** Queue one failed upload for retry. Deduped per row (latest photo wins). */
export function queuePhotoUpload(spaceId: string, rowId: number, dataUrl: string): void {
  const entries = readQueue(spaceId).filter((e) => e.rowId !== rowId);
  entries.push({ rowId, dataUrl, queuedAt: Date.now() });
  writeQueue(spaceId, entries);
}

let flushing = false;

/**
 * Retry every queued upload. Runs on app load and on the 'online' event.
 * Successes patch the row's image_url and leave the queue; failures stay for
 * the next retry. Never throws.
 */
export async function flushPhotoUploads(spaceId: string, onRowPatched?: () => void): Promise<void> {
  if (flushing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const entries = readQueue(spaceId);
  if (entries.length === 0) return;
  flushing = true;
  try {
    const remaining: PendingPhoto[] = [];
    let patched = false;
    for (const entry of entries) {
      try {
        const file = await dataUrlToJpegFile(entry.dataUrl, 'mistake-photo.jpg');
        const hosted = await uploadImage(file, spaceId);
        await verifiedDbFrom(TABLES.questionQueue).update(entry.rowId, { image_url: hosted });
        patched = true;
      } catch {
        remaining.push(entry);
      }
    }
    writeQueue(spaceId, remaining);
    if (patched && onRowPatched) onRowPatched();
  } finally {
    flushing = false;
  }
}
