/**
 * PWAInstallPrompt — the engagement-timed "install VicharakAI" popup.
 *
 * Mounted once at the app root (App.tsx), OUTSIDE the providers, so it can
 * overlay every screen. It waits for real engagement before saying anything:
 * 30 seconds in the app OR the first meaningful action (completing a task —
 * features/tasks/useTasks dispatches PWA_ENGAGEMENT_EVENT), whichever comes
 * first. Never on load.
 *
 * Where the native install dialog exists (Android Chrome, desktop
 * Chrome/Edge) the primary button triggers it via the deferred
 * `beforeinstallprompt` event that shared/pwaInstall.tsx captured at module
 * level — ONE listener for the whole app, shared with the header install
 * icon. On iOS (where that event never fires) the same card shows the
 * Share → Add to Home Screen steps instead. Anywhere else it stays silent —
 * the header icon (shared/pwaInstall.tsx) remains the manual path.
 *
 * Memory (all localStorage, every touch wrapped for private browsing):
 *   pwa_installed            — 'true' once installed; never shows again.
 *   pwa_install_dismissed    — timestamp of a dismissal; quiet for 7 days.
 *
 * Renders as a bottom sheet on phones and a centered modal on sm+ screens,
 * on the app's paper design system (white sheet, hairline rule, brand blue).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  BRAND,
  BRAND_WASH,
  INK,
  INK_SOFT,
  OVERLAY_BG,
  POPOVER_SHADOW,
  RADIUS,
  RULE,
  SHEET,
  tint,
} from '../theme';
import { VicharakLogoMark } from '../ui';
import {
  PWA_ENGAGEMENT_EVENT,
  consumeDeferredInstallPrompt,
  detectPlatform,
  getDeferredInstallPrompt,
  isAppInstalled,
  isIosSafari,
  runningStandalone,
  subscribeInstall,
} from '../shared/pwaInstall';

/* ---------- memory ---------- */

const INSTALLED_KEY = 'pwa_installed';
const DISMISSED_KEY = 'pwa_install_dismissed';
/** A dismissal keeps the popup quiet for a week. */
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Engagement timer — the popup never fires before this unless acted upon. */
const ENGAGEMENT_DELAY_MS = 30_000;

/** localStorage may be unavailable (private browsing) — never let it throw. */
function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private browsing — the in-memory state still hides it this visit */
  }
}

