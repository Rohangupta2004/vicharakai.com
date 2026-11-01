import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { colorWithAlpha } from './emailGateShared';

export default function LoginPanel({ compact = false, ctx }: { compact?: boolean; ctx: any }) {
  const { email, setEmail, setLegalDoc, password, authMode, loading, error, setError, googleLoading, gsiButtonReady, guestModeEnabled, enableGoogleSignIn, socialProviders, handleAuthSubmit, handleGuestMode, handleSocialLogin, handleGoogleSignIn, mountGsiButton, primaryColor, sectionBackground, panelColor, bgLight, bgMedium, borderColor, textPrimary, textMuted, textSubtle, onPrimary, brandGradient, toneDanger, loginPanelId, SUPPORT_EMAIL, legalLinkStyle, trialDurationDays } = ctx;
  // Never hardcoded: the controller reads TRIAL_DURATION_DAYS from the app's
  // access rules, so this panel always quotes the trial the app really grants.
  const trialDays = trialDurationDays ?? 7;
  return (
    <div
      id={loginPanelId}
      className={compact ? '' : 'rounded-3xl p-6 sm:p-8'}
      style={compact ? undefined : {
        backgroundColor: panelColor,
        boxShadow: `0 24px 48px ${colorWithAlpha(primaryColor, 0.14)}, 0 2px 6px ${colorWithAlpha(primaryColor, 0.06)}`,
        border: `1px solid ${borderColor}`,
      }}
    >
      {!compact && (
        <div className="mb-5 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: brandGradient, color: onPrimary }}
          >
            <Sparkles size={22} strokeWidth={2.4} />
          </div>
          <p className="text-base font-extrabold" style={{ color: textPrimary }}>
            Start your {trialDays}-day free trial
          </p>
          <p className="mt-1 text-sm" style={{ color: textMuted }}>
            Takes 2 minutes. Free for {trialDays} days — no card needed.
          </p>
        </div>
      )}

      {/* SIGNUP FRICTION (2026-09-27): Google LEADS. One tap, no inbox round
          trip and no code to copy — on a phone it is by far the shortest path
          into the trial, so it sits above the email form rather than under it.
          The email magic-code flow below is untouched and still works.
          Google's own rendered button (popup flow) appears once GSI loads on
          the authorized origin; the custom button covers other hosts (it hands
          off to www.vicharakai.com first) and script-load failures. */}
      {enableGoogleSignIn && (
        <>
          <div
            ref={(el) => { mountGsiButton(el); }}
            className="justify-center"
            style={{ display: gsiButtonReady ? 'flex' : 'none' }}
            data-testid="button-google-gsi"
          />
      {!gsiButtonReady && (
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-4 text-base font-bold transition-all hover:-translate-y-0.5"
          style={{
            backgroundColor: '#FFFFFF',
            border: `2px solid ${borderColor}`,
            color: '#1F2328',
            cursor: loading || googleLoading ? 'not-allowed' : 'pointer',
            minHeight: 56,
            boxShadow: `0 8px 20px ${colorWithAlpha(primaryColor, 0.16)}`,
          }}
          data-testid="button-google"
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
          )}
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </button>
      )}

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1" style={{ backgroundColor: borderColor }} />
            <span className="text-xs font-medium" style={{ color: textSubtle }}>or use your email</span>
            <div className="h-px flex-1" style={{ backgroundColor: borderColor }} />
          </div>
        </>
      )}

      {/* The platform has no email+password endpoint (/api/spaces/:id/auth/login
          returns 404), so the old Password tab could never sign anyone in.
          Removed — the magic-code flow below is the one working email path. */}
      <form onSubmit={handleAuthSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="Enter your email"
            className="w-full px-4 py-4 text-base rounded-2xl focus:outline-none transition-all"
            style={{
              backgroundColor: sectionBackground,
              border: `2px solid ${error ? toneDanger : borderColor}`,
              color: textPrimary,
              minHeight: 56,
            }}
            disabled={loading}
            required
            /* No autoFocus: with Google now the first thing in the panel, an
               auto-raised phone keyboard covered it before it could be read. */
            autoComplete="email"
            inputMode="email"
            data-testid="input-email"
          />
        </div>

        {authMode === 'otp' && (
          <p className="text-xs" style={{ color: textSubtle }}>
            No password needed — we&apos;ll email you a 4-digit code to sign in.
          </p>
        )}

        {error && (
          <p className="text-xs" style={{ color: toneDanger }} data-testid="text-error">
            {error}
          </p>
        )}

        <div
          className="space-y-2 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: bgLight,
            color: textMuted,
          }}
        >
          <p>
            By continuing, you agree to our{' '}
            <button
              type="button"
              onClick={() => setLegalDoc('privacy')}
              className="font-medium underline"
              style={{ color: textPrimary }}
              aria-haspopup="dialog"
            >
              Privacy Policy
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => setLegalDoc('terms')}
              className="font-medium underline"
              style={{ color: textPrimary }}
              aria-haspopup="dialog"
            >
              Terms of Service
            </button>
            .
          </p>
          <p>
            After sign-in, we ask for your birth year and apply the appropriate adult or parent/guardian consent step before study data is stored. Marketing is always optional.
          </p>
        </div>

        {(() => {
          const disabled = loading || !email || (authMode === 'password' && !password);
          const label = loading
            ? authMode === 'password'
              ? 'Signing in...'
              : 'Sending code...'
            : authMode === 'password'
              ? 'Log in'
              : 'Email me a sign-in code';
          return (
            <button
              type="submit"
              disabled={disabled}
              aria-busy={loading}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
              style={{
                background: disabled ? bgMedium : brandGradient,
                color: disabled ? textSubtle : onPrimary,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : `0 10px 24px ${colorWithAlpha(primaryColor, 0.34)}`,
                minHeight: 56,
              }}
              data-testid="button-continue"
            >
              {loading && <Loader2 size={18} strokeWidth={2.6} className="animate-spin" aria-hidden="true" />}
              {label}
              {!loading && <ArrowRight size={18} strokeWidth={2.6} />}
            </button>
          );
        })()}
      </form>

      {/* Merchant-review requirement: the policy links sit with the sign-up
          action itself, not only in the page footer. */}
      <p className="mt-4 text-center text-[11px] leading-relaxed" style={{ color: textSubtle }}>
        By continuing you agree to our{' '}
        <button type="button" onClick={() => setLegalDoc('terms')} style={legalLinkStyle} data-testid="link-panel-terms">
          Terms of Service
        </button>{' '}
        and{' '}
        <button type="button" onClick={() => setLegalDoc('privacy')} style={legalLinkStyle} data-testid="link-panel-privacy">
          Privacy Policy
        </button>
        . Need help? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={legalLinkStyle}>
          {SUPPORT_EMAIL}
        </a>
      </p>

      {socialProviders.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ backgroundColor: borderColor }} />
            <span className="text-xs font-medium" style={{ color: textSubtle }}>or continue with</span>
            <div className="flex-1 h-px" style={{ backgroundColor: borderColor }} />
          </div>
          <div className={`grid gap-2 ${socialProviders.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {socialProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleSocialLogin(provider)}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: panelColor,
                  border: `2px solid ${borderColor}`,
                  color: textPrimary,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <span className="capitalize">{provider}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {guestModeEnabled && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleGuestMode}
            disabled={loading}
            className="text-sm font-semibold transition-colors hover:opacity-70"
            style={{ color: textMuted, cursor: loading ? 'not-allowed' : 'pointer' }}
            data-testid="button-guest-mode"
          >
            Continue as guest
          </button>
        </div>
      )}
    </div>
  );
}
