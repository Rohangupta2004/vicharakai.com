/**
 * Concept-gap detection for mock question entries — the AI VISION fallback.
 *
 * WHY THIS EXISTS. Tesseract reads every crop and stores `extracted_text`,
 * and that text used to be the ONLY signal concept detection had. On a real
 * paper it is routinely unusable: a Math scatterplot question came back as
 * "across the four beats, exactly described. Ends on truehave…", which
 * keyword-matches to nothing. The result was `predicted_topic_id` null on
 * almost every entry and a `concept_gap` tag with nothing behind it — the
 * student was told they had a gap but never told WHICH concept.
 *
 * THE CHAIN (unchanged at the front, extended at the back):
 *   Tesseract OCR                → extracted_text stored, as before
 *   syllabus keyword match       → a confident match still wins (topicPredict)
 *   AI vision on the CROP        → only when that match fails, or the entry
 *                                  carries a concept_gap tag
 *   AI concept + topic + gap     → the topic is a SUGGESTION; the gap line is
 *                                  what the student finally gets to read
 *
 * Tesseract is NOT removed and NOT bypassed: its text still ships to the
 * model here as extra context, garbled or not — a half-read formula or a
 * stray "750 words" is often enough to disambiguate the crop.
 *
 * THE SYLLABUS IS STILL THE LAW. The model answers in free text, so its
 * `predicted_topic` is snapped against the student's OWN subject → chapter →
 * topic tree (`snapTopicToSyllabus`) before anything is stored. An
 * out-of-catalog topic is kept as display-only text and never written to
 * `predicted_topic_id` — the same no-invented-topics rule topicPredict.ts and
 * features/doubts/autoTag.ts already follow.
 *
 * Never throws. Every failure path (no token, no crop, non-200, bad JSON,
 * timeout) resolves to null so the logging list keeps working exactly as it
 * does today.
 */

import {
  AI_MODELS,
  OPENAI_PROXY_URL,
  supportsReasoningEffort,
  tokenLimitField,
  visionRetryModel,
} from '../../config/models';
import { waitForWorkspaceDbToken } from '../../shared/platformAuth';
import { extractJsonObject } from '../../customExam';
import { sanitizeTopicName, type QuestionEntryRow } from './taTypes';
import type { TopicPickerSubject } from '../../TopicPicker';

/** Vision reads a whole image — slower than a text classification, so it
 * gets a longer leash than the 20s topic pick. */
const CONCEPT_GAP_TIMEOUT_MS = 30_000;

/** The reply is four short strings; it never needs more room than this. */
const CONCEPT_GAP_MAX_TOKENS = 500;

/** Garbled OCR still helps, but a whole RC passage would crowd out the
 * image. Enough for a question stem plus its options. */
const OCR_CONTEXT_CHARS = 1200;

/** How much of the student's syllabus is offered as the topic shortlist. */
const SYLLABUS_CONTEXT_CHARS = 2600;

/** Shortest overlap that may snap a topic by containment rather than an
 * exact match. Below it a fragment like 'linear' matches several unrelated
 * topics and means nothing. */
const MIN_PARTIAL_TOPIC_CHARS = 8;

const CONCEPT_GAP_SYSTEM_PROMPT =
  'You are an expert exam analysis assistant. Given a crop of a question image from a student\'s mock exam, identify: (1) the specific concept being tested, (2) the closest syllabus topic match, (3) if this is a concept gap error, what specific concept the student likely misunderstood. Be concise. Return JSON only.';

/** Everything the model needs that does not live on the entry itself. */
export interface ConceptGapExamContext {
  /** The exam this mock belongs to — the session's own type when it has one. */
  examLabel: string;
  /** The mock's name, for a little more grounding ('JEE Main Mock 4'). */
  mockName?: string | null;
  /** The student's enrolled syllabus. Doubles as the topic shortlist AND the
   * validator every returned topic is snapped against. */
  subjects: TopicPickerSubject[];
  /** The error tag the student picked, when they already picked one. */
  errorTag?: string | null;
}

/** A topic that exists in the student's own syllabus. */
export interface SyllabusTopicMatch {
  subject: string;
  chapter: string;
  topic: string;
}

