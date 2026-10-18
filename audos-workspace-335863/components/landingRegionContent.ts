/**
 * SUPERSEDED (2026-09-01) — DO NOT IMPORT THIS FILE.
 *
 * The landing page now carries its two region experiences as two separate
 * pages instead of one page fed by a copy table:
 *
 *   India         → components/LandingMarketing.tsx (copy frozen by the
 *                   founder; ₹10 / ₹149 through Razorpay)
 *   International → components/LandingGlobalMarketing.tsx (MCAT/GRE/GMAT/
 *                   LSAT/UCAT/GAMSAT/A-Levels; $1 / $10 through Creem)
 *
 * The branch is resolved in useEmailGateController and applied in
 * EmailGateLanding.tsx. Nothing reads the table below, its `GeoRegion` import
 * no longer exists in emailGateShared (so importing this file would break the
 * build), and its exam lists and USD amounts are out of date. It is kept only
 * as a record of the earlier approach — edit the two pages above instead.
 *
 * ---------------------------------------------------------------------------
 * Original note follows.
 *
 * THE single source of truth for every region-specific word, price and
 * payment method on the signed-out landing page.
 *
 * WHY THIS FILE EXISTS (read before editing)
 * ------------------------------------------
 * VicharakAI runs separate Meta ad sets for India and for the United States.
 * The India creative promises JEE/NEET/UPSC prep at ₹10–₹149; the US creative
 * promises MCAT/USMLE/SAT prep at $1–$14.99. If a visitor who clicked one ad
 * lands on a page carrying the OTHER audience's exams, currency or payment
 * brand, the click is wasted and the campaign's measured conversion rate is
 * meaningless. So the two experiences share layout and brand and NOTHING else:
 *
 *   region 'IN'          → Indian exams only, ₹ only, Razorpay only.
 *   region 'US' / 'INTL' → US exams only, $ only, Creem only.
 *
 * There is deliberately NO blended list anywhere — "JEE, NEET, MCAT" in one
 * row defeats the entire purpose. 'INTL' currently renders the US copy (that
 * is the product decision, not an oversight); give it its own entry here if it
 * ever needs its own voice.
 *
 * Every landing sub-component takes `region: GeoRegion` and reads its copy
 * from regionContent(region) below, so an audit of the no-overlap rule is a
 * read of this one file rather than a crawl through the markup.
 */
import { PLAN_PRICE_INR, PLAN_PRICE_USD } from './emailGateShared';
import type { GeoRegion } from './emailGateShared';

export interface RegionContent {
  region: GeoRegion;
  /** Which checkout the pricing section offers. */
  checkout: 'razorpay' | 'creem';
  /** Display prices for this region — already carrying their currency symbol. */
  price: { day: string; monthly: string };
  /** The bare currency symbol, for the small glyph on the plan card. */
  currencyGlyph: string;
  /** Hero copy. The headline is brand-level and shared; the subheadline names
   *  the exams this audience actually sits. */
  heroSub: (brand: string) => string;
  /** Social-proof exam strip under the hero CTA. */
  examStripLabel: string;
  examChips: string[];
  /** Compliance-footer one-liner. */
  footerLine: string;
  /** The simulated coach exchange in the “add a task” demo card. */
  demo: { user: string; reply: string };
  /** Wording for the four-stage student journey. */
  journey: { pileUp: string; fixed: (brand: string) => string };
  /** Wording inside the phone mockups. */
  mockups: {
    loggedTask: string;
    loggedTaskMeta: string;
    revisionTask: string;
    revisionLabel: string;
    doubtMeta: string;
    doubtRespaced: string;
    priority: Array<{ topic: string; accuracy: string; weight: string }>;
    priorityNote: string;
  };
  /** Wording inside the five problem panels. */
  problem: { testPanelTitle: string; testPanelText: string; spacedText: string; attribution: string };
  /** Pricing-section payment line + footnote. */
  paymentMethodLine: string;
  pricingNote: string;
}

/* -------------------------------------------------------------------------- */
/*  India — ₹ pricing, Razorpay, Indian competitive-exam culture              */
/* -------------------------------------------------------------------------- */

const INDIA: RegionContent = {
  region: 'IN',
  checkout: 'razorpay',
  price: PLAN_PRICE_INR,
  currencyGlyph: '₹',
  heroSub: (brand) =>
    `Built for JEE, NEET and UPSC aspirants. Log what you study, then ${brand} learns your pace and scientifically schedules every spaced repetition session automatically.`,
  examStripLabel: 'Built for India’s toughest exams',
  examChips: [
    'JEE',
    'NEET',
    'NEET PG',
    'INICET',
    'UPSC',
    'MPSC',
    'CAT',
    'CLAT',
    'SSC',
    'RRB',
    'Banking',
    'Defence',
    'Teaching',
  ],
  footerLine:
    'Smarter revision for JEE, NEET, NEET PG, INICET, UPSC, MPSC, CAT, CLAT, SSC, RRB, Banking, Defence and Teaching aspirants.',
  demo: {
    user: 'Add task: Rotational Motion — Lecture 3',
    reply: [
      '**Got it — Rotational Motion logged.** Today’s plan:',
      '- **Now:** Thermodynamics Chapter 3 + 10 practice questions',
      '- **Tonight:** Organic Chemistry revision — a 5-minute recall check',
      '- **Day 3:** first spaced revision of Rotational Motion — already on your calendar',
      'Keep logging what you study — *by your second day, I already know your pace.*',
    ].join('\n'),
  },
  journey: {
    pileUp:
      'Three new coaching lectures this week. Now you have no idea what to revise first — or whether any of it will hold until the next mock.',
    fixed: (brand) =>
      `Add your daily task and ${brand} schedules every revision — board syllabus, coaching batch or self-study. It learns from what you complete: by your second day, it already knows your pace.`,
  },
  mockups: {
    loggedTask: 'Biology by Sharma Sir — Lecture 1',
    loggedTaskMeta: 'Online batch lecture · logged by you',
    revisionTask: 'Organic Chemistry — Revision due',
    revisionLabel: 'Auto-scheduled · spaced interval hit today',
    doubtMeta: 'Physics · Mock Test #4 · Rated: Hard',
    doubtRespaced: 'Re-appears in 3 days',
    priority: [
      { topic: 'Current Electricity', accuracy: '42% accuracy', weight: 'Weightage 8%' },
      { topic: 'Thermodynamics', accuracy: '67% accuracy', weight: 'Weightage 6%' },
      { topic: 'Optics', accuracy: '91% accuracy', weight: 'Weightage 5%' },
    ],
    priorityNote: 'Voice to text available. Syllabus weightage shown per topic.',
  },
  problem: {
    testPanelTitle: 'Mock test reveals the damage',
    testPanelText: 'You discover your gaps at mock time — too late to fix them.',
    spacedText:
      'Review at Day 1, 3, 5, 7, 14 and memory moves to long-term. Top rankers do exactly this.',
    attribution:
      'Ali Abdaal (6.8M subscribers) and Ishan Sharma have made videos on spaced repetition — it works.',
  },
  paymentMethodLine: 'Razorpay — UPI, cards, wallets',
  pricingNote: 'Charged in ₹ (INR) through Razorpay — UPI, cards and wallets, without leaving this page.',
};

