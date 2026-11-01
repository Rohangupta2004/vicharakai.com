/**
 * AppShell — the application shell: assembles every feature hook ONCE,
 * provides the AppController, renders the gates (loading → re-auth →
 * onboarding → trial-expiry paywall) and composes the screens, overlays
 * and navigation. No feature/business logic lives here — only wiring.
 *
 * TODAY is the default app surface (founder instruction, 2026-09-30: one
 * consistent main view on every open) and Vicharree remains a primary routed
 * screen. NAVIGATION IS RESPONSIVE (founder instruction, 2026-09-30): on
 * desktop (≥768px) the LEFT SIDEBAR carries every destination; on mobile
 * (<768px) the BOTTOM TAB BAR is the one nav surface — there is NO top tab
 * bar at any width. Vicharee opens from the sidebar on desktop and from the
 * floating Vicharree launcher on mobile. Chat is never a popup, overlay or
 * split panel.
 */
/* eslint-disable */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  MOTION_CSS,
  ON_AMBER,
  PAGE_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from '../theme';
import { VicharakBottomNav, VicharakSidebar, consumeRequestedTab, type VicharakTab } from '../ui';
import { useVicharakTheme } from '../ThemeContext';
import CalendarTab from '../CalendarTab';
import DoubtsTab from '../DoubtsTab';
import TestScoresTab from '../TestScoresTab';
import PaywallScreen from '../PaywallScreen';
import SyllabusScreen from '../SyllabusScreen';
import { examLabelFromId } from '../customExam';
import { localSessionAuthState } from '../sessionGuard';
import { trackEventOncePerDay } from '../shared/track';
import { useToast } from '../shared/useToast';
import { consumeOutboxWarnings, OUTBOX_WARNING_EVENT } from '../services/database/writeOutbox';
import { STUDENT_DATA_WRITE_FAILED_EVENT, useStudentData } from './StudentDataContext';
import { AppContextProvider, type AppController } from './AppContext';
import { useAccess } from '../features/access/useAccess';
import { usePlanEngine } from '../features/plan/usePlanEngine';
import { useMastery } from '../features/mastery/useMastery';
import { useTasks } from '../features/tasks/useTasks';
import { useSyllabusActions } from '../features/syllabus/useSyllabusActions';
import { useDoubts } from '../features/doubts/useDoubts';
import { useTests } from '../features/tests/useTests';
import { useTestAnalysis } from '../features/testAnalysis/useTestAnalysis';
import { useCoach } from '../features/coach/useCoach';
import { useNotifications } from '../features/notifications/useNotifications';
import { useSettings } from '../features/profile/useSettings';
import { useOnboarding } from '../features/onboarding/useOnboarding';
import { useProfileRecovery } from '../features/onboarding/profileRecovery';
import OnboardingFlow from '../features/onboarding/OnboardingFlow';
import TodayScreen from '../features/today/TodayScreen';
import MoodCheckOverlay from '../features/today/MoodCheckOverlay';
import CoachScreen from '../features/coach/CoachScreen';
import DashboardScreen from '../features/dashboard/DashboardScreen';
import TestAnalysisScreen from '../features/testAnalysis/TestAnalysisScreen';
import FreeGapAnalysis, { type PendingUpload } from '../features/testAnalysis/FreeGapAnalysis';
import ToolsScreen from '../features/tools/ToolsScreen';
import PremiumScreen from '../features/premium/PremiumScreen';
import ProfileScreen from '../features/profile/ProfileScreen';
import ProfileOverlays from '../features/profile/ProfileOverlays';
import TaskOverlays from '../features/tasks/TaskOverlays';
import TaskEntrySheet from '../features/tasks/TaskEntrySheet';
import DoubtOverlays from '../features/doubts/DoubtOverlays';
import TestOverlays from '../features/tests/TestOverlays';
import ToastViewport from '../shared/ToastViewport';
import PracticeScreen from '../features/practice/PracticeScreen';
import VisionBoardScreen from '../features/visionBoard/VisionBoardScreen';
import PYQAdminScreen from '../pyq/PYQAdminScreen';
import VicharreeLauncher from '../components/VicharreeLauncher';
import { MOOD_FLOW_DONE_EVENT } from '../features/coach/vichareeSignals';
import {
  hardcodedFallbackByExam,
  SYLLABI_SYNCED_EVENT,
  SYNC_EXAM_IDS,
  useSyllabusCatalog,
} from '../data/syllabusRuntime';
import { buildTagCatalog } from '../features/doubts/autoTag';

