/**
 * PWA install - the "Install app" button (landing header + in-app icon) and the
 * platform-aware "Install VicharakAI" sheet behind it.
 *
 * The `beforeinstallprompt` listener and install state live in
 * lib/pwaInstallState.ts (imported by Desktop.tsx on first load, so Chrome's
 * early, once-only event is captured before React mounts). This file
 * re-exports that API for the rest of the app. Where the native install dialog
 * exists (Android Chrome, desktop Chrome/Edge) the button triggers it via the
 * stored event; everywhere else it opens a short manual guide - Share -> Add
 * to Home Screen on iPhone/iPad Safari, the menu on other Android browsers,
 * "use Chrome or Edge" on other desktops.
 *
 * The button hides inside an installed (standalone) window, and retires for
 * the rest of the session once the student installs or dismisses the flow.
 *
 * Related, deliberately separate pieces:
 *   lib/pwaMetadata.ts         - manifest + icon metadata + service worker
 *   components/PWAInstallPrompt.tsx - the engagement-timed install popup
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Download, X } from 'lucide-react';
import { BRAND, CARD, INK, INK_SOFT, OVERLAY_BG, RADIUS, RULE, RULE_SOFT, tint } from '../theme';
import {
  PWA_INSTALL_SESSION_KEY,
  consumeDeferredInstallPrompt,
  detectPlatform,
  getDeferredInstallPrompt,
  isAppInstalled,
  isIosSafari,
  runningStandalone,
  subscribeInstall,
} from '../../../lib/pwaInstallState';
import type { BeforeInstallPromptEvent, Platform } from '../../../lib/pwaInstallState';

export {
  PWA_INSTALL_SESSION_KEY,
  consumeDeferredInstallPrompt,
  detectPlatform,
  getDeferredInstallPrompt,
  isAppInstalled,
  isIosSafari,
  runningStandalone,
  subscribeInstall,
};
export type { BeforeInstallPromptEvent, Platform };

/**
 * Fired on window the first time the student completes something meaningful
 * (currently: completing a task). The engagement-timed install popup listens
 * for it as its "show now" signal alongside its own timer.
 */
export const PWA_ENGAGEMENT_EVENT = 'vicharakai:meaningful-action';

/** The iOS share glyph (box with the up arrow), shown inline in the steps. */
function ShareGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: '-2px' }}
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function StepRow({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-extrabold"
        style={{ background: tint(BRAND, 0.12), color: BRAND }}
        aria-hidden="true"
      >
        {n}
      </span>
      <span className="text-sm leading-relaxed" style={{ color: INK }}>
        {children}
      </span>
    </li>
  );
}

/**
 * The install button. Renders nothing when the app already runs standalone or
 * the student finished/dismissed the flow this session. Tap: native install
 * dialog where the browser offers one, otherwise a short platform-specific
 * guide in a bottom sheet (centered card on sm+).
 */
