/**
 * MoodCheckOverlay — Vicharee's opening flow. ONCE PER CALENDAR DAY (founder
 * instruction, 2026-09-30 — the date it last showed is tracked in
 * localStorage 'vicharee_mood_date', so a second open the same day skips
 * straight to the main view), after the auth/onboarding/paywall gates,
 * Vicharee sweeps
 * in on a slide-up + fade overlay, greets the student by name — "Hey Riya!
 * \uD83D\uDC4B How are you feeling today?" — and offers three PILL buttons:
 * \uD83D\uDD25 Very Energetic · \uD83D\uDE10 Just Regular · \uD83D\uDE14 Very Down.
 *
 * Since V2 Task 5 this is also the very first thing a brand-new student sees
 * after onboarding — exam picked, dream goal written, trial started, then
 * Vicharee.
 *
 * The answer reshapes Today immediately (moodCheck.ts): energetic = a bigger
 * slice with the hardest weak ground first (Vicharee also queues up to two
 * flagged-weak topics through the same addTask path everything else uses —
 * duplicates are skipped automatically); regular = the standard plan; down =
 * a light 2-item day, revision leading, easiest win first. A brief "Plan
 * ready" confirmation from Vicharee closes the overlay.
 *
 * Animation is pure CSS keyframes (no Rive/Lottie in this project — the
 * mascot is a static image; see components/VicharreeCharacter.tsx) and every
 * animation collapses under prefers-reduced-motion. The Today header chip
 * re-opens the question at any time via requestMoodRecheck().
 */
/* eslint-disable */
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { BRAND, INK, INK_SOFT, OVERLAY_BG, RULE, SHEET, tint } from '../../theme';
import VicharreeCharacter from '../../components/VicharreeCharacter';
import { topicKey } from '../../engine';
import { trackEvent } from '../../shared/track';
import { useApp } from '../../app/AppContext';
import {
  MOOD_META,
  MOOD_RECHECK_EVENT,
  markMoodPromptSeen,
  moodPromptSeenToday,
  readTodayMood,
  writeTodayMood,
  type VichareeMood,
} from './moodCheck';
import { emitMoodFlowDone } from '../coach/vichareeSignals';

const MOOD_ORDER: VichareeMood[] = ['energetic', 'regular', 'down'];

/** How long the "Plan ready" confirmation holds before the overlay leaves. */
const READY_HOLD_MS = 1700;
const LEAVE_MS = 320;

