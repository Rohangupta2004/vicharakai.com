import { useEffect, useRef, useState } from 'react';
import type { ComponentType, CSSProperties, MutableRefObject, ReactNode } from 'react';
import type { LandingTokens } from './landingTokens';
import {
  PAPER_ACCENT,
  PAPER_ACCENT_HOVER,
  PAPER_ACCENT_INK,
  PAPER_ACCENT_PRESS,
  PAPER_ACCENT_TEXT,
  PAPER_BG,
  PAPER_FONTS_IMPORT,
  PAPER_FONT_BODY,
  PAPER_FONT_DISPLAY,
  PAPER_GONE,
  PAPER_G_ACCENT,
  PAPER_G_ACCENT_BRAND,
  PAPER_G_BRAND,
  PAPER_G_BRAND_HOVER,
  PAPER_G_CARD,
  PAPER_G_HELD,
  PAPER_G_HERO,
  PAPER_G_HERO_MOBILE,
  PAPER_G_RULE,
  PAPER_G_SUNK,
  PAPER_G_TEXT,
  PAPER_G_WASH,
  PAPER_G_WASH_WARM,
  PAPER_INK,
  PAPER_INK_FAINT,
  PAPER_INK_SOFT,
  PAPER_KEPT,
  PAPER_RULE,
  PAPER_SUNK,
} from './landingTokens';
import type { RegionConfig, RegionMemory } from './landingRegions';
import { PRIMARY_CTA, TRIAL_CTA, TRIAL_DAYS } from './landingRegions';
import type { ExamMatch } from './landingExamMatch';
import { readExamMatch } from './landingExamMatch';
import { PLAN_PRICE_INR, PLAN_PRICE_USD } from './emailGateShared';
import type { CtaLocation, LandingEventContext } from './landingAnalytics';
import { trackCtaClick, trackDemoRun, trackPricingView } from './landingAnalytics';
import { PhoneFrame, TodayScreen } from './LandingAppMockups';
import ForgettingDiagram from './LandingForgettingDiagram';
import SpacedRepetitionExplainer from './LandingSpacedRepetition';
import { LEARN_HREF } from './Learn/learnRoute';
import LandingFlowDiagram from './LandingFlowDiagram';
import { ChatPlanMockup, VichareeMoodMockup, VisionBoardMockup } from './LandingV2Showcase';
import type { LandingLang } from './landingLanguage';
import { readLandingLang, saveLandingLang, translateLanding } from './landingLanguage';
import { BookOpen, CalendarClock, FileText, Gauge, LineChart, ListChecks, Sparkles, TrendingUp, XCircle } from 'lucide-react';

/**
 * THE SIGNED-OUT LANDING PAGE — one component, four regional faces.
 *
 * VicharakAI acquires from four markets whose exams, currency and academic
 * vocabulary do not overlap, so each market has its own route:
 *
 *   /in · /us · /uk · /global   (and the bare root, which geo-detects)
 *
 * THIS FILE HOLDS NO REGIONAL CONTENT. Every headline, paragraph, exam chip,
 * price, meta description and piece of terminology comes in as `region` from
 * components/landingRegions.ts, so a layout fix lands on all four pages at
 * once and a copy fix is a one-line edit in the config. NEVER hardcode a
 * price, a currency symbol or an exam name here.
 *
 * ── FULLY LIGHT, ONE BLUE (v198, founder instruction 2026-09-30) ──
 *
 * The ENTIRE page — nav, hero, every band and every card — sits on a LIGHT
 * warm-white sheet (#FCFBF8 family) in dark ink (#161F2B). The PAPER_*
 * tokens in landingTokens.ts carry the light values, so the cards, diagrams
 * and the Learn/legal pages all flip together.
 *
 * Since v198 the free-session banner (.lp4-banner) is light as well — a
 * white card behind a blue hairline directly below the nav. NOTHING on the
 * page is dark any more, and the banner's inline email field is gone. Since
 * v199 its one "Claim my spot" button is a MAILTO to the founder — it never
 * opens the sign-in and never redirects (founder instruction, 2026-09-30).
 *
 * The ONE accent everywhere is electric blue #0057FF. CYAN IS GONE — no
 * border, no glow, no gradient stop, no icon (v194 removed the last of it).
 *
 * The light-hero scoped rules under .lp4-hero-glow remain — they now agree
 * with the global tokens instead of shielding the hero from a dark canvas.
 *
 * The phone mockups (LandingAppMockups) stay LIGHT on purpose: they depict
 * the real app, which is light-themed, and a screen inside a bezel is meant
 * to look like a screen.
 *
 * ── THE PAGE, IN ORDER ────────────────────────────────────────────
 *
 *   1  HERO        — exam chips, the headline, and THE LIVE DEMO: a visitor
 *                    names a topic they finished and how long ago, and the
 *                    page prints the five dates it needed to come back on,
 *                    marking the ones already missed. No signup, no network
 *                    call — the dates are computed in the browser from the
 *                    1/3/7/14/28 spacing the app really uses.
 *   2  WHY         — why it keeps happening (v189, founder instruction
 *                    2026-09-27): the memory diagram (now carrying the METHOD
 *                    the system hands you at every review point), the
 *                    method's public credentials — Active Recall + Spaced
 *                    Repetition — as trust badges, and the argument that
 *                    knowing the method is not the same as executing it.
 *   3  DAILY PLAN  — how the system works: the Today screen you actually
 *                    open, what each task is doing for you, reasons that name
 *                    the method (not just the timing), and the 12-month pain
 *                    line.
 *   4  METHOD      — active recall as the core mechanic beside the animated
 *                    spaced-repetition explainer. The hand-written rules are
 *                    the differentiator: the AI makes it faster, the rules
 *                    make it smarter.
 *   5  MEMORY      — the compounding loop, drawn as three filling rails.
 *   6  ANALYSIS    — ONE test-analysis section (v189 removed the duplicate):
 *                    the founder's screen recording, larger and on the left,
 *                    beside the claim. It plays muted with NO sound control
 *                    (founder instruction).
 *   7  FOUNDER     — a small human story. The attribution is 'Founder ·
 *                    Active NEET 2026 Aspirant' and NEVER a real name.
 *   8  FAQ         — the objections, as an accordion: one answer open at a
 *                    time instead of the old wall of text.
 *   9  PRICE       — at the absolute bottom, just above the footer: one
 *                    mount, tabs for India / International with only the
 *                    active market prominent, the founder's own note above
 *                    the cards, and the concierge note on International only.
 *
 * Three QUOTABLE CALLOUTS sit between the bands (after WHY, after the daily
 * plan, before ANALYSIS), and a JOIN band sits between the FAQ and the
 * price: one "I Want to Join" button that opens a pre-filled mailto: to the
 * founder — no form, no inputs, no server call.
 *
 * This file owns marketing markup only. Opening the sign-in panel and the
 * legal modals arrive as callbacks; auth, OTP, checkout and geo all stay in
 * useEmailGateController, and every CTA on every regional page calls the same
 * openLogin().
 */

interface LandingPageProps {
  t: LandingTokens;
  /** The space this page belongs to — the funnel events are posted against
   *  it, so a CTA tap lands in the same analytics as the capture it leads to. */
  spaceId: string;
  /** Everything market-specific on the page. */
  region: RegionConfig;
  /** EmailGate's theme-aware logo block, so the mark never diverges. */
  BrandMark: ComponentType<{ size?: number; blockColor?: string; radiusScale?: number }>;
  /** True once the visitor has scrolled past the hero — solidifies the nav. */
  scrolled: boolean;
  /** The one CTA behaviour on the page: open the existing sign-in / sign-up. */
  openLogin: () => void;
  /** Legacy — gated the mobile sticky CTA, which was removed entirely
   *  (founder instruction, 2026-09-30). Kept optional so callers that still
   *  pass it stay valid. */
  overlayOpen?: boolean;
  onOpenLegal: (doc: 'privacy' | 'terms') => void;
  supportEmail: string;
  legalLinkStyle: CSSProperties;
  navLinkStyle: CSSProperties;
}

/**
 * The quick-scroll section links in the navbar. They SCROLL rather than link:
 * this page lives inside a hash-routed shell (see StaticPages and
 * landingRegions), so writing `#how-it-works` into location.hash would push a
 * route the router then has to ignore. Hidden on mobile — the page has no
 * hamburger, and every section is one swipe away. The Learn link is the one
 * exception: it is a real route, so it stays visible at every width.
 */
const NAV_SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'problem', label: 'Why you forget' },
  { id: 'scheduling', label: 'How it works' },
  { id: 'system', label: 'The system' },
  { id: 'final-cta', label: 'Price' },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * REAL PHOTOGRAPHY — brand-level assets, so they live here rather than in the
 * region config. AS OF 2026-09-27 NONE OF THESE RENDER: the problem-band
 * planner photo was replaced by the drawn memory diagram
 * (LandingForgettingDiagram) and the phone-in-hand Today photo was removed
 * from the features band (founder instruction). Kept, unreferenced, like
 * LANDING_SHOTS below, in case the founder wants them back.
 *
 * RENDER CLEAN: never place a gradient, colour wash or tint layer OVER an
 * image. The band washes belong on SECTION BACKGROUNDS only.
 */
const LANDING_PHOTOS = {
  hero: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/91b99f21-ea7c-48bc-801e-812da0a4208e.png',
  problem: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/4a915844-2c68-49ee-be4d-a602792b1dfc.png',
  clarity: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/babc04b6-6fd5-4ff5-8bcd-028e62710d95.png',
  proof: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/7e356d20-6d2b-4ca6-b2f6-f195bd98e49a.png',
} as const;

/**
 * REAL APP SCREENSHOTS — CURRENTLY UNUSED (founder instruction, 2026-09-05:
 * the page renders the markup MOCKUPS from LandingAppMockups, not
 * screenshots). Kept, unreferenced, in case the founder wants them back.
 */
const LANDING_SHOTS = {
  analysisOverview: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/1b54bd14-5862-4ca4-bc8d-c90684ba5aa1.png',
  errorBreakdown: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/4605e911-0fd4-497f-824d-71593373ef4d.png',
  topicsCost: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/b509f700-2880-4329-942e-4d7a0766927a.png',
  taggingDone: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/3398adfd-dc0e-4f8f-ab7c-68abcd0155d1.png',
  questionList: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/085390cd-2020-4a8f-b484-577a26dfdc41.png',
  boxDetection: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/f87295f9-e7f3-4d2f-b547-f1112411c819.png',
  boxConfirm: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/e2f25298-1d3d-48e7-b995-5ecfe26d30f2.png',
  paperPages: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/5d125aff-92d4-4995-baa6-40796d5e9aaf.png',
  tagExpanded: 'https://storage.googleapis.com/audos-images/attachments/696f81c1-6527-4d7a-b358-80932a69811d/ac16efb5-331d-4ceb-a9dc-03753bd39214.png',
  mistakeBook: 'https://storage.googleapis.com/audos-images/attachments/general/bf1dc6d8-9bfe-4ec6-a6be-bb1549063764.png',
  calendar: 'https://storage.googleapis.com/audos-images/attachments/general/72ef6911-5afd-4354-9ec1-334ee430479c.png',
  todayList: 'https://storage.googleapis.com/audos-images/attachments/general/ce9cb19c-6f64-46e8-a262-6eb9b23211e3.png',
  todayGlance: 'https://storage.googleapis.com/audos-images/attachments/general/fb9d8f86-f3df-46e3-a4d5-8aaf009650c4.png',
} as const;

/** The Test Analysis demo video (founder instruction, 2026-09-05) — a real
 *  screen recording of the app analysing a logged paper. Muted, looped,
 *  inline: a living screenshot. */
const TEST_ANALYSIS_VIDEO =
  'https://storage.googleapis.com/audos-images/attachments/general/44b9116c-15f5-4270-a477-e51d4ac855f7.mp4';

/** The ink bezel a screen recording sits inside, matching the phone frames. */
const DEVICE_FRAME_STYLE: CSSProperties = {
  borderRadius: 18,
  padding: 9,
  background: 'linear-gradient(165deg, #10101A, #1B1B27)',
  border: '1.5px solid rgba(255, 255, 255, 0.14)',
  boxShadow: '0 22px 44px rgba(0, 0, 0, 0.6)',
};

const DEVICE_SCREEN_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  borderRadius: 11,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backgroundColor: '#05070E',
};

/** The one treatment a photo gets on paper: a hairline rule, square-ish
 *  corners and a caption underneath. Nothing layered on top of the image.
 *  Unused since 2026-09-27 (no photo renders) — kept with the photos above. */
const PLATE_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  objectFit: 'cover',
  borderRadius: 4,
  border: `1px solid ${PAPER_RULE}`,
  backgroundColor: PAPER_SUNK,
};

/** A tiny inline-SVG line icon, tinted to match the page ink, for the
 *  HeroDemo form fields — drawn as a CSS background-image so the icon needs
 *  no extra markup or dependency. */
