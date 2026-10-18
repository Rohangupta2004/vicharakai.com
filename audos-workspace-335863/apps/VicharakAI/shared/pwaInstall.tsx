/**
 * PWA install — the small header icon that installs VicharakAI, and the
 * platform-aware "Install VicharakAI" sheet behind it.
 *
 * ONE `beforeinstallprompt` listener lives at module level, registered the
 * moment any screen imports this file — so Chrome's early, once-only event is
 * captured even if it fires before React mounts. Where the native install
 * dialog exists (Android Chrome, desktop Chrome/Edge) the icon triggers it
 * directly via the stored event's prompt(); everywhere else the icon opens a
 * short manual guide — Share → Add to Home Screen on iOS Safari, the ⋮ menu
 * on other Android browsers, "use Chrome or Edge" on other desktops.
 *
 * The icon hides entirely inside an installed (standalone) window, and
 * retires for the rest of the session once the student installs or dismisses
 * the flow (a sessionStorage flag — it returns on the next visit).
 *
 * Related, deliberately separate pieces:
 *   shared/appIcon.ts          — manifest + icon metadata (what an install produces)
 *   components/PWAInstallPrompt.tsx — the engagement-timed install popup,
 *     which shares this module's captured `beforeinstallprompt` event
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Download, X } from 'lucide-react';
import { BRAND, CARD, INK, INK_SOFT, OVERLAY_BG, RADIUS, RULE, RULE_SOFT, tint } from '../theme';

/** Chrome's install event — not yet in the DOM lib's type definitions. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const SESSION_KEY = 'vicharakai:pwa_install_dismissed';

/**
 * Fired on window the first time the student completes something meaningful
 * (currently: completing a task — features/tasks/useTasks dispatches it).
 * The engagement-timed install popup (components/PWAInstallPrompt) listens
 * for it as its "show now" signal alongside its own 30-second timer.
 */
export const PWA_ENGAGEMENT_EVENT = 'vicharakai:meaningful-action';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const subscribers = new Set<() => void>();
const notifyAll = () => subscribers.forEach((notify) => notify());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    /* preventDefault() keeps Chrome's own mini-infobar quiet; the stored
       event powers the header icon instead. */
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyAll();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appInstalled = true;
    try {
      sessionStorage.setItem(SESSION_KEY, 'installed');
    } catch {
      /* storage blocked — appInstalled still hides the icon this visit */
    }
    notifyAll();
  });
}

/** Read the captured install event without consuming it. */
export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/**
 * Take ownership of the captured install event — its prompt() works exactly
 * once. Every subscriber is notified, so the header icon and the popup can
 * never both hold the same event.
 */
export function consumeDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  const pending = deferredPrompt;
  if (!pending) return null;
  deferredPrompt = null;
  notifyAll();
  return pending;
}

/** True once this visit saw the `appinstalled` event. */
export function isAppInstalled(): boolean {
  return appInstalled;
}

/** Notifies on deferred-prompt arrival/consumption and on app install. */
export function subscribeInstall(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/** True inside an already-installed app window — the icon has no job there. */
export function runningStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* very old browser — fall through to the iOS flag */
  }
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  /* iPadOS 13+ reports itself as Macintosh; the touch check tells it apart. */
  const iPadOs = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || iPadOs) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Only Safari itself can add to the iOS home screen — not Chrome/Firefox iOS. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/crios|fxios|edgios|opt\//i.test(ua);
}

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
 * The header install icon. Renders nothing when the app already runs
 * standalone or the student finished/dismissed the flow this session.
 * Tap: native install dialog where the browser offers one, otherwise a
 * short platform-specific guide in a bottom sheet (centered card on sm+).
 */
export default function PwaInstallButton({ className = '' }: { className?: string }) {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  /* Re-render when the module-level deferred prompt arrives or is consumed. */
  const [, setPromptTick] = useState(0);

  useEffect(() => {
    if (runningStandalone() || appInstalled) return undefined;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return undefined;
    } catch {
      /* storage blocked — just show the icon */
    }
    setHidden(false);
    const notify = () => {
      setPromptTick((t) => t + 1);
      if (appInstalled) setHidden(true);
    };
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  if (hidden) return null;

  /** Put the flow away for the rest of the session. */
  const retire = (reason: string) => {
    try {
      sessionStorage.setItem(SESSION_KEY, reason);
    } catch {
      /* storage blocked: the icon may return after a reload, which is fine */
    }
    setOpen(false);
    setHidden(true);
  };

  const handleClick = async () => {
    if (deferredPrompt) {
      const pending = deferredPrompt;
      deferredPrompt = null; // a stored event's prompt() works exactly once
      notifyAll();
      try {
        await pending.prompt();
        const choice = await pending.userChoice;
        retire(choice.outcome);
        return;
      } catch {
        /* stale event (already used / page state changed) — manual guide instead */
      }
    }
    setOpen(true);
  };

  const platform = detectPlatform();

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="Install the VicharakAI app"
        title="Install app"
        className={`w-8 h-8 rounded-full flex items-center justify-center touch-manipulation ${className}`}
        style={{ border: `1px solid ${RULE}`, background: 'transparent', color: INK_SOFT }}
        data-testid="button-pwa-install"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
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
                  ? 'Get VicharakAI on your desktop — it opens in its own window, like an app.'
                  : 'Get VicharakAI on your home screen — it opens full-screen, no browser bar.'}
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
                      Open this page in Safari first — on iPhone and iPad, only Safari can add
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
                      Tap <strong>Add</strong> — VicharakAI appears on your home screen
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
                  <StepRow n={3}>Confirm — VicharakAI lands on your home screen</StepRow>
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