const MOOD_CSS = `
@keyframes vkMoodBackdropIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes vkMoodCardUp { from { opacity: 0; transform: translateY(34px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vkMoodCharIn { 0% { opacity: 0; transform: translateY(26px) scale(0.82); } 60% { opacity: 1; transform: translateY(-4px) scale(1.04); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes vkMoodFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes vkMoodRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vkMoodTickPop { 0% { opacity: 0; transform: scale(0.5); } 60% { opacity: 1; transform: scale(1.14); } 100% { opacity: 1; transform: scale(1); } }
@keyframes vkMoodOut { to { opacity: 0; } }
@keyframes vkMoodCardOut { to { opacity: 0; transform: translateY(18px); } }
.vk-mood-overlay { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; justify-content: center; padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); background: ${OVERLAY_BG}; animation: vkMoodBackdropIn 0.28s ease-out both; }
@media (min-width: 640px) { .vk-mood-overlay { align-items: center; } }
.vk-mood-card { width: 100%; max-width: 400px; background: ${SHEET}; border: 1px solid ${RULE}; border-radius: 14px; padding: 22px 20px calc(16px + env(safe-area-inset-bottom, 0px) * 0); box-shadow: 0 18px 48px rgba(22, 31, 43, 0.28); animation: vkMoodCardUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both; }
.vk-mood-char { display: flex; justify-content: center; animation: vkMoodCharIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s both; }
.vk-mood-char > span { display: inline-block; animation: vkMoodFloat 3.2s ease-in-out 0.8s infinite; }
.vk-mood-title { margin-top: 14px; font-size: 19px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; text-align: center; color: ${INK}; animation: vkMoodRise 0.4s ease-out 0.18s both; }
.vk-mood-sub { margin-top: 6px; font-size: 13px; line-height: 1.45; text-align: center; color: ${INK_SOFT}; animation: vkMoodRise 0.4s ease-out 0.24s both; }
.vk-mood-options { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
.vk-mood-option { display: flex; align-items: center; gap: 13px; width: 100%; min-height: 62px; padding: 12px 20px; text-align: left; background: ${SHEET}; border: 1.5px solid ${RULE}; border-radius: 999px; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease, transform 0.12s ease; animation: vkMoodRise 0.4s ease-out both; -webkit-tap-highlight-color: transparent; }
.vk-mood-option:hover { border-color: ${BRAND}; background: ${tint(BRAND, 0.04)}; }
.vk-mood-option:active { transform: scale(0.975); }
.vk-mood-emoji { font-size: 27px; line-height: 1; flex-shrink: 0; }
.vk-mood-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.vk-mood-label { font-size: 14.5px; font-weight: 600; line-height: 1.3; color: ${INK}; }
.vk-mood-hint { font-size: 12px; line-height: 1.35; color: ${INK_SOFT}; }
.vk-mood-skip { display: block; width: 100%; min-height: 44px; margin-top: 8px; font-size: 12.5px; font-weight: 600; text-align: center; color: ${INK_SOFT}; animation: vkMoodRise 0.4s ease-out 0.42s both; }
.vk-mood-ready { text-align: center; padding: 6px 4px 10px; animation: vkMoodRise 0.35s ease-out both; }
.vk-mood-tick { display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; margin-top: 12px; border-radius: 999px; background: ${tint(BRAND, 0.12)}; color: ${BRAND}; animation: vkMoodTickPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.vk-mood-ready h2 { margin-top: 10px; font-size: 18px; font-weight: 700; color: ${INK}; }
.vk-mood-ready p { margin: 8px auto 0; max-width: 300px; font-size: 13px; line-height: 1.5; color: ${INK_SOFT}; }
.vk-mood-leaving { animation: vkMoodOut ${LEAVE_MS}ms ease-in both; }
.vk-mood-leaving .vk-mood-card { animation: vkMoodCardOut ${LEAVE_MS}ms ease-in both; }
@media (prefers-reduced-motion: reduce) {
  .vk-mood-overlay, .vk-mood-card, .vk-mood-char, .vk-mood-char > span, .vk-mood-title, .vk-mood-sub,
  .vk-mood-option, .vk-mood-skip, .vk-mood-ready, .vk-mood-tick { animation: none; }
}
`;

type MoodPhase = 'hidden' | 'greet' | 'ready' | 'leaving';

