/**
 * India — Civil Services and Defence entrance syllabi.
 *  • UPSC CSE — Prelims (GS Paper I + CSAT Paper II), Mains (GS I-IV + Essay)
 *    and a sample of popular optionals (History, Geography, Public
 *    Administration, Sociology).
 *  • MPSC Rajyaseva — Prelims GS + CSAT, Mains GS 1-4 plus the Marathi and
 *    English language papers.
 *  • AFCAT, NDA and CDS — the UPSC/IAF defence-entry patterns.
 */
import { buildExam, type ExamSyllabus } from './syllabusTypes';

export const UPSC_CSE: ExamSyllabus = buildExam('upsc_cse', 'UPSC Civil Services (CSE)', 'India', 'Civil Services', [
  ['Prelims — GS Paper I', [
    ['History & Culture', 'high', ['Ancient India — Indus Valley to Guptas', 'Medieval India — Sultanate, Vijayanagara and Mughals', 'Modern India and colonial economy', 'Freedom struggle and Gandhian movements', 'Indian art, architecture and culture']],
    ['Geography', 'high', ['Physical geography — geomorphology, climatology, oceanography', 'Indian physiography, rivers and monsoon', 'Agriculture, soils and resources', 'World geography and mapping', 'Human and economic geography']],
    ['Polity & Governance', 'high', ['Constitutional framework and Preamble', 'Fundamental Rights, DPSP and Duties', 'Union and state executive-legislature', 'Judiciary and landmark judgments', 'Constitutional and statutory bodies', 'Panchayati Raj and local governance']],
    ['Economy', 'high', ['National income and growth', 'Money, banking and RBI', 'Fiscal policy, budget and taxation', 'External sector and trade', 'Poverty, employment and inclusion', 'Agriculture and food security']],
    ['Environment & Ecology', 'high', ['Ecosystems and biogeochemical cycles', 'Biodiversity and conservation networks', 'Climate change and international conventions', 'Pollution and environmental laws', 'Species and protected areas in news']],
    ['Science & Technology', 'medium', ['Space and defence technology', 'Biotechnology and health tech', 'IT, AI and emerging technologies', 'Energy and nuclear science', 'Everyday science in the news']],
    ['Current Affairs', 'high', ['Government schemes and policies', 'National and international developments', 'Reports, indices and organisations', 'Awards, sports and places in news']],
  ]],
  ['Prelims — CSAT Paper II', [
    ['Comprehension & Communication', 'medium', ['Reading comprehension passages', 'Main idea and inference questions', 'Interpersonal and communication skills']],
    ['Reasoning & Decision Making', 'medium', ['Logical reasoning and analytical ability', 'Syllogisms and statement-conclusion', 'Decision making and problem solving', 'Seating and puzzle arrangements']],
    ['Basic Numeracy & DI', 'medium', ['Number systems and percentages', 'Ratio, averages and interest', 'Time-speed-distance and time-work', 'Tables, charts and data sufficiency']],
  ]],
  ['Mains — GS Paper I', [
    ['Indian Heritage & Culture', 'medium', ['Temple architecture and sculpture', 'Paintings, music and dance forms', 'Literature and philosophical traditions', 'UNESCO sites and cultural institutions']],
    ['Modern Indian History', 'high', ['1857 and its aftermath', 'National movement phases and leaders', 'Partition and integration of states', 'Post-independence consolidation']],
    ['World History', 'medium', ['Industrial and political revolutions', 'World wars and the interwar order', 'Decolonisation and the Cold War', 'Political philosophies — capitalism, socialism, communism']],
    ['Indian Society', 'medium', ['Diversity, caste and communalism', 'Role of women and women\u2019s organisations', 'Population, poverty and urbanisation', 'Globalisation and social change']],
    ['Geography of the World & India', 'high', ['Geophysical phenomena — earthquakes, cyclones, tsunamis', 'Distribution of key natural resources', 'Location of industries and industrial policy', 'Changes in critical geographical features']],
  ]],
  ['Mains — GS Paper II', [
    ['Constitution & Polity', 'high', ['Basic structure and constitutional evolution', 'Separation of powers and federal issues', 'Parliament and state legislatures — functioning', 'Judiciary — structure and reforms', 'Elections and the Representation of the People Act']],
    ['Governance & Transparency', 'high', ['Government policies and their design', 'E-governance and citizen charters', 'RTI, transparency and accountability', 'Civil services and administrative reforms', 'NGOs, SHGs and pressure groups']],
    ['Social Justice', 'medium', ['Welfare schemes for vulnerable sections', 'Health, education and human resources', 'Poverty and hunger — issues and interventions', 'Statutory bodies for protection of rights']],
    ['International Relations', 'high', ['India and its neighbourhood', 'Bilateral and regional groupings', 'Global institutions and their reform', 'Indian diaspora and soft power', 'Effects of developed-country policies on India']],
  ]],
  ['Mains — GS Paper III', [
    ['Economy & Planning', 'high', ['Growth, development and employment', 'Inclusive growth and budgeting', 'Land reforms and agriculture marketing', 'Industrial policy and infrastructure', 'Investment models and PPP']],
    ['Agriculture & Food Management', 'medium', ['Cropping patterns and irrigation', 'MSP, PDS and food security', 'Food processing and supply chains', 'Technology missions and e-technology for farmers']],
    ['Science, Technology & Environment', 'medium', ['Indigenisation and achievements of Indian S&T', 'IT, space, robotics and biotech applications', 'Environmental impact assessment', 'Conservation and pollution control']],
    ['Security & Disaster Management', 'high', ['Internal security — extremism and insurgency', 'Cyber security and money laundering', 'Border management and organised crime', 'Security agencies and their mandate', 'Disaster management framework']],
  ]],
  ['Mains — GS Paper IV (Ethics)', [
    ['Ethics & Human Interface', 'high', ['Essence and consequences of ethics', 'Ethics in public and private relationships', 'Contributions of moral thinkers', 'Attitude — content, structure and function']],
    ['Aptitude & Emotional Intelligence', 'medium', ['Foundational values of civil service', 'Emotional intelligence in administration', 'Social influence and persuasion']],
    ['Probity in Governance', 'high', ['Public service concept and philosophy', 'Codes of ethics and conduct', 'Corruption — causes and remedies', 'Work culture and service delivery quality']],
    ['Case Studies', 'high', ['Stakeholder mapping and ethical dilemmas', 'Conflict of interest situations', 'Whistleblowing and administrative discretion', 'Structuring a case-study answer']],
  ]],
  ['Mains — Essay', [
    ['Essay Craft', 'medium', ['Interpreting philosophical topics', 'Structure — introduction, body, conclusion', 'Evidence, examples and quotations', 'Balancing multiple dimensions', 'Timed essay practice']],
  ]],
  ['Optional Subjects (Samples)', [
    ['History Optional', 'medium', ['Ancient and medieval Indian historiography', 'Modern India — detailed national movement', 'World history from 1500', 'Map work of historical sites']],
    ['Geography Optional', 'medium', ['Geomorphology and climatology (advanced)', 'Human and economic geography theories', 'Geography of India — regional analysis', 'Models, laws and map work']],
    ['Public Administration Optional', 'medium', ['Administrative thought and theories', 'Comparative public administration', 'Indian administration — evolution and issues', 'Public policy and financial administration']],
    ['Sociology Optional', 'medium', ['Sociological thinkers — Marx to Merton', 'Research methods and analysis', 'Indian society — caste, kinship and religion', 'Social change and movements in India']],
  ]],
]);

