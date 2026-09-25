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
import { imageForCategory, imageForPerson, avatarFor } from "../../utils/stockImages";
import { COURSE_CATEGORIES, CATEGORY_META } from "../../utils/constants";
import { useState } from "react";
import { COURSES, EDUCATORS } from "../../data/catalogMock";
import { SearchIcon, ShieldCheckIcon, VideoIcon, WalletIcon, UsersIcon, FileTextIcon, BookOpenIcon, TrendingUpIcon, CheckCircleIcon } from "../../components/ui/icons";
import { LandingHeroScene } from "../../components/ui/illustrations";
import SiteFooter from "../components/SiteFooter";

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

const ALL_POPULAR_COURSES = [
  COURSES.find((course) => course.id === "c1"),
  COURSES.find((course) => course.id === "c6"),
  COURSES.find((course) => course.id === "c2"),
  COURSES.find((course) => course.id === "c5"),
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
      ? ALL_POPULAR_COURSES.slice(0, 4)
      : ALL_POPULAR_COURSES.filter((c) => c.category === activeFilter).slice(0, 4);

  return (
    <div>
      {/* Hero: editorial headline + an original animated learning scene. */}
      <section className="border-b border-text/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-20">
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
                navigate(`/explore${query ? `?q=${encodeURIComponent(query)}` : ""}`);
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
          {/* `aspect-square` pins this box to a true 1:1 ratio regardless
              of the grid row's actual height (driven by the text column
              via `md:items-center`), so the scene can never be forced
              into a mismatched box the way the previous illustration
              was. The glow is drawn inside the SVG itself now, so there
              is no second, separately-sized element to fall out of sync
              with it. */}
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <LandingHeroScene className="h-full w-full text-primary" />
          </div>
        </div>
      </section>

      {/* Goal-led discovery strip. */}
      <section className="mx-auto max-w-6xl px-6 py-10">
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
      </section>

      {/* Our most popular courses */}
      <section id="courses" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
      </section>

      {/* Assessment system feature */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-8 rounded-3xl border border-text/10 bg-white p-6 shadow-sm md:grid-cols-[1fr_0.9fr] md:p-10">
          <div>
            {/* Item 7: this box is now Test Series only — Course Quizzes
                content removed, copy rewritten around Test Series and its
                per-question reporting. */}
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Test Series</p>
            <h2 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight text-text sm:text-4xl">Don’t Just Learn. Prove What You Know.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text/60">Take structured test series and realistic mock exams, then see exactly where the time went — down to how long you spent on each question.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { n: "01", title: "Structured Test Series", text: "Full-length mock exams modeled on real assessments, timed just like the real thing.", icon: FileTextIcon, tint: "bg-[#f8e8df] text-primary" },
                { n: "02", title: "Per-Question Reporting", text: "Detailed breakdowns like \u201cQ1 attempted for 2 mins\u201d so you know exactly where to improve.", icon: BookOpenIcon, tint: "bg-[#e7f1ef] text-[#28756f]" },
              ].map((item) => <article key={item.title} className="rounded-2xl border border-text/10 bg-[#fcfbfa] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-text/35">{item.n}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tint}`}><item.icon className="h-4 w-4"/></span></div><h3 className="mt-3 text-sm font-bold text-text">{item.title}</h3><p className="mt-1 text-xs leading-5 text-text/55">{item.text}</p></article>)}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-5">
            {/* Final Assessment 82% score box — content/styling unchanged per item 7. */}
            <div className="rounded-2xl border border-text/10 bg-[#fbf7f2] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary/70">Python Programming</p><h3 className="mt-1 font-display text-lg font-bold text-text">Final Assessment</h3></div><span className="rounded-full bg-[#e7f1ef] px-3 py-1 text-[11px] font-bold text-[#28756f]">PASSED</span></div><div className="mt-5 flex items-center gap-5"><div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-[7px] border-primary bg-white"><strong className="font-display text-2xl text-primary">82%</strong><span className="text-[9px] font-bold uppercase tracking-wider text-text/40">Your score</span></div><div><p className="text-sm font-semibold text-text">33 / 40 Correct</p><p className="mt-1 text-xs text-text/50">Performance breakdown</p><div className="mt-3 space-y-1.5 text-xs"><p className="text-[#28756f]">✓ Fundamentals</p><p className="text-[#28756f]">✓ Functions</p><p className="text-[#a7792c]">△ Data Structures</p></div></div></div></div>
            {/* Item 7: routes into the Test Series destination; /student/assessments/test-series
                is behind ProtectedRoute role="student", so a logged-out click already
                bounces through /login?redirect=... rather than silently rendering
                someone else's data — no separate public preview page exists to link to. */}
            <Button fullWidth={false} className="self-start px-6" onClick={() => navigate("/student/assessments/test-series")}>Explore Assessments</Button>
          </div>
        </div>
        <div className="mt-10 rounded-3xl bg-[#f4f0f8] px-6 py-8 sm:px-9"><div className="text-center"><p className="text-xs font-bold uppercase tracking-widest text-[#71549a]">A complete learning cycle</p><h2 className="mt-2 font-display text-2xl font-bold text-text sm:text-3xl">Learn → Practice → Assess → Improve</h2></div><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          { n: "01", title: "Learn", text: "Take courses from expert educators.", icon: BookOpenIcon },
          { n: "02", title: "Practice", text: "Apply what you learned through exercises and quizzes.", icon: CheckCircleIcon },
          { n: "03", title: "Test Series", text: "Take structured tests and course assessments.", icon: FileTextIcon },
          { n: "04", title: "Improve", text: "Understand weak areas and continue learning.", icon: TrendingUpIcon },
        ].map((step, index) => <div key={step.title} className="relative rounded-2xl border border-text/10 bg-white p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary"><step.icon className="h-5 w-5"/></span><div><span className="text-[10px] font-bold tracking-widest text-text/35">STEP {step.n}</span><h3 className="text-sm font-bold text-text">{step.title}</h3></div></div><p className="mt-3 text-xs leading-5 text-text/55">{step.text}</p>{index < 3 && <span className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-[#f4f0f8] px-1 text-primary lg:block">→</span>}</div>)}
        </div></div>
      </section>

      {/* Learn from the best — Instructor Grid (same ColorBlockCard,
          different meta row — never a separate InstructorCard) */}
      <section id="instructors" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
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
      </section>

      {/* Become an Educator */}
      <section id="educators" className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 rounded-2xl bg-primary/5 p-8 md:grid-cols-[1fr_1.2fr] md:p-12">
          <div className="flex flex-col items-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
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
      </section>

      {/* Stats row */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 rounded-2xl bg-primary/5 p-8 sm:grid-cols-4">
          <StatCard value={8} suffix="+" label="Years Experience" />
          <StatCard value={92} suffix="%" label="Student Satisfaction" />
          <StatCard value={250} suffix="+" label="Expert Mentors" />
          <StatCard value={50000} suffix="+" label="Total Students" />
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
              Testimonial
            </p>
            <h2 className="font-display text-2xl font-bold text-text">
              Stories From our Learning Journey.
            </h2>
          </div>
        </div>
        <Marquee rows={[TESTIMONIALS_ROW_1, TESTIMONIALS_ROW_2]} />
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
              Frequently Asked Questions
            </p>
            <h2 className="font-display text-2xl font-bold text-text">
              Answers to your most common questions.
            </h2>
          </div>
        </div>
        <Accordion items={FAQ_ITEMS} />
      </section>

      {/* Closing CTA banner */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center gap-5 rounded-2xl bg-primary px-8 py-12 text-center text-white">
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
