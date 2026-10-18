/**
 * Why-wrong error taxonomy (§6): the 7 categories, display labels, and
 * paired-tag diagnostics with remedies.
 */
import type { WhyWrongTag, Doubt } from '../data/types';

export interface WhyWrongCategory {
  tag: WhyWrongTag;
  label: string;
  short: string;
}

export const WHY_WRONG_CATEGORIES: WhyWrongCategory[] = [
  { tag: 'silly_mistake', label: 'Silly mistake', short: 'Silly' },
  { tag: 'concept_gap', label: 'Concept gap', short: 'Concept' },
  { tag: 'formula_forgot', label: 'Formula forgot', short: 'Formula' },
  { tag: 'application_gap', label: 'Application gap', short: 'Apply' },
  { tag: 'time_pressure', label: 'Time pressure', short: 'Time' },
  { tag: 'misread_question', label: 'Misread question', short: 'Misread' },
  { tag: 'guessed', label: 'Guessed', short: 'Guessed' },
];

export function whyWrongLabel(tag: WhyWrongTag): string {
  return WHY_WRONG_CATEGORIES.find((c) => c.tag === tag)?.label ?? tag;
}

/* ---- Paired-tag diagnostics (§6) ---- */

interface PairedRemedy {
  pair: [WhyWrongTag, WhyWrongTag];
  remedy: string;
}

const PAIRED_REMEDIES: PairedRemedy[] = [
  {
    pair: ['concept_gap', 'formula_forgot'],
    remedy: 'Re-study the chapter basics before more practice — formulas won\u2019t stick without the concept underneath.',
  },
  {
    pair: ['time_pressure', 'silly_mistake'],
    remedy: 'Slow down on the first read: most of these marks are lost to rushing, not to knowledge.',
  },
  {
    pair: ['application_gap', 'concept_gap'],
    remedy: 'Work solved examples step-by-step before attempting fresh problems on these concepts.',
  },
  {
    pair: ['misread_question', 'time_pressure'],
    remedy: 'Underline what the question asks before solving — misreads under time pressure compound.',
  },
  {
    pair: ['guessed', 'concept_gap'],
    remedy: 'These topics need first-pass study, not revision — schedule them as study tasks.',
  },
];

/** Given recent tags, surface remedies for pairs that BOTH appear ≥ 2 times. */
export function diagnosePairs(doubts: Doubt[]): string[] {
  const counts = new Map<WhyWrongTag, number>();
  for (const d of doubts) {
    if (d.why_wrong_tag) counts.set(d.why_wrong_tag, (counts.get(d.why_wrong_tag) ?? 0) + 1);
  }
  return PAIRED_REMEDIES.filter(
    ({ pair }) => (counts.get(pair[0]) ?? 0) >= 2 && (counts.get(pair[1]) ?? 0) >= 2,
  ).map((p) => p.remedy);
}

/** Tag counts for the Progress breakdown. */
export function whyWrongCounts(doubts: Doubt[]): Array<{ category: WhyWrongCategory; count: number }> {
  return WHY_WRONG_CATEGORIES.map((category) => ({
    category,
    count: doubts.filter((d) => d.why_wrong_tag === category.tag).length,
  }));
}
