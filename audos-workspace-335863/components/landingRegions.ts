import { TRIAL_DURATION_DAYS } from '../apps/VicharakAI/access';
import {
  PLAN_PRICE_INR,
  SEO_CANONICAL_URL,
  SEO_DESCRIPTION,
  SEO_OG_TITLE,
  SEO_SOCIAL_IMAGE,
  SEO_TITLE,
  deviceTimeZone,
  fetchGeoCountry,
  fetchIpApiCountry,
  readCachedGeoCountry,
  upsertHeadTag,
} from './emailGateShared';

/**
 * THE REGIONAL LANDING CONFIGURATION — one shared page, four configured faces.
 *
 * VicharakAI acquires students from four different markets whose exams,
 * currency and academic vocabulary do not overlap. Rather than a country
 * dropdown on one blended page (which would show "JEE, NEET, MCAT" in a single
 * row and convert nobody), each market gets its OWN route rendering the SAME
 * component library from the configuration below:
 *
 *   /in      → India          — JEE, NEET, UPSC, CAT, GATE, Boards, NEET PG (INR, Razorpay)
 *   /us      → United States  — SAT, ACT, AP, MCAT, GRE, GMAT, LSAT (USD, Creem)
 *   /uk      → United Kingdom — GCSE, A-Level, UCAT, IB, IGCSE (GBP shown, Creem)
 *   /global  → International  — IB, IGCSE, SAT, A-Level, University Entrance (USD, Creem)
 *
 * NOTHING IS DUPLICATED IN CODE. components/LandingPage.tsx renders one region
 * config; the mockups, the retention chart and the design tokens are shared.
 * To change a price, an exam list, a meta description or a piece of
 * terminology, edit the entry below — never a visual component.
 *
 * PRICING LIVES HERE AND ONLY HERE (founder instruction, 2026-09-02). No
 * currency symbol or amount may be hardcoded into a component. India reads its
 * figures from PLAN_PRICE_INR in emailGateShared, so the landing page can never
 * drift from what Razorpay actually charges.
 *
 * ROUTING. The space is a client-rendered bundle served at the domain root, so
 * these routes resolve the same way the legal pages do (see StaticPages.tsx):
 * the HASH form (#/in) is what the in-page switcher links to, because it
 * survives a direct load and a refresh on any host. readLandingRegionFromLocation()
 * ALSO recognises the real pathname (/in), so the moment the host is configured
 * to rewrite /in, /us, /uk and /global onto this bundle, those become working
 * crawlable URLs with no code change.
 *
 * THE ROOT ROUTE geo-redirects: a visitor landing on the bare root is sent to
 * their regional route. The visitor's OWN saved choice (the switcher writes it
 * to localStorage under 'vicharakai_region') wins outright and skips the geo
 * lookup entirely; otherwise resolveLandingRegion() reads the country
 * (ipapi.co → the workspace `geo` server function → the device clock), capped
 * overall by resolveLandingRegionWithTimeout so a slow lookup can never hold
 * the visitor, and everything unknowable falls back to Global. A URL that
 * names its region (/uk, #/uk) is always honoured exactly as written — a
 * shared link means what it says and is never overridden by preference or geo.
 *
 * CHECKOUT IS NOT DECIDED HERE. Every CTA on every regional page opens the same
 * sign-up (openLogin) — the regional page is the acquisition surface, and the
 * charge itself stays on the existing IP-based routing in
 * useEmailGateController (India → Razorpay/INR, international → Creem/USD).
 * `pricing.checkout` below is what the page SAYS, and `pricing.footnote` is
 * where a region tells the visitor the currency it is actually billed in.
 */

/**
 * THE TRIAL LENGTH AND THE CTA WORDS — one definition, every surface.
 *
 * The trial was extended 3 → 7 days on 2026-09-27 and the number is read from
 * apps/VicharakAI/access.ts (TRIAL_DURATION_DAYS), which is the same constant
 * the app writes into vicharakai_trials. The landing page therefore cannot
 * promise a length the product does not grant.
 *
 * THE CTA COPY (2026-09-28 copy pass). Every PRIMARY call to action on the
 * page — hero, mobile sticky bar, the mid-page repeats and the pricing trial
 * card — carries the same label: "Start for free — 7-day trial". The number
 * is never typed: it comes from TRIAL_DAYS, so the button can never promise
 * a trial length the product does not grant. One ask, everywhere; the fuller
 * free-trial reassurance travels beside the button (the offer pill and the
 * reassure line). Import these rather than typing a second variant into a
 * component. Secondary buttons, nav links and form labels keep their own copy.
 */
export const TRIAL_DAYS = TRIAL_DURATION_DAYS;
export const PRIMARY_CTA = `Start for free — ${TRIAL_DAYS}-day trial`;
export const TRIAL_CTA = `Start for free — ${TRIAL_DAYS}-day trial`;

export type RegionKey = 'in' | 'us' | 'uk' | 'global';

/** The vocabulary a market actually uses. Shared copy is templated on these,
 *  so "revision/mock/syllabus/chapter" becomes "review/practice test/course/unit"
 *  without a second copy of the paragraph. */
export interface RegionTerms {
  /** The noun for coming back to material: revision / review. */
  revision: string;
  /** Verb form: revise / review. */
  revise: string;
  /** Gerund: revising / reviewing. */
  revising: string;
  /** Past tense: revised / reviewed. */
  revised: string;
  /** A practice exam: mock / practice test / mock exam. */
  mock: string;
  /** Plural of the above. */
  mocks: string;
  /** The body of material: syllabus / course / specification. */
  syllabus: string;
  /** A division of it: chapter / unit / module / topic. */
  chapter: string;
  /** Plural of the above. */
  chapters: string;
  /** What this market calls the person studying: aspirant / student. */
  learner: string;
  /** Plural of the above. */
  learners: string;
  /** The word in "Your mistakes become your ___ system." */
  systemWord: string;
}

/** Every background on the page. SINCE 2026-09-03 (founder instruction) the
 *  page's SECTION backgrounds are painted by the four shared --g-* gradient
 *  tokens in landingTokens.ts, applied inside LandingPage.tsx so all four
 *  regional routes carry one strictly-blue treatment. Of the values below,
 *  only `page` (the scroll container's canvas) still renders — the rest are
 *  kept for the record and for any future re-divergence of the regions. */
export interface RegionGradients {
  /** The scroll container's own canvas, behind everything. */
  page: string;
  /** Hero section — carries the region's signature glow. */
  hero: string;
  /** The alternating (deeper) section fill. */
  section: string;
  /** The plain section fill between them. */
  plain: string;
  /** Closing CTA — the hero glow, lit from below. */
  close: string;
  /** Card hover lift, tinted to the region's secondary hue. */
  cardGlow: string;
}

export interface RegionPlan {
  /** Small caps label above the price. */
  label: string;
  /** The price WITH its currency symbol — the only place a figure lives. */
  price: string;
  /** "/month", "/day". */
  unit: string;
  /** One line of justification under the price. */
  note: string;
}

export interface RegionPricing {
  /** ISO currency code, for analytics and for the schema markup. */
  currency: string;
  /** The bare glyph — ₹, $, £. */
  symbol: string;
  /** The headline subscription. */
  monthly: RegionPlan;
  /** The free trial — every account starts here. The old paid day
   *  pass was removed on 2026-09-27; this card replaces it. */
  trial: RegionPlan;
  /** Which checkout this market is routed to once they subscribe. */
  checkout: 'razorpay' | 'creem';
  /** The honest note about what the card is actually billed in. */
  footnote: string;
}

export interface RegionSeo {
  title: string;
  description: string;
  keywords: string;
  ogDescription: string;
  /** BCP-47 tag for the hreflang alternates. */
  hreflang: string;
}

export interface RegionStep {
  icon: string;
  label: string;
  text: string;
}

export interface RegionFeature {
  title: string;
  /** The full description — kept in the config, no longer rendered on the
   *  landing page (the image-first feature section shows `brief` instead). */
  text: string;
  /** One line, for the condensed feature list beside “The Clarity” photo
   *  (founder instruction, 2026-09-03) — never a paragraph. */
  brief: string;
}

/** A real, attributable student quote. SHIPPED EMPTY ON PURPOSE — inventing
 *  testimonials would put words in students' mouths. Drop real ones in here
 *  per region and the proof section renders them automatically. */
export interface RegionTestimonial {
  quote: string;
  name: string;
  detail: string;
}

/** The wording inside the phone mockups. The app screens are the same; the
 *  subjects, papers and test names on them are not. */
export interface RegionMockups {
  mistakeBookSubtitle: string;
  captureSubject: string;
  captureChips: [string, string];
  captureCaption: string;
  rows: Array<{ topic: string; meta: string; due: string }>;
  todaySubtitle: string;
  tasks: Array<{ title: string; why: string; chip?: string }>;
  todayFooter: string;
}

/** One key callout in the Test Analysis section. */
export interface RegionTestCallout {
  title: string;
  text: string;
}

/** The wording inside the Test Analysis phone mockup. */
export interface RegionTestAnalysisMockup {
  title: string;
  subtitle: string;
  /** Small caps label on the auto-detected crop. */
  cropLabel: string;
  /** The question put to the student under the cropped question. */
  prompt: string;
  /** The four reasons a wrong answer is tagged with. */
  errorTypes: string[];
  footer: string;
}

/**
 * THE TEST ANALYSIS SECTION. The behaviour is universal — every market takes
 * practice exams, looks at the score and never opens the paper again — so the
 * copy is identical everywhere and only the VOCABULARY moves: a paper is a
 * 'mock test' in India, a 'practice test' in the US and internationally, and a
 * 'mock exam' in the UK. `testTerm` carries that word (the section says it in
 * full, unlike RegionTerms.mock which India shortens to 'mock'), and the
 * revision/review noun still comes from RegionTerms.
 */
