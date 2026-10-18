/**
 * Focus mode — the floating timer FAB's full-screen destination.
 *
 * Three phases, one promise: nothing on screen but the countdown.
 *  1. setup   — pick 25 / 45 / 60 minutes or a custom duration; the active
 *               mission's name is shown so the student knows what the block
 *               is credited to.
 *  2. running — a huge countdown, the task name, pause/resume and stop.
 *               Nothing else. True focus mode.
 *  3. done    — a completion tone plays, a summary says how long they focused
 *               and on what, and App.tsx auto-logs the session to the study
 *               log before returning to Today.
 *
 * The component owns its own clock; App.tsx owns the database write (via
 * onLog) so this file stays purely presentational + timing.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play, Square, Timer, X } from 'lucide-react';
import { MAX_SESSION_MINUTES, formatClock, formatDuration } from './engine';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  BRAND_GRADIENT_DEEP,
  NAVY,
  ON_AMBER,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';

const PRESETS = [25, 45, 60] as const;

/** Two soft ascending notes — the "block complete" tone. Never throws. */
function playCompletionTone() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const note = (frequency: number, start: number, length: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + length + 0.05);
    };
    note(660, 0, 0.5);
    note(880, 0.35, 0.8);
  } catch {
    /* no audio permission — the visual summary still lands */
  }
}

type FocusPhase = 'setup' | 'running' | 'done';

export function FocusModeScreen({
  taskName,
  subject,
  onLog,
  onClose,
}: {
  /** The active task this block is credited to (today's mission by default). */
  taskName: string | null;
  subject: string | null;
  /** Called exactly once with the whole minutes focused — App logs the session. */
  onLog: (minutes: number) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<FocusPhase>('setup');
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [custom, setCustom] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumMs, setAccumMs] = useState(0);
  const [, setTick] = useState(0);
  const [finalMinutes, setFinalMinutes] = useState(0);
  const loggedRef = useRef(false);

  const running = phase === 'running' && startedAt !== null;
  const targetMs = targetMinutes * 60000;
  const elapsedMs = Math.min(targetMs, accumMs + (startedAt !== null ? Date.now() - startedAt : 0));
  const remainingMs = Math.max(0, targetMs - elapsedMs);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [running]);

  const finish = (minutes: number, playTone: boolean) => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    setFinalMinutes(minutes);
    setPhase('done');
    if (playTone) playCompletionTone();
    if (minutes > 0) onLog(minutes);
  };

  /* Countdown reaches zero → tone + summary + auto-log. */
  useEffect(() => {
    if (phase !== 'running' || remainingMs > 0) return;
    finish(targetMinutes, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingMs]);

  const customMinutes = Math.round(Number(custom));
  const customValid = custom.trim() !== '' && Number.isFinite(customMinutes) && customMinutes > 0 && customMinutes <= MAX_SESSION_MINUTES;

  const start = () => {
    setAccumMs(0);
    setStartedAt(Date.now());
    setPhase('running');
  };

  const pause = () => {
    if (startedAt === null) return;
    setAccumMs((prev) => prev + Math.max(0, Date.now() - startedAt));
    setStartedAt(null);
  };

  const resume = () => setStartedAt(Date.now());

  const stop = () => {
    const minutes = Math.round(elapsedMs / 60000);
    if (minutes >= 1) {
      finish(minutes, false);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center px-6 text-center vicharak-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
      style={{ background: NAVY }}
    >
      {phase !== 'done' && (
        <button
          type="button"
          onClick={phase === 'running' ? stop : onClose}
          aria-label={phase === 'running' ? 'Stop the focus session' : 'Close focus mode'}
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center touch-manipulation"
          style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
          data-testid="button-focus-close"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {phase === 'setup' && (
        <div className="w-full max-w-sm vicharak-rise">
          <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Timer className="w-7 h-7" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold" style={{ color: TEXT }}>Focus session</h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-focus-task">
            {taskName ? (
              <>On <strong style={{ color: TEXT }}>{taskName}</strong>{subject ? ` · ${subject}` : ''}</>
            ) : (
              'No task queued — the time still counts towards today.'
            )}
          </p>

          <div className="mt-7 grid grid-cols-3 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTargetMinutes(preset);
                  setCustom('');
                }}
                className="py-3.5 text-base font-extrabold touch-manipulation"
                style={
                  targetMinutes === preset && !customValid
                    ? { borderRadius: RADIUS.md, background: BRAND_GRADIENT, color: ON_AMBER }
                    : { borderRadius: RADIUS.md, background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }
                }
                data-testid={`focus-preset-${preset}`}
              >
                {preset} min
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SESSION_MINUTES}
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value);
              const n = Math.round(Number(event.target.value));
              if (Number.isFinite(n) && n > 0 && n <= MAX_SESSION_MINUTES) setTargetMinutes(n);
            }}
            placeholder="Or custom minutes"
            aria-label="Custom focus duration in minutes"
            className="mt-3 w-full px-4 py-3 text-center text-sm font-bold"
            style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, color: TEXT }}
            data-testid="input-focus-custom"
          />
          <button
            type="button"
            disabled={custom.trim() !== '' && !customValid}
            onClick={start}
            className="mt-6 w-full py-4 text-base font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-focus-start"
          >
            <Play className="w-5 h-5" />
            Start {formatDuration(targetMinutes)} focus
          </button>
        </div>
      )}

      {phase === 'running' && (
        <div className="w-full max-w-md vicharak-fade">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: TEXT_MUTED }}>
            {running ? 'Focus mode' : 'Paused'}
          </p>
          {taskName && (
            <p className="mt-3 text-lg font-extrabold leading-snug" style={{ color: TEXT }} data-testid="text-focus-running-task">
              {taskName}
            </p>
          )}
          {subject && (
            <p className="mt-1 text-[12px] font-bold" style={{ color: TEXT_MUTED }}>{subject}</p>
          )}
          <p
            className="mt-8 tabular-nums font-black leading-none tracking-[-0.05em]"
            style={{ color: TEXT, fontSize: 'clamp(64px, 22vw, 120px)' }}
            data-testid="text-focus-clock"
          >
            {formatClock(remainingMs)}
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={running ? pause : resume}
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-focus-pause"
            >
              {running ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Resume</>}
            </button>
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
              data-testid="button-focus-stop"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="w-full max-w-sm vicharak-rise">
          <span
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: BRAND_GRADIENT_DEEP, color: ON_AMBER }}
          >
            <Check className="w-8 h-8" />
          </span>
          <h1 className="mt-6 text-2xl font-extrabold" style={{ color: TEXT }} data-testid="text-focus-summary">
            You focused for {formatDuration(finalMinutes)}
            {taskName ? ` on ${taskName}` : ''}
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            Logged to your study time automatically — it counts towards today's total and your pace signal.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full py-4 text-base font-extrabold touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-focus-done"
          >
            Back to Today
          </button>
        </div>
      )}
    </div>
  );
}
