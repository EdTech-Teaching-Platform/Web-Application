// Public Landing Page — build spec: exact mockup layout, doc ref LMS
// Section 5.3 (Discovery — Landing/Home Page). Route: "/" (see
// src/public/routes.jsx). Marketing/discovery chrome per design.md: "carry
// the full bold color-block treatment" + "max 4-6 cards per section" — the
// opposite chrome rule from the Student Dashboard.
//
// Data below is mock/placeholder shaped to match discoveryApi's response
// contract (see src/services/discoveryApi.js) — wire up the real fetches
// once those endpoints exist; kept as local consts here so the screen
// renders and is reviewable without a backend.
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Chip from "../../components/ui/Chip";
import ColorBlockCard from "../../components/ui/ColorBlockCard";
import StatCard from "../../components/ui/StatCard";
import Marquee from "../../components/ui/Marquee";
import Accordion from "../../components/ui/Accordion";
import { imageForCategory, imageForPerson, avatarFor, imgFallback, heroPhoto } from "../../utils/stockImages";
import { COURSE_CATEGORIES, CATEGORY_META } from "../../utils/constants";
import { useState } from "react";
import { COURSES, EDUCATORS } from "../../data/catalogMock";
import { SearchIcon, ShieldCheckIcon, VideoIcon, WalletIcon, UsersIcon, FileTextIcon, BookOpenIcon, TrendingUpIcon, CheckCircleIcon, PlayCircleIcon, GoogleIcon, AppleIcon, AwardIcon, PencilIcon, TargetIcon, BriefcaseIcon, HeartIcon, ClockIcon } from "../../components/ui/icons";

import SiteFooter from "../components/SiteFooter";
import SectionShapes from "../../components/common/SectionShapes";

// No course/educator preview video is speced for this page today. If one
// is added later: design.md bans auto-play everywhere — render a static
// thumbnail + PlayIcon (see components/ui/icons) and start playback only
// on click, never on mount/scroll/hover.

// "Become an Educator" section — Section 5.1 (educator registration &
// verification) + Section 5.11 (Educator Earnings & Payouts). Grounded in
// what those modules actually promise (verification, course + live-class
// creation, an append-only earnings ledger with payout requests, and
// Discovery surfacing educators to students) rather than invented perks.
const EDUCATOR_BENEFITS = [
  {
    icon: ShieldCheckIcon,
    title: "Verified educator profile",
    description: "Complete identity verification once and get a public profile students can trust before booking or enrolling.",
  },
  {
    icon: VideoIcon,
    title: "Teach your way",
    description: "Publish self-paced courses, host live 1-on-1 or group classes, or do both — you choose the format per course.",
  },
  {
    icon: WalletIcon,
    title: "Transparent earnings",
    description: "Every credit lands in a permanent, append-only ledger. Request a payout anytime up to your available balance.",
  },
  {
    icon: UsersIcon,
    title: "Reach more students",
    description: "Get discovered in Explore and category search by learners already looking for your subject.",
  },
];

const COURSE_FILTERS = ["All", "Programming", "Design", "Business", "Math"];

// Same "Explore by goal" copy already used on ExplorePage.jsx, reused
// here rather than invented — just given the reference layout's 4
// distinct pastel-card treatment instead of ExplorePage's plain grid.
const LANDING_GOALS = [
  { icon: TargetIcon, tint: "bg-accent-peach/15", title: "Start a new skill", description: "Beginner-friendly courses to get moving on something brand new." },
  { icon: BriefcaseIcon, tint: "bg-accent-teal/15", title: "Build career-ready skills", description: "In-demand, job-focused tracks in tech, design and business." },
  { icon: FileTextIcon, tint: "bg-accent-lilac/15", title: "Prepare for exams", description: "Structured practice for board, competitive and language exams.", to: "/student/assessments/test-series" },
  { icon: HeartIcon, tint: "bg-accent-sky/15", title: "Learn for personal interest", description: "Music, languages, wellness and creative courses to enjoy." },
];

const ALL_POPULAR_COURSES = [
  COURSES.find((course) => course.id === "c1"),
  COURSES.find((course) => course.id === "c6"),
  COURSES.find((course) => course.id === "c2"),
  COURSES.find((course) => course.id === "c5"),
  COURSES.find((course) => course.id === "c9"),
];

