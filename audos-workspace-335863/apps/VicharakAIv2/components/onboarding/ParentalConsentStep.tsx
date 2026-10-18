/**
 * Parental consent (§17): shown only when birth year says under 18.
 * The student cannot proceed until a parent/guardian confirms.
 */
import React, { useState } from 'react';
import { Button, CheckRow, Field, inputStyle } from '../../ui/primitives';
import { TEXT_MUTED } from '../../ui/tokens';
import { logConsent } from '../../data/consent';

export default function ParentalConsentStep(props: { onConfirmed: () => void }) {
  const [parentName, setParentName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const canProceed = confirmed && parentName.trim().length >= 2;

  const next = async () => {
    setSaving(true);
    await logConsent('parental', true);
    props.onConfirmed();
  };

  return (
    <div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: TEXT_MUTED, marginTop: 0 }}>
        Because you're under 18, a parent or guardian must approve before you can
        use the app. Please hand the device to them for this step.
      </p>
      <Field label="Parent / guardian name">
        <input
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          placeholder="Full name"
          style={inputStyle}
          data-testid="input-parent-name"
        />
      </Field>
      <CheckRow checked={confirmed} onChange={setConfirmed} testId="check-parental-consent">
        I am this student's parent or guardian and I consent to their study data
        (tasks, scores, photos of their own work) being stored on this device
        for exam preparation.
      </CheckRow>
      <Button full disabled={!canProceed || saving} onClick={() => void next()} testId="button-parental-next">
        Confirm and continue
      </Button>
    </div>
  );
}
