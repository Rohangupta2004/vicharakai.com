/**
 * DailyPopup — the full-screen "start of day" moment. Shown once per calendar
 * day, on the FIRST open of the app, before the tabs (App.tsx gates it with
 * `shouldShowDailyPopup(today)` and dismisses via `markDailyPopupSeen(today)`).
 *
 * Three jobs, in order:
 *  1. Greet the student by name for the right time of day.
 *  2. Land today's rotating quote (from quotes.ts — muted + italic, felt not
 *     noticed, per the library's styling rule).
 *  3. Ask "how are you arriving today?" — a three-option vibe picker whose
 *     answer is persisted for the day and reported to App.tsx, so the Today
 *     screen can meet the student where they actually are (e.g. a 'low' day
 *     pairs with the existing Feeling-low / lighter-plan affordances).
 *
 * Picking a vibe is optional: "Skip for now" (or the backdrop / X) closes the
 * popup without recording a mood, and it will not reappear until tomorrow.
 *
 * Storage is date-keyed (one key per calendar day), matching the app's
 * `vicharak_*` localStorage conventions; stale keys from previous days are
 * pruned on mark-seen so storage never grows unbounded.
 */
import { CloudRain, Compass, Sparkles, X, Zap } from 'lucide-react';
import { dailyQuote } from './quotes';
import { getSystemDate } from './systemDate';
import {
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
  tint,
} from './theme';

/** How the student says they're arriving today. 'low' pairs with the app's
 * lighter-day affordances; 'charged' and 'steady' are simply acknowledged. */
export type DailyVibe = 'charged' | 'steady' | 'low';

const SEEN_KEY_PREFIX = 'vicharak_daily_popup_';
const VIBE_KEY_PREFIX = 'vicharak_daily_vibe_';

const VIBE_VALUES: readonly DailyVibe[] = ['charged', 'steady', 'low'];

/** True when the popup has NOT yet been seen today (storage failures fail
 * closed — no popup — so a privacy-mode browser is never nagged every mount). */
export function shouldShowDailyPopup(dateISO: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${SEEN_KEY_PREFIX}${dateISO}`) === null;
  } catch {
    return false;
  }
}

/** Record that today's popup was shown, and sweep out previous days' keys. */
export function markDailyPopupSeen(dateISO: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SEEN_KEY_PREFIX}${dateISO}`, '1');
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const isOurs = key.startsWith(SEEN_KEY_PREFIX) || key.startsWith(VIBE_KEY_PREFIX);
      if (isOurs && !key.endsWith(dateISO)) stale.push(key);
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* storage unavailable — the popup simply shows again next mount */
  }
}

