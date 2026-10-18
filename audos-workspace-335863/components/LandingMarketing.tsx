import type { ComponentType, CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import type { LandingTokens } from './landingTokens';
import {
  CTA_BLUE,
  GLASS_BG,
  GLASS_BG_INSET,
  GLASS_BORDER,
  GLASS_BORDER_STRONG,
  GLASS_GLOW,
  HERO_RADIAL_GLOW,
  withAlpha,
} from './landingTokens';
import { AiMarkdown } from './landingMarkdown';
import LandingProblemPanels from './LandingProblemPanels';
import LandingPhoneMockups from './LandingPhoneMockups';
import LandingStudentGallery from './LandingStudentGallery';

/**
 * The signed-out marketing page for VicharakAI — the INDIA branch.
 *
 * Visitors whose country resolves to IN get this page; everyone else gets
 * components/LandingGlobalMarketing.tsx, which is a completely separate
 * content experience (international exams, USD pricing, Creem). The split is
 * made once per session in useEmailGateController and applied in
 * EmailGateLanding.tsx.
 *
 * COPY IS FROZEN (founder instruction, 2026-09-01): the India branch keeps
 * every headline, paragraph and CTA word exactly as it was. Changes to this
 * file are DESIGN ONLY — spacing, type scale, surface treatment. If a copy
 * change is ever wanted here it needs the founder to ask for it explicitly.
 *
 * This file owns ONLY marketing markup. Every behaviour it needs — opening the
 * sign-in panel, starting a Razorpay checkout, opening a legal modal —
 * arrives as a callback from EmailGate.tsx, which still owns all auth, OTP,
 * checkout and legal code. Nothing in here fetches or registers anything.
 *
 * PRICING ON THIS BRANCH IS INR-ONLY: Trial ₹10 / 1 day · Monthly ₹149 /
 * 30 days, charged through Razorpay without leaving the page.
 *
 * DESIGN RULES (founder instruction, 2026-09-02 — premium, minimal, dark):
 *   · TYPOGRAPHY IS THE VISUAL. There are no illustrations anywhere on this
 *     page: no stick figures, no drawn props, no explainer diagrams, no
 *     cartoon icons. The only artwork left is the forgetting-curve chart,
 *     because it is real data-viz.
 *   · Surfaces are glass, never colour: rgba(255,255,255,0.04) behind a
 *     rgba(255,255,255,0.08) hairline, and the only shadow on the page is the
 *     faint blue glow on a hovered card.
 *   · One large, faint radial glow sits behind the hero headline; the key
 *     words of the headline carry the brand gradient and nothing else does.
 *   · The CTA is flat solid #0057FF — a large rounded pill with no neon.
 *   · Palette is #0A0A0F / #111118 with #0057FF → #003AB0 and the #6C9BFF
 *     tint for small accent text. No cyan, no purple, no teal, no violet.
 *   · Nothing on the page moves on its own; the student-journey section is
 *     driven by the reader's scroll position.
 */

export type PaidPlan = 'day' | 'monthly';

interface LandingMarketingProps {
  t: LandingTokens;
  /** EmailGate's theme-aware logo block, so the mark never diverges. */
  BrandMark: ComponentType<{ size?: number; blockColor?: string; radiusScale?: number }>;
  /** True once the visitor has scrolled past the hero — solidifies the nav. */
  scrolled: boolean;
  openLogin: () => void;
  /** Display prices (INR), derived in EmailGate from the numeric plan amounts. */
  priceInr: { day: string; monthly: string };
  /** Content switch for the India-specific phone mockup. Always true on this
   *  branch — kept as a prop so the mockup component stays generic. */
  isIndia: boolean;
  checkoutBusyPlan: PaidPlan | null;
  checkoutError: string;
  /** Razorpay (INR) — the one checkout on this branch. */
  onRazorpay: (plan: PaidPlan) => void;
  onOpenLegal: (doc: 'privacy' | 'terms') => void;
  supportEmail: string;
  legalLinkStyle: CSSProperties;
  navLinkStyle: CSSProperties;
}

const FOUNDER_STORY =
  'I was preparing for my exam using online batches and YouTube. Every day I studied — but by the end of the week I had no idea what had actually stuck. My gaps only showed up in mocks. I couldn’t find any app that tracked my strategy, not just my content. So I built one. This is VicharakAI.';

/**
 * The simulated coach exchange in the “add a task” demo card. The reply is
 * authored in the same lightweight markdown the real coach speaks (bold,
 * bullets, line breaks) and rendered through <AiMarkdown /> (see
 * components/landingMarkdown.tsx), so the formatting always displays as real
 * bold text and lists — never as raw ** asterisks.
 *
 * COPY RULE (Day-1 accuracy): Day 1 is add your task → get today’s roadmap.
 * Personalization builds from Day 2, based on what the student actually
 * completed — the reply must never promise same-day personalization.
 */
const DEMO_USER_MESSAGE = 'Add task: Rotational Motion — Lecture 3';
const DEMO_AI_RESPONSE = [
  '**Got it — Rotational Motion logged.** Here’s your roadmap for today:',
  '- **Now:** finish the Lecture 3 notes + 10 practice questions',
  '- **Tonight:** a 5-minute recall check on what you covered',
  '- **Day 3:** first spaced revision — already on your calendar',
  'Keep logging what you study — *by your second day, I already know your pace.*',
].join('\n');

/** The four words under the hero headline. Typography only: no pills, no
 *  arrows, no diagram, and nothing animated. */
const FLOW_STAGES = ['Study', 'Learn', 'Revise', 'Remember'];

/**
 * The four-word sequence under the headline, set as type.
 *
 * It replaces the old animated flow diagram (pills joined by filling arrow
 * bars, cycling every four seconds): an explainer graphic that made the hero
 * read as a tutorial. The words are unchanged — they are just letter-spaced
 * caps separated by hairlines now, and the last one is the lit one.
 */
function StudyFlow({ t }: { t: LandingTokens }) {
  return (
    <div
      className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-3"
      data-testid="motion-diagram"
    >
      {FLOW_STAGES.map((label, index) => (
        <div key={label} className="flex items-center gap-x-4">
          {index > 0 && (
            <span
              aria-hidden="true"
              style={{ display: 'block', width: 22, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.18)' }}
            />
          )}
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.3em] sm:text-xs"
            style={{ color: index === FLOW_STAGES.length - 1 ? t.textPrimary : t.textSubtle }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LandingMarketing({
  t,
  BrandMark,
  scrolled,
  openLogin,
  priceInr,
  isIndia,
  checkoutBusyPlan,
  checkoutError,
  onRazorpay,
  onOpenLegal,
  supportEmail,
  legalLinkStyle,
  navLinkStyle,
}: LandingMarketingProps) {
  // The one CTA look: flat solid brand blue, white ink, no glow. The hover
  // state lives in the .lp-cta rules below rather than here, because an
  // inline style would outrank them.
  const ctaStyle: CSSProperties = {
    backgroundColor: CTA_BLUE,
    color: t.onGradient,
    border: 'none',
    cursor: 'pointer',
  };

  const payCta = (label: string, busy: boolean, onClick: () => void, testId: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={checkoutBusyPlan !== null}
      className="lp-cta w-full rounded-full px-5 py-4 text-sm font-extrabold"
      style={{ ...ctaStyle, cursor: checkoutBusyPlan ? 'wait' : 'pointer', opacity: checkoutBusyPlan && !busy ? 0.55 : 1 }}
      data-testid={testId}
    >
      {busy ? 'Opening secure checkout…' : label}
    </button>
  );

  return (
    <>
      <style>{`
        /* ---------- Signed-out landing page ---------- */
        @keyframes lpRise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .lp-rise { opacity: 0; animation: lpRise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        /* Flat solid CTA: no resting shadow, no neon. Hover only lifts it a
           hair and deepens the blue. */
        .lp-cta {
          transition: transform 0.18s ease-out, background-color 0.18s ease-out;
        }
        .lp-cta:hover { transform: translateY(-1px); background-color: #0B62FF; }
        .lp-cta:active { transform: translateY(0) scale(0.99); }
        .lp-cta:focus-visible { outline: 2px solid ${t.accentSoft}; outline-offset: 3px; }
        /* The hero headline: massive, tight, unbroken at 375px. The key words
           inside it are the only gradient-filled text on the page. */
        .lp-hero-title {
          font-size: clamp(2.5rem, 11vw, 5.5rem);
          line-height: 0.98;
          letter-spacing: -0.045em;
          text-wrap: balance;
        }
        @media (min-width: 640px) { .lp-hero-title { font-size: clamp(3.25rem, 8vw, 5.5rem); } }
        /* Glass cards: flat at rest, a faint blue glow when hovered. */
        .lp-card { transition: border-color 0.24s ease-out, box-shadow 0.24s ease-out; }
        .lp-card:hover { border-color: ${GLASS_BORDER_STRONG}; box-shadow: ${GLASS_GLOW}; }
        /* The AI demo bubble: the last markdown block drops its trailing
           margin so the bubble padding reads even on all four sides. */
        [data-testid="text-ai-demo-response"] > :last-child { margin-bottom: 0 !important; }
        @media (prefers-reduced-motion: reduce) {
          .lp-rise { animation: none; opacity: 1; transform: none; }
          .lp-cta, .lp-card { transition: none; }
          .lp-cta:hover { transform: none; }
        }
      `}</style>

      {/* ---------- Section 1: header + hero ---------- */}
      <nav
        className="sticky top-0 z-40 px-5 md:px-10"
        style={{
          // Near-black glass, not a blue banner: the nav should disappear into
          // the page and let the hero headline carry the colour.
          backgroundColor: scrolled ? 'rgba(10, 10, 15, 0.92)' : 'rgba(10, 10, 15, 0.6)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${scrolled ? GLASS_BORDER : 'transparent'}`,
          transition: 'border-color 0.4s ease, background-color 0.4s ease',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} radiusScale={0.3} />
            <span className="text-lg font-extrabold tracking-tight" style={{ fontFamily: t.headingFont, color: t.textPrimary }}>
              {t.brandName}
            </span>
          </div>
          <button
            onClick={openLogin}
            className="lp-cta whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-extrabold sm:text-sm"
            style={ctaStyle}
            data-testid="button-nav-get-started"
          >
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* The hero is lit exactly once: a single wide radial glow of
          rgba(0, 87, 255, 0.12) sitting behind the headline on the near-black
          canvas. No banner gradient, no second light source, nothing
          animated. */}
      <section
        className="px-5 pb-24 pt-20 md:px-10 md:pb-32 md:pt-28"
        style={{ background: HERO_RADIAL_GLOW }}
      >
        <div className="mx-auto max-w-5xl text-center">
          <h1
            className="lp-hero-title lp-rise font-extrabold"
            style={{ color: t.textPrimary, fontFamily: t.headingFont, animationDelay: '0.05s' }}
          >
            You study.{' '}
            <span
              style={{
                backgroundImage: t.gradientText,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              Revision is on us.
            </span>
          </h1>
          <p
            className="lp-rise mx-auto mt-7 max-w-2xl text-[16px] leading-[1.65] sm:text-lg sm:leading-relaxed md:text-xl"
            style={{ color: t.textMuted, animationDelay: '0.16s' }}
          >
            Add today’s task — get today’s roadmap. From Day 2, {t.brandName} already knows your pace and schedules every revision automatically.
          </p>

          <div className="lp-rise mt-10 md:mt-12" style={{ animationDelay: '0.26s' }}>
            <StudyFlow t={t} />
          </div>

          <div className="lp-rise mt-12 flex flex-col items-center md:mt-14" style={{ animationDelay: '0.36s' }}>
            <button
              onClick={openLogin}
              className="lp-cta inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full px-9 py-[19px] text-[17px] font-extrabold sm:w-auto sm:text-lg"
              style={ctaStyle}
              data-testid="button-open-login"
            >
              Start My Free Trial <ArrowRight size={20} strokeWidth={2.6} />
            </button>
            <p className="mt-5 text-[13px] font-semibold sm:text-sm" style={{ color: t.textSubtle }}>
              Free for 3 days — no card needed. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Section 2: the four-stage student journey ----------
          Scroll-driven, not a slideshow: the sticky mockup follows whichever
          text panel the reader has reached. */}
      <LandingStudentGallery t={t} />

      {/* ---------- Section 3: the problem, in five text panels ---------- */}
      <LandingProblemPanels t={t} />

      {/* ---------- Section 4: how it works, in real screens ----------
          The “Today” screen names an Indian coaching teacher, so it only
          renders for Indian visitors; everyone else gets the remaining screens
          in an even grid with no gap where it was. */}
      <LandingPhoneMockups t={t} isIndia={isIndia} />

      {/* ---------- Section 4.5: one real exchange with the coach ----------
          A simulated chat: the student logs a task, the coach answers. The
          reply is markdown rendered through AiMarkdown, so bold and bullets
          always display as formatting — never as raw asterisks. */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.sectionBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-ai-demo"
      >
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
              What it feels like
            </p>
            <h2
              className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-[52px]"
              style={{ color: t.textPrimary, fontFamily: t.headingFont }}
            >
              Add a task. Here’s what comes back.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.7] sm:text-base sm:leading-relaxed" style={{ color: t.textMuted }}>
              Day 1 is this simple: log what you studied and {t.brandName} hands you today’s roadmap. The personal
              part builds from Day 2 — it learns from what you actually complete.
            </p>
          </div>

          <div data-reveal className="mx-auto mt-12 max-w-xl">
            <div
              className="lp-card rounded-2xl p-4 md:p-6"
              style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
              data-testid="card-ai-demo"
            >
              <div className="flex justify-end">
                <p
                  className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-bold"
                  style={{ backgroundColor: CTA_BLUE, color: t.onGradient, maxWidth: '85%', margin: 0 }}
                  data-testid="text-ai-demo-user"
                >
                  {DEMO_USER_MESSAGE}
                </p>
              </div>
              <div className="mt-3 flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed"
                  style={{
                    backgroundColor: GLASS_BG_INSET,
                    border: `1px solid ${GLASS_BORDER}`,
                    color: t.textMuted,
                    maxWidth: '92%',
                  }}
                  data-testid="text-ai-demo-response"
                >
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-[0.16em]"
                    style={{ color: t.accentSoft, margin: '0 0 6px' }}
                  >
                    {t.brandName}
                  </p>
                  <AiMarkdown text={DEMO_AI_RESPONSE} t={t} />
                </div>
              </div>
            </div>
            <p className="mt-5 text-center text-xs leading-relaxed" style={{ color: t.textSubtle }}>
              Simulated conversation — this is the coach waiting on the other side of the sign-up.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Section 5: built by a student ---------- */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.pageBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-built-by-student"
      >
        <div
          data-reveal
          className="lp-card mx-auto max-w-3xl rounded-2xl p-7 text-center md:p-14"
          style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
            Who built this
          </p>
          <h2
            className="mt-4 text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-3xl md:text-[44px]"
            style={{ color: t.textPrimary, fontFamily: t.headingFont }}
          >
            Built by a student who lived this problem
          </h2>
          <p className="mt-7 text-[15px] leading-[1.75] sm:text-base md:text-lg md:leading-relaxed" style={{ color: t.textMuted }}>
            {FOUNDER_STORY}
          </p>
        </div>
      </section>

      {/* ---------- Section 6: pricing ----------
          ONE card, INR-only: Trial ₹10 / 1 day and Monthly ₹149 / 30 days
          (Popular), charged through Razorpay. The handler lives untouched in
          useEmailGateController. */}
      <section
        id="pricing"
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.pageBg, borderTop: `1px solid ${GLASS_BORDER}`, scrollMarginTop: 84 }}
      >
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mx-auto max-w-3xl text-center">
            <h2
              className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-[52px]"
              style={{ color: t.textPrimary, fontFamily: t.headingFont }}
            >
              Simple, honest pricing
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.7] sm:text-base sm:leading-relaxed" style={{ color: t.textMuted }}>
              Start small. Stay only while it is doing the work for you.
            </p>
          </div>

          {checkoutError && (
            <p
              className="mx-auto mt-10 max-w-xl rounded-2xl px-5 py-3.5 text-center text-sm font-bold leading-relaxed"
              style={{ backgroundColor: withAlpha(t.toneDanger, 0.1), border: `1px solid ${withAlpha(t.toneDanger, 0.28)}`, color: t.toneDanger }}
              role="alert"
              data-testid="text-checkout-error"
            >
              {checkoutError}
            </p>
          )}

          <div className="mx-auto mt-12 max-w-md">
            {/* ---- The one plan card — Razorpay, INR ---- */}
            <div data-reveal>
              <div
                className="lp-card flex h-full flex-col rounded-2xl p-6 md:p-8"
                style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
                data-testid="card-plan-india"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold uppercase tracking-[0.16em]" style={{ color: t.textPrimary }}>
                    Your plan
                  </p>
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold"
                    style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}`, color: t.accentSoft }}
                    aria-hidden="true"
                  >
                    ₹
                  </span>
                </div>

                <div className="mt-7 space-y-3">
                  {/* Trial — small, muted. */}
                  <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: GLASS_BG_INSET, border: `1px solid ${GLASS_BORDER}` }}>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: t.textSubtle }}>
                        Trial
                      </span>
                      <span className="text-xl font-extrabold tracking-tight" style={{ color: t.textMuted }}>
                        {priceInr.day}
                      </span>
                      <span className="text-xs font-bold" style={{ color: t.textSubtle }}>
                        / 1 day
                      </span>
                    </p>
                  </div>

                  {/* Popular — the one row that carries the blue: a thin
                      border on the left, nothing else. */}
                  <div
                    className="relative rounded-2xl px-4 py-4"
                    style={{
                      backgroundColor: GLASS_BG,
                      border: `1px solid ${GLASS_BORDER}`,
                      borderLeft: `2px solid ${CTA_BLUE}`,
                    }}
                  >
                    <span
                      className="absolute -top-2.5 right-4 inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em]"
                      style={{ backgroundColor: CTA_BLUE, color: t.onGradient }}
                      data-testid="badge-popular"
                    >
                      Most chosen
                    </span>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-[32px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: t.textPrimary }}>
                        {priceInr.monthly}
                      </span>
                      <span className="text-xs font-bold" style={{ color: t.textSubtle }}>
                        / 30 days
                      </span>
                    </p>
                    <p className="mt-2 text-xs font-semibold" style={{ color: t.textMuted }}>
                      Full access for a month
                    </p>
                  </div>
                </div>

                <p className="mt-6 text-xs font-semibold leading-relaxed" style={{ color: t.textSubtle }}>
                  Razorpay — UPI, cards, wallets
                </p>

                <div className="mt-auto space-y-4 pt-7">
                  {payCta(`Get 30 days — ${priceInr.monthly}`, checkoutBusyPlan === 'monthly', () => onRazorpay('monthly'), 'button-pay-india-monthly')}
                  <button
                    type="button"
                    onClick={() => onRazorpay('day')}
                    disabled={checkoutBusyPlan !== null}
                    className="w-full text-xs font-bold underline underline-offset-4"
                    style={{ color: t.textMuted, backgroundColor: 'transparent', border: 'none', cursor: checkoutBusyPlan ? 'wait' : 'pointer' }}
                    data-testid="button-pay-india-day"
                  >
                    {checkoutBusyPlan === 'day' ? 'Opening secure checkout…' : `or try 1 day for ${priceInr.day}`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-10 max-w-xl text-center text-sm leading-relaxed" style={{ color: t.textSubtle }} data-testid="text-funds-development">
            Your subscription directly funds development. Built solo — your support keeps this going.
          </p>

          <p className="mt-6 text-center text-xs font-semibold" style={{ color: t.textSubtle }} data-testid="text-pricing-regions">
            Same price everywhere — charged in ₹ (INR) through Razorpay without leaving this page.
          </p>

          {/* Closing CTA — the free trial, not a payment. */}
          <div data-reveal className="mt-14 flex flex-col items-center">
            <button
              onClick={openLogin}
              className="lp-cta inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full px-9 py-[19px] text-[17px] font-extrabold sm:w-auto sm:text-lg"
              style={ctaStyle}
              data-testid="button-bottom-cta"
            >
              Start your free 3-day trial <ArrowRight size={19} strokeWidth={2.6} />
            </button>
          </div>

          <p className="mx-auto mt-7 max-w-xl text-center text-xs leading-relaxed" style={{ color: t.textSubtle }}>
            Your 3-day free trial starts when you finish setting up your account — no card needed. Monthly plans renew
            until you cancel; payments for a period you have already accessed are non-refundable.
          </p>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-bold" style={{ color: t.textMuted }}>
            <button type="button" onClick={() => onOpenLegal('terms')} style={legalLinkStyle} data-testid="link-pricing-terms">
              Terms of Service
            </button>
            <span style={{ color: t.textSubtle }}>·</span>
            <button type="button" onClick={() => onOpenLegal('privacy')} style={legalLinkStyle} data-testid="link-pricing-privacy">
              Privacy Policy
            </button>
            <span style={{ color: t.textSubtle }}>·</span>
            <a href={`mailto:${supportEmail}`} style={legalLinkStyle} data-testid="link-pricing-support">
              {supportEmail}
            </a>
          </p>
        </div>
      </section>

      {/* ---------- Compliance footer: hash-routed public pages ---------- */}
      <footer className="px-5 pb-12 pt-14 md:px-10" style={{ borderTop: `1px solid ${GLASS_BORDER}`, backgroundColor: t.sectionBg }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} radiusScale={0.3} />
            <span className="text-base font-extrabold" style={{ fontFamily: t.headingFont, color: t.textPrimary }}>
              {t.brandName}
            </span>
          </div>
          <p className="text-xs" style={{ color: t.textSubtle }}>
            Smarter revision for JEE, NEET, NEET PG, INICET, UPSC, CAT, SSC and Defence aspirants.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs" style={{ color: t.textSubtle }}>
            <span>© 2026 {t.brandName}</span>
            <span aria-hidden="true">·</span>
            <a href="#/about" className="hover:opacity-80" style={navLinkStyle} data-testid="link-footer-about">
              About
            </a>
            <span aria-hidden="true">·</span>
            <a href="#/terms" className="hover:opacity-80" style={navLinkStyle} data-testid="link-footer-terms">
              Terms
            </a>
            <span aria-hidden="true">·</span>
            <a href="#/privacy" className="hover:opacity-80" style={navLinkStyle} data-testid="link-footer-privacy">
              Privacy
            </a>
            <span aria-hidden="true">·</span>
            <a href="#/refund" className="hover:opacity-80" style={navLinkStyle} data-testid="link-footer-refund">
              Refund Policy
            </a>
            <span aria-hidden="true">·</span>
            <a href="#/contact" className="hover:opacity-80" style={navLinkStyle} data-testid="link-footer-contact">
              Contact
            </a>
          </nav>
          <p className="text-xs" style={{ color: t.textSubtle }}>
            Support:{' '}
            <a href={`mailto:${supportEmail}`} className="font-semibold underline underline-offset-2" style={{ color: t.textMuted }}>
              {supportEmail}
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