export interface RegionTestAnalysis {
  /** This market's word for a practice exam, spelled out. */
  testTerm: string;
  /** Plural of the above. */
  testTermPlural: string;
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  callouts: RegionTestCallout[];
  /** The line under the phone mockup. */
  caption: string;
  mockup: RegionTestAnalysisMockup;
}

/**
 * THE HERO DEMO (founder mockup, 2026-09-06) — the interactive moment at the
 * top of the page. A visitor types a topic they finished and how long ago,
 * and the page prints the five dates that topic needed to come back on,
 * marking the ones already missed. No signup, no network call: the dates are
 * computed in the browser from the 1/3/7/14/30 spacing the app really uses.
 *
 * `{item}` and `{n}` are substituted by the component.
 */
export interface RegionDemo {
  heading: string;
  hint: string;
  itemLabel: string;
  whenLabel: string;
  options: Array<{ days: number; label: string }>;
  cta: string;
  /** e.g. “Here’s when {item} needed to come back:” */
  resultLead: string;
  /** The row label: “Revision 1” / “Review 1”. */
  rowLabel: string;
  onTrack: string;
  onTrackNote: string;
  /** e.g. “You’ve already missed {n} of the 5 revisions for {item}.” */
  missed: string;
  missedNote: string;
}

/** One doubt a visitor arrives with, answered plainly. */
export interface RegionObjection {
  q: string;
  a: string;
}

/** One stage of the compounding-memory loop. */
export interface RegionMemoryStep {
  /** How far into using it this stage sits: “Week 1”, “Week 4”, “Week 12”. */
  when: string;
  title: string;
  text: string;
}

/**
 * THE COMPOUNDING MEMORY LOOP (founder instruction, 2026-09-27) — the actual
 * differentiator, and the one thing the page never said out loud.
 *
 * Every incumbent hands all of its students the same plan. VicharakAI builds
 * a memory of ONE student from every session they log, so its advice gets
 * more personal the longer it runs. A visitor who does not understand that
 * has no reason to prefer this over the app they already pay for, which is
 * why it now gets a band of its own rather than one clause in a feature list.
 */
export interface RegionMemory {
  heading: string;
  lede: string;
  steps: RegionMemoryStep[];
  kicker: string;
}

/**
 * THE PROBLEM IN STUDENTS' OWN WORDS.
 *
 * Deliberately NOT testimonials: no names, no ratings, and no suggestion that
 * anyone said these about the product. They are the pain stated the way a
 * student states it, and `note` tells the reader exactly that. Inventing a
 * five-star review would have been the easy version and the dishonest one —
 * real attributable quotes still go in `proof.testimonials`, and the one that
 * is there is signed as the founder because that is who said it.
 */
export interface RegionPainVoices {
  heading: string;
  /** The line that makes the framing explicit, so nothing here reads as a
   *  review a customer left. */
  note: string;
  lines: string[];
}

/** What a first week actually changes, stated as what the product does
 *  rather than as a review nobody has given yet. */
export interface RegionOutcomes {
  heading: string;
  lines: string[];
}

