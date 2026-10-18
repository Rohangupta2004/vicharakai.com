/**
 * India — MBA, Law, Finance/Accounting and Staff Selection syllabi.
 *  • CAT — IIM pattern (VARC, DILR, QA).
 *  • CLAT — the five NLU sections.
 *  • CA Final — Group 1 and Group 2 papers (ICAI scheme).
 *  • CFA Level 1 — the ten CFA Institute topic areas.
 *  • SSC CGL — Tier 1 and Tier 2 sections.
 */
import { buildExam, type ExamSyllabus } from './syllabusTypes';

export const CAT: ExamSyllabus = buildExam('cat', 'CAT', 'India', 'MBA', [
  ['Verbal Ability & Reading Comprehension', [
    ['Reading Comprehension', 'high', ['Main idea and central theme', 'Direct-detail questions', 'Inference questions', 'Author tone and attitude', 'Purpose and passage structure', 'Vocabulary in context', 'Fact versus opinion', 'Application and extrapolation']],
    ['RC Passage Genres', 'medium', ['Philosophy and humanities passages', 'Social-science passages', 'Science and technology passages', 'Economics and business passages', 'History and culture passages', 'Abstract and literary passages']],
    ['Para Jumbles', 'high', ['Sentence-link identification', 'Opening and closing sentences', 'Mandatory pairs', 'Four-sentence TITA para jumbles']],
    ['Para Summary', 'medium', ['Central-idea compression', 'Scope and tone matching', 'Elimination of distortions', 'Summary practice sets']],
    ['Odd Sentence Out', 'medium', ['Paragraph-coherence mapping', 'Odd-sentence elimination', 'TITA odd-one-out sets']],
    ['Sentence Placement & Completion', 'low', ['Best sentence placement', 'Paragraph completion', 'Logical bridge sentences']],
    ['Critical Reasoning', 'low', ['Assumptions and conclusions', 'Strengthen and weaken arguments', 'Paradox resolution', 'Inference and evaluation']],
  ]],
  ['Data Interpretation & Logical Reasoning', [
    ['Tables, Charts & Graphs', 'high', ['Tables and missing data', 'Bar charts', 'Line graphs', 'Pie charts', 'Radar and scatter charts', 'Mixed-chart sets']],
    ['Data Caselets', 'medium', ['Paragraph caselets', 'Reasoning-based data caselets', 'Data comparison and approximation', 'Growth-rate and percentage sets']],
    ['Arrangements', 'high', ['Linear seating', 'Circular seating', 'Grid and matrix arrangements', 'Multi-variable arrangements', 'Ordering and ranking']],
    ['Grouping, Selection & Distribution', 'high', ['Team selection', 'Grouping with conditions', 'Object distribution', 'Matching and allocation']],
    ['Games & Tournaments', 'medium', ['Round-robin tournaments', 'Knockout tournaments', 'League tables', 'Scoring and ranking', 'Wins-losses-draws constraints']],
    ['Routes, Networks & Scheduling', 'medium', ['Network paths and connectivity', 'Maps and spatial constraints', 'Timetables and event scheduling', 'Task sequencing and calendars']],
    ['Set Theory & Venn Diagrams', 'medium', ['Two-set problems', 'Three-set problems', 'Four-set problems', 'Maxima-minima with sets']],
    ['Binary Logic & Cubes', 'low', ['Truth-teller and liar puzzles', 'Conditional logic', 'Painted cubes and stacked blocks', 'Spatial visualisation']],
  ]],
  ['Quantitative Ability', [
    ['Number Systems', 'medium', ['Divisibility rules', 'Factors and multiples', 'HCF and LCM', 'Remainders and cyclicity', 'Units digits', 'Factorials and trailing zeros', 'Base systems']],
    ['Arithmetic', 'high', ['Percentage change and successive change', 'Ratio, proportion and variation', 'Averages, mixtures and alligation', 'Profit, loss and discount', 'Simple and compound interest', 'Time, speed and distance', 'Time and work', 'Pipes and cisterns']],
    ['Algebra', 'high', ['Linear and quadratic equations', 'Inequalities and modulus', 'Functions and graphs', 'Logarithms, surds and indices', 'Sequences and series', 'Maxima-minima of expressions']],
    ['Geometry & Mensuration', 'high', ['Lines, angles and triangles', 'Similarity and congruence', 'Circles and their theorems', 'Quadrilaterals and polygons', 'Coordinate geometry', 'Areas and volumes of solids']],
    ['Modern Math', 'medium', ['Permutations and combinations', 'Probability', 'Set theory and inclusion-exclusion', 'Binomial theorem basics']],
  ]],
]);

