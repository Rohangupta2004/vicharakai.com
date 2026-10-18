import type { ComponentType, CSSProperties, ReactNode } from 'react';
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
  LANDING_C_ACCENT,
  withAlpha,
} from './landingTokens';
import { AiMarkdown } from './landingMarkdown';
import { ForgettingCurve } from './LandingProblemPanels';

/**
 * The signed-out marketing page for VicharakAI — the INTERNATIONAL branch.
 *
 * WHY THIS FILE EXISTS: visitors outside India sit completely different exams,
 * pay in a different currency and through a different processor. Showing them
 * the Indian page (JEE/NEET copy, ₹ pricing, Razorpay/UPI) wastes the click.
 * So the two branches share the brand and the layout language and NOTHING
 * else — every headline, section and price here is its own copy, and there is
 * deliberately no blended “JEE, NEET, MCAT” list anywhere.
 *
 * The branch is decided ONCE per session in useEmailGateController (ipapi.co
 * country_code → the workspace `geo` server function → device timezone,
 * cached in sessionStorage) and applied in EmailGateLanding.tsx. Country IN
 * gets components/LandingMarketing.tsx; everything else gets this page.
 *
 * AUTH IS IDENTICAL on both branches — every CTA here calls the same
 * openLogin() the Indian page uses. Only content and checkout differ:
 *
 *   pricing  → $1 / 1 day (Trial) and $10 / month (Popular)
 *   checkout → a Creem payment link (onCreem), never Razorpay, never ₹
 *
 * DESIGN RULES (founder instruction, 2026-09-02 — premium, minimal, dark):
 * typography is the visual and there are NO illustrations on this page — no
 * drawn props, no cartoon icons, no explainer graphics. The hero's memory map
 * is a study-plan grid built from markup, and the forgetting curve survives
 * only because it is real data-viz. Surfaces are glass, never colour:
 * rgba(255,255,255,0.04) behind a rgba(255,255,255,0.08) hairline, with the
 * faint blue GLASS_GLOW as the page's only shadow. The CTA is flat solid
 * #0057FF, a large rounded pill with no neon. Palette: #0A0A0F canvas,
 * #111118 deep surface, #0057FF accent, #003AB0 navy and the light #6C9BFF
 * tint for small accent text. No cyan, purple, teal or violet, and no white
 * surfaces.
 *
 * The forgetting-curve chart is imported from LandingProblemPanels because the
 * science is universal; only the framing copy around it is rewritten here.
 */

export type PaidPlan = 'day' | 'monthly';

interface LandingGlobalMarketingProps {
  t: LandingTokens;
  BrandMark: ComponentType<{ size?: number; blockColor?: string; radiusScale?: number }>;
  scrolled: boolean;
  /** The one auth entry point — identical to the Indian branch. */
  openLogin: () => void;
  /** Display prices (USD), derived in EmailGate from the numeric plan amounts. */
  priceUsd: { day: string; monthly: string };
  /** Creem (USD) — the international checkout. Opens Creem’s hosted page. */
  onCreem: (plan: PaidPlan) => void;
  /** Set once a Creem tab has been opened, so the visitor knows where to look. */
  checkoutNotice: string;
  checkoutError: string;
  onOpenLegal: (doc: 'privacy' | 'terms') => void;
  supportEmail: string;
  legalLinkStyle: CSSProperties;
  navLinkStyle: CSSProperties;
}

/** The hero headline, split so the gradient fill lands on the closing words
 *  only — white everywhere else. Rendered as lead + ' ' + key, so the
 *  sentence on screen is unchanged, word for word. */
const HERO_HEADLINE_LEAD = 'The AI that knows what you need to study —';
const HERO_HEADLINE_KEY = 'before you do.';
const HERO_SUB =
  'VicharakAI builds a memory of how you study, spots what’s slipping, and tells you exactly what to focus on each day. Built for MCAT, GRE, GMAT, LSAT — and every high-stakes exam.';
