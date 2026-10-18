/**
 * Data & privacy (§17): review consent history, flip the (separate)
 * product-development consent, and see what is stored. All data is local;
 * images can be deleted per-mistake in the Mistake Book.
 */
import React, { useEffect, useState } from 'react';
import { listConsents, logConsent, currentConsent, CONSENT_VERSION } from '../../data/consent';
import type { ConsentRecord } from '../../data/types';
import { CheckRow } from '../../ui/primitives';
import { TEXT_MUTED, TEXT_SECONDARY } from '../../ui/tokens';

export default function DataPrivacy() {
  const [productDev, setProductDev] = useState(false);
  const [log, setLog] = useState<ConsentRecord[]>([]);

  const load = async () => {
    setProductDev(await currentConsent('product_development'));
    setLog(await listConsents());
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleProductDev = async (v: boolean) => {
    await logConsent('product_development', v);
    await load();
  };

  return (
    <div>
      <CheckRow checked={productDev} onChange={(v) => void toggleProductDev(v)} testId="check-product-dev">
        Allow anonymised usage patterns to improve the product. Separate from
        core functionality — the app works fully either way.
      </CheckRow>
      <p style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.6, margin: '8px 0' }}>
        Everything you add — tasks, scores, photos — lives in this device's
        storage, not on a server. Photos are stripped of EXIF/location data
        before saving. Delete any mistake (and its photo) from the Mistake Book.
        Current consent version: {CONSENT_VERSION}.
      </p>
      <details>
        <summary style={{ fontSize: 13, fontWeight: 700, color: TEXT_SECONDARY, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
          Consent history ({log.length})
        </summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {log.map((c) => (
            <li key={c.consent_id} style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4 }}>
              {c.at.slice(0, 16).replace('T', ' ')} — {c.kind}: {c.granted ? 'granted' : 'declined'} (v{c.version})
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
