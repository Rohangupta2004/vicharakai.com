/**
 * US exam catalogue — the 36 AP subjects plus the DAT, as planner ExamDefs.
 *
 * WHY THIS FILE EXISTS: the planner catalogue (../syllabus.ts) already carries
 * SAT, ACT, GRE, GMAT, MCAT and LSAT via ../examCatalog.ts, and their ids there
 * ALREADY match the ids used by the shared `exam_metadata` and
 * `exam_questions_bank` tables ('sat', 'act', 'gre', 'gmat', 'mcat', 'lsat').
 * What was missing was the per-subject AP exams and the DAT, so a US student
 * could only pick the generic "AP Exams" entry and never "AP Calculus AB".
 *
 * IDS ARE THE CONTRACT: every id below is the same string used as
 * exam_metadata.exam_id and exam_questions_bank.exam_id, and it is what lands
 * in zuno_profile.exam when the student picks the exam. Never rename one
 * without migrating both tables.
 *
 * Chapter names follow each course's official College Board units so the
 * planner, the starting-point screen and the AI coach all speak the same
 * language the student's teacher does.
 */
import type { ExamDef, ExamSubject } from '../syllabus';

/** Compact builder: subject name + [chapter, topics] pairs. */
const subj = (name: string, chapters: Array<[string, string[]]>): ExamSubject => ({
  name,
  chapters: chapters.map(([chapterName, topics]) => ({ name: chapterName, topics })),
});

/** Every AP exam sits in early-to-mid May; the day is the usual sitting. */
const ap = (
  id: string,
  name: string,
  blurb: string,
  day: number,
  subjects: ExamSubject[],
): ExamDef => ({
  id,
  name,
  fullName: name,
  blurb,
  target: { label: name, month: 5, day },
  country: 'USA',
  category: 'General',
  subjects,
});

/** The six themes and four skill modes every AP world-language exam uses. */
const languageThemes = (language: string): ExamSubject[] => [
  subj('Interpretive Communication', [
    ['Interpretive Reading', ['Authentic print texts', 'Inferring meaning from context', 'Print and audio texts combined']],
    ['Interpretive Listening', ['Audio reports and interviews', 'Conversations at natural speed', 'Note-taking while listening']],
  ]),
  subj('Presentational & Interpersonal Communication', [
    ['Writing', ['Formal email reply', 'Argumentative essay from three sources', 'Register and cohesion devices']],
    ['Speaking', ['Simulated conversation', 'Cultural comparison presentation', 'Fluency and pronunciation']],
  ]),
  subj('Course Themes', [
    ['Families and Communities', ['Family structures', 'Customs and traditions', 'Community networks']],
    ['Personal and Public Identities', ['Self-image', 'National identity', 'Beliefs and values']],
    ['Beauty and Aesthetics', ['Visual and performing arts', 'Architecture', 'Ideals of beauty']],
    ['Science and Technology', ['Innovation', 'Ethics of technology', 'Health care and medicine']],
    ['Contemporary Life', ['Education and careers', 'Leisure and travel', 'Rites of passage']],
    ['Global Challenges', ['Environment', 'Economic issues', 'Human rights and migration']],
  ]),
  subj(language + ' Language Foundations', [
    ['Grammar in Context', ['Tenses and aspect', 'Subjunctive and mood', 'Agreement and pronouns']],
    ['Vocabulary Building', ['Thematic vocabulary', 'Idiomatic expressions', 'Cognates and false friends']],
  ]),
];

/* ------------------------------------------------------------------ */
/*  AP — Mathematics & Computer Science                                */
/* ------------------------------------------------------------------ */

