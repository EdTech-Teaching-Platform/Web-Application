// Public Landing Page — doc ref LMS Section 5.3 (Discovery — Landing/Home
// Page). Route: "/" (see src/public/routes.jsx).
//
// 2026 visual redesign: new theme (electric blue / ink / sunshine yellow on
// white, rounded "bubble" components) scoped to this page through the
// --lp-* variables in ../landingTheme.js. Behaviour is unchanged from the
// previous version — same routes, search + category navigation, board-exam
// countdown, mock data shape, and the same shared components (StatCard,
// Marquee, Accordion) — only presentation changed.
//
// Data below is mock/placeholder shaped to match discoveryApi's response
// contract (see src/services/discoveryApi.js) — wire up the real fetches
// once those endpoints exist.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { prefetchPublicList } from "../../portals/student/services/studentSeriesApi";
import StatCard from "../../components/ui/StatCard";
import Marquee from "../../components/ui/Marquee";
import { imageForPerson, imgFallback, heroPhoto } from "../../utils/stockImages";
import {
  GoogleIcon,
  AppleIcon,
  PlayIcon,
} from "../../components/ui/icons";

import SiteFooter from "../components/SiteFooter";
import { LANDING_THEME_VARS } from "../landingTheme";
import { ProductShowcase, SectionTitle } from "../components/landing/ProductShowcase";
import HeroSection from "../components/landing/HeroSection";
import ClassFinder from "../components/landing/ClassFinder";
import TestJourney from "../components/landing/TestJourney";
import ExamCountdownBanner from "../components/landing/ExamCountdownBanner";
import TestSeriesShowcase from "../components/landing/TestSeriesShowcase";
import EducatorsCarousel from "../components/landing/EducatorsCarousel";
import FaqSection from "../components/landing/FaqSection";
import DeviceMockup from "../components/landing/DeviceMockup";
import { Reveal, PillButton, SectionHead, Squiggle } from "../components/landing/LandingUI";

// No course/educator preview video is speced for this page today. If one
// is added later: design.md bans auto-play everywhere — render a static
// thumbnail + PlayIcon (see components/ui/icons) and start playback only
// on click, never on mount/scroll/hover.

// Testimonials render initials avatars (no stock photos) so names and faces never mismatch.
const TESTIMONIALS_ROW_1 = [
  { id: "t1", quote: "The live classes completely changed how I study for exams.", name: "Ananya", role: "Grade 11 student", rating: 5 },
  { id: "t2", quote: "Found an educator who actually explains things clearly.", name: "Karan", role: "Parent", rating: 5 },
  { id: "t3", quote: "Certificates helped me land a freelance gig.", name: "Meera", role: "Learner", rating: 4 },
  { id: "t7", quote: "Doubts get cleared in the session itself, so I never fall behind.", name: "Rohan", role: "Grade 10 student", rating: 5 },
];
const TESTIMONIALS_ROW_2 = [
  { id: "t4", quote: "Booking a session takes seconds — no back and forth.", name: "Farhan", role: "Learner", rating: 5 },
  { id: "t5", quote: "My daughter looks forward to her classes now.", name: "Sunita", role: "Parent", rating: 5 },
  { id: "t6", quote: "Progress tracking keeps me honest about my goals.", name: "Devika", role: "Learner", rating: 4 },
  { id: "t8", quote: "I can see exactly how my son is doing after every class.", name: "Anil", role: "Parent", rating: 5 },
];

const FAQ_ITEMS = [
  {
    id: "f1",
    question: "How does a test series work?",
    answer:
      "A test series is a package of timed tests for a class and subject, such as chapter tests, full-length tests and mock exams. Enrol, and the tests unlock in your dashboard. Each one runs against a timer and is scored the moment you submit.",
  },
  {
    id: "f2",
    question: "Can I retake a test?",
    answer:
      "Yes. Every attempt is saved in your attempt history, so you can retake a test and compare scores over time. How many attempts a test allows can vary, so check the test details before you start.",
  },
  {
    id: "f3",
    question: "What do I get in my report after a test?",
    answer:
      "A detailed report after every attempt: your score, how many answers were correct, wrong or skipped, and a topic-wise breakdown that shows what to revise next. Pass marks vary by test.",
  },
  {
    id: "f4",
    question: "Which classes and exams are covered?",
    answer:
      "Test series are organised by class and subject, from Class 6 to Class 12, with practice for board, entrance and competitive exams too. Browse the list or search by subject or exam to see what's available.",
  },
  {
    id: "f5",
    question: "Are test series free or paid, and can I get a refund?",
    answer:
      "Some series are free and others are paid, with the price shown on each series. Where a refund applies, it is handled through Orders in your dashboard, subject to the platform's refund policy.",
  },
];

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

