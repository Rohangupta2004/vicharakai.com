/**
 * After-OCR tagging (§5): concept suggestion (BM25 + triggers) → student
 * confirms or corrects via the enum-constrained resolver → difficulty →
 * optional answer → save activates the FSRS card. Primary tag is required
 * before saving (§3.2); the answer field is optional.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { Concept, Difficulty, Doubt } from '../../data/types';
import { getImage } from '../../data/images';
import { activateDoubt, deleteDoubt, getDoubt } from '../../data/doubts';
import { buildIndex, suggestConcepts } from '../../engine/conceptMatcher';
import { initialCard, seedGradeForDifficulty } from '../../engine/fsrs';
import ConceptTagResolver from '../shared/ConceptTagResolver';
import { Button, Field, inputStyle } from '../../ui/primitives';
import { ACCENT, BORDER, RADIUS, TEXT, TEXT_MUTED, TOUCH } from '../../ui/tokens';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export default function TagDoubtView(props: {
  doubtId: string;
  concepts: Concept[];
  onDone: () => void;
}) {
  const [doubt, setDoubt] = useState<Doubt | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [primary, setPrimary] = useState<Concept | null>(null);
  const [secondary, setSecondary] = useState<Concept | null>(null);
  const [picker, setPicker] = useState<'primary' | 'secondary' | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const d = await getDoubt(props.doubtId);
      if (!d) return props.onDone();
      setDoubt(d);
      if (d.image_id) {
        const img = await getImage(d.image_id);
        if (img) {
          url = URL.createObjectURL(img.blob);
          setImageUrl(url);
        }
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [props.doubtId]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => {
    if (!doubt || !doubt.ocr_text) return [];
    return suggestConcepts(buildIndex(props.concepts), doubt.ocr_text, 5).map((s) => s.concept_id);
  }, [doubt, props.concepts]);

  const save = async () => {
    if (!doubt || !primary) return;
    setSaving(true);
    const card = initialCard(seedGradeForDifficulty(difficulty));
    await activateDoubt(doubt.doubt_id, {
      primary_concept_id: primary.concept_id,
      secondary_concept_id: secondary?.concept_id ?? null,
      difficulty,
      answer_text: answer.trim() || null,
      fsrs_due_date: card.due_date,
      fsrs_stability: card.stability,
      fsrs_difficulty: card.difficulty,
    });
    props.onDone();
  };

  if (!doubt) return null;

  const tagButton = (label: string, value: Concept | null, slot: 'primary' | 'secondary') => (
    <button
      type="button"
      onClick={() => setPicker(slot)}
      data-testid={`button-tag-${slot}`}
      style={{ width: '100%', minHeight: TOUCH, padding: '10px 12px', textAlign: 'left', borderRadius: RADIUS.control, border: `1px solid ${value ? ACCENT : BORDER}`, background: 'transparent', color: value ? TEXT : TEXT_MUTED, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
    >
      {value ? value.name : label}
    </button>
  );

  return (
    <div>
      {imageUrl ? (
        <img src={imageUrl} alt="Your question" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 12, marginBottom: 12, background: '#000' }} />
      ) : null}
      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 12px' }}>
        {doubt.ocr_status === 'pending' && 'Reading text… you can tag without waiting.'}
        {doubt.ocr_status === 'failed' && 'Text could not be read — pick the concept manually.'}
        {doubt.ocr_status === 'done' && (doubt.ocr_text ? `“${doubt.ocr_text.slice(0, 140)}…”` : 'No text found in the photo.')}
      </p>

      <Field label="Concept (required)">{tagButton('Pick the concept…', primary, 'primary')}</Field>
      <Field label="Secondary concept (optional)">{tagButton('Add a second concept…', secondary, 'secondary')}</Field>

      <Field label="How hard was it?">
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)} data-testid={`difficulty-${d}`} style={{ flex: 1, minHeight: TOUCH, borderRadius: RADIUS.control, border: `1px solid ${difficulty === d ? ACCENT : BORDER}`, background: 'transparent', color: difficulty === d ? ACCENT : TEXT_MUTED, fontWeight: 800, textTransform: 'capitalize', cursor: 'pointer' }}>
              {d}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Correct answer (optional — add it later if you like)">
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} data-testid="input-answer" />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <Button full variant="danger" onClick={() => void deleteDoubt(doubt.doubt_id).then(props.onDone)} testId="button-delete-doubt">Delete</Button>
        </div>
        <div style={{ flex: 2 }}>
          <Button full disabled={!primary || saving} onClick={() => void save()} testId="button-save-doubt">Save mistake</Button>
        </div>
      </div>

      {picker ? (
        <ConceptTagResolver
          title={picker === 'primary' ? 'Pick the concept' : 'Secondary concept'}
          concepts={props.concepts}
          suggestedIds={suggestions}
          onPick={(c) => {
            if (picker === 'primary') setPrimary(c);
            else setSecondary(c);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