const AP_MATH_CS: ExamDef[] = [
  ap('ap_calc_ab', 'AP Calculus AB', 'Limits, derivatives, integrals and the Fundamental Theorem', 12, [
    subj('Calculus AB', [
      ['Unit 1: Limits and Continuity', ['Defining limits and limit notation', 'Limits from graphs and tables', 'Algebraic techniques for limits', 'Continuity and types of discontinuity', 'Intermediate Value Theorem']],
      ['Unit 2: Differentiation — Definition and Basic Rules', ['Average and instantaneous rate of change', 'The derivative as a limit', 'Power, sum and difference rules', 'Product and quotient rules', 'Derivatives of trigonometric, exponential and log functions']],
      ['Unit 3: Differentiation — Composite, Implicit and Inverse Functions', ['The chain rule', 'Implicit differentiation', 'Derivatives of inverse functions', 'Higher-order derivatives']],
      ['Unit 4: Contextual Applications of Differentiation', ['Straight-line motion', 'Related rates', 'Linear approximation', 'Indeterminate forms and L Hospital rule']],
      ['Unit 5: Analytical Applications of Differentiation', ['Mean Value Theorem', 'Critical points and the Extreme Value Theorem', 'First and second derivative tests', 'Concavity and inflection points', 'Optimisation problems']],
      ['Unit 6: Integration and Accumulation of Change', ['Riemann sums and trapezoidal sums', 'Definite integrals and accumulation', 'Fundamental Theorem of Calculus', 'u-substitution', 'Properties of definite integrals']],
      ['Unit 7: Differential Equations', ['Slope fields', 'Separation of variables', 'Exponential growth and decay', 'Verifying solutions']],
      ['Unit 8: Applications of Integration', ['Average value of a function', 'Area between curves', 'Volumes with known cross sections', 'Volumes of revolution']],
    ]),
  ]),
  ap('ap_calc_bc', 'AP Calculus BC', 'All of Calculus AB plus series, parametric and polar', 12, [
    subj('Calculus BC', [
      ['Unit 1: Limits and Continuity', ['Limits from graphs and tables', 'Algebraic limit techniques', 'Continuity and discontinuity', 'Intermediate Value Theorem']],
      ['Unit 2: Differentiation — Definition and Basic Rules', ['The derivative as a limit', 'Power, product and quotient rules', 'Derivatives of transcendental functions']],
      ['Unit 3: Differentiation — Composite, Implicit and Inverse Functions', ['Chain rule', 'Implicit differentiation', 'Inverse function derivatives']],
      ['Unit 4: Contextual Applications of Differentiation', ['Motion along a line', 'Related rates', 'Indeterminate forms and L Hospital rule']],
      ['Unit 5: Analytical Applications of Differentiation', ['Mean Value Theorem', 'Derivative tests for extrema', 'Concavity', 'Optimisation']],
      ['Unit 6: Integration and Accumulation of Change', ['Riemann sums', 'Fundamental Theorem of Calculus', 'u-substitution', 'Integration by parts', 'Partial fractions', 'Improper integrals']],
      ['Unit 7: Differential Equations', ['Slope fields', 'Separation of variables', 'Euler method', 'Logistic growth models']],
      ['Unit 8: Applications of Integration', ['Area between curves', 'Volumes of revolution', 'Arc length']],
      ['Unit 9: Parametric, Polar and Vector-Valued Functions', ['Derivatives of parametric equations', 'Vector-valued motion', 'Polar area', 'Arc length in parametric form']],
      ['Unit 10: Infinite Sequences and Series', ['Convergence tests', 'Alternating series and error bounds', 'Ratio test and radius of convergence', 'Taylor and Maclaurin series', 'Lagrange error bound']],
    ]),
  ]),
  ap('ap_stats', 'AP Statistics', 'Data, sampling, probability and statistical inference', 7, [
    subj('Statistics', [
      ['Unit 1: Exploring One-Variable Data', ['Distributions and shape', 'Centre and spread', 'Outliers and boxplots', 'Normal distribution and z-scores']],
      ['Unit 2: Exploring Two-Variable Data', ['Scatterplots and correlation', 'Least-squares regression', 'Residual plots', 'Influential points']],
      ['Unit 3: Collecting Data', ['Sampling methods and bias', 'Experiments versus observational studies', 'Random assignment, blocking and blinding']],
      ['Unit 4: Probability and Random Variables', ['Probability rules', 'Conditional probability and independence', 'Discrete random variables', 'Binomial and geometric distributions']],
      ['Unit 5: Sampling Distributions', ['Sampling distribution of a proportion', 'Sampling distribution of a mean', 'Central Limit Theorem', 'Bias and variability']],
      ['Unit 6: Inference for Proportions', ['Confidence intervals for a proportion', 'Significance tests for a proportion', 'Two-sample proportion procedures']],
      ['Unit 7: Inference for Means', ['t-intervals for a mean', 'One-sample t-tests', 'Two-sample and matched-pairs t-procedures']],
      ['Unit 8: Chi-Square Inference', ['Goodness-of-fit test', 'Test for homogeneity', 'Test for independence']],
      ['Unit 9: Inference for Slopes', ['Confidence interval for a slope', 'Test for a slope', 'Checking regression conditions']],
    ]),
  ]),
  ap('ap_precalc', 'AP Precalculus', 'Function families, trigonometry and modelling', 13, [
    subj('Precalculus', [
      ['Unit 1: Polynomial and Rational Functions', ['Rates of change', 'End behaviour and zeros', 'Polynomial and rational modelling', 'Asymptotes and holes', 'Function transformations']],
      ['Unit 2: Exponential and Logarithmic Functions', ['Arithmetic and geometric sequences', 'Exponential growth and decay models', 'Logarithms and their properties', 'Solving exponential equations', 'Semi-log plots']],
      ['Unit 3: Trigonometric and Polar Functions', ['Radian measure and the unit circle', 'Sinusoidal graphs and transformations', 'Trigonometric identities and equations', 'Inverse trigonometric functions', 'Polar coordinates and graphs']],
      ['Unit 4: Parameters, Vectors and Matrices (not assessed)', ['Parametric functions', 'Vectors', 'Matrices and transformations']],
    ]),
  ]),
  ap('ap_cs_a', 'AP Computer Science A', 'Java programming, objects, arrays and recursion', 6, [
    subj('Computer Science A (Java)', [
      ['Unit 1: Primitive Types', ['Variables and data types', 'Arithmetic expressions and casting', 'Compound assignment operators']],
      ['Unit 2: Using Objects', ['Objects and constructors', 'Calling methods', 'String and Math class methods', 'Wrapper classes']],
      ['Unit 3: Boolean Expressions and if Statements', ['Relational and logical operators', 'if / else if / else', 'De Morgan laws', 'Comparing objects and equals()']],
      ['Unit 4: Iteration', ['while and for loops', 'Nested loops', 'Informal run-time analysis', 'Loop tracing']],
      ['Unit 5: Writing Classes', ['Instance variables and constructors', 'Accessor and mutator methods', 'this keyword and scope', 'static variables and methods']],
      ['Unit 6: Array', ['Array declaration and traversal', 'Enhanced for loops', 'Array algorithms: max, min, sum, search']],
      ['Unit 7: ArrayList', ['ArrayList methods', 'Traversing and modifying an ArrayList', 'Searching and sorting algorithms']],
      ['Unit 8: 2D Array', ['Declaring and initialising 2D arrays', 'Row-major traversal', '2D array algorithms']],
      ['Unit 9: Inheritance', ['extends and superclasses', 'Overriding methods and super', 'Polymorphism and late binding', 'The Object class']],
      ['Unit 10: Recursion', ['Writing recursive methods', 'Tracing recursive calls', 'Recursive searching and sorting']],
    ]),
  ]),
  ap('ap_cs_principles', 'AP Computer Science Principles', 'Big ideas of computing plus the Create task', 15, [
    subj('Computer Science Principles', [
      ['Unit 1: Creative Development', ['Collaboration and program design', 'Development processes', 'Identifying and correcting errors']],
      ['Unit 2: Data', ['Binary and data representation', 'Data compression', 'Extracting information from data', 'Bias in data']],
      ['Unit 3: Algorithms and Programming', ['Variables and assignment', 'Conditionals and Boolean logic', 'Iteration and lists', 'Procedures and abstraction', 'Simulations']],
      ['Unit 4: Computer Systems and Networks', ['The internet and protocols', 'Fault tolerance', 'Parallel and distributed computing']],
      ['Unit 5: Impact of Computing', ['Beneficial and harmful effects', 'The digital divide', 'Computing bias', 'Legal and ethical concerns', 'Safe computing']],
      ['Create Performance Task', ['Choosing a program idea', 'Program code and abstraction', 'Written responses and video']],
    ]),
  ]),
];

/* ------------------------------------------------------------------ */
/*  AP — Sciences                                                      */
/* ------------------------------------------------------------------ */

