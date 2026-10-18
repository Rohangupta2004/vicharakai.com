/**
 * [V2 Task 3] Vicharree chat signals — the tiny window-event bus that lets
 * the rest of the app talk TO the Vicharree chat without new prop threading:
 *
 *  - mood-flow-done: the opening mood check finished (answered, skipped, or
 *    already answered today). useCoach reacts by sending the personalized
 *    daily-plan opening message; AppShell reacts by landing the student on
 *    the Today tab — the one consistent main view after the mood flow
 *    (founder instruction, 2026-09-30).
 *  - analysis-weak-topic: test analysis just fully tagged a WRONG question
 *    (error tag + syllabus topic). useCoach reacts with a proactive
 *    "want me to schedule a revision for tomorrow?" nudge in the chat.
 *  - coach-appended: Vicharree appended a proactive message; AppShell lights
 *    the unread dot when the chat overlay is closed.
 *
 * Window events (not context) on purpose: the emitters live in feature hooks
 * that must not depend on the coach feature's render tree, and the mood
 * overlay already talks to Today the same way (features/today/moodCheck.ts).
 */
import type { VichareeMood } from '../today/moodCheck';

/** Fired when the opening mood-check flow resolves (see MoodCheckOverlay). */
export const MOOD_FLOW_DONE_EVENT = 'vicharee:mood-flow-done';
/** Fired when test analysis tags a wrong question onto a syllabus chapter. */
export const VICHAREE_ANALYSIS_SIGNAL_EVENT = 'vicharee:analysis-weak-topic';
/** Fired when Vicharree appends a proactive chat message. */
export const VICHAREE_COACH_APPENDED_EVENT = 'vicharee:coach-appended';

export interface AnalysisWeakTopicSignal {
  subject: string;
  /** Human chapter/topic label, e.g. "Current Electricity". */
  chapter: string;
  /** How many questions are marked wrong in that chapter so far. */
  wrongCount: number;
}

/**
 * Announce that the mood flow finished. Deferred one tick so listeners
 * mounted in the SAME commit (parent effects run after child effects) never
 * miss an emit fired from a child's mount effect.
 */
export function emitMoodFlowDone(mood: VichareeMood | null): void {
  try {
    window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent(MOOD_FLOW_DONE_EVENT, { detail: { mood } }));
      } catch {
        /* CustomEvent unavailable — the chat's own open fallback still greets */
      }
    }, 0);
  } catch {
    /* no window — never load-bearing */
  }
}

/** The mood carried by a mood-flow-done event — null when none was chosen. */
export function moodFromFlowEvent(event: Event): VichareeMood | null {
  const mood = (event as CustomEvent<{ mood?: VichareeMood | null }>).detail?.mood;
  return mood === 'energetic' || mood === 'regular' || mood === 'down' ? mood : null;
}

export function notifyAnalysisWrongTopic(signal: AnalysisWeakTopicSignal): void {
  try {
    window.dispatchEvent(new CustomEvent(VICHAREE_ANALYSIS_SIGNAL_EVENT, { detail: signal }));
  } catch {
    /* a cosmetic nudge — never load-bearing */
  }
}

export function analysisSignalFromEvent(event: Event): AnalysisWeakTopicSignal | null {
  const detail = (event as CustomEvent<AnalysisWeakTopicSignal>).detail;
  if (!detail || typeof detail.chapter !== 'string' || !(detail.chapter ?? '').trim()) return null;
  return {
    subject: typeof detail.subject === 'string' ? detail.subject : '',
    chapter: detail.chapter,
    wrongCount: Number.isFinite(detail.wrongCount) && detail.wrongCount > 0 ? Math.round(detail.wrongCount) : 1,
  };
}

export function notifyCoachMessageAppended(): void {
  try {
    window.dispatchEvent(new CustomEvent(VICHAREE_COACH_APPENDED_EVENT));
  } catch {
    /* the unread dot is cosmetic */
  }
}
