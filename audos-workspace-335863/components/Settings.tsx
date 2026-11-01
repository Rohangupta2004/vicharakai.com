import { useState, useEffect } from 'react';
import { CreditCard, LogOut, Clock, CheckCircle2, AlertCircle, Loader2, CalendarX, LifeBuoy, Mail, Smartphone, Sparkles } from 'lucide-react';
import { useSpaceRuntime } from '../SpaceRuntimeContext';
import { settingsStyles } from '../lib/colors';
import { TRIAL_DURATION_DAYS, subscriptionIsPro } from '../apps/VicharakAI/access';
import { clearVicharakLocalState } from '../apps/VicharakAI/services/database/resetService';
import { clearWriteOutbox } from '../apps/VicharakAI/services/database/writeOutbox';
import { clearPhotoUploadQueue } from '../apps/VicharakAI/features/doubts/photoUploadQueue';

interface SettingsProps {
  spaceId: string;
}

interface SubscriptionStatus {
  status: 'pending' | 'not_registered' | 'registered' | 'trial' | 'trialing' | 'trial_expired' | 'active' | 'canceled' | 'past_due';
  trialDaysRemaining: number;
  trialDays: number;
  trialExpired: boolean;
  trialStartDate: string | null;
  hasPaymentMethod: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  contactId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

interface StoredSession {
  id?: string;
  sessionId?: string;
  workspaceSessionId?: string;
  email?: string;
  createdAt?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  isReturningUser?: boolean;
  workspaceId?: string;
  verified?: boolean;
  isGuest?: boolean;
}

function getSessionStorageKey(spaceId: string) {
  return `space_session_${spaceId}`;
}

export default function Settings({ spaceId }: SettingsProps) {
  const { setSessionId, sessionId: contextSessionId } = useSpaceRuntime();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [portalMessage, setPortalMessage] = useState('');

  useEffect(() => {
    // Use localStorage for cross-browser persistence (matching EmailGate.tsx)
    // Re-read when spaceId or contextSessionId changes (session update trigger)
    const sessionKey = getSessionStorageKey(spaceId);
    const existingSession = localStorage.getItem(sessionKey);
    if (existingSession) {
      try {
        const session = JSON.parse(existingSession);
        setEmail(session.email || '');
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }
  }, [spaceId, contextSessionId]);

  useEffect(() => {
    if (email && email.includes('@')) loadSubscriptionStatus();
  }, [email, spaceId, contextSessionId]);

  const loadSubscriptionStatus = async () => {
    const verifiedSessionId = String((window as any).__audosAcceptedSessionId || contextSessionId || '');
    if (!verifiedSessionId.startsWith('wses_')) {
      setSubscriptionStatus(null);
      return;
    }

    setStatusLoading(true);
    try {
      const response = await fetch(`/api/hooks/execute/${spaceId}/vicharakai-entitlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': verifiedSessionId,
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'status' }),
      });
      if (!response.ok) throw new Error(`entitlement_${response.status}`);
      const payload = await response.json();
      const entitlement = payload && typeof payload.data === 'object' ? payload.data : payload;
      const expiresAt = typeof entitlement?.expires_at === 'string' ? entitlement.expires_at : null;
      const trialDaysRemaining = expiresAt
        ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000))
        : 0;
      const mappedStatus: SubscriptionStatus['status'] = entitlement?.status === 'subscribed'
        ? 'active'
        : entitlement?.status === 'trial'
          ? 'trial'
          : entitlement?.status === 'expired'
            ? 'trial_expired'
            : 'pending';
      setSubscriptionStatus({
        status: mappedStatus,
        trialDaysRemaining,
        trialDays: TRIAL_DURATION_DAYS,
        trialExpired: mappedStatus === 'trial_expired',
        trialStartDate: null,
        hasPaymentMethod: mappedStatus === 'active',
        subscriptionId: null,
        subscriptionStatus: entitlement?.status || null,
        contactId: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: mappedStatus === 'active' ? expiresAt : null,
      });
    } catch (e) {
      console.error('Failed to load subscription status:', e);
      setSubscriptionStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const syncSessionIdentity = async (rawEmail: string) => {
    const requestedEmail = rawEmail.trim().toLowerCase();
    const sessionKey = getSessionStorageKey(spaceId);
    const stored = localStorage.getItem(sessionKey);
    const verifiedSession: StoredSession | null = stored ? JSON.parse(stored) : null;
    const verifiedEmail = verifiedSession?.email?.trim().toLowerCase() || '';
    const verifiedSessionId =
      verifiedSession?.workspaceSessionId || verifiedSession?.sessionId || verifiedSession?.id || '';
    const acceptedSessionId = String((window as any).__audosAcceptedSessionId || contextSessionId || '');

    if (
      verifiedSession?.verified !== true ||
      verifiedSession?.isGuest === true ||
      !verifiedEmail ||
      !verifiedSessionId.startsWith('wses_') ||
      acceptedSessionId !== verifiedSessionId
    ) {
      throw new Error('Please sign in again to manage this account.');
    }
    const workspaceId = String((window as any).__WORKSPACE_ID__ || '');
    if (!workspaceId) throw new Error('Please sign in again to manage this account.');
    const checkResponse = await fetch(
      `/api/auth/otp/space/check-session?workspaceId=${encodeURIComponent(workspaceId)}&sessionUuid=${encodeURIComponent(verifiedSessionId)}`,
      { credentials: 'include' },
    );
    const check = await checkResponse.json().catch(() => null);
    const serverEmail = check && check.verified === true && typeof check.email === 'string'
      ? check.email.trim().toLowerCase()
      : '';
    if (!checkResponse.ok || !serverEmail) {
      throw new Error('Please sign in again to manage this account.');
    }
    if (requestedEmail !== serverEmail || verifiedEmail !== serverEmail) {
      throw new Error('Sign out and verify the new email address before changing accounts.');
    }
    return { email: serverEmail, workspaceSessionId: verifiedSessionId };
  };

  const handleSignOut = async () => {
    try {
      const platformSignOut = (window as any).__signOut;
      if (typeof platformSignOut === 'function') await platformSignOut();
    } catch (error) {
      console.warn('[Settings] Platform sign-out did not complete cleanly', error);
    } finally {
      clearWriteOutbox();
      clearPhotoUploadQueue();
      clearVicharakLocalState();
      const sessionKey = getSessionStorageKey(spaceId);
      localStorage.removeItem(sessionKey);
      setEmail('');
      setSubscriptionStatus(null);
      setSessionId('');
      window.location.reload();
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    setError('');
    try {
      await syncSessionIdentity(email);
      setPortalMessage('Open VicharakAI and choose Premium to pay ₹149 securely through Razorpay.');
      window.dispatchEvent(new CustomEvent('openApp', { detail: { appId: 'vicharakai' } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please sign in again to continue.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    setError('');
    try {
      await syncSessionIdentity(email);
      window.location.href = `mailto:grohan24102004@gmail.com?subject=${encodeURIComponent('Cancel VicharakAI subscription')}&body=${encodeURIComponent(`Please cancel the VicharakAI plan for ${email}.`)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please sign in again to continue.');
    } finally {
      setManagingPortal(false);
    }
  };

  const getStatusBadge = () => {
    if (!subscriptionStatus) return null;
    if (subscriptionIsPro(subscriptionStatus) && subscriptionStatus.status !== 'trial' && subscriptionStatus.status !== 'trialing') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--space-surface-accent-soft)] text-[var(--space-semantic-success)]">
          <CheckCircle2 className="w-4 h-4" /> Premium
        </div>
      );
    }

    switch (subscriptionStatus.status) {
      case 'active':
        return (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${subscriptionStatus.cancelAtPeriodEnd ? 'bg-[var(--space-surface-accent-soft)] text-[var(--space-semantic-warning)]' : 'bg-[var(--space-surface-accent-soft)] text-[var(--space-semantic-success)]'}`}>
            {subscriptionStatus.cancelAtPeriodEnd ? (
              <>
                <CalendarX className="w-4 h-4" />
                Cancels {subscriptionStatus.currentPeriodEnd
                  ? new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : 'at period end'}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Premium
              </>
            )}
          </div>
        );
      case 'trial':
      case 'trialing':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--space-surface-accent-soft)] text-[var(--space-text-accent)] rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Free trial · {subscriptionStatus.trialDaysRemaining} day{subscriptionStatus.trialDaysRemaining === 1 ? '' : 's'} left
          </div>
        );
      case 'trial_expired':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--space-surface-accent-soft)] text-[var(--space-semantic-warning)] rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Unsubscribed
          </div>
        );
      case 'past_due':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--space-surface-accent-soft)] text-[var(--space-semantic-danger)] rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Payment past due
          </div>
        );
      case 'canceled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--space-surface-muted)] text-[var(--space-text-secondary)] rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Subscription canceled
          </div>
        );
      case 'pending':
      case 'registered':
        return null;
      default:
        return null;
    }
  };

  const hasPremiumAccess = subscriptionIsPro(subscriptionStatus);
  const showPaymentCTA = subscriptionStatus && !hasPremiumAccess &&
    ['trial', 'trialing', 'trial_expired', 'canceled', 'past_due', 'registered'].includes(subscriptionStatus.status);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  return (
    <div className={settingsStyles.container}>
      <div className={settingsStyles.innerContainer}>
        {/* Account Section */}
        <div className={settingsStyles.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--space-text-primary)]">
              Your Account
            </h3>
            {email && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--space-text-secondary)] hover:text-[var(--space-semantic-danger)] hover:bg-[var(--space-surface-accent-soft)] rounded-lg transition-colors"
                data-testid="button-sign-out"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            )}
          </div>

          <div>
            <label htmlFor="settings-email" className={settingsStyles.label}>
              Email Address
            </label>
            <input
              type="email"
              id="settings-email"
              value={email}
              readOnly
              aria-readonly="true"
              placeholder="you@example.com"
              className={settingsStyles.input(!!error)}
              data-testid="input-settings-email"
            />
            <p className="mt-2 text-xs text-[var(--space-text-muted)]">
              To use a different email, sign out and verify the new address.
            </p>
            {error && (
              <p className={settingsStyles.errorText} data-testid="text-settings-error">
                {error}
              </p>
            )}
            {portalMessage && (
              <p className="text-sm text-[var(--space-semantic-success)]" role="status">
                {portalMessage}
              </p>
            )}
          </div>

        </div>

        {/* Subscription Section */}
        {email && (
          <div className="mt-8 pt-6 border-t border-[var(--space-border-default)]" style={{ minHeight: 185 }}>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-[var(--space-text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--space-text-primary)]">
                Subscription
              </h3>
            </div>

            {statusLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-[var(--space-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading subscription status...
                </div>
                <div className="h-12 rounded-xl bg-[var(--space-surface-muted)]" aria-hidden="true" />
                <div className="mx-auto h-3 w-44 rounded-full bg-[var(--space-surface-muted)]" aria-hidden="true" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Badge */}
                {getStatusBadge()}

                {/* Trial Progress */}
                {(subscriptionStatus?.status === 'trial' || subscriptionStatus?.status === 'trialing') && (
                  <div className="p-4 bg-[var(--space-surface-accent-soft)] rounded-2xl border border-[var(--space-border-default)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-[var(--space-text-primary)]">
                        Free Trial
                      </span>
                      <span className="text-sm text-[var(--space-text-secondary)]">
                        {subscriptionStatus.trialDaysRemaining} of {subscriptionStatus.trialDays} days remaining
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--space-surface-muted)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[linear-gradient(90deg,var(--space-brand-highlight),var(--space-brand-primary))] rounded-full transition-all"
                        style={{ 
                          width: `${((subscriptionStatus.trialDays - subscriptionStatus.trialDaysRemaining) / subscriptionStatus.trialDays) * 100}%` 
                        }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-[var(--space-text-secondary)]">
                      The trial ends without a charge. To continue, buy the ₹149/month plan through Razorpay in VicharakAI.
                    </p>
                    {subscriptionStatus.hasPaymentMethod && (
                      <button
                        onClick={handleManageSubscription}
                        disabled={managingPortal}
                        className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--space-text-secondary)] hover:text-[var(--space-text-primary)] hover:bg-[var(--space-surface-card-hover)] border border-[var(--space-border-default)] rounded-lg transition-colors disabled:opacity-50"
                      >
                        {managingPortal ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                        Manage Billing
                      </button>
                    )}
                  </div>
                )}

                {/* Active Subscription Info */}
                {hasPremiumAccess && subscriptionStatus?.status !== 'trial' && subscriptionStatus?.status !== 'trialing' && (
                  <div className={`p-4 bg-gradient-to-r ${subscriptionStatus.cancelAtPeriodEnd ? 'from-[var(--space-surface-accent-soft)] to-[var(--space-surface-accent-soft)] border-[var(--space-surface-accent-soft)]' : 'from-[var(--space-surface-card)] to-[var(--space-surface-card)] border-[var(--space-surface-accent-soft)]'} rounded-xl border`}>
                    {subscriptionStatus.cancelAtPeriodEnd ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CalendarX className="w-5 h-5 text-[var(--space-semantic-warning)]" />
                          <span className="text-sm font-medium text-[var(--space-text-primary)]">
                            Subscription ending
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--space-text-secondary)]">
                          Your subscription will end on{' '}
                          <span className="font-semibold text-[var(--space-text-primary)]">
                            {subscriptionStatus.currentPeriodEnd
                              ? new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                              : 'the end of the current billing period'}
                          </span>. You will continue to have full access until then.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-[var(--space-semantic-success)]" />
                          <span className="text-sm font-medium text-[var(--space-text-primary)]">
                            You have full access
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--space-text-secondary)]">
                          Your subscription is active. Thank you for your support!
                        </p>
                      </>
                    )}
                    <button
                      onClick={handleManageSubscription}
                      disabled={managingPortal}
                      className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--space-text-primary)] bg-[var(--space-surface-card)] hover:bg-[var(--space-surface-card-hover)] border border-[var(--space-border-default)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {managingPortal ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Opening...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Cancel by email
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Trial Expired Warning */}
                {subscriptionStatus?.status === 'trial_expired' && (
                  <div className="p-4 bg-gradient-to-r from-[var(--space-surface-accent-soft)] to-[var(--space-surface-accent-soft)] rounded-xl border border-[var(--space-surface-accent-soft)]">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-[var(--space-semantic-warning)]" />
                      <span className="text-sm font-medium text-[var(--space-text-primary)]">
                        Your trial has ended
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--space-text-secondary)]">
                      Your free trial ended without a charge. VicharakAI Premium is ₹149/month in India through Razorpay.
                      It unlocks the full app: your daily plan, spaced revision, unlimited AI coaching, photo Mistake
                      Book capture and test generation. Open the Premium tab in VicharakAI to subscribe.
                    </p>
                  </div>
                )}

                {/* Payment CTA - show if in trial or expired, regardless of payment config */}
                {showPaymentCTA && (
                  <div className="space-y-3">
                    {/* No inline price here: the platform payment-config price
                        (defaultPriceCents) does not know the selected plan — it
                        rendered a wrong "₹5"-style amount. Plans and prices are
                        listed in the "Your plan" card below. */}
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--space-brand-highlight)] hover:brightness-95 text-[var(--space-text-on-highlight)] font-medium rounded-xl shadow-[0_4px_14px_color-mix(in_srgb,var(--space-brand-highlight)_28%,transparent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-subscribe"
                    >
                      {subscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Redirecting to checkout...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          {(subscriptionStatus?.status === 'trial' || subscriptionStatus?.status === 'trialing')
                            ? 'Add Payment Method' 
                            : 'Subscribe Now'}
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-[var(--space-text-muted)]">
                      Secure India-only payment via Razorpay — UPI, card or wallet
                    </p>
                  </div>
                )}

                {/* Not registered yet */}
                {subscriptionStatus?.status === 'not_registered' && (
                  <div className="p-4 bg-[var(--space-surface-panel)] rounded-xl text-center">
                    <p className="text-sm text-[var(--space-text-secondary)]">
                      Save your email to link your account and pick a plan
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* What the VicharakAI plan actually is — the same deal the app enforces */}
        <div className="mt-8 pt-6 border-t border-[var(--space-border-default)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[var(--space-text-brand)]" />
            <h3 className="text-sm font-semibold text-[var(--space-text-primary)]">Your plan</h3>
          </div>
          <div
            className="p-4 rounded-2xl bg-[var(--space-surface-accent-soft)] border border-[var(--space-border-default)]"
            data-testid="card-vicharakai-plan"
          >
            <p className="text-sm text-[var(--space-text-secondary)]">
              VicharakAI starts with a <span className="font-semibold text-[var(--space-text-primary)]">{TRIAL_DURATION_DAYS}-day free trial</span>{' '}
              — full access, no card needed — and runs on one simple subscription after that.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-[var(--space-text-secondary)]">
              <li>
                <span className="font-semibold text-[var(--space-text-primary)]">Free trial — {TRIAL_DURATION_DAYS} days</span> — the whole
                app, free: your daily plan, spaced revision, unlimited AI coaching, photo scan &amp; Mistake Book capture.
              </li>
              <li>
                <span className="font-semibold text-[var(--space-text-primary)]">VicharakAI Premium — ₹149/month</span>{' '}
                — the full Premium engine with Priority Support. To cancel, email grohan24102004@gmail.com before your next payment.
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-[var(--space-text-muted)]">
              India only: pay in-app through Razorpay using UPI, cards, wallets or netbanking. The free trial does not
              auto-charge. There is one plan and no day pass; each verified ₹149 payment adds one month of access.
            </p>
          </div>
        </div>

        {/* VicharakAI on your phone — add-to-home-screen guidance */}
        <div className="mt-8 pt-6 border-t border-[var(--space-border-default)]">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-5 h-5 text-[var(--space-text-brand)]" />
            <h3 className="text-sm font-semibold text-[var(--space-text-primary)]">On your phone</h3>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--space-surface-accent-soft)] border border-[var(--space-border-default)]" data-testid="card-install-app">
            <p className="text-sm text-[var(--space-text-secondary)]">
              VicharakAI works like an app — add it to your home screen and it opens with one tap, no app store needed.
            </p>
            <ol className="mt-3 space-y-1.5 text-xs text-[var(--space-text-secondary)] list-decimal list-inside">
              {isIOS ? (
                <>
                  <li>Open VicharakAI in <span className="font-semibold">Safari</span></li>
                  <li>Tap the <span className="font-semibold">Share</span> button (the square with an arrow)</li>
                  <li>Scroll down and tap <span className="font-semibold">Add to Home Screen</span>, then <span className="font-semibold">Add</span></li>
                </>
              ) : isAndroid ? (
                <>
                  <li>Open VicharakAI in <span className="font-semibold">Chrome</span></li>
                  <li>Tap the <span className="font-semibold">⋮ menu</span> in the top-right corner</li>
                  <li>Tap <span className="font-semibold">Add to Home screen</span> (or <span className="font-semibold">Install app</span>) and confirm</li>
                </>
              ) : (
                <>
                  <li>Open this same link on your phone's browser</li>
                  <li>iPhone: in Safari, tap <span className="font-semibold">Share → Add to Home Screen</span></li>
                  <li>Android: in Chrome, tap <span className="font-semibold">⋮ → Add to Home screen</span></li>
                </>
              )}
            </ol>
            <p className="mt-3 text-[11px] text-[var(--space-text-muted)]">
              You'll get a VicharakAI icon on your home screen — your plan, streak and coach one tap away.
            </p>
          </div>
        </div>

        {/* Support — the same address the app's Help & Support sheet uses */}
        <div className="mt-8 pt-6 border-t border-[var(--space-border-default)]">
          <div className="flex items-center gap-2 mb-3">
            <LifeBuoy className="w-5 h-5 text-[var(--space-text-brand)]" />
            <h3 className="text-sm font-semibold text-[var(--space-text-primary)]">Need help?</h3>
          </div>
          <div
            className="p-4 rounded-2xl bg-[var(--space-surface-accent-soft)] border border-[var(--space-border-default)]"
            data-testid="card-support"
          >
            <p className="text-sm text-[var(--space-text-secondary)]">
              Answers to the common questions — how planning works, the revision schedule, changing your exam — live
              under <span className="font-semibold text-[var(--space-text-primary)]">Profile → Help &amp; Support</span>{' '}
              in the app. For anything else, email us.
            </p>
            <a
              href="mailto:grohan24102004@gmail.com?subject=VicharakAI%20%E2%80%94%20help%20request"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--space-border-default)] bg-[var(--space-surface-card)] text-[var(--space-text-primary)] hover:bg-[var(--space-surface-card-hover)] transition-colors"
              data-testid="link-settings-support"
            >
              <Mail className="w-4 h-4" />
              grohan24102004@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
