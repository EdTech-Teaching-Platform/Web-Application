// Shared discovery/catalog mock data — Day 3 (Educator Public Profile,
// Course Details, Wishlist, Checkout). Doc ref: Sec 5.3 (Discovery), Sec
// 5.4 (Course & Curriculum: reviews/ratings), Sec 5.10 (Commerce).
//
// Promoted to src/data (not portal-local) the same way discoveryApi.js
// was: consumed by BOTH the public Explore page (src/public) and the
// Student portal's Course Details/Educator Profile/Wishlist/Checkout
// pages — two consumer groups already, so per the README's "promote once
// 2+ consumers need it" rule this doesn't start portal-local.
//
// No catalog/educator-profile/review endpoints exist yet — kept as local
// mock data, same pattern as Dashboard.jsx and LandingPage.jsx ("Data
// below is mock/placeholder — wire to the real API once it exists").
// EDUCATORS and COURSES intentionally reuse the same ids/names already
// used by ExplorePage.jsx and Dashboard.jsx's mock arrays so a click
// through Explore/Dashboard/Course Details/Educator Profile is coherent
// end to end.
import { imageForCategory, imageForPerson } from "../utils/stockImages";

export const EDUCATORS = [
  {
    id: "ed1",
    name: "Priya Sharma",
    headline: "Full-Stack Developer & Python Educator",
    city: "Bengaluru, India",
    bio: "Priya has spent 9 years building production web applications before moving into full-time teaching. She focuses on project-based learning so students ship real, working code from week one — not just watch slides.",
    aboutSections: [
      { title: "From building software to teaching it", text: "Priya brings together a computer science education and nine years of hands-on experience building production web applications. That background helps her connect programming concepts to the decisions developers make when creating software that people actually use." },
      { title: "A practical, project-led approach", text: "Her teaching is centered on learning by doing. Instead of stopping at syntax or isolated examples, Priya guides learners through concepts in context and encourages them to apply each idea in working code. The goal is to help students understand why a solution works and how to adapt it when a problem changes." },
      { title: "Areas of expertise", text: "Priya teaches Python, JavaScript, React, and backend systems. Her courses are suited to learners who want to build a stronger programming foundation and see how the pieces of a web application fit together." },
      { title: "What to expect as a learner", text: "Expect structured lessons, practical examples, and project work that builds on core concepts. Priya’s profile includes courses across live and self-paced formats, so learners can choose the style that best fits their schedule." },
    ],
    qualifications: ["B.Tech, Computer Science — IIT Bombay", "AWS Certified Solutions Architect"],
    experienceYears: 9,
    subjects: ["Python", "JavaScript", "React", "Backend Systems"],
    languages: ["English", "Hindi"],
    rating: 4.8,
    reviewCount: 612,
    studentsCount: 8400,
  },
  {
    id: "ed2",
    name: "Rohan Mehta",
    headline: "Mathematics Educator, Grades 9–12",
    city: "Pune, India",
    bio: "Rohan has taught secondary-level mathematics for over a decade with a focus on building intuition before formulas. Former CBSE board examiner.",
    aboutSections: [
      { title: "Teaching approach", text: "Rohan helps learners understand the reasoning behind a method before relying on a formula. His lessons use carefully worked examples to make each step visible and give students a reliable way to check their own thinking." },
      { title: "Areas of expertise", text: "His teaching covers algebra, trigonometry, and calculus, with experience teaching secondary-level mathematics and serving as a CBSE board examiner." },
      { title: "What to expect as a learner", text: "Students can expect concepts to build progressively, with attention to common points of confusion and the problem-solving habits needed for exams and further study." },
    ],
    qualifications: ["M.Sc. Mathematics — University of Pune", "B.Ed."],
    experienceYears: 12,
    subjects: ["Algebra", "Trigonometry", "Calculus"],
    languages: ["English", "Hindi", "Marathi"],
    rating: 4.6,
    reviewCount: 388,
    studentsCount: 5200,
  },
  {
    id: "ed3",
    name: "Anaya Kapoor",
    headline: "IELTS & Spoken English Coach",
    city: "Delhi, India",
    bio: "Anaya is a certified IELTS trainer who has helped over 3,000 students reach their target band score, with a focus on speaking confidence and real-world fluency.",
    aboutSections: [
      { title: "Teaching approach", text: "Anaya focuses on helping learners express ideas clearly and confidently. Her coaching balances language accuracy with the ability to respond naturally in real conversations and speaking tasks." },
      { title: "Areas of expertise", text: "A CELTA-certified trainer with a background in English literature, Anaya teaches IELTS speaking, spoken English, and business English." },
      { title: "What to expect as a learner", text: "Learners work on fluency, useful vocabulary, answer structure, and confidence through guided practice designed around their communication goals." },
    ],
    qualifications: ["CELTA Certified", "M.A. English Literature — Delhi University"],
    experienceYears: 7,
    subjects: ["IELTS Speaking", "Spoken English", "Business English"],
    languages: ["English", "Hindi"],
    rating: 4.9,
    reviewCount: 741,
    studentsCount: 3100,
  },
  {
    id: "ed4",
    name: "Vikram Rao",
    headline: "Guitarist & Music Educator",
    city: "Chennai, India",
    bio: "Vikram is a session guitarist and self-taught-to-professional success story who now teaches beginners the exact practice routine that got him there.",
    aboutSections: [
      { title: "Teaching approach", text: "Vikram makes guitar approachable by breaking practice into small, repeatable steps. His lessons connect technique to the rhythm and songs learners want to play." },
      { title: "Areas of expertise", text: "A guitarist with Trinity College London Grade 8 certification, Vikram teaches beginner guitar and music theory." },
      { title: "What to expect as a learner", text: "Students build familiarity with essential chords, rhythm, and practice routines at a steady pace, with a focus on developing habits they can continue independently." },
    ],
    qualifications: ["Trinity College London, Grade 8 Guitar"],
    experienceYears: 11,
    subjects: ["Guitar", "Music Theory"],
    languages: ["English", "Tamil"],
    rating: 4.7,
    reviewCount: 256,
    studentsCount: 2200,
  },
  {
    id: "ed5",
    name: "Meera Iyer",
    headline: "Product & UI Designer",
    city: "Mumbai, India",
    bio: "Meera has designed products used by millions at two Indian startups and now teaches practical, portfolio-ready UI design to career switchers.",
    aboutSections: [
      { title: "Teaching approach", text: "Meera connects design principles to the decisions behind real product interfaces. Her lessons focus on clear visual choices, reusable systems, and explaining the reasoning behind a design." },
      { title: "Areas of expertise", text: "With experience designing digital products at Indian startups, Meera teaches UI design, design systems, and Figma." },
      { title: "What to expect as a learner", text: "Learners practice turning ideas into organized screens and design work they can refine into a portfolio, with an emphasis on clarity and consistency." },
    ],
    qualifications: ["B.Des. — NID Ahmedabad"],
    experienceYears: 8,
    subjects: ["UI Design", "Design Systems", "Figma"],
    languages: ["English"],
    rating: 4.5,
    reviewCount: 190,
    studentsCount: 1800,
  },
  {
    id: "ed6",
    name: "Aditya Sen",
    headline: "Physics & Chemistry Educator",
    city: "Kolkata, India",
    bio: "Aditya taught undergraduate physics for six years before moving to full-time online teaching, focused on building real intuition for the sciences instead of rote memorization.",
    aboutSections: [
      { title: "Teaching approach", text: "Aditya helps learners build an intuitive picture of scientific ideas before moving into formal notation. Explanations connect principles to examples so students can reason through unfamiliar problems." },
      { title: "Areas of expertise", text: "His academic teaching experience includes undergraduate physics, and his current subjects include physics, chemistry, and biology." },
      { title: "What to expect as a learner", text: "Expect concept-first explanations, worked examples, and practice that helps connect scientific ideas instead of treating them as isolated facts." },
    ],
    qualifications: ["M.Sc. Physics — Jadavpur University", "B.Ed."],
    experienceYears: 10,
    subjects: ["Physics", "Chemistry", "Biology"],
    languages: ["English", "Bengali", "Hindi"],
    rating: 4.7,
    reviewCount: 334,
    studentsCount: 4100,
  },
  {
    id: "ed7",
    name: "Neha Joshi",
    headline: "Business Strategy & Marketing Educator",
    city: "Ahmedabad, India",
    bio: "Neha spent nine years in brand strategy and growth marketing at two consumer startups before teaching founders and career switchers the fundamentals she wishes she'd learned sooner.",
    aboutSections: [
      { title: "Teaching approach", text: "Neha draws on startup experience to make business concepts concrete. Her lessons connect strategic ideas to the choices teams make when testing, communicating, and growing a business." },
      { title: "Areas of expertise", text: "After nine years in brand strategy and growth marketing, Neha teaches digital marketing, business strategy, and finance." },
      { title: "What to expect as a learner", text: "Learners build a practical understanding of business fundamentals and how to apply them to a plan, a project, or a career transition." },
    ],
    qualifications: ["MBA — IIM Ahmedabad"],
    experienceYears: 9,
    subjects: ["Digital Marketing", "Business Strategy", "Finance"],
    languages: ["English", "Hindi", "Gujarati"],
    rating: 4.6,
    reviewCount: 275,
    studentsCount: 3600,
  },
  {
    id: "ed8",
    name: "Kabir Ahluwalia",
    headline: "Lifestyle & Personal Development Coach",
    city: "Jaipur, India",
    bio: "Kabir is a certified wellness and productivity coach who has run workshops for over 5,000 learners on the everyday skills school never taught — from focus to public speaking to photography.",
    aboutSections: [
      { title: "Teaching approach", text: "Kabir teaches everyday skills through practical exercises and routines learners can adapt to their own lives. The focus is on steady improvement and tools that remain useful after a lesson ends." },
      { title: "Areas of expertise", text: "A certified professional coach, Kabir’s subjects include productivity, photography, and public speaking." },
      { title: "What to expect as a learner", text: "His workshops and courses focus on applying ideas in manageable steps, whether learners are building a creative skill or improving how they organize and communicate." },
    ],
    qualifications: ["Certified Professional Coach (ICF)"],
    experienceYears: 6,
    subjects: ["Productivity", "Photography", "Public Speaking"],
    languages: ["English", "Hindi"],
    rating: 4.6,
    reviewCount: 208,
    studentsCount: 2900,
  },
];