const TOP_INSTRUCTORS = [
  EDUCATORS.find((educator) => educator.id === "ed1"),
  EDUCATORS.find((educator) => educator.id === "ed5"),
  EDUCATORS.find((educator) => educator.id === "ed2"),
  EDUCATORS.find((educator) => educator.id === "ed3"),
];

// `avatar` is filled via avatarFor() below rather than hardcoded here, so
// the mapping lives in one place (stockImages.js) instead of being
// repeated per testimonial.
const TESTIMONIALS_ROW_1 = [
  { id: "t1", quote: "The live classes completely changed how I study for exams.", name: "Ananya", role: "Grade 11 student", rating: 5 },
  { id: "t2", quote: "Found an educator who actually explains things clearly.", name: "Karan", role: "Parent", rating: 5 },
  { id: "t3", quote: "Certificates helped me land a freelance gig.", name: "Meera", role: "Learner", rating: 4 },
].map((t) => ({ ...t, avatar: avatarFor(t.id) }));
const TESTIMONIALS_ROW_2 = [
  { id: "t4", quote: "Booking a session takes seconds — no back and forth.", name: "Farhan", role: "Learner", rating: 5 },
  { id: "t5", quote: "My daughter looks forward to her classes now.", name: "Sunita", role: "Parent", rating: 5 },
  { id: "t6", quote: "Progress tracking keeps me honest about my goals.", name: "Devika", role: "Learner", rating: 4 },
].map((t) => ({ ...t, avatar: avatarFor(t.id) }));

