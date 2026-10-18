/**
 * Settings tab: exam & syllabus (shared SyllabusPicker — switching exams
 * shows a fresh doubt deck, §13), exam date, notifications, data & privacy,
 * and the PWA install action.
 */
import React, { useState } from 'react';
import { useApp } from '../../state/AppContext';
import SyllabusPicker from '../shared/SyllabusPicker';
import NotificationSettings from './NotificationSettings';
import DataPrivacy from './DataPrivacy';
import { saveProfile } from '../../data/kv';
import { canPromptInstall, promptInstall, isStandalone, isIosSafari } from '../../pwa/install';
import { Button, Field, inputStyle, SectionTitle } from '../../ui/primitives';
import { TEXT, TEXT_MUTED } from '../../ui/tokens';

export default function SettingsScreen() {
  const { profile, refresh } = useApp();
  const [installed, setInstalled] = useState(isStandalone());

  if (!profile) return null;

  const changeExamDate = async (date: string) => {
    await saveProfile({ exam_date: date || null });
    refresh();
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>Settings</h1>

      <SectionTitle>Exam & syllabus</SectionTitle>
      <SyllabusPicker
        selectedExamId={profile.exam_id}
        onLoaded={async (entry) => {
          await saveProfile({ exam_id: entry.exam_id });
          refresh();
        }}
      />
      <div style={{ marginTop: 12 }}>
        <Field label="Exam date">
          <input
            type="date"
            value={profile.exam_date ?? ''}
            onChange={(e) => void changeExamDate(e.target.value)}
            style={inputStyle}
            data-testid="input-settings-exam-date"
          />
        </Field>
      </div>

      <SectionTitle>Notifications</SectionTitle>
      <NotificationSettings />

      <SectionTitle>Add to home screen</SectionTitle>
      {installed ? (
        <p style={{ fontSize: 13, color: TEXT_MUTED }}>Installed — you're using the app.</p>
      ) : isIosSafari() ? (
        <p style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6 }}>
          On iPhone: tap Share, then “Add to Home Screen” for full-screen, offline-ready access.
        </p>
      ) : canPromptInstall() ? (
        <Button onClick={() => void promptInstall().then(setInstalled)} testId="button-install">
          Install app
        </Button>
      ) : (
        <p style={{ fontSize: 13, color: TEXT_MUTED }}>
          Your browser will offer installation once it considers the app ready.
        </p>
      )}

      <SectionTitle>Data & privacy</SectionTitle>
      <DataPrivacy />
    </div>
  );
}
