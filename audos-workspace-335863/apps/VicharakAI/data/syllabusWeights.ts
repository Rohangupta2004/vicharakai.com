/**
 * Chapter-level exam weightage for NEET-UG and JEE Main.
 *
 * Every number is the share (in %) that chapter carries of the WHOLE paper —
 * NOT of its subject's section. That distinction matters: it makes Physics,
 * Chemistry, Biology and Mathematics chapters directly comparable, so a
 * cross-subject queue can be ordered by "where are the marks?" alone.
 *
 * NOTE: this is deliberately a DIFFERENT dataset from ../weightage.ts, which
 * stores per-SUBJECT-section shares against the planner's own coarse chapter
 * names (../syllabus.ts) and drives the Weightage/Syllabus reading surfaces.
 * That file stays the source of truth for those screens; this one exists for
 * the backlog-triage prioritisation described in getPriorityScore
 * (../studyEngine.ts) and is keyed on NCERT/NTA chapter names instead.
 *
 * Chapter names entered by students rarely match a key character for
 * character, so every lookup goes through getChapterWeight, which normalises,
 * then consults a curated alias table (the planner's grouped chapter names
 * map onto one or more NCERT chapters), then tries containment, and finally
 * falls back to FALLBACK_CHAPTER_WEIGHT so an unknown chapter is simply
 * treated as equal-priority rather than dropped.
 */

/** The two exams this dataset covers. */
export type WeightExamId = 'neet_ug' | 'jee_main';

export interface ExamWeightProfile {
  /** Questions in the full paper the percentages below are shares of. */
  questionCount: number;
  /** subject → chapter name → percent of the full paper. */
  subjects: Record<string, Record<string, number>>;
}

/**
 * The weight used when a chapter has no entry (an exam we hold no data for, a
 * free-text task, a chapter that left the syllabus). 1.0 means "count this as
 * an ordinary chapter" — it never removes an item from the queue.
 */
export const FALLBACK_CHAPTER_WEIGHT = 1.0;

/* ------------------------------------------------------------------ */
/*  The data                                                           */
/* ------------------------------------------------------------------ */

