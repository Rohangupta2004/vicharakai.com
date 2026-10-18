/**
 * VicharakAI access rules — the single place the app and Settings decide what a
 * student can use.
 *
 * The live model (since 2026-08-18; trial extended 3 → 7 days on 2026-09-27):
 *  - Onboarding (welcome → exam picker → exam date + daily hours → value
 *    preview) is free. Completing it starts a 7-DAY FREE TRIAL with FULL
 *    access (no feature restrictions), recorded in the vicharakai_trials
 *    table keyed by the student's email — the EARLIEST record wins, so the
 *    clock never resets on a reinstall or a second device. The PaywallScreen
 *    fires only when the trial has expired AND no subscription is active.
 *  - ONE paid plan: VicharakAI Premium, ₹149/month. The yearly tier was
 *    retired on 2026-08-19 and the ₹10 day/'Trial' tier was DELETED on
 *    2026-09-27 — config, UI and the create-razorpay-order hook — because a
 *    free trial already covers "try it first" and two trials side by
 *    side only confused people. Payment routing is two rails, decided by the
 *    STUDENT'S EXAM (pricingRegion.ts): Indian exam → Razorpay (₹149/month,
 *    UPI/card/wallet), US/international exam → Creem ($14.99/month, merchant
 *    of record). Verified payments land in the vicharakai_subscriptions
 *    table (via the verify-razorpay-payment / razorpay-webhook hooks) and
 *    unlock the plan by the student's email (status === 'active' and
 *    expires_at > now).
 *    SUBSCRIPTION ALWAYS WINS: computeAccessStatus checks the active paid
 *    row FIRST — a student with one is 'subscribed' whatever the trial
 *    table says, so the trial banner can never show for a paying student.
 *  - A platform-side subscription (Settings → Stripe checkout) with
 *    status 'active' also unlocks the app, so legacy subscribers keep access.
 */

import { getSystemNow } from './systemDate';

/** Kill switch kept for emergencies — when true, everything is free again. */
export const PAYWALL_DISABLED = false;

/* ---------- lifetime premium (QA / founder-granted accounts) ---------- */

/**
 * Accounts with PERMANENT full access — they never see the paywall and never
 * expire, whatever the subscription or trial tables say. The QA/founder test
 * account lives here; computeAccessStatus short-circuits on it, and the
 * grant-lifetime-premium server hook mirrors the same entitlement into
 * vicharakai_subscriptions so the data layer agrees with the client check.
 */
export const LIFETIME_PREMIUM_EMAILS = ['grohan24102004@gmail.com'];

/** True when this email holds lifetime premium (case/whitespace-insensitive). */
export function isLifetimePremiumEmail(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false;
  return LIFETIME_PREMIUM_EMAILS.includes((email ?? '').trim().toLowerCase());
}

/** The minimal shape subscriptionIsPro needs — matches Settings' SubscriptionStatus. */
export interface SubscriptionLike {
  status: string;
  trialExpired?: boolean;
}

/**
 * Does this student have full access right now?
 * True for an active subscription or a platform-side (Stripe) trial.
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

/** @deprecated Legacy constants — the free tier and the old client-side
 * trial were removed on 2026-08-17. Kept only so older references keep
 * compiling; the live trial length is TRIAL_DURATION_DAYS. */
export const TRIAL_DAYS = 7;
export const FREE_DAILY_AI_MESSAGES = 5;
export const PRO_PRICE_MONTHLY = '₹149/month';

/* ---------- paid plans (Razorpay for India · Creem internationally) ---------- */

/** The plan ids checkout understands. 'monthly' is the ONLY one — the ₹10
 * day tier was deleted on 2026-09-27 from this config, from every screen and
 * from the create-razorpay-order hook, so no path can activate it again.
 * Legacy 'day' / 'yearly' rows already written to vicharakai_subscriptions
 * keep unlocking access until they expire: activePaidPlan reads those rows,
 * not this union. */
export type PaidPlanId = 'monthly';

export interface PaidPlanDef {
  label: string;
  /** Razorpay display price (INR) — derived from inrAmount. */
  inr: string;
  /** Creem display price (USD) — what a student outside India is charged. */
  usd: string;
  /** Numeric INR amount — the single source `inr` and `paise` derive from. */
  inrAmount: number;
  /** Numeric USD amount — the single source `usd` derives from. */
  usdAmount: number;
  /** Razorpay amount in paise — must match the create-razorpay-order hook. */
  paise: number;
  /** Human period — 'day', 'month', 'year'. */
  per: string;
  durationDays: number;
  badge: string | null;
}

