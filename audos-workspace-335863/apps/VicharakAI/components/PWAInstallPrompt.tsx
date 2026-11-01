/**
 * Post-sign-in PWA install prompt. It is mounted only in AppShell's unlocked
 * branch, then waits for onboarding, paywall, mood check, or another modal to
 * leave before showing. Chrome/Edge use the deferred native install event;
 * iOS receives Safari's Share → Add to Home Screen instructions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { VicharakLogoMark } from '../ui';
import {
  consumeDeferredInstallPrompt,
  detectPlatform,
  getDeferredInstallPrompt,
  isAppInstalled,
  isIosSafari,
  runningStandalone,
  subscribeInstall,
} from '../shared/pwaInstall';

const INSTALLED_KEY = 'pwa_installed';
const DISMISSED_KEY = 'pwa_install_dismissed';
const SESSION_SHOWN_KEY = 'vicharakai:pwa_install_prompt_shown';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const BLOCKING_OVERLAYS = [
  '[data-testid="screen-onboarding"]',
  '[data-testid="screen-ob-pay"]',
  '[data-testid="screen-paywall"]',
  '[data-testid="mood-check-overlay"]',
  '[aria-modal="true"]',
].join(',');

const BLUE = '#0057FF';
const BLUE_DEEP = '#003AB0';
const BLUE_TINT = '#6C9BFF';
const INK = '#0F1B33';
const MUTED = '#52617A';

function storageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing can block storage; in-memory state still protects this render.
  }
}

function recentlyDismissed(): boolean {
  const value = storageGet(localStorage, DISMISSED_KEY);
  if (!value) return false;
  const dismissedAt = Number(value);
  return !Number.isFinite(dismissedAt) || Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

function markInstalled(): void {
  storageSet(localStorage, INSTALLED_KEY, 'true');
}

function ShareGlyph() {
  return <Share2 className="inline-block w-4 h-4" aria-hidden="true" />;
}

type PromptMode = 'native' | 'ios';

export default function PWAInstallPrompt() {
  const [mode, setMode] = useState<PromptMode | null>(null);
  const [installing, setInstalling] = useState(false);
  const [iosHintActive, setIosHintActive] = useState(false);
  const openedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const iosStepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (runningStandalone() || isAppInstalled()) {
      markInstalled();
      return undefined;
    }
    if (storageGet(localStorage, INSTALLED_KEY) === 'true') return undefined;
    if (recentlyDismissed()) return undefined;
    if (storageGet(sessionStorage, SESSION_SHOWN_KEY) === 'true') return undefined;

    let disposed = false;
    let timer = 0;

    const safeToOpen = () => !document.querySelector(BLOCKING_OVERLAYS);
    const tryOpen = () => {
      if (disposed || openedRef.current || !safeToOpen()) return;
      if (runningStandalone() || isAppInstalled()) {
        markInstalled();
        return;
      }
      if (storageGet(localStorage, INSTALLED_KEY) === 'true' || recentlyDismissed()) return;

      const nextMode: PromptMode | null = detectPlatform() === 'ios'
        ? 'ios'
        : getDeferredInstallPrompt()
          ? 'native'
          : null;
      if (!nextMode) return;

      openedRef.current = true;
      storageSet(sessionStorage, SESSION_SHOWN_KEY, 'true');
      setMode(nextMode);
    };

    const scheduleTryOpen = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tryOpen, 350);
    };

    // Give post-sign-in overlays a render turn before deciding the shell is clear.
    scheduleTryOpen();
    const observer = new MutationObserver(scheduleTryOpen);
    observer.observe(document.body, { childList: true, subtree: true });

    const unsubscribe = subscribeInstall(() => {
      if (isAppInstalled()) {
        markInstalled();
        setMode(null);
      } else {
        scheduleTryOpen();
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      unsubscribe();
    };
  }, []);

  const dismiss = useCallback(() => {
    storageSet(localStorage, DISMISSED_KEY, String(Date.now()));
    setMode(null);
  }, []);

  useEffect(() => {
    if (!mode) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => primaryButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('aria-hidden'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [mode, dismiss]);

  const handleNativeInstall = async () => {
    const pending = consumeDeferredInstallPrompt();
    if (!pending) {
      setMode(null);
      return;
    }
    setInstalling(true);
    try {
      await pending.prompt();
      const choice = await pending.userChoice;
      if (choice.outcome === 'accepted') {
        markInstalled();
        setMode(null);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setInstalling(false);
    }
  };

  const handleIosInstall = () => {
    setIosHintActive(true);
    iosStepsRef.current?.focus();
  };

  if (!mode) return null;

  const iosSafari = mode === 'ios' && isIosSafari();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      data-testid="popup-pwa-install"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(6, 16, 39, 0.56)', backdropFilter: 'blur(5px)' }}
        aria-hidden="true"
        onMouseDown={dismiss}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-benefit"
        tabIndex={-1}
        className="relative w-full overflow-hidden rounded-t-[24px] bg-white px-5 pb-5 pt-6 shadow-2xl sm:max-w-[420px] sm:rounded-[24px] sm:p-6"
        style={{ border: `1px solid ${BLUE_TINT}66`, paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${BLUE}, ${BLUE_DEEP})` }}
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `${BLUE_TINT}22`, border: `1px solid ${BLUE_TINT}66` }}
            aria-hidden="true"
          >
            <VicharakLogoMark size={32} fallbackColor={BLUE} />
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close install prompt"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ color: MUTED, background: '#F1F5FB' }}
            data-testid="button-pwa-popup-close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <h2 id="pwa-install-title" className="mt-4 text-[22px] font-extrabold leading-tight" style={{ color: INK }}>
          Install VicharakAI
        </h2>
        <p id="pwa-install-benefit" className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
          Open it like an app and get your daily plan in one tap.
        </p>

        {mode === 'ios' && (
          <div
            className="mt-4 rounded-2xl p-4"
            style={{ background: `${BLUE_TINT}16`, border: `1px solid ${BLUE_TINT}55` }}
          >
            {!iosSafari && (
              <p className="mb-3 text-xs font-semibold leading-relaxed" style={{ color: INK }}>
                Open VicharakAI in Safari first to add it to your Home Screen.
              </p>
            )}
            <ol
              ref={iosStepsRef}
              tabIndex={-1}
              className="space-y-2.5 text-sm leading-relaxed outline-none"
              style={{ color: INK }}
              aria-label="iPhone and iPad install steps"
            >
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ color: BLUE, background: `${BLUE_TINT}30` }}>1</span>
                <span>Tap Share <ShareGlyph /> in Safari.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ color: BLUE, background: `${BLUE_TINT}30` }}>2</span>
                <span>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</span>
              </li>
            </ol>
            <p className="sr-only" aria-live="polite">
              {iosHintActive ? 'Use Safari Share, then Add to Home Screen.' : ''}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            ref={primaryButtonRef}
            type="button"
            disabled={installing}
            onClick={mode === 'native' ? () => void handleNativeInstall() : handleIosInstall}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-5 text-sm font-extrabold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DEEP} 100%)`, boxShadow: `0 10px 24px ${BLUE}38` }}
            data-testid="button-pwa-popup-install"
          >
            {installing ? 'Opening…' : 'Install'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold"
            style={{ color: BLUE_DEEP, background: '#FFFFFF', border: `1px solid ${BLUE_TINT}88` }}
            data-testid="button-pwa-popup-later"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
