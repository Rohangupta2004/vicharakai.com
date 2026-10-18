/**
 * Concept strength heatmap (§16). The ONLY place colour beyond the blue
 * accent is allowed (§15): strength cells use semantic colours. Grouped by
 * subject → chapter, one cell per concept.
 */
import React from 'react';
import type { Concept, Doubt, TestLog } from '../../data/types';
import { conceptStrength, Strength } from '../../engine/testSignal';
import { STRENGTH_COLORS, TEXT, TEXT_MUTED } from '../../ui/tokens';

const LEGEND: Array<{ key: Strength; label: string }> = [
  { key: 'strong', label: 'Strong' },
  { key: 'medium', label: 'Okay' },
  { key: 'weak', label: 'Weak' },
  { key: 'untested', label: 'No data' },
];

export default function ConceptHeatmap(props: { concepts: Concept[]; doubts: Doubt[]; tests: TestLog[] }) {
  const bySubject = new Map<string, Concept[]>();
  for (const c of props.concepts) {
    const list = bySubject.get(c.subject) ?? [];
    list.push(c);
    bySubject.set(c.subject, list);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {LEGEND.map((l) => (
          <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: TEXT_MUTED }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: STRENGTH_COLORS[l.key], display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      {Array.from(bySubject.entries()).map(([subject, concepts]) => (
        <div key={subject} style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: TEXT }}>{subject}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6 }}>
            {concepts.map((c) => {
              const strength = conceptStrength(c.concept_id, props.doubts, props.tests);
              return (
                <div
                  key={c.concept_id}
                  title={`${c.name} — ${strength}`}
                  data-testid={`heat-${c.concept_id}`}
                  style={{ height: 44, borderRadius: 8, background: STRENGTH_COLORS[strength], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: strength === 'untested' ? TEXT_MUTED : '#08101f', padding: 2, textAlign: 'center', overflow: 'hidden' }}
                >
                  {c.name.slice(0, 14)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
