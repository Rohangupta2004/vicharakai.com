/**
 * The upgrade sheet — shown when the free trial wraps, when the day's free AI
 * messages run out, or when a student taps “Go Pro” themselves.
 *
 * It never blocks the app: closing it drops the student straight back into the
 * full planner. Payment isn't wired up yet, so the primary action collects
 * interest and says so plainly instead of pretending to charge anyone.
 */
import { Check, Crown, Loader2, X } from 'lucide-react';
import {
  FREE_DAILY_AI_MESSAGES,
  LIMIT_MESSAGE,
  // TEMP: Paywall disabled 2026-08-08 — re-enable once payment is ready.
  PAYWALL_DISABLED,
  PRO_PRICE_MONTHLY,
  TRIAL_DAYS,
  type AiAccess,
} from './access';
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
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';

export type UpgradeReason = 'trial-ended' | 'limit' | 'browse';

const PRO_BENEFITS = [
  'Unlimited AI messages — ask as often as prep needs',
  'Full coaching: what next, prioritisation, daily strategy',
  'Weak-area plans built from your own test marks',
  'Cancel anytime, in two taps',
];

function openingLine(reason: UpgradeReason, access: AiAccess): string {
  // TEMP: Paywall disabled 2026-08-08 — re-enable once payment is ready.
  // With nothing metered, the only way here is a student tapping “Go Pro”, so
  // the sheet talks about the waiting list rather than a limit they've hit.
  if (PAYWALL_DISABLED) {
    return "VicharakAI is completely free right now — unlimited AI, no card, no daily cap. Pro opens later; say you want it and you'll be first through the door.";
  }
  if (reason === 'limit') return LIMIT_MESSAGE;
  if (reason === 'trial-ended') {
    return `That's your ${TRIAL_DAYS} days of full AI — no card, exactly as promised. You're on VicharakAI Free now: the whole planner, plus ${FREE_DAILY_AI_MESSAGES} AI messages a day.`;
  }
  return access.tier === 'trial'
    ? `You're still on your free trial — nothing to do today. Pro is here for when the ${FREE_DAILY_AI_MESSAGES}-a-day free limit starts to pinch.`
    : "Everything you use today stays free. Pro is for when you want VicharakAI's coaching without a daily cap.";
}

export default function UpgradeSheet({
  access,
  reason,
  notified,
  saving,
  onNotify,
  onClose,
}: {
  access: AiAccess;
  reason: UpgradeReason;
  notified: boolean;
  saving: boolean;
  onNotify: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="VicharakAI Pro"
      data-testid="sheet-upgrade"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 vicharak-fade"
        style={{ background: OVERLAY_BG }}
      />
      <div
        className="relative max-h-[88vh] overflow-y-auto vicharak-sheet"
        style={{
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          background: NAVY_ALT,
          borderTop: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-start justify-between px-5 pt-4">
          <span
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: RADIUS.md, background: BRAND_GRADIENT, color: ON_AMBER }}
            aria-hidden="true"
          >
            <Crown className="w-5 h-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: BORDER, color: TEXT }}
            data-testid="button-close-upgrade"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-6">
          <h2 className="text-xl font-extrabold leading-tight" style={{ color: TEXT }}>
            Continue with VicharakAI AI
          </h2>
          <p className="text-sm font-bold mt-1" style={{ color: AMBER }} data-testid="text-pro-price">
            {PRO_PRICE_MONTHLY} · Cancel anytime.
          </p>
          <p className="text-sm mt-2.5 leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-upgrade-reason">
            {openingLine(reason, access)}
          </p>

          <ul className="mt-4 space-y-2">
            {PRO_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: tint(SUCCESS, 0.16), color: SUCCESS }}
                  aria-hidden="true"
                >
                  <Check className="w-3 h-3" />
                </span>
                <span className="text-sm" style={{ color: TEXT }}>
                  {benefit}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={notified || saving}
            onClick={onNotify}
            className="mt-5 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-notify-pro"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : notified ? <Check className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
            {notified ? "You're on the list" : 'Notify me when Pro opens'}
          </button>

          <p className="text-xs mt-3 text-center leading-relaxed" style={{ color: notified ? SUCCESS : TEXT_MUTED }}>
            {notified
              ? "We'll email you the moment VicharakAI Pro opens. Nothing changes today — keep studying."
              : "Pro isn't open for payment yet. Tell us you want it and you'll be first through the door."}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full py-2.5 text-xs font-extrabold"
            style={{ borderRadius: RADIUS.chip, background: CARD, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
            data-testid="button-stay-free"
          >
            Keep going with VicharakAI Free
          </button>

          <p className="text-[11px] mt-3 text-center leading-relaxed" style={{ color: TEXT_MUTED }}>
            Your plan, revisions, streak, calendar and dashboard are never limited — free, forever.
          </p>
        </div>
      </div>
    </div>
  );
}
