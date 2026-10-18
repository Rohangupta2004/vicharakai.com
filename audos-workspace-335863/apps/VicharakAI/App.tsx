/**
 * VicharakAI — application composition root.
 *
 * The app is assembled from focused modules; this file only composes them.
 * Where things live now:
 *
 *   app/AppProviders.tsx        — theme + StudentData providers
 *   app/AppShell.tsx            — gates, screens, overlays, navigation wiring
 *   app/StudentDataContext.tsx  — ONE place all data is loaded & derived
 *   config/                     — models, revision ladders, priority weights
 *   services/database/          — table registry, safe reads/writes, reset
 *   revisionEngine.ts           — THE spaced-revision scheduler
 *   studyEngine.ts              — THE student state + priority engine
 *   adaptationEngine.ts         — mastery/weakness/readiness calculations
 *   pyq/                        — the authentic PYQ bank (ingestion, retrieval, admin)
 *   contexts/VicharreeVisibilityContext.tsx — hides the Vicharree launcher on test screens
 *   features/<feature>/         — each feature's state, actions and screens
 *     tasks · revision(engine) · mastery · tests · doubts · syllabus ·
 *     dashboard · today · coach · onboarding · access · notifications ·
 *     profile · plan
 *
 * To change a feature, open its folder — nothing needs edits here.
 *
 * PWA metadata is infrastructure-only and is installed from this composition
 * root.
 */
// Runtime shims for the ES2022 built-ins this app and its CDN dependencies
// call unguarded (Array/String.prototype.at, Object.hasOwn, findLast…). Must
// load AHEAD of everything else so a `.at()` reaching a pre-2021 mobile browser
// is polyfilled instead of throwing "… .at is not a function".
import '../../lib/browserCompat';
import { useEffect } from 'react';
import { installAppIconMetadata } from './shared/appIcon';
import AppProviders from './app/AppProviders';
import AppShell from './app/AppShell';
import { VicharreeVisibilityProvider } from './contexts/VicharreeVisibilityContext';

export default function VicharakAI() {
  /* Point the tab icon, iOS home-screen icon and manifest at VicharakAI. */
  useEffect(() => {
    installAppIconMetadata();
  }, []);

  return (
    <VicharreeVisibilityProvider>
      <AppProviders>
        <AppShell />
      </AppProviders>
    </VicharreeVisibilityProvider>
  );
}
