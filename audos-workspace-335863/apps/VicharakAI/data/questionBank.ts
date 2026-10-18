/**
 * VicharakAI PYQ Question Bank — the seeded, VERIFIED previous-year questions
 * the Practice tab serves offline (no AI generation, no network).
 *
 * SOURCING RULES (do not relax):
 *  - ONLY questions from publicly released official papers may live here —
 *    NTA papers for JEE Main / NEET UG, the Union Public Service Commission's
 *    published papers for UPSC CSE. Never an invented or "AI-written" question.
 *  - `official_source` must name the exact paper (body, exam, year, and the
 *    session/shift where the exam has one).
 *  - `explanation` states why the correct option is right; keep it faithful to
 *    the official answer key.
 *  - New entries append to QUESTION_BANK with a new stable `id` — ids are
 *    referenced by rows in the vicharakai_question_attempts table, so an id
 *    must never be reused or repointed at different content.
 */

export type QuestionBankExam =
  | 'JEE_MAIN'
  | 'JEE_ADVANCED'
  | 'NEET_UG'
  | 'NEET_PG'
  | 'UPSC_CSE'
  | 'CAT'
  | 'MCAT'
  | 'USMLE'
  | 'GRE'
  | 'LSAT'
  | 'SAT'
  | 'BAR_EXAM';

export type QuestionOptionLetter = 'A' | 'B' | 'C' | 'D';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankEntry {
  /** Stable id — never reuse (attempt rows reference it). */
  id: string;
  exam: QuestionBankExam;
  subject: string;
  chapter: string;
  /** The official paper year. */
  year: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: QuestionOptionLetter;
  /** Why the correct option is right (verified against the official key). */
  explanation: string;
  /** Exact official provenance, e.g. 'NTA JEE Main 2023 (31 Jan, Shift 1)'. */
  official_source: string;
  difficulty: QuestionDifficulty;
  /** Subtopic tags for matching against weakness data. */
  tags: string[];
}

export const QUESTION_BANK_EXAM_LABELS: Record<QuestionBankExam, string> = {
  JEE_MAIN: 'JEE Main',
  JEE_ADVANCED: 'JEE Advanced',
  NEET_UG: 'NEET UG',
  NEET_PG: 'NEET PG',
  UPSC_CSE: 'UPSC CSE',
  CAT: 'CAT',
  MCAT: 'MCAT',
  USMLE: 'USMLE',
  GRE: 'GRE',
  LSAT: 'LSAT',
  SAT: 'SAT',
  BAR_EXAM: 'Bar Exam',
};

/** Bank exam → pyq_exams.code, for the DB-backed question pool
 * (pyq-practice-pool server function). Every bank exam has a pyq code. */
export const BANK_EXAM_TO_PYQ_CODE: Record<QuestionBankExam, string> = {
  JEE_MAIN: 'jee_main',
  JEE_ADVANCED: 'jee_advanced',
  NEET_UG: 'neet_ug',
  NEET_PG: 'neet_pg',
  UPSC_CSE: 'upsc_cse',
  CAT: 'cat',
  MCAT: 'mcat',
  USMLE: 'usmle',
  GRE: 'gre',
  LSAT: 'lsat',
  SAT: 'sat',
  BAR_EXAM: 'bar_exam',
};

/** pyq_exams.code → bank exam (reverse of BANK_EXAM_TO_PYQ_CODE). */
export function bankExamForPyqCode(code: string | null | undefined): QuestionBankExam | null {
  const clean = String(code ?? '').trim().toLowerCase();
  for (const [bankExam, pyqCode] of Object.entries(BANK_EXAM_TO_PYQ_CODE)) {
    if (pyqCode === clean) return bankExam as QuestionBankExam;
  }
  return null;
}

/** Profile/syllabus exam ids (examCatalog / exam_syllabi) → bank exam codes. */
const PROFILE_EXAM_TO_BANK: Record<string, QuestionBankExam> = {
  jee_main: 'JEE_MAIN',
  jee_advanced: 'JEE_ADVANCED',
  neet_ug: 'NEET_UG',
  neet: 'NEET_UG',
  neet_pg: 'NEET_PG',
  upsc_cse: 'UPSC_CSE',
  upsc: 'UPSC_CSE',
  cat: 'CAT',
  mcat: 'MCAT',
  usmle: 'USMLE',
  gre: 'GRE',
  lsat: 'LSAT',
  sat: 'SAT',
  psat: 'SAT',
};

/** The bank exam for a student's chosen exam id — null when the bank has no
 * matching vertical (custom exams, banking, SSC…). */
export function bankExamForProfileExam(profileExamId: string | null | undefined): QuestionBankExam | null {
  const clean = String(profileExamId ?? '').trim().toLowerCase();
  return PROFILE_EXAM_TO_BANK[clean] ?? null;
}

/* ------------------------------------------------------------------ */
/*  The seed — verified PYQs from officially released 2020–2024 papers */
/* ------------------------------------------------------------------ */

