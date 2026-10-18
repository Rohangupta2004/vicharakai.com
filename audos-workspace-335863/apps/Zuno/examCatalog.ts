/**
 * Expanded exam catalogue (CHANGE 11) — popular exams from India, the USA,
 * the UK and neighbouring countries. Each entry carries a country, a category
 * (Medical / Engineering / Law / Business / Government / General) and a
 * starter subject list, so onboarding can search and filter the whole set.
 *
 * JEE and NEET keep their full granular syllabi in syllabus.ts — the exams
 * here ship a lighter chapter/topic structure that students grow as they
 * study (and "Type your exam" still covers anything missing entirely).
 */
import type { ExamDef, ExamSubject } from './syllabus';

const subj = (name: string, chapters: Array<[string, string[]]>): ExamSubject => ({
  name,
  chapters: chapters.map(([chapterName, topics]) => ({ name: chapterName, topics })),
});

export const EXTRA_EXAMS: ExamDef[] = [
  /* ---------------- India ---------------- */
  {
    id: 'gate',
    name: 'GATE',
    fullName: 'GATE — Graduate Aptitude Test in Engineering',
    blurb: 'PG engineering & PSU recruitment — aptitude + your core discipline',
    target: { label: 'GATE', month: 2, day: 1 },
    country: 'India',
    category: 'Engineering',
    subjects: [
      subj('Engineering Mathematics', [
        ['Core topics', ['Linear algebra', 'Calculus', 'Differential equations', 'Probability and statistics', 'Numerical methods']],
      ]),
      subj('General Aptitude', [
        ['Core topics', ['Verbal ability', 'Numerical ability', 'Analytical aptitude', 'Spatial aptitude']],
      ]),
      subj('Core Discipline', [
        ['Core topics', ['Branch fundamentals', 'Subject-wise revision of your paper', 'Previous-year GATE problems', 'Full-length mock tests']],
      ]),
    ],
  },
  {
    id: 'clat',
    name: 'CLAT',
    fullName: 'CLAT — Common Law Admission Test',
    blurb: 'National law university entrance — English, GK, legal & logical reasoning',
    target: { label: 'CLAT', month: 12, day: 7 },
    country: 'India',
    category: 'Law',
    subjects: [
      subj('English Language', [
        ['Core topics', ['Reading comprehension', 'Vocabulary in context', 'Grammar and usage', 'Inference and tone']],
      ]),
      subj('Current Affairs & GK', [
        ['Core topics', ['National current affairs', 'International affairs', 'Static GK', 'Arts and culture', 'Awards and sports']],
      ]),
      subj('Legal Reasoning', [
        ['Core topics', ['Legal principles and fact application', 'Law of torts basics', 'Contract law basics', 'Constitutional law basics', 'Criminal law basics']],
      ]),
      subj('Logical Reasoning', [
        ['Core topics', ['Arguments and assumptions', 'Strengthen and weaken', 'Syllogisms', 'Analogies and sequences']],
      ]),
      subj('Quantitative Techniques', [
        ['Core topics', ['Percentages and ratios', 'Averages', 'Data interpretation sets', 'Basic algebra and mensuration']],
      ]),
    ],
  },
  {
    id: 'nda',
    name: 'NDA',
    fullName: 'NDA — National Defence Academy Examination',
    blurb: 'Defence services entrance — Mathematics + General Ability',
    target: { label: 'NDA I', month: 4, day: 13 },
    country: 'India',
    category: 'Government',
    subjects: [
      subj('Mathematics', [
        ['Core topics', ['Algebra', 'Trigonometry', 'Analytical geometry', 'Differential and integral calculus', 'Vector algebra', 'Statistics and probability']],
      ]),
      subj('English', [
        ['Core topics', ['Grammar and usage', 'Vocabulary', 'Comprehension', 'Sentence arrangement']],
      ]),
      subj('General Knowledge', [
        ['Core topics', ['Physics', 'Chemistry', 'General science', 'History and the freedom movement', 'Geography', 'Current events']],
      ]),
    ],
  },
  {
    id: 'ibps-po',
    name: 'IBPS PO',
    fullName: 'IBPS PO — Probationary Officer',
    blurb: 'Public-sector bank officer recruitment — quant, reasoning, English & banking',
    target: { label: 'IBPS PO Prelims', month: 10, day: 11 },
    country: 'India',
    category: 'Government',
    subjects: [
      subj('English Language', [
        ['Core topics', ['Reading comprehension', 'Cloze test', 'Error spotting', 'Para jumbles', 'Fillers']],
      ]),
      subj('Quantitative Aptitude', [
        ['Core topics', ['Simplification and approximation', 'Number series', 'Data interpretation', 'Arithmetic word problems', 'Quadratic comparisons']],
      ]),
      subj('Reasoning Ability', [
        ['Core topics', ['Puzzles and seating arrangement', 'Syllogisms', 'Inequalities', 'Blood relations and directions', 'Input-output']],
      ]),
      subj('General & Banking Awareness', [
        ['Core topics', ['Banking and financial awareness', 'RBI and monetary policy', 'Current affairs', 'Static GK']],
      ]),
      subj('Computer Aptitude', [
        ['Core topics', ['Computer fundamentals', 'MS Office basics', 'Internet and networking', 'Security basics']],
      ]),
    ],
  },

  /* ---------------- USA ---------------- */
  {
    id: 'sat',
    name: 'SAT',
    fullName: 'SAT — Scholastic Assessment Test',
    blurb: 'US college admissions — Reading & Writing + Math',
    target: { label: 'SAT', month: 10, day: 4 },
    country: 'USA',
    category: 'General',
    subjects: [
      subj('Reading & Writing', [
        ['Core topics', ['Craft and structure', 'Information and ideas', 'Standard English conventions', 'Expression of ideas']],
      ]),
      subj('Math', [
        ['Core topics', ['Algebra', 'Advanced math', 'Problem solving and data analysis', 'Geometry and trigonometry']],
      ]),
    ],
  },
  {
    id: 'act',
    name: 'ACT',
    fullName: 'ACT — American College Testing',
    blurb: 'US college admissions — English, Math, Reading & Science',
    target: { label: 'ACT', month: 9, day: 13 },
    country: 'USA',
    category: 'General',
    subjects: [
      subj('English', [
        ['Core topics', ['Usage and mechanics', 'Rhetorical skills', 'Punctuation and sentence structure']],
      ]),
      subj('Math', [
        ['Core topics', ['Pre-algebra and elementary algebra', 'Intermediate algebra and coordinate geometry', 'Plane geometry and trigonometry']],
      ]),
      subj('Reading', [
        ['Core topics', ['Prose fiction passages', 'Social science passages', 'Humanities passages', 'Natural science passages']],
      ]),
      subj('Science', [
        ['Core topics', ['Data representation', 'Research summaries', 'Conflicting viewpoints']],
      ]),
    ],
  },
  {
    id: 'gre',
    name: 'GRE',
    fullName: 'GRE — Graduate Record Examination',
    blurb: 'Graduate school admissions — verbal, quant & analytical writing',
    target: { label: 'GRE', month: 12, day: 15 },
    country: 'USA',
    category: 'General',
    subjects: [
      subj('Verbal Reasoning', [
        ['Core topics', ['Text completion', 'Sentence equivalence', 'Reading comprehension', 'High-frequency vocabulary']],
      ]),
      subj('Quantitative Reasoning', [
        ['Core topics', ['Arithmetic', 'Algebra', 'Geometry', 'Data analysis', 'Quantitative comparisons']],
      ]),
      subj('Analytical Writing', [
        ['Core topics', ['Analyse an issue essay', 'Argument structure and evidence', 'Timed essay practice']],
      ]),
    ],
  },
  {
    id: 'gmat',
    name: 'GMAT',
    fullName: 'GMAT — Graduate Management Admission Test',
    blurb: 'Business school admissions — quant, verbal & data insights',
    target: { label: 'GMAT', month: 11, day: 15 },
    country: 'USA',
    category: 'Business',
    subjects: [
      subj('Quantitative Reasoning', [
        ['Core topics', ['Arithmetic and number properties', 'Algebra', 'Word problems', 'Rates, ratios and percents']],
      ]),
      subj('Verbal Reasoning', [
        ['Core topics', ['Critical reasoning', 'Reading comprehension', 'Argument evaluation']],
      ]),
      subj('Data Insights', [
        ['Core topics', ['Data sufficiency', 'Multi-source reasoning', 'Graphics interpretation', 'Table analysis', 'Two-part analysis']],
      ]),
    ],
  },
  {
    id: 'mcat',
    name: 'MCAT',
    fullName: 'MCAT — Medical College Admission Test',
    blurb: 'US/Canada medical school entrance — sciences + critical analysis',
    target: { label: 'MCAT', month: 6, day: 14 },
    country: 'USA',
    category: 'Medical',
    subjects: [
      subj('Chemical & Physical Foundations', [
        ['Core topics', ['General chemistry', 'Physics for biological systems', 'Organic chemistry essentials', 'Biochemistry overlap']],
      ]),
      subj('CARS', [
        ['Core topics', ['Reading comprehension', 'Reasoning within the text', 'Reasoning beyond the text']],
      ]),
      subj('Biological & Biochemical Foundations', [
        ['Core topics', ['Cell and molecular biology', 'Biochemistry pathways', 'Organ systems', 'Genetics']],
      ]),
      subj('Psychological & Social Foundations', [
        ['Core topics', ['Psychology fundamentals', 'Sociology fundamentals', 'Behavioural research methods']],
      ]),
    ],
  },
  {
    id: 'lsat',
    name: 'LSAT',
    fullName: 'LSAT — Law School Admission Test',
    blurb: 'US/Canada law school entrance — logic, reading & writing',
    target: { label: 'LSAT', month: 11, day: 8 },
    country: 'USA',
    category: 'Law',
    subjects: [
      subj('Logical Reasoning', [
        ['Core topics', ['Assumptions', 'Flaws in arguments', 'Strengthen and weaken', 'Inference questions', 'Parallel reasoning']],
      ]),
      subj('Analytical Reasoning', [
        ['Core topics', ['Ordering games', 'Grouping games', 'Hybrid games', 'Rule substitution']],
      ]),
      subj('Reading Comprehension', [
        ['Core topics', ['Law and humanities passages', 'Science passages', 'Comparative reading sets']],
      ]),
      subj('Writing', [
        ['Core topics', ['Decision-prompt essays', 'Structuring a persuasive argument']],
      ]),
    ],
  },
  {
    id: 'usmle',
    name: 'USMLE',
    fullName: 'USMLE — United States Medical Licensing Examination',
    blurb: 'US medical licensing — Step 1 foundations of medicine',
    target: { label: 'USMLE Step 1', month: 6, day: 30 },
    country: 'USA',
    category: 'Medical',
    subjects: [
      subj('Anatomy & Physiology', [
        ['Core topics', ['Gross anatomy', 'Neuroanatomy', 'Organ-system physiology', 'Embryology']],
      ]),
      subj('Biochemistry & Genetics', [
        ['Core topics', ['Metabolic pathways', 'Molecular biology', 'Medical genetics', 'Nutrition']],
      ]),
      subj('Pathology', [
        ['Core topics', ['General pathology', 'Systemic pathology', 'Neoplasia', 'Inflammation and repair']],
      ]),
      subj('Pharmacology', [
        ['Core topics', ['Pharmacokinetics and dynamics', 'Autonomic drugs', 'Antimicrobials', 'Drug side effects and toxicity']],
      ]),
      subj('Microbiology & Immunology', [
        ['Core topics', ['Bacteriology', 'Virology', 'Mycology and parasitology', 'Immune mechanisms']],
      ]),
      subj('Behavioural Science & Biostatistics', [
        ['Core topics', ['Biostatistics and epidemiology', 'Ethics and communication', 'Psychiatry basics']],
      ]),
    ],
  },
  {
    id: 'ap-exams',
    name: 'AP Exams',
    fullName: 'AP — Advanced Placement Examinations',
    blurb: 'US college-credit exams — pick your AP subjects and go deep',
    target: { label: 'AP Exams', month: 5, day: 5 },
    country: 'USA',
    category: 'General',
    subjects: [
      subj('AP Calculus', [
        ['Core topics', ['Limits and continuity', 'Differentiation', 'Integration and accumulation', 'Series (BC)']],
      ]),
      subj('AP Physics', [
        ['Core topics', ['Kinematics and dynamics', 'Energy and momentum', 'Electricity and magnetism', 'Waves and modern physics']],
      ]),
      subj('AP Chemistry', [
        ['Core topics', ['Atomic structure and bonding', 'Thermodynamics and kinetics', 'Equilibrium', 'Acids and bases']],
      ]),
      subj('AP Biology', [
        ['Core topics', ['Cell biology', 'Genetics and information transfer', 'Evolution', 'Ecology']],
      ]),
      subj('AP English', [
        ['Core topics', ['Rhetorical analysis', 'Argument essays', 'Literary analysis', 'Synthesis essays']],
      ]),
    ],
  },
  {
    id: 'psat',
    name: 'PSAT',
    fullName: 'PSAT/NMSQT — Preliminary SAT',
    blurb: 'SAT practice + National Merit qualification — Reading & Writing + Math',
    target: { label: 'PSAT', month: 10, day: 15 },
    country: 'USA',
    category: 'General',
    subjects: [
      subj('Reading & Writing', [
        ['Core topics', ['Craft and structure', 'Information and ideas', 'Standard English conventions', 'Expression of ideas']],
      ]),
      subj('Math', [
        ['Core topics', ['Algebra', 'Advanced math', 'Problem solving and data analysis', 'Geometry and trigonometry']],
      ]),
    ],
  },

  /* ---------------- UK ---------------- */
  {
    id: 'a-levels',
    name: 'A-Levels',
    fullName: 'GCE A-Levels (UK)',
    blurb: 'UK sixth-form qualifications — your chosen A-Level subjects',
    target: { label: 'A-Level exams', month: 6, day: 1 },
    country: 'UK',
    category: 'General',
    subjects: [
      subj('Mathematics', [
        ['Core topics', ['Pure mathematics', 'Statistics', 'Mechanics']],
      ]),
      subj('Physics', [
        ['Core topics', ['Mechanics and materials', 'Electricity', 'Waves and particles', 'Fields and further mechanics']],
      ]),
      subj('Chemistry', [
        ['Core topics', ['Physical chemistry', 'Inorganic chemistry', 'Organic chemistry', 'Practical skills']],
      ]),
      subj('Biology', [
        ['Core topics', ['Cells and biological molecules', 'Genetics and evolution', 'Energy transfers', 'Organisms and ecosystems']],
      ]),
      subj('English Literature', [
        ['Core topics', ['Poetry analysis', 'Prose study', 'Drama and Shakespeare', 'Unseen texts']],
      ]),
    ],
  },
  {
    id: 'gcse',
    name: 'GCSE',
    fullName: 'GCSE (UK)',
    blurb: 'UK secondary qualifications — core GCSE subjects',
    target: { label: 'GCSE exams', month: 5, day: 15 },
    country: 'UK',
    category: 'General',
    subjects: [
      subj('Mathematics', [
        ['Core topics', ['Number', 'Algebra', 'Ratio and proportion', 'Geometry and measures', 'Probability and statistics']],
      ]),
      subj('English Language', [
        ['Core topics', ['Reading fiction and non-fiction', 'Descriptive and narrative writing', 'Language analysis']],
      ]),
      subj('Combined Science', [
        ['Core topics', ['Biology topics', 'Chemistry topics', 'Physics topics', 'Required practicals']],
      ]),
      subj('History', [
        ['Core topics', ['Period studies', 'Thematic study', 'Depth studies', 'Source analysis']],
      ]),
      subj('Geography', [
        ['Core topics', ['Physical geography', 'Human geography', 'Fieldwork skills']],
      ]),
    ],
  },
  {
    id: 'ucat',
    name: 'UCAT',
    fullName: 'UCAT — University Clinical Aptitude Test',
    blurb: 'UK medical & dental school aptitude test',
    target: { label: 'UCAT', month: 9, day: 25 },
    country: 'UK',
    category: 'Medical',
    subjects: [
      subj('Verbal Reasoning', [
        ['Core topics', ['Passage speed reading', 'True / false / cannot tell', 'Inference questions']],
      ]),
      subj('Decision Making', [
        ['Core topics', ['Syllogisms', 'Probability reasoning', 'Venn diagrams', 'Evaluating arguments']],
      ]),
      subj('Quantitative Reasoning', [
        ['Core topics', ['Percentages and ratios', 'Rates and proportions', 'Data extraction from charts']],
      ]),
      subj('Situational Judgement', [
        ['Core topics', ['Appropriateness scenarios', 'Importance scenarios', 'Medical ethics principles']],
      ]),
    ],
  },
  {
    id: 'bmat',
    name: 'BMAT',
    fullName: 'BMAT — BioMedical Admissions Test',
    blurb: 'Biomedical admissions aptitude — thinking skills, science & writing',
    target: { label: 'BMAT', month: 10, day: 18 },
    country: 'UK',
    category: 'Medical',
    subjects: [
      subj('Thinking Skills', [
        ['Core topics', ['Problem solving', 'Critical thinking', 'Argument analysis']],
      ]),
      subj('Scientific Knowledge & Applications', [
        ['Core topics', ['Biology', 'Chemistry', 'Physics', 'Mathematics']],
      ]),
      subj('Writing Task', [
        ['Core topics', ['Essay planning', 'Constructing a balanced argument', 'Concise scientific writing']],
      ]),
    ],
  },
  {
    id: 'lnat',
    name: 'LNAT',
    fullName: 'LNAT — National Admissions Test for Law',
    blurb: 'UK law school aptitude — comprehension + essay',
    target: { label: 'LNAT', month: 1, day: 20 },
    country: 'UK',
    category: 'Law',
    subjects: [
      subj('Verbal Reasoning', [
        ['Core topics', ['Comprehension passages', 'Argument identification', 'Inference and interpretation']],
      ]),
      subj('Essay', [
        ['Core topics', ['Essay planning', 'Balanced argument writing', 'Current issues awareness']],
      ]),
    ],
  },

  /* ---------------- Neighbouring countries ---------------- */
  {
    id: 'mdcat',
    name: 'MDCAT',
    fullName: 'MDCAT — Medical & Dental College Admission Test (Pakistan)',
    blurb: 'Pakistan medical & dental entrance — biology-led sciences',
    target: { label: 'MDCAT', month: 9, day: 21 },
    country: 'Pakistan',
    category: 'Medical',
    subjects: [
      subj('Biology', [
        ['Core topics', ['Cell biology', 'Human physiology', 'Genetics', 'Biodiversity', 'Bioenergetics']],
      ]),
      subj('Chemistry', [
        ['Core topics', ['Physical chemistry', 'Inorganic chemistry', 'Organic chemistry']],
      ]),
      subj('Physics', [
        ['Core topics', ['Mechanics', 'Waves and oscillations', 'Electricity and magnetism', 'Modern physics']],
      ]),
      subj('English', [
        ['Core topics', ['Grammar and usage', 'Vocabulary', 'Comprehension']],
      ]),
      subj('Logical Reasoning', [
        ['Core topics', ['Critical thinking', 'Series and patterns', 'Cause and effect']],
      ]),
    ],
  },
  {
    id: 'hsc-bd',
    name: 'HSC',
    fullName: 'HSC — Higher Secondary Certificate (Bangladesh)',
    blurb: 'Bangladesh higher secondary board exams — science stream core',
    target: { label: 'HSC', month: 6, day: 26 },
    country: 'Bangladesh',
    category: 'General',
    subjects: [
      subj('Physics', [
        ['Core topics', ['Mechanics', 'Heat and thermodynamics', 'Electricity and magnetism', 'Modern physics']],
      ]),
      subj('Chemistry', [
        ['Core topics', ['Physical chemistry', 'Inorganic chemistry', 'Organic chemistry']],
      ]),
      subj('Biology', [
        ['Core topics', ['Botany', 'Zoology', 'Human physiology']],
      ]),
      subj('Higher Mathematics', [
        ['Core topics', ['Algebra and trigonometry', 'Calculus', 'Coordinate geometry', 'Statistics']],
      ]),
      subj('English', [
        ['Core topics', ['Reading comprehension', 'Grammar', 'Writing skills']],
      ]),
    ],
  },
  {
    id: 'al-lk',
    name: 'A/L',
    fullName: 'GCE Advanced Level (Sri Lanka)',
    blurb: 'Sri Lanka university entrance — science stream A/L subjects',
    target: { label: 'A/L', month: 11, day: 24 },
    country: 'Sri Lanka',
    category: 'General',
    subjects: [
      subj('Combined Mathematics', [
        ['Core topics', ['Pure mathematics', 'Applied mathematics', 'Statics and dynamics']],
      ]),
      subj('Physics', [
        ['Core topics', ['Mechanics', 'Waves', 'Electricity', 'Matter and modern physics']],
      ]),
      subj('Chemistry', [
        ['Core topics', ['Physical chemistry', 'Inorganic chemistry', 'Organic chemistry']],
      ]),
      subj('Biology', [
        ['Core topics', ['Cell and molecular biology', 'Plant biology', 'Animal physiology', 'Ecology']],
      ]),
      subj('General English', [
        ['Core topics', ['Comprehension', 'Grammar', 'Writing']],
      ]),
    ],
  },
  {
    id: 'see-np',
    name: 'SEE',
    fullName: 'SEE — Secondary Education Examination (Nepal)',
    blurb: 'Nepal grade-10 board exams — the core compulsory subjects',
    target: { label: 'SEE', month: 3, day: 20 },
    country: 'Nepal',
    category: 'General',
    subjects: [
      subj('Compulsory Mathematics', [
        ['Core topics', ['Arithmetic', 'Algebra', 'Geometry', 'Statistics and probability']],
      ]),
      subj('Science', [
        ['Core topics', ['Physics topics', 'Chemistry topics', 'Biology topics', 'Astronomy and environment']],
      ]),
      subj('English', [
        ['Core topics', ['Reading comprehension', 'Grammar', 'Free writing']],
      ]),
      subj('Nepali', [
        ['Core topics', ['Literature', 'Grammar', 'Composition']],
      ]),
      subj('Social Studies', [
        ['Core topics', ['Civics', 'History', 'Geography', 'Economics basics']],
      ]),
    ],
  },
  {
    id: 'gaokao',
    name: 'Gaokao',
    fullName: 'Gaokao — National College Entrance Examination (China)',
    blurb: 'China university entrance — Chinese, Maths, English + track subjects',
    target: { label: 'Gaokao', month: 6, day: 7 },
    country: 'China',
    category: 'General',
    subjects: [
      subj('Chinese', [
        ['Core topics', ['Modern reading', 'Classical Chinese', 'Composition', 'Language usage']],
      ]),
      subj('Mathematics', [
        ['Core topics', ['Functions and derivatives', 'Trigonometry and vectors', 'Sequences', 'Solid and analytic geometry', 'Probability and statistics']],
      ]),
      subj('English', [
        ['Core topics', ['Reading comprehension', 'Cloze test', 'Grammar filling', 'Writing']],
      ]),
      subj('Science Track', [
        ['Core topics', ['Physics', 'Chemistry', 'Biology']],
      ]),
      subj('Humanities Track', [
        ['Core topics', ['History', 'Geography', 'Politics']],
      ]),
    ],
  },
  {
    id: 'csat-kr',
    name: 'CSAT',
    fullName: 'CSAT (Suneung) — College Scholastic Ability Test (South Korea)',
    blurb: 'South Korea university entrance — Korean, Maths, English + inquiry',
    target: { label: 'CSAT', month: 11, day: 13 },
    country: 'South Korea',
    category: 'General',
    subjects: [
      subj('Korean Language', [
        ['Core topics', ['Reading', 'Literature', 'Speech and writing', 'Language and media']],
      ]),
      subj('Mathematics', [
        ['Core topics', ['Calculus', 'Probability and statistics', 'Geometry', 'Functions and sequences']],
      ]),
      subj('English', [
        ['Core topics', ['Listening comprehension', 'Reading comprehension', 'Grammar and vocabulary']],
      ]),
      subj('Inquiry (Science / Social)', [
        ['Core topics', ['Elective science subjects', 'Elective social-studies subjects']],
      ]),
      subj('Korean History', [
        ['Core topics', ['Pre-modern history', 'Modern and contemporary history']],
      ]),
    ],
  },
];