export interface ConceptGapAnalysis {
  /** The specific concept this question tests (free text, display only). */
  conceptBeingTested: string;
  /** The model's closest syllabus topic, verbatim as it answered. */
  predictedTopic: string;
  /** `predictedTopic` resolved against the student's syllabus, or null when
   * it named something outside it. Only a match may ever be stored. */
  syllabusTopic: SyllabusTopicMatch | null;
  /** One sentence: what the student likely does not understand. */
  description: string;
  /** The model's own 0–1 confidence. */
  confidence: number;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function cleanLine(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Lower-cased, punctuation-free — the comparison form for topic snapping. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a free-text topic against the student's OWN syllabus tree. Exact
 * (normalised) match first; failing that, a single unambiguous containment
 * match — 'Scatterplots' finding 'Scatterplots and line of best fit' is a
 * real answer, while a fragment that fits several topics is not.
 *
 * AMBIGUITY RESOLVES TO NULL, never to the first hit. The student then picks
 * from their syllabus, which is the same promise the rest of the feature
 * makes: no topic is ever guessed on their behalf.
 */
export function snapTopicToSyllabus(
  value: string,
  subjects: TopicPickerSubject[],
  preferredSubject?: string | null,
): SyllabusTopicMatch | null {
  const wanted = normalize(value);
  if (!wanted) return null;

  const exact: SyllabusTopicMatch[] = [];
  const partial: SyllabusTopicMatch[] = [];
  for (const subject of subjects) {
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        if (!topic) continue;
        const candidate = normalize(topic);
        if (!candidate) continue;
        const match = { subject: subject.name, chapter: chapter.name, topic };
        if (candidate === wanted) exact.push(match);
        else if (
          Math.min(candidate.length, wanted.length) >= MIN_PARTIAL_TOPIC_CHARS &&
          (candidate.includes(wanted) || wanted.includes(candidate))
        ) {
          partial.push(match);
        }
      }
    }
  }

  const preferred = normalize(String(preferredSubject ?? ''));
  const pick = (matches: SyllabusTopicMatch[]): SyllabusTopicMatch | null => {
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    /* Several syllabuses repeat ONE topic name across subjects, and the
     * entry's own subject breaks that tie. Two different topics inside the
     * same subject is real ambiguity, and picking either would be a guess. */
    if (!preferred) return null;
    const inSubject = matches.filter((match) => normalize(match.subject) === preferred);
    return inSubject.length === 1 ? inSubject[0] : null;
  };
  return pick(exact) ?? pick(partial);
}

/** The syllabus shortlist the model chooses its topic from, capped. */
function syllabusContext(subjects: TopicPickerSubject[], entry: QuestionEntryRow): string {
  const entrySubject = normalize(String(entry.subject ?? ''));
  /* The entry's own subject leads, so the useful topics survive the cap. */
  const ordered = entrySubject
    ? [...subjects].sort((a, b) => {
        const aMatch = normalize(a.name) === entrySubject ? 0 : 1;
        const bMatch = normalize(b.name) === entrySubject ? 0 : 1;
        return aMatch - bMatch;
      })
    : subjects;

  const lines: string[] = [];
  let used = 0;
  for (const subject of ordered) {
    for (const chapter of subject.chapters) {
      const topics = chapter.topics.filter(Boolean);
      if (topics.length === 0) continue;
      const line = `${subject.name} › ${chapter.name}: ${topics.join(' | ')}`;
      if (used + line.length > SYLLABUS_CONTEXT_CHARS) return lines.join('\n');
      lines.push(line);
      used += line.length + 1;
    }
  }
  return lines.join('\n');
}

/** Everything known about the question, in the order the model should read it. */
function questionContext(entry: QuestionEntryRow, context: ConceptGapExamContext): string {
  const ocrText = String(entry.extracted_text ?? '').trim();
  const parts: string[] = [`EXAM: ${context.examLabel || 'unknown exam'}`];
  if (context.mockName) parts.push(`MOCK: ${context.mockName}`);
  if (entry.question_number !== null && entry.question_number !== undefined && entry.question_number !== '') {
    parts.push(`QUESTION NUMBER: ${entry.question_number}`);
  }
  if (entry.subject) parts.push(`SUBJECT (student-tagged): ${entry.subject}`);
  if (entry.chapter_id) parts.push(`CHAPTER (student-tagged): ${entry.chapter_id}`);
  if (entry.topic_id) parts.push(`TOPIC (student-confirmed): ${entry.topic_id}`);
  if (context.errorTag) parts.push(`ERROR TAG the student picked: ${context.errorTag}`);

  const syllabus = syllabusContext(context.subjects, entry);
  if (syllabus) {
    parts.push('', "THE STUDENT'S SYLLABUS (prefer a topic copied verbatim from here):", syllabus);
  }

  parts.push(
    '',
    'ON-DEVICE OCR OF THIS CROP — often badly garbled, so trust the IMAGE first',
    'and treat this only as a hint (it may be nonsense; ignore it if so):',
    ocrText ? ocrText.slice(0, OCR_CONTEXT_CHARS) : '(no text could be read)',
    '',
    'Reply with STRICT JSON only — no prose, no markdown fences:',
    '{"concept_being_tested": string, "predicted_topic": string, "concept_gap_description": string, "confidence": number}',
    '- "concept_being_tested": the specific concept this question tests.',
    '- "predicted_topic": the closest syllabus chapter/topic name, copied verbatim from the syllabus above when one fits.',
    '- "concept_gap_description": ONE sentence naming what the student likely does not understand.',
    '- "confidence": 0 to 1, how sure you are. Be honest — an unreadable crop deserves a low number.',
  );
  return parts.join('\n');
}

