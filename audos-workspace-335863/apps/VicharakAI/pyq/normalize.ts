/**
 * PYQ text normalization + duplicate-similarity scoring.
 * Pure functions, no external library, no data access.
 */

export function normalizeQuestionText(text: string): string {
  return (text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"') ?? '')
    .trim();
}

// Jaccard similarity on word trigrams — no external library.
export function similarityScore(a: string, b: string): number {
  const trigrams = (s: string): Set<string> => {
    const words = s.split(' ');
    const tg = new Set<string>();
    for (let i = 0; i <= words.length - 3; i++) {
      tg.add(words.slice(i, i + 3).join(' '));
    }
    if (tg.size === 0) {
      // fallback to bigrams if too short
      for (let i = 0; i <= words.length - 2; i++) {
        tg.add(words.slice(i, i + 2).join(' '));
      }
    }
    return tg;
  };
  const na = trigrams(normalizeQuestionText(a));
  const nb = trigrams(normalizeQuestionText(b));
  if (na.size === 0 && nb.size === 0) return 1;
  let intersection = 0;
  na.forEach((t) => {
    if (nb.has(t)) intersection++;
  });
  return intersection / (na.size + nb.size - intersection);
}
// >= 0.85: likely duplicate | >= 0.70: flag for review

/** Similarity at/above this = treated as a duplicate (insert is skipped). */
export const DUPLICATE_SKIP_THRESHOLD = 0.85;
/** Similarity at/above this (but below skip) = inserted AND flagged for review. */
export const DUPLICATE_REVIEW_THRESHOLD = 0.7;
