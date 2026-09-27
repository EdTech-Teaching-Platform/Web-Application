// Frontend question banks for the school Mathematics and Science packages.
// These use the same assessment schema as the main test catalog so they go
// through the real timed runner, attempt storage, and result pages.
const question = (prompt, options, answer, explanation, topic) => ({ prompt, options, answer, explanation, topic });

const mathQuestions = [
  question("Which is an irrational number?", ["0.25", "√2", "3/8", "0.125"], 1, "√2 cannot be written as a ratio of two integers.", "Real Numbers"),
  question("The decimal expansion of 13/40 is…", ["0.325", "0.32", "0.35", "0.3025"], 0, "13 ÷ 40 = 0.325, a terminating decimal.", "Real Numbers"),
  question("The HCF of 18 and 30 is…", ["3", "6", "9", "12"], 1, "The greatest common divisor of 18 and 30 is 6.", "Real Numbers"),
  question("If p(x) = x² − 5x + 6, its zeroes are…", ["1 and 6", "−2 and −3", "2 and 3", "−2 and 3"], 2, "Factor x² − 5x + 6 as (x − 2)(x − 3).", "Polynomials"),
  question("The sum of the zeroes of 3x² + 7x − 2 is…", ["7/3", "−7/3", "−2/3", "2/3"], 1, "For ax² + bx + c, the sum of zeroes is −b/a.", "Polynomials"),
  question("A polynomial of degree 3 can have at most how many zeroes?", ["1", "2", "3", "4"], 2, "A non-zero polynomial has no more zeroes than its degree.", "Polynomials"),
  question("The solution of x + y = 7 and x − y = 1 is…", ["(3, 4)", "(4, 3)", "(5, 2)", "(2, 5)"], 1, "Adding the equations gives 2x = 8, so x = 4 and y = 3.", "Linear Equations"),
  question("For two linear equations to have a unique solution, their lines must…", ["Be parallel", "Coincide", "Intersect once", "Be perpendicular only"], 2, "A unique solution is their single point of intersection.", "Linear Equations"),
  question("Solve 2x + 3y = 12 and x − y = 1.", ["x = 3, y = 2", "x = 2, y = 3", "x = 4, y = 1", "x = 1, y = 4"], 0, "Substitute x = y + 1: 2(y + 1) + 3y = 12, giving y = 2 and x = 3.", "Linear Equations"),
  question("The roots of x² − 9 = 0 are…", ["0 and 9", "3 only", "−3 and 3", "−9 and 9"], 2, "x² = 9 gives x = ±3.", "Quadratic Equations"),
  question("The discriminant of x² + 4x + 4 is…", ["0", "4", "8", "16"], 0, "b² − 4ac = 16 − 16 = 0; the roots are equal.", "Quadratic Equations"),
  question("If the discriminant of a quadratic is negative, its real roots are…", ["Two distinct roots", "Equal", "None", "Always integers"], 2, "A negative discriminant means there are no real roots.", "Quadratic Equations"),
  question("What is the 10th term of the AP 3, 7, 11, …?", ["35", "39", "40", "43"], 1, "a₁₀ = 3 + 9 × 4 = 39.", "Arithmetic Progressions"),
  question("The common difference of 14, 9, 4, −1, … is…", ["−4", "−5", "5", "−9"], 1, "Each term decreases by 5.", "Arithmetic Progressions"),
  question("The sum of the first 5 positive integers is…", ["10", "12", "15", "20"], 2, "1 + 2 + 3 + 4 + 5 = 15.", "Arithmetic Progressions"),
  question("Two triangles are similar when their corresponding angles are…", ["Supplementary", "Equal", "Right angles", "Different"], 1, "Similarity preserves corresponding angles.", "Triangles"),
  question("In a right triangle, the hypotenuse is 13 and one leg is 5. The other leg is…", ["8", "10", "12", "18"], 2, "By Pythagoras, the missing leg is √(13² − 5²) = 12.", "Triangles"),
  question("If a line is parallel to one side of a triangle, it divides the other two sides…", ["Unequally always", "Proportionally", "At right angles", "Into three parts"], 1, "The Basic Proportionality Theorem gives proportional side segments.", "Triangles"),
  question("The distance between (0, 0) and (3, 4) is…", ["4", "5", "6", "7"], 1, "Distance = √(3² + 4²) = 5.", "Coordinate Geometry"),
  question("The midpoint of (2, 4) and (6, 8) is…", ["(4, 6)", "(8, 12)", "(2, 2)", "(3, 4)"], 0, "Average the x-coordinates and y-coordinates separately.", "Coordinate Geometry"),
  question("The slope of the line through (1, 2) and (3, 8) is…", ["2", "3", "4", "6"], 1, "Slope = (8 − 2)/(3 − 1) = 3.", "Coordinate Geometry"),
  question("If x + 2 = 9, x equals…", ["6", "7", "9", "11"], 1, "Subtract 2 from both sides.", "Algebra"),
  question("Expand (a + b)².", ["a² + b²", "a² + 2ab + b²", "a² − 2ab + b²", "2a + 2b"], 1, "The square identity is a² + 2ab + b².", "Algebra"),
  question("If 3x = 21, x equals…", ["6", "7", "18", "24"], 1, "Divide both sides by 3.", "Algebra"),
  question("The area of a rectangle with sides 8 cm and 5 cm is…", ["13 cm²", "26 cm²", "40 cm²", "80 cm²"], 2, "Area = length × width = 8 × 5 = 40 cm².", "Geometry"),
  question("The sum of interior angles in a triangle is…", ["90°", "180°", "270°", "360°"], 1, "The interior angles of every Euclidean triangle sum to 180°.", "Geometry"),
  question("The circumference of a circle of radius r is…", ["πr²", "2πr", "πd²", "r²"], 1, "Circumference = 2πr.", "Geometry"),
];