/** One proxied call. Resolves to the raw reply, or '' on any refusal. */
async function requestConceptGap(prompt: string, imageUrl: string | null, model: string): Promise<string> {
  const token = await waitForWorkspaceDbToken();
  if (!token) return '';
  const content: Array<Record<string, unknown>> = [];
  if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });
  content.push({ type: 'text', text: prompt });

  /* The token-limit field and reasoning_effort differ by model family; the
   * registry owns that so this call site does not have to. */
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: CONCEPT_GAP_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    stream: false,
  };
  body[tokenLimitField(model)] = CONCEPT_GAP_MAX_TOKENS;
  if (supportsReasoningEffort(model)) body.reasoning_effort = 'none';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CONCEPT_GAP_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workspace-DB-Token': token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) return '';
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const reply = data.choices?.[0]?.message?.content;
  return typeof reply === 'string' ? reply : '';
}

/**
 * Ask for the reading, keeping the IMAGE in play as long as possible:
 *   1. the balanced model with the crop attached — the intended path;
 *   2. the registry's image-capable model with the same crop, in case the
 *      balanced one turns image content down;
 *   3. text-only off whatever Tesseract managed, so a crop the models refuse
 *      still yields something rather than nothing.
 * Reading the CROP is the whole point, so dropping to step 3 is genuinely a
 * last resort — the garbled OCR text is exactly what could not carry this.
 */
async function readConceptGap(prompt: string, imageUrl: string | null, hasOcrText: boolean): Promise<string> {
  const primary = await requestConceptGap(prompt, imageUrl, AI_MODELS.standard);
  if (primary || !imageUrl) return primary;

  const retryModel = visionRetryModel(AI_MODELS.standard);
  if (retryModel) {
    const withVisionModel = await requestConceptGap(prompt, imageUrl, retryModel);
    if (withVisionModel) return withVisionModel;
  }
  return hasOcrText ? requestConceptGap(prompt, null, AI_MODELS.standard) : '';
}

/**
 * THE concept-gap entry point. Sends the CROP IMAGE plus the entry's own
 * context (subject/chapter/topic, the exam type, the syllabus shortlist and
 * whatever Tesseract managed to read) and returns the concept, a syllabus-
 * validated topic suggestion and the one-sentence gap description.
 *
 * The image is what the model is really being asked to read; a crop that
 * never uploaded (`crop_url` null) still gets a text-only pass off the OCR
 * text, and a model that refuses image content is retried through the
 * registry's image-capable one rather than losing the crop entirely.
 */
export async function analyzeConceptGap(
  entry: QuestionEntryRow,
  examContext: ConceptGapExamContext,
): Promise<ConceptGapAnalysis | null> {
  const cropUrl = String(entry.crop_url ?? '').trim() || null;
  const ocrText = String(entry.extracted_text ?? '').trim();
  /* Nothing to look at and nothing to read: there is no question here yet. */
  if (!cropUrl && !ocrText) return null;

  const prompt = questionContext(entry, examContext);
  let reply = '';
  try {
    reply = await readConceptGap(prompt, cropUrl, ocrText.length > 0);
  } catch {
    return null;
  }
  if (!(reply ?? '').trim()) return null;

  const parsed = extractJsonObject(reply);
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;

  const conceptBeingTested = cleanLine(record.concept_being_tested, 140);
  const predictedTopic = cleanLine(record.predicted_topic, 140);
  const description = cleanLine(record.concept_gap_description, 240);
  const confidence = clamp01(Number(record.confidence));
  /* A reply with neither a concept nor a gap sentence taught us nothing. */
  if (!conceptBeingTested && !description && !predictedTopic) return null;

  /* The syllabus is the law: the topic is only usable once it resolves to a
   * real topic in the student's own tree. 'General' and friends are refused
   * by sanitizeTopicName exactly as everywhere else. */
  const snapped =
    snapTopicToSyllabus(predictedTopic, examContext.subjects, entry.subject) ??
    snapTopicToSyllabus(conceptBeingTested, examContext.subjects, entry.subject);
  const syllabusTopic = snapped && sanitizeTopicName(snapped.topic) ? snapped : null;

  return { conceptBeingTested, predictedTopic, syllabusTopic, description, confidence };
}