/** The vibe picked earlier today, if any — lets App.tsx restore it on remount. */
export function readTodaysVibe(dateISO: string): DailyVibe | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${VIBE_KEY_PREFIX}${dateISO}`);
    return (VIBE_VALUES as readonly string[]).includes(raw ?? '') ? (raw as DailyVibe) : null;
  } catch {
    return null;
  }
}

function storeTodaysVibe(dateISO: string, vibe: DailyVibe): void {
  try {
    window.localStorage.setItem(`${VIBE_KEY_PREFIX}${dateISO}`, vibe);
  } catch {
    /* storage unavailable — App.tsx still receives the vibe via onPickVibe */
  }
}

/** Time-of-day greeting, read through the QA-aware clock (never `new Date()`). */
function greetingForNow(): string {
  const hour = getSystemDate().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Saturday, 29 August" from the app's YYYY-MM-DD `today` string. Noon avoids
 * any timezone edge flipping the calendar day. */
function formatDayLabel(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateISO;
  return parsed.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

const VIBE_OPTIONS: Array<{
  vibe: DailyVibe;
  label: string;
  hint: string;
  Icon: typeof Zap;
  color: string;
}> = [
  {
    vibe: 'charged',
    label: 'Charged up',
    hint: "Great — let's put that energy on the hardest topic first.",
    Icon: Zap,
    color: 'var(--vicharak-amber-bright, #4DDFFF)',
  },
  {
    vibe: 'steady',
    label: 'Steady',
    hint: 'Perfect. Steady days are where ranks are quietly built.',
    Icon: Compass,
    color: 'var(--vicharak-success, #4ADE80)',
  },
  {
    vibe: 'low',
    label: 'Running low',
    hint: "That's allowed. We'll keep today small — not zero.",
    Icon: CloudRain,
    color: 'var(--vicharak-warning, #FBBF24)',
  },
];

export default function DailyMotivationPopup({
  today,
  name,
  onClose,
  onPickVibe,
}: {
  /** Today's date as YYYY-MM-DD (App.tsx's `todayISO()`). */
  today: string;
  /** Student's display name — may be empty while identity is still loading. */
  name: string;
  /** Dismiss without recording a mood (backdrop, X, or "Skip for now"). */
  onClose: () => void;
  /** A mood was chosen — persisted here, then reported up. */
  onPickVibe: (vibe: DailyVibe) => void;
}) {
  const trimmedName = (name ?? '').trim();
  const greeting = trimmedName ? `${greetingForNow()}, ${trimmedName}` : `${greetingForNow()}`;

  const pick = (vibe: DailyVibe) => {
    storeTodaysVibe(today, vibe);
    onPickVibe(vibe);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-label="Daily check-in"
      data-testid="popup-daily"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 vicharak-fade"
        style={{ background: OVERLAY_BG }}
      />

      <div
        className="relative w-full max-w-md overflow-hidden vicharak-popup"
        style={{
          borderRadius: RADIUS.hero,
          background: NAVY_ALT,
          border: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Brand-gradient header band */}
        <div className="px-6 pt-6 pb-5" style={{ background: BRAND_GRADIENT, color: ON_AMBER }}>
          <div className="flex items-start justify-between gap-3">
            <span
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
              style={{ borderRadius: RADIUS.md, background: 'rgba(255,255,255,0.18)' }}
              aria-hidden="true"
            >
              <Sparkles className="w-5 h-5" />
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', color: ON_AMBER }}
              data-testid="button-close-daily-popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mt-4 opacity-90">
            {formatDayLabel(today)}
          </p>
          <h2 className="text-2xl font-extrabold leading-tight mt-1" data-testid="text-daily-greeting">
            {greeting}
          </h2>
        </div>

        <div className="px-6 pt-5 pb-6">
          {/* Quote of the day — muted + italic, per the quote library's rule */}
          <p
            className="text-sm italic leading-relaxed vicharak-fade"
            style={{ color: TEXT_MUTED }}
            data-testid="text-daily-quote"
          >
            “{dailyQuote(today)}”
          </p>

          <p className="text-sm font-bold mt-5" style={{ color: TEXT }}>
            How are you arriving today?
          </p>

          <div className="mt-3 space-y-2.5">
            {VIBE_OPTIONS.map(({ vibe, label, hint, Icon, color }) => (
              <button
                key={vibe}
                type="button"
                onClick={() => pick(vibe)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-transform active:scale-[0.98]"
                style={{
                  borderRadius: RADIUS.lg,
                  background: tint(color, 0.1),
                  border: `1px solid ${tint(color, 0.35)}`,
                }}
                data-testid={`button-vibe-${vibe}`}
              >
                <span
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ borderRadius: RADIUS.sm, background: tint(color, 0.18), color }}
                  aria-hidden="true"
                >
                  <Icon style={{ width: 18, height: 18 }} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold" style={{ color: TEXT }}>
                    {label}
                  </span>
                  <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                    {hint}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full py-2.5 text-sm font-semibold"
            style={{
              borderRadius: RADIUS.chip,
              border: `1px solid ${BORDER}`,
              color: TEXT_SECONDARY,
              background: 'transparent',
            }}
            data-testid="button-skip-daily-popup"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
