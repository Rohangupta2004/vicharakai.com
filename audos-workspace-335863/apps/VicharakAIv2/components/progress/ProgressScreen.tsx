/**
 * Progress tab (§16): concept strength heatmap, why-wrong breakdown, and
 * the test-score log that feeds test wins (§8.1).
 */
import React, { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { listDoubts } from '../../data/doubts';
import { listTestLogs } from '../../data/testLogs';
import type { Doubt, TestLog } from '../../data/types';
import ConceptHeatmap from './ConceptHeatmap';
import WhyWrongBreakdown from './WhyWrongBreakdown';
import TestLogForm from './TestLogForm';
import { SectionTitle } from '../../ui/primitives';
import { TEXT } from '../../ui/tokens';

export default function ProgressScreen() {
  const { profile, concepts, refreshKey, refresh } = useApp();
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [tests, setTests] = useState<TestLog[]>([]);

  const examId = profile?.exam_id ?? null;

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      const [d, t] = await Promise.all([listDoubts(examId), listTestLogs(examId)]);
      if (cancelled) return;
      setDoubts(d);
      setTests(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, refreshKey]);

  if (!examId) return null;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>Progress</h1>

      <SectionTitle>Concept strength</SectionTitle>
      <ConceptHeatmap concepts={concepts} doubts={doubts} tests={tests} />

      <SectionTitle>Why answers go wrong</SectionTitle>
      <WhyWrongBreakdown doubts={doubts} />

      <SectionTitle>Log a test score</SectionTitle>
      <TestLogForm examId={examId} concepts={concepts} onLogged={refresh} />
    </div>
  );
}