export const MPSC: ExamSyllabus = buildExam('mpsc', 'MPSC Rajyaseva', 'India', 'Civil Services', [
  ['Prelims — GS Paper I', [
    ['History with Maharashtra Focus', 'high', ['Ancient and medieval India', 'Modern India and the freedom struggle', 'Social reformers of Maharashtra', 'Samyukta Maharashtra movement']],
    ['Geography with Maharashtra Focus', 'high', ['Physical geography fundamentals', 'Geography of Maharashtra — relief, rivers and climate', 'Agriculture and irrigation in Maharashtra', 'Economic geography of India']],
    ['Polity', 'high', ['Indian Constitution essentials', 'State government and Maharashtra administration', 'Panchayati Raj with Maharashtra acts', 'Judiciary and rights']],
    ['Economy & Planning', 'medium', ['Indian economy basics', 'Maharashtra economy and budget', 'Agriculture and cooperatives', 'Government schemes of Maharashtra']],
    ['Environment & Science', 'medium', ['Ecology and biodiversity basics', 'Environmental issues of Maharashtra', 'General science for prelims', 'Science and technology developments']],
    ['Current Affairs', 'high', ['State, national and international events', 'Awards, sports and appointments', 'Schemes and reports in news']],
  ]],
  ['Prelims — CSAT Paper II', [
    ['Comprehension & Reasoning', 'medium', ['Marathi and English comprehension passages', 'Logical reasoning and puzzles', 'Decision making and problem solving']],
    ['Quantitative Aptitude', 'medium', ['Numeracy — percentages, ratios and averages', 'Data interpretation sets', 'Data sufficiency basics']],
  ]],
  ['Mains — GS Paper I (History & Geography)', [
    ['History of Modern India & Maharashtra', 'high', ['British rule and its impact on Maharashtra', 'Social and cultural awakening', 'Freedom movement with regional leaders', 'Post-1960 Maharashtra']],
    ['Geography (Advanced)', 'high', ['Geomorphic processes and Indian physiography', 'Climatology and monsoon mechanics', 'Maharashtra — agro-climatic zones', 'Remote sensing and GIS basics', 'Settlement and urban geography']],
  ]],
  ['Mains — GS Paper II (Polity & Laws)', [
    ['Constitution & Political System', 'high', ['Constitutional framework and amendments', 'Centre-state relations', 'Political parties and pressure groups', 'Electoral process and reforms']],
    ['Laws & Administration', 'medium', ['District administration and land revenue', 'Important central and state acts', 'Human rights framework', 'Administrative tribunals and RTI']],
  ]],
  ['Mains — GS Paper III (HR & Human Rights)', [
    ['Human Resource Development', 'medium', ['Education system and policies', 'Health and nutrition programmes', 'Skill development and employment', 'Rural and urban development schemes']],
    ['Human Rights', 'medium', ['UDHR and Indian mechanisms', 'Rights of vulnerable groups', 'Protection commissions', 'International humanitarian law basics']],
  ]],
  ['Mains — GS Paper IV (Economy & S&T)', [
    ['Economy & Agriculture', 'high', ['Indian and Maharashtra economy structure', 'Public finance and banking', 'Agriculture, cooperation and marketing', 'Poverty and employment programmes']],
    ['Science & Technology', 'medium', ['Energy and environment technology', 'Space and defence developments', 'ICT and e-governance', 'Biotechnology and health']],
  ]],
  ['Marathi Language Paper', [
    ['Marathi Skills', 'medium', ['Essay writing in Marathi', 'Translation — English to Marathi', 'Precis and comprehension', 'Grammar and vocabulary usage']],
  ]],
  ['English Language Paper', [
    ['English Skills', 'medium', ['Essay writing', 'Translation — Marathi to English', 'Precis writing', 'Comprehension and grammar']],
  ]],
]);