const physicsQuestions = [
  question("The SI unit of force is…", ["Joule", "Newton", "Watt", "Pascal"], 1, "Force is measured in newtons (N).", "Mechanics"),
  question("A body travels 100 m in 20 s. Its average speed is…", ["2 m/s", "5 m/s", "20 m/s", "2000 m/s"], 1, "Average speed = distance ÷ time = 100 ÷ 20 = 5 m/s.", "Motion"),
  question("Which quantity is a vector?", ["Distance", "Speed", "Mass", "Displacement"], 3, "Displacement has both magnitude and direction.", "Motion"),
  question("The energy stored in a raised object is…", ["Chemical", "Gravitational potential", "Sound", "Nuclear"], 1, "An object's height in a gravitational field gives it potential energy.", "Work and Energy"),
  question("For a fixed resistor, doubling voltage makes current…", ["Halve", "Double", "Stay the same", "Become zero"], 1, "Ohm's law gives I = V/R.", "Electricity"),
  question("Two resistors of 2 Ω and 3 Ω in series have total resistance…", ["1 Ω", "5 Ω", "6 Ω", "1.2 Ω"], 1, "Resistances in series add: 2 + 3 = 5 Ω.", "Electricity"),
  question("A convex lens can form a real image when the object is…", ["At the optical centre only", "Beyond its focal point", "Inside its focal point only", "Behind the lens"], 1, "An object beyond the focal point produces a real image on the other side.", "Optics"),
  question("Sound cannot travel through…", ["Water", "Steel", "Air", "A vacuum"], 3, "Sound needs a material medium to propagate.", "Waves"),
  question("The acceleration due to gravity near Earth's surface is approximately…", ["0.98 m/s²", "9.8 m/s²", "98 m/s²", "980 m/s²"], 1, "The standard approximate value is 9.8 m/s².", "Gravitation"),
  question("Power is the rate of doing…", ["Work", "Mass", "Distance", "Momentum"], 0, "Power = work done divided by time.", "Work and Energy"),
];

const chemistryQuestions = [
  question("A solution with pH 2 is…", ["Acidic", "Neutral", "Basic", "A salt only"], 0, "Values below 7 are acidic.", "Acids and Bases"),
  question("The chemical symbol for sodium is…", ["So", "S", "Na", "N"], 2, "Sodium's symbol is Na, from the Latin natrium.", "Elements"),
  question("Water has the formula…", ["HO", "H₂O", "H₂O₂", "OH₂O"], 1, "A water molecule has two hydrogen atoms and one oxygen atom.", "Chemical Compounds"),
  question("The atomic number of an element equals its number of…", ["Neutrons", "Protons", "Shells", "Isotopes"], 1, "Atomic number is defined by the number of protons in the nucleus.", "Atomic Structure"),
  question("Rusting of iron requires oxygen and…", ["Nitrogen", "Water", "Helium", "Carbon dioxide only"], 1, "Iron rusts in the presence of oxygen and moisture.", "Metals"),
  question("Which gas turns limewater milky?", ["Oxygen", "Hydrogen", "Carbon dioxide", "Nitrogen"], 2, "Carbon dioxide forms insoluble calcium carbonate in limewater.", "Chemical Reactions"),
  question("A bond formed by transfer of electrons is…", ["Ionic", "Covalent", "Metallic only", "Hydrogen"], 0, "Ionic bonding involves electron transfer and electrostatic attraction.", "Bonding"),
  question("The process of a liquid changing to gas at the surface is…", ["Freezing", "Condensation", "Evaporation", "Sublimation"], 2, "Evaporation occurs at a liquid's surface.", "States of Matter"),
  question("Which is a noble gas?", ["Oxygen", "Neon", "Chlorine", "Hydrogen"], 1, "Neon is a Group 18 noble gas.", "Periodic Table"),
  question("In a balanced chemical equation, the number of atoms of each element is…", ["Different on each side", "Equal on both sides", "Always zero", "Not considered"], 1, "Balancing conserves atoms and mass in a chemical reaction.", "Chemical Reactions"),
];