export default function PwaInstallButton({
  className = '',
  variant = 'icon',
}: {
  className?: string;
  variant?: 'icon' | 'landing';
}) {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [, setPromptTick] = useState(0);

  useEffect(() => {
    if (runningStandalone() || isAppInstalled()) return undefined;
    try {
      if (sessionStorage.getItem(PWA_INSTALL_SESSION_KEY)) return undefined;
    } catch {
      /* storage blocked - just show the button */
    }
    setHidden(false);
    return subscribeInstall(() => {
      setPromptTick((t) => t + 1);
      if (isAppInstalled()) setHidden(true);
    });
  }, []);

  if (hidden) return null;

  const retire = (reason: string) => {
    try {
      sessionStorage.setItem(PWA_INSTALL_SESSION_KEY, reason);
    } catch {
      /* storage blocked: the button may return after a reload, which is fine */
    }
    setOpen(false);
    setHidden(true);
  };

  const handleClick = async () => {
    const pending = consumeDeferredInstallPrompt();
    if (pending) {
      try {
        await pending.prompt();
        const choice = await pending.userChoice;
        retire(choice.outcome);
        return;
      } catch {
        /* stale event (already used / page state changed) - manual guide instead */
      }
    }
    setOpen(true);
  };

  const platform = detectPlatform();
  const landingButton = variant === 'landing';

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="Install the VicharakAI app"
        title="Install app"
        className={`${landingButton
          ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold touch-manipulation'
          : 'w-8 h-8 rounded-full flex items-center justify-center touch-manipulation'} ${className}`}
        style={landingButton
          ? {
              border: '1px solid rgba(108, 155, 255, 0.48)',
              background: 'rgba(0, 87, 255, 0.14)',
              color: '#6C9BFF',
              whiteSpace: 'nowrap',
            }
          : { border: `1px solid ${RULE}`, background: 'transparent', color: INK_SOFT }}
        data-testid="button-pwa-install"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        {landingButton ? <span>Install app</span> : null}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex flex-col justify-end sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Install VicharakAI"
          data-testid="sheet-pwa-install"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => retire('dismissed')}
            className="absolute inset-0 vicharak-fade"
            style={{ background: OVERLAY_BG }}
          />
          <div
            className="relative w-full sm:max-w-[400px] overflow-y-auto vicharak-sheet sm:vicharak-popup"
            style={{
              maxHeight: '82vh',
              background: CARD,
              border: `1px solid ${RULE}`,
              borderRadius: `${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`,
            }}
          >
            <div className="flex items-start justify-between px-5 pt-4">
              <span
                className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                style={{ borderRadius: RADIUS.md, background: BRAND, color: '#fff' }}
                aria-hidden="true"
              >
                <Download className="w-5 h-5" />
              </span>
              <button
                type="button"
                onClick={() => retire('dismissed')}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: RULE_SOFT, color: INK }}
                data-testid="button-pwa-install-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pt-3 pb-6">
              <h2 className="text-xl font-extrabold leading-tight" style={{ color: INK }} data-testid="text-pwa-install-title">
                Install VicharakAI
              </h2>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: INK_SOFT }}>
                {platform === 'desktop'
                  ? 'Get VicharakAI on your desktop - it opens in its own window, like an app.'
                  : 'Get VicharakAI on your home screen - it opens full-screen, no browser bar.'}
              </p>

              {platform === 'ios' && (
                <>
                  {!isIosSafari() && (
                    <p
                      className="mt-3 px-3 py-2.5 text-[12px] font-bold leading-relaxed"
                      style={{
                        borderRadius: RADIUS.md,
                        background: tint(BRAND, 0.08),
                        border: `1px solid ${tint(BRAND, 0.25)}`,
                        color: INK,
                      }}
                    >
                      Open this page in Safari first - on iPhone and iPad, only Safari can add
                      apps to the Home Screen.
                    </p>
                  )}
                  <ol className="mt-4 space-y-3" data-testid="list-pwa-install-steps">
                    <StepRow n={1}>
                      Tap the Share button <ShareGlyph /> in Safari&rsquo;s toolbar
                    </StepRow>
                    <StepRow n={2}>
                      Scroll down and tap <strong>Add to Home Screen</strong>
                    </StepRow>
                    <StepRow n={3}>
                      Tap <strong>Add</strong> - VicharakAI appears on your home screen
                    </StepRow>
                  </ol>
                </>
              )}

              {platform === 'android' && (
                <ol className="mt-4 space-y-3" data-testid="list-pwa-install-steps">
                  <StepRow n={1}>
                    Tap the <strong>{'\u22EE'}</strong> menu at the top right of your browser
                  </StepRow>
                  <StepRow n={2}>
                    Choose <strong>Add to Home screen</strong> (or <strong>Install app</strong>)
                  </StepRow>
                  <StepRow n={3}>Confirm - VicharakAI lands on your home screen</StepRow>
                </ol>
              )}

              {platform === 'desktop' && (
                <p className="mt-4 text-sm leading-relaxed" style={{ color: INK }} data-testid="text-pwa-install-desktop">
                  Open this page in <strong>Chrome</strong> or <strong>Edge</strong> and look for
                  the install icon (a small screen with a down arrow) at the right end of the
                  address bar. If it isn&rsquo;t there, the app may already be installed.
                </p>
              )}

              <button
                type="button"
                onClick={() => retire('dismissed')}
                className="vicharak-btn vicharak-btn-primary mt-5 w-full"
                style={{ minHeight: 44 }}
                data-testid="button-pwa-install-done"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