export const AFCAT: ExamSyllabus = buildExam('afcat', 'AFCAT', 'India', 'Defence', [
  ['English', [
    ['Verbal Ability', 'high', ['Reading comprehension', 'Synonyms and antonyms', 'Error detection and sentence completion', 'Idioms and phrases', 'Cloze test and vocabulary usage']],
  ]],
  ['General Awareness', [
    ['Static & Current GK', 'high', ['Indian history and freedom struggle', 'Geography of India and the world', 'Polity and Constitution basics', 'Economy and current affairs', 'Defence, sports and awards', 'Basic science in daily life']],
  ]],
  ['Numerical Ability', [
    ['Quantitative Skills', 'high', ['Decimals, fractions and simplification', 'Percentages, ratio and proportion', 'Average and mixture problems', 'Profit-loss and simple interest', 'Time-speed-distance and races', 'Time and work']],
  ]],
  ['Reasoning & Military Aptitude', [
    ['Verbal & Non-Verbal Reasoning', 'high', ['Analogy and odd one out', 'Series completion', 'Venn diagrams and syllogisms', 'Coding-decoding']],
    ['Spatial & Military Aptitude', 'medium', ['Embedded and rotated figures', 'Figure classification and completion', 'Dot situation and paper folding', 'Spatial visualisation drills']],
  ]],
]);