export const QUESTION_BANK: QuestionBankEntry[] = [
  /* ---------- JEE Main · Physics ---------- */
  {
    id: 'jeemain-2023-phy-newton-01',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Laws of Motion',
    year: 2023,
    question_text:
      'A body of mass 500 g moves along the x-axis such that its velocity varies with displacement x according to the relation v = 10\u221Ax m/s. The force acting on the body is:',
    option_a: '125 N',
    option_b: '25 N',
    option_c: '166 N',
    option_d: '5 N',
    correct_option: 'B',
    explanation:
      'When velocity is a function of position, a = v(dv/dx). Here dv/dx = 5/\u221Ax, so a = 10\u221Ax \u00D7 5/\u221Ax = 50 m/s\u00B2 (constant). F = ma = 0.5 kg \u00D7 50 m/s\u00B2 = 25 N.',
    official_source: 'NTA JEE Main 2023 (11 April, Shift 2)',
    difficulty: 'medium',
    tags: ['newtons-second-law', 'variable-velocity', 'kinematics-calculus'],
  },
  {
    id: 'jeemain-2023-phy-projectile-02',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Motion in a Plane',
    year: 2023,
    question_text:
      'The initial speed of a projectile fired from the ground is u. At the highest point during its motion, the speed of the projectile is (\u221A3/2)u. The time of flight of the projectile is:',
    option_a: '2u/g',
    option_b: 'u/g',
    option_c: '\u221A3u/g',
    option_d: 'u/2g',
    correct_option: 'B',
    explanation:
      'At the highest point only the horizontal component remains: u cos\u03B8 = (\u221A3/2)u, so \u03B8 = 30\u00B0. Time of flight T = 2u sin\u03B8/g = 2u(1/2)/g = u/g.',
    official_source: 'NTA JEE Main 2023 (31 January, Shift 1)',
    difficulty: 'medium',
    tags: ['projectile-motion', 'time-of-flight', 'velocity-components'],
  },
  {
    id: 'jeemain-2023-phy-magnet-03',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Magnetism and Matter',
    year: 2023,
    question_text:
      'A bar magnet with a magnetic moment of 5.0 A\u00B7m\u00B2 is placed parallel to a magnetic field of 0.4 T. The amount of work required to turn the magnet from the parallel to the antiparallel position relative to the field direction is:',
    option_a: '4 J',
    option_b: '2 J',
    option_c: '1 J',
    option_d: 'Zero',
    correct_option: 'A',
    explanation:
      'W = MB(cos\u03B8\u1D62 \u2212 cos\u03B8f) = MB(cos 0\u00B0 \u2212 cos 180\u00B0) = 2MB = 2 \u00D7 5.0 \u00D7 0.4 = 4 J. Parallel is the minimum-energy orientation (\u2212MB) and antiparallel the maximum (+MB).',
    official_source: 'NTA JEE Main 2023 (31 January, Shift 1)',
    difficulty: 'easy',
    tags: ['magnetic-dipole', 'potential-energy', 'work-done'],
  },
  {
    id: 'jeemain-2023-phy-gravity-04',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Gravitation',
    year: 2023,
    question_text:
      'At a certain depth d below the surface of the Earth, the value of acceleration due to gravity becomes four times its value at a height 3R above the Earth\u2019s surface, where R is the radius of the Earth (take R = 6400 km). The depth d is equal to:',
    option_a: '640 km',
    option_b: '2560 km',
    option_c: '4800 km',
    option_d: '5260 km',
    correct_option: 'C',
    explanation:
      'At height 3R: g\u2095 = g(R/(R+3R))\u00B2 = g/16. The condition gives g_d = 4 \u00D7 g/16 = g/4. Using g_d = g(1 \u2212 d/R): 1/4 = 1 \u2212 d/R, so d = (3/4)R = 4800 km.',
    official_source: 'NTA JEE Main 2023 (31 January, Shift 1)',
    difficulty: 'medium',
    tags: ['variation-of-g', 'depth-and-height', 'earth-gravity'],
  },
  {
    id: 'jeemain-2024-phy-dimensions-05',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Units and Measurements',
    year: 2024,
    question_text:
      'Statement I: Linear momentum and moment of force (torque) have the same dimensions. Statement II: Planck\u2019s constant and angular momentum have the same dimensions. In the light of the above statements, choose the correct answer:',
    option_a: 'Statement I is correct but Statement II is false',
    option_b: 'Statement I is false but Statement II is correct',
    option_c: 'Both Statement I and Statement II are correct',
    option_d: 'Both Statement I and Statement II are false',
    correct_option: 'B',
    explanation:
      'Linear momentum is [MLT\u207B\u00B9] while torque is [ML\u00B2T\u207B\u00B2] \u2014 different, so Statement I is false. Planck\u2019s constant (E/\u03BD) and angular momentum are both [ML\u00B2T\u207B\u00B9], so Statement II is correct.',
    official_source: 'NTA JEE Main 2024 (27 January, Shift 1)',
    difficulty: 'easy',
    tags: ['dimensional-analysis', 'planck-constant', 'angular-momentum'],
  },

  /* ---------- NEET UG · Biology ---------- */
  {
    id: 'neetug-2023-bio-transport-01',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Transport in Plants',
    year: 2023,
    question_text:
      'Movement and accumulation of ions across a membrane against their concentration gradient can be explained by:',
    option_a: 'Osmosis',
    option_b: 'Facilitated diffusion',
    option_c: 'Passive transport',
    option_d: 'Active transport',
    correct_option: 'D',
    explanation:
      'Moving ions against a concentration gradient requires energy (ATP) \u2014 that is active transport. Osmosis, facilitated diffusion and passive transport all move substances down their gradients without energy input.',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'easy',
    tags: ['active-transport', 'membrane-transport', 'plant-physiology'],
  },
  {
    id: 'neetug-2023-bio-mineral-02',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Mineral Nutrition',
    year: 2023,
    question_text: 'Which micronutrient is required for the splitting of water molecules during photosynthesis?',
    option_a: 'Manganese',
    option_b: 'Molybdenum',
    option_c: 'Magnesium',
    option_d: 'Copper',
    correct_option: 'A',
    explanation:
      'Manganese is essential for the water-splitting (photolysis) step of photosynthesis that liberates oxygen. Molybdenum works in nitrogen metabolism, magnesium activates photosynthesis/respiration enzymes and sits in chlorophyll, and copper serves overall metabolism.',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'medium',
    tags: ['micronutrients', 'photolysis', 'photosynthesis'],
  },
  {
    id: 'neetug-2023-bio-meiosis-03',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Cell Cycle and Cell Division',
    year: 2023,
    question_text:
      'The process of appearance of recombination nodules occurs at which sub-stage of prophase I in meiosis?',
    option_a: 'Zygotene',
    option_b: 'Pachytene',
    option_c: 'Diplotene',
    option_d: 'Diakinesis',
    correct_option: 'B',
    explanation:
      'Recombination nodules appear during pachytene, the sub-stage where crossing over between non-sister chromatids of homologous chromosomes takes place. Zygotene is pairing (synapsis), diplotene shows chiasmata, and diakinesis is the final prophase I stage.',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'medium',
    tags: ['meiosis', 'prophase-1', 'crossing-over'],
  },
  {
    id: 'neetug-2023-bio-dna-04',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Molecular Basis of Inheritance',
    year: 2023,
    question_text: 'Unequivocal proof that DNA is the genetic material was first provided by:',
    option_a: 'Frederick Griffith',
    option_b: 'Alfred Hershey and Martha Chase',
    option_c: 'Avery, MacLeod and McCarty',
    option_d: 'Wilkins and Franklin',
    correct_option: 'B',
    explanation:
      'The Hershey\u2013Chase bacteriophage experiment (radioactive \u00B3\u00B2P vs \u00B3\u2075S labelling) gave the unequivocal proof. Griffith showed transformation, Avery\u2013MacLeod\u2013McCarty biochemically characterised the transforming principle, and Wilkins & Franklin produced DNA X-ray diffraction data.',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'easy',
    tags: ['hershey-chase', 'genetic-material', 'dna'],
  },
  {
    id: 'neetug-2023-bio-repro-05',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Reproductive Health',
    year: 2023,
    question_text:
      'Which one of the following common sexually transmitted diseases is completely curable when detected early and treated properly?',
    option_a: 'Genital herpes',
    option_b: 'Gonorrhoea',
    option_c: 'Hepatitis-B',
    option_d: 'HIV infection',
    correct_option: 'B',
    explanation:
      'Gonorrhoea is a bacterial STD and is completely curable with timely antibiotic treatment. Genital herpes, hepatitis-B and HIV are viral infections that can be managed but not completely cured.',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'easy',
    tags: ['std', 'reproductive-health', 'bacterial-diseases'],
  },

  /* ---------- UPSC CSE · GS Paper I (Prelims) ---------- */
  {
    id: 'upsc-2022-gs1-polity-01',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Polity',
    year: 2022,
    question_text:
      'Which of the following is/are the exclusive power(s) of the Lok Sabha? 1. To ratify the declaration of Emergency. 2. To pass a motion of no-confidence against the Council of Ministers. 3. To impeach the President of India. Select the correct answer using the code given below:',
    option_a: '1 and 2',
    option_b: '2 only',
    option_c: '1 and 3',
    option_d: '3 only',
    correct_option: 'B',
    explanation:
      'Only the Lok Sabha can pass a no-confidence motion, since the Council of Ministers is collectively responsible to the House of the People (Article 75(3)). An Emergency proclamation must be approved by BOTH Houses, and impeachment of the President can be initiated in either House \u2014 so neither is exclusive to the Lok Sabha.',
    official_source: 'UPSC CSE Prelims 2022, General Studies Paper I',
    difficulty: 'medium',
    tags: ['parliament', 'lok-sabha', 'no-confidence-motion'],
  },
  {
    id: 'upsc-2022-gs1-geography-02',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Geography',
    year: 2022,
    question_text: 'Gandikota canyon of South India was created by which one of the following rivers?',
    option_a: 'Manjira',
    option_b: 'Cauvery',
    option_c: 'Pennar',
    option_d: 'Tungabhadra',
    correct_option: 'C',
    explanation:
      'The Pennar river cut through the granite hills near Gandikota village (Kadapa district, Andhra Pradesh), eroding the spectacular gorge often called the \u201CGrand Canyon of India\u201D. \u201CGandi\u201D is Telugu for gorge.',
    official_source: 'UPSC CSE Prelims 2022, General Studies Paper I',
    difficulty: 'medium',
    tags: ['rivers', 'landforms', 'andhra-pradesh'],
  },
  {
    id: 'upsc-2022-gs1-medieval-03',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Medieval Indian History',
    year: 2022,
    question_text: 'In medieval India, the term \u201CFanam\u201D referred to:',
    option_a: 'Clothing',
    option_b: 'Coins',
    option_c: 'Ornaments',
    option_d: 'Weapons',
    correct_option: 'B',
    explanation:
      'Fanam (panam) coins were a regular unit of currency in medieval South India, used extensively for trade \u2014 notably in Travancore. The word literally means \u201Cmoney\u201D and survives in Malayalam as a synonym for wealth.',
    official_source: 'UPSC CSE Prelims 2022, General Studies Paper I',
    difficulty: 'easy',
    tags: ['medieval-india', 'currency', 'south-india'],
  },
  {
    id: 'upsc-2022-gs1-ancient-04',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Ancient Indian History',
    year: 2022,
    question_text:
      'Which one of the following statements about Sangam literature in ancient South India is correct?',
    option_a: 'Sangam poems are devoid of any reference to material culture',
    option_b: 'The social classification of Varna was known to Sangam poets',
    option_c: 'Sangam poems have no reference to warrior ethic',
    option_d: 'Sangam literature refers to magical forces as irrational',
    correct_option: 'B',
    explanation:
      'Sangam poets knew the varna classification \u2014 kings (Arashar), traders (Vaishiyar), farmers (Velalar) and Brahmanas are mentioned \u2014 though the four-fold varna order had little real application in Tamil society. The poems are rich in material culture and warrior ethic, and treat magical forces (ananku) as real, not irrational.',
    official_source: 'UPSC CSE Prelims 2022, General Studies Paper I',
    difficulty: 'hard',
    tags: ['sangam-literature', 'ancient-india', 'tamil-society'],
  },
  {
    id: 'upsc-2022-gs1-environment-05',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Environment and Ecology',
    year: 2022,
    question_text: 'The \u201CMiyawaki method\u201D is well known for the:',
    option_a: 'Promotion of commercial farming in arid and semi-arid areas',
    option_b: 'Development of gardens using genetically modified flora',
    option_c: 'Creation of mini forests in urban areas',
    option_d: 'Harvesting wind energy on coastal areas and on sea surfaces',
    correct_option: 'C',
    explanation:
      'The Miyawaki method, based on the work of Japanese botanist Akira Miyawaki, creates dense, fast-growing native mini forests in small urban plots by planting multi-layered native saplings close together \u2014 used, for example, by Mumbai\u2019s municipal corporation.',
    official_source: 'UPSC CSE Prelims 2022, General Studies Paper I',
    difficulty: 'easy',
    tags: ['afforestation', 'urban-forests', 'miyawaki'],
  },

  /* ---------- NEET UG 2020 (13 September 2020) ---------- */
  {
    id: 'neetug-2020-bio-biotech-06',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Biotechnology: Principles and Processes',
    year: 2020,
    question_text: 'Separated DNA fragments can be visualised with the help of:',
    option_a: 'Staining with ethidium bromide followed by exposure to UV radiation',
    option_b: 'Staining with acetocarmine in bright light',
    option_c: 'Staining with aniline blue under visible light',
    option_d: 'Staining with saffranine in UV radiation',
    correct_option: 'A',
    explanation:
      'DNA fragments separated by gel electrophoresis are stained with ethidium bromide, which intercalates into DNA and fluoresces bright orange under UV light. Acetocarmine, aniline blue and saffranine do not make DNA visible this way.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'easy',
    tags: ['gel-electrophoresis', 'ethidium-bromide', 'dna-visualisation'],
  },
  {
    id: 'neetug-2020-bio-apc-07',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Cell Cycle and Cell Division',
    year: 2020,
    question_text:
      'Anaphase Promoting Complex (APC) is a protein degradation machinery necessary for proper mitosis of animal cells. If APC is defective in a human cell, which of the following is expected to occur?',
    option_a: 'Chromosomes will be fragmented',
    option_b: 'Chromosomes will not segregate',
    option_c: 'Recombination of chromosome arms will occur',
    option_d: 'Chromosomes will not condense',
    correct_option: 'B',
    explanation:
      'APC triggers the degradation of securin, freeing separase to cleave the cohesin holding sister chromatids together. A defective APC leaves cohesin intact, so sister chromatids cannot separate and chromosomes fail to segregate at anaphase.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'hard',
    tags: ['mitosis', 'anaphase', 'apc-complex'],
  },
  {
    id: 'neetug-2020-bio-roots-08',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Morphology of Flowering Plants',
    year: 2020,
    question_text: 'The roots that originate from the base of the stem are:',
    option_a: 'Prop roots',
    option_b: 'Lateral roots',
    option_c: 'Fibrous roots',
    option_d: 'Primary roots',
    correct_option: 'C',
    explanation:
      'In monocots like wheat, the primary root is short-lived and is replaced by a large number of roots arising from the base of the stem — the fibrous root system. Prop roots arise from branches, and lateral roots branch off the primary root.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'easy',
    tags: ['root-systems', 'fibrous-roots', 'monocots'],
  },
  {
    id: 'neetug-2020-bio-oocyte-09',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Human Reproduction',
    year: 2020,
    question_text: 'Meiotic division of the secondary oocyte is completed:',
    option_a: 'At the time of fusion of a sperm with an ovum',
    option_b: 'Prior to ovulation',
    option_c: 'At the time of copulation',
    option_d: 'After zygote formation',
    correct_option: 'A',
    explanation:
      'The secondary oocyte is arrested at metaphase II and completes meiosis II only when a sperm makes contact and enters — releasing the second polar body and forming the ovum. Ovulation releases the arrested secondary oocyte, not a finished ovum.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'medium',
    tags: ['oogenesis', 'meiosis-2', 'fertilisation'],
  },
  {
    id: 'neetug-2020-bio-sludge-10',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Microbes in Human Welfare',
    year: 2020,
    question_text: 'Which of the following is put into the anaerobic sludge digester for further sewage treatment?',
    option_a: 'Primary treatment effluent',
    option_b: 'Floating debris',
    option_c: 'Effluents of primary treatment',
    option_d: 'Activated sludge',
    correct_option: 'D',
    explanation:
      'During secondary treatment, the bacterial flocs settled in the settling tank form activated sludge. A small part is reused as inoculum in the aeration tank and the major part is pumped into anaerobic sludge digesters, where anaerobic microbes digest it, producing biogas.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'medium',
    tags: ['sewage-treatment', 'activated-sludge', 'biogas'],
  },
  {
    id: 'neetug-2020-phy-kinetic-11',
    exam: 'NEET_UG',
    subject: 'Physics',
    chapter: 'Kinetic Theory',
    year: 2020,
    question_text:
      'The average thermal energy for a mono-atomic gas is: (kʙ is the Boltzmann constant and T is the absolute temperature)',
    option_a: '(3/2) kʙT',
    option_b: '(5/2) kʙT',
    option_c: '(7/2) kʙT',
    option_d: '(1/2) kʙT',
    correct_option: 'A',
    explanation:
      'A mono-atomic gas molecule has 3 translational degrees of freedom and, by equipartition, each contributes (1/2)kʙT — so the average thermal energy per molecule is (3/2)kʙT.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'easy',
    tags: ['equipartition', 'degrees-of-freedom', 'thermal-energy'],
  },
  {
    id: 'neetug-2020-phy-capillary-12',
    exam: 'NEET_UG',
    subject: 'Physics',
    chapter: 'Mechanical Properties of Fluids',
    year: 2020,
    question_text:
      'A capillary tube of radius r is immersed in water and water rises in it to a height h. The mass of the water in the capillary is 5 g. Another capillary tube of radius 2r is immersed in water. The mass of water that will rise in this tube is:',
    option_a: '5.0 g',
    option_b: '10.0 g',
    option_c: '20.0 g',
    option_d: '2.5 g',
    correct_option: 'B',
    explanation:
      'Capillary rise h ∝ 1/r, and the mass of the risen column m ∝ r²h, so m ∝ r. Doubling the radius doubles the mass: 2 × 5 g = 10 g.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'medium',
    tags: ['capillarity', 'surface-tension', 'proportionality'],
  },
  {
    id: 'neetug-2020-phy-beats-13',
    exam: 'NEET_UG',
    subject: 'Physics',
    chapter: 'Waves',
    year: 2020,
    question_text:
      'In a guitar, two strings A and B made of the same material are slightly out of tune and produce beats of frequency 6 Hz. When the tension in B is slightly decreased, the beat frequency increases to 7 Hz. If the frequency of A is 530 Hz, the original frequency of B will be:',
    option_a: '524 Hz',
    option_b: '536 Hz',
    option_c: '537 Hz',
    option_d: '523 Hz',
    correct_option: 'A',
    explanation:
      'fB is either 530 ± 6 Hz. Decreasing the tension in B lowers fB; since the beat frequency then INCREASES to 7 Hz, fB must already be below fA. So fB = 530 − 6 = 524 Hz.',
    official_source: 'NTA NEET (UG) 2020, 13 September 2020',
    difficulty: 'medium',
    tags: ['beats', 'string-frequency', 'tension'],
  },

  /* ---------- NEET UG 2021 (12 September 2021) ---------- */
  {
    id: 'neetug-2021-bio-dormancy-14',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Plant Growth and Development',
    year: 2021,
    question_text: 'Which of the following is not an inhibitory substance governing seed dormancy?',
    option_a: 'Abscisic acid',
    option_b: 'Phenolic acid',
    option_c: 'Para-ascaridole',
    option_d: 'Gibberellic acid',
    correct_option: 'D',
    explanation:
      'Seed dormancy is maintained by inhibitors such as abscisic acid, phenolic acids and para-ascaridole. Gibberellic acid does the opposite — it BREAKS dormancy and promotes germination.',
    official_source: 'NTA NEET (UG) 2021, 12 September 2021',
    difficulty: 'easy',
    tags: ['seed-dormancy', 'gibberellin', 'plant-hormones'],
  },
  {
    id: 'neetug-2021-bio-guardcells-15',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Transport in Plants',
    year: 2021,
    question_text: 'In land plants, the guard cells differ from other epidermal cells in having:',
    option_a: 'Cytoskeleton',
    option_b: 'Mitochondria',
    option_c: 'Endoplasmic reticulum',
    option_d: 'Chloroplasts',
    correct_option: 'D',
    explanation:
      'Ordinary epidermal cells of land plants lack chloroplasts; guard cells are the exception. Their chloroplasts power the osmotic changes that open and close the stomatal pore. Cytoskeleton, mitochondria and ER occur in all living plant cells.',
    official_source: 'NTA NEET (UG) 2021, 12 September 2021',
    difficulty: 'easy',
    tags: ['guard-cells', 'stomata', 'epidermis'],
  },
  {
    id: 'neetug-2021-bio-translation-16',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Molecular Basis of Inheritance',
    year: 2021,
    question_text: 'The first phase of translation is:',
    option_a: 'Recognition of DNA molecule',
    option_b: 'Aminoacylation of tRNA',
    option_c: 'Recognition of an anti-codon',
    option_d: 'Binding of mRNA to ribosome',
    correct_option: 'B',
    explanation:
      'Translation begins with charging of tRNA — aminoacylation — in which amino acids are activated with ATP and linked to their cognate tRNAs. Only then does initiation (mRNA binding to the ribosome) proceed.',
    official_source: 'NTA NEET (UG) 2021, 12 September 2021',
    difficulty: 'medium',
    tags: ['translation', 'trna-charging', 'protein-synthesis'],
  },
  {
    id: 'neetug-2021-bio-art-17',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Reproductive Health',
    year: 2021,
    question_text:
      'In which of the following techniques, the embryos are transferred to assist those females who cannot conceive?',
    option_a: 'GIFT and ICSI',
    option_b: 'ZIFT and IUT',
    option_c: 'GIFT and ZIFT',
    option_d: 'ICSI and ZIFT',
    correct_option: 'B',
    explanation:
      'Embryo-transfer methods are ZIFT (zygote/early embryo up to 8 blastomeres into the fallopian tube) and IUT (embryo with more than 8 blastomeres into the uterus). GIFT transfers an ovum, not an embryo, and ICSI is a lab fertilisation method.',
    official_source: 'NTA NEET (UG) 2021, 12 September 2021',
    difficulty: 'medium',
    tags: ['art', 'zift', 'iut'],
  },
  {
    id: 'neetug-2021-chem-he2-18',
    exam: 'NEET_UG',
    subject: 'Chemistry',
    chapter: 'Chemical Bonding and Molecular Structure',
    year: 2021,
    question_text: 'Identify a molecule which does not exist.',
    option_a: 'Li₂',
    option_b: 'C₂',
    option_c: 'O₂',
    option_d: 'He₂',
    correct_option: 'D',
    explanation:
      'By molecular orbital theory, He₂ has the configuration σ1s² σ*1s², giving bond order (2 − 2)/2 = 0 — no bond forms, so He₂ does not exist. Li₂, C₂ and O₂ all have positive bond orders.',
    official_source: 'NTA NEET (UG) 2021, 12 September 2021',
    difficulty: 'easy',
    tags: ['molecular-orbital-theory', 'bond-order', 'diatomic-molecules'],
  },
  {
    id: 'neetug-2021-phy-escape-19',
    exam: 'NEET_UG',
    subject: 'Physics',
    chapter: 'Gravitation',
    year: 2021,
    question_text:
      'The escape velocity from the Earth’s surface is v. The escape velocity from the surface of another planet having a radius four times that of Earth and the same mass density is:',
    option_a: '3v',
    option_b: '4v',
    option_c: 'v',
    option_d: '2v',
    correct_option: 'B',
    explanation:
      'For uniform density ρ, M ∝ R³, so v_esc = √(2GM/R) ∝ R√ρ. With the same density and four times the radius, the escape velocity is 4v.',
    official_source: 'NTA NEET (UG) 2021, 12 September 2021',
    difficulty: 'medium',
    tags: ['escape-velocity', 'density', 'gravitation'],
  },

  /* ---------- NEET UG 2022 (17 July 2022) ---------- */
  {
    id: 'neetug-2022-bio-hypothalamus-20',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Neural Control and Coordination',
    year: 2022,
    question_text: 'Which of the following regions of the brain is responsible for thermoregulation?',
    option_a: 'Corpus callosum',
    option_b: 'Medulla oblongata',
    option_c: 'Hypothalamus',
    option_d: 'Cerebrum',
    correct_option: 'C',
    explanation:
      'The hypothalamus is the body’s thermostat — it contains centres regulating body temperature, hunger and thirst. The medulla controls respiration and cardiovascular reflexes; the corpus callosum connects the cerebral hemispheres.',
    official_source: 'NTA NEET (UG) 2022, 17 July 2022',
    difficulty: 'easy',
    tags: ['hypothalamus', 'thermoregulation', 'brain'],
  },
  {
    id: 'neetug-2022-bio-cockroach-21',
    exam: 'NEET_UG',
    subject: 'Biology',
    chapter: 'Structural Organisation in Animals',
    year: 2022,
    question_text: 'Which of the following features is used to identify a male cockroach from a female cockroach?',
    option_a: 'Presence of anal cerci',
    option_b: 'Presence of a boat-shaped sternum on the 9th abdominal segment',
    option_c: 'Forewings with darker tegmina',
    option_d: 'Presence of anal styles',
    correct_option: 'D',
    explanation:
      'Male cockroaches bear a pair of short, unjointed anal styles on the 9th sternum — absent in females. Anal cerci and darkened tegmina occur in both sexes.',
    official_source: 'NTA NEET (UG) 2022, 17 July 2022',
    difficulty: 'medium',
    tags: ['cockroach', 'sexual-dimorphism', 'anal-styles'],
  },

  /* ---------- NEET UG 2023 — Physics & Chemistry additions ---------- */
  {
    id: 'neetug-2023-phy-rms-22',
    exam: 'NEET_UG',
    subject: 'Physics',
    chapter: 'Kinetic Theory',
    year: 2023,
    question_text:
      'The temperature of a gas is −50 °C. To what temperature the gas should be heated so that the rms speed is increased by 3 times?',
    option_a: '669 °C',
    option_b: '3295 °C',
    option_c: '3097 K',
    option_d: '223 K',
    correct_option: 'B',
    explanation:
      'v_rms ∝ √T. “Increased by 3 times” means the new speed is 4 times the original, so T must become 16 times: 16 × 223.15 K ≈ 3570 K ≈ 3295 °C (the official key).',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'medium',
    tags: ['rms-speed', 'temperature', 'kinetic-theory'],
  },
  {
    id: 'neetug-2023-chem-limestone-23',
    exam: 'NEET_UG',
    subject: 'Chemistry',
    chapter: 'Some Basic Concepts of Chemistry',
    year: 2023,
    question_text:
      'The right option for the mass of CO₂ produced by heating 20 g of 20% pure limestone is: (Atomic mass of Ca = 40) [CaCO₃ → CaO + CO₂ on heating]',
    option_a: '1.32 g',
    option_b: '1.12 g',
    option_c: '1.76 g',
    option_d: '2.64 g',
    correct_option: 'C',
    explanation:
      '20% pure means 4 g of CaCO₃ = 4/100 = 0.04 mol. Each mole of CaCO₃ gives one mole of CO₂, so 0.04 mol × 44 g/mol = 1.76 g.',
    official_source: 'NTA NEET (UG) 2023, 7 May 2023',
    difficulty: 'easy',
    tags: ['stoichiometry', 'mole-concept', 'purity'],
  },

  /* ---------- JEE Main 2020–2022 ---------- */
  {
    id: 'jeemain-2020-phy-adiabatic-06',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Thermodynamics',
    year: 2020,
    question_text:
      'A litre of dry air at STP expands adiabatically to a volume of 3 litres. If γ = 1.40, the work done by air is: (3¹·⁴ = 4.6555) [Take air to be an ideal gas]',
    option_a: '60.7 J',
    option_b: '90.5 J',
    option_c: '100.8 J',
    option_d: '48 J',
    correct_option: 'B',
    explanation:
      'W = (P₁V₁ − P₂V₂)/(γ − 1). P₂ = P₁(V₁/V₂)^γ = P₁/4.6555. With P₁ ≈ 1.013 × 10⁵ Pa, V₁ = 10⁻³ m³: W = (101.3 − 65.3)/0.4 ≈ 90.5 J.',
    official_source: 'NTA JEE Main 2020 (January session)',
    difficulty: 'medium',
    tags: ['adiabatic-process', 'work-done', 'ideal-gas'],
  },
  {
    id: 'jeemain-2020-phy-halflife-07',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Nuclei',
    year: 2020,
    question_text:
      'The activity of a radioactive sample falls from 700 s⁻¹ to 500 s⁻¹ in 30 minutes. Its half-life is close to:',
    option_a: '66 min',
    option_b: '52 min',
    option_c: '72 min',
    option_d: '62 min',
    correct_option: 'D',
    explanation:
      'λ = ln(700/500)/30 min = 0.3365/30 per minute. t½ = ln 2/λ = 0.693 × 30/0.3365 ≈ 61.8 min ≈ 62 min.',
    official_source: 'NTA JEE Main 2020 (January session)',
    difficulty: 'medium',
    tags: ['radioactivity', 'half-life', 'decay-law'],
  },
  {
    id: 'jeemain-2020-math-examination-08',
    exam: 'JEE_MAIN',
    subject: 'Mathematics',
    chapter: 'Permutations and Combinations',
    year: 2020,
    question_text:
      'The number of 4-letter words (with or without meaning) that can be formed from the eleven letters of the word “EXAMINATION” is:',
    option_a: '2454',
    option_b: '2266',
    option_c: '1680',
    option_d: '3600',
    correct_option: 'A',
    explanation:
      'EXAMINATION has 8 distinct letters with A, I, N appearing twice. All distinct: ⁸C₄·4! = 1680. One repeated pair + 2 others: 3·⁷C₂·(4!/2!) = 756. Two repeated pairs: ³C₂·(4!/2!2!) = 18. Total 1680 + 756 + 18 = 2454. (Asked as a numerical-answer question; 2454 was the official key.)',
    official_source: 'NTA JEE Main 2020 (January session)',
    difficulty: 'hard',
    tags: ['permutations', 'repeated-letters', 'counting'],
  },
  {
    id: 'jeemain-2021-math-population-09',
    exam: 'JEE_MAIN',
    subject: 'Mathematics',
    chapter: 'Differential Equations',
    year: 2021,
    question_text:
      'If a population P = P(t) at time t of a certain species follows the differential equation dP/dt = 0.5P − 450 with P(0) = 850, then the time at which the population becomes zero is:',
    option_a: 'ln 9',
    option_b: '(1/2) ln 18',
    option_c: 'ln 18',
    option_d: '2 ln 18',
    correct_option: 'D',
    explanation:
      'dP/(P − 900) = 0.5 dt gives P − 900 = C e^{t/2}; P(0) = 850 makes C = −50, so P = 900 − 50 e^{t/2}. P = 0 when e^{t/2} = 18, i.e. t = 2 ln 18.',
    official_source: 'NTA JEE Main 2021 (24 February, Shift 1)',
    difficulty: 'medium',
    tags: ['differential-equations', 'separation-of-variables', 'exponential-growth'],
  },
  {
    id: 'jeemain-2022-phy-bulk-10',
    exam: 'JEE_MAIN',
    subject: 'Physics',
    chapter: 'Mechanical Properties of Solids',
    year: 2022,
    question_text:
      'The bulk modulus of a liquid is 3 × 10¹⁰ N m⁻². The pressure required to reduce the volume of the liquid by 2% is:',
    option_a: '3 × 10⁸ N m⁻²',
    option_b: '9 × 10⁸ N m⁻²',
    option_c: '6 × 10⁸ N m⁻²',
    option_d: '12 × 10⁸ N m⁻²',
    correct_option: 'C',
    explanation:
      'B = ΔP/(ΔV/V), so ΔP = B × ΔV/V = 3 × 10¹⁰ × 0.02 = 6 × 10⁸ N m⁻².',
    official_source: 'NTA JEE Main 2022 (June session)',
    difficulty: 'easy',
    tags: ['bulk-modulus', 'compressibility', 'elasticity'],
  },

  /* ---------- UPSC CSE Prelims 2020–2024 ---------- */
  {
    id: 'upsc-2020-gs1-goldtranche-06',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Economy',
    year: 2020,
    question_text: 'With reference to the international trade of India at present, “Gold Tranche” (Reserve Tranche) refers to:',
    option_a: 'A loan system of the World Bank',
    option_b: 'One of the operations of a Central Bank',
    option_c: 'A credit system granted by WTO to its members',
    option_d: 'A credit system granted by IMF to its members',
    correct_option: 'D',
    explanation:
      'The Reserve (Gold) Tranche is the portion of a member country’s quota with the IMF that it can access without conditions — effectively an emergency credit line granted by the IMF to its members.',
    official_source: 'UPSC CSE Prelims 2020, General Studies Paper I',
    difficulty: 'medium',
    tags: ['imf', 'reserve-tranche', 'international-finance'],
  },
  {
    id: 'upsc-2020-gs1-constitutionalgovt-07',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Polity',
    year: 2020,
    question_text: 'A constitutional government by definition is a:',
    option_a: 'Government by legislature',
    option_b: 'Popular government',
    option_c: 'Multi-party government',
    option_d: 'Limited government',
    correct_option: 'D',
    explanation:
      'Constitutionalism means the powers of government are limited by a constitution — restraints on state power are its defining feature. Popularity, party count or legislative supremacy do not define it.',
    official_source: 'UPSC CSE Prelims 2020, General Studies Paper I',
    difficulty: 'easy',
    tags: ['constitutionalism', 'limited-government', 'polity-basics'],
  },
  {
    id: 'upsc-2020-gs1-steelslag-08',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Science and Technology',
    year: 2020,
    question_text:
      'Steel slag can be the material for which of the following? 1. Construction of base road 2. Improvement of agricultural soil 3. Production of cement. Select the correct answer using the code given below:',
    option_a: '1 and 2 only',
    option_b: '2 and 3 only',
    option_c: '1 and 3 only',
    option_d: '1, 2 and 3',
    correct_option: 'D',
    explanation:
      'Steel slag, a by-product of steel making, is used as aggregate in road bases, as a soil conditioner/liming agent in agriculture, and as a raw material in cement production — all three uses are established.',
    official_source: 'UPSC CSE Prelims 2020, General Studies Paper I',
    difficulty: 'medium',
    tags: ['steel-slag', 'waste-utilisation', 'materials'],
  },
  {
    id: 'upsc-2021-gs1-bondyields-09',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Economy',
    year: 2021,
    question_text:
      'Indian Government Bond Yields are influenced by which of the following? 1. Actions of the United States Federal Reserve 2. Actions of the Reserve Bank of India 3. Inflation and short-term interest rates. Select the correct answer using the code given below:',
    option_a: '1 and 2 only',
    option_b: '2 only',
    option_c: '3 only',
    option_d: '1, 2 and 3',
    correct_option: 'D',
    explanation:
      'Bond yields respond to global capital flows (US Fed actions), domestic monetary policy (RBI’s rate and liquidity operations), and inflation with short-term interest rates — all three influence Indian government bond yields.',
    official_source: 'UPSC CSE Prelims 2021, General Studies Paper I',
    difficulty: 'medium',
    tags: ['bond-yields', 'monetary-policy', 'macroeconomics'],
  },
  {
    id: 'upsc-2021-gs1-sugarcane-10',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Geography',
    year: 2021,
    question_text: 'Among the following, which one is the least water-efficient crop?',
    option_a: 'Sugarcane',
    option_b: 'Sunflower',
    option_c: 'Pearl millet',
    option_d: 'Red gram',
    correct_option: 'A',
    explanation:
      'Sugarcane needs roughly 1,500–2,500 mm of water over its long growing season — far more per unit output than sunflower, pearl millet or red gram, which are comparatively drought-hardy.',
    official_source: 'UPSC CSE Prelims 2021, General Studies Paper I',
    difficulty: 'easy',
    tags: ['crops', 'water-use', 'agriculture'],
  },
  {
    id: 'upsc-2021-gs1-leaflitter-11',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Environment and Ecology',
    year: 2021,
    question_text:
      '“Leaf litter decomposes faster than in any other biome and as a result the soil surface is often almost bare. Apart from trees, the vegetation is largely composed of plant forms that reach up into the canopy vicariously, by climbing the trees or growing as epiphytes, rooted on the upper branches of trees.” This is the most likely description of:',
    option_a: 'Coniferous forest',
    option_b: 'Dry deciduous forest',
    option_c: 'Mangrove forest',
    option_d: 'Tropical rain forest',
    correct_option: 'D',
    explanation:
      'Rapid litter decomposition (warm, moist conditions), climbers/lianas and abundant epiphytes reaching a high canopy are signature features of tropical rain forests.',
    official_source: 'UPSC CSE Prelims 2021, General Studies Paper I',
    difficulty: 'easy',
    tags: ['biomes', 'tropical-rainforest', 'epiphytes'],
  },
  {
    id: 'upsc-2022-gs1-rfi-12',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Indian Economy',
    year: 2022,
    question_text:
      '“Rapid Financing Instrument” and “Rapid Credit Facility” are related to the provisions of lending by which one of the following?',
    option_a: 'Asian Development Bank',
    option_b: 'International Monetary Fund',
    option_c: 'United Nations Environment Programme Finance Initiative',
    option_d: 'World Bank',
    correct_option: 'B',
    explanation:
      'The RFI and the RCF are the IMF’s emergency lending windows — the RFI for all members and the concessional RCF for low-income countries — providing rapid assistance without a full-fledged programme.',
    official_source: 'UPSC CSE Prelims 2022, General Studies Paper I',
    difficulty: 'medium',
    tags: ['imf', 'emergency-lending', 'international-finance'],
  },
  {
    id: 'upsc-2023-gs1-metagenomics-13',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Science and Technology',
    year: 2023,
    question_text: '“Aerial metagenomics” best refers to which one of the following situations?',
    option_a: 'Collecting DNA samples from air in a habitat at one go',
    option_b: 'Understanding the genetic makeup of avian species of a habitat',
    option_c: 'Using air-blown seed samples of plants',
    option_d: 'Sending drones to inaccessible areas to collect plant and animal samples from land and water bodies',
    correct_option: 'A',
    explanation:
      'Aerial metagenomics samples environmental DNA (eDNA) directly from the air, letting researchers detect the species present in a habitat in one sweep without capturing any organism.',
    official_source: 'UPSC CSE Prelims 2023, General Studies Paper I',
    difficulty: 'medium',
    tags: ['edna', 'metagenomics', 'biodiversity-monitoring'],
  },
  {
    id: 'upsc-2023-gs1-wolbachia-14',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'Environment and Ecology',
    year: 2023,
    question_text: '“Wolbachia method” is sometimes talked about with reference to which one of the following?',
    option_a: 'Controlling the viral diseases spread by mosquitoes',
    option_b: 'Converting crop residues into packing material',
    option_c: 'Producing biodegradable plastics',
    option_d: 'Producing biochar from thermo-chemical conversion of biomass',
    correct_option: 'A',
    explanation:
      'Wolbachia bacteria introduced into Aedes aegypti mosquitoes block viruses like dengue, Zika and chikungunya from replicating — releasing Wolbachia-carrying mosquitoes suppresses transmission of these mosquito-borne viral diseases.',
    official_source: 'UPSC CSE Prelims 2023, General Studies Paper I',
    difficulty: 'medium',
    tags: ['wolbachia', 'dengue', 'vector-control'],
  },
  {
    id: 'upsc-2024-gs1-volcanic-15',
    exam: 'UPSC_CSE',
    subject: 'General Studies',
    chapter: 'World Geography',
    year: 2024,
    question_text:
      'Consider the following: 1. Pyroclastic debris 2. Ash and dust 3. Nitrogen compounds 4. Sulphur compounds. How many of the above are products of volcanic eruptions?',
    option_a: 'Only one',
    option_b: 'Only two',
    option_c: 'Only three',
    option_d: 'All four',
    correct_option: 'D',
    explanation:
      'Volcanic eruptions eject pyroclastic debris, ash and dust, and release gases including nitrogen compounds and sulphur compounds (notably SO₂) — all four listed items are volcanic products.',
    official_source: 'UPSC CSE Prelims 2024, General Studies Paper I',
    difficulty: 'easy',
    tags: ['volcanism', 'physical-geography', 'volcanic-gases'],
  },
];

