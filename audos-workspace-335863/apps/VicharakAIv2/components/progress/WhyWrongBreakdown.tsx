/**
 * Why-wrong breakdown (§6): how the student's errors distribute across the
 * 7 categories, plus any active paired-tag remedies. Monochrome bars —
 * colour stays reserved for concept strength (§15).
 */
import React from 'react';
import type { Doubt } from '../../data/types';
import { whyWrongCounts, diagnosePairs } from '../../engine/whyWrong';
import BWBanner from '../shared/BWBanner';
import { ACCENT, MUTED_SURFACE, TEXT, TEXT_MUTED } from '../../ui/tokens';

export default function WhyWrongBreakdown(props: { doubts: Doubt[] }) {
  const counts = whyWrongCounts(props.doubts);
  const max = Math.max(1, ...counts.map((c) => c.count));
  const total = counts.reduce((s, c) => s + c.count, 0);
  const remedies = diagnosePairs(props.doubts);

  if (total === 0) {
    return (
      <p style={{ fontSize: 13, color: TEXT_MUTED }}>
        Tag why answers went wrong after review sessions and the pattern shows up here.
      </p>
    );
  }

  return (
    <div>
      {counts
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(({ category, count }) => (
          <div key={category.tag} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT, marginBottom: 3 }}>
              <span style={{ fontWeight: 700 }}>{category.label}</span>
              <span style={{ color: TEXT_MUTED }}>{count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: MUTED_SURFACE, overflow: 'hidden' }}>
              <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: ACCENT }} />
            </div>
          </div>
        ))}
      {remedies.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {remedies.map((r) => (
            <BWBanner key={r} text={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
