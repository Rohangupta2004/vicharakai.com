/**
 * Recording study time — the one number VicharakAI cannot infer.
 *
 * Two ways in, one destination. The primary path is manual: the moment a task
 * is checked off, a sheet asks “How long did you study?” with five one-tap
 * pills and a custom box, so a duration costs exactly one extra tap. The timer
 * on the active mission card is a pure add-on — ignore it and nothing changes;
 * use it and it simply pre-fills the same sheet.
 *
 * Nothing here reads or writes the database; App.tsx owns that.
 */
import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Pause, Play, Square, Timer } from 'lucide-react';
import { DURATION_CHIPS, MAX_SESSION_MINUTES, formatClock, formatDuration } from './engine';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';

/* ------------------------------------------------------------------ */
/*  The optional timer                                                 */
/* ------------------------------------------------------------------ */

interface StoredTimer {
  itemId: number | null;
  /** Epoch ms the current run began, or null while paused. */
  startedAt: number | null;
  accumMs: number;
  /** Optional countdown duration. Legacy timers without one continue as stopwatches. */
  targetMs: number | null;
  /** Calendar day the timer belongs to. */
  day: string;
}

export interface StudyTimer {
  itemId: number | null;
  running: boolean;
  elapsedMs: number;
  targetMs: number | null;
  remainingMs: number;
  complete: boolean;
  /** Whole minutes measured so far; any started timer counts for at least one. */
  minutes: number;
  isFor: (itemId: number) => boolean;
  start: (itemId: number, targetMinutes?: number) => void;
  pause: () => void;
  clear: () => void;
}

const MAX_TIMER_MS = MAX_SESSION_MINUTES * 60000;

function emptyTimer(day: string): StoredTimer {
  return { itemId: null, startedAt: null, accumMs: 0, targetMs: null, day };
}

function readTimer(key: string, today: string): StoredTimer {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyTimer(today);
    const parsed = JSON.parse(raw) as Partial<StoredTimer>;
    // A timer left running overnight belongs to yesterday — never credit it to today.
    if (parsed.day !== today) return emptyTimer(today);
    const itemId = typeof parsed.itemId === 'number' ? parsed.itemId : null;
    const targetMs =
      typeof parsed.targetMs === 'number' && parsed.targetMs > 0 && parsed.targetMs <= MAX_TIMER_MS
        ? parsed.targetMs
        : null;
    // Old stopwatch sessions had no target. Clear them so an active clock can
    // never count upward: VicharakAI now uses countdown timers only.
    if (itemId !== null && targetMs === null) return emptyTimer(today);
    return {
      itemId,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      accumMs: typeof parsed.accumMs === 'number' && parsed.accumMs > 0 ? parsed.accumMs : 0,
      targetMs,
      day: today,
    };
  } catch {
    return emptyTimer(today);
  }
}

/** A countdown timer that survives tab switches and reloads. */
export function useStudyTimer(spaceId: string, today: string): StudyTimer {
  const key = `vicharak_timer_${spaceId}`;
  const [state, setState] = useState<StoredTimer>(() => readTimer(key, today));
  const [, setTick] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* private browsing — the timer just won't survive a reload */
    }
  }, [key, state]);

  const running = state.startedAt !== null;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const raw = state.accumMs + (state.startedAt !== null ? Date.now() - state.startedAt : 0);
  const elapsedMs = Math.min(MAX_TIMER_MS, Math.max(0, raw));
  const remainingMs = state.targetMs !== null ? Math.max(0, state.targetMs - elapsedMs) : 0;
  const complete = state.targetMs !== null && elapsedMs >= state.targetMs;

  useEffect(() => {
    if (!running || state.targetMs === null || elapsedMs < state.targetMs) return;
    setState((prev) => {
      if (prev.startedAt === null || prev.targetMs === null) return prev;
      return { ...prev, startedAt: null, accumMs: prev.targetMs };
    });
  }, [elapsedMs, running, state.targetMs]);

  const start = useCallback(
    (itemId: number, targetMinutes?: number) => {
      setState((prev) => {
        const resumingSame = prev.itemId === itemId && prev.accumMs > 0 && targetMinutes === undefined;
        const targetMs =
          targetMinutes !== undefined
            ? Math.min(MAX_TIMER_MS, Math.max(60000, Math.round(targetMinutes) * 60000))
            : resumingSame
              ? (prev.targetMs ?? 30 * 60000)
              : 30 * 60000;
        return {
          itemId,
          startedAt: Date.now(),
          // A chosen duration starts fresh; resuming the same timer keeps its time.
          accumMs: resumingSame ? prev.accumMs : 0,
          targetMs,
          day: today,
        };
      });
    },
    [today],
  );

  const pause = useCallback(() => {
    setState((prev) => {
      if (prev.startedAt === null) return prev;
      const limit = prev.targetMs ?? MAX_TIMER_MS;
      const total = Math.min(limit, prev.accumMs + Math.max(0, Date.now() - prev.startedAt));
      return { ...prev, startedAt: null, accumMs: total };
    });
  }, []);

  const clear = useCallback(() => setState(emptyTimer(today)), [today]);

  return {
    itemId: state.itemId,
    running,
    elapsedMs,
    targetMs: state.targetMs,
    remainingMs,
    complete,
    minutes: elapsedMs > 0 ? Math.max(1, Math.round(elapsedMs / 60000)) : 0,
    isFor: (itemId: number) => state.itemId === itemId,
    start,
    pause,
    clear,
  };
}