export default function LandingPage() {
  const navigate = useNavigate();

  // Warm the public test-series list so "Explore Test Series" opens instantly.
  useEffect(() => {
    const id = window.setTimeout(() => prefetchPublicList(50), 600);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div style={LANDING_THEME_VARS} className="overflow-x-clip bg-white font-body text-(--lp-ink) selection:bg-(--lp-yellow) selection:text-(--lp-ink)">
      <HeroSection />

      {/* ──────────────────── BOARD EXAM COUNTDOWN ───────────────────── */}
      <ExamCountdownBanner />

      {/* ───────────────── STATS + PLATFORM ───────────────── */}
      <section className="bg-(--lp-blue-tint) py-12 md:py-14">
        <div className={SHELL}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-0 md:divide-x md:divide-(--lp-blue)/15">
            {[
              { value: 50000, suffix: "+", label: "Students learning", bar: "bg-(--lp-blue)" },
              { value: 250, suffix: "+", label: "Verified mentors", bar: "bg-(--lp-yellow)" },
              { value: 92, suffix: "%", label: "Student satisfaction", bar: "bg-(--lp-ink)" },
              { value: 8, suffix: "+", label: "Years of experience", bar: "bg-(--lp-blue)" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 70} className="min-w-0 md:px-8 md:first:pl-0 md:last:pr-0">
                <span className={`mb-4 block h-1 w-10 rounded-full ${s.bar}`} aria-hidden="true" />
                <StatCard
                  value={s.value}
                  suffix={s.suffix}
                  label={s.label}
                  className="items-start gap-1.5"
                  valueClassName="whitespace-nowrap font-(family-name:--lp-font) text-[clamp(1.75rem,9.5vw,2.5rem)] font-bold leading-none tracking-[-0.03em] text-(--lp-ink) sm:text-6xl"
                  labelClassName="text-sm font-medium normal-case tracking-normal text-(--lp-muted)"
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Hidden on phones for now (the tabbed product showcase is too heavy at that width). */}
      <section id="platform" className="hidden scroll-mt-24 bg-white py-16 md:block md:py-24">
        <div className={SHELL}>
          <Reveal>
            <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
              <SectionTitle eyebrow="The platform" title="Everything a serious student needs, in one place." />
              <p className="max-w-md text-base leading-relaxed text-(--lp-muted) lg:pb-1.5">
                Not a pile of videos. A complete loop of learning, practice and honest feedback, so every hour you put in shows up in your score.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <ProductShowcase />
          </Reveal>
        </div>
      </section>

      {/* ───────────────── TEST SERIES JOURNEY ("How it works") ────────────── */}
      <section id="how-it-works" className="scroll-mt-24 py-14 md:py-24">
        <div className={SHELL}>
          <Reveal>
            <SectionHead
              maxW="max-w-3xl"
              eyebrow="How it works"
              title="From the right test series to a better score."
              subtitle="Find the series for your class and subject, enrol, sit the test and get a detailed report, then fix what it shows."
            />
          </Reveal>
          <Reveal delay={80}>
            <TestJourney />
          </Reveal>
          <Reveal className="mt-12 flex justify-center">
            <PillButton tone="blue" onClick={() => navigate("/test-series")}>
              Explore Test Series
            </PillButton>
          </Reveal>
        </div>
      </section>

      {/* ────────────── FIND YOUR TEST SERIES ("Courses" anchor) ────────────── */}
      <section id="courses" className="scroll-mt-24 py-12 md:py-20">
        <div className={SHELL}>
          <Reveal className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end md:gap-6">
            <SectionTitle eyebrow="Find your test series" title="Pick your class, then your subject." />
            <p className="max-w-sm text-sm leading-relaxed text-(--lp-muted)">
              Test series are organised by class and subject, so you only see what is relevant to what you are studying right now.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <ClassFinder />
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── TEST SERIES ───────────────────────── */}
      <TestSeriesShowcase />

      {/* Featured test series section hidden for now (component kept in
          ../components/landing/FeaturedSeries.jsx — re-add <FeaturedSeries />
          here to show it again). */}

      {/* ───────────── BUILT BY EXPERT EDUCATORS (carousel) ───────────── */}
      <EducatorsCarousel />

      {/* ──────────────────────── TESTIMONIALS ───────────────────────── */}
      <section id="testimonials" className="scroll-mt-24 bg-(--lp-blue-tint) py-16 md:py-28">
        <div className={SHELL}>
          <Reveal>
            <SectionHead eyebrow="Testimonial" title="Stories from our learning journey." />
          </Reveal>
        </div>
        <Reveal className="mt-12">
          <Marquee
            rows={[TESTIMONIALS_ROW_1, TESTIMONIALS_ROW_2]}
          />
        </Reveal>
      </section>

      {/* ─────────────────────────── FAQ ─────────────────────────────── */}
      <FaqSection items={FAQ_ITEMS} />

      {/* ───────────────────── LEARN ANYWHERE / CTA ───────────────────── */}
      {/* The platform is responsive today; the app-store badges below are
          presentational placeholders (no real mobile app exists yet),
          flagged rather than linked to fabricated store URLs. */}
      <section className="pb-20 pt-10 md:pb-28 md:pt-14">
        <div className={SHELL}>
          <div className="relative overflow-hidden rounded-[32px] bg-(--lp-ink) p-5 text-white sm:rounded-[44px] sm:p-10 lg:p-14">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-(--lp-blue)/80 blur-2xl" />
              <div className="absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-(--lp-yellow)/45 blur-2xl" />
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.3px)",
                  backgroundSize: "26px 26px",
                  maskImage: "radial-gradient(ellipse at 70% 50%, black 0%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(ellipse at 70% 50%, black 0%, transparent 70%)",
                }}
              />
            </div>
            <div className="relative grid items-center gap-8 sm:gap-10 md:grid-cols-2">
              <Reveal className="relative order-2 mx-auto w-full max-w-xl md:order-1 md:max-w-none">
                <DeviceMockup />
              </Reveal>
              <Reveal delay={100} className="order-1 flex flex-col items-start md:order-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide ring-1 ring-white/15 sm:px-3.5 sm:text-xs">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-(--lp-yellow)" aria-hidden="true">
                    <rect x="2.5" y="5" width="14" height="10" rx="1.6" />
                    <path d="M1 18.5h17" />
                    <rect x="16.5" y="9" width="5" height="9.5" rx="1.2" />
                  </svg>
                  Any Device
                </span>
                <h2 className="mt-4 font-(family-name:--lp-font) text-[2.1rem] font-bold leading-[1.05] tracking-[-0.025em] sm:mt-5 sm:text-6xl">
                  Practise anytime,{" "}
                  <span className="relative inline-block text-(--lp-yellow)">
                    anywhere.
                    <Squiggle className="absolute -bottom-2 left-0 h-3 w-full text-(--lp-blue) sm:-bottom-3 sm:h-4" />
                  </span>
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:mt-5 sm:text-base">
                  The web platform works across desktop and mobile browsers today, so you can start a test series, sit a timed test or read your report from whatever device is in front of you.
                </p>
                <div className="mt-5 grid w-full grid-cols-2 gap-2.5 sm:mt-6 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
                  {/* Presentational only -- no dedicated mobile app exists yet
                      (no FAQ entry covers it now). Not links: no real store URLs to
                      point at, so these render as static badges. */}
                  <span className="inline-flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 sm:min-w-[150px] sm:gap-3 sm:px-4" title="Coming soon -- no mobile app yet">
                    <GoogleIcon className="h-5 w-5 shrink-0" />
                    <span className="text-left leading-tight"><span className="block text-[8px] font-medium uppercase tracking-wide text-white/65 sm:text-[9px]">Coming soon on</span><span className="block text-[13px] font-semibold sm:text-sm">Google Play</span></span>
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 sm:min-w-[150px] sm:gap-3 sm:px-4" title="Coming soon -- no mobile app yet">
                    <AppleIcon className="h-5 w-5 shrink-0" />
                    <span className="text-left leading-tight"><span className="block text-[8px] font-medium uppercase tracking-wide text-white/65 sm:text-[9px]">Coming soon on</span><span className="block text-[13px] font-semibold sm:text-sm">App Store</span></span>
                  </span>
                </div>
                <div className="mt-6 grid w-full grid-cols-2 gap-2 sm:mt-8 sm:gap-2.5">
                  {[
                    "Timed practice tests",
                    "Instant scoring",
                    "Detailed reports",
                    "Attempt history",
                    "Retake and compare",
                    "Works on any browser",
                  ].map((item, i) => (
                    <Reveal key={item} delay={i * 60}>
                      <div className="flex h-full items-start gap-2 rounded-xl bg-white/[0.06] px-2.5 py-2 text-[13px] leading-snug text-white/90 ring-1 ring-white/10 transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 sm:items-center sm:gap-2.5 sm:px-3 sm:py-2.5 sm:text-sm">
                        <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) sm:mt-0 sm:h-5 sm:w-5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                        </span>
                        {item}
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="mt-7 w-full sm:mt-9 sm:w-auto">
                  <PillButton tone="yellow" className="w-full sm:w-auto [&>span:first-child]:flex-1 [&>span:first-child]:text-center sm:[&>span:first-child]:flex-none" onClick={() => navigate("/register")}>
                    Join Universal Learning
                  </PillButton>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
