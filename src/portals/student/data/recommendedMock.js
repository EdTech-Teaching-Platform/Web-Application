// Mock data behind the Dashboard's "Recommended for You" row and the
// dedicated /student/recommended page (src/portals/student/pages/
// Recommended.jsx) it links to. Pulled out to its own file, matching
// src/portals/student/data/{assessmentMock,sessionMock}.js's pattern,
// since it's now shared by 2 consumers (Dashboard preview + the full
// Recommended page) rather than staying inline in one page file.
//
// ids match src/data/catalogMock.js's real course ids so clicking through
// opens a real Course Details page.
export const RECOMMENDED = [
  { id: "c5", title: "Advanced React Patterns", subtitle: "Priya Sharma", description: "Design scalable React interfaces with reusable patterns and production-ready techniques.", price: 1999, originalPrice: 2499, rating: 4.9, category: "Programming" },
  { id: "c6", title: "UI Design Fundamentals", subtitle: "Meera Iyer", description: "Learn the principles, systems, and workflows behind clear and engaging digital products.", price: 1099, originalPrice: 1099, rating: 4.5, category: "Design" },
  { id: "c4", title: "Guitar for Beginners", subtitle: "Vikram Rao", description: "Learn essential chords, rhythm, and practice routines for confident beginner playing.", price: 799, originalPrice: 999, rating: 4.7, category: "Music" },
  { id: "c3", title: "IELTS Speaking Mastery", subtitle: "Anaya Kapoor", description: "Improve fluency, confidence, and speaking strategy with structured IELTS practice.", price: 1299, originalPrice: 1599, rating: 4.9, category: "Languages" },
  { id: "c18", title: "Trigonometry Made Simple", subtitle: "Rohan Mehta", description: "Build a clear, visual intuition for trigonometry from the ground up.", price: 800, originalPrice: 800, rating: 4.3, category: "Math" },
  { id: "c62", title: "Physics Fundamentals: Mechanics", subtitle: "Aditya Sen", description: "Understand motion, forces, and energy through worked examples and practice.", price: 900, originalPrice: 900, rating: 4.3, category: "Science" },
  { id: "c74", title: "Entrepreneurship Fundamentals", subtitle: "Neha Joshi", description: "Learn how to validate an idea, build a plan, and take the first real steps.", price: 1300, originalPrice: 1300, rating: 4.3, category: "Business" },
  { id: "c86", title: "Photography Fundamentals", subtitle: "Kabir Ahluwalia", description: "Learn composition, light, and camera basics to start taking better photos.", price: 600, originalPrice: 600, rating: 4.3, category: "Other" },
];

// A second, different set for the /student/recommended page's "Related
// Courses" row — deliberately excludes every id already in RECOMMENDED
// above so the two sections never show the same course twice.
export const RELATED_COURSES = [
  { id: "c9", title: "Full-Stack Web Development", subtitle: "Priya Sharma", description: "Go from a static page to a working full-stack app, one concept at a time.", price: 1275, originalPrice: 1575, rating: 4.4, category: "Programming" },
  { id: "c52", title: "Figma for Product Designers", subtitle: "Meera Iyer", description: "Design and prototype real product screens using Figma's core workflows.", price: 1175, originalPrice: 1475, rating: 4.4, category: "Design" },
  { id: "c41", title: "Piano for Absolute Beginners", subtitle: "Vikram Rao", description: "Start playing simple songs within your first few practice sessions.", price: 775, originalPrice: 1075, rating: 4.4, category: "Music" },
  { id: "c30", title: "Business English Communication", subtitle: "Anaya Kapoor", description: "Write and speak with more confidence in meetings, emails, and interviews.", price: 1075, originalPrice: 1375, rating: 4.4, category: "Languages" },
  { id: "c19", title: "Calculus I: Limits & Derivatives", subtitle: "Rohan Mehta", description: "Build the foundations of calculus with clear, worked-through examples.", price: 875, originalPrice: 1175, rating: 4.4, category: "Math" },
  { id: "c63", title: "Organic Chemistry Basics", subtitle: "Aditya Sen", description: "Make sense of reactions and mechanisms with a practical, visual approach.", price: 975, originalPrice: 1275, rating: 4.4, category: "Science" },
  { id: "c75", title: "Digital Marketing Essentials", subtitle: "Neha Joshi", description: "Learn the channels and fundamentals behind a modern marketing plan.", price: 1375, originalPrice: 1675, rating: 4.4, category: "Business" },
  { id: "c87", title: "Personal Productivity & Time Management", subtitle: "Kabir Ahluwalia", description: "Build simple systems to focus better and get more done with less stress.", price: 675, originalPrice: 975, rating: 4.4, category: "Other" },
];