export const CLAT: ExamSyllabus = buildExam('clat', 'CLAT', 'India', 'Law', [
  ['English Language', [
    ['Reading & Language Skills', 'high', ['Passage comprehension and inference', 'Vocabulary in context', 'Grammar and usage in passages', 'Tone, purpose and viewpoint', 'Summary and title questions']],
  ]],
  ['Current Affairs & General Knowledge', [
    ['Current Affairs', 'high', ['National developments and policy', 'International affairs and summits', 'Legal developments in the news', 'Awards, sports and culture']],
    ['Static GK', 'medium', ['Modern Indian history essentials', 'Geography and environment basics', 'Arts, culture and important days', 'Science and technology milestones']],
  ]],
  ['Legal Reasoning', [
    ['Legal Principles & Application', 'high', ['Reading legal passages and principles', 'Law of torts — negligence and liability', 'Contract law — offer, acceptance and breach', 'Criminal law — elements of offences', 'Constitutional law — rights and duties', 'Legal maxims and current legal issues']],
  ]],
  ['Logical Reasoning', [
    ['Critical Reasoning', 'high', ['Argument structure — premises and conclusions', 'Assumptions and inferences', 'Strengthen and weaken questions', 'Analogies and logical sequences', 'Syllogisms and consistency']],
  ]],
  ['Quantitative Techniques', [
    ['Data-Based Numeracy', 'medium', ['Percentages and ratios from data sets', 'Averages and mixtures', 'Basic algebra and mensuration', 'Graph and table interpretation', 'Speed, time and work basics']],
  ]],
]);

export const CA_FINAL: ExamSyllabus = buildExam('ca_final', 'CA Final', 'India', 'Finance', [
  ['Financial Reporting (Group 1)', [
    ['Ind AS Framework', 'high', ['Conceptual framework and Ind AS 1 presentation', 'Revenue recognition — Ind AS 115', 'Leases — Ind AS 116', 'Financial instruments — Ind AS 32, 109', 'Income taxes — Ind AS 12', 'Employee benefits and share-based payments']],
    ['Consolidation & Business Combinations', 'high', ['Business combinations — Ind AS 103', 'Consolidated financial statements — Ind AS 110', 'Associates and joint arrangements', 'Foreign-currency translation — Ind AS 21']],
    ['Analysis & Special Topics', 'medium', ['First-time adoption — Ind AS 101', 'Fair-value measurement — Ind AS 113', 'Integrated and corporate social reporting', 'Analysis of financial statements']],
  ]],
  ['Strategic Financial Management (Group 1)', [
    ['Investment Decisions & Valuation', 'high', ['Capital budgeting under risk', 'Business and equity valuation', 'Mergers, acquisitions and restructuring', 'Startup and private-equity valuation basics']],
    ['Portfolio & Risk Management', 'high', ['Portfolio theory and CAPM', 'Derivatives — futures and options strategies', 'Interest-rate and currency risk management', 'Value at Risk basics']],
    ['Markets & International Finance', 'medium', ['Security analysis and market efficiency', 'Foreign-exchange exposure management', 'International capital budgeting', 'Mutual funds and securitisation']],
  ]],
  ['Advanced Auditing & Professional Ethics (Group 1)', [
    ['Auditing Standards & Procedures', 'high', ['Standards on auditing — planning to reporting', 'Risk assessment and internal control', 'Audit evidence and sampling', 'Audit reports and CARO']],
    ['Special Audits & Ethics', 'medium', ['Audit of banks, insurance and NBFCs', 'Audit under fiscal laws and forensic audit', 'Peer review and quality control', 'Professional ethics — Chartered Accountants Act and schedules']],
  ]],
  ['Corporate & Economic Laws (Group 2)', [
    ['Company Law', 'high', ['Appointment and powers of directors', 'Meetings, resolutions and postal ballot', 'Oppression, mismanagement and winding up', 'Compromises, arrangements and amalgamations', 'NCLT and NCLAT procedures']],
    ['Securities & Economic Laws', 'medium', ['SEBI LODR and ICDR essentials', 'FEMA — current and capital account transactions', 'Insolvency and Bankruptcy Code', 'Prevention of Money Laundering Act', 'Arbitration and conciliation basics']],
  ]],
  ['Strategic Cost Management & Performance Evaluation (Group 2)', [
    ['Strategic Cost Management', 'medium', ['Activity-based and target costing', 'Life-cycle and kaizen costing', 'Theory of constraints and throughput accounting', 'Pricing decisions and strategies']],
    ['Performance Evaluation & Decision Making', 'medium', ['Balanced scorecard and performance measures', 'Transfer pricing', 'Standard costing — advanced variances', 'Relevant costing and decision models', 'Linear programming and learning curves']],
  ]],
  ['Elective Paper (Group 2)', [
    ['Elective Options Overview', 'low', ['Risk management elective themes', 'Financial services and capital markets themes', 'International taxation themes', 'Economic laws and global financial reporting themes', 'Multidisciplinary case-study technique']],
  ]],
  ['Direct Tax Laws & International Taxation (Group 2)', [
    ['Direct Taxes', 'high', ['Income computation under all heads', 'Assessment of companies and MAT', 'TDS, TCS and advance tax', 'Assessment procedures, appeals and penalties', 'Business restructuring taxation']],
    ['International Taxation', 'medium', ['Transfer pricing and arm\u2019s-length principle', 'Double-taxation avoidance agreements', 'Non-resident taxation', 'BEPS and equalisation levy', 'GAAR essentials']],
  ]],
  ['Indirect Tax Laws (Group 2)', [
    ['GST', 'high', ['Supply, levy and composition', 'Input tax credit mechanics', 'Time, place and value of supply', 'Registration, returns and e-way bills', 'Assessment, audit, offences and appeals']],
    ['Customs & FTP', 'medium', ['Customs valuation and duty types', 'Import-export procedures', 'Duty drawback and refunds', 'Foreign Trade Policy essentials']],
  ]],
]);

