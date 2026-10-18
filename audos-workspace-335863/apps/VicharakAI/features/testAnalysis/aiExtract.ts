/**
 * AI question extraction for Test Analysis — reads a photographed mock-paper
 * PAGE with the vision model and returns every question it can see, with its
 * number and text. This replaces the manual crop/split step as the DEFAULT
 * path: the student uploads pages, Vicharee reads them, and the review list
 * opens with one row per question ready for Correct / Wrong / Skipped.
 *
 * The manual CropScreen remains the FALLBACK: any page this module cannot
 * read stays 'unprocessed' and keeps its "split it yourself" flow, so a bad
 * photo never strands the student.
 *
 * Model chain (same registry pattern as conceptGap.ts): the balanced model
 * first (AI_MODELS.standard, image-capable on the workspace proxy), retried
 * through the registry's dedicated vision model if it turns the image down.
 * Every failure path (no token, non-200, bad JSON, timeout, empty list)
 * throws AiExtractError so the caller can fall back to manual splitting with
 * a clear message.
 */

import {
  AI_MODELS,
  OPENAI_PROXY_URL,
  supportsReasoningEffort,
  tokenLimitField,
  visionRetryModel,
} from '../../config/models';
import { waitForWorkspaceDbToken } from '../../shared/platformAuth';

/** A page photo carries many questions — give the read a generous leash. */
const EXTRACT_TIMEOUT_MS = 75_000;

/** Enough room for a dense two-column page of MCQs; the proxy caps at 8192. */
const EXTRACT_MAX_TOKENS = 6000;

/** More rows than any real paper page carries — a runaway reply is cut here. */
const MAX_QUESTIONS_PER_PAGE = 80;

const EXTRACT_SYSTEM_PROMPT =
  'You are an expert exam-paper reader. You are given a photo of one page of a ' +
  'mock test paper. Extract EVERY question visible on the page. Preserve ' +
  'mathematical notation faithfully (fractions, exponents, units, Greek ' +
  'letters) and include MCQ options labelled (A)/(B)/(C)/(D) on their own ' +
  'lines when present. Use the question number printed on the paper; null when ' +
  'no number is visible. NEVER invent, complete or paraphrase questions — ' +
  'extract only what is actually printed. Return STRICT JSON only.';

const EXTRACT_USER_PROMPT = [
  'Read this mock test paper page and extract every question.',
  'Reply with STRICT JSON only — no prose, no markdown fences:',
  '{"questions": [{"number": <integer or null>, "text": "<the full question text, options included>"}]}',
  'Order the questions exactly as they appear on the page.',
].join('\n');

/** One question the model read off the page. */
export interface ExtractedQuestion {
  questionNumber: number | null;
  text: string;
}

/** Thrown when a page could not be read — callers fall back to manual crop. */
export class AiExtractError extends Error {}

/** One proxied vision call. Resolves to the raw reply, '' on any refusal. */
async function requestExtraction(imageUrl: string, model: string): Promise<string> {
  const token = await waitForWorkspaceDbToken();
  if (!token) return '';

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: EXTRACT_USER_PROMPT },
        ],
      },
    ],
    stream: false,
  };
  body[tokenLimitField(model)] = EXTRACT_MAX_TOKENS;
  if (supportsReasoningEffort(model)) body.reasoning_effort = 'none';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workspace-DB-Token': token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return '';
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) return '';
  try {
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const reply = data.choices?.[0]?.message?.content;
    return typeof reply === 'string' ? reply : '';
  } catch {
    return '';
  }
}

/** Pull the {"questions": [...]} object out of a reply that may carry fences. */
function parseQuestions(reply: string): ExtractedQuestion[] {
  const text = (reply ?? '').trim();
  if (!text) return [];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const list = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return [];
  const questions: ExtractedQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const rawText = String(record.text ?? '').trim();
    if (!rawText) continue;
    const rawNumber = Number(record.number);
    questions.push({
      questionNumber: Number.isFinite(rawNumber) && rawNumber > 0 ? Math.round(rawNumber) : null,
      text: rawText.slice(0, 4000),
    });
    if (questions.length >= MAX_QUESTIONS_PER_PAGE) break;
  }
  return questions;
}

/**
 * Read one page image (data URL or hosted URL) and return its questions.
 * Throws AiExtractError when nothing usable came back — the caller keeps the
 * page 'unprocessed' so the manual crop flow can take over.
 */
export async function extractQuestionsFromImage(imageUrl: string): Promise<ExtractedQuestion[]> {
  const source = (imageUrl ?? '').trim();
  if (!source) throw new AiExtractError('No page image to read');

  let questions = parseQuestions(await requestExtraction(source, AI_MODELS.standard));
  if (questions.length === 0) {
    const retryModel = visionRetryModel(AI_MODELS.standard);
    if (retryModel) questions = parseQuestions(await requestExtraction(source, retryModel));
  }
  if (questions.length === 0) throw new AiExtractError('Could not read any questions off this page');
  return questions;
}
