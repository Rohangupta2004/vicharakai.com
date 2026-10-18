/**
 * Notification preferences (§9): strictly opt-in, with the daily reminder
 * time. Rendered inside Settings only — never during onboarding.
 */
import React, { useEffect, useState } from 'react';
import { getNotifPrefs, enableNotifications, disableNotifications, saveNotifPrefs } from '../../notifications/notify';
import { Button, CheckRow, Field, inputStyle } from '../../ui/primitives';
import { TEXT_MUTED } from '../../ui/tokens';

export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [dailyTime, setDailyTime] = useState('19:00');
  const [denied, setDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getNotifPrefs().then((p) => {
      setEnabled(p.enabled);
      setDailyTime(p.dailyTime);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  const toggle = async (next: boolean) => {
    if (next) {
      const granted = await enableNotifications(dailyTime);
      setEnabled(granted);
      setDenied(!granted);
    } else {
      await disableNotifications();
      setEnabled(false);
    }
  };

  const changeTime = async (t: string) => {
    setDailyTime(t);
    const prefs = await getNotifPrefs();
    await saveNotifPrefs({ ...prefs, dailyTime: t });
  };

  return (
    <div>
      <CheckRow checked={enabled} onChange={(v) => void toggle(v)} testId="check-notifications">
        Remind me to study, review due cards, and flag when I'm behind pace.
        Off by default — nothing is sent unless you turn this on.
      </CheckRow>
      {denied ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '4px 0 10px' }}>
          The browser blocked notifications — allow them in your browser's site settings, then try again.
        </p>
      ) : null}
      {enabled ? (
        <Field label="Daily reminder time">
          <input type="time" value={dailyTime} onChange={(e) => void changeTime(e.target.value)} style={inputStyle} data-testid="input-daily-time" />
        </Field>
      ) : null}
    </div>
  );
}