const AP_SCIENCES: ExamDef[] = [
  ap('ap_bio', 'AP Biology', 'Cells, energetics, heredity, evolution and ecology', 13, [
    subj('Biology', [
      ['Unit 1: Chemistry of Life', ['Water and hydrogen bonding', 'Macromolecule structure and function', 'Nucleic acids', 'Properties of biological molecules']],
      ['Unit 2: Cell Structure and Function', ['Organelles and their roles', 'Cell size and surface-area-to-volume ratio', 'Membrane structure and permeability', 'Passive and active transport', 'Osmosis and tonicity']],
      ['Unit 3: Cellular Energetics', ['Enzyme structure and regulation', 'Cellular respiration', 'Photosynthesis and the Calvin cycle', 'Fitness and molecular diversity']],
      ['Unit 4: Cell Communication and Cell Cycle', ['Signal transduction pathways', 'Feedback mechanisms', 'Mitosis and the cell cycle', 'Cell-cycle regulation and cancer']],
      ['Unit 5: Heredity', ['Meiosis and genetic diversity', 'Mendelian genetics', 'Non-Mendelian inheritance', 'Chromosomal inheritance and pedigrees']],
      ['Unit 6: Gene Expression and Regulation', ['DNA replication', 'Transcription and translation', 'Operons and gene regulation', 'Mutations', 'Biotechnology methods']],
      ['Unit 7: Natural Selection', ['Evidence for evolution', 'Hardy-Weinberg equilibrium', 'Types of selection and genetic drift', 'Speciation and phylogeny', 'Origin of life hypotheses']],
      ['Unit 8: Ecology', ['Behavioural and energy responses', 'Population growth and carrying capacity', 'Community interactions', 'Biodiversity and ecosystem disruption']],
    ]),
  ]),
  ap('ap_chem', 'AP Chemistry', 'Structure, reactions, kinetics, thermodynamics and equilibrium', 5, [
    subj('Chemistry', [
      ['Unit 1: Atomic Structure and Properties', ['Moles and molar mass', 'Mass spectroscopy', 'Electron configuration', 'Photoelectron spectroscopy', 'Periodic trends']],
      ['Unit 2: Compound Structure and Properties', ['Ionic and covalent bonding', 'Lewis diagrams and formal charge', 'VSEPR and hybridisation', 'Resonance', 'Bond polarity']],
      ['Unit 3: Intermolecular Forces and Properties', ['London, dipole and hydrogen bonding', 'Solids, liquids and gases', 'Ideal gas law and kinetic molecular theory', 'Solutions and solubility', 'Beer-Lambert law']],
      ['Unit 4: Chemical Reactions', ['Net ionic equations', 'Stoichiometry and limiting reactants', 'Acid-base and redox reactions', 'Titration calculations']],
      ['Unit 5: Kinetics', ['Reaction rates and rate laws', 'Integrated rate laws and half-life', 'Collision theory and activation energy', 'Reaction mechanisms', 'Catalysis']],
      ['Unit 6: Thermodynamics', ['Endothermic and exothermic processes', 'Calorimetry and heat capacity', 'Enthalpy of formation', 'Hess law and bond enthalpies']],
      ['Unit 7: Equilibrium', ['The equilibrium constant', 'Reaction quotient and direction', 'ICE tables', 'Le Chatelier principle', 'Solubility product Ksp']],
      ['Unit 8: Acids and Bases', ['pH, pOH and Kw', 'Weak acid and base equilibria', 'Titration curves', 'Buffers and Henderson-Hasselbalch', 'Polyprotic acids']],
      ['Unit 9: Applications of Thermodynamics', ['Entropy and spontaneity', 'Gibbs free energy', 'Free energy and the equilibrium constant', 'Electrochemistry and cell potential', 'Electrolysis and Faraday law']],
    ]),
  ]),
  ap('ap_physics_1', 'AP Physics 1', 'Algebra-based mechanics, rotation, oscillations and fluids', 14, [
    subj('Physics 1 (algebra-based)', [
      ['Unit 1: Kinematics', ['Position, velocity and acceleration', 'Motion graphs', 'Uniformly accelerated motion', 'Projectile motion']],
      ['Unit 2: Force and Translational Dynamics', ['Newton three laws', 'Free-body diagrams', 'Friction and normal forces', 'Inclined planes and connected systems', 'Circular motion and centripetal force']],
      ['Unit 3: Work, Energy and Power', ['Work by constant and variable forces', 'Kinetic and potential energy', 'Conservation of energy', 'Power and efficiency']],
      ['Unit 4: Linear Momentum', ['Impulse-momentum theorem', 'Conservation of momentum', 'Elastic and inelastic collisions', 'Centre of mass']],
      ['Unit 5: Torque and Rotational Dynamics', ['Torque and rotational equilibrium', 'Moment of inertia', 'Rotational form of Newton second law', 'Rolling motion']],
      ['Unit 6: Energy and Momentum of Rotating Systems', ['Rotational kinetic energy', 'Angular momentum', 'Conservation of angular momentum']],
      ['Unit 7: Oscillations', ['Simple harmonic motion', 'Mass-spring systems', 'Simple pendulum', 'Energy in oscillating systems']],
      ['Unit 8: Fluids', ['Density and pressure', 'Buoyancy and Archimedes principle', 'Continuity equation', 'Bernoulli principle']],
    ]),
  ]),
  ap('ap_physics_2', 'AP Physics 2', 'Algebra-based thermodynamics, electricity, magnetism and optics', 8, [
    subj('Physics 2 (algebra-based)', [
      ['Unit 1: Thermodynamics', ['Temperature, heat and internal energy', 'Ideal gas law and kinetic theory', 'First and second laws of thermodynamics', 'Heat engines and PV diagrams']],
      ['Unit 2: Electric Force, Field and Potential', ['Coulomb law', 'Electric fields and field lines', 'Electric potential and potential energy', 'Gauss law qualitatively']],
      ['Unit 3: Electric Circuits', ['Current, resistance and resistivity', 'Ohm law and power', 'Series and parallel circuits', 'Kirchhoff rules', 'RC circuit behaviour']],
      ['Unit 4: Magnetism and Electromagnetic Induction', ['Magnetic fields and forces on charges', 'Force on a current-carrying wire', 'Magnetic flux', 'Faraday and Lenz laws']],
      ['Unit 5: Geometric Optics', ['Reflection and refraction', 'Snell law and total internal reflection', 'Mirrors and lenses', 'Ray diagrams and image formation']],
      ['Unit 6: Waves, Sound and Physical Optics', ['Wave properties and superposition', 'Standing waves and resonance', 'Doppler effect', 'Interference and diffraction']],
      ['Unit 7: Modern Physics', ['Photoelectric effect', 'Atomic energy levels and spectra', 'Nuclear decay', 'Mass-energy equivalence']],
    ]),
  ]),
  ap('ap_physics_c_mech', 'AP Physics C: Mechanics', 'Calculus-based mechanics and gravitation', 12, [
    subj('Physics C: Mechanics', [
      ['Unit 1: Kinematics', ['Derivatives and integrals of motion functions', 'Motion in two dimensions', 'Projectile motion with calculus']],
      ['Unit 2: Force and Translational Dynamics', ['Newton laws with calculus', 'Resistive forces and terminal velocity', 'Circular motion dynamics']],
      ['Unit 3: Work, Energy and Power', ['Work as a line integral', 'Potential energy functions and force', 'Conservation of energy']],
      ['Unit 4: Linear Momentum', ['Impulse as an integral of force', 'Centre-of-mass motion', 'Collisions in two dimensions', 'Variable-mass systems']],
      ['Unit 5: Torque and Rotational Dynamics', ['Moment of inertia by integration', 'Rotational dynamics', 'Rolling without slipping', 'Static equilibrium']],
      ['Unit 6: Energy and Momentum of Rotating Systems', ['Rotational kinetic energy', 'Angular momentum and its conservation', 'Gyroscopic behaviour']],
      ['Unit 7: Oscillations', ['Differential equation of simple harmonic motion', 'Physical pendulum', 'Damped oscillations']],
      ['Unit 8: Gravitation', ['Newton law of gravitation', 'Gravitational potential energy', 'Orbits and escape velocity', 'Kepler laws']],
    ]),
  ]),
  ap('ap_physics_c_em', 'AP Physics C: E&M', 'Calculus-based electricity and magnetism', 12, [
    subj('Physics C: Electricity & Magnetism', [
      ['Unit 1: Electric Fields and Electric Potential', ['Coulomb law and superposition', 'Fields of continuous charge distributions', 'Gauss law', 'Electric potential from integration']],
      ['Unit 2: Conductors and Capacitors', ['Electrostatics of conductors', 'Capacitance and dielectrics', 'Energy stored in a capacitor', 'Capacitor networks']],
      ['Unit 3: Electric Circuits', ['Current density and resistivity', 'Kirchhoff rules', 'RC circuit differential equations', 'Power dissipation']],
      ['Unit 4: Magnetic Fields and Forces', ['Force on moving charges and wires', 'Biot-Savart law', 'Ampere law', 'Solenoids and toroids']],
      ['Unit 5: Electromagnetism', ['Magnetic flux', 'Faraday law of induction', 'Lenz law', 'Inductance and LR circuits', 'Maxwell equations overview']],
    ]),
  ]),
  ap('ap_env_sci', 'AP Environmental Science', 'Ecosystems, resources, pollution and global change', 8, [
    subj('Environmental Science', [
      ['Unit 1: The Living World — Ecosystems', ['Biomes and ecosystem structure', 'Biogeochemical cycles', 'Primary productivity', 'Trophic levels and energy flow']],
      ['Unit 2: The Living World — Biodiversity', ['Ecosystem services', 'Island biogeography', 'Ecological tolerance and succession']],
      ['Unit 3: Populations', ['Population growth models', 'Carrying capacity', 'Demographic transition and age structure']],
      ['Unit 4: Earth Systems and Resources', ['Plate tectonics and soil formation', 'Atmospheric structure', 'Watersheds and El Nino']],
      ['Unit 5: Land and Water Use', ['Agricultural practices and irrigation', 'Overfishing and aquaculture', 'Mining and urbanisation', 'Sustainable practices']],
      ['Unit 6: Energy Resources and Consumption', ['Fossil fuels and nuclear power', 'Renewable energy sources', 'Energy efficiency and conservation']],
      ['Unit 7: Atmospheric Pollution', ['Sources of air pollution', 'Photochemical smog and thermal inversion', 'Acid rain', 'Indoor air pollutants']],
      ['Unit 8: Aquatic and Terrestrial Pollution', ['Point and non-point sources', 'Eutrophication and dead zones', 'Solid and hazardous waste', 'Dose-response and bioaccumulation']],
      ['Unit 9: Global Change', ['Ozone depletion', 'Greenhouse gases and climate change', 'Ocean acidification and warming', 'Invasive species and habitat loss']],
    ]),
  ]),
];

