/**
 * Concept matching (§3.1, §5): OCR text → ranked concept suggestions.
 * BM25 over concept name + triggers + chapter, plus an exact trigger-phrase
 * bonus. Pure and synchronous — build the index once per exam, reuse it.
 * (Embedding similarity can be added later behind this same interface.)
 */
import type { Concept } from '../data/types';

const K1 = 1.5;
const B = 0.75;

export interface ConceptSuggestion {
  concept_id: string;
  score: number;
}

interface IndexedDoc {
  concept_id: string;
  tf: Map<string, number>;
  length: number;
  triggerPhrases: string[];
}

export interface MatcherIndex {
  docs: IndexedDoc[];
  df: Map<string, number>;
  avgLength: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function buildIndex(concepts: Concept[]): MatcherIndex {
  const docs: IndexedDoc[] = concepts.map((c) => {
    const tokens = tokenize(`${c.name} ${c.chapter} ${c.triggers.join(' ')}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return {
      concept_id: c.concept_id,
      tf,
      length: tokens.length,
      triggerPhrases: c.triggers.map((t) => t.toLowerCase()),
    };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avgLength = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgLength };
}

/** Rank concepts for a blob of OCR text. Returns top `limit`, best first. */
export function suggestConcepts(index: MatcherIndex, ocrText: string, limit = 5): ConceptSuggestion[] {
  const queryTerms = Array.from(new Set(tokenize(ocrText)));
  if (queryTerms.length === 0) return [];
  const lowered = ocrText.toLowerCase();
  const n = index.docs.length;

  const scored = index.docs.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const f = doc.tf.get(term);
      if (!f) continue;
      const df = index.df.get(term) ?? 1;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / index.avgLength));
    }
    // Exact multi-word trigger phrase in the OCR text is a strong signal.
    for (const phrase of doc.triggerPhrases) {
      if (phrase.includes(' ') && lowered.includes(phrase)) score += 2.5;
    }
    return { concept_id: doc.concept_id, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
