/**
 * OnboardingFlow — TWO steps, then the trial offer.
 *
 *   1. PICK YOUR EXAM — a searchable list of every exam in the shared
 *      `vicharakai_exams` registry (13 Indian + 7 international), plus
 *      "Other — type your exam" for anything the registry does not carry.
 *      Choosing an exam loads that exam's papers from
 *      `vicharakai_exam_sections` and carries them onto the profile.
 *   2. YOUR DREAM GOAL — one open text field. What the student actually
 *      wants: "AIIMS Delhi", "IIT Bombay CSE", "Rank under 100". It is
 *      stored as the `goals` meta row, which is the anchor the Vision Board
 *      pins its whole map to and the line the coach reads back.
 *
 * Then the trial screen: **Start my 7-day free trial** (no card, no payment)
 * writes the profile and lands the student in the app, where Vicharee's mood
 * check opens the conversation. "Or subscribe now" is the secondary path.
 *
 * 2026-09-29 (V2 Task 5): exam date, daily study hours, "where are you right
 * now?" and the Day-1 plan preview are GONE, and so is the AI welcome
 * overlay that used to follow them. Nothing else may be added here — the
 * product asks for two things up front and Vicharee learns the rest in
 * conversation. Do not reintroduce an intake question on this path.
 *
 * PAYMENT, ACCURATELY: checkout routes by the EXAM THE STUDENT PICKED
 * (pricingRegion.ts) through the one shared implementation in
 * features/premium/premiumCheckout.ts — an Indian exam → Razorpay,
 * ₹149/month; a US/international exam → Creem, $14.99/month. No exam yet, or
 * any doubt, means India. Nothing on this path shows two currencies at once.
 *
 * DESIGN: the first impression runs on its own dark, gradient-led system
 * (electric blue #0057FF + bright blue #4D8DFF on a #0A0A0F→#111118→#0D1A2E
 * gradient) scoped under the `vicharak-ob` root class — deliberately NOT
 * `vicharak-app`, so the paper theme's global radius/shadow/background
 * overrides never flatten it. Screens slide in from the right; selections
 * flash green then settle on the blue accent. Mobile first throughout: 44px
 * tap-target floor, a 12px type floor, and 16px inputs so iOS Safari never
 * zooms the page when a field takes focus.
 */
/* eslint-disable */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronRight, Loader2, Search, Sparkles, Target, Wand2 } from 'lucide-react';
import { VicharakLogoMark } from '../../ui';
import { getExam } from '../../syllabus';
import { buildCustomExam, customExamId, lookupExamSyllabus } from '../../customExam';
import CustomExamEntry from '../../CustomExamEntry';
import PaywallScreen from '../../PaywallScreen';
import { PREMIUM_PLAN, TRIAL_DURATION_DAYS, planPriceLabel } from '../../access';
import { examPricingIsIndia } from '../../pricingRegion';
import {
  registryExamLabel,
  sectionsToExamSubjects,
  summarizeSections,
  useExamRegistry,
  useExamSectionRegistry,
} from '../../data/examRegistry';
import { OB_FLOW, saveStartMode, type ObScreen } from './onboardingStorage';
import {
  DB_TO_PLANNER, EXAM_CATEGORY_BY_ID, FALLBACK_EXAMS, POPULAR_EXAM_IDS,
  filterPickerExams, groupPickerExams, pickerCategoryLabel,
  type PickerExam,
} from './examPickerCatalog';
import { useApp } from '../../app/AppContext';
import { trackOnboardingStep } from '../../shared/track';

/* ------------------------------------------------------------------ */
/*  Design tokens — onboarding only                                    */
/* ------------------------------------------------------------------ */

/** Bright electric blue — the accent that reads on this dark shell. */
const BLUE_BRIGHT = '#4D8DFF';
/** The app's brand blue — CTA fills, selected borders and card glows. */
const BLUE = '#0057FF';
/** Lighter brand blue for gradient TEXT (full-strength blue reads too dark). */
const BLUE_TEXT = '#6EA8FF';
/** The onboarding background — one dark gradient on both screens. */
const OB_BG = 'linear-gradient(160deg, #0A0A0F 0%, #111118 60%, #0D1A2E 100%)';

