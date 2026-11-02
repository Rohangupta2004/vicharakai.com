/**
 * Access feature — the only browser entry point for subscription and trial state.
 * Identity, trial dates and paid entitlements are resolved by the
 * session-verified vicharakai-entitlement server function. The browser never
 * reads or writes the underlying payment tables.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PAID_PLANS,
  PAYWALL_DISABLED,
  TRIAL_DURATION_DAYS,
  aiUsageMetaKey,
  cacheAiUsedToday,
  computeAiAccess,
  persistSubscriptionStatus,
  readAiUsageValue,
  readAiUsedToday,
  recordAiMessage,
  type AccessStatus,
  type AiAccess,
  type PaidPlanId,
  type SubscriptionRow,
  type TrialRow,
} from '../../access';
import type { PremiumFeature } from '../../PaywallScreen';
import { VICHARAK_NAV_TARGET_KEY } from '../../ui';
import { hookHeaders } from '../../shared/platformAuth';
import { readSessionEmail } from '../../shared/sessionUtils';
import { trackEvent } from '../../shared/track';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';

interface EntitlementResponse {
  plan: string | null;
  status: 'pending' | 'subscribed' | 'trial' | 'expired';
  expires_at: string | null;
}

interface QueryView<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export interface AccessFeature {
  paidSessionEmail: string;
  /** Retained for old consumers; founder access is now decided server-side. */
  isQaTester: boolean;
  subscriptionsQ: QueryView<SubscriptionRow>;
  trialsQ: QueryView<TrialRow>;
  paidPlan: SubscriptionRow | null;
  accessStatus: AccessStatus;
  access: AiAccess;
  gateUnlocked: boolean;
  accessChecking: boolean;
  entitlementError: Error | null;
  retryEntitlement: () => void;
  paywall: { feature: PremiumFeature | null } | null;
  openPaywall: (feature: PremiumFeature | null) => void;
  closePaywall: () => void;
  handlePaymentSuccess: (plan: PaidPlanId) => void;
  aiUsedToday: number;
  chargeAi: () => void;
}

