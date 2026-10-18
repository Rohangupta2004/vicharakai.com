/**
 * Global exams — US, UK and Asia.
 *  • USMLE Step 1 & Step 2 CK, MCAT, UCAT — medical.
 *  • GMAT Focus Edition & GRE General — business / postgraduate admissions.
 *  • SAT & ACT — US undergraduate admissions.
 *  • LNAT, STEP, TMUA — UK admissions tests.
 *  • Gaokao, Suneung (CSAT) and TOPIK II — Asia.
 */
import { buildExam, type ExamSyllabus } from './syllabusTypes';

export const USMLE_STEP_1: ExamSyllabus = buildExam('usmle_step_1', 'USMLE Step 1', 'USA', 'Medical', [
  ['Anatomy', [
    ['Gross Anatomy & Embryology', 'medium', ['Clinically applied limb anatomy', 'Thoracic and abdominal viscera', 'Pelvic anatomy and perineum', 'Embryologic derivatives and congenital anomalies']],
    ['Neuroanatomy', 'medium', ['Spinal-cord tracts and lesion localisation', 'Brainstem anatomy and cranial nerves', 'Cerebral vasculature and stroke syndromes', 'Ventricles, meninges and CSF']],
  ]],
  ['Behavioural Sciences', [
    ['Behavioural Science & Ethics', 'medium', ['Biostatistics and epidemiology for Step 1', 'Study design and test interpretation', 'Medical ethics and patient communication', 'Development and psychological principles', 'Sleep physiology and substance effects']],
  ]],
  ['Biochemistry', [
    ['Metabolism & Nutrition-Linked Biochemistry', 'high', ['Glycolysis, TCA and electron transport', 'Glycogen storage and lysosomal diseases', 'Lipid metabolism and dyslipidemias', 'Amino-acid disorders and urea cycle', 'Vitamin biochemistry in disease']],
    ['Molecular & Cellular Biochemistry', 'high', ['DNA replication and repair defects', 'Transcription, translation and their inhibitors', 'Cell-cycle regulation and apoptosis', 'Laboratory techniques — PCR, blots and sequencing', 'Collagen and connective-tissue biochemistry']],
  ]],
  ['Cell Biology', [
    ['Cell & Tissue Biology', 'medium', ['Organelle structure and diseases', 'Cytoskeleton and trafficking defects', 'Cell-signaling pathways', 'Epithelial and connective tissue histology']],
  ]],
  ['Microbiology', [
    ['Clinical Microbiology', 'high', ['High-yield bacteriology by system', 'Virology — DNA and RNA virus families', 'Mycology and parasitology essentials', 'Antimicrobial mechanisms and resistance', 'Immunology — hypersensitivity and immunodeficiency']],
  ]],
  ['Pathology', [
    ['General & Systemic Pathology', 'high', ['Cellular injury, inflammation and repair', 'Neoplasia — genetics and tumor biology', 'Cardiovascular and pulmonary pathology', 'GI, hepatic and renal pathology', 'Endocrine, reproductive and CNS pathology', 'Hematopathology']],
  ]],
  ['Pharmacology', [
    ['Pharmacology Principles & Systems', 'high', ['Pharmacokinetics and dose calculations', 'Autonomic pharmacology', 'Cardiovascular and renal drugs', 'CNS pharmacology', 'Antimicrobial and anticancer agents', 'Toxicities and antidotes']],
  ]],
  ['Physiology', [
    ['Systems Physiology', 'high', ['Cardiovascular pressure-volume physiology', 'Respiratory mechanics and gas exchange', 'Renal clearance and acid-base', 'GI and endocrine physiology', 'Neurophysiology and muscle']],
  ]],
  ['Genetics', [
    ['Medical Genetics', 'medium', ['Modes of inheritance and pedigrees', 'Chromosomal abnormalities and syndromes', 'Trinucleotide repeats and imprinting', 'Population genetics — Hardy-Weinberg', 'Genetic testing technologies']],
  ]],
  ['Nutrition', [
    ['Clinical Nutrition', 'low', ['Fat- and water-soluble vitamin deficiencies', 'Trace elements — zinc, copper and iron', 'Protein-energy malnutrition', 'Nutrition in metabolic disease']],
  ]],
]);

