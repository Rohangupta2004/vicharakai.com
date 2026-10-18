/**
 * Test loop entry: log a per-concept test score. A good score (≥75%)
 * triggers the test-win boost — FSRS cards for that concept are pushed out
 * automatically (§8.1). Uses the enum-constrained resolver for the concept.
 */
import React, { useState } from 'react';
import type { Concept } from '../../data/types';
import { logTestScore } from '../../engine/testSignal';
import ConceptTagResolver from '../shared/ConceptTagResolver';
import { Button, Field, inputStyle } from '../../ui/primitives';
import { ACCENT, BORDER, RADIUS, TEXT, TEXT_MUTED, TOUCH } from '../../ui/tokens';

export default function TestLogForm(props: { examId: string; concepts: Concept[]; onLogged: () => void }) {
  const [concept, setConcept] = useState<Concept | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [score, setScore] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseInt(score, 10);
  const valid = concept && !Number.isNaN(parsed) && parsed >= 0 && parsed <= 100;

  const save = async () => {
    if (!concept || !valid) return;
    setSaving(true);
    await logTestScore(props.examId, concept.concept_id, parsed);
    setConcept(null);
    setScore('');
    setSaving(false);
    props.onLogged();
  };

  return (
    <div>
      <Field label="Concept tested">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          data-testid="button-test-concept"
          style={{ width: '100%', minHeight: TOUCH, padding: '10px 12px', textAlign: 'left', borderRadius: RADIUS.control, border: `1px solid ${concept ? ACCENT : BORDER}`, background: 'transparent', color: concept ? TEXT : TEXT_MUTED, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          {concept ? concept.name : 'Pick a concept…'}
        </button>
      </Field>
      <Field label="Score (%)">
        <input type="number" inputMode="numeric" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} style={inputStyle} data-testid="input-test-score" />
      </Field>
      <Button full disabled={!valid || saving} onClick={() => void save()} testId="button-test-save">
        Log score
      </Button>
      {pickerOpen ? (
        <ConceptTagResolver
          title="Concept tested"
          concepts={props.concepts}
          onPick={(c) => {
            setConcept(c);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
