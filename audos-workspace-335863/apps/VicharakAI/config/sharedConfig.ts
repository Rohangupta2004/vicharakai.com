/**
 * sharedConfig — the ONE shared vocabulary for the incremental feature
 * modules added on top of the core app:
 *
 *  · REVISION_DAYS      — the canonical spaced-revision ladder (1/3/7/14).
 *                         Re-exported from config/revision.ts (the ONE
 *                         revision config) so there is still exactly one
 *                         source of truth for interval arithmetic.
 *  · DIFFICULTY         — the human difficulty vocabulary (Easy/Medium/Hard)
 *                         used by every difficulty prompt and label.
 *  · DOUBT_GRADES       — the four FSRS review responses (Again/Hard/Good/
 *                         Easy) and the FSRS rating each maps to.
 *  · WRONG_REASONS      — the fixed post-test wrong-answer taxonomy, plus
 *                         the follow-up guidance each reason maps to.
 *  · CONCEPT_KEYWORDS   — the rule-based concept keyword map used for OCR /
 *                         text concept tagging. ZERO AI calls — matching is
 *                         pure keyword/regex, entirely on-device.
 *  · ROAST templates    — tier-aware 🔥 Roast Me FALLBACK lines. roastTier()
 *                         classifies the real stats (bad/decent/good) and
 *                         buildRoast() only picks lines consistent with them
 *                         ({missedTasks}/{streak}/{overdueRevisions} slots).
 *                         The primary roast is AI-generated in
 *                         features/dashboard/RoastMe.tsx — these templates
 *                         are the deterministic offline fallback.
 *  · PYQ concept queue  — a tiny localStorage queue: concepts tagged today
 *                         surface as "practice PYQs on …" the NEXT day.
 *
 * Deterministic only — AI is NOT permitted in this file.
 */

import { TOPIC_REVISION_INTERVALS } from './revision';

/* ------------------------------------------------------------------ */
/*  Revision ladder                                                    */
/* ------------------------------------------------------------------ */

/**
 * The canonical spaced-revision intervals, in days: 1 → 3 → 7 → 14.
 * Aliased from config/revision.ts so scheduling maths keeps ONE home
 * (engine/revisionEngine.ts) — never do interval arithmetic against this
 * array directly; call the revision engine instead.
 */
export const REVISION_DAYS: readonly number[] = TOPIC_REVISION_INTERVALS;

/* ------------------------------------------------------------------ */
/*  Shared taxonomy — re-exported from config/taxonomy.ts (ONE home)   */
/* ------------------------------------------------------------------ */

/* Every reason/difficulty vocabulary (the four FSRS doubt grades, the six
 * post-test wrong-answer reasons + coaching follow-ups, content difficulty)
 * lives in config/taxonomy.ts. Re-exported here so existing import sites
 * keep working — the definitions themselves are never duplicated. */
export {
  DIFFICULTY,
  NO_REVISION_LABEL,
  DOUBT_GRADES,
  DOUBT_GRADE_LABELS,
  DOUBT_EASY_MAX_SECONDS,
  DOUBT_GOOD_MAX_SECONDS,
  doubtGradeFromSeconds,
  DOUBT_GRADE_TO_FSRS,
  isSuccessfulRecall,
  WRONG_REASONS,
  isWrongReason,
  WRONG_REASON_FOLLOWUPS,
} from './taxonomy';
export type { DifficultyLabel, DoubtGrade, WrongReason } from './taxonomy';

/* ------------------------------------------------------------------ */
/*  Feature flags                                                      */
/* ------------------------------------------------------------------ */

// TODO: Re-enable once question generation is validated — currently producing incorrect answers
/** Gates every flow that AUTO-GENERATES test questions with AI: fresh
 * questions for Test Mode shortfalls, the AI 'similar'/'mix' generated-test
 * modes, doubt→MCQ conversion inside the flagged practice test, and the
 * one-tap doubt practice test. While false the UI hides those sub-flows
 * entirely; every code path is kept intact behind this flag. */
export const ENABLE_AUTO_QUESTION_GEN = false;

/* ------------------------------------------------------------------ */
/*  Rule-based concept keyword map (zero AI calls)                     */
/* ------------------------------------------------------------------ */

/**
 * concept → lowercase keywords that indicate it. Matching is a plain
 * substring scan over the lowercased text (longest keyword wins ties), so
 * OCR output, typed doubts and test questions all tag the same way,
 * entirely on-device.
 */