/* ------------------------------------------------------------------ */
/*  AP — History, Government & Social Science                          */
/* ------------------------------------------------------------------ */

const AP_SOCIAL: ExamDef[] = [
  ap('ap_us_history', 'AP US History', 'US history 1491 to the present across nine periods', 8, [
    subj('United States History', [
      ['Period 1: 1491-1607', ['Native societies before contact', 'Columbian Exchange', 'Spanish colonisation and the encomienda system']],
      ['Period 2: 1607-1754', ['Chesapeake, New England and Middle colonies', 'Atlantic slave trade', 'Mercantilism and salutary neglect', 'Great Awakening and Enlightenment']],
      ['Period 3: 1754-1800', ['Seven Years War and imperial crisis', 'Declaration of Independence and the Revolution', 'Articles of Confederation', 'Constitution and ratification debate', 'Federalist era and the first parties']],
      ['Period 4: 1800-1848', ['Jefferson and the Louisiana Purchase', 'Market Revolution and transport', 'Jacksonian democracy', 'Second Great Awakening and reform movements', 'Missouri Compromise and sectionalism']],
      ['Period 5: 1844-1877', ['Manifest Destiny and the Mexican-American War', 'Compromises of the 1850s', 'Secession and the Civil War', 'Emancipation and the Reconstruction Amendments', 'Reconstruction and its collapse']],
      ['Period 6: 1865-1898', ['Industrialisation and the railroads', 'Immigration and urbanisation', 'Labour movements and Gilded Age politics', 'Populism and the New South', 'Westward expansion and Native policy']],
      ['Period 7: 1890-1945', ['Progressive Era reforms', 'US imperialism and the First World War', 'The 1920s and cultural change', 'Great Depression and the New Deal', 'Second World War at home and abroad']],
      ['Period 8: 1945-1980', ['Cold War containment and Korea', 'Civil rights movement', 'Great Society and Vietnam', 'The 1970s: Watergate and stagflation']],
      ['Period 9: 1980-present', ['Reagan and conservative resurgence', 'End of the Cold War', 'Globalisation and technology', 'Post-9/11 America']],
    ]),
  ]),
  ap('ap_world_history', 'AP World History: Modern', 'Global history from 1200 CE to the present', 14, [
    subj('World History: Modern', [
      ['Unit 1: The Global Tapestry, c.1200-1450', ['East Asia under the Song', 'Dar al-Islam', 'South and Southeast Asia', 'The Americas and Africa', 'Developments in Europe']],
      ['Unit 2: Networks of Exchange, c.1200-1450', ['The Silk Roads', 'The Mongol Empire', 'Indian Ocean trade', 'Trans-Saharan trade', 'Cultural and environmental consequences']],
      ['Unit 3: Land-Based Empires, c.1450-1750', ['Gunpowder empires', 'Ottoman, Safavid and Mughal states', 'Legitimising and consolidating power', 'Religion and state power']],
      ['Unit 4: Transoceanic Interconnections, c.1450-1750', ['Technological innovations in navigation', 'Columbian Exchange', 'Maritime empires and mercantilism', 'Atlantic slave trade', 'Challenges to state power']],
      ['Unit 5: Revolutions, c.1750-1900', ['Enlightenment thought', 'Atlantic revolutions and nationalism', 'Industrial Revolution and its technologies', 'Reactions to industrial capitalism']],
      ['Unit 6: Consequences of Industrialisation, c.1750-1900', ['State expansion and imperialism', 'Economic imperialism', 'Migration and its effects', 'Resistance to imperialism']],
      ['Unit 7: Global Conflict, c.1900-present', ['Shifting power after 1900', 'The world wars', 'Economic depression and total war', 'Mass atrocities']],
      ['Unit 8: Cold War and Decolonisation, c.1900-present', ['Cold War alignments and proxy wars', 'Decolonisation movements', 'Newly independent states', 'Global resistance and non-alignment']],
      ['Unit 9: Globalisation, c.1900-present', ['Advances in technology and medicine', 'Environmental effects of globalisation', 'Economic and cultural globalisation', 'Movements for rights and reform']],
    ]),
  ]),
  ap('ap_euro_history', 'AP European History', 'Europe from 1450 to the present', 15, [
    subj('European History', [
      ['Unit 1: Renaissance and Exploration', ['Italian and Northern Renaissance', 'Printing and humanism', 'Voyages of exploration', 'Commercial revolution']],
      ['Unit 2: Age of Reformation', ['Luther and Protestantism', 'Calvinism and radical reform', 'Catholic Reformation', 'Wars of religion']],
      ['Unit 3: Absolutism and Constitutionalism', ['French absolutism under Louis XIV', 'English Civil War and Glorious Revolution', 'Eastern European absolutism', 'Balance of power diplomacy']],
      ['Unit 4: Scientific, Philosophical and Political Developments', ['Scientific Revolution', 'The Enlightenment', 'Enlightened absolutism', 'Salons and the public sphere']],
      ['Unit 5: Conflict, Crisis and Reaction', ['French Revolution', 'Napoleonic Europe', 'Congress of Vienna', 'Conservatism and liberalism']],
      ['Unit 6: Industrialisation and Its Effects', ['Industrial Revolution in Britain and beyond', 'Urbanisation and class formation', 'Socialism and Marxism', 'Reform movements']],
      ['Unit 7: Nineteenth-Century Ideologies', ['Nationalism and the unifications of Italy and Germany', 'New imperialism', 'Mass politics', 'Modern thought and the arts']],
      ['Unit 8: Twentieth-Century Global Conflicts', ['First World War and the Russian Revolution', 'Interwar crisis and fascism', 'Second World War and the Holocaust', 'Cold War division of Europe']],
      ['Unit 9: Cold War and Contemporary Europe', ['Decolonisation and European recovery', 'European integration', 'Collapse of communism', 'Migration and contemporary challenges']],
    ]),
  ]),
  ap('ap_us_gov', 'AP US Government & Politics', 'Constitution, branches, rights, ideologies and participation', 4, [
    subj('United States Government & Politics', [
      ['Unit 1: Foundations of American Democracy', ['Democratic ideals and the Declaration', 'Articles of Confederation and the Constitution', 'Federalist and Anti-Federalist debate', 'Separation of powers and checks and balances', 'Federalism in practice']],
      ['Unit 2: Interactions Among Branches', ['Structure and powers of Congress', 'The presidency and executive power', 'The federal judiciary and judicial review', 'The bureaucracy and policy implementation']],
      ['Unit 3: Civil Liberties and Civil Rights', ['First Amendment protections', 'Due process and selective incorporation', 'Equal protection and the civil rights movement', 'The fifteen required Supreme Court cases']],
      ['Unit 4: American Political Ideologies and Beliefs', ['Political socialisation', 'Public opinion polling', 'Ideology and economic policy', 'Ideology and social policy']],
      ['Unit 5: Political Participation', ['Voting rights and voter behaviour', 'Political parties and third parties', 'Interest groups and PACs', 'Elections and campaign finance', 'The media as a linkage institution']],
    ]),
  ]),
  ap('ap_comp_gov', 'AP Comparative Government', 'Politics of China, Iran, Mexico, Nigeria, Russia and the UK', 6, [
    subj('Comparative Government & Politics', [
      ['Unit 1: Political Systems, Regimes and Governments', ['States, nations and sovereignty', 'Democratic and authoritarian regimes', 'Sources of legitimacy', 'Political and economic change']],
      ['Unit 2: Political Institutions', ['Executives and cabinets', 'Unicameral and bicameral legislatures', 'Judiciaries and judicial independence', 'Federal and unitary systems']],
      ['Unit 3: Political Culture and Participation', ['Political values and socialisation', 'Civil society', 'Political participation and protest', 'Social movements']],
      ['Unit 4: Party and Electoral Systems', ['Electoral rules and outcomes', 'Party systems', 'Interest groups', 'Elections in the six course countries']],
      ['Unit 5: Political and Economic Changes', ['Globalisation and sovereignty', 'Economic liberalisation', 'Democratisation and its reversals', 'Human development indicators']],
    ]),
  ]),
  ap('ap_psych', 'AP Psychology', 'Biological bases, cognition, development, social and health', 15, [
    subj('Psychology', [
      ['Research Methods and Statistics', ['Experimental and correlational designs', 'Sampling and random assignment', 'Descriptive statistics and effect size', 'Inferential statistics and p-values', 'Ethical guidelines']],
      ['Unit 1: Biological Bases of Behavior', ['Neurons and neurotransmission', 'Brain structures and functions', 'The endocrine and nervous systems', 'Sleep and consciousness', 'Genetic and evolutionary influences']],
      ['Unit 2: Cognition', ['Sensation and perception', 'Attention and perceptual organisation', 'Memory encoding, storage and retrieval', 'Forgetting and memory distortion', 'Thinking, problem solving and intelligence']],
      ['Unit 3: Development and Learning', ['Physical and cognitive development', 'Piaget, Vygotsky and Erikson', 'Classical conditioning', 'Operant conditioning and reinforcement schedules', 'Observational and cognitive learning']],
      ['Unit 4: Social Psychology and Personality', ['Attribution and attitudes', 'Conformity, obedience and group behaviour', 'Prejudice and altruism', 'Personality theories and assessment', 'Motivation and emotion']],
      ['Unit 5: Mental and Physical Health', ['Stress and coping', 'Classification of psychological disorders', 'Anxiety, mood and psychotic disorders', 'Treatment approaches and therapies', 'Positive psychology and well-being']],
    ]),
  ]),
  ap('ap_macro_econ', 'AP Macroeconomics', 'GDP, inflation, monetary and fiscal policy, trade', 14, [
    subj('Macroeconomics', [
      ['Unit 1: Basic Economic Concepts', ['Scarcity and opportunity cost', 'Production possibilities curve', 'Comparative advantage and trade', 'Supply and demand basics']],
      ['Unit 2: Economic Indicators and the Business Cycle', ['Circular flow and GDP', 'Limitations of GDP', 'Unemployment and its types', 'CPI, inflation and real versus nominal values', 'Business cycle phases']],
      ['Unit 3: National Income and Price Determination', ['Aggregate demand', 'Short-run and long-run aggregate supply', 'Equilibrium and output gaps', 'The spending and tax multipliers']],
      ['Unit 4: The Financial Sector', ['Money and its functions', 'Fractional reserve banking and the money multiplier', 'The money market', 'The loanable funds market', 'Monetary policy tools']],
      ['Unit 5: Long-Run Consequences of Stabilization Policies', ['Short-run and long-run Phillips curves', 'Inflation expectations', 'Crowding out', 'Economic growth and productivity']],
      ['Unit 6: Open Economy — International Trade and Finance', ['Balance of payments accounts', 'Foreign exchange markets', 'Exchange rate determination', 'Effects of appreciation and depreciation']],
    ]),
  ]),
  ap('ap_micro_econ', 'AP Microeconomics', 'Markets, costs, market structures and market failure', 7, [
    subj('Microeconomics', [
      ['Unit 1: Basic Economic Concepts', ['Scarcity, choice and opportunity cost', 'Production possibilities curve', 'Comparative advantage', 'Marginal analysis']],
      ['Unit 2: Supply and Demand', ['Determinants of demand and supply', 'Market equilibrium and disequilibrium', 'Price elasticity of demand and supply', 'Consumer and producer surplus', 'Price controls and taxes']],
      ['Unit 3: Production, Cost and Perfect Competition', ['Production functions and marginal product', 'Short-run and long-run costs', 'Profit maximisation', 'The perfectly competitive firm and market', 'Long-run equilibrium and entry']],
      ['Unit 4: Imperfect Competition', ['Monopoly pricing and deadweight loss', 'Price discrimination', 'Monopolistic competition', 'Oligopoly and game theory']],
      ['Unit 5: Factor Markets', ['Derived demand for labour', 'Marginal revenue product', 'Least-cost hiring rule', 'Monopsony']],
      ['Unit 6: Market Failure and the Role of Government', ['Externalities and Pigouvian remedies', 'Public and private goods', 'Income inequality measures', 'Government intervention and efficiency']],
    ]),
  ]),
  ap('ap_human_geo', 'AP Human Geography', 'Population, culture, politics, agriculture, cities and development', 5, [
    subj('Human Geography', [
      ['Unit 1: Thinking Geographically', ['Maps and map projections', 'Types of geographic data', 'Scale of analysis', 'Regions and spatial concepts']],
      ['Unit 2: Population and Migration', ['Population distribution and density', 'Demographic transition model', 'Population policies', 'Push and pull factors', 'Types of migration']],
      ['Unit 3: Cultural Patterns and Processes', ['Cultural landscapes', 'Diffusion of culture', 'Language and religion patterns', 'Globalisation and cultural change']],
      ['Unit 4: Political Patterns and Processes', ['States, nations and nation-states', 'Colonialism and boundaries', 'Devolution and supranationalism', 'Electoral geography and gerrymandering']],
      ['Unit 5: Agriculture and Rural Land Use', ['Agricultural revolutions', 'Von Thunen model', 'Agribusiness and commodity chains', 'Rural settlement and survey systems']],
      ['Unit 6: Cities and Urban Land Use', ['Urbanisation and world cities', 'Central place theory', 'Concentric, sector and multiple nuclei models', 'Urban sustainability and challenges']],
      ['Unit 7: Industrial and Economic Development', ['Industrial Revolution and location theory', 'Measures of development', 'Rostow and Wallerstein models', 'Sustainable development and the global economy']],
    ]),
  ]),
];

