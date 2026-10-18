/**
 * "Am I on track?" signal (§4) rendered as a strictly B&W banner (§15) —
 * level is conveyed by a monochrome glyph + words, never by colour.
 */
import React, { useEffect, useState } from 'react';
import BWBanner from '../shared/BWBanner';
import type { Profile } from '../../data/types';
import { computePaceSignal, remainingEstHoursForExam, PaceSignal as Signal } from '../../engine/pace';

const GLYPHS: Record<Signal['level'], string> = {
  green: '\u2713', // check
  amber: '\u25B3', // triangle
  red: '!',
  none: '\u2022',
};

export default function PaceSignal(props: { profile: Profile; refreshKey: number }) {
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const examId = props.profile.exam_id;
      if (!examId) return;
      const remaining = await remainingEstHoursForExam(examId);
      const s = await computePaceSignal({ examDate: props.profile.exam_date, remainingEstHours: remaining });
      if (!cancelled) setSignal(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.profile, props.refreshKey]);

  if (!signal) return null;
  return <BWBanner glyph={GLYPHS[signal.level]} text={signal.label} testId="banner-pace" />;
}