/* -------------------------------------------------------------------------- */
/*  United States — $ pricing, Creem, US pre-med / grad-school culture        */
/* -------------------------------------------------------------------------- */

const UNITED_STATES: RegionContent = {
  region: 'US',
  checkout: 'creem',
  price: PLAN_PRICE_USD,
  currencyGlyph: '$',
  heroSub: (brand) =>
    `Built for MCAT, USMLE and SAT prep. Log what you study, then ${brand} learns your pace and scientifically schedules every spaced repetition session automatically.`,
  examStripLabel: 'Built for the exams that decide your next step',
  examChips: [
    'MCAT',
    'USMLE Step 1',
    'USMLE Step 2',
    'USMLE Step 3',
    'SAT',
    'GRE',
    'GMAT',
    'LSAT',
    'NCLEX',
  ],
  footerLine: 'Smarter review for MCAT, USMLE, SAT, GRE, GMAT, LSAT and NCLEX students.',
  demo: {
    user: 'Add task: MCAT Biochem — Amino Acids lecture',
    reply: [
      '**Got it — Amino Acids logged.** Today’s plan:',
      '- **Now:** MCAT Biochemistry passage practice + 10 discrete questions',
      '- **Tonight:** Organ Systems review — a 5-minute recall check',
      '- **Day 3:** first spaced review of Amino Acids — already on your calendar',
      'Keep logging what you study — *by your second day, I already know your pace.*',
    ].join('\n'),
  },
  journey: {
    pileUp:
      'Three new lecture blocks this week. Now you have no idea what to review first — or whether any of it will hold until your next practice test.',
    fixed: (brand) =>
      `Add your daily task and ${brand} schedules every review — course lectures, prep books or self-study. It learns from what you complete: by your second day, it already knows your pace.`,
  },
  mockups: {
    loggedTask: 'Biochemistry — Lecture 12',
    loggedTaskMeta: 'Course lecture · logged by you',
    revisionTask: 'Amino Acids & Proteins — Review due',
    revisionLabel: 'Auto-scheduled · spaced interval hit today',
    doubtMeta: 'Biochemistry · Practice Test #4 · Rated: Hard',
    doubtRespaced: 'Re-appears in 3 days',
    priority: [
      { topic: 'Cardiovascular System', accuracy: '42% accuracy', weight: 'Test weight 8%' },
      { topic: 'Amino Acids & Proteins', accuracy: '67% accuracy', weight: 'Test weight 6%' },
      { topic: 'Behavioral Science', accuracy: '91% accuracy', weight: 'Test weight 5%' },
    ],
    priorityNote: 'Voice to text available. Test weighting shown per topic.',
  },
  problem: {
    testPanelTitle: 'The practice test reveals the damage',
    testPanelText: 'You discover your gaps on test day — too late to fix them.',
    spacedText:
      'Review at Day 1, 3, 5, 7, 14 and memory moves to long-term. Top scorers do exactly this.',
    attribution:
      'Ali Abdaal (6.8M subscribers) and Thomas Frank have made videos on spaced repetition — it works.',
  },
  paymentMethodLine: 'Creem — secure international card checkout',
  pricingNote: 'Charged in $ (USD) through Creem — secure international checkout, cancel anytime.',
};

/* 'INTL' is the US experience with its own region tag, so analytics can still
 * tell an American visitor apart from a rest-of-world one. */
const INTERNATIONAL: RegionContent = { ...UNITED_STATES, region: 'INTL' };

const BY_REGION: Record<GeoRegion, RegionContent> = {
  IN: INDIA,
  US: UNITED_STATES,
  INTL: INTERNATIONAL,
};

/** The complete copy set for a region. Anything undecided resolves to the
 * international set, never to India — a wrong guess that shows rupees to a US
 * ad click is the expensive one. */
export function regionContent(region: GeoRegion | null | undefined): RegionContent {
  return region ? BY_REGION[region] ?? INTERNATIONAL : INTERNATIONAL;
}

/** True only for the India experience. Sub-components use this for the handful
 * of layout choices that follow from the region rather than the copy. */
export function isIndiaRegion(region: GeoRegion | null | undefined): boolean {
  return region === 'IN';
}
