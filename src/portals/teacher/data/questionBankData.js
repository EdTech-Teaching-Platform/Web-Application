// UNUSED -- no longer imported anywhere. The "Build from Course" / "Question Bank" / Duplicate / CSV / AI start paths
// were removed: test series are now built manually from scratch. Safe to delete this file.
// Seed question bank for the "Pick from question bank" build method.
// Each entry is a ready-to-use question (same shape the builder edits) plus
// the facets the picker filters on (subject / topic / difficulty). Picking
// clones a question with fresh ids so editing it in a series never mutates
// the bank. A real bank would live on the server; this is a small local seed.
import { makeId } from "./testSeriesData";

let n = 0;
const bid = (p) => `${p}-bank${++n}`;
const o = (text, correct = false) => ({ id: bid("o"), text, correct });
function mcq(subject, topic, difficulty, text, options, correctIdx, points = 4, explanation = "") {
  return { id: bid("qb"), subject, type: "mcq_single", text: `<p>${text}</p>`, points, difficulty, topic, explanation, options: options.map((t, i) => o(t, i === correctIdx)) };
}
function tf(subject, topic, difficulty, text, answer, points = 2) {
  return { id: bid("qb"), subject, type: "true_false", text: `<p>${text}</p>`, points, difficulty, topic, explanation: "", options: [o("True", answer), o("False", !answer)] };
}
function num(subject, topic, difficulty, text, answer, tolerance = 0, points = 4) {
  return { id: bid("qb"), subject, type: "numerical", text: `<p>${text}</p>`, points, difficulty, topic, explanation: "", correctAnswer: String(answer), tolerance };
}
function fill(subject, topic, difficulty, text, answer, points = 2) {
  return { id: bid("qb"), subject, type: "fill_blank", text: `<p>${text}</p>`, points, difficulty, topic, explanation: "", correctAnswer: answer };
}

export const QUESTION_BANK = [
  mcq("Mathematics", "Quadratic Equations", "Beginner", "The roots of x² − 7x + 12 = 0 are:", ["3 and 4", "2 and 6", "−3 and −4", "1 and 12"], 0, 2),
  mcq("Mathematics", "Quadratic Equations", "Intermediate", "For which value of k does x² + kx + 9 = 0 have equal roots (k > 0)?", ["3", "6", "9", "12"], 1),
  num("Mathematics", "Arithmetic Progressions", "Beginner", "Find the sum of the first 20 natural numbers.", 210, 0, 2),
  num("Mathematics", "Arithmetic Progressions", "Intermediate", "The 5th term of an AP is 17 and the 9th term is 33. Find the common difference.", 4, 0),
  mcq("Mathematics", "Trigonometry", "Intermediate", "The value of sin²θ + cos²θ is:", ["0", "1", "2", "depends on θ"], 1, 2),
  mcq("Mathematics", "Trigonometry", "Advanced", "If tan θ = 3/4 and θ is acute, then sin θ equals:", ["3/5", "4/5", "5/3", "3/4"], 0),
  tf("Mathematics", "Probability", "Beginner", "The probability of any event always lies between 0 and 1 inclusive.", true),
  num("Mathematics", "Probability", "Intermediate", "A die is rolled once. Find the probability (as a decimal, 2 d.p.) of getting a prime number.", 0.5, 0.01),
  mcq("Physics", "Kinematics", "Beginner", "The SI unit of acceleration is:", ["m/s", "m/s²", "N", "kg·m/s"], 1, 2),
  mcq("Physics", "Kinematics", "Intermediate", "A body falls freely from rest. Its speed after 3 s (g = 10 m/s²) is:", ["10 m/s", "20 m/s", "30 m/s", "45 m/s"], 2),
  num("Physics", "Laws of Motion", "Intermediate", "A 5 kg body is acted on by a net force of 20 N. Find its acceleration in m/s².", 4, 0),
  tf("Physics", "Laws of Motion", "Beginner", "An object at rest stays at rest unless acted on by a net external force.", true),
  mcq("Physics", "Optics", "Intermediate", "A concave mirror of focal length 15 cm forms a real image of an object at 30 cm. The image distance is:", ["15 cm", "30 cm", "45 cm", "60 cm"], 1),
  mcq("Physics", "Optics", "Advanced", "Total internal reflection can occur when light travels from:", ["Rarer to denser medium", "Denser to rarer medium", "Any medium to vacuum only", "Air to glass"], 1),
  mcq("Chemistry", "Periodic Table", "Beginner", "Which of these is a noble gas?", ["Neon", "Nitrogen", "Chlorine", "Sodium"], 0, 2),
  mcq("Chemistry", "Chemical Bonding", "Intermediate", "The bond in NaCl is:", ["Covalent", "Ionic", "Metallic", "Hydrogen"], 1),
  fill("Chemistry", "Acids and Bases", "Beginner", "The pH of a neutral solution at 25 °C is ______.", "7"),
  num("Chemistry", "Mole Concept", "Advanced", "How many moles are present in 36 g of water (molar mass 18 g/mol)?", 2, 0),
  mcq("Biology", "Cell Biology", "Beginner", "Which organelle is called the powerhouse of the cell?", ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"], 1, 2),
  tf("Biology", "Cell Biology", "Beginner", "Plant cells have a cell wall but animal cells do not.", true),
  mcq("Biology", "Genetics", "Intermediate", "The physical expression of a gene is called the:", ["Genotype", "Phenotype", "Allele", "Chromosome"], 1),
  mcq("Computer Science", "Python Basics", "Beginner", "Which keyword defines a function in Python?", ["func", "define", "def", "lambda only"], 2, 2),
  fill("Computer Science", "Python Basics", "Beginner", "The built-in function that returns the length of a list is ______.", "len"),
  mcq("Computer Science", "Data Structures", "Intermediate", "Which data structure follows LIFO order?", ["Queue", "Stack", "Array", "Tree"], 1),
  mcq("Computer Science", "Algorithms", "Advanced", "The worst-case time complexity of binary search on n items is:", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], 1),
  mcq("English", "Grammar", "Beginner", "Choose the correct sentence.", ["She don't like tea.", "She doesn't like tea.", "She not like tea.", "She didn't likes tea."], 1, 2),
  mcq("English", "Vocabulary", "Intermediate", "The word closest in meaning to 'ephemeral' is:", ["Lasting", "Short-lived", "Ancient", "Brilliant"], 1),
];

export const BANK_SUBJECTS = Array.from(new Set(QUESTION_BANK.map((q) => q.subject)));
export function bankTopics(subject) {
  return Array.from(new Set(QUESTION_BANK.filter((q) => !subject || subject === "All" || q.subject === subject).map((q) => q.topic))).sort();
}
export function filterBank({ subject = "All", topic = "All", difficulty = "All", query = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return QUESTION_BANK.filter((q) => {
    if (subject !== "All" && q.subject !== subject) return false;
    if (topic !== "All" && q.topic !== topic) return false;
    if (difficulty !== "All" && q.difficulty !== difficulty) return false;
    if (needle && !`${q.text} ${q.topic}`.toLowerCase().includes(needle)) return false;
    return true;
  });
}
// Clone selected bank questions into fresh, editable series questions.
export function cloneBankQuestions(items) {
  return items.map((item) => {
    const copy = JSON.parse(JSON.stringify(item));
    delete copy.subject;
    copy.id = makeId("q");
    if (copy.options) copy.options = copy.options.map((op) => ({ ...op, id: makeId("o") }));
    return copy;
  });
}
