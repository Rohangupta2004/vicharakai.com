/**
 * VicharakAI — structured exam database (research file).
 *
 * One typed record per supported exam: who conducts it, how often, the paper
 * structure, the REAL marking scheme, the major syllabus areas per section,
 * and the coaching-relevant facts (typical prep time, aspirant volume, the
 * founder's key insight about where students actually lose marks).
 *
 * This file is DATA ONLY — it renders nothing and touches no app logic.
 * Exam ids match the shared `exam_metadata` WorkspaceDB table's exam_id keys
 * (jee_main, neet_ug, upsc_cse, cat, mcat, capf, uk_a_levels, ...) so a row
 * here can be joined against exam_metadata / exam_syllabi without aliasing.
 *
 * ACCURACY NOTES (researched against the 2025-26 official patterns):
 *  - JEE Main: NTA removed the optional Section B choice from the January
 *    2025 session — 75 compulsory questions now, not the 2021-24 pattern of
 *    90 questions with 75 to attempt. Numericals carry -1 since 2024.
 *  - NEET UG: from 2025 the exam is back to 180 compulsory questions in
 *    180 minutes (the 200-question / 3h20m pattern ran 2021-2024).
 *  - INI-CET: has negative marking of one-third of a mark, not zero.
 *  - LSAT: Analytical Reasoning ("logic games") was retired in August 2024;
 *    the scored test is now 2x Logical Reasoning + 1x Reading Comprehension.
 *  - UCAT: Abstract Reasoning was removed from the 2025 cycle; Decision
 *    Making was expanded to 35 questions.
 *  - UPSC CAPF: Paper I is 125 questions worth 250 MARKS (the "250" often
 *    quoted is the marks total, not the question count).
 *  - A-Levels in England have been LINEAR since the 2015-18 reforms (all
 *    papers at the end of the two-year course); only the international
 *    variants (CAIE / Edexcel IAL) remain modular.
 */

export type ExamCountry = 'India' | 'USA' | 'UK' | 'Australia' | 'Canada';

export type ExamCategory =
  | 'engineering'
  | 'medical'
  | 'law'
  | 'management'
  | 'civil_services'
  | 'banking'
  | 'defence'
  | 'teaching'
  | 'international_graduate';

export type ExamDifficulty = 'moderate' | 'hard' | 'very_hard';

export interface ExamMarkingScheme {
  /** Marks awarded for a correct answer (representative value for the primary question type). */
  correct: number;
  /** Marks deducted for a wrong answer — 0 when there is no negative marking. Negative number, e.g. -1 or -0.25. */
  incorrect: number;
  /** Marks for an unattempted question (0 for every exam here). */
  unattempted: number;
  /** Where the scheme is mixed (JEE Advanced, UPSC, NDA...), the real per-paper detail. */
  notes?: string;
}

export interface ExamSectionInfo {
  name: string;
  /** Major syllabus areas — real chapters/units from the official syllabus, not placeholders. */
  topics: string[];
  /** Number of questions in this section (0 for purely descriptive papers where it varies). */
  questionCount: number;
  /** Maximum marks for the section, when officially defined. */
  marks?: number;
  /** Sectional time limit in minutes, when the exam enforces one. */
  durationMinutes?: number;
  /** e.g. 'mcq', 'mcq + numerical', 'descriptive', 'essay'. */
  format?: string;
}

export interface ExamInfo {
  /** Stable id — matches exam_metadata.exam_id in WorkspaceDB where a row exists. */
  id: string;
  name: string;
  fullName: string;
  country: ExamCountry;
  category: ExamCategory;
  conductedBy: string;
  frequency: string;
  /**
   * Questions in the PRIMARY sitting (first stage for multi-stage exams —
   * e.g. UPSC CSE Prelims, SSC CGL Tier 1). Later stages are described in
   * `sections`. 0 when the exam is fully descriptive (A-Levels).
   */
  totalQuestions: number;
  /** Duration of the primary sitting in minutes (both papers for same-day two-paper exams). */
  duration: number;
  markingScheme: ExamMarkingScheme;
  sections: ExamSectionInfo[];
  difficulty: ExamDifficulty;
  /** Average months of dedicated preparation a serious aspirant invests. */
  typicalPreparationMonths: number;
  aspirantsPerYear: string;
  description: string;
  /** Monthly VicharakAI subscription for this audience — ₹149 for India, null where pricing is USD (Creem). */
  priceINR: number | null;
  /** Whether the 1/3/7/14/28 spaced-revision ladder is the right core mechanic for this exam. */
  spaceRepetitionApplicable: boolean;
  /** Founder-driven insight: the #1 failure mode VicharakAI should attack for this exam. */
  keyInsight: string;
}