const HERO_CTA = 'Start your 3-day free trial';

const PROBLEM_HEADLINE =
  'You study for hours. But three weeks later, you’re not sure what actually stuck — and you only find out on test day.';
const PROBLEM_SUPPORT =
  'The problem isn’t effort. It’s that nobody tells you what to revise — or when. You find out what slipped only when a practice test punishes you for it.';

const STEPS: Array<{ n: string; title: string; body: string }> = [
  { n: '01', title: 'Log what you studied today', body: 'Takes 30 seconds.' },
  {
    n: '02',
    title: 'VicharakAI tracks what’s slipping',
    body: 'Builds your memory map silently in the background.',
  },
  { n: '03', title: 'Get tomorrow’s exact plan', body: 'No guesswork, no planning stress.' },
];

/** International exams only — never an Indian exam name on this branch. */
const EXAMS = ['MCAT', 'GRE', 'GMAT', 'LSAT', 'UCAT', 'GAMSAT', 'A-Levels'];

/** The founder story, told for an international reader. */
const FOUNDER_STORY =
  'I was preparing for my own exam using online courses and YouTube. Every day I studied — but by the end of the week I had no idea what had actually stuck. My gaps only showed up on practice tests. I couldn’t find any app that tracked my strategy, not just my content. So I built one. This is VicharakAI.';

const DEMO_USER_MESSAGE = 'Add task: MCAT Biochem — Amino Acids lecture';
const DEMO_AI_RESPONSE = [
  '**Got it — Amino Acids logged.** Here’s your plan for today:',
  '- **Now:** one Biochem passage set + 10 discrete questions',
  '- **Tonight:** a 5-minute recall check on what you covered',
  '- **Day 3:** first spaced review — already on your calendar',
  'Keep logging what you study — *by your second day, I already know your pace.*',
].join('\n');

/** The hero visual: what “a memory of how you study” actually looks like —
 *  three topics with a live status, and tomorrow’s call already made.
 *
 *  It is a STUDY-PLAN GRID, not a picture: dark cells, small caps labels and
 *  one blue accent per row, built from markup only. The colour coding is blue
 *  intensity — how many cells are lit — so the card stays inside the #0057FF
 *  palette instead of reaching for red/amber/green status paint. Nothing in
 *  here is on a timer. */
const MEMORY_CELLS = 5;

