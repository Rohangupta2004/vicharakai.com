/**
 * India — Medical entrance syllabi.
 *  • NEET UG — NMC 2024 syllabus, NCERT-aligned (Physics, Chemistry, Botany, Zoology).
 *  • NEET PG — the 19 pre/para/clinical subjects of the MBBS curriculum.
 *  • INICET — the same 19 subjects plus AIIMS-specific Research Methodology,
 *    Biostatistics and Medical Ethics.
 *  • FMGE — the MCI/NMC screening test for foreign medical graduates.
 */
import { buildExam, type ExamSyllabus, type SubjectSeed } from './syllabusTypes';

export const NEET_UG: ExamSyllabus = buildExam('neet_ug', 'NEET UG', 'India', 'Medical', [
  ['Physics', [
    ['Physics & Measurement', 'low', ['Units and dimensions', 'Significant figures', 'Error analysis', 'Vernier calipers and screw gauge']],
    ['Kinematics', 'medium', ['Motion in one dimension', 'Motion graphs', 'Vectors and relative velocity', 'Projectile motion', 'Uniform circular motion']],
    ['Laws of Motion', 'high', ["Newton's laws and free-body diagrams", 'Friction', 'Dynamics of circular motion', 'Connected-body problems']],
    ['Work, Energy & Power', 'medium', ['Work-energy theorem', 'Potential and kinetic energy', 'Conservation of energy', 'Power', 'Elastic and inelastic collisions']],
    ['Rotational Motion', 'high', ['Centre of mass', 'Torque and angular momentum', 'Moment of inertia', 'Rolling motion', 'Rigid-body equilibrium']],
    ['Gravitation', 'medium', ['Universal law of gravitation', 'Acceleration due to gravity', 'Gravitational potential', 'Satellites and orbital velocity', 'Escape velocity']],
    ['Properties of Solids & Liquids', 'high', ['Elastic behaviour', 'Fluid pressure and buoyancy', 'Continuity and Bernoulli equations', 'Viscosity', 'Surface tension', 'Thermal expansion and calorimetry']],
    ['Thermodynamics', 'high', ['Thermal equilibrium', 'First law of thermodynamics', 'Isothermal and adiabatic processes', 'Second law and heat engines']],
    ['Kinetic Theory of Gases', 'medium', ['Ideal gas equation', 'Kinetic interpretation of temperature', 'RMS speed', 'Degrees of freedom and equipartition']],
    ['Oscillations & Waves', 'high', ['Simple harmonic motion', 'Energy in SHM', 'Pendulum and springs', 'Wave motion and superposition', 'Standing waves and organ pipes', 'Beats and Doppler effect']],
    ['Electrostatics', 'high', ["Coulomb's law", 'Electric field and dipoles', "Gauss's law", 'Electric potential and energy', 'Capacitors and dielectrics']],
    ['Current Electricity', 'high', ['Drift velocity and resistance', 'Series-parallel circuits', "Kirchhoff's laws", 'Wheatstone bridge', 'Potentiometer', 'Electrical power']],
    ['Magnetic Effects of Current & Magnetism', 'high', ['Lorentz force', 'Biot-Savart law', "Ampere's law", 'Force on current-carrying conductors', 'Moving-coil galvanometer', 'Magnetic materials']],
    ['Electromagnetic Induction & AC', 'high', ["Faraday's and Lenz's laws", 'Self and mutual inductance', 'Alternating-current circuits', 'LCR resonance', 'Transformers and generators']],
    ['Electromagnetic Waves', 'low', ['Displacement current', 'Electromagnetic-wave properties', 'Electromagnetic spectrum']],
    ['Optics', 'high', ['Spherical mirrors', 'Refraction and total internal reflection', 'Lenses and optical instruments', 'Prisms and dispersion', "Young's double-slit experiment", 'Diffraction and polarisation']],
    ['Dual Nature of Matter & Radiation', 'medium', ['Photoelectric effect', "Einstein's equation", 'de Broglie waves']],
    ['Atoms & Nuclei', 'high', ['Rutherford model', 'Bohr model and spectra', 'Mass defect and binding energy', 'Radioactive decay', 'Fission and fusion']],
    ['Electronic Devices', 'high', ['Semiconductor energy bands', 'p-n junction diode', 'Rectifiers and Zener diode', 'LED and photodiode', 'Logic gates']],
    ['Experimental Skills', 'low', ['Measurement instruments', 'Graph interpretation', 'Mechanics experiments', 'Electricity experiments', 'Optics experiments']],
  ]],
  ['Chemistry', [
    ['Some Basic Concepts of Chemistry', 'medium', ['Mole concept', 'Stoichiometry', 'Limiting reagent', 'Concentration terms', 'Empirical and molecular formulae']],
    ['Atomic Structure', 'medium', ['Electromagnetic radiation', 'Bohr model', 'Quantum numbers', 'Orbitals and electronic configuration']],
    ['Chemical Bonding & Molecular Structure', 'high', ['Ionic and covalent bonds', 'Lewis structures', 'VSEPR theory', 'Hybridisation', 'Molecular-orbital theory', 'Hydrogen bonding']],
    ['Chemical Thermodynamics', 'medium', ['First law and enthalpy', 'Hess law', 'Entropy', 'Gibbs energy and spontaneity']],
    ['Solutions', 'medium', ['Concentration units', "Raoult's law", 'Colligative properties', "van't Hoff factor"]],
    ['Equilibrium', 'high', ['Equilibrium constants', "Le Chatelier's principle", 'Acid-base equilibrium', 'pH and buffers', 'Salt hydrolysis', 'Solubility product']],
    ['Redox Reactions & Electrochemistry', 'high', ['Oxidation-number method', 'Electrochemical cells', 'Electrode potentials', 'Nernst equation', 'Conductance', 'Electrolysis and corrosion']],
    ['Chemical Kinetics', 'medium', ['Rate laws', 'Order and molecularity', 'Integrated first-order equation', 'Half-life', 'Arrhenius equation']],
    ['Classification & Periodicity', 'medium', ['Periodic table', 'Atomic and ionic radii', 'Ionisation enthalpy', 'Electron gain enthalpy', 'Electronegativity']],
    ['p-Block Elements', 'high', ['Group 13 and 14 chemistry', 'Group 15 and 16 chemistry', 'Halogens', 'Noble gases']],
    ['d- & f-Block Elements', 'high', ['Transition-metal configurations', 'Oxidation states', 'Colour and magnetism', 'Lanthanoids and actinoids']],
    ['Coordination Compounds', 'high', ['Nomenclature', 'Isomerism', 'Bonding theories', 'Crystal-field splitting', 'Applications']],
    ['Purification & Characterisation', 'low', ['Purification methods', 'Qualitative element detection', 'Functional-group tests', 'Quantitative analysis basics']],
    ['General Organic Chemistry', 'high', ['IUPAC nomenclature', 'Structural isomerism', 'Inductive and resonance effects', 'Reaction intermediates', 'Electrophiles and nucleophiles', 'Organic reaction types']],
    ['Hydrocarbons', 'high', ['Alkanes and conformations', 'Alkenes and addition reactions', 'Alkynes and acidic hydrogen', 'Benzene aromaticity', 'Electrophilic aromatic substitution']],
    ['Haloalkanes & Haloarenes', 'medium', ['Preparation of haloalkanes and haloarenes', 'SN1 and SN2 reactions', 'Elimination reactions', 'Reactions of haloarenes', 'Grignard reagents', 'Polyhalogen compounds']],
    ['Alcohols, Phenols & Ethers', 'medium', ['Alcohol preparation and reactions', 'Phenol acidity and substitution', 'Kolbe and Reimer-Tiemann reactions', 'Ether preparation and cleavage']],
    ['Aldehydes, Ketones & Carboxylic Acids', 'high', ['Carbonyl preparation', 'Nucleophilic addition', 'Aldol and Cannizzaro reactions', 'Oxidation-reduction of carbonyls', 'Carboxylic-acid acidity and reactions']],
    ['Amines', 'medium', ['Preparation and basicity of amines', 'Reactions and tests of amines', 'Diazonium salts', 'Azo coupling']],
    ['Biomolecules', 'high', ['Carbohydrates', 'Amino acids and proteins', 'Enzymes and vitamins', 'Nucleic acids']],
    ['Principles Related to Practical Chemistry', 'low', ['Salt analysis', 'Organic functional-group analysis', 'Titrations', 'Preparation and purification experiments']],
  ]],
  ['Botany', [
    ['Diversity in Living World', 'high', ['Taxonomy and binomial nomenclature', 'Five-kingdom classification', 'Monera', 'Protista', 'Fungi', 'Lichens and viruses', 'Algae and bryophytes', 'Pteridophytes and gymnosperms', 'Angiosperm classification']],
    ['Morphology of Flowering Plants', 'medium', ['Root modifications', 'Stem modifications', 'Leaf morphology and phyllotaxy', 'Inflorescence', 'Flower structure and aestivation', 'Fruit and seed', 'Plant-family characters']],
    ['Anatomy of Flowering Plants', 'low', ['Plant tissues', 'Dicot and monocot root anatomy', 'Dicot and monocot stem anatomy', 'Leaf anatomy', 'Secondary growth']],
    ['Cell Structure & Function', 'high', ['Prokaryotic and eukaryotic cells', 'Cell membrane and cell wall', 'Cell organelles', 'Cytoskeleton and cilia', 'Biomolecules of the cell', 'Enzymes', 'Cell cycle', 'Mitosis and meiosis']],
    ['Plant Physiology', 'high', ['Water potential and osmosis', 'Transport in plants', 'Mineral nutrition', 'Photosynthesis', 'Photosynthetic pigments and light reaction', 'Calvin cycle and C4 pathway', 'Photorespiration', 'Plant respiration', 'Plant growth regulators', 'Photoperiodism and vernalisation']],
    ['Sexual Reproduction in Flowering Plants', 'medium', ['Flower and gametophyte development', 'Pollination', 'Double fertilisation', 'Seed and fruit development', 'Apomixis and polyembryony']],
    ['Principles of Inheritance & Variation', 'high', ['Mendelian inheritance', 'Incomplete dominance and codominance', 'Multiple alleles and pleiotropy', 'Chromosomal theory', 'Linkage and recombination', 'Sex determination', 'Mutation and genetic disorders']],
    ['Molecular Basis of Inheritance', 'high', ['DNA and RNA structure', 'DNA replication', 'Transcription', 'Genetic code and translation', 'Gene regulation', 'Human Genome Project', 'DNA fingerprinting']],
    ['Microbes in Human Welfare', 'low', ['Microbes in household products', 'Industrial products', 'Sewage treatment', 'Biogas generation', 'Biocontrol and biofertilisers']],
    ['Biotechnology', 'high', ['Recombinant-DNA tools', 'Cloning vectors and host cells', 'PCR and gel electrophoresis', 'Bioreactors and downstream processing', 'GM crops', 'Medical biotechnology', 'Biopatents and bioethics']],
    ['Ecology & Environment', 'high', ['Organism-environment interactions', 'Population attributes and growth', 'Community interactions', 'Ecosystem productivity', 'Decomposition and energy flow', 'Ecological pyramids and succession', 'Biodiversity patterns', 'Conservation strategies', 'Air and water pollution', 'Climate change and ozone depletion']],
  ]],
  ['Zoology', [
    ['Animal Kingdom', 'high', ['Basis of animal classification', 'Porifera and Cnidaria', 'Platyhelminthes and Aschelminthes', 'Annelida and Arthropoda', 'Mollusca and Echinodermata', 'Hemichordata', 'Chordate classification']],
    ['Structural Organisation in Animals', 'low', ['Animal tissues', 'Frog morphology', 'Frog anatomy and organ systems']],
    ['Digestion & Absorption', 'low', ['Human alimentary canal', 'Digestive glands and enzymes', 'Digestion and absorption of nutrients', 'Digestive disorders']],
    ['Breathing & Exchange of Gases', 'low', ['Human respiratory system', 'Mechanism of breathing', 'Gas exchange and transport', 'Regulation of respiration', 'Respiratory disorders']],
    ['Body Fluids & Circulation', 'medium', ['Blood and lymph', 'Blood groups and coagulation', 'Human heart', 'Cardiac cycle and ECG', 'Double circulation', 'Circulatory disorders']],
    ['Excretory Products & Elimination', 'low', ['Human excretory system', 'Urine formation', 'Osmoregulation', 'Hormonal regulation of kidney function', 'Dialysis and renal disorders']],
    ['Locomotion & Movement', 'low', ['Types of movement', 'Skeletal muscle contraction', 'Human skeleton and joints', 'Muscular and skeletal disorders']],
    ['Neural Control & Coordination', 'medium', ['Neuron and nerve impulse', 'Central and peripheral nervous systems', 'Reflex action', 'Sensory reception', 'Eye and ear']],
    ['Chemical Coordination & Integration', 'medium', ['Endocrine glands', 'Hormone mechanisms', 'Hypothalamus and pituitary hormones', 'Thyroid and adrenal hormones', 'Pancreatic and gonadal hormones', 'Endocrine disorders']],
    ['Human Reproduction', 'medium', ['Male reproductive system', 'Female reproductive system', 'Gametogenesis', 'Menstrual cycle', 'Fertilisation and implantation', 'Pregnancy and parturition', 'Lactation']],
    ['Reproductive Health', 'low', ['Contraception', 'Medical termination of pregnancy', 'Sexually transmitted infections', 'Infertility and assisted reproductive techniques']],
    ['Human Health & Disease', 'medium', ['Pathogens and common diseases', 'Innate and acquired immunity', 'Vaccines and antibodies', 'Allergy and autoimmunity', 'AIDS', 'Cancer', 'Drug and alcohol abuse']],
    ['Evolution', 'medium', ['Origin of life', 'Evidence for evolution', 'Natural selection', 'Hardy-Weinberg equilibrium', 'Adaptive radiation', 'Human evolution']],
    ['Biology & Human Welfare', 'low', ['Animal husbandry', 'Plant breeding principles', 'Single-cell protein', 'Tissue culture']],
  ]],
]);

