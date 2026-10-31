export interface ExamSubject {
  slug: string; name: string; description: string; keyTopics: string[]; relatedArticleSlugs?: string[];
}
export interface ExamData {
  slug: string; name: string; shortName: string; fullForm: string; tagline: string; metaDescription: string;
  studentsPerYear: string; examMonths: string; difficulty: string; subjects: ExamSubject[];
  faqs: Array<{ q: string; a: string }>; heroStats: Array<{ label: string; value: string }>;
  relatedArticleSlugs: string[];
}

type ExamSeed = Omit<ExamData, 'faqs' | 'heroStats'>;
const S = (slug: string, name: string, topics: string[], description?: string): ExamSubject => ({
  slug, name, keyTopics: topics,
  description: description || `${name} rewards clear concepts, active recall and repeated practice under exam conditions.`,
});
const E = (seed: ExamSeed): ExamData => ({
  ...seed,
  heroStats: [
    { label: 'Subjects', value: String(seed.subjects.length) },
    { label: 'Exam window', value: seed.examMonths },
    { label: 'Competition', value: seed.difficulty },
  ],
  faqs: [
    { q: `How early should I start preparing for ${seed.shortName}?`, a: `Start early enough to complete one careful syllabus pass and at least two revision cycles. Your exact runway depends on your present level and daily study time, so begin with a diagnostic paper rather than copying another student's calendar.` },
    { q: `How should I divide time across ${seed.shortName} subjects?`, a: `Use recent topic-level accuracy to allocate time. Protect regular contact with every subject, then give extra blocks to high-weightage areas where your accuracy is below your usual level.` },
    { q: `When should I begin mock tests for ${seed.shortName}?`, a: `Begin sectional tests while learning and full-pattern mocks once most of the syllabus has had a first pass. Every mock should be followed by error classification, targeted repair and a later retest.` },
    { q: `Are previous-year papers enough for ${seed.shortName}?`, a: `They are essential for understanding recurring themes and question style, but they are not a substitute for concepts, revision and timed mixed practice. Use them as both a learning resource and a final benchmark.` },
    { q: `How often should I revise for ${seed.shortName}?`, a: `Review new material within a day, then widen the gaps as recall improves. Active recall and questions are more useful than repeated reading; weak topics should return sooner than secure ones.` },
    { q: `What should I do after a poor ${seed.shortName} mock?`, a: `Separate concept gaps, application gaps, careless errors and time losses. Fix each category differently, then verify the repair with fresh questions instead of judging progress from one score.` },
  ],
});

export const EXAM_DATA: ExamData[] = [
E({ slug:'jee', name:'JEE Main', shortName:'JEE Main', fullForm:'Joint Entrance Examination (Main)', tagline:'Build Main-paper speed and accuracy on a revision schedule that keeps every chapter retrievable.', metaDescription:'Plan JEE Main preparation by subject with topic priorities, revision cycles, mock analysis and realistic answers to common student questions.', studentsPerYear:'Official registration count published each cycle', examMonths:'January & April sessions', difficulty:'Extremely Competitive', relatedArticleSlugs:['how-to-study-for-jee','jee-mathematics-strategy','jee-chemistry-strategy','test-analysis'], subjects:[
S('physics','Physics',['Units and dimensions','Kinematics','Laws of motion','Work, energy and power','Rotational motion','Thermodynamics','Electrostatics and current electricity','Magnetism and electromagnetic induction','Optics','Modern physics']),
S('chemistry','Chemistry',['Mole concept','Atomic structure','Chemical bonding','Thermodynamics and equilibrium','Electrochemistry and kinetics','Coordination compounds','p-block chemistry','General organic chemistry','Hydrocarbons','Biomolecules']),
S('mathematics','Mathematics',['Quadratic equations','Sequences and series','Complex numbers','Matrices and determinants','Limits and continuity','Differentiation','Integration','Coordinate geometry','Vectors and 3D geometry','Probability']),
]}),
E({ slug:'neet', name:'NEET UG', shortName:'NEET', fullForm:'National Eligibility cum Entrance Test', tagline:'Turn a vast NCERT syllabus into reliable recall and exam-day accuracy.', metaDescription:'Prepare for NEET UG with subject priorities for Physics, Chemistry and Biology, high-yield topics, revision planning, mock analysis and practical FAQs.', studentsPerYear:'Official registration count published each cycle', examMonths:'May', difficulty:'Extremely Competitive', relatedArticleSlugs:['how-to-study-for-neet','neet-biology-high-yield','neet-physics-strategy','ncert-for-neet'], subjects:[
S('physics','Physics',['Units and measurements','Mechanics','Properties of matter','Thermodynamics','Waves and oscillations','Electrostatics','Current electricity','Magnetism and EMI','Ray and wave optics','Modern physics']),
S('chemistry','Chemistry',['Some basic concepts','Atomic structure','Chemical bonding','Equilibrium','Thermodynamics','Solutions and electrochemistry','Organic reaction principles','Hydrocarbons','Coordination compounds','p-block chemistry']),
S('biology','Biology',['Cell biology','Plant physiology','Human physiology','Reproduction','Genetics and evolution','Biotechnology','Ecology','Diversity in living world','Structural organisation','Human health and disease']),
]}),
E({ slug:'neet-pg', name:'NEET PG', shortName:'NEET PG', fullForm:'National Eligibility cum Entrance Test for Postgraduate Medical Courses', tagline:'Keep nineteen subjects retrievable through clinical integration and repeated grand-test review.', metaDescription:'Build a practical NEET PG preparation system across major clinical subjects, topic priorities, revision cycles, grand-test analysis and common student questions.', studentsPerYear:'Official registration count published each cycle', examMonths:'As notified by NBEMS', difficulty:'Extremely Competitive', relatedArticleSlugs:['neet-pg-preparation','test-analysis','memory-techniques','last-month-strategy'], subjects:[
S('medicine','Medicine',['Cardiology','Respiratory medicine','Neurology','Endocrinology','Gastroenterology','Nephrology','Infectious disease','Rheumatology']),
S('surgery','Surgery',['Trauma','Gastrointestinal surgery','Hepatobiliary surgery','Urology','Breast and thyroid','Vascular surgery','Anaesthesia basics','Orthopaedic integration']),
S('obstetrics-and-gynaecology','Obstetrics and Gynaecology',['Antenatal care','Labour','Obstetric emergencies','Postpartum care','Menstrual disorders','Infertility','Gynaecologic oncology','Contraception']),
S('paediatrics','Paediatrics',['Growth and development','Neonatology','Nutrition','Immunisation','Paediatric infections','Respiratory disorders','Cardiology','Neurology']),
S('community-medicine','Community Medicine',['Epidemiology','Biostatistics','Screening','Communicable disease control','National health programmes','Maternal and child health','Environmental health','Health management']),
]}),
];

export function getExam(slug: string): ExamData | undefined { return EXAM_DATA.find((exam) => exam.slug === slug); }