/* ------------------------------------------------------------------ */
/*  AP — English, Languages & Arts                                     */
/* ------------------------------------------------------------------ */

const AP_ARTS_LANGUAGES: ExamDef[] = [
  ap('ap_english_lang', 'AP English Language', 'Rhetorical analysis, argument and synthesis', 12, [
    subj('English Language & Composition', [
      ['Reading: Rhetorical Analysis', ['Rhetorical situation: exigence, audience, purpose', 'Claims, evidence and reasoning', 'Organisation and methods of development', 'Style, diction and syntax']],
      ['Writing: Argument', ['Defensible thesis statements', 'Line of reasoning', 'Evidence and commentary', 'Sophistication of thought']],
      ['Writing: Synthesis', ['Reading and annotating sources', 'Integrating and citing sources', 'Handling counterargument and concession']],
      ['Writing: Rhetorical Analysis Essay', ['Identifying rhetorical choices', 'Explaining the effect on the audience', 'Avoiding device-spotting']],
      ['Language and Conventions', ['Sentence variety and emphasis', 'Punctuation for clarity', 'Modifiers, parallelism and agreement']],
    ]),
  ]),
  ap('ap_english_lit', 'AP English Literature', 'Close reading of poetry, prose fiction and drama', 6, [
    subj('English Literature & Composition', [
      ['Short Fiction', ['Character and motivation', 'Setting and its significance', 'Narration and point of view', 'Structure and contrasts']],
      ['Poetry', ['Figurative language and imagery', 'Structure, form and line breaks', 'Sound, rhythm and metre', 'Speaker and tone']],
      ['Longer Fiction and Drama', ['Character development across a work', 'Plot, conflict and structure', 'Symbol, motif and setting', 'Interpretation and ambiguity']],
      ['Literary Argument', ['Defensible interpretive thesis', 'Textual evidence and commentary', 'Sophistication and complexity']],
      ['Multiple-Choice Reading Skills', ['Line-reference questions', 'Inference and tone questions', 'Function of a passage element']],
    ]),
  ]),
  ap('ap_spanish_lang', 'AP Spanish Language', 'Spanish proficiency across the four communicative modes', 7, languageThemes('Spanish')),
  ap('ap_french_lang', 'AP French Language', 'French proficiency across the four communicative modes', 13, languageThemes('French')),
  ap('ap_german_lang', 'AP German Language', 'German proficiency across the four communicative modes', 15, languageThemes('German')),
  ap('ap_italian_lang', 'AP Italian Language', 'Italian proficiency across the four communicative modes', 15, languageThemes('Italian')),
  ap('ap_chinese_lang', 'AP Chinese Language', 'Mandarin proficiency, fully computer-delivered', 12, languageThemes('Chinese')),
  ap('ap_japanese_lang', 'AP Japanese Language', 'Japanese proficiency, fully computer-delivered', 12, languageThemes('Japanese')),
  ap('ap_spanish_lit', 'AP Spanish Literature', 'Spanish and Latin American literature across six periods', 14, [
    subj('Spanish Literature & Culture', [
      ['La Edad Media y el Siglo de Oro', ['Conde Lucanor and medieval prose', 'Lazarillo de Tormes', 'Cervantes and Don Quijote', 'Golden Age poetry and theatre']],
      ['El siglo XIX', ['Romanticism and Jose Maria Heredia', 'Realism and Emilia Pardo Bazan', 'Modernismo and Ruben Dario']],
      ['La Generacion del 98 y el Vanguardismo', ['Unamuno and the essay', 'Lorca and poetic drama', 'Vanguard poetry']],
      ['El Boom latinoamericano', ['Borges and the fantastic', 'Garcia Marquez and magical realism', 'Rulfo and Cortazar']],
      ['Literatura contemporanea', ['Contemporary short fiction', 'Testimonial and feminist voices', 'Poetry after 1960']],
      ['Analisis literario', ['Literary terms and devices', 'Text and art comparison', 'Writing the analytical essay in Spanish']],
    ]),
  ]),
  ap('ap_latin', 'AP Latin', 'Vergil Aeneid and Caesar Gallic War', 13, [
    subj('Latin', [
      ['Vergil, Aeneid', ['Book 1 required selections', 'Books 2 and 4 required selections', 'Books 6, 8 and 12 required selections', 'Epic conventions and Roman values']],
      ['Caesar, Gallic War', ['Books 1, 4, 5 and 6 required selections', 'Caesar as narrator and general', 'Roman ethnography of the Gauls and Germans']],
      ['Translation Skills', ['Literal translation practice', 'Indirect statement and ablative absolute', 'Subjunctive clauses']],
      ['Literary and Cultural Analysis', ['Scansion of dactylic hexameter', 'Rhetorical figures in Latin', 'Contextual essay writing', 'Sight-passage strategies']],
    ]),
  ]),
  ap('ap_art_history', 'AP Art History', '250 required works across ten global content areas', 5, [
    subj('Art History', [
      ['Global Prehistory and Ancient Mediterranean', ['Prehistoric works', 'Near Eastern and Egyptian art', 'Greek and Roman art']],
      ['Early Europe and Colonial Americas', ['Medieval and Byzantine art', 'Renaissance and Baroque', 'Colonial American works']],
      ['Later Europe and Americas', ['Neoclassicism and Romanticism', 'Realism and Impressionism', 'Modernism to mid-century']],
      ['Indigenous Americas', ['Mesoamerican art', 'Andean art', 'North American Indigenous works']],
      ['Africa and West and Central Asia', ['African sculpture and architecture', 'Islamic art and architecture', 'Textiles and calligraphy']],
      ['South, East and Southeast Asia and the Pacific', ['Buddhist and Hindu art', 'Chinese and Japanese works', 'Oceanic art']],
      ['Global Contemporary', ['Post-1980 works', 'Installation and performance', 'Art and globalisation']],
      ['Skills of Art Historical Analysis', ['Visual analysis and attribution', 'Contextual analysis', 'Comparison essays', 'Using the 250-work image set']],
    ]),
  ]),
  ap('ap_music_theory', 'AP Music Theory', 'Harmony, voice leading, aural skills and sight singing', 12, [
    subj('Music Theory', [
      ['Music Fundamentals: Pitch and Rhythm', ['Notation and clefs', 'Rhythmic values and metre', 'Intervals and inversions', 'Scales and key signatures']],
      ['Music Fundamentals: Chords', ['Triads and inversions', 'Seventh chords', 'Roman numeral analysis', 'Figured bass']],
      ['Harmony and Voice Leading', ['Part writing rules', 'Cadences and phrase structure', 'Non-chord tones', 'Modulation and secondary function']],
      ['Aural Skills', ['Melodic dictation', 'Harmonic dictation', 'Identifying cadences and textures', 'Error detection']],
      ['Sight Singing', ['Solfege and scale-degree singing', 'Reading in major and minor', 'Rhythmic accuracy while singing']],
      ['Form and Analysis', ['Binary and ternary forms', 'Motive and sequence', 'Score-based analysis']],
    ]),
  ]),
  ap('ap_seminar', 'AP Seminar', 'AP Capstone research, argument and team project', 5, [
    subj('Seminar (AP Capstone)', [
      ['Question and Explore', ['Identifying a research question', 'Locating and evaluating sources', 'Recognising gaps in existing work']],
      ['Understand and Analyse Arguments', ['Line of reasoning and evidence', 'Credibility and bias in sources', 'Summarising an argument fairly']],
      ['Evaluate Multiple Perspectives', ['Comparing conflicting accounts', 'Identifying underlying assumptions', 'Cultural and disciplinary lenses']],
      ['Synthesise Ideas', ['Building an evidence-based argument', 'Attribution and citation', 'Resolving contradictory evidence']],
      ['Team, Transform and Transmit', ['Team Project and Presentation', 'Individual Research-Based Essay', 'Oral defence and questioning', 'End-of-course exam practice']],
    ]),
  ]),
  ap('ap_research', 'AP Research', 'Year-long independent research paper and defence', 30, [
    subj('Research (AP Capstone)', [
      ['Scoping the Inquiry', ['Narrowing a research question', 'Literature review', 'Identifying the gap in the field']],
      ['Method and Ethics', ['Choosing an appropriate method', 'Sampling and data collection', 'Research ethics and approvals']],
      ['Analysis and Findings', ['Analysing qualitative data', 'Analysing quantitative data', 'Discussing limitations']],
      ['The Academic Paper', ['Structuring a 4,000-5,000 word paper', 'Discipline-appropriate citation', 'Revising with feedback']],
      ['Presentation and Oral Defense', ['Designing the presentation', 'Anticipating panel questions', 'Process and Reflection Portfolio (PREP)']],
    ]),
  ]),
];