/* ------------------------------------------------------------------ */
/*  NEET PG / INICET — the 19 MBBS subjects (shared seeds)             */
/* ------------------------------------------------------------------ */

const PG_CLINICAL_SUBJECTS: SubjectSeed[] = [
  ['Anatomy', [
    ['Gross Anatomy', 'medium', ['Upper limb — brachial plexus and applied anatomy', 'Lower limb — gluteal region and femoral triangle', 'Thorax — heart, lungs and mediastinum', 'Abdomen — peritoneum, GI tract and viscera', 'Head and neck — triangles, cranial nerves and pharynx']],
    ['Neuroanatomy', 'medium', ['Spinal cord tracts and lesions', 'Brainstem cross-sections', 'Cerebellum and basal ganglia', 'Blood supply of the brain', 'Ventricular system and CSF']],
    ['Histology & Embryology', 'low', ['Epithelia and glands under the microscope', 'Germ-layer derivatives', 'Branchial arch derivatives', 'Development of heart and great vessels', 'Congenital anomalies of clinical importance']],
  ]],
  ['Physiology', [
    ['General & Nerve-Muscle Physiology', 'medium', ['Transport across membranes', 'Resting membrane and action potentials', 'Neuromuscular transmission', 'Muscle contraction mechanics']],
    ['Cardiovascular & Respiratory Physiology', 'medium', ['Cardiac cycle and output regulation', 'Blood pressure control', 'Lung volumes and compliance', 'Gas transport and V/Q relationships', 'High-altitude and exercise physiology']],
    ['Renal, GI & Endocrine Physiology', 'medium', ['Nephron function and clearance', 'Acid-base regulation', 'GI motility and secretions', 'Hormone mechanisms and feedback axes']],
    ['Neurophysiology', 'low', ['Sensory pathways and receptors', 'Motor system and reflexes', 'Hypothalamus and limbic functions', 'EEG, sleep and higher functions']],
  ]],
  ['Biochemistry', [
    ['Metabolism', 'medium', ['Glycolysis, TCA and oxidative phosphorylation', 'Glycogen and gluconeogenesis disorders', 'Lipid metabolism and ketone bodies', 'Amino-acid metabolism and urea cycle', 'Inborn errors of metabolism']],
    ['Molecular Biology & Genetics', 'medium', ['DNA replication, transcription and translation', 'Regulation of gene expression', 'Molecular techniques — PCR, blotting, sequencing', 'Patterns of inheritance and pedigree analysis']],
    ['Clinical Biochemistry, Vitamins & Minerals', 'low', ['Vitamin deficiencies and toxicities', 'Enzymes in diagnosis', 'Liver, renal and lipid function tests', 'Free radicals and antioxidants']],
  ]],
  ['Pathology', [
    ['General Pathology', 'high', ['Cell injury, necrosis and apoptosis', 'Inflammation and repair', 'Hemodynamic disorders — thrombosis and shock', 'Neoplasia — nomenclature, carcinogenesis and tumor markers', 'Genetic and pediatric disorders']],
    ['Hematology', 'high', ['Anemias — microcytic, macrocytic and hemolytic', 'Leukemias and lymphomas', 'Bleeding and coagulation disorders', 'Blood banking and transfusion medicine']],
    ['Systemic Pathology', 'high', ['Cardiovascular pathology — atherosclerosis and MI', 'Lung pathology — COPD, ILD and carcinoma', 'GI and liver pathology — hepatitis and cirrhosis', 'Renal pathology — glomerulonephritis', 'Breast, endocrine and CNS pathology']],
  ]],
  ['Pharmacology', [
    ['General Pharmacology', 'medium', ['Pharmacokinetics — absorption to clearance', 'Pharmacodynamics and receptor theory', 'Adverse drug reactions and interactions', 'Drug development and pharmacovigilance']],
    ['Autonomic, Cardiovascular & Renal Drugs', 'high', ['Cholinergic and adrenergic drugs', 'Antihypertensives', 'Antianginals and heart-failure drugs', 'Diuretics', 'Antiarrhythmics and hypolipidemics']],
    ['Antimicrobials & Chemotherapy', 'high', ['Beta-lactams and protein-synthesis inhibitors', 'Antitubercular and antileprotic drugs', 'Antifungals and antivirals', 'Antimalarials and anthelmintics', 'Anticancer drugs and immunosuppressants']],
    ['CNS, Endocrine & Autacoid Drugs', 'medium', ['Sedatives, antiepileptics and antiparkinsonian drugs', 'Antipsychotics and antidepressants', 'Opioids and NSAIDs', 'Insulin, oral antidiabetics and thyroid drugs', 'Corticosteroids and sex hormones']],
  ]],
  ['Microbiology', [
    ['Bacteriology', 'medium', ['Gram-positive cocci — staph and strep', 'Enterobacteriaceae and gram-negative rods', 'Mycobacteria', 'Anaerobes and spirochetes', 'Sterilisation and hospital infection control']],
    ['Virology', 'medium', ['Herpes, hepatitis and HIV viruses', 'Respiratory and exanthematous viruses', 'Arboviruses and rabies', 'Viral diagnostics']],
    ['Immunology', 'medium', ['Innate and adaptive immunity', 'Antigen-antibody reactions', 'Hypersensitivity reactions', 'Autoimmunity and immunodeficiency', 'Vaccines and immunoprophylaxis']],
    ['Mycology & Parasitology', 'low', ['Superficial and systemic mycoses', 'Malaria and leishmania', 'Intestinal protozoa and helminths', 'Opportunistic infections']],
  ]],
  ['Forensic Medicine', [
    ['Thanatology & Injuries', 'low', ['Death and postmortem changes', 'Mechanical injuries and wound ballistics', 'Asphyxial deaths', 'Autopsy procedures']],
    ['Toxicology', 'low', ['General management of poisoning', 'Corrosives, insecticides and snake bite', 'Alcohol and drug intoxication', 'Heavy-metal poisoning']],
    ['Medical Jurisprudence', 'low', ['Legal procedure and evidence', 'Medical negligence and consent', 'Sexual offences and their examination', 'Identification and age estimation']],
  ]],
  ['Community Medicine', [
    ['Epidemiology', 'high', ['Study designs — cohort, case-control and RCT', 'Measures of disease frequency and association', 'Screening and diagnostic-test evaluation', 'Outbreak investigation', 'Bias, confounding and causality']],
    ['Biostatistics & Demography', 'medium', ['Sampling methods and sample size', 'Tests of significance', 'Vital statistics and health indicators', 'Census and demographic cycle']],
    ['National Health Programmes', 'high', ['RNTCP/NTEP and vector-borne programmes', 'RCH, immunisation schedule and RMNCH+A', 'NCD and blindness-control programmes', 'Health planning committees and health systems']],
    ['Nutrition, Environment & Occupational Health', 'medium', ['Nutritional assessment and deficiency disorders', 'Water, sanitation and waste management', 'Occupational diseases and their prevention', 'Disaster management basics']],
  ]],
  ['Medicine', [
    ['Cardiology & Respiratory Medicine', 'high', ['Ischaemic heart disease and heart failure', 'Arrhythmias and ECG interpretation', 'Valvular disease and endocarditis', 'Asthma, COPD and ILD', 'Pneumonia and pulmonary embolism']],
    ['Neurology', 'high', ['Stroke syndromes and management', 'Seizures and epilepsy', 'Movement disorders and demyelination', 'Neuropathies and myopathies', 'CNS infections']],
    ['Endocrinology & Metabolism', 'high', ['Diabetes mellitus and its complications', 'Thyroid disorders', 'Adrenal and pituitary disease', 'Dyslipidemia, obesity and electrolyte disorders']],
    ['Gastroenterology, Nephrology & Hematology', 'high', ['GI bleeding and inflammatory bowel disease', 'Chronic liver disease and its complications', 'AKI, CKD and glomerular disease', 'Anemias and hematologic malignancies in practice']],
    ['Infectious Disease & Rheumatology', 'high', ['Tuberculosis and HIV medicine', 'Fever syndromes — malaria, dengue, typhoid', 'Sepsis and antimicrobial stewardship', 'Rheumatoid arthritis, SLE and vasculitides']],
  ]],
  ['Surgery', [
    ['General Surgery & Trauma', 'high', ['Wound healing, sutures and surgical infections', 'Fluid, electrolyte and nutrition support', 'ATLS approach and shock management', 'Burns assessment and management']],
    ['GI & Hepatobiliary Surgery', 'high', ['Acute abdomen and intestinal obstruction', 'Appendix, hernias and abdominal wall', 'Gallstones and biliary disease', 'Colorectal and gastric cancer principles', 'Pancreatitis and its complications']],
    ['Urology, Vascular & Breast Surgery', 'medium', ['Urolithiasis and hematuria workup', 'Prostate disease and urologic cancers', 'Peripheral arterial disease and varicose veins', 'Breast lumps and breast-cancer management']],
    ['Endocrine Surgery & Perioperative Care', 'medium', ['Thyroid swellings and thyroidectomy', 'Parathyroid and adrenal surgical disease', 'Preoperative assessment', 'Postoperative complications']],
  ]],
  ['Obstetrics & Gynaecology', [
    ['Obstetrics — Normal', 'high', ['Antenatal care and fetal surveillance', 'Normal labour and partogram', 'Obstetric anatomy and physiology of pregnancy', 'Puerperium and lactation']],
    ['Obstetrics — Complicated', 'high', ['Hypertensive disorders and eclampsia', 'Antepartum and postpartum hemorrhage', 'Preterm labour and PROM', 'Multiple pregnancy and malpresentations', 'Medical disorders in pregnancy']],
    ['Gynaecology', 'high', ['Menstrual disorders and abnormal uterine bleeding', 'Fibroids, endometriosis and PCOS', 'Genital-tract infections and prolapse', 'Cervical, endometrial and ovarian cancer']],
    ['Contraception & Infertility', 'medium', ['Temporary and permanent contraception', 'Emergency contraception and MTP Act', 'Evaluation of the infertile couple', 'ART principles']],
  ]],
  ['Paediatrics', [
    ['Neonatology', 'high', ['Neonatal resuscitation', 'Neonatal jaundice', 'Sepsis in the newborn', 'Prematurity and low birth weight']],
    ['Growth, Development & Nutrition', 'medium', ['Growth charts and developmental milestones', 'Protein-energy malnutrition management', 'Micronutrient deficiencies', 'Immunisation schedule and AEFI']],
    ['Pediatric Systemic Disease', 'medium', ['Congenital heart disease', 'Childhood asthma and pneumonia', 'Diarrhea and dehydration management', 'Nephrotic syndrome and childhood seizures', 'Genetic syndromes']],
  ]],
  ['Orthopaedics', [
    ['Fractures & Trauma', 'medium', ['Fracture healing and principles of fixation', 'Upper-limb fractures and dislocations', 'Lower-limb and spine injuries', 'Compartment syndrome and fat embolism']],
    ['Bone & Joint Infections and Tumors', 'low', ['Osteomyelitis and septic arthritis', 'Bone TB including spine', 'Benign and malignant bone tumors']],
    ['Cold Orthopaedics', 'low', ['Congenital deformities — CTEV and DDH', 'Osteoarthritis and rheumatoid joint disease', 'Metabolic bone disease — rickets and osteoporosis', 'Nerve injuries and their signs']],
  ]],
  ['Radiology', [
    ['Imaging Modalities', 'low', ['X-ray physics and radiation protection', 'CT, MRI and ultrasound principles', 'Contrast media and reactions', 'Nuclear imaging basics']],
    ['Systemic Radiology', 'medium', ['Chest X-ray signs and patterns', 'Bone and joint imaging signs', 'Abdominal imaging — classic signs', 'Neuroimaging of stroke, bleed and tumors', 'Obstetric ultrasound milestones']],
  ]],
  ['Anaesthesia', [
    ['General Anaesthesia & Airway', 'low', ['Preoperative assessment and ASA grading', 'Induction agents and inhalational anesthetics', 'Muscle relaxants and reversal', 'Airway management and intubation', 'Monitoring under anesthesia']],
    ['Regional Anaesthesia & Critical Care', 'low', ['Spinal and epidural anesthesia', 'Local anesthetics and toxicity', 'CPR guidelines', 'Ventilator basics and oxygen therapy', 'Pain management principles']],
  ]],
  ['Dermatology', [
    ['Papulosquamous Disorders & Infections', 'low', ['Psoriasis and lichen planus', 'Dermatophyte and candidal infections', 'Scabies and pediculosis', 'Bacterial and viral skin infections']],
    ['Vesiculobullous, Pigmentary & Appendageal Disorders', 'low', ['Pemphigus and pemphigoid', 'Vitiligo and melasma', 'Acne and alopecia', 'Drug eruptions including SJS-TEN']],
    ['Leprosy & STIs', 'medium', ['Leprosy classification and reactions', 'Multi-drug therapy of leprosy', 'Syphilis stages and treatment', 'Genital ulcer and discharge syndromes']],
  ]],
  ['Psychiatry', [
    ['Psychotic & Mood Disorders', 'low', ['Schizophrenia — features and management', 'Bipolar disorder and lithium therapy', 'Depression and suicide-risk assessment', 'Electroconvulsive therapy']],
    ['Anxiety, Substance Use & Child Psychiatry', 'low', ['Anxiety, OCD and PTSD', 'Alcohol and opioid dependence', 'Delirium and dementia', 'ADHD, autism and learning disorders', 'Psychotherapy basics']],
  ]],
  ['ENT', [
    ['Ear', 'medium', ['Hearing tests and deafness evaluation', 'CSOM and its complications', 'Otosclerosis and Meniere disease', 'Facial-nerve palsy']],
    ['Nose & Paranasal Sinuses', 'low', ['Epistaxis management', 'Sinusitis and nasal polyps', 'Allergic rhinitis', 'Nasopharyngeal carcinoma and angiofibroma']],
    ['Throat & Larynx', 'medium', ['Tonsillitis and adenoids', 'Hoarseness and vocal-cord lesions', 'Stridor and airway emergencies', 'Head and neck cancers overview']],
  ]],
  ['Ophthalmology', [
    ['Anterior Segment', 'medium', ['Conjunctivitis and red-eye differentials', 'Corneal ulcers and keratitis', 'Cataract types and surgery', 'Refractive errors and correction']],
    ['Glaucoma, Uvea & Retina', 'medium', ['Angle-closure and open-angle glaucoma', 'Uveitis patterns', 'Diabetic retinopathy staging', 'Retinal detachment and vascular occlusions']],
    ['Squint & Neuro-ophthalmology', 'low', ['Strabismus evaluation', 'Pupillary pathway lesions', 'Optic neuritis and papilledema', 'Visual-field defects and their localisation']],
  ]],
];