/** True while a previous dismissal is still inside its 7-day cooldown. */
function recentlyDismissed(): boolean {
  const raw = storageGet(DISMISSED_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return true; // unreadable stamp — stay quiet
  return Date.now() - at < DISMISS_COOLDOWN_MS;
}

/* ---------- scoped styles (self-contained — no MOTION_CSS dependency) ---------- */

const PROMPT_CSS = `
@keyframes vicharakPwaRise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vicharakPwaFade { from { opacity: 0; } to { opacity: 1; } }
.vicharak-pwa-rise { animation: vicharakPwaRise 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
.vicharak-pwa-fade { animation: vicharakPwaFade 0.26s ease-out both; }
.vicharak-pwa-card { border-radius: 10px 10px 0 0; }
@media (min-width: 640px) { .vicharak-pwa-card { border-radius: 10px; } }
@media (prefers-reduced-motion: reduce) {
  .vicharak-pwa-rise, .vicharak-pwa-fade { animation-duration: 0.01ms; }
}
/* The popup mounts OUTSIDE AppShell, so it cannot rely on MOTION_CSS having
   been injected yet — these duplicate the app's button language verbatim
   (identical declarations, so double-injection changes nothing). */
.vicharak-pwa-card .vicharak-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.52rem 0.95rem; font-family: var(--f-body, "IBM Plex Sans", system-ui, sans-serif); font-size: 0.86rem; font-weight: 600; border-radius: var(--r, 3px); cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.vicharak-pwa-card .vicharak-btn-primary { background: var(--brand, #1B5CF0); border: 1.5px solid var(--brand, #1B5CF0); color: #fff; }
.vicharak-pwa-card .vicharak-btn-primary:hover { background: var(--brand-deep, #1442B8); border-color: var(--brand-deep, #1442B8); }
.vicharak-pwa-card .vicharak-btn-ghost { background: transparent; border: 1.5px solid var(--brand, #1B5CF0); color: var(--brand, #1B5CF0); }
.vicharak-pwa-card .vicharak-btn-ghost:hover { background: var(--brand-wash, #EDF2FE); }
.vicharak-pwa-card .vicharak-btn:disabled { opacity: 0.45; cursor: default; }
`;

/* ---------- small pieces ---------- */

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

/** One numbered instruction row of the iOS guide. */
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

/* ---------- the popup ---------- */

type PromptMode = 'native' | 'ios';

export default function PWAInstallPrompt() {
  const [mode, setMode] = useState<PromptMode | null>(null);
  const [installing, setInstalling] = useState(false);
  /** True once the student earned the popup (30s in, or one real action). */
  const engagedRef = useRef(false);
  const openedOnceRef = useRef(false);

  useEffect(() => {
    /* Never inside an installed window, never after install or a fresh
       dismissal — the eligibility check runs once, on mount. */
    if (runningStandalone() || isAppInstalled()) return undefined;
    if (storageGet(INSTALLED_KEY) === 'true') return undefined;
    if (recentlyDismissed()) return undefined;

    let disposed = false;

    const tryOpen = () => {
      if (disposed || openedOnceRef.current || !engagedRef.current) return;
      if (isAppInstalled() || storageGet(INSTALLED_KEY) === 'true' || recentlyDismissed()) return;
      const platform = detectPlatform();
      if (platform === 'ios') {
        openedOnceRef.current = true;
        setMode('ios');
      } else if (getDeferredInstallPrompt()) {
        /* Android Chrome / desktop Chrome & Edge — the real install dialog
           is one tap away. Without the captured event there is nothing this
           popup can honestly offer, so it stays silent (the header install
           icon still covers the manual path). */
        openedOnceRef.current = true;
        setMode('native');
      }
    };

    const engage = () => {
      if (engagedRef.current) return;
      engagedRef.current = true;
      tryOpen();
    };

    /* Engagement: 30 seconds in the app OR the first meaningful action —
       whichever arrives first. Never immediately on load. */
    const timer = window.setTimeout(engage, ENGAGEMENT_DELAY_MS);
    window.addEventListener(PWA_ENGAGEMENT_EVENT, engage);

    /* If Chrome's install event arrives after engagement, open then; and if
       the app gets installed by any path, put the popup away for good. */
    const unsubscribe = subscribeInstall(() => {
      if (isAppInstalled()) {
        storageSet(INSTALLED_KEY, 'true');
        setMode(null);
        return;
      }
      tryOpen();
    });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener(PWA_ENGAGEMENT_EVENT, engage);
      unsubscribe();
    };
  }, []);

  if (!mode) return null;

  /** "Not now", the X, or the backdrop — quiet for 7 days. */
  const dismiss = () => {
    storageSet(DISMISSED_KEY, String(Date.now()));
    setMode(null);
  };

  /** Primary CTA on the native path — hands over to the browser's dialog. */
  const handleInstall = async () => {
    const pending = consumeDeferredInstallPrompt();
    if (!pending) {
      dismiss();
      return;
    }
    setInstalling(true);
    try {
      await pending.prompt();
      const choice = await pending.userChoice;
      if (choice.outcome === 'accepted') {
        storageSet(INSTALLED_KEY, 'true');
        setMode(null);
      } else {
        dismiss();
      }
    } catch {
      /* stale event (already used / page state changed) — treat as dismissed */
      dismiss();
    } finally {
      setInstalling(false);
    }
  };

  const iosSafari = mode === 'ios' && isIosSafari();

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Install VicharakAI"
      data-testid="popup-pwa-install"
    >
      <style>{PROMPT_CSS}</style>

      {/* backdrop — blurred, and a tap on it counts as "Not now" */}
      <button
        type="button"
        aria-label="Not now"
        onClick={dismiss}
        className="absolute inset-0 vicharak-pwa-fade"
        style={{
          background: OVERLAY_BG,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: 'none',
          cursor: 'default',
        }}
      />

      <div
        className="vicharak-pwa-card vicharak-pwa-rise relative w-full sm:max-w-[420px] overflow-hidden"
        style={{
          background: SHEET,
          border: `1px solid ${RULE}`,
          boxShadow: `${POPOVER_SHADOW}, 0 -6px 34px ${tint(BRAND, 0.16)}`,
        }}
      >
        {/* slim brand accent along the top edge */}
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 right-0"
          style={{ height: 3, background: BRAND }}
        />

        <div className="flex items-start justify-between px-5 pt-5">
          <span
            className="w-11 h-11 flex items-center justify-center flex-shrink-0"
            style={{
              borderRadius: RADIUS.md,
              background: BRAND_WASH,
              border: `1px solid ${tint(BRAND, 0.3)}`,
            }}
            aria-hidden="true"
          >
            <VicharakLogoMark size={30} fallbackColor={BRAND} />
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
            style={{ background: 'transparent', border: `1px solid ${RULE}`, color: INK_SOFT }}
            data-testid="button-pwa-popup-close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-3.5 pb-5">
          <h2
            className="text-xl font-extrabold leading-tight"
            style={{ color: INK, fontFamily: 'var(--f-head)' }}
            data-testid="text-pwa-popup-title"
          >
            Study smarter on every device
          </h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: INK_SOFT }}>
            Install VicharakAI as an app — it loads instantly, opens full-screen with no
            browser bar, and your plan sits one tap from your home screen.
          </p>

          {mode === 'ios' && (
            <>
              {!iosSafari && (
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
              <ol className="mt-4 space-y-3" data-testid="list-pwa-popup-steps">
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

          {mode === 'native' ? (
            <div className="mt-5 flex flex-col sm:flex-row-reverse gap-2.5">
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={installing}
                className="vicharak-btn vicharak-btn-primary w-full sm:flex-1"
                style={{ minHeight: 46 }}
                data-testid="button-pwa-popup-install"
              >
                {installing ? 'Opening…' : 'Install app'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="vicharak-btn vicharak-btn-ghost w-full sm:w-auto"
                style={{ minHeight: 46 }}
                data-testid="button-pwa-popup-later"
              >
                Not now
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={dismiss}
              className="vicharak-btn vicharak-btn-primary mt-5 w-full"
              style={{ minHeight: 46 }}
              data-testid="button-pwa-popup-done"
            >
              Got it
            </button>
          )}

          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
