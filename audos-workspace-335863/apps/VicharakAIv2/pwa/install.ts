/**
 * PWA install prompt capture (§9 trigger 6, §16). Chrome fires
 * `beforeinstallprompt` once at page load — usually before the app mounts —
 * so the event is stashed at module scope.
 */

let stashedPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    stashedPrompt = e;
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as any).standalone)
  );
}

export function canPromptInstall(): boolean {
  return stashedPrompt !== null && !isStandalone();
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
}

/** Trigger the browser's native install dialog. Returns true if accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!stashedPrompt) return false;
  await stashedPrompt.prompt();
  const { outcome } = await stashedPrompt.userChoice;
  if (outcome === 'accepted') {
    stashedPrompt = null;
    return true;
  }
  return false;
}