function MemoryMapCard({ t }: { t: LandingTokens }) {
  const rows: Array<{ topic: string; status: string; held: number }> = [
    { topic: 'Amino Acids & Proteins', status: 'Slipping', held: 2 },
    { topic: 'Kinetics', status: 'Needs a review', held: 3 },
    { topic: 'Behavioral Science', status: 'Holding', held: 5 },
  ];
  return (
    <div
      className="mx-auto w-full max-w-sm rounded-2xl p-5 text-left sm:max-w-md sm:p-6"
      style={{
        backgroundColor: GLASS_BG,
        border: `1px solid ${GLASS_BORDER}`,
        boxShadow: GLASS_GLOW,
      }}
      data-testid="card-memory-map"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: t.accentSoft, margin: 0 }}>
          Your memory map
        </p>
        <span
          className="rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em]"
          style={{ backgroundColor: CTA_BLUE, color: t.onGradient }}
        >
          Live
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {rows.map((row) => (
          <div
            key={row.topic}
            className="rounded-2xl px-3.5 py-3"
            style={{ backgroundColor: GLASS_BG_INSET, border: `1px solid ${GLASS_BORDER}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12.5px] font-extrabold" style={{ color: t.textPrimary }}>
                {row.topic}
              </span>
              <span
                className="flex-shrink-0 text-[9px] font-extrabold uppercase tracking-[0.14em]"
                style={{ color: row.held >= MEMORY_CELLS ? t.accentSoft : t.textSubtle }}
              >
                {row.status}
              </span>
            </div>
            {/* The plan grid: a lit cell is a topic still holding. */}
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: MEMORY_CELLS }).map((_, cell) => (
                <span
                  key={cell}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 3,
                    backgroundColor: cell < row.held ? CTA_BLUE : 'rgba(255, 255, 255, 0.06)',
                    border: `1px solid ${cell < row.held ? withAlpha(CTA_BLUE, 0.5) : GLASS_BORDER}`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-4 rounded-2xl px-3.5 py-3"
        style={{
          backgroundColor: GLASS_BG,
          border: `1px solid ${GLASS_BORDER}`,
          borderLeft: `2px solid ${CTA_BLUE}`,
        }}
      >
        <p className="text-[12px] font-bold leading-snug" style={{ color: t.textMuted, margin: 0 }}>
          Tomorrow: review Amino Acids first, then 20 minutes on Kinetics.
        </p>
      </div>
    </div>
  );
}

function SectionHeading({ t, children }: { t: LandingTokens; children: ReactNode }) {
  return (
    <h2
      className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-[46px]"
      style={{ color: t.textPrimary, fontFamily: t.headingFont }}
    >
      {children}
    </h2>
  );
}

export default function LandingGlobalMarketing({
  t,
  BrandMark,
  scrolled,
  openLogin,
  priceUsd,
  onCreem,
  checkoutNotice,
  checkoutError,
  onOpenLegal,
  supportEmail,
  legalLinkStyle,
  navLinkStyle,
}: LandingGlobalMarketingProps) {
  const ctaStyle: CSSProperties = {
    // Flat solid brand blue, white ink, no glow — the hover state lives in
    // the .gp-cta rules below so it can outrank an inline style.
    backgroundColor: CTA_BLUE,
    color: t.onGradient,
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <>
      <style>{`
        /* ---------- Signed-out landing page · international branch ---------- */
        @keyframes gpRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .gp-rise { opacity: 0; animation: gpRise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        /* Flat solid CTA: no resting shadow, no neon. Hover only lifts it a
           hair and deepens the blue. */
        .gp-cta { transition: transform 0.18s ease-out, background-color 0.18s ease-out; }
        .gp-cta:hover { transform: translateY(-1px); background-color: #0B62FF; }
        .gp-cta:active { transform: translateY(0) scale(0.99); }
        .gp-cta:focus-visible { outline: 2px solid ${t.accentSoft}; outline-offset: 3px; }
        /* The hero headline: massive, tight, unbroken at 375px. The key words
           inside it are the only gradient-filled text on the page. */
        .gp-hero-title {
          font-size: clamp(2.3rem, 9.2vw, 4.75rem);
          line-height: 1;
          letter-spacing: -0.04em;
          text-wrap: balance;
        }
        @media (min-width: 640px) { .gp-hero-title { font-size: clamp(3rem, 6.4vw, 4.75rem); } }
        /* Glass cards: flat at rest, a faint blue glow when hovered. */
        .gp-card, .gp-price-card { transition: border-color 0.24s ease-out, box-shadow 0.24s ease-out; }
        .gp-card:hover, .gp-price-card:hover { border-color: ${GLASS_BORDER_STRONG}; box-shadow: ${GLASS_GLOW}; }
        [data-testid="text-global-demo-response"] > :last-child { margin-bottom: 0 !important; }
        /* The forgetting curve draws itself in when the panel scrolls into view
           (.eg-revealed comes from the reveal observer in
           useEmailGateController). The resting state is the FULLY DRAWN curve,
           so a panel that never gets the class still shows a complete chart. */
        .lp-curve { stroke-dasharray: 700; stroke-dashoffset: 0; }
        [data-testid="global-problem-curve"].eg-revealed .lp-curve {
          animation: gpCurveDraw 1.15s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        [data-testid="global-problem-curve"].eg-revealed .lp-curve-hold { animation-delay: 0.22s; }
        @keyframes gpCurveDraw { from { stroke-dashoffset: 700; } to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .gp-rise { animation: none; opacity: 1; transform: none; }
          .gp-cta, .gp-card, .gp-price-card { transition: none; }
          .gp-cta:hover { transform: none; }
          .lp-curve { stroke-dasharray: none; }
          [data-testid="global-problem-curve"].eg-revealed .lp-curve { animation: none; }
        }
      `}</style>

      {/* ---------- Header ---------- */}
      <nav
        className="sticky top-0 z-40 px-5 md:px-10"
        style={{
          // Near-black glass, not a blue banner: the nav disappears into the
          // page and lets the hero headline carry the colour.
          backgroundColor: scrolled ? 'rgba(10, 10, 15, 0.92)' : 'rgba(10, 10, 15, 0.6)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${scrolled ? GLASS_BORDER : 'transparent'}`,
          transition: 'border-color 0.4s ease, background-color 0.4s ease',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BrandMark size={34} radiusScale={0.3} />
            <span className="text-lg font-extrabold tracking-tight" style={{ fontFamily: t.headingFont, color: t.textPrimary }}>
              {t.brandName}
            </span>
          </div>
          <button
            onClick={openLogin}
            className="gp-cta whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-extrabold sm:text-sm"
            style={ctaStyle}
            data-testid="button-nav-get-started"
          >
            Start free trial
          </button>
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      {/* The hero is lit exactly once: a single wide radial glow of
          rgba(0, 87, 255, 0.12) behind the headline on the near-black canvas.
          No banner gradient, no second light source, nothing animated. */}
      <section
        className="px-5 pb-24 pt-20 md:px-10 md:pb-32 md:pt-28"
        style={{ background: HERO_RADIAL_GLOW }}
        data-testid="section-global-hero"
      >
        <div className="mx-auto max-w-5xl text-center">
          <h1
            className="gp-hero-title gp-rise font-extrabold"
            style={{ color: t.textPrimary, fontFamily: t.headingFont, animationDelay: '0.05s' }}
            data-testid="text-global-headline"
          >
            {HERO_HEADLINE_LEAD}{' '}
            <span
              style={{
                backgroundImage: t.gradientText,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {HERO_HEADLINE_KEY}
            </span>
          </h1>
          <p
            className="gp-rise mx-auto mt-7 max-w-2xl text-[16px] leading-[1.65] sm:text-lg sm:leading-relaxed"
            style={{ color: t.textMuted, animationDelay: '0.16s' }}
          >
            {HERO_SUB}
          </p>

          <div className="gp-rise mt-12 flex flex-col items-center md:mt-14" style={{ animationDelay: '0.28s' }}>
            <button
              onClick={openLogin}
              className="gp-cta inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full px-9 py-[19px] text-[17px] font-extrabold sm:w-auto sm:text-lg"
              style={ctaStyle}
              data-testid="button-open-login"
            >
              {HERO_CTA} <ArrowRight size={20} strokeWidth={2.6} />
            </button>
            <p className="mt-5 text-[13px] font-semibold sm:text-sm" style={{ color: t.textSubtle }}>
              No credit card. Cancel anytime.
            </p>
          </div>

          <div className="gp-rise mt-16" style={{ animationDelay: '0.4s' }}>
            <MemoryMapCard t={t} />
          </div>
        </div>
      </section>

      {/* ---------- The problem, with the (universal) forgetting curve ---------- */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.sectionBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-global-problem"
      >
        <div className="mx-auto max-w-5xl">
          <div data-reveal className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
              The real problem
            </p>
            <div className="mt-3">
              <SectionHeading t={t}>{PROBLEM_HEADLINE}</SectionHeading>
            </div>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-[1.68] sm:text-base sm:leading-relaxed" style={{ color: t.textMuted }}>
              {PROBLEM_SUPPORT}
            </p>
          </div>

          <figure
            data-reveal
            data-testid="global-problem-curve"
            className="gp-card max-w-3xl rounded-2xl p-6 md:p-8"
            style={{
              // <figure> carries a UA margin, so it is set explicitly here
              // rather than through mx-auto/mt-* classes an inline margin
              // would override anyway.
              margin: '56px auto 0',
              backgroundColor: GLASS_BG,
              border: `1px solid ${GLASS_BORDER}`,
              borderLeft: `2px solid ${CTA_BLUE}`,
            }}
          >
            <h3 className="text-base font-extrabold leading-snug md:text-lg" style={{ color: t.textPrimary, fontFamily: t.headingFont }}>
              Three days in, half of it is already gone
            </h3>
            <div
              className="mt-5 overflow-hidden rounded-2xl px-2 py-4"
              style={{ backgroundColor: GLASS_BG_INSET, border: `1px solid ${GLASS_BORDER}` }}
            >
              <ForgettingCurve t={t} />
            </div>
            <figcaption className="mt-4 text-[13.5px] leading-relaxed sm:text-sm" style={{ color: t.textMuted }}>
              The Ebbinghaus forgetting curve: without review you lose about half of what you learned within three
              days. Reviewing at days 1, 3, 7 and 14 keeps it near the top instead — which is exactly the schedule
              nobody has time to run by hand.
            </figcaption>
          </figure>

          <p
            data-reveal
            className="mx-auto mt-9 max-w-2xl text-center text-lg font-semibold leading-snug md:text-2xl"
            style={{ color: t.textPrimary, fontFamily: t.headingFont }}
          >
            {t.brandName} runs that schedule for you — silently, in the background.
          </p>
        </div>
      </section>

      {/* ---------- How it works, in three steps ---------- */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.pageBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-global-how-it-works"
      >
        <div className="mx-auto max-w-5xl">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
              How it works
            </p>
            <div className="mt-3">
              <SectionHeading t={t}>Thirty seconds a day. That is the whole job.</SectionHeading>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
            {STEPS.map((stepItem, index) => (
              <div
                key={stepItem.n}
                data-reveal
                className="gp-card flex flex-col rounded-2xl p-6 md:p-8"
                style={{
                  backgroundColor: GLASS_BG,
                  border: `1px solid ${GLASS_BORDER}`,
                  borderLeft: `2px solid ${CTA_BLUE}`,
                  transitionDelay: `${index * 90}ms`,
                }}
                data-testid={`global-step-${stepItem.n}`}
              >
                {/* Step number marker — carries the --c-accent token
                    (founder instruction, 2026-09-03). */}
                <span
                  className="text-[28px] font-extrabold leading-none tracking-[-0.02em] md:text-[34px]"
                  style={{ color: `var(--c-accent, ${LANDING_C_ACCENT})`, fontFamily: t.headingFont }}
                >
                  {stepItem.n}
                </span>
                <h3
                  className="mt-4 text-[19px] font-extrabold leading-snug md:text-xl"
                  style={{ color: t.textPrimary, fontFamily: t.headingFont }}
                >
                  {stepItem.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-[1.65] sm:text-sm" style={{ color: t.textMuted }}>
                  {stepItem.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- One exchange with the coach ---------- */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.sectionBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-global-demo"
      >
        <div className="mx-auto max-w-3xl">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
              What it feels like
            </p>
            <div className="mt-3">
              <SectionHeading t={t}>Log one thing. Get your next move.</SectionHeading>
            </div>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.68] sm:text-base sm:leading-relaxed" style={{ color: t.textMuted }}>
              Day 1 is this simple: tell {t.brandName} what you studied and it hands you today’s plan. From Day 2 it is
              personal — it learns from what you actually complete.
            </p>
          </div>

          <div data-reveal className="mx-auto mt-9 max-w-xl">
            <div
              className="gp-card rounded-2xl p-4 md:p-6"
              style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
              data-testid="card-global-demo"
            >
              <div className="flex justify-end">
                <p
                  className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-bold"
                  style={{ backgroundColor: CTA_BLUE, color: t.onGradient, maxWidth: '85%', margin: 0 }}
                  data-testid="text-global-demo-user"
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
                  data-testid="text-global-demo-response"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: t.accentSoft, margin: '0 0 6px' }}>
                    {t.brandName}
                  </p>
                  <AiMarkdown text={DEMO_AI_RESPONSE} t={t} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: t.textSubtle }}>
              Simulated conversation — this is the coach waiting on the other side of the sign-up.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Exams covered (international only) ---------- */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.pageBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-global-exams"
      >
        <div className="mx-auto max-w-4xl text-center">
          <div data-reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
              Built for the exams that decide your next step
            </p>
            <div className="mt-3">
              <SectionHeading t={t}>Whatever you are sitting, the method is the same.</SectionHeading>
            </div>
          </div>

          <div data-reveal className="mt-8 flex flex-wrap items-center justify-center gap-2.5" data-testid="global-exam-chips">
            {EXAMS.map((exam) => (
              <span
                key={exam}
                className="rounded-full px-4 py-2 text-[13px] font-extrabold"
                style={{
                  color: t.textPrimary,
                  backgroundColor: GLASS_BG,
                  border: `1px solid ${GLASS_BORDER}`,
                }}
              >
                {exam}
              </span>
            ))}
          </div>

          <p data-reveal className="mx-auto mt-6 max-w-xl text-[14.5px] leading-[1.68] sm:text-sm" style={{ color: t.textMuted }}>
            Studying for something else? Tell {t.brandName} your exam and your date, and it plans around them.
          </p>
        </div>
      </section>

      {/* ---------- Proof: the method, and who built it ---------- */}
      <section
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.sectionBg, borderTop: `1px solid ${GLASS_BORDER}` }}
        data-testid="section-global-proof"
      >
        <div className="mx-auto max-w-3xl">
          <p
            data-reveal
            className="rounded-2xl px-5 py-4 text-center text-[14px] leading-relaxed sm:text-sm"
            style={{ border: `1px solid ${GLASS_BORDER}`, backgroundColor: GLASS_BG, color: t.textMuted }}
            data-testid="global-attribution"
          >
            Ali Abdaal (6.8M subscribers) and Thomas Frank have both made videos on spaced repetition — the method is
            settled. Running it every single day is the part nobody manages alone.
          </p>

          <div
            data-reveal
            className="gp-card mt-10 rounded-2xl p-7 text-center md:p-14"
            style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
            data-testid="section-global-founder"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
              Who built this
            </p>
            <div className="mt-4">
              <SectionHeading t={t}>Built by a student who lived this problem</SectionHeading>
            </div>
            <p className="mt-6 text-[15px] leading-[1.7] sm:text-base md:text-lg md:leading-relaxed" style={{ color: t.textMuted }}>
              {FOUNDER_STORY}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Pricing: USD via Creem ---------- */}
      <section
        id="pricing"
        className="px-5 py-24 md:px-10 md:py-32"
        style={{ backgroundColor: t.pageBg, borderTop: `1px solid ${GLASS_BORDER}`, scrollMarginTop: 84 }}
        data-testid="section-global-pricing"
      >
        <div className="mx-auto max-w-4xl">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <SectionHeading t={t}>Simple, honest pricing</SectionHeading>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.68] sm:text-base sm:leading-relaxed" style={{ color: t.textMuted }}>
              No yearly lock-in. Cancel anytime.
            </p>
          </div>

          {checkoutError && (
            <p
              className="mx-auto mt-8 max-w-xl rounded-2xl px-5 py-3.5 text-center text-sm font-bold leading-relaxed"
              style={{ backgroundColor: withAlpha(t.toneDanger, 0.1), border: `1px solid ${withAlpha(t.toneDanger, 0.28)}`, color: t.toneDanger }}
              role="alert"
              data-testid="text-checkout-error"
            >
              {checkoutError}
            </p>
          )}

          {checkoutNotice && (
            <p
              className="mx-auto mt-8 max-w-xl rounded-2xl px-5 py-3.5 text-center text-sm font-bold leading-relaxed"
              style={{ backgroundColor: GLASS_BG, border: `1px solid ${withAlpha(CTA_BLUE, 0.4)}`, color: t.textPrimary }}
              role="status"
              data-testid="text-checkout-notice"
            >
              {checkoutNotice}
            </p>
          )}

          <div className="mx-auto mt-9 max-w-md">
            <div data-reveal>
              <div
                className="gp-price-card flex h-full flex-col rounded-2xl p-6 md:p-8"
                style={{ backgroundColor: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
                data-testid="card-plan-global"
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
                    $
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: GLASS_BG_INSET, border: `1px solid ${GLASS_BORDER}` }}>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: t.textSubtle }}>
                        Trial
                      </span>
                      <span className="text-xl font-extrabold tracking-tight" style={{ color: t.textMuted }}>
                        {priceUsd.day}
                      </span>
                      <span className="text-xs font-bold" style={{ color: t.textSubtle }}>
                        / day
                      </span>
                    </p>
                  </div>

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
                        {priceUsd.monthly}
                      </span>
                      <span className="text-xs font-bold" style={{ color: t.textSubtle }}>
                        / month
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: t.textMuted }}>
                      Full access, month to month
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-xs font-semibold leading-relaxed" style={{ color: t.textSubtle }}>
                  Creem — secure international card checkout
                </p>

                <div className="mt-auto space-y-3 pt-6">
                  <button
                    type="button"
                    onClick={() => onCreem('monthly')}
                    className="gp-cta w-full rounded-full px-5 py-4 text-sm font-extrabold"
                    style={ctaStyle}
                    data-testid="button-pay-global-monthly"
                  >
                    Get a month — {priceUsd.monthly}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreem('day')}
                    className="w-full text-xs font-bold underline underline-offset-4"
                    style={{ color: t.textMuted, backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                    data-testid="button-pay-global-day"
                  >
                    or try 1 day for {priceUsd.day}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs font-semibold" style={{ color: t.textSubtle }} data-testid="text-pricing-regions">
            Charged in $ (USD) through Creem — secure international checkout. No yearly lock-in. Cancel anytime.
          </p>

          {/* ---------- Closing CTA ---------- */}
          <div data-reveal className="mt-12 flex flex-col items-center text-center">
            <SectionHeading t={t}>Ready to stop guessing and start progressing?</SectionHeading>
            <button
              onClick={openLogin}
              className="gp-cta mt-8 inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full px-9 py-[19px] text-[17px] font-extrabold sm:w-auto sm:text-lg"
              style={ctaStyle}
              data-testid="button-bottom-cta"
            >
              Start free for 3 days <ArrowRight size={19} strokeWidth={2.6} />
            </button>
          </div>

          <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-relaxed" style={{ color: t.textSubtle }}>
            Your 3-day free trial starts when you finish setting up your account — no card needed. Monthly plans renew
            until you cancel; payments for a period you have already accessed are non-refundable.
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-bold" style={{ color: t.textMuted }}>
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

      {/* ---------- Compliance footer ---------- */}
      <footer className="px-5 pb-10 pt-12 md:px-10" style={{ borderTop: `1px solid ${GLASS_BORDER}`, backgroundColor: t.sectionBg }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} radiusScale={0.3} />
            <span className="text-base font-extrabold" style={{ fontFamily: t.headingFont, color: t.textPrimary }}>
              {t.brandName}
            </span>
          </div>
          <p className="text-xs" style={{ color: t.textSubtle }}>
            Smarter revision for MCAT, GRE, GMAT, LSAT, UCAT, GAMSAT and A-Level students.
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
