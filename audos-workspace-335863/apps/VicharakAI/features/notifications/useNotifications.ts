/**
 * Notifications feature — browser/PWA reminders: the immediate revision
 * alert, the daily mission reminder at the chosen time, per-task
 * 15-minutes-before alerts and the 8am morning summary.
 * Device-local by nature (Notification permission is per-device).
 * Extracted verbatim from App.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { diffDays, todayISO } from '../../engine';
import { getSystemDate, getSystemNow } from '../../systemDate';
import { IS_IOS } from '../../shared/device';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';

/** zuno_meta key for the account's reminder time (cross-device). */
const REMINDER_TIME_META_KEY = 'notify_time';

/**
 * Safe notification display. Android Chrome (and some other mobile browsers)
 * forbid the `new Notification()` constructor entirely — it throws
 * "Illegal constructor. Use ServiceWorkerRegistration.showNotification()
 * instead." — so notifications must go through the service worker when one
 * is registered. Falls back to the guarded constructor only when no service
 * worker is available (older desktop browsers), and never throws either way.
 */
function showNotification(title: string, options?: NotificationOptions) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const fallback = () => {
    try {
      const notice = new Notification(title, options);
      notice.onclick = () => {
        try {
          window.focus();
        } catch {
          /* focus can be refused */
        }
        notice.close();
      };
    } catch {
      /* The constructor is banned on this browser — nothing to show. */
    }
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (registration) return registration.showNotification(title, options ?? {});
        fallback();
      })
      .catch(fallback);
  } else {
    fallback();
  }
}

export interface NotificationsFeature {
  notificationsOn: boolean;
  reminderTime: string;
  setReminderTimePersist: (time: string) => void;
  notifBannerDismissed: boolean;
  dismissNotifBanner: () => void;
  enableNotifications: () => Promise<void>;
  toggleNotifications: () => Promise<void>;
}

