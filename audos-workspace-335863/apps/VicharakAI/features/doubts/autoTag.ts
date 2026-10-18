/**
 * autoTag — constrained subject/chapter tagging for Mistake Book entries.
 *
 * THE RULE: the tagger may only ever answer from the SELECTED EXAM'S OWN
 * chapter list. The model receives that list as a closed set and picks from
 * it — it never invents a subject or chapter name — and every tag carries a
 * confidence score (0–1). Below TAG_CONFIDENCE_THRESHOLD the UI renders the
 * tag as an editable suggestion chip, never asserted; and EVERY card offers a
 * one-tap correction regardless of confidence. Corrections are logged to
 * zuno_meta so mis-tags remain auditable.
 *
 * Two taggers, one contract:
 *  - aiTagQuestion  — one cheap-model call with the closed catalog; replies
 *    are validated against the catalog (an out-of-catalog answer is snapped
 *    to the catalog or dropped) so a hallucinated name can never be stored.
 *  - ruleTagQuestion — deterministic on-device fallback: word overlap between
 *    the question text and the catalog's chapter names (plus the shared
 *    CONCEPT_KEYWORDS map for the concept). Always low confidence.
 */

import { AI_MODELS, OPENAI_PROXY_URL } from '../../config/models';
import { waitForWorkspaceDbToken } from '../../shared/platformAuth';
import { tagConcept } from '../../config/sharedConfig';
import { extractJsonObject } from '../../customExam';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';

/** Below this the tag renders as an editable suggestion, not a statement. */
export const TAG_CONFIDENCE_THRESHOLD = 0.7;

/** One subject and its chapters — the closed set the tagger picks from. */
export interface CatalogSubject {
  subject: string;
  chapters: string[];
}

export interface AutoTagResult {
  /** Always one of the catalog's subjects (or 'General' when nothing fits). */
  subject: string;
  /** A chapter from that subject's own list, or '' when none fit. */
  chapter: string;
  /** Free-text concept (display only — never used as a subject/chapter). */
  concept: string;
  /** 0–1. 1 = student-confirmed; < TAG_CONFIDENCE_THRESHOLD = suggestion. */
  confidence: number;
  source: 'ai' | 'rule' | 'none';
}

/** The chapters shown to the tagger — shaped from TopicPicker subjects or an
 * ExamDef; both reduce to {subject, chapters[]}. */
export function buildTagCatalog(
  subjects: Array<{ name: string; chapters: Array<{ name: string }> }>,
): CatalogSubject[] {
  return subjects
    .map((s) => ({ subject: s.name, chapters: s.chapters.map((c) => c.name).filter(Boolean) }))
    .filter((s) => s.subject);
}

const UNTAGGED: AutoTagResult = { subject: 'General', chapter: '', concept: '', confidence: 0, source: 'none' };

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

/** Case-insensitive exact match of a name against a list; returns the
 * canonical (catalog) spelling or null. */
function snapToList(value: string, list: string[]): string | null {
  const wanted = (value ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return list.find((entry) => (entry ?? '').trim().toLowerCase() === wanted) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Deterministic fallback — catalog word overlap, zero AI             */
/* ------------------------------------------------------------------ */

const RULE_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'which', 'when',
  'find', 'given', 'value', 'question', 'following', 'correct', 'answer',
]);

/**
 * Score every catalog chapter against the text by word overlap. Deliberately
 * conservative: it returns a LOW confidence (never above 0.5), so a rule tag
 * always renders as an editable suggestion. It never falls back to "the first
 * subject" — no match means General at confidence 0.
 */
export function ruleTagQuestion(text: string, catalog: CatalogSubject[]): AutoTagResult {
  const hay = ` ${String(text || '').toLowerCase().replace(/\s+/g, ' ')} `;
  if (!(hay ?? '').trim()) return UNTAGGED;
  const words = new Set(
    hay.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !RULE_STOP_WORDS.has(w)),
  );
  let best: { subject: string; chapter: string; score: number } | null = null;
  for (const entry of catalog) {
    for (const chapter of entry.chapters) {
      const chapterWords = chapter.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      if (chapterWords.length === 0) continue;
      let score = 0;
      for (const word of chapterWords) {
        if (words.has(word)) score += word.length >= 6 ? 2 : 1;
        else if (hay.includes(word)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) best = { subject: entry.subject, chapter, score };
    }
  }
  const concept = tagConcept(text) ?? '';
  if (!best) {
    // A concept keyword hit without a chapter match still beats nothing —
    // but only when its subject can be located in the catalog is it usable,
    // and CONCEPT_KEYWORDS carries no subject, so: General, confidence 0.
    return { ...UNTAGGED, concept };
  }
  // 2 points ≈ one strong word — cap at 0.5 so rule tags stay suggestions.
  const confidence = Math.min(0.5, 0.2 + best.score * 0.08);
  return { subject: best.subject, chapter: best.chapter, concept, confidence, source: 'rule' };
}

