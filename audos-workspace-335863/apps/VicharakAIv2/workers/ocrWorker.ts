/**
 * OCR pipeline (§5). Tesseract.js executes its WASM recognizer inside its
 * OWN dedicated Web Worker (worker + core loaded from CDN) — recognition
 * never runs on the main thread, and never on a server.
 *
 * Capture is non-blocking: enqueueOcr() returns immediately; results land in
 * the doubt row (data/doubts.setOcrResult) whenever the worker finishes.
 * Jobs are re-enqueued on app start for doubts still marked 'pending'.
 */
import { setOcrResult } from '../data/doubts';
import { getImage } from '../data/images';

type TesseractWorker = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
};

let workerPromise: Promise<TesseractWorker> | null = null;
let listeners: Array<(doubtId: string) => void> = [];
const queue: string[] = [];
let draining = false;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const mod: any = await import('https://esm.sh/tesseract.js@5.1.1');
      const createWorker = mod.createWorker ?? mod.default?.createWorker;
      // createWorker spins up the dedicated Web Worker + WASM core.
      return (await createWorker('eng')) as TesseractWorker;
    })();
  }
  return workerPromise;
}

/** Notify UI (e.g. Mistakes screen) when a doubt's OCR completes. */
export function onOcrDone(fn: (doubtId: string) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** Fire-and-forget: queue OCR for a stored doubt image. */
export function enqueueOcr(doubtId: string): void {
  if (!queue.includes(doubtId)) queue.push(doubtId);
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const doubtId = queue.shift()!;
      await runJob(doubtId);
      for (const l of listeners) l(doubtId);
    }
  } finally {
    draining = false;
  }
}

async function runJob(doubtId: string): Promise<void> {
  try {
    const { getDoubt } = await import('../data/doubts');
    const doubt = await getDoubt(doubtId);
    if (!doubt || doubt.ocr_status !== 'pending' || !doubt.image_id) return;
    const image = await getImage(doubt.image_id);
    if (!image) {
      await setOcrResult(doubtId, '', 'failed');
      return;
    }
    const worker = await getWorker();
    const result = await worker.recognize(image.blob);
    await setOcrResult(doubtId, (result.data.text ?? '').trim(), 'done');
  } catch {
    // Offline or CDN unreachable: mark failed — the student can still tag
    // the concept manually; OCR is an accelerator, not a dependency.
    await setOcrResult(doubtId, '', 'failed');
  }
}

/** Re-enqueue unfinished OCR jobs (called once on app start). */
export async function resumePendingOcr(examId: string): Promise<void> {
  const { listDoubts } = await import('../data/doubts');
  const doubts = await listDoubts(examId);
  for (const d of doubts) {
    if (d.ocr_status === 'pending' && d.image_id) enqueueOcr(d.doubt_id);
  }
}
