/**
 * Granular syllabus catalogue for VicharakAI's supported competitive exams.
 * Sources follow the standard NTA JEE/NEET syllabuses, UPSC GS I-IV,
 * CAT section conventions, and SSC CGL/CHSL tier syllabuses.
 * Chapters are filters only; students add the granular topics below.
 */

import { EXTRA_EXAMS } from './examCatalog';
import { US_EXAMS } from './data/examsUS';

export interface ExamChapter {
  name: string;
  topics: string[];
}

export interface ExamSubject {
  name: string;
  chapters: ExamChapter[];
}

/** Broad exam category — drives the onboarding search filters (CHANGE 11). */
export type ExamCategory = 'Medical' | 'Engineering' | 'Law' | 'Business' | 'Government' | 'General';

export interface ExamDef {
  id: string;
  name: string;
  fullName: string;
  blurb: string;
  target: { label: string; month: number; day: number };
  subjects: ExamSubject[];
  /** Country the exam belongs to (e.g. "India", "USA") — onboarding filter. */
  country?: string;
  /** Broad category the exam falls under — onboarding filter. */
  category?: ExamCategory;
  /** True for an exam the student typed in themselves (see customExam.ts). */
  custom?: boolean;
  /** Where a typed exam's syllabus came from. */
  syllabusSource?: 'ai' | 'manual';
}

const ch = (name: string, topics: string[]): ExamChapter => ({ name, topics });

