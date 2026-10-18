/**
 * Onboarding step 3: pick the exam and load its syllabus bundle (Light tier
 * for v1). Reuses the shared SyllabusPicker — the same component Settings
 * uses. Also captures an optional exam date for the pace signal.
 */
import React, { useState } from 'react';
import type { ExamRegistryEntry } from '../../data/types';
import SyllabusPicker from '../shared/SyllabusPicker';
import type { InstalledBundleMeta } from '../../registry/bundleLoader';
import { Button, Field, inputStyle } from '../../ui/primitives';
import { TEXT_MUTED } from '../../ui/tokens';

export default function ExamSelectStep(props: {
  onDone: (examId: string, examDate: string | null) => void;
}) {
  const [loaded, setLoaded] = useState<{ entry: ExamRegistryEntry; meta: InstalledBundleMeta } | null>(null);
  const [examDate, setExamDate] = useState('');

  return (
    <div>
      <SyllabusPicker
        selectedExamId={loaded?.entry.exam_id ?? null}
        onLoaded={(entry, meta) => setLoaded({ entry, meta })}
      />
      {loaded ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '0 0 12px' }}>
            Loaded {loaded.meta.concept_count} concepts across {loaded.meta.chapter_count} chapters
            ({loaded.meta.tier} tier).
          </p>
          <Field label="Exam date (optional — powers the pace signal)">
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              style={inputStyle}
              data-testid="input-exam-date"
            />
          </Field>
          <Button
            full
            onClick={() => props.onDone(loaded.entry.exam_id, examDate || null)}
            testId="button-exam-done"
          >
            Start studying
          </Button>
        </div>
      ) : null}
    </div>
  );
}