/* ------------------------------------------------------------------ */
/*  Professional-school admissions not already in the catalogue        */
/* ------------------------------------------------------------------ */

const US_PROFESSIONAL: ExamDef[] = [
  {
    id: 'dat',
    name: 'DAT',
    fullName: 'DAT — Dental Admission Test',
    blurb: 'US dental school entrance — sciences, perceptual ability, reading and quant',
    // Offered year-round at Prometric centres, so this is only a neutral
    // default the student replaces on the exam-date screen.
    target: { label: 'DAT', month: 7, day: 1 },
    country: 'USA',
    category: 'Medical',
    subjects: [
      subj('Survey of the Natural Sciences', [
        ['Biology', ['Cell and molecular biology', 'Genetics and heredity', 'Human anatomy and physiology', 'Developmental biology', 'Evolution, ecology and diversity']],
        ['General Chemistry', ['Stoichiometry and gas laws', 'Atomic structure and periodic properties', 'Thermodynamics and kinetics', 'Equilibrium, acids and bases', 'Electrochemistry']],
        ['Organic Chemistry', ['Structure, bonding and nomenclature', 'Stereochemistry', 'Substitution and elimination mechanisms', 'Carbonyl and aromatic reactions', 'Synthesis and spectroscopy']],
      ]),
      subj('Perceptual Ability', [
        ['Perceptual Ability Test', ['Keyhole (apertures)', 'Top-front-end views', 'Angle ranking', 'Hole punching', 'Cube counting', 'Pattern folding']],
      ]),
      subj('Reading Comprehension', [
        ['Science Passages', ['Locating detail under time pressure', 'Tone and author purpose', 'Inference from scientific text', 'Search-and-mark strategy']],
      ]),
      subj('Quantitative Reasoning', [
        ['Quantitative Reasoning', ['Arithmetic and fractions', 'Algebra and equations', 'Probability and statistics', 'Geometry and trigonometry', 'Applied word problems']],
      ]),
    ],
  },
];

