/**
 * Profile/settings feature — profile edits (name, goals, exam date), the
 * avatar, sign-out, the Day-7 milestone, streak celebrations, the hidden QA
 * Time Machine entry and the confirmation-gated danger actions.
 *
 * RESET ALL DATA now calls the ONE true reset (services/database/
 * resetService.ts): every study/adaptation table from the central registry
 * is cleared straight from the database — not just the rows a screen
 * happened to have loaded — and the reset verifies itself before reloading.
 */
import { useEffect, useRef, useState } from 'react';
import { isStreakMilestone } from '../../quotes';
import { useVicharakTheme, type VicharakThemeMode } from '../../ThemeContext';
import { clearVicharakLocalState, resetStudentStudyData } from '../../services/database/resetService';
import { markOnboardingReset } from '../onboarding/profileRecovery';
import { fileToAvatarDataUrl, readStoredAvatar, PROFILE_AVATAR_KEY } from './avatar';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';

/** zuno_meta key for the account's light/dark theme choice (cross-device). */
const THEME_META_KEY = 'theme_mode';

export interface SettingsFeature {
  nameDraft: string | null;
  setNameDraft: (v: string | null) => void;
  avatarDataUrl: string | null;
  pickProfileAvatar: (file: File) => Promise<void>;
  goalsDraft: string | null;
  setGoalsDraft: (v: string | null) => void;
  examDateDraft: string | null;
  setExamDateDraft: (v: string | null) => void;
  dailyGoalDraft: string | null;
  setDailyGoalDraft: (v: string | null) => void;
  weeklyGoalDraft: string | null;
  setWeeklyGoalDraft: (v: string | null) => void;
  savingProfile: boolean;
  setSavingProfile: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  /** [FIX 1] The in-app Account & plan slide-up sheet (no navigation away). */
  accountSheetOpen: boolean;
  setAccountSheetOpen: (v: boolean) => void;
  showTimeMachine: boolean;
  setShowTimeMachine: (v: boolean) => void;
  weekMilestoneOpen: boolean;
  dismissWeekMilestone: () => void;
  milestoneStreak: number | null;
  setMilestoneStreak: (v: number | null) => void;
  dangerAction: 'reset' | 'delete' | null;
  setDangerAction: (v: 'reset' | 'delete' | null) => void;
  dangerBusy: boolean;
  confirmDangerAction: () => Promise<void>;
  handleSignOut: () => void;
}

