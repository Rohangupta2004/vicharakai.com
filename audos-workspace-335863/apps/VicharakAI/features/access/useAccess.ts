/**
 * Access feature — subscription + 3-day trial + paywall state. The ONE place
 * the app decides what a student can use (rules themselves live in access.ts).
 * Extracted verbatim from App.tsx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PAID_PLANS,
  PAYWALL_DISABLED,
  TRIAL_DURATION_MS,
  activePaidPlan,
  aiUsageMetaKey,
  cacheAiUsedToday,
  computeAccessStatus,
  computeAiAccess,
  isLifetimePremiumEmail,
  persistSubscriptionStatus,
  readAiUsageValue,
  readAiUsedToday,
  recordAiMessage,
  subscriptionIsPro,
  type AccessStatus,
  type AiAccess,
  type PaidPlanId,
  type SubscriptionRow,
  type TrialRow,
} from '../../access';
import type { PremiumFeature } from '../../PaywallScreen';
import { VICHARAK_NAV_TARGET_KEY } from '../../ui';
import { getSystemDate } from '../../systemDate';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';
import { readSessionEmail, readStoredSession } from '../../shared/sessionUtils';
import { trackCheckoutSuccess, trackEvent, trackEventOnce, trackedExamLabel } from '../../shared/track';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';

const CREEM_CHECKOUT_PENDING_KEY = 'vicharakai_creem_checkout_pending';

export interface AccessFeature {
  paidSessionEmail: string;
  isQaTester: boolean;
  subscriptionsQ: { data: SubscriptionRow[]; loading: boolean; error: Error | null; refresh: () => void };
  trialsQ: { data: TrialRow[]; loading: boolean; error: Error | null; refresh: () => void };
  paidPlan: SubscriptionRow | null;
  accessStatus: AccessStatus;
  access: AiAccess;
  gateUnlocked: boolean;
  accessChecking: boolean;
  /** What sent the student to the Premium tab — null once they leave it. */
  paywall: { feature: PremiumFeature | null } | null;
  /** Navigate to the in-app Premium tab, naming the feature that was locked. */
  openPaywall: (feature: PremiumFeature | null) => void;
  closePaywall: () => void;
  handlePaymentSuccess: (plan: PaidPlanId) => void;
  aiUsedToday: number;
  /** Account-scoped usage tick after an AI call; paid access stays unlimited. */
  chargeAi: () => void;
}

