/**
 * VicharakAI access rules — the single place the app and Settings decide what a
 * student can use.
 *
 * This module was lost when apps/Zuno/ was wiped and rebuilt on 2026-08-10;
 * components/Settings.tsx still imports { subscriptionIsPro } from here, so
 * its absence broke the whole space compile ("App Loading Error"). Recreated
 * to match the behaviour the Settings copy describes: the paywall is
 * currently DISABLED and everything is free.
 *
 * TEMP: Paywall disabled 2026-08-08 — flip PAYWALL_DISABLED back to false
 * once payments are ready, and Settings' plan copy should be restored to the
 * metered wording at the same time.
 */

export const PAYWALL_DISABLED = true;

/** The minimal shape subscriptionIsPro needs — matches Settings' SubscriptionStatus. */
export interface SubscriptionLike {
  status: string;
  trialExpired?: boolean;
}

/**
 * Does this student have full (Pro) access right now?
 * While PAYWALL_DISABLED is true, everyone does — no metering, no trial gate.
 */
export function subscriptionIsPro(subscription: SubscriptionLike | null | undefined): boolean {
  if (PAYWALL_DISABLED) return true;
  if (!subscription) return false;
  return (
    subscription.status === 'active' ||
    subscription.status === 'trial' ||
    subscription.status === 'trialing'
  );
}

export const TRIAL_DAYS = 5;
export const FREE_DAILY_AI_MESSAGES = 2;
export const PRO_PRICE_MONTHLY = '₹149/month';
export const LIMIT_MESSAGE = `You've used today's ${FREE_DAILY_AI_MESSAGES} free AI messages. Your planner, revisions, calendar and dashboard are still fully available.`;
export const TRIAL_START_META_KEY = 'vicharakai_trial_start';
export const PRO_INTEREST_META_KEY = 'vicharakai_pro_interest';

type AccessTier = 'trial' | 'free' | 'pro';

export interface AiAccess {
  tier: AccessTier;
  canAskAi: boolean;
  usedToday: number;
  messagesRemaining: number | null;
  trialDaysRemaining: number;
}

interface ResolveTrialStartArgs {
  spaceId: string;
  savedTrialStart?: string | null;
  planStartDate?: string | null;
  today: string;
}

interface ComputeAiAccessArgs {
  isPro: boolean;
  trialStart: string;
  today: string;
  usedToday: number;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  if (!DAY_PATTERN.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : day;
}

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in privacy mode; access must still work.
  }
}

function trialStorageKey(spaceId: string): string {
  return `vicharakai:${spaceId}:trial-start`;
}

function usageStorageKey(spaceId: string, today: string): string {
  return `vicharakai:${spaceId}:ai-usage:${today}`;
}

function trialAnnouncementKey(spaceId: string): string {
  return `vicharakai:${spaceId}:trial-end-announced`;
}

/** Resolve a stable trial anchor without ever depending on a missing runtime hook. */
export function resolveTrialStart({
  spaceId,
  savedTrialStart,
  planStartDate,
  today,
}: ResolveTrialStartArgs): string {
  return (
    normalizeDay(savedTrialStart) ||
    normalizeDay(readLocal(trialStorageKey(spaceId))) ||
    normalizeDay(planStartDate) ||
    normalizeDay(today) ||
    new Date().toISOString().slice(0, 10)
  );
}

export function rememberTrialStart(spaceId: string, trialStart: string): void {
  const day = normalizeDay(trialStart);
  if (day) writeLocal(trialStorageKey(spaceId), day);
}

export function readAiUsedToday(spaceId: string, today: string): number {
  const value = Number.parseInt(readLocal(usageStorageKey(spaceId, today)) || '0', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function recordAiMessage(spaceId: string, today: string): number {
  const next = readAiUsedToday(spaceId, today) + 1;
  writeLocal(usageStorageKey(spaceId, today), String(next));
  return next;
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
}

export function computeAiAccess({
  isPro,
  trialStart,
  today,
  usedToday,
}: ComputeAiAccessArgs): AiAccess {
  const safeUsedToday = Number.isFinite(usedToday) && usedToday > 0 ? Math.floor(usedToday) : 0;

  // The paywall is intentionally off: retain the Free label while granting all AI access.
  if (PAYWALL_DISABLED) {
    return {
      tier: 'free',
      canAskAi: true,
      usedToday: safeUsedToday,
      messagesRemaining: null,
      trialDaysRemaining: 0,
    };
  }

  if (isPro) {
    return {
      tier: 'pro',
      canAskAi: true,
      usedToday: safeUsedToday,
      messagesRemaining: null,
      trialDaysRemaining: 0,
    };
  }

  const elapsedDays = daysBetween(
    normalizeDay(trialStart) || normalizeDay(today) || new Date().toISOString().slice(0, 10),
    normalizeDay(today) || new Date().toISOString().slice(0, 10),
  );
  const trialDaysRemaining = Math.max(0, TRIAL_DAYS - elapsedDays);
  if (trialDaysRemaining > 0) {
    return {
      tier: 'trial',
      canAskAi: true,
      usedToday: safeUsedToday,
      messagesRemaining: null,
      trialDaysRemaining,
    };
  }

  const messagesRemaining = Math.max(0, FREE_DAILY_AI_MESSAGES - safeUsedToday);
  return {
    tier: 'free',
    canAskAi: messagesRemaining > 0,
    usedToday: safeUsedToday,
    messagesRemaining,
    trialDaysRemaining: 0,
  };
}

export function shouldAnnounceTrialEnd(spaceId: string): boolean {
  return readLocal(trialAnnouncementKey(spaceId)) !== 'true';
}

export function markTrialEndAnnounced(spaceId: string): void {
  writeLocal(trialAnnouncementKey(spaceId), 'true');
}

export function planLabel(access: AiAccess): string {
  if (PAYWALL_DISABLED) return 'VicharakAI Free';
  if (access.tier === 'pro') return 'VicharakAI Pro';
  if (access.tier === 'trial') return 'Free trial';
  return 'VicharakAI Free';
}

/**
 * Short banner headline used by PlanBanner in ui.tsx. This export was missing
 * after the 2026-08-10 rebuild of this module (ui.tsx still imported it), so
 * the compiler auto-stubbed it — calling the stub crashed the app at runtime.
 */
export function planHeadline(access: AiAccess): string {
  if (PAYWALL_DISABLED) return 'VicharakAI is free right now';
  if (access.tier === 'pro') return 'VicharakAI Pro';
  if (access.tier === 'trial') {
    return `Free trial — ${access.trialDaysRemaining} day${access.trialDaysRemaining === 1 ? '' : 's'} of unlimited AI left`;
  }
  return `${access.messagesRemaining ?? 0} of ${FREE_DAILY_AI_MESSAGES} free AI messages left today`;
}

export function planDetail(access: AiAccess): string {
  if (PAYWALL_DISABLED) return 'Everything is open, including unlimited AI coaching.';
  if (access.tier === 'pro') return 'Unlimited AI coaching.';
  if (access.tier === 'trial') return `${access.trialDaysRemaining} trial day${access.trialDaysRemaining === 1 ? '' : 's'} remaining.`;
  return `${FREE_DAILY_AI_MESSAGES} AI messages each day; planning tools stay unlimited.`;
}

export function planStatusLine(access: AiAccess): string {
  if (PAYWALL_DISABLED || access.tier === 'pro') return 'Unlimited AI messages';
  if (access.tier === 'trial') return `${access.trialDaysRemaining} days of unlimited AI remaining`;
  return `${access.messagesRemaining ?? 0} of ${FREE_DAILY_AI_MESSAGES} AI messages left today`;
}