const BASE_EXAMS: ExamDef[] = [
  {
    id: 'jee',
    name: 'JEE Main',
    fullName: 'JEE Main',
    blurb: 'Engineering entrance — Physics, Chemistry, Mathematics',
    target: { label: 'JEE Main', month: 1, day: 24 },
    country: 'India',
    category: 'Engineering',
    subjects: [
      {
        name: 'Physics',
        chapters: [
          ch('Units, Dimensions & Errors', ['SI units and unit conversions', 'Dimensional analysis and applications', 'Significant figures and rounding', 'Absolute, relative and percentage errors', 'Vernier calipers and screw gauge']),
          ch('Kinematics', ['Position, displacement and distance', 'Velocity and acceleration graphs', 'Equations of uniformly accelerated motion', 'Relative motion in one and two dimensions', 'Projectile motion', 'Uniform circular motion kinematics']),
          ch('Laws of Motion', ["Newton's laws and free-body diagrams", 'Static and kinetic friction', 'Connected bodies and pulley constraints', 'Banking of roads', 'Centripetal force applications', 'Pseudo force in accelerated frames']),
          ch('Work, Energy & Power', ['Work by constant and variable forces', 'Work-energy theorem', 'Potential energy and conservative forces', 'Conservation of mechanical energy', 'Power and efficiency', 'Spring-block energy problems']),
          ch('Centre of Mass, Momentum & Collisions', ['Centre of mass of particle systems', 'Linear momentum and impulse', 'Conservation of momentum', 'Elastic and inelastic collisions', 'Two-dimensional collisions', 'Centre-of-mass frame']),
          ch('Rotational Motion', ['Angular kinematics', 'Torque and angular momentum', 'Moment of inertia and parallel-axis theorem', 'Rotational dynamics', 'Rolling without slipping', 'Rigid-body equilibrium']),
          ch('Gravitation', ["Newton's law of gravitation", 'Gravitational field and potential', 'Potential energy of gravitating systems', "Kepler's laws", 'Orbital velocity and satellites', 'Escape velocity']),
          ch('Mechanical Properties of Solids', ['Stress, strain and elastic moduli', "Hooke's law and stress-strain curves", 'Elastic energy density', 'Combination of wires']),
          ch('Mechanical Properties of Fluids', ['Fluid pressure and Pascal law', 'Buoyancy and Archimedes principle', 'Equation of continuity', 'Bernoulli theorem and applications', 'Viscosity and terminal velocity', 'Surface tension and capillarity']),
          ch('Thermal Properties of Matter', ['Temperature scales and thermal expansion', 'Calorimetry and change of state', 'Heat conduction', 'Convection and radiation', "Newton's law of cooling"]),
          ch('Thermodynamics', ['Zeroth law and thermal equilibrium', 'First law and internal energy', 'Isothermal and adiabatic processes', 'Heat capacities of gases', 'Second law and entropy', 'Carnot engine and refrigerator']),
          ch('Kinetic Theory of Gases', ['Ideal gas equation', 'Kinetic interpretation of pressure', 'RMS, mean and most probable speeds', 'Degrees of freedom and equipartition', 'Mean free path']),
          ch('Oscillations', ['Simple harmonic motion equation', 'Energy in SHM', 'Spring combinations', 'Simple and physical pendulums', 'Damped and forced oscillations', 'Resonance']),
          ch('Waves', ['Travelling wave equation', 'Superposition and reflection', 'Standing waves in strings', 'Organ pipes', 'Beats', 'Doppler effect in sound']),
          ch('Electrostatics', ["Coulomb's law and superposition", 'Electric field and field lines', 'Electric dipole', 'Electric flux', "Gauss's law and applications", 'Electric potential and potential energy']),
          ch('Capacitance', ['Capacitance of parallel-plate capacitors', 'Series and parallel capacitors', 'Dielectrics and polarisation', 'Energy stored in capacitors', 'Charging and discharging capacitors']),
          ch('Current Electricity', ["Ohm's law and drift velocity", 'Resistivity and temperature dependence', 'Series-parallel resistor networks', "Kirchhoff's junction and loop laws", 'Wheatstone and metre bridge', 'Potentiometer', 'Electrical power and cells']),
          ch('Moving Charges & Magnetism', ['Lorentz force', 'Motion of charged particles in magnetic fields', 'Biot-Savart law', "Ampere's circuital law", 'Force between parallel currents', 'Torque on a current loop', 'Moving-coil galvanometer']),
          ch('Magnetism & Matter', ['Bar magnet as a dipole', "Gauss's law for magnetism", 'Dia-, para- and ferromagnetism', "Earth's magnetism", 'Hysteresis and permanent magnets']),
          ch('Electromagnetic Induction', ["Faraday's laws", "Lenz's law and motional EMF", 'Self and mutual inductance', 'LR transients', 'Eddy currents', 'AC generator']),
          ch('Alternating Current', ['AC voltage and current', 'RMS and average values', 'Reactance and impedance', 'Series LCR resonance', 'Power factor', 'Transformers']),
          ch('Electromagnetic Waves', ["Maxwell's displacement current", 'Properties of electromagnetic waves', 'Electromagnetic spectrum and uses']),
          ch('Ray Optics', ['Reflection by spherical mirrors', 'Refraction and total internal reflection', 'Refraction at spherical surfaces', 'Thin lenses and lens maker formula', 'Prisms and dispersion', 'Microscopes and telescopes']),
          ch('Wave Optics', ["Huygens' principle", "Young's double-slit interference", 'Thin-film interference', 'Single-slit diffraction', 'Polarisation and Brewster law']),
          ch('Dual Nature of Matter & Radiation', ['Photoelectric effect', "Einstein's photoelectric equation", 'de Broglie wavelength', 'Davisson-Germer experiment']),
          ch('Atoms', ['Rutherford scattering', 'Bohr model of hydrogen', 'Hydrogen spectrum', 'Excitation and ionisation energies']),
          ch('Nuclei', ['Nuclear composition and size', 'Mass defect and binding energy', 'Radioactive decay law', 'Alpha, beta and gamma decay', 'Nuclear fission and fusion']),
          ch('Semiconductor Electronics', ['Energy bands in solids', 'Intrinsic and extrinsic semiconductors', 'p-n junction diode', 'Rectifiers and Zener diode', 'LED, photodiode and solar cell', 'Logic gates']),
          ch('Experimental Physics', ['Least count and error propagation', 'Graph plotting and slope interpretation', 'Simple pendulum experiment', "Ohm's law and resistance experiments", 'Focal length experiments', 'Semiconductor characteristic curves']),
        ],
      },
      {
        name: 'Chemistry',
        chapters: [
          ch('Mole Concept & Stoichiometry', ['Mole and molar-mass calculations', 'Empirical and molecular formulae', 'Stoichiometric equations', 'Limiting reagent', 'Percentage yield and purity', 'Molarity, molality and mole fraction']),
          ch('Atomic Structure', ['Electromagnetic radiation and spectra', 'Bohr model and hydrogen spectrum', 'de Broglie relation', 'Heisenberg uncertainty principle', 'Quantum numbers and orbitals', 'Electronic configuration and stability']),
          ch('States of Matter', ['Gas laws and ideal gas equation', 'Dalton law of partial pressures', 'Kinetic molecular theory', 'Real gases and van der Waals equation', 'Liquefaction and critical constants', 'Intermolecular forces in liquids']),
          ch('Chemical Bonding & Molecular Structure', ['Ionic and covalent bonding', 'Lewis structures and formal charge', 'VSEPR shapes', 'Valence-bond theory and hybridisation', 'Molecular-orbital theory', 'Bond order and magnetic behaviour', 'Hydrogen bonding']),
          ch('Chemical Thermodynamics', ['System, surroundings and state functions', 'First law and enthalpy', 'Hess law and bond enthalpy', 'Entropy change', 'Gibbs energy and spontaneity', 'Relation between Gibbs energy and equilibrium']),
          ch('Solutions', ['Concentration units', "Raoult's law", 'Ideal and non-ideal solutions', 'Colligative properties', 'Abnormal molar mass and van’t Hoff factor']),
          ch('Chemical Equilibrium', ['Law of mass action', 'Equilibrium constants Kc and Kp', "Le Chatelier's principle", 'Degree of dissociation', 'Homogeneous and heterogeneous equilibrium']),
          ch('Ionic Equilibrium', ['Acid-base concepts', 'pH of acids and bases', 'Buffer solutions', 'Salt hydrolysis', 'Solubility product', 'Common-ion effect and indicators']),
          ch('Redox Reactions', ['Oxidation number', 'Balancing redox reactions', 'Disproportionation and comproportionation', 'Redox titrations']),
          ch('Electrochemistry', ['Conductance and molar conductivity', "Kohlrausch's law", 'Galvanic and electrolytic cells', 'Standard electrode potentials', 'Nernst equation', 'Electrolysis and Faraday laws', 'Batteries, fuel cells and corrosion']),
          ch('Chemical Kinetics', ['Rate of reaction', 'Rate law and order', 'Integrated zero- and first-order equations', 'Half-life', 'Arrhenius equation', 'Collision theory and catalysts']),
          ch('Surface Chemistry', ['Adsorption and isotherms', 'Catalysis', 'Colloids and emulsions', 'Coagulation and electrophoresis']),
          ch('Classification & Periodicity', ['Modern periodic law', 'Atomic and ionic radii', 'Ionisation enthalpy', 'Electron gain enthalpy', 'Electronegativity', 'Oxidation-state trends']),
          ch('Hydrogen & s-Block Elements', ['Isotopes and hydrides', 'Water and hydrogen peroxide', 'Alkali-metal chemistry', 'Alkaline-earth chemistry', 'Diagonal relationships']),
          ch('p-Block Elements', ['Group 13 compounds and boranes', 'Group 14 compounds and allotropes', 'Group 15 hydrides and oxoacids', 'Group 16 oxides and oxoacids', 'Halogens and interhalogens', 'Noble-gas compounds']),
          ch('d- & f-Block Elements', ['Transition-element configurations', 'Oxidation states and redox chemistry', 'Colour and magnetic properties', 'Catalytic behaviour', 'Lanthanoid contraction', 'Actinoid chemistry']),
          ch('Coordination Compounds', ["Werner's theory and terminology", 'IUPAC nomenclature', 'Structural and stereoisomerism', 'Valence-bond theory', 'Crystal-field splitting', 'Magnetic moment and colour', 'Stability and applications']),
          ch('Metallurgy', ['Concentration of ores', 'Roasting and calcination', 'Thermodynamic principles of extraction', 'Electrolytic reduction', 'Refining methods']),
          ch('Purification & Characterisation of Organic Compounds', ['Crystallisation, sublimation and distillation', 'Chromatography', 'Qualitative element detection', 'Empirical formula from analysis', 'Organic functional-group tests']),
          ch('General Organic Chemistry', ['IUPAC nomenclature', 'Structural and stereoisomerism', 'Inductive effect', 'Resonance and hyperconjugation', 'Homolytic and heterolytic cleavage', 'Carbocations, carbanions and free radicals', 'Acidity and basicity', 'Electrophiles and nucleophiles']),
          ch('Hydrocarbons', ['Alkane preparation and reactions', 'Alkane conformations', 'Alkene preparation and electrophilic addition', 'Ozonolysis and oxidation of alkenes', 'Alkyne preparation and acidic character', 'Benzene aromaticity', 'Electrophilic aromatic substitution']),
          ch('Haloalkanes & Haloarenes', ['Preparation of haloalkanes and haloarenes', 'SN1 and SN2 mechanisms', 'Stereochemistry of nucleophilic substitution', 'Elimination versus substitution', 'Reactions of haloarenes', 'Grignard reagent formation', 'Environmental effects of halogen compounds']),
          ch('Alcohols, Phenols & Ethers', ['Preparation and reactions of alcohols', 'Oxidation and dehydration of alcohols', 'Acidity and reactions of phenols', 'Kolbe and Reimer-Tiemann reactions', 'Williamson ether synthesis', 'Ether cleavage']),
          ch('Aldehydes & Ketones', ['Preparation of carbonyl compounds', 'Nucleophilic addition', 'Aldol condensation', 'Cannizzaro reaction', 'Oxidation and reduction', 'Carbonyl identification tests']),
          ch('Carboxylic Acids & Derivatives', ['Acidity of carboxylic acids', 'Preparation and reactions of acids', 'Esterification and hydrolysis', 'Acid chlorides, anhydrides and amides', 'Hell-Volhard-Zelinsky reaction']),
          ch('Amines & Diazonium Salts', ['Classification and basicity of amines', 'Preparation and reactions of amines', 'Hinsberg and carbylamine tests', 'Diazotisation', 'Reactions of diazonium salts', 'Azo coupling']),
          ch('Biomolecules', ['Carbohydrate structures and reactions', 'Amino acids and proteins', 'Enzymes', 'Vitamins', 'DNA and RNA']),
          ch('Polymers & Chemistry in Everyday Life', ['Addition and condensation polymers', 'Copolymerisation', 'Biodegradable polymers', 'Drug classifications', 'Soaps and detergents']),
          ch('Practical Chemistry', ['Acid-base and redox titrations', 'Salt analysis', 'Organic functional-group analysis', 'Preparation of inorganic compounds', 'Kinetic and thermochemical experiments']),
        ],
      },
      {
        name: 'Mathematics',
        chapters: [
          ch('Sets, Relations & Functions', ['Set operations and Venn diagrams', 'Cartesian products', 'Equivalence relations', 'Domain, range and graphs of functions', 'Composite and inverse functions', 'Even, odd and periodic functions']),
          ch('Complex Numbers', ['Algebra of complex numbers', 'Argand-plane geometry', 'Modulus and argument', 'Polar form and De Moivre theorem', 'Roots of unity', 'Locus problems']),
          ch('Quadratic Equations', ['Roots and discriminant', 'Relations between roots and coefficients', 'Nature and location of roots', 'Quadratic inequalities', 'Common roots and parameter problems']),
          ch('Matrices & Determinants', ['Matrix operations', 'Determinant properties', 'Minors and cofactors', 'Adjoint and inverse', 'Rank of a matrix', 'Systems of linear equations']),
          ch('Permutations & Combinations', ['Fundamental counting principle', 'Permutations with restrictions', 'Permutations with repetition', 'Circular permutations', 'Combinations and identities', 'Distribution of objects']),
          ch('Binomial Theorem', ['General and middle terms', 'Greatest binomial term', 'Binomial coefficient identities', 'Multinomial expansion', 'Binomial approximations']),
          ch('Sequences & Series', ['Arithmetic progressions', 'Geometric progressions', 'Harmonic progression and means', 'Arithmetico-geometric series', 'Telescoping series', 'Sigma notation and standard sums']),
          ch('Trigonometry', ['Trigonometric ratios and identities', 'Compound and multiple angles', 'Trigonometric equations', 'Inverse trigonometric functions', 'Properties of triangles', 'Heights and distances']),
          ch('Straight Lines', ['Slope and line equations', 'Angle between lines', 'Distance from a point to a line', 'Pair and family of lines', 'Angle bisectors']),
          ch('Circles', ['Circle equations', 'Tangent and normal', 'Chord of contact', 'Radical axis', 'Family of circles']),
          ch('Conic Sections', ['Parabola standard forms', 'Ellipse standard forms', 'Hyperbola standard forms', 'Parametric coordinates', 'Tangents and normals', 'Chord and focal properties']),
          ch('Limits & Continuity', ['Algebraic and trigonometric limits', 'Exponential and logarithmic limits', 'Continuity at a point', 'Types of discontinuity', "L'Hospital-type limit methods"]),
          ch('Differentiability', ['Derivative from first principles', 'Chain, product and quotient rules', 'Implicit differentiation', 'Logarithmic differentiation', 'Parametric derivatives', 'Higher-order derivatives']),
          ch('Applications of Derivatives', ['Tangents and normals', 'Increasing and decreasing functions', 'Local and absolute extrema', 'Maxima-minima word problems', "Rolle's and mean-value theorems", 'Rate-of-change problems']),
          ch('Indefinite Integration', ['Standard antiderivatives', 'Substitution', 'Integration by parts', 'Partial fractions', 'Trigonometric integrals', 'Reduction formulae']),
          ch('Definite Integration & Area', ['Properties of definite integrals', 'Fundamental theorem of calculus', 'Definite integral evaluation', 'Area bounded by curves']),
          ch('Differential Equations', ['Order and degree', 'Formation of differential equations', 'Variable-separable equations', 'Homogeneous equations', 'First-order linear equations']),
          ch('Vectors', ['Vector algebra', 'Dot and cross products', 'Scalar and vector triple products', 'Vector equations and applications']),
          ch('Three-Dimensional Geometry', ['Direction ratios and cosines', 'Lines in three dimensions', 'Planes', 'Angles between lines and planes', 'Distance of a point from a plane', 'Shortest distance between skew lines']),
          ch('Probability', ['Classical probability', 'Conditional probability', "Bayes' theorem", 'Independent events', 'Random variables', 'Binomial distribution']),
          ch('Statistics', ['Mean and weighted mean', 'Variance and standard deviation', 'Combined variance', 'Measures of dispersion']),
          ch('Mathematical Reasoning', ['Statements and logical connectives', 'Implication and equivalence', 'Contradiction and converse', 'Quantifiers and valid arguments']),
        ],
      },
    ],
  },
  {
    id: 'neet',
    name: 'NEET',
    fullName: 'NEET UG',
    blurb: 'Medical entrance — Physics, Chemistry, Botany & Zoology',
    target: { label: 'NEET', month: 5, day: 3 },
    country: 'India',
    category: 'Medical',
    subjects: [
      {
        name: 'Physics',
        chapters: [
          ch('Physics & Measurement', ['Units and dimensions', 'Significant figures', 'Error analysis', 'Vernier calipers and screw gauge']),
          ch('Kinematics', ['Motion in one dimension', 'Motion graphs', 'Vectors and relative velocity', 'Projectile motion', 'Uniform circular motion']),
          ch('Laws of Motion', ["Newton's laws and free-body diagrams", 'Friction', 'Dynamics of circular motion', 'Connected-body problems']),
          ch('Work, Energy & Power', ['Work-energy theorem', 'Potential and kinetic energy', 'Conservation of energy', 'Power', 'Elastic and inelastic collisions']),
          ch('Rotational Motion', ['Centre of mass', 'Torque and angular momentum', 'Moment of inertia', 'Rolling motion', 'Rigid-body equilibrium']),
          ch('Gravitation', ['Universal law of gravitation', 'Acceleration due to gravity', 'Gravitational potential', 'Satellites and orbital velocity', 'Escape velocity']),
          ch('Properties of Solids & Liquids', ['Elastic behaviour', 'Fluid pressure and buoyancy', 'Continuity and Bernoulli equations', 'Viscosity', 'Surface tension', 'Thermal expansion and calorimetry']),
          ch('Thermodynamics', ['Thermal equilibrium', 'First law of thermodynamics', 'Isothermal and adiabatic processes', 'Second law and heat engines']),
          ch('Kinetic Theory of Gases', ['Ideal gas equation', 'Kinetic interpretation of temperature', 'RMS speed', 'Degrees of freedom and equipartition']),
          ch('Oscillations & Waves', ['Simple harmonic motion', 'Energy in SHM', 'Pendulum and springs', 'Wave motion and superposition', 'Standing waves and organ pipes', 'Beats and Doppler effect']),
          ch('Electrostatics', ["Coulomb's law", 'Electric field and dipoles', "Gauss's law", 'Electric potential and energy', 'Capacitors and dielectrics']),
          ch('Current Electricity', ['Drift velocity and resistance', 'Series-parallel circuits', "Kirchhoff's laws", 'Wheatstone bridge', 'Potentiometer', 'Electrical power']),
          ch('Magnetic Effects of Current & Magnetism', ['Lorentz force', 'Biot-Savart law', "Ampere's law", 'Force on current-carrying conductors', 'Moving-coil galvanometer', 'Magnetic materials']),
          ch('Electromagnetic Induction & AC', ["Faraday's and Lenz's laws", 'Self and mutual inductance', 'Alternating-current circuits', 'LCR resonance', 'Transformers and generators']),
          ch('Electromagnetic Waves', ['Displacement current', 'Electromagnetic-wave properties', 'Electromagnetic spectrum']),
          ch('Optics', ['Spherical mirrors', 'Refraction and total internal reflection', 'Lenses and optical instruments', 'Prisms and dispersion', "Young's double-slit experiment", 'Diffraction and polarisation']),
          ch('Dual Nature of Matter & Radiation', ['Photoelectric effect', "Einstein's equation", 'de Broglie waves']),
          ch('Atoms & Nuclei', ['Rutherford model', 'Bohr model and spectra', 'Mass defect and binding energy', 'Radioactive decay', 'Fission and fusion']),
          ch('Electronic Devices', ['Semiconductor energy bands', 'p-n junction diode', 'Rectifiers and Zener diode', 'LED and photodiode', 'Logic gates']),
          ch('Experimental Skills', ['Measurement instruments', 'Graph interpretation', 'Mechanics experiments', 'Electricity experiments', 'Optics experiments']),
        ],
      },
      {
        name: 'Chemistry',
        chapters: [
          ch('Some Basic Concepts of Chemistry', ['Mole concept', 'Stoichiometry', 'Limiting reagent', 'Concentration terms', 'Empirical and molecular formulae']),
          ch('Atomic Structure', ['Electromagnetic radiation', 'Bohr model', 'Quantum numbers', 'Orbitals and electronic configuration']),
          ch('Chemical Bonding & Molecular Structure', ['Ionic and covalent bonds', 'Lewis structures', 'VSEPR theory', 'Hybridisation', 'Molecular-orbital theory', 'Hydrogen bonding']),
          ch('Chemical Thermodynamics', ['First law and enthalpy', 'Hess law', 'Entropy', 'Gibbs energy and spontaneity']),
          ch('Solutions', ['Concentration units', "Raoult's law", 'Colligative properties', 'van’t Hoff factor']),
          ch('Equilibrium', ['Equilibrium constants', "Le Chatelier's principle", 'Acid-base equilibrium', 'pH and buffers', 'Salt hydrolysis', 'Solubility product']),
          ch('Redox Reactions & Electrochemistry', ['Oxidation-number method', 'Electrochemical cells', 'Electrode potentials', 'Nernst equation', 'Conductance', 'Electrolysis and corrosion']),
          ch('Chemical Kinetics', ['Rate laws', 'Order and molecularity', 'Integrated first-order equation', 'Half-life', 'Arrhenius equation']),
          ch('Classification & Periodicity', ['Periodic table', 'Atomic and ionic radii', 'Ionisation enthalpy', 'Electron gain enthalpy', 'Electronegativity']),
          ch('p-Block Elements', ['Group 13 and 14 chemistry', 'Group 15 and 16 chemistry', 'Halogens', 'Noble gases']),
          ch('d- & f-Block Elements', ['Transition-metal configurations', 'Oxidation states', 'Colour and magnetism', 'Lanthanoids and actinoids']),
          ch('Coordination Compounds', ['Nomenclature', 'Isomerism', 'Bonding theories', 'Crystal-field splitting', 'Applications']),
          ch('Purification & Characterisation', ['Purification methods', 'Qualitative element detection', 'Functional-group tests', 'Quantitative analysis basics']),
          ch('General Organic Chemistry', ['IUPAC nomenclature', 'Structural isomerism', 'Inductive and resonance effects', 'Reaction intermediates', 'Electrophiles and nucleophiles', 'Organic reaction types']),
          ch('Hydrocarbons', ['Alkanes and conformations', 'Alkenes and addition reactions', 'Alkynes and acidic hydrogen', 'Benzene aromaticity', 'Electrophilic aromatic substitution']),
          ch('Haloalkanes & Haloarenes', ['Preparation of haloalkanes and haloarenes', 'SN1 and SN2 reactions', 'Elimination reactions', 'Reactions of haloarenes', 'Grignard reagents', 'Polyhalogen compounds']),
          ch('Alcohols, Phenols & Ethers', ['Alcohol preparation and reactions', 'Phenol acidity and substitution', 'Kolbe and Reimer-Tiemann reactions', 'Ether preparation and cleavage']),
          ch('Aldehydes, Ketones & Carboxylic Acids', ['Carbonyl preparation', 'Nucleophilic addition', 'Aldol and Cannizzaro reactions', 'Oxidation-reduction of carbonyls', 'Carboxylic-acid acidity and reactions']),
          ch('Amines', ['Preparation and basicity of amines', 'Reactions and tests of amines', 'Diazonium salts', 'Azo coupling']),
          ch('Biomolecules', ['Carbohydrates', 'Amino acids and proteins', 'Enzymes and vitamins', 'Nucleic acids']),
          ch('Principles Related to Practical Chemistry', ['Salt analysis', 'Organic functional-group analysis', 'Titrations', 'Preparation and purification experiments']),
        ],
      },
      {
        name: 'Biology',
        chapters: [
          ch('Diversity in Living World', ['Taxonomy and binomial nomenclature', 'Five-kingdom classification', 'Monera', 'Protista', 'Fungi', 'Lichens and viruses', 'Algae and bryophytes', 'Pteridophytes and gymnosperms', 'Angiosperm classification']),
          ch('Morphology of Flowering Plants', ['Root modifications', 'Stem modifications', 'Leaf morphology and phyllotaxy', 'Inflorescence', 'Flower structure and aestivation', 'Fruit and seed', 'Plant-family characters']),
          ch('Anatomy of Flowering Plants', ['Plant tissues', 'Dicot and monocot root anatomy', 'Dicot and monocot stem anatomy', 'Leaf anatomy', 'Secondary growth']),
          ch('Cell Structure & Function', ['Prokaryotic and eukaryotic cells', 'Cell membrane and cell wall', 'Cell organelles', 'Cytoskeleton and cilia', 'Biomolecules', 'Enzymes', 'Cell cycle', 'Mitosis and meiosis']),
          ch('Plant Physiology', ['Water potential and osmosis', 'Transport in plants', 'Mineral nutrition', 'Photosynthesis', 'Photosynthetic pigments and light reaction', 'Calvin cycle and C4 pathway', 'Photorespiration', 'Plant respiration', 'Plant growth regulators', 'Photoperiodism and vernalisation']),
          ch('Sexual Reproduction in Flowering Plants', ['Flower and gametophyte development', 'Pollination', 'Double fertilisation', 'Seed and fruit development', 'Apomixis and polyembryony']),
          ch('Principles of Inheritance & Variation', ['Mendelian inheritance', 'Incomplete dominance and codominance', 'Multiple alleles and pleiotropy', 'Chromosomal theory', 'Linkage and recombination', 'Sex determination', 'Mutation and genetic disorders']),
          ch('Molecular Basis of Inheritance', ['DNA and RNA structure', 'DNA replication', 'Transcription', 'Genetic code and translation', 'Gene regulation', 'Human Genome Project', 'DNA fingerprinting']),
          ch('Evolution', ['Origin of life', 'Evidence for evolution', 'Natural selection', 'Hardy-Weinberg equilibrium', 'Adaptive radiation', 'Human evolution']),
          ch('Microbes in Human Welfare', ['Microbes in household products', 'Industrial products', 'Sewage treatment', 'Biogas production', 'Biocontrol and biofertilisers']),
          ch('Biotechnology', ['Recombinant-DNA tools', 'Cloning vectors and host cells', 'PCR and gel electrophoresis', 'Bioreactors and downstream processing', 'GM crops', 'Medical biotechnology', 'Biopatents and bioethics']),
          ch('Ecology & Environment', ['Organism-environment interactions', 'Population attributes and growth', 'Community interactions', 'Ecosystem productivity', 'Decomposition and energy flow', 'Ecological pyramids and succession', 'Biodiversity patterns', 'Conservation strategies', 'Air and water pollution', 'Climate change and ozone depletion']),
          ch('Animal Kingdom', ['Basis of animal classification', 'Porifera and Cnidaria', 'Platyhelminthes and Aschelminthes', 'Annelida and Arthropoda', 'Mollusca and Echinodermata', 'Hemichordata', 'Chordate classification']),
          ch('Structural Organisation in Animals', ['Animal tissues', 'Frog morphology', 'Frog anatomy and organ systems']),
          ch('Digestion & Absorption', ['Human alimentary canal', 'Digestive glands and enzymes', 'Digestion and absorption of nutrients', 'Digestive disorders']),
          ch('Breathing & Exchange of Gases', ['Human respiratory system', 'Mechanism of breathing', 'Gas exchange and transport', 'Regulation of respiration', 'Respiratory disorders']),
          ch('Body Fluids & Circulation', ['Blood and lymph', 'Blood groups and coagulation', 'Human heart', 'Cardiac cycle and ECG', 'Double circulation', 'Circulatory disorders']),
          ch('Excretory Products & Elimination', ['Human excretory system', 'Urine formation', 'Osmoregulation', 'Hormonal regulation of kidney function', 'Dialysis and renal disorders']),
          ch('Locomotion & Movement', ['Types of movement', 'Skeletal muscle contraction', 'Human skeleton and joints', 'Muscular and skeletal disorders']),
          ch('Neural Control & Coordination', ['Neuron and nerve impulse', 'Central and peripheral nervous systems', 'Reflex action', 'Sensory reception', 'Eye and ear']),
          ch('Chemical Coordination & Integration', ['Endocrine glands', 'Hormone mechanisms', 'Hypothalamus and pituitary hormones', 'Thyroid and adrenal hormones', 'Pancreatic and gonadal hormones', 'Endocrine disorders']),
          ch('Human Reproduction', ['Male reproductive system', 'Female reproductive system', 'Gametogenesis', 'Menstrual cycle', 'Fertilisation and implantation', 'Pregnancy and parturition', 'Lactation']),
          ch('Reproductive Health', ['Contraception', 'Medical termination of pregnancy', 'Sexually transmitted infections', 'Infertility and assisted reproduction']),
          ch('Human Health & Disease', ['Pathogens and common diseases', 'Innate and acquired immunity', 'Vaccines and antibodies', 'Allergy and autoimmunity', 'AIDS', 'Cancer', 'Drug and alcohol abuse']),
          ch('Biology & Human Welfare', ['Animal husbandry', 'Plant breeding principles', 'Single-cell protein', 'Tissue culture']),
        ],
      },
    ],
  },
  {
    id: 'upsc',
    name: 'UPSC',
    fullName: 'UPSC Civil Services — General Studies',
    blurb: 'Prelims and Mains GS I-IV — society, governance, economy, security, ethics & more',
    target: { label: 'UPSC Prelims', month: 5, day: 24 },
    country: 'India',
    category: 'Government',
    subjects: [
      {
        name: 'History & Culture',
        chapters: [
          ch('Ancient India', ['Indus Valley civilisation', 'Vedic society and polity', 'Mahajanapadas and Buddhism-Jainism', 'Mauryan administration and Ashokan policy', 'Post-Mauryan kingdoms', 'Gupta age', 'Sangam age and South India']),
          ch('Medieval India', ['Early medieval regional kingdoms', 'Delhi Sultanate', 'Vijayanagara and Bahmani kingdoms', 'Mughal polity and administration', 'Maratha state', 'Bhakti and Sufi movements']),
          ch('Modern India', ['European trading companies', 'British conquest and expansion', 'Land-revenue systems', 'Economic impact of colonial rule', 'Socio-religious reform movements', 'Tribal and peasant movements', 'Revolt of 1857']),
          ch('Freedom Struggle', ['Early associations and formation of INC', 'Moderates and extremists', 'Swadeshi and revolutionary movements', 'Home Rule and Lucknow Pact', 'Gandhian mass movements', 'Constitutional developments 1909-1935', 'Subhas Bose and INA', 'Partition and independence']),
          ch('Post-Independence India', ['Integration of princely states', 'Linguistic reorganisation', 'Planning and agrarian change', 'Political developments after 1964', 'Emergency and democratic restoration']),
          ch('World History', ['Industrial Revolution', 'American and French revolutions', 'World wars', 'Colonialism and decolonisation', 'Russian Revolution', 'Capitalism, socialism and communism', 'Redrawing national boundaries']),
          ch('Indian Art & Culture', ['Temple architecture', 'Indo-Islamic architecture', 'Sculpture and paintings', 'Classical and folk dances', 'Indian music traditions', 'Literature, philosophy and religions', 'UNESCO heritage and cultural institutions']),
        ],
      },
      {
        name: 'Geography',
        chapters: [
          ch('Physical Geography', ['Earth interior and geological time', 'Plate tectonics', 'Earthquakes and volcanoes', 'Weathering and erosion', 'Fluvial, glacial, aeolian and coastal landforms']),
          ch('Climatology', ['Atmospheric composition and structure', 'Insolation and heat budget', 'Pressure belts and planetary winds', 'Air masses and fronts', 'Tropical and temperate cyclones', 'Jet streams', 'Climate classifications']),
          ch('Oceanography', ['Ocean-floor relief', 'Temperature and salinity', 'Ocean currents', 'Waves and tides', 'Coral reefs', 'El Niño, La Niña and IOD']),
          ch('Indian Physical Geography', ['Himalayas and northern plains', 'Peninsular plateau', 'Indian desert and islands', 'Coasts and coastal plains', 'Himalayan rivers', 'Peninsular rivers']),
          ch('Indian Climate & Resources', ['Indian monsoon mechanism', 'Western disturbances and cyclones', 'Soils of India', 'Natural vegetation', 'Water resources', 'Mineral and energy resources']),
          ch('Agriculture & Industry Geography', ['Cropping seasons and patterns', 'Major crops and regions', 'Irrigation and watershed management', 'Industrial location factors', 'Major industrial regions', 'Transport corridors']),
          ch('Human & Economic Geography', ['Population distribution and migration', 'Urbanisation', 'Human settlements', 'Primary-secondary-tertiary activities', 'World resource distribution', 'Trade and transport networks']),
          ch('Geophysical Phenomena', ['Earthquakes and tsunamis', 'Cyclones and storm surges', 'Landslides', 'Changes in glaciers and ice caps', 'Critical geographical features']),
        ],
      },
      {
        name: 'Indian Society',
        chapters: [
          ch('Social Structure', ['Salient features of Indian society', 'Diversity and pluralism', 'Caste and class', 'Tribal communities', 'Kinship, family and marriage']),
          ch('Women & Social Empowerment', ['Women’s movements', 'Gender inequality and violence', 'Political and economic participation', 'Self-help groups', 'Empowerment of vulnerable sections']),
          ch('Population & Urbanisation', ['Population trends and demographic dividend', 'Migration', 'Urbanisation problems and remedies', 'Poverty and developmental issues']),
          ch('Social Change', ['Globalisation and Indian society', 'Communalism', 'Regionalism', 'Secularism', 'Social media and social change']),
        ],
      },
      {
        name: 'Polity & Governance',
        chapters: [
          ch('Constitutional Foundations', ['Historical underpinnings', 'Constituent Assembly', 'Salient features and sources', 'Preamble', 'Union and territory', 'Citizenship', 'Basic-structure doctrine']),
          ch('Rights, Duties & Directive Principles', ['Fundamental Rights', 'Constitutional remedies and writs', 'Directive Principles', 'Fundamental Duties', 'Rights issues and landmark judgments']),
          ch('Union Government', ['President and Vice-President', 'Prime Minister and Council of Ministers', 'Parliament composition and officers', 'Legislative procedure', 'Budget and financial procedure', 'Parliamentary committees', 'Privileges and anti-defection']),
          ch('Judiciary', ['Supreme Court jurisdiction', 'High Courts', 'Subordinate judiciary', 'Judicial review', 'Judicial activism and PIL', 'Tribunals', 'Judicial appointments and reforms']),
          ch('Federalism', ['Legislative relations', 'Administrative relations', 'Financial relations', 'Inter-state relations', 'Emergency provisions', 'Special provisions for states', 'GST Council']),
          ch('State & Local Government', ['Governor', 'Chief Minister and State Council', 'State legislature', 'Panchayati Raj', 'Urban local bodies', 'Finance and devolution']),
          ch('Constitutional & Statutory Bodies', ['Election Commission', 'CAG', 'UPSC and State PSCs', 'Finance Commission', 'National commissions', 'Lokpal and Lokayuktas', 'Information commissions', 'Regulatory bodies']),
          ch('Governance & Public Administration', ['Transparency and accountability', 'Right to Information', 'Citizen charters', 'E-governance', 'Civil-service role and reforms', 'NGOs, SHGs and pressure groups', 'Social audit']),
          ch('Social Justice', ['Welfare schemes for vulnerable groups', 'Health policy and systems', 'Education policy', 'Human-resource development', 'Issues of hunger and poverty', 'Mechanisms and institutions for protection']),
        ],
      },
      {
        name: 'International Relations',
        chapters: [
          ch('India & Neighbourhood', ['India-Pakistan relations', 'India-China relations', 'India-Bangladesh relations', 'India-Nepal and Bhutan relations', 'India-Sri Lanka and Maldives relations', 'Myanmar and Afghanistan']),
          ch('Bilateral & Regional Groupings', ['India-US relations', 'India-Russia relations', 'India-EU relations', 'India-Japan and Australia relations', 'ASEAN and Indo-Pacific', 'QUAD, BRICS and SCO', 'SAARC and BIMSTEC']),
          ch('Global Institutions & Diaspora', ['United Nations and reform', 'WTO, IMF and World Bank', 'International treaties and forums', 'Indian diaspora', 'Global issues affecting India']),
        ],
      },
      {
        name: 'Economy & Agriculture',
        chapters: [
          ch('National Income & Development', ['GDP, GVA and national-income accounting', 'Growth versus development', 'Human-development measures', 'Inclusive growth', 'Employment and unemployment']),
          ch('Money, Banking & Monetary Policy', ['Money supply and liquidity', 'RBI functions', 'Monetary-policy instruments', 'Inflation and indices', 'Banking structure', 'NPAs and banking reforms', 'Digital payments and financial inclusion']),
          ch('Fiscal Policy & Public Finance', ['Union Budget', 'Revenue and capital accounts', 'Fiscal deficits', 'Taxation and GST', 'Public debt', 'FRBM framework', 'Centre-state finances']),
          ch('External Sector', ['Balance of payments', 'Exchange-rate systems', 'Foreign-exchange reserves', 'FDI and FPI', 'Trade policy', 'Current-account deficit', 'International economic institutions']),
          ch('Planning, Infrastructure & Investment', ['Planning in India and NITI Aayog', 'Investment models and PPP', 'Transport infrastructure', 'Energy infrastructure', 'Digital infrastructure', 'Logistics and industrial corridors']),
          ch('Industry & Services', ['Industrial policy', 'MSMEs', 'Manufacturing initiatives', 'Service-sector trends', 'Startups and innovation', 'Competition and disinvestment']),
          ch('Agriculture', ['Land reforms', 'Cropping patterns', 'Irrigation', 'Agricultural inputs', 'MSP and procurement', 'Agricultural marketing and e-NAM', 'PDS and food security', 'Food processing', 'Animal husbandry and fisheries']),
          ch('Poverty & Inclusion', ['Poverty estimation', 'Inequality', 'Employment programmes', 'Social-sector expenditure', 'Financial inclusion', 'Demographic dividend']),
        ],
      },
      {
        name: 'Environment & Ecology',
        chapters: [
          ch('Ecology Fundamentals', ['Ecosystem structure and function', 'Food chains and webs', 'Ecological pyramids', 'Biogeochemical cycles', 'Ecological succession', 'Population and community ecology']),
          ch('Biodiversity', ['Levels and values of biodiversity', 'Biodiversity hotspots', 'Endemic and threatened species', 'IUCN categories', 'In-situ and ex-situ conservation', 'Protected areas and community reserves']),
          ch('Climate Change', ['Greenhouse gases and warming', 'Climate impacts and adaptation', 'Mitigation and carbon markets', 'UNFCCC, Kyoto and Paris Agreement', 'India’s NDC and climate missions', 'IPCC assessments']),
          ch('Environmental Pollution', ['Air pollution', 'Water and marine pollution', 'Soil and noise pollution', 'Solid and hazardous waste', 'Plastic and e-waste', 'Bioremediation']),
          ch('Environmental Governance', ['Environment Protection Act', 'Wildlife Protection Act', 'Forest laws', 'Biological Diversity Act', 'Environmental Impact Assessment', 'NGT and pollution-control boards', 'International environmental conventions']),
        ],
      },
      {
        name: 'Science & Technology',
        chapters: [
          ch('Space Technology', ['Launch vehicles', 'Satellite orbits and applications', 'Navigation systems', 'Planetary and human-spaceflight missions', 'Private space ecosystem']),
          ch('Defence Technology', ['Missile systems', 'Radar and electronic warfare', 'Unmanned systems', 'Defence indigenisation', 'Nuclear doctrine basics']),
          ch('Biotechnology & Health', ['Genomics and gene editing', 'Vaccines and immunology', 'Stem cells', 'GM crops and biosafety', 'Antimicrobial resistance', 'Public-health technologies']),
          ch('Digital & Emerging Technology', ['Artificial intelligence and machine learning', 'Quantum technology', 'Blockchain and virtual digital assets', 'Semiconductors', '5G and 6G', 'Cyber-physical systems and robotics']),
          ch('Energy & Nuclear Science', ['Nuclear fission and fusion', 'India’s nuclear programme', 'Solar, wind and storage', 'Hydrogen economy', 'Biofuels', 'Critical minerals']),
          ch('Intellectual Property & Innovation', ['Patents and IPR regimes', 'Technology transfer', 'Research institutions', 'Science policy and innovation ecosystem']),
        ],
      },
      {
        name: 'Internal Security',
        chapters: [
          ch('Security Challenges', ['Terrorism and radicalisation', 'Insurgency in the Northeast', 'Left-wing extremism', 'Border management', 'Organised crime and trafficking']),
          ch('Cyber & Information Security', ['Cyber threats and critical infrastructure', 'Data protection', 'Social media and internal security', 'Money laundering', 'Cryptocurrency-linked crime']),
          ch('Security Architecture', ['Security forces and agencies', 'Intelligence coordination', 'Coastal security', 'Police reforms', 'Development-security linkage']),
        ],
      },
      {
        name: 'Disaster Management',
        chapters: [
          ch('Disaster-Risk Framework', ['Hazard, vulnerability and risk', 'Prevention and mitigation', 'Preparedness and early warning', 'Response, recovery and reconstruction', 'Sendai Framework']),
          ch('Disaster Governance', ['Disaster Management Act', 'NDMA, SDMA and district authorities', 'National Disaster Response Force', 'Community-based disaster management', 'Urban resilience']),
          ch('Major Hazards', ['Earthquake risk', 'Floods and urban flooding', 'Cyclones and storm surges', 'Droughts and heat waves', 'Landslides and avalanches', 'Industrial and biological disasters']),
        ],
      },
      {
        name: 'Ethics, Integrity & Aptitude',
        chapters: [
          ch('Ethics & Human Interface', ['Essence and determinants of ethics', 'Consequences of ethical action', 'Dimensions of ethics', 'Ethics in private and public relationships', 'Lessons from moral thinkers']),
          ch('Attitude & Aptitude', ['Content and structure of attitude', 'Moral and political attitudes', 'Social influence and persuasion', 'Civil-service aptitude and foundational values']),
          ch('Emotional Intelligence', ['Components of emotional intelligence', 'Application in administration', 'Empathy, compassion and tolerance']),
          ch('Public-Service Values', ['Integrity and impartiality', 'Objectivity and non-partisanship', 'Dedication to public service', 'Probity in governance', 'Codes of ethics and conduct']),
          ch('Probity & Governance', ['Public-service concept', 'Philosophical basis of governance', 'Transparency and RTI', 'Citizen charters', 'Work culture and quality of service', 'Corruption challenges']),
          ch('Ethics Case Studies', ['Stakeholder identification', 'Ethical dilemmas', 'Conflict of interest', 'Administrative decision-making', 'Whistleblowing', 'Corporate and environmental ethics']),
        ],
      },
      {
        name: 'Current Affairs',
        chapters: [
          ch('National Issues', ['Government policies and legislation', 'Supreme Court and constitutional developments', 'Social-sector developments', 'Economy and budget updates']),
          ch('International Issues', ['Major geopolitical developments', 'International organisations and summits', 'India’s bilateral relations', 'Global economic developments']),
          ch('Science, Environment & Places in News', ['Science and technology developments', 'Species and protected areas in news', 'Climate and disaster events', 'Maps and locations in news']),
        ],
      },
      {
        name: 'CSAT',
        chapters: [
          ch('Comprehension', ['Reading comprehension', 'Main idea and inference', 'Tone and argument analysis']),
          ch('Interpersonal & Communication Skills', ['Communication principles', 'Interpersonal situations', 'Conflict-resolution scenarios']),
          ch('Logical Reasoning', ['Statements and conclusions', 'Assumptions and arguments', 'Syllogisms', 'Analytical puzzles', 'Data sufficiency']),
          ch('Decision Making & Problem Solving', ['Administrative decision situations', 'Ethical decision making', 'Prioritisation and problem solving']),
          ch('General Mental Ability', ['Series and analogies', 'Coding and classification', 'Directions, relations and ranking']),
          ch('Basic Numeracy', ['Number systems', 'Percentages and ratios', 'Averages', 'Profit, loss and interest', 'Time, speed and distance', 'Time and work']),
          ch('Data Interpretation', ['Tables', 'Bar and line graphs', 'Pie charts', 'Data comparison and estimation']),
        ],
      },
    ],
  },
  {
    id: 'cat',
    name: 'CAT',
    fullName: 'CAT — Common Admission Test',
    blurb: 'MBA entrance — VARC, DILR & Quantitative Aptitude',
    target: { label: 'CAT', month: 11, day: 29 },
    country: 'India',
    category: 'Business',
    subjects: [
      {
        name: 'VARC',
        chapters: [
          ch('Reading Comprehension', ['Main idea and central theme', 'Direct-detail questions', 'Inference questions', 'Author tone and attitude', 'Purpose and passage structure', 'Vocabulary in context', 'Fact versus opinion', 'Application and extrapolation']),
          ch('RC Passage Genres', ['Philosophy and humanities passages', 'Social-science passages', 'Science and technology passages', 'Economics and business passages', 'History and culture passages', 'Abstract and literary passages']),
          ch('Para Jumbles', ['Sentence-link identification', 'Opening and closing sentences', 'Mandatory pairs', 'Four-sentence TITA para jumbles']),
          ch('Para Summary', ['Central-idea compression', 'Scope and tone matching', 'Elimination of distortions', 'Summary practice sets']),
          ch('Odd Sentence Out', ['Paragraph-coherence mapping', 'Odd-sentence elimination', 'TITA odd-one-out sets']),
          ch('Sentence Placement & Completion', ['Best sentence placement', 'Paragraph completion', 'Logical bridge sentences']),
          ch('Critical Reasoning', ['Assumptions and conclusions', 'Strengthen and weaken arguments', 'Paradox resolution', 'Inference and evaluation']),
          ch('Language Skills', ['Contextual vocabulary', 'Grammar in context', 'Sentence correction', 'Usage and verbal analogies']),
        ],
      },
      {
        name: 'DILR',
        chapters: [
          ch('Tables, Charts & Graphs', ['Tables and missing data', 'Bar charts', 'Line graphs', 'Pie charts', 'Radar and scatter charts', 'Mixed-chart sets']),
          ch('Data Caselets', ['Paragraph caselets', 'Reasoning-based data caselets', 'Data comparison and approximation', 'Growth-rate and percentage sets']),
          ch('Arrangements', ['Linear seating', 'Circular seating', 'Grid and matrix arrangements', 'Multi-variable arrangements', 'Ordering and ranking']),
          ch('Grouping, Selection & Distribution', ['Team selection', 'Grouping with conditions', 'Object distribution', 'Matching and allocation']),
          ch('Games & Tournaments', ['Round-robin tournaments', 'Knockout tournaments', 'League tables', 'Scoring and ranking', 'Wins-losses-draws constraints']),
          ch('Routes & Networks', ['Network paths', 'Routes and connectivity', 'Maps and spatial constraints', 'Max-flow style reasoning']),
          ch('Scheduling & Sequencing', ['Timetables', 'Event scheduling', 'Task sequencing', 'Calendars and timelines']),
          ch('Set Theory & Venn Diagrams', ['Two-set problems', 'Three-set problems', 'Four-set problems', 'Maxima-minima with sets']),
          ch('Binary Logic & Truth-Tellers', ['Truth and lie statements', 'Binary attributes', 'Conditional logic']),
          ch('Cubes, Blocks & Spatial Sets', ['Painted cubes', 'Stacked blocks', 'Spatial visualisation']),
          ch('Data Sufficiency', ['Two-statement data sufficiency', 'Quantitative data sufficiency', 'Logical data sufficiency']),
        ],
      },
      {
        name: 'Quant',
        chapters: [
          ch('Number Systems', ['Divisibility rules', 'Factors and multiples', 'HCF and LCM', 'Remainders and cyclicity', 'Units digits', 'Factorials and trailing zeros', 'Base systems']),
          ch('Percentages, Ratio & Proportion', ['Percentage changes', 'Successive percentage change', 'Ratios and proportions', 'Variation', 'Partnership']),
          ch('Averages, Mixtures & Alligation', ['Simple and weighted averages', 'Combined averages', 'Mixture concentration', 'Replacement problems', 'Alligation']),
          ch('Profit, Loss & Interest', ['Profit, loss and discount', 'Marked price and successive discounts', 'Simple interest', 'Compound interest', 'Installments and growth']),
          ch('Time, Speed & Distance', ['Average and relative speed', 'Trains', 'Boats and streams', 'Races', 'Circular tracks', 'Escalators']),
          ch('Time & Work', ['Work-rate equations', 'Efficiency ratios', 'Pipes and cisterns', 'Alternate-day work', 'Wages and work distribution']),
          ch('Linear & Quadratic Equations', ['Linear equations', 'Simultaneous equations', 'Quadratic roots and discriminant', 'Equations with parameters', 'Word-problem modelling']),
          ch('Inequalities & Modulus', ['Linear and quadratic inequalities', 'Modulus equations', 'Modulus inequalities', 'Range of expressions']),
          ch('Functions & Graphs', ['Domain and range', 'Composite and inverse functions', 'Common function graphs', 'Transformations of graphs', 'Maxima and minima']),
          ch('Logarithms, Surds & Indices', ['Laws of indices', 'Surd simplification', 'Logarithm properties', 'Logarithmic equations']),
          ch('Sequences & Series', ['Arithmetic progressions', 'Geometric progressions', 'Harmonic progressions', 'Special sums', 'Recursive sequences']),
          ch('Geometry', ['Lines and angles', 'Triangles and similarity', 'Quadrilaterals and polygons', 'Circles', 'Coordinate geometry', 'Geometric transformations']),
          ch('Mensuration', ['Triangle and quadrilateral area', 'Circle sectors and rings', 'Prisms and cylinders', 'Cones and spheres', 'Composite solids']),
          ch('Permutations & Combinations', ['Counting principle', 'Arrangements with restrictions', 'Circular arrangements', 'Selections and distributions']),
          ch('Probability', ['Basic probability', 'Mutually exclusive events', 'Independent events', 'Conditional probability', 'Expected value']),
          ch('Set Theory', ['Set operations', 'Venn-diagram counting', 'Inclusion-exclusion']),
        ],
      },
    ],
  },
  {
    id: 'ssc',
    name: 'SSC CGL',
    fullName: 'SSC CGL / CHSL',
    blurb: 'Government recruitment — Quant, English, GK & Reasoning',
    target: { label: 'SSC CGL', month: 9, day: 14 },
    country: 'India',
    category: 'Government',
    subjects: [
      {
        name: 'Quantitative Aptitude',
        chapters: [
          ch('Number System & Simplification', ['Whole numbers and integers', 'Fractions and decimals', 'BODMAS simplification', 'Divisibility', 'HCF and LCM', 'Surds and indices', 'Remainders']),
          ch('Percentages, Ratio & Proportion', ['Percentage calculations', 'Successive percentage change', 'Ratio and proportion', 'Direct and inverse variation', 'Partnership']),
          ch('Average, Ages & Mixture', ['Simple and weighted average', 'Problems on ages', 'Mixture and alligation']),
          ch('Profit, Loss & Discount', ['Cost and selling price', 'Marked price', 'Successive discounts', 'Dishonest-dealer problems']),
          ch('Simple & Compound Interest', ['Simple interest', 'Compound interest', 'Difference between SI and CI', 'Installment problems']),
          ch('Time & Work', ['Work and efficiency', 'Combined work', 'Pipes and cisterns', 'Wages']),
          ch('Time, Speed & Distance', ['Average speed', 'Relative speed', 'Trains', 'Boats and streams', 'Races and circular tracks']),
          ch('Algebra', ['Algebraic identities', 'Linear equations', 'Quadratic equations', 'Polynomials', 'Graphs of linear equations']),
          ch('Geometry', ['Lines and angles', 'Triangles and centres', 'Congruence and similarity', 'Quadrilaterals and polygons', 'Circle theorems', 'Common tangents']),
          ch('Trigonometry', ['Trigonometric ratios', 'Standard angles', 'Identities', 'Complementary angles', 'Heights and distances']),
          ch('Mensuration', ['Triangle and quadrilateral areas', 'Circle and sector', 'Prism and cylinder', 'Cone and sphere', 'Composite figures']),
          ch('Data Interpretation', ['Tables', 'Bar graphs', 'Line graphs', 'Pie charts', 'Histogram and frequency polygon']),
          ch('Statistics', ['Mean, median and mode', 'Standard deviation basics', 'Frequency distributions']),
        ],
      },
      {
        name: 'English',
        chapters: [
          ch('Vocabulary', ['Synonyms and antonyms', 'One-word substitution', 'Idioms and phrases', 'Homonyms and commonly confused words', 'Spelling correction']),
          ch('Grammar Foundations', ['Parts of speech', 'Tenses', 'Subject-verb agreement', 'Articles and determiners', 'Prepositions', 'Conjunctions', 'Modifiers']),
          ch('Voice & Narration', ['Active and passive voice', 'Direct and indirect speech']),
          ch('Error Detection', ['Subject-verb errors', 'Pronoun errors', 'Tense errors', 'Preposition and article errors', 'Parallelism and modifier errors']),
          ch('Sentence Improvement', ['Grammar-based improvement', 'Usage-based improvement', 'Phrase replacement']),
          ch('Fillers & Cloze Test', ['Single and double fillers', 'Grammar cloze', 'Vocabulary cloze', 'Contextual cloze']),
          ch('Sentence Arrangement', ['Para jumbles', 'Sentence ordering', 'Paragraph completion']),
          ch('Reading Comprehension', ['Direct-detail questions', 'Inference questions', 'Theme and title', 'Vocabulary in context']),
        ],
      },
      {
        name: 'General Awareness',
        chapters: [
          ch('History & Culture', ['Ancient India', 'Medieval India', 'Modern India', 'Freedom struggle', 'Art and culture']),
          ch('Geography', ['Physical geography', 'Indian physiography', 'Rivers, soils and agriculture', 'World geography', 'Environment basics']),
          ch('Polity', ['Constitutional features', 'Fundamental Rights and Duties', 'Parliament and executive', 'Judiciary', 'Constitutional bodies', 'Local government']),
          ch('Economy', ['National income', 'Inflation', 'Banking and RBI', 'Budget and taxation', 'Poverty and employment', 'Government schemes']),
          ch('General Science — Physics', ['Units and motion', 'Work, energy and power', 'Heat and thermodynamics', 'Sound and waves', 'Light and optics', 'Electricity and magnetism']),
          ch('General Science — Chemistry', ['Atomic structure and periodic table', 'Acids, bases and salts', 'Metals and non-metals', 'Carbon compounds', 'Everyday chemistry']),
          ch('General Science — Biology', ['Cell and tissues', 'Human organ systems', 'Nutrition and disease', 'Genetics and evolution', 'Plant biology', 'Ecology']),
          ch('Static GK', ['Countries, capitals and currencies', 'Awards and honours', 'Books and authors', 'Sports', 'Important days', 'National symbols and organisations']),
          ch('Current Affairs', ['National current affairs', 'International current affairs', 'Economy and appointments', 'Science and environment updates', 'Sports and awards updates']),
          ch('Computer Awareness', ['Computer hardware and software', 'Operating systems', 'Internet and networking', 'MS Office basics', 'Cybersecurity basics']),
        ],
      },
      {
        name: 'Reasoning',
        chapters: [
          ch('Analogy & Classification', ['Word analogy', 'Number analogy', 'Figure analogy', 'Odd one out']),
          ch('Series', ['Number series', 'Alphabet series', 'Alphanumeric series', 'Figure series']),
          ch('Coding-Decoding', ['Letter coding', 'Number coding', 'Substitution coding', 'Matrix and conditional coding']),
          ch('Mathematical Operations', ['Symbol substitution', 'Equation balancing', 'Missing operators']),
          ch('Blood Relations & Direction Sense', ['Family-tree relations', 'Coded blood relations', 'Directions and distance', 'Shadow and clock directions']),
          ch('Order, Ranking & Alphabet Test', ['Position and ranking', 'Alphabetical order', 'Word formation', 'Dictionary order']),
          ch('Syllogism & Venn Diagrams', ['Categorical syllogisms', 'Possibility cases', 'Logical Venn diagrams', 'Set relationships']),
          ch('Statements & Logic', ['Statement and conclusion', 'Statement and assumption', 'Arguments', 'Courses of action', 'Cause and effect']),
          ch('Seating & Puzzles', ['Linear seating', 'Circular seating', 'Floor puzzles', 'Box and scheduling puzzles']),
          ch('Non-Verbal Reasoning', ['Mirror and water images', 'Paper folding and cutting', 'Embedded figures', 'Figure completion', 'Cubes and dice', 'Counting figures']),
          ch('Critical Thinking', ['Data sufficiency', 'Decision making', 'Problem solving', 'Emotional and social intelligence']),
        ],
      },
    ],
  },
];