function unwrapEntitlement(value: unknown): EntitlementResponse | null {
  const outer = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const candidate = outer?.data && typeof outer.data === 'object'
    ? (outer.data as Record<string, unknown>)
    : outer;
  if (!candidate) return null;
  const status = candidate.status;
  if (status !== 'pending' && status !== 'subscribed' && status !== 'trial' && status !== 'expired') return null;
  return {
    plan: typeof candidate.plan === 'string' ? candidate.plan : null,
    status,
    expires_at: typeof candidate.expires_at === 'string' ? candidate.expires_at : null,
  };
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useAccess(
  data: StudentData,
  toast: ToastFeature,
  consentComplete: boolean,
): AccessFeature {
  const { spaceId, today, profile, dbSessionReady, metaQ, upsertMeta } = data;
  const { showToast } = toast;
  const paidSessionEmail = readSessionEmail(spaceId);
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [entitlementError, setEntitlementError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const retryEntitlement = useCallback(() => setRefreshToken((value) => value + 1), []);

  const requestEntitlement = useCallback(async (action: 'status' | 'start_trial'): Promise<EntitlementResponse> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/hooks/execute/${spaceId}/vicharakai-entitlement`, {
          method: 'POST',
          headers: hookHeaders(),
          body: JSON.stringify({ action }),
        });
        const payload = await response.json().catch(() => null);
        const parsed = unwrapEntitlement(payload);
        if (response.ok && parsed) return parsed;
        const message = payload && typeof payload === 'object' && typeof (payload as any).error === 'string'
          ? (payload as any).error
          : 'Your plan status could not be verified.';
        lastError = new Error(message);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Your plan status could not be verified.');
      }
      if (attempt < 2) await wait(400 * (attempt + 1));
    }
    throw lastError ?? new Error('Your plan status could not be verified.');
  }, [spaceId]);

  useEffect(() => {
    let cancelled = false;
    setEntitlementLoading(true);
    setEntitlementError(null);
    if (!paidSessionEmail) {
      setEntitlement(null);
      setEntitlementLoading(false);
      setEntitlementError(new Error('Please sign in again so we can verify your plan.'));
      return () => { cancelled = true; };
    }
    void requestEntitlement('status')
      .then((next) => { if (!cancelled) setEntitlement(next); })
      .catch((error) => { if (!cancelled) setEntitlementError(error instanceof Error ? error : new Error('Your plan status could not be verified.')); })
      .finally(() => { if (!cancelled) setEntitlementLoading(false); });
    return () => { cancelled = true; };
  }, [paidSessionEmail, refreshToken, requestEntitlement]);

  /* A missing trial is PENDING, never free. Ask the server to create it only
   * after onboarding has a durable profile AND the age/consent step is
   * complete. This keeps the seven-day clock stopped while account setup is
   * still gated. */
  const trialStartKeyRef = useRef('');
  useEffect(() => {
    if (PAYWALL_DISABLED || !consentComplete || !profile || !dbSessionReady || !paidSessionEmail) return;
    if (entitlementLoading || entitlement?.status !== 'pending') return;
    const key = `${paidSessionEmail}|${profile.id}|${refreshToken}`;
    if (trialStartKeyRef.current === key) return;
    trialStartKeyRef.current = key;
    setEntitlementLoading(true);
    setEntitlementError(null);
    void requestEntitlement('start_trial')
      .then((next) => {
        setEntitlement(next);
        if (next.status === 'trial') {
          trackEvent('trial_started', { trial_expires_at: next.expires_at, spaceId });
        }
      })
      .catch((error) => setEntitlementError(error instanceof Error ? error : new Error('Your free trial could not be started.')))
      .finally(() => setEntitlementLoading(false));
  }, [consentComplete, profile, dbSessionReady, paidSessionEmail, entitlementLoading, entitlement?.status, refreshToken, requestEntitlement, spaceId]);

  const accessStatus: AccessStatus = PAYWALL_DISABLED
    ? { status: 'subscribed', daysLeftInTrial: null, trialExpiresAt: null }
    : entitlement?.status === 'subscribed'
      ? { status: 'subscribed', daysLeftInTrial: null, trialExpiresAt: null }
      : entitlement?.status === 'trial' && entitlement.expires_at
        ? {
            status: 'trial',
            daysLeftInTrial: Math.max(0, Math.ceil((Date.parse(entitlement.expires_at) - Date.now()) / 86_400_000)),
            trialExpiresAt: entitlement.expires_at,
          }
        : entitlement?.status === 'expired'
          ? { status: 'expired', daysLeftInTrial: null, trialExpiresAt: entitlement.expires_at }
          : { status: 'pending', daysLeftInTrial: null, trialExpiresAt: null };

  const paidPlan: SubscriptionRow | null = entitlement?.status === 'subscribed' && entitlement.expires_at
    ? {
        id: -1,
        user_email: '',
        plan_type: entitlement.plan || 'monthly',
        status: 'active',
        expires_at: entitlement.expires_at,
      }
    : null;
  const trialRow: TrialRow | null = entitlement?.expires_at && (entitlement.status === 'trial' || entitlement.status === 'expired')
    ? {
        email: '',
        trial_started_at: new Date(Date.parse(entitlement.expires_at) - TRIAL_DURATION_DAYS * 86_400_000).toISOString(),
        trial_expires_at: entitlement.expires_at,
      }
    : null;
  const subscriptionsQ: QueryView<SubscriptionRow> = {
    data: paidPlan ? [paidPlan] : [],
    loading: entitlementLoading,
    error: entitlementError,
    refresh: retryEntitlement,
  };
  const trialsQ: QueryView<TrialRow> = {
    data: trialRow ? [trialRow] : [],
    loading: entitlementLoading,
    error: entitlementError,
    refresh: retryEntitlement,
  };

  const [aiUsedToday, setAiUsedToday] = useState(() => readAiUsedToday(spaceId, today));
  const aiUsageRef = useRef(aiUsedToday);
  const aiUsageVisitKeyRef = useRef(`${spaceId}|${paidSessionEmail}|${today}`);
  const aiUsageChargedThisVisitRef = useRef(false);
  const [paywall, setPaywall] = useState<{ feature: PremiumFeature | null } | null>(null);
  const access = useMemo(
    () => computeAiAccess({ isPro: accessStatus.status === 'subscribed' || accessStatus.status === 'trial', usedToday: aiUsedToday }),
    [accessStatus.status, aiUsedToday],
  );
  const gateUnlocked = PAYWALL_DISABLED || accessStatus.status === 'subscribed' || accessStatus.status === 'trial';
  const accessChecking = entitlementLoading || (accessStatus.status === 'pending' && !entitlementError);

  const openPaywall = (feature: PremiumFeature | null) => {
    setPaywall({ feature });
    try { localStorage.setItem(VICHARAK_NAV_TARGET_KEY, 'premium'); } catch {}
    try { window.dispatchEvent(new CustomEvent('openApp')); } catch {}
  };
  const closePaywall = () => setPaywall(null);

  useEffect(() => {
    persistSubscriptionStatus(spaceId, access.tier === 'pro' ? 'active' : 'locked');
  }, [spaceId, access.tier]);

  const handlePaymentSuccess = (plan: PaidPlanId) => {
    trackEvent('payment_completed', { plan, amount_inr: PAID_PLANS[plan].inrAmount, spaceId });
    setPaywall(null);
    retryEntitlement();
    showToast('Payment confirmed — VicharakAI Premium is unlocked!');
  };

  const durableAiUsedToday = useMemo(() => {
    const key = aiUsageMetaKey(today);
    let greatest = 0;
    for (const row of metaQ.data ?? []) {
      if (row.meta_key === key) greatest = Math.max(greatest, readAiUsageValue(row.meta_value));
    }
    return greatest;
  }, [metaQ.data, today]);

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
  }, [spaceId, paidSessionEmail, today, metaQ.loading, durableAiUsedToday]);

  const chargeAi = () => {
    const current = Math.max(aiUsageRef.current, durableAiUsedToday);
    const next = recordAiMessage(spaceId, today, current);
    aiUsageChargedThisVisitRef.current = true;
    aiUsageRef.current = next;
    setAiUsedToday(next);
    void upsertMeta(aiUsageMetaKey(today), String(next)).catch(() => undefined);
  };

  return {
    paidSessionEmail,
    isQaTester: false,
    subscriptionsQ,
    trialsQ,
    paidPlan,
    accessStatus,
    access,
    gateUnlocked,
    accessChecking,
    entitlementError,
    retryEntitlement,
    paywall,
    openPaywall,
    closePaywall,
    handlePaymentSuccess,
    aiUsedToday,
    chargeAi,
  };
}
