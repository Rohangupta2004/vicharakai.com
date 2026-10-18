import { createPortal } from 'react-dom';
import LoginPanel from './EmailGateLoginPanel';
import { LEGAL_EFFECTIVE_DATE, PrivacyPageContent, TermsPageContent } from './StaticPages';
import { Check, FileText, Home, Mail, ShieldCheck, X } from 'lucide-react';
import { colorWithAlpha } from './emailGateShared';

export default function EmailGateOverlays({ ctx }: { ctx: any }) {
  const { email, legalDoc, setLegalDoc, loading, loginOpen, setLoginOpen, checkoutSuccess, setCheckoutSuccess, showInstallBanner, isIOS, handleInstall, handleDismissInstall, bodyFontStack, headingFontStack, primaryColor, highlightColor, brandName, panelStrongColor, bgLight, borderColor, textPrimary, textMuted, textSubtle, onPrimary, brandGradient, darkSurface, openLogin, SUPPORT_EMAIL, legalLinkStyle, BrandMark, trialDurationDays } = ctx;
  const trialDays = trialDurationDays ?? 7;
  return (
    <>
      {loginOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 backdrop-blur-sm"
          style={{ backgroundColor: colorWithAlpha(darkSurface, 0.6) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-gate-login-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !loading) {
              setLoginOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md relative overflow-hidden rounded-3xl"
            style={{ backgroundColor: panelStrongColor, border: `1px solid ${borderColor}`, boxShadow: '0 30px 70px rgba(15, 23, 42, 0.72)' }}
          >
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              disabled={loading}
              aria-label="Close login"
              className="absolute right-3 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-1000 ease-in-out hover:opacity-80"
              style={{ backgroundColor: bgLight, color: textPrimary }}
            >
              <X size={18} strokeWidth={2.6} />
            </button>
            <div className="p-6 sm:p-8">
              <h2 id="email-gate-login-title" className="text-2xl font-extrabold mb-1" style={{ color: textPrimary }}>
                Build my study plan
              </h2>
              <p className="mb-5 text-sm" style={{ color: textMuted }}>
                Enter your email and finish setup — your {trialDays}-day free trial starts right away, with full access and no card.
              </p>
              <LoginPanel compact ctx={ctx} />
            </div>
          </div>
        </div>
      )}

      {/* Payment verified — celebrate, then hand off to sign-in so the plan
          attaches to their account. */}
      {checkoutSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 backdrop-blur-sm"
          style={{ backgroundColor: colorWithAlpha(darkSurface, 0.6) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-success-title"
        >
          <div className="w-full max-w-md rounded-3xl p-6 text-center sm:p-8" style={{ backgroundColor: panelStrongColor, border: `1px solid ${borderColor}`, boxShadow: '0 30px 70px rgba(15, 23, 42, 0.72)' }}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: brandGradient, color: onPrimary }}>
              <Check size={26} strokeWidth={3} />
            </div>
            <h2 id="checkout-success-title" className="mt-4 text-2xl font-extrabold" style={{ color: textPrimary }}>
              Payment successful {'\uD83C\uDF89'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: textMuted }}>
              Welcome to {brandName} {checkoutSuccess.planName} ({checkoutSuccess.priceLabel}). Sign in with the email you paid with and you’re all set.
            </p>
            <button
              type="button"
              onClick={() => {
                setCheckoutSuccess(null);
                openLogin();
              }}
              className="mt-5 w-full rounded-2xl px-5 py-3.5 text-sm font-extrabold"
              style={{ background: brandGradient, color: onPrimary }}
              data-testid="button-checkout-success-continue"
            >
              Continue — sign in
            </button>
            <button
              type="button"
              onClick={() => setCheckoutSuccess(null)}
              className="mt-3 block w-full text-xs font-bold underline underline-offset-4"
              style={{ color: textSubtle }}
              data-testid="button-checkout-success-close"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ---------- Privacy Policy / Terms of Service ----------
          In-page modals, portalled to <body>, so the same document opens from
          the pricing cards, the closing CTA and the sign-in panel without the
          visitor losing their place. The content is shared with the routed
          #/privacy and #/terms pages (components/StaticPages.tsx) so the modal
          and the full page can never drift apart. */}
      {legalDoc && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-doc-title"
          onClick={() => setLegalDoc(null)}
          style={{
            backgroundColor: colorWithAlpha(darkSurface, 0.78),
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            fontFamily: bodyFontStack,
          }}
          data-testid="modal-legal"
        >
          <section
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl"
            onClick={(event) => event.stopPropagation()}
            style={{
              backgroundColor: panelStrongColor,
              border: `1px solid ${borderColor}`,
              color: textPrimary,
              boxShadow: '0 30px 70px rgba(15, 23, 42, 0.72)',
            }}
          >
            <header className="flex items-start justify-between gap-4 px-5 py-4 sm:px-7" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: highlightColor }}>
                  {legalDoc === 'privacy' ? <ShieldCheck size={13} strokeWidth={2.6} /> : <FileText size={13} strokeWidth={2.6} />}
                  {legalDoc === 'privacy' ? 'Your data, clearly explained' : 'The agreement, in plain English'}
                </p>
                <h2 id="legal-doc-title" className="mt-1 text-xl font-extrabold sm:text-2xl" style={{ fontFamily: headingFontStack }}>
                  {brandName} {legalDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                </h2>
                <p className="mt-1 text-sm" style={{ color: textSubtle }}>Effective {LEGAL_EFFECTIVE_DATE}</p>
              </div>
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full hover:opacity-80"
                style={{ backgroundColor: bgLight, border: `1px solid ${borderColor}`, color: textPrimary }}
                aria-label={legalDoc === 'privacy' ? 'Close privacy policy' : 'Close terms of service'}
                data-testid="button-close-legal"
              >
                <X size={18} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div className="space-y-6 text-sm leading-6" style={{ color: textMuted }}>
                {legalDoc === 'privacy' ? <PrivacyPageContent /> : <TermsPageContent />}
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs font-bold sm:px-7" style={{ borderTop: `1px solid ${borderColor}`, color: textMuted }}>
              <button
                type="button"
                onClick={() => setLegalDoc(legalDoc === 'privacy' ? 'terms' : 'privacy')}
                style={legalLinkStyle}
                data-testid="button-switch-legal"
              >
                Read the {legalDoc === 'privacy' ? 'Terms of Service' : 'Privacy Policy'}
              </button>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5" style={legalLinkStyle}>
                <Mail size={13} strokeWidth={2.6} /> {SUPPORT_EMAIL}
              </a>
            </footer>
          </section>
        </div>,
        document.body,
      )}

      {/* ---------- PWA install banner ----------
          Mobile-only bottom sheet, portalled to <body> so it sits above every
          modal. Android/Chrome gets a real Install button (native dialog via
          the captured beforeinstallprompt event); iOS Safari gets Share →
          “Add to Home Screen” instructions with the share glyph inline. */}
      {showInstallBanner && createPortal(
        <div
          role="dialog"
          aria-label={`Install ${brandName}`}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            padding: '16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
            background: panelStrongColor,
            borderTop: `1px solid ${borderColor}`,
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 40px rgba(15, 23, 42, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            fontFamily: bodyFontStack,
            animation: 'egPwaSlideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
          data-testid="banner-pwa-install"
        >
          <style>{`
            @keyframes egPwaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @media (prefers-reduced-motion: reduce) { [data-testid="banner-pwa-install"] { animation: none !important; } }
          `}</style>

          <button
            type="button"
            onClick={handleDismissInstall}
            aria-label="Dismiss install prompt"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: 'transparent',
              border: 'none',
              color: textMuted,
              cursor: 'pointer',
            }}
            data-testid="button-pwa-dismiss"
          >
            <X size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingRight: 28 }}>
            <BrandMark size={44} radiusScale={0.28} />
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: textPrimary, fontFamily: headingFontStack }}>
                Add to Home Screen
              </p>
              {isIOS ? (
                <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: textMuted }}>
                  Tap the Share icon{' '}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'inline', verticalAlign: '-2px' }}
                    aria-hidden="true"
                  >
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>{' '}
                  below, then ‘Add to Home Screen’
                </p>
              ) : (
                <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: textMuted }}>
                  Install {brandName} for the best experience — no browser bar, instant open
                </p>
              )}
            </div>
          </div>

          {!isIOS && (
            <button
              type="button"
              onClick={handleInstall}
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: 16,
                border: 'none',
                background: brandGradient,
                color: onPrimary,
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: `0 10px 24px ${colorWithAlpha(primaryColor, 0.34)}`,
              }}
              data-testid="button-pwa-install"
            >
              Install App
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
