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
import { useNavigate } from "react-router-dom";
import StatCard from "../../components/ui/StatCard";
import Marquee from "../../components/ui/Marquee";
import { imageForPerson, imgFallback, heroPhoto } from "../../utils/stockImages";
import { COURSE_CATEGORIES } from "../../utils/constants";
import {
  UsersIcon,
  CheckCircleIcon,
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
import { Reveal, PillButton, SectionHead } from "../components/landing/LandingUI";

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

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={LANDING_THEME_VARS} className="overflow-x-clip bg-white font-body text-(--lp-ink) selection:bg-(--lp-yellow) selection:text-(--lp-ink)">
      <HeroSection />

      {/* ──────────────────── BOARD EXAM COUNTDOWN ───────────────────── */}
      <ExamCountdownBanner />

      {/* ───────────── SUBJECT STRIP + STATS + PLATFORM ───────────── */}
      <section className="border-y border-(--lp-line) bg-white">
        <div className={`${SHELL} flex flex-wrap items-center justify-center gap-x-2 gap-y-2 py-5 text-sm text-(--lp-muted)`} aria-label="Subjects offered">
          <span className="mr-2 font-semibold text-(--lp-ink)">Learn</span>
          {COURSE_CATEGORIES.filter((c) => c !== "Other").map((c, i, arr) => (
            <span key={c} className="flex items-center gap-2">
              {c}
              {i < arr.length - 1 && <span className="h-1 w-1 rounded-full bg-(--lp-yellow)" aria-hidden="true" />}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-(--lp-blue-tint) py-12 md:py-14">
        <div className={SHELL}>
          <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-(--lp-blue)/15">
            {[
              { value: 50000, suffix: "+", label: "Students learning", bar: "bg-(--lp-blue)" },
              { value: 250, suffix: "+", label: "Verified mentors", bar: "bg-(--lp-yellow)" },
              { value: 92, suffix: "%", label: "Student satisfaction", bar: "bg-(--lp-ink)" },
              { value: 8, suffix: "+", label: "Years of experience", bar: "bg-(--lp-blue)" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 70} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <span className={`mb-4 block h-1 w-10 rounded-full ${s.bar}`} aria-hidden="true" />
                <StatCard
                  value={s.value}
                  suffix={s.suffix}
                  label={s.label}
                  className="items-start gap-1.5"
                  valueClassName="font-(family-name:--lp-font) text-5xl font-bold leading-none tracking-[-0.03em] text-(--lp-ink) sm:text-6xl"
                  labelClassName="text-sm font-medium normal-case tracking-normal text-(--lp-muted)"
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-24 bg-white py-16 md:py-24">
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
      <section id="courses" className="scroll-mt-24 py-14 md:py-20">
        <div className={SHELL}>
          <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
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
          <div className="relative overflow-hidden rounded-[44px] bg-(--lp-ink) p-6 text-white sm:p-10 lg:p-14">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-(--lp-blue)/80 blur-2xl" />
              <div className="absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-(--lp-yellow)/45 blur-2xl" />
            </div>
            <div className="relative grid items-center gap-10 md:grid-cols-2">
              <Reveal className="relative order-2 mx-auto w-full max-w-xl md:order-1 md:max-w-none">
                <DeviceMockup />
              </Reveal>
              <Reveal delay={100} className="order-1 flex flex-col items-start md:order-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide">
                  <UsersIcon className="h-3.5 w-3.5" />
                  Any Device
                </span>
                <h2 className="mt-5 font-(family-name:--lp-font) text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                  Learn anytime, <span className="text-(--lp-yellow)">anywhere.</span>
                </h2>
                <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
                  The web platform works across desktop and mobile browsers today, so you can pick up a course or join a live class from whatever device is in front of you.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {/* Presentational only -- no dedicated mobile app exists yet
                      (see FAQ_ITEMS f5 above). Not links: no real store URLs to
                      point at, so these render as static badges. */}
                  <span className="inline-flex min-w-[150px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15" title="Coming soon -- no mobile app yet">
                    <GoogleIcon className="h-5 w-5 shrink-0" />
                    <span className="text-left leading-tight"><span className="block text-[9px] font-medium uppercase tracking-wide text-white/65">Coming soon on</span><span className="block text-sm font-semibold">Google Play</span></span>
                  </span>
                  <span className="inline-flex min-w-[150px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15" title="Coming soon -- no mobile app yet">
                    <AppleIcon className="h-5 w-5 shrink-0" />
                    <span className="text-left leading-tight"><span className="block text-[9px] font-medium uppercase tracking-wide text-white/65">Coming soon on</span><span className="block text-sm font-semibold">App Store</span></span>
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
                    <div key={item} className="flex items-center gap-2.5 text-sm text-white/90">
                      <CheckCircleIcon className="h-5 w-5 shrink-0 text-(--lp-yellow)" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-9">
                  <PillButton tone="yellow" onClick={() => navigate("/register")}>
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
