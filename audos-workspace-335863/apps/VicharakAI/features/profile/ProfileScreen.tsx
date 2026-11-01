/**
 * ProfileScreen — the Me tab: identity, plan/premium status, goals, exam
 * settings, notifications, weekly targets entry, support and the danger
 * zone. JSX extracted verbatim from App.tsx.
 *
 * NO THEME SWITCH: the app has ONE surface (paper). `.vicharak-light` and
 * `.vicharak-app` resolve to identical styles in theme.ts, so the Dark/Light
 * control that used to sit in the settings list changed nothing at all when
 * tapped — a dead switch reads as a broken app, so it is gone.
 */
/* eslint-disable */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  BarChart3, Bell, BookOpen, CalendarDays, Camera, Check, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, CloudRain, Compass, Crown, Flag, Flame, GraduationCap, LifeBuoy, Loader2,
  Lock, LogOut, Mail, Pencil, Play, Plus, RotateCcw, Send, Settings as SettingsIcon,
  Sparkles, Star, Target, Timer, Trash2, Trophy, Users, Wand2, Wrench, X,
} from 'lucide-react';
import {
  AMBER, AMBER_BRIGHT, BORDER, BORDER_STRONG, BRAND_GRADIENT, BRAND_GRADIENT_DEEP, CARD,
  CARD_SHADOW, CARD_SOFT, DANGER, GLASS_BG, HERO_SHADOW, NAVY, NAVY_ALT, ON_AMBER, ORANGE,
  OVERLAY_BG, PAGE_BG, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, WARNING,
  subjectColor, subjectTint, tint,
} from '../../theme';
import { Card, SectionLabel, ShowMoreToggle, SubjectDot, VicharakAvatar } from '../../ui';
import { formatDuration, diffDays, topicKey } from '../../engine';
import { EXAMS, defaultExamDate, getExam } from '../../syllabus';
import { examLabelFromId, isCustomExamId } from '../../customExam';
import CustomExamEntry from '../../CustomExamEntry';
import { PREMIUM_PRODUCT_NAME, planPriceLabel } from '../../access';
import { getSystemNow } from '../../systemDate';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { CHAT_EXAM_META_KEY } from '../../ExamChatSupport';
import { pillStyle } from '../../shared/styles';
import { inputStyle } from '../../shared/styles';
import { IS_IOS_NO_PUSH } from '../../shared/device';
import { ProfileAvatar } from './avatar';
import { useApp } from '../../app/AppContext';
import PwaInstallButton from '../../shared/pwaInstall';

