/**
 * Onboarding state machine (§11 step 3): birth year → consent (with the
 * under-18 parental branch) → exam select + bundle load. Signup itself is
 * handled by the platform email gate before the app ever mounts.
 * Notifications are NOT requested here — opt-in only, after onboarding (§9).
 */
import React, { useState } from 'react';
import BWBanner from '../shared/BWBanner';
import BirthYearStep from './BirthYearStep';
import ConsentStep from './ConsentStep';
import ParentalConsentStep from './ParentalConsentStep';
import ExamSelectStep from './ExamSelectStep';
import { saveProfile } from '../../data/kv';
import { nowIso } from '../../lib/dates';
import { PAGE, TEXT, TEXT_MUTED, FONT } from '../../ui/tokens';

type Step = 'birth_year' | 'parental' | 'consent' | 'exam';

const STEP_TITLES: Record<Step, [string, string]> = {
  birth_year: ['Step 1 of 3', 'About you'],
  parental: ['Step 1b of 3', 'Parental consent'],
  consent: ['Step 2 of 3', 'Your data, your call'],
  exam: ['Step 3 of 3', 'Pick your exam'],
};

export default function OnboardingFlow(props: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('birth_year');

  const [title, heading] = STEP_TITLES[step];

  return (
    <div style={{ minHeight: '100%', background: PAGE, fontFamily: FONT, padding: 20, boxSizing: 'border-box', maxWidth: 560, margin: '0 auto' }}>
      <BWBanner text={title} testId="banner-onboarding-step" />
      <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: '20px 0 4px' }}>{heading}</h1>
      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '0 0 20px' }}>
        Takes under a minute. Everything stays on this device.
      </p>

      {step === 'birth_year' && (
        <BirthYearStep
          onNext={async (birthYear, isMinor) => {
            await saveProfile({ birth_year: birthYear, is_minor: isMinor });
            setStep(isMinor ? 'parental' : 'consent');
          }}
        />
      )}
      {step === 'parental' && (
        <ParentalConsentStep
          onConfirmed={async () => {
            await saveProfile({ parental_consent_at: nowIso() });
            setStep('consent');
          }}
        />
      )}
      {step === 'consent' && <ConsentStep onNext={() => setStep('exam')} />}
      {step === 'exam' && (
        <ExamSelectStep
          onDone={async (examId, examDate) => {
            await saveProfile({
              exam_id: examId,
              exam_date: examDate,
              onboarding_complete: true,
              onboarding_completed_at: nowIso(),
            });
            props.onComplete();
          }}
        />
      )}
    </div>
  );
}