export const USMLE_STEP_2_CK: ExamSyllabus = buildExam('usmle_step_2_ck', 'USMLE Step 2 CK', 'USA', 'Medical', [
  ['Internal Medicine', [
    ['Cardio-Pulmonary Medicine', 'high', ['Chest pain and ACS management', 'Heart failure and arrhythmias', 'Asthma, COPD and ILD workup', 'Pulmonary embolism and pleural disease']],
    ['GI, Renal & Endocrine Medicine', 'high', ['GI bleeding and liver disease', 'AKI, CKD and electrolyte disorders', 'Diabetes and thyroid management', 'Adrenal and pituitary disease']],
    ['Infectious Disease, Heme-Onc & Rheum', 'high', ['Antibiotic selection by syndrome', 'HIV care and opportunistic infections', 'Anemias and common malignancies', 'Rheumatologic diagnosis and treatment']],
  ]],
  ['Surgery', [
    ['Surgical Care', 'high', ['Acute abdomen decision making', 'Trauma assessment and management', 'Pre- and postoperative care', 'Vascular and surgical oncology essentials']],
  ]],
  ['Obstetrics & Gynecology', [
    ['OB-GYN Clinical Care', 'high', ['Prenatal care and labor management', 'Obstetric complications and emergencies', 'Abnormal uterine bleeding and pelvic masses', 'Cervical screening and gynecologic cancers', 'Contraception counseling']],
  ]],
  ['Pediatrics', [
    ['Pediatric Clinical Care', 'high', ['Newborn assessment and neonatal problems', 'Well-child visits and vaccination schedules', 'Common pediatric infections', 'Congenital and genetic conditions', 'Adolescent medicine']],
  ]],
  ['Psychiatry', [
    ['Psychiatric Clinical Care', 'medium', ['Mood and psychotic disorder management', 'Anxiety, OCD and trauma disorders', 'Substance-use disorders', 'Child psychiatry and safety assessment']],
  ]],
  ['Preventive Medicine', [
    ['Prevention & Biostatistics', 'medium', ['Screening guidelines by age and risk', 'Vaccination in adults', 'Risk-factor modification', 'Biostatistics and evidence interpretation', 'Quality improvement and patient safety']],
  ]],
  ['Emergency Medicine', [
    ['Emergency Care', 'medium', ['ACLS and resuscitation priorities', 'Toxicologic emergencies and antidotes', 'Environmental emergencies', 'Shock recognition and management']],
  ]],
]);

export const MCAT: ExamSyllabus = buildExam('mcat', 'MCAT', 'USA', 'Medical', [
  ['Biological & Biochemical Foundations', [
    ['Biomolecules & Metabolism', 'high', ['Amino acids, proteins and enzymes', 'Carbohydrate and lipid metabolism', 'Bioenergetics and oxidative phosphorylation', 'DNA, RNA and protein synthesis']],
    ['Cells & Organ Systems', 'high', ['Cell structure and division', 'Microbiology — bacteria and viruses', 'Nervous and endocrine systems', 'Circulatory, respiratory and renal systems', 'Reproduction and development']],
  ]],
  ['Chemical & Physical Foundations', [
    ['General Chemistry & Physics', 'high', ['Atomic structure and periodic trends', 'Thermodynamics and kinetics', 'Acids, bases and titrations', 'Mechanics, fluids and circuits', 'Optics, sound and nuclear phenomena']],
    ['Organic Chemistry & Biochem Overlap', 'medium', ['Functional groups and reactions', 'Stereochemistry', 'Separation and spectroscopy techniques', 'Carbonyl and carboxylic-acid chemistry']],
  ]],
  ['Psychological, Social & Biological Foundations', [
    ['Behavioral & Social Sciences', 'high', ['Sensation, perception and cognition', 'Learning, memory and behavior change', 'Motivation, emotion and stress', 'Identity, social processes and interactions', 'Social structure, demographics and inequality']],
  ]],
  ['Critical Analysis & Reasoning Skills', [
    ['CARS', 'high', ['Foundations of comprehension', 'Reasoning within the text', 'Reasoning beyond the text', 'Timed passage strategy']],
  ]],
]);

