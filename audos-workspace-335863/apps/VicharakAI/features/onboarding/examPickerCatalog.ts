/**
 * Exam-picker catalogue — shapes the shared `vicharakai_exams` registry rows
 * into the two-section list onboarding's step 1 renders, and maps each
 * registry exam_id onto the planner catalogue (syllabus.ts EXAMS) where a
 * full local syllabus exists.
 *
 * 2026-09-29 (V2 Task 5): the picker moved OFF `exam_metadata` and onto the
 * `vicharakai_exams` registry, and is no longer India-only. The registry is
 * the product's own supported-exam list — 13 Indian exams plus MCAT, LSAT,
 * GRE, GMAT, UCAT, A-Levels and GAMSAT — so the list is grouped into exactly
 * two sections, "Indian exams" and "International exams", with popular exams
 * leading each. There is still no country SELECTOR and no region question
 * anywhere in onboarding.
 *
 * An exam without a planner entry rides the registry-sections path (its
 * subjects come from `vicharakai_exam_sections`), and only an exam the
 * registry cannot describe at all falls back to the typed-exam AI lookup.
 *
 * The FALLBACK list keeps the picker fully usable when the registry read
 * fails or returns empty — the picker must never render blank.
 */

export interface PickerExam {
  /** Stable `vicharakai_exams.id` — the contract with the shared tables. */
  examId: string;
  name: string;
  country: string;
  category: string;
  /** Registry-provided second line; absent on the hard-coded fallback list. */
  categoryLabel?: string | null;
  popular: boolean;
}

export interface PickerGroup {
  key: string;
  /** 'India' or 'International' — the two sections the picker renders. */
  country: string;
  label: string;
  exams: PickerExam[];
}

/** The high-traffic exams that carry the Popular badge. */
export const POPULAR_EXAM_IDS = new Set([
  'jee_main',
  'neet_ug',
  'upsc_cse',
  'cat',
  'ssc_cgl',
  'banking_ibps_po',
  'mcat',
]);

/**
 * Registry exam_id → planner catalogue id (syllabus.ts EXAMS). Ids not listed
 * here are tried against the planner catalogue directly (cat, clat, gre,
 * gmat, mcat, lsat, ucat, ctet… already match by name); an id with no planner
 * entry is built from its `vicharakai_exam_sections` rows instead.
 *
 * The `exam_metadata` aliases the picker used before the 2026-09-29 move are
 * kept so a profile saved by an older build still resolves.
 */
export const DB_TO_PLANNER: Record<string, string> = {
  jee_main: 'jee',
  jee_advanced: 'jee-advanced',
  neet_ug: 'neet',
  upsc_cse: 'upsc',
  ssc_cgl: 'ssc',
  banking_ibps_po: 'ibps-po',
  a_levels: 'a-levels',
  // legacy exam_metadata ids
  ibps_po: 'ibps-po',
  uk_a_levels: 'a-levels',
  mcat_ca: 'mcat',
  lsat_ca: 'lsat',
  lsat_india: 'lsat',
};

/** India leads — it is the product's primary market. */
const COUNTRY_ORDER = ['India', 'USA', 'US', 'UK', 'Australia', 'Canada'];

/** Within a section, the order the categories appear in. */
const CATEGORY_ORDER = [
  'medical',
  'engineering',
  'civil_services',
  'management',
  'law',
  'banking',
  'ssc',
  'railway',
  'defence',
  'teaching',
  'grad',
  'school',
  'other',
];

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  engineering: 'Engineering',
  civil_services: 'Civil Services',
  management: 'Management',
  law: 'Law',
  banking: 'Banking',
  ssc: 'Government',
  railway: 'Railways',
  defence: 'Defence',
  teaching: 'Teaching',
  grad: 'Grad School',
  school: 'School',
  other: 'Other',
};

/**
 * Legacy fallback for rows whose registry category is still null. New seed
 * rows should carry `category` in `vicharakai_exams` instead.
 */
export const EXAM_CATEGORY_BY_ID: Record<string, string> = {
  neet_ug: 'medical',
  neet_pg: 'medical',
  inicet: 'medical',
  jee_main: 'engineering',
  jee_advanced: 'engineering',
  upsc_cse: 'civil_services',
  mpsc: 'civil_services',
  cat: 'management',
  clat: 'law',
  ssc_cgl: 'ssc',
  rrb_ntpc: 'railway',
  banking_ibps_po: 'banking',
  ctet: 'teaching',
  mcat: 'medical',
  ucat: 'medical',
  gamsat: 'medical',
  lsat: 'law',
  gre: 'grad',
  gmat: 'grad',
  a_levels: 'school',
};

/**
 * Hard-coded safety net — the full registry as it stands, used whenever the
 * `vicharakai_exams` read fails or returns no rows. The picker must NEVER
 * show a clipped list.
 */