export function useSettings(data: StudentData, toast: ToastFeature): SettingsFeature {
  const { spaceId, profile, day, streak, setSessionId, dbSessionReady, metaQ, metaMap, upsertMeta } = data;
  const { showToast } = toast;

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  /* The profile photo — a compact data URI. ACCOUNT-KEYED in zuno_meta (key
   * profile_avatar) so it follows the login across devices; localStorage is
   * only the instant-boot cache. */
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(() => readStoredAvatar());
  const [goalsDraft, setGoalsDraft] = useState<string | null>(null);
  const [examDateDraft, setExamDateDraft] = useState<string | null>(null);
  const [dailyGoalDraft, setDailyGoalDraft] = useState<string | null>(null);
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [showTimeMachine, setShowTimeMachine] = useState(false);
  const [weekMilestoneOpen, setWeekMilestoneOpen] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState<number | null>(null);
  const [dangerAction, setDangerAction] = useState<'reset' | 'delete' | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);

  const pickProfileAvatar = async (file: File) => {
    const dataUrl = await fileToAvatarDataUrl(file);
    if (!dataUrl) {
      showToast("That photo couldn't be read — mind trying another one?");
      return;
    }
    try {
      localStorage.setItem(PROFILE_AVATAR_KEY, dataUrl);
    } catch {
      /* private browsing — the photo just won't survive a reload */
    }
    // Durable, cross-device — the account's photo.
    void upsertMeta(PROFILE_AVATAR_KEY, dataUrl).catch(() => undefined);
    setAvatarDataUrl(dataUrl);
    showToast('Profile photo updated.');
  };

  /* ACCOUNT-KEYED AVATAR + THEME (one-time migration included): once the
   * verified session and the meta rows load, a value stored in zuno_meta wins
   * and refreshes the local cache; a device-local value with no meta row yet
   * is migrated UP so every future login (any device) sees it. */
  const { mode: themeMode, setMode: setThemeMode } = useVicharakTheme();
  const prefsSyncRef = useRef(false);
  const themeWrittenRef = useRef<string | null>(null);
  useEffect(() => {
    if (prefsSyncRef.current || metaQ.loading || !dbSessionReady) return;
    prefsSyncRef.current = true;
    const storedAvatar = metaMap.get(PROFILE_AVATAR_KEY)?.meta_value || '';
    if (storedAvatar.startsWith('data:image/')) {
      if (storedAvatar !== avatarDataUrl) {
        setAvatarDataUrl(storedAvatar);
        try {
          localStorage.setItem(PROFILE_AVATAR_KEY, storedAvatar);
        } catch {
          /* cache miss only — the state above still shows it this visit */
        }
      }
    } else if (avatarDataUrl) {
      void upsertMeta(PROFILE_AVATAR_KEY, avatarDataUrl).catch(() => undefined);
    }
    const storedTheme = metaMap.get(THEME_META_KEY)?.meta_value;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      themeWrittenRef.current = storedTheme;
      if (storedTheme !== themeMode) setThemeMode(storedTheme as VicharakThemeMode);
    } else {
      themeWrittenRef.current = themeMode;
      // Only a non-default choice is worth a row — dark is the default.
      if (themeMode === 'light') void upsertMeta(THEME_META_KEY, themeMode).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaQ.loading, metaMap, dbSessionReady]);
  /* Theme flips after the reconcile write through to the account. */
  useEffect(() => {
    if (!prefsSyncRef.current || themeWrittenRef.current === themeMode) return;
    themeWrittenRef.current = themeMode;
    void upsertMeta(THEME_META_KEY, themeMode).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  /* Day-7 personalisation milestone — shown once when the student reaches
   * prep day 7. `day` derives from todayISO(), so the QA Time Machine
   * triggers it exactly like seven real days would. */
  useEffect(() => {
    if (!profile || day < 7) return;
    try {
      if (localStorage.getItem(`vicharak_week_milestone_${spaceId}`)) return;
    } catch {
      return; // storage unavailable — skip rather than nag every render
    }
    setWeekMilestoneOpen(true);
  }, [profile, day, spaceId]);
  const dismissWeekMilestone = () => {
    try {
      localStorage.setItem(`vicharak_week_milestone_${spaceId}`, '1');
    } catch {
      /* storage unavailable — the note simply reappears next visit */
    }
    setWeekMilestoneOpen(false);
  };

  /* Streak milestone — a calm full-screen pause, shown once per milestone. */
  useEffect(() => {
    if (!profile || !isStreakMilestone(streak)) return;
    const flag = `vicharak_streak_milestone_${streak}`;
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch {
      return;
    }
    setMilestoneStreak(streak);
  }, [streak, profile]);

  const handleSignOut = () => {
    window.__signOut?.();
    try {
      localStorage.removeItem(`space_session_${spaceId}`);
    } catch {
      /* storage unavailable — the reload below still resets the in-memory session */
    }
    setSessionId('');
    window.location.reload();
  };

  /** Reset All Data / Delete Account — both confirmation-gated in the UI.
   * The reset clears EVERY study/adaptation table (central registry) and
   * verifies itself; auth and paid entitlements are never touched. */
  const confirmDangerAction = async () => {
    if (!dangerAction || dangerBusy) return;
    setDangerBusy(true);
    try {
      const reports = await resetStudentStudyData();
      const leftovers = reports.filter((report) => report.remaining > 0);
      clearVicharakLocalState();
      // A reset re-onboards ON PURPOSE — pause profile recovery (which would
      // otherwise restore the old profile from a previous session) until the
      // student finishes onboarding again. Set AFTER clearVicharakLocalState,
      // which wipes vicharak-prefixed keys including this one.
      markOnboardingReset(spaceId);
      if (leftovers.length > 0) {
        // Be honest: a partial reset is reported, never silently accepted.
        setDangerBusy(false);
        showToast(`Almost done — ${leftovers.map((r) => r.table).join(', ')} still had rows. Tap once more to finish.`);
        return;
      }
      if (dangerAction === 'delete') {
        // Delete Account also ends the session before the app resets.
        handleSignOut();
      } else {
        window.location.reload();
      }
    } catch {
      setDangerBusy(false);
      showToast("That didn't finish — mind trying once more?");
    }
  };

  return {
    nameDraft,
    setNameDraft,
    avatarDataUrl,
    pickProfileAvatar,
    goalsDraft,
    setGoalsDraft,
    examDateDraft,
    setExamDateDraft,
    dailyGoalDraft,
    setDailyGoalDraft,
    weeklyGoalDraft,
    setWeeklyGoalDraft,
    savingProfile,
    setSavingProfile,
    helpOpen,
    setHelpOpen,
    accountSheetOpen,
    setAccountSheetOpen,
    showTimeMachine,
    setShowTimeMachine,
    weekMilestoneOpen,
    dismissWeekMilestone,
    milestoneStreak,
    setMilestoneStreak,
    dangerAction,
    setDangerAction,
    dangerBusy,
    confirmDangerAction,
    handleSignOut,
  };
}