export const UCAT: ExamSyllabus = buildExam('ucat', 'UCAT', 'UK', 'Medical', [
  ['Verbal Reasoning', [
    ['Verbal Reasoning', 'high', ['Speed-reading long passages', 'True / false / cannot tell decisions', 'Inference and author-intent questions', 'Trap-answer recognition']],
  ]],
  ['Decision Making', [
    ['Decision Making', 'high', ['Syllogisms and logical puzzles', 'Probability and Venn-diagram reasoning', 'Interpreting charts and data for arguments', 'Evaluating strongest arguments']],
  ]],
  ['Quantitative Reasoning', [
    ['Quantitative Reasoning', 'high', ['Percentages, ratios and rates', 'Mental math under time pressure', 'Multi-step data extraction from charts', 'Unit conversions and estimation']],
  ]],
  ['Abstract Reasoning', [
    ['Abstract Reasoning', 'medium', ['Pattern-set identification', 'Shape, number and position rules', 'Series continuation', 'Statement-based set matching']],
  ]],
  ['Situational Judgement', [
    ['Situational Judgement', 'medium', ['Appropriateness of responses', 'Importance of considerations', 'Medical ethics and professionalism scenarios', 'Teamwork and patient-safety judgement']],
  ]],
]);

export const GMAT_FOCUS: ExamSyllabus = buildExam('gmat_focus', 'GMAT Focus Edition', 'USA', 'MBA', [
  ['Quantitative Reasoning', [
    ['Arithmetic & Number Properties', 'high', ['Number properties and divisibility', 'Fractions, decimals and percents', 'Ratios and proportions', 'Exponents and roots']],
    ['Algebra & Word Problems', 'high', ['Linear and quadratic equations', 'Inequalities and absolute value', 'Rates, work and mixtures', 'Overlapping sets and sequences', 'Statistics — mean, median and deviation']],
  ]],
  ['Verbal Reasoning', [
    ['Critical Reasoning', 'high', ['Argument structure and assumptions', 'Strengthen and weaken questions', 'Evaluate and inference questions', 'Boldface and paradox questions']],
    ['Reading Comprehension', 'high', ['Main-idea and structure questions', 'Detail and inference questions', 'Tone and application questions', 'Long business and science passages']],
  ]],
  ['Data Insights', [
    ['Data Insights', 'high', ['Data sufficiency', 'Multi-source reasoning', 'Table analysis', 'Graphics interpretation', 'Two-part analysis']],
  ]],
]);

export const GRE_GENERAL: ExamSyllabus = buildExam('gre_general', 'GRE General Test', 'USA', 'Postgraduate', [
  ['Verbal Reasoning', [
    ['Text Completion & Equivalence', 'high', ['Single- and multi-blank text completion', 'Sentence equivalence pairs', 'High-frequency GRE vocabulary', 'Context-clue strategies']],
    ['Reading Comprehension', 'high', ['Main idea and structure', 'Inference and application', 'Critical-reasoning short passages', 'Highlighted-sentence function questions']],
  ]],
  ['Quantitative Reasoning', [
    ['Arithmetic & Algebra', 'high', ['Integer properties and fractions', 'Percents, ratios and rates', 'Linear and quadratic problem solving', 'Exponents, roots and sequences']],
    ['Geometry & Data Analysis', 'medium', ['Lines, circles, triangles and solids', 'Coordinate geometry', 'Descriptive statistics and distributions', 'Counting, probability and interpretation of graphs', 'Quantitative-comparison strategy']],
  ]],
  ['Analytical Writing', [
    ['Analyze an Issue', 'medium', ['Position development with reasons and examples', 'Organizing an argument under time', 'Style, grammar and revision technique', 'Scored sample analysis']],
  ]],
]);

export const SAT: ExamSyllabus = buildExam('sat', 'SAT', 'USA', 'Undergraduate', [
  ['Evidence-Based Reading & Writing', [
    ['Reading — Information & Ideas', 'high', ['Central ideas and details', 'Command of textual evidence', 'Inferences from passages and data', 'Cross-text connections']],
    ['Reading — Craft & Structure', 'high', ['Words in context', 'Text structure and purpose', 'Rhetorical analysis']],
    ['Writing — Conventions & Expression', 'high', ['Sentence boundaries and punctuation', 'Verb tense, agreement and pronouns', 'Transitions and logical flow', 'Concision and precision edits']],
  ]],
  ['Math', [
    ['Algebra', 'high', ['Linear equations and inequalities', 'Systems of linear equations', 'Linear functions and graphs', 'Interpreting linear models']],
    ['Advanced Math', 'high', ['Quadratic and polynomial expressions', 'Exponential and rational functions', 'Nonlinear systems', 'Function notation and transformations']],
    ['Problem Solving & Data Analysis', 'medium', ['Ratios, rates and proportions', 'Percentages in context', 'Data distributions and center-spread', 'Scatterplots and line of best fit', 'Probability and study design']],
    ['Geometry & Trigonometry', 'medium', ['Area, volume and angle relationships', 'Right-triangle trigonometry', 'Circle theorems and arc measures', 'Coordinate geometry connections']],
  ]],
]);