export default function ProfileScreen() {
  const { data, toast, access: accessFeature, tasks, tests, notifications, settings, setTab } = useApp();
  const access = accessFeature.access;
  const { accessStatus, paidPlan, openPaywall, paidSessionEmail } = accessFeature;
  const {
    spaceId, today, profile, dbProfile, examDef, savedExamLabel, examDate, examDateSet, daysToExam,
    goals, dailyGoal, weeklyGoal, studentName, savedName, day, streak, metaMap, metaQ, profileQ,
    upsertMeta, storedCustomExam, studentItems, scoreEntries,
  } = data;
  const storedExamDate = metaMap.get('exam_date')?.meta_value;
  const examName = examDef?.name ?? (savedExamLabel || examLabelFromId(profile?.exam ?? null));
  const trialExpiresMs = accessStatus.trialExpiresAt ? Date.parse(accessStatus.trialExpiresAt) : NaN;
  const trialLastDay = Number.isFinite(trialExpiresMs) && trialExpiresMs - getSystemNow() < 86_400_000;
  const trialDaysLeftCount = accessStatus.daysLeftInTrial ?? 0;
  const trialBannerText = trialLastDay
    ? 'Free trial ends today'
    : `Free trial · ${trialDaysLeftCount} ${trialDaysLeftCount === 1 ? 'day' : 'days'} left`;
  const { showToast } = toast;
  const {
    switchToTypedExam, examSwitchOpen, setExamSwitchOpen, changingExam, setChangingExam,
  } = tasks;
  const { openTargetsScreen } = tests;
  const { notificationsOn, reminderTime, setReminderTimePersist, toggleNotifications, enableNotifications } = notifications;
  const {
    nameDraft, setNameDraft, avatarDataUrl, pickProfileAvatar, goalsDraft, setGoalsDraft,
    examDateDraft, setExamDateDraft, dailyGoalDraft, setDailyGoalDraft, weeklyGoalDraft,
    setWeeklyGoalDraft, savingProfile, setSavingProfile, setHelpOpen,
    setAccountSheetOpen, dangerAction, setDangerAction, dangerBusy, handleSignOut,
  } = settings;
  const premiumPriceLine = planPriceLabel('monthly');
  /* ONE exam per student: a catalogue tap stages the switch here and an
   * explicit confirmation performs it — the new exam REPLACES the old one
   * (never a second simultaneous exam), and progress data is kept. */
  const [pendingExamSwitch, setPendingExamSwitch] = useState<(typeof EXAMS)[number] | null>(null);

  type AutosaveField = 'name' | 'goals' | 'goal_daily_hours' | 'goal_weekly_hours';
  const latestDraftsRef = useRef({ nameDraft, goalsDraft, dailyGoalDraft, weeklyGoalDraft });
  latestDraftsRef.current = { nameDraft, goalsDraft, dailyGoalDraft, weeklyGoalDraft };
  const upsertMetaRef = useRef(upsertMeta);
  upsertMetaRef.current = upsertMeta;
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveCountRef = useRef(0);

  const validateHourGoal = (field: AutosaveField, raw: string): string | null => {
    const clean = raw.trim();
    if (!clean) return '';
    const value = Number(clean);
    const max = field === 'goal_daily_hours' ? 24 : 168;
    if (!Number.isFinite(value) || value < 0 || value > max) return null;
    return String(Math.round(value * 100) / 100);
  };

  const persistDraft = useCallback((field: AutosaveField, raw: string, announce = false): Promise<boolean> => {
    const task = async (): Promise<boolean> => {
      let value = raw.trim();
      if (field === 'name' && !value) {
        if (announce) showToast('Your saved name was kept — enter a non-empty name before saving.');
        return false;
      }
      if (field === 'goal_daily_hours' || field === 'goal_weekly_hours') {
        const validated = validateHourGoal(field, raw);
        if (validated === null) {
          const limit = field === 'goal_daily_hours' ? 24 : 168;
          showToast(`Enter a valid ${field === 'goal_daily_hours' ? 'daily' : 'weekly'} target from 0 to ${limit} hours.`);
          return false;
        }
        value = validated;
      }
      const stored =
        field === 'name'
          ? savedName ?? ''
          : field === 'goals'
            ? goals
            : field === 'goal_daily_hours'
              ? dailyGoal
              : weeklyGoal;
      if (value === stored) return true;
      saveCountRef.current += 1;
      setSavingProfile(true);
      try {
        await upsertMetaRef.current(field, value);
        if (announce) {
          showToast(
            field === 'name'
              ? 'Name saved.'
              : field === 'goals'
                ? 'Dream goal saved.'
                : 'Study-hour goal saved.',
          );
        }
        return true;
      } catch (error) {
        console.warn(`[vicharakai] ${field} autosave failed`, error);
        showToast("That change didn't save — your input is still here. Try once more.");
        return false;
      } finally {
        saveCountRef.current = Math.max(0, saveCountRef.current - 1);
        if (saveCountRef.current === 0) setSavingProfile(false);
      }
    };
    const next = saveChainRef.current.then(task, task);
    saveChainRef.current = next.then(() => undefined, () => undefined);
    return next;
  }, [dailyGoal, goals, savedName, showToast, weeklyGoal]);

  const flushCurrentDrafts = useCallback((announce = false) => {
    const current = latestDraftsRef.current;
    if (current.nameDraft !== null) void persistDraft('name', current.nameDraft, announce);
    if (current.goalsDraft !== null) void persistDraft('goals', current.goalsDraft, announce);
    if (current.dailyGoalDraft !== null) void persistDraft('goal_daily_hours', current.dailyGoalDraft, announce);
    if (current.weeklyGoalDraft !== null) void persistDraft('goal_weekly_hours', current.weeklyGoalDraft, announce);
  }, [persistDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => flushCurrentDrafts(false), 800);
    return () => window.clearTimeout(timer);
  }, [nameDraft, goalsDraft, dailyGoalDraft, weeklyGoalDraft, flushCurrentDrafts]);

  useEffect(() => {
    const onPageHide = () => flushCurrentDrafts(false);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushCurrentDrafts(false);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flushCurrentDrafts(false);
    };
  }, [flushCurrentDrafts]);

  if (!profile) return null;

  return (
    <>
          <div className="flex-1 w-full max-w-[860px] mx-auto px-5 sm:px-8 pt-6 vicharak-screen-pad space-y-4">
            <header className="flex items-center gap-3 vicharak-rise">
              {/* FIX: tappable avatar — initials by default, tap to upload a photo. */}
              <ProfileAvatar name={studentName} imageUrl={avatarDataUrl} onPick={(file) => void pickProfileAvatar(file)} />
              <div className="min-w-0 flex-1">
                {nameDraft === null ? (
                  <button
                    type="button"
                    onClick={() => setNameDraft(studentName ?? '')}
                    className="flex items-center gap-1.5 group"
                    data-testid="button-edit-name"
                  >
                    <h1 className="text-xl font-extrabold" style={{ color: TEXT }}>
                      {studentName ?? 'Add your name'}
                    </h1>
                    <Pencil className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" style={{ color: TEXT_MUTED }} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="px-3 py-1.5 text-sm"
                      style={inputStyle}
                      placeholder="Your name"
                      autoFocus
                      data-testid="input-name"
                    />
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        const value = nameDraft ?? '';
                        void persistDraft('name', value, true).then((saved) => {
                          if (saved) setNameDraft(null);
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-extrabold flex-shrink-0"
                      style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid="button-save-name"
                    >
                      Save
                    </button>
                  </div>
                )}
                <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
                  Day {day} of prep · {examName} aspirant
                </p>
                {/* FIX: plan badge under the name — glowing for paying students,
                    a quiet tappable trial line during the free trial. */}
                {accessStatus.status === 'subscribed' ? (
                  <span
                    className="vicharak-badge-glow mt-1.5 inline-flex items-center px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,87,255,0.18), rgba(0,65,204,0.10))',
                      border: '1px solid rgba(0,87,255,0.5)',
                      color: AMBER_BRIGHT,
                    }}
                    data-testid="badge-plan-premium"
                  >
                    {'⚡ PREMIUM'}
                  </span>
                ) : accessStatus.status === 'trial' && accessStatus.trialExpiresAt ? (
                  /* Trial countdown ONLY with a real active trial record
                     (trialExpiresAt set) — never for a paying student whose
                     subscription rows haven't loaded yet. */
                  <button
                    type="button"
                    onClick={() => openPaywall(null)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold touch-manipulation"
                    style={{ color: TEXT_MUTED }}
                    data-testid="badge-plan-trial"
                  >
                    {trialBannerText}
                    <span className="font-extrabold underline underline-offset-2" style={{ color: ORANGE }}>
                      · Upgrade
                    </span>
                  </button>
                ) : accessStatus.status === 'expired' ? (
                  <button
                    type="button"
                    onClick={() => openPaywall(null)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold touch-manipulation"
                    style={{ color: TEXT_MUTED }}
                    data-testid="badge-plan-locked"
                  >
                    Plan locked
                    <span className="font-extrabold underline underline-offset-2" style={{ color: AMBER }}>
                      · Unlock
                    </span>
                  </button>
                ) : null}
              </div>
              {/* Install-app entry — hides itself once installed/dismissed. */}
              <PwaInstallButton className="flex-shrink-0 self-start" />
            </header>

            {/* exam countdown — the one number that frames everything */}
            <Card radius={RADIUS.lg} className="p-4 text-center vicharak-rise" style={{ animationDelay: '20ms' }} testId="card-exam-countdown">
              <p className="text-3xl font-extrabold" style={{ color: AMBER }} data-testid="text-days-to-exam">{daysToExam}</p>
              <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>days until {examName}</p>
            </Card>

            {/* exam date nudge — a prompt, never a blocking gate */}
            {!examDateSet && (
              <Card
                radius={RADIUS.md}
                className="p-3.5 vicharak-rise"
                style={{ background: tint(AMBER, 0.1), borderColor: tint(AMBER, 0.4) }}
                testId="card-exam-date-prompt"
              >
                <p className="text-xs font-bold" style={{ color: AMBER }}>
                  Set your exam date to switch the pace signal on
                </p>
                <p className="text-[11px] mt-1" style={{ color: TEXT_SECONDARY }}>
                  I'm using {examDate} as a guess for now. Set the real date below and “Am I on track?” becomes accurate.
                </p>
              </Card>
            )}

            {/* streak & stats */}
            <Card radius={RADIUS.lg} className="p-4 vicharak-rise" style={{ animationDelay: '40ms' }} testId="card-profile-stats">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Streak', value: `${streak}\uD83D\uDD25` },
                  { label: 'Topics', value: studentItems.filter((i) => i.kind === 'new' && i.status === 'done').length },
                  { label: 'Revisions', value: studentItems.filter((i) => i.kind === 'revision' && i.status === 'done').length },
                  { label: 'Tests', value: scoreEntries.length },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-lg font-extrabold" style={{ color: AMBER }}>
                      {s.value}
                    </p>
                    <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* exam settings + goals */}
            <Card radius={RADIUS.lg} className="p-5 space-y-4 vicharak-rise" style={{ animationDelay: '70ms' }} testId="card-exam-settings">
              <div>
                <SectionLabel>Exam</SectionLabel>
                {changingExam ? (
                  <div>
                    {/* The catalogue now carries the per-subject US exams too
                        (36 AP subjects + DAT), so this row is capped and
                        scrolls instead of growing into a wall of chips. Every
                        exam stays reachable. */}
                    <div className="flex gap-1.5 flex-wrap max-h-[34vh] overflow-y-auto pr-0.5" data-testid="list-switch-exam">
                      {EXAMS.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            // Tapping the CURRENT exam just closes the picker;
                            // any other exam is staged for confirmation below.
                            if (e.id === profile.exam) {
                              setPendingExamSwitch(null);
                              setChangingExam(false);
                              return;
                            }
                            setPendingExamSwitch(e);
                          }}
                          className="px-3 py-1.5 text-xs font-bold transition-all"
                          style={pillStyle(e.id === profile.exam || pendingExamSwitch?.id === e.id)}
                          data-testid={`button-switch-exam-${e.id}`}
                        >
                          {e.name}
                        </button>
                      ))}
                      {examDef?.custom && (
                        <span className="px-3 py-1.5 text-xs font-bold" style={pillStyle(true)} data-testid="pill-current-typed-exam">
                          {examDef.name}
                        </span>
                      )}
                    </div>
                    {pendingExamSwitch && (
                      <div
                        className="mt-2.5 p-3"
                        style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.35)}` }}
                        data-testid="confirm-exam-switch"
                      >
                        <p className="text-xs font-bold" style={{ color: TEXT }}>
                          Switch from {examDef?.name ?? examName} to {pendingExamSwitch.name}? Your progress data will be kept.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={savingProfile}
                            onClick={() => {
                              const e = pendingExamSwitch;
                              if (!e) return;
                              setSavingProfile(true);
                              void (async () => {
                                try {
                                  await verifiedDbFrom('zuno_profile').update(profile.id, { exam: e.id });
                                  await upsertMeta('exam_date', defaultExamDate(e, today));
                                  // Recommendations recalculate against the NEW exam:
                                  // a pinned chat exam would keep insights on the old one.
                                  if (metaMap.get(CHAT_EXAM_META_KEY)?.meta_value) await upsertMeta(CHAT_EXAM_META_KEY, '');
                                  profileQ.refresh();
                                  setPendingExamSwitch(null);
                                  setChangingExam(false);
                                  setExamSwitchOpen(false);
                                  showToast(`Switched to ${e.name} — your progress data is kept.`);
                                } catch {
                                  showToast("That switch didn't save — give it another try.");
                                } finally {
                                  setSavingProfile(false);
                                }
                              })();
                            }}
                            className="px-3 py-2 text-xs font-extrabold disabled:opacity-60"
                            style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                            data-testid="button-confirm-exam-switch"
                          >
                            {savingProfile ? 'Switching…' : `Switch to ${pendingExamSwitch.name}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingExamSwitch(null)}
                            className="px-3 py-2 text-xs font-bold"
                            style={{ color: TEXT_MUTED, background: 'transparent', border: 'none' }}
                            data-testid="button-cancel-exam-switch"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {examSwitchOpen ? (
                      <div className="mt-2.5">
                        <CustomExamEntry
                          today={today}
                          confirmLabel="Switch to this exam"
                          onReady={(exam) => void switchToTypedExam(exam)}
                          onCancel={() => setExamSwitchOpen(false)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExamSwitchOpen(true)}
                        className="mt-2.5 text-[11px] font-bold hover:underline"
                        style={{ color: AMBER }}
                        data-testid="button-switch-exam-custom"
                      >
                        + Type another exam
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: TEXT }}>
                      {examDef?.fullName ?? examName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChangingExam(true)}
                      className="text-[11px] font-bold hover:underline"
                      style={{ color: AMBER }}
                      data-testid="button-change-exam"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div>
                <SectionLabel>Exam date</SectionLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={examDateDraft ?? storedExamDate ?? (examDef ? examDate : '')}
                    min={today}
                    onChange={(e) => setExamDateDraft(e.target.value)}
                    className="px-3 py-2 text-sm flex-1"
                    style={inputStyle}
                    data-testid="input-profile-exam-date"
                  />
                  {examDateDraft !== null && examDateDraft !== examDate && (
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        setSavingProfile(true);
                        void upsertMeta('exam_date', examDateDraft)
                          .then(() => {
                            setExamDateDraft(null);
                            showToast('Exam date updated — pace recalculated.');
                          })
                          .catch(() => showToast("That date didn't save — it is still here, so tap Save to try again."))
                          .finally(() => setSavingProfile(false));
                      }}
                      className="px-3 py-2 text-xs font-extrabold flex-shrink-0"
                      style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid="button-save-exam-date"
                    >
                      Save
                    </button>
                  )}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: TEXT_MUTED }}>
                  {daysToExam} days away · drives your pace signal
                </p>
              </div>

              <div>
                <SectionLabel>Dream goal</SectionLabel>
                <textarea
                  value={goalsDraft ?? goals}
                  onChange={(e) => setGoalsDraft(e.target.value)}
                  onBlur={() => {
                    if (goalsDraft === null) return;
                    const value = goalsDraft;
                    void persistDraft('goals', value, true).then((saved) => {
                      if (saved) setGoalsDraft(null);
                    });
                  }}
                  rows={2}
                  placeholder='e.g. "Crack NEET 2026 with AIR under 500"'
                  className="px-3 py-2 text-sm resize-none"
                  style={inputStyle}
                  data-testid="input-goals"
                />
                <p className="text-[11px] mt-1.5" style={{ color: TEXT_MUTED }}>
                  This is the {'\uD83C\uDFAF'} line at the top of your Today screen — editing it here or there changes the same goal.
                </p>
              </div>

              <div>
                <SectionLabel>Study-hour goals</SectionLabel>
                <div className="flex gap-2">
                  {(
                    [
                      { key: 'goal_daily_hours', label: 'Daily', value: dailyGoal, draft: dailyGoalDraft, set: setDailyGoalDraft, placeholder: 'e.g. 6' },
                      { key: 'goal_weekly_hours', label: 'Weekly', value: weeklyGoal, draft: weeklyGoalDraft, set: setWeeklyGoalDraft, placeholder: 'e.g. 40' },
                    ] as const
                  ).map((field) => (
                    <div key={field.key} className="flex-1 min-w-0">
                      <label
                        className="block text-[10px] font-bold mb-1"
                        style={{ color: TEXT_MUTED }}
                        htmlFor={`input-${field.key}`}
                      >
                        {field.label} hours
                      </label>
                      <input
                        id={`input-${field.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={field.draft ?? field.value}
                        onChange={(e) => field.set(e.target.value)}
                        onBlur={() => {
                          if (field.draft === null) return;
                          const value = field.draft;
                          void persistDraft(field.key, value, true).then((saved) => {
                            if (saved) field.set(null);
                          });
                        }}
                        placeholder={field.placeholder}
                        className="px-3 py-2 text-sm"
                        style={inputStyle}
                        data-testid={`input-${field.key}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: TEXT_MUTED }}>
                  I compare these against the study-hours chart in your performance dashboard.
                </p>
              </div>
            </Card>

            {/* plan — ONE clean tap. Full plan details deliberately do NOT
                live inline here: subscribers get "Manage Subscription" (the
                Account & plan sheet) and everyone else gets "Upgrade to
                Premium" (the paywall). */}
            <button
              type="button"
              onClick={() => setTab('premium')}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left vicharak-rise touch-manipulation"
              style={{ background: CARD, border: `1px solid ${tint(AMBER, 0.35)}`, borderRadius: RADIUS.md, animationDelay: '90ms', minHeight: 56 }}
              data-testid="card-tier"
            >
              <Crown className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: TEXT }}>
                  {PREMIUM_PRODUCT_NAME}
                </span>
                <span className="block text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>
                  {accessStatus.status === 'subscribed'
                    ? 'Active — plan, renewal and payment options'
                    : accessStatus.status === 'trial'
                      ? `Free trial running · ${premiumPriceLine} after`
                      : `${premiumPriceLine} — see everything it unlocks`}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
            </button>

            {/* settings + sign out */}
            <section className="space-y-2 vicharak-rise" style={{ animationDelay: '110ms' }}>
              <div
                className="w-full px-4 py-3.5"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="row-notifications"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 flex-shrink-0" style={{ color: notificationsOn ? AMBER : TEXT_MUTED }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>Study reminders</p>
                    <p className="text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Daily mission + revision-due alerts</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleNotifications()}
                    className="px-3 py-1.5 text-xs font-extrabold"
                    style={pillStyle(notificationsOn)}
                    aria-pressed={notificationsOn}
                    data-testid="button-toggle-notifications"
                  >
                    {notificationsOn ? 'On' : 'Turn on'}
                  </button>
                </div>
                {notificationsOn && (
                  <label className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
                    Daily reminder time
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(event) => setReminderTimePersist(event.target.value)}
                      className="px-2.5 py-1.5 text-xs"
                      style={inputStyle}
                      data-testid="input-reminder-time"
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTab('calendar')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-calendar"
              >
                <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Study calendar</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Month view of your plan — every task stays editable</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => openTargetsScreen('week')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-weekly-targets"
              >
                <Target className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Study targets</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Monthly &amp; weekly focus chapters, topic + test goals — AI can pick</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setTab('vision')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, minHeight: 56 }}
                data-testid="button-open-vision-board"
              >
                <Compass className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Vision board</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>Your dream goal on a pinboard — topics strung around it, colour-coded by accuracy</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              {/* The bottom bar carries five destinations (Today · Revision ·
                  + · Progress · Premium · Profile). Everything that left it
                  lives here, one tap away, with room for a real name and a
                  line saying what it does. */}
              <button
                type="button"
                onClick={() => setTab('doubts')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, minHeight: 56 }}
                data-testid="button-open-doubts"
              >
                <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Mistake book</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>Every question you got wrong — scheduled to come back</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setTab('analysis')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, minHeight: 56 }}
                data-testid="button-open-analysis"
              >
                <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Test analysis</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>Where the marks actually went, question by question</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setTab('scores')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-scores"
              >
                <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Test scores</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Log mocks &amp; chapter tests — they feed your insights</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setTab('tools')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-tools"
              >
                <Wrench className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TEXT }}>Study tools</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Generate Test, Focus Timer, Weightage &amp; Syllabus</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-help"
              >
                <LifeBuoy className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                <span className="text-sm font-semibold flex-1" style={{ color: TEXT }}>
                  Help &amp; Support
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              {/* [FIX 1] Opens the in-app Account & plan slide-up sheet —
                  never a navigation to another screen, so closing it always
                  returns right here. */}
              <button
                type="button"
                onClick={() => setAccountSheetOpen(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-open-settings"
              >
                <SettingsIcon className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                <span className="text-sm font-semibold flex-1" style={{ color: TEXT }}>
                  Account &amp; subscription settings
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              {/* FIX 1: Reset All Data / Delete Account — both confirmation-gated. */}
              <button
                type="button"
                onClick={() => setDangerAction('reset')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${tint(DANGER, 0.35)}`, borderRadius: RADIUS.md }}
                data-testid="button-reset-all-data"
              >
                <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: DANGER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: DANGER }}>Reset All Data</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Wipe tasks, revisions, scores and your Mistake Book — start over</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={() => setDangerAction('delete')}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${tint(DANGER, 0.35)}`, borderRadius: RADIUS.md }}
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 flex-shrink-0" style={{ color: DANGER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: DANGER }}>Delete Account</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>Erase your data and sign out for good</span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid="button-sign-out"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: DANGER }} />
                <span className="text-sm font-semibold" style={{ color: DANGER }}>
                  Sign out
                </span>
              </button>
            </section>

            <p className="pt-2 pb-1 text-center text-[10px] font-bold" style={{ color: TEXT_MUTED }}>
              VicharakAI v1.0
            </p>
          </div>
    </>
  );
}
