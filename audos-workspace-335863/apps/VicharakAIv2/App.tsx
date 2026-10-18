/**
 * VicharakAI v2 — composition root. Everything lives in focused modules:
 *
 *   data/       IndexedDB schema + typed stores (offline source of truth)
 *   registry/   exam-registry + syllabus.md bundles + parser (exam-agnostic)
 *   engine/     fsrs · scheduler (1/3/7/14) · conceptMatcher (BM25) · pace ·
 *               backlog · testSignal · whyWrong
 *   workers/    imageSanitize (EXIF strip) · ocrWorker (Tesseract, off-thread)
 *   components/ shared · onboarding · today · mistakes · progress · settings
 *   notifications/ + pwa/  opt-in triggers, install, offline bootstrap
 *
 * This file only wires the provider and shell together.
 */
import React from 'react';
import { AppProvider } from './state/AppContext';
import AppShell from './AppShell';

export default function VicharakAIv2() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