export const EXAM_DATABASE: Record<string, ExamInfo> = {
  /* ============================== INDIA ============================== */

  jee_main: {
    id: 'jee_main',
    name: 'JEE Main',
    fullName: 'Joint Entrance Examination - Main',
    country: 'India',
    category: 'engineering',
    conductedBy: 'National Testing Agency (NTA)',
    frequency: 'Twice a year (January & April sessions)',
    totalQuestions: 75,
    duration: 180,
    markingScheme: {
      correct: 4,
      incorrect: -1,
      unattempted: 0,
      notes:
        'Since the January 2025 session all 75 questions are compulsory (20 MCQ + 5 numerical per subject) and BOTH types carry -1 for a wrong answer. The 2021-24 pattern of 90 questions with a Section B choice is retired, but older mock papers still use it. Total 300 marks.',
    },
    sections: [
      {
        name: 'Physics',
        questionCount: 25,
        marks: 100,
        format: 'mcq + numerical',
        topics: [
          'Units and Measurements',
          'Kinematics',
          'Laws of Motion',
          'Work, Energy and Power',
          'Rotational Motion',
          'Gravitation',
          'Properties of Solids and Liquids',
          'Thermodynamics and Kinetic Theory of Gases',
          'Oscillations and Waves',
          'Electrostatics',
          'Current Electricity',
          'Magnetic Effects of Current and Magnetism',
          'Electromagnetic Induction and Alternating Currents',
          'Optics',
          'Dual Nature of Matter and Radiation',
          'Atoms and Nuclei',
          'Electronic Devices (Semiconductors)',
        ],
      },
      {
        name: 'Chemistry',
        questionCount: 25,
        marks: 100,
        format: 'mcq + numerical',
        topics: [
          'Some Basic Concepts in Chemistry (Mole Concept)',
          'Atomic Structure',
          'Chemical Bonding and Molecular Structure',
          'Chemical Thermodynamics',
          'Solutions',
          'Equilibrium',
          'Redox Reactions and Electrochemistry',
          'Chemical Kinetics',
          'Classification of Elements and Periodicity',
          'p-Block Elements',
          'd- and f-Block Elements',
          'Coordination Compounds',
          'Purification and Characterisation of Organic Compounds',
          'Basic Principles of Organic Chemistry (GOC)',
          'Hydrocarbons',
          'Organic Compounds Containing Halogens, Oxygen and Nitrogen',
          'Biomolecules',
        ],
      },
      {
        name: 'Mathematics',
        questionCount: 25,
        marks: 100,
        format: 'mcq + numerical',
        topics: [
          'Sets, Relations and Functions',
          'Complex Numbers and Quadratic Equations',
          'Matrices and Determinants',
          'Permutations and Combinations',
          'Binomial Theorem',
          'Sequences and Series',
          'Limits, Continuity and Differentiability',
          'Applications of Derivatives',
          'Integral Calculus',
          'Differential Equations',
          'Coordinate Geometry (Straight Lines, Circles, Conic Sections)',
          'Three-Dimensional Geometry',
          'Vector Algebra',
          'Statistics and Probability',
          'Trigonometry',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 18,
    aspirantsPerYear: '~14 lakh unique candidates',
    description:
      'Gateway to NITs, IIITs and GFTIs, and the qualifier for JEE Advanced (IITs). The best of two attempts counts, so session strategy matters as much as the syllabus.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Ranks are lost to silly errors on the first ten easy questions, not to the hardest ones — formula recall decays silently between the January and April attempts, and re-derived formulas cost 90 seconds each in a 180-minute paper.',
  },

  jee_advanced: {
    id: 'jee_advanced',
    name: 'JEE Advanced',
    fullName: 'Joint Entrance Examination - Advanced',
    country: 'India',
    category: 'engineering',
    conductedBy: 'One of the seven zonal IITs on rotation, under the Joint Admission Board (JAB)',
    frequency: 'Once a year (May/June); only the top ~2.5 lakh JEE Main scorers qualify, max 2 attempts',
    totalQuestions: 102,
    duration: 360,
    markingScheme: {
      correct: 3,
      incorrect: -1,
      unattempted: 0,
      notes:
        'The pattern changes every year by design. Recent papers mix single-correct MCQs (+3/-1), multiple-correct MCQs (+4 with partial credit, -2 full wrong), non-negative numerical/integer questions (+4/0), and matching/paragraph sets. Roughly 51 questions and 180 marks per paper; both papers are compulsory (total ~360 marks).',
    },
    sections: [
      {
        name: 'Physics (Paper 1 + Paper 2)',
        questionCount: 34,
        marks: 120,
        format: 'single-correct, multi-correct, numerical, matching',
        topics: [
          'Mechanics (Kinematics, Newton\u2019s Laws, Work-Energy, Rotation)',
          'Gravitation',
          'Properties of Matter and Fluid Mechanics',
          'Thermal Physics and Thermodynamics',
          'Simple Harmonic Motion and Waves',
          'Electrostatics and Capacitance',
          'Current Electricity',
          'Magnetism and Electromagnetic Induction',
          'Geometrical and Wave Optics',
          'Modern Physics (Photoelectric Effect, Bohr Model, Nuclei)',
          'Error Analysis and Experimental Physics',
        ],
      },
      {
        name: 'Chemistry (Paper 1 + Paper 2)',
        questionCount: 34,
        marks: 120,
        format: 'single-correct, multi-correct, numerical, matching',
        topics: [
          'Physical Chemistry (Mole Concept, Thermodynamics, Equilibrium, Electrochemistry, Kinetics)',
          'Atomic Structure and Chemical Bonding',
          'Solutions and Colligative Properties',
          'Solid State and Surface Chemistry',
          'Inorganic Chemistry (Periodic Table, p/d/f-Block, Qualitative Analysis)',
          'Coordination Compounds',
          'Organic Chemistry (GOC, Isomerism, Named Reactions)',
          'Hydrocarbons and Halides',
          'Alcohols, Phenols, Ethers, Aldehydes, Ketones and Acids',
          'Amines, Biomolecules and Polymers',
        ],
      },
      {
        name: 'Mathematics (Paper 1 + Paper 2)',
        questionCount: 34,
        marks: 120,
        format: 'single-correct, multi-correct, numerical, matching',
        topics: [
          'Algebra (Complex Numbers, Quadratics, Progressions)',
          'Matrices and Determinants',
          'Permutations, Combinations and Probability',
          'Functions, Limits, Continuity and Differentiability',
          'Applications of Derivatives',
          'Definite and Indefinite Integration',
          'Differential Equations',
          'Coordinate Geometry (Lines, Circles, Conics)',
          'Three-Dimensional Geometry and Vectors',
          'Trigonometry and Inverse Trigonometric Functions',
        ],
      },
    ],
    difficulty: 'very_hard',
    typicalPreparationMonths: 24,
    aspirantsPerYear: '~1.9 lakh registered (of ~2.5 lakh eligible)',
    description:
      'Entrance to the 23 IITs — India\u2019s hardest engineering exam, testing multi-concept problem solving rather than single-formula recall.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Advanced punishes shallow revision: a topic \u201ccovered\u201d once is useless because every question chains 2-3 concepts. Spaced re-solving of full problems (not re-reading notes) is what separates a 2-digit rank from a 5-digit one.',
  },

  neet_ug: {
    id: 'neet_ug',
    name: 'NEET UG',
    fullName: 'National Eligibility cum Entrance Test - Undergraduate',
    country: 'India',
    category: 'medical',
    conductedBy: 'National Testing Agency (NTA)',
    frequency: 'Once a year (May), pen-and-paper OMR',
    totalQuestions: 180,
    duration: 180,
    markingScheme: {
      correct: 4,
      incorrect: -1,
      unattempted: 0,
      notes:
        'From 2025 all 180 questions are compulsory and the paper is back to 3 hours flat — the 2021-24 pattern (200 questions with 20 optional, 3h20m) is retired. Total 720 marks.',
    },
    sections: [
      {
        name: 'Physics',
        questionCount: 45,
        marks: 180,
        format: 'mcq',
        topics: [
          'Physical World and Measurement',
          'Kinematics and Laws of Motion',
          'Work, Energy and Power',
          'Motion of System of Particles and Rigid Body',
          'Gravitation',
          'Properties of Bulk Matter',
          'Thermodynamics and Kinetic Theory',
          'Oscillations and Waves',
          'Electrostatics and Current Electricity',
          'Magnetic Effects of Current and Magnetism',
          'Electromagnetic Induction and Alternating Currents',
          'Optics',
          'Dual Nature of Matter, Atoms and Nuclei',
          'Electronic Devices',
        ],
      },
      {
        name: 'Chemistry',
        questionCount: 45,
        marks: 180,
        format: 'mcq',
        topics: [
          'Some Basic Concepts of Chemistry',
          'Structure of Atom',
          'Classification of Elements and Periodicity',
          'Chemical Bonding and Molecular Structure',
          'Thermodynamics',
          'Equilibrium',
          'Redox Reactions and Electrochemistry',
          'Chemical Kinetics',
          'p-Block, d- and f-Block Elements',
          'Coordination Compounds',
          'Organic Chemistry: Basic Principles and Techniques',
          'Hydrocarbons',
          'Haloalkanes, Alcohols, Phenols and Ethers',
          'Aldehydes, Ketones, Carboxylic Acids and Amines',
          'Biomolecules',
        ],
      },
      {
        name: 'Botany',
        questionCount: 45,
        marks: 180,
        format: 'mcq',
        topics: [
          'Diversity in the Living World',
          'Structural Organisation in Plants (Morphology and Anatomy)',
          'Cell Structure and Function',
          'Plant Physiology (Photosynthesis, Respiration, Growth)',
          'Sexual Reproduction in Flowering Plants',
          'Principles of Inheritance and Variation',
          'Molecular Basis of Inheritance',
          'Microbes in Human Welfare',
          'Organisms and Populations',
          'Ecosystem, Biodiversity and Conservation',
        ],
      },
      {
        name: 'Zoology',
        questionCount: 45,
        marks: 180,
        format: 'mcq',
        topics: [
          'Animal Kingdom',
          'Structural Organisation in Animals',
          'Biomolecules',
          'Human Physiology (Digestion, Breathing, Circulation, Excretion)',
          'Neural Control, Coordination and Chemical Coordination',
          'Human Reproduction and Reproductive Health',
          'Evolution',
          'Human Health and Disease',
          'Biotechnology: Principles, Processes and Applications',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 24,
    aspirantsPerYear: '~23 lakh (largest medical entrance in the world)',
    description:
      'The single entrance for all MBBS/BDS/AYUSH seats in India — NCERT-anchored, brutal on recall precision, with ~1 seat per 20 aspirants in government colleges.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Forgetting which formula or NCERT line applies under pressure is the #1 failure mode — Biology alone is 360 marks of pure recall, and the gap between what a student studied and what they remember on exam day is invisible until the score card reveals it.',
  },

  neet_pg: {
    id: 'neet_pg',
    name: 'NEET PG',
    fullName: 'National Eligibility cum Entrance Test - Postgraduate',
    country: 'India',
    category: 'medical',
    conductedBy: 'National Board of Examinations in Medical Sciences (NBEMS)',
    frequency: 'Once a year (computer-based)',
    totalQuestions: 200,
    duration: 210,
    markingScheme: {
      correct: 4,
      incorrect: -1,
      unattempted: 0,
      notes: '200 MCQs, 800 marks, 3.5 hours, time-bound sections in recent editions. Percentile-based merit for MD/MS/DNB counselling.',
    },
    sections: [
      {
        name: 'Pre-Clinical Subjects',
        questionCount: 33,
        marks: 132,
        format: 'mcq',
        topics: [
          'Anatomy (Gross, Neuroanatomy, Embryology, Histology)',
          'Physiology (Organ Systems, Endocrine, Neurophysiology)',
          'Biochemistry (Metabolism, Molecular Biology, Clinical Correlations)',
        ],
      },
      {
        name: 'Para-Clinical Subjects',
        questionCount: 67,
        marks: 268,
        format: 'mcq',
        topics: [
          'Pathology (General and Systemic)',
          'Pharmacology (Mechanisms, Adverse Effects, Recent Drugs)',
          'Microbiology (Bacteriology, Virology, Immunology)',
          'Forensic Medicine and Toxicology',
          'Preventive and Social Medicine (Epidemiology, Biostatistics, National Health Programmes)',
        ],
      },
      {
        name: 'Clinical Subjects',
        questionCount: 100,
        marks: 400,
        format: 'mcq',
        topics: [
          'General Medicine (with Dermatology and Psychiatry)',
          'General Surgery (with Orthopaedics, Anaesthesia, Radiodiagnosis)',
          'Obstetrics and Gynaecology',
          'Paediatrics',
          'Otorhinolaryngology (ENT)',
          'Ophthalmology',
        ],
      },
    ],
    difficulty: 'very_hard',
    typicalPreparationMonths: 12,
    aspirantsPerYear: '~2.4 lakh MBBS graduates',
    description:
      'The single entrance for MD/MS/PG Diploma and DNB seats — clinical, image-based and applied questions across all 19 MBBS subjects, taken alongside internship or practice.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'The syllabus is the entire MBBS course — nobody fails for not studying enough, they fail because subject 1 has faded by the time subject 19 is done. Rotating spaced revision across all 19 subjects is the whole game.',
  },

  inicet: {
    id: 'inicet',
    name: 'INI-CET',
    fullName: 'Institutes of National Importance Combined Entrance Test',
    country: 'India',
    category: 'medical',
    conductedBy: 'AIIMS New Delhi (for all AIIMS, JIPMER, PGIMER, NIMHANS, SCTIMST)',
    frequency: 'Twice a year (May and November, for July and January sessions)',
    totalQuestions: 200,
    duration: 180,
    markingScheme: {
      correct: 1,
      incorrect: -0.33,
      unattempted: 0,
      notes:
        'Each correct answer earns 1 mark and each wrong answer costs one-third of a mark (-1/3). A commonly repeated claim that INI-CET has no negative marking is wrong.',
    },
    sections: [
      {
        name: 'Pre- and Para-Clinical Subjects',
        questionCount: 80,
        format: 'mcq',
        topics: [
          'Anatomy',
          'Physiology',
          'Biochemistry',
          'Pathology',
          'Pharmacology',
          'Microbiology',
          'Forensic Medicine',
          'Preventive and Social Medicine',
        ],
      },
      {
        name: 'Clinical Subjects',
        questionCount: 120,
        format: 'mcq',
        topics: [
          'General Medicine and Allied (Dermatology, Psychiatry)',
          'General Surgery and Allied (Orthopaedics, Anaesthesia, Radiology)',
          'Obstetrics and Gynaecology',
          'Paediatrics',
          'ENT and Ophthalmology',
          'Clinical Image-Based and Applied Questions',
        ],
      },
    ],
    difficulty: 'very_hard',
    typicalPreparationMonths: 12,
    aspirantsPerYear: '~45,000 per session',
    description:
      'PG entrance to AIIMS and the other Institutes of National Importance — more conceptual and image-heavy than NEET PG, with a punishing seat-to-aspirant ratio.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'INI-CET rewards first-principles understanding over question-bank cramming — but the -1/3 negative marking means confident recall of what you DO know matters more than attempting everything.',
  },

  upsc_cse: {
    id: 'upsc_cse',
    name: 'UPSC CSE',
    fullName: 'Union Public Service Commission - Civil Services Examination',
    country: 'India',
    category: 'civil_services',
    conductedBy: 'Union Public Service Commission (UPSC)',
    frequency: 'Once a year (Prelims ~May/June, Mains ~September, Interview Jan-Apr)',
    totalQuestions: 180,
    duration: 240,
    markingScheme: {
      correct: 2,
      incorrect: -0.66,
      unattempted: 0,
      notes:
        'Prelims GS Paper I: 100 Qs x 2 marks, -1/3 per wrong answer. CSAT: 80 Qs x 2.5 marks, -0.83 per wrong, qualifying at 33%. Mains is fully descriptive (1750 marks counted) and the Interview adds 275 — totally different skills from the MCQ stage.',
    },
    sections: [
      {
        name: 'Prelims Paper I — General Studies',
        questionCount: 100,
        marks: 200,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'History of India and Indian National Movement',
          'Indian and World Geography',
          'Indian Polity and Governance (Constitution, Panchayati Raj, Rights)',
          'Economic and Social Development (Sustainable Development, Poverty, Demographics)',
          'Environment, Ecology, Biodiversity and Climate Change',
          'General Science and Technology',
          'Current Events of National and International Importance',
        ],
      },
      {
        name: 'Prelims Paper II — CSAT (qualifying, 33%)',
        questionCount: 80,
        marks: 200,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'Reading Comprehension',
          'Logical Reasoning and Analytical Ability',
          'Decision Making and Problem Solving',
          'Basic Numeracy (Class X level)',
          'Data Interpretation',
        ],
      },
      {
        name: 'Mains — 9 descriptive papers',
        questionCount: 9,
        marks: 1750,
        format: 'descriptive / essay',
        topics: [
          'Essay (250 marks)',
          'GS-I: Indian Heritage and Culture, History, Geography and Society (250)',
          'GS-II: Governance, Constitution, Polity, Social Justice and International Relations (250)',
          'GS-III: Economy, Technology, Environment, Disaster Management and Security (250)',
          'GS-IV: Ethics, Integrity and Aptitude (250)',
          'Optional Subject Papers I and II (250 + 250)',
          'Qualifying: Indian Language and English (300 each, marks not counted)',
          'Personality Test / Interview (275 marks)',
        ],
      },
    ],
    difficulty: 'very_hard',
    typicalPreparationMonths: 15,
    aspirantsPerYear: '~10-13 lakh apply, ~5-6 lakh appear for Prelims',
    description:
      'Recruits IAS, IPS, IFS and 20+ central services — a 10-12 month, three-stage marathon where MCQ elimination, long-form writing and personality assessment each demand different preparation.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'The Polity you finished four months ago quietly expires while you read today\u2019s newspaper — with a 2,500+ hour syllabus, UPSC is not a hard-work problem but a retention-scheduling problem: nothing tells you what is slipping until Prelims does.',
  },

  capf: {
    id: 'capf',
    name: 'UPSC CAPF',
    fullName: 'Central Armed Police Forces (Assistant Commandants) Examination',
    country: 'India',
    category: 'defence',
    conductedBy: 'Union Public Service Commission (UPSC)',
    frequency: 'Once a year (written exam ~August)',
    totalQuestions: 125,
    duration: 300,
    markingScheme: {
      correct: 2,
      incorrect: -0.66,
      unattempted: 0,
      notes:
        'Paper I: 125 MCQs worth 250 marks (+2 each, -1/3 of 2 marks per wrong answer). The often-quoted \u201c250\u201d is the MARKS total, not the question count. Paper II (200 marks) is descriptive with no negative marking. Followed by Physical Standards/Efficiency Tests and a 150-mark Interview.',
    },
    sections: [
      {
        name: 'Paper I — General Ability and Intelligence',
        questionCount: 125,
        marks: 250,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'General Mental Ability (Reasoning, Quantitative Aptitude, Data Interpretation)',
          'General Science (with emphasis on applied science and IT awareness)',
          'Current Events of National and International Importance',
          'Indian Polity and Economy (Constitution, Human Rights, Security Systems)',
          'History of India (with the freedom struggle)',
          'Indian and World Geography',
        ],
      },
      {
        name: 'Paper II — General Studies, Essay and Comprehension',
        questionCount: 6,
        marks: 200,
        durationMinutes: 180,
        format: 'descriptive',
        topics: [
          'Essay Writing (modern Indian history, polity, economy, security topics)',
          'Argument Analysis and Report Writing',
          'Reading Comprehension',
          'Pr\u00e9cis Writing',
          'Grammar and Language Skills (English only)',
        ],
      },
      {
        name: 'Physical Efficiency Tests + Interview',
        questionCount: 0,
        marks: 150,
        format: 'physical + interview',
        topics: [
          '100m sprint, 800m run, long jump, shot put (gender-normed standards)',
          'Medical Standards Tests',
          'Interview / Personality Test (150 marks)',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 10,
    aspirantsPerYear: '~4-5 lakh apply',
    description:
      'Recruits Assistant Commandants for BSF, CRPF, CISF, ITBP and SSB — a UPSC-style GS paper plus descriptive writing plus genuine physical standards.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Aspirants over-invest in the MCQ paper and discover too late that Paper II essay-writing and the physical tests are eliminators — a balanced weekly cycle across all three is the strategy layer nobody plans.',
  },

  mpsc: {
    id: 'mpsc',
    name: 'MPSC',
    fullName: 'Maharashtra Public Service Commission - State Services (Rajyaseva) Examination',
    country: 'India',
    category: 'civil_services',
    conductedBy: 'Maharashtra Public Service Commission (MPSC)',
    frequency: 'Once a year (per vacancy notification)',
    totalQuestions: 180,
    duration: 240,
    markingScheme: {
      correct: 2,
      incorrect: -0.5,
      unattempted: 0,
      notes:
        'Prelims Paper 1: 100 Qs x 2 marks; Paper 2 (CSAT): 80 Qs x 2.5 marks, qualifying at 33%. Negative marking is 1/4 of the marks per wrong answer. Mains moved to the UPSC-style descriptive pattern (9 papers, 1750 marks) from the 2025 cycle.',
    },
    sections: [
      {
        name: 'Prelims Paper 1 — General Studies',
        questionCount: 100,
        marks: 200,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'History of Modern India with special reference to Maharashtra',
          'Geography of Maharashtra, India and the World',
          'Indian Polity and Governance (with Maharashtra local self-government)',
          'Economic and Social Development',
          'Environment and Ecology',
          'General Science',
          'Current Affairs (state, national, international)',
        ],
      },
      {
        name: 'Prelims Paper 2 — CSAT (qualifying, 33%)',
        questionCount: 80,
        marks: 200,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'Comprehension (English and Marathi passages)',
          'Logical Reasoning and Analytical Ability',
          'Decision Making and Problem Solving',
          'Basic Numeracy and Data Interpretation (Class X level)',
        ],
      },
      {
        name: 'Mains — descriptive (UPSC pattern from 2025)',
        questionCount: 9,
        marks: 1750,
        format: 'descriptive / essay',
        topics: [
          'Marathi and English language papers',
          'Essay',
          'GS-I: History, Geography and Society (Maharashtra-weighted)',
          'GS-II: Polity, Constitution and Governance',
          'GS-III: Economy, Science-Tech, Environment and Security',
          'GS-IV: Ethics, Integrity and Aptitude',
          'Interview / Personality Test',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 12,
    aspirantsPerYear: '~3-4 lakh',
    description:
      'Maharashtra\u2019s state civil services exam (Deputy Collector, DySP, Tahsildar and allied posts) — UPSC-like structure with a strong Maharashtra-specific overlay in history, geography and polity.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'MPSC aspirants juggle two syllabi — the UPSC-style core plus the Maharashtra-specific layer — and the state layer (local self-government, Samyukta Maharashtra movement) is exactly what fades first because no all-India material revises it.',
  },

  cat: {
    id: 'cat',
    name: 'CAT',
    fullName: 'Common Admission Test',
    country: 'India',
    category: 'management',
    conductedBy: 'Indian Institutes of Management (a different IIM each year)',
    frequency: 'Once a year (last Sunday of November)',
    totalQuestions: 68,
    duration: 120,
    markingScheme: {
      correct: 3,
      incorrect: -1,
      unattempted: 0,
      notes:
        'MCQs: +3/-1. TITA (type-in-the-answer) questions: +3 with NO negative marking. Sectional time locks of 40 minutes each — you cannot return to a section. Scores are scaled and reported as percentiles; ~99 percentile is the general-category cutoff for old IIMs.',
    },
    sections: [
      {
        name: 'VARC — Verbal Ability and Reading Comprehension',
        questionCount: 24,
        durationMinutes: 40,
        format: 'mcq + tita',
        topics: [
          'Reading Comprehension (4 passages: inference, tone, main idea)',
          'Para Jumbles',
          'Para Summary',
          'Odd Sentence Out',
          'Sentence Completion and Placement',
        ],
      },
      {
        name: 'DILR — Data Interpretation and Logical Reasoning',
        questionCount: 22,
        durationMinutes: 40,
        format: 'mcq + tita',
        topics: [
          'Data Tables, Bar/Line/Pie Charts and Caselets',
          'Seating Arrangements and Grouping',
          'Games, Tournaments and Scheduling',
          'Venn Diagrams and Set-Based Puzzles',
          'Routes, Networks and Optimisation',
        ],
      },
      {
        name: 'QA — Quantitative Ability',
        questionCount: 22,
        durationMinutes: 40,
        format: 'mcq + tita',
        topics: [
          'Arithmetic (Percentages, Ratio, Time-Speed-Distance, Time and Work, Mixtures)',
          'Algebra (Equations, Inequalities, Functions, Logarithms)',
          'Geometry and Mensuration',
          'Number System',
          'Modern Math (Permutations-Combinations, Probability, Progressions)',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 10,
    aspirantsPerYear: '~3.3 lakh registered',
    description:
      'Entrance to the 21 IIMs and most top Indian B-schools — a speed-and-selection test where choosing WHICH 40-45 questions to attempt matters more than syllabus coverage.',
    priceINR: 149,
    spaceRepetitionApplicable: false,
    keyInsight:
      'CAT is percentile combat, not syllabus recall — the winning skill is question selection under sectional time locks. Daily sectional mocks and error-log review beat content revision; spaced repetition applies only to formula sheets and vocabulary.',
  },

  clat: {
    id: 'clat',
    name: 'CLAT',
    fullName: 'Common Law Admission Test',
    country: 'India',
    category: 'law',
    conductedBy: 'Consortium of National Law Universities',
    frequency: 'Once a year (December, for the following academic year)',
    totalQuestions: 120,
    duration: 120,
    markingScheme: {
      correct: 1,
      incorrect: -0.25,
      unattempted: 0,
      notes: '120 passage-based MCQs since the 2024 edition (previously 150). Every section is comprehension-driven — even Quant starts from a data passage.',
    },
    sections: [
      {
        name: 'English Language',
        questionCount: 24,
        format: 'passage-based mcq',
        topics: [
          'Reading Comprehension (450-word passages)',
          'Inference and Conclusion Drawing',
          'Vocabulary in Context',
          'Author\u2019s Tone and Viewpoint',
        ],
      },
      {
        name: 'Current Affairs including General Knowledge',
        questionCount: 30,
        format: 'passage-based mcq',
        topics: [
          'National and International Current Affairs',
          'Contemporary Legal Developments',
          'Arts and Culture',
          'International Affairs and Treaties',
          'Historical Events of Continuing Significance',
        ],
      },
      {
        name: 'Legal Reasoning',
        questionCount: 30,
        format: 'passage-based mcq',
        topics: [
          'Application of Legal Principles to Fact Situations',
          'Law of Torts',
          'Law of Contracts',
          'Constitutional Law',
          'Criminal Law (IPC/BNS basics)',
          'Legal Current Affairs and Landmark Judgments',
        ],
      },
      {
        name: 'Logical Reasoning',
        questionCount: 24,
        format: 'passage-based mcq',
        topics: [
          'Argument Structure (Premise, Conclusion, Assumption)',
          'Strengthening and Weakening Arguments',
          'Inferences and Analogies',
          'Critical Reasoning Passages',
        ],
      },
      {
        name: 'Quantitative Techniques',
        questionCount: 12,
        format: 'data-passage mcq',
        topics: [
          'Ratios, Proportions and Percentages',
          'Basic Algebra and Mensuration',
          'Statistical Estimation (Averages, Data Sets)',
          'Graph and Table Interpretation',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 12,
    aspirantsPerYear: '~70,000',
    description:
      'Entrance to 24 National Law Universities for the 5-year integrated LLB — a reading-speed exam in disguise: ~20,000 words of passages in 120 minutes.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'CLAT toppers are readers, not crammers — but Current Affairs and Legal GK (a quarter of the paper) decay fast, so a daily 20-minute spaced-revision loop on news and judgments is the highest-ROI habit.',
  },

  ssc_cgl: {
    id: 'ssc_cgl',
    name: 'SSC CGL',
    fullName: 'Staff Selection Commission - Combined Graduate Level Examination',
    country: 'India',
    category: 'civil_services',
    conductedBy: 'Staff Selection Commission (SSC)',
    frequency: 'Once a year (Tier 1 ~September, Tier 2 ~December-January)',
    totalQuestions: 100,
    duration: 60,
    markingScheme: {
      correct: 2,
      incorrect: -0.5,
      unattempted: 0,
      notes:
        'Tier 1: 100 Qs x 2 marks, -0.50 per wrong, qualifying in nature since the 2022 pattern change. Tier 2 Paper I decides merit: +3 per correct, -1 per wrong, plus a qualifying Data Entry Speed Test and Computer module.',
    },
    sections: [
      {
        name: 'Tier 1 — General Intelligence and Reasoning',
        questionCount: 25,
        marks: 50,
        format: 'mcq',
        topics: [
          'Analogies, Classification and Series',
          'Coding-Decoding',
          'Syllogisms and Venn Diagrams',
          'Blood Relations and Direction Sense',
          'Non-Verbal Reasoning (Mirror Images, Paper Folding, Figure Completion)',
        ],
      },
      {
        name: 'Tier 1 — General Awareness',
        questionCount: 25,
        marks: 50,
        format: 'mcq',
        topics: [
          'Indian History and Culture',
          'Geography and Environment',
          'Indian Polity and Constitution',
          'Economy and Budget',
          'General Science (Physics, Chemistry, Biology)',
          'Static GK and Current Affairs',
        ],
      },
      {
        name: 'Tier 1 — Quantitative Aptitude',
        questionCount: 25,
        marks: 50,
        format: 'mcq',
        topics: [
          'Number System and Simplification',
          'Percentages, Ratio and Proportion, Averages',
          'Profit-Loss, Interest and Mixtures',
          'Time-Speed-Distance and Time-Work',
          'Algebra, Geometry, Trigonometry and Mensuration',
          'Data Interpretation',
        ],
      },
      {
        name: 'Tier 1 — English Comprehension',
        questionCount: 25,
        marks: 50,
        format: 'mcq',
        topics: [
          'Error Spotting and Sentence Improvement',
          'Fill in the Blanks',
          'Synonyms, Antonyms and One-Word Substitution',
          'Idioms and Phrases',
          'Active-Passive and Direct-Indirect',
          'Reading Comprehension and Cloze Test',
        ],
      },
      {
        name: 'Tier 2 — Paper I (merit-deciding)',
        questionCount: 150,
        marks: 450,
        durationMinutes: 150,
        format: 'mcq + data entry test',
        topics: [
          'Mathematical Abilities (30 Qs) — advanced arithmetic, algebra, geometry',
          'Reasoning and General Intelligence (30 Qs)',
          'English Language and Comprehension (45 Qs)',
          'General Awareness (25 Qs)',
          'Computer Knowledge module (20 Qs, qualifying)',
          'Data Entry Speed Test (qualifying)',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 10,
    aspirantsPerYear: '~25-30 lakh apply',
    description:
      'Recruits Group B and C officers (Income Tax Inspector, Excise, ASO, Auditor) across central ministries — moderate syllabus, extreme competition, decided by speed and accuracy.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'CGL cutoffs are decided by 2-3 marks among lakhs of aspirants — GK is the least practised, fastest-decaying section, and a daily spaced ladder on static GK + current affairs is worth more than another hundred maths questions.',
  },

  rrb_ntpc: {
    id: 'rrb_ntpc',
    name: 'RRB NTPC',
    fullName: 'Railway Recruitment Board - Non-Technical Popular Categories Examination',
    country: 'India',
    category: 'civil_services',
    conductedBy: 'Railway Recruitment Boards (21 zonal RRBs, centrally coordinated)',
    frequency: 'Per vacancy cycle (roughly annual notifications)',
    totalQuestions: 100,
    duration: 90,
    markingScheme: {
      correct: 1,
      incorrect: -0.33,
      unattempted: 0,
      notes: 'CBT-1: 100 Qs, 90 min, -1/3 per wrong answer; normalised across shifts. CBT-2: 120 Qs, 90 min, same marking. Typing/aptitude tests for specific posts.',
    },
    sections: [
      {
        name: 'CBT-1 — Mathematics',
        questionCount: 30,
        format: 'mcq',
        topics: [
          'Number System and Simplification',
          'Decimals, Fractions, LCM-HCF',
          'Ratio-Proportion, Percentage, Averages',
          'Time and Work, Time-Speed-Distance',
          'Simple and Compound Interest, Profit and Loss',
          'Elementary Algebra, Geometry, Trigonometry and Statistics',
        ],
      },
      {
        name: 'CBT-1 — General Intelligence and Reasoning',
        questionCount: 30,
        format: 'mcq',
        topics: [
          'Analogies and Series Completion',
          'Coding-Decoding',
          'Puzzles and Seating Arrangement',
          'Syllogisms and Statement-Conclusion',
          'Venn Diagrams, Data Sufficiency and Decision Making',
        ],
      },
      {
        name: 'CBT-1 — General Awareness',
        questionCount: 40,
        format: 'mcq',
        topics: [
          'Current Events (national and international)',
          'Indian History, Art and Culture',
          'Geography of India and the World',
          'Indian Polity and Governance',
          'Indian Economy',
          'General Science (up to Class X CBSE)',
          'Indian Railways facts, Sports, Awards',
        ],
      },
      {
        name: 'CBT-2 (120 Qs, 90 min — same three subjects, higher weightage on GA)',
        questionCount: 120,
        durationMinutes: 90,
        format: 'mcq',
        topics: [
          'Mathematics (35 Qs)',
          'General Intelligence and Reasoning (35 Qs)',
          'General Awareness (50 Qs)',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 6,
    aspirantsPerYear: '~1 crore+ applications per cycle',
    description:
      'Recruits station masters, clerks, goods guards and commercial apprentices in Indian Railways — one of the largest recruitment exams on Earth by application volume.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'General Awareness is 40% of CBT-1 and 100% memory — with a crore of applicants and shift normalisation, the aspirants who schedule GA revision (instead of only grinding maths) clear the cutoff.',
  },

  ibps_po: {
    id: 'ibps_po',
    name: 'IBPS PO',
    fullName: 'Institute of Banking Personnel Selection - Probationary Officer (CRP PO/MT)',
    country: 'India',
    category: 'banking',
    conductedBy: 'Institute of Banking Personnel Selection (IBPS)',
    frequency: 'Once a year (Prelims ~October, Mains ~November, Interview Jan-Feb)',
    totalQuestions: 100,
    duration: 60,
    markingScheme: {
      correct: 1,
      incorrect: -0.25,
      unattempted: 0,
      notes:
        'Prelims: 100 Qs, 60 min with 20-minute sectional locks, qualifying. Mains: 155 objective Qs (200 marks, 3 hours) + English descriptive (letter + essay, 25 marks, 30 min). Final merit: Mains 80% + Interview 20%; Prelims marks are not counted.',
    },
    sections: [
      {
        name: 'Prelims — English Language',
        questionCount: 30,
        durationMinutes: 20,
        format: 'mcq',
        topics: [
          'Reading Comprehension',
          'Cloze Test',
          'Error Spotting and Sentence Correction',
          'Para Jumbles',
          'Fillers and Vocabulary',
        ],
      },
      {
        name: 'Prelims — Quantitative Aptitude',
        questionCount: 35,
        durationMinutes: 20,
        format: 'mcq',
        topics: [
          'Simplification and Approximation',
          'Number Series',
          'Quadratic Equations and Inequalities',
          'Data Interpretation (tables, charts, caselets)',
          'Arithmetic (Percentage, Ratio, Interest, Time-Work, Speed-Distance)',
        ],
      },
      {
        name: 'Prelims — Reasoning Ability',
        questionCount: 35,
        durationMinutes: 20,
        format: 'mcq',
        topics: [
          'Puzzles and Seating Arrangements (linear, circular, floor-based)',
          'Syllogisms',
          'Inequalities',
          'Blood Relations and Direction Sense',
          'Coding-Decoding and Alphanumeric Series',
        ],
      },
      {
        name: 'Mains — objective + descriptive (merit-deciding)',
        questionCount: 155,
        marks: 225,
        durationMinutes: 210,
        format: 'mcq + descriptive',
        topics: [
          'Reasoning and Computer Aptitude (45 Qs, 60 marks)',
          'General / Economy / Banking Awareness (40 Qs, 40 marks)',
          'English Language (35 Qs, 40 marks)',
          'Data Analysis and Interpretation (35 Qs, 60 marks)',
          'English Descriptive: Letter Writing and Essay (25 marks)',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 8,
    aspirantsPerYear: '~4-6 lakh',
    description:
      'Recruits Probationary Officers for 11 public-sector banks — sectional time locks and steep accuracy demands make it a speed-and-consistency exam.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Banking Awareness (a full Mains section) is churned monthly by RBI circulars and budget updates — aspirants who batch-revise current banking GK on a spaced ladder keep marks that one-time readers lose within weeks.',
  },

  nda: {
    id: 'nda',
    name: 'NDA',
    fullName: 'National Defence Academy and Naval Academy Examination',
    country: 'India',
    category: 'defence',
    conductedBy: 'Union Public Service Commission (UPSC)',
    frequency: 'Twice a year (NDA I ~April, NDA II ~September)',
    totalQuestions: 270,
    duration: 300,
    markingScheme: {
      correct: 2.5,
      incorrect: -0.83,
      unattempted: 0,
      notes:
        'Mathematics: 120 Qs x 2.5 marks (300 total), -0.83 per wrong. GAT: 150 Qs x 4 marks (600 total), -1.33 per wrong. Written total 900, followed by a 900-mark, 5-day SSB interview. Candidates must be 16.5-19.5 years old.',
    },
    sections: [
      {
        name: 'Paper I — Mathematics',
        questionCount: 120,
        marks: 300,
        durationMinutes: 150,
        format: 'mcq',
        topics: [
          'Algebra (Sets, Complex Numbers, Progressions, Quadratics)',
          'Matrices and Determinants',
          'Trigonometry',
          'Analytical Geometry (2D and 3D)',
          'Differential Calculus and Integral Calculus',
          'Differential Equations',
          'Vector Algebra',
          'Statistics and Probability',
        ],
      },
      {
        name: 'Paper II — General Ability Test (GAT)',
        questionCount: 150,
        marks: 600,
        durationMinutes: 150,
        format: 'mcq',
        topics: [
          'English (Grammar, Vocabulary, Comprehension) — 50 Qs, 200 marks',
          'Physics (Mechanics, Heat, Light, Electricity)',
          'Chemistry (Elements, Compounds, Everyday Chemistry)',
          'General Science and Biology Basics',
          'Indian History and the Freedom Movement',
          'Geography (India and World)',
          'Current Events',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 12,
    aspirantsPerYear: '~3-4 lakh per attempt (~6-7 lakh across both)',
    description:
      'Entry to the National Defence Academy (Army, Navy, Air Force wings) straight after Class 12 — a maths-heavy written screen followed by the 5-day SSB personality assessment.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'The written exam is won on Mathematics speed (120 questions in 150 minutes) but LOST on GAT general knowledge — school-age aspirants systematically under-revise history and geography because nobody schedules it for them.',
  },

  cds: {
    id: 'cds',
    name: 'CDS',
    fullName: 'Combined Defence Services Examination',
    country: 'India',
    category: 'defence',
    conductedBy: 'Union Public Service Commission (UPSC)',
    frequency: 'Twice a year (CDS I ~April, CDS II ~September)',
    totalQuestions: 340,
    duration: 360,
    markingScheme: {
      correct: 1,
      incorrect: -0.33,
      unattempted: 0,
      notes:
        'Three papers of 100 marks each: English (120 Qs), General Knowledge (120 Qs), Elementary Mathematics (100 Qs) — so per-question marks differ (0.83 for English/GK, 1 for Maths); the penalty is one-third of the question\u2019s marks. OTA (Officers Training Academy) candidates skip the Maths paper. SSB interview follows.',
    },
    sections: [
      {
        name: 'English',
        questionCount: 120,
        marks: 100,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'Reading Comprehension',
          'Error Spotting',
          'Sentence Arrangement and Improvement',
          'Synonyms and Antonyms',
          'Idioms and Phrases',
          'Fill in the Blanks',
        ],
      },
      {
        name: 'General Knowledge',
        questionCount: 120,
        marks: 100,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'Current Affairs (national, international, defence)',
          'Indian History and National Movement',
          'Indian Polity and Constitution',
          'Geography (India and World)',
          'Indian Economy',
          'General Science (Physics, Chemistry, Biology)',
          'Defence-Related Awareness',
        ],
      },
      {
        name: 'Elementary Mathematics (not for OTA)',
        questionCount: 100,
        marks: 100,
        durationMinutes: 120,
        format: 'mcq',
        topics: [
          'Arithmetic (Number System, Percentages, Interest, Time-Work, Time-Distance)',
          'Elementary Algebra',
          'Trigonometry',
          'Geometry',
          'Mensuration',
          'Statistics',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 8,
    aspirantsPerYear: '~2.5 lakh per attempt',
    description:
      'Graduate-entry route to IMA, INA, AFA and OTA — Class-10-level maths but a wide, current-affairs-heavy GK paper, followed by the SSB interview.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'The GK paper spans everything from ancient history to last month\u2019s defence deals — it cannot be crammed in the final month, only maintained; a rolling spaced-revision calendar across GK sub-areas is the whole preparation strategy.',
  },

  ctet: {
    id: 'ctet',
    name: 'CTET',
    fullName: 'Central Teacher Eligibility Test',
    country: 'India',
    category: 'teaching',
    conductedBy: 'Central Board of Secondary Education (CBSE)',
    frequency: 'Twice a year (typically July and December)',
    totalQuestions: 150,
    duration: 150,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'NO negative marking. Qualifying: 60% (90/150) for general category, 55% for reserved. The certificate is valid for life (since 2021). Candidates may sit both papers in one day to be eligible for classes 1-8.',
    },
    sections: [
      {
        name: 'Paper 1 (Classes 1-5) — Child Development and Pedagogy',
        questionCount: 30,
        format: 'mcq',
        topics: [
          'Child Development (Piaget, Kohlberg, Vygotsky)',
          'Concept of Inclusive Education and Special Needs',
          'Learning and Pedagogy',
          'Assessment and Evaluation',
        ],
      },
      {
        name: 'Paper 1 — Language I and Language II',
        questionCount: 60,
        format: 'mcq',
        topics: [
          'Reading Comprehension (prose and poem)',
          'Pedagogy of Language Development',
          'Grammar and Verbal Ability',
          'Language Skills: Listening, Speaking, Teaching-Learning Materials',
        ],
      },
      {
        name: 'Paper 1 — Mathematics and Environmental Studies',
        questionCount: 60,
        format: 'mcq',
        topics: [
          'Numbers, Shapes, Measurement, Data Handling (content up to Class 5)',
          'Pedagogical Issues in Mathematics',
          'Family and Friends, Food, Shelter, Water, Travel (EVS themes)',
          'EVS Pedagogy and NCF principles',
        ],
      },
      {
        name: 'Paper 2 (Classes 6-8) — CDP + Languages + Maths/Science OR Social Studies',
        questionCount: 150,
        durationMinutes: 150,
        format: 'mcq',
        topics: [
          'Child Development and Pedagogy (30 Qs)',
          'Language I and Language II (30 + 30 Qs)',
          'Mathematics and Science (60 Qs) — for Maths/Science teachers',
          'Social Studies (60 Qs) — for Social Studies teachers',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 5,
    aspirantsPerYear: '~25-30 lakh per cycle',
    description:
      'The mandatory eligibility test for teaching posts in central government schools (KVS, NVS) and a benchmark for state schools — pedagogy-weighted, no negative marking.',
    priceINR: 149,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Aspirants fail CTET on pedagogy theory, not content — child-development theorists and NCF terminology are pure recall that decays in weeks, ideal for a short spaced ladder in the final two months.',
  },

  /* =========================== INTERNATIONAL =========================== */

  mcat: {
    id: 'mcat',
    name: 'MCAT',
    fullName: 'Medical College Admission Test',
    country: 'USA',
    category: 'medical',
    conductedBy: 'Association of American Medical Colleges (AAMC)',
    frequency: '~30 test dates per year (January and March-September)',
    totalQuestions: 230,
    duration: 450,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'No negative marking — never leave a blank. Raw scores scale to 118-132 per section, 472-528 total (500 is the median; ~511+ is competitive for MD programs). Content time is 6h15m; the full seated day with breaks runs ~7.5 hours.',
    },
    sections: [
      {
        name: 'Chemical and Physical Foundations of Biological Systems',
        questionCount: 59,
        durationMinutes: 95,
        format: 'passage-based mcq',
        topics: [
          'General Chemistry (Thermodynamics, Kinetics, Solutions, Acids-Bases)',
          'Physics (Mechanics, Fluids, Circuits, Optics, Waves)',
          'Organic Chemistry (Functional Groups, Separations, Spectroscopy)',
          'Biochemistry (Enzymes, Metabolism overlap)',
          'Research Methods and Data Interpretation',
        ],
      },
      {
        name: 'CARS — Critical Analysis and Reasoning Skills',
        questionCount: 53,
        durationMinutes: 90,
        format: 'passage-based mcq',
        topics: [
          'Humanities Passages (ethics, philosophy, art)',
          'Social Sciences Passages (economics, history, studies of diverse cultures)',
          'Foundations of Comprehension',
          'Reasoning Within the Text',
          'Reasoning Beyond the Text (application and extrapolation)',
        ],
      },
      {
        name: 'Biological and Biochemical Foundations of Living Systems',
        questionCount: 59,
        durationMinutes: 95,
        format: 'passage-based mcq',
        topics: [
          'Biochemistry (Amino Acids, Enzymes, Metabolic Pathways)',
          'Molecular Biology (DNA Replication, Transcription, Translation)',
          'Cell Biology',
          'Organ Systems Physiology',
          'Genetics and Evolution',
          'Microbiology',
        ],
      },
      {
        name: 'Psychological, Social and Biological Foundations of Behavior',
        questionCount: 59,
        durationMinutes: 95,
        format: 'passage-based mcq',
        topics: [
          'Sensation, Perception and Cognition',
          'Learning, Memory and Behavior',
          'Motivation, Emotion, Attitudes and Personality',
          'Psychological Disorders',
          'Social Processes, Identity and Social Structure',
          'Demographics and Social Inequality',
        ],
      },
    ],
    difficulty: 'very_hard',
    typicalPreparationMonths: 6,
    aspirantsPerYear: '~85,000-90,000 test takers',
    description:
      'The gateway to US and Canadian MD/DO programs — a 7.5-hour endurance test of applied science reasoning plus a pure verbal section, typically prepared with 300-350 total study hours.',
    priceINR: null,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Pre-meds studying 8+ hours a day still watch their first content block (biochem pathways, amino acids) decay before test day — the MCAT\u2019s 6-month prep arc is the textbook case for a spaced-repetition ladder plus full-length endurance practice.',
  },

  gre: {
    id: 'gre',
    name: 'GRE General',
    fullName: 'Graduate Record Examinations - General Test',
    country: 'USA',
    category: 'international_graduate',
    conductedBy: 'Educational Testing Service (ETS)',
    frequency: 'Year-round, computer-delivered (test-center and at-home)',
    totalQuestions: 54,
    duration: 118,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'No negative marking. Section-level adaptive: the second Verbal/Quant section\u2019s difficulty depends on first-section performance. Scores: Verbal 130-170, Quant 130-170 (1-point steps), Analytical Writing 0-6 (half-point steps). The shortened (Sept 2023) format is 1h58m with no unscored section.',
    },
    sections: [
      {
        name: 'Analytical Writing',
        questionCount: 1,
        durationMinutes: 30,
        format: 'essay',
        topics: [
          '\u201cAnalyze an Issue\u201d essay',
          'Constructing a clear position with reasons and examples',
          'Organisation, development and language control',
        ],
      },
      {
        name: 'Verbal Reasoning (2 sections: 12 + 15 questions)',
        questionCount: 27,
        durationMinutes: 41,
        format: 'adaptive mcq',
        topics: [
          'Text Completion (1-3 blanks)',
          'Sentence Equivalence',
          'Reading Comprehension (short and long passages)',
          'Critical Reasoning (argument analysis)',
          'High-Frequency Academic Vocabulary',
        ],
      },
      {
        name: 'Quantitative Reasoning (2 sections: 12 + 15 questions)',
        questionCount: 27,
        durationMinutes: 47,
        format: 'adaptive mcq + numeric entry',
        topics: [
          'Arithmetic (Integers, Fractions, Percents, Ratios)',
          'Algebra (Equations, Inequalities, Functions, Coordinate Geometry)',
          'Geometry (Angles, Circles, Solids)',
          'Data Analysis (Statistics, Probability, Data Interpretation)',
          'Quantitative Comparison questions',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 4,
    aspirantsPerYear: '~340,000 worldwide',
    description:
      'The general admission test for US and global graduate schools (MS, PhD, some MBA) — since September 2023 a compact 2-hour adaptive test.',
    priceINR: null,
    spaceRepetitionApplicable: true,
    keyInsight:
      'GRE Verbal is decided by vocabulary breadth — a textbook spaced-repetition use case (1,000+ words on a review ladder) — while Quant is won by eliminating careless errors on questions you already know how to solve.',
  },

  gmat: {
    id: 'gmat',
    name: 'GMAT',
    fullName: 'Graduate Management Admission Test (Focus Edition format)',
    country: 'USA',
    category: 'management',
    conductedBy: 'Graduate Management Admission Council (GMAC)',
    frequency: 'Year-round, computer-adaptive (test-center and online)',
    totalQuestions: 64,
    duration: 135,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'Question-adaptive: difficulty adjusts per answer, so no raw marking scheme — unanswered questions carry a heavy penalty. Total score 205-805 (10-point steps); each section scored 60-90. Sections can be taken in any order; one 10-minute break.',
    },
    sections: [
      {
        name: 'Quantitative Reasoning',
        questionCount: 21,
        durationMinutes: 45,
        format: 'adaptive mcq (problem solving only)',
        topics: [
          'Arithmetic and Number Properties',
          'Algebra (Equations, Inequalities, Exponents)',
          'Word Problems (Rates, Work, Mixtures, Ratios, Percents)',
          'Statistics and Counting Methods',
        ],
      },
      {
        name: 'Verbal Reasoning',
        questionCount: 23,
        durationMinutes: 45,
        format: 'adaptive mcq',
        topics: [
          'Critical Reasoning (assumptions, strengthen/weaken, evaluate)',
          'Reading Comprehension (business, science, humanities passages)',
          'Inference and Argument Evaluation',
        ],
      },
      {
        name: 'Data Insights',
        questionCount: 20,
        durationMinutes: 45,
        format: 'adaptive multi-format',
        topics: [
          'Data Sufficiency',
          'Multi-Source Reasoning',
          'Table Analysis',
          'Graphics Interpretation',
          'Two-Part Analysis',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 4,
    aspirantsPerYear: '~100,000+ worldwide',
    description:
      'The MBA admission standard for top global business schools — a 2h15m adaptive test where Data Insights (the ex-Integrated Reasoning section) now carries equal weight with Quant and Verbal.',
    priceINR: null,
    spaceRepetitionApplicable: false,
    keyInsight:
      'The adaptive algorithm punishes streaks of rushed errors more than isolated hard misses — pacing discipline and an error log beat content volume; only formula sheets and idiom lists benefit from spaced recall.',
  },

  lsat: {
    id: 'lsat',
    name: 'LSAT',
    fullName: 'Law School Admission Test',
    country: 'USA',
    category: 'law',
    conductedBy: 'Law School Admission Council (LSAC)',
    frequency: '~9 administrations per year (test-center and remote)',
    totalQuestions: 76,
    duration: 140,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'No negative marking. ~76 scored questions across 3 scored sections plus 1 unscored variable section (4 x 35 min). Scaled score 120-180 (~152 median, 170+ = top 3%). Analytical Reasoning (\u201clogic games\u201d) was REMOVED in August 2024 — the scored test is now 2x Logical Reasoning + 1x Reading Comprehension. LSAT Writing is taken separately online and sent unscored to schools.',
    },
    sections: [
      {
        name: 'Logical Reasoning (2 scored sections)',
        questionCount: 50,
        durationMinutes: 70,
        format: 'mcq',
        topics: [
          'Identifying Assumptions (necessary and sufficient)',
          'Strengthening and Weakening Arguments',
          'Flaw-in-Reasoning Questions',
          'Inference and Must-Be-True Questions',
          'Parallel Reasoning and Principle Application',
          'Argument Structure and Method of Reasoning',
        ],
      },
      {
        name: 'Reading Comprehension (1 scored section)',
        questionCount: 26,
        durationMinutes: 35,
        format: 'mcq',
        topics: [
          'Law and Legal-Theory Passages',
          'Natural Science Passages',
          'Humanities and Social Science Passages',
          'Comparative Reading (paired passages)',
          'Author Attitude, Structure and Inference Questions',
        ],
      },
      {
        name: 'Unscored Variable Section + LSAT Writing (separate)',
        questionCount: 26,
        durationMinutes: 35,
        format: 'mcq + essay (writing taken separately)',
        topics: [
          'Unscored experimental section (LR or RC, indistinguishable during the test)',
          'LSAT Argumentative Writing: 35-minute online essay, unscored but sent to schools',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 5,
    aspirantsPerYear: '~140,000 tests administered',
    description:
      'The primary admission test for US, Canadian and some UK law schools — pure reasoning under time pressure since logic games were retired in 2024; score is the single biggest admissions lever.',
    priceINR: null,
    spaceRepetitionApplicable: false,
    keyInsight:
      'There is no content to memorise — improvement comes from drilling question types until flaw-spotting is automatic, then reviewing every wrong answer\u2019s WHY. The strategy layer is an error-pattern log, not a revision ladder.',
  },

  ucat: {
    id: 'ucat',
    name: 'UCAT',
    fullName: 'University Clinical Aptitude Test',
    country: 'UK',
    category: 'medical',
    conductedBy: 'UCAT Consortium (delivered by Pearson VUE); UCAT ANZ for Australia/NZ',
    frequency: 'Once a year (testing window July-September, one attempt per cycle)',
    totalQuestions: 184,
    duration: 111,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'No negative marking. Each cognitive subtest scales to 300-900 (total 900-2700); Situational Judgement is banded 1-4. Abstract Reasoning was REMOVED from the 2025 test and Decision Making expanded to 35 questions — older prep material showing 5 subtests is outdated.',
    },
    sections: [
      {
        name: 'Verbal Reasoning',
        questionCount: 44,
        durationMinutes: 22,
        format: 'mcq (passage-based)',
        topics: [
          'Rapid Reading of 200-300 Word Passages',
          'True / False / Can\u2019t Tell Judgements',
          'Inference and Deduction from Text',
          'Distinguishing Stated Facts from Implications',
        ],
      },
      {
        name: 'Decision Making',
        questionCount: 35,
        durationMinutes: 37,
        format: 'mcq (text, charts, diagrams)',
        topics: [
          'Syllogisms and Logical Deduction',
          'Probabilistic and Statistical Reasoning',
          'Venn Diagrams',
          'Evaluating Arguments',
          'Interpreting Data to Reach Decisions',
        ],
      },
      {
        name: 'Quantitative Reasoning',
        questionCount: 36,
        durationMinutes: 26,
        format: 'mcq (data-based)',
        topics: [
          'Percentages, Ratios and Rates',
          'Mental Arithmetic at Speed',
          'Extracting Values from Charts, Tables and Graphs',
          'Multi-Step Numerical Problems',
        ],
      },
      {
        name: 'Situational Judgement',
        questionCount: 69,
        durationMinutes: 26,
        format: 'scenario rating',
        topics: [
          'Appropriateness of Responses in Clinical/Academic Scenarios',
          'Importance Ratings',
          'Medical Ethics Principles (integrity, patient safety, teamwork)',
          'Professional Behaviour Standards (GMC guidance themes)',
        ],
      },
    ],
    difficulty: 'hard',
    typicalPreparationMonths: 3,
    aspirantsPerYear: '~37,000 (UK cycle)',
    description:
      'The aptitude test for most UK (and Australian/NZ) medical and dental schools — extreme time pressure (roughly 30 seconds per question) rather than academic content.',
    priceINR: null,
    spaceRepetitionApplicable: false,
    keyInsight:
      'UCAT is a timing exam, not a knowledge exam — untimed accuracy means nothing. The winning preparation is short daily timed drills tracking seconds-per-question by subtest, ramping to full mocks in the final fortnight.',
  },

  gamsat: {
    id: 'gamsat',
    name: 'GAMSAT',
    fullName: 'Graduate Medical School Admissions Test',
    country: 'Australia',
    category: 'medical',
    conductedBy: 'Australian Council for Educational Research (ACER)',
    frequency: 'Twice a year (March and September sittings; UK and Ireland included)',
    totalQuestions: 139,
    duration: 315,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'No negative marking on MCQ sections; Section 2 essays are human-scored. Each section scales to 0-100; the standard overall score = (S1 + S2 + 2xS3) / 4 — Section 3 carries double weight at most schools. ~5.5-hour test day.',
    },
    sections: [
      {
        name: 'Section 1 — Reasoning in Humanities and Social Sciences',
        questionCount: 62,
        durationMinutes: 100,
        format: 'mcq (text, poetry, cartoons, data)',
        topics: [
          'Interpretation of Prose Fiction and Non-Fiction',
          'Poetry Analysis',
          'Cartoons, Images and Tables as Argument',
          'Logical and Plausible Reasoning in Socio-Cultural Contexts',
        ],
      },
      {
        name: 'Section 2 — Written Communication',
        questionCount: 2,
        durationMinutes: 65,
        format: 'essay',
        topics: [
          'Task A: Argumentative Essay on a Socio-Political Theme',
          'Task B: Reflective/Personal Essay on an Interpersonal Theme',
          'Thesis Development and Coherent Structure Under Time Pressure',
        ],
      },
      {
        name: 'Section 3 — Reasoning in Biological and Physical Sciences',
        questionCount: 75,
        durationMinutes: 150,
        format: 'mcq (stimulus-based)',
        topics: [
          'Biology (first-year university level, ~40% of questions)',
          'Chemistry — General and Organic (~40%)',
          'Physics (A-level / Year 12 standard, ~20%)',
          'Data Interpretation and Novel-Scenario Reasoning',
          'Applying Provided Information Over Memorised Facts',
        ],
      },
    ],
    difficulty: 'very_hard',
    typicalPreparationMonths: 6,
    aspirantsPerYear: '~12,000-15,000 across sittings',
    description:
      'The entrance test for graduate-entry medicine in Australia, the UK and Ireland — a 5.5-hour reasoning marathon where Section 3 (double-weighted science reasoning) usually decides the outcome.',
    priceINR: null,
    spaceRepetitionApplicable: true,
    keyInsight:
      'GAMSAT punishes pure memorisation — questions hand you the information and test reasoning — but the science FOUNDATIONS (organic mechanisms, physics relationships) must be automatic, and non-science graduates need a spaced ladder to build and hold that base over a 6-month arc.',
  },

  uk_a_levels: {
    id: 'uk_a_levels',
    name: 'A-Levels',
    fullName: 'GCE Advanced Level qualifications (UK)',
    country: 'UK',
    category: 'international_graduate',
    conductedBy: 'Ofqual-regulated boards: AQA, Pearson Edexcel, OCR, WJEC/Eduqas (CAIE & Edexcel IAL internationally)',
    frequency: 'Once a year (exams May-June, results mid-August); students typically sit 3 subjects after a 2-year course',
    totalQuestions: 0,
    duration: 0,
    markingScheme: {
      correct: 1,
      incorrect: 0,
      unattempted: 0,
      notes:
        'Papers are marked out of raw marks (structured questions and essays, no negative marking) and converted via grade boundaries to A*-E. England has been LINEAR since the 2015-18 reforms — all papers at the end of Year 13; only international variants (CAIE, Edexcel IAL) keep modular AS/A2 units. Typically 2-3 papers of ~2 hours per subject.',
    },
    sections: [
      {
        name: 'Mathematics (most popular A-Level)',
        questionCount: 0,
        format: 'structured written papers',
        topics: [
          'Pure Mathematics (Proof, Algebra, Functions, Calculus, Trigonometry, Vectors)',
          'Statistics (Sampling, Distributions, Hypothesis Testing)',
          'Mechanics (Kinematics, Forces, Moments)',
        ],
      },
      {
        name: 'Physics',
        questionCount: 0,
        format: 'structured written papers + practical endorsement',
        topics: [
          'Mechanics and Materials',
          'Waves and Optics',
          'Electricity',
          'Fields (Gravitational, Electric, Magnetic)',
          'Particle and Nuclear Physics',
          'Thermodynamics and Practical Skills',
        ],
      },
      {
        name: 'Chemistry',
        questionCount: 0,
        format: 'structured written papers + practical endorsement',
        topics: [
          'Physical Chemistry (Atomic Structure, Bonding, Energetics, Kinetics, Equilibria)',
          'Inorganic Chemistry (Periodicity, Group Chemistry, Transition Metals)',
          'Organic Chemistry (Mechanisms, Synthesis, Analysis: NMR, IR, MS)',
        ],
      },
      {
        name: 'Biology',
        questionCount: 0,
        format: 'structured written papers + practical endorsement',
        topics: [
          'Biological Molecules and Cells',
          'Exchange, Transport and Energy Transfers',
          'Genetics, Populations and Evolution',
          'Gene Expression and Biotechnology',
          'Organisms and Their Environment (Ecology)',
        ],
      },
    ],
    difficulty: 'moderate',
    typicalPreparationMonths: 24,
    aspirantsPerYear: '~800,000 subject entries (England, per year)',
    description:
      'The UK\u2019s university-entrance qualifications — subject-based, essay-and-structured-question papers graded A*-E, sat at the end of a two-year sixth-form course.',
    priceINR: null,
    spaceRepetitionApplicable: true,
    keyInsight:
      'Linear A-Levels examine TWO years of content in one May-June window — Year 12 material silently decays during Year 13, and students who run continuous spaced revision from month one outperform those who start revising at Easter.',
  },
};

/** Every exam as an array, stable order (India first, then international). */
export const EXAM_LIST: ExamInfo[] = Object.values(EXAM_DATABASE);

/** All exam ids, for pickers and validation. */
export const EXAM_IDS: string[] = Object.keys(EXAM_DATABASE);

/** Lookup by id — accepts the raw id or a 'custom:' prefixed profile id. */
export function getExamById(id: string | null | undefined): ExamInfo | null {
  if (!id) return null;
  const key = String(id).replace(/^custom:/, '').trim();
  return EXAM_DATABASE[key] ?? null;
}

/** Exams for one country, e.g. examsByCountry('India'). */
export function examsByCountry(country: ExamCountry): ExamInfo[] {
  return EXAM_LIST.filter((exam) => exam.country === country);
}

/** Exams for one category, e.g. examsByCategory('medical'). */
export function examsByCategory(category: ExamCategory): ExamInfo[] {
  return EXAM_LIST.filter((exam) => exam.category === category);
}
