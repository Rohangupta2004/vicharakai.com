/**
 * THE EXAM-SPECIFIC DAY-ONE PLAN (founder instruction, 2026-09-27).
 *
 * The hero's “Your plan tomorrow morning” card used to print the SAME three
 * topics to every visitor on a route — an SAT student and a JEE aspirant both
 * read “Organic Chemistry: Reaction mechanisms”. The card is the page's only
 * proof that the product produces something specific, so printing a generic
 * list was the one place the page undercut its own claim.
 *
 * Tapping an exam chip in the hero now swaps these rows. Every entry below is
 * three REAL topics from that exam's own syllabus, in the three states the app
 * actually produces:
 *
 *   weak — a chapter the student keeps dropping marks in, pulled to the front;
 *   due  — a topic whose spaced revision lands today;
 *   ok   — something that is holding, and can safely wait.
 *
 * NOTHING HERE IS A PROMISE THE APP CANNOT KEEP. These are sample topics for a
 * plan the app really builds from a student's own log — the card's footer says
 * exactly that. Keep the topic names real: a plausible-but-wrong chapter name
 * is worse to an aspirant than a generic one.
 *
 * Keys are matched case- and punctuation-insensitively (see `normalise`), so
 * “A-Level”, “A Level” and “A-Levels” all resolve to the same entry. An exam
 * with no entry falls back to the region's own configured rows, so adding a
 * chip to landingRegions.ts can never blank the card.
 */

export type DayOneState = 'weak' | 'due' | 'ok';

export interface ExamPlanRow {
  state: DayOneState;
  subject: string;
  topic: string;
}

/** One exam's three sample rows, in the order the app would hand them over. */
type ExamPlan = [ExamPlanRow, ExamPlanRow, ExamPlanRow];

function plan(
  weak: [string, string],
  due: [string, string],
  ok: [string, string],
): ExamPlan {
  return [
    { state: 'weak', subject: weak[0], topic: weak[1] },
    { state: 'due', subject: due[0], topic: due[1] },
    { state: 'ok', subject: ok[0], topic: ok[1] },
  ];
}

