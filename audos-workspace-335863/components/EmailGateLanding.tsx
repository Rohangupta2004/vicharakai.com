import LandingNarrative from './LandingNarrative';
import type { LandingTokens } from './landingTokens';
import { landingRegion } from './landingRegions';

/**
 * The signed-out landing shell.
 *
 * It owns exactly two things: page-level scrolling (see the scroll-ownership
 * note below) and the handful of CSS rules the shell and the sign-in panel
 * share. The page itself is components/LandingNarrative.tsx — the
 * preparation-system rebuild (v202, Otto instruction 2026-10-01). The
 * previous page, components/LandingPage.tsx, stays in the tree unreferenced
 * per house convention.
 *
 * FOUR REGIONAL PAGES, ONE COMPONENT LIBRARY (founder instruction,
 * 2026-09-02). /in, /us, /uk and /global each render LandingPage with their
 * own entry from components/landingRegions.ts — exams, hero copy, pricing,
 * terminology, meta tags and gradient all arrive from that config, so there is
 * no second copy of the page anywhere. The bare root geo-detects which one to
 * show and falls back to International.
 *
 * `ctx.landingRegionKey` is resolved in useEmailGateController (URL first,
 * then geo); this file only turns the key into a config.
 *
 * `isIndia` and `geoBranch` still resolve in useEmailGateController for the
 * signed-in app's own pricing — they are IP-based and stay that way, so
 * reading the /uk page never changes what a visitor is actually charged.
 *
 * AUTH IS UNTOUCHED: every CTA on every regional page calls the same
 * openLogin(), and the page owns no auth, payment or geo logic of its own —
 * all of that stays in useEmailGateController.
 */
export default function EmailGateLanding({ ctx }: { ctx: any }) {
  const {
    spaceId,
    bodyFontStack,
    headingFontStack,
    pageBackground,
    sectionBackground,
    panelColor,
    borderColor,
    textPrimary,
    textMuted,
    textSubtle,
    primaryColor,
    primaryDeep,
    accentSoft,
    brandGradient,
    brandGradientText,
    heroGlow,
    onPrimary,
    toneGood,
    toneWarn,
    toneDanger,
    subjectOrange,
    brandName,
    BrandMark,
    scrolled,
    openLogin,
    loginOpen,
    legalDoc,
    checkoutSuccess,
    showInstallBanner,
    setLegalDoc,
    SUPPORT_EMAIL,
    legalLinkStyle,
    navLinkStyle,
    landingRegionKey,
    logoUrl,
  } = ctx;

  const region = landingRegion(landingRegionKey);

  // The one palette the marketing page draws from. Assembled from the same
  // constants the OTP screen, sign-in modal and checkout modals use, so no
  // signed-out surface can drift onto a different brand. The page's own
  // #0057FF accent lives in landingTokens (LANDING_ACCENT), and its
  // backgrounds come from the region's gradient treatment.
  const tokens: LandingTokens = {
    brandName,
    headingFont: headingFontStack,
    pageBg: pageBackground,
    sectionBg: sectionBackground,
    panelBg: panelColor,
    border: borderColor,
    textPrimary,
    textMuted,
    textSubtle,
    accent: primaryColor,
    accentDeep: primaryDeep,
    accentSoft,
    gradient: brandGradient,
    gradientText: brandGradientText,
    onGradient: onPrimary,
    heroGlow,
    toneGood,
    toneWarn,
    toneDanger,
    subjectOrange,
  };

  return (
    <div
      className="eg-root h-screen overflow-y-auto"
      style={{
        height: '100dvh',
        WebkitOverflowScrolling: 'touch',
        fontFamily: bodyFontStack,
        // The marketing surface uses a midnight canvas with the same brand
        // blue as the app. Keeping it here prevents a light overscroll flash.
        backgroundColor: '#040817',
        color: '#F2F5FF',
      }}
    >
      <style>{`
        /* SCROLL OWNERSHIP — the landing page scrolls inside .eg-root.
           The OS shell (Desktop.tsx) pins html/body (overflow:hidden,
           position:fixed, height:100%) so the app window can never rubber-band,
           and those inline styles reach this page too: without the override
           below the hero fills the locked viewport and nothing under it can be
           reached on a phone. A stylesheet !important outranks an inline style,
           so these rules hand scrolling back for exactly as long as the
           signed-out landing page is mounted — they unmount with it, leaving
           the shell’s own lock intact for the signed-in app. */
        html:has(.eg-root), body:has(.eg-root) {
          overflow: visible !important;
          position: static !important;
          height: auto !important;
          width: auto !important;
        }
        /* Scroll-reveal: useEmailGateController observes the scroll container
           and adds .eg-revealed to each [data-reveal] element as it enters
           (15% visibility threshold). It re-runs on a region change, which
           swaps in a whole new set of [data-reveal] sections.
           Fade-in + slide-up: 24px → 0 over 0.5s ease-out. The hero is not a
           [data-reveal] target — it loads immediately with its own stagger. */
        [data-reveal] { opacity: 0; transform: translateY(24px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; }
        .eg-revealed { opacity: 1 !important; transform: translateY(0) !important; }
        /* Staggered children: the repeated items inside a revealed section
           (feature rows, memory-loop cards, plan cards, FAQ items, pills…)
           rise 80ms apart. Opacity + transform only — nothing here can shift
           layout, and it all stands down under prefers-reduced-motion. */
        [data-reveal] :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > * {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
        }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > * {
          opacity: 1;
          transform: translateY(0);
        }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > *:nth-child(2) { transition-delay: 80ms; }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > *:nth-child(3) { transition-delay: 160ms; }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > *:nth-child(4) { transition-delay: 240ms; }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > *:nth-child(5) { transition-delay: 320ms; }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > *:nth-child(6) { transition-delay: 400ms; }
        .eg-revealed :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > *:nth-child(n+7) { transition-delay: 480ms; }
        /* The sign-in panel keeps its slow, calm transitions. */
        #email-gate-login-panel button, #email-gate-login-panel input {
          transition-duration: 0.9s;
          transition-timing-function: ease-in-out;
        }
        /* The OTP / sign-in inputs live in the modal and keep the slate
           placeholder; the landing page itself has no inputs. */
        input[data-testid="input-email"]::placeholder,
        input[data-testid="input-code"]::placeholder { color: rgba(148, 163, 184, 0.7); }
        @media (prefers-reduced-motion: reduce) {
          [data-reveal] { opacity: 1; transform: none; transition: none; }
          [data-reveal] :is(.lp4-beats, .lp4-loop, .lp4-callouts, .lp4-plans, .lp4-reasons, .lp4-quotes, .lp4-outcomes, .lp4-voices, .lp4-faq, .lp4-method-pills, .lp4-trust, .lp4-fd-methods, .lp4-learn) > * {
            opacity: 1; transform: none; transition: none;
          }
        }
      `}</style>

      <LandingNarrative
        t={tokens}
        spaceId={spaceId}
        region={region}
        logoUrl={logoUrl}
        scrolled={scrolled}
        openLogin={openLogin}
        supportEmail={SUPPORT_EMAIL}
      />
    </div>
  );
}
