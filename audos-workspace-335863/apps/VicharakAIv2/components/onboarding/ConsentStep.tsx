/**
 * Onboarding step 2 (§17 — DPDP): minimum-necessary consent, logged with
 * version. Product-development consent is a SEPARATE, optional checkbox —
 * never bundled with the required processing consent (§5).
 */
import React, { useState } from 'react';
import { Button, CheckRow } from '../../ui/primitives';
import { TEXT_MUTED } from '../../ui/tokens';
import { logConsent, CONSENT_VERSION } from '../../data/consent';

export default function ConsentStep(props: { onNext: () => void }) {
  const [basic, setBasic] = useState(false);
  const [productDev, setProductDev] = useState(false);
  const [saving, setSaving] = useState(false);

  const next = async () => {
    setSaving(true);
    await logConsent('dpdp_basic', true);
    await logConsent('product_development', productDev);
    props.onNext();
  };

  return (
    <div>
      <CheckRow checked={basic} onChange={setBasic} testId="check-consent-basic">
        I agree to my study data (tasks, test scores, and photos of my own work)
        being stored on this device so the app can plan my revision. Required to
        use the app.
      </CheckRow>
      <CheckRow checked={productDev} onChange={setProductDev} testId="check-consent-product">
        Optional: anonymised usage patterns may be used to improve the product.
        Uploading and studying work fully without this.
      </CheckRow>
      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '8px 0 16px' }}>
        Consent version {CONSENT_VERSION} — logged with your choice. You can
        review or change this any time in Settings.
      </p>
      <Button full disabled={!basic || saving} onClick={() => void next()} testId="button-consent-next">
        Continue
      </Button>
    </div>
  );
}