const FAQ_ITEMS = [
  {
    id: "f1",
    question: "How do online courses and live classes work?",
    answer:
      "Courses are self-paced video/PDF/text lessons you complete on your own schedule. Live classes are scheduled sessions you book with an educator and join through a single-use link generated fresh at join time.",
  },
  {
    id: "f2",
    question: "Can I get a refund if the course isn't right for me?",
    answer:
      "Yes — refunds are handled through Orders in your dashboard, subject to the platform's refund policy and any limits set for the specific course.",
  },
  {
    id: "f3",
    question: "Are the certificates accredited and recognized?",
    answer:
      "Certificates confirm course completion on Universal Learning with a unique certificate number. Accreditation varies by course — check the specific course's details page for accreditation status before enrolling.",
  },
  {
    id: "f4",
    question: "How do 1-on-1 mentor sessions work?",
    answer:
      "You book an available slot directly with an educator; the platform prevents double-booking at the database level, and you can reschedule or cancel from Manage Booking.",
  },
  {
    id: "f5",
    question: "Can I access the materials on mobile or offline?",
    answer:
      "The web platform works on mobile browsers today. A dedicated mobile app with offline access is on the roadmap but not part of the current build.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");

  const popularCourses =
    activeFilter === "All"
      ? ALL_POPULAR_COURSES.slice(0, 5)
      : ALL_POPULAR_COURSES.filter((c) => c.category === activeFilter).slice(0, 5);

  return (
    <div>
      {/* Hero: editorial headline + an original animated learning scene. */}
      <section className="relative bg-bg py-16">
        <SectionShapes variant="hero" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div className="flex flex-col items-start">
            <span className="mb-5 inline-flex items-center rounded-full bg-blush px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Learn without limits
            </span>
            <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-5xl">
              Build skills that move you forward.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-text/65 md:text-lg">
              Learn from experienced educators through structured courses, live classes, practice, and projects designed for real progress.
            </p>
            <form
              className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-xl border border-text/15 bg-bg p-1.5 focus-within:border-primary"
              onSubmit={(event) => {
                event.preventDefault();
                const query = new FormData(event.currentTarget).get("query");
                // #browse scrolls straight to ExplorePage's filtered results
                // (same fix as the category chips below), so a search
                // actually looks like it did something instead of landing
                // above the fold with the match buried off-screen.
                navigate(`/explore${query ? `?q=${encodeURIComponent(query)}#browse` : ""}`);
              }}
            >
              <SearchIcon className="ml-3 h-5 w-5 shrink-0 text-text/40" />
              <input
                name="query"
                placeholder="What do you want to learn?"
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-text outline-none placeholder:text-text/40"
                aria-label="Search courses"
              />
              <Button fullWidth={false} type="submit" className="px-5">
                Search
              </Button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-text/50">
              <span>Popular:</span>
              {["Programming", "Design", "Languages"].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => navigate(`/explore?category=${encodeURIComponent(category)}#browse`)}
                  className="font-semibold text-primary hover:underline"
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                fullWidth={false}
                variant="primary"
                className="px-6"
                onClick={() => navigate("/register")}
              >
                I'm a Student
              </Button>
              <Button
                fullWidth={false}
                variant="secondary"
                className="px-6"
                onClick={() => navigate("/teacher/registration")}
              >
                I'm an Educator
              </Button>
            </div>
          </div>
          {/* Real photo of live online learning, in a rounded card with
              a soft blush glow behind it for depth — replaces the earlier
              cartoon-style icon-collage illustration with something that
              reads as a genuine, professional scene. A small "product
              preview" stat chip floats on the card using real design
              tokens (StatCard-style numbers), not a redrawn mockup. */}
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <div className="absolute inset-0 -z-10 rounded-full bg-blush blur-2xl" aria-hidden="true" />
            {/* Small decorative doodles beside the photo, reusing existing
                icons (AwardIcon/PencilIcon) and the same soft pastel-badge
                language used elsewhere, rather than a new illustration. */}
            <span className="absolute -right-3 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-accent-sky/20 text-primary shadow-sm" aria-hidden="true">
              <AwardIcon className="h-6 w-6" />
            </span>
            <span className="absolute -left-4 bottom-24 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-accent-peach/25 text-primary shadow-sm" aria-hidden="true">
              <PencilIcon className="h-5 w-5" />
            </span>
            <div className="h-full w-full overflow-hidden rounded-[28px] border border-text/10 bg-white p-2 shadow-[0_20px_60px_rgba(74,14,14,0.14)]">
              <img
                src={heroPhoto({ w: 640, h: 640 })}
                onError={(e) => imgFallback(e, "landing-hero", 640, 640)}
                alt="Student in a live online class"
                className="h-full w-full rounded-[20px] object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-5 flex items-center gap-3 rounded-2xl border border-text/10 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(23,50,77,0.12)] sm:-left-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-primary bg-bg">
                <span className="font-display text-xs font-bold text-primary">92%</span>
              </div>
              <div>
                <p className="font-display text-sm font-bold text-text">Course completed</p>
                <p className="text-xs text-text/50">4.9 ★ average rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Explore by goal — 4 distinct pastel cards, matching the reference
          layout's "Explore by goal" row (icon, title, one-line description,
          arrow), reusing the same real goal copy as ExplorePage.jsx. */}
      <section className="relative bg-white py-16">
        <SectionShapes variant="goals" />
        <div className="relative mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Explore by goal</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-text">Not sure where to start? Pick what you're trying to do.</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LANDING_GOALS.map((goal) => {
              const Icon = goal.icon;
              return (
                <button
                  key={goal.title}
                  type="button"
                  onClick={() => (goal.to ? navigate(goal.to) : navigate("/explore"))}
                  className={`group flex flex-col items-start gap-3 rounded-2xl ${goal.tint} p-5 text-left transition-transform duration-150 hover:-translate-y-0.5`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-sm font-bold text-text">{goal.title}</span>
                  <span className="text-xs leading-5 text-text/60">{goal.description}</span>
                  <span className="mt-auto text-xs font-semibold text-primary">Explore →</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Goal-led discovery strip. */}
      <section className="relative bg-accent-peach/10 py-16">
        <SectionShapes variant="categories" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Start with a subject</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-text">What would you like to learn?</h2>
          </div>
          <button type="button" onClick={() => navigate("/explore")} className="text-sm font-semibold text-primary hover:underline">
            Explore all courses →
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {COURSE_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <button
                key={category}
                type="button"
                onClick={() => navigate(`/explore?category=${encodeURIComponent(category)}#browse`)}
                className="group flex min-h-24 flex-col items-start justify-between rounded-xl border border-text/10 bg-white p-3 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/30"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tint}`}>
                  <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                </span>
                <span className="text-xs font-semibold text-text group-hover:text-primary">{category}</span>
              </button>
            );
          })}
        </div>
        </div>
      </section>

      {/* Our most popular courses */}
      <section id="courses" className="relative bg-white py-16">
        <SectionShapes variant="courses" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Most Popular
            </p>
            <h2 className="font-display text-2xl font-bold text-text">
              Our most popular courses.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/explore")}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all courses
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {COURSE_FILTERS.map((filter) => (
            <Chip key={filter} active={activeFilter === filter} onClick={() => setActiveFilter(filter)}>
              {filter}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {popularCourses.map((course, i) => (
            <ColorBlockCard
              key={course.id}
              rotationIndex={i}
              image={imageForCategory(course.category)}
              badge={course.category}
              title={course.title}
              subtitle={course.subtitle}
              description={course.description}
              price={course.price}
              rating={course.rating}
              reviewCount={course.reviewCount}
              actionLabel="Enroll"
              className="w-full"
              onClick={() => navigate(`/course/${course.id}`)}
              onAction={() => navigate(`/course/${course.id}`)}
            />
          ))}
        </div>
        </div>
      </section>

      {/* Test Series — a main Phase-1 product, not a small feature card:
          full-width section, exam-mockup preview on the right, primary CTA
          into the /student/test-series marketplace. */}
      <section className="relative bg-bg py-16">
        <SectionShapes variant="testimonials" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-8 rounded-3xl border border-text/10 bg-white p-6 shadow-sm md:grid-cols-[1fr_0.9fr] md:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Test Series</p>
            <h2 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight text-text sm:text-4xl">Prepare. Practice. Perform.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text/60">Practice with topic-wise, subject-wise and full-length test series designed to help you understand your preparation, improve your speed and identify areas that need more work.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { n: "01", title: "Structured Test Series", text: "Chapter, subject and full-length mock exams, timed just like the real thing.", icon: FileTextIcon, tint: "bg-[#f8e8df] text-primary" },
                { n: "02", title: "Per-Question Reporting", text: "Detailed breakdowns of time spent and accuracy per question, so you know exactly where to improve.", icon: BookOpenIcon, tint: "bg-[#e7f1ef] text-[#28756f]" },
              ].map((item) => <article key={item.title} className="rounded-2xl border border-text/10 bg-[#fcfbfa] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-text/35">{item.n}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tint}`}><item.icon className="h-4 w-4"/></span></div><h3 className="mt-3 text-sm font-bold text-text">{item.title}</h3><p className="mt-1 text-xs leading-5 text-text/55">{item.text}</p></article>)}
            </div>
            <Button fullWidth={false} className="mt-6 px-6" onClick={() => navigate("/student/test-series")}>Explore Test Series</Button>
          </div>
          <div className="flex flex-col justify-center">
            {/* Static exam-UI mockup — illustrative preview, not a real
                live test (this is a marketing page, not the exam shell). */}
            <div className="rounded-2xl border border-text/10 bg-[#fcfbfa] p-5 sm:p-6">
              <div className="flex items-center justify-between text-xs font-semibold text-text/55">
                <span>Question 12 / 50</span>
                <span className="inline-flex items-center gap-1.5 text-primary"><ClockIcon className="h-3.5 w-3.5"/>34:28</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-text/10"><div className="h-full w-[24%] rounded-full bg-primary"/></div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-text/40">Question palette</p>
              <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
                  const state = n <= 8 ? "answered" : n === 12 ? "current" : n === 9 || n === 15 ? "flagged" : n === 6 || n === 13 ? "unanswered" : "unvisited";
                  const tone = state === "answered" ? "bg-[#28756f] text-white" : state === "current" ? "bg-primary text-white ring-2 ring-primary ring-offset-1" : state === "flagged" ? "bg-[#e8c25a] text-white" : state === "unanswered" ? "bg-primary/15 text-primary" : "bg-text/5 text-text/40";
                  return <span key={n} className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${tone}`}>{n}</span>;
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-text/50">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#28756f]"/>Answered</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/15"/>Unanswered</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#e8c25a]"/>Marked</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-text/5"/>Not visited</span>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-text/10 bg-[#fbf7f2] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary/70">Python Programming</p><h3 className="mt-1 font-display text-lg font-bold text-text">Final Assessment</h3></div><span className="rounded-full bg-[#e7f1ef] px-3 py-1 text-[11px] font-bold text-[#28756f]">PASSED</span></div><div className="mt-5 flex items-center gap-5"><div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-[6px] border-primary bg-white"><strong className="font-display text-xl text-primary">82%</strong><span className="text-[8px] font-bold uppercase tracking-wider text-text/40">Score</span></div><div><p className="text-sm font-semibold text-text">33 / 40 correct</p><p className="mt-1 text-xs text-text/50">Performance breakdown</p></div></div></div>
          </div>
        </div>
        </div>
      </section>

      {/* Learning paths — pulled out of the assessment box above into its
          own full-width lavender band, matching the reference layout's
          "learning paths" pattern: heading + CTA on the left, path cards
          on the right. Same real "Learn → Practice → Assess → Improve"
          step copy as before, just restructured. */}
      <section className="relative bg-[#f4f0f8] py-16">
        <SectionShapes variant="paths" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.6fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#71549a]">A complete learning cycle</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-text sm:text-3xl">Learn → Practice → Assess → Improve</h2>
              <p className="mt-3 text-sm leading-6 text-text/60">Every course pairs with practice and structured assessment, so progress is something you can prove.</p>
              <Button fullWidth={false} className="mt-6 px-6" onClick={() => navigate("/explore")}>Explore all courses →</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { n: "01", title: "Learn", text: "Take courses from expert educators.", icon: BookOpenIcon },
                { n: "02", title: "Practice", text: "Apply what you learned through exercises and quizzes.", icon: CheckCircleIcon },
                { n: "03", title: "Test Series", text: "Take structured tests and course assessments.", icon: FileTextIcon },
                { n: "04", title: "Improve", text: "Understand weak areas and continue learning.", icon: TrendingUpIcon },
              ].map((step) => (
                <div key={step.title} className="rounded-2xl border border-text/10 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary"><step.icon className="h-5 w-5" /></span>
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-text/35">STEP {step.n}</span>
                      <h3 className="text-sm font-bold text-text">{step.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-text/55">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Learn Live -- real Live Classes feature (see /student/live-classes,
          courseType === "Live" in catalogMock), adapted from a competitor
          reference layout but grounded in what this platform actually
          offers, not an invented English-teaching pitch. */}
      <section className="relative bg-white py-16">
        <SectionShapes variant="why" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-8 rounded-3xl bg-primary p-6 text-white md:grid-cols-2 md:p-10">
          <div className="flex flex-col items-start">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <VideoIcon className="h-3.5 w-3.5" />
              Live Classes
            </span>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              Learn Live with Real Educators
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              Book scheduled sessions with verified educators and join through a
              single-use link generated fresh at join time -- real-time teaching,
              not just recorded video.
            </p>
            <Button
              fullWidth={false}
              variant="inverse"
              className="mt-6 px-6"
              onClick={() => navigate("/student/live-classes")}
            >
              Explore Live Classes
            </Button>
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                "Expert educators",
                "Live weekly sessions",
                "Sync across all devices",
                "Interactive Q&A",
                "Small cohort sizes",
                "Topic-based classes",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/90">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-accent-peach" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm md:max-w-none">
            <img
              src={imageForPerson("live-classes-hero", { w: 480, h: 420 })}
              onError={(e) => imgFallback(e, "live-classes-hero", 480, 420)}
              alt="Educator teaching a live class"
              className="h-full w-full rounded-2xl object-cover"
            />
            {/* Decorative play-button overlay only -- there is no video
                backend/recording behind this image, so it is not wired to
                any click handler or player. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                <PlayCircleIcon className="h-9 w-9 text-primary" />
              </span>
            </span>
          </div>
        </div>
        </div>
      </section>

      {/* Learn Anywhere -- the platform is responsive today; the app-store
          badges below are presentational placeholders (no real mobile app
          exists yet), flagged rather than linked to fabricated store URLs. */}
      <section className="relative bg-bg py-16">
        <SectionShapes variant="cta" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-8 rounded-3xl bg-primary p-6 text-white md:grid-cols-2 md:p-10">
          <div className="relative order-2 mx-auto w-full max-w-sm md:order-1 md:max-w-none">
            <img
              src={imageForPerson("mobile-app-hero", { w: 480, h: 420 })}
              onError={(e) => imgFallback(e, "mobile-app-hero", 480, 420)}
              alt="Learner studying from a phone"
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
          <div className="order-1 flex flex-col items-start md:order-2">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <UsersIcon className="h-3.5 w-3.5" />
              Any Device
            </span>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              Learn Anytime, Anywhere
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              The web platform works across desktop and mobile browsers today,
              so you can pick up a course or join a live class from whatever
              device is in front of you.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* Presentational only -- no dedicated mobile app exists yet
                  (see FAQ_ITEMS f5 above). Not links: no real store URLs to
                  point at, so these render as static badges rather than
                  fabricated destinations. */}
              <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/60" title="Coming soon -- no mobile app yet">
                <GoogleIcon className="h-4 w-4" />
                Google Play
              </span>
              <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/60" title="Coming soon -- no mobile app yet">
                <AppleIcon className="h-4 w-4" />
                App Store
              </span>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                "Sync across devices",
                "Continue where you left off",
                "Downloadable resources",
                "Topic-based learning",
                "Live class access",
                "Daily learning goals",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/90">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-accent-peach" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Learn from the best — Instructor Grid (same ColorBlockCard,
          different meta row — never a separate InstructorCard) */}
      <section id="instructors" className="relative bg-white py-16">
        <SectionShapes variant="educators" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Top Rated
            </p>
            <h2 className="font-display text-2xl font-bold text-text">Learn from the best.</h2>
          </div>
          <a
            href="/instructors"
            onClick={(e) => {
              e.preventDefault();
              navigate("/instructors");
            }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all instructors
          </a>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOP_INSTRUCTORS.map((instructor, i) => (
            <ColorBlockCard
              key={instructor.id}
              rotationIndex={i}
              image={imageForPerson(instructor.name)}
              badge="Top Rated Instructor"
              title={instructor.name}
              subtitle={instructor.headline}
              description={`${instructor.subjects.slice(0, 2).join(", ")} · ${instructor.experienceYears}+ yrs experience`}
              rating={instructor.rating}
              reviewCount={instructor.reviewCount}
              actionLabel="View Profile"
              className="w-full"
              onClick={() => navigate(`/educator?educator=${instructor.id}`)}
              onAction={() => navigate(`/educator?educator=${instructor.id}`)}
            />
          ))}
        </div>
        </div>
      </section>

      {/* Become an Educator */}
      <section id="educators" className="relative bg-bg py-16">
        <SectionShapes variant="why" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-10 rounded-2xl bg-white p-8 md:grid-cols-[1fr_1.2fr] md:p-12">
          <div className="flex flex-col items-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              For Educators
            </p>
            <h2 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Teach what you know. Get paid for it.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-text/65">
              Join 250+ verified educators building courses and hosting live classes for learners around the world, with transparent earnings and payouts you can track anytime.
            </p>
            <Button
              fullWidth={false}
              className="mt-6 px-6"
              onClick={() => navigate("/teacher/registration")}
            >
              Become an Educator
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EDUCATOR_BENEFITS.map((benefit) => (
              <div key={benefit.title} className="rounded-xl bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <benefit.icon className="h-4 w-4 text-primary" />
                </span>
                <p className="mt-3 text-sm font-semibold text-text">{benefit.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text/60">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="relative bg-white py-16">
        <SectionShapes variant="categories" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 rounded-2xl bg-bg p-8 sm:grid-cols-4">
          <StatCard value={8} suffix="+" label="Years Experience" />
          <StatCard value={92} suffix="%" label="Student Satisfaction" />
          <StatCard value={250} suffix="+" label="Expert Mentors" />
          <StatCard value={50000} suffix="+" label="Total Students" />
        </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative bg-bg py-16">
        <SectionShapes variant="testimonials" />
        <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Testimonial
            </p>
            <h2 className="font-display text-2xl font-bold text-text">
              Stories From our Learning Journey.
            </h2>
          </div>
        </div>
        <Marquee rows={[TESTIMONIALS_ROW_1, TESTIMONIALS_ROW_2]} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative bg-white py-16">
        <SectionShapes variant="faq" />
        <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Frequently Asked Questions
            </p>
            <h2 className="font-display text-2xl font-bold text-text">
              Answers to your most common questions.
            </h2>
          </div>
        </div>
        <Accordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* Closing CTA banner */}
      <section className="relative mx-auto max-w-6xl px-6 py-16">
        <SectionShapes variant="cta" />
        <div className="relative flex flex-col items-center gap-5 rounded-2xl bg-primary px-8 py-12 text-center text-white">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Ready to start learning?</h2>
          <p className="max-w-lg text-sm text-white/80">
            Join over 50,000 learners mastering in-demand skills today with world-class mentors.
          </p>
          <Button
            fullWidth={false}
            variant="inverse"
            className="px-8"
            onClick={() => navigate("/register")}
          >
            Get Started Now
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