export function useNotifications(data: StudentData, toast: ToastFeature): NotificationsFeature {
  const { spaceId, today, profile, dueRevisions, dueFlagged, dbSessionReady, metaQ, metaMap, upsertMeta } = data;
  const { showToast } = toast;

  const [notificationsOn, setNotificationsOn] = useState(() => localStorage.getItem(`vicharak_notifications_${spaceId}`) === 'on');
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem(`vicharak_reminder_time_${spaceId}`) || '19:00');
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(
    () => localStorage.getItem(`vicharak_notif_banner_${spaceId}`) === 'dismissed',
  );
  const autoNotifRef = useRef(false);

  /* ACCOUNT-KEYED REMINDER TIME: the chosen hour is a user preference, so it
   * lives in zuno_meta (key notify_time) and follows the login across
   * devices; localStorage stays as the instant-boot cache. The on/off switch
   * stays device-local ON PURPOSE — Notification permission is granted per
   * device, and syncing "off" from a phone would silently kill a laptop's
   * reminders. One-time migration: a device-local time that has no meta row
   * yet is written up the first time the verified session loads. */
  const reminderMetaSyncRef = useRef(false);
  useEffect(() => {
    if (reminderMetaSyncRef.current || metaQ.loading || !dbSessionReady) return;
    reminderMetaSyncRef.current = true;
    const stored = metaMap.get(REMINDER_TIME_META_KEY)?.meta_value || '';
    if (/^\d{1,2}:\d{2}$/.test(stored)) {
      if (stored !== reminderTime) {
        setReminderTime(stored);
        try {
          localStorage.setItem(`vicharak_reminder_time_${spaceId}`, stored);
        } catch {
          /* cache miss only — the state above still applies this visit */
        }
      }
      return;
    }
    if (reminderTime && reminderTime !== '19:00') {
      void upsertMeta(REMINDER_TIME_META_KEY, reminderTime).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaQ.loading, metaMap, dbSessionReady]);

  const setReminderTimePersist = (time: string) => {
    setReminderTime(time);
    try {
      localStorage.setItem(`vicharak_reminder_time_${spaceId}`, time);
    } catch {
      /* preference simply won't survive a reload */
    }
    // Durable, cross-device — the account's reminder time.
    void upsertMeta(REMINDER_TIME_META_KEY, time).catch(() => undefined);
  };

  const dismissNotifBanner = () => {
    setNotifBannerDismissed(true);
    try {
      localStorage.setItem(`vicharak_notif_banner_${spaceId}`, 'dismissed');
    } catch {
      /* non-fatal */
    }
  };

  /* Permission drift: an OS-level revoke flips the stored toggle off. */
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (notificationsOn && Notification.permission !== 'granted') {
      setNotificationsOn(false);
      localStorage.setItem(`vicharak_notifications_${spaceId}`, 'off');
    }
  }, [notificationsOn, spaceId]);

  /* Auto-enable reminders: ask once, as soon as the student has a plan.
   * An explicit "off" choice is always respected. */
  useEffect(() => {
    if (autoNotifRef.current || !profile || typeof Notification === 'undefined') return;
    autoNotifRef.current = true;
    if (Notification.permission === 'granted') {
      if (localStorage.getItem(`vicharak_notifications_${spaceId}`) !== 'off') {
        setNotificationsOn(true);
        localStorage.setItem(`vicharak_notifications_${spaceId}`, 'on');
      }
      return;
    }
    if (Notification.permission === 'denied') return;
    if (localStorage.getItem(`vicharak_notif_prompted_${spaceId}`)) return;
    localStorage.setItem(`vicharak_notif_prompted_${spaceId}`, '1');
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setNotificationsOn(true);
        localStorage.setItem(`vicharak_notifications_${spaceId}`, 'on');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, spaceId]);

  /* ---------- THE daily notification (return trigger) ----------
   * ONE per day, at the time the student set. It names the ACTUAL topic and
   * the reason — never a count — and stays SILENT when nothing is due. */
  const missionReminderTag = `vicharak-mission-reminder-${spaceId}`;

  /* What today's notice would say — null means silence. */
  const dailyNotice = (() => {
    const due = dueRevisions[0];
    if (due) {
      const ago = due.studied_on ? diffDays(due.studied_on, today) : 0;
      return {
        title: `${due.topic} is due`,
        body:
          ago > 0
            ? `You studied it ${ago} day${ago === 1 ? '' : 's'} ago — a two-minute recall keeps it fresh.`
            : 'A quick recall today keeps it fresh.',
      };
    }
    const flagged = dueFlagged[0];
    if (flagged) {
      const label = (flagged.topic || '').trim() || (flagged.concept || '').trim() || flagged.subject;
      return {
        title: `${label} is ready to re-solve`,
        body: 'A question you saved is due — your own answer is on the back.',
      };
    }
    return null;
  })();
  const dailyNoticeRef = useRef(dailyNotice);
  dailyNoticeRef.current = dailyNotice;

  const showDailyNotice = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notice = dailyNoticeRef.current;
    if (!notice) return; // nothing due — silence, never a nudge for its own sake
    const dedupeKey = `vicharak_daily_notice_${spaceId}_${todayISO()}`;
    try {
      if (localStorage.getItem(dedupeKey)) return;
      localStorage.setItem(dedupeKey, '1');
    } catch {
      /* still show it — at worst a reload repeats it once */
    }
    showNotification(notice.title, { body: notice.body });
  };
  const nextReminderDate = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const next = getSystemDate();
    next.setHours(hours || 0, minutes || 0, 0, 0);
    if (next.getTime() <= getSystemNow()) next.setDate(next.getDate() + 1);
    return next;
  };
  const cancelPersistentMissionReminder = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      const scheduled = await registration.getNotifications({ tag: missionReminderTag });
      scheduled.forEach((notification) => notification.close());
    } catch {
      /* No active service worker — the in-tab fallback remains available. */
    }
  };
  const scheduleDailyNotice = async (): Promise<() => void> => {
    const at = nextReminderDate(reminderTime);
    const TimestampTrigger = (globalThis as typeof globalThis & {
      TimestampTrigger?: new (timestamp: number) => unknown;
    }).TimestampTrigger;

    /* Persistent trigger (fires even with the tab closed) — scheduled ONLY
     * when something is actually due, with the real topic in the body.
     * Nothing due at scheduling time = nothing scheduled = silence. */
    const notice = dailyNoticeRef.current;
    if ('serviceWorker' in navigator && TimestampTrigger && notice) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const scheduled = await registration.getNotifications({ tag: missionReminderTag });
          scheduled.forEach((notification) => notification.close());
          await registration.showNotification(notice.title, {
            tag: missionReminderTag,
            body: notice.body,
            trigger: new TimestampTrigger(at.getTime()),
          } as NotificationOptions);
          return () => {
            void registration.getNotifications({ tag: missionReminderTag }).then((notifications) => {
              notifications.forEach((notification) => notification.close());
            });
          };
        }
      } catch {
        /* Notification Triggers are optional; fall through to an open-tab timer. */
      }
    }

    const timeout = window.setTimeout(showDailyNotice, Math.max(0, at.getTime() - getSystemNow()));
    return () => window.clearTimeout(timeout);
  };

  useEffect(() => {
    if (!notificationsOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined;
    let cancelled = false;
    let cleanup: () => void = () => undefined;
    void scheduleDailyNotice().then((scheduledCleanup) => {
      if (cancelled) scheduledCleanup();
      else cleanup = scheduledCleanup;
    });
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsOn, reminderTime, spaceId, today]);

  /* The per-task 15-minute alerts and the 8am count summary are GONE by
   * design: one notification per day, at the student's own time, naming one
   * topic and one reason — and silence when nothing is due. */

  /** One re-usable enable path — the banner, the auto-prompt fallback and the
   * Profile toggle all land here. */
  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast(IS_IOS
        ? 'On iPhone, add VicharakAI to your Home Screen first (Share → Add to Home Screen) — then reminders can reach you.'
        : 'Notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Allow notifications in your browser settings to turn reminders on.');
      return;
    }
    setNotificationsOn(true);
    localStorage.setItem(`vicharak_notifications_${spaceId}`, 'on');
    showToast('Reminders are on — one a day at your time, naming the topic that is due. Silent when nothing is.');
  };

  const toggleNotifications = async () => {
    if (notificationsOn) {
      setNotificationsOn(false);
      localStorage.setItem(`vicharak_notifications_${spaceId}`, 'off');
      void cancelPersistentMissionReminder();
      return;
    }
    await enableNotifications();
  };

  return {
    notificationsOn,
    reminderTime,
    setReminderTimePersist,
    notifBannerDismissed,
    dismissNotifBanner,
    enableNotifications,
    toggleNotifications,
  };
}
