/**
 * ProfileOverlays — streak milestone, hidden QA panel, help & support and the danger-zone confirmation.
 * JSX extracted verbatim from App.tsx.
 */
/* eslint-disable */
import { Flame, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import {
  AMBER, BORDER, BORDER_STRONG, BRAND_GRADIENT, BRAND_GRADIENT_DEEP, CARD, CARD_SHADOW, DANGER,
  NAVY, NAVY_ALT, ON_AMBER, OVERLAY_BG, PAGE_BG, RADIUS, TEXT, TEXT_MUTED, TEXT_SECONDARY, tint,
} from '../../theme';
import TimeMachinePanel from '../../TimeMachinePanel';
import HelpSupportSheet from '../../HelpSupport';
import AccountSheet from './AccountSheet';
import { streakMilestoneQuote } from '../../quotes';
import { useApp } from '../../app/AppContext';

export default function ProfileOverlays() {
  const { data, settings, setTab } = useApp();
  const { spaceId } = data;
  const {
    milestoneStreak, setMilestoneStreak, showTimeMachine, setShowTimeMachine, helpOpen, setHelpOpen,
    accountSheetOpen, setAccountSheetOpen, dangerAction, setDangerAction, dangerBusy, confirmDangerAction,
  } = settings;

  return (
    <>
      {/* streak milestone — a calm full-screen pause, shown once per milestone */}
      {milestoneStreak !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center vicharak-fade"
          style={{ background: BRAND_GRADIENT_DEEP, color: ON_AMBER }}
          role="dialog"
          aria-modal="true"
          aria-label={`${milestoneStreak}-day streak milestone`}
          data-testid="overlay-streak-milestone"
        >
          <Flame className="w-12 h-12 vicharak-pop" />
          <p className="mt-3 text-6xl font-extrabold leading-none vicharak-rise">{milestoneStreak}</p>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.22em] opacity-75">day streak</p>
          <p className="mt-6 max-w-xs text-base italic font-semibold leading-relaxed opacity-90 vicharak-rise" style={{ animationDelay: '140ms' }}>
            “{streakMilestoneQuote(milestoneStreak)}”
          </p>
          <button
            type="button"
            onClick={() => setMilestoneStreak(null)}
            className="mt-9 px-6 py-2.5 text-sm font-extrabold"
            style={{ borderRadius: RADIUS.chip, background: '#FFFFFF', color: '#0041CC' }}
            data-testid="button-dismiss-milestone"
          >
            Keep it going
          </button>
        </div>
      )}

      {/* Hidden QA Test Controls (Time Machine) panel — see systemDate.ts. */}
      {showTimeMachine && <TimeMachinePanel onClose={() => setShowTimeMachine(false)} />}
      {/* help & support — FAQs and a mailto, from the Profile settings list */}
      {helpOpen && (
        <HelpSupportSheet
          onClose={() => setHelpOpen(false)}
          onAskCoach={() => {
            setHelpOpen(false);
            setTab('coach');
          }}
        />
      )}

      {/* [FIX 1] Account & plan — active plan + geo-priced upgrade options,
          as a slide-up sheet (never a navigation away from the app). */}
      {accountSheetOpen && <AccountSheet onClose={() => setAccountSheetOpen(false)} />}

      {/* FIX 1: confirmation for Reset All Data / Delete Account. */}
      {dangerAction && (
        <div
          className="fixed inset-0 z-[78] flex items-center justify-center px-6 vicharak-fade"
          role="dialog"
          aria-modal="true"
          aria-label={dangerAction === 'reset' ? 'Reset all data' : 'Delete account'}
        >
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: OVERLAY_BG }}
            onClick={dangerBusy ? undefined : () => setDangerAction(null)}
            aria-label="Cancel"
          />
          <div
            className="relative w-full max-w-sm p-5 vicharak-rise"
            style={{ background: CARD, border: `1px solid ${tint(DANGER, 0.45)}`, borderRadius: RADIUS.hero, boxShadow: CARD_SHADOW }}
            data-testid="modal-danger-confirm"
          >
            <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: tint(DANGER, 0.14), color: DANGER }}>
              {dangerAction === 'reset' ? <RotateCcw className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </span>
            <h2 className="mt-3 text-lg font-extrabold" style={{ color: TEXT }}>
              {dangerAction === 'reset' ? 'Reset all data?' : 'Delete your account?'}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-danger-warning">
              This will permanently delete all your tasks, revision history, test scores and your Mistake Book. This cannot be undone.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => void confirmDangerAction()}
                className="w-full py-3 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: DANGER, color: '#2B0B0B' }}
                data-testid="button-danger-confirm"
              >
                {dangerBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {dangerBusy
                  ? dangerAction === 'reset' ? 'Resetting…' : 'Deleting…'
                  : dangerAction === 'reset' ? 'Yes, Reset Everything' : 'Yes, Delete My Account'}
              </button>
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => setDangerAction(null)}
                className="w-full py-3 text-sm font-extrabold disabled:opacity-50 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-danger-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