export const ACT: ExamSyllabus = buildExam('act', 'ACT', 'USA', 'Undergraduate', [
  ['English', [
    ['Usage & Mechanics', 'high', ['Punctuation and sentence structure', 'Grammar and agreement', 'Modifier placement']],
    ['Rhetorical Skills', 'high', ['Strategy and audience', 'Organization and transitions', 'Style and redundancy edits']],
  ]],
  ['Mathematics', [
    ['Pre-Algebra & Elementary Algebra', 'high', ['Number basics and operations', 'Percentages, ratios and proportions', 'Linear equations and inequalities', 'Statistics and probability basics']],
    ['Intermediate Algebra & Coordinate Geometry', 'medium', ['Quadratics and functions', 'Systems and matrices basics', 'Graphs, slopes and conics basics', 'Logarithms and complex numbers']],
    ['Plane Geometry & Trigonometry', 'medium', ['Angles, triangles and circles', 'Area, perimeter and volume', 'Right-triangle trigonometry', 'Trig graphs and identities basics']],
  ]],
  ['Reading', [
    ['Reading Comprehension', 'high', ['Prose fiction and literary narrative', 'Social science passages', 'Humanities passages', 'Natural science passages', 'Paired-passage comparison']],
  ]],
  ['Science', [
    ['Science Reasoning', 'high', ['Data representation — graphs and tables', 'Research-summary experiments', 'Conflicting viewpoints analysis', 'Scientific method and variables']],
  ]],
  ['Writing (Optional Essay)', [
    ['ACT Essay', 'low', ['Analyzing multiple perspectives', 'Thesis and argument development', 'Organization and cohesion', 'Language use under time']],
  ]],
]);

export const LNAT: ExamSyllabus = buildExam('lnat', 'LNAT', 'UK', 'Law', [
  ['Section A — Multiple-Choice Comprehension', [
    ['Critical Comprehension', 'high', ['Argument identification in dense passages', 'Assumption and inference questions', 'Author tone, purpose and technique', 'Analysing rhetoric and evidence', 'Eliminating near-miss answers']],
  ]],
  ['Section B — Essay', [
    ['Essay Writing', 'high', ['Choosing and framing the question', 'Building a persuasive, balanced argument', 'Using current-affairs and ethical examples', 'Counter-arguments and rebuttal', 'Clear timed writing at 40 minutes']],
  ]],
]);

export const STEP: ExamSyllabus = buildExam('step', 'STEP (Maths)', 'UK', 'Undergraduate', [
  ['STEP 2 — Pure Mathematics', [
    ['Pure Maths (A-level + AS Further)', 'high', ['Algebraic manipulation and proof', 'Coordinate geometry and curve sketching', 'Trigonometric identities and equations', 'Differentiation and integration techniques', 'Sequences, series and induction', 'Complex numbers and polynomials']],
  ]],
  ['STEP 2 — Mechanics', [
    ['Mechanics', 'medium', ['Kinematics with calculus', 'Forces, friction and equilibrium', 'Projectiles', 'Momentum, impulse and collisions', 'Moments and rigid bodies', 'Energy methods']],
  ]],
  ['STEP 2 — Probability & Statistics', [
    ['Probability & Statistics', 'medium', ['Combinatorial probability', 'Discrete random variables and expectation', 'Continuous distributions', 'Conditional probability arguments']],
  ]],
  ['STEP 3 — Advanced Pure', [
    ['Advanced Pure (Full Further Maths)', 'high', ['Hyperbolic functions and advanced integration', 'Differential equations — first and second order', 'Matrices, eigenvalues and transformations', 'Polar coordinates and advanced curve work', 'Vectors and 3D geometry proofs', 'Rigorous inequality and proof questions']],
  ]],
  ['STEP 3 — Advanced Applied', [
    ['Advanced Mechanics & Statistics', 'medium', ['Circular and simple harmonic motion', 'Variable-mass and advanced dynamics', 'Generating functions basics', 'Advanced probability problem solving']],
  ]],
]);

export const TMUA: ExamSyllabus = buildExam('tmua', 'TMUA', 'UK', 'Undergraduate', [
  ['Paper 1 — Applications of Mathematical Knowledge', [
    ['Mathematical Applications', 'high', ['Algebra and functions at speed', 'Sequences and series problem solving', 'Coordinate geometry applications', 'Trigonometry and exponentials', 'Differentiation and integration applications', 'Combinatorics and number problems']],
  ]],
  ['Paper 2 — Mathematical Reasoning', [
    ['Logic & Proof', 'high', ['Logical connectives and negation', 'Necessary and sufficient conditions', 'Direct proof and counterexamples', 'Proof by contradiction and induction', 'Identifying errors in given proofs']],
  ]],
]);

