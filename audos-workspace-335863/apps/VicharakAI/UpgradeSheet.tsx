/**
 * LEGACY upgrade sheet — superseded by PaywallScreen.tsx, which runs the real
 * checkout (Monthly ₹149 via Razorpay, INR-only for all users worldwide — the
 * ₹10 day tier, the yearly tier and the Creem/USD path are retired). App.tsx no longer
 * renders this sheet; it is kept only so older references keep compiling.
 * The Explorer (free) tier no longer exists, so this sheet carries no
 * “continue for free” path or free-tier copy. Its primary action still just
 * records interest.
 */
import { Check, Crown, Loader2, X } from 'lucide-react';
import { type AiAccess } from './access';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
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
  void access;
  void reason;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="VicharakAI Premium"
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
            VicharakAI Premium
          </h2>
          <p className="text-sm font-bold mt-1" style={{ color: AMBER }} data-testid="text-pro-price">
            3-day free trial · then ₹149/month
          </p>
          <p className="text-sm mt-2.5 leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-upgrade-reason">
            VicharakAI runs on a subscription — pick a plan on the Premium screen and everything unlocks instantly.
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
            {notified ? "You're on the list" : 'Email me about Premium'}
          </button>

          <p className="text-xs mt-3 text-center leading-relaxed" style={{ color: notified ? SUCCESS : TEXT_MUTED }}>
            {notified
              ? "We'll email you about VicharakAI Premium."
              : 'Unlock any time from the Premium screen — payment is secure via Razorpay (UPI, card, wallet).'}
          </p>
        </div>
      </div>
    </div>
  );
}
