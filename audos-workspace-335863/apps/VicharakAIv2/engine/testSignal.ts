/**
 * Test loop (§ product thesis) + test wins (§8.1).
 * Logging a good score on a concept boosts FSRS stability on that concept's
 * doubt cards, pushing their reviews out automatically. Concept strength for
 * the Progress heatmap is also computed here.
 */
import type { Doubt, TestLog } from '../data/types';
import { addTestLog } from '../data/testLogs';
import { listDoubts, updateDoubt } from '../data/doubts';
import { boost } from './fsrs';

const WIN_THRESHOLD_PCT = 75;
const WIN_BOOST_FACTOR = 1.5;

/** Log a test score; on a win, push out FSRS cards for that concept. */
export async function logTestScore(examId: string, conceptId: string, scorePct: number): Promise<TestLog> {
  const log = await addTestLog(examId, conceptId, scorePct);
  if (scorePct >= WIN_THRESHOLD_PCT) {
    const doubts = await listDoubts(examId);
    for (const d of doubts) {
      if (d.status !== 'active' || d.primary_concept_id !== conceptId) continue;
      const boosted = boost(
        {
          stability: d.fsrs_stability,
          difficulty: d.fsrs_difficulty,
          due_date: d.fsrs_due_date ?? log.taken_at.slice(0, 10),
          last_review: d.fsrs_last_review,
          review_count: d.review_count,
        },
        WIN_BOOST_FACTOR,
      );
      await updateDoubt({ ...d, fsrs_stability: boosted.stability, fsrs_due_date: boosted.due_date });
    }
  }
  return log;
}

/* ---- Concept strength (Progress heatmap) ---- */

export type Strength = 'strong' | 'medium' | 'weak' | 'untested';

/**
 * Strength per concept: recent test scores (weighted 2×) + review outcomes.
 * More unresolved doubts on a concept → weaker.
 */
export function conceptStrength(conceptId: string, doubts: Doubt[], tests: TestLog[]): Strength {
  const myTests = tests.filter((t) => t.concept_id === conceptId);
  const myDoubts = doubts.filter(
    (d) => d.primary_concept_id === conceptId || d.secondary_concept_id === conceptId,
  );
  if (myTests.length === 0 && myDoubts.length === 0) return 'untested';

  const avgScore = myTests.length
    ? myTests.reduce((s, t) => s + t.score_pct, 0) / myTests.length
    : 50;
  const unresolved = myDoubts.filter((d) => d.review_count === 0).length;
  const reviewed = myDoubts.filter((d) => d.review_count > 0).length;

  const score = avgScore * 2 + reviewed * 5 - unresolved * 15;
  if (score >= 130) return 'strong';
  if (score >= 70) return 'medium';
  return 'weak';
}
