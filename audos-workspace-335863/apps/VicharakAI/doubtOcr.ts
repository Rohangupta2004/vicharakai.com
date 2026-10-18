/**
 * Local OCR for the Doubts UPLOAD path — Tesseract.js inside a Web Worker.
 *
 * Privacy + responsiveness contract:
 *  - Recognition runs on the student's device FIRST. Only when the local
 *    Tesseract pass fails (worker error, empty text, or confidence below
 *    OCR_MIN_CONFIDENCE) does aiOcrText() quietly send the clean JPEG to the
 *    platform's OpenAI vision proxy as a fallback — manual typing stays the
 *    last resort. (The untouched Camera flow keeps its own vision tagging.)
 *  - Tesseract.js loads from CDN via importScripts INSIDE the worker; the
 *    main thread never imports or runs the OCR engine, so the UI never janks.
 *  - Before anything touches the image, fileToCleanJpeg() redraws it on a
 *    canvas and re-exports fresh JPEG bytes — that strips EXIF/GPS metadata,
 *    so neither the worker nor the storage upload ever sees the raw file.
 *
 * Worker protocol (the extra `id` lets several screenshots process without
 * their answers getting crossed):
 *    in : { type: 'OCR', id, imageData: <base64 data URL> }
 *    out: { type: 'OCR_RESULT', id, text, confidence }
 *       | { type: 'OCR_ERROR', id, error }
 */

import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { waitForWorkspaceDbToken } from './shared/platformAuth';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

/** Hindi + English — the app already ships Hindi UI labels (VicharakBottomNav)
 * and printed questions for Indian exams mix both scripts. */
const OCR_LANGUAGES = 'hin+eng';

/** A screenshot that hasn't produced text after this long counts as failed —
 * the card stays editable and offers Retry. (The first run also downloads the
 * engine + language data; a retry is much faster because they're cached.) */
export const OCR_TIMEOUT_MS = 15_000;

/** Tesseract mean-word confidence (0–100) below which the local read is
 * treated as failed and the AI-vision fallback should be attempted. */
export const OCR_MIN_CONFIDENCE = 40;

/** Longest the AI-vision fallback may run before callers fall through to the
 * manual-typing prompt. */
const AI_OCR_TIMEOUT_MS = 25_000;

const AI_OCR_PROMPT =
  'Extract and return ONLY the text visible in this image. Return just the raw text, no commentary, no formatting markers.';

/** Longest canvas edge for the clean JPEG — plenty of resolution for printed
 * text, and keeps canvas memory bounded on low-end phones. */
const MAX_DIMENSION = 2000;

const WORKER_SOURCE = [
  `importScripts('${TESSERACT_CDN}');`,
  'self.onmessage = function (event) {',
  '  var data = event.data || {};',
  "  if (data.type !== 'OCR' || !data.imageData) return;",
  '  var id = data.id;',
  `  Tesseract.recognize(data.imageData, '${OCR_LANGUAGES}')`,
  '    .then(function (result) {',
  '      var d = (result && result.data) || {};',
  "      self.postMessage({ type: 'OCR_RESULT', id: id, text: String(d.text || ''), confidence: typeof d.confidence === 'number' ? d.confidence : 0 });",
  '    })',
  '    .catch(function (error) {',
  "      self.postMessage({ type: 'OCR_ERROR', id: id, error: String((error && error.message) || error || 'OCR failed') });",
  '    });',
  '};',
].join('\n');

export interface OcrResult {
  text: string;
  /** Tesseract's 0–100 mean word confidence for the page. */
  confidence: number;
}

interface PendingJob {
  resolve: (result: OcrResult) => void;
  reject: (error: Error) => void;
  timer: number;
}

let worker: Worker | null = null;
let workerUrl: string | null = null;
let nextJobId = 1;
const pending = new Map<number, PendingJob>();

function failAllPending(message: string): void {
  for (const job of pending.values()) {
    clearTimeout(job.timer);
    job.reject(new Error(message));
  }
  pending.clear();
}

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

/** Lazily build the singleton OCR worker from a Blob URL — no separate file. */
function getWorker(): Worker {
  if (worker) return worker;
  const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
  workerUrl = URL.createObjectURL(blob);
  worker = new Worker(workerUrl);
  worker.onmessage = (event: MessageEvent) => {
    const data = (event.data ?? {}) as { type?: string; id?: number; text?: string; confidence?: number; error?: string };
    if (typeof data.id !== 'number') return;
    const job = pending.get(data.id);
    if (!job) return; // answered after its timeout — the card already moved on
    pending.delete(data.id);
    clearTimeout(job.timer);
    if (data.type === 'OCR_RESULT') job.resolve({ text: data.text ?? '', confidence: data.confidence ?? 0 });
    else job.reject(new Error(data.error || 'OCR failed'));
  };
  // A top-level crash (e.g. the CDN script failed to load) fails every
  // pending job; the NEXT job builds a fresh worker, so Retry recovers.
  worker.onerror = () => {
    failAllPending('The text reader could not start');
    teardownWorker();
  };
  return worker;
}