/** Numeric plan amounts — the ONE place a price figure lives. Every display
 * string and the Razorpay paise amount derive from these. The USD figure
 * must match what the Creem product actually charges (see creemConfig.ts). */
const PLAN_AMOUNTS = {
  monthly: { inr: 149, usd: 14.99 },
} as const;

export const PAID_PLANS: Record<PaidPlanId, PaidPlanDef> = {
  monthly: {
    label: 'Monthly',
    inr: `₹${PLAN_AMOUNTS.monthly.inr}`,
    usd: `$${PLAN_AMOUNTS.monthly.usd}`,
    inrAmount: PLAN_AMOUNTS.monthly.inr,
    usdAmount: PLAN_AMOUNTS.monthly.usd,
    paise: PLAN_AMOUNTS.monthly.inr * 100,
    per: 'month',
    durationDays: 30,
    badge: null,
  },
};

/** The plans on sale — Monthly only. */
export const PAID_PLAN_IDS: PaidPlanId[] = ['monthly'];

/** The single plan every upgrade surface sells. */
export const PREMIUM_PLAN: PaidPlanId = 'monthly';

/** The product name every paid surface prints — never a bare "Monthly". */
export const PREMIUM_PRODUCT_NAME = 'VicharakAI Premium';

/** 'VicharakAI Premium · ₹149/month' — the one plan line, region-aware. */
export function premiumPlanTitle(isIndia: boolean = true): string {
  return `${PREMIUM_PRODUCT_NAME} · ${planPriceLabel(PREMIUM_PLAN, isIndia)}`;
}

/** 'Start free for 7 days, then ₹149/month. Cancel anytime.' */
export function trialFramingLine(isIndia: boolean = true): string {
  return `Start free for ${TRIAL_DURATION_DAYS} days, then ${planPriceLabel(PREMIUM_PLAN, isIndia)}. Cancel anytime.`;
}

/** What Premium includes — ONE list, shared by the paywall and Premium tab. */
export const PREMIUM_INCLUDES: string[] = [
  'Unlimited AI study plans, rebuilt every day',
  'Spaced revision that brings topics back before you forget',
  'AI prioritisation — what to study first, and why',
  'Weak-topic detection and smart practice cards',
  'Progress reports, streaks and full revision history',
];

/* The PUBLIC Razorpay key id is NOT hardcoded client-side: the
 * create-razorpay-order hook returns it as `key_id` alongside each order, so
 * the checkout modal always opens with the key matching the account the order
 * was created on (a mismatched key makes signature verification fail). */

/** '₹149/month' or '$14.99/month' — one plan's price line. `isIndia` comes
 * from pricingRegion.examPricingIsIndia(exam): the price follows the EXAM the
 * student picked, never their IP. Default true = India. */
export function planPriceLabel(plan: PaidPlanId, isIndia: boolean = true): string {
  const def = PAID_PLANS[plan];
  return `${isIndia ? def.inr : def.usd}/${def.per}`;
}

/** One row of the vicharakai_subscriptions table (written by the verify hook). */
export interface SubscriptionRow {
  id: number;
  user_email: string;
  plan_type: string;
  status: string;
  expires_at: string;
  created_at?: string | null;
}

/** Paid entitlement rows that may outrank the free trial. `lifetime` is the
 * founder-granted QA entitlement; it remains valid alongside the public plans. */
const PAID_ACCESS_PLAN_TYPES = new Set(['day', 'monthly', 'yearly', 'lifetime']);

/** The newest still-valid active paid plan among the user's subscription rows.
 * Trial-like rows can never win here, even if they are accidentally stored in
 * the subscriptions table with an active status. */
export function activePaidPlan(
  rows: SubscriptionRow[] | null | undefined,
  nowMs: number = getSystemNow(),
): SubscriptionRow | null {
  if (!rows || rows.length === 0) return null;
  let best: SubscriptionRow | null = null;
  for (const row of rows) {
    if (
      !row ||
      row.status !== 'active' ||
      !PAID_ACCESS_PLAN_TYPES.has(String(row.plan_type).trim().toLowerCase())
    ) continue;
    const expires = Date.parse(String(row.expires_at));
    if (!Number.isFinite(expires) || expires <= nowMs) continue;
    if (!best || expires > Date.parse(String(best.expires_at))) best = row;
  }
  return best;
}

/* ---------- 7-day free trial (vicharakai_trials) ---------- */

