/**
 * Syllabus picker (§10): exam selector with bundle-load indicator.
 * Used in onboarding and Settings. Reads ONLY the registry — it renders
 * whatever exams the registry lists, with zero exam-specific code.
 */
import React, { useState } from 'react';
import type { ExamRegistryEntry } from '../../data/types';
import { listExams, deriveTier } from '../../registry/examRegistry';
import { installBundle, InstalledBundleMeta } from '../../registry/bundleLoader';
import { Card, Pill } from '../../ui/primitives';
import { ACCENT, TEXT, TEXT_MUTED, TEXT_SECONDARY } from '../../ui/tokens';

type LoadState = { examId: string; phase: 'loading' } | { examId: string; phase: 'error'; message: string } | null;

export default function SyllabusPicker(props: {
  selectedExamId: string | null;
  onLoaded: (entry: ExamRegistryEntry, meta: InstalledBundleMeta) => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>(null);
  const exams = listExams();

  const pick = async (entry: ExamRegistryEntry) => {
    setLoadState({ examId: entry.exam_id, phase: 'loading' });
    try {
      const meta = await installBundle(entry);
      setLoadState(null);
      props.onLoaded(entry, meta);
    } catch (err) {
      setLoadState({ examId: entry.exam_id, phase: 'error', message: err instanceof Error ? err.message : 'Bundle failed to load' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {exams.map((exam) => {
        const selected = props.selectedExamId === exam.exam_id;
        const state = loadState && loadState.examId === exam.exam_id ? loadState : null;
        return (
          <Card key={exam.exam_id} onClick={() => void pick(exam)} testId={`exam-option-${exam.exam_id}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: selected ? ACCENT : TEXT }}>
                  {exam.display_name}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_MUTED }}>
                  {state?.phase === 'loading'
                    ? 'Loading syllabus bundle…'
                    : state?.phase === 'error'
                      ? state.message
                      : selected
                        ? 'Selected — tap to reload the bundle'
                        : 'Tap to load the syllabus'}
                </p>
              </div>
              <Pill color={TEXT_SECONDARY}>{deriveTier(exam) === 'full' ? 'Full' : 'Light'}</Pill>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