export const GAOKAO: ExamSyllabus = buildExam('gaokao', 'Gaokao', 'China', 'Undergraduate', [
  ['Chinese Language', [
    ['Chinese', 'high', ['Modern-text reading analysis', 'Classical Chinese reading', 'Poetry appreciation', 'Language usage and idioms', 'Composition — 800-character essay']],
  ]],
  ['Mathematics', [
    ['Mathematics', 'high', ['Functions and derivatives', 'Trigonometry and vectors', 'Sequences and series', 'Solid and analytic geometry', 'Probability and statistics', 'Inequality proofs and parametric problems']],
  ]],
  ['Foreign Language (English)', [
    ['English', 'high', ['Listening comprehension', 'Reading comprehension', 'Cloze test', 'Grammar filling', 'Written expression and letters']],
  ]],
  ['Science Bundle (Physics · Chemistry · Biology)', [
    ['Physics', 'high', ['Mechanics and Newton\u2019s laws', 'Electricity and magnetism', 'Energy and momentum', 'Waves, optics and modern physics']],
    ['Chemistry', 'medium', ['Chemical reactions and energy', 'Electrochemistry and equilibrium', 'Organic chemistry fundamentals', 'Chemical experiments and analysis']],
    ['Biology', 'medium', ['Cell biology and metabolism', 'Genetics and evolution', 'Homeostasis and regulation', 'Ecology and biotechnology']],
  ]],
  ['Humanities Bundle (Politics · History · Geography)', [
    ['Politics', 'medium', ['Economic life and markets', 'Political life and governance', 'Culture and philosophy', 'Current-affairs application']],
    ['History', 'medium', ['Ancient Chinese history', 'Modern Chinese history', 'World history themes', 'Historical-source analysis']],
    ['Geography', 'medium', ['Physical geography processes', 'Human and economic geography', 'Regional geography of China', 'Map and data interpretation']],
  ]],
]);

export const SUNEUNG: ExamSyllabus = buildExam('suneung', 'Suneung (CSAT)', 'South Korea', 'Undergraduate', [
  ['Korean Language', [
    ['Korean', 'high', ['Reading — non-literary texts', 'Literature — classical and modern', 'Speech and writing elective', 'Language and media elective']],
  ]],
  ['Mathematics', [
    ['Mathematics', 'high', ['Algebra and functions', 'Calculus — limits, derivatives and integrals', 'Probability and statistics elective', 'Geometry elective', 'Sequences and mathematical induction']],
  ]],
  ['English', [
    ['English', 'high', ['Listening comprehension', 'Reading — main idea and detail', 'Blank-inference questions', 'Sentence ordering and insertion', 'Long-passage analysis']],
  ]],
  ['Korean History', [
    ['Korean History', 'medium', ['Pre-modern Korean history', 'Japanese colonial period', 'Modern and contemporary Korea', 'Source-based questions']],
  ]],
  ['Social Studies / Science Electives', [
    ['Social Studies Electives', 'medium', ['Life and ethics', 'Social culture', 'Korean geography', 'Politics and law', 'Economics']],
    ['Science Electives', 'medium', ['Physics I and II topics', 'Chemistry I and II topics', 'Life science I and II topics', 'Earth science I and II topics']],
  ]],
]);

export const TOPIK_II: ExamSyllabus = buildExam('topik_ii', 'TOPIK II', 'South Korea', 'Language', [
  ['Reading', [
    ['Reading (Levels 3-6)', 'high', ['Intermediate grammar patterns in context', 'Advanced vocabulary and hanja-based words', 'Long informational passages', 'Ordering and insertion questions', 'Author intent and tone questions', 'Speed strategies for the 50-question set']],
  ]],
  ['Listening', [
    ['Listening (Levels 3-6)', 'high', ['Conversations and announcements', 'News and documentary audio', 'Lectures and discussions', 'Inference from tone and context', 'Note-taking strategies']],
  ]],
  ['Writing', [
    ['Writing (쓰기 51-54)', 'high', ['Sentence-completion items 51-52', 'Describing graphs and data (서술형 53)', 'The 600-700 character essay (54)', 'Formal written register and connectors', 'Essay structure and time management']],
  ]],
]);
