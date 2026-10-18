/**
 * bundles/sample-science/syllabus.md — DEV STUB bundle (§3.5).
 * 16 concepts across 2 subjects / 4 chapters, for development and testing
 * only. A full exam bundle (1,000–1,500 concepts) is authored later and
 * dropped in through the same format — the parser doesn't care about size.
 */
export const SAMPLE_SCIENCE_SYLLABUS_MD = `# syllabus
exam: sample-science

## subject: Physics

### chapter: Motion in a Straight Line

- id: phy.motion.displacement
  name: Displacement and Distance
  source_ref: SCI-XI-CH3.1
  est_hours: 1.5
  triggers: displacement, distance, position, path length, initial position, final position, net change, straight line, magnitude, direction

- id: phy.motion.velocity
  name: Speed and Velocity
  source_ref: SCI-XI-CH3.2
  est_hours: 1.5
  triggers: velocity, speed, average velocity, instantaneous velocity, uniform motion, rate of change, metre per second, slope, position time graph, relative velocity

- id: phy.motion.acceleration
  name: Acceleration
  source_ref: SCI-XI-CH3.3
  est_hours: 2
  triggers: acceleration, deceleration, retardation, velocity time graph, uniform acceleration, rate of change of velocity, metre per second squared, slope of velocity, increasing speed, negative acceleration

- id: phy.motion.kinematics-equations
  name: Equations of Motion
  source_ref: SCI-XI-CH3.4
  est_hours: 2.5
  triggers: equations of motion, kinematics, v equals u plus at, s equals ut, free fall, stopping distance, uniformly accelerated, initial velocity, final velocity, time of flight

### chapter: Laws of Motion

- id: phy.laws.first-law
  name: Inertia and Newton's First Law
  source_ref: SCI-XI-CH5.1
  est_hours: 1.5
  triggers: inertia, first law, newton, rest, uniform motion, external force, mass, tendency to resist, seat belt, sudden stop

- id: phy.laws.second-law
  name: Newton's Second Law and Momentum
  source_ref: SCI-XI-CH5.2
  est_hours: 2.5
  triggers: second law, force, momentum, mass times acceleration, impulse, rate of change of momentum, net force, newton unit, f equals ma, collision

- id: phy.laws.third-law
  name: Newton's Third Law
  source_ref: SCI-XI-CH5.3
  est_hours: 1
  triggers: third law, action reaction, equal and opposite, recoil, rocket propulsion, normal reaction, pair of forces, interaction, push back, gun recoil

- id: phy.laws.friction
  name: Friction
  source_ref: SCI-XI-CH5.4
  est_hours: 2
  triggers: friction, static friction, kinetic friction, coefficient of friction, limiting friction, rough surface, normal force, sliding, rolling friction, banking of road

## subject: Chemistry

### chapter: Atomic Structure

- id: chem.atom.subatomic
  name: Subatomic Particles
  source_ref: SCI-XI-CH2.1
  est_hours: 1
  triggers: electron, proton, neutron, nucleus, charge, atomic number, mass number, cathode ray, discovery, fundamental particle

- id: chem.atom.bohr-model
  name: Bohr Model of the Atom
  source_ref: SCI-XI-CH2.2
  est_hours: 2
  triggers: bohr, orbit, energy level, shell, hydrogen spectrum, quantised, radius, angular momentum, stationary state, energy of orbit

- id: chem.atom.quantum-numbers
  name: Quantum Numbers and Orbitals
  source_ref: SCI-XI-CH2.3
  est_hours: 2.5
  triggers: quantum number, orbital, principal, azimuthal, magnetic, spin, subshell, s p d f, shape of orbital, node

- id: chem.atom.electron-config
  name: Electronic Configuration
  source_ref: SCI-XI-CH2.4
  est_hours: 1.5
  triggers: electronic configuration, aufbau, pauli exclusion, hund rule, filling order, valence electron, noble gas core, half filled, fully filled, stability

### chapter: Chemical Bonding

- id: chem.bond.ionic
  name: Ionic Bonding
  source_ref: SCI-XI-CH4.1
  est_hours: 1.5
  triggers: ionic bond, electrovalent, cation, anion, electron transfer, lattice energy, electrostatic attraction, crystal lattice, ionic compound, sodium chloride

- id: chem.bond.covalent
  name: Covalent Bonding and Lewis Structures
  source_ref: SCI-XI-CH4.2
  est_hours: 2
  triggers: covalent bond, shared pair, lewis structure, lone pair, octet rule, double bond, triple bond, bond pair, electron dot, formal charge

- id: chem.bond.vsepr
  name: VSEPR and Molecular Geometry
  source_ref: SCI-XI-CH4.3
  est_hours: 2
  triggers: vsepr, geometry, shape of molecule, bond angle, tetrahedral, trigonal planar, linear, bent shape, repulsion, lone pair effect

- id: chem.bond.hybridisation
  name: Hybridisation
  source_ref: SCI-XI-CH4.4
  est_hours: 2
  triggers: hybridisation, sp3, sp2, sp hybrid, mixing of orbitals, sigma bond, pi bond, tetrahedral carbon, bond formation, overlap
`;
