// Landing "Meet the founders" section: four founder cards plus a short
// founding-story band, in the same electric blue / ink / yellow system and
// colour-block card language as the educators section above it.
//
// All names, titles, bios, quotes and numbers below are PLACEHOLDER copy
// (dummy founders). Portraits are generic placeholder headshots from
// i.pravatar.cc (same service utils/stockImages.js already uses); if one
// fails to load it is hidden and the initials monogram underneath shows
// instead. Swap FOUNDERS for the real team and real photos before launch.
// Purely presentational: no routes, auth or data are touched.
import { LinkedInIcon, XSocialIcon } from "../../../components/ui/icons";
import { Reveal, SectionHead, Squiggle, Sparkle } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

const portrait = (n) => `https://i.pravatar.cc/480?img=${n}`;

const FOUNDERS = [
  {
    id: "f1",
    name: "Aarav Malhotra",
    role: "Co-founder & CEO",
    photo: portrait(12),
    focus: "Vision & strategy",
    bio: "Former IIT Delhi topper who spent six years coaching board and JEE students before turning that experience into a product. Leads vision, partnerships and the promise that every student gets honest feedback.",
    quote: "A score is only useful if it tells you what to do next.",
    tags: ["Strategy", "Partnerships", "Pedagogy"],
  },
  {
    id: "f2",
    name: "Ishita Rao",
    role: "Co-founder & CTO",
    photo: portrait(47),
    focus: "Product & engineering",
    bio: "Ex-engineering lead at a large ed-tech platform, where she scaled timed assessments to millions of attempts. Builds the test engine, reports and the systems that keep exam day calm.",
    quote: "Exam day should be the most boring day for our servers.",
    tags: ["Platform", "Reliability", "Data"],
  },
  {
    id: "f3",
    name: "Dr. Kabir Menon",
    role: "Co-founder & Chief Academic Officer",
    photo: portrait(33),
    focus: "Academics & quality",
    bio: "A PhD in education with fifteen years of curriculum design and paper-setting experience. Runs the educator review board and makes sure every question matches the syllabus and exam pattern.",
    quote: "Good questions teach. Great questions diagnose.",
    tags: ["Curriculum", "Assessment", "Educators"],
  },
  {
    id: "f4",
    name: "Nisha Verma",
    role: "Co-founder & COO",
    photo: portrait(5),
    focus: "Operations & community",
    bio: "Built operations for two consumer start-ups before joining. Owns educator onboarding, student support and the partnerships that bring Universal Learning to schools and coaching centres.",
    quote: "Students remember how quickly we helped, not how well we planned.",
    tags: ["Operations", "Support", "Growth"],
  },
];

// Fixed order, never random: yellow, cyan, blue, orange (same rotation the
// educator cards use). `ink` is the text colour that sits on the block.
const TONES = [
  { block: "bg-(--lp-yellow)", ink: "text-(--lp-ink)", ring: "bg-(--lp-ink)/[0.07]", chip: "bg-(--lp-ink) text-white" },
  { block: "bg-rotation-3", ink: "text-(--lp-ink)", ring: "bg-white/30", chip: "bg-(--lp-ink) text-white" },
  { block: "bg-(--lp-blue)", ink: "text-white", ring: "bg-white/15", chip: "bg-white text-(--lp-ink)" },
  { block: "bg-rotation-2", ink: "text-(--lp-ink)", ring: "bg-white/30", chip: "bg-(--lp-ink) text-white" },
];