const REVIEW_TEMPLATES = [
  { name: "Ishaan Verma", rating: 5, text: "Genuinely one of the clearest courses I've taken — every concept builds on the last." },
  { name: "Sneha Bhat", rating: 5, text: "The educator explains things at just the right pace. I finally understand what I was stuck on for months." },
  { name: "Arjun Nair", rating: 4, text: "Solid course overall. A couple of the later lessons could use more examples, but I'm happy with what I learned." },
  { name: "Diya Kapadia", rating: 5, text: "Worth every rupee. The live Q&A sessions made all the difference." },
  { name: "Kabir Malhotra", rating: 3, text: "Good content but the pacing felt a bit fast in the middle section for a true beginner like me." },
];

function buildReviews(seedOffset) {
  return REVIEW_TEMPLATES.map((r, i) => ({
    id: `rv${seedOffset}${i}`,
    name: r.name,
    rating: r.rating,
    date: `2026-0${(i % 8) + 1}-1${i}`,
    text: r.text,
    featured: i === 0,
  }));
}

function ratingBreakdownFrom(reviews) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    counts[r.rating] = (counts[r.rating] ?? 0) + 1;
  });
  return counts;
}

function buildCurriculum(topic) {
  return [
    {
      id: "m1",
      title: `Getting Started with ${topic}`,
      lessons: [
        { id: "l1", title: "Course overview & how to get the most out of it", type: "video", duration: "6 min", preview: true },
        { id: "l2", title: "Setting up your environment", type: "video", duration: "12 min", preview: true },
        { id: "l3", title: "Reference cheat-sheet", type: "resource", duration: "2 min", preview: false },
      ],
    },
    {
      id: "m2",
      title: "Core Concepts",
      lessons: [
        { id: "l4", title: "Fundamentals, part 1", type: "video", duration: "18 min", preview: false },
        { id: "l5", title: "Fundamentals, part 2", type: "video", duration: "22 min", preview: false },
        { id: "l6", title: "Knowledge check", type: "quiz", duration: "10 min", preview: false },
        { id: "l7", title: "Reading: going deeper", type: "article", duration: "8 min", preview: false },
      ],
    },
    {
      id: "m3",
      title: "Applying What You've Learned",
      lessons: [
        { id: "l8", title: "Guided project walkthrough", type: "video", duration: "31 min", preview: false },
        { id: "l9", title: "Submit your project", type: "assignment", duration: "—", preview: false },
        { id: "l10", title: "Live session recording: common mistakes", type: "live", duration: "45 min", preview: false },
      ],
    },
  ];
}