export const CONCEPT_KEYWORDS: Record<string, readonly string[]> = {
  // Physics — mechanics
  "Newton's Laws of Motion": ['newton', 'first law', 'second law', 'third law', 'inertia', 'f = ma', 'f=ma'],
  'Kinematics — Projectile Motion': ['projectile', 'trajectory', 'range of projectile', 'time of flight'],
  'Work, Energy & Power': ['work done', 'kinetic energy', 'potential energy', 'work-energy', 'power delivered'],
  'Circular Motion': ['circular motion', 'centripetal', 'angular velocity', 'banking of road'],
  'Rotational Dynamics': ['moment of inertia', 'torque', 'angular momentum', 'rolling'],
  Gravitation: ['gravitation', 'escape velocity', 'orbital', 'kepler', 'satellite'],
  'Simple Harmonic Motion': ['simple harmonic', 'shm', 'oscillation', 'pendulum', 'spring constant'],
  'Fluid Mechanics': ['bernoulli', 'viscosity', 'buoyan', 'surface tension', 'fluid'],
  // Physics — electricity & magnetism
  "Kirchhoff's Laws": ['kirchhoff', 'loop rule', 'junction rule', 'kvl', 'kcl'],
  "Ohm's Law & Resistance": ['ohm', 'resistivity', 'resistance in series', 'resistance in parallel'],
  'Capacitors & Capacitance': ['capacitor', 'capacitance', 'dielectric', 'parallel plate'],
  'Electrostatics — Coulomb & Fields': ['coulomb', 'electric field', 'electric flux', 'gauss', 'point charge'],
  'Magnetic Effects of Current': ['biot', 'savart', 'ampere', 'magnetic field due to', 'solenoid'],
  'Electromagnetic Induction': ['faraday', 'lenz', 'induced emf', 'induction', 'eddy current'],
  'Alternating Current': ['alternating current', 'ac circuit', 'impedance', 'resonance in lcr', 'transformer'],
  // Physics — optics & modern
  'Ray Optics': ['refraction', 'total internal reflection', 'lens formula', 'mirror formula', 'prism'],
  'Wave Optics': ['interference', 'diffraction', 'polarisation', 'young', 'double slit'],
  'Photoelectric Effect': ['photoelectric', 'work function', 'photon', 'de broglie'],
  'Atomic & Nuclear Physics': ['bohr', 'radioactiv', 'half-life', 'half life', 'nuclear', 'binding energy'],
  Thermodynamics: ['thermodynamic', 'entropy', 'enthalpy', 'isothermal', 'adiabatic', 'carnot', 'first law of thermo'],
  'Kinetic Theory of Gases': ['kinetic theory', 'ideal gas', 'rms speed', 'mean free path'],
  // Chemistry
  'Chemical Bonding': ['hybridisation', 'hybridization', 'vsepr', 'molecular orbital', 'sigma bond', 'pi bond', 'lattice energy'],
  'Atomic Structure': ['quantum number', 'orbital', 'aufbau', 'electronic configuration', 'heisenberg'],
  'Periodic Table & Periodicity': ['periodic', 'electronegativity', 'ionisation energy', 'ionization energy', 'atomic radius'],
  'Chemical Equilibrium': ['equilibrium constant', 'le chatelier', 'kp', 'kc'],
  'Ionic Equilibrium — pH & Buffers': ['ph of', 'buffer', 'solubility product', 'ksp', 'ionic equilibrium'],
  Electrochemistry: ['electrochem', 'electrolysis', 'nernst', 'galvanic', 'electrode potential'],
  'Chemical Kinetics': ['rate of reaction', 'order of reaction', 'activation energy', 'arrhenius', 'rate constant'],
  'Organic Chemistry — GOC': ['organic chemistry', 'resonance', 'inductive effect', 'carbocation', 'hyperconjugation', 'isomerism'],
  'Organic Reactions & Mechanisms': ['sn1', 'sn2', 'elimination reaction', 'electrophilic', 'nucleophilic', 'markovnikov', 'grignard'],
  'Coordination Compounds': ['coordination', 'ligand', 'crystal field', 'chelate'],
  'Solutions & Colligative Properties': ['colligative', 'raoult', 'molality', 'osmotic pressure', 'freezing point depression'],
  'Mole Concept & Stoichiometry': ['mole concept', 'stoichiometr', 'limiting reagent', 'molar mass', 'empirical formula'],
  // Mathematics
  'Integration — Calculus': ['integration', 'integral', 'antiderivative', 'definite integral', 'area under'],
  'Differentiation & Applications': ['differentiation', 'derivative', 'maxima', 'minima', 'tangent and normal', 'rate of change'],
  'Limits & Continuity': ['limit of', 'continuity', 'l hospital', "l'hospital", 'lim x'],
  'Quadratic Equations': ['quadratic', 'discriminant', 'roots of the equation'],
  'Sequences & Series': ['arithmetic progression', 'geometric progression', ' ap ', ' gp ', 'sum of n terms', 'series'],
  'Permutations & Combinations': ['permutation', 'combination', 'ncr', 'npr', 'arrangements'],
  Probability: ['probability', 'bayes', 'dice', 'random variable', 'conditional probability'],
  'Matrices & Determinants': ['matrix', 'matrices', 'determinant', 'adjoint', 'inverse of a'],
  Trigonometry: ['trigonometr', 'sin ', 'cos ', 'tan ', 'identities', 'inverse trig'],
  'Coordinate Geometry': ['straight line', 'circle equation', 'parabola', 'ellipse', 'hyperbola', 'locus'],
  Vectors: ['vector', 'dot product', 'cross product', 'scalar triple'],
  'Complex Numbers': ['complex number', 'argand', 'modulus and argument', 'iota', 'cube root of unity'],
  // Biology (NEET)
  'Cell Biology': ['cell wall', 'mitochondria', 'cell membrane', 'organelle', 'cell cycle', 'mitosis', 'meiosis'],
  'Genetics & Inheritance': ['mendel', 'genetics', 'inheritance', 'dominant', 'recessive', 'chromosome', 'dna replication'],
  'Human Physiology — Circulation': ['heart', 'blood pressure', 'cardiac', 'circulatory', 'haemoglobin', 'hemoglobin'],
  'Human Physiology — Nervous System': ['neuron', 'nervous system', 'synapse', 'reflex arc', 'action potential'],
  'Plant Physiology — Photosynthesis': ['photosynthesis', 'chlorophyll', 'calvin cycle', 'light reaction'],
  'Ecology & Environment': ['ecosystem', 'ecology', 'food chain', 'biodiversity', 'population growth'],
  'Animal Tissues': ['animal tissue', 'epithelial', 'connective tissue', 'squamous', 'histology'],
  Evolution: ['evolution', 'darwin', 'natural selection', 'speciation', 'homologous'],
  'Human Reproduction': ['menstrual', 'gametogenesis', 'fertilisation', 'fertilization', 'embryo'],
  Biomolecules: ['biomolecule', 'protein structure', 'enzyme', 'carbohydrate', 'nucleic acid'],
};