/* ------------------------------------------------------------------ */
/*  Small selectors                                                    */
/* ------------------------------------------------------------------ */

/** Bank exams that actually hold seeded questions, in a stable order. */
export function examsWithQuestions(): QuestionBankExam[] {
  const seen = new Set<QuestionBankExam>();
  for (const entry of QUESTION_BANK) seen.add(entry.exam);
  return (Object.keys(QUESTION_BANK_EXAM_LABELS) as QuestionBankExam[]).filter((exam) => seen.has(exam));
}

export function questionsForExam(exam: QuestionBankExam): QuestionBankEntry[] {
  return QUESTION_BANK.filter((entry) => entry.exam === exam);
}

/** Distinct subjects for one exam, in first-seen order. */
export function subjectsForExam(exam: QuestionBankExam): string[] {
  const subjects: string[] = [];
  for (const entry of questionsForExam(exam)) {
    if (!subjects.includes(entry.subject)) subjects.push(entry.subject);
  }
  return subjects;
}

/** Distinct chapters for one exam (optionally one subject), first-seen order. */
export function chaptersForExam(exam: QuestionBankExam, subject?: string | null): string[] {
  const chapters: string[] = [];
  for (const entry of questionsForExam(exam)) {
    if (subject && entry.subject !== subject) continue;
    if (!chapters.includes(entry.chapter)) chapters.push(entry.chapter);
  }
  return chapters;
}

export function bankOptionText(entry: QuestionBankEntry, letter: QuestionOptionLetter): string {
  switch (letter) {
    case 'A':
      return entry.option_a;
    case 'B':
      return entry.option_b;
    case 'C':
      return entry.option_c;
    default:
      return entry.option_d;
  }
}