/** JEE Advanced shares JEE Main's full granular syllabus structure (CHANGE 11). */
const JEE_ADVANCED: ExamDef = {
  ...BASE_EXAMS[0],
  id: 'jee-advanced',
  name: 'JEE Advanced',
  fullName: 'JEE Advanced',
  blurb: 'IIT entrance — Physics, Chemistry, Mathematics at advanced depth',
  target: { label: 'JEE Advanced', month: 5, day: 18 },
};

/**
 * The full catalogue: the deep pre-loaded syllabi, the expanded worldwide
 * list, and the per-subject US exams (36 AP subjects + the DAT).
 *
 * ORDER MATTERS for the India experience: the Indian exams stay first, so the
 * onboarding picker's default "India" filter shows exactly what it always did.
 * US_EXAMS is appended, and every one of its entries carries country 'USA',
 * so nothing new appears under any other country filter.
 */
export const EXAMS: ExamDef[] = [
  BASE_EXAMS[0],
  JEE_ADVANCED,
  ...BASE_EXAMS.slice(1),
  ...EXTRA_EXAMS,
  ...US_EXAMS,
];

export function getExam(id: string): ExamDef | undefined {
  return EXAMS.find((exam) => exam.id === id);
}

/** Flat list of every granular topic for a subject, preserving chapter order. */
export function subjectTopics(subject: ExamSubject): Array<{ chapter: string; topic: string }> {
  return subject.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({ chapter: chapter.name, topic })));
}