/** Length of the free trial every new student gets after onboarding.
 * EXTENDED 3 → 7 DAYS on 2026-09-27 (founder instruction). This constant is
 * the ONE place the trial length lives: the paywall, the onboarding CTA, the
 * in-app trial banner and every countdown derive from it, so the number can
 * never disagree with the date actually written to vicharakai_trials. */
export const TRIAL_DURATION_DAYS = 7;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 86_400_000;

/** One row of the vicharakai_trials table (written once by the app). */
export interface TrialRow {
  id?: number;
  email: string;
  /** ISO timestamp — when the trial began (first onboarding completion). */
  trial_started_at: string;
  /** ISO timestamp — trial_started_at + TRIAL_DURATION_DAYS days. */
  trial_expires_at: string;
  created_at?: string | null;
}

/**
 * The user's one true trial record: the EARLIEST started row for the email.
 * The table refuses updates/deletes from the app and the email is unique, so
 * a reinstall, a second device, or a re-insert can never reset the clock.
 */
export function trialRecord(rows: TrialRow[] | null | undefined): TrialRow | null {
  if (!rows || rows.length === 0) return null;
  let earliest: TrialRow | null = null;
  for (const row of rows) {
    if (!row || !row.trial_expires_at) continue;
    const started = Date.parse(String(row.trial_started_at));
    if (!earliest) {
      earliest = row;
      continue;
    }
    const earliestStarted = Date.parse(String(earliest.trial_started_at));
    if (Number.isFinite(started) && (!Number.isFinite(earliestStarted) || started < earliestStarted)) {
      earliest = row;
    }
  }
  return earliest;
}

/** Whole days left in a trial — ceil((expires − now) / 1 day), floored at 0. */
export function trialDaysLeft(expiresAt: string, nowMs: number = getSystemNow()): number {
  const expires = Date.parse(String(expiresAt));
  if (!Number.isFinite(expires)) return 0;
  return Math.max(0, Math.ceil((expires - nowMs) / 86_400_000));
}

export interface AccessStatus {
  status: 'subscribed' | 'trial' | 'expired';
  daysLeftInTrial: number | null;
  trialExpiresAt: string | null;
}

/**
 * The single access decision, in priority order:
 *  1. active paid subscription (vicharakai_subscriptions: status 'active' and
 *     expires_at > now) or a platform-side active plan → 'subscribed';
 *  2. active trial (vicharakai_trials: trial_expires_at > now) → 'trial';
 *  3. an expired trial record with no subscription → 'expired' (paywall).
 * A user with NO trial record and no subscription is reported as 'trial'
 * (with the full TRIAL_DURATION_DAYS): the app starts their trial the moment
 * onboarding completes, so a brand-new student is never paywalled on first
 * open. App.tsx computes this per render — the useAccessStatus shape
 * ({ status, daysLeftInTrial, trialExpiresAt }) is exactly this return.
 *
 * `email` short-circuits everything for LIFETIME_PREMIUM_EMAILS: those
 * accounts are 'subscribed' forever, before any table is consulted.
 * `nowMs` defaults to getSystemNow() so the QA Time Machine (systemDate.ts)
 * moves trial expiry with the simulated clock.
 */
export function computeAccessStatus({
  subscriptionRows,
  trialRows,
  platformPro = false,
  email = null,
  nowMs = getSystemNow(),
}: {
  subscriptionRows?: SubscriptionRow[] | null;
  trialRows?: TrialRow[] | null;
  platformPro?: boolean;
  /** The signed-in student's email — checked against LIFETIME_PREMIUM_EMAILS. */
  email?: string | null;
  nowMs?: number;
}): AccessStatus {
  if (isLifetimePremiumEmail(email)) {
    return { status: 'subscribed', daysLeftInTrial: null, trialExpiresAt: null };
  }
  if (PAYWALL_DISABLED || platformPro || activePaidPlan(subscriptionRows, nowMs)) {
    return { status: 'subscribed', daysLeftInTrial: null, trialExpiresAt: null };
  }
  const trial = trialRecord(trialRows);
  if (!trial) {
    return { status: 'trial', daysLeftInTrial: TRIAL_DURATION_DAYS, trialExpiresAt: null };
  }
  const expires = Date.parse(String(trial.trial_expires_at));
  if (Number.isFinite(expires) && expires > nowMs) {
    return {
      status: 'trial',
      daysLeftInTrial: trialDaysLeft(trial.trial_expires_at, nowMs),
      trialExpiresAt: trial.trial_expires_at,
    };
  }
  return { status: 'expired', daysLeftInTrial: null, trialExpiresAt: trial.trial_expires_at };
}