function runJob(imageData: string): Promise<OcrResult> {
  return new Promise<OcrResult>((resolve, reject) => {
    let ocrWorker: Worker;
    try {
      ocrWorker = getWorker();
    } catch {
      reject(new Error('Web Workers are unavailable in this browser'));
      return;
    }
    const id = nextJobId++;
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('OCR timed out'));
    }, OCR_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    ocrWorker.postMessage({ type: 'OCR', id, imageData });
  });
}

/* One page at a time: Tesseract spins up its own engine per recognize call,
 * so running many screenshots simultaneously would swamp a phone. Jobs queue
 * FIFO here — the student can keep picking screenshots and each card's 15s
 * clock starts only when its own recognition actually begins. */
let queueTail: Promise<void> = Promise.resolve();

/** Run OCR on a clean base64 image, entirely off the main thread. */
export function recognizeText(imageData: string): Promise<OcrResult> {
  return new Promise<OcrResult>((resolve, reject) => {
    queueTail = queueTail
      .then(() => runJob(imageData).then(resolve, reject))
      .catch(() => {
        /* keep the queue alive after a failed job */
      });
  });
}

/**
 * EXIF strip: decode the image, redraw it onto a canvas and export as JPEG
 * (quality 0.85). Canvas re-encoding writes fresh image bytes with no
 * metadata segments, so EXIF/GPS never leaves the device — this clean base64
 * is what both the OCR worker AND the storage upload receive; the raw File
 * is never used again after this call.
 */
export function fileToCleanJpeg(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) throw new Error('Empty image');
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        // White backdrop — transparent screenshot PNGs would otherwise
        // flatten to black in JPEG and become unreadable for OCR.
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not read the image'));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the image'));
    };
    image.src = objectUrl;
  });
}

/** Rebuild a File from the clean JPEG data URL so the existing uploadImage()
 * path can store it — the upload therefore also carries zero EXIF. */
export async function dataUrlToJpegFile(dataUrl: string, fileName: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], fileName, { type: 'image/jpeg' });
}

/**
 * AI-vision fallback OCR — used ONLY after the on-device Tesseract pass has
 * failed or come back below OCR_MIN_CONFIDENCE. Sends the already-clean
 * (EXIF-stripped, canvas-re-encoded) JPEG data URL to the platform's OpenAI
 * vision proxy. Runs on the main thread — plain fetch, never inside the
 * worker.
 *
 * Never throws: any failure (missing workspace token, network error, non-200
 * response, timeout, empty content) resolves to '' so callers can fall
 * through to the manual input without surfacing an error.
 */
export async function aiOcrText(imageDataUrl: string): Promise<string> {
  try {
    const token = await waitForWorkspaceDbToken();
    if (!token) return '';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), AI_OCR_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch('/proxy/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-DB-Token': token,
        },
        body: JSON.stringify({
          model: 'gpt-4o', // vision-capable model accepted by the workspace proxy
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageDataUrl } },
                { type: 'text', text: AI_OCR_PROMPT },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return '';
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' ? (content ?? '').trim() : '';
  } catch {
    return '';
  }
}

/** Longest the OCR-cleanup model call may run before the raw OCR text is
 * kept as-is — the card must never hang on a tidy-up. */
const OCR_CLEANUP_TIMEOUT_MS = 20_000;

const OCR_CLEANUP_PROMPT = [
  'You clean up raw OCR output of an exam question. Rules:',
  '- Fix obvious OCR mistakes (broken words, wrong characters, stray symbols).',
  '- Preserve mathematical notation faithfully (fractions, exponents, units, Greek letters).',
  '- Keep the question text and, when present, the MCQ options labelled (A)/(B)/(C)/(D), one per line.',
  '- Remove irrelevant noise: page numbers, headers, watermarks, unrelated fragments.',
  '- NEVER invent, complete or paraphrase missing portions — keep only what is actually there.',
  'Return ONLY the cleaned question text, no commentary.',
].join('\n');

/**
 * Pass raw OCR text through the cheapest available text model to fix OCR
 * mistakes while preserving maths notation and MCQ options — never inventing
 * content. Never throws: any failure (no token, network, timeout, empty
 * reply) resolves to '' so callers keep the raw OCR text.
 */
export async function cleanOcrQuestionText(rawText: string): Promise<string> {
  const source = (rawText ?? '').trim();
  if (!source || source.length < 12) return '';
  try {
    const token = await waitForWorkspaceDbToken();
    if (!token) return '';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), OCR_CLEANUP_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-DB-Token': token,
        },
        body: JSON.stringify({
          // The cheapest text tier — this is a mechanical tidy-up, not generation.
          model: AI_MODELS.fast,
          reasoning_effort: 'none',
          messages: [
            { role: 'system', content: OCR_CLEANUP_PROMPT },
            { role: 'user', content: source.slice(0, 4000) },
          ],
          max_completion_tokens: 900,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return '';
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    const cleaned = typeof content === 'string' ? (content ?? '').trim() : '';
    // A reply that shrank to almost nothing is a refusal, not a clean-up.
    return cleaned && cleaned.length >= Math.min(12, source.length) ? cleaned : '';
  } catch {
    return '';
  }
}

/** Tidy raw OCR output for the editable field: normalise whitespace inside
 * lines but keep the question's line structure. */
export function tidyOcrText(raw: string): string {
  return (raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (line.replace(/\s+/g, ' ') ?? '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') ?? '')
    .trim();
}