export interface RegionConfig {
  key: RegionKey;
  /** The real path this region is meant to own: /in, /us, /uk, /global. */
  path: string;
  /** The working in-bundle route the switcher links to. */
  hash: string;
  /** Long name, for the pricing card and the meta copy. */
  label: string;
  /** Short name, for the switcher. */
  shortLabel: string;
  terms: RegionTerms;
  gradients: RegionGradients;
  seo: RegionSeo;
  /** The exam chips under the hero. */
  exams: string[];
  hero: {
    /** Kept for the record — the paper layout leads with the exam chips and
     *  the headline, so no eyebrow renders above the H1. */
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    sub: string;
    /** The hero descriptor paragraph under the sub-headline — what the
     *  product actually does with your last test. */
    body: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  /** The line under every primary CTA: what the free trial actually gives. */
  reassure: string;
  /** A quiet chip after the exam list, e.g. “+24 more exams”. Only set where
   *  the market really has more than the chips show. */
  examsMore?: string;
  /** The interactive hero demo. */
  demo: RegionDemo;
  problem: {
    heading: string;
    /** The pain in a student's OWN voice, set above the argument. A cold
     *  visitor has to feel recognised before they will read a paragraph. */
    voice: string;
    paragraphs: string[];
    /** The line under the week-decay strip. */
    weeksKey: string;
    /** The central product story, in the founder's words. */
    manifesto: string;
  };
  /** The compounding-memory loop — why this gets better the longer you use
   *  it, and why no other app's plan looks like yours. */
  memory: RegionMemory;
  /** The doubts section, answered plainly. */
  objections: {
    heading: string;
    items: RegionObjection[];
  };
  shift: {
    heading: string;
    steps: RegionStep[];
    kicker: string;
    note: string;
    /** The spaced-repetition promise in plain words — a prominent callout in
     *  the how-it-works section. No scheme names, no jargon. */
    spacedQuote: string;
    captureCaption: string;
    planCaption: string;
    /** Caption under the Calendar screenshot in the how-it-works row. */
    calendarCaption: string;
  };
  features: {
    /** Section heading over the image-first feature layout. */
    heading: string;
    /** The differentiator in one direct student-facing paragraph. */
    description: string;
    /** Only the first three cards render, as one-line points. */
    cards: RegionFeature[];
    /** Caption under “The Clarity” photo. */
    todayCaption: string;
  };
  proof: {
    heading: string;
    points: string[];
    testimonials: RegionTestimonial[];
    /** The pain in students' own words — explicitly not reviews. */
    painVoices: RegionPainVoices;
    /** What a first week actually changes — not reviews either. */
    outcomes: RegionOutcomes;
  };
  pricing: RegionPricing & {
    heading: string;
    /** The value anchor above the plans — what the visitor has already spent. */
    anchor: string;
    includeLine: string;
    trialLine: string;
  };
  founder: {
    heading: string;
    paragraphs: string[];
    /** The human sign-off under the story — rendered as “— <em>signoff</em>”. */
    signoff: string;
  };
  close: {
    heading: string;
    description: string;
    cta: string;
    note: string;
  };
  /** The Test Analysis section — one universal behaviour, four vocabularies. */
  testAnalysis: RegionTestAnalysis;
  /** The one-line description in the compliance footer. */
  footerLine: string;
  mockups: RegionMockups;
  /** Labels on the memory-retention chart. */
  chart: {
    ariaLabel: string;
    yAxis: string;
    xAxis: string;
    legendWithout: string;
  };
}

/* ==========================================================================
 *  SHARED COPY — written once, spoken in each market's vocabulary.
 *  Anything genuinely brand-level (the three capture steps, the five product
 *  pillars, the spaced-repetition callout, the founder note) is built from these
 *  templates so a wording fix lands on all four pages at once.
 * ======================================================================== */

/**
 * THE FOUR-STEP PRODUCT STORY (founder brief, 2026-09-06): snap a mistake →
 * it gets scheduled → it learns your gaps → the day arrives already planned.
 * Written once and spoken in each market's vocabulary — ALL FOUR REGIONS use
 * it, India included (the Hinglish variants were retired in v176; the page is
 * English everywhere).
 */
function sharedSteps(x: RegionTerms): RegionStep[] {
  // `icon` carries the small step kicker over each panel; the three panels
  // read as the product's whole loop (founder instruction, 2026-09-27), each
  // with its own animated CSS illustration in LandingPage.tsx.
  return [
    {
      icon: 'Step 1',
      label: 'Log what you studied',
      text: `Thirty seconds at night: tap the ${x.chapter} you covered, from your own ${x.syllabus}.`,
    },
    {
      icon: 'Step 2',
      label: 'It gets spaced — day 1, 3, 7, 14, 28',
      text: `Five ${x.revision} dates are booked instantly, timed to when memory fades. How each one goes moves the next.`,
    },
    {
      icon: 'Step 3',
      label: 'It surfaces before you forget',
      text: `The ${x.chapter} lands back on your plan by itself — before it slips, not after the ${x.mock} finds it.`,
    },
  ];
}

/** The problem heading — stated as the thing that actually happens. */
function sharedProblemHeading(x: RegionTerms): string {
  return `You finish a ${x.chapter}. Three new ones arrive. You never go back.`;
}

/** THE PROBLEM: the work gets done, nothing brings it back, and the gap
 *  surfaces at the worst possible moment. Two short paragraphs, because the
 *  heading above them already says the new lectures keep arriving — repeating
 *  that here cost a phone reader a screen for nothing (2026-09-27). */
function sharedProblem(x: RegionTerms): string[] {
  return [
    `Weeks later that ${x.chapter} is blank — and you find out in the middle of a ${x.mock}.`,
    'The problem was never effort. Nothing tells you what to go back to, or when.',
  ];
}

/**
 * THE PAIN IN THE STUDENT'S OWN VOICE (founder instruction, 2026-09-27;
 * reworded in the 2026-09-28 copy pass).
 *
 * The single most useful line on the page for a cold visitor: the sentence a
 * student is already saying to themselves at 1am, printed back at them before
 * the page argues anything. It is a human sentence rather than a
 * market-specific one, so every route carries it unchanged.
 */
function sharedProblemVoice(): string {
  return 'I study every day — but nothing sticks, and I only find out what I’m missing when it’s too late.';
}

/** The line under the two week-decay strips. NOT RENDERED since 2026-09-27 —
 *  the strips were removed (the memory diagram beside them made the same
 *  point), and this sentence went with them. Kept so the copy is one edit away
 *  if the strips ever come back. */
function sharedWeeksKey(x: RegionTerms): string {
  const Revise = `${x.revise.charAt(0).toUpperCase()}${x.revise.slice(1)}`;
  return `One ${x.chapter}, left alone. By week eight there is almost nothing left — and you find out at the ${x.mock}. ${Revise} it on day 1, 3, 7, 14 and 28 and it stays. Miss those windows and it goes.`;
}

/** The one paragraph under the differentiator heading. */
function sharedFeatureIntro(x: RegionTerms): string {
  return `Most students find the gap at a ${x.mock} — by then it is too late. VicharakAI reads your daily log, spots the topics going quiet, and moves them from short-term into long-term memory before they cost you anything.`;
}

/** The line under the CLOSING CTA — the last thing a visitor reads before
 *  they leave or sign up, and the third place the offer has to be stated in
 *  full (hero pill, mid-page CTAs, here). It said “No commitment · Cancel
 *  anytime · Instant access” until 2026-09-27, which never mentioned the free
 *  trial or the absence of a card. Identical everywhere — the trial does not
 *  vary by market. */
function sharedReassure(): string {
  return `Free for ${TRIAL_DAYS} days · No credit card needed · Cancel anytime`;
}

/** THE HERO DEMO copy, in each market's vocabulary. */
function sharedDemo(x: RegionTerms): RegionDemo {
  const Revision = `${x.revision.charAt(0).toUpperCase()}${x.revision.slice(1)}`;
  return {
    heading: `See it on your own ${x.chapter}`,
    hint: 'No signup. Takes ten seconds.',
    itemLabel: `A ${x.chapter} you’ve already finished`,
    whenLabel: 'When did you study it?',
    options: [
      { days: 3, label: '3 days ago' },
      { days: 10, label: 'About 10 days ago' },
      { days: 30, label: 'About a month ago' },
      { days: 75, label: 'Two to three months ago' },
    ],
    cta: `Show my ${x.revision} dates`,
    resultLead: 'Here’s when {item} needed to come back:',
    rowLabel: Revision,
    onTrack: 'You’re still inside the window.',
    onTrackNote: 'Log it tonight and it will not slip.',
    missed: 'You’ve already missed {n} of the 5 {revisions} for {item}.',
    missedNote: `That’s one ${x.chapter}. You have about ninety.`,
  };
}

/** THE DOUBTS a visitor actually arrives with, answered plainly. */
function sharedObjections(x: RegionTerms): { heading: string; items: RegionObjection[] } {
  return {
    heading: 'The things you’re probably thinking.',
    items: [
      {
        q: 'I don’t have time for another app.',
        a: `Thirty seconds at night to log the ${x.chapter}. Everything after that happens without you.`,
      },
      {
        q: 'I already pay for lectures and a question bank.',
        a: 'This is not another course. It tells you when to go back to the ones you have already bought.',
      },
      {
        q: 'I tried Anki and quit.',
        a: `Most people quit at deck-making. There are no decks here. You tap a ${x.chapter} name and the schedule builds itself.`,
      },
      {
        q: 'Are my papers and mistakes private?',
        a: 'Yes. Only you can see them, and you can delete your account and everything in it whenever you want.',
      },
      {
        q: 'What if I fall behind for a week?',
        a: `Missed ${x.revision} tasks get rescheduled automatically. Nothing turns red, nothing shames you.`,
      },
    ],
  };
}

/** The spaced-repetition promise in plain words (founder instruction,
 *  2026-09-05): no scheme names, no jargon. NOT RENDERED since 2026-09-27 —
 *  as a pull quote it restated the three steps directly above it, and the
 *  how-it-works band now carries one credibility line instead. */
function sharedSpacedQuote(x: RegionTerms): string {
  const verb = `${x.revise.charAt(0).toUpperCase()}${x.revise.slice(1)}`;
  return `${verb} the right topics at the right time — VicharakAI spaces your ${x.revision} automatically, so nothing slips through.`;
}

/** THE FOUR BEATS beside the Today phone — what the morning screen is
 *  actually doing for you. Plain words only: no scheme names and no
 *  card-and-deck vocabulary anywhere. All four render. */
function sharedFeatures(x: RegionTerms): RegionFeature[] {
  return [
    {
      title: 'Every task says why it is there',
      text: `Not a bare topic name. Each row carries its reason AND its method — “Active recall — you got this wrong in ${x.mock} 4. Take a blank page.” — so you can see the list is not random.`,
      brief: `Each row names the method, not just the timing: “Active recall — you got this wrong in ${x.mock} 4. Take a blank page.”`,
    },
    {
      title: 'It tells you if you will finish in time',
      text: 'Your pace is measured against your real exam date, every day, from what you have actually logged.',
      brief: 'Measured against your real exam date — so you read “on track”, or the truth, months early.',
    },
    {
      title: 'Tests built from your own lost marks',
      text: `A self-marked test weighted by where you actually dropped marks, drawn from your ${x.revision} queue and your Mistake Book.`,
      brief: `A test weighted by where you actually dropped marks in your logged ${x.mocks} — not a generic set.`,
    },
    {
      title: `Your exam’s real ${x.chapter} list is already inside`,
      text: `Every ${x.chapter} of your own ${x.syllabus}, colour-coded by how well you have held onto it.`,
      brief: `Every ${x.chapter} colour-coded by how well you have held onto it. Nothing to set up.`,
    },
  ];
}

/**
 * THE FOUNDER STORY (founder instruction, 2026-09-27) — the conversion
 * anchor: a personal, human “Why I built this” note rendered as a warm paper
 * card with an electric-blue left border. The copy is the founder's own, near-verbatim;
 * only the mock/practice-test noun is spoken in the market's vocabulary.
 * `*word*` marks an emphasised word — LandingPage renders it as <em>.
 */
function sharedFounderNote(x: RegionTerms): string[] {
  return [
    `I was studying 8+ hours a day for competitive exams. By the time ${x.mocks} came, half of what I’d covered had quietly slipped away — and I didn’t know *which* half.`,
    'I spent months reading research on how memory actually works — spaced repetition, active recall, how short-term memory becomes long-term. I built the system I wish I’d had when I was preparing.',
    'VicharakAI isn’t another study app. It’s the thing that remembers for you — so you can actually trust your preparation.',
  ];
}

/** The sign-off under the founder story — human, deliberately not a title. */
const FOUNDER_SIGNOFF = 'A student who learned it the hard way';

/** The central product story — the same claim on every page, in each market's
 *  words. This is the paragraph the whole page exists to make true. */
function sharedManifesto(): string {
  return 'Students don’t need another app to organise. They need a system that remembers what they studied, what they got wrong, and what has to come back next.';
}

/**
 * THE COMPOUNDING MEMORY LOOP, in three stages of one student's use.
 *
 * Stated as time rather than as features, because the claim IS time: the
 * product is worth more in week twelve than in week one, and that is the
 * whole reason to start now rather than bookmark it. Nothing here promises
 * more than the app does — stage one is the nightly log, stage two is the
 * schedule bending on how each revision actually went (which the app already
 * does), and stage three is the weakness signal that follows from having
 * months of that history.
 */
function sharedMemoryLoop(x: RegionTerms): RegionMemory {
  return {
    heading: 'The longer you use it, the better it knows you.',
    lede: `It keeps a memory of YOUR preparation — every ${x.chapter} you log, every ${x.revision} you clear, every one you blank on. Not a plan written once and handed to you: one that gets sharper every night.`,
    steps: [
      {
        when: 'Week 1',
        title: 'It learns what you cover',
        text: `You tap the ${x.chapters} as you finish them. From the first one it knows what you studied, and when.`,
      },
      {
        when: 'Week 4',
        title: 'It learns what you lose',
        text: `The ones you clear easily and the ones you blank on both go back into the model. The spacing bends towards what YOU lose.`,
      },
      {
        when: 'Week 12',
        title: 'It knows before you do',
        text: `With months of your own history behind it, a ${x.chapter} going quiet shows up weeks before a ${x.mock} would have found it.`,
      },
    ],
    kicker: `Every other app hands all ${x.learners} the same plan. This one has only ever seen yours.`,
  };
}

/**
 * THE PROBLEM, IN THE WORDS STUDENTS USE.
 *
 * The proof band shipped with one real quote (the founder's) and nothing
 * else, which left cold ad traffic reading three factual bullet points and
 * moving on. These are NOT invented reviews and the section says so: no
 * names, no stars, no claim that a customer said them about the product. They
 * are the pain recognisable enough that an aspirant sees themselves in it —
 * and `note` states the framing plainly rather than hoping nobody asks.
 */
function sharedPainVoices(x: RegionTerms): RegionPainVoices {
  return {
    heading: 'If any of these is you, keep reading.',
    note: `The words ${x.learners} use about the problem — not product reviews. Real ${x.learner} quotes go here the day we have earned them.`,
    // The “I finish a chapter and months later it is blank” line was removed on
    // 2026-09-27: the student pull quote above the closing CTA now says exactly
    // that, and the page should not say it twice.
    lines: [
      `“I don’t know what to ${x.revise}. I just open whatever is on top of the pile.”`,
      `“My ${x.mocks} keep catching topics I already studied. That is the part that breaks me.”`,
      '“I am putting in the hours. I just can’t tell if any of it is staying.”',
    ],
  };
}

/**
 * WHAT THE FIRST WEEK CHANGES.
 *
 * Written in the second person rather than as quotes, and deliberately so:
 * with no collected student testimonials, an attributed “it told me my
 * Organic Chemistry was slipping and I got 90%” would be invented, and an
 * invented review is the fastest way to lose a sceptical aspirant. These say
 * the same concrete things in the reader's own frame, and every one of them
 * is a behaviour the app actually has. Real quotes still go in
 * `proof.testimonials` the day students give them.
 */
function sharedOutcomes(x: RegionTerms): RegionOutcomes {
  return {
    heading: 'What changes in your first week',
    lines: [
      `You know which ${x.chapters} to ${x.revise} today — and which are safe to skip for now.`,
      `A ${x.chapter} going quiet surfaces weeks before the ${x.mock} would have found it.`,
      'You stop opening whatever is on top of the pile, because the day is already decided.',
    ],
  };
}

/**
 * THE TEST ANALYSIS COPY — written once, spoken in each market's vocabulary.
 *
 * The section itself is the same on all four routes: taking a paper, reading
 * the score and never opening it again is not an Indian habit or an American
 * one. Only `testTerm` and the market's revision-vs-review noun change, which
 * is why this is a template rather than four blocks of near-identical prose.
 * `testTerm` MUST agree with the region's own RegionTerms.mock, or the hero
 * and this section end up calling the same paper two different things: India
 * says 'mock test', the US 'practice test', and the UK and International
 * 'mock exam'.
 */
function sharedTestAnalysis(x: RegionTerms, testTerm: string, testTermPlural: string): RegionTestAnalysis {
  const Test = `${testTerm.charAt(0).toUpperCase()}${testTerm.slice(1)}`;
  return {
    testTerm,
    testTermPlural,
    eyebrow: 'Test analysis',
    heading: 'Your score tells you what happened. We show you why it keeps happening.',
    paragraphs: [
      `Students take ${testTermPlural}, look at the score, and never open the paper again. That’s why the same mistakes repeat.`,
      `Upload your paper, tag each wrong answer in under 10 minutes, and let VicharakAI find the pattern — so the next ${testTerm} looks different.`,
    ],
    callouts: [
      {
        title: 'Upload once, crop any question',
        text: 'Upload the paper once. Question boundaries are detected for you — keep the crops or adjust them.',
      },
      {
        title: 'Tag the reason, not just the wrong answer',
        text: 'Four taps per question: didn’t know it, knew it but couldn’t apply it, silly mistake, ran out of time.',
      },
      {
        title: `Patterns appear after 2+ ${testTermPlural}`,
        text: `Get the same topic wrong in three ${testTermPlural} running and it shows up as a pattern, not a bad day.`,
      },
      {
        title: `Weak topics go straight to your ${x.revision} plan`,
        text: `Every weak topic becomes a ${x.revision} task automatically, on the same spacing as the rest of your plan — day 1, 3, 7, 14 and 28.`,
      },
    ],
    caption: `Tag each wrong answer in one pass. The ${x.revision} tasks are written for you.`,
    mockup: {
      title: 'Test Analysis',
      // No question count here on purpose: the one demo paper's figures live
      // in LandingAppMockups.TestAnalysisScreen, and a second number printed
      // beside them is how the screen ended up contradicting itself.
      subtitle: `${Test} 3 · reviewing your wrong answers`,
      cropLabel: 'Crop detected',
      prompt: 'Why did you get this wrong?',
      errorTypes: ['Didn’t know it', 'Knew it, couldn’t apply', 'Silly mistake', 'Ran out of time'],
      footer: `Wrong in 3 ${testTermPlural} running — queued for ${x.revision} on day 1, 3, 7, 14 and 28.`,
    },
  };
}

/* ==========================================================================
 *  THE FOUR REGIONS
 * ======================================================================== */

const IN_TERMS: RegionTerms = {
  revision: 'revision',
  revise: 'revise',
  revising: 'revising',
  revised: 'revised',
  mock: 'mock',
  mocks: 'mocks',
  syllabus: 'syllabus',
  chapter: 'chapter',
  chapters: 'chapters',
  learner: 'aspirant',
  learners: 'aspirants',
  systemWord: 'revision',
};

const US_TERMS: RegionTerms = {
  revision: 'review',
  revise: 'review',
  revising: 'reviewing',
  revised: 'reviewed',
  mock: 'practice test',
  mocks: 'practice tests',
  syllabus: 'course',
  chapter: 'unit',
  chapters: 'units',
  learner: 'student',
  learners: 'students',
  systemWord: 'study',
};

const UK_TERMS: RegionTerms = {
  revision: 'revision',
  revise: 'revise',
  revising: 'revising',
  revised: 'revised',
  mock: 'mock exam',
  mocks: 'mock exams',
  syllabus: 'specification',
  chapter: 'module',
  chapters: 'modules',
  learner: 'student',
  learners: 'students',
  systemWord: 'revision',
};

const GLOBAL_TERMS: RegionTerms = {
  revision: 'revision',
  revise: 'revise',
  revising: 'revising',
  revised: 'revised',
  mock: 'mock exam',
  mocks: 'mock exams',
  syllabus: 'syllabus',
  chapter: 'topic',
  chapters: 'topics',
  learner: 'student',
  learners: 'students',
  systemWord: 'revision',
};

/* -------------------------------------------------------------------------
 *  INDIA — deep navy into an electric-blue glow.
 * ---------------------------------------------------------------------- */

const INDIA: RegionConfig = {
  key: 'in',
  path: '/in',
  hash: '#/in',
  label: 'India',
  shortLabel: 'India',
  terms: IN_TERMS,
  gradients: {
    page: '#050A14',
    hero:
      'radial-gradient(ellipse 92% 62% at 50% -12%, rgba(0, 87, 255, 0.17) 0%, transparent 66%), ' +
      'radial-gradient(ellipse 120% 84% at 6% 0%, rgba(9, 46, 104, 0.55) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #071627 0%, #050A14 60%, #04070E 100%)',
    section:
      'radial-gradient(ellipse 78% 52% at 82% 0%, rgba(0, 87, 255, 0.12) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #04070E 0%, #06111F 52%, #04070E 100%)',
    plain: 'linear-gradient(180deg, #050A14 0%, #04070E 100%)',
    close:
      'radial-gradient(ellipse 96% 70% at 50% 112%, rgba(0, 87, 255, 0.16) 0%, transparent 64%), ' +
      'linear-gradient(180deg, #04070E 0%, #071425 100%)',
    cardGlow: '0 0 34px rgba(0, 87, 255, 0.16)',
  },
  /* TITLE AND DESCRIPTION (founder instruction, 2026-10-01). One title and
     one description across all four routes: VicharakAI is a PREPARATION
     SYSTEM, and framing it as “a revision app for …” undersold it in the one
     place a searcher reads first. Keep in step with SEO_TITLE /
     SEO_DESCRIPTION in emailGateShared.tsx. Keywords and the OG line below
     stay market-specific. */
  seo: {
    title: 'VicharakAI — Your Preparation System for NEET, JEE & More',
    description:
      'Connect your tests, mistakes, practice and revision. VicharakAI helps you build a continuous preparation loop — not just a study schedule.',
    keywords:
      'AI revision app for NEET, AI revision app for JEE, JEE revision app, NEET preparation app, UPSC preparation app, daily revision plan, mistake book app, NEET PG revision, CAT preparation app, GATE preparation app',
    ogDescription:
      'You study every day — and half of it is quietly slipping away. VicharakAI remembers every chapter you have covered, spots the ones going quiet, and tells you exactly what to revise today, before the mock exposes the gap.',
    hreflang: 'en-IN',
  },
  /* THE FIVE CORE EXAMS ONLY (founder instruction, 2026-09-30) — the row
     was a wall of eleven chips; it now stays scannable with the five exams
     the product leads with, and the '+others' tail covers the rest. */
  exams: ['JEE', 'NEET', 'NEET PG', 'UPSC', 'CAT'],
  hero: {
    eyebrow: 'Beat forgetting, automatically',
    // OUTCOME FIRST (founder copy pass, 2026-09-28). The headline names the
    // result, the sub names the scientifically proven method, and the body
    // says exactly what the product does with your last test. The SAME
    // headline, sub and body run on all four regions. UTM ad traffic still
    // overrides the headline and sub with the exam-specific lines in
    // landingExamMatch.ts.
    titleLead: 'Find your gaps',
    titleAccent: 'before the exam does.',
    sub: 'VicharakAI tracks every study session and tells you what’s slipping — built for JEE, NEET & UPSC.',
    body: 'Upload your last practice test. VicharakAI spots every gap, builds your personalised revision plan, and uses spaced repetition to make sure you never forget the same thing twice.',
    ctaPrimary: PRIMARY_CTA,
    ctaSecondary: 'See how it works ↓',
  },
  reassure: sharedReassure(),
  demo: sharedDemo(IN_TERMS),
  objections: sharedObjections(IN_TERMS),
  memory: sharedMemoryLoop(IN_TERMS),
  problem: {
    heading: sharedProblemHeading(IN_TERMS),
    voice: sharedProblemVoice(),
    paragraphs: sharedProblem(IN_TERMS),
    weeksKey: sharedWeeksKey(IN_TERMS),
    manifesto: sharedManifesto(),
  },
  shift: {
    heading: 'From one wrong question to tomorrow’s plan.',
    steps: sharedSteps(IN_TERMS),
    kicker: 'You never plan any of it. You just study what is in front of you.',
    note: 'Nothing to set up — JEE, NEET, UPSC, CAT, GATE, Boards and NEET PG are already mapped, chapter by chapter.',
    spacedQuote: sharedSpacedQuote(IN_TERMS),
    captureCaption: 'Snap the question you got wrong. Subject and topic are tagged for you.',
    planCaption: 'It comes back as a task on your plan, right before you would forget it.',
    calendarCaption: 'Your revision lands on the calendar by itself — spaced out weeks ahead.',
  },
  features: {
    heading: 'It knows what\'s slipping — before you do.',
    description: sharedFeatureIntro(IN_TERMS),
    cards: sharedFeatures(IN_TERMS),
    todayCaption: 'Every task on Today carries the reason it is there.',
  },
  proof: {
    heading: 'Built for aspirants who refuse to let hard work go to waste.',
    points: [
      'Your daily plan is built from your real study log — there is nothing extra to set up.',
      'Full syllabus loaded for JEE, NEET, NEET PG, UPSC, MPSC, CAT, GATE and Boards.',
      'Built by an aspirant who kept going blank in mocks — for exactly that problem.',
    ],
    /* ONE REAL, ATTRIBUTABLE QUOTE (2026-09-27). Cold ad traffic landed on an
     * empty proof section, so the founder's own words — his real NEET 2026
     * story, the reason the product exists — carry it until students give
     * theirs. It is signed as the founder, NOT dressed up as a customer:
     * inventing a student testimonial is still off the table. Replace or
     * append the moment a real student quote exists. */
    testimonials: [
      {
        quote:
          'I scored 420 in NEET and still missed a good government seat. It was never the hours — it was that half of what I studied in month two had quietly gone by month five, and nothing told me which half. That is the only problem VicharakAI solves.',
        name: 'Founder',
        detail: 'NEET 2026 Aspirant',
      },
    ],
    painVoices: sharedPainVoices(IN_TERMS),
    outcomes: sharedOutcomes(IN_TERMS),
  },
  pricing: {
    currency: 'INR',
    symbol: '₹',
    heading: `Free for ${TRIAL_DAYS} days. Then ${PLAN_PRICE_INR.monthly} a month.`,
    anchor:
      'You have already spent lakhs on lectures and question banks. This is what makes you actually remember them.',
    monthly: {
      label: 'Monthly',
      price: PLAN_PRICE_INR.monthly,
      unit: '/month',
      note: 'Less than you spend on tea in a week — for a whole month of planned revision.',
    },
    trial: {
      label: 'Free trial',
      price: 'Free',
      unit: `for ${TRIAL_DAYS} days`,
      note: 'The whole app — daily plan, revision schedule, AI coach. No card needed.',
    },
    checkout: 'razorpay',
    footnote: 'Charged in ₹ (INR) through Razorpay — UPI, cards and wallets.',
    includeLine: 'Every feature included on every plan. Cancel anytime.',
    trialLine: `Start free for ${TRIAL_DAYS} days, then ₹149/month. Cancel anytime.`,
  },
  founder: {
    heading: 'Why I built this',
    paragraphs: sharedFounderNote(IN_TERMS),
    signoff: FOUNDER_SIGNOFF,
  },
  close: {
    heading: 'Tomorrow morning you’ll know exactly what to revise.',
    description: 'Log one chapter tonight. See what comes back.',
    cta: PRIMARY_CTA,
    note: `${TRIAL_DAYS} days free, full access — no card needed. Then ₹149/month. Cancel anytime.`,
  },
  testAnalysis: sharedTestAnalysis(IN_TERMS, 'mock test', 'mock tests'),
  footerLine:
    'A daily revision plan built from your own mistakes — for JEE, NEET, UPSC, CAT, GATE, Boards and NEET PG.',
  mockups: {
    mistakeBookSubtitle: 'NEET · 24 questions you got wrong',
    captureSubject: 'Physics · Rotational Motion',
    captureChips: ['Maths', 'Permutations & Combinations'],
    captureCaption: 'Subject and topic filled in for you. Write the answer when it comes back.',
    rows: [
      { topic: 'Permutations & Combinations', meta: 'Wrong in Chapter Test 4', due: 'Due today' },
      { topic: 'Thermodynamics', meta: 'Wrong in Full Mock 2', due: 'In 3 days' },
    ],
    todaySubtitle: 'Wednesday · 4 tasks · about 3h 30m',
    tasks: [
      {
        title: 'Clear mistake: Permutations & Combinations',
        why: 'Active recall — you got this wrong in Chapter Test 4. Take a blank page.',
        chip: 'Due now',
      },
      { title: 'Rotational Motion — revise', why: 'Studied five days ago — due to come back today.', chip: 'Back today' },
      { title: 'Current Electricity — 10 questions', why: '42% accuracy in your last full mock.', chip: 'Weak' },
      { title: 'Aldehydes & Ketones — Lecture 3', why: 'Next chapter on your plan.' },
    ],
    todayFooter: '13 topics to clear and you’re back on pace.',
  },
  chart: {
    ariaLabel:
      'Chart: without revision, how much of a chapter you can recall falls away within days. With VicharakAI, scheduled revision holds it near the top.',
    yAxis: 'How much you recall',
    xAxis: 'Days after you studied it',
    legendWithout: 'Without revision',
  },
};

/* -------------------------------------------------------------------------
 *  UNITED STATES — deep navy into a violet/blue glow.
 * ---------------------------------------------------------------------- */

const UNITED_STATES: RegionConfig = {
  key: 'us',
  path: '/us',
  hash: '#/us',
  label: 'United States',
  shortLabel: 'US',
  terms: US_TERMS,
  gradients: {
    page: '#06070F',
    hero:
      'radial-gradient(ellipse 88% 60% at 50% -12%, rgba(0, 87, 255, 0.10) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 104% 76% at 84% 0%, rgba(109, 74, 255, 0.26) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 112% 82% at 4% 4%, rgba(15, 38, 102, 0.5) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #0A0B20 0%, #06070F 60%, #05060C 100%)',
    section:
      'radial-gradient(ellipse 76% 52% at 16% 0%, rgba(92, 62, 200, 0.14) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #05060C 0%, #0A0A1D 52%, #05060C 100%)',
    plain: 'linear-gradient(180deg, #06070F 0%, #05060C 100%)',
    close:
      'radial-gradient(ellipse 96% 70% at 50% 112%, rgba(109, 74, 255, 0.24) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 70% 50% at 50% 116%, rgba(0, 87, 255, 0.10) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #05060C 0%, #0A0B20 100%)',
    cardGlow: '0 0 34px rgba(120, 92, 255, 0.18)',
  },
  seo: {
    title: 'VicharakAI — Your Preparation System for NEET, JEE & More',
    description:
      'Connect your tests, mistakes, practice and revision. VicharakAI helps you build a continuous preparation loop — not just a study schedule.',
    keywords:
      'SAT study app, MCAT study app, ACT prep app, AP exam study app, GRE prep app, GMAT study app, LSAT prep app, spaced repetition study app, AI study planner, practice test review app',
    ogDescription:
      'You study every day — and half of it is quietly slipping away. VicharakAI turns every question you missed into spaced review that comes back right before you forget it — built for SAT, ACT, AP, MCAT, GRE, GMAT and LSAT students.',
    hreflang: 'en-US',
  },
  exams: ['SAT', 'ACT', 'AP', 'MCAT', 'GRE', 'GMAT', 'LSAT'],
  hero: {
    eyebrow: 'Beat forgetting, automatically',
    titleLead: 'Find your gaps',
    titleAccent: 'before the exam does.',
    sub: 'VicharakAI tracks every study session and tells you what’s slipping — built for JEE, NEET & UPSC.',
    body: 'Upload your last practice test. VicharakAI spots every gap, builds your personalised revision plan, and uses spaced repetition to make sure you never forget the same thing twice.',
    ctaPrimary: PRIMARY_CTA,
    ctaSecondary: 'See how it works ↓',
  },
  reassure: sharedReassure(),
  demo: sharedDemo(US_TERMS),
  objections: sharedObjections(US_TERMS),
  memory: sharedMemoryLoop(US_TERMS),
  problem: {
    heading: sharedProblemHeading(US_TERMS),
    voice: sharedProblemVoice(),
    paragraphs: sharedProblem(US_TERMS),
    weeksKey: sharedWeeksKey(US_TERMS),
    manifesto: sharedManifesto(),
  },
  shift: {
    heading: 'From one missed question to tomorrow’s plan.',
    steps: sharedSteps(US_TERMS),
    kicker: 'You never plan any of it. You just study what is in front of you.',
    note: 'Nothing to set up — your course is already mapped, unit by unit.',
    spacedQuote: sharedSpacedQuote(US_TERMS),
    captureCaption: 'Snap the question you missed. Subject and topic are tagged for you.',
    planCaption: 'It comes back as a task on your plan, right before you’d forget it.',
    calendarCaption: 'Your review lands on the calendar by itself — spaced out weeks ahead.',
  },
  features: {
    heading: 'It knows what\'s slipping — before you do.',
    description: sharedFeatureIntro(US_TERMS),
    cards: sharedFeatures(US_TERMS),
    todayCaption: 'Every task on Today carries the reason it is there.',
  },
  proof: {
    heading: 'Built for students who refuse to let hard work go to waste.',
    points: [
      'Spaced review timed to how memory actually works — with zero setup on your side.',
      'Built around SAT, ACT, AP, MCAT, GRE, GMAT and LSAT content, subject by subject.',
      'Your score report becomes a study plan: log a practice test and the weak topics re-order themselves.',
    ],
    testimonials: [],
    painVoices: sharedPainVoices(US_TERMS),
    outcomes: sharedOutcomes(US_TERMS),
  },
  pricing: {
    currency: 'USD',
    symbol: '$',
    heading: `Free for ${TRIAL_DAYS} days. Then $14.99 a month.`,
    anchor:
      'You have already spent thousands on prep courses and question banks. This is what makes you actually remember them.',
    monthly: {
      label: 'Monthly',
      price: '$14.99',
      unit: '/month',
      note: 'Less than one hour with a tutor, for a whole month of prep.',
    },
    trial: {
      label: 'Free trial',
      price: 'Free',
      unit: `for ${TRIAL_DAYS} days`,
      note: `Full access for ${TRIAL_DAYS} days. No card needed.`,
    },
    checkout: 'creem',
    footnote: 'Charged in $ (USD) through Creem — secure international card checkout.',
    includeLine: 'Every feature included on every plan. Cancel anytime.',
    trialLine: `Start free for ${TRIAL_DAYS} days, then $14.99/month. Cancel anytime.`,
  },
  founder: {
    heading: 'Why I built this',
    paragraphs: sharedFounderNote(US_TERMS),
    signoff: FOUNDER_SIGNOFF,
  },
  close: {
    heading: 'Tomorrow morning you’ll know exactly what to review.',
    description: 'Log one unit tonight. See what comes back.',
    cta: PRIMARY_CTA,
    note: 'Snap your first mistake in under a minute.',
  },
  testAnalysis: sharedTestAnalysis(US_TERMS, 'practice test', 'practice tests'),
  footerLine:
    'Spaced review built from your own mistakes — for SAT, ACT, AP, MCAT, GRE, GMAT and LSAT students.',
  mockups: {
    mistakeBookSubtitle: 'MCAT · 24 questions you missed',
    captureSubject: 'Biology · Amino Acids',
    captureChips: ['Chemistry', 'Acid–Base Equilibria'],
    captureCaption: 'Subject and topic filled in for you. Write the answer when it comes back.',
    rows: [
      { topic: 'Acid–Base Equilibria', meta: 'Missed in Practice Test 4', due: 'Due today' },
      { topic: 'Thermochemistry', meta: 'Missed in Full-Length 2', due: 'In 3 days' },
    ],
    todaySubtitle: 'Wednesday · 4 tasks · about 3h 30m',
    tasks: [
      {
        title: 'Clear mistake: Acid–Base Equilibria',
        why: 'Active recall — you got this wrong in Practice Test 4. Take a blank page.',
        chip: 'Due now',
      },
      { title: 'Amino Acids — review', why: 'Studied five days ago — due for spaced review.', chip: 'Spaced' },
      { title: 'Kinematics — 10 questions', why: '42% accuracy on your last full-length.', chip: 'Weak' },
      { title: 'Organic Chemistry — Lecture 3', why: 'Next unit on your course plan.' },
    ],
    todayFooter: '13 topics to clear and you’re back on pace.',
  },
  chart: {
    ariaLabel:
      'Chart: without review, how much of a unit you can recall falls away within days. With VicharakAI, scheduled review holds it near the top.',
    yAxis: 'How much you recall',
    xAxis: 'Days after you studied it',
    legendWithout: 'Without review',
  },
};

/* -------------------------------------------------------------------------
 *  UNITED KINGDOM — deep navy into a blue/purple glow.
 * ---------------------------------------------------------------------- */

const UNITED_KINGDOM: RegionConfig = {
  key: 'uk',
  path: '/uk',
  hash: '#/uk',
  label: 'United Kingdom',
  shortLabel: 'UK',
  terms: UK_TERMS,
  gradients: {
    page: '#05070E',
    hero:
      'radial-gradient(ellipse 88% 60% at 50% -12%, rgba(0, 87, 255, 0.09) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 104% 76% at 78% 0%, rgba(88, 86, 214, 0.28) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 112% 82% at 6% 4%, rgba(11, 40, 99, 0.52) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #080A1C 0%, #05070E 60%, #04060B 100%)',
    section:
      'radial-gradient(ellipse 76% 52% at 84% 0%, rgba(76, 74, 190, 0.14) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #04060B 0%, #080A1A 52%, #04060B 100%)',
    plain: 'linear-gradient(180deg, #05070E 0%, #04060B 100%)',
    close:
      'radial-gradient(ellipse 96% 70% at 50% 112%, rgba(88, 86, 214, 0.24) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 70% 50% at 50% 116%, rgba(0, 87, 255, 0.10) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #04060B 0%, #080A1C 100%)',
    cardGlow: '0 0 34px rgba(104, 102, 226, 0.18)',
  },
  seo: {
    title: 'VicharakAI — Your Preparation System for NEET, JEE & More',
    description:
      'Connect your tests, mistakes, practice and revision. VicharakAI helps you build a continuous preparation loop — not just a study schedule.',
    keywords:
      'GCSE revision app, A-Level revision app, UCAT preparation app, IB revision app, IGCSE revision app, spaced repetition revision, past paper mistakes app, AI revision planner UK',
    ogDescription:
      'You study every day — and half of it is quietly slipping away. VicharakAI turns every question you got wrong into spaced revision that comes back right before you forget it — built for GCSE, A-Level, IGCSE, UCAT and IB students.',
    hreflang: 'en-GB',
  },
  exams: ['GCSE', 'A-Level', 'UCAT', 'IB', 'IGCSE'],
  hero: {
    eyebrow: 'Beat forgetting, automatically',
    titleLead: 'Find your gaps',
    titleAccent: 'before the exam does.',
    sub: 'VicharakAI tracks every study session and tells you what’s slipping — built for JEE, NEET & UPSC.',
    body: 'Upload your last practice test. VicharakAI spots every gap, builds your personalised revision plan, and uses spaced repetition to make sure you never forget the same thing twice.',
    ctaPrimary: PRIMARY_CTA,
    ctaSecondary: 'See how it works ↓',
  },
  reassure: sharedReassure(),
  demo: sharedDemo(UK_TERMS),
  objections: sharedObjections(UK_TERMS),
  memory: sharedMemoryLoop(UK_TERMS),
  problem: {
    heading: sharedProblemHeading(UK_TERMS),
    voice: sharedProblemVoice(),
    paragraphs: sharedProblem(UK_TERMS),
    weeksKey: sharedWeeksKey(UK_TERMS),
    manifesto: sharedManifesto(),
  },
  shift: {
    heading: 'From one wrong question to tomorrow’s plan.',
    steps: sharedSteps(UK_TERMS),
    kicker: 'You never plan any of it. You just study what is in front of you.',
    note: 'Nothing to set up — your specification is already mapped, module by module.',
    spacedQuote: sharedSpacedQuote(UK_TERMS),
    captureCaption: 'Snap the past-paper question you got wrong. Subject and topic are tagged for you.',
    planCaption: 'It comes back as a task on your plan, right before you’d forget it.',
    calendarCaption: 'Your revision lands on the calendar by itself — spaced out weeks ahead.',
  },
  features: {
    heading: 'It knows what\'s slipping — before you do.',
    description: sharedFeatureIntro(UK_TERMS),
    cards: sharedFeatures(UK_TERMS),
    todayCaption: 'Every task on Today carries the reason it is there.',
  },
  proof: {
    heading: 'Built for students who refuse to let hard work go to waste.',
    points: [
      'Spaced revision timed to how memory actually works — with zero setup on your side.',
      'Built around GCSE, A-Level, IGCSE, UCAT and IB content, module by module.',
      'Your past papers become the revision list: log a mock exam and the weak topics re-order themselves.',
    ],
    testimonials: [],
    painVoices: sharedPainVoices(UK_TERMS),
    outcomes: sharedOutcomes(UK_TERMS),
  },
  pricing: {
    currency: 'GBP',
    symbol: '£',
    heading: `Free for ${TRIAL_DAYS} days. Then £12 a month.`,
    anchor:
      'You have already spent a fortune on tuition and past papers. This is what makes you actually remember them.',
    monthly: {
      label: 'Monthly',
      price: '£12',
      unit: '/month',
      note: 'Less than half an hour of private tuition, for a whole month of revision.',
    },
    trial: {
      label: 'Free trial',
      price: 'Free',
      unit: `for ${TRIAL_DAYS} days`,
      note: `Full access for ${TRIAL_DAYS} days. No card needed.`,
    },
    checkout: 'creem',
    footnote: 'Shown in £ (GBP). Charged in $ (USD) through Creem at the day’s rate.',
    includeLine: 'Every feature included on every plan. Cancel anytime.',
    trialLine: `Start free for ${TRIAL_DAYS} days, then £12/month. Cancel anytime.`,
  },
  founder: {
    heading: 'Why I built this',
    paragraphs: sharedFounderNote(UK_TERMS),
    signoff: FOUNDER_SIGNOFF,
  },
  close: {
    heading: 'Tomorrow morning you’ll know exactly what to revise.',
    description: 'Log one module tonight. See what comes back.',
    cta: PRIMARY_CTA,
    note: 'Snap your first mistake in under a minute.',
  },
  testAnalysis: sharedTestAnalysis(UK_TERMS, 'mock exam', 'mock exams'),
  footerLine:
    'Spaced revision built from your own mistakes — for GCSE, A-Level, IGCSE, UCAT and IB students.',
  mockups: {
    mistakeBookSubtitle: 'A-Level · 24 questions you got wrong',
    captureSubject: 'Physics · Circular Motion',
    captureChips: ['Maths', 'Binomial Expansion'],
    captureCaption: 'Subject and topic filled in for you. Write the answer when it comes back.',
    rows: [
      { topic: 'Binomial Expansion', meta: 'Wrong in the Paper 2 mock', due: 'Due today' },
      { topic: 'Titration Calculations', meta: 'Wrong in the January mock', due: 'In 3 days' },
    ],
    todaySubtitle: 'Wednesday · 4 tasks · about 3h 30m',
    tasks: [
      {
        title: 'Clear mistake: Binomial Expansion',
        why: 'Active recall — you got this wrong in your Paper 2 mock. Take a blank page.',
        chip: 'Due now',
      },
      { title: 'Circular Motion — revise', why: 'Studied five days ago — due for spaced revision.', chip: 'Spaced' },
      { title: 'Titration Calculations — 10 questions', why: '42% accuracy in your last mock exam.', chip: 'Weak' },
      { title: 'Organic Chemistry — Module 3', why: 'Next module on your plan.' },
    ],
    todayFooter: '13 topics to clear and you’re back on pace.',
  },
  chart: {
    ariaLabel:
      'Chart: without revision, how much of a module you can recall falls away within days. With VicharakAI, scheduled revision holds it near the top.',
    yAxis: 'How much you recall',
    xAxis: 'Days after you studied it',
    legendWithout: 'Without revision',
  },
};

/* -------------------------------------------------------------------------
 *  INTERNATIONAL — deep navy into a subtle blue/violet glow.
 * ---------------------------------------------------------------------- */

const GLOBAL: RegionConfig = {
  key: 'global',
  path: '/global',
  hash: '#/global',
  label: 'International',
  shortLabel: 'Global',
  terms: GLOBAL_TERMS,
  gradients: {
    page: '#05070E',
    hero:
      'radial-gradient(ellipse 88% 60% at 50% -12%, rgba(0, 87, 255, 0.11) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 104% 76% at 72% 2%, rgba(92, 104, 214, 0.20) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 110% 80% at 10% 2%, rgba(13, 36, 92, 0.5) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #070917 0%, #05070E 60%, #04060B 100%)',
    section:
      'radial-gradient(ellipse 76% 52% at 20% 0%, rgba(70, 88, 180, 0.11) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #04060B 0%, #070915 52%, #04060B 100%)',
    plain: 'linear-gradient(180deg, #05070E 0%, #04060B 100%)',
    close:
      'radial-gradient(ellipse 96% 70% at 50% 112%, rgba(92, 104, 214, 0.20) 0%, transparent 64%), ' +
      'radial-gradient(ellipse 70% 50% at 50% 116%, rgba(0, 87, 255, 0.11) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #04060B 0%, #070917 100%)',
    cardGlow: '0 0 34px rgba(96, 118, 226, 0.16)',
  },
  seo: {
    title: 'VicharakAI — Your Preparation System for NEET, JEE & More',
    description:
      'Connect your tests, mistakes, practice and revision. VicharakAI helps you build a continuous preparation loop — not just a study schedule.',
    keywords:
      'IB revision app, IGCSE revision app, university entrance exam prep, international exam revision app, spaced repetition study app, AI revision planner, mistake book app',
    ogDescription:
      'You study every day — and half of it is quietly slipping away. VicharakAI turns every question you got wrong into spaced revision that comes back right before you forget it — built for IB, IGCSE, SAT, A-Level and university entrance students worldwide.',
    hreflang: 'en',
  },
  exams: ['IB', 'IGCSE', 'SAT', 'A-Level', 'University Entrance'],
  hero: {
    eyebrow: 'Beat forgetting, automatically',
    titleLead: 'Find your gaps',
    titleAccent: 'before the exam does.',
    sub: 'VicharakAI tracks every study session and tells you what’s slipping — built for JEE, NEET & UPSC.',
    body: 'Upload your last practice test. VicharakAI spots every gap, builds your personalised revision plan, and uses spaced repetition to make sure you never forget the same thing twice.',
    ctaPrimary: PRIMARY_CTA,
    ctaSecondary: 'See how it works ↓',
  },
  reassure: sharedReassure(),
  demo: sharedDemo(GLOBAL_TERMS),
  objections: sharedObjections(GLOBAL_TERMS),
  memory: sharedMemoryLoop(GLOBAL_TERMS),
  problem: {
    heading: sharedProblemHeading(GLOBAL_TERMS),
    voice: sharedProblemVoice(),
    paragraphs: sharedProblem(GLOBAL_TERMS),
    weeksKey: sharedWeeksKey(GLOBAL_TERMS),
    manifesto: sharedManifesto(),
  },
  shift: {
    heading: 'From one wrong question to tomorrow’s plan.',
    steps: sharedSteps(GLOBAL_TERMS),
    kicker: 'You never plan any of it. You just study what is in front of you.',
    note: 'Nothing to set up — any syllabus, any curriculum, topic by topic.',
    spacedQuote: sharedSpacedQuote(GLOBAL_TERMS),
    captureCaption: 'Snap the question you got wrong. Subject and topic are tagged for you.',
    planCaption: 'It comes back as a task on your plan, right before you’d forget it.',
    calendarCaption: 'Your revision lands on the calendar by itself — spaced out weeks ahead.',
  },
  features: {
    heading: 'It knows what\'s slipping — before you do.',
    description: sharedFeatureIntro(GLOBAL_TERMS),
    cards: sharedFeatures(GLOBAL_TERMS),
    todayCaption: 'Every task on Today carries the reason it is there.',
  },
  proof: {
    heading: 'Built for students who refuse to let hard work go to waste.',
    points: [
      'Spaced revision timed to how memory actually works — with zero setup on your side.',
      'Curriculum-agnostic: it learns your syllabus from what you actually study and get wrong.',
      'Your mock exams become the revision list: log one and the weak topics re-order themselves.',
    ],
    testimonials: [],
    painVoices: sharedPainVoices(GLOBAL_TERMS),
    outcomes: sharedOutcomes(GLOBAL_TERMS),
  },
  pricing: {
    currency: 'USD',
    symbol: '$',
    heading: `Free for ${TRIAL_DAYS} days. Then $14.99 a month.`,
    anchor:
      'You have already spent a fortune on courses and question banks. This is what makes you actually remember them.',
    monthly: {
      label: 'Monthly',
      price: '$14.99',
      unit: '/month',
      note: 'Less than one hour with a tutor, for a whole month of revision.',
    },
    trial: {
      label: 'Free trial',
      price: 'Free',
      unit: `for ${TRIAL_DAYS} days`,
      note: `Full access for ${TRIAL_DAYS} days. No card needed.`,
    },
    checkout: 'creem',
    footnote: 'Charged in $ (USD) through Creem — secure international card checkout.',
    includeLine: 'Every feature included on every plan. Cancel anytime.',
    trialLine: `Start free for ${TRIAL_DAYS} days, then $14.99/month. Cancel anytime.`,
  },
  founder: {
    heading: 'Why I built this',
    paragraphs: sharedFounderNote(GLOBAL_TERMS),
    signoff: FOUNDER_SIGNOFF,
  },
  close: {
    heading: 'Tomorrow morning you’ll know exactly what to revise.',
    description: 'Log one topic tonight. See what comes back.',
    cta: PRIMARY_CTA,
    note: 'Snap your first mistake in under a minute.',
  },
  testAnalysis: sharedTestAnalysis(GLOBAL_TERMS, 'mock exam', 'mock exams'),
  footerLine:
    'Spaced revision built from your own mistakes — for IB, IGCSE, SAT, A-Level and university entrance students.',
  mockups: {
    mistakeBookSubtitle: 'IB · 24 questions you got wrong',
    captureSubject: 'Physics · Circular Motion',
    captureChips: ['Maths AA', 'Integration by Parts'],
    captureCaption: 'Subject and topic filled in for you. Write the answer when it comes back.',
    rows: [
      { topic: 'Integration by Parts', meta: 'Wrong in the Paper 1 mock', due: 'Due today' },
      { topic: 'Stoichiometry', meta: 'Wrong in the mock exam', due: 'In 3 days' },
    ],
    todaySubtitle: 'Wednesday · 4 tasks · about 3h 30m',
    tasks: [
      {
        title: 'Clear mistake: Integration by Parts',
        why: 'Active recall — you got this wrong in your Paper 1 mock. Take a blank page.',
        chip: 'Due now',
      },
      { title: 'Circular Motion — revise', why: 'Studied five days ago — due for spaced revision.', chip: 'Spaced' },
      { title: 'Stoichiometry — 10 questions', why: '42% accuracy in your last mock exam.', chip: 'Weak' },
      { title: 'Organic Chemistry — Topic 10', why: 'Next topic on your plan.' },
    ],
    todayFooter: '13 topics to clear and you’re back on pace.',
  },
  chart: {
    ariaLabel:
      'Chart: without revision, how much of a topic you can recall falls away within days. With VicharakAI, scheduled revision holds it near the top.',
    yAxis: 'How much you recall',
    xAxis: 'Days after you studied it',
    legendWithout: 'Without revision',
  },
};

/* ==========================================================================
 *  REGISTRY, ROUTING AND GEO RESOLUTION
 * ======================================================================== */

export const LANDING_REGIONS: Record<RegionKey, RegionConfig> = {
  in: INDIA,
  us: UNITED_STATES,
  uk: UNITED_KINGDOM,
  global: GLOBAL,
};

/** Switcher order — India first, Global last. */
export const REGION_ORDER: RegionKey[] = ['in', 'us', 'uk', 'global'];

/** The region the root route falls back to when nothing else is known. */
export const DEFAULT_REGION: RegionKey = 'global';

/** The config for a key, always resolving to something renderable. */
export function landingRegion(key: RegionKey | null | undefined): RegionConfig {
  return (key && LANDING_REGIONS[key]) || LANDING_REGIONS[DEFAULT_REGION];
}

function asRegionKey(value: string): RegionKey | null {
  const clean = value.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  return (REGION_ORDER as string[]).includes(clean) ? (clean as RegionKey) : null;
}

/**
 * Which regional page the current URL asks for, or null for the root route.
 *
 * The HASH is checked first and wins outright, exactly as the legal pages
 * resolve in StaticPages.tsx — it is the form that survives a direct load and
 * a refresh on a bundle served at the domain root. The real PATHNAME (/in,
 * /us, /uk, /global) is recognised too, so those become live crawlable URLs
 * the moment the host rewrites them onto this bundle.
 */
export function readLandingRegionFromLocation(): RegionKey | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash || '';
  if (rawHash) {
    return asRegionKey(rawHash.replace(/^#\/?/, ''));
  }
  return asRegionKey(window.location.pathname);
}

/** Session cache for the geo-resolved region on the root route. */
const REGION_CACHE_KEY = 'landing_region';

function readCachedRegion(): RegionKey | null {
  try {
    return asRegionKey(sessionStorage.getItem(REGION_CACHE_KEY) || '');
  } catch {
    return null;
  }
}

function cacheRegion(key: RegionKey): void {
  try {
    sessionStorage.setItem(REGION_CACHE_KEY, key);
  } catch {
    /* storage unavailable — the lookup simply runs again next mount */
  }
}

/**
 * The visitor's OWN region choice, made through the in-page switcher and kept
 * in localStorage so it outlives the session. When present it beats every geo
 * signal: a repeat visitor keeps the region they picked instead of being
 * re-geo-detected on each visit. It is written ONLY by a deliberate switcher
 * tap — never by geo detection — so a wrong IP answer can never be locked in.
 */
export const REGION_PREFERENCE_KEY = 'vicharakai_region';

/** The region the visitor picked on an earlier visit, or null. */
export function readRegionPreference(): RegionKey | null {
  try {
    return asRegionKey(localStorage.getItem(REGION_PREFERENCE_KEY) || '');
  } catch {
    return null;
  }
}

/** Remember a deliberate switcher choice across visits. */
export function saveRegionPreference(key: RegionKey): void {
  try {
    localStorage.setItem(REGION_PREFERENCE_KEY, key);
  } catch {
    /* storage unavailable — the visitor is simply geo-detected again next visit */
  }
}

/** The market a two-letter country code belongs to. Everything outside the
 *  three named markets is International, never India — showing rupees to a
 *  mis-detected visitor is the expensive mistake. */
export function regionForCountry(countryCode: string): RegionKey {
  const code = countryCode.trim().toUpperCase();
  if (code === 'IN') return 'in';
  if (code === 'US') return 'us';
  if (code === 'GB' || code === 'UK') return 'uk';
  return 'global';
}

/** The market the device clock implies — the last resort when no IP answer
 *  can be had at all. */
export function regionFromTimezone(): RegionKey {
  const tz = deviceTimeZone();
  if (!tz) return DEFAULT_REGION;
  if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta') || tz === 'IST') return 'in';
  if (tz === 'Europe/London' || tz.startsWith('Europe/Belfast')) return 'uk';
  if (tz.startsWith('America/') && !tz.startsWith('America/Argentina') && !tz.startsWith('America/Sao_Paulo')) {
    // US/Canada/Mexico all read as the US academic vocabulary; the alternative
    // for them is the International page, which says much the same thing.
    return 'us';
  }
  return DEFAULT_REGION;
}

/** What is knowable synchronously, for the very first paint of the root
 *  route: the visitor's own saved choice, else the region resolved earlier
 *  this session, else the country cached by the app's own geo lookup, else
 *  the device clock. */
export function initialLandingRegion(): RegionKey {
  const preferred = readRegionPreference();
  if (preferred) return preferred;
  const cached = readCachedRegion();
  if (cached) return cached;
  const country = readCachedGeoCountry();
  if (country) return regionForCountry(country);
  return regionFromTimezone();
}

/**
 * Resolve the visitor's market for the ROOT route, in strict order:
 *
 *   1. the visitor's own saved switcher choice (localStorage — beats geo);
 *   2. the region already cached in sessionStorage (so geo resolves ONCE);
 *   3. the country cached by the app's own geo lookup this session;
 *   4. ipapi.co's country_code, straight from the browser;
 *   5. the workspace's own `geo` server function (covers the browser call
 *      being rate-limited, refused by CORS or blocked by an extension);
 *   6. the device timezone.
 *
 * Always resolves, never throws, and caches whatever it decides. It does not
 * rewrite the URL itself — the root-route redirect in useEmailGateController
 * is the one place that does, and it calls this through
 * resolveLandingRegionWithTimeout below.
 */
export async function resolveLandingRegion(spaceId: string): Promise<RegionKey> {
  const preferred = readRegionPreference();
  if (preferred) return preferred;

  const cached = readCachedRegion();
  if (cached) return cached;

  const sessionCountry = readCachedGeoCountry();
  if (sessionCountry) {
    const region = regionForCountry(sessionCountry);
    cacheRegion(region);
    return region;
  }

  const ipApiCountry = await fetchIpApiCountry();
  if (ipApiCountry) {
    const region = regionForCountry(ipApiCountry);
    cacheRegion(region);
    return region;
  }

  const serverCountry = await fetchGeoCountry(spaceId);
  if (serverCountry) {
    const region = regionForCountry(serverCountry);
    cacheRegion(region);
    return region;
  }

  const fallback = regionFromTimezone();
  cacheRegion(fallback);
  return fallback;
}

/** The most a root-route visitor will wait for the redirect's geo lookup.
 *  The page has already painted its best synchronous guess underneath, so
 *  this is purely how long the URL may lag — past it, the device clock
 *  decides (and an unreadable clock means Global). */
export const REGION_REDIRECT_TIMEOUT_MS = 4000;

/**
 * resolveLandingRegion under a hard overall deadline, for the root-route
 * redirect. The underlying chain already caps each network step, but those
 * caps stack — this keeps the worst case at REGION_REDIRECT_TIMEOUT_MS by
 * falling back to the device clock (which defaults to Global) the moment the
 * budget runs out. Never rejects.
 */
export function resolveLandingRegionWithTimeout(spaceId: string): Promise<RegionKey> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(regionFromTimezone()), REGION_REDIRECT_TIMEOUT_MS);
    void resolveLandingRegion(spaceId).then((region) => {
      clearTimeout(timer);
      resolve(region);
    });
  });
}