export const CFA_LEVEL_1: ExamSyllabus = buildExam('cfa_level_1', 'CFA Level 1', 'India', 'Finance', [
  ['Ethical & Professional Standards', [
    ['Ethics & Standards', 'high', ['Code of Ethics and Standards of Professional Conduct', 'Guidance for the seven standards', 'Global Investment Performance Standards (GIPS)', 'Ethics application case questions']],
  ]],
  ['Quantitative Methods', [
    ['Quantitative Foundations', 'medium', ['Time value of money', 'Statistical concepts and return measures', 'Probability concepts', 'Common probability distributions', 'Sampling, estimation and hypothesis testing', 'Correlation and simple linear regression']],
  ]],
  ['Economics', [
    ['Micro, Macro & Global Economics', 'medium', ['Demand-supply analysis and elasticity', 'Firm and market structures', 'Business cycles and aggregate output', 'Monetary and fiscal policy', 'International trade and capital flows', 'Currency exchange rates']],
  ]],
  ['Financial Statement Analysis', [
    ['FSA Core', 'high', ['Income statement, balance sheet and cash-flow analysis', 'Inventories and long-lived assets', 'Income taxes in financial statements', 'Non-current liabilities and leases', 'Financial reporting quality', 'Ratio analysis and forecasting']],
  ]],
  ['Corporate Issuers', [
    ['Corporate Finance Basics', 'medium', ['Corporate governance and ESG', 'Capital budgeting methods', 'Cost of capital', 'Working-capital management', 'Business models and capital structure']],
  ]],
  ['Equity Investments', [
    ['Equity Markets & Valuation', 'high', ['Market organisation and indices', 'Market efficiency', 'Equity valuation — dividend discount and multiplier models', 'Industry and company analysis']],
  ]],
  ['Fixed Income', [
    ['Bond Markets & Analysis', 'high', ['Fixed-income instrument features', 'Bond prices and yield measures', 'Term structure of interest rates', 'Duration and convexity risk measures', 'Asset-backed securities', 'Credit analysis fundamentals']],
  ]],
  ['Derivatives', [
    ['Derivative Instruments', 'low', ['Forward and futures mechanics', 'Options payoffs and moneyness', 'Swaps basics', 'Arbitrage and pricing foundations']],
  ]],
  ['Alternative Investments', [
    ['Alternatives Overview', 'low', ['Private equity and private debt', 'Real estate and infrastructure', 'Hedge-fund strategies', 'Commodities and digital assets']],
  ]],
  ['Portfolio Management & Wealth Planning', [
    ['Portfolio Foundations', 'medium', ['Risk and return — Markowitz framework', 'CAPM and performance measures', 'Portfolio planning and the IPS', 'Behavioral finance basics', 'Risk-management framework']],
  ]],
]);