export const NDA: ExamSyllabus = buildExam('nda', 'NDA', 'India', 'Defence', [
  ['Mathematics (Paper I)', [
    ['Algebra', 'high', ['Sets, relations and functions', 'Complex numbers and quadratic equations', 'Sequences and series', 'Permutations, combinations and binomial theorem', 'Logarithms']],
    ['Matrices & Determinants', 'medium', ['Matrix operations', 'Determinants and properties', 'Inverse and solution of linear systems']],
    ['Trigonometry', 'high', ['Ratios, identities and equations', 'Inverse trigonometric functions', 'Heights and distances', 'Properties of triangles']],
    ['Analytical Geometry (2D & 3D)', 'medium', ['Straight lines and circles', 'Conic sections in standard form', 'Direction cosines and planes', 'Sphere basics']],
    ['Calculus', 'high', ['Limits, continuity and differentiability', 'Applications of derivatives', 'Indefinite and definite integration', 'Areas under curves', 'First-order differential equations']],
    ['Vectors', 'medium', ['Vector operations', 'Dot and cross products', 'Applications in geometry and mechanics']],
    ['Statistics & Probability', 'medium', ['Data classification and central tendency', 'Variance and standard deviation', 'Classical probability and conditional probability', 'Binomial distribution']],
  ]],
  ['GAT — English', [
    ['English Proficiency', 'high', ['Grammar and usage', 'Vocabulary — synonyms and antonyms', 'Comprehension passages', 'Sentence arrangement and cohesion', 'Spotting errors']],
  ]],
  ['GAT — Physics', [
    ['Physics Fundamentals', 'medium', ['Motion, force and energy', 'Heat and temperature', 'Sound and wave motion', 'Light — reflection and refraction', 'Electricity and magnetism basics', 'Simple machines and instruments']],
  ]],
  ['GAT — Chemistry', [
    ['Chemistry Fundamentals', 'medium', ['Physical and chemical changes', 'Elements, mixtures and compounds', 'Air, water and oxidation', 'Acids, bases and salts', 'Carbon and its forms', 'Fertilizers and everyday chemistry']],
  ]],
  ['GAT — General Science', [
    ['Life & General Science', 'low', ['Cell and basis of life', 'Human body and epidemics', 'Food and balanced diet', 'Solar system and space basics', 'Eminent scientists and discoveries']],
  ]],
  ['GAT — History & Freedom Movement', [
    ['Indian History & Polity', 'medium', ['Ancient and medieval Indian culture', 'Freedom movement milestones', 'Constitution and governance basics', 'Five-year plans and panchayati raj', 'World history landmarks — renaissance to world wars']],
  ]],
  ['GAT — Geography', [
    ['Physical & Indian Geography', 'medium', ['Earth — latitudes, longitudes and time zones', 'Landforms, weathering and earthquakes', 'Atmosphere, winds and cyclones', 'Ocean currents and tides', 'India — agriculture, minerals and trade centres']],
  ]],
  ['GAT — Current Events', [
    ['Current Affairs', 'medium', ['Recent national events and schemes', 'International developments', 'Sports, awards and cultural events', 'Defence exercises and appointments']],
  ]],
]);

export const CDS: ExamSyllabus = buildExam('cds', 'CDS', 'India', 'Defence', [
  ['English', [
    ['English Proficiency', 'high', ['Reading comprehension', 'Spotting errors', 'Sentence improvement and ordering', 'Synonyms, antonyms and idioms', 'Fill in the blanks and cloze']],
  ]],
  ['General Knowledge', [
    ['History & Polity', 'high', ['Ancient to modern Indian history', 'Freedom struggle', 'Indian Constitution and governance', 'Current national affairs']],
    ['Geography & Economy', 'medium', ['Physical and Indian geography', 'Indian economy fundamentals', 'Agriculture and industries']],
    ['Science & Defence Awareness', 'medium', ['Physics, chemistry and biology basics', 'Science and technology in the news', 'Defence forces, ranks and exercises', 'Sports and awards']],
  ]],
  ['Elementary Mathematics', [
    ['Arithmetic', 'high', ['Number system and HCF-LCM', 'Percentages, profit and loss', 'Ratio, proportion and variation', 'Simple and compound interest', 'Time-work and time-speed-distance']],
    ['Algebra & Trigonometry', 'medium', ['Basic operations and factorisation', 'Linear and quadratic equations', 'Trigonometric ratios and identities', 'Heights and distances']],
    ['Geometry, Mensuration & Statistics', 'medium', ['Lines, angles and triangles', 'Circles and quadrilaterals', 'Areas and volumes of solids', 'Data collection and graphical representation']],
  ]],
]);
