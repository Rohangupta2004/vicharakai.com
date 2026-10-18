/**
 * One planned study task (§4): subject pill, chapter, estimated hours,
 * completion checkbox. On completion it asks (optionally) how long it took —
 * that observation feeds the self-correcting estimates (§12).
 */
import React, { useState } from 'react';
import type { StudyTask } from '../../data/types';
import { Card, Pill } from '../../ui/primitives';
import { ACCENT, BORDER, RADIUS, TEXT, TEXT_MUTED, TOUCH } from '../../ui/tokens';

const QUICK_MINUTES = [30, 60, 120] as const;

export default function TaskRow(props: {
  task: StudyTask;
  overdue?: boolean;
  onComplete: (minutes: number | null) => void;
}) {
  const [asking, setAsking] = useState(false);
  const { task } = props;

  if (asking) {
    return (
      <Card testId={`task-minutes-${task.task_id}`}>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: TEXT_MUTED }}>Roughly how long did it take?</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => props.onComplete(m)}
              style={{ minHeight: TOUCH, padding: '0 16px', borderRadius: RADIUS.control, border: `1px solid ${ACCENT}`, background: 'transparent', color: ACCENT, fontWeight: 700, cursor: 'pointer' }}
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => props.onComplete(null)}
            style={{ minHeight: TOUCH, padding: '0 16px', borderRadius: RADIUS.control, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_MUTED, cursor: 'pointer' }}
          >
            Skip
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card testId={`task-${task.task_id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          aria-label="Mark complete"
          onClick={() => setAsking(true)}
          data-testid={`task-check-${task.task_id}`}
          style={{ width: TOUCH, height: TOUCH, flexShrink: 0, borderRadius: '50%', border: `2px solid ${ACCENT}`, background: 'transparent', cursor: 'pointer' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill>{task.subject}</Pill>
            {props.overdue ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED }}>from {task.planned_for}</span>
            ) : null}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: TEXT }}>{task.chapter}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_MUTED }}>~{task.est_hours}h</p>
        </div>
      </div>
    </Card>
  );
}