export interface ConceptTagOptions {
  /** Concepts to steer away from (e.g. already used on this batch of doubts)
   * — a different matching concept wins when one exists. */
  avoid?: ReadonlySet<string>;
}

/** Score every concept against the text; returns matches sorted best-first. */
export function matchConcepts(text: string): Array<{ concept: string; score: number }> {
  const hay = ` ${String(text || '').toLowerCase().replace(/\s+/g, ' ')} `;
  if (hay.trim() === '') return [];
  const hits: Array<{ concept: string; score: number }> = [];
  for (const [concept, keywords] of Object.entries(CONCEPT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (hay.includes(keyword)) score += 10 + keyword.length; // longer keywords are stronger evidence
    }
    if (score > 0) hits.push({ concept, score });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/**
 * The rule-based concept tag for a piece of text (OCR output, a typed doubt,
 * a test question). Returns null when nothing in the map matches — callers
 * keep their existing fallbacks (topic → subject). When `avoid` is given and
 * an alternative match exists, the alternative wins, so a batch of doubts
 * differentiates concepts instead of repeating the same tag.
 */
export function tagConcept(text: string, options: ConceptTagOptions = {}): string | null {
  const matches = matchConcepts(text);
  if (matches.length === 0) return null;
  if (options.avoid && options.avoid.size > 0) {
    const fresh = matches.find((m) => !options.avoid!.has(m.concept));
    if (fresh) return fresh.concept;
  }
  return matches[0].concept;
}

/* ------------------------------------------------------------------ */
/*  🔥 Roast Me fallback templates (deterministic, tier-aware)         */
/* ------------------------------------------------------------------ */

export interface RoastStats {
  /** Carried-over / missed tasks right now. */
  missedTasks: number;
  /** Current daily streak. */
  streak: number;
  /** Spaced revisions past their due date. */
  overdueRevisions: number;
}

/** How the student is ACTUALLY doing — drives both the AI prompt's tone
 * and which fallback template pool is allowed. */
export type RoastTier = 'bad' | 'decent' | 'good';

/**
 * Classify the stats so roast copy can never contradict them: someone with
 * 0 missed tasks and 0 overdue revisions must NEVER be told their to-do
 * list "has commitment issues" — the roast has to find something else.
 */
export function roastTier(stats: RoastStats): RoastTier {
  const missed = Math.max(0, stats.missedTasks);
  const overdue = Math.max(0, stats.overdueRevisions);
  if (missed === 0 && overdue === 0) return 'good';
  if (missed >= 3 || overdue >= 3 || missed + overdue >= 4) return 'bad';
  return 'decent';
}

/** HARD roasts — only for genuinely bad stats. Lines referencing a stat
 * slot are filtered out by buildRoast() when that stat is 0. */
export const ROAST_TEMPLATES_BAD: readonly string[] = [
  '{missedTasks} missed tasks and a {streak}-day streak? Your to-do list has commitment issues and honestly, so do you.',
  'Your {overdueRevisions} overdue revisions called. They\u2019ve formed a support group. They meet daily. Unlike you and your books.',
  'Physics has Newton\u2019s laws. You have {missedTasks} pending tasks and the law of infinite postponement.',
  'Spaced repetition works at 1, 3, 7 and 14 days. Your version — {overdueRevisions} overdue revisions — is called spaced procrastination.',
  'You\u2019ve mastered the hardest chapter of all: adding tasks. Completing them? {missedTasks} still waiting for their hero.',
  'If ignoring revisions were an exam topic you\u2019d have 100 percentile — {overdueRevisions} overdue and counting.',
  'Toppers fear one thing: running out of syllabus. You fear one thing: your own {missedTasks}-task backlog making eye contact.',
  'Your books miss you. Your {overdueRevisions} overdue revisions miss you. Your rank? It\u2019s moving on without you.',
];

/** MILD teasing — for stats that are merely unimpressive, never harsh. */
export const ROAST_TEMPLATES_DECENT: readonly string[] = [
  'Only {missedTasks} missed? Cute. That\u2019s not a backlog yet — it\u2019s a backlog with training wheels. Clear it before it learns to multiply.',
  '{overdueRevisions} overdue revisions isn\u2019t a crisis. It\u2019s a crisis with a learner\u2019s permit. Park it today.',
  'A {streak}-day streak with {missedTasks} missed on the side — you\u2019re speedrunning \u201calmost consistent\u201d.',
  'Not bad, not topper. {missedTasks} missed tasks is the study equivalent of leaving one bite on the plate.',
  '{overdueRevisions} revisions past due. Your memory is doing its half of spaced repetition — it\u2019s waiting on you for the other half.',
  'Respectable-ish. But {missedTasks} missed and {overdueRevisions} overdue means your plan is still beating you on penalties.',
];

/** GOOD stats, short streak — nothing real to roast, so mock-praise and
 * tease the streak still being young. NEVER claims they slack. */
export const ROAST_TEMPLATES_GOOD: readonly string[] = [
  '0 missed, 0 overdue, a {streak}-day streak. Fine. We get it. The only thing left to roast is how smug you\u2019re about to feel.',
  'A {streak}-day streak? Bold of you to call that a habit. Adorable start though — even toppers began somewhere.',
  'Zero missed tasks, zero overdue revisions. You pressed a roast button just to be told you\u2019re doing fine. THAT\u2019s the roast.',
  'Nothing missed, nothing overdue. Your discipline is so clean it\u2019s boring — your backlog quit out of unemployment.',
  'Perfect record, {streak}-day streak. Suspiciously organised. Blink twice if the to-do list is holding you hostage.',
];

/** GOOD stats with a real streak (7+ days) — pure sarcastic applause. */
export const ROAST_TEMPLATES_GOOD_LONG_STREAK: readonly string[] = [
  '{streak} days straight, 0 missed, 0 overdue. At this point the syllabus should be scared of YOU.',
  'A {streak}-day streak and a spotless queue. We came to roast and found nothing flammable. Disgusting. Keep going.',
  'Zero missed, zero overdue, {streak} days running. The only thing getting cooked here is the competition.',
];

/** Legacy flat export — kept so older import sites keep compiling. New code
 * should call buildRoast(), which picks a stat-consistent pool itself. */
export const ROAST_TEMPLATES: readonly string[] = [
  ...ROAST_TEMPLATES_BAD,
  ...ROAST_TEMPLATES_DECENT,
  ...ROAST_TEMPLATES_GOOD,
  ...ROAST_TEMPLATES_GOOD_LONG_STREAK,
];

/**
 * Fill one roast template from real stats — the deterministic FALLBACK for
 * when the AI roast is unavailable. The pool is chosen by roastTier(), and
 * within the bad/decent pools any line referencing a stat that is 0 is
 * excluded, so the sentence can never contradict the numbers shown beside
 * it. `seed` rotates within the eligible pool — pass an incrementing tap
 * count for a new roast per tap.
 */
export function buildRoast(stats: RoastStats, seed = 0): string {
  const missed = Math.max(0, stats.missedTasks);
  const overdue = Math.max(0, stats.overdueRevisions);
  const streak = Math.max(0, stats.streak);
  const tier = roastTier(stats);
  let pool: readonly string[];
  if (tier === 'good') {
    pool = streak >= 7 ? ROAST_TEMPLATES_GOOD_LONG_STREAK : ROAST_TEMPLATES_GOOD;
  } else {
    const source = tier === 'bad' ? ROAST_TEMPLATES_BAD : ROAST_TEMPLATES_DECENT;
    const fits = source.filter(
      (t) =>
        (missed > 0 || !t.includes('{missedTasks}')) &&
        (overdue > 0 || !t.includes('{overdueRevisions}')),
    );
    pool = fits.length > 0 ? fits : source;
  }
  const index = Math.abs(Math.trunc(seed)) % pool.length;
  // split/join instead of replaceAll — keeps older mobile WebViews happy.
  return pool[index]
    .split('{missedTasks}').join(String(missed))
    .split('{streak}').join(String(streak))
    .split('{overdueRevisions}').join(String(overdue));
}

/* ------------------------------------------------------------------ */
/*  Next-day PYQ concept queue (stored locally — zero AI, zero server)  */
/* ------------------------------------------------------------------ */

interface PyqQueueEntry {
  concept: string;
  /** The ISO date the concept becomes due for PYQ practice. */
  dueOn: string;
}

const PYQ_QUEUE_PREFIX = 'vicharak_pyq_queue_';
/** Entries older than this many days past due are swept out. */
const PYQ_QUEUE_MAX_AGE_DAYS = 14;

function pyqKey(spaceId: string): string {
  return `${PYQ_QUEUE_PREFIX}${spaceId}`;
}

function readPyqQueue(spaceId: string): PyqQueueEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(pyqKey(spaceId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PyqQueueEntry =>
        !!e && typeof e === 'object' && typeof (e as PyqQueueEntry).concept === 'string' && typeof (e as PyqQueueEntry).dueOn === 'string',
    );
  } catch {
    return [];
  }
}

function writePyqQueue(spaceId: string, entries: PyqQueueEntry[]): void {
  try {
    window.localStorage.setItem(pyqKey(spaceId), JSON.stringify(entries.slice(0, 60)));
  } catch {
    /* storage unavailable — the queue simply lives for this visit only */
  }
}

/** Queue a tagged concept so related PYQs are suggested on `dueOn`
 * (typically tomorrow). Deduped per concept — the earliest due date wins. */
export function queuePyqConcept(spaceId: string, concept: string, dueOn: string): void {
  const clean = concept.trim();
  if (!clean) return;
  const entries = readPyqQueue(spaceId);
  const existing = entries.find((e) => e.concept === clean);
  if (existing) {
    if (dueOn < existing.dueOn) existing.dueOn = dueOn;
  } else {
    entries.push({ concept: clean, dueOn });
  }
  writePyqQueue(spaceId, entries);
}

/** Concepts whose PYQ practice is due on or before `today`, oldest first.
 * Also prunes entries so far past due they are no longer useful. */
export function duePyqConcepts(spaceId: string, today: string): string[] {
  const entries = readPyqQueue(spaceId);
  const cutoff = new Date(`${today}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - PYQ_QUEUE_MAX_AGE_DAYS);
  const pad = (n: number) => String(n).padStart(2, '0');
  const oldest = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const kept = entries.filter((e) => e.dueOn >= oldest);
  if (kept.length !== entries.length) writePyqQueue(spaceId, kept);
  return kept
    .filter((e) => e.dueOn <= today)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((e) => e.concept);
}

/** Remove one concept from the PYQ queue (it was practised or dismissed). */
export function clearPyqConcept(spaceId: string, concept: string): void {
  writePyqQueue(spaceId, readPyqQueue(spaceId).filter((e) => e.concept !== concept));
}