const FAQS = [
  { id: "f1", question: "Do I need any prior experience to take this course?", answer: "No — this course starts from the fundamentals and builds up gradually. Each module states any prerequisite explicitly." },
  { id: "f2", question: "Is there a certificate after completion?", answer: "Yes, a certificate is issued automatically the moment you complete every required lesson and pass the final assessment." },
  { id: "f3", question: "How long do I have access to the course?", answer: "Once enrolled, you have lifetime access to all lessons, materials, and future updates to this course." },
  { id: "f4", question: "Can I get a refund if I'm not satisfied?", answer: "Refunds are handled per the platform's refund policy — see the Terms & Refund Policy link at checkout." },
];

// id / title / subtitle / price / rating / category / level kept identical
// to ExplorePage.jsx's existing ALL_COURSES so Explore's grid and this
// richer detail set describe the same six courses rather than drifting.
const BASE_COURSES = [
  { id: "c1", title: "Complete Python Bootcamp", subtitle: "Priya Sharma", educatorId: "ed1", price: 1499, originalPrice: 1999, rating: 4.8, category: "Programming", level: "Beginner", courseType: "Live", enrolled: true },
  { id: "c2", title: "Algebra Foundations", subtitle: "Rohan Mehta", educatorId: "ed2", price: 899, originalPrice: 899, rating: 4.6, category: "Math", level: "Beginner", courseType: "Self-paced", enrolled: true },
  { id: "c3", title: "IELTS Speaking Mastery", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1299, originalPrice: 1599, rating: 4.9, category: "Languages", level: "Intermediate", courseType: "Live", enrolled: true },
  { id: "c4", title: "Guitar for Beginners", subtitle: "Vikram Rao", educatorId: "ed4", price: 799, originalPrice: 999, rating: 4.7, category: "Music", level: "Beginner", courseType: "Self-paced", enrolled: true },
  { id: "c5", title: "Advanced React Patterns", subtitle: "Priya Sharma", educatorId: "ed1", price: 1999, originalPrice: 2499, rating: 4.9, category: "Programming", level: "Advanced", courseType: "Live" },
  { id: "c6", title: "UI Design Fundamentals", subtitle: "Meera Iyer", educatorId: "ed5", price: 1099, originalPrice: 1099, rating: 4.5, category: "Design", level: "Beginner", courseType: "Self-paced" },
  // Archived — reachable directly (e.g. an old wishlist/link) to exercise
  // the "course unavailable/archived" state without needing a real backend
  // flag flip. Doesn't appear in Explore/Dashboard's own mock lists.
  { id: "c7", title: "Legacy Excel Mastery", subtitle: "Rohan Mehta", educatorId: "ed2", price: 499, originalPrice: 699, rating: 4.2, category: "Business", level: "Beginner", status: "archived" },

  // Additional catalog courses so every category (matching the Landing
  // page's category tiles / hero "I'm a Student" flow and Explore's
  // category chips) has a real 10-15 course list instead of just 1-2
  // items. Same mock shape as the six above; each new course's
  // educatorId points at a real EDUCATORS entry so its subtitle,
  // Educator Public Profile, and course count all agree.
  { id: "c8", title: "JavaScript Essentials", subtitle: "Priya Sharma", educatorId: "ed1", price: 1200, originalPrice: 1200, rating: 4.3, category: "Programming", level: "Beginner", courseType: "Self-paced" },
  { id: "c9", title: "Full-Stack Web Development", subtitle: "Priya Sharma", educatorId: "ed1", price: 1275, originalPrice: 1575, rating: 4.4, category: "Programming", level: "Intermediate", courseType: "Self-paced" },
  { id: "c10", title: "Data Structures & Algorithms in Java", subtitle: "Priya Sharma", educatorId: "ed1", price: 1350, originalPrice: 1650, rating: 4.5, category: "Programming", level: "Advanced", courseType: "Self-paced" },
  { id: "c11", title: "Modern C++ for Beginners", subtitle: "Priya Sharma", educatorId: "ed1", price: 1425, originalPrice: 1425, rating: 4.6, category: "Programming", level: "Beginner", courseType: "Live" },
  { id: "c12", title: "Django for Backend Developers", subtitle: "Priya Sharma", educatorId: "ed1", price: 1500, originalPrice: 1800, rating: 4.7, category: "Programming", level: "Intermediate", courseType: "Self-paced" },
  { id: "c13", title: "Mobile App Development with Flutter", subtitle: "Priya Sharma", educatorId: "ed1", price: 1575, originalPrice: 1875, rating: 4.8, category: "Programming", level: "Advanced", courseType: "Self-paced" },
  { id: "c14", title: "Git & GitHub Mastery", subtitle: "Priya Sharma", educatorId: "ed1", price: 1650, originalPrice: 1650, rating: 4.3, category: "Programming", level: "Beginner", courseType: "Self-paced" },
  { id: "c15", title: "SQL for Developers", subtitle: "Priya Sharma", educatorId: "ed1", price: 1725, originalPrice: 2025, rating: 4.4, category: "Programming", level: "Intermediate", courseType: "Live" },
  { id: "c16", title: "Node.js API Development", subtitle: "Priya Sharma", educatorId: "ed1", price: 1800, originalPrice: 2100, rating: 4.5, category: "Programming", level: "Advanced", courseType: "Self-paced" },
  { id: "c17", title: "Machine Learning with Python", subtitle: "Priya Sharma", educatorId: "ed1", price: 1875, originalPrice: 1875, rating: 4.6, category: "Programming", level: "Beginner", courseType: "Self-paced" },
  { id: "c18", title: "Trigonometry Made Simple", subtitle: "Rohan Mehta", educatorId: "ed2", price: 800, originalPrice: 800, rating: 4.3, category: "Math", level: "Beginner", courseType: "Self-paced" },
  { id: "c19", title: "Calculus I: Limits & Derivatives", subtitle: "Rohan Mehta", educatorId: "ed2", price: 875, originalPrice: 1175, rating: 4.4, category: "Math", level: "Intermediate", courseType: "Self-paced" },
  { id: "c20", title: "Geometry Essentials", subtitle: "Rohan Mehta", educatorId: "ed2", price: 950, originalPrice: 1250, rating: 4.5, category: "Math", level: "Advanced", courseType: "Self-paced" },
  { id: "c21", title: "Statistics & Probability", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1025, originalPrice: 1025, rating: 4.6, category: "Math", level: "Beginner", courseType: "Live" },
  { id: "c22", title: "Linear Algebra Basics", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1100, originalPrice: 1400, rating: 4.7, category: "Math", level: "Intermediate", courseType: "Self-paced" },
  { id: "c23", title: "Number Theory for Competitions", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1175, originalPrice: 1475, rating: 4.8, category: "Math", level: "Advanced", courseType: "Self-paced" },
  { id: "c24", title: "Vedic Math Speed Techniques", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1250, originalPrice: 1250, rating: 4.3, category: "Math", level: "Beginner", courseType: "Self-paced" },
  { id: "c25", title: "Calculus II: Integration", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1325, originalPrice: 1625, rating: 4.4, category: "Math", level: "Intermediate", courseType: "Live" },
  { id: "c26", title: "Discrete Mathematics", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1400, originalPrice: 1700, rating: 4.5, category: "Math", level: "Advanced", courseType: "Self-paced" },
  { id: "c27", title: "Math for Data Science", subtitle: "Rohan Mehta", educatorId: "ed2", price: 1475, originalPrice: 1475, rating: 4.6, category: "Math", level: "Beginner", courseType: "Self-paced" },
  { id: "c28", title: "Mental Math Mastery", subtitle: "Rohan Mehta", educatorId: "ed2", price: 850, originalPrice: 1150, rating: 4.7, category: "Math", level: "Intermediate", courseType: "Self-paced" },
  { id: "c29", title: "Spoken English for Beginners", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1000, originalPrice: 1000, rating: 4.3, category: "Languages", level: "Beginner", courseType: "Self-paced" },
  { id: "c30", title: "Business English Communication", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1075, originalPrice: 1375, rating: 4.4, category: "Languages", level: "Intermediate", courseType: "Self-paced" },
  { id: "c31", title: "French for Beginners", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1150, originalPrice: 1450, rating: 4.5, category: "Languages", level: "Advanced", courseType: "Self-paced" },
  { id: "c32", title: "Spanish Conversation Practice", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1225, originalPrice: 1225, rating: 4.6, category: "Languages", level: "Beginner", courseType: "Live" },
  { id: "c33", title: "German A1 Essentials", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1300, originalPrice: 1600, rating: 4.7, category: "Languages", level: "Intermediate", courseType: "Self-paced" },
  { id: "c34", title: "TOEFL Prep Intensive", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1375, originalPrice: 1675, rating: 4.8, category: "Languages", level: "Advanced", courseType: "Self-paced" },
  { id: "c35", title: "English Grammar Bootcamp", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1450, originalPrice: 1450, rating: 4.3, category: "Languages", level: "Beginner", courseType: "Self-paced" },
  { id: "c36", title: "Public Speaking in English", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1525, originalPrice: 1825, rating: 4.4, category: "Languages", level: "Intermediate", courseType: "Live" },
  { id: "c37", title: "Creative Writing Workshop", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1600, originalPrice: 1900, rating: 4.5, category: "Languages", level: "Advanced", courseType: "Self-paced" },
  { id: "c38", title: "Hindi for Non-Native Speakers", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1675, originalPrice: 1675, rating: 4.6, category: "Languages", level: "Beginner", courseType: "Self-paced" },
  { id: "c39", title: "Japanese Basics N5", subtitle: "Anaya Kapoor", educatorId: "ed3", price: 1050, originalPrice: 1350, rating: 4.7, category: "Languages", level: "Intermediate", courseType: "Self-paced" },
  { id: "c40", title: "Music Theory Fundamentals", subtitle: "Vikram Rao", educatorId: "ed4", price: 700, originalPrice: 700, rating: 4.3, category: "Music", level: "Beginner", courseType: "Self-paced" },
  { id: "c41", title: "Piano for Absolute Beginners", subtitle: "Vikram Rao", educatorId: "ed4", price: 775, originalPrice: 1075, rating: 4.4, category: "Music", level: "Intermediate", courseType: "Self-paced" },
  { id: "c42", title: "Indian Classical Vocals", subtitle: "Vikram Rao", educatorId: "ed4", price: 850, originalPrice: 1150, rating: 4.5, category: "Music", level: "Advanced", courseType: "Self-paced" },
  { id: "c43", title: "Drum Kit Essentials", subtitle: "Vikram Rao", educatorId: "ed4", price: 925, originalPrice: 925, rating: 4.6, category: "Music", level: "Beginner", courseType: "Live" },
  { id: "c44", title: "Ukulele Quick Start", subtitle: "Vikram Rao", educatorId: "ed4", price: 1000, originalPrice: 1300, rating: 4.7, category: "Music", level: "Intermediate", courseType: "Self-paced" },
  { id: "c45", title: "Songwriting & Composition", subtitle: "Vikram Rao", educatorId: "ed4", price: 1075, originalPrice: 1375, rating: 4.8, category: "Music", level: "Advanced", courseType: "Self-paced" },
  { id: "c46", title: "Music Production with FL Studio", subtitle: "Vikram Rao", educatorId: "ed4", price: 1150, originalPrice: 1150, rating: 4.3, category: "Music", level: "Beginner", courseType: "Self-paced" },
  { id: "c47", title: "Violin Basics", subtitle: "Vikram Rao", educatorId: "ed4", price: 1225, originalPrice: 1525, rating: 4.4, category: "Music", level: "Intermediate", courseType: "Live" },
  { id: "c48", title: "Bass Guitar Foundations", subtitle: "Vikram Rao", educatorId: "ed4", price: 1300, originalPrice: 1600, rating: 4.5, category: "Music", level: "Advanced", courseType: "Self-paced" },
  { id: "c49", title: "Singing Technique & Breath Control", subtitle: "Vikram Rao", educatorId: "ed4", price: 1375, originalPrice: 1375, rating: 4.6, category: "Music", level: "Beginner", courseType: "Self-paced" },
  { id: "c50", title: "Electronic Music Production", subtitle: "Vikram Rao", educatorId: "ed4", price: 750, originalPrice: 1050, rating: 4.7, category: "Music", level: "Intermediate", courseType: "Self-paced" },
  { id: "c51", title: "UX Research Essentials", subtitle: "Meera Iyer", educatorId: "ed5", price: 1100, originalPrice: 1100, rating: 4.3, category: "Design", level: "Beginner", courseType: "Self-paced" },
  { id: "c52", title: "Figma for Product Designers", subtitle: "Meera Iyer", educatorId: "ed5", price: 1175, originalPrice: 1475, rating: 4.4, category: "Design", level: "Intermediate", courseType: "Self-paced" },
  { id: "c53", title: "Graphic Design Principles", subtitle: "Meera Iyer", educatorId: "ed5", price: 1250, originalPrice: 1550, rating: 4.5, category: "Design", level: "Advanced", courseType: "Self-paced" },
  { id: "c54", title: "Design Systems in Practice", subtitle: "Meera Iyer", educatorId: "ed5", price: 1325, originalPrice: 1325, rating: 4.6, category: "Design", level: "Beginner", courseType: "Live" },
  { id: "c55", title: "Adobe Photoshop Masterclass", subtitle: "Meera Iyer", educatorId: "ed5", price: 1400, originalPrice: 1700, rating: 4.7, category: "Design", level: "Intermediate", courseType: "Self-paced" },
  { id: "c56", title: "Typography for Designers", subtitle: "Meera Iyer", educatorId: "ed5", price: 1475, originalPrice: 1775, rating: 4.8, category: "Design", level: "Advanced", courseType: "Self-paced" },
  { id: "c57", title: "Motion Design Basics", subtitle: "Meera Iyer", educatorId: "ed5", price: 1550, originalPrice: 1550, rating: 4.3, category: "Design", level: "Beginner", courseType: "Self-paced" },
  { id: "c58", title: "Brand Identity Design", subtitle: "Meera Iyer", educatorId: "ed5", price: 1625, originalPrice: 1925, rating: 4.4, category: "Design", level: "Intermediate", courseType: "Live" },
  { id: "c59", title: "Illustration for Beginners", subtitle: "Meera Iyer", educatorId: "ed5", price: 1700, originalPrice: 2000, rating: 4.5, category: "Design", level: "Advanced", courseType: "Self-paced" },
  { id: "c60", title: "Design Thinking Workshop", subtitle: "Meera Iyer", educatorId: "ed5", price: 1775, originalPrice: 1775, rating: 4.6, category: "Design", level: "Beginner", courseType: "Self-paced" },
  { id: "c61", title: "Portfolio Building for Designers", subtitle: "Meera Iyer", educatorId: "ed5", price: 1150, originalPrice: 1450, rating: 4.7, category: "Design", level: "Intermediate", courseType: "Self-paced" },
  { id: "c62", title: "Physics Fundamentals: Mechanics", subtitle: "Aditya Sen", educatorId: "ed6", price: 900, originalPrice: 900, rating: 4.3, category: "Science", level: "Beginner", courseType: "Self-paced" },
  { id: "c63", title: "Organic Chemistry Basics", subtitle: "Aditya Sen", educatorId: "ed6", price: 975, originalPrice: 1275, rating: 4.4, category: "Science", level: "Intermediate", courseType: "Self-paced" },
  { id: "c64", title: "Introduction to Biology", subtitle: "Aditya Sen", educatorId: "ed6", price: 1050, originalPrice: 1350, rating: 4.5, category: "Science", level: "Advanced", courseType: "Self-paced" },
  { id: "c65", title: "Environmental Science Essentials", subtitle: "Aditya Sen", educatorId: "ed6", price: 1125, originalPrice: 1125, rating: 4.6, category: "Science", level: "Beginner", courseType: "Live" },
  { id: "c66", title: "Astronomy for Beginners", subtitle: "Aditya Sen", educatorId: "ed6", price: 1200, originalPrice: 1500, rating: 4.7, category: "Science", level: "Intermediate", courseType: "Self-paced" },
  { id: "c67", title: "Human Anatomy & Physiology", subtitle: "Aditya Sen", educatorId: "ed6", price: 1275, originalPrice: 1575, rating: 4.8, category: "Science", level: "Advanced", courseType: "Self-paced" },
  { id: "c68", title: "Chemistry: Reactions & Equations", subtitle: "Aditya Sen", educatorId: "ed6", price: 1350, originalPrice: 1350, rating: 4.3, category: "Science", level: "Beginner", courseType: "Self-paced" },
  { id: "c69", title: "Physics: Electricity & Magnetism", subtitle: "Aditya Sen", educatorId: "ed6", price: 1425, originalPrice: 1725, rating: 4.4, category: "Science", level: "Intermediate", courseType: "Live" },
  { id: "c70", title: "Genetics 101", subtitle: "Aditya Sen", educatorId: "ed6", price: 1500, originalPrice: 1800, rating: 4.5, category: "Science", level: "Advanced", courseType: "Self-paced" },
  { id: "c71", title: "Earth Science & Geology", subtitle: "Aditya Sen", educatorId: "ed6", price: 1575, originalPrice: 1575, rating: 4.6, category: "Science", level: "Beginner", courseType: "Self-paced" },
  { id: "c72", title: "Scientific Method & Lab Skills", subtitle: "Aditya Sen", educatorId: "ed6", price: 950, originalPrice: 1250, rating: 4.7, category: "Science", level: "Intermediate", courseType: "Self-paced" },
  { id: "c73", title: "Botany Basics", subtitle: "Aditya Sen", educatorId: "ed6", price: 1025, originalPrice: 1325, rating: 4.8, category: "Science", level: "Advanced", courseType: "Live" },
  { id: "c74", title: "Entrepreneurship Fundamentals", subtitle: "Neha Joshi", educatorId: "ed7", price: 1300, originalPrice: 1300, rating: 4.3, category: "Business", level: "Beginner", courseType: "Self-paced" },
  { id: "c75", title: "Digital Marketing Essentials", subtitle: "Neha Joshi", educatorId: "ed7", price: 1375, originalPrice: 1675, rating: 4.4, category: "Business", level: "Intermediate", courseType: "Self-paced" },
  { id: "c76", title: "Financial Modeling Basics", subtitle: "Neha Joshi", educatorId: "ed7", price: 1450, originalPrice: 1750, rating: 4.5, category: "Business", level: "Advanced", courseType: "Self-paced" },
  { id: "c77", title: "Project Management Fundamentals", subtitle: "Neha Joshi", educatorId: "ed7", price: 1525, originalPrice: 1525, rating: 4.6, category: "Business", level: "Beginner", courseType: "Live" },
  { id: "c78", title: "Business Strategy 101", subtitle: "Neha Joshi", educatorId: "ed7", price: 1600, originalPrice: 1900, rating: 4.7, category: "Business", level: "Intermediate", courseType: "Self-paced" },
  { id: "c79", title: "Leadership & Team Management", subtitle: "Neha Joshi", educatorId: "ed7", price: 1675, originalPrice: 1975, rating: 4.8, category: "Business", level: "Advanced", courseType: "Self-paced" },
  { id: "c80", title: "Sales Fundamentals", subtitle: "Neha Joshi", educatorId: "ed7", price: 1750, originalPrice: 1750, rating: 4.3, category: "Business", level: "Beginner", courseType: "Self-paced" },
  { id: "c81", title: "Personal Finance & Budgeting", subtitle: "Neha Joshi", educatorId: "ed7", price: 1825, originalPrice: 2125, rating: 4.4, category: "Business", level: "Intermediate", courseType: "Live" },
  { id: "c82", title: "Startup Fundraising 101", subtitle: "Neha Joshi", educatorId: "ed7", price: 1900, originalPrice: 2200, rating: 4.5, category: "Business", level: "Advanced", courseType: "Self-paced" },
  { id: "c83", title: "Negotiation Skills Masterclass", subtitle: "Neha Joshi", educatorId: "ed7", price: 1975, originalPrice: 1975, rating: 4.6, category: "Business", level: "Beginner", courseType: "Self-paced" },
  { id: "c84", title: "Supply Chain Management Basics", subtitle: "Neha Joshi", educatorId: "ed7", price: 1350, originalPrice: 1650, rating: 4.7, category: "Business", level: "Intermediate", courseType: "Self-paced" },
  { id: "c85", title: "Excel for Business Analytics", subtitle: "Neha Joshi", educatorId: "ed7", price: 1425, originalPrice: 1725, rating: 4.8, category: "Business", level: "Advanced", courseType: "Live" },
  { id: "c86", title: "Photography Fundamentals", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 600, originalPrice: 600, rating: 4.3, category: "Other", level: "Beginner", courseType: "Self-paced" },
  { id: "c87", title: "Personal Productivity & Time Management", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 675, originalPrice: 975, rating: 4.4, category: "Other", level: "Intermediate", courseType: "Self-paced" },
  { id: "c88", title: "Career Interview Preparation", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 750, originalPrice: 1050, rating: 4.5, category: "Other", level: "Advanced", courseType: "Self-paced" },
  { id: "c89", title: "Yoga & Mindfulness Basics", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 825, originalPrice: 825, rating: 4.6, category: "Other", level: "Beginner", courseType: "Live" },
  { id: "c90", title: "Cooking Essentials for Beginners", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 900, originalPrice: 1200, rating: 4.7, category: "Other", level: "Intermediate", courseType: "Self-paced" },
  { id: "c91", title: "Creative Writing for Fun", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 975, originalPrice: 1275, rating: 4.8, category: "Other", level: "Advanced", courseType: "Self-paced" },
  { id: "c92", title: "Public Speaking Confidence", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 1050, originalPrice: 1050, rating: 4.3, category: "Other", level: "Beginner", courseType: "Self-paced" },
  { id: "c93", title: "Resume Writing Workshop", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 1125, originalPrice: 1425, rating: 4.4, category: "Other", level: "Intermediate", courseType: "Live" },
  { id: "c94", title: "Digital Wellness & Focus", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 1200, originalPrice: 1500, rating: 4.5, category: "Other", level: "Advanced", courseType: "Self-paced" },
  { id: "c95", title: "Chess Strategy for Beginners", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 1275, originalPrice: 1275, rating: 4.6, category: "Other", level: "Beginner", courseType: "Self-paced" },
  { id: "c96", title: "Home Gardening Basics", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 650, originalPrice: 950, rating: 4.7, category: "Other", level: "Intermediate", courseType: "Self-paced" },
  { id: "c97", title: "Content Creation for Social Media", subtitle: "Kabir Ahluwalia", educatorId: "ed8", price: 725, originalPrice: 1025, rating: 4.8, category: "Other", level: "Advanced", courseType: "Live" },
];