function demoFieldIcon(paths: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${PAPER_INK_SOFT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  )}`;
}
/** The topic field's icon — an open book. */
const ICON_TOPIC = demoFieldIcon(
  '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v18H5.5A1.5 1.5 0 0 1 4 19.5v-15z"/><path d="M12 3h6.5A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5H12"/>',
);
/** The "how long ago" field's icon — a calendar. */
const ICON_CALENDAR = demoFieldIcon(
  '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
);

/**
 * THE HERO TRUST LINE (2026-09-27).
 *
 * This printed the VISIT count — “1,780+ students came here last month” —
 * which is the weakest true number the workspace has: it says people arrived,
 * not that a single one of them stayed. Workspace analytics records 475
 * unique students who have actually started an account, so that is what the
 * line says now. Both figures are real; only one of them is proof.
 *
 * Update it here when the number is refreshed, and never round it up.
 */
const HERO_STUDENT_COUNT = '485';

/**
 * THE FOUNDER TRUST BADGE (founder instruction, 2026-09-30) — printed in the
 * hero on EVERY regional route, directly under the '2 Days Only' promo
 * strip. Personal and relatable, never a brag stat: the founder LIVED this
 * exact problem, and that is the whole message.
 */
const JOIN_MAILTO =
  'mailto:grohan24102004@gmail.com?subject=I%20Want%20to%20Join%20VicharakAI&body=Hi%2C%20I%20want%20to%20join%20VicharakAI%20early%20access.';

/**
 * THE CLAIM MAILTO (founder instruction, 2026-09-30) — the promo strip's
 * "Claim my spot" button opens the visitor's own mail app with a pre-filled
 * message to the founder. No sign-in, no redirect, no auto-send: only a
 * student who deliberately hits Send in their mail client ever reaches the
 * founder.
 */
const CLAIM_MAILTO =
  'mailto:grohan24102004@gmail.com?subject=PW%20Student%20Claim&body=Hi%2C%20I%20am%20a%20current%20PW%20student%20and%20I%20want%20to%20claim%20my%20spot%20on%20VicharakAI.';

const FOUNDER_TRUST_BADGE: Record<string, string> = {
  in:
    'Built by someone who lived this exact struggle. NEET 90 percentile, self-study, online batches — I made VicharakAI because I needed it myself.',
  us:
    'Built by someone who lived this exact struggle. NEET 90 percentile, self-study, online batches — I made VicharakAI because I needed it myself.',
  uk:
    'Built by someone who lived this exact struggle. NEET 90 percentile, self-study, online batches — I made VicharakAI because I needed it myself.',
  global:
    'Built by someone who lived this exact struggle. NEET 90 percentile, self-study, online batches — I made VicharakAI because I needed it myself.',
};

/**
 * THE CORE FEATURE SHOWCASE (founder instruction, 2026-09-30) — the four
 * pillars, one line each, rendered as premium dark cards with electric-blue
 * accents in a band directly under the hero.
 */
const CORE_FEATURES: Array<{ title: string; brief: string; Icon: typeof LineChart }> = [
  {
    title: 'Test Analysis',
    brief: 'Wrong questions become revision cards. Find the WHY behind every mistake.',
    Icon: LineChart,
  },
  {
    title: 'Beat Forgetting',
    brief: 'Spaced revision that tells you exactly what to review today.',
    Icon: CalendarClock,
  },
  {
    title: 'Vicharee AI Coach',
    brief: 'Daily personalised targets based on your actual pace and weak topics.',
    Icon: Sparkles,
  },
  {
    title: 'Am I On Track?',
    brief: 'Nightly signal: on track, behind, or at risk — so you course-correct early.',
    Icon: Gauge,
  },
];

/**
 * EXAM-SPECIFIC PAIN POINTS (founder instruction, 2026-09-28).
 *
 * Tapping an exam chip in the hero now answers "why does MY exam need this?"
 * in one sentence, printed in a card that slides in under the row. The six
 * exams the founder wrote lines for carry them verbatim; every other chip
 * (CLAT, SSC, MPSC, GATE, Boards, and the non-Indian routes' exams) falls
 * back to the massive-syllabus line, so no pill ever answers with silence.
 */
const EXAM_PAIN: Record<string, string> = {
  JEE: 'You’ve covered Mechanics 3 times but still fumble in JEE mocks. Revision without tracking is revision wasted.',
  NEET: 'Biology has 97 chapters. You can’t revise all of them the night before. VicharakAI tells you which 12 matter most right now.',
  'NEET PG':
    'Clinical cases pile up faster than you can revise. AI spots which topics are fading before your next exam catches it.',
  UPSC: 'Current affairs change daily but your notes don’t track what you’ve actually retained. VicharakAI builds your retention map.',
  CAT: 'You solve 100 quant questions but don’t know which mistake pattern keeps repeating. AI finds the pattern.',
  INICET: 'Ward rounds + studying = zero time. VicharakAI fits revision into the gaps you actually have.',
};
const EXAM_PAIN_GENERIC =
  'Massive syllabus, limited time. VicharakAI picks what you study TODAY based on what you’ve already covered.';
function examPainLine(exam: string): string {
  return EXAM_PAIN[exam] ?? EXAM_PAIN_GENERIC;
}

/**
 * THE WHY-SECTION ARGUMENT (founder instruction, 2026-09-27 v189).
 *
 * The method is public knowledge — every topper, every memory researcher and
 * every top AI names the same two techniques. The section says so out loud,
 * because the product's claim is not a secret method: it is EXECUTION. The
 * copy is region-neutral (the vocabulary differences never touch it), so it
 * lives here rather than in the region config.
 *
 * BANNED VOCABULARY: never “forgetting curve” — say “beat forgetting” or
 * “short-term to long-term memory” (founder rule).
 */
/** THE YOUTUBE PROOF LINK (founder instruction, 2026-09-27): “search
 *  YouTube” in the WHY section is a REAL search, pre-filled with the exact
 *  question a sceptical aspirant would type — the claim is checkable in one
 *  tap instead of being an unverifiable sentence. */
const YOUTUBE_SEARCH_URL =
  'https://www.youtube.com/results?search_query=is+spaced+repetition+the+best+way+to+study';

const WHY_METHOD = {
  badgeLead: 'Recommended by',
  // PEOPLE, not AIs (founder instruction, 2026-09-27): the pills carry the
  // humans who actually vouch for the method — the AI names stay in the
  // paragraph above, as the thing a sceptic can go and ask.
  badges: ['Academic rankers', 'Doctors', 'IAS officers', 'Memory researchers', 'and more'],
  execution:
    'The method isn’t the problem. Everyone knows it. The problem is executing it — consistently, across 12 months of preparation, with 3 new chapters landing every day.',
  close:
    'VicharakAI doesn’t give you theory. It gives you the system that performs it for you automatically. Stop listening. Start performing.',
} as const;

/** THE QUOTABLE CALLOUTS (founder instruction, 2026-09-27 v189) — three pull
 *  quotes placed between sections: large italic type, a blue left rule,
 *  centred on the page. */
const CALLOUT_AFTER_WHY =
  'The method is Active Recall + Spaced Repetition. Every topper uses it. VicharakAI makes you actually do it.';
const CALLOUT_AFTER_PLAN =
  'One month in, I realized I couldn’t remember half of month one. VicharakAI would have caught it on day 8.';
const CALLOUT_BEFORE_ANALYSIS =
  'Your score doesn’t lie. But it only tells you after the exam. VicharakAI tells you before.';

/** One pull-quote callout between sections. No band rule — it floats. */
function QuoteCallout({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <section
      className="lp4-section"
      data-testid={testId}
      style={{
        background: 'radial-gradient(42rem 16rem at 50% 50%, rgba(0, 87, 255, 0.09), transparent 72%)',
      }}
    >
      <div className="lp4-sheet">
        <div className="lp4-inner lp4-inner-tight" data-reveal="">
          <blockquote className="lp4-callout">{children}</blockquote>
        </div>
      </div>
    </section>
  );
}

/**
 * THE METHOD SECTION (founder instruction, 2026-09-27 v189) — active recall
 * as the core mechanic, and the hand-written rules behind the AI.
 */
const METHOD_COPY = {
  heading: 'Not arbitrary revision. The right method, for the right topic, at the right moment.',
  paragraphs: [
    'For theory: VicharakAI doesn’t say “revise Acid–Base Equilibria.” It says: take a blank page, write everything you remember, then check. That’s active recall — the method every study researcher agrees beats re-reading.',
    'For questions: practice. For formulas: recall cards. The backend decides which method fits which topic.',
    'This isn’t just AI generating a to-do list. It’s a system built by a student who lived this problem — with hand-written rules for when active recall beats re-reading, when to push a topic forward and when to pull it back. The AI makes it 10x faster. The rules make it 10x smarter.',
  ],
  pills: ['Active Recall for theory', 'Practice for questions', 'Smart method selection'],
} as const;

/** The pain-point line under the daily-plan features (founder copy, v189). */
const PLAN_PAIN_COPY =
  'One day consistent? Great. Five days? Even better. But prep is a 12-month journey. After one month, you’d need an hour just to figure out what to revise. After three months — a whole afternoon. VicharakAI does it in 30 seconds, every morning.';

/**
 * THE V2 SHOWCASE COPY (founder instruction, 2026-09-29) — the three bands
 * straight after the hero that SHOW the rebuilt app: the Vicharee mood
 * check-in that opens every session, the Vision Board map, and the
 * chat-first daily plan. The animated mockups themselves live in
 * components/LandingV2Showcase.tsx; only the headings run through tr(),
 * body copy stays English (founder rule).
 */
const CONSEQUENCES = [
  {
    exam: 'JEE',
    line: 'You finish the syllabus. Mock test: 43%. You realise you forgot 70% of what you studied.',
  },
  {
    exam: 'NEET',
    line: "You study 8 hours every day. By month 3, you can't tell what stuck and what didn't.",
  },
  {
    exam: 'UPSC',
    line: "Everyone in your batch is revising. You don't know what to revise.",
  },
  {
    exam: 'ONE ATTEMPT',
    line: "One year. One attempt. One gap you didn't know about.",
  },
] as const;

const WEAK_SPOT_FLOW = ['Test analysis', 'Vicharee spots the gap', 'Revision scheduled automatically'] as const;

const V2_SHOWCASE = {
  vicharee: {
    heading: 'Meet Vicharee. Every session starts with you.',
    lede: 'Open the app and your AI coach checks in before anything else. Energetic, regular, or down — the day’s plan adjusts to match, so you never stare at a schedule you can’t face.',
    caption: 'The mood check-in that opens every session — the plan adapts to your answer.',
    beats: [
      {
        title: 'A coach, not a dashboard',
        brief: 'Vicharee greets you by name, asks how you are, and builds the day around your answer.',
      },
      {
        title: 'Low days still count',
        brief: 'Feeling down? The plan shrinks to what you can actually finish — the streak survives the bad days.',
      },
      {
        title: 'High days go further',
        brief: 'Full of energy? Vicharee adds the harder recall work while you can take it.',
      },
    ],
  },
  vision: {
    heading: 'See your whole prep as a map to your dream.',
    lede: 'The Vision Board turns your syllabus into a living map. Every topic is a node showing how complete it is and how accurate you are — all connected to the one goal you wrote on day one.',
    caption: 'The Vision Board — every topic a node, your dream goal at the summit.',
    beats: [
      {
        title: 'Every topic, one glance',
        brief: 'Completion and accuracy sit on each node, so “where am I weak?” takes seconds, not a spreadsheet.',
      },
      {
        title: 'Progress you can watch move',
        brief: 'Nodes fill as you study and revise — the map lights up toward your goal.',
      },
      {
        title: 'The dream stays on screen',
        brief: 'AIIMS, IIT, your target — written on day one, pinned above every topic you clear.',
      },
    ],
  },
  chat: {
    heading: 'No dashboards to dig through. Vicharee just tells you.',
    lede: 'Targets arrive as a message the moment you open the app. The Today tab updates itself. And when a question blocks you, you send a photo of the doubt right in the chat.',
    caption: 'Chat-first: targets, follow-ups and doubt photos in one thread.',
    beats: [
      {
        title: 'Proactive, not passive',
        brief: 'Vicharee messages first — today’s targets, why each one matters, and how long each takes.',
      },
      {
        title: 'The Today tab keeps itself',
        brief: 'Finish or reshuffle in chat and the tab updates on its own. Nothing to maintain.',
      },
      {
        title: 'Doubts die in the chat',
        brief: 'Snap the question, send it, and the fix folds into today’s plan.',
      },
    ],
  },
} as const;

/**
 * THE FOUNDER STORY (founder instruction, 2026-09-27 v189) — a small human
 * section before the FAQ. NO REAL NAME anywhere on the page: the attribution
 * is “Founder · Active NEET 2026 Aspirant” and nothing else (founder rule).
 */
const FOUNDER_STORY = {
  heading: 'Built by an aspirant who lived the gap.',
  paragraphs: [
    'The founder scored 420 in NEET 2026 — and still could not see what to revise before the gaps showed up in a mock. Studying hard was not the missing piece. Knowing what had actually stuck was.',
    'VicharakAI began as the system the founder needed personally: remember every topic, expose weak spots early, and schedule the next revision before another paper finds the gap first.',
  ],
  attribution: 'The founder · NEET 2026 aspirant',
} as const;

/** The founder's own note above the pricing cards (founder copy, v189). */
const PRICING_NOTE =
  'I would’ve kept this free. Honestly. But VicharakAI uses AI on every session, and AI costs money — even for a solo dev who built this while preparing for the same exam. ₹149/month is less than a week of chai. That’s all I’m asking.';

/**
 * THE JOIN SECTION (founder instruction, 2026-09-30) — no form, no inputs,
 * no email capture. One prominent primary CTA that opens the visitor's own
 * mail app with a pre-filled "I want to join" message to the founder.
 */
function ContactSection() {
  return (
    <div className="lp4-contact" data-testid="contact-join">
      <a className="lp4-btn lp4-btn-primary" href={JOIN_MAILTO} data-testid="button-join">
        I Want to Join
        <span className="lp4-btn-arrow" aria-hidden="true">→</span>
      </a>
    </div>
  );
}

/** The five days a topic has to come back on. Same spacing the app runs —
 *  TOPIC_REVISION_INTERVALS in apps/VicharakAI/config/revision.ts. The page
 *  printed 30 for the last rung until 2026-09-27 while the product scheduled
 *  28, so a student who signed up got a different date from the one the demo
 *  had just promised them. Never let these two drift apart. */
const REVISION_OFFSETS = [1, 3, 7, 14, 28];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The marginal label that sits in the register's gutter. */
function Marginal({ children }: { children: ReactNode }) {
  return <p className="lp4-marginal">{children}</p>;
}

/**
 * One band of the sheet: a hairline rule across the top, an optional wash
 * lighting it from a corner, and the content indented past the margin rule.
 *
 * Every band's content carries [data-reveal] (founder instruction,
 * 2026-09-27): it fades up as it enters the viewport, via the observer
 * useEmailGateController already runs against .eg-root — the page's real
 * scroll container. The CSS (and its prefers-reduced-motion stand-down)
 * lives in EmailGateLanding.tsx. The hero is not a Band and has its own
 * staggered load-in instead (see the motion block below).
 */
function Band({
  id,
  testId,
  marginal,
  wash = 'none',
  tight = false,
  children,
}: {
  id?: string;
  testId?: string;
  marginal?: string;
  wash?: 'none' | 'blue' | 'warm';
  tight?: boolean;
  children: ReactNode;
}) {
  const background =
    wash === 'blue' ? PAPER_G_WASH : wash === 'warm' ? PAPER_G_WASH_WARM : undefined;
  return (
    <section id={id} data-testid={testId} className="lp4-section" style={{ background, scrollMarginTop: 68 }}>
      <div className="lp4-band-glow" aria-hidden="true" />
      <div className="lp4-sheet">
        <div className="lp4-rule" aria-hidden="true" />
        <div className={tight ? 'lp4-inner lp4-inner-tight' : 'lp4-inner'} data-reveal="">
          {marginal ? <Marginal>{marginal}</Marginal> : null}
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * THE HERO DEMO — the interactive moment at the top of the page.
 *
 * Everything happens in the browser: the visitor names a topic they have
 * already finished and roughly when they studied it, and the five dates it
 * needed to come back on are printed with the missed ones struck in red. No
 * account, no network call, and no claim the product cannot keep — the
 * spacing is the same 1/3/7/14/30 the app actually schedules on.
 */
function HeroDemo({
  region,
  exam,
  onRun,
}: {
  region: RegionConfig;
  exam: string;
  /** Reported once the visitor actually runs it — the strongest pre-signup
   *  intent signal on the page, and worth telling apart from a CTA tap. */
  onRun: () => void;
}) {
  const copy = region.demo;
  const [item, setItem] = useState(region.mockups.rows[region.mockups.rows.length - 1].topic);
  const [ago, setAgo] = useState(String(copy.options[2]?.days ?? 30));
  const [shown, setShown] = useState(false);

  const label = item.trim() || copy.itemLabel;
  const today = startOfToday();
  const start = new Date(today);
  start.setDate(start.getDate() - Number(ago));

  const rows = REVISION_OFFSETS.map((offset, index) => {
    const due = new Date(start);
    due.setDate(due.getDate() + offset);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    const state = diff < 0 ? 'missed' : diff === 0 ? 'due' : 'ahead';
    const tag = diff < 0 ? 'missed' : diff === 0 ? 'due today' : `in ${diff} day${diff === 1 ? '' : 's'}`;
    return { key: offset, when: formatDay(due), what: `${copy.rowLabel} ${index + 1}`, tag, state };
  });
  const missed = rows.filter((row) => row.state === 'missed').length;

  return (
    <div className="lp4-demo" data-testid="demo-revision-dates">
      <div className="lp4-demo-top">
        <h3 className="lp4-demo-h">{copy.heading}</h3>
        {/* The exam chips are not decoration — the one you pick is named here. */}
        <span className="lp4-demo-badge" data-testid="demo-exam-badge">
          {exam}
        </span>
      </div>
      <p className="lp4-demo-hint">{copy.hint}</p>

      <div className="lp4-demo-fields">
        <label className="lp4-field">
          <span>{copy.itemLabel}</span>
          <input
            type="text"
            value={item}
            onChange={(event) => setItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setShown(true);
            }}
            autoComplete="off"
            spellCheck={false}
            data-testid="input-demo-topic"
          />
        </label>

        <label className="lp4-field lp4-select">
          <span>{copy.whenLabel}</span>
          <select value={ago} onChange={(event) => setAgo(event.target.value)} data-testid="select-demo-when">
            {copy.options.map((option) => (
              <option key={option.days} value={String(option.days)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="lp4-btn"
        onClick={() => {
          onRun();
          setShown(true);
        }}
        data-testid="button-demo-run"
      >
        {copy.cta}
        <span className="lp4-btn-arrow" aria-hidden="true">
          →
        </span>
      </button>

      {shown ? (
        <div className="lp4-demo-out" data-testid="demo-output">
          <p className="lp4-demo-head">{copy.resultLead.replace('{item}', label)}</p>
          <ul className="lp4-sched">
            {rows.map((row, index) => (
              <li key={row.key} className={`lp4-sched-${row.state}`} style={{ animationDelay: `${index * 45}ms` }}>
                <span className="lp4-when">{row.when}</span>
                <span className="lp4-what">{row.what}</span>
                <span className="lp4-tag">{row.tag}</span>
              </li>
            ))}
          </ul>
          <p className={missed === 0 ? 'lp4-verdict lp4-verdict-ok' : 'lp4-verdict'}>
            {missed === 0
              ? copy.onTrack
              : copy.missed
                  .replace('{n}', String(missed))
                  .replace('{revisions}', `${region.terms.revision}s`)
                  .replace('{item}', label)}
            <small>{missed === 0 ? copy.onTrackNote : copy.missedNote}</small>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * THE DECAY STRIPS ARE GONE (founder instruction, 2026-09-27 — cut what the
 * page already says). Two six-cell week strips drew the same argument as the
 * memory diagram standing next to them: one topic left alone against the same
 * topic revised on schedule. The band therefore made one point twice and cost
 * a phone reader an extra screen to read it.
 *
 * The diagram (components/LandingForgettingDiagram.tsx) keeps the argument,
 * now full width. PAPER_DECAY_STEPS stays exported in landingTokens, and
 * region.problem.weeksKey — the sentence under the strips — stays in the
 * config, unrendered, like every other retired copy block.
 */

function MidPageCTA({
  onClick,
  testId,
  heading = 'Ready to stop forgetting?',
  cta = TRIAL_CTA,
}: {
  onClick: () => void;
  testId: string;
  heading?: string;
  cta?: string;
}) {
  return (
    <section className="lp4-mid-cta" data-testid={testId}>
      <div className="lp4-sheet">
        <div className="lp4-mid-cta-inner" data-reveal="">
          <h2>{heading}</h2>
          <button type="button" className="lp4-btn lp4-btn-primary" onClick={onClick}>
            {cta}
            <span className="lp4-btn-arrow" aria-hidden="true">
              →
            </span>
          </button>
          {/* The reassurance travels WITH the button. A visitor meeting this
              CTA scrolled past the hero offer pill several screens ago. */}
          <p className="lp4-reassure" style={{ margin: 0 }}>
            {TRIAL_DAYS} days free · No credit card needed to start · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}

/** How full the band reads at each stage of the memory loop. The point is
 *  made by the widths before a word is read: it is worth more in week twelve
 *  than in week one. */
const MEMORY_FILL = ['34%', '68%', '100%'];

/**
 * THE COMPOUNDING MEMORY LOOP — three stages of one student's use, drawn as
 * three filling rails. This is the claim the page never made: every incumbent
 * hands all of its students the same plan, while this one has only ever seen
 * yours. Markup and CSS only, like the rest of the sheet — no image, no
 * library, no new bytes.
 */
function MemoryLoop({ memory }: { memory: RegionMemory }) {
  return (
    <ol className="lp4-loop" data-testid="list-memory-loop">
      {memory.steps.map((step, index) => (
        <li key={step.when} data-testid={`card-memory-${index + 1}`}>
          <p className="lp4-loop-when">{step.when}</p>
          <span className="lp4-loop-track" aria-hidden="true">
            <i style={{ width: MEMORY_FILL[index] }} />
          </span>
          <h3>{step.title}</h3>
          <p className="lp4-loop-text">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * THE COUNT-UP STAT (founder instruction, 2026-09-27). The hero's one real
 * number counts up from zero the first time it scrolls into view. Plain
 * requestAnimationFrame — no library — and the span reserves the finished
 * width (tabular numerals + min-width) so the count never shifts the line it
 * sits on. Under prefers-reduced-motion, or without IntersectionObserver,
 * the final figure simply renders.
 */
function StatCount({ value, duration = 1300 }: { value: string; duration?: number }) {
  const match = value.match(/\d+/);
  const target = match ? parseInt(match[0], 10) : 0;
  const prefix = match ? value.slice(0, match.index ?? 0) : value;
  const suffix = match ? value.slice((match.index ?? 0) + match[0].length) : '';
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || target <= 0) return;
    let frame = 0;
    const run = () => {
      if (started.current) return;
      started.current = true;
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setShown(target);
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        // Decelerating: fast through the small numbers, settling on the real one.
        setShown(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === 'undefined') {
      run();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        run();
        observer.disconnect();
      },
      { root: node.closest('.eg-root'), threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-block',
        minWidth: `${String(target).length}ch`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}

/**
 * THE FAQ, AS AN ACCORDION (founder instruction, 2026-09-27).
 *
 * The objections band printed every question with its answer already open, so
 * a visitor met a wall of body text and scrolled past all of it. One panel is
 * open at a time now: the question is the control, the chevron says it opens,
 * and the answer grows to its own height rather than appearing. The first
 * question opens on load so the band never reads as an empty list of links.
 */
function FaqAccordion({ items }: { items: Array<{ q: string; a: string }> }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="lp4-faq" data-testid="list-faq">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `lp4-faq-panel-${index}`;
        const buttonId = `lp4-faq-button-${index}`;
        return (
          <div
            key={item.q}
            className="lp4-faq-item"
            data-open={isOpen ? 'true' : 'false'}
            data-testid={`faq-${index + 1}`}
          >
            <h3>
              <button
                id={buttonId}
                type="button"
                className="lp4-faq-q"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                data-testid={`button-faq-${index + 1}`}
              >
                <span>{item.q}</span>
                <span className="lp4-faq-icon">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
            </h3>
            <div className="lp4-faq-a" id={panelId} role="region" aria-labelledby={buttonId}>
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* The FeatPoints tick list and the AccuracyCard / MistakeBookCard showcases
   were REMOVED in v189 (founder instruction, 2026-09-27): the page carries
   exactly ONE analysis section — the screen recording — and the mistake-book
   claim lives inside the daily-plan band's copy. */

/**
 * THE TEST-ANALYSIS DEMO VIDEO (founder instruction, 2026-09-27 v189: the
 * sound control is REMOVED — no audio button of any kind). The recording
 * autoplays muted, loops inline and reads as a living screenshot, exactly
 * like the drawn mockups around it.
 */
function TestAnalysisVideo({ label }: { label: string }) {
  return (
    <div className="lp4-vid" style={DEVICE_FRAME_STYLE}>
      <video
        src={TEST_ANALYSIS_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        style={DEVICE_SCREEN_STYLE}
        data-testid="video-test-analysis-player"
      />
    </div>
  );
}

/**
 * THE PRICE, PRINTED TWICE (founder instruction, 2026-09-27).
 *
 * One definition, two mount points: once mid-page, as soon as the hero has
 * made its promise, and again immediately above the closing ask. A visitor who
 * scrolls past the first still meets the price before the last button.
 *
 * BOTH MARKETS ARE ON THE PAGE. The route already knows which one the visitor
 * is in, so that tab opens selected — but the ads do send Indian students to
 * /global and US students to /in, and a price they cannot be charged is worse
 * than a tab they have to tap. The figures come from PLAN_PRICE_INR /
 * PLAN_PRICE_USD, the same constants Razorpay and Creem are driven from, so no
 * amount is typed into this component.
 *
 * NOTHING HERE STARTS A CHECKOUT. Both CTAs open the same sign-up, stamped
 * with the subscription intent, and the charge stays on the existing routing:
 * an Indian exam bills in rupees through Razorpay, an international exam in
 * dollars through Creem.
 */
const PRICE_MARKETS = [
  {
    key: 'in' as const,
    tab: 'India',
    price: PLAN_PRICE_INR.monthly,
    note: 'Less than a week of chai — for a whole month of planned revision.',
    rail: 'Billed in ₹ (INR) through Razorpay — UPI, cards and wallets.',
  },
  {
    key: 'intl' as const,
    tab: 'International',
    price: PLAN_PRICE_USD.monthly,
    note: 'Less than one hour with a tutor, for a whole month of prep.',
    rail: 'Billed in $ (USD) through Creem — secure international card checkout.',
  },
];

function PricingBlock({
  regionKey,
  heading,
  anchor,
  onStartTrial,
  onChoosePlan,
  supportEmail,
  probeRef,
  testId,
  legal,
}: {
  regionKey: string;
  /** Omit it and the block writes its own, quoting the SELECTED market's
   *  price — which is the only heading that can never contradict the cards
   *  below it. (region.pricing.heading is region-specific and quotes £ on the
   *  UK route, where these cards offer ₹ and $ only.) */
  heading?: string;
  anchor?: string;
  onStartTrial: () => void;
  onChoosePlan: () => void;
  /** The support address the International concierge note names. */
  supportEmail: string;
  /** Only the FIRST mount carries the funnel probe — one pricing view per page. */
  probeRef?: MutableRefObject<HTMLSpanElement | null>;
  testId: string;
  /** The terms / privacy / support row, printed under the first block only. */
  legal?: ReactNode;
}) {
  const [market, setMarket] = useState<'in' | 'intl'>(regionKey === 'in' ? 'in' : 'intl');
  const active = PRICE_MARKETS.find((entry) => entry.key === market) ?? PRICE_MARKETS[0];
  return (
    <>
      {probeRef ? <span ref={probeRef} className="lp4-probe" aria-hidden="true" /> : null}
      {/* THE OFFER, unmissable at the price (founder instruction, 2026-09-27):
          the no-card badge restated where the money question is decided. */}
      <p
        className="lp4-offer"
        data-testid={`${testId}-offer-badge`}
        style={{ fontSize: '0.92rem', padding: '0.42rem 0.9rem' }}
      >
        {TRIAL_DAYS} days free — no card needed
      </p>
      <h2 className="lp4-measure">
        {heading ?? `Free for ${TRIAL_DAYS} days. Then ${active.price} a month.`}
      </h2>
      {anchor ? <p className="lp4-anchor">{anchor}</p> : null}
      {/* The founder's own note — why this costs anything at all (v189). */}
      <p className="lp4-price-note" data-testid={`${testId}-founder-note`}>
        {PRICING_NOTE}
      </p>

      <div className="lp4-exams" role="tablist" aria-label="Where you are paying from" style={{ marginTop: '1.3rem' }}>
        {PRICE_MARKETS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={entry.key === market}
            className={entry.key === market ? 'lp4-exam lp4-exam-on' : 'lp4-exam'}
            onClick={() => setMarket(entry.key)}
            data-testid={`${testId}-tab-${entry.key}`}
          >
            {entry.tab}
          </button>
        ))}
      </div>

      <div className="lp4-plans">
        {/* The free trial leads — it is how every account starts. */}
        <div className="lp4-plan" data-testid={`${testId}-card-trial`}>
          <p className="lp4-plan-label">Free trial</p>
          <p className="lp4-amt">
            Free <small>for {TRIAL_DAYS} days</small>
          </p>
          <p className="lp4-who">
            The whole app — daily plan, spaced revision, AI coach and Mistake Book. No card needed.
          </p>
          <div className="lp4-plan-cta">
            <button
              type="button"
              className="lp4-btn lp4-btn-primary"
              style={{ width: '100%' }}
              onClick={onStartTrial}
              data-testid={`${testId}-button-trial`}
            >
              {TRIAL_CTA}
            </button>
          </div>
        </div>

        <div className="lp4-plan lp4-plan-lead" data-testid={`${testId}-card-monthly`}>
          <p className="lp4-plan-label">{active.tab} &middot; after the trial</p>
          <p className="lp4-amt">
            {active.price} <small>/month</small>
          </p>
          <p className="lp4-who">{active.note}</p>
          <div className="lp4-plan-cta">
            <button
              type="button"
              className="lp4-btn"
              style={{ width: '100%' }}
              onClick={onChoosePlan}
              data-testid={`${testId}-button-monthly`}
            >
              See what Premium includes
            </button>
          </div>
        </div>
      </div>

      <p className="lp4-pay" data-testid={`${testId}-rail`}>
        {active.rail} Every feature is included on every plan, and you can cancel at any time —
        the {TRIAL_DAYS}-day trial takes no card at all.
      </p>
      {/* THE CONCIERGE NOTE — International tab ONLY (founder instruction,
          2026-09-27). The India tab never shows it. */}
      {market === 'intl' ? (
        <p className="lp4-concierge" data-testid={`${testId}-concierge-note`}>
          New to this? Email us at{' '}
          <a href={`mailto:${supportEmail}`} data-testid={`${testId}-concierge-email`}>
            {supportEmail}
          </a>{' '}
          — we’ll personally set up your first week’s plan.
        </p>
      ) : null}
      {legal}
    </>
  );
}

/* The Learn teaser band was removed in v189 (founder instruction, 2026-09-27:
   the page ends WHY → PLAN → METHOD → MEMORY → ANALYSIS → FOUNDER → FAQ →
   PRICE, and nothing sits between the price and the footer). The Learn hub
   itself is untouched — the nav and the footer still link to it. */

/**
 * THE '2 DAYS ONLY' PROMO STRIP (v199, founder instruction 2026-09-30) — the
 * free 1-on-1 study-strategy offer as a LIGHT card inside the hero, directly
 * below the nav. No email field and NO sign-in: the one "Claim my spot"
 * button is a mailto link (CLAIM_MAILTO above) that opens the visitor's own
 * mail app pre-filled to the founder, and a small inline note confirms what
 * just happened. Only a visitor who deliberately hits Send ever reaches the
 * founder — no auto-send, no login, no redirect. Same dismissal as before
 * (localStorage — once dismissed it never returns in that browser).
 */
const CONCIERGE_DISMISS_KEY = 'vicharakai_free_session_banner_dismissed';

function ConciergeBanner({ onClaim }: { onClaim: () => void }) {
  const [visible, setVisible] = useState(false);
  /* True once the mailto link was tapped — shows the inline reassurance. */
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CONCIERGE_DISMISS_KEY) !== '1') setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(CONCIERGE_DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — the banner simply returns next visit */
    }
  };

  return (
    <div
      className="lp4-banner"
      role="region"
      aria-label="Free 1-on-1 study strategy session"
      data-testid="banner-free-session"
    >
      <div className="lp4-banner-wrap">
        <div className="lp4-banner-in">
          <div className="lp4-banner-copy">
            <p className="lp4-banner-headline" data-testid="text-banner-headline">
              <span className="lp4-banner-dot" aria-hidden="true" />
              2 Days Only — Free 1-on-1 Study Strategy Session
            </p>
            <p className="lp4-banner-sub">
              From a NEET aspirant who lived this exact gap · Personalised tips on studying without burnout,
              test analysis &amp; beating forgetting. Completely free.
            </p>
          </div>
          <div className="lp4-banner-form">
            {/* A real mailto anchor — the browser opens the visitor's own
                mail client. onClaim only records the tap (fire-and-forget
                analytics); it never opens the sign-in or navigates. */}
            <a
              className="lp4-banner-claim"
              href={CLAIM_MAILTO}
              onClick={() => {
                onClaim();
                setClaimed(true);
              }}
              data-testid="button-banner-claim"
            >
              Claim my spot
            </a>
            {claimed ? (
              <p className="lp4-banner-note" role="status" data-testid="text-banner-claim-note">
                Your email client will open — just hit Send and we’ll be in touch!
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="lp4-banner-x"
            onClick={dismiss}
            aria-label="Dismiss this offer"
            data-testid="button-banner-dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * THE SCROLL NARRATIVE (Otto instruction, 2026-09-30).
 *
 * The page now tells one story in nine scenes: HERO (content is everywhere)
 * → THE REAL PROBLEM (you forget) → THE REVISION GAP (when? what?) → MEET
 * VICHARAKAI → SCHEDULING → TODAY'S WORK → MISTAKES → THE COMPLETE SYSTEM →
 * FINAL CTA. Everything below reuses the existing paper tokens and the Band
 * shell — no new colours, no new fonts, and every scene fades up through the
 * same [data-reveal] observer the old bands used. The mock UI visuals are
 * styled HTML/CSS, never screenshots. The retired bands' components stay in
 * this file, unreferenced, per house convention (like LANDING_SHOTS).
 * ==================================================================== */

/** The six places content arrives from — the hero montage cycles through
 *  them (see .lps-montage). Pure CSS; static under prefers-reduced-motion. */
const MONTAGE_ITEMS = ['YouTube', 'PDFs', 'Notes', 'DPPs', 'Books', 'Tests'] as const;

function HeroMontage() {
  return (
    <div
      className="lps-montage lp4-hin lp4-hin-3"
      data-testid="hero-montage"
      aria-label="YouTube, PDFs, Notes, DPPs, Books, Tests"
    >
      {MONTAGE_ITEMS.map((item, index) => (
        <span key={item} style={{ display: 'contents' }}>
          {index > 0 ? (
            <span className="lps-montage-arrow" aria-hidden="true">
              →
            </span>
          ) : null}
          <span className="lps-montage-chip" style={{ animationDelay: `${index * 0.8}s` }}>
            {item}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Scene 2 — the decay timeline. A chapter completed on Day 1 and the memory
 *  bar fading to almost nothing by Day 30, when the test hits. */
const STORY_DECAY = [
  { day: 'Day 1', note: 'Chemical Bonding — completed', memory: 100, tag: 'Studied ✓', gone: false },
  { day: 'Day 7', note: 'No revision. Details start slipping.', memory: 62, tag: 'Fading', gone: false },
  { day: 'Day 14', note: 'You are deep in new chapters now.', memory: 34, tag: 'Fading fast', gone: false },
  { day: 'Day 30', note: 'The test hits.', memory: 12, tag: 'Gone', gone: true },
] as const;

function StoryProblem() {
  return (
    <Band id="problem" testId="section-story-problem" marginal="The problem" wash="warm">
      <h2 className="lp4-measure">You study. You move on. Then you forget.</h2>
      <div className="lps-timeline" data-testid="story-decay-timeline">
        {STORY_DECAY.map((step) => (
          <article key={step.day} className={step.gone ? 'lps-day lps-day-gone' : 'lps-day'}>
            <p className="lps-day-label">{step.day}</p>
            <p className="lps-day-topic">{step.note}</p>
            <span className="lps-mem" aria-hidden="true">
              <i style={{ width: `${step.memory}%` }} />
            </span>
            <p className="lps-day-tag">{step.tag}</p>
          </article>
        ))}
      </div>
      <p className="lp4-lede" style={{ marginTop: '2rem' }} data-testid="story-problem-body">
        You finished Chemical Bonding on Day 1. By Day 30 — when the test hits — it’s gone. Nobody told
        you to go back.
      </p>
    </Band>
  );
}

/** Scene 3 — the two questions every serious student faces, revealed one
 *  after the other (see the .lps-questions reveal CSS). */
function StoryGap() {
  return (
    <Band id="gap" testId="section-story-gap" marginal="The gap">
      <div className="lps-questions">
        <p className="lps-q">When should I revise?</p>
        <p className="lps-q">What should I revise?</p>
      </div>
      <p className="lp4-lede" style={{ marginTop: '2rem' }} data-testid="story-gap-body">
        Every serious student faces this. Most guess. Most lose marks they could have saved.
      </p>
    </Band>
  );
}

/** Scene 4 — the clean section break where VicharakAI enters: the brand mark
 *  and wordmark centred, then the one-line promise. */
function StoryMeet({
  BrandMark,
}: {
  BrandMark: ComponentType<{ size?: number; blockColor?: string; radiusScale?: number }>;
}) {
  return (
    <Band id="meet" testId="section-story-meet" wash="blue">
      <div className="lps-meet">
        <div className="lps-meet-logo" data-testid="story-meet-logo">
          <BrandMark size={52} radiusScale={0.28} blockColor="#0057FF" />
          <span className="lp4-word" style={{ fontSize: '1.6rem' }}>
            Vicharak<i>AI</i>
          </span>
        </div>
        <h2>Meet VicharakAI</h2>
        <p className="lp4-lede" style={{ margin: '1.2rem auto 0' }} data-testid="story-meet-body">
          Your AI study companion that builds your revision schedule — automatically.
        </p>
      </div>
    </Band>
  );
}

/** Scene 5 — the scheduling mock card. The revise-in slots are printed from
 *  REVISION_OFFSETS, the schedule the app actually runs — never an invented
 *  spacing (house rule: the page never promises a date the app does not keep). */
function StoryScheduling() {
  return (
    <Band id="scheduling" testId="section-story-scheduling" marginal="Scheduling">
      <h2 className="lp4-measure">Your Revision. Scheduled.</h2>
      <div className="lps-card" data-testid="story-schedule-card">
        <div className="lps-card-top">
          <p className="lps-card-title">Chemical Bonding</p>
          <span className="lps-status-done">Completed ✓</span>
        </div>
        <p className="lps-slots-label">Revise in:</p>
        <div className="lps-slots">
          {REVISION_OFFSETS.map((offset) => (
            <span key={offset} className="lps-slot">
              {offset} Day{offset === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      </div>
      <p className="lp4-lede" style={{ marginTop: '2rem' }} data-testid="story-scheduling-body">
        Add what you studied. VicharakAI figures out when you need to revisit it — before you forget it.
      </p>
    </Band>
  );
}

/** Scene 6 — the Today list, as a clean mock card. */
const STORY_TODAY_TASKS = [
  { kind: 'Revise', title: 'Chemical Bonding', meta: 'Day 7 revision — 10 minutes of recall', tag: 'Due today' },
  { kind: 'Recall', title: 'Laws of Motion', meta: 'Blank-page active recall, then check', tag: 'Due today' },
  { kind: 'Fix', title: 'Organic Chemistry — GOC', meta: 'From your Mistake Book', tag: 'Weak spot' },
  { kind: 'Practice', title: 'Thermodynamics', meta: '10 targeted questions', tag: 'Today' },
] as const;

function StoryToday() {
  return (
    <Band id="today" testId="section-story-today" marginal="Today" wash="blue">
      <h2 className="lp4-measure">Know Exactly What To Do Today.</h2>
      <div className="lps-card" data-testid="story-today-card">
        <div className="lps-card-top">
          <p className="lps-card-title">Today</p>
        </div>
        <ul className="lps-tasks">
          {STORY_TODAY_TASKS.map((task) => (
            <li key={task.title}>
              <span className="lps-task-kind">{task.kind}</span>
              <span className="lps-task-main">
                <b>{task.title}</b>
                <small>{task.meta}</small>
              </span>
              <span className="lps-task-tag">{task.tag}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="lp4-lede" style={{ marginTop: '2rem' }} data-testid="story-today-body">
        No more guessing. No more planning. Open the app, see your tasks, study.
      </p>
    </Band>
  );
}

/** Scene 7 — the mistake-to-revision flow. */
const STORY_MISTAKE_FLOW = [
  { title: 'Test question', detail: 'Q17 · Chemical Bonding', tone: 'plain' },
  { title: 'Wrong answer', detail: 'Marked ✗ in your test analysis', tone: 'wrong' },
  { title: 'Mistake Book', detail: 'Captured automatically', tone: 'plain' },
  { title: 'Scheduled', detail: 'Revision booked — until it sticks', tone: 'held' },
] as const;

function StoryMistakes() {
  return (
    <Band id="mistakes" testId="section-story-mistakes" marginal="Mistakes" wash="warm">
      <h2 className="lp4-measure">Turn Mistakes Into Revision.</h2>
      <div className="lps-mflow" data-testid="story-mistake-flow">
        {STORY_MISTAKE_FLOW.map((step) => (
          <div key={step.title} className={`lps-mstep lps-mstep-${step.tone}`}>
            <b>{step.title}</b>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>
      <p className="lp4-lede" style={{ marginTop: '2rem' }} data-testid="story-mistakes-body">
        Every wrong answer in a test becomes a revision task. Weak topics come back automatically until
        they stick.
      </p>
    </Band>
  );
}

/** Scene 8 — the whole system as one horizontal flow. */
const STORY_SYSTEM: Array<{ label: string; Icon: typeof BookOpen }> = [
  { label: 'Syllabus', Icon: BookOpen },
  { label: 'Tasks', Icon: ListChecks },
  { label: 'Revisions', Icon: CalendarClock },
  { label: 'Mistakes', Icon: XCircle },
  { label: 'Tests', Icon: FileText },
  { label: 'Progress', Icon: TrendingUp },
];

function StorySystem() {
  return (
    <Band id="system" testId="section-story-system" marginal="The system" wash="blue">
      <h2 className="lp4-measure">Your Entire Revision System. One Place.</h2>
      <div className="lps-sys" data-testid="story-system-flow">
        {STORY_SYSTEM.map(({ label, Icon }, index) => (
          <span key={label} style={{ display: 'contents' }}>
            {index > 0 ? (
              <span className="lps-sys-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <div className="lps-sys-item">
              <span className="lps-sys-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={2} />
              </span>
              <b>{label}</b>
            </div>
          </span>
        ))}
      </div>
      <p className="lp4-lede" style={{ marginTop: '2rem' }} data-testid="story-system-body">
        Track everything. Miss nothing. Know exactly where you stand.
      </p>
    </Band>
  );
}

/** Scene 9 — the final ask. Big display lines, the one CTA (same openLogin
 *  every other CTA uses), the honest price line, and the legal links that
 *  used to live under the pricing block. Carries the pricing_view probe. */
function StoryFinalCta({
  onStart,
  priceLine,
  probeRef,
  legal,
}: {
  onStart: () => void;
  priceLine: string;
  probeRef: MutableRefObject<HTMLSpanElement | null>;
  legal: ReactNode;
}) {
  return (
    <section
      id="final-cta"
      className="lp4-section"
      data-testid="section-story-final"
      style={{ background: PAPER_G_WASH, scrollMarginTop: 68 }}
    >
      <div className="lp4-sheet">
        <div className="lp4-rule" aria-hidden="true" />
        <div className="lps-final" data-reveal="">
          <span ref={probeRef} className="lp4-probe" aria-hidden="true" />
          <h2 className="lps-final-h">
            Study less randomly.
            <br />
            Revise more intentionally.
          </h2>
          <p className="lp4-lede" style={{ margin: '1.3rem auto 0' }} data-testid="story-final-sub">
            Know what to revise. Know when to revise.
          </p>
          <p style={{ margin: '1.8rem 0 0' }}>
            <button type="button" className="lp4-btn lp4-btn-primary" onClick={onStart} data-testid="button-final-cta">
              Start Your Free Trial
              <span className="lp4-btn-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </p>
          <p className="lp4-reassure" data-testid="story-final-price">
            {priceLine}
          </p>
          {legal}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({
  t,
  spaceId,
  region,
  BrandMark,
  scrolled,
  openLogin,
  onOpenLegal,
  supportEmail,
  legalLinkStyle,
  navLinkStyle,
}: LandingPageProps) {
  // Presentational only — the chips read as selectable, and the region's
  // headline exam is lit first. Picking one swaps no content in v1.
  //
  // The selection is held loosely rather than initialised from the region,
  // because switching region keeps this component mounted: a stored “JEE”
  // would survive onto /us, where no chip would then look selected.
  const [pickedExam, setPickedExam] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<string>(NAV_SECTIONS[0].id);
  // UTM MESSAGE MATCH (?exam=jee|neet|neet-pg|upsc, set by the Meta ad
  // campaigns — see landingExamMatch.ts). Read client-side once on mount;
  // an absent or unknown value leaves the page exactly as it was.
  const [examMatch, setExamMatch] = useState<ExamMatch | null>(null);
  useEffect(() => {
    setExamMatch(readExamMatch());
  }, []);

  /* Highlight the nav link for whichever section is in view (desktop). */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const root = document.querySelector('.eg-root');
    const ids = NAV_SECTIONS.map((item) => item.id);
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!elements.length) return;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (!id) continue;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId = ids[0];
        let bestRatio = -1;
        for (const id of ids) {
          const ratio = ratios.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestRatio > 0) setActiveNav(bestId);
      },
      { root, rootMargin: '-40% 0px -45% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [region.key]);

  /* ENGLISH / HINGLISH (founder instruction, 2026-09-28): the EN | हिं
     toggle in the top bar. Headlines, subheads and CTAs switch through
     tr(); body copy stays English on purpose. The choice persists in
     localStorage ('vicharakai_lang') and defaults to English. */
  const [lang, setLang] = useState<LandingLang>(() => readLandingLang());
  const pickLang = (next: LandingLang) => {
    setLang(next);
    saveLandingLang(next);
  };
  /* INDIA-ONLY (founder instruction, 2026-09-30): the toggle renders on the
     India route alone, and every other route always reads English — a saved
     'hi' preference never leaks Hinglish onto an international page. */
  const langEnabled = region.key === 'in';
  const activeLang: LandingLang = langEnabled ? lang : 'en';
  const tr = (text: string) => translateLanding(activeLang, text);

  /* LANDING PRICING → IN-APP SUBSCRIPTION (founder instruction, 2026-09-27):
     the pricing-section CTAs stamp a post-login intent before opening the
     same sign-in every other CTA uses. After auth, the app shell consumes the
     flag and routes the visitor straight to the subscription surface — an
     onboarded student gets the paywall modal; a brand-new one lands in
     onboarding, whose final step IS the plan screen. Auth itself is untouched. */
  const openPlanSignup = (location: CtaLocation) => () => {
    trackCtaClick(analytics, location);
    try {
      localStorage.setItem('vicharakai_postlogin_intent', 'subscription');
    } catch {
      /* storage unavailable — the visitor still lands in the app normally */
    }
    openLogin();
  };

  /* FUNNEL INSTRUMENTATION (2026-09-27).

     This page reported ZERO CTA clicks against 1,560 unique visitors — while
     the same analytics recorded 475 unique email captures over the period.
     Both cannot be true, and the button was never the problem: NOTHING HERE
     EVER COUNTED A CLICK. The only event the signed-out flow has ever sent is
     `lead`, fired after an email is captured, so every step before it was
     invisible and the funnel's first real leak could not be located.

     Every CTA now names itself before opening the sign-in panel. Tracking is
     fire-and-forget and cannot throw, so openLogin() runs either way. */
  const analytics: LandingEventContext = {
    spaceId,
    region: region.key,
    exam: examMatch?.slug ?? null,
  };

  const ctaHandler = (location: CtaLocation) => () => {
    trackCtaClick(analytics, location);
    openLogin();
  };

  /* Reaching the price is the step the funnel reported as a flat zero. It was
     never sent either. Observed against the page's real scroll container, and
     reported once per page view. */
  const pricingProbeRef = useRef<HTMLSpanElement | null>(null);
  const pricingSeen = useRef(false);
  useEffect(() => {
    const marker = pricingProbeRef.current;
    if (!marker || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || pricingSeen.current) return;
        pricingSeen.current = true;
        trackPricingView({ spaceId, region: region.key, exam: examMatch?.slug ?? null });
        observer.disconnect();
      },
      { root: marker.closest('.eg-root'), threshold: 0 },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [spaceId, region.key, examMatch]);

  const exams = region.exams;
  // The ad's exam lights its chip prominently; a visitor's own tap still wins.
  const matchedChip = examMatch && exams.includes(examMatch.chip) ? examMatch.chip : null;
  const activeExam =
    pickedExam && exams.includes(pickedExam) ? pickedExam : matchedChip ?? exams[0];
  /* The trust chips UNDER the hero CTA (they moved below it on 2026-09-27 —
     see the hero markup). This is the row where a student has to find their
     own exam, so it names as many as wrap onto a phone rather than a curated
     four, and the region's own “+N more” chip carries the tail. */
  const heroTrustExams = exams.slice(0, 8);
  const testAnalysis = region.testAnalysis;

  return (
    <>
      <style>{`${PAPER_FONTS_IMPORT}
        /* ---------- Signed-out landing page — v198 ----------
           FULLY LIGHT (founder instruction, 2026-09-30): warm-white body,
           light nav, light cards — and since v198 the free-session banner
           (.lp4-banner) is light too, so NO dark surface remains anywhere
           on the page. ONE accent — electric blue #0057FF. */
        .lp4 {
          position: relative;
          z-index: 0;
          background: linear-gradient(180deg, #FFFFFF 0%, #FCFBF8 38%, #F4F6FA 100%);
          color: #161F2B;
          font-family: ${PAPER_FONT_BODY};
          font-size: 17px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-wrap: break-word;
        }
        /* Media never escapes its container. */
        .lp4 img, .lp4 video { max-width: 100%; }
        /* ---- the drifting glow field (UX pass, 2026-09-27) ----
           Fixed to the viewport, painted behind the content (negative z-index
           inside .lp4's stacking context), and animated with transform only so
           it composites on the GPU — no repaints, no layout shifts, no mobile
           jank. The blue blooms are capped under 10% opacity: legibility first. */
        .lp4-atmo { display: none; }
        .lp4-atmo::before,
        .lp4-atmo::after {
          content: '';
          position: absolute;
          width: 92vmax;
          height: 92vmax;
          border-radius: 50%;
          will-change: transform;
        }
        .lp4-atmo::before {
          top: -46vmax;
          right: -30vmax;
          background: radial-gradient(circle at 50% 50%, rgba(108, 155, 255, 0.08) 0%, rgba(0, 87, 255, 0.03) 42%, transparent 68%);
        }
        .lp4-atmo::after {
          bottom: -50vmax;
          left: -32vmax;
          background: radial-gradient(circle at 50% 50%, rgba(0, 87, 255, 0.09) 0%, rgba(0, 87, 255, 0.03) 44%, transparent 70%);
        }
        @media (prefers-reduced-motion: no-preference) {
          .lp4-atmo::before { animation: lp4AtmoDrift 18s ease-in-out infinite alternate; }
          .lp4-atmo::after { animation: lp4AtmoDriftB 26s ease-in-out infinite alternate; }
          @keyframes lp4AtmoDrift {
            from { transform: translate3d(0, 0, 0) scale(1); }
            to { transform: translate3d(-16vw, 14vh, 0) scale(1.18); }
          }
          @keyframes lp4AtmoDriftB {
            from { transform: translate3d(0, 0, 0) scale(1.12); }
            to { transform: translate3d(14vw, -12vh, 0) scale(1); }
          }
        }
        .lp4 h1, .lp4 h2, .lp4 h3 {
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 800;
          letter-spacing: -0.022em;
          line-height: 1.04;
          margin: 0;
        }
        .lp4 h1 { font-size: clamp(3rem, 5.2vw, 4.5rem); }
        .lp4 h2 {
          font-size: clamp(1.75rem, 3.9vw, 2.6rem);
          line-height: 1.08;
          background-image: linear-gradient(96deg, #0B1830 0%, #0057FF 52%, #003AB0 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .lp4 h3 { font-size: 1.12rem; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
        .lp4 p { margin: 0 0 1.05em; }
        .lp4 p:last-child { margin-bottom: 0; }

        /* ---- the register sheet, with its margin rule ---- */
        /* v189: the sheet widens to ~1200px (founder instruction — the page
           read narrow). Section backgrounds are already full-bleed. */
        .lp4-section { position: relative; }
        /* THE SECTION GLOW FIELDS (v194): faint blue radial spots behind
           each band's text — decorative depth only, at 6–12% opacity,
           absolutely positioned behind the sheet with pointer-events none so
           nothing is ever covered. Alternating corners keep the page from
           repeating one spotlight. */
        .lp4-band-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(38rem 22rem at 12% 8%, rgba(108, 155, 255, 0.07), transparent 66%),
            radial-gradient(46rem 26rem at 88% 82%, rgba(0, 87, 255, 0.12), transparent 70%);
        }
        .lp4-section:nth-of-type(even) .lp4-band-glow {
          background:
            radial-gradient(40rem 24rem at 86% 6%, rgba(108, 155, 255, 0.06), transparent 64%),
            radial-gradient(44rem 26rem at 10% 86%, rgba(0, 87, 255, 0.11), transparent 70%);
        }
        .lp4-sheet { max-width: 76rem; margin: 0 auto; padding: 0 1.4rem; position: relative; }
        /* v189: each divider casts a faint blue band below it — depth
           between sections without a second hue. */
        .lp4-rule {
          height: 1px;
          background: linear-gradient(90deg, rgba(22, 31, 43, 0) 0%, rgba(22, 31, 43, 0.12) 12%, rgba(22, 31, 43, 0.12) 88%, rgba(22, 31, 43, 0) 100%);
          box-shadow: none;
        }
        /* SECTION RHYTHM (UX pass, 2026-09-27): every band breathes — 5rem
           (80px) top and bottom on desktop, so each section reads as its own
           thought and the eye rests between arguments. Phones keep a tighter
           3.5rem so a small screen never becomes a whitespace treadmill. */
        .lp4-inner { position: relative; padding: 5rem 0; }
        .lp4-inner-tight { padding: 2.5rem 0; }
        @media (max-width: 47.99rem) {
          .lp4-inner { padding: 3.5rem 0; }
          .lp4-inner-tight { padding: 1.8rem 0; }
        }
        /* The marginal label reaches for the margin rule with a short tick. */
        .lp4-marginal {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #0057FF;
          margin: 0 0 1.4rem;
        }
        .lp4-marginal::after {
          content: '';
          width: 14px;
          height: 2px;
          border-radius: 2px;
          background-image: ${PAPER_G_BRAND};
        }
        @media (min-width: 60rem) {
          .lp4-sheet { padding-left: 5.5rem; padding-right: 2.4rem; }
          /* v177's blue vertical margin rule was removed (founder request):
             the paper gutter and its marginal labels stay, the blue line goes. */
          .lp4-marginal {
            position: absolute;
            left: -5.5rem;
            width: 3.4rem;
            justify-content: flex-end;
            margin: 0;
            transform: translateY(0.5rem);
          }
        }
        .lp4-measure { max-width: 40rem; }
        .lp4-lede { font-size: 1.16rem; line-height: 1.65; color: #4A5568; max-width: 36rem; }
        .lp4-body { color: #4A5568; font-size: 1.1rem; }

        /* ---- top bar — LIGHT (v197): warm-white glass in dark ink ---- */
        .lp4-top {
          position: sticky;
          top: 0;
          z-index: 40;
          background-color: rgba(252, 251, 248, 0.94);
          border-bottom: 1px solid rgba(22, 31, 43, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .lp4-top[data-scrolled='true'] {
          box-shadow: 0 10px 28px -18px rgba(22, 31, 43, 0.25);
        }
        .lp4-top-in { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.45rem 0; }
        .lp4-brand { display: inline-flex; align-items: center; gap: 0.55rem; text-decoration: none; color: #161F2B; }
        .lp4-word { font-family: ${PAPER_FONT_DISPLAY}; font-weight: 800; font-size: 1.16rem; letter-spacing: -0.02em; }
        .lp4-word i {
          font-style: normal;
          background-image: linear-gradient(96deg, #0057FF 0%, #2F82F5 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .lp4-nav { display: flex; align-items: center; gap: 1rem; font-size: 0.875rem; }
        /* On phones the scroll shortcuts hide (every section is one swipe
           away) but the Learn link — a real route — stays. */
        .lp4-nav button { display: none; }
        /* The section links SCROLL and are buttons; the Learn link is a real
           route and so is a real anchor. Both wear the same gradient
           underline, so the row reads as one set. */
        .lp4-nav button, .lp4-nav a {
          position: relative;
          background: none;
          border: 0;
          padding: 0 0 3px;
          cursor: pointer;
          font: inherit;
          text-decoration: none;
          color: rgba(22, 31, 43, 0.55);
          transition: color 0.2s ease;
        }
        .lp4-nav button::after, .lp4-nav a::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          border-radius: 2px;
          background-image: ${PAPER_G_BRAND};
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .lp4-nav button:hover, .lp4-nav a:hover { color: rgba(22, 31, 43, 0.85); }
        .lp4-nav button.lp4-nav-on, .lp4-nav a.lp4-nav-on {
          color: #0047D6;
          font-weight: 600;
        }
        .lp4-nav button.lp4-nav-on::after, .lp4-nav a.lp4-nav-on::after { transform: scaleX(1); }
        .lp4-nav button:hover::after, .lp4-nav a:hover::after { transform: scaleX(0); }
        .lp4-nav button.lp4-nav-on:hover::after, .lp4-nav a.lp4-nav-on:hover::after { transform: scaleX(1); }
        @media (min-width: 48rem) { .lp4-nav button { display: inline-block; } }

        /* ---- buttons ---- */
        /* THE BUTTON. Not a flat rectangle: a pressed-ink key with a lit top
           edge, a shadow that belongs to the paper, an arrow that steps
           forward on hover, and a single sheen that crosses it once. */
        .lp4-btn {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-image: ${PAPER_G_BRAND};
          color: #FFFFFF;
          font-family: ${PAPER_FONT_BODY};
          font-size: 1rem;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.005em;
          padding: 0.95rem 1.6rem;
          border-radius: 7px;
          text-decoration: none;
          border: 0;
          cursor: pointer;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.26) inset,
            0 -1px 0 rgba(0, 20, 70, 0.22) inset,
            0 1px 2px rgba(16, 24, 40, 0.1),
            0 10px 22px -8px rgba(0, 87, 255, 0.55);
          transition: transform 0.16s ease, box-shadow 0.22s ease, background-image 0.22s ease;
        }
        .lp4-btn::after {
          content: '';
          position: absolute;
          top: -20%;
          bottom: -20%;
          left: -45%;
          width: 30%;
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transform: skewX(-18deg);
          opacity: 0;
          pointer-events: none;
        }
        .lp4-btn:hover {
          background-image: ${PAPER_G_BRAND_HOVER};
          transform: translateY(-1px);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.3) inset,
            0 -1px 0 rgba(0, 20, 70, 0.22) inset,
            0 2px 4px rgba(16, 24, 40, 0.1),
            0 16px 30px -10px rgba(0, 87, 255, 0.6);
        }
        .lp4-btn:hover::after { opacity: 1; animation: lp4Sheen 0.7s ease-out forwards; }
        .lp4-btn:active {
          transform: translateY(1px);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.18) inset,
            0 -1px 0 rgba(0, 20, 70, 0.28) inset,
            0 2px 6px -2px rgba(0, 87, 255, 0.5);
        }
        @keyframes lp4Sheen {
          from { transform: translateX(0) skewX(-18deg); }
          to { transform: translateX(470%) skewX(-18deg); }
        }
        .lp4-btn-arrow { display: inline-block; margin-left: 0.55rem; transition: transform 0.18s ease; }
        .lp4-btn:hover .lp4-btn-arrow { transform: translateX(3px); }
        /* THE ONE ACTION ON THE PAGE, in the brand blue (2026-09-27 — the cyan
           is gone). Every primary CTA — hero, the mid-page repeats, the trial
           plan, the close and the mobile bar — wears #0057FF with WHITE ink:
           the same blue the app and the auth screens are painted with, so the
           page and the product a visitor signs into finally match.

           #0057FF IS A DARK COLOUR. On a fill it takes white ink and clears
           contrast comfortably; as small text it would not, which is why
           nothing on this page prints it as a label — that is what the light
           tint PAPER_ACCENT_TEXT (#6C9BFF) is for. See landingTokens.ts. */
        .lp4-btn-primary {
          min-width: 240px;
          min-height: 56px;
          height: auto;
          padding: 1.1rem 2rem;
          background: ${PAPER_ACCENT};
          background-image: ${PAPER_G_ACCENT};
          color: ${PAPER_ACCENT_INK};
          border-radius: 10px;
          font-size: 17px;
          font-weight: 700;
          box-shadow:
            0 6px 26px rgba(0, 87, 255, 0.5),
            0 3px 9px rgba(0, 32, 110, 0.45),
            0 0 0 1px rgba(122, 165, 255, 0.22) inset;
          transition: transform 0.16s ease, box-shadow 0.22s ease, background-color 0.22s ease;
        }
        .lp4-btn-primary:hover {
          background: ${PAPER_ACCENT_HOVER};
          background-image: none;
          color: ${PAPER_ACCENT_INK};
          box-shadow: 0 10px 34px rgba(0, 87, 255, 0.62), 0 4px 12px rgba(0, 32, 110, 0.5);
          transform: translateY(-1px);
        }
        .lp4-btn-primary:active { background: ${PAPER_ACCENT_PRESS}; background-image: none; }
        .lp4-btn-sm { padding: 0.62rem 1.05rem; font-size: 0.9rem; border-radius: 6px; }
        .lp4 :focus-visible { outline: 2.5px solid #0057FF; outline-offset: 3px; }
        .lp4-reassure { font-size: 14px; color: #5C677A; margin: 0.7rem 0 0; }

        /* THE OFFER, stated before the headline. A visitor arriving from an ad
           must see "free, no card" without scrolling and without reading a
           word of body copy. */
        /* The 7-days-free pill (v194): electric-blue fill, white ink —
           unmissable above the headline on the light hero, and equally at
           home on the dark pricing band. */
        .lp4-offer {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin: 0 0 1rem;
          padding: 0.42rem 0.95rem;
          border-radius: 999px;
          border: 1px solid rgba(0, 87, 255, 0.55);
          background: linear-gradient(135deg, #0057FF 0%, #1A6BFF 100%);
          color: #FFFFFF;
          font-size: 0.95rem;
          font-weight: 800;
          letter-spacing: -0.005em;
          box-shadow: 0 4px 18px rgba(0, 87, 255, 0.35);
        }
        .lp4-offer::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #FFFFFF;
        }

        /* ---- core feature showcase (v194): gradient-bordered dark cards,
           electric-blue accents only ---- */
        .lp4-featshow { display: grid; grid-template-columns: 1fr; gap: 0.9rem; margin-top: 2rem; }
        @media (min-width: 48rem) { .lp4-featshow { grid-template-columns: repeat(2, 1fr); gap: 1.15rem; } }
        .lp4-featcard {
          position: relative;
          overflow: hidden;
          padding: 1.2rem 1.2rem 1.35rem;
          border-radius: 12px;
          border: 1px solid rgba(22, 31, 43, 0.1);
          background: #FFFFFF;
          box-shadow: 0 10px 28px -22px rgba(22, 31, 43, 0.28);
        }
        .lp4-featcard::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(22rem 9rem at 88% -18%, rgba(0, 87, 255, 0.18), transparent 70%);
          pointer-events: none;
        }
        .lp4-featcard-icon {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(0, 87, 255, 0.16);
          border: 1px solid rgba(108, 155, 255, 0.4);
          color: #6C9BFF;
        }
        .lp4-featcard h3 { position: relative; margin-top: 0.95rem; font-size: 1.08rem; color: #161F2B; }
        .lp4-featcard p { position: relative; margin: 0.5rem 0 0; font-size: 0.95rem; line-height: 1.55; color: #4A5568; }

        /* ---- the free-session promo strip (v198): LIGHT, like the rest
           of the page — a white card behind a blue hairline directly below
           the nav. The email field is gone; the one Claim button opens the
           normal sign-in. ---- */
        .lp4-banner {
          position: relative;
          margin: 0 0 1.5rem;
          border: 1px solid rgba(0, 87, 255, 0.28);
          border-radius: 14px;
          background:
            radial-gradient(30rem 9rem at 92% -30%, rgba(0, 87, 255, 0.08), transparent 70%),
            linear-gradient(168deg, #FFFFFF 0%, #F4F7FF 100%);
          box-shadow: 0 16px 36px -24px rgba(0, 46, 145, 0.35);
        }
        .lp4-banner-in {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.55rem 1.4rem;
          padding: 0.85rem 2.9rem 0.95rem 1.15rem;
        }
        .lp4-banner-copy { min-width: 0; flex: 1 1 24rem; }
        .lp4-banner-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 0.5rem;
          border-radius: 50%;
          background: #0057FF;
        }
        .lp4-banner-headline {
          margin: 0;
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 800;
          font-size: 1.04rem;
          line-height: 1.3;
          color: #161F2B;
        }
        .lp4-banner-sub { margin: 0.2rem 0 0; font-size: 0.82rem; line-height: 1.4; color: #4A5568; }
        .lp4-banner-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        .lp4-banner-claim {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0.5rem 1.6rem;
          border: none;
          border-radius: 8px;
          background-image: ${PAPER_G_BRAND};
          color: #FFFFFF;
          font-weight: 800;
          font-size: 0.9rem;
          white-space: nowrap;
          cursor: pointer;
          text-decoration: none;
        }
        .lp4-banner-claim:hover { background-image: ${PAPER_G_BRAND_HOVER}; }
        /* The reassurance after the Claim tap — the mail app is opening. */
        .lp4-banner-note {
          flex-basis: 100%;
          margin: 0.15rem 0 0;
          font-size: 0.8rem;
          font-weight: 600;
          color: #0047D6;
        }
        .lp4-banner-x {
          position: absolute;
          top: 0.25rem;
          right: 0.15rem;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: rgba(22, 31, 43, 0.45);
          font-size: 1.6rem;
          line-height: 1;
          cursor: pointer;
        }
        .lp4-banner-x:hover { color: #161F2B; }
        @media (max-width: 47.99rem) {
          .lp4-banner-in { padding: 0.75rem 2.6rem 0.85rem 0.9rem; }
          .lp4-banner-headline { font-size: 0.95rem; }
          .lp4-banner-form { width: 100%; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .lp4-banner-dot { animation: lp4BannerPulse 1.6s ease-in-out infinite; }
          @keyframes lp4BannerPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0, 87, 255, 0.45); }
            55% { box-shadow: 0 0 0 6px rgba(0, 87, 255, 0); }
          }
        }
        /* ---- the founder trust badge (v194): under the promo strip, on
           every regional route. Gradient border, dark ink, light fill. ---- */
        .lp4-founder-badge {
          display: inline-flex;
          align-items: center;
          margin: 0 0 1.4rem;
          padding: 0.5rem 1rem;
          border: 1.5px solid transparent;
          border-radius: 999px;
          background-image:
            linear-gradient(#FFFFFF, #FFFFFF),
            linear-gradient(120deg, #6C9BFF 0%, #0057FF 100%);
          background-origin: padding-box, border-box;
          background-clip: padding-box, border-box;
          color: #10182B;
          font-weight: 800;
          font-size: 0.95rem;
          letter-spacing: -0.005em;
          box-shadow: 0 8px 24px -16px rgba(0, 87, 255, 0.6);
        }
        @media (max-width: 47.99rem) { .lp4-founder-badge { font-size: 0.85rem; } }
        /* ---- the PW social-proof badge (founder instruction, 2026-09-30):
           a quiet pill near the hero CTA — a callout, never a headline. ---- */
        .lp4-pw-badge {
          display: inline-flex;
          align-items: center;
          margin: 0.85rem 0 0;
          padding: 0.34rem 0.8rem;
          border: 1px solid rgba(0, 87, 255, 0.22);
          border-radius: 999px;
          background: rgba(0, 87, 255, 0.07);
          font-size: 0.78rem;
          font-weight: 700;
          color: #0047D6;
        }
        /* Hero rhythm lives in classes rather than inline styles, so the
           mobile block below can tighten it without touching the markup. */
        .lp4-hero-sub { margin-top: 1.25rem; }
        .lp4-hero-cta { margin: 1.5rem 0 0; }

        /* The three-step strip's rules went with the strip itself (2026-09-27
           — it repeated the How-it-works band above the live demo). */
        /* The message-match trust line under the hero CTA (?exam= present). */
        .lp4-cta-proof { font-size: 14px; font-weight: 600; color: ${PAPER_INK_SOFT}; margin: 0.85rem 0 0; }

        /* The India hero uses exam names as trust, never an invented count. */
        .lp4-exam-proof {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 1.05rem;
          color: ${PAPER_INK_SOFT};
          font-size: 14px;
          line-height: 1.4;
        }
        /* The social-proof line now sits UNDER the chips as its own
           paragraph, rather than as a full-width label wedged inside the chip
           row above the button. */
        .lp4-exam-proof-label {
          margin: 0.55rem 0 0;
          color: ${PAPER_INK_SOFT};
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
        }
        /* The message-match badge. Quieter than the offer pill above it: the
           offer is the ask, this is only confirmation the visitor is in the
           right place. */
        .lp4-for-exam {
          display: inline-flex;
          align-items: center;
          margin: 0 0 0.7rem;
          padding: 0.2rem 0.62rem;
          border: 1px solid rgba(108, 155, 255, 0.34);
          border-radius: 999px;
          background: rgba(0, 87, 255, 0.18);
          color: ${PAPER_ACCENT_TEXT};
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        /* Two stacked pills would cost the first screen a line it cannot
           spare, so the offer tightens when the exam badge follows it. */
        .lp4-offer:has(+ .lp4-for-exam) { margin-bottom: 0.5rem; }
        /* A 1px marker an IntersectionObserver can actually see — a
           zero-height element never reports an intersection. */
        .lp4-probe { display: block; width: 1px; height: 1px; }
        .lp4-proof-chip {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0.15rem 0.55rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.75);
          color: ${PAPER_INK_SOFT};
          font-weight: 700;
        }
        .lp4-proof-dot { color: ${PAPER_INK_FAINT}; }
        .lp4-proof-chip-more { border-style: dashed; color: ${PAPER_INK_FAINT}; font-weight: 600; }

        /* Repeated conversion points stay quiet on the paper but keep the
           same large, high-contrast action as the hero. */
        /* v189.2: the repeat CTA no longer paints a flat block over the page
           gradient — a soft blue wash carries it instead. */
        .lp4-mid-cta {
          background: radial-gradient(44rem 16rem at 50% 0%, rgba(0, 87, 255, 0.1), transparent 70%);
          border-top: 1px solid ${PAPER_RULE};
        }
        .lp4-mid-cta-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.1rem;
          padding: 3rem 0;
          text-align: center;
        }
        .lp4-mid-cta h2 { font-size: clamp(1.75rem, 3vw, 2.15rem); }

        /* ---- hero ---- */
        /* Compressed on 2026-09-27: the exam picker and the plan preview now
           have to be reachable within the first screen-and-a-bit, so the hero
           gives up the padding it was using to look spacious. */
        .lp4-hero { padding: 2rem 0 2.4rem; position: relative; }
        /* THE LIGHT HERO (v194, founder instruction 2026-09-30): the whole
           first viewport is a warm-white sheet in dark ink — no dark canvas
           and no dark gradient anywhere in the hero or the nav. Two very
           faint blue radials keep the brand light in the corners. The
           hand-off to the dark body happens in .lp4-hero-fade below. */
        .lp4-hero-glow {
          background:
            radial-gradient(ellipse 46% 40% at 78% -6%, rgba(0, 87, 255, 0.07) 0%, transparent 62%),
            radial-gradient(ellipse 90% 46% at 8% 108%, rgba(0, 87, 255, 0.05) 0%, transparent 66%),
            linear-gradient(180deg, #FFFFFF 0%, #FCFBF8 52%, #F2F5FB 100%);
        }
        @media (max-width: 47.99rem) {
          .lp4-hero-glow {
            background:
              radial-gradient(ellipse 130% 46% at 50% -8%, rgba(0, 87, 255, 0.06) 0%, transparent 64%),
              linear-gradient(180deg, #FFFFFF 0%, #FCFBF8 55%, #F2F5FB 100%);
          }
        }
        .lp4-hero-fade { display: none; }
        @media (min-width: 60rem) { .lp4-hero { padding: 2.6rem 0 2.8rem; } }
        /* THE SCROLL CUE (UX pass, 2026-09-27): nine sections wait below the
           hero, so it ends with a small chevron at ~30% opacity and a gentle
           pulse instead of a hard stop. Drawn with two borders — CSS only,
           no library — and it stands down under prefers-reduced-motion. */
        .lp4-scroll-cue { display: flex; justify-content: center; margin-top: 2.4rem; opacity: 0.3; }
        .lp4-scroll-cue span {
          width: 14px;
          height: 14px;
          border-right: 2px solid #161F2B;
          border-bottom: 2px solid #161F2B;
          transform: rotate(45deg);
        }
        @media (prefers-reduced-motion: no-preference) {
          .lp4-scroll-cue { animation: lp4CuePulse 2.6s ease-in-out infinite; }
          @keyframes lp4CuePulse {
            0%, 100% { opacity: 0.22; transform: translateY(0); }
            50% { opacity: 0.38; transform: translateY(6px); }
          }
        }
        .lp4-hero h1 { max-width: 16ch; }
        /* ---- ABOVE THE FOLD ON A PHONE ----
           The desktop headline is 48px at its smallest, which pushed the CTA
           off a 375×667 screen entirely: 1,780 visitors in 30 days produced
           zero CTA clicks. Everything above the button is tightened here so
           the offer pill, headline, sub, exam chips AND the button all land
           inside the first screen without scrolling. */
        @media (max-width: 47.99rem) {
          .lp4-hero { padding: 0.8rem 0 1.6rem; }
          .lp4-hero h1 { font-size: 1.95rem; line-height: 1.14; max-width: 24ch; }
          .lp4-lede { font-size: 1rem; line-height: 1.5; }
          .lp4-offer { margin-bottom: 0.8rem; }
          .lp4-hero-sub { margin-top: 0.75rem; }
          .lp4-hero-cta { margin-top: 1.15rem; }
          .lp4-hero-grid { gap: 1.25rem; }
          .lp4-hero-demo-shelf { margin-top: 1.5rem; }
          /* One unmissable, full-width action. */
          .lp4-btn-primary {
            width: 100%;
            min-width: 0;
            padding-left: 1rem;
            padding-right: 1rem;
            font-size: 16px;
          }
        }
        /* THE HERO (founder instruction, 2026-09-27): the demo video is gone.
           The row is copy (headline, sub, CTA, reassure) on the LEFT and the
           exam picker on the RIGHT, vertically centred to each other so the
           picker reads as a natural extension of the copy. Below 768px the
           row wraps back into a stack: text on top, exam picker below — it
           never overflows the viewport. */
        .lp4-hero-grid { display: flex; flex-direction: column; gap: 2rem; }
        @media (min-width: 48rem) {
          .lp4-hero-grid { flex-direction: row; align-items: center; gap: 3rem; }
          .lp4-hero-grid > div:first-child { flex: 1 1 60%; min-width: 0; }
          .lp4-hero-exams-col { flex: 1 1 40%; min-width: 0; }
        }
        /* The redesigned live-demo panel sits full-width below the hero row,
           so it reads as its own mini product demo rather than a cramped
           sidebar form. */
        .lp4-hero-demo-shelf { margin-top: 2.1rem; }
        /* THE EXAM CHIP. A small card rather than an outlined box: paper fill,
           a status dot that lights up, a lift on hover, and a filled brand
           state with its own inner highlight when selected. */
        .lp4-exams { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .lp4-exam {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-family: ${PAPER_FONT_BODY};
          font-size: 0.875rem;
          font-weight: 600;
          color: ${PAPER_INK_SOFT};
          background-image: ${PAPER_G_CARD};
          border: 1px solid ${PAPER_RULE};
          border-radius: 7px;
          padding: 0.34rem 0.72rem;
          cursor: pointer;
          box-shadow: 0 1px 1px rgba(16, 24, 40, 0.04);
          transition: color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease,
            transform 0.18s ease, background-image 0.18s ease;
        }
        .lp4-exam::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${PAPER_RULE};
          transition: background 0.18s ease, box-shadow 0.18s ease;
        }
        .lp4-exam:hover {
          color: ${PAPER_INK};
          border-color: rgba(0, 87, 255, 0.4);
          transform: translateY(-1px);
          box-shadow: 0 5px 12px -5px rgba(0, 87, 255, 0.4);
        }
        .lp4-exam:hover::before { background: rgba(0, 87, 255, 0.55); }
        .lp4-exam:active { transform: translateY(0) scale(0.95); }
        .lp4-exam-on, .lp4-exam-on:hover {
          color: #FFFFFF;
          border-color: transparent;
          background-image: ${PAPER_G_BRAND};
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.26) inset,
            0 6px 14px -6px rgba(0, 87, 255, 0.7);
        }
        .lp4-exam-on::before, .lp4-exam-on:hover::before {
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22);
        }
        .lp4-exam-more, .lp4-exam-more:hover {
          cursor: default;
          color: ${PAPER_INK_FAINT};
          background-image: none;
          border-color: ${PAPER_RULE};
          border-style: dashed;
          box-shadow: none;
          transform: none;
        }
        .lp4-exam-more::before { display: none; }
        .lp4-grad {
          background-image: ${PAPER_G_TEXT};
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }

        /* ---- the live demo ---- */
        /* THE DEMO CARD — redesigned as a premium mini product demo rather
           than a plain utility form: a raised paper card with a soft blue
           glow in the corner, icon-led fields, and the result laid out as a
           real vertical timeline instead of a flat list. */
        .lp4-demo {
          position: relative;
          overflow: hidden;
          background-image: ${PAPER_G_CARD};
          border: 1px solid ${PAPER_RULE};
          border-radius: 16px;
          padding: 1.7rem 1.7rem 1.8rem;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 26px 52px -30px rgba(22, 31, 43, 0.35);
        }
        .lp4-demo::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 16px 16px 0 0;
          background-image: ${PAPER_G_BRAND};
        }
        .lp4-demo::after {
          content: '';
          position: absolute;
          top: -55%;
          right: -20%;
          width: 60%;
          height: 140%;
          background: radial-gradient(circle, rgba(0, 87, 255, 0.22), transparent 70%);
          pointer-events: none;
        }
        .lp4-demo-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .lp4-demo-h { margin-bottom: 0.25rem; }
        .lp4-demo-badge {
          flex-shrink: 0;
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: ${PAPER_ACCENT_TEXT};
          background: rgba(0, 87, 255, 0.18);
          border: 1px solid rgba(108, 155, 255, 0.3);
          border-radius: 999px;
          padding: 0.24rem 0.6rem;
          white-space: nowrap;
        }
        .lp4-demo-hint {
          position: relative;
          z-index: 1;
          font-size: 0.9rem;
          color: ${PAPER_INK_SOFT};
          margin-bottom: 1.3rem;
          max-width: 30rem;
        }
        .lp4-demo-fields {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 1rem;
          margin-bottom: 1.1rem;
        }
        @media (min-width: 34rem) { .lp4-demo-fields { grid-template-columns: 1fr 1fr; } }
        .lp4-field { display: block; margin-bottom: 0; }
        .lp4-field > span {
          display: block;
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${PAPER_INK_SOFT};
          margin-bottom: 0.4rem;
        }
        /* Icon-led inputs: a small line icon sits inside each field, drawn as
           a CSS background-image rather than extra markup, so the topic and
           date fields read as a real product form. */
        .lp4-field input, .lp4-field select {
          width: 100%;
          font: 500 0.98rem ${PAPER_FONT_BODY};
          color: ${PAPER_INK};
          background-color: ${PAPER_SUNK};
          background-repeat: no-repeat;
          background-position: 0.85rem center;
          border: 1px solid ${PAPER_RULE};
          border-radius: 9px;
          padding: 0.75rem 0.85rem 0.75rem 2.6rem;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06) inset;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .lp4-field input { background-image: url("${ICON_TOPIC}"); }
        .lp4-field select { background-image: url("${ICON_CALENDAR}"); }
        .lp4-field input::placeholder { color: ${PAPER_INK_FAINT}; }
        .lp4-field input:focus, .lp4-field select:focus {
          border-color: ${PAPER_ACCENT_TEXT};
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 87, 255, 0.35);
        }
        /* The native select arrow is the one thing that always gives a page
           away as unstyled — draw our own. */
        .lp4-select { position: relative; }
        .lp4-select select { appearance: none; -webkit-appearance: none; padding-right: 2.3rem; cursor: pointer; }
        .lp4-select::after {
          content: '';
          position: absolute;
          right: 0.9rem;
          bottom: 1.12rem;
          width: 7px;
          height: 7px;
          border-right: 2px solid ${PAPER_INK_SOFT};
          border-bottom: 2px solid ${PAPER_INK_SOFT};
          transform: rotate(45deg);
          pointer-events: none;
        }
        .lp4-demo .lp4-btn { position: relative; z-index: 1; width: 100%; }
        @media (min-width: 34rem) {
          .lp4-demo .lp4-btn { width: auto; padding-left: 2.1rem; padding-right: 2.1rem; }
        }
        .lp4-demo-out {
          position: relative;
          z-index: 1;
          margin-top: 1.5rem;
          border-top: 1px solid ${PAPER_RULE};
          padding-top: 1.3rem;
        }
        .lp4-demo-head { font-size: 0.93rem; font-weight: 600; margin-bottom: 1rem; }
        /* THE RESULT — a real vertical timeline (a connecting rule threaded
           through each node) rather than a plain bulleted list, so the five
           dates read as a schedule, not a printout. */
        .lp4-sched { list-style: none; margin: 0; padding: 0; }
        .lp4-sched li {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          padding: 0.55rem 0.6rem 0.55rem 0.05rem;
          font-size: 0.95rem;
          border-radius: 8px;
        }
        .lp4-sched li:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 0.38rem;
          top: 1.15rem;
          bottom: -0.35rem;
          width: 2px;
          background: ${PAPER_RULE};
        }
        .lp4-sched li::before {
          content: '';
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          width: 9px;
          height: 9px;
          margin-top: 0.42rem;
          border-radius: 50%;
          background: ${PAPER_BG};
          border: 2px solid rgba(22, 31, 43, 0.25);
        }
        .lp4-sched li.lp4-sched-missed::before { background: rgba(255, 107, 94, 0.22); border-color: ${PAPER_GONE}; }
        .lp4-sched li.lp4-sched-due::before {
          border-color: transparent;
          background-image: ${PAPER_G_HELD};
          box-shadow: 0 0 0 3px rgba(0, 87, 255, 0.3);
        }
        .lp4-sched li.lp4-sched-due { background-color: rgba(0, 87, 255, 0.14); }
        .lp4-when { font-weight: 600; min-width: 4.2rem; font-variant-numeric: tabular-nums; }
        /* Status reads as a pill, not as coloured text. */
        .lp4-tag {
          margin-left: auto;
          flex-shrink: 0;
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          border-radius: 999px;
          padding: 0.2rem 0.55rem;
          border: 1px solid ${PAPER_RULE};
          background: rgba(22, 31, 43, 0.05);
          color: ${PAPER_INK_SOFT};
        }
        .lp4-sched-missed .lp4-tag {
          color: ${PAPER_GONE};
          background: rgba(255, 107, 94, 0.14);
          border-color: rgba(255, 107, 94, 0.32);
        }
        .lp4-sched-missed .lp4-what { color: ${PAPER_GONE}; opacity: 0.85; text-decoration: line-through; }
        .lp4-sched-due .lp4-when { color: ${PAPER_KEPT}; }
        .lp4-sched-due .lp4-tag {
          color: ${PAPER_KEPT};
          background: rgba(61, 214, 140, 0.14);
          border-color: rgba(61, 214, 140, 0.32);
        }
        /* The verdict is a notice, not a bold sentence. */
        .lp4-verdict {
          position: relative;
          z-index: 1;
          margin: 1.2rem 0 0;
          padding: 0.85rem 0.95rem;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 600;
          color: ${PAPER_GONE};
          background: rgba(255, 107, 94, 0.1);
          border: 1px solid rgba(255, 107, 94, 0.28);
        }
        .lp4-verdict-ok {
          color: ${PAPER_KEPT};
          background: rgba(61, 214, 140, 0.1);
          border-color: rgba(61, 214, 140, 0.28);
        }
        .lp4-verdict small { display: block; font-size: 0.875rem; font-weight: 400; color: ${PAPER_INK_SOFT}; margin-top: 0.3rem; }

        /* ---- founder strip ---- */
        .lp4-founder {
          position: relative;
          padding: 0.15rem 0 0.15rem 1.1rem;
          max-width: 34rem;
          font-size: 1rem;
          color: ${PAPER_INK_SOFT};
        }
        .lp4-founder::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 2px;
          background-image: ${PAPER_G_BRAND};
        }
        .lp4-founder b { color: ${PAPER_INK}; font-weight: 600; }

        /* The decay-strip rules went with the strips (2026-09-27): the memory
           diagram beside them was making the identical point. */

        /* ---- the day (how it works) ---- */
        .lp4-day { list-style: none; margin: 2rem 0 0; padding: 0; max-width: 36rem; }
        .lp4-day li { display: grid; grid-template-columns: 1fr; gap: 0.3rem; padding: 1.05rem 0; border-top: 1px solid ${PAPER_RULE}; }
        .lp4-day li:last-child { border-bottom: 1px solid ${PAPER_RULE}; }
        @media (min-width: 34rem) { .lp4-day li { grid-template-columns: 6.4rem 1fr; gap: 1.1rem; } }
        .lp4-clock { font-size: 0.875rem; font-weight: 600; color: ${PAPER_ACCENT_TEXT}; padding-top: 0.16rem; }
        .lp4-day p { margin: 0.3rem 0 0; font-size: 1rem; color: ${PAPER_INK_SOFT}; }

        /* ---- pull quote ---- */
        .lp4-pull {
          position: relative;
          margin: 2.2rem 0 0;
          max-width: 36rem;
          background-image: ${PAPER_G_CARD};
          border: 1px solid ${PAPER_RULE};
          border-radius: 0 4px 4px 0;
          padding: 1.2rem 1.3rem 1.2rem 1.5rem;
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 600;
          font-size: 1.08rem;
          line-height: 1.4;
          letter-spacing: -0.015em;
        }
        .lp4-pull::before {
          content: '';
          position: absolute;
          left: -1px; top: -1px; bottom: -1px;
          width: 3px;
          background-image: ${PAPER_G_ACCENT_BRAND};
        }

        /* ---- the student sentence, immediately above the closing ask ----
           A testimonial card, honestly labelled: dark surface, a drawn quote
           mark in the accent tint, the sentence at display size, and a
           caption that says what it is instead of inventing a name. It is
           centred and full-measure on a phone, where it is the last thing
           read before the button. */
        .lp4-say {
          position: relative;
          margin: 0 auto;
          max-width: 36rem;
          padding: 2.2rem 1.4rem 1.35rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 14px;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 24px 46px -28px rgba(0, 0, 0, 0.9);
        }
        .lp4-say::before {
          content: '“';
          position: absolute;
          top: 0.5rem;
          left: 1.05rem;
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: 3.6rem;
          line-height: 1;
          color: ${PAPER_ACCENT_TEXT};
          opacity: 0.6;
          pointer-events: none;
        }
        .lp4-say blockquote {
          margin: 0;
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 700;
          font-size: clamp(1.12rem, 3.3vw, 1.42rem);
          line-height: 1.34;
          letter-spacing: -0.015em;
          color: ${PAPER_INK};
        }
        .lp4-say figcaption {
          margin-top: 0.85rem;
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: ${PAPER_INK_FAINT};
        }
        .lp4-say-answer {
          margin: 1.15rem auto 0;
          max-width: 36rem;
          font-size: 1.02rem;
          font-weight: 600;
          line-height: 1.45;
          text-align: center;
          color: ${PAPER_INK_SOFT};
        }

        /* ---- two-column plates ----
           Every row that pairs a text block with an image, mockup or screen
           recording shares ONE vertical midpoint (founder instruction,
           2026-09-23): align-items: center on the row, media at its natural
           height, so neither column floats high while the other hangs low.
           Below 52rem the row stacks to one column, as before. */
        .lp4-split { display: grid; gap: 2rem; align-items: center; margin-top: 2rem; }
        @media (min-width: 52rem) {
          .lp4-split { grid-template-columns: 1fr 1fr; gap: 2.6rem; }
        }
        .lp4-showcase { display: grid; gap: 2.4rem; align-items: center; margin-top: 2.2rem; }
        @media (min-width: 52rem) { .lp4-showcase { grid-template-columns: 17.5rem 1fr; gap: 3rem; } }
        .lp4-caption { font-size: 0.875rem; color: ${PAPER_INK_SOFT}; margin: 0.7rem 0 0; }

        /* ---- beats ---- */
        .lp4-beats { list-style: none; margin: 0; padding: 0; max-width: 32rem; }
        .lp4-beats li { position: relative; border-top: 1px solid ${PAPER_RULE}; padding: 1rem 0 1rem 1.15rem; }
        .lp4-beats li:last-child { border-bottom: 1px solid ${PAPER_RULE}; }
        .lp4-beats li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 1.42rem;
          width: 6px;
          height: 6px;
          border-radius: 2px;
          transform: rotate(45deg);
          background-image: ${PAPER_G_BRAND};
        }
        .lp4-beats p { margin: 0.25rem 0 0; color: ${PAPER_INK_SOFT}; font-size: 1rem; }

        /* ---- numbered callouts ---- */
        .lp4-callouts { list-style: none; margin: 1.6rem 0 0; padding: 0; }
        .lp4-callouts li { display: grid; grid-template-columns: 2rem 1fr; gap: 0.85rem; border-top: 1px solid ${PAPER_RULE}; padding: 0.95rem 0; }
        .lp4-callouts li:last-child { border-bottom: 1px solid ${PAPER_RULE}; }
        /* The callout numeral sits in its own little paper tile. */
        .lp4-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.95rem;
          height: 1.95rem;
          border-radius: 7px;
          background-image: ${PAPER_G_CARD};
          border: 1px solid ${PAPER_RULE};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 800;
          font-size: 0.875rem;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .lp4-callouts p { margin: 0.22rem 0 0; color: ${PAPER_INK_SOFT}; font-size: 1rem; }

        /* ---- proof ---- */
        .lp4-points { display: grid; gap: 0.9rem; margin-top: 1.6rem; }
        @media (min-width: 48rem) { .lp4-points { grid-template-columns: repeat(3, 1fr); } }
        .lp4-point {
          position: relative;
          overflow: hidden;
          background-image: ${PAPER_G_CARD};
          border: 1px solid ${PAPER_RULE};
          border-radius: 8px;
          padding: 1rem 1.05rem 1rem 1.35rem;
          font-size: 1rem;
          color: ${PAPER_INK_SOFT};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }
        .lp4-point::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-image: ${PAPER_G_BRAND};
          opacity: 0.75;
        }
        /* auto-fit rather than a fixed 2 columns: with a single real quote
           the old grid left a conspicuous empty half-row beside it. */
        .lp4-quotes { display: grid; gap: 0.9rem; margin-top: 0.9rem; }
        @media (min-width: 48rem) { .lp4-quotes { grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); } }
        .lp4-quote {
          margin: 0;
          background-image: ${PAPER_G_CARD};
          border: 1px solid ${PAPER_RULE};
          border-left: 2px solid ${PAPER_ACCENT};
          border-radius: 4px;
          padding: 1.05rem 1.15rem;
        }
        .lp4-quote blockquote { margin: 0; font-size: 1rem; }
        .lp4-quote figcaption { margin-top: 0.7rem; font-size: 0.875rem; font-weight: 700; color: ${PAPER_ACCENT_TEXT}; }

        /* ---- doubts ---- */
        .lp4-qa { max-width: 36rem; margin-top: 1.9rem; }
        .lp4-qa dt { font-weight: 600; margin-top: 1.35rem; }
        .lp4-qa dt:first-of-type { margin-top: 0; }
        .lp4-qa dd { margin: 0.3rem 0 0; color: ${PAPER_INK_SOFT}; font-size: 1rem; }

        /* ---- price ---- */
        .lp4-anchor { max-width: 33rem; font-size: 1.04rem; margin-top: 1.1rem; }
        .lp4-plans { display: grid; gap: 1rem; margin: 1.9rem 0 1.1rem; max-width: 38rem; }
        @media (min-width: 40rem) { .lp4-plans { grid-template-columns: 1fr 1fr; } }
        .lp4-plan {
          position: relative;
          overflow: hidden;
          border: 1px solid ${PAPER_RULE};
          border-radius: 10px;
          padding: 1.3rem;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
          display: flex;
          flex-direction: column;
        }
        .lp4-plan-lead {
          border-color: rgba(0, 87, 255, 0.4);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 18px 36px -20px rgba(0, 87, 255, 0.5);
        }
        .lp4-plan-lead::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background-image: ${PAPER_G_BRAND}; }
        /* A turned-down corner — the page is paper, so the lead plan gets the
           dog-ear rather than a shouted badge. */
        .lp4-plan-lead::after {
          content: '';
          position: absolute;
          top: 3px;
          right: 0;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 26px 26px 0;
          border-color: transparent rgba(0, 87, 255, 0.14) transparent transparent;
        }
        .lp4-amt {
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 800;
          font-size: 2.15rem;
          line-height: 1;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
          margin: 0;
        }
        .lp4-amt small { font-size: 0.9rem; font-weight: 600; font-family: ${PAPER_FONT_BODY}; color: ${PAPER_INK_SOFT}; letter-spacing: 0; }
        .lp4-who { font-size: 0.92rem; color: ${PAPER_INK_SOFT}; margin: 0.6rem 0 0; }
        .lp4-plan-label {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: ${PAPER_INK_SOFT};
          background: rgba(22, 31, 43, 0.05);
          border: 1px solid ${PAPER_RULE};
          border-radius: 999px;
          padding: 0.22rem 0.62rem;
          margin: 0 0 0.9rem;
        }
        .lp4-plan-lead .lp4-plan-label {
          color: ${PAPER_ACCENT_TEXT};
          background: rgba(0, 87, 255, 0.18);
          border-color: rgba(108, 155, 255, 0.3);
        }
        .lp4-plan-cta { margin-top: auto; padding-top: 1.1rem; }
        .lp4-pay { font-size: 0.89rem; color: ${PAPER_INK_SOFT}; max-width: 34rem; }
        .lp4-legal { display: flex; flex-wrap: wrap; gap: 0.45rem 0.7rem; margin-top: 1.4rem; font-size: 0.875rem; }

        /* ---- close + footer ---- */
        .lp4-close { padding: 4.2rem 0 4.6rem; position: relative; }
        .lp4-close h2 { max-width: 18ch; }
        .lp4-footer { padding: 1.7rem 0 2.6rem; font-size: 0.9rem; color: ${PAPER_INK_SOFT}; }
        .lp4-footer a { color: ${PAPER_INK_SOFT}; }

        /* ---- the pain, in the student's own voice ---- */
        /* The largest non-heading type on the page, because being recognised
           is what earns the paragraph after it. */
        .lp4-voice {
          margin: 1.3rem 0 0;
          padding: 0 0 0 1.2rem;
          border-left: 3px solid ${PAPER_ACCENT};
          max-width: 34rem;
          font-family: ${PAPER_FONT_DISPLAY};
          /* v189.2: smaller ceiling and a taller line — the quote reads as a
             sentence, not a wall (founder instruction). */
          font-size: clamp(1.2rem, 3vw, 1.55rem);
          font-style: italic;
          font-weight: 700;
          line-height: 1.35;
          letter-spacing: -0.015em;
          color: ${PAPER_INK};
        }

        /* ---- the memory loop ---- */
        .lp4-loop { list-style: none; display: grid; gap: 0.9rem; margin: 2rem 0 0; padding: 0; }
        @media (min-width: 48rem) {
          .lp4-loop { grid-template-columns: repeat(3, 1fr); gap: 1.1rem; }
        }
        .lp4-loop li {
          padding: 1.15rem 1.2rem 1.25rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 10px;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }
        .lp4-loop-when {
          margin: 0 0 0.6rem;
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${PAPER_ACCENT_TEXT};
        }
        /* The fill IS the argument: the same product, further along. */
        .lp4-loop-track {
          display: block;
          height: 5px;
          margin-bottom: 0.9rem;
          border-radius: 999px;
          background: ${PAPER_SUNK};
          overflow: hidden;
        }
        .lp4-loop-track i { display: block; height: 100%; border-radius: 999px; background-image: ${PAPER_G_BRAND}; }
        .lp4-loop-text { margin: 0.45rem 0 0; font-size: 1rem; color: ${PAPER_INK_SOFT}; }

        /* ---- the problem in students' own words ---- */
        .lp4-voices-block { margin-top: 2rem; }
        .lp4-voices-h { margin: 0; }
        .lp4-voices { list-style: none; display: grid; gap: 0.7rem; margin: 1.1rem 0 0; padding: 0; }
        @media (min-width: 48rem) { .lp4-voices { grid-template-columns: 1fr 1fr; gap: 0.8rem; } }
        .lp4-voices li {
          padding: 0.9rem 1rem;
          border: 1px solid ${PAPER_RULE};
          border-left: 2px solid ${PAPER_GONE};
          border-radius: 6px;
          background: ${PAPER_BG};
          font-size: 1rem;
          font-style: italic;
          line-height: 1.6;
        }
        .lp4-voices-note { margin: 0.95rem 0 0; max-width: 34rem; font-size: 0.875rem; color: ${PAPER_INK_FAINT}; }

        /* ---- the exam pain point (founder instruction, 2026-09-28) ----
           One sentence of exam-specific pain under the pills, sliding in
           whenever a different chip is tapped (the card is keyed on the
           exam, so it re-mounts and the animation re-runs). */
        .lp4-exam-pain {
          margin-top: 0.9rem;
          padding: 0.85rem 1rem 0.9rem;
          border: 1px solid rgba(0, 87, 255, 0.3);
          border-left: 3px solid ${PAPER_ACCENT};
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(0, 87, 255, 0.12) 0%, rgba(0, 87, 255, 0.04) 100%);
          animation: lp4PainIn 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .lp4-exam-pain-tag {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${PAPER_ACCENT_TEXT};
        }
        .lp4-exam-pain p { margin: 0.3rem 0 0; font-size: 0.9rem; line-height: 1.55; color: ${PAPER_INK}; }
        @keyframes lp4PainIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .lp4-exam-pain { animation: none; } }

        /* ---- the language toggle (EN | हिं, founder instruction,
           2026-09-28) ---- */
        .lp4-top .lp4-lang {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          padding: 2px;
          border: 1px solid rgba(22, 31, 43, 0.14);
          border-radius: 999px;
          background: rgba(22, 31, 43, 0.05);
        }
        .lp4-top .lp4-lang button {
          border: 0;
          background: transparent;
          color: rgba(22, 31, 43, 0.55);
          font-family: ${PAPER_FONT_BODY};
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1;
          padding: 0.32rem 0.6rem;
          border-radius: 999px;
          cursor: pointer;
          transition: color 0.18s ease, background 0.18s ease;
        }
        .lp4-lang button[aria-pressed="true"] {
          background-image: ${PAPER_G_BRAND};
          color: #FFFFFF;
        }

        /* ---- FAQ accordion (founder instruction, 2026-09-27) ----
           The questions used to print with every answer open, so the band was
           a wall of text a visitor scrolled past. One open at a time now: the
           question is the control, the chevron says it opens, and the answer
           grows rather than appearing. The 0fr -> 1fr grid row is what makes an
           auto-height panel animate at all; a browser that does not support it
           simply snaps open, which is still correct. */
        .lp4-faq { max-width: 42rem; margin-top: 1.7rem; border-top: 1px solid ${PAPER_RULE}; }
        .lp4-faq-item { border-bottom: 1px solid ${PAPER_RULE}; }
        .lp4-faq-q {
          display: flex;
          width: 100%;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.05rem 0;
          margin: 0;
          background: none;
          border: 0;
          text-align: left;
          cursor: pointer;
          color: ${PAPER_INK};
          font-family: ${PAPER_FONT_BODY};
          font-size: 1.02rem;
          font-weight: 600;
          line-height: 1.35;
          transition: color 0.18s ease;
        }
        .lp4-faq-q:hover { color: ${PAPER_ACCENT_TEXT}; }
        .lp4-faq-icon {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid ${PAPER_RULE};
          background: rgba(22, 31, 43, 0.04);
          color: ${PAPER_INK_SOFT};
          transition: background 0.24s ease, border-color 0.24s ease, color 0.24s ease;
        }
        .lp4-faq-icon svg { transition: transform 0.26s ease; }
        .lp4-faq-item[data-open='true'] .lp4-faq-icon {
          background: rgba(0, 87, 255, 0.12);
          border-color: rgba(0, 87, 255, 0.3);
          color: ${PAPER_ACCENT_TEXT};
        }
        .lp4-faq-item[data-open='true'] .lp4-faq-icon svg { transform: rotate(180deg); }
        .lp4-faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease; }
        .lp4-faq-item[data-open='true'] .lp4-faq-a { grid-template-rows: 1fr; }
        .lp4-faq-a > div { overflow: hidden; }
        .lp4-faq-a p { margin: 0; padding: 0 0 1.15rem; color: ${PAPER_INK_SOFT}; font-size: 1rem; max-width: 40rem; }
        @media (prefers-reduced-motion: reduce) {
          .lp4-faq-a, .lp4-faq-icon svg { transition: none; }
        }

        /* ---- feature showcases (mock analysis / mistake book) ----
           A drawn panel on one side, the claim and three proof points on the
           other. The 'flip' modifier alternates which side the panel sits on so
           two showcases in a row do not read as one repeated block. */
        .lp4-feat { display: grid; gap: 1.8rem; align-items: center; margin-top: 1.6rem; }
        @media (min-width: 52rem) {
          .lp4-feat { grid-template-columns: 1fr 1fr; gap: 2.6rem; }
          .lp4-feat-flip > :first-child { order: 2; }
        }
        .lp4-feat-points { list-style: none; margin: 1.3rem 0 0; padding: 0; display: grid; gap: 0.8rem; }
        .lp4-feat-points li { display: flex; gap: 0.7rem; align-items: flex-start; font-size: 1rem; line-height: 1.6; }
        .lp4-feat-tick {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          margin-top: 0.16rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-image: ${PAPER_G_BRAND};
          color: ${PAPER_ACCENT_INK};
        }

        /* The stylised topic-accuracy card behind the Mock Analysis claim. */
        .lp4-acc {
          border: 1px solid ${PAPER_RULE};
          border-radius: 12px;
          padding: 1.15rem 1.2rem 1.25rem;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 18px 34px -24px rgba(22, 31, 43, 0.3);
        }
        .lp4-acc-h { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin: 0; }
        .lp4-acc-title { font-family: ${PAPER_FONT_DISPLAY}; font-weight: 800; font-size: 1rem; letter-spacing: -0.015em; }
        .lp4-acc-score { font-family: ${PAPER_FONT_DISPLAY}; font-weight: 800; font-size: 1.5rem; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .lp4-acc-note { margin: 0.3rem 0 1.05rem; font-size: 0.875rem; color: ${PAPER_INK_FAINT}; }
        .lp4-acc-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.8rem; }
        .lp4-acc-top { display: flex; justify-content: space-between; gap: 0.8rem; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.32rem; }
        .lp4-acc-pct { color: ${PAPER_INK_SOFT}; font-variant-numeric: tabular-nums; }
        .lp4-acc-bar { display: block; height: 7px; border-radius: 999px; background: rgba(22, 31, 43, 0.08); overflow: hidden; }
        .lp4-acc-bar i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background-image: ${PAPER_G_HELD};
          transform-origin: left center;
          animation: lp4AccGrow 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .lp4-acc-low i { background-image: linear-gradient(90deg, #E0503F, ${PAPER_GONE}); }
        @keyframes lp4AccGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .lp4-acc-bar i { animation: none; } }
        .lp4-acc-flag {
          margin: 1.05rem 0 0;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 107, 94, 0.3);
          background: rgba(255, 107, 94, 0.1);
          font-size: 0.875rem;
          font-weight: 600;
          color: ${PAPER_GONE};
        }

        /* The scan-and-save flow behind the Mistake Book claim. */
        .lp4-flow { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
        .lp4-flow li {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.72rem 0.85rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 10px;
          background-image: ${PAPER_G_SUNK};
          font-size: 0.9rem;
          font-weight: 600;
        }
        .lp4-flow-step {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          background: rgba(0, 87, 255, 0.2);
          border: 1px solid rgba(108, 155, 255, 0.3);
          color: ${PAPER_ACCENT_TEXT};
        }
        .lp4-flow-note { margin: 0.9rem 0 0; font-size: 0.875rem; color: ${PAPER_INK_FAINT}; }
        .lp4-flow-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.85rem; }
        .lp4-flow-tag {
          font-size: 0.875rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 0.26rem 0.62rem;
          border: 1px solid rgba(108, 155, 255, 0.3);
          background: rgba(0, 87, 255, 0.16);
          color: ${PAPER_ACCENT_TEXT};
        }

        /* ---- the demo video (v189: NO sound control — founder instruction).
           The recording simply plays muted; no button sits over it. ---- */
        .lp4-vid { position: relative; }

        /* ---- the Learn hub teaser, near the foot of the page ---- */
        .lp4-learn { display: grid; gap: 0.8rem; margin-top: 1.5rem; }
        @media (min-width: 46rem) { .lp4-learn { grid-template-columns: repeat(3, 1fr); } }
        .lp4-learn a {
          display: block;
          padding: 1rem 1.1rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 10px;
          background-image: ${PAPER_G_CARD};
          color: ${PAPER_INK};
          text-decoration: none;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .lp4-learn a:hover { border-color: rgba(108, 155, 255, 0.4); transform: translateY(-2px); }
        .lp4-learn p { margin: 0.35rem 0 0; font-size: 0.9rem; color: ${PAPER_INK_SOFT}; }
        @media (prefers-reduced-motion: reduce) { .lp4-learn a:hover { transform: none; } }

        /* ---- what the first week changes ---- */
        .lp4-outcomes-block { margin-top: 1.9rem; }
        .lp4-outcomes { list-style: none; display: grid; gap: 0.6rem; margin: 1rem 0 0; padding: 0; }
        @media (min-width: 48rem) { .lp4-outcomes { grid-template-columns: repeat(3, 1fr); gap: 0.8rem; } }
        .lp4-outcomes li {
          position: relative;
          padding: 0.9rem 1rem 0.9rem 2.2rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 8px;
          background-image: ${PAPER_G_CARD};
          font-size: 1rem;
          line-height: 1.6;
          color: ${PAPER_INK_SOFT};
        }
        .lp4-outcomes li::before {
          content: '';
          position: absolute;
          left: 0.95rem;
          top: 1.3rem;
          width: 9px;
          height: 5px;
          border-left: 2px solid ${PAPER_KEPT};
          border-bottom: 2px solid ${PAPER_KEPT};
          transform: rotate(-45deg);
        }

        /* ---- the searchable YouTube proof link in the WHY band ---- */
        .lp4-yt {
          color: ${PAPER_ACCENT_TEXT};
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: rgba(108, 155, 255, 0.45);
          transition: color 0.18s ease, text-decoration-color 0.18s ease;
        }
        .lp4-yt:hover { color: #FFFFFF; text-decoration-color: #FFFFFF; }
        .lp4-yt::after { content: ' ↗'; font-size: 0.85em; }
        /* Key phrases in body copy carry full ink, so the argument reads
           strong instead of flat grey. */
        .lp4-body b { color: ${PAPER_INK}; font-weight: 700; }
        /* The one-line answer under the ask — display type in the brand
           gradient, on its own line where it can actually be read. */
        .lp4-method-line {
          margin: 1rem 0 0;
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: clamp(1.4rem, 3.4vw, 2rem);
          font-weight: 800;
          font-style: normal;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }

        /* ---- quotable callouts between sections (v189) ---- */
        /* v189.2 (founder instruction — the big text read badly): the quote
           BLOCK stays centred on the page, but the words are left-aligned
           against the blue rule with a taller line, so long quotes read as
           sentences instead of a floating slab. */
        .lp4-callout {
          margin: 0 auto;
          max-width: 44rem;
          padding: 0.5rem 0 0.5rem 1.5rem;
          border-left: 3px solid ${PAPER_ACCENT};
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: clamp(1.25rem, 3vw, 1.65rem);
          font-style: italic;
          font-weight: 700;
          line-height: 1.38;
          letter-spacing: -0.015em;
          text-align: left;
          color: ${PAPER_INK};
        }

        /* ---- the method's trust badges in the WHY band (v189) ---- */
        .lp4-trust { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 1.2rem 0 0; }
        .lp4-trust-lead {
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: ${PAPER_INK_FAINT};
          margin-right: 0.2rem;
        }
        .lp4-trust-pill {
          display: inline-flex;
          align-items: center;
          font-size: 0.875rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 0.26rem 0.66rem;
          border: 1px solid rgba(108, 155, 255, 0.3);
          background: rgba(0, 87, 255, 0.14);
          color: ${PAPER_ACCENT_TEXT};
        }

        /* ---- the method pills (v189) ---- */
        .lp4-method-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.4rem; }
        .lp4-method-pill {
          display: inline-flex;
          align-items: center;
          font-size: 0.875rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 0.45rem 0.9rem;
          border: 1px solid rgba(108, 155, 255, 0.32);
          background: rgba(0, 87, 255, 0.16);
          color: ${PAPER_ACCENT_TEXT};
        }

        /* ---- example reasons under the daily-plan features (v189): they
           name the METHOD, not just the timing. ---- */
        .lp4-reasons { list-style: none; margin: 1.4rem 0 0; padding: 0; display: grid; gap: 0.5rem; max-width: 32rem; }
        .lp4-reasons li {
          padding: 0.7rem 0.85rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 10px;
          background-image: ${PAPER_G_SUNK};
          font-size: 0.9rem;
          color: ${PAPER_INK_SOFT};
        }
        .lp4-reasons li b { color: ${PAPER_ACCENT_TEXT}; font-weight: 700; }

        /* ---- consequences: stark, specific and visible directly after hero ---- */
        .lp4-consequences { display: grid; gap: 0.8rem; margin-top: 1.6rem; }
        @media (min-width: 48rem) { .lp4-consequences { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .lp4-consequence {
          min-height: 152px;
          padding: 1.15rem 1.2rem;
          border: 1px solid ${PAPER_RULE};
          border-top: 3px solid ${PAPER_ACCENT};
          border-radius: 12px;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 18px 38px -30px rgba(22,31,43,.35);
        }
        .lp4-consequence b { display: block; color: ${PAPER_ACCENT_TEXT}; font-size: .75rem; letter-spacing: .12em; text-transform: uppercase; }
        .lp4-consequence p { margin: .75rem 0 0; color: ${PAPER_INK}; font-family: ${PAPER_FONT_DISPLAY}; font-size: 1.08rem; font-weight: 700; line-height: 1.42; }
        .lp4-weak-flow { display: grid; gap: .55rem; margin: 1.35rem 0 1.5rem; }
        @media (min-width: 46rem) { .lp4-weak-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; } }
        .lp4-weak-step { position: relative; padding: .9rem 1rem; border: 1px solid rgba(108,155,255,.34); border-radius: 10px; background: rgba(0,87,255,.12); color: ${PAPER_INK}; font-weight: 750; line-height: 1.35; }
        .lp4-weak-step:not(:last-child)::after { content: '→'; display: block; margin-top: .4rem; color: ${PAPER_ACCENT_TEXT}; }
        @media (min-width: 46rem) { .lp4-weak-step:not(:last-child)::after { position: absolute; right: -.55rem; top: 50%; z-index: 2; margin: 0; transform: translate(50%,-50%); } }
        .lp4-analysis-copy { grid-template-columns: minmax(0, 48rem) !important; }

        /* ---- the founder story (v189): dark card, blue left rule. ---- */
        .lp4-story {
          margin-top: 1.7rem;
          max-width: 40rem;
          padding: 1.4rem 1.5rem;
          border: 1px solid ${PAPER_RULE};
          border-left: 3px solid ${PAPER_ACCENT};
          border-radius: 0 12px 12px 0;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(22, 31, 43, 0.08), 0 22px 44px -32px rgba(22, 31, 43, 0.28);
        }
        .lp4-story p { font-size: 1.02rem; line-height: 1.6; color: ${PAPER_INK_SOFT}; }
        .lp4-story p:first-child { color: ${PAPER_INK}; }
        .lp4-story-sign { margin-top: 1rem; font-size: 0.875rem; font-weight: 800; letter-spacing: 0.04em; color: ${PAPER_ACCENT_TEXT}; }

        /* ---- the founder's note above the pricing cards (v189) ---- */
        .lp4-price-note {
          margin: 1.4rem 0 0;
          max-width: 40rem;
          padding: 1.05rem 1.2rem 1.05rem 1.45rem;
          border: 1px solid ${PAPER_RULE};
          border-left: 3px solid ${PAPER_ACCENT};
          border-radius: 0 10px 10px 0;
          background-image: ${PAPER_G_CARD};
          font-size: 1rem;
          font-style: italic;
          line-height: 1.6;
          color: ${PAPER_INK_SOFT};
        }
        /* The International-only concierge note. */
        .lp4-concierge {
          margin: 1rem 0 0;
          max-width: 38rem;
          padding: 0.85rem 1rem;
          border: 1px solid rgba(108, 155, 255, 0.3);
          border-radius: 10px;
          background: rgba(0, 87, 255, 0.12);
          font-size: 0.92rem;
          color: ${PAPER_INK};
        }
        .lp4-concierge a { color: ${PAPER_ACCENT_TEXT}; font-weight: 700; }

        /* ---- the single analysis band (v189): the recording takes the wider
           column and the row aligns to the top. ---- */
        .lp4-analysis { display: grid; gap: 2rem; align-items: start; margin-top: 2rem; }
        @media (min-width: 52rem) { .lp4-analysis { grid-template-columns: 1.15fr 1fr; gap: 3rem; } }

        /* ---- the join band ----
           One "I Want to Join" primary button — no form, no inputs, no email
           capture. The button wears the page's primary CTA style. */
        .lp4-contact { max-width: 40rem; margin-top: 1.9rem; }

        /* ================= LIGHT HERO SCOPE (v194) =================
           The hero section (.lp4-hero-glow) is a light sheet: every
           dark-canvas token that reaches into it is re-inked here. The dark
           sections below are untouched. */
        .lp4-hero-glow { color: #161F2B; }
        .lp4-hero-glow .lp4-lede,
        .lp4-hero-glow .lp4-reassure,
        .lp4-hero-glow .lp4-cta-proof,
        .lp4-hero-glow .lp4-exam-proof,
        .lp4-hero-glow .lp4-exam-proof-label,
        .lp4-hero-glow .lp4-demo-hint,
        .lp4-hero-glow .lp4-demo-head,
        .lp4-hero-glow .lp4-caption { color: #4A5568; }
        .lp4-hero-glow .lp4-hero h1 .lp4-grad,
        .lp4-hero-glow .lp4-grad {
          background-image: linear-gradient(96deg, #0057FF 0%, #2F82F5 55%, #003AB0 100%);
        }
        .lp4-hero-glow .lp4-for-exam {
          color: #0057FF;
          border-color: rgba(0, 87, 255, 0.4);
          background: rgba(0, 87, 255, 0.1);
        }
        .lp4-hero-glow .lp4-proof-chip {
          border-color: rgba(22, 31, 43, 0.14);
          background: rgba(255, 255, 255, 0.75);
          color: #3F4C63;
        }
        .lp4-hero-glow .lp4-proof-dot { color: rgba(22, 31, 43, 0.35); }
        .lp4-hero-glow .lp4-exam {
          background-image: none;
          background-color: #FFFFFF;
          border-color: rgba(22, 31, 43, 0.16);
          color: #3F4C63;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
        }
        .lp4-hero-glow .lp4-exam::before { background: rgba(22, 31, 43, 0.22); }
        .lp4-hero-glow .lp4-exam:hover { color: #161F2B; }
        .lp4-hero-glow .lp4-exam-on, .lp4-hero-glow .lp4-exam-on:hover {
          background-image: ${PAPER_G_BRAND};
          border-color: transparent;
          color: #FFFFFF;
        }
        .lp4-hero-glow .lp4-exam-on::before, .lp4-hero-glow .lp4-exam-on:hover::before { background: #FFFFFF; }
        .lp4-hero-glow .lp4-exam-more, .lp4-hero-glow .lp4-exam-more:hover {
          background-color: transparent;
          color: rgba(22, 31, 43, 0.45);
          border-color: rgba(22, 31, 43, 0.2);
        }
        .lp4-hero-glow .lp4-exam-pain {
          background: linear-gradient(135deg, rgba(0, 87, 255, 0.08) 0%, rgba(0, 87, 255, 0.03) 100%);
        }
        .lp4-hero-glow .lp4-exam-pain-tag { color: #0057FF; }
        .lp4-hero-glow .lp4-exam-pain p { color: #161F2B; }
        .lp4-hero-glow .lp4-demo {
          background-image: none;
          background-color: #FFFFFF;
          border-color: rgba(22, 31, 43, 0.12);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 26px 52px -30px rgba(22, 31, 43, 0.45);
        }
        .lp4-hero-glow .lp4-demo::after { background: radial-gradient(circle, rgba(0, 87, 255, 0.1), transparent 70%); }
        .lp4-hero-glow .lp4-demo-badge { color: #0057FF; border-color: rgba(0, 87, 255, 0.3); background: rgba(0, 87, 255, 0.1); }
        .lp4-hero-glow .lp4-field > span { color: #4A5568; }
        .lp4-hero-glow .lp4-field input, .lp4-hero-glow .lp4-field select {
          color: #161F2B;
          background-color: #F4F6FA;
          border-color: rgba(22, 31, 43, 0.16);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06) inset;
        }
        .lp4-hero-glow .lp4-field input::placeholder { color: rgba(22, 31, 43, 0.35); }
        .lp4-hero-glow .lp4-field input:focus, .lp4-hero-glow .lp4-field select:focus {
          border-color: #0057FF;
          box-shadow: 0 0 0 3px rgba(0, 87, 255, 0.18);
        }
        .lp4-hero-glow .lp4-select::after { border-right-color: #4A5568; border-bottom-color: #4A5568; }
        .lp4-hero-glow .lp4-demo-out { border-top-color: rgba(22, 31, 43, 0.1); }
        .lp4-hero-glow .lp4-sched li::before { background: #FFFFFF; border-color: rgba(22, 31, 43, 0.25); }
        .lp4-hero-glow .lp4-sched li:not(:last-child)::after { background: rgba(22, 31, 43, 0.12); }
        .lp4-hero-glow .lp4-tag { border-color: rgba(22, 31, 43, 0.14); background: rgba(22, 31, 43, 0.05); color: #3F4C63; }
        .lp4-hero-glow .lp4-sched-missed .lp4-tag { color: #C2372A; background: rgba(224, 80, 63, 0.1); border-color: rgba(224, 80, 63, 0.3); }
        .lp4-hero-glow .lp4-sched-missed .lp4-what { color: #C2372A; }
        .lp4-hero-glow .lp4-sched-due { background-color: rgba(0, 87, 255, 0.07); }
        .lp4-hero-glow .lp4-sched-due .lp4-when { color: #0E9F5D; }
        .lp4-hero-glow .lp4-sched-due .lp4-tag { color: #0E9F5D; background: rgba(14, 159, 93, 0.1); border-color: rgba(14, 159, 93, 0.3); }
        .lp4-hero-glow .lp4-verdict { color: #C2372A; background: rgba(224, 80, 63, 0.08); border-color: rgba(224, 80, 63, 0.28); }
        .lp4-hero-glow .lp4-verdict-ok { color: #0E9F5D; background: rgba(14, 159, 93, 0.08); border-color: rgba(14, 159, 93, 0.28); }
        .lp4-hero-glow .lp4-verdict small { color: #4A5568; }
        .lp4-hero-glow .lp4-scroll-cue span { border-right-color: #161F2B; border-bottom-color: #161F2B; }

        /* ---- motion ----
           Load + scroll motion (founder instruction, 2026-09-27): the hero
           staggers in on load, every band below fades up as it enters the
           viewport (the [data-reveal] observer in useEmailGateController,
           rooted on .eg-root — this page does not scroll the window), and
           the primary CTA breathes a slow blue glow. Opacity, transform and
           shadow only, so nothing here can shift layout — and ALL of it
           stands down under prefers-reduced-motion, because every animation
           is declared inside this no-preference block. */
        @media (prefers-reduced-motion: no-preference) {
          .lp4-sched li { animation: lp4Rise 0.32s ease-out both; }
          @keyframes lp4Rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
          /* The hero's staggered entrance — each element ~120ms behind the
             one before it, decelerating into place. */
          .lp4-hin { animation: lp4HeroIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .lp4-hin-2 { animation-delay: 110ms; }
          .lp4-hin-3 { animation-delay: 230ms; }
          .lp4-hin-4 { animation-delay: 350ms; }
          .lp4-hin-5 { animation-delay: 470ms; }
          .lp4-hin-6 { animation-delay: 580ms; }
          .lp4-hin-7 { animation-delay: 700ms; }
          /* The exam trust chips ripple in left-to-right — each chip carries
             its own inline animation-delay. */
          .lp4-chip-in { animation: lp4HeroIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
          @keyframes lp4HeroIn {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: none; }
          }
          /* The hero headline's gradient words shimmer on a slow loop
             (founder instruction, 2026-09-28) — background-position only. */
          .lp4-hero h1 .lp4-grad {
            background-size: 220% 100%;
            animation: lp4Shimmer 7s ease-in-out 1.2s infinite;
          }
          @keyframes lp4Shimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          /* The exam pills breathe a faint blue glow while idle and pop
             when picked (founder instruction, 2026-09-28). Hover cancels
             the idle breath so its own lift still reads. */
          [data-testid="row-exam-pills"] .lp4-exam:not(.lp4-exam-on):not(.lp4-exam-more) {
            animation: lp4PillIdle 4.4s ease-in-out infinite;
          }
          [data-testid="row-exam-pills"] .lp4-exam:not(.lp4-exam-on):not(.lp4-exam-more):nth-child(even) {
            animation-delay: 2.2s;
          }
          [data-testid="row-exam-pills"] .lp4-exam:hover { animation: none; }
          @keyframes lp4PillIdle {
            0%, 100% { box-shadow: 0 1px 1px rgba(16, 24, 40, 0.04); border-color: ${PAPER_RULE}; }
            50% { box-shadow: 0 0 14px -3px rgba(0, 87, 255, 0.45); border-color: rgba(0, 87, 255, 0.4); }
          }
          [data-testid="row-exam-pills"] .lp4-exam-on {
            animation: lp4ExamPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          @keyframes lp4ExamPop {
            0% { transform: scale(0.9); }
            55% { transform: scale(1.08); }
            100% { transform: scale(1); }
          }
          /* One slow breath on the primary action — attention, not alarm.
             Hover and press cancel it so their own shadow states still read. */
          .lp4-btn-primary { animation: lp4Glow 3.4s ease-in-out 1.4s infinite; }
          .lp4-btn-primary:hover, .lp4-btn-primary:active { animation: none; }
          @keyframes lp4Glow {
            0%, 100% {
              box-shadow:
                0 6px 26px rgba(0, 87, 255, 0.5),
                0 3px 9px rgba(0, 32, 110, 0.45),
                0 0 0 1px rgba(122, 165, 255, 0.22) inset;
            }
            50% {
              box-shadow:
                0 8px 32px rgba(0, 87, 255, 0.68),
                0 3px 11px rgba(0, 32, 110, 0.5),
                0 0 0 1px rgba(122, 165, 255, 0.3) inset,
                0 0 0 5px rgba(0, 87, 255, 0.16);
            }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp4-btn, .lp4-exam, .lp4-nav button, .lp4-nav a, .lp4-nav button::after, .lp4-nav a::after, .lp4-field input, .lp4-field select { transition: none; }
          .lp4-btn:hover, .lp4-btn:active, .lp4-exam:hover { transform: none; }
          .lp4-btn:hover::after { animation: none; opacity: 0; }
          .lp4-btn:hover .lp4-btn-arrow { transform: none; }
          .lp4-nav button:hover::after, .lp4-nav a:hover::after { transform: scaleX(1); }
        }

        /* ================= THE SCROLL NARRATIVE (Otto instruction,
           2026-09-30) ================= Nine scenes between the nav and the
           footer. Everything here reuses the paper tokens — no new colours,
           no new fonts — and all motion is opacity/transform/shadow only,
           standing down under prefers-reduced-motion. */
        /* -- hero montage: content arrives from everywhere -- */
        .lps-montage { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; margin-top: 1.35rem; }
        .lps-montage-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.34rem 0.78rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 999px;
          background: #FFFFFF;
          color: ${PAPER_INK_SOFT};
          font-size: 0.9rem;
          font-weight: 700;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }
        .lps-montage-arrow { color: ${PAPER_INK_FAINT}; font-size: 0.85rem; }
        /* -- the problem decay timeline -- */
        .lps-timeline { display: grid; gap: 0.8rem; margin-top: 2rem; }
        @media (min-width: 48rem) { .lps-timeline { grid-template-columns: repeat(4, 1fr); gap: 1rem; } }
        .lps-day {
          border: 1px solid ${PAPER_RULE};
          border-radius: 12px;
          padding: 1.05rem 1.1rem 1.15rem;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }
        .lps-day-label { margin: 0; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: ${PAPER_ACCENT_TEXT}; }
        .lps-day-topic { margin: 0.5rem 0 0; font-weight: 700; font-size: 0.95rem; color: ${PAPER_INK}; line-height: 1.4; }
        .lps-mem { display: block; height: 6px; margin-top: 0.85rem; border-radius: 999px; background: ${PAPER_SUNK}; overflow: hidden; }
        .lps-mem i { display: block; height: 100%; border-radius: 999px; background-image: ${PAPER_G_HELD}; }
        .lps-day-tag { margin: 0.55rem 0 0; font-size: 0.8rem; font-weight: 700; color: ${PAPER_INK_FAINT}; }
        .lps-day-gone { border-color: rgba(194, 55, 42, 0.35); }
        .lps-day-gone .lps-mem i { background-image: linear-gradient(90deg, #E0503F, ${PAPER_GONE}); }
        .lps-day-gone .lps-day-tag { color: ${PAPER_GONE}; }
        /* -- the two revision-gap questions, revealed one after the other -- */
        .lps-questions { margin-top: 0.6rem; }
        .lps-q {
          margin: 0.7rem 0 0;
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 800;
          font-size: clamp(1.9rem, 5vw, 3rem);
          letter-spacing: -0.022em;
          line-height: 1.08;
          color: ${PAPER_INK};
        }
        .lps-q + .lps-q { color: ${PAPER_ACCENT_TEXT}; }
        [data-reveal] .lps-questions .lps-q { opacity: 0; transform: translateY(24px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; }
        .eg-revealed .lps-questions .lps-q { opacity: 1; transform: translateY(0); }
        .eg-revealed .lps-questions .lps-q:nth-child(2) { transition-delay: 450ms; }
        /* -- the centred section break where VicharakAI enters -- */
        .lps-meet { text-align: center; max-width: 40rem; margin: 0 auto; }
        .lps-meet-logo { display: flex; align-items: center; justify-content: center; gap: 0.7rem; margin-bottom: 1.6rem; }
        /* -- the shared mock-UI card (the schedule + the Today list) -- */
        .lps-card {
          position: relative;
          overflow: hidden;
          margin-top: 2rem;
          max-width: 34rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 16px;
          padding: 1.35rem 1.4rem 1.45rem;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 26px 52px -30px rgba(22, 31, 43, 0.35);
        }
        .lps-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background-image: ${PAPER_G_BRAND}; }
        .lps-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; }
        .lps-card-title { margin: 0; font-family: ${PAPER_FONT_DISPLAY}; font-weight: 800; font-size: 1.08rem; letter-spacing: -0.015em; color: ${PAPER_INK}; }
        .lps-status-done {
          flex-shrink: 0;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${PAPER_KEPT};
          background: rgba(21, 128, 61, 0.1);
          border: 1px solid rgba(21, 128, 61, 0.3);
          border-radius: 999px;
          padding: 0.24rem 0.62rem;
        }
        .lps-slots-label { margin: 1.15rem 0 0.55rem; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${PAPER_INK_SOFT}; }
        .lps-slots { display: flex; flex-wrap: wrap; gap: 0.45rem; }
        .lps-slot {
          display: inline-flex;
          align-items: center;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 0.34rem 0.78rem;
          border: 1px solid rgba(0, 87, 255, 0.28);
          background: rgba(0, 87, 255, 0.08);
          color: ${PAPER_ACCENT_TEXT};
        }
        [data-reveal] .lps-slots .lps-slot { opacity: 0; transform: translateY(14px); transition: opacity 0.45s ease-out, transform 0.45s ease-out; }
        .eg-revealed .lps-slots .lps-slot { opacity: 1; transform: none; }
        .eg-revealed .lps-slots .lps-slot:nth-child(2) { transition-delay: 120ms; }
        .eg-revealed .lps-slots .lps-slot:nth-child(3) { transition-delay: 240ms; }
        .eg-revealed .lps-slots .lps-slot:nth-child(4) { transition-delay: 360ms; }
        .eg-revealed .lps-slots .lps-slot:nth-child(5) { transition-delay: 480ms; }
        /* -- the Today task list -- */
        .lps-tasks { list-style: none; margin: 0.9rem 0 0; padding: 0; }
        .lps-tasks li { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem 0.85rem; padding: 0.8rem 0; border-top: 1px solid ${PAPER_RULE}; }
        .lps-task-kind { flex-shrink: 0; min-width: 4.6rem; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${PAPER_ACCENT_TEXT}; }
        .lps-task-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
        .lps-task-main b { font-size: 0.95rem; font-weight: 700; color: ${PAPER_INK}; }
        .lps-task-main small { font-size: 0.82rem; color: ${PAPER_INK_SOFT}; }
        .lps-task-tag {
          flex-shrink: 0;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          border-radius: 999px;
          padding: 0.2rem 0.55rem;
          border: 1px solid ${PAPER_RULE};
          background: rgba(22, 31, 43, 0.05);
          color: ${PAPER_INK_SOFT};
        }
        /* -- the mistake-to-revision flow -- */
        .lps-mflow { display: grid; gap: 0.55rem; margin-top: 2rem; }
        @media (min-width: 52rem) { .lps-mflow { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.1rem; } }
        .lps-mstep { position: relative; padding: 0.95rem 1.05rem 1.05rem; border: 1px solid ${PAPER_RULE}; border-radius: 10px; background-image: ${PAPER_G_CARD}; }
        .lps-mstep b { display: block; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${PAPER_ACCENT_TEXT}; }
        .lps-mstep p { margin: 0.45rem 0 0; font-size: 0.95rem; font-weight: 600; line-height: 1.45; color: ${PAPER_INK}; }
        .lps-mstep:not(:last-child)::after { content: '→'; display: block; margin-top: 0.5rem; color: ${PAPER_ACCENT_TEXT}; font-weight: 700; }
        @media (min-width: 52rem) {
          .lps-mstep:not(:last-child)::after { position: absolute; right: -0.85rem; top: 50%; margin: 0; transform: translate(50%, -50%); z-index: 2; }
        }
        .lps-mstep-wrong { border-color: rgba(194, 55, 42, 0.35); }
        .lps-mstep-wrong b { color: ${PAPER_GONE}; }
        .lps-mstep-held { border-color: rgba(0, 87, 255, 0.4); background-image: linear-gradient(135deg, rgba(0, 87, 255, 0.1) 0%, rgba(0, 87, 255, 0.02) 100%); }
        /* -- the complete-system flow -- */
        .lps-sys { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.55rem; margin-top: 2rem; }
        .lps-sys-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.55rem;
          min-width: 6.2rem;
          padding: 1rem 0.9rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 12px;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }
        .lps-sys-item b { font-size: 0.875rem; font-weight: 700; color: ${PAPER_INK}; }
        .lps-sys-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: rgba(0, 87, 255, 0.1);
          border: 1px solid rgba(0, 87, 255, 0.25);
          color: ${PAPER_ACCENT_TEXT};
        }
        .lps-sys-arrow { align-self: center; color: ${PAPER_INK_FAINT}; font-weight: 700; }
        /* -- the final ask -- */
        .lps-final { padding: 4.6rem 0 4.8rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .lps-final-h { font-size: clamp(2.1rem, 5.6vw, 3.4rem); line-height: 1.08; }
        .lps-final .lp4-lede { max-width: 32rem; }
        .lps-final .lp4-legal { justify-content: center; margin-top: 1.6rem; }
        @media (max-width: 47.99rem) { .lps-final { padding: 3.4rem 0 3.8rem; } }
        /* -- montage motion: the six chips light up in sequence -- */
        @media (prefers-reduced-motion: no-preference) {
          .lps-montage-chip { animation: lpsMontageLit 4.8s ease-in-out infinite; }
          @keyframes lpsMontageLit {
            0%, 16%, 100% {
              background: #FFFFFF;
              color: ${PAPER_INK_SOFT};
              border-color: ${PAPER_RULE};
              transform: translateY(0);
              box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
            }
            5%, 11% {
              background: ${PAPER_ACCENT};
              color: #FFFFFF;
              border-color: transparent;
              transform: translateY(-2px);
              box-shadow: 0 8px 18px -8px rgba(0, 87, 255, 0.65);
            }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lps-montage-chip { animation: none; }
          [data-reveal] .lps-questions .lps-q,
          [data-reveal] .lps-slots .lps-slot { opacity: 1; transform: none; transition: none; }
        }
      `}</style>

      <div className="lp4">
        {/* The animated glow field behind everything — see .lp4-atmo. */}
        <div className="lp4-atmo" aria-hidden="true" />
        {/* ---------- Top bar ---------- */}
        <div className="lp4-top" data-scrolled={scrolled ? 'true' : 'false'}>
          <div className="lp4-sheet">
            <div className="lp4-top-in">
              <a className="lp4-brand" href={region.path}>
                <BrandMark size={28} radiusScale={0.28} blockColor="#0057FF" />
                <span className="lp4-word">
                  Vicharak<i>AI</i>
                </span>
              </a>
              <nav className="lp4-nav" data-testid="nav-section-links">
                {NAV_SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={activeNav === item.id ? 'lp4-nav-on' : undefined}
                    aria-current={activeNav === item.id ? 'true' : undefined}
                    onClick={() => {
                      setActiveNav(item.id);
                      scrollToSection(item.id);
                    }}
                    data-testid={`link-nav-${item.id}`}
                  >
                    {item.label}
                  </button>
                ))}
                {/* The public Learn hub — a real route, not a scroll target. */}
                <a href={LEARN_HREF} data-testid="link-nav-learn">
                  Learn
                </a>
              </nav>
              {/* EN | हिं (founder instruction, 2026-09-28) — headlines and
                  CTAs switch to Hinglish; body copy stays English. INDIA ONLY
                  (founder instruction, 2026-09-30): the selector renders on
                  the /in route alone — never on the international routes. */}
              {langEnabled ? (
                <div className="lp4-lang" role="group" aria-label="Language" data-testid="toggle-language">
                  <button type="button" aria-pressed={lang === 'en'} onClick={() => pickLang('en')} data-testid="button-lang-en">
                    EN
                  </button>
                  <button type="button" aria-pressed={lang === 'hi'} onClick={() => pickLang('hi')} data-testid="button-lang-hi">
                    हिं
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className="lp4-btn lp4-btn-sm"
                onClick={ctaHandler('nav')}
                data-testid="button-nav-get-started"
              >
                {tr('Start now')}
              </button>
            </div>
          </div>
        </div>

        {/* ---------- 1 · Hero ---------- */}
        {/* v194: the LIGHT hero — see .lp4-hero-glow above. */}
        <section className="lp4-section lp4-hero-glow" data-testid="section-hero">
          <div className="lp4-sheet">
            <div className="lp4-hero">
              <div className="lp4-hero-grid">
                <div>
                  {/* The offer leads. It is the single most important thing a
                      cold visitor has to register, and it has to survive being
                      read in three seconds on a phone. */}
                  <p className="lp4-offer lp4-hin lp4-hin-1" data-testid="hero-offer-badge">
                    {activeLang === 'hi'
                      ? `${TRIAL_DAYS} din free — card ki zaroorat nahi`
                      : `Try Free for ${TRIAL_DAYS} Days — no card needed`}
                  </p>
                  {/* THE STORY OPENS (Otto instruction, 2026-09-30): content
                      is everywhere — the question is what you do AFTER
                      studying it. One headline on every regional route. */}
                  <h1 className="lp4-hin lp4-hin-2" data-testid="hero-headline">
                    Content is <span className="lp4-grad">everywhere.</span>
                  </h1>
                  <p className="lp4-lede lp4-hero-sub lp4-hin lp4-hin-3" data-testid="hero-subheadline">
                    But what do you do <b style={{ color: PAPER_ACCENT_TEXT, fontWeight: 800 }}>AFTER</b> studying?
                  </p>
                  {/* THE MONTAGE: the six places content arrives from, lighting
                      up in rapid sequence — see .lps-montage. */}
                  <HeroMontage />

                  <p className="lp4-hero-cta lp4-hin lp4-hin-4">
                    <button
                      type="button"
                      className="lp4-btn lp4-btn-primary"
                      onClick={ctaHandler('hero')}
                      data-testid="button-open-login"
                    >
                      Start Free Trial
                      <span className="lp4-btn-arrow" aria-hidden="true">
                        →
                      </span>
                    </button>
                  </p>
                  <p className="lp4-reassure lp4-hin lp4-hin-5" data-testid="hero-cta-proof">
                    {examMatch
                      ? examMatch.proof
                      : activeLang === 'hi'
                        ? `Card nahi chahiye · ${TRIAL_DAYS} din free · Kabhi bhi cancel karo`
                        : `No credit card needed · ${TRIAL_DAYS} days free · Cancel anytime`}
                  </p>

                </div>
              </div>

              {/* Nine sections wait below — say so. See .lp4-scroll-cue. */}
              <div className="lp4-scroll-cue lp4-hin lp4-hin-7" aria-hidden="true">
                <span />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 2 · The real problem (Otto instruction, 2026-09-30) ---------- */}
        <StoryProblem />

        {/* ---------- 3 · The revision gap ---------- */}
        <StoryGap />

        {/* ---------- 4 · Meet VicharakAI ---------- */}
        <StoryMeet BrandMark={BrandMark} />

        {/* ---------- 5 · Automatic revision scheduling ---------- */}
        <StoryScheduling />

        {/* ---------- 6 · Today's work ---------- */}
        <StoryToday />

        {/* ---------- 7 · Mistakes become revision ---------- */}
        <StoryMistakes />

        {/* ---------- 8 · The complete system ---------- */}
        <StorySystem />

        {/* ---------- 9 · Final CTA — the ask, the honest price line and the
            legal links, just above the footer. Carries the pricing_view
            probe so the funnel step keeps reporting. ---------- */}
        <StoryFinalCta
          onStart={ctaHandler('close')}
          priceLine={`${TRIAL_DAYS}-day free trial · ${
            region.key === 'in' ? PLAN_PRICE_INR.monthly : PLAN_PRICE_USD.monthly
          }/month after · Cancel anytime`}
          probeRef={pricingProbeRef}
          legal={
            <p className="lp4-legal">
              <button type="button" onClick={() => onOpenLegal('terms')} style={legalLinkStyle} data-testid="link-final-terms">
                Terms of Service
              </button>
              <span style={{ color: PAPER_INK_FAINT }}>·</span>
              <button type="button" onClick={() => onOpenLegal('privacy')} style={legalLinkStyle} data-testid="link-final-privacy">
                Privacy Policy
              </button>
              <span style={{ color: PAPER_INK_FAINT }}>·</span>
              <a href={`mailto:${supportEmail}`} style={legalLinkStyle} data-testid="link-final-support">
                {supportEmail}
              </a>
            </p>
          }
        />

        {/* ---------- Compliance footer ---------- */}
        <div className="lp4-sheet">
          <div className="lp4-rule" aria-hidden="true" />
          <footer className="lp4-footer">
            <p style={{ margin: '0 0 0.6rem' }}>{region.footerLine}</p>
            <p style={{ margin: '0 0 0.6rem' }} data-testid="text-footer-made-by">
              Made by a student, for students.
            </p>
            <p style={{ margin: '0 0 0.6rem' }}>
              Interested? Drop us a message at{' '}
              <a href={`mailto:${supportEmail}`} data-testid="link-footer-drop-message">
                {supportEmail}
              </a>
            </p>
            <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem' }}>
              <span>© 2026 {t.brandName}</span>
              <span aria-hidden="true">·</span>
              <a href={LEARN_HREF} style={navLinkStyle} data-testid="link-footer-learn">
                Learn
              </a>
              <span aria-hidden="true">·</span>
              <a href="/about" style={navLinkStyle} data-testid="link-footer-about">
                About
              </a>
              <span aria-hidden="true">·</span>
              <a href="/terms" style={navLinkStyle} data-testid="link-footer-terms">
                Terms
              </a>
              <span aria-hidden="true">·</span>
              <a href="/privacy" style={navLinkStyle} data-testid="link-footer-privacy">
                Privacy
              </a>
              <span aria-hidden="true">·</span>
              <a href="/refund" style={navLinkStyle} data-testid="link-footer-refund">
                Refund Policy
              </a>
              <span aria-hidden="true">·</span>
              <a href="/contact" style={navLinkStyle} data-testid="link-footer-contact">
                Contact
              </a>
              <span aria-hidden="true">·</span>
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </nav>
          </footer>
        </div>
      </div>
    </>
  );
}