/** @deprecated Free-tier limit message — the daily cap no longer exists. */
export const LIMIT_MESSAGE = 'VicharakAI needs an active plan — unlock it from the Premium screen.';

type AccessTier = 'pro' | 'locked';

export interface AiAccess {
  tier: AccessTier;
  /** May the next free-form AI chat message be sent? */
  canAskAi: boolean;
  usedToday: number;
  messagesRemaining: number | null;
  /** Premium features — AI chat, photo scan / doubt capture, AI test
   * generation. True on an active plan; false when locked at the paywall. */
  premiumUnlocked: boolean;
}

interface ComputeAiAccessArgs {
  isPro: boolean;
  usedToday: number;
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

function usageStorageKey(spaceId: string, today: string): string {
  return `vicharakai:${spaceId}:ai-usage:${today}`;
}

/** Durable zuno_meta key for one account's daily AI usage. */
export function aiUsageMetaKey(today: string): string {
  return `ai_usage|${today}`;
}

function subscriptionStatusKey(spaceId: string): string {
  return `vicharakai:${spaceId}:subscription_status`;
}

/* ---------- subscription bookkeeping ---------- */

export type StoredSubscriptionStatus = 'active' | 'locked';

/** Mirror the derived tier into storage as `subscription_status`. */
export function persistSubscriptionStatus(spaceId: string, status: StoredSubscriptionStatus): void {
  writeLocal(subscriptionStatusKey(spaceId), status);
}

export function readSubscriptionStatus(spaceId: string): StoredSubscriptionStatus | null {
  const value = readLocal(subscriptionStatusKey(spaceId));
  return value === 'active' || value === 'locked' ? value : null;
}

/* ---------- daily AI usage (account state + same-visit local cache) ---------- */

/** Parse an AI usage value from either zuno_meta or the browser cache. */
export function readAiUsageValue(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** Instant-boot cache only; zuno_meta is the durable source of truth. */
export function readAiUsedToday(spaceId: string, today: string): number {
  return readAiUsageValue(readLocal(usageStorageKey(spaceId, today)));
}

export function cacheAiUsedToday(spaceId: string, today: string, usedToday: number): void {
  writeLocal(usageStorageKey(spaceId, today), String(readAiUsageValue(usedToday)));
}

/** Increment the local same-visit cache; the caller mirrors `next` to zuno_meta. */
export function recordAiMessage(
  spaceId: string,
  today: string,
  usedToday: number = readAiUsedToday(spaceId, today),
): number {
  const next = readAiUsageValue(usedToday) + 1;
  cacheAiUsedToday(spaceId, today, next);
  return next;
}

/**
 * The access model since 2026-08-18: an active subscription OR an active
 * free trial unlocks everything (callers pass either as isPro — trial
 * access has no feature restrictions); with neither the student is LOCKED —
 * the trial-expiry paywall in App.tsx blocks the app before any locked state
 * could ever matter in the UI. The Explorer (free) tier is gone.
 */
export function computeAiAccess({ isPro, usedToday }: ComputeAiAccessArgs): AiAccess {
  const safeUsedToday = Number.isFinite(usedToday) && usedToday > 0 ? Math.floor(usedToday) : 0;

  if (PAYWALL_DISABLED || isPro) {
    return {
      tier: 'pro',
      canAskAi: true,
      usedToday: safeUsedToday,
      messagesRemaining: null,
      premiumUnlocked: true,
    };
  }

  return {
    tier: 'locked',
    canAskAi: false,
    usedToday: safeUsedToday,
    messagesRemaining: 0,
    premiumUnlocked: false,
  };
}

/* ---------- copy — every plan line the UI shows ---------- */

export function planLabel(access: AiAccess): string {
  return access.tier === 'pro' ? 'VicharakAI Premium' : 'Plan locked';
}

/**
 * Short banner headline used by PlanBanner in ui.tsx. This export was missing
 * after the 2026-08-10 rebuild of this module (ui.tsx still imported it), so
 * the compiler auto-stubbed it — calling the stub crashed the app at runtime.
 */
export function planHeadline(access: AiAccess): string {
  return access.tier === 'pro'
    ? 'VicharakAI Premium'
    : 'Subscription needed — unlock VicharakAI to continue';
}

export function planDetail(access: AiAccess): string {
  return access.tier === 'pro'
    ? 'Unlimited AI coaching, photo scan and test generation.'
    : 'Pick a plan on the Premium screen and everything unlocks instantly.';
}

export function planStatusLine(access: AiAccess): string {
  return access.tier === 'pro' ? 'Unlimited AI messages' : 'Locked — plan needed';
}