export const FALLBACK_EXAMS: PickerExam[] = [
  { examId: 'neet_ug', name: 'NEET UG', country: 'India', category: 'medical', popular: true },
  { examId: 'jee_main', name: 'JEE Main', country: 'India', category: 'engineering', popular: true },
  { examId: 'jee_advanced', name: 'JEE Advanced', country: 'India', category: 'engineering', popular: false },
  { examId: 'neet_pg', name: 'NEET PG', country: 'India', category: 'medical', popular: false },
  { examId: 'inicet', name: 'INI-CET', country: 'India', category: 'medical', popular: false },
  { examId: 'upsc_cse', name: 'UPSC CSE', country: 'India', category: 'civil_services', popular: true },
  { examId: 'mpsc', name: 'MPSC', country: 'India', category: 'civil_services', popular: false },
  { examId: 'cat', name: 'CAT', country: 'India', category: 'management', popular: true },
  { examId: 'clat', name: 'CLAT', country: 'India', category: 'law', popular: false },
  { examId: 'ssc_cgl', name: 'SSC CGL', country: 'India', category: 'ssc', popular: true },
  { examId: 'rrb_ntpc', name: 'RRB NTPC', country: 'India', category: 'railway', popular: false },
  { examId: 'banking_ibps_po', name: 'IBPS PO', country: 'India', category: 'banking', popular: true },
  { examId: 'ctet', name: 'CTET', country: 'India', category: 'teaching', popular: false },
  { examId: 'mcat', name: 'MCAT', country: 'USA', category: 'medical', popular: true },
  { examId: 'lsat', name: 'LSAT', country: 'USA', category: 'law', popular: false },
  { examId: 'gre', name: 'GRE', country: 'USA', category: 'grad', popular: false },
  { examId: 'gmat', name: 'GMAT', country: 'USA', category: 'grad', popular: false },
  { examId: 'ucat', name: 'UCAT', country: 'UK', category: 'medical', popular: false },
  { examId: 'a_levels', name: 'A-Levels', country: 'UK', category: 'school', popular: false },
  { examId: 'gamsat', name: 'GAMSAT', country: 'Australia', category: 'medical', popular: false },
];

/**
 * Legacy fallback for rows whose registry `category_label` is still null.
 * These values preserve the existing card copy during rollout and for older
 * saved payloads; newly seeded exams should carry their label in the table.
 */
const EXAM_CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  neet_ug: 'Medical UG',
  neet_pg: 'Medical PG',
  inicet: 'Medical PG',
  jee_main: 'Engineering',
  jee_advanced: 'Engineering',
  upsc_cse: 'Civil Services',
  mpsc: 'Civil Services · Maharashtra',
  cat: 'MBA',
  clat: 'Law',
  ssc_cgl: 'Government',
  rrb_ntpc: 'Railways',
  banking_ibps_po: 'Banking',
  ctet: 'Teaching',
  mcat: 'Medical · US & Canada',
  ucat: 'Medical · UK & Australia',
  gamsat: 'Medical · Australia, UK & Ireland',
  lsat: 'Law · US & Canada',
  gre: 'Grad school',
  gmat: 'Business school',
  a_levels: 'School · UK & international',
  // legacy exam_metadata ids, so an older saved pick still reads correctly
  ibps_po: 'Banking',
  uk_a_levels: 'School · UK & international',
};

/** The category line one picker card shows under the exam name. */
export function pickerCategoryLabel(entry: PickerExam): string {
  const registryLabel = String(entry.categoryLabel || '').trim();
  return registryLabel || EXAM_CATEGORY_LABEL_OVERRIDES[entry.examId] || categoryLabel(entry.category);
}

function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

function countryRank(country: string): number {
  const index = COUNTRY_ORDER.indexOf(country);
  return index === -1 ? COUNTRY_ORDER.length : index;
}

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

/**
 * Two ordered sections — "Indian exams" then "International exams". Inside a
 * section the popular exams lead, then medical → engineering → civil services
 * → …, then alphabetically. Deliberately NOT one section per category: the
 * whole registry is twenty exams, and thirteen sticky headers over a
 * twenty-item list is scrolling furniture, not navigation.
 */
export function groupPickerExams(entries: PickerExam[]): PickerGroup[] {
  const india: PickerExam[] = [];
  const international: PickerExam[] = [];
  for (const entry of entries) {
    (entry.country === 'India' ? india : international).push(entry);
  }
  const order = (list: PickerExam[]) =>
    list.sort((a, b) => {
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      const byCountry = countryRank(a.country) - countryRank(b.country);
      if (byCountry !== 0 && a.country !== 'India') return byCountry;
      const byCategory = categoryRank(a.category) - categoryRank(b.category);
      if (byCategory !== 0) return byCategory;
      return a.name.localeCompare(b.name);
    });
  const groups: PickerGroup[] = [];
  if (india.length > 0) {
    groups.push({ key: 'india', country: 'India', label: 'Indian exams', exams: order(india) });
  }
  if (international.length > 0) {
    groups.push({
      key: 'international',
      country: 'International',
      label: 'International exams',
      exams: order(international),
    });
  }
  return groups;
}

/** Case-insensitive picker search over name, id, country and category. */
export function filterPickerExams(entries: PickerExam[], query: string): PickerExam[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.examId.toLowerCase().includes(q) ||
      entry.country.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q) ||
      pickerCategoryLabel(entry).toLowerCase().includes(q),
  );
}
