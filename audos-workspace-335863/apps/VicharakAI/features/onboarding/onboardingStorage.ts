/**
 * Onboarding flow types + local persistence (the pending profile saved before
 * the session verifies, and the once-per-user welcome flag).
 */
import { getExam, type ExamDef } from '../../syllabus';
import { parseCustomExam } from '../../customExam';

/** The onboarding screens, in order: exam picker → dream goal → pay screen.
 *
 * 2026-09-29 (V2 Task 5): onboarding is TWO steps. The exam-date, daily-hours
 * and Day-1-preview screens were removed along with the older welcome splash
 * and starting-point screens — Vicharee asks for all of that conversationally
 * once the student is inside. Their literals stay in this union only so stale
 * persisted state can never break the type; nothing navigates to them. */
export type ObScreen = 'welcome' | 'exam' | 'goal' | 'date' | 'hours' | 'start' | 'preview' | 'pay';

/** The COUNTED onboarding steps — drives the "Step X of 2" progress bar.
 * The pay screen that follows is deliberately not counted, so the bar reads
 * 100% while the student reads the trial offer. */
export const OB_FLOW: ObScreen[] = ['exam', 'goal'];

/** One chapter the student marked "already completed" on the starting-point screen. */
export interface ObCompletedEntry {
  subject: string;
  chapter: string;
  /** Approximate completion date — ISO YYYY-MM-DD (mid-month for month picks). */
  approxDate: string;
  /** Stable chapter id from the structured syllabus database (data/syllabuses)
   * when the chapter came from it — lets the adaptation engine record the
   * completion exactly; null for planner-only / custom-exam chapters. */
  chapterId?: string | null;
}

/** 'YYYY-MM' (rough month pick) → a usable ISO date — mid-month, never in the future. */
export function approxMonthToISO(value: string, today: string): string {
  const iso = /^\d{4}-\d{2}$/.test(value) ? `${value}-15` : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
  return iso > today ? today : iso;
}

/**
 * What a brand-new student chose BEFORE their workspace session finished
 * verifying — their exam, its section structure and their dream goal. Saved
 * locally so finishing onboarding never blocks on authentication; a sync
 * effect writes it to WorkspaceDB the moment the verified session lands
 * (surviving reloads via localStorage).
 */
export interface PendingOnboarding {
  examId: string | null;
  /** serializeCustomExam() JSON for typed/custom exams — null for catalogue exams. */
  customExamJson: string | null;
  date: string | null;
  topics: string[];
  /** Daily study-hours pick, when an older build collected one. */
  hours: string | null;
  /** Chapters marked "already completed", with an approximate date. */
  completed: ObCompletedEntry[];
  /** The dream goal from onboarding step 2 — the Vision Board's anchor. */
  goal: string | null;
  /** `vicharakai_exams.id` for the exam picked in step 1. */
  registryExamId: string | null;
  /** That exam's `vicharakai_exam_sections` structure, as JSON. */
  sectionsJson: string | null;
  start: string;
}

const pendingOnboardingKey = (spaceId: string) => `vicharak_pending_onboarding_${spaceId}`;

/** Same-device fast-path only. WorkspaceDB's zuno_profile.onboarding_complete
 * remains the durable source of truth across browsers and devices. Keying by
 * email prevents one account on a shared browser from inheriting another
 * account's completion state. */
const onboardingCompleteKey = (spaceId: string, email: string) =>
  `vicharak_onboarding_complete_${spaceId}_${email.trim().toLowerCase()}`;

export function hasCachedOnboardingComplete(spaceId: string, email: string): boolean {
  if (!email) return false;
  try {
    return localStorage.getItem(onboardingCompleteKey(spaceId, email)) === '1';
  } catch {
    return false;
  }
}

export function cacheOnboardingComplete(spaceId: string, email: string): void {
  if (!email) return;
  try {
    localStorage.setItem(onboardingCompleteKey(spaceId, email), '1');
  } catch {
    /* WorkspaceDB still carries the durable flag. */
  }
}

export function clearCachedOnboardingComplete(spaceId: string, email: string): void {
  if (!email) return;
  try {
    localStorage.removeItem(onboardingCompleteKey(spaceId, email));
  } catch {
    /* nothing to clear */
  }
}