export function examTopicCount(exam: ExamDef): number {
  return exam.subjects.reduce(
    (sum, subject) => sum + subject.chapters.reduce((count, chapter) => count + chapter.topics.length, 0),
    0,
  );
}

const INFERENCE_STOP_WORDS = new Set([
  'add', 'assignment', 'chapter', 'class', 'complete', 'do', 'finish', 'learn', 'lecture', 'mock', 'notes',
  'practice', 'question', 'questions', 'read', 'recall', 'review', 'revise', 'revision', 'solve', 'study',
  'task', 'test', 'the', 'today', 'tomorrow', 'topic', 'video', 'watch', 'with',
]);

function normalizeLookup(value: string): string {
  return (value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ') ?? '')
    .trim();
}

function lookupTokens(value: string): string[] {
  return normalizeLookup(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !INFERENCE_STOP_WORDS.has(token));
}

function entryScore(query: string, queryTokens: string[], entry: string): number {
  const candidate = normalizeLookup(entry);
  if (!candidate) return 0;
  if (query === candidate) return 1000 + candidate.length;
  if (query.length >= 4 && (candidate.includes(query) || query.includes(candidate))) return 700 + Math.min(candidate.length, 100);

  const candidateTokens = lookupTokens(candidate);
  const overlap = queryTokens.filter((token) =>
    candidateTokens.some((candidateToken) => candidateToken === token || (token.length >= 6 && (candidateToken.includes(token) || token.includes(candidateToken)))),
  );
  if (overlap.length === 0) return 0;
  const distinctive = overlap.filter((token) => token.length >= 6).length;
  if (overlap.length === 1 && distinctive === 0) return 0;
  return overlap.length * 80 + distinctive * 30 - Math.max(0, candidateTokens.length - overlap.length) * 2;
}

/**
 * Resolve free text or a selected syllabus label to one subject in this exam.
 * Chapter names and granular topic labels are both indexed. If two subjects
 * score equally, or no meaningful match exists, return blank instead of guessing.
 */
export function inferSubjectForTopic(exam: ExamDef | undefined, value: string): string {
  if (!exam) return '';
  const query = normalizeLookup(value);
  const queryTokens = lookupTokens(value);
  if (!query || queryTokens.length === 0) return '';

  const ranked = exam.subjects
    .map((subject) => {
      let score = entryScore(query, queryTokens, subject.name);
      for (const chapter of subject.chapters) {
        score = Math.max(score, entryScore(query, queryTokens, chapter.name));
        for (const topic of chapter.topics) {
          score = Math.max(score, entryScore(query, queryTokens, topic));
        }
      }
      return { subject: subject.name, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0 || ranked[0].score < 100) return '';
  if (ranked[1] && ranked[1].score === ranked[0].score) return '';
  return ranked[0].subject;
}

/** Next occurrence of the exam's default target date, as ISO YYYY-MM-DD. */
export function defaultExamDate(exam: ExamDef, todayISO: string): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = Number(todayISO.slice(0, 4));
  const makeDate = (targetYear: number) => `${targetYear}-${pad(exam.target.month)}-${pad(exam.target.day)}`;
  return makeDate(year) >= todayISO ? makeDate(year) : makeDate(year + 1);
}