export const COURSES = BASE_COURSES.map((c, i) => {
  const reviews = buildReviews(i);
  return {
    status: "active",
    language: "English",
    duration: "6h 40m",
    lastUpdated: "2026-08-2" + ((i % 9) + 1),
    certificate: true,
    enrolledCount: 900 + i * 380,
    reviewCount: reviews.length * 41 + i * 17,
    description:
      `A practical, project-driven path through ${c.title.toLowerCase()} — built for students who want to actually apply what they learn, not just watch lessons passively.`,
    whatYouLearn: [
      "Build real, working projects from scratch",
      "Understand the core concepts, not just the syntax/steps",
      "Avoid the most common beginner mistakes",
      "Get ready for the next level course in this track",
    ],
    requirements: ["A computer with a stable internet connection", "No prior experience required unless stated in the curriculum"],
    curriculum: buildCurriculum(c.title.split(" ")[0]),
    faqs: FAQS,
    reviews,
    ratingBreakdown: ratingBreakdownFrom(reviews),
    image: imageForCategory(c.category, { w: 640, h: 480 }),
    ...c,
  };
});

export function getCourseById(id) {
  return COURSES.find((c) => c.id === id) ?? null;
}

export function getEducatorById(id) {
  return EDUCATORS.find((e) => e.id === id) ?? null;
}

