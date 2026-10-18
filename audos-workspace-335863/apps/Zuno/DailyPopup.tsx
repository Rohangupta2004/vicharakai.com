/**
 * Daily motivation popup — a full-screen moment on the FIRST open of each
 * calendar day, before the student touches their plan. Two formats alternate
 * by day of month: an emoji "pick your vibe" grid (even days) whose choice
 * then sits subtly in the Today header, and a single quote card (odd days)
 * with a Start My Day CTA. Shown once per day, tracked via localStorage.
 */
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { dailyQuote } from './quotes';
import { BRAND_GRADIENT_DEEP, ON_AMBER, RADIUS } from './theme';

export interface DailyVibe {
  emoji: string;
  label: string;
}

export const DAILY_VIBES: DailyVibe[] = [
  { emoji: '\uD83D\uDD25', label: 'Focused' },
  { emoji: '\uD83D\uDCAA', label: 'Determined' },
  { emoji: '\uD83E\uDDE0', label: 'Sharp' },
  { emoji: '\u26A1', label: 'Energized' },
  { emoji: '\uD83C\uDFAF', label: 'On Track' },
  { emoji: '\uD83D\uDE80', label: 'Ready' },
];

const POPUP_DATE_KEY = 'vicharak_daily_popup_date';
const VIBE_KEY = 'vicharak_daily_vibe';

/** True when the popup has not been shown yet on this calendar day. */
export function shouldShowDailyPopup(today: string): boolean {
  try {
    return localStorage.getItem(POPUP_DATE_KEY) !== today;
  } catch {
    return false;
  }
}

export function markDailyPopupSeen(today: string): void {
  try {
    localStorage.setItem(POPUP_DATE_KEY, today);
  } catch {
    /* it will simply show again next load — harmless */
  }
}

export function saveTodaysVibe(today: string, vibe: DailyVibe): void {
  try {
    localStorage.setItem(VIBE_KEY, JSON.stringify({ date: today, ...vibe }));
  } catch {
    /* the header emoji just won't persist */
  }
}

/** The vibe picked today, or null if none was picked / it's from an older day. */
export function readTodaysVibe(today: string): DailyVibe | null {
  try {
    const raw = localStorage.getItem(VIBE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date?: string; emoji?: string; label?: string };
    if (parsed.date !== today || !parsed.emoji || !parsed.label) return null;
    return { emoji: parsed.emoji, label: parsed.label };
  } catch {
    return null;
  }
}

export default function DailyMotivationPopup({
  today,
  name,
  onClose,
  onPickVibe,
}: {
  today: string;
  name: string | null;
  onClose: () => void;
  onPickVibe: (vibe: DailyVibe) => void;
}) {
  /* Alternate daily: even day of month → emoji mood grid, odd → quote card. */
  const format = useMemo<'vibes' | 'quote'>(
    () => (Number(today.slice(8, 10)) % 2 === 0 ? 'vibes' : 'quote'),
    [today],
  );

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 py-10 text-center vicharak-popup"
      style={{ background: BRAND_GRADIENT_DEEP, color: ON_AMBER, zIndex: 60 }}
      role="dialog"
      aria-modal="true"
      aria-label="Daily motivation"
      data-testid="overlay-daily-popup"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss daily motivation"
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ background: 'rgba(5,18,46,0.3)', color: '#EAF2FF' }}
        data-testid="button-dismiss-daily-popup"
      >
        <X className="w-4 h-4" />
      </button>

      {format === 'vibes' ? (
        <>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-80">
            Good to see you{name ? `, ${name}` : ''}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight max-w-xs">What's your vibe for today?</h1>
          <p className="mt-1.5 text-sm opacity-85 max-w-xs">
            Tap one — I'll keep it on your Today screen as a quiet reminder.
          </p>
          <div className="mt-7 grid grid-cols-3 gap-3 w-full max-w-xs">
            {DAILY_VIBES.map((vibe) => (
              <button
                key={vibe.label}
                type="button"
                onClick={() => {
                  saveTodaysVibe(today, vibe);
                  onPickVibe(vibe);
                }}
                className="flex flex-col items-center gap-1.5 py-4 px-1 transition-transform hover:-translate-y-0.5 touch-manipulation"
                style={{
                  borderRadius: RADIUS.lg,
                  background: 'rgba(5,18,46,0.25)',
                  border: '1px solid rgba(234,242,255,0.3)',
                }}
                data-testid={`button-vibe-${vibe.label.replace(/\s+/g, '-')}`}
              >
                <span className="text-3xl leading-none" aria-hidden="true">
                  {vibe.emoji}
                </span>
                <span className="text-[11px] font-extrabold">{vibe.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-80">Today's spark</p>
          <p className="mt-6 max-w-sm text-2xl font-extrabold leading-snug" data-testid="text-popup-quote">
            “{dailyQuote(today)}”
          </p>
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-75">— Your Second Mind</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-10 px-7 py-3.5 text-sm font-extrabold transition-opacity hover:opacity-90 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: '#FFFFFF', color: '#0041CC', boxShadow: '0 6px 18px rgba(0,0,0,0.28)' }}
            data-testid="button-start-my-day"
          >
            Start My Day →
          </button>
        </>
      )}
    </div>
  );
}