export function readPendingOnboarding(spaceId: string): PendingOnboarding | null {
  try {
    const raw = localStorage.getItem(pendingOnboardingKey(spaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOnboarding>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.start !== 'string') return null;
    return {
      examId: typeof parsed.examId === 'string' ? parsed.examId : null,
      customExamJson: typeof parsed.customExamJson === 'string' ? parsed.customExamJson : null,
      date: typeof parsed.date === 'string' ? parsed.date : null,
      topics: Array.isArray(parsed.topics) ? parsed.topics.filter((t): t is string => typeof t === 'string') : [],
      hours: typeof parsed.hours === 'string' ? parsed.hours : null,
      goal: typeof parsed.goal === 'string' ? parsed.goal : null,
      registryExamId: typeof parsed.registryExamId === 'string' ? parsed.registryExamId : null,
      sectionsJson: typeof parsed.sectionsJson === 'string' ? parsed.sectionsJson : null,
      completed: Array.isArray(parsed.completed)
        ? parsed.completed
            .filter(
              (c): c is ObCompletedEntry =>
                !!c &&
                typeof c === 'object' &&
                typeof (c as { subject?: unknown }).subject === 'string' &&
                typeof (c as { chapter?: unknown }).chapter === 'string' &&
                typeof (c as { approxDate?: unknown }).approxDate === 'string',
            )
            .map((c) => ({
              ...c,
              chapterId:
                typeof (c as { chapterId?: unknown }).chapterId === 'string'
                  ? (c as { chapterId?: string }).chapterId
                  : null,
            }))
        : [],
      start: parsed.start,
    };
  } catch {
    return null;
  }
}

export function savePendingOnboarding(spaceId: string, pending: PendingOnboarding): void {
  try {
    localStorage.setItem(pendingOnboardingKey(spaceId), JSON.stringify(pending));
  } catch {
    /* private browsing — the in-memory copy still drives this visit */
  }
}

export function clearPendingOnboarding(spaceId: string): void {
  try {
    localStorage.removeItem(pendingOnboardingKey(spaceId));
  } catch {
    /* nothing to clear */
  }
}

/* ---------- welcome screen (shown once per user, before the exam picker) ---------- */

const welcomeSeenKey = (spaceId: string) => `vicharak_welcome_seen_${spaceId}`;

export function hasSeenWelcome(spaceId: string): boolean {
  try {
    return localStorage.getItem(welcomeSeenKey(spaceId)) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(spaceId: string): void {
  try {
    localStorage.setItem(welcomeSeenKey(spaceId), '1');
  } catch {
    /* state alone still moves this visit forward */
  }
}

/* ---------- starting point ("start fresh" vs "I've already started") ------ */

/**
 * Which path the student took on the starting-point screen. Neither path
 * generates tasks: "fresh" saves nothing at all, "started" saves exactly the
 * chapters they ticked. The only thing this flag buys is ONE gentle
 * suggestion bubble on Today for a student who started fresh and therefore
 * has an honestly empty list — tapped or ignored, it never comes back.
 */
export type ObStartMode = 'fresh' | 'started';

const startModeKey = (spaceId: string) => `vicharak_start_mode_${spaceId}`;
const startNudgeKey = (spaceId: string) => `vicharak_start_nudge_done_${spaceId}`;

export function saveStartMode(spaceId: string, mode: ObStartMode): void {
  try {
    localStorage.setItem(startModeKey(spaceId), mode);
  } catch {
    /* private browsing — the suggestion simply never shows */
  }
}

export function readStartMode(spaceId: string): ObStartMode | null {
  try {
    const raw = localStorage.getItem(startModeKey(spaceId));
    return raw === 'fresh' || raw === 'started' ? raw : null;
  } catch {
    return null;
  }
}

/** The suggestion is a one-off: accepting OR ignoring it retires it for good. */
export function startNudgeSpent(spaceId: string): boolean {
  try {
    return localStorage.getItem(startNudgeKey(spaceId)) === '1';
  } catch {
    return true;
  }
}

export function spendStartNudge(spaceId: string): void {
  try {
    localStorage.setItem(startNudgeKey(spaceId), '1');
  } catch {
    /* nothing to record — state alone hides it for this visit */
  }
}

/** Rebuild the ExamDef a pending onboarding was created with. */
export function pendingExamDef(pending: PendingOnboarding, today: string): ExamDef | null {
  if (pending.customExamJson) return parseCustomExam(pending.customExamJson, today) ?? null;
  return pending.examId ? getExam(pending.examId) ?? null : null;
}