/* ------------------------------------------------------------------ */
/*  AI tagger — closed catalog, validated reply                        */
/* ------------------------------------------------------------------ */

const AI_TAG_TIMEOUT_MS = 20_000;

/**
 * One cheap-model call: the exam's own subject → chapters catalog is the
 * ONLY allowed answer space. The reply is validated: subject must be one of
 * the catalog subjects and chapter must belong to that subject's list —
 * anything else is snapped to the catalog or the whole tag is dropped to the
 * rule fallback. Never throws; resolves to null on any failure.
 */
export async function aiTagQuestion(
  text: string,
  catalog: CatalogSubject[],
  examLabel: string,
): Promise<AutoTagResult | null> {
  const source = String(text || '').trim();
  if (!source || catalog.length === 0) return null;
  try {
    const token = await waitForWorkspaceDbToken();
    if (!token) return null;
    const catalogLines = catalog
      .map((entry) => `${entry.subject}: ${entry.chapters.join(' | ')}`)
      .join('\n');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), AI_TAG_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-DB-Token': token },
        body: JSON.stringify({
          model: AI_MODELS.fast,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content: [
                `You classify one exam question for a ${examLabel} aspirant.`,
                'You are given the ONLY allowed subjects and chapters (one line per subject, chapters separated by " | ").',
                'Reply with STRICT JSON only — no prose, no markdown fences:',
                '{"subject": string, "chapter": string, "concept": string, "confidence": number}',
                'RULES:',
                '- "subject" MUST be copied verbatim from the allowed list. Never invent one.',
                '- "chapter" MUST be copied verbatim from that subject\'s own chapter list. Never invent one. Use "" if none fits.',
                '- "concept" is the specific concept tested (free text, e.g. "SN2 mechanism — stereochemistry").',
                '- "confidence" is 0 to 1: how sure you are that subject AND chapter are right. Be honest — a partial or ambiguous question deserves a low number.',
                '- If the question fits none of the subjects, use {"subject": "", "chapter": "", "concept": "", "confidence": 0}.',
              ].join('\n'),
            },
            {
              role: 'user',
              content: `ALLOWED SUBJECTS AND CHAPTERS:\n${catalogLines}\n\nQUESTION:\n${source.slice(0, 2200)}`,
            },
          ],
          max_completion_tokens: 220,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const parsed = extractJsonObject(String(data.choices?.[0]?.message?.content || ''));
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    const rawSubject = typeof record.subject === 'string' ? record.subject : '';
    const rawChapter = typeof record.chapter === 'string' ? record.chapter : '';
    const concept = typeof record.concept === 'string' ? (record.concept.replace(/\s+/g, ' ') ?? '').trim().slice(0, 90) : '';
    let confidence = clamp01(Number(record.confidence));

    // VALIDATION — the catalog is the law. An answer outside it is snapped
    // back in (case-insensitive) or rejected, never stored as-is.
    const subject = snapToList(rawSubject, catalog.map((entry) => entry.subject));
    if (!subject) return null;
    const entry = catalog.find((e) => e.subject === subject) as CatalogSubject;
    let chapter = snapToList(rawChapter, entry.chapters) ?? '';
    // A subject with an invented chapter: keep the subject, drop the chapter,
    // and cap the confidence — half the tag was outside the catalog.
    if (!chapter && (rawChapter ?? '').trim()) confidence = Math.min(confidence, 0.5);
    return { subject, chapter, concept, confidence, source: 'ai' };
  } catch {
    return null;
  }
}

/**
 * THE tagging entry point every capture path uses: AI first (when available),
 * the deterministic catalog matcher as fallback — and 'General' at
 * confidence 0 when neither can place the question. NEVER "the first subject
 * in the list": that was the bug that filed organic chemistry under Physics.
 */
export async function autoTagQuestion(
  text: string,
  catalog: CatalogSubject[],
  examLabel: string,
  canAskAi: boolean,
): Promise<AutoTagResult> {
  if (canAskAi) {
    const ai = await aiTagQuestion(text, catalog, examLabel);
    if (ai && ai.confidence > 0) return ai;
  }
  return ruleTagQuestion(text, catalog);
}

/* ------------------------------------------------------------------ */
/*  Correction logging                                                 */
/* ------------------------------------------------------------------ */

/**
 * Log a one-tap tag correction durably (zuno_meta, key `tagfix|<rowId>|<ts>`
 * so every correction is kept, never overwritten). Fire-and-forget: logging
 * must never block or fail the correction itself.
 */
export function logTagCorrection(
  rowId: number,
  from: { subject: string; topic: string | null },
  to: { subject: string; topic: string | null },
  today: string,
): void {
  void verifiedDbFrom(TABLES.meta)
    .insert({
      meta_key: `tagfix|${rowId}|${Date.now()}`,
      meta_value: JSON.stringify({ from, to, on: today }),
    })
    .catch(() => undefined);
}
