/**
 * Weekly Targets — the compact goals card under Today's Mission.
 *
 * A week runs Monday→Sunday. The student sets two numbers (topics to complete,
 * tests to take); progress fills automatically from completed tasks and
 * submitted Test Mode results. On Sunday the card flips to its summary voice,
 * and a new week without targets shows the set-goals prompt (plus how last
 * week ended, so a missed week never disappears silently).
 */

import { useState } from 'react';
import { Loader2, Pencil, Target, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';
import { Card } from './ui';
import { addDaysISO, diffDays } from './engine';
import type { WeeklyTargetRow } from './mcq';

/* ------------------------------------------------------------------ */
/*  Week helpers                                                       */
/* ------------------------------------------------------------------ */

/** ISO date of the Monday of the week containing `iso`. */
export function weekStartISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay(); // 0 = Sunday
  const back = day === 0 ? 6 : day - 1;
  return addDaysISO(iso, -back);
}

export function isSundayISO(iso: string): boolean {
  return new Date(`${iso}T12:00:00`).getDay() === 0;
}

/** True when `iso` falls inside the week starting on `weekStart` (Mon→Sun). */
export function inWeek(iso: string, weekStart: string): boolean {
  const diff = diffDays(weekStart, iso);
  return diff >= 0 && diff <= 6;
}

function toCount(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/* ------------------------------------------------------------------ */
/*  Compact card — two progress bars, never a full section             */
/* ------------------------------------------------------------------ */

function GoalBar({ label, done, target, testId }: { label: string; done: number; target: number; testId: string }) {
  const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const hit = target > 0 && done >= target;
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>{label}</span>
        <span className="text-[11px] font-extrabold" style={{ color: hit ? SUCCESS : TEXT_MUTED }}>
          {done} / {target}{hit ? ' ✓' : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: hit ? SUCCESS : BRAND_GRADIENT, transition: 'width 0.5s ease-out' }} />
      </div>
    </div>
  );
}

export function WeeklyGoalsCard({
  row,
  topicsDone,
  testsDone,
  today,
  onEdit,
}: {
  /** This week's targets row, or null when not set yet. */
  row: WeeklyTargetRow | null;
  topicsDone: number;
  testsDone: number;
  today: string;
  onEdit: () => void;
}) {
  const sunday = isSundayISO(today);

  if (!row) {
    return (
      <Card radius={RADIUS.lg} className="mt-6 px-4 py-3.5 vicharak-fade" testId="card-weekly-goals-empty">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Target className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Set this week's goals</p>
            <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>Topics to finish + tests to take — two numbers, that's it.</p>
          </div>
          <button type="button" onClick={onEdit} className="px-3 py-1.5 text-[11px] font-extrabold flex-shrink-0 touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-set-weekly-goals">
            Set goals
          </button>
        </div>
      </Card>
    );
  }

  const topicTarget = toCount(row.topic_target);
  const testTarget = toCount(row.test_target);
  const topicsHit = topicsDone >= topicTarget;
  const testsHit = testsDone >= testTarget;
  const allHit = topicsHit && testsHit;
  const missedTopics = Math.max(0, topicTarget - topicsDone);

  return (
    <Card radius={RADIUS.lg} className="mt-6 px-4 py-3.5 vicharak-fade" testId="card-weekly-goals">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
          <Target className="w-3.5 h-3.5" style={{ color: AMBER }} />
          Weekly goals
        </p>
        <button type="button" onClick={onEdit} aria-label="Edit weekly goals" className="w-7 h-7 rounded-full flex items-center justify-center touch-manipulation" style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }} data-testid="button-edit-weekly-goals">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      <div className="mt-2.5 space-y-2.5">
        <GoalBar label="Topics this week" done={topicsDone} target={topicTarget} testId="bar-weekly-topics" />
        <GoalBar label="Tests this week" done={testsDone} target={testTarget} testId="bar-weekly-tests" />
      </div>
      {sunday && (
        <p className="mt-2.5 text-[11px] leading-snug" style={{ color: allHit ? SUCCESS : TEXT_SECONDARY }} data-testid="text-weekly-summary">
          {allHit
            ? `You completed ${topicsDone}/${topicTarget} topics and ${testsDone}/${testTarget} tests this week. Well done! 🎉`
            : `Week wraps today — ${missedTopics > 0 ? `${missedTopics} topic${missedTopics === 1 ? '' : 's'} still open (they carry to next week)` : 'topics are done'}${testsDone < testTarget ? `, ${testTarget - testsDone} test${testTarget - testsDone === 1 ? '' : 's'} to go` : ''}.`}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Set-targets sheet                                                  */
/* ------------------------------------------------------------------ */

const TOPIC_CHOICES = [3, 5, 7, 10];
const TEST_CHOICES = [1, 2, 3, 5];

export function WeeklyTargetSheet({
  initialTopicTarget,
  initialTestTarget,
  lastWeekLine,
  saving,
  onSave,
  onClose,
}: {
  initialTopicTarget: number;
  initialTestTarget: number;
  /** How last week ended — shown once when a new week opens without targets. */
  lastWeekLine: string | null;
  saving: boolean;
  onSave: (topicTarget: number, testTarget: number) => void;
  onClose: () => void;
}) {
  const [topicTarget, setTopicTarget] = useState(initialTopicTarget);
  const [testTarget, setTestTarget] = useState(initialTestTarget);

  const pill = (active: boolean) =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Weekly goals">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close weekly goals" />
      <div className="relative max-h-[80vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet" style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}>
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Target className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>This week's goals</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>Monday to Sunday. Progress fills in by itself.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {lastWeekLine && (
          <p className="mt-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-last-week-summary">
            {lastWeekLine}
          </p>
        )}

        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Topics to complete</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TOPIC_CHOICES.map((n) => (
            <button key={n} type="button" onClick={() => setTopicTarget(n)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(topicTarget === n)} data-testid={`weekly-topics-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Tests to take</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TEST_CHOICES.map((n) => (
            <button key={n} type="button" onClick={() => setTestTarget(n)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(testTarget === n)} data-testid={`weekly-tests-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(topicTarget, testTarget)}
          className="mt-6 w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-save-weekly-goals"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : `Lock in: ${topicTarget} topics · ${testTarget} test${testTarget === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
