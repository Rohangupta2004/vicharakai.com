/**
 * Onboarding step 1 (§17): year of birth. Under-18 auto-routes to the
 * parental consent flow — the routing decision is made HERE, once.
 */
import React, { useState } from 'react';
import { Button, Field, inputStyle } from '../../ui/primitives';
import { TEXT_MUTED } from '../../ui/tokens';

export default function BirthYearStep(props: {
  onNext: (birthYear: number, isMinor: boolean) => void;
}) {
  const [year, setYear] = useState('');
  const currentYear = new Date().getFullYear();
  const parsed = parseInt(year, 10);
  const valid = !Number.isNaN(parsed) && parsed >= currentYear - 100 && parsed <= currentYear - 5;

  return (
    <div>
      <Field label="Year of birth">
        <input
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder={`${currentYear - 17}`}
          style={inputStyle}
          data-testid="input-birth-year"
        />
      </Field>
      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 16px', lineHeight: 1.5 }}>
        We ask only the year — nothing else — to route students under 18 through
        parental consent, as required by law. It is stored on this device.
      </p>
      <Button
        full
        disabled={!valid}
        onClick={() => props.onNext(parsed, currentYear - parsed < 18)}
        testId="button-birth-year-next"
      >
        Continue
      </Button>
    </div>
  );
}