export default function MoodCheckOverlay() {
  const { data, tasks } = useApp();
  const { spaceId, today, studentName, studentItems, weakTopicInsights } = data;
  const [phase, setPhase] = useState<MoodPhase>('hidden');
  const [chosen, setChosen] = useState<VichareeMood | null>(null);
  const timers = useRef<number[]>([]);

  const queue = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  /* Show once per calendar day (founder instruction, 2026-09-30). [V2 Task 5]
   * The day onboarding finishes still counts as that day's showing. */
  useEffect(() => {
    if (moodPromptSeenToday(today)) {
      /* Already asked today (a reload or a second open) — skip the picker
       * entirely and go straight to the main view, still handing off to the
       * chat with whatever mood is stored today. The session guards in
       * useCoach make a repeat emit a no-op. */
      emitMoodFlowDone(readTodayMood(spaceId, today));
      return;
    }
    markMoodPromptSeen(today);
    setPhase('greet');
    // Mount-only by design — this is the app-open moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The Today header chip re-opens the question at any time. */
  useEffect(() => {
    const onRecheck = () => {
      setChosen(null);
      setPhase('greet');
    };
    window.addEventListener(MOOD_RECHECK_EVENT, onRecheck);
    return () => window.removeEventListener(MOOD_RECHECK_EVENT, onRecheck);
  }, []);

  const select = (mood: VichareeMood) => {
    if (phase !== 'greet') return;
    setChosen(mood);
    writeTodayMood(spaceId, today, mood);
    try {
      trackEvent('mood_selected', { mood });
    } catch {
      /* analytics is never load-bearing */
    }
    if (mood === 'energetic') {
      /* Full-power day: Vicharee puts the two toughest flagged-weak topics on
       * today's plate through the SAME addTask path every other surface uses
       * — duplicates are skipped automatically, and the student manages them
       * like any other task. */
      const pendingKeys = new Set(
        studentItems
          .filter((item) => item.status === 'pending')
          .map((item) => item.source_key || topicKey(item.subject, item.topic)),
      );
      const picks = weakTopicInsights
        .filter((weak) => !pendingKeys.has(topicKey(weak.subjectName, weak.topicName)))
        .slice(0, 2);
      void (async () => {
        for (const weak of picks) {
          try {
            await tasks.addTask(weak.subjectName, weak.topicName, 'Revision', true);
          } catch {
            /* skip this topic — the rest can still be added */
          }
        }
      })();
    }
    /* [V2 Task 3] The mood flow is done — the shell opens the Vicharree chat
     * and Vicharree sends the personalized daily-plan message there. */
    emitMoodFlowDone(mood);
    setPhase('ready');
    queue(() => setPhase('leaving'), READY_HOLD_MS);
    queue(() => setPhase('hidden'), READY_HOLD_MS + LEAVE_MS);
  };

  const skip = () => {
    if (phase !== 'greet') return;
    /* [V2] Skipping still hands off to the chat — the daily-plan message
     * simply goes out without a mood flavour. */
    emitMoodFlowDone(readTodayMood(spaceId, today));
    setPhase('leaving');
    queue(() => setPhase('hidden'), LEAVE_MS);
  };

  if (phase === 'hidden') return null;

  const meta = chosen ? MOOD_META[chosen] : null;
  const greeting = studentName
    ? `Hey ${studentName}! \uD83D\uDC4B How are you feeling today?`
    : 'Hey! \uD83D\uDC4B How are you feeling today?';

  return (
    <div
      className={`vk-mood-overlay${phase === 'leaving' ? ' vk-mood-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="How are you feeling today?"
      data-testid="mood-check-overlay"
    >
      <style>{MOOD_CSS}</style>
      <div className="vk-mood-card">
        <div className="vk-mood-char" aria-hidden="true">
          <span>
            <VicharreeCharacter size={72} state="greeting" />
          </span>
        </div>
        {phase !== 'greet' && meta ? (
          <div className="vk-mood-ready" data-testid="mood-check-ready" aria-live="polite">
            <span className="vk-mood-tick">
              <Check className="w-6 h-6" aria-hidden="true" />
            </span>
            <h2>Plan ready</h2>
            <p>{meta.readyLine}</p>
          </div>
        ) : (
          <>
            <h2 className="vk-mood-title" data-testid="text-mood-greeting">
              {greeting}
            </h2>
            <p className="vk-mood-sub">Pick one and I'll build today's plan around it.</p>
            <div className="vk-mood-options" role="group" aria-label="Pick today's energy">
              {MOOD_ORDER.map((mood, index) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => select(mood)}
                  className="vk-mood-option touch-manipulation"
                  style={{ animationDelay: `${0.3 + index * 0.07}s` }}
                  data-testid={`button-mood-${mood}`}
                >
                  <span className="vk-mood-emoji" aria-hidden="true">
                    {MOOD_META[mood].emoji}
                  </span>
                  <span className="vk-mood-text">
                    <span className="vk-mood-label">{MOOD_META[mood].label}</span>
                    <span className="vk-mood-hint">{MOOD_META[mood].sub}</span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={skip} className="vk-mood-skip touch-manipulation" data-testid="button-mood-skip">
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