/* ==========================================================================
 *  PER-REGION SEO
 * ======================================================================== */

function setNamedMeta(name: string, content: string): void {
  const tag = upsertHeadTag(`meta[name="${name}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  });
  tag.setAttribute('content', content);
}

function setPropertyMeta(property: string, content: string): void {
  const tag = upsertHeadTag(`meta[property="${property}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  });
  tag.setAttribute('content', content);
}

/**
 * Write this region's search and social metadata into <head>.
 *
 * The space ships as a client-rendered bundle with no server-authored <head>,
 * so every tag is written on mount and REWRITTEN when the region changes —
 * existing tags are reused rather than duplicated, so switching regions can
 * never stack up copies.
 *
 * `explicit` is true when the URL actually names the region (/in, #/in). The
 * root route geo-detects its content but keeps the bare canonical, so the two
 * URLs are never in competition for the same ranking.
 */
export function applyRegionSeoTags(region: RegionConfig, explicit: boolean): void {
  if (typeof document === 'undefined') return;

  document.title = SEO_TITLE;

  setNamedMeta('description', SEO_DESCRIPTION);
  setNamedMeta('keywords', region.seo.keywords);
  setNamedMeta('robots', 'index, follow');
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', SEO_OG_TITLE);
  setNamedMeta('twitter:description', SEO_DESCRIPTION);
  setNamedMeta('twitter:image', SEO_SOCIAL_IMAGE);
  setNamedMeta('theme-color', '#040817');

  const canonicalUrl = explicit ? `${SEO_CANONICAL_URL}${region.path}` : SEO_CANONICAL_URL;

  setPropertyMeta('og:site_name', 'VicharakAI');
  setPropertyMeta('og:title', SEO_OG_TITLE);
  setPropertyMeta('og:description', SEO_DESCRIPTION);
  setPropertyMeta('og:url', canonicalUrl);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:image', SEO_SOCIAL_IMAGE);
  setPropertyMeta('og:locale', region.seo.hreflang.replace('-', '_'));

  const canonical = upsertHeadTag('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    return link;
  });
  canonical.setAttribute('href', canonicalUrl);

  // Points AI crawlers at /llms.txt, the plain-text description of what
  // VicharakAI is, who it is for and what it costs. The platform's head-tag
  // setting refuses this rel value, so every surface writes it itself — see
  // applyPageSeo in components/seoMeta.ts for the other public routes.
  const aiInstructions = upsertHeadTag('link[rel="ai-instructions"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'ai-instructions');
    return link;
  });
  aiInstructions.setAttribute('href', `${SEO_CANONICAL_URL}/llms.txt`);

  // hreflang alternates, so a search engine serves the Indian page to an
  // Indian searcher and the US page to an American one instead of picking
  // between four near-identical pages on its own.
  REGION_ORDER.forEach((key) => {
    const alt = LANDING_REGIONS[key];
    const link = upsertHeadTag(`link[rel="alternate"][hreflang="${alt.seo.hreflang}"]`, () => {
      const created = document.createElement('link');
      created.setAttribute('rel', 'alternate');
      created.setAttribute('hreflang', alt.seo.hreflang);
      return created;
    });
    link.setAttribute('href', `${SEO_CANONICAL_URL}${alt.path}`);
  });

  const xDefault = upsertHeadTag('link[rel="alternate"][hreflang="x-default"]', () => {
    const created = document.createElement('link');
    created.setAttribute('rel', 'alternate');
    created.setAttribute('hreflang', 'x-default');
    return created;
  });
  xDefault.setAttribute('href', `${SEO_CANONICAL_URL}${LANDING_REGIONS.global.path}`);
}