export const NEET_PG: ExamSyllabus = buildExam('neet_pg', 'NEET PG', 'India', 'Medical', PG_CLINICAL_SUBJECTS);

export const INICET: ExamSyllabus = buildExam('inicet', 'INI-CET', 'India', 'Medical', [
  ...PG_CLINICAL_SUBJECTS,
  ['Research Methodology', [
    ['Research Design & Conduct', 'medium', ['Framing a research question — PICO', 'Study-design selection and hierarchy of evidence', 'Randomisation, blinding and allocation concealment', 'Systematic reviews and meta-analysis basics', 'Critical appraisal of a paper']],
  ]],
  ['Biostatistics', [
    ['Applied Biostatistics', 'medium', ['Types of data and scales of measurement', 'Measures of central tendency and dispersion', 'Normal distribution and confidence intervals', 'Hypothesis testing — t-test, chi-square and ANOVA', 'Correlation, regression and survival analysis', 'Sensitivity, specificity and predictive values']],
  ]],
  ['Medical Ethics', [
    ['Ethics & Professionalism', 'low', ['Autonomy, beneficence, non-maleficence and justice', 'Informed consent and confidentiality', 'Research ethics and institutional review boards', 'End-of-life care and breaking bad news', 'Professional conduct regulations']],
  ]],
]);