/** The mission-card hero countdown: set hours/minutes, then tap to start or pause. */
export function MissionTimer({
  timer,
  itemId,
  taskName,
  subject,
}: {
  timer: StudyTimer;
  itemId: number;
  taskName: string;
  subject?: string;
}) {
  const [durationHours, setDurationHours] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const active = timer.isFor(itemId);
  const elapsedMs = active ? timer.elapsedMs : 0;
  const running = active && timer.running;
  const complete = active && timer.complete;
  const hours = Math.max(0, Math.floor(Number(durationHours) || 0));
  const minutes = Math.max(0, Math.floor(Number(durationMinutes) || 0));
  const totalMinutes = Math.min(MAX_SESSION_MINUTES, hours * 60 + minutes);
  const durationValid = totalMinutes > 0;
  const displayMs = active ? timer.remainingMs : totalMinutes * 60000;
  const label = running
    ? 'Pause the study timer'
    : complete
      ? 'Timer finished'
      : elapsedMs > 0
        ? 'Resume the study timer'
        : `Start a ${formatDuration(totalMinutes)} study timer`;
  const setPreset = (presetMinutes: number) => {
    setDurationHours(String(Math.floor(presetMinutes / 60)));
    setDurationMinutes(String(presetMinutes % 60));
  };

  return (
    <div
      className="w-full px-4 py-5 sm:px-5 text-center"
      style={{
        borderRadius: RADIUS.lg,
        background: 'rgba(3,18,57,0.3)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 18px 36px rgba(0,0,0,0.18)',
      }}
      data-testid="mission-timer-hero"
    >
      <div className="flex items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70">
            {complete ? "Time's up" : active ? (running ? 'Countdown running' : 'Countdown paused') : 'Set countdown timer'}
          </p>
          <p className="mt-1 truncate text-sm font-extrabold">{taskName}</p>
          {subject && <p className="mt-0.5 text-[11px] font-bold opacity-70">{subject}</p>}
        </div>
        <span className="rounded-full border border-white/25 px-2.5 py-1 text-[10px] font-extrabold opacity-80">
          {active ? (complete ? 'Finished' : `Tap clock to ${running ? 'pause' : 'resume'}`) : 'Hours + minutes'}
        </span>
      </div>

      {!active && (
        <div className="mt-4" data-testid="timer-duration-picker">
          <div className="mx-auto flex max-w-[240px] items-end justify-center gap-2">
            <label className="flex-1 text-left">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide opacity-70">Hours</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={Math.floor(MAX_SESSION_MINUTES / 60)}
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className="w-full rounded-xl border border-white/25 bg-black/15 px-3 py-2 text-center text-lg font-black text-white outline-none focus:border-white/60"
                aria-label="Timer hours"
                data-testid="input-timer-hours"
              />
            </label>
            <span className="pb-2.5 text-lg font-black opacity-60">:</span>
            <label className="flex-1 text-left">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide opacity-70">Minutes</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                className="w-full rounded-xl border border-white/25 bg-black/15 px-3 py-2 text-center text-lg font-black text-white outline-none focus:border-white/60"
                aria-label="Timer minutes"
                data-testid="input-timer-minutes"
              />
            </label>
          </div>
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5" aria-label="Quick timer durations">
            {[25, 45, 60, 120].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPreset(preset)}
                className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-extrabold opacity-80 transition-opacity hover:opacity-100"
                data-testid={`timer-preset-${preset}`}
              >
                {formatDuration(preset)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (running) timer.pause();
          else if (!complete && active && elapsedMs > 0) timer.start(itemId);
          else if (!active && durationValid) timer.start(itemId, totalMinutes);
        }}
        disabled={complete || (!active && !durationValid)}
        aria-label={label}
        className="mt-4 w-full flex flex-col items-center justify-center touch-manipulation transition-transform active:scale-[0.98] disabled:opacity-60"
        data-testid="button-study-timer"
      >
        <span
          className="tabular-nums max-w-full font-black leading-none tracking-[-0.05em]"
          style={{ fontSize: 'clamp(50px, 16.5vw, 78px)' }}
          data-testid="text-timer-clock"
        >
          {formatClock(displayMs)}
        </span>
        <span className="mt-3 inline-flex max-w-full items-center gap-2 text-sm font-extrabold">
          {running ? <Pause className="w-4 h-4" /> : complete ? <Square className="w-4 h-4 fill-current" /> : elapsedMs > 0 ? <Play className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
          <span>
            {running
              ? 'Pause timer'
              : complete
                ? "Time's up"
                : elapsedMs > 0
                  ? 'Resume timer'
                  : `Start ${formatDuration(totalMinutes)}`}
          </span>
        </span>
      </button>

      {complete && (
        <div className="mt-3">
          <p className="text-xs font-extrabold">Focus block complete — log the task when you’re ready.</p>
          <button
            type="button"
            onClick={timer.clear}
            className="mt-2 rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-extrabold opacity-85"
            data-testid="button-new-study-timer"
          >
            Set another timer
          </button>
        </div>
      )}
      {running && (
        <button
          type="button"
          onClick={timer.pause}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-extrabold opacity-80 transition-opacity hover:opacity-100 touch-manipulation"
          aria-label="Stop the timer and keep the recorded time"
          data-testid="button-stop-study-timer"
        >
          <Square className="w-3 h-3 fill-current" />
          Stop & keep time
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  “How long did you study?”                                          */
/* ------------------------------------------------------------------ */

/**
 * The manual entry sheet. Every pill saves on the tap — no confirm step — so
 * checking a task off and recording its hours is two taps in total, and Skip is
 * always one tap away because the task itself is already saved.
 */
export function DurationSheet({
  topic,
  subject,
  note,
  prefillMinutes,
  saving,
  onSave,
  onSkip,
}: {
  topic: string | null;
  subject: string | null;
  note: string | null;
  prefillMinutes: number | null;
  saving: boolean;
  onSave: (minutes: number, fromTimer: boolean) => void;
  onSkip: () => void;
}) {
  const [custom, setCustom] = useState(() => (prefillMinutes !== null ? String(prefillMinutes) : ''));
  const typed = Math.round(Number(custom));
  const typedValid = custom.trim() !== '' && Number.isFinite(typed) && typed > 0 && typed <= MAX_SESSION_MINUTES;
  const saveTyped = () => {
    if (typedValid && !saving) onSave(typed, prefillMinutes !== null && typed === prefillMinutes);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vicharak-duration-title"
    >
      <button
        type="button"
        aria-label="Skip logging study time"
        onClick={onSkip}
        className="absolute inset-0 vicharak-fade"
        style={{ background: OVERLAY_BG }}
      />
      <div
        className="relative vicharak-sheet px-5 pt-5 pb-7"
        style={{
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          background: CARD,
          borderTop: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
        }}
        data-testid="sheet-duration"
      >
        <div className="flex items-start gap-3">
          <span
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.14) }}
          >
            <Clock className="w-5 h-5" style={{ color: AMBER }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="vicharak-duration-title" className="text-base font-extrabold leading-tight" style={{ color: TEXT }}>
              How long did you study?
            </h2>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: TEXT_MUTED }}>
              {topic ? `${topic}${subject ? ` · ${subject}` : ''}` : "Adds to today's total"}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] font-bold flex-shrink-0 px-1 py-0.5"
            style={{ color: TEXT_MUTED }}
            data-testid="button-skip-duration"
          >
            Skip
          </button>
        </div>

        {note && (
          <p className="text-[11px] italic mt-2.5" style={{ color: TEXT_SECONDARY }}>
            “{note}”
          </p>
        )}

        {prefillMinutes !== null && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(prefillMinutes, true)}
            className="mt-4 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-60 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-log-timer-duration"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />}
            Log {formatDuration(prefillMinutes)} from your timer
          </button>
        )}

        <div className="flex flex-wrap gap-2 mt-4" data-testid="duration-chips">
          {DURATION_CHIPS.map((chip) => (
            <button
              key={chip.minutes}
              type="button"
              disabled={saving}
              onClick={() => onSave(chip.minutes, false)}
              className="px-4 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px disabled:opacity-60 touch-manipulation"
              style={{
                borderRadius: RADIUS.chip,
                background: tint(AMBER, 0.14),
                border: `1px solid ${tint(AMBER, 0.42)}`,
                color: AMBER,
              }}
              data-testid={`chip-duration-${chip.minutes}`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SESSION_MINUTES}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveTyped();
              }
            }}
            placeholder="Or type minutes"
            aria-label="Study time in minutes"
            className="flex-1 min-w-0 px-3 py-2.5 text-sm"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
            data-testid="input-custom-duration"
          />
          <button
            type="button"
            disabled={!typedValid || saving}
            onClick={saveTyped}
            className="px-5 py-2.5 text-xs font-extrabold flex-shrink-0 disabled:opacity-45"
            style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-save-duration"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
        <p className="text-[10px] mt-2" style={{ color: TEXT_MUTED }}>
          {typedValid
            ? `That's ${formatDuration(typed)} — it lands on today's total and your pace signal.`
            : 'Skip it and the task still counts — only the hours go unrecorded.'}
        </p>
      </div>
    </div>
  );
}