/** Card treatment shared by every onboarding surface. */
const OB_CARD =
  'bg-gradient-to-br from-gray-800/60 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-[0_0_60px_rgba(0,87,255,0.10)]';

/**
 * Scoped stylesheet for the onboarding experience. Lives outside the
 * `vicharak-app` class on purpose: the paper theme's global rules (flat 3px
 * radius, shadow removal, paper background) must not reach these screens.
 */
const OB_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.vicharak-ob {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: #E5E7EB;
  color-scheme: dark;
}
.ob-title {
  font-family: 'Bricolage Grotesque', 'IBM Plex Sans', sans-serif;
  font-weight: 800;
  font-size: 1.7rem;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: #F9FAFB;
}
.ob-grad-text {
  background: linear-gradient(90deg, ${BLUE_BRIGHT}, ${BLUE_TEXT});
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
/* ---------- motion ---------- */
@keyframes obRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.ob-rise { animation: obRise 0.35s ease-out both; }
@keyframes obSlideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes obSlideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-30px); } }
.ob-screen-in { animation: obSlideIn 0.22s ease-out both; }
.ob-screen-out { animation: obSlideOut 0.18s ease-in both; }
/* Progress bar fill — gradient + a quiet pulsing glow. */
@keyframes obBarGlow {
  0%, 100% { box-shadow: 0 0 6px rgba(77, 141, 255, 0.45); }
  50% { box-shadow: 0 0 14px rgba(0, 87, 255, 0.6); }
}
.ob-bar-fill {
  background: linear-gradient(90deg, ${BLUE_BRIGHT}, ${BLUE});
  animation: obBarGlow 2.2s ease-in-out infinite;
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
/* ---------- interactive pieces ---------- */
.ob-btn { transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease; }
.ob-btn:hover { transform: scale(1.02); box-shadow: 0 0 18px rgba(0, 87, 255, 0.4); }
.ob-btn:active { transform: scale(0.985); }
.ob-btn:disabled { opacity: 0.55; transform: none; box-shadow: none; cursor: default; }
.ob-btn-primary {
  background: ${BLUE};
  color: #fff;
  box-shadow: 0 0 22px rgba(0, 87, 255, 0.3);
  position: relative;
  overflow: hidden;
}
/* CTA press: a brief blue shimmer sweeping across the button. */
@keyframes obShimmer {
  from { transform: translateX(-130%) skewX(-18deg); }
  to { transform: translateX(300%) skewX(-18deg); }
}
.ob-btn-primary:active::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 45%;
  background: linear-gradient(90deg, transparent, rgba(77, 141, 255, 0.55), transparent);
  animation: obShimmer 0.5s ease-out;
  pointer-events: none;
}
.ob-chip { transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
.ob-chip:hover, .ob-chip:focus-visible { border-color: rgba(0, 87, 255, 0.7); box-shadow: 0 0 12px rgba(0, 87, 255, 0.3); transform: scale(1.01); }
.ob-chip-on { border-color: ${BLUE} !important; box-shadow: 0 0 18px rgba(0, 87, 255, 0.5); background: rgba(0, 87, 255, 0.14) !important; }
/* Selection confirm: a brief green flash that settles back on the accent. */
@keyframes obFlash {
  0% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.7); border-color: #22C55E; }
  100% { box-shadow: 0 0 18px rgba(0, 87, 255, 0.5); border-color: ${BLUE}; }
}
.ob-flash { animation: obFlash 0.3s ease-out both; }
/* ---------- forms ---------- */
.vicharak-ob input, .vicharak-ob select, .vicharak-ob textarea {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #F9FAFB;
}
.vicharak-ob input::placeholder, .vicharak-ob textarea::placeholder { color: #6B7280; }
.vicharak-ob .ob-input:focus, .vicharak-ob .ob-input:focus-visible {
  outline: none;
  border-color: ${BLUE_BRIGHT};
  box-shadow: 0 0 0 1px rgba(77, 141, 255, 0.5), 0 0 16px rgba(0, 87, 255, 0.25);
}
/* ---------- picker scroll ---------- */
.ob-scroll { scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: rgba(77, 141, 255, 0.35) transparent; }
.ob-scroll::-webkit-scrollbar { width: 5px; }
.ob-scroll::-webkit-scrollbar-thumb { background: rgba(77, 141, 255, 0.35); border-radius: 99px; }
.ob-sticky-head { position: sticky; top: 0; z-index: 5; backdrop-filter: blur(8px); background: rgba(10, 13, 22, 0.9); }
/* Sub-labels and helper text — the spec's muted slate. */
.vicharak-ob .text-gray-400, .vicharak-ob .text-gray-500 { color: #A0AEC0; }
/* ---------- mobile floors ----------
 * This root is deliberately NOT .vicharak-app, so the two floors the app
 * enforces everywhere else did not reach onboarding: nothing smaller than
 * 12px, and no tap target under 44px — in the one flow every single new
 * student has to get through on a phone. */
.vicharak-ob [class*="text-[8px]"], .vicharak-ob [class*="text-[9px]"],
.vicharak-ob [class*="text-[10px]"], .vicharak-ob [class*="text-[11px]"] { font-size: 12px; }
.vicharak-ob button { min-height: 44px; }
@media (prefers-reduced-motion: reduce) {
  .vicharak-ob *, .vicharak-ob *::before, .vicharak-ob *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

/** Dark input styling shared by the onboarding form fields. */
const obInputStyle: CSSProperties = {
  background: 'rgba(17, 24, 39, 0.75)',
  border: '1px solid rgba(75, 85, 99, 0.6)',
  borderRadius: 12,
  padding: '0.7rem 0.75rem',
  /* 16px exactly. Anything smaller makes iOS Safari zoom the whole page in
   * when the field takes focus, which threw the list and the sticky CTA
   * off-screen and left the student stranded mid-onboarding. */
  fontSize: '16px',
  minHeight: 46,
  width: '100%',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

/* ------------------------------------------------------------------ */
/*  Step 2 — dream-goal examples, by exam                              */
/* ------------------------------------------------------------------ */

/**
 * Three real goals per exam, offered as one-tap starting points so the
 * student never faces an empty box. Tapping one fills the SAME single text
 * field — they are suggestions, not a picker, and the field stays free text.
 * Keyed by `vicharakai_exams.id`.
 */
const GOAL_EXAMPLES_BY_EXAM: Record<string, string[]> = {
  neet_ug: ['AIIMS Delhi', 'A government MBBS seat', 'AIR under 1000'],
  jee_main: ['IIT Bombay CSE', 'NIT Trichy', 'Rank under 5000'],
  jee_advanced: ['IIT Bombay CSE', 'IIT Delhi', 'AIR under 500'],
  neet_pg: ['MD Radiology', 'An AIIMS residency', 'Rank under 1000'],
  inicet: ['AIIMS Delhi residency', 'MD Medicine', 'Rank under 300'],
  upsc_cse: ['IAS on the first attempt', 'AIR under 100', 'Indian Foreign Service'],
  mpsc: ['Deputy Collector', 'Rank under 50', 'Clear it this attempt'],
  cat: ['IIM Ahmedabad', '99.5 percentile', 'IIM Bangalore'],
  clat: ['NLSIU Bangalore', 'NALSAR Hyderabad', 'AIR under 100'],
  ssc_cgl: ['Income Tax Inspector', 'Assistant Section Officer', 'Top of the merit list'],
  rrb_ntpc: ['Station Master', 'Top of my zone merit list', 'Clear it this cycle'],
  banking_ibps_po: ['SBI Probationary Officer', 'A PO posting this cycle', 'Clear prelims and mains'],
  ctet: ['A KVS teaching post', 'Qualify Paper I', 'Teach in a government school'],
  mcat: ['Johns Hopkins Medicine', 'A 515+ score', 'An MD seat this cycle'],
  lsat: ['Harvard Law', 'A 175+ score', 'A T14 law school'],
  gre: ['Stanford MS', 'A 330+ score', 'A funded PhD offer'],
  gmat: ['Wharton MBA', 'A 740+ score', 'An M7 business school'],
  ucat: ['Oxford Medicine', 'A top-decile score', 'A UK medical school offer'],
  a_levels: ['Three A*s', 'Cambridge Natural Sciences', 'My first-choice university'],
  gamsat: ['Melbourne MD', '70+ overall', 'A graduate-entry medicine offer'],
};

const GOAL_EXAMPLES_FALLBACK = ['My dream college', 'Clear it on the first attempt', 'A top rank'];

function goalExamples(registryExamId: string | null): string[] {
  return (registryExamId ? GOAL_EXAMPLES_BY_EXAM[registryExamId] : undefined) ?? GOAL_EXAMPLES_FALLBACK;
}

/* ------------------------------------------------------------------ */
/*  Step 1 — the greeting, personalised the moment an exam is tapped   */
/* ------------------------------------------------------------------ */

function examWelcomeCopy(entry: PickerExam | null): string {
  if (!entry) return 'What are you preparing for?';
  return `${entry.name} — let’s build your plan`;
}

/* ------------------------------------------------------------------ */
/*  Progress header — "Step X of 2" on both screens                    */
/* ------------------------------------------------------------------ */

function ObProgress({ step }: { step: ObScreen }) {
  const index = Math.max(0, OB_FLOW.indexOf(step));
  const stepNumber = index + 1;
  const percent = Math.round((stepNumber / OB_FLOW.length) * 100);
  return (
    <div className="mb-6" aria-label={`Step ${stepNumber} of ${OB_FLOW.length}`} data-testid="ob-progress">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold tracking-wide text-gray-400" data-testid="ob-progress-step">
          Step {stepNumber} of {OB_FLOW.length}
        </span>
        <span className="text-[11px] font-bold ob-grad-text" data-testid="ob-progress-percent">
          {percent}% complete
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(55, 65, 81, 0.6)' }}>
        <div className="ob-bar-fill h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The flow                                                           */
/* ------------------------------------------------------------------ */

export default function OnboardingFlow() {
  const { data, onboarding, access } = useApp();
  const { today, spaceId } = data;
  const {
    obStep, setObStep, obExam, obDate, obGoal, setObGoal,
    obCustomExam, obCustomOpen, setObCustomOpen, obSearch, setObSearch,
    obRegistryExamId, obSectionsJson, creating, acceptExam, finishOnboarding,
  } = onboarding;
  /* What the student pays after the free trial — ₹149/month for an INDIAN
   * exam (Razorpay), $14.99/month for a US/international exam (Creem). The
   * price follows the exam they just picked (pricingRegion.ts), never their
   * IP address; before any pick it reads ₹149 (India is the default). */
  const obIsIndia = examPricingIsIndia(
    obCustomExam?.id ?? obExam ?? null,
    obCustomExam?.fullName ?? obCustomExam?.name ?? null,
  );
  const obPriceLine = planPriceLabel(PREMIUM_PLAN, obIsIndia);

  /* ---- screen transitions: slide in from the right, out to the left ---- */
  const [displayStep, setDisplayStep] = useState<ObScreen>(obStep);
  const [screenPhase, setScreenPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    if (obStep === displayStep) return undefined;
    setScreenPhase('out');
    const timer = window.setTimeout(() => {
      setDisplayStep(obStep);
      setScreenPhase('in');
    }, 170);
    return () => window.clearTimeout(timer);
  }, [obStep, displayStep]);

  /* One event per screen the student actually sees — the drop-off point
     inside onboarding is otherwise invisible. Fire on the displayed step
     (after the slide) so a skipped animation still names the screen. */
  useEffect(() => {
    trackOnboardingStep(displayStep, { spaceId });
  }, [displayStep, spaceId]);

  /* ---- the catalogue: the shared vicharakai_exams registry ----
   * ONE settled render for the list. While the FIRST read is still in flight
   * the picker shows a skeleton (pickerEntries === null) instead of painting
   * the fallback list and then swapping it for the registry rows — that
   * fallback→reload→DB swap was the "exam list renders three times and
   * flickers" bug. Readiness latches on and is never revoked, so a later
   * background refresh cannot bounce the settled list back to the skeleton. */
  const registry = useExamRegistry();
  const sectionCatalog = useExamSectionRegistry();
  const catalogReadyRef = useRef(false);
  if (!registry.loading || registry.rows.length > 0) catalogReadyRef.current = true;
  const catalogReady = catalogReadyRef.current;
  /* The last non-empty list, held so a transient empty result during a later
   * refresh never swaps the settled list for the fallback mid-view. */
  const lastEntriesRef = useRef<PickerExam[] | null>(null);
  const pickerEntries: PickerExam[] | null = useMemo(() => {
    if (!catalogReady) return null;
    const entries = registry.rows.map<PickerExam>((row) => ({
      examId: (row.id ?? '').trim(),
      name: registryExamLabel(row),
      country: String(row.country || 'Other').trim() || 'Other',
      category: String(row.category || '').trim() || EXAM_CATEGORY_BY_ID[(row.id ?? '').trim()] || 'other',
      categoryLabel: String(row.category_label || '').trim() || undefined,
      popular: POPULAR_EXAM_IDS.has((row.id ?? '').trim()),
    }));
    if (entries.length > 0) return entries;
    // Registry unavailable or empty — the settled list stays put; on a
    // genuinely empty first load the hard-coded core list ships.
    return lastEntriesRef.current ?? FALLBACK_EXAMS;
  }, [catalogReady, registry.rows]);
  if (pickerEntries && pickerEntries.length > 0) lastEntriesRef.current = pickerEntries;
  const obQuery = (obSearch ?? '').trim().toLowerCase();
  const pickerGroups = useMemo(
    () => groupPickerExams(filterPickerExams(pickerEntries ?? [], obQuery)),
    [pickerEntries, obQuery],
  );

  /* ---- selection: tap selects (flash green), the named CTA confirms ---- */
  const [pendingEntry, setPendingEntry] = useState<PickerExam | null>(null);
  const [obFlashId, setObFlashId] = useState<string | null>(null);
  const [obLookupId, setObLookupId] = useState<string | null>(null);

  const draftExam = obCustomExam ?? (obExam ? getExam(obExam) : undefined);

  /** Which picker card reads as selected (incl. when the student comes Back). */
  const entrySelected = (entry: PickerExam): boolean => {
    if (pendingEntry) return pendingEntry.examId === entry.examId;
    if (obRegistryExamId) return obRegistryExamId === entry.examId;
    return false;
  };

  /** The exam the step-1 CTA acts on: this tap, or the earlier pick on Back. */
  const activeEntry: PickerExam | null =
    pendingEntry ?? (pickerEntries ?? []).find((entry) => entrySelected(entry)) ?? null;

  /** One picker tap: mark the choice (green flash) and personalise the copy —
   * the named CTA below ("Continue with NEET UG") moves the flow forward. */
  const selectExam = (entry: PickerExam) => {
    if (obLookupId) return;
    setPendingEntry(entry);
    setObFlashId(entry.examId);
    window.setTimeout(() => setObFlashId(null), 320);
  };

  /** True while the registry reads that step 1 depends on are still landing. */
  const catalogBusy = registry.loading || sectionCatalog.loading;

  /**
   * The step-1 CTA. Three ways an exam becomes a plan, in order of fidelity:
   *  1. the planner catalogue has a full local syllabus for it — use that;
   *  2. otherwise build it from its own `vicharakai_exam_sections` papers,
   *     with the registry id baked into the exam id so the structured
   *     syllabus database still resolves it later;
   *  3. only if the registry describes no sections at all, fall back to the
   *     AI syllabus lookup the typed-exam path uses.
   */
  const confirmExam = (entry: PickerExam) => {
    if (obLookupId || catalogBusy) return;
    const sections = sectionCatalog.byExamId.get(entry.examId) ?? [];
    const pick = {
      examId: entry.examId,
      sectionsJson: sections.length > 0 ? JSON.stringify(summarizeSections(sections)) : null,
    };

    const plannerId = DB_TO_PLANNER[entry.examId] ?? entry.examId;
    const preset = getExam(plannerId);
    if (preset) {
      acceptExam(preset, pick);
      return;
    }

    const subjects = sectionsToExamSubjects(sections);
    if (subjects.length > 0) {
      const fromRegistry = buildCustomExam(
        {
          // The registry id drives the slug, so `custom:neet-pg` still
          // resolves to the structured `neet_pg` syllabus downstream.
          id: customExamId(entry.examId),
          name: entry.name,
          fullName: registry.byId.get(entry.examId)?.full_name ?? entry.name,
          subjects,
          syllabusSource: 'manual',
        },
        today,
      );
      if (fromRegistry) {
        acceptExam(fromRegistry, pick);
        return;
      }
    }

    setObLookupId(entry.examId);
    void (async () => {
      try {
        const found = await lookupExamSyllabus(entry.name, today);
        if (found.status === 'found' && found.exam) {
          acceptExam(found.exam, pick);
          return;
        }
        // Nothing reliable found: proceed with a named manual exam — step 2
        // and the app behind it handle an empty subject list safely.
        const manual = buildCustomExam({ name: entry.name, subjects: [], syllabusSource: 'manual' }, today);
        if (manual) acceptExam(manual, pick);
      } finally {
        setObLookupId(null);
      }
    })();
  };

  /** Finish onboarding — create the profile from the exam and the dream goal.
   * Called by the free-trial CTA (no payment: useAccess starts the trial the
   * moment the profile exists) AND after a verified payment. */
  const finishToApp = () => {
    saveStartMode(spaceId, 'fresh');
    void finishOnboarding({
      exam: draftExam ?? null,
      date: obDate || null,
      goal: obGoal,
      registryExamId: obRegistryExamId,
      sectionsJson: obSectionsJson,
    });
  };

  const goalReady = (obGoal ?? '').trim().length >= 2;

  /* ------------------------------------------------------------------ */
  /*  The trial screen — fires the moment step 2 is done                 */
  /* ------------------------------------------------------------------ */
  if (displayStep === 'pay') {
    return (
      <div className="vicharak-ob" data-testid="screen-ob-pay">
        <style>{OB_CSS}</style>
        <PaywallScreen
          feature={null}
          blocking={false}
          trialEnded={false}
          spaceId={spaceId}
          examId={draftExam?.id ?? obExam ?? null}
          examLabel={draftExam?.fullName ?? draftExam?.name ?? null}
          userEmail={access.paidSessionEmail}
          onStartTrial={finishToApp}
          startTrialBusy={creating}
          onPaymentSuccess={(plan) => {
            // Order matters: the profile is written first, then the
            // subscription rows refresh — the student lands straight in the
            // app with Premium already on.
            finishToApp();
            access.handlePaymentSuccess(plan);
          }}
          onClose={() => setObStep('goal')}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Steps 1–2 — shared dark shell + step progress bar                  */
  /* ------------------------------------------------------------------ */
  return (
    <div
      className="vicharak-ob w-full min-h-[100dvh] flex flex-col items-center px-5 pt-7"
      style={{
        background: OB_BG,
        /* Clear of the phone's home indicator, so the last CTA on a screen is
           never half-buried under the gesture bar. */
        paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
      }}
      data-testid="screen-onboarding"
    >
      <style>{OB_CSS}</style>
      <div className={`w-full max-w-md ${screenPhase === 'out' ? 'ob-screen-out' : 'ob-screen-in'}`} key={displayStep}>
        {/* The exam picker keeps exactly ONE header (the shell's); the goal
            screen carries the small brand mark. */}
        {displayStep !== 'exam' && (
          <div className="flex items-center justify-center mb-4">
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 46,
                height: 46,
                background: 'rgba(17, 24, 39, 0.85)',
                border: `1px solid ${BLUE_BRIGHT}4D`,
                boxShadow: '0 0 18px rgba(0, 87, 255, 0.22)',
              }}
            >
              <VicharakLogoMark size={26} />
            </span>
          </div>
        )}
        <ObProgress step={displayStep} />

        {/* ---------------- step 1: choose your exam ---------------- */}
        {displayStep === 'exam' && (
          <div>
            {/* Personalises the instant a card is tapped. */}
            <h1 className="ob-title text-center" data-testid="text-exam-welcome">
              {examWelcomeCopy(activeEntry)}
            </h1>
            <p className="text-sm text-center mt-2 text-gray-400" data-testid="text-exam-sub">
              Pick your exam — your whole plan is built around it.
            </p>
            {/* Instant client-side search over the registry. */}
            <div className="relative mt-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
              <input
                value={obSearch}
                onChange={(event) => setObSearch(event.target.value)}
                placeholder="Search exams — NEET, JEE, UPSC, MCAT…"
                className="ob-input text-sm"
                style={{ ...obInputStyle, paddingLeft: '2.2rem' }}
                data-testid="input-exam-search"
              />
            </div>

            <div
              className={`ob-scroll mt-4 overflow-y-auto rounded-2xl ${OB_CARD}`}
              style={{ maxHeight: '48vh' }}
              data-testid="list-exams"
            >
              {/* First load: ONE quiet skeleton, then ONE settled list — never
                  the fallback list flashing and re-sorting while data lands. */}
              {pickerEntries === null && (
                <div className="px-3 py-3 space-y-2 animate-pulse" data-testid="list-exams-loading" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((slot) => (
                    <div
                      key={slot}
                      className="w-full px-4 py-3.5 flex items-center gap-3 rounded-2xl"
                      style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(75, 85, 99, 0.6)' }}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block h-3.5 rounded-full"
                          style={{ width: `${52 + (slot % 3) * 14}%`, background: 'rgba(75, 85, 99, 0.55)' }}
                        />
                        <span
                          className="block h-2.5 rounded-full mt-2"
                          style={{ width: '32%', background: 'rgba(55, 65, 81, 0.5)' }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {pickerGroups.map((group) => (
                <div key={group.key} data-testid={`exam-group-${group.key}`}>
                  <div className="ob-sticky-head px-4 py-2 border-b border-gray-800/70">
                    <p className="text-[11px] font-bold tracking-wide text-gray-400">{group.label}</p>
                  </div>
                  {/* Full-width tappable cards — name + category, never clipped;
                      the surrounding container scrolls when the list overflows. */}
                  <div className="px-3 py-3 space-y-2">
                    {group.exams.map((entry) => {
                      const selected = entrySelected(entry);
                      const flashing = obFlashId === entry.examId;
                      const looking = obLookupId === entry.examId;
                      return (
                        <button
                          key={entry.examId}
                          type="button"
                          onClick={() => selectExam(entry)}
                          aria-pressed={selected}
                          className={`ob-chip${selected || flashing ? ' ob-chip-on' : ''}${flashing ? ' ob-flash' : ''} w-full px-4 py-3.5 flex items-center gap-3 text-left rounded-2xl touch-manipulation`}
                          style={{
                            background: 'rgba(17, 24, 39, 0.7)',
                            border: '1px solid rgba(75, 85, 99, 0.6)',
                          }}
                          data-testid={`button-exam-${entry.examId}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-[15px] font-bold" style={{ color: '#FFFFFF' }}>{entry.name}</span>
                              {entry.popular && (
                                <span
                                  className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-bold"
                                  style={{ background: 'rgba(0, 87, 255, 0.22)', color: '#9DC0FF', border: '1px solid rgba(0, 87, 255, 0.45)' }}
                                >
                                  🔥 Popular
                                </span>
                              )}
                            </span>
                            <span className="block text-[12px] mt-0.5" style={{ color: '#A0AEC0' }}>
                              {pickerCategoryLabel(entry)}
                            </span>
                          </span>
                          {looking ? (
                            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: BLUE_BRIGHT }} aria-hidden="true" />
                          ) : selected || flashing ? (
                            <Check className="w-5 h-5 flex-shrink-0" style={{ color: BLUE_BRIGHT }} aria-hidden="true" />
                          ) : (
                            <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {pickerEntries !== null && pickerGroups.length === 0 && (
                <p className="text-xs text-center py-6 text-gray-400" data-testid="text-exam-no-match">
                  No exams match that search — pick “Other” below and type it; I’ll fetch the syllabus.
                </p>
              )}
            </div>

            {/* "Other": any exam the student types — syllabus fetched for them. */}
            <div className="mt-3">
              {obCustomOpen ? (
                <div className="rounded-2xl overflow-hidden">
                  <CustomExamEntry today={today} onReady={(exam) => acceptExam(exam)} onCancel={() => setObCustomOpen(false)} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setObCustomOpen(true)}
                  className={`ob-chip w-full p-3.5 flex items-center gap-3 text-left rounded-2xl ${OB_CARD}`}
                  style={{ borderStyle: 'dashed', borderColor: `${BLUE_BRIGHT}66` }}
                  data-testid="button-exam-custom"
                >
                  <Wand2 className="w-5 h-5 flex-shrink-0" style={{ color: BLUE_BRIGHT }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-100">Other — type your exam</span>
                    {/* Not truncated: on a 375px screen `truncate` cut this to
                        "Any other exam — I'll fetch its sylla…". It wraps. */}
                    <span className="block text-[12px] leading-snug text-gray-400">Any other exam — I’ll fetch its syllabus</span>
                  </span>
                  <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0 text-gray-500" />
                </button>
              )}
            </div>

            {/* The named CTA — "Continue with NEET UG", never a bare "Next".
                Sticky so it stays under the thumb while the list scrolls. */}
            {activeEntry && !obCustomOpen && (
              <div
                className="sticky z-20 mt-4"
                style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
              >
                <button
                  type="button"
                  disabled={Boolean(obLookupId) || catalogBusy}
                  onClick={() => confirmExam(activeEntry)}
                  className="ob-btn ob-btn-primary w-full py-4 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2"
                  data-testid="button-exam-continue"
                >
                  {obLookupId || catalogBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {obLookupId
                    ? 'Fetching your syllabus…'
                    : catalogBusy
                      ? 'Loading your exam…'
                      : `Continue with ${activeEntry.name}`}
                  {!obLookupId && !catalogBusy && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- step 2: your dream goal ---------------- */}
        {displayStep === 'goal' && (
          <div>
            <h1 className="ob-title text-center" data-testid="text-goal-headline">
              What’s your <span className="ob-grad-text">dream goal?</span>
            </h1>
            <p className="text-sm text-center mt-2 text-gray-400" data-testid="text-goal-sub">
              The thing you actually want. Everything Vicharee plans points back at it.
            </p>

            <div className={`mt-5 p-4 ${OB_CARD}`}>
              <label className="flex items-center gap-1.5 text-[12px] font-bold mb-2 text-gray-400" htmlFor="ob-dream-goal">
                <Target className="w-3.5 h-3.5" style={{ color: BLUE_BRIGHT }} aria-hidden="true" />
                Your goal
              </label>
              <textarea
                id="ob-dream-goal"
                rows={2}
                autoFocus
                value={obGoal}
                onChange={(event) => setObGoal(event.target.value)}
                placeholder={`e.g. ${goalExamples(obRegistryExamId)[0]}`}
                className="ob-input resize-none"
                style={{ ...obInputStyle, minHeight: 76 }}
                data-testid="input-dream-goal"
              />
              {/* One-tap starting points. They fill the SAME field — this step
                  stays one open text box, never a picker. */}
              <div className="mt-3">
                <p className="text-[11px] font-bold tracking-wide text-gray-400">Or start from one of these</p>
                <div className="mt-2 flex flex-wrap gap-2" data-testid="ob-goal-examples">
                  {goalExamples(obRegistryExamId).map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setObGoal(example)}
                      className="ob-chip px-3 py-2 rounded-full text-[12px] font-bold touch-manipulation"
                      style={{
                        background: 'rgba(17, 24, 39, 0.7)',
                        border: '1px solid rgba(75, 85, 99, 0.6)',
                        color: '#E5E7EB',
                      }}
                      data-testid={`ob-goal-example-${example.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-snug text-gray-400" data-testid="text-goal-hint">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ marginTop: 2, color: BLUE_BRIGHT }} aria-hidden="true" />
              A rough one is fine — it sits at the top of your Vision Board and you can change it any time.
            </p>

            <button
              type="button"
              disabled={!goalReady}
              onClick={() => setObStep('pay')}
              className="ob-btn ob-btn-primary mt-5 w-full py-4 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2"
              data-testid="button-goal-continue"
            >
              Lock in my goal
              <ChevronRight className="w-4 h-4" />
            </button>
            <p className="mt-3 text-center text-[12px] font-semibold text-gray-400" data-testid="text-goal-trial-hint">
              Next: {TRIAL_DURATION_DAYS} days free, full access — no card needed. Then {obPriceLine}.
            </p>
            <button
              type="button"
              onClick={() => setObStep('exam')}
              className="mt-2 w-full text-[13px] font-semibold text-gray-400 touch-manipulation"
              style={{ minHeight: 44 }}
              data-testid="button-ob-back-goal"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