const initialsOf = (name = "") =>
  name.replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function FounderCard({ founder, index }) {
  const tone = TONES[index % TONES.length];
  return (
    <article
      aria-label={founder.name}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_1px_2px_rgb(15_17_21/0.04),0_14px_34px_-18px_rgb(15_17_21/0.22)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_30px_60px_-20px_rgb(15_17_21/0.28)] sm:rounded-[2rem]"
    >
      {/* colour block with the portrait framed on it */}
      <div className={`relative overflow-hidden px-5 pb-0 pt-5 ${tone.block} ${tone.ink}`}>
        <span className={`absolute -right-14 -top-16 h-52 w-52 rounded-full ${tone.ring}`} aria-hidden="true" />
        <span className={`absolute -bottom-24 -left-10 h-48 w-48 rounded-full ${tone.ring}`} aria-hidden="true" />
        <span
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(currentColor 1.1px, transparent 1.1px)", backgroundSize: "16px 16px" }}
          aria-hidden="true"
        />
        <span className={`relative inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${tone.chip}`}>{founder.focus}</span>
        <div className="relative mx-auto mt-4 aspect-[4/4.4] w-[78%] translate-y-px overflow-hidden rounded-t-[1.5rem] bg-(--lp-ink) ring-4 ring-white/90">
          <span className="absolute inset-0 grid place-items-center font-(family-name:--lp-font) text-5xl font-bold text-(--lp-yellow)" aria-hidden="true">
            {initialsOf(founder.name)}
          </span>
          <img
            src={founder.photo}
            alt={`${founder.name}, ${founder.role}`}
            loading="lazy"
            draggable="false"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-6 pt-5 sm:px-6">
        <h3 className="font-(family-name:--lp-font) text-xl font-bold leading-tight tracking-tight text-(--lp-ink)">{founder.name}</h3>
        <p className="mt-1 text-sm font-semibold leading-5 text-(--lp-blue-deep)">{founder.role}</p>
        <p className="mt-3 text-sm leading-6 text-(--lp-muted)">{founder.bio}</p>

        <blockquote className="mt-4 rounded-2xl bg-(--lp-blue-tint) px-4 py-3 text-[13px] font-medium italic leading-5 text-(--lp-ink)">
          <span className="not-italic font-bold text-(--lp-blue)" aria-hidden="true">“</span>{founder.quote}<span className="not-italic font-bold text-(--lp-blue)" aria-hidden="true">”</span>
        </blockquote>

        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${founder.name}'s areas`}>
          {founder.tags.map((t) => (
            <li key={t} className="rounded-full bg-(--lp-grey) px-3 py-1 text-xs font-semibold text-(--lp-ink)">{t}</li>
          ))}
        </ul>

        {/* Profile links are placeholders: shown as static marks until real URLs exist. */}
        <div className="mt-auto flex items-center gap-2 pt-5 text-(--lp-ink)" aria-hidden="true">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-grey) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white"><LinkedInIcon width={16} height={16} /></span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-grey) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white"><XSocialIcon width={14} height={14} /></span>
        </div>
      </div>
    </article>
  );
}

const MILESTONES = [
  { year: "2018", text: "Started as weekend doubt-clearing classes for 40 students." },
  { year: "2021", text: "Moved online and launched our first timed test series." },
  { year: "2024", text: "Opened the platform to verified educators across India." },
  { year: "Today", text: "50,000+ students practising on one platform." },
];

export default function FoundersSection() {
  return (
    <section id="founders" className="scroll-mt-24 overflow-x-clip bg-white py-16 md:py-24" aria-labelledby="founders-title">
      <div className={SHELL}>
        <Reveal className="grid items-end gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <SectionHead
            align="left"
            maxW="max-w-2xl"
            eyebrow="Meet the founders"
            title={<span id="founders-title">Built by teachers and engineers who{" "}<span className="relative inline-block text-(--lp-blue)">sat the exams.<Squiggle className="absolute -bottom-2 left-0 h-2.5 w-full text-(--lp-yellow)" /></span></span>}
          />
          <p className="max-w-md text-base leading-relaxed text-(--lp-muted) lg:pb-1.5">
            We started Universal Learning because good practice and honest feedback shouldn't depend on which city you live in. Four founders, one shared obsession: help every student know exactly what to fix next.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {FOUNDERS.map((f, i) => (
            <Reveal key={f.id} delay={i * 90} className="h-full">
              <FounderCard founder={f} index={i} />
            </Reveal>
          ))}
        </div>

        {/* founding story band */}
        <Reveal delay={80} className="mt-12 md:mt-16">
          <div className="relative overflow-hidden rounded-[32px] bg-(--lp-ink) p-6 text-white sm:rounded-[44px] sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-(--lp-blue)/70 blur-2xl" />
              <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-(--lp-yellow)/35 blur-2xl" />
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.3px)",
                  backgroundSize: "26px 26px",
                  maskImage: "radial-gradient(ellipse at 80% 50%, black 0%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(ellipse at 80% 50%, black 0%, transparent 70%)",
                }}
              />
            </div>
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
              <div>
                <Sparkle className="h-7 w-7 text-(--lp-yellow)" fill="currentColor" />
                <h3 className="mt-4 font-(family-name:--lp-font) text-2xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
                  Our mission: make serious exam practice{" "}
                  <span className="text-(--lp-yellow)">available to everyone.</span>
                </h3>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
                  Every test we publish is reviewed by a verified educator, scored instantly and explained properly, so a student in a small town practises with the same quality as one in a metro.
                </p>
              </div>
              <ol className="relative grid gap-3 sm:grid-cols-2">
                {MILESTONES.map((m) => (
                  <li key={m.year} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10">
                    <span className="font-(family-name:--lp-font) text-2xl font-bold text-(--lp-yellow)">{m.year}</span>
                    <p className="mt-1.5 text-sm leading-snug text-white/80">{m.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
