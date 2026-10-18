/**
 * Why-wrong bulk tagging grid (§6): shown after a review session. Tags
 * multiple cards at once against the 7 error categories. One of the app's
 * exactly-two allowed popups (§15). Surfaces paired-tag remedies on save.
 */
import React, { useState } from 'react';
import type { Doubt, WhyWrongTag } from '../../data/types';
import { WHY_WRONG_CATEGORIES, diagnosePairs } from '../../engine/whyWrong';
import { setWhyWrong, listDoubts } from '../../data/doubts';
import { Button } from '../../ui/primitives';
import BWBanner from '../shared/BWBanner';
import { ACCENT, BORDER, CARD, CARD_STRONG, RADIUS, TEXT, TEXT_MUTED, TOUCH } from '../../ui/tokens';

export default function WhyWrongGrid(props: {
  examId: string;
  /** The cards reviewed this session, in review order. */
  doubts: Doubt[];
  conceptName: (conceptId: string | null) => string;
  onClose: () => void;
}) {
  const [tags, setTags] = useState<Record<string, WhyWrongTag>>({});
  const [remedies, setRemedies] = useState<string[] | null>(null);

  const save = async () => {
    for (const [doubtId, tag] of Object.entries(tags)) await setWhyWrong(doubtId, tag);
    const all = await listDoubts(props.examId);
    setRemedies(diagnosePairs(all));
  };

  return (
    <div role="dialog" aria-label="Why did these go wrong?" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', background: CARD, borderTop: `1px solid ${BORDER}`, borderRadius: '20px 20px 0 0', padding: 16, boxSizing: 'border-box' }}>
        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: TEXT }}>Why did these go wrong?</p>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: TEXT_MUTED }}>
          Tap a reason for each card — patterns across reasons unlock targeted advice.
        </p>

        {remedies === null ? (
          <>
            {props.doubts.map((d) => (
              <div key={d.doubt_id} style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: TEXT }}>
                  {props.conceptName(d.primary_concept_id)}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {WHY_WRONG_CATEGORIES.map((c) => {
                    const active = tags[d.doubt_id] === c.tag;
                    return (
                      <button
                        key={c.tag}
                        type="button"
                        onClick={() => setTags((prev) => ({ ...prev, [d.doubt_id]: c.tag }))}
                        data-testid={`whywrong-${d.doubt_id}-${c.tag}`}
                        style={{ minHeight: TOUCH, borderRadius: RADIUS.control, border: `1px solid ${active ? ACCENT : BORDER}`, background: active ? CARD_STRONG : 'transparent', color: active ? ACCENT : TEXT_MUTED, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}
                      >
                        {c.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Button full variant="ghost" onClick={props.onClose}>Skip</Button>
              </div>
              <div style={{ flex: 2 }}>
                <Button full disabled={Object.keys(tags).length === 0} onClick={() => void save()} testId="button-whywrong-save">
                  Save reasons
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {remedies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {remedies.map((r) => (
                  <BWBanner key={r} text={r} />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: TEXT_MUTED }}>Saved. Keep tagging — patterns show up after a few sessions.</p>
            )}
            <Button full onClick={props.onClose} testId="button-whywrong-close">Done</Button>
          </>
        )}
      </div>
    </div>
  );
}