export const SYLLABUS_WEIGHTS: Record<WeightExamId, ExamWeightProfile> = {
  neet_ug: {
    questionCount: 180,
    subjects: {
      Physics: {
        'Units & Dimensions': 1.3,
        'Motion in a Straight Line': 1.1,
        'Motion in a Plane': 0.7,
        'Laws of Motion': 0.8,
        'Work, Energy & Power': 0.8,
        'System of Particles & Rotational Motion': 1.1,
        Gravitation: 1.3,
        'Mechanical Properties of Solids': 0.4,
        'Mechanical Properties of Fluids': 0.8,
        'Thermal Properties of Matter': 0.1,
        Thermodynamics: 0.4,
        'Kinetic Theory': 0.6,
        Oscillations: 0.9,
        Waves: 0.3,
        'Electric Charges & Fields': 0.6,
        'Electrostatic Potential & Capacitance': 1.8,
        'Current Electricity': 2.0,
        'Moving Charges & Magnetism': 1.3,
        'Magnetism & Matter': 0.6,
        'Electromagnetic Induction': 0.6,
        'Alternating Current': 1.2,
        'Electromagnetic Waves': 1.2,
        'Ray Optics & Optical Instruments': 1.6,
        'Wave Optics': 0.7,
        'Dual Nature of Radiation & Matter': 1.1,
        Atoms: 0.9,
        Nuclei: 0.3,
        'Semiconductor Electronics': 1.7,
      },
      Chemistry: {
        'Some Basic Concepts of Chemistry': 0.9,
        'Structure of Atom': 0.9,
        'Classification of Elements & Periodicity': 0.8,
        'Chemical Bonding & Molecular Structure': 1.2,
        Thermodynamics: 0.9,
        Equilibrium: 1.2,
        'Redox Reactions': 0.4,
        'p-Block (Groups 13-14)': 0.1,
        'General Organic Chemistry': 1.3,
        Hydrocarbons: 1.3,
        Solutions: 0.9,
        Electrochemistry: 1.1,
        'Chemical Kinetics': 1.3,
        'p-Block (Groups 15-18)': 0.9,
        'd & f Block Elements': 1.1,
        'Coordination Compounds': 1.4,
        'Haloalkanes & Haloarenes': 1.1,
        'Alcohols, Phenols & Ethers': 1.3,
        'Aldehydes, Ketones & Carboxylic Acids': 1.7,
        Amines: 1.1,
        Biomolecules: 0.7,
      },
      Biology: {
        'The Living World': 0.2,
        'Biological Classification': 0.7,
        'Plant Kingdom': 1.9,
        'Animal Kingdom': 1.9,
        'Morphology of Flowering Plants': 1.7,
        'Anatomy of Flowering Plants': 1.4,
        'Structural Organisation in Animals': 2.4,
        'Cell: The Unit of Life': 1.9,
        Biomolecules: 2.2,
        'Cell Cycle & Cell Division': 2.2,
        'Photosynthesis in Higher Plants': 1.6,
        'Respiration in Plants': 0.8,
        'Plant Growth & Development': 1.4,
        'Breathing & Exchange of Gases': 0.9,
        'Body Fluids & Circulation': 1.1,
        'Excretory Products & Elimination': 0.7,
        'Locomotion & Movement': 1.1,
        'Neural Control & Coordination': 0.4,
        'Chemical Coordination & Integration': 1.1,
        'Sexual Reproduction in Flowering Plants': 1.9,
        'Human Reproduction': 2.0,
        'Reproductive Health': 1.2,
        'Principles of Inheritance & Variation': 2.4,
        'Molecular Basis of Inheritance': 4.1,
        Evolution: 1.1,
        'Human Health & Disease': 1.8,
        'Microbes in Human Welfare': 0.8,
        'Biotechnology: Principles & Processes': 2.9,
        'Biotechnology & Its Applications': 2.1,
        'Organisms & Populations': 2.0,
        Ecosystem: 1.2,
        'Biodiversity & Conservation': 1.4,
      },
    },
  },
  jee_main: {
    questionCount: 75,
    subjects: {
      Physics: {
        'Units & Measurement': 1.4,
        Vectors: 0.5,
        'Motion in a Straight Line': 1.1,
        'Projectile Motion': 0.8,
        "Newton's Laws of Motion": 1.2,
        Friction: 0.4,
        'Circular Motion': 0.6,
        'Work, Power & Energy': 1.1,
        'Centre of Mass': 1.1,
        'Rotational Motion': 2.2,
        Gravitation: 1.6,
        'Oscillations (SHM)': 1.4,
        'Waves (String & Sound)': 1.1,
        'Kinetic Theory of Gases': 2.0,
        Thermodynamics: 1.7,
        Elasticity: 1.1,
        'Fluid Mechanics': 0.7,
        'Surface Tension & Viscosity': 0.9,
        'Electric Charges & Fields': 1.9,
        'Electrostatic Potential & Capacitance': 2.1,
        'Current Electricity': 3.3,
        'Moving Charges & Magnetism': 2.3,
        'Electromagnetic Induction': 1.4,
        'Alternating Current': 1.8,
        'Ray Optics & Optical Instruments': 1.9,
        'Wave Optics': 1.4,
        'Magnetism & Matter': 0.6,
        'Electromagnetic Waves': 1.3,
        'Nuclear Physics': 0.9,
        'Semiconductor Devices': 2.0,
        Atoms: 1.6,
        'Dual Nature of Matter & Radiation': 1.7,
        'Experimental Physics / Error Analysis': 1.0,
      },
      Chemistry: {
        'Some Basic Concepts of Chemistry': 1.9,
        'Structure of Atom': 1.7,
        'Classification of Elements & Periodicity': 1.3,
        'Chemical Bonding & Molecular Structure': 2.4,
        Thermodynamics: 1.9,
        'Chemical Equilibrium': 0.9,
        'Ionic Equilibrium': 1.0,
        'Redox Reactions': 0.8,
        'p-Block Elements (11th)': 0.7,
        'General Organic Chemistry + IUPAC + Isomerism': 2.6,
        Hydrocarbons: 1.1,
        'Practical Organic Chemistry': 1.3,
        Solutions: 2.1,
        Electrochemistry: 1.7,
        'Chemical Kinetics': 1.8,
        'p-Block Elements (12th)': 1.8,
        'd & f Block Elements': 2.5,
        'Coordination Compounds': 2.8,
        'Qualitative Analysis': 1.2,
        'Haloalkanes & Haloarenes': 1.4,
        'Alcohols, Phenols & Ethers': 0.9,
        'Aldehydes, Ketones & Carboxylic Acids': 1.6,
        Amines: 2.3,
        Biomolecules: 1.8,
        Polymers: 0.7,
      },
      Mathematics: {
        'Basic Mathematics & Logarithm': 0.2,
        'Trigonometric Ratios & Identities': 0.5,
        'Trigonometric Equations': 0.5,
        'Solution of Triangles': 0.2,
        'Quadratic Equations & Inequalities': 1.2,
        'Sequence & Series': 2.4,
        'Permutations & Combinations': 1.6,
        'Binomial Theorem': 2.1,
        'Complex Numbers': 1.6,
        'Straight Lines': 1.3,
        Circle: 1.3,
        Parabola: 1.0,
        Ellipse: 0.8,
        Hyperbola: 0.8,
        'Sets & Relations': 1.0,
        Statistics: 1.0,
        Functions: 1.3,
        'Inverse Trigonometric Functions': 1.0,
        Limits: 0.9,
        'Continuity & Differentiability': 1.1,
        'Methods of Differentiation': 0.5,
        'Application of Derivatives': 1.8,
        'Indefinite Integration': 0.5,
        'Definite Integration': 2.6,
        'Area Under Curve': 1.4,
        'Differential Equations': 2.2,
        Vectors: 2.2,
        'Three-Dimensional Geometry': 3.4,
        Matrices: 1.9,
        Determinants: 1.2,
        Probability: 1.9,
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Name matching                                                      */
/* ------------------------------------------------------------------ */

/** Lowercase, strip everything that is not a letter or a digit. */
export function normalizeChapterName(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The planner's own exam ids (zuno_profile.exam — see ../syllabus.ts) and the
 * structured syllabus ids (./syllabuses.ts) both resolve onto this dataset.
 * JEE Advanced shares JEE Main's weightage, as it does in ../weightage.ts.
 */
const EXAM_ID_ALIASES: Record<string, WeightExamId> = {
  neet: 'neet_ug',
  neetug: 'neet_ug',
  jee: 'jee_main',
  jeemain: 'jee_main',
  jeeadvanced: 'jee_main',
};

/** Resolve any of the app's exam ids onto a dataset we actually hold. */
export function resolveWeightExamId(examId: string | null | undefined): WeightExamId | null {
  const key = normalizeChapterName(examId);
  if (!key) return null;
  return EXAM_ID_ALIASES[key] ?? null;
}

/**
 * Some exams file the same chapters under different subject headings — the
 * structured NEET-UG syllabus splits biology into Botany and Zoology, while
 * this dataset keeps one Biology block. Only used to disambiguate chapter
 * names that appear in more than one subject.
 */
const SUBJECT_ALIASES: Record<WeightExamId, Record<string, string>> = {
  neet_ug: { botany: 'Biology', zoology: 'Biology', biology: 'Biology' },
  jee_main: { maths: 'Mathematics', math: 'Mathematics' },
};

/**
 * The planner's coarse chapter names (../syllabus.ts) mapped onto the NCERT
 * chapters they actually cover. A grouped chapter maps to SEVERAL keys and
 * takes their combined weight — the planner's "Atoms & Nuclei" really is worth
 * Atoms + Nuclei on the paper. Only consulted when an exact name match fails,
 * so a chapter the dataset already knows is never re-routed.
 */
const CHAPTER_ALIASES: Record<WeightExamId, Record<string, string[]>> = {
  neet_ug: {
    /* Physics */
    physicsmeasurement: ['Units & Dimensions'],
    unitsdimensionserrors: ['Units & Dimensions'],
    unitsmeasurement: ['Units & Dimensions'],
    kinematics: ['Motion in a Straight Line', 'Motion in a Plane'],
    rotationalmotion: ['System of Particles & Rotational Motion'],
    propertiesofsolidsliquids: [
      'Mechanical Properties of Solids',
      'Mechanical Properties of Fluids',
      'Thermal Properties of Matter',
    ],
    kinetictheoryofgases: ['Kinetic Theory'],
    oscillationswaves: ['Oscillations', 'Waves'],
    electrostatics: ['Electric Charges & Fields', 'Electrostatic Potential & Capacitance'],
    capacitance: ['Electrostatic Potential & Capacitance'],
    magneticeffectsofcurrentmagnetism: ['Moving Charges & Magnetism', 'Magnetism & Matter'],
    electromagneticinductionac: ['Electromagnetic Induction', 'Alternating Current'],
    optics: ['Ray Optics & Optical Instruments', 'Wave Optics'],
    rayoptics: ['Ray Optics & Optical Instruments'],
    dualnatureofmatterradiation: ['Dual Nature of Radiation & Matter'],
    atomsnuclei: ['Atoms', 'Nuclei'],
    electronicdevices: ['Semiconductor Electronics'],
    semiconductordevices: ['Semiconductor Electronics'],

    /* Chemistry */
    atomicstructure: ['Structure of Atom'],
    chemicalthermodynamics: ['Thermodynamics'],
    moleconceptstoichiometry: ['Some Basic Concepts of Chemistry'],
    classificationperiodicity: ['Classification of Elements & Periodicity'],
    chemicalequilibrium: ['Equilibrium'],
    ionicequilibrium: ['Equilibrium'],
    redoxreactionselectrochemistry: ['Redox Reactions', 'Electrochemistry'],
    pblockelements: ['p-Block (Groups 13-14)', 'p-Block (Groups 15-18)'],
    dfblockelements: ['d & f Block Elements'],
    aldehydesketones: ['Aldehydes, Ketones & Carboxylic Acids'],
    carboxylicacidsderivatives: ['Aldehydes, Ketones & Carboxylic Acids'],
    aminesdiazoniumsalts: ['Amines'],

    /* Biology */
    diversityinlivingworld: ['The Living World', 'Biological Classification', 'Plant Kingdom'],
    cellstructurefunction: ['Cell: The Unit of Life', 'Cell Cycle & Cell Division', 'Biomolecules'],
    cellthebasicunitoflife: ['Cell: The Unit of Life'],
    plantphysiology: [
      'Photosynthesis in Higher Plants',
      'Respiration in Plants',
      'Plant Growth & Development',
    ],
    biotechnology: ['Biotechnology: Principles & Processes', 'Biotechnology & Its Applications'],
    ecologyenvironment: ['Organisms & Populations', 'Ecosystem', 'Biodiversity & Conservation'],
    ecology: ['Organisms & Populations', 'Ecosystem', 'Biodiversity & Conservation'],
    genetics: ['Principles of Inheritance & Variation', 'Molecular Basis of Inheritance'],
  },
  jee_main: {
    /* Physics */
    unitsdimensionserrors: ['Units & Measurement'],
    physicsmeasurement: ['Units & Measurement'],
    kinematics: ['Motion in a Straight Line', 'Projectile Motion'],
    lawsofmotion: ["Newton's Laws of Motion", 'Friction', 'Circular Motion'],
    workenergypower: ['Work, Power & Energy'],
    centreofmassmomentumcollisions: ['Centre of Mass'],
    mechanicalpropertiesofsolids: ['Elasticity'],
    mechanicalpropertiesoffluids: ['Fluid Mechanics', 'Surface Tension & Viscosity'],
    propertiesofsolidsliquids: ['Elasticity', 'Fluid Mechanics', 'Surface Tension & Viscosity'],
    oscillations: ['Oscillations (SHM)'],
    oscillationswaves: ['Oscillations (SHM)', 'Waves (String & Sound)'],
    waves: ['Waves (String & Sound)'],
    kinetictheory: ['Kinetic Theory of Gases'],
    electrostatics: ['Electric Charges & Fields'],
    capacitance: ['Electrostatic Potential & Capacitance'],
    magneticeffectsofcurrentmagnetism: ['Moving Charges & Magnetism', 'Magnetism & Matter'],
    electromagneticinductionac: ['Electromagnetic Induction', 'Alternating Current'],
    rayoptics: ['Ray Optics & Optical Instruments'],
    optics: ['Ray Optics & Optical Instruments', 'Wave Optics'],
    nuclei: ['Nuclear Physics'],
    atomsnuclei: ['Atoms', 'Nuclear Physics'],
    dualnatureofradiationmatter: ['Dual Nature of Matter & Radiation'],
    semiconductorelectronics: ['Semiconductor Devices'],
    electronicdevices: ['Semiconductor Devices'],
    experimentalphysics: ['Experimental Physics / Error Analysis'],
    experimentalskills: ['Experimental Physics / Error Analysis'],

    /* Chemistry */
    moleconceptstoichiometry: ['Some Basic Concepts of Chemistry'],
    atomicstructure: ['Structure of Atom'],
    chemicalthermodynamics: ['Thermodynamics'],
    equilibrium: ['Chemical Equilibrium', 'Ionic Equilibrium'],
    classificationperiodicity: ['Classification of Elements & Periodicity'],
    pblockelements: ['p-Block Elements (11th)', 'p-Block Elements (12th)'],
    dfblockelements: ['d & f Block Elements'],
    purificationcharacterisationoforganiccompounds: ['Practical Organic Chemistry'],
    purificationcharacterisation: ['Practical Organic Chemistry'],
    generalorganicchemistry: ['General Organic Chemistry + IUPAC + Isomerism'],
    aldehydesketones: ['Aldehydes, Ketones & Carboxylic Acids'],
    carboxylicacidsderivatives: ['Aldehydes, Ketones & Carboxylic Acids'],
    aminesdiazoniumsalts: ['Amines'],
    polymerschemistryineverydaylife: ['Polymers'],
    practicalchemistry: ['Qualitative Analysis'],
    principlesrelatedtopracticalchemistry: ['Qualitative Analysis'],

    /* Mathematics */
    setsrelationsfunctions: ['Sets & Relations', 'Functions'],
    quadraticequations: ['Quadratic Equations & Inequalities'],
    matricesdeterminants: ['Matrices', 'Determinants'],
    sequencesseries: ['Sequence & Series'],
    trigonometry: [
      'Trigonometric Ratios & Identities',
      'Trigonometric Equations',
      'Solution of Triangles',
      'Inverse Trigonometric Functions',
    ],
    circles: ['Circle'],
    conicsections: ['Parabola', 'Ellipse', 'Hyperbola'],
    limitscontinuity: ['Limits', 'Continuity & Differentiability'],
    differentiability: ['Continuity & Differentiability', 'Methods of Differentiation'],
    applicationsofderivatives: ['Application of Derivatives'],
    definiteintegrationarea: ['Definite Integration', 'Area Under Curve'],
    threedimensionalgeometry: ['Three-Dimensional Geometry'],
  },
};

/* ------------------------------------------------------------------ */
/*  Lookup index (built once per exam, on first use)                   */
/* ------------------------------------------------------------------ */

interface WeightIndex {
  /** normalised chapter → normalised subject → percent. */
  bySubject: Map<string, Map<string, number>>;
  /** normalised chapter → the largest percent it carries in any subject. */
  best: Map<string, number>;
}

const INDEX_CACHE = new Map<WeightExamId, WeightIndex>();

function indexFor(examId: WeightExamId): WeightIndex {
  const cached = INDEX_CACHE.get(examId);
  if (cached) return cached;
  const bySubject = new Map<string, Map<string, number>>();
  const best = new Map<string, number>();
  for (const [subject, chapters] of Object.entries(SYLLABUS_WEIGHTS[examId].subjects)) {
    const subjectKey = normalizeChapterName(subject);
    for (const [chapter, percent] of Object.entries(chapters)) {
      const chapterKey = normalizeChapterName(chapter);
      const perSubject = bySubject.get(chapterKey) ?? new Map<string, number>();
      perSubject.set(subjectKey, percent);
      bySubject.set(chapterKey, perSubject);
      if (percent > (best.get(chapterKey) ?? 0)) best.set(chapterKey, percent);
    }
  }
  const index = { bySubject, best };
  INDEX_CACHE.set(examId, index);
  return index;
}

/**
 * The percent for one already-normalised chapter key. When a subject hint is
 * given and that subject carries the chapter, its own figure wins (NEET files
 * Thermodynamics in both Physics at 0.4 and Chemistry at 0.9); otherwise the
 * heavier of the two is used, so an ambiguous name is never under-ranked.
 */
function percentFor(index: WeightIndex, chapterKey: string, subjectKey: string): number | null {
  const perSubject = index.bySubject.get(chapterKey);
  if (!perSubject) return null;
  if (subjectKey) {
    const exact = perSubject.get(subjectKey);
    if (typeof exact === 'number') return exact;
  }
  return index.best.get(chapterKey) ?? null;
}

/** The longest dataset chapter name contained in (or containing) the query. */
function containmentMatch(index: WeightIndex, chapterKey: string, subjectKey: string): number | null {
  if (chapterKey.length < 6) return null;
  let bestKey = '';
  for (const key of index.bySubject.keys()) {
    if (key.length < 6 || key.length <= bestKey.length) continue;
    if (chapterKey.includes(key) || key.includes(chapterKey)) bestKey = key;
  }
  return bestKey ? percentFor(index, bestKey, subjectKey) : null;
}

/* ------------------------------------------------------------------ */
/*  Public lookup                                                      */
/* ------------------------------------------------------------------ */

/**
 * The weight (percent of the full paper) one chapter carries, matched
 * case- and punctuation-insensitively:
 *
 *   1. exact match on the normalised chapter name;
 *   2. the alias table — a planner chapter that groups several NCERT chapters
 *      takes their COMBINED weight;
 *   3. containment, for free text like "revise coordination compounds";
 *   4. FALLBACK_CHAPTER_WEIGHT, so nothing is ever dropped for being unknown.
 *
 * `subject` is an optional hint used only to disambiguate a chapter name that
 * two subjects share.
 */
export function getChapterWeight(
  examId: string | null | undefined,
  chapterName: string | null | undefined,
  subject?: string | null,
): number {
  const exam = resolveWeightExamId(examId);
  const chapterKey = normalizeChapterName(chapterName);
  if (!exam || !chapterKey) return FALLBACK_CHAPTER_WEIGHT;

  const index = indexFor(exam);
  const rawSubject = normalizeChapterName(subject);
  const subjectKey = SUBJECT_ALIASES[exam][rawSubject]
    ? normalizeChapterName(SUBJECT_ALIASES[exam][rawSubject])
    : rawSubject;

  const exact = percentFor(index, chapterKey, subjectKey);
  if (exact !== null) return exact;

  const aliased = CHAPTER_ALIASES[exam][chapterKey];
  if (aliased) {
    let total = 0;
    for (const candidate of aliased) {
      const percent = percentFor(index, normalizeChapterName(candidate), subjectKey);
      if (percent !== null) total += percent;
    }
    if (total > 0) return Math.round(total * 10) / 10;
  }

  const contained = containmentMatch(index, chapterKey, subjectKey);
  if (contained !== null) return contained;

  return FALLBACK_CHAPTER_WEIGHT;
}

/**
 * True when the dataset actually recognised the chapter — lets a caller say
 * "~2.4% of the paper" honestly, instead of quoting the equal-priority
 * fallback as if it were a real weightage figure.
 */
export function hasChapterWeight(
  examId: string | null | undefined,
  chapterName: string | null | undefined,
  subject?: string | null,
): boolean {
  const exam = resolveWeightExamId(examId);
  const chapterKey = normalizeChapterName(chapterName);
  if (!exam || !chapterKey) return false;
  const index = indexFor(exam);
  if (index.bySubject.has(chapterKey)) return true;
  if (CHAPTER_ALIASES[exam][chapterKey]?.some((c) => index.bySubject.has(normalizeChapterName(c)))) return true;
  const rawSubject = normalizeChapterName(subject);
  return containmentMatch(index, chapterKey, rawSubject) !== null;
}