export const SSC_CGL: ExamSyllabus = buildExam('ssc_cgl', 'SSC CGL', 'India', 'Staff Selection', [
  ['Tier 1 — General Intelligence & Reasoning', [
    ['Analogy, Series & Classification', 'high', ['Word and number analogy', 'Number and alphabet series', 'Odd one out', 'Figure series and analogy']],
    ['Puzzles & Arrangements', 'high', ['Seating arrangements', 'Blood relations and directions', 'Order, ranking and scheduling puzzles', 'Coding-decoding and matrix codes']],
    ['Logic & Non-Verbal', 'medium', ['Syllogisms and Venn diagrams', 'Statement-conclusion reasoning', 'Mirror and water images', 'Paper folding, cutting and embedded figures', 'Dice and cube reasoning']],
  ]],
  ['Tier 1 — General Awareness', [
    ['Static GK', 'high', ['Indian history and culture', 'Geography of India and the world', 'Polity and Constitution', 'Economy basics and schemes', 'Books, awards and important days']],
    ['Science & Current Affairs', 'high', ['Physics and chemistry everyday science', 'Biology — human body and diseases', 'Computer awareness', 'Recent national and international events', 'Sports and appointments']],
  ]],
  ['Tier 1 — Quantitative Aptitude', [
    ['Arithmetic', 'high', ['Percentages, ratio and proportion', 'Averages and ages', 'Profit, loss and discount', 'Simple and compound interest', 'Mixture and alligation', 'Time and work', 'Time, speed and distance']],
    ['Advanced Maths', 'high', ['Algebraic identities and simplification', 'Geometry — triangles and circles', 'Trigonometry and heights-distances', 'Mensuration of 2D and 3D figures', 'Data interpretation sets', 'Number system and surds']],
  ]],
  ['Tier 1 — English Comprehension', [
    ['Grammar & Vocabulary', 'high', ['Error spotting', 'Fill in the blanks', 'Synonyms, antonyms and one-word substitution', 'Idioms and phrases', 'Spelling correction', 'Active-passive and narration']],
    ['Reading & Usage', 'medium', ['Reading comprehension passages', 'Cloze tests', 'Para jumbles', 'Sentence improvement']],
  ]],
  ['Tier 2 — Mathematical Abilities', [
    ['Advanced Quantitative Paper', 'high', ['Number theory and algebra at Tier-2 depth', 'Geometry, mensuration and trigonometry advanced sets', 'Statistics and probability basics', 'Higher-difficulty arithmetic word problems', 'Speed-based DI caselets']],
  ]],
  ['Tier 2 — English Language & Comprehension', [
    ['Advanced English Paper', 'high', ['Long reading-comprehension sets', 'Advanced grammar application', 'Precis-style comprehension questions', 'Vocabulary in context at Tier-2 depth']],
  ]],
  ['Tier 2 — Statistics', [
    ['Statistics Paper (JSO)', 'medium', ['Collection and representation of data', 'Central tendency and dispersion', 'Moments, skewness and kurtosis', 'Correlation and regression', 'Probability theory and distributions', 'Sampling theory and index numbers', 'Time-series analysis', 'Variance analysis']],
  ]],
  ['Tier 2 — General Studies (Finance & Economics)', [
    ['Finance & Accounts', 'medium', ['Fundamental accounting principles', 'Books of accounts and rectification', 'Depreciation, provisions and reserves', 'Financial statements basics']],
    ['Economics & Governance', 'medium', ['CAG and finance commission roles', 'Demand-supply and market forms', 'National income and money-banking', 'Indian economy — reforms and budget', 'Role of IT in governance']],
  ]],
]);
