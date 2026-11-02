/**
 * Module-level PWA install state. Importing this file registers ONE
 * `beforeinstallprompt` listener, so Chrome's early, once-only event is
 * captured even if it fires before React mounts. Desktop.tsx imports it for
 * that side effect; the install button (apps/VicharakAI/shared/pwaInstall.tsx)
 * and the engagement popup read the same state through it.
 */

/** Chrome's install event - not yet in the DOM lib's type definitions. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const PWA_INSTALL_SESSION_KEY = 'vicharakai:pwa_install_dismissed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const subscribers = new Set<() => void>();

export function notifyInstallSubscribers(): void {
  subscribers.forEach((notify) => notify());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstallSubscribers();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appInstalled = true;
    try {
      sessionStorage.setItem(PWA_INSTALL_SESSION_KEY, 'installed');
    } catch {
      /* storage blocked - appInstalled still hides the button this visit */
    }
    notifyInstallSubscribers();
  });
}

/** Read the captured install event without consuming it. */
export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/**
 * Take ownership of the captured install event - its prompt() works exactly
 * once. Every subscriber is notified so two UIs never hold the same event.
 */
export function consumeDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  const pending = deferredPrompt;
  if (!pending) return null;
  deferredPrompt = null;
  notifyInstallSubscribers();
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

/** True inside an already-installed app window. */
export function runningStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* very old browser - fall through to the iOS flag */
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

/** Only Safari itself can add to the iOS home screen - not Chrome/Firefox iOS. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/crios|fxios|edgios|opt\//i.test(ua);
}
