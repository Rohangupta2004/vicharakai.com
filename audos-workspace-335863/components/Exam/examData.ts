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
E({ slug:'jee', name:'JEE Mains & Advanced', shortName:'JEE', fullForm:'Joint Entrance Examination', tagline:'Build depth for Advanced without sacrificing Main speed and accuracy.', metaDescription:'Plan JEE Main and Advanced preparation by subject with topic priorities, revision cycles, mock analysis and realistic answers to common student questions.', studentsPerYear:'Official registration count published each cycle', examMonths:'January, April & May', difficulty:'Extremely Competitive', relatedArticleSlugs:['how-to-study-for-jee','jee-mathematics-strategy','jee-chemistry-strategy','test-analysis'], subjects:[
S('physics','Physics',['Units and dimensions','Kinematics','Laws of motion','Work, energy and power','Rotational motion','Thermodynamics','Electrostatics and current electricity','Magnetism and electromagnetic induction','Optics','Modern physics']),
S('chemistry','Chemistry',['Mole concept','Atomic structure','Chemical bonding','Thermodynamics and equilibrium','Electrochemistry and kinetics','Coordination compounds','p-block chemistry','General organic chemistry','Hydrocarbons','Biomolecules']),
S('mathematics','Mathematics',['Quadratic equations','Sequences and series','Complex numbers','Matrices and determinants','Limits and continuity','Differentiation','Integration','Coordinate geometry','Vectors and 3D geometry','Probability']),
]}),
E({ slug:'neet', name:'NEET UG', shortName:'NEET', fullForm:'National Eligibility cum Entrance Test', tagline:'Turn a vast NCERT syllabus into reliable recall and exam-day accuracy.', metaDescription:'Prepare for NEET UG with subject priorities for Physics, Chemistry and Biology, high-yield topics, revision planning, mock analysis and practical FAQs.', studentsPerYear:'Official registration count published each cycle', examMonths:'May', difficulty:'Extremely Competitive', relatedArticleSlugs:['how-to-study-for-neet','neet-biology-high-yield','neet-physics-strategy','ncert-for-neet'], subjects:[
S('physics','Physics',['Units and measurements','Mechanics','Properties of matter','Thermodynamics','Waves and oscillations','Electrostatics','Current electricity','Magnetism and EMI','Ray and wave optics','Modern physics']),
S('chemistry','Chemistry',['Some basic concepts','Atomic structure','Chemical bonding','Equilibrium','Thermodynamics','Solutions and electrochemistry','Organic reaction principles','Hydrocarbons','Coordination compounds','p-block chemistry']),
S('biology','Biology',['Cell biology','Plant physiology','Human physiology','Reproduction','Genetics and evolution','Biotechnology','Ecology','Diversity in living world','Structural organisation','Human health and disease']),
]}),
E({ slug:'upsc', name:'UPSC Civil Services Examination', shortName:'UPSC CSE', fullForm:'Union Public Service Commission Civil Services Examination', tagline:'Build a two-year system where current affairs strengthen a revisable static core.', metaDescription:'Structure UPSC CSE preparation across GS subjects with key topics, revision and answer-writing guidance, mock strategy and clear answers to frequent questions.', studentsPerYear:'Official applicant count published each cycle', examMonths:'May–June & September', difficulty:'Extremely Competitive', relatedArticleSlugs:['how-to-study-for-upsc','upsc-gs-strategy','upsc-optional-strategy','pattern-analysis'], subjects:[
S('history','History',['Ancient India','Medieval India','Modern India','Freedom struggle','Post-independence India','World history','Art and culture','Historical maps']),
S('geography','Geography',['Geomorphology','Climatology','Oceanography','Indian physical geography','Resources','Agriculture','Human geography','Disaster geography']),
S('polity','Polity',['Constitutional framework','Fundamental rights','Parliament','Executive','Judiciary','Federalism','Local government','Governance and social justice']),
S('economy','Economy',['National income','Fiscal policy','Monetary policy','Inflation','Banking','External sector','Agriculture and industry','Inclusive growth']),
S('science-and-tech','Science and Technology',['Space technology','Biotechnology','Information technology','Artificial intelligence','Defence technology','Health science','Energy technology','Environmental applications']),
]}),
E({ slug:'neet-pg', name:'NEET PG', shortName:'NEET PG', fullForm:'National Eligibility cum Entrance Test for Postgraduate Medical Courses', tagline:'Keep nineteen subjects retrievable through clinical integration and repeated grand-test review.', metaDescription:'Build a practical NEET PG preparation system across major clinical subjects, topic priorities, revision cycles, grand-test analysis and common student questions.', studentsPerYear:'Official registration count published each cycle', examMonths:'As notified by NBEMS', difficulty:'Extremely Competitive', relatedArticleSlugs:['neet-pg-preparation','test-analysis','memory-techniques','last-month-strategy'], subjects:[
S('medicine','Medicine',['Cardiology','Respiratory medicine','Neurology','Endocrinology','Gastroenterology','Nephrology','Infectious disease','Rheumatology']),
S('surgery','Surgery',['Trauma','Gastrointestinal surgery','Hepatobiliary surgery','Urology','Breast and thyroid','Vascular surgery','Anaesthesia basics','Orthopaedic integration']),
S('obstetrics-and-gynaecology','Obstetrics and Gynaecology',['Antenatal care','Labour','Obstetric emergencies','Postpartum care','Menstrual disorders','Infertility','Gynaecologic oncology','Contraception']),
S('paediatrics','Paediatrics',['Growth and development','Neonatology','Nutrition','Immunisation','Paediatric infections','Respiratory disorders','Cardiology','Neurology']),
S('community-medicine','Community Medicine',['Epidemiology','Biostatistics','Screening','Communicable disease control','National health programmes','Maternal and child health','Environmental health','Health management']),
]}),
E({ slug:'cat', name:'CAT', shortName:'CAT', fullForm:'Common Admission Test', tagline:'Improve percentile by making better selection decisions under a strict clock.', metaDescription:'Prepare for CAT across VARC, DILR and Quant with high-priority topics, sectional strategy, mock analysis, time management and practical preparation FAQs.', studentsPerYear:'Official registration count published each cycle', examMonths:'November', difficulty:'Highly Competitive', relatedArticleSlugs:['cat-preparation','mock-test-frequency','time-management-exam','pattern-analysis'], subjects:[
S('verbal-ability','Verbal Ability and Reading Comprehension',['Reading comprehension','Inference','Main idea','Tone and purpose','Para summaries','Para jumbles','Odd sentence out','Vocabulary in context']),
S('data-interpretation-and-logical-reasoning','Data Interpretation and Logical Reasoning',['Tables and charts','Caselets','Arrangements','Games and tournaments','Routes and networks','Set theory','Scheduling','Set selection']),
S('quantitative-aptitude','Quantitative Aptitude',['Arithmetic','Algebra','Geometry','Number systems','Modern mathematics','Percentages and ratios','Time, speed and work','Functions']),
]}),
E({ slug:'clat', name:'CLAT', shortName:'CLAT', fullForm:'Common Law Admission Test', tagline:'Train passage reading, principle application and calm decision-making at speed.', metaDescription:'Plan CLAT preparation across English, legal and logical reasoning, mathematics and current affairs with topic priorities, mock strategy and clear FAQs.', studentsPerYear:'Official registration count published each cycle', examMonths:'December', difficulty:'Highly Competitive', relatedArticleSlugs:['clat-preparation','study-schedule','test-analysis','pattern-analysis'], subjects:[
S('english','English',['Reading comprehension','Main idea','Inference','Tone','Vocabulary in context','Argument structure','Summary','Passage speed']),
S('legal-reasoning','Legal Reasoning',['Principle-fact application','Constitutional law themes','Contracts','Torts','Criminal law basics','Rights and duties','Legal current affairs','Passage reasoning']),
S('logical-reasoning','Logical Reasoning',['Conclusions','Assumptions','Strengthen and weaken','Analogies','Cause and effect','Paradox','Argument flaws','Inference']),
S('mathematics','Mathematics',['Percentages','Ratios','Averages','Profit and loss','Time and work','Data interpretation','Simple and compound interest','Mensuration']),
S('general-knowledge','General Knowledge',['National events','International events','Legal developments','Awards and appointments','Government schemes','Economy','Science and environment','Monthly revision']),
]}),
E({ slug:'ssc', name:'SSC CGL', shortName:'SSC CGL', fullForm:'Staff Selection Commission Combined Graduate Level Examination', tagline:'Convert a finite syllabus and repeated patterns into speed, accuracy and consistency.', metaDescription:'Prepare for SSC CGL by subject with Quant, English, reasoning and awareness priorities, previous-paper strategy, mock analysis and realistic preparation FAQs.', studentsPerYear:'Official application count published each cycle', examMonths:'As notified by SSC', difficulty:'Highly Competitive', relatedArticleSlugs:['ssc-cgl-preparation','time-management-exam','pattern-analysis','study-schedule'], subjects:[
S('english','English',['Reading comprehension','Cloze test','Error spotting','Sentence improvement','Vocabulary','One-word substitution','Idioms','Active and passive voice']),
S('general-intelligence','General Intelligence and Reasoning',['Analogy','Classification','Series','Coding-decoding','Syllogism','Venn diagrams','Non-verbal reasoning','Statement conclusions']),
S('quantitative-aptitude','Quantitative Aptitude',['Arithmetic','Algebra','Geometry','Mensuration','Trigonometry','Data interpretation','Number system','Time and work']),
S('general-awareness','General Awareness',['History','Polity','Geography','Economy','General science','Static GK','Current affairs','Government programmes']),
]}),
E({ slug:'rrb', name:'RRB NTPC', shortName:'RRB NTPC', fullForm:'Railway Recruitment Board Non-Technical Popular Categories', tagline:'Master recurring aptitude patterns while maintaining a dependable awareness revision cycle.', metaDescription:'Prepare for RRB NTPC Mathematics, reasoning and awareness with key topic priorities, CBT time strategy, previous papers, mock analysis and practical FAQs.', studentsPerYear:'Application count varies by recruitment notification', examMonths:'As notified by Railway Recruitment Boards', difficulty:'Highly Competitive', relatedArticleSlugs:['ssc-cgl-preparation','time-management-exam','mock-test-frequency','pattern-analysis'], subjects:[
S('mathematics','Mathematics',['Number system','Decimals and fractions','LCM and HCF','Ratio and proportion','Percentages','Time and work','Time and distance','Profit and loss','Geometry','Data interpretation']),
S('general-intelligence','General Intelligence and Reasoning',['Analogies','Series','Coding-decoding','Mathematical operations','Relationships','Syllogism','Venn diagrams','Puzzles','Data sufficiency','Decision making']),
S('general-awareness','General Awareness',['Current events','Indian history','Geography','Polity','Economy','General science','Transport systems','Government programmes','Computers','Static GK']),
]}),
E({ slug:'mpsc', name:'MPSC State Service', shortName:'MPSC', fullForm:'Maharashtra Public Service Commission State Service Examination', tagline:'Combine Maharashtra-specific depth with a strong, revisable General Studies foundation.', metaDescription:'Plan MPSC State Service preparation across Marathi, English, General Studies and CSAT with topic priorities, revision, answer practice and useful FAQs.', studentsPerYear:'Official applicant count varies by notification', examMonths:'As notified by MPSC', difficulty:'Highly Competitive', relatedArticleSlugs:['upsc-gs-strategy','study-schedule','pattern-analysis','test-analysis'], subjects:[
S('marathi','Marathi',['Grammar','Vocabulary','Comprehension','Precis writing','Translation','Usage','Sentence correction','Writing practice']),
S('english','English',['Grammar','Vocabulary','Comprehension','Precis writing','Translation','Sentence correction','Usage','Writing practice']),
S('general-studies','General Studies',['Maharashtra history','Indian history','Maharashtra geography','Indian geography','Constitution and governance','Economy','Environment','Science and technology','Current affairs','Social issues']),
S('csat','CSAT',['Reading comprehension','Logical reasoning','Analytical ability','Decision making','Basic numeracy','Data interpretation','Problem solving','Communication skills']),
]}),
E({ slug:'inicet', name:'INI-CET', shortName:'INI-CET', fullForm:'Institute of National Importance Combined Entrance Test', tagline:'Integrate basic science with clinical clues and revise for fast, precise recall.', metaDescription:'Prepare systematically for INI-CET across medicine, surgery, allied and basic sciences with high-yield topics, integrated revision, mock analysis and FAQs.', studentsPerYear:'Official registration count published each session', examMonths:'May & November', difficulty:'Extremely Competitive', relatedArticleSlugs:['neet-pg-preparation','test-analysis','memory-techniques','last-month-strategy'], subjects:[
S('medicine','Medicine',['Cardiology','Neurology','Endocrinology','Gastroenterology','Nephrology','Respiratory medicine','Infectious disease','Emergency medicine']),
S('surgery','Surgery',['Trauma','Gastrointestinal surgery','Urology','Breast and thyroid','Vascular surgery','Orthopaedics','Anaesthesia','Radiology integration']),
S('allied-sciences','Allied Sciences',['Dermatology','Psychiatry','Radiology','Anaesthesia','ENT','Ophthalmology','Forensic medicine','Community medicine']),
S('basic-sciences','Basic Sciences',['Anatomy','Physiology','Biochemistry','Pathology','Pharmacology','Microbiology','Genetics','Immunology']),
]}),
E({ slug:'banking', name:'Banking Exams (SBI/IBPS PO)', shortName:'Banking Exams', fullForm:'SBI and IBPS Probationary Officer Examinations', tagline:'Build speed without letting sectional cutoffs or current affairs become afterthoughts.', metaDescription:'Prepare for SBI and IBPS PO exams across English, reasoning, Quant and awareness with speed drills, mock analysis, topic priorities and common FAQs.', studentsPerYear:'Applications vary across SBI and IBPS notifications', examMonths:'Multiple cycles through the year', difficulty:'Highly Competitive', relatedArticleSlugs:['time-management-exam','mock-test-frequency','pattern-analysis','study-schedule'], subjects:[
S('english','English',['Reading comprehension','Cloze test','Error detection','Sentence rearrangement','Vocabulary','Fillers','Phrase replacement','Descriptive writing']),
S('reasoning','Reasoning',['Seating arrangements','Puzzles','Syllogism','Inequalities','Coding-decoding','Blood relations','Direction sense','Input-output','Data sufficiency','Critical reasoning']),
S('quantitative-aptitude','Quantitative Aptitude',['Simplification','Number series','Quadratic equations','Data interpretation','Arithmetic','Percentages','Ratio','Time and work','Probability','Data sufficiency']),
S('general-awareness','General and Banking Awareness',['Banking terms','RBI and monetary policy','Financial awareness','Current affairs','Government schemes','Static GK','Economy','Computer aptitude']),
]}),
E({ slug:'defence', name:'NDA & CDS', shortName:'NDA/CDS', fullForm:'National Defence Academy and Combined Defence Services Examinations', tagline:'Pair written-exam consistency with the awareness and communication expected after it.', metaDescription:'Prepare for NDA and CDS Mathematics, English and General Knowledge with topic priorities, written-paper strategy, revision, mock analysis and practical FAQs.', studentsPerYear:'Official applicant count varies by UPSC cycle', examMonths:'April & September', difficulty:'Highly Competitive', relatedArticleSlugs:['time-management-exam','study-schedule','mock-test-frequency','pattern-analysis'], subjects:[
S('mathematics','Mathematics',['Algebra','Matrices and determinants','Trigonometry','Analytical geometry','Differential calculus','Integral calculus','Vectors','Statistics and probability']),
S('english','English',['Grammar','Vocabulary','Comprehension','Sentence improvement','Ordering of words','Usage','Synonyms and antonyms','Timed passages']),
S('general-knowledge','General Knowledge',['Physics','Chemistry','General science','History','Freedom movement','Geography','Current events','Defence awareness','Polity','Economy']),
]}),
E({ slug:'teaching', name:'CTET & State TET', shortName:'CTET/TET', fullForm:'Central and State Teacher Eligibility Tests', tagline:'Connect pedagogy principles to classroom situations instead of memorising labels alone.', metaDescription:'Prepare for CTET and State TET across child development, languages and environmental studies with pedagogy priorities, practice strategy and clear FAQs.', studentsPerYear:'Applications vary by central and state notification', examMonths:'As notified by the relevant board', difficulty:'Competitive', relatedArticleSlugs:['active-recall','memory-techniques','study-schedule','test-analysis'], subjects:[
S('child-development','Child Development and Pedagogy',['Development principles','Learning theories','Inclusive education','Assessment','Intelligence','Motivation','Special needs','Classroom practice']),
S('language-i','Language I',['Comprehension','Grammar in context','Language acquisition','Teaching methods','Assessment','Remedial teaching','Vocabulary','Classroom activities']),
S('language-ii','Language II',['Comprehension','Grammar in context','Second-language acquisition','Teaching methods','Assessment','Remedial teaching','Vocabulary','Classroom activities']),
S('environmental-studies','Environmental Studies',['Family and friends','Food','Shelter','Water','Travel','Plants and animals','Environment','EVS pedagogy']),
S('mathematics','Mathematics Pedagogy',['Number system','Arithmetic','Geometry','Measurement','Data handling','Problem solving','Error analysis','Teaching methods']),
]}),
];

export function getExam(slug: string): ExamData | undefined { return EXAM_DATA.find((exam) => exam.slug === slug); }
