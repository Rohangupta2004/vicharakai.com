/**
 * Concept tag resolver (§10, §3.3): autocomplete picker constrained to the
 * current exam's closed concept enum. One of the app's exactly-two allowed
 * popups (§15). No free-text creation — the student can only pick from the
 * enum; AI/BM25 suggestions are surfaced first for confirm-or-correct.
 */
import React, { useMemo, useState } from 'react';
import type { Concept } from '../../data/types';
import { Button } from '../../ui/primitives';
import { ACCENT, BORDER, CARD, CARD_STRONG, RADIUS, TEXT, TEXT_MUTED, TEXT_SECONDARY, TOUCH } from '../../ui/tokens';
import { inputStyle } from '../../ui/primitives';

export default function ConceptTagResolver(props: {
  title: string;
  concepts: Concept[];
  /** concept_ids to surface at the top (e.g. BM25 suggestions), best first. */
  suggestedIds?: string[];
  onPick: (concept: Concept) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const suggested = (props.suggestedIds ?? [])
      .map((id) => props.concepts.find((c) => c.concept_id === id))
      .filter((c): c is Concept => !!c);
    if (!q) {
      const rest = props.concepts.filter((c) => !suggested.includes(c));
      return [...suggested, ...rest].slice(0, 30);
    }
    return props.concepts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.chapter.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [query, props.concepts, props.suggestedIds]);

  return (
    <div
      role="dialog"
      aria-label={props.title}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: CARD, borderTop: `1px solid ${BORDER}`, borderRadius: '20px 20px 0 0', padding: 16, boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT }}>{props.title}</p>
          <Button variant="ghost" onClick={props.onClose} testId="concept-picker-close">Close</Button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts…"
          style={{ ...inputStyle, marginBottom: 10 }}
          data-testid="concept-picker-search"
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.length === 0 ? (
            <p style={{ color: TEXT_MUTED, fontSize: 13, textAlign: 'center', padding: 20 }}>
              No concepts match — tags come only from the syllabus.
            </p>
          ) : (
            results.map((c) => {
              const suggested = (props.suggestedIds ?? []).includes(c.concept_id);
              return (
                <button
                  key={c.concept_id}
                  type="button"
                  onClick={() => props.onPick(c)}
                  data-testid={`concept-option-${c.concept_id}`}
                  style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: TOUCH, padding: '10px 12px', marginBottom: 6, borderRadius: RADIUS.control, border: `1px solid ${suggested ? ACCENT : BORDER}`, background: suggested ? CARD_STRONG : 'transparent', cursor: 'pointer' }}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: TEXT }}>
                    {c.name}
                    {suggested ? <span style={{ color: ACCENT, fontWeight: 800 }}> · suggested</span> : null}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: TEXT_SECONDARY }}>
                    {c.subject} → {c.chapter}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