/**
 * THE one boot/loading screen. Every pre-shell wait (profile read, plan read,
 * subscription/trial check, profile recovery) renders THIS exact DOM, so a
 * cold load paints ONE stable loading state and then the real UI. The old
 * gates each drew their own layout (spinner+text → bare Loader2 → shell), so
 * landing visibly repainted three times — the "triple flash".
 */
function BootScreen({
  rootClass,
  shellStyle,
  label,
  testId,
}: {
  rootClass: string;
  shellStyle: CSSProperties;
  label: string;
  testId?: string;
}) {
  return (
    <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 w-full`} style={shellStyle}>
      <style>{MOTION_CSS}</style>
      <div
        className="animate-spin rounded-full h-8 w-8"
        style={{ border: `2px solid ${BORDER}`, borderTopColor: AMBER }}
      />
      <p className="text-sm" style={{ color: TEXT_MUTED }} data-testid={testId}>
        {label}
      </p>
    </div>
  );
}

export default function AppShell() {
  /* ---------- feature assembly (order = dependency order) ---------- */
  const data = useStudentData();
  const toast = useToast();
  useEffect(() => {
    const showWarning = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) {
        consumeOutboxWarnings();
        toast.showToast(message);
      }
    };
    window.addEventListener(OUTBOX_WARNING_EVENT, showWarning);
    const buffered = consumeOutboxWarnings();
    if (buffered.length > 0) toast.showToast(buffered.join(' '));
    return () => window.removeEventListener(OUTBOX_WARNING_EVENT, showWarning);
  }, [toast.showToast]);
  const { refresh: refreshSyllabusCatalog } = useSyllabusCatalog();
  const [syncingSyllabi, setSyncingSyllabi] = useState(false);
  const [syllabiProgress, setSyllabiProgress] = useState('');
  const [isWorkspaceAdmin, setIsWorkspaceAdmin] = useState(false);
  useEffect(() => {
    const requested = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1';
    if (!requested) {
      setIsWorkspaceAdmin(false);
      return;
    }
    const sessionId = String((window as any).__audosAcceptedSessionId || '');
    if (!sessionId.startsWith('wses_')) {
      setIsWorkspaceAdmin(false);
      return;
    }
    let cancelled = false;
    void fetch(`/api/hooks/execute/${data.spaceId}/vicharakai-admin-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
      credentials: 'include',
      body: '{}',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        const result = payload && typeof payload.data === 'object' ? payload.data : payload;
        if (!cancelled) setIsWorkspaceAdmin(response.ok && result?.isAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setIsWorkspaceAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.spaceId]);
  const access = useAccess(data, toast);
  const plan = usePlanEngine(data);
  const mastery = useMastery(data);
  const tasks = useTasks(data, toast, mastery, access);
  const syllabus = useSyllabusActions(data, toast, tasks);
  const doubts = useDoubts(data, toast, access);
  const tests = useTests(data, toast, access, tasks);
  /* One owner for every mock-analysis read/write. The analysis screen and the
   * generated-test overlay consume this same feature instance. */
  const analysis = useTestAnalysis(data, toast, access, tests);
  const coach = useCoach(data, toast, access, tasks, plan, doubts);
  const notifications = useNotifications(data, toast);
  const settings = useSettings(data, toast);
  const onboarding = useOnboarding(data, toast);
  /* Onboarding-loop fix: before the `!profile` gate may show onboarding to a
   * SIGNED-IN student, recovery checks the durable email-keyed evidence (a
   * profile from a previous session, a trial record, an active subscription)
   * and restores the profile instead — a returning or PAYING student is never
   * marched through onboarding again just because a fresh login minted a new
   * session id. See features/onboarding/profileRecovery.ts. */
  const profileRecovery = useProfileRecovery(data, access);

  useEffect(() => {
    const onWriteFailure = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      toast.showToast(message || "That change didn't save — try once more.");
    };
    window.addEventListener(STUDENT_DATA_WRITE_FAILED_EVENT, onWriteFailure);
    return () => window.removeEventListener(STUDENT_DATA_WRITE_FAILED_EVENT, onWriteFailure);
  }, [toast.showToast]);

  const persistAiExplanation = async (row: Parameters<typeof doubts.updateDoubt>[0], text: string) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await doubts.updateDoubt(row, { ai_explanation: text });
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 750 * 2 ** attempt));
        }
      }
    }
    console.warn('[vicharakai] AI explanation save failed after retries', lastError);
    toast.showToast("The explanation is still on screen, but it didn't save to your Mistake Book — tap Explain again to retry.");
  };

  /* ---------- navigation ----------
   * Vicharree is a real, full-screen destination — never an overlay. TODAY
   * is the default surface (founder instruction, 2026-09-30): every open
   * lands on the same consistent main view — the Today tab with the sidebar
   * layout — and the mood flow below hands off to it too, so no different
   * layouts appear on different opens. */
  const [baseTab, setBaseTab] = useState<VicharakTab>('today');
  const setTab = useCallback((next: VicharakTab) => setBaseTab(next), []);
  const tab: VicharakTab = baseTab;

  /* Finishing the mood check always lands the student on the SAME main view
   * — the Today tab with the sidebar layout (founder instruction,
   * 2026-09-30). The plan message from useCoach still waits in Vicharee,
   * one tap away. */
  useEffect(() => {
    const openToday = () => setTab('today');
    window.addEventListener(MOOD_FLOW_DONE_EVENT, openToday);
    return () => window.removeEventListener(MOOD_FLOW_DONE_EVENT, openToday);
  }, [setTab]);

  /* PERF: stable handler so the memoized bottom nav skips re-rendering on
   * unrelated state changes (setSyllabusPickerOpen is a stable setter). */
  const openSyllabusPickerFromNav = useCallback(
    () => tasks.setSyllabusPickerOpen(true),
    [tasks.setSyllabusPickerOpen],
  );
  /* Tab requests left by a deep link or an older build's bottom nav. */
  useEffect(() => {
    const apply = () => {
      const t = consumeRequestedTab();
      if (t) setTab(t);
    };
    apply();
    window.addEventListener('openApp', apply);
    return () => window.removeEventListener('openApp', apply);
  }, [setTab]);

  /* LANDING → SUBSCRIPTION DEEP LINK: the landing page's pricing CTAs stamp
   * this flag before opening sign-in, so a visitor who clicked a plan lands
   * on the subscription surface — not a generic home screen. A student with
   * a profile gets the paywall modal directly; a brand-new student is already
   * headed into onboarding, whose final step IS the plan screen, so the flag
   * is simply consumed. Consumed once, then removed. */
  useEffect(() => {
    if (data.profileQ.loading) return;
    let intent = '';
    try {
      intent = localStorage.getItem('vicharakai_postlogin_intent') || '';
      if (intent) localStorage.removeItem('vicharakai_postlogin_intent');
    } catch {
      /* storage unavailable — nothing to consume */
    }
    if (intent === 'subscription' && data.profile && access.accessStatus.status !== 'subscribed') {
      // Lands them on the Premium tab — the same surface the in-app CTAs open.
      access.openPaywall(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.profileQ.loading, data.profile?.id]);

  /* Retention signal: the student came back on day 2, 3 or 7 after signing up
   * (data.day is 1-based off the profile's start_date). Once per calendar day
   * — the localStorage marker keeps a reload or a tab switch from reporting
   * the same return twice. */
  useEffect(() => {
    const dayNumber = data.day;
    if (!data.profile || (dayNumber !== 2 && dayNumber !== 3 && dayNumber !== 7)) return;
    trackEventOncePerDay(data.spaceId, 'last_day_returned_fired', data.today, 'day_returned', {
      day_number: dayNumber,
    });
  }, [data.profile?.id, data.day, data.today, data.spaceId]);

  /* LANDING FREE-ANALYSIS HANDOFF: the signed-out page's free test-analysis
     tool stashes the visitor's paper / typed mistakes in localStorage
     (vicharakai_test_upload_pending) and opens sign-in. Once the new student
     is through onboarding and inside the shell, pick the payload up ONCE, run
     the free gap analysis over it, and clear the key so it never replays. */
  const [freeAnalysis, setFreeAnalysis] = useState<PendingUpload | null>(null);
  const freeAnalysisConsumed = useRef(false);
  useEffect(() => {
    if (freeAnalysisConsumed.current) return;
    if (!data.profile || !access.gateUnlocked) return;
    let raw = '';
    try {
      raw = localStorage.getItem('vicharakai_test_upload_pending') || '';
    } catch {
      raw = '';
    }
    if (!raw) return;
    freeAnalysisConsumed.current = true;
    try {
      localStorage.removeItem('vicharakai_test_upload_pending');
    } catch {
      /* storage unavailable — the state below still drives the one-time view */
    }
    try {
      const parsed = JSON.parse(raw) as PendingUpload;
      if (parsed && (parsed.type === 'file' || parsed.type === 'text')) setFreeAnalysis(parsed);
    } catch {
      /* malformed payload — nothing to show */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.profile?.id, access.gateUnlocked]);

  const syncSyllabi = async () => {
    if (syncingSyllabi) return;
    setSyncingSyllabi(true);
    setSyllabiProgress(`0/${SYNC_EXAM_IDS.length}`);
    toast.showToast(`Syncing official syllabi — 0/${SYNC_EXAM_IDS.length}…`);
    const fallbackByExam = hardcodedFallbackByExam();
    const reports: Array<Record<string, any>> = [];
    let cursor = 0;
    let completed = 0;

    const worker = async () => {
      while (cursor < SYNC_EXAM_IDS.length) {
        const examId = SYNC_EXAM_IDS[cursor++];
        try {
          const response = await fetch(`/api/hooks/execute/${data.spaceId}/apify-syllabus-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              examIds: [examId],
              fallbackByExam: { [examId]: fallbackByExam[examId] ?? [] },
            }),
          });
          const payload = (await response.json()) as Record<string, any>;
          const result = payload && typeof payload.data === 'object' ? payload.data : payload;
          if (!response.ok || result?.success !== true) throw new Error(String(result?.error || 'sync failed'));
          reports.push(...(Array.isArray(result.reports) ? result.reports : []));
        } catch (error) {
          reports.push({ exam_id: examId, source: 'error', rows: 0, error: String(error) });
        }
        completed += 1;
        setSyllabiProgress(`${completed}/${SYNC_EXAM_IDS.length}`);
        if (completed % 5 === 0 || completed === SYNC_EXAM_IDS.length) {
          toast.showToast(`Syncing official syllabi — ${completed}/${SYNC_EXAM_IDS.length}…`);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: 3 }, worker));
      refreshSyllabusCatalog();
      window.dispatchEvent(new CustomEvent(SYLLABI_SYNCED_EVENT));
      const scraped = reports.filter((report) => report.source === 'apify').length;
      const fallback = reports.filter((report) => report.source === 'hardcoded-fallback').length;
      const failed = reports.filter((report) => !report.rows).length;
      toast.showToast(
        `Syllabi synced — ${scraped} scraped, ${fallback} kept from the built-in catalogue${failed ? `, ${failed} failed` : ''}.`,
      );
    } finally {
      setSyncingSyllabi(false);
      setSyllabiProgress('');
    }
  };

  const controller: AppController = {
    data,
    toast,
    access,
    plan,
    mastery,
    tasks,
    syllabus,
    doubts,
    tests,
    analysis,
    coach,
    notifications,
    settings,
    onboarding,
    tab,
    setTab,
  };

  const { mode: themeMode } = useVicharakTheme();
  /* The student's chosen theme drives ONE class on the app root — theme.ts
     swaps every token under `.vicharak-dark`, so all screens flip together.
     Today is a flat, clean page by design, so the paper grain is suppressed
     while THAT tab is on screen; every other tab keeps the texture. */
  const rootClass = `vicharak-app${themeMode === 'dark' ? ' vicharak-dark' : ''}${
    baseTab === 'today' ? ' vicharak-plain' : ''
  }`;
  const shellStyle: CSSProperties = { background: PAGE_BG, color: TEXT, minHeight: '100%', height: '100%' };

  const {
    profile,
    profileQ,
    itemsQ,
    items,
    studentItems,
    scoreEntries,
    examDef,
    savedExamLabel,
    examDate,
    pace,
    taskDetails,
    today,
    spaceId,
    flaggedRows,
    quickAddSubjects,
    resultsQ,
    activeSyllabusExam,
    progressRows,
    attemptRows,
    planSessionError,
    authGateNeeded,
    setAuthGateNeeded,
    mockNudgeLine,
  } = data;

  /* ---------- gate 1: ONE loading screen for the whole boot ----------
   * Profile, plan AND the subscription/trial lookups all resolve behind the
   * SAME screen. They used to be three separate gates with three different
   * layouts, so a cold landing repainted three times (spinner+text → bare
   * Loader2 → shell). Now the app renders exactly once when the data is in. */
  const accessResolving =
    Boolean(profile) &&
    (access.accessChecking ||
      (!access.gateUnlocked && (access.subscriptionsQ.loading || access.trialsQ.loading)));
  if (profileQ.loading || (profile && itemsQ.loading && items.length === 0) || accessResolving) {
    return (
      <AppContextProvider value={controller}>
        <BootScreen
          rootClass={rootClass}
          shellStyle={shellStyle}
          label="One sec — remembering where we left off…"
          testId="text-boot-loading"
        />
      </AppContextProvider>
    );
  }

  /* ---------- gate 2: session not verified / expired ---------- */
  if (planSessionError || authGateNeeded) {
    const pendingOtp = localSessionAuthState() === 'pending';
    return (
      <AppContextProvider value={controller}>
        <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 px-6 text-center w-full`} style={shellStyle}>
          <style>{MOTION_CSS}</style>
          <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Mail className="w-7 h-7" />
          </span>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT }} data-testid="text-session-reauth-title">
            {pendingOtp ? 'Verify your email to continue' : 'Please sign in again'}
          </h1>
          <p className="text-sm max-w-sm leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-session-reauth-body">
            {pendingOtp
              ? "Almost there — your sign-in isn't finished yet. Enter the one-time code we email you and your study plan will be right here waiting."
              : 'Your session has expired or needs a fresh verification. Sign in with your email and the code we send you — your plan, streak and progress are all saved safely.'}
          </p>
          <button
            type="button"
            onClick={settings.handleSignOut}
            className="vicharak-btn vicharak-btn-primary mt-2"
            style={{ minHeight: 44 }}
            data-testid="button-session-reauth"
          >
            {pendingOtp ? 'Verify my email' : 'Sign in again'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthGateNeeded(false);
              profileQ.refresh();
              itemsQ.refresh();
            }}
            className="text-[12px] font-bold"
            style={{ color: TEXT_MUTED }}
            data-testid="button-session-retry"
          >
            I've already verified — try again
          </button>
        </div>
      </AppContextProvider>
    );
  }

  /* ---------- gate 3: load error ---------- */
  if (profileQ.error || itemsQ.error) {
    return (
      <AppContextProvider value={controller}>
        <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 px-6 text-center w-full`} style={shellStyle}>
          <style>{MOTION_CSS}</style>
          <p className="text-sm" style={{ color: DANGER }}>
            Your study plan couldn't load just now. Your saved work is still safe.
          </p>
          <button
            type="button"
            onClick={() => {
              profileQ.refresh();
              itemsQ.refresh();
            }}
            className="vicharak-btn vicharak-btn-primary"
            style={{ minHeight: 44 }}
          >
            Let's try that again
          </button>
        </div>
      </AppContextProvider>
    );
  }

  /* ---------- gate 4: entitlement verification ---------- */
  if (profile && access.entitlementError) {
    return (
      <AppContextProvider value={controller}>
        <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 px-6 text-center w-full`} style={shellStyle}>
          <style>{MOTION_CSS}</style>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT }}>We couldn’t verify your access</h1>
          <p className="text-sm max-w-sm leading-relaxed" style={{ color: TEXT_SECONDARY }} role="alert">
            Your study data is safe. Check your connection, then try again — access stays locked until the server confirms your trial or plan.
          </p>
          <button type="button" onClick={access.retryEntitlement} className="vicharak-btn vicharak-btn-primary" style={{ minHeight: 44 }}>
            Try again
          </button>
        </div>
      </AppContextProvider>
    );
  }

  /* ---------- gate 5: onboarding ----------
   * Order matters: a signed-in student with no session-scoped profile row is
   * NOT necessarily new — recovery first restores their profile from previous
   * sessions (or their paid/trial entitlement). Only a student with no
   * durable evidence of a finished onboarding ever sees the flow. */
  if (!profile) {
    if (profileRecovery.blocking) {
      if (profileRecovery.status === 'error') {
        return (
          <AppContextProvider value={controller}>
            <div className={`${rootClass} flex flex-col items-center justify-center gap-3 py-20 px-6 text-center w-full`} style={shellStyle}>
              <style>{MOTION_CSS}</style>
              <h1 className="text-xl font-extrabold" style={{ color: TEXT }}>We couldn’t restore your profile yet</h1>
              <p className="text-sm max-w-sm leading-relaxed" style={{ color: TEXT_SECONDARY }} role="alert">
                Your saved exam and study data are still safe. Check your connection, then retry — onboarding stays hidden while recovery is unresolved.
              </p>
              <button type="button" onClick={profileRecovery.retry} className="vicharak-btn vicharak-btn-primary" style={{ minHeight: 44 }}>
                Retry profile recovery
              </button>
            </div>
          </AppContextProvider>
        );
      }
      return (
        <AppContextProvider value={controller}>
          <BootScreen
            rootClass={rootClass}
            shellStyle={shellStyle}
            label="Welcome back — restoring your plan…"
            testId="text-profile-recovery"
          />
        </AppContextProvider>
      );
    }
    return (
      <AppContextProvider value={controller}>
        <OnboardingFlow />
      </AppContextProvider>
    );
  }

  /* ---------- gate 6: trial-expiry paywall ----------
   * The subscription/trial lookups were already awaited by gate 1, so by the
   * time this runs the verdict is final — no second spinner, no flash. */
  if (!access.gateUnlocked) {
    return (
      <AppContextProvider value={controller}>
        <PaywallScreen
          feature={null}
          blocking
          trialEnded
          /* A student with entitlement rows has PAID before: their plan
             lapsed, they did not run out of trial, and being told otherwise
             at the one moment they are deciding whether to pay again is the
             worst possible misread of their history. */
          subscriptionLapsed={(access.subscriptionsQ.data ?? []).length > 0}
          spaceId={spaceId}
          examId={profile?.exam ?? null}
          examLabel={savedExamLabel || null}
          userEmail={access.paidSessionEmail}
          onPaymentSuccess={access.handlePaymentSuccess}
          onClose={() => undefined}
        />
      </AppContextProvider>
    );
  }

  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const examName = examDef?.name ?? (savedExamLabel || examLabelFromId(profile.exam));

  /* ---------- the shell ---------- */
  return (
    <AppContextProvider value={controller}>
      <div className={`${rootClass} relative flex flex-col md:flex-row w-full min-h-0`} style={shellStyle}>
        <style>{MOTION_CSS}</style>

        {/* Hidden operations control: visible only on ?admin=1. */}
        {isWorkspaceAdmin && (
          <button
            type="button"
            disabled={syncingSyllabi}
            onClick={() => void syncSyllabi()}
            className="fixed top-3 left-3 z-[94] inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-extrabold disabled:opacity-60 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-sync-syllabi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingSyllabi ? 'animate-spin' : ''}`} />
            {syncingSyllabi ? `Syncing ${syllabiProgress}` : 'Sync Syllabi'}
          </button>
        )}

        {/* Desktop-only left sidebar (≥768px, pure CSS classes); the bottom
            nav takes over below 768px. It renders on EVERY tab — including
            Vicharee, where it is the desktop way back. PYQ Admin appears
            only for the workspace admin (?admin=1). */}
        <VicharakSidebar
          active={tab}
          onSelect={setTab}
          showPyqAdmin={isWorkspaceAdmin}
        />

        <div className="flex-1 flex flex-col min-h-0 md:min-w-0">
          {/* NO top tab bar (founder instruction, 2026-09-30): on mobile the
              bottom tab bar is the one nav surface, on desktop the left
              sidebar is. Vicharee opens from the sidebar (desktop) or the
              floating Vicharree launcher below (mobile), and its own ✕
              returns to Today. */}

          {baseTab === 'coach' && <CoachScreen onClose={() => setTab('today')} />}

          {baseTab === 'today' && <TodayScreen />}

          {baseTab === 'calendar' && (
            <div className="flex-1 min-h-0 w-full lg:max-w-[1000px] lg:mx-auto">
              <CalendarTab
                items={studentItems}
                scores={scoreEntries}
                examDef={examDef}
                examId={profile.exam}
                examDate={examDate}
                pace={pace}
                startDate={profile.start_date}
                today={today}
                recommendedNext={plan.tomorrowPicks[0]}
                taskDetails={taskDetails}
                onUpdateTask={tasks.updateCalendarTask}
                doubts={flaggedRows}
              />
            </div>
          )}

          {baseTab === 'doubts' && (
            <DoubtsTab
              rows={flaggedRows}
              spaceId={spaceId}
              subjects={subjectNames.length > 0 ? subjectNames : quickAddSubjects}
              catalog={buildTagCatalog(data.topicPickerSubjects)}
              examLabel={data.topicPickerExamLabel}
              canAskAi={access.access.premiumUnlocked}
              onAiCharged={access.chargeAi}
              saving={doubts.savingFlag}
              onSave={doubts.saveFlagged}
              onSnap={doubts.snapMistake}
              onRetag={(row, subject) => void doubts.correctTag(row, subject)}
              onRemove={(row) => void doubts.removeFlagged(row)}
              onUpdateDraft={(row, patch) => void doubts.updateDoubt(row, patch)}
              gradeSaving={doubts.savingFlaggedDetail}
              onGrade={(row, grade) => doubts.gradeFlagged(row, grade)}
              onExplainBlocked={() => access.openPaywall('chat')}
              onPersistExplanation={(row, text) => void persistAiExplanation(row, text)}
              onPracticeTest={() => tests.setFlaggedTestOpen(true)}
            />
          )}

          {baseTab === 'scores' && (
            <div className="flex-1 min-h-0 w-full lg:max-w-[1000px] lg:mx-auto">
              {resultsQ.error && (
                <div
                  className="mx-5 sm:mx-8 mt-4 px-3.5 py-3 text-center"
                  role="alert"
                  style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.08), border: `1px solid ${tint(DANGER, 0.3)}` }}
                  data-testid="scores-load-error"
                >
                  <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                    Your score history couldn't refresh just now. Previously saved tests are still safe.
                  </p>
                  <button
                    type="button"
                    onClick={() => resultsQ.refresh()}
                    className="vicharak-btn vicharak-btn-primary mt-2"
                    data-testid="button-scores-retry"
                  >
                    Try again
                  </button>
                </div>
              )}
              {resultsQ.loading && (resultsQ.data ?? []).length === 0 ? (
                <div className="px-5 sm:px-8 pt-10 text-center" data-testid="scores-loading">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin" style={{ color: AMBER }} />
                  <p className="mt-2 text-[12px]" style={{ color: TEXT_MUTED }}>Loading your score history…</p>
                </div>
              ) : (
              <TestScoresTab
                examName={examName}
                examId={profile.exam}
                examDef={examDef}
                results={resultsQ.data ?? []}
                scoreEntries={scoreEntries}
                today={today}
                weeklyMockNudge={mockNudgeLine}
                onOpenAnalysis={() => setTab('analysis')}
                onNewTest={() => {
                  tests.setGenerateTestError(null);
                  tests.setGenerateTestOpen(true);
                }}
                onUploadMistake={(sourceLabel, subject) => doubts.openMistakeUpload({ sourceLabel, subject })}
              />
              )}
            </div>
          )}

          {baseTab === 'analysis' && <TestAnalysisScreen />}

          {baseTab === 'practice' && <PracticeScreen />}

          {baseTab === 'dashboard' && <DashboardScreen />}

          {/* Vision Board — a tilted physical pinboard with the dream goal in the
              centre. No mobile bottom-nav slot (see ui.tsx): Progress, Tools,
              Profile quick links and the desktop sidebar all open it. */}
          {baseTab === 'vision' && <VisionBoardScreen />}

          {baseTab === 'tools' && <ToolsScreen />}

          {/* VicharakAI Premium — plan status, what Premium includes and the
              one upgrade CTA. Every premium gate in the app navigates here. */}
          {baseTab === 'premium' && <PremiumScreen />}

          {baseTab === 'profile' && <ProfileScreen />}

          {/* Admin-only: the PYQ pipeline console (import / progress /
              review / duplicates). Never rendered for ordinary students. */}
          {baseTab === 'pyqadmin' && isWorkspaceAdmin && <PYQAdminScreen />}
        </div>

        {/* Mobile-only floating Vicharree launcher: with the top tab bar
            gone (founder instruction, 2026-09-30) this is how a phone opens
            the coach. The desktop sidebar already lists Vicharee, so the
            launcher hides at md and up (pure CSS). */}
        <div className="md:hidden">
          <VicharreeLauncher
            chatOpen={baseTab === 'coach'}
            onToggle={() => setTab(baseTab === 'coach' ? 'today' : 'coach')}
          />
        </div>

        {/* toast — with a one-tap Undo when the action is reversible */}
        <ToastViewport />

        {/* Feature-owned overlays and sheets. */}
        <TaskOverlays />
        <TaskEntrySheet />
        <DoubtOverlays />
        <TestOverlays />
        <ProfileOverlays />
        {/* [V2] Vicharee's opening mood check — once per app open, after the
            gates. Since Task 5 it also owns the moment straight after
            onboarding: the AI welcome overlay that used to take that slot is
            gone, so a brand-new student meets Vicharee immediately. */}
        <MoodCheckOverlay />

        {/* LANDING FREE-ANALYSIS: a brand-new student who used the signed-out
            free tool lands straight in their gap analysis (see the handoff
            effect above). It sits above the mood check so it is the first
            thing they meet, and hands them into the full Test Analysis tab. */}
        {freeAnalysis && (
          <FreeGapAnalysis
            payload={freeAnalysis}
            examLabel={examName}
            onOpenFull={() => {
              setFreeAnalysis(null);
              setTab('analysis');
            }}
            onClose={() => setFreeAnalysis(null)}
          />
        )}

        {/* No paywall modal here by design (2026-09-27): tapping a locked
            feature navigates to the Premium TAB above instead of throwing a
            full-screen sheet over the student's work. The only paywall that
            still covers the app is gate 5 — the trial-expiry gate. */}

        {/* Syllabus Browser — every exam in the database, mastery colour-coded. */}
        {syllabus.syllabusBrowserOpen && (
          <SyllabusScreen
            initialExamId={activeSyllabusExam?.id ?? null}
            progressRows={progressRows}
            attemptRows={attemptRows}
            addingChapter={syllabus.browserAddingChapter}
            onStudyChapter={(browsedExam, browsedSubject, browsedChapter) =>
              void syllabus.studyChapterFromBrowser(browsedExam, browsedSubject, browsedChapter)}
            onClose={() => syllabus.setSyllabusBrowserOpen(false)}
          />
        )}

        {/* Vicharee is full-screen: no sidebar and no second bottom nav. The
            secondary nav returns on every other destination. */}
        {baseTab !== 'coach' && (
          <VicharakBottomNav
            active={baseTab === 'pyqadmin' ? 'today' : baseTab}
            onSelect={setTab}
            onAddTask={openSyllabusPickerFromNav}
          />
        )}
      </div>
    </AppContextProvider>
  );
}