export const FMGE: ExamSyllabus = buildExam('fmge', 'FMGE (MCI Screening)', 'India', 'Medical', [
  ['Anatomy', [
    ['High-Yield Gross & Neuroanatomy', 'medium', ['Limb nerve injuries and applied anatomy', 'Thorax and abdomen viscera relations', 'Head-neck triangles and cranial nerves', 'Brainstem lesions and spinal tracts', 'Embryology — arch derivatives and anomalies']],
  ]],
  ['Physiology', [
    ['Systems Physiology Review', 'medium', ['Membrane and nerve-muscle physiology', 'Cardio-respiratory regulation', 'Renal and acid-base physiology', 'Endocrine axes and reproduction', 'CNS — sensory and motor systems']],
  ]],
  ['Biochemistry', [
    ['Metabolism & Molecular Biology Review', 'low', ['Carbohydrate, lipid and protein metabolism', 'Vitamins and inborn errors', 'Molecular biology techniques', 'Clinical enzymology']],
  ]],
  ['Pathology', [
    ['General & Systemic Pathology Review', 'high', ['Cell injury and inflammation', 'Neoplasia and tumor markers', 'Anemias and leukemias', 'Cardiac, lung, GI, liver and renal pathology']],
  ]],
  ['Pharmacology', [
    ['Pharmacology Review', 'medium', ['General pharmacokinetics and dynamics', 'ANS and cardiovascular drugs', 'Antimicrobials and chemotherapy', 'CNS and endocrine drugs', 'Classic adverse effects and antidotes']],
  ]],
  ['Microbiology', [
    ['Microbiology & Immunology Review', 'medium', ['Bacteriology of common pathogens', 'Virology — hepatitis and HIV', 'Parasitology and mycology', 'Immunity and hypersensitivity', 'Sterilisation and biomedical waste']],
  ]],
  ['Forensic Medicine', [
    ['Forensic Review', 'low', ['Postmortem changes and injuries', 'Common poisonings', 'Legal medicine and consent', 'Sexual offences examination']],
  ]],
  ['Community Medicine', [
    ['PSM Review', 'high', ['Epidemiology and study designs', 'Biostatistics essentials', 'National health programmes', 'Immunisation and nutrition', 'Health indicators and demography']],
  ]],
  ['Medicine', [
    ['Internal Medicine Review', 'high', ['Cardiology and ECG essentials', 'Respiratory and GI medicine', 'Neurology and stroke', 'Endocrinology — diabetes and thyroid', 'Infections — TB, HIV and tropical fevers']],
  ]],
  ['Surgery', [
    ['Surgery Review', 'high', ['Trauma and shock', 'Acute abdomen and GI surgery', 'Breast, thyroid and urology essentials', 'Orthopaedic fractures overview', 'Anesthesia and radiology essentials']],
  ]],
  ['Obstetrics & Gynaecology', [
    ['ObGyn Review', 'high', ['Antenatal care and labour', 'Obstetric emergencies', 'Gynaecologic oncology essentials', 'Contraception and infertility']],
  ]],
  ['Paediatrics', [
    ['Paediatrics Review', 'medium', ['Neonatology essentials', 'Growth, development and immunisation', 'Common pediatric illnesses', 'Nutrition disorders of childhood']],
  ]],
  ['Ophthalmology & ENT', [
    ['Eye & ENT Review', 'medium', ['Red eye, cataract and glaucoma', 'Retina and neuro-ophthalmology signs', 'Ear — CSOM and deafness', 'Nose and throat emergencies']],
  ]],
  ['Dermatology & Psychiatry', [
    ['Skin & Mind Review', 'low', ['Leprosy and common dermatoses', 'STIs and drug eruptions', 'Psychosis, mood and anxiety disorders', 'Substance-use disorders']],
  ]],
]);
