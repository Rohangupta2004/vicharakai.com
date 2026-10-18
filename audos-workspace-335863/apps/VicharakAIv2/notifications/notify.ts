/**
 * Notification plumbing (§9): strictly OPT-IN. Nothing is requested or sent
 * until the student enables notifications in Settings — and never before
 * onboarding completes. Trigger logic lives in triggers.ts.
 */
import { kvGet, kvSet } from '../data/kv';
import { logConsent } from '../data/consent';

export interface NotifPrefs {
  enabled: boolean;
  /** 'HH:MM' local time for the daily study reminder. */
  dailyTime: string;
  /** trigger key → last fired local date (YYYY-MM-DD). */
  lastFired: Record<string, string>;
}

const KEY = 'notif_prefs';

export async function getNotifPrefs(): Promise<NotifPrefs> {
  return (await kvGet<NotifPrefs>(KEY)) ?? { enabled: false, dailyTime: '19:00', lastFired: {} };
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await kvSet(KEY, prefs);
}

/** Opt in: ask the browser for permission, log the consent decision. */
export async function enableNotifications(dailyTime: string): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  await logConsent('notifications', granted);
  const prefs = await getNotifPrefs();
  await saveNotifPrefs({ ...prefs, enabled: granted, dailyTime });
  return granted;
}

export async function disableNotifications(): Promise<void> {
  const prefs = await getNotifPrefs();
  await saveNotifPrefs({ ...prefs, enabled: false });
  await logConsent('notifications', false);
}

/**
 * Show a notification if permitted. Works while the app is open; when the
 * platform serves a service worker, registration.showNotification is used
 * so notifications also render from the SW context.
 */
export async function notify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body });
      return;
    }
  } catch {
    /* fall through to page-scope notification */
  }
  new Notification(title, { body });
}