export function getCoursesByEducator(educatorId) {
  return COURSES.filter((c) => c.educatorId === educatorId && c.status === "active");
}

export function getRelatedCourses(course, limit = 4) {
  return COURSES.filter((c) => c.id !== course.id && c.category === course.category && c.status === "active")
    .concat(COURSES.filter((c) => c.id !== course.id && c.category !== course.category && c.status === "active"))
    .slice(0, limit);
}

// Mock upcoming live sessions per educator — Sec 5.6 (Scheduling &
// Booking) isn't built yet, so "Book Session" below routes to the existing
// BookSession stub; this is just enough shape for the Educator Profile
// page's "Upcoming Live Sessions" list.
export function getSessionsForEducator(educatorId) {
  const educator = getEducatorById(educatorId);
  if (!educator) return [];
  return [
    { id: `${educatorId}-s1`, title: `1:1 Doubt Clearing — ${educator.subjects[0]}`, date: "Fri, 20 Sep", time: "6:00 PM", duration: "30 min", price: 299, seatsLeft: 4 },
    { id: `${educatorId}-s2`, title: `Group Workshop — ${educator.subjects[1] ?? educator.subjects[0]}`, date: "Sun, 22 Sep", time: "11:00 AM", duration: "60 min", price: 499, seatsLeft: 0 },
  ];
}

export function imageForEducator(educator) {
  return imageForPerson(educator.name, { w: 480, h: 480 });
}