export function useAccess(data: StudentData, toast: ToastFeature): AccessFeature {
  const {
    spaceId,
    sessionMetadata,
    today,
    profile,
    examDef,
    savedExamLabel,
    dbSessionReady,
    metaQ,
    upsertMeta,
  } = data;
  const { showToast } = toast;

  /* Paid entitlements — shared rows written by the payment hooks, looked up
   * by the signed-in email (see activePaidPlan in access.ts). */
  const paidSessionEmail = readSessionEmail(spaceId);
  /* QA/founder account — lifetime premium, plus the visible Test Controls
   * entry on the Profile tab (everyone else only has the hidden gesture). */
  const isQaTester = isLifetimePremiumEmail(paidSessionEmail);
  const subscriptionsQ = window.useWorkspaceDB<SubscriptionRow>(TABLES.subscriptions, {
    shared: true,
    limit: 20,
    orderBy: { column: 'id', direction: 'desc' },
    filters: [{ column: 'user_email', operator: '=', value: paidSessionEmail }],
  });
  /* 3-day free-trial records — shared rows keyed by email. Insert-only with a
   * unique email server-side, and access.ts reads the EARLIEST row, so the
   * trial clock can never be reset from a client. */
  const trialsQ = window.useWorkspaceDB<TrialRow>(TABLES.trials, {
    shared: true,
    limit: 20,
    orderBy: { column: 'id', direction: 'asc' },
    filters: [{ column: 'email', operator: '=', value: paidSessionEmail }],
  });

  const [isPro, setIsPro] = useState(false);
  /* Browser storage is only the instant-boot cache. Once zuno_meta loads, its
   * account-scoped value wins unless this visit has already charged a call. */
  const [aiUsedToday, setAiUsedToday] = useState(() => readAiUsedToday(spaceId, today));
  const aiUsageRef = useRef(aiUsedToday);
  const aiUsageVisitKeyRef = useRef(`${spaceId}|${paidSessionEmail}|${today}`);
  const aiUsageChargedThisVisitRef = useRef(false);
  const [paywall, setPaywall] = useState<{ feature: PremiumFeature | null } | null>(null);

  /* A verified payment is resolved before trial state. Do this on every
   * render rather than memoizing the query array: the WorkspaceDB hook may
   * refresh rows in place after a webhook/payment, and a stale memo must never
   * leave a paying student displayed as a trial user. */
  const subscriptionRows = paidSessionEmail ? subscriptionsQ.data ?? [] : [];
  const paidPlan = activePaidPlan(subscriptionRows);
  /* Subscription always wins. Only when no active paid row exists do we
   * evaluate the free trial (then the paywall). Trials remain fully intact for
   * students who have not paid. */
  const accessStatus: AccessStatus = paidPlan
    ? { status: 'subscribed', daysLeftInTrial: null, trialExpiresAt: null }
    : computeAccessStatus({
        subscriptionRows: [],
        trialRows: paidSessionEmail ? trialsQ.data ?? [] : [],
        platformPro: isPro,
        email: paidSessionEmail,
      });
  /* Trial access is FULL access — no feature restrictions during the trial. */
  const access = useMemo(
    () => computeAiAccess({ isPro: accessStatus.status !== 'expired', usedToday: aiUsedToday }),
    [accessStatus.status, aiUsedToday],
  );
  /* The paywall gate fires ONLY when the free trial is over and no
   * subscription is active — never right after onboarding. */
  const gateUnlocked = PAYWALL_DISABLED || accessStatus.status !== 'expired';
  /* While the subscription/trial lookups are still resolving for a signed-in
   * student, hold the loader instead of flashing Today at someone whose trial
   * may already be over. A confirmed plan or trial record skips the wait. */
  const accessChecking =
    !PAYWALL_DISABLED &&
    Boolean(paidSessionEmail) &&
    (subscriptionsQ.loading || trialsQ.loading) &&
    accessStatus.status !== 'subscribed' &&
    !accessStatus.trialExpiresAt;

  /* A premium gate is a DESTINATION, not an interruption: since 2026-09-27
   * this navigates to the Premium tab (which names `feature` at the top)
   * instead of throwing a full-screen modal over whatever the student was
   * doing. The nav-target key + 'openApp' event is the same route every
   * deep link already takes, so no caller had to change. The one paywall
   * that still covers the app is the trial-expiry gate in AppShell. */
  const openPaywall = (feature: PremiumFeature | null) => {
    setPaywall({ feature });
    try {
      localStorage.setItem(VICHARAK_NAV_TARGET_KEY, 'premium');
    } catch {
      /* storage unavailable — the event below still carries the request */
    }
    try {
      window.dispatchEvent(new CustomEvent('openApp'));
    } catch {
      /* nothing else to try */
    }
  };
  const closePaywall = () => setPaywall(null);

  /* Mirror the derived tier into storage as subscription_status. */
  useEffect(() => {
    persistSubscriptionStatus(spaceId, access.tier === 'pro' ? 'active' : 'locked');
  }, [spaceId, access.tier]);

  /* Payment is LIVE: PaywallScreen runs the Razorpay flow itself. The verify
   * hook has already written the subscription row before this fires. */
  const handlePaymentSuccess = (plan: PaidPlanId) => {
    trackEvent('payment_completed', {
      plan,
      amount_inr: PAID_PLANS[plan].inrAmount,
      spaceId,
    });
    try {
      sessionStorage.removeItem(CREEM_CHECKOUT_PENDING_KEY);
    } catch {
      /* already counted on the Razorpay rail */
    }
    setPaywall(null);
    subscriptionsQ.refresh();
    showToast('Payment successful — VicharakAI Premium is unlocked!');
  };

  /* Creem pays in another tab. Count the purchase only when access flips
     from not-subscribed to subscribed after that tab was opened — a refresh
     of an already-paid account must not look like a new sale. */
  const wasSubscribedRef = useRef(false);
  useEffect(() => {
    const nowSubscribed = Boolean(paidPlan);
    if (subscriptionsQ.loading) return;
    let pending = '';
    try {
      pending = sessionStorage.getItem(CREEM_CHECKOUT_PENDING_KEY) || '';
    } catch {
      pending = '';
    }
    if (pending && nowSubscribed && !wasSubscribedRef.current) {
      try {
        sessionStorage.removeItem(CREEM_CHECKOUT_PENDING_KEY);
      } catch {
        /* flag is gone either way */
      }
      trackCheckoutSuccess('creem', {
        plan: paidPlan?.plan_type || pending,
        spaceId,
      });
    }
    wasSubscribedRef.current = nowSubscribed;
  }, [paidPlan, subscriptionsQ.loading, spaceId]);

  /* The blocking gate is the only place a student learns the trial is over.
     Fire once per device so a reload of the lockout screen does not look
     like a second expiry. */
  useEffect(() => {
    if (PAYWALL_DISABLED || accessStatus.status !== 'expired') return;
    if (subscriptionsQ.loading || trialsQ.loading) return;
    trackEventOnce(spaceId, 'trial_expired_fired', 'trial_expired', {
      exam: trackedExamLabel(examDef, savedExamLabel, profile?.exam),
      subscriptionLapsed: (subscriptionsQ.data ?? []).length > 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessStatus.status, subscriptionsQ.loading, trialsQ.loading, spaceId]);

  /* Start the 3-day free trial the moment onboarding is complete for a
   * signed-in student with no trial record and no active plan. At most one
   * attempt per visit; an existing record is never touched. */
  const trialStartRef = useRef(false);
  useEffect(() => {
    if (trialStartRef.current || PAYWALL_DISABLED) return;
    if (!profile || !dbSessionReady || !paidSessionEmail) return;
    if (subscriptionsQ.loading || trialsQ.loading) return;
    if ((trialsQ.data ?? []).length > 0 || accessStatus.status === 'subscribed') return;
    trialStartRef.current = true;
    // System clock: the QA Time Machine moves trial start/expiry with it.
    const startedAt = getSystemDate();
    const expiresAt = new Date(startedAt.getTime() + TRIAL_DURATION_MS);
    const trialExam = trackedExamLabel(examDef, savedExamLabel, profile.exam);
    void verifiedDbFrom(TABLES.trials)
      .insert({
        email: paidSessionEmail,
        trial_started_at: startedAt.toISOString(),
        trial_expires_at: expiresAt.toISOString(),
        created_at: startedAt.toISOString(),
      })
      .then(() => {
        // The trial row is the student's activation record — report it only
        // once it actually exists (a refused duplicate lands in catch below).
        trackEvent('trial_started', {
          exam: trialExam,
          trial_expires_at: expiresAt.toISOString(),
          spaceId,
        });
        trialsQ.refresh();
      })
      .catch(() => {
        // A duplicate insert (a second device racing) is refused by the
        // unique-email guard — re-read either way; the record that exists wins.
        trialsQ.refresh();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, dbSessionReady, paidSessionEmail, subscriptionsQ.loading, trialsQ.loading, trialsQ.data, accessStatus.status]);

  /* Data-layer mirror of the lifetime-premium grant (QA account only). */
  const lifetimeGrantRef = useRef(false);
  useEffect(() => {
    if (lifetimeGrantRef.current || !isQaTester || !paidSessionEmail) return;
    if (subscriptionsQ.loading) return;
    const rows = subscriptionsQ.data ?? [];
    if (rows.some((row) => row.plan_type === 'lifetime' && row.status === 'active')) return;
    lifetimeGrantRef.current = true;
    void fetch(`/api/hooks/execute/${spaceId}/grant-lifetime-premium`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: paidSessionEmail }),
    })
      .then(() => subscriptionsQ.refresh())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQaTester, paidSessionEmail, subscriptionsQ.loading, subscriptionsQ.data, spaceId]);

  /* Re-check when returning-user identity arrives — legacy platform-side
   * (Stripe) subscribers keep access. */
  useEffect(() => {
    const session = readStoredSession(spaceId);
    const metadata = (session?.metadata as Record<string, unknown> | undefined) ?? sessionMetadata;
    const email = typeof session?.email === 'string' ? (session.email ?? '').trim().toLowerCase() : '';
    const metadataLike = metadata as unknown as { status: string };
    if (!email.includes('@')) {
      setIsPro(subscriptionIsPro(metadataLike));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/space/${spaceId}/subscription-status?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          if (!cancelled) setIsPro(subscriptionIsPro(metadataLike));
          return;
        }
        const payload = (await res.json()) as { status?: unknown };
        const payloadLike = payload as unknown as { status: string };
        if (!cancelled) setIsPro(subscriptionIsPro(payloadLike) || subscriptionIsPro(metadataLike));
      } catch {
        if (!cancelled) setIsPro(subscriptionIsPro(metadataLike));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, sessionMetadata]);

  /* zuno_meta is account-keyed by StudentDataContext's cross-session merge.
   * Historical duplicate rows can exist under different login sessions, so
   * use the greatest observed value; a stale row must never reset the count. */
  const durableAiUsedToday = useMemo(() => {
    const key = aiUsageMetaKey(today);
    let greatest = 0;
    for (const row of metaQ.data ?? []) {
      if (row.meta_key !== key) continue;
      greatest = Math.max(greatest, readAiUsageValue(row.meta_value));
    }
    return greatest;
  }, [metaQ.data, today]);

  /* Re-hydrate when identity/date changes and when the durable read lands.
   * A charge made during this visit stays optimistic on screen while its
   * serialized upsert finishes behind it, matching the hero-pin pattern. */
  useEffect(() => {
    const visitKey = `${spaceId}|${paidSessionEmail}|${today}`;
    if (aiUsageVisitKeyRef.current !== visitKey) {
      aiUsageVisitKeyRef.current = visitKey;
      aiUsageChargedThisVisitRef.current = false;
      const cached = readAiUsedToday(spaceId, today);
      aiUsageRef.current = cached;
      setAiUsedToday(cached);
    }
    if (metaQ.loading || aiUsageChargedThisVisitRef.current) return;
    aiUsageRef.current = durableAiUsedToday;
    setAiUsedToday(durableAiUsedToday);
    cacheAiUsedToday(spaceId, today, durableAiUsedToday);
  }, [spaceId, paidSessionEmail, today, sessionMetadata, metaQ.loading, durableAiUsedToday]);

  const chargeAi = () => {
    /* Never move backwards if a cross-device value arrived between renders. */
    const current = Math.max(aiUsageRef.current, durableAiUsedToday);
    const next = recordAiMessage(spaceId, today, current);
    aiUsageChargedThisVisitRef.current = true;
    aiUsageRef.current = next;
    setAiUsedToday(next);
    // Durable account state; a failed write leaves this visit's cache intact.
    void upsertMeta(aiUsageMetaKey(today), String(next)).catch(() => undefined);
  };

  return {
    paidSessionEmail,
    isQaTester,
    subscriptionsQ,
    trialsQ,
    paidPlan,
    accessStatus,
    access,
    gateUnlocked,
    accessChecking,
    paywall,
    openPaywall,
    closePaywall,
    handlePaymentSuccess,
    aiUsedToday,
    chargeAi,
  };
}
