/**
 * Shell: onboarding gate, bottom navigation (Today | Mistakes | Progress |
 * Settings, §4), offline bootstrap, the minute-tick for notification
 * triggers, and the one-time homescreen install nudge (§9 trigger 6).
 */
import React, { useEffect, useState } from 'react';
import { Home, Camera, BarChart3, Settings as SettingsIcon, X } from 'lucide-react';
import { useApp } from './state/AppContext';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import TodayScreen from './components/today/TodayScreen';
import MistakesScreen from './components/mistakes/MistakesScreen';
import ProgressScreen from './components/progress/ProgressScreen';
import SettingsScreen from './components/settings/SettingsScreen';
import { initOffline } from './pwa/offline';
import { evaluateTriggers } from './notifications/triggers';
import { canPromptInstall, promptInstall } from './pwa/install';
import { kvGet, kvSet } from './data/kv';
import { ACCENT, BORDER, CARD, FONT, PAGE, TEXT, TEXT_MUTED, TOUCH } from './ui/tokens';

type Tab = 'today' | 'mistakes' | 'progress' | 'settings';

const TABS: Array<{ id: Tab; label: string; Icon: typeof Home }> = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'mistakes', label: 'Mistakes', Icon: Camera },
  { id: 'progress', label: 'Progress', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export default function AppShell() {
  const { ready, profile, refresh } = useApp();
  const [tab, setTab] = useState<Tab>('today');
  const [startInReview, setStartInReview] = useState(false);
  const [showInstallNudge, setShowInstallNudge] = useState(false);

  useEffect(() => {
    void initOffline();
    void evaluateTriggers();
    const timer = setInterval(() => void evaluateTriggers(), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Homescreen nudge: once, only after onboarding, only when installable.
  useEffect(() => {
    if (!profile?.onboarding_complete) return;
    void kvGet<boolean>('install_nudge_shown').then((shown) => {
      if (!shown && canPromptInstall()) setShowInstallNudge(true);
    });
  }, [profile?.onboarding_complete]);

  if (!ready) return null;

  if (!profile?.onboarding_complete) {
    return <OnboardingFlow onComplete={refresh} />;
  }

  const dismissNudge = () => {
    setShowInstallNudge(false);
    void kvSet('install_nudge_shown', true);
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: PAGE, fontFamily: FONT }}>
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {tab === 'today' && (
          <TodayScreen
            onOpenReviews={() => {
              setStartInReview(true);
              setTab('mistakes');
            }}
          />
        )}
        {tab === 'mistakes' && (
          <MistakesScreen startInReview={startInReview} onReviewExit={() => setStartInReview(false)} />
        )}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      {showInstallNudge ? (
        <div style={{ position: 'fixed', bottom: 76, left: 12, right: 12, zIndex: 60, maxWidth: 536, margin: '0 auto', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 13, color: TEXT }}>Add to your home screen — works offline.</p>
          <button type="button" onClick={() => void promptInstall().then(dismissNudge)} style={{ minHeight: TOUCH, padding: '0 14px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' }} data-testid="button-nudge-install">
            Install
          </button>
          <button type="button" aria-label="Dismiss" onClick={dismissNudge} style={{ width: TOUCH, height: TOUCH, border: 'none', background: 'transparent', color: TEXT_MUTED, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      ) : null}

      <nav aria-label="Main" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', background: CARD, borderTop: `1px solid ${BORDER}`, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              data-testid={`nav-${id}`}
              style={{ flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'transparent', color: active ? ACCENT : TEXT_MUTED, cursor: 'pointer' }}
            >
              <Icon size={22} strokeWidth={active ? 2.6 : 2} />
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 600 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