/**
 * Every US exam this file adds to the planner catalogue. Consumed by
 * ../syllabus.ts, which appends it to EXAMS — so search, the country filter,
 * getExam, defaultExamDate and the plan generator all keep working unchanged.
 */
export const US_EXAMS: ExamDef[] = [
  ...AP_MATH_CS,
  ...AP_SCIENCES,
  ...AP_SOCIAL,
  ...AP_ARTS_LANGUAGES,
  ...US_PROFESSIONAL,
];

/** The five categories the exam_metadata table uses. */
export type UsExamCategory = 'ap' | 'college_admissions' | 'law' | 'grad' | 'medical';

export interface UsExamGroup {
  category: UsExamCategory;
  label: string;
  /** Planner exam ids, most popular first. */
  examIds: string[];
}

/**
 * The expandable sections the US exam picker shows. AP exams lead with the
 * highest-enrolment subjects so the common picks need no scrolling.
 */
export const US_EXAM_GROUPS: UsExamGroup[] = [
  {
    category: 'ap',
    label: 'AP Exams',
    examIds: [
      'ap_calc_ab',
      'ap_calc_bc',
      'ap_bio',
      'ap_chem',
      'ap_physics_1',
      'ap_us_history',
      'ap_psych',
      'ap_cs_a',
      'ap_stats',
      'ap_english_lang',
      'ap_english_lit',
      'ap_world_history',
      'ap_us_gov',
      'ap_macro_econ',
      'ap_micro_econ',
      'ap_human_geo',
      'ap_env_sci',
      'ap_precalc',
      'ap_cs_principles',
      'ap_physics_2',
      'ap_physics_c_mech',
      'ap_physics_c_em',
      'ap_euro_history',
      'ap_comp_gov',
      'ap_spanish_lang',
      'ap_french_lang',
      'ap_german_lang',
      'ap_italian_lang',
      'ap_chinese_lang',
      'ap_japanese_lang',
      'ap_spanish_lit',
      'ap_latin',
      'ap_art_history',
      'ap_music_theory',
      'ap_seminar',
      'ap_research',
    ],
  },
  { category: 'college_admissions', label: 'College Admissions', examIds: ['sat', 'act'] },
  { category: 'law', label: 'Law School', examIds: ['lsat'] },
  { category: 'grad', label: 'Grad School', examIds: ['gre', 'gmat'] },
  { category: 'medical', label: 'Medical School', examIds: ['mcat', 'dat'] },
];

/** Every exam id reachable from the US picker. */
export const US_EXAM_IDS: string[] = US_EXAM_GROUPS.flatMap((group) => group.examIds);

export function isUsExamId(examId: string | null | undefined): boolean {
  return Boolean(examId) && US_EXAM_IDS.includes(String(examId));
}