const EXAM_PLANS: Record<string, ExamPlan> = {
  /* ---------- India ---------- */
  jee: plan(
    ['Organic Chemistry', 'Reaction mechanisms (GOC)'],
    ['Physics', 'Rotational motion'],
    ['Maths', 'Definite integration'],
  ),
  neet: plan(
    ['Biology', 'Neural control & coordination'],
    ['Organic Chemistry', 'Aldehydes & ketones'],
    ['Physics', 'Current electricity'],
  ),
  'neet pg': plan(
    ['Pharmacology', 'Antimicrobials'],
    ['Medicine', 'Acid\u2013base disorders'],
    ['Anatomy', 'Brachial plexus'],
  ),
  inicet: plan(
    ['Pathology', 'Neoplasia'],
    ['Microbiology', 'Bacterial genetics'],
    ['Physiology', 'Cardiac cycle'],
  ),
  upsc: plan(
    ['Polity', 'Constitutional amendments'],
    ['Modern History', 'The Gandhian era'],
    ['Geography', 'The Indian monsoon'],
  ),
  mpsc: plan(
    ['Maharashtra Polity', 'Panchayati Raj institutions'],
    ['Modern History', 'Maharashtra social reformers'],
    ['Geography', 'Rivers & drainage of Maharashtra'],
  ),
  cat: plan(
    ['DILR', 'Arrangements & puzzles'],
    ['Quant', 'Time, speed & distance'],
    ['VARC', 'Reading comprehension'],
  ),
  clat: plan(
    ['Legal Reasoning', 'Law of torts'],
    ['Logical Reasoning', 'Assumptions & inferences'],
    ['English', 'Reading comprehension'],
  ),
  ssc: plan(
    ['Quantitative Aptitude', 'Percentages, profit & loss'],
    ['General Awareness', 'Indian polity'],
    ['Reasoning', 'Series & analogies'],
  ),
  rrb: plan(
    ['Quantitative Aptitude', 'Simplification & averages'],
    ['General Science', 'Physics: work, power & energy'],
    ['Reasoning', 'Coding\u2013decoding'],
  ),
  gate: plan(
    ['Engineering Mathematics', 'Linear algebra'],
    ['Networks', 'Transient analysis'],
    ['Digital Logic', 'Combinational circuits'],
  ),
  boards: plan(
    ['Physics', 'Electromagnetic induction'],
    ['Chemistry', 'Chemical kinetics'],
    ['Maths', 'Probability'],
  ),

  /* ---------- United States ---------- */
  sat: plan(
    ['Reading', 'Reading comprehension'],
    ['Math', 'Algebra 2 \u2014 quadratics & systems'],
    ['Writing', 'Evidence-based writing'],
  ),
  act: plan(
    ['Science', 'Data representation passages'],
    ['Math', 'Trigonometry & coordinate geometry'],
    ['English', 'Punctuation & usage'],
  ),
  ap: plan(
    ['AP Biology', 'Cellular energetics'],
    ['AP US History', 'Period 5 (1844\u20131877)'],
    ['AP Calculus AB', 'Derivative rules'],
  ),
  mcat: plan(
    ['Biochemistry', 'Enzyme kinetics'],
    ['CARS', 'Passage reasoning drills'],
    ['Psych/Soc', 'Learning & memory'],
  ),
  usmle: plan(
    ['Pharmacology', 'Autonomic drugs'],
    ['Pathology', 'Cardiovascular pathology'],
    ['Biochemistry', 'Metabolic pathways'],
  ),
  gre: plan(
    ['Quant', 'Data interpretation'],
    ['Verbal', 'Text completion'],
    ['Analytical Writing', 'Analyse an argument'],
  ),
  gmat: plan(
    ['Data Insights', 'Multi-source reasoning'],
    ['Quant', 'Number properties'],
    ['Verbal', 'Critical reasoning'],
  ),
  lsat: plan(
    ['Logical Reasoning', 'Flaw-in-the-reasoning questions'],
    ['Logic Games', 'Grouping games'],
    ['Reading', 'Comparative passages'],
  ),

  /* ---------- United Kingdom & international ---------- */
  gcse: plan(
    ['Maths', 'Quadratic graphs'],
    ['Combined Science', 'Electricity'],
    ['English Literature', 'Macbeth \u2014 themes'],
  ),
  'a level': plan(
    ['Chemistry', 'Organic mechanisms'],
    ['Maths', 'Integration by parts'],
    ['Biology', 'Gas exchange'],
  ),
  ucat: plan(
    ['Decision Making', 'Logical puzzles'],
    ['Quantitative Reasoning', 'Ratios & rates'],
    ['Verbal Reasoning', 'Inference questions'],
  ),
  ib: plan(
    ['Maths AA HL', 'Complex numbers'],
    ['Chemistry HL', 'Energetics'],
    ['English A', 'Paper 1 guided analysis'],
  ),
  igcse: plan(
    ['Physics', 'Waves & sound'],
    ['Maths', 'Trigonometry'],
    ['Chemistry', 'The periodic table'],
  ),
  'university entrance': plan(
    ['Maths', 'Calculus fundamentals'],
    ['Physics', 'Mechanics \u2014 momentum'],
    ['English', 'Essay structure & argument'],
  ),
};

/** Chips that name the same exam as an entry above. */
const ALIASES: Record<string, string> = {
  'a levels': 'a level',
  'a-levels': 'a level',
  alevel: 'a level',
  neetpg: 'neet pg',
  'neet-pg': 'neet pg',
  'ap exams': 'ap',
  'usmle step 1': 'usmle',
  banking: 'ssc',
  defence: 'ssc',
  teaching: 'ssc',
  railways: 'rrb',
  'board exams': 'boards',
  'class 12 boards': 'boards',
  'university entrance exams': 'university entrance',
};

/** Lower-case, punctuation collapsed to single spaces — so “A-Level”,
 *  “A Level” and “a  level” are one key. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The three sample rows for this exam chip, or null when the exam has no
 * entry — callers then fall back to the region's own configured rows rather
 * than rendering an empty card.
 */
export function examDayOnePlan(exam: string | null | undefined): ExamPlanRow[] | null {
  if (!exam) return null;
  const key = normalise(exam);
  if (!key) return null;
  const direct = EXAM_PLANS[key] ?? EXAM_PLANS[ALIASES[key] ?? ''];
  return direct ? direct.map((row) => ({ ...row })) : null;
}