const biologyQuestions = [
  question("The basic structural and functional unit of life is the…", ["Organ", "Tissue", "Cell", "System"], 2, "Cells are the smallest units that carry out life processes.", "Cell Biology"),
  question("Photosynthesis mainly takes place in the…", ["Nucleus", "Chloroplast", "Mitochondrion", "Ribosome"], 1, "Chloroplasts contain chlorophyll and are the site of photosynthesis.", "Plant Biology"),
  question("Which blood cells carry oxygen?", ["Red blood cells", "Platelets", "White blood cells", "Neurons"], 0, "Haemoglobin in red blood cells transports oxygen.", "Human Physiology"),
  question("DNA's primary role is to…", ["Digest food", "Store hereditary information", "Pump blood", "Produce bile"], 1, "DNA carries genetic instructions used in growth and development.", "Genetics"),
  question("The organ that filters blood to produce urine is the…", ["Lung", "Kidney", "Stomach", "Pancreas"], 1, "The kidneys filter blood and regulate water and waste balance.", "Human Physiology"),
  question("Pollination is the transfer of pollen to the…", ["Root", "Stigma", "Ovary", "Sepal"], 1, "Pollen lands on the stigma, the receptive part of a flower.", "Plant Reproduction"),
  question("An ecosystem includes organisms and their…", ["Genes only", "Physical environment", "Food only", "Predators only"], 1, "An ecosystem includes living communities and the non-living environment.", "Ecology"),
  question("Which molecule is the main immediate energy currency of cells?", ["DNA", "ATP", "Starch", "Cellulose"], 1, "ATP supplies usable energy for many cellular processes.", "Cell Biology"),
  question("A vaccine helps the immune system by…", ["Destroying all cells", "Preparing it to recognize a pathogen", "Replacing red blood cells", "Stopping digestion"], 1, "Vaccination trains immune memory to respond to a specific pathogen.", "Human Health"),
  question("In a food chain, plants are usually…", ["Producers", "Primary consumers", "Decomposers", "Parasites"], 0, "Plants produce organic food using energy, usually from sunlight.", "Ecology"),
];

function makeQuestions(id, rows) {
  return rows.map((item, index) => ({ id: `${id}-q${index + 1}`, ...item, type: "single", learnTo: "/student/test-series" }));
}

const definitions = [
  ["maths-real-numbers", "Real Numbers", "Mathematics", "Beginner", 12, mathQuestions.slice(0, 3)],
  ["maths-polynomials", "Polynomials", "Mathematics", "Beginner", 12, mathQuestions.slice(3, 6)],
  ["maths-linear-equations", "Pair of Linear Equations", "Mathematics", "Intermediate", 15, mathQuestions.slice(6, 9)],
  ["maths-quadratic-equations", "Quadratic Equations", "Mathematics", "Intermediate", 12, mathQuestions.slice(9, 12)],
  ["maths-arithmetic-progressions", "Arithmetic Progressions", "Mathematics", "Intermediate", 12, mathQuestions.slice(12, 15)],
  ["maths-triangles", "Triangles", "Mathematics", "Intermediate", 12, mathQuestions.slice(15, 18)],
  ["maths-coordinate-geometry", "Coordinate Geometry", "Mathematics", "Intermediate", 12, mathQuestions.slice(18, 21)],
  ["maths-algebra", "Algebra", "Mathematics", "Intermediate", 20, mathQuestions.slice(21, 24)],
  ["maths-geometry", "Geometry", "Mathematics", "Intermediate", 20, mathQuestions.slice(24, 27)],
  ["maths-mock-1", "Mock Test 01", "Mathematics", "Advanced", 35, mathQuestions.slice(0, 20)],
  ["maths-mock-2", "Mock Test 02", "Mathematics", "Advanced", 35, mathQuestions.slice(7, 27)],
  ["science-physics", "Physics — Full Syllabus", "Physics", "Advanced", 25, physicsQuestions],
  ["science-chemistry", "Chemistry — Full Syllabus", "Chemistry", "Advanced", 25, chemistryQuestions],
  ["science-biology", "Biology — Full Syllabus", "Biology", "Advanced", 25, biologyQuestions],
  ["science-mock-1", "Full-Length Mock 01", "Science", "Advanced", 60, [...physicsQuestions.slice(0, 4), ...chemistryQuestions.slice(0, 3), ...biologyQuestions.slice(0, 3)]],
  ["science-mock-2", "Full-Length Mock 02", "Science", "Advanced", 60, [...physicsQuestions.slice(4, 7), ...chemistryQuestions.slice(4, 7), ...biologyQuestions.slice(4, 8)]],
];

export const GENERATED_SERIES_ASSESSMENTS = definitions.map(([id, title, subject, difficulty, durationMinutes, rows]) => ({
  id,
  title,
  subject,
  category: id.startsWith("science-") ? "Science" : "Mathematics",
  difficulty,
  durationMinutes,
  attemptsAllowed: "Unlimited",
  passingScore: 50,
  rating: 4.5,
  attempts: 0,
  badge: "",
  type: "Mock Exam",
  questionType: "Multiple Choice",
  certificateEligible: false,
  description: `${title} assessment covering key ${subject} concepts with explanations for every answer.`,
  skills: [subject],
  topics: [...new Set(rows.map((item) => item.topic))],
  questions: makeQuestions(id, rows),
}));
