/**
 * Auto-segmentation for mock paper pages — Tesseract.js line detection inside
 * a Web Worker (same CDN + Blob-URL pattern as doubtOcr.ts, so the main
 * thread never runs the OCR engine and the UI never janks).
 *
 * The worker returns every recognised text LINE with its bounding box; the
 * main thread then looks for question-numbering patterns at line starts
 * ("14.", "Q14", "(14)", "14)") and proposes one crop box per detected
 * question: full page width, from that question's line down to the next
 * question's line (or the page bottom).
 *
 * PROPOSES, NEVER COMMITS: the boxes here are suggestions the student
 * confirms, adjusts, deletes or replaces in the cropping screen. A worker
 * failure simply yields zero proposals — manual drawing always works.
 */

import type { CropRect } from './taTypes';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const SEGMENT_LANGUAGES = 'hin+eng';
/** Page-level recognition is heavier than a crop — allow a longer clock. */
export const SEGMENT_TIMEOUT_MS = 45_000;

/** One recognised text line with its bounding box (natural pixels). */
export interface PageLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A proposed question crop, with the detected number when one matched. */
export interface ProposedBox {
  rect: CropRect;
  questionNumber: number | null;
}

const WORKER_SOURCE = [
  `importScripts('${TESSERACT_CDN}');`,
  'self.onmessage = function (event) {',
  '  var data = event.data || {};',
  "  if (data.type !== 'SEGMENT' || !data.imageData) return;",
  '  var id = data.id;',
  `  Tesseract.recognize(data.imageData, '${SEGMENT_LANGUAGES}')`,
  '    .then(function (result) {',
  '      var d = (result && result.data) || {};',
  '      var lines = [];',
  '      var raw = d.lines || [];',
  '      for (var i = 0; i < raw.length; i++) {',
  '        var line = raw[i];',
  '        if (!line || !line.bbox) continue;',
  '        lines.push({ text: String(line.text || ""), x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 });',
  '      }',
  "      self.postMessage({ type: 'SEGMENT_RESULT', id: id, lines: lines });",
  '    })',
  '    .catch(function (error) {',
  "      self.postMessage({ type: 'SEGMENT_ERROR', id: id, error: String((error && error.message) || error || 'segmentation failed') });",
  '    });',
  '};',
].join('\n');

interface PendingJob {
  resolve: (lines: PageLine[]) => void;
  reject: (error: Error) => void;
  timer: number;
}

let worker: Worker | null = null;
let workerUrl: string | null = null;
let nextJobId = 1;
const pending = new Map<number, PendingJob>();

function teardownWorker(): void {
  if (worker) {
    try {
      worker.terminate();
    } catch {
      /* already gone */
    }
  }
  if (workerUrl) {
    try {
      URL.revokeObjectURL(workerUrl);
    } catch {
      /* non-fatal */
    }
  }
  worker = null;
  workerUrl = null;
}

function getWorker(): Worker {
  if (worker) return worker;
  const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
  workerUrl = URL.createObjectURL(blob);
  worker = new Worker(workerUrl);
  worker.onmessage = (event: MessageEvent) => {
    const data = (event.data ?? {}) as { type?: string; id?: number; lines?: PageLine[]; error?: string };
    if (typeof data.id !== 'number') return;
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    clearTimeout(job.timer);
    if (data.type === 'SEGMENT_RESULT') job.resolve(Array.isArray(data.lines) ? data.lines : []);
    else job.reject(new Error(data.error || 'Segmentation failed'));
  };
  worker.onerror = () => {
    for (const job of pending.values()) {
      clearTimeout(job.timer);
      job.reject(new Error('The page reader could not start'));
    }
    pending.clear();
    teardownWorker();
  };
  return worker;
}

/* One page at a time — page recognition is heavy on low-end phones. */
let queueTail: Promise<void> = Promise.resolve();

/** Recognise every text line (with boxes) on a page image, off-thread. */
export function recognizePageLines(imageData: string): Promise<PageLine[]> {
  const run = (): Promise<PageLine[]> =>
    new Promise<PageLine[]>((resolve, reject) => {
      let segWorker: Worker;
      try {
        segWorker = getWorker();
      } catch {
        reject(new Error('Web Workers are unavailable in this browser'));
        return;
      }
      const id = nextJobId++;
      const timer = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error('Segmentation timed out'));
      }, SEGMENT_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      segWorker.postMessage({ type: 'SEGMENT', id, imageData });
    });
  return new Promise<PageLine[]>((resolve, reject) => {
    queueTail = queueTail
      .then(() => run().then(resolve, reject))
      .catch(() => {
        /* keep the queue alive after a failed job */
      });
  });
}

/** "14.", "14)", "(14)", "[14]", "Q14", "Q. 14", "Ques 14" at a line start. */
const QUESTION_NUMBER_PATTERNS: RegExp[] = [
  /^\s*[([]?\s*(\d{1,3})\s*[.)\]]/,
  /^\s*q(?:ues(?:tion)?)?\s*[.:-]?\s*(\d{1,3})\b/i,
];

/** The question number a line starts with, or null. */
export function detectQuestionNumber(lineText: string): number | null {
  const text = String(lineText || '');
  for (const pattern of QUESTION_NUMBER_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 400) return n;
    }
  }
  return null;
}

/**
 * Turn recognised lines into proposed crop boxes: each detected question
 * numbering line opens a box spanning the full page width from just above
 * that line down to just above the next question line (or the page bottom).
 * Pure function — trivially testable, zero AI.
 */
export function proposeBoxesFromLines(
  lines: PageLine[],
  imageWidth: number,
  imageHeight: number,
): ProposedBox[] {
  const starts: Array<{ y: number; questionNumber: number }> = [];
  for (const line of lines) {
    const questionNumber = detectQuestionNumber(line.text);
    if (questionNumber === null) continue;
    // Numbering usually sits in the left half of the page; a number at the
    // far right is more likely a marks column than a question start.
    if (line.x0 > imageWidth * 0.55) continue;
    starts.push({ y: Math.max(0, line.y0), questionNumber });
  }
  starts.sort((a, b) => a.y - b.y);
  // Collapse duplicate detections that landed on (almost) the same line.
  const deduped: Array<{ y: number; questionNumber: number }> = [];
  for (const start of starts) {
    const previous = deduped[deduped.length - 1];
    if (previous && Math.abs(start.y - previous.y) < imageHeight * 0.015) continue;
    deduped.push(start);
  }
  const pad = Math.round(imageHeight * 0.006);
  return deduped.map((start, index) => {
    const top = Math.max(0, start.y - pad);
    const nextTop = index + 1 < deduped.length ? Math.max(0, deduped[index + 1].y - pad) : imageHeight;
    const height = Math.max(24, nextTop - top);
    return {
      rect: { x: 0, y: Math.round(top), w: imageWidth, h: Math.round(Math.min(height, imageHeight - top)) },
      questionNumber: start.questionNumber,
    };
  });
}

/* ---------- canvas cropping helpers (main thread, cheap) ---------- */

/** Load an image element from a URL/data URL (CORS-safe for canvas reads). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the page image'));
    image.src = src;
  });
}

/** Cut one crop rect out of an image as a JPEG data URL. */
export function cropToDataUrl(image: HTMLImageElement, rect: CropRect): string {
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  const x = Math.max(0, Math.min(rect.x, naturalW - 1));
  const y = Math.max(0, Math.min(rect.y, naturalH - 1));
  const w = Math.max(8, Math.min(rect.w, naturalW - x));
  const h = Math.max(8, Math.min(rect.h, naturalH - y));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
