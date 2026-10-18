/**
 * TimeMachinePanel — the hidden QA "Test Controls" panel (date override).
 *
 * Lets a tester simulate any date without waiting real days: trial expiry
 * (Day-4 paywall), spaced-revision triggers (1-3-5-7-14), the Day-7
 * personalisation milestone, exam countdown, streaks, pace and tomorrow's
 * schedule all follow the simulated date because every current-time read in
 * the app goes through getSystemDate()/getSystemNow() (see systemDate.ts).
 *
 * NOT a user feature. It is reachable only via:
 *  - the 🔧 Test Controls row on the Profile tab (QA account only),
 *  - 5 quick taps or a 3-second hold on the version line at the bottom of
 *    the Profile tab,
 *  - 5 quick taps on the VicharakAI logo on the paywall screen (so a tester
 *    locked out at the Day-4 gate can still travel back), and
 *  - tapping the amber "test date" badge whenever an override is active.
 *
 * Every change is persisted to localStorage and applied with a full reload so
 * ALL date-derived state (queries, memos, schedules) recomputes consistently.
 */
import { useState } from 'react';
import { CalendarClock, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react';
import {
  advanceDateOverrideDays,
  clearDateOverride,
  getSystemDate,
  isDateOverrideActive,
  setDateOverrideToDate,
} from './systemDate';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  tint,
} from './theme';

function toInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function TimeMachinePanel({ onClose }: { onClose: () => void }) {
  const overrideActive = isDateOverrideActive();
  const systemDate = getSystemDate();
  const [customDate, setCustomDate] = useState(() => toInputDate(systemDate));
  const [applying, setApplying] = useState(false);

  /* Persist the change, then reload so every date-derived computation —
   * access status, revision queues, streaks, countdowns — recomputes from
   * the simulated clock. The override survives the reload via localStorage. */
  const apply = (mutate: () => void) => {
    if (applying) return;
    setApplying(true);
    mutate();
    window.setTimeout(() => window.location.reload(), 250);
  };

  const jumpButton = (label: string, days: number) => (
    <button
      type="button"
      disabled={applying}
      onClick={() => apply(() => advanceDateOverrideDays(days))}
      className="flex-1 py-3 text-sm font-extrabold touch-manipulation disabled:opacity-60"
      style={{ borderRadius: RADIUS.md, background: BRAND_GRADIENT, color: ON_AMBER }}
      data-testid={`button-timemachine-plus-${days}`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[96] flex flex-col justify-end sm:justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Test Controls — date override"
      data-testid="panel-timemachine"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 vicharak-fade" style={{ background: OVERLAY_BG }} />
      <div
        className="relative w-full sm:max-w-[420px] max-h-[88vh] overflow-y-auto vicharak-sheet px-5 pt-4 pb-6"
        style={{
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          borderBottomLeftRadius: undefined,
          background: NAVY_ALT,
          borderTop: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-start justify-between">
          <span
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: RADIUS.md, background: tint(WARNING, 0.16), color: WARNING }}
            aria-hidden="true"
          >
            <CalendarClock className="w-5 h-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: BORDER, color: TEXT }}
            data-testid="button-timemachine-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="mt-3 text-xl font-extrabold leading-tight" style={{ color: TEXT }}>
          {'🔧'} Test Controls — Time Machine
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
          QA only. Simulate any date to test trial expiry, spaced revisions, streaks, the exam countdown and
          tomorrow's plan. The app reloads to apply each change.
        </p>

        {/* Current system date — the one truth the whole app runs on. */}
        <div
          className="mt-4 px-4 py-3"
          style={{
            borderRadius: RADIUS.md,
            background: overrideActive ? tint(WARNING, 0.1) : tint(TEXT_MUTED, 0.08),
            border: `1px solid ${overrideActive ? tint(WARNING, 0.4) : BORDER}`,
          }}
          data-testid="text-timemachine-system-date"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
            System date
          </p>
          <p className="mt-1 text-[15px] font-extrabold" style={{ color: overrideActive ? WARNING : TEXT }}>
            {systemDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="mt-0.5 text-[11px] font-bold" style={{ color: overrideActive ? WARNING : TEXT_MUTED }}>
            {overrideActive ? 'Override ACTIVE — the app is running on simulated time.' : 'Today (no override).'}
          </p>
        </div>

        {/* Quick jumps. */}
        <div className="mt-4 flex items-stretch gap-2">
          {jumpButton('+1 Day', 1)}
          {jumpButton('+7 Days', 7)}
          {jumpButton('+30 Days', 30)}
        </div>

        {/* Custom date. */}
        <div className="mt-3 flex items-stretch gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            aria-label="Custom override date"
            className="flex-1 min-w-0 px-3 py-2.5 text-sm font-bold"
            style={{ background: 'transparent', border: `1px solid ${BORDER_STRONG}`, borderRadius: RADIUS.md, color: TEXT, colorScheme: 'dark' }}
            data-testid="input-timemachine-date"
          />
          <button
            type="button"
            disabled={applying || !customDate}
            onClick={() => apply(() => setDateOverrideToDate(customDate))}
            className="px-4 py-2.5 text-sm font-extrabold inline-flex items-center gap-1.5 touch-manipulation disabled:opacity-60"
            style={{ borderRadius: RADIUS.md, border: `1px solid ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.1) }}
            data-testid="button-timemachine-jump"
          >
            Jump
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Reset. */}
        <button
          type="button"
          disabled={applying || !overrideActive}
          onClick={() => apply(() => clearDateOverride())}
          className="mt-3 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation disabled:opacity-50"
          style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER_STRONG}`, background: 'transparent', color: TEXT_SECONDARY }}
          data-testid="button-timemachine-reset"
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Reset to today (clear override)
        </button>

        <p className="mt-3 text-[10px] leading-relaxed text-center" style={{ color: TEXT_MUTED }}>
          The override is stored on this device only and never affects other students.
        </p>
      </div>
    </div>
  );
}
