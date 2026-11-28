// Landing "Meet the founders" section: an editorial row of four
// founder cards (arch-framed portraits on colour blocks, floating name
// plates, one-line quotes) plus a founding-story band. Same electric blue /
// ink / yellow system and colour-block language as the educators section.
//
// All names, titles, bios, quotes and numbers below are PLACEHOLDER copy
// (dummy founders). Portraits are generic placeholder headshots from
// Unsplash; if one
// fails to load it is hidden and the initials monogram underneath shows
// instead. Swap FOUNDERS / MILESTONES / HIGHLIGHTS for the real team and
// real photos before launch. Purely presentational: no routes, auth or data.
import { LinkedInIcon, XSocialIcon } from "../../../components/ui/icons";
import { Reveal, SectionHead, Squiggle, Sparkle } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

// Placeholder male portraits (Unsplash, face-cropped). Distinct from the four
// photos the educators section uses, so no face repeats on the page.
const portrait = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=faces&w=480&h=560&q=70`;

const FOUNDERS = [
  {
    id: "f1",
    name: "Salim",
    role: "Founder",
    focus: "Vision & strategy",
    photo: portrait("1472099645785-5658abf4ff4e"),
    bio: "Former IIT Delhi topper who coached board and JEE students for six years before building the product he wished he had.",
    quote: "A score is only useful if it tells you what to do next.",
  },
  {
    id: "f2",
    name: "Deepak Gupta",
    role: "Founder",
    focus: "Product & engineering",
    photo: portrait("1500648767791-00dcc994a43e"),
    bio: "Ex-engineering lead who scaled timed assessments to millions of attempts. Keeps the test engine fast and exam day calm.",
    quote: "Exam day should be the most boring day for our servers.",
  },
  {
    id: "f3",
    name: "Muhammad Ahmed",
    role: "Founder",
    focus: "Academics & quality",
    photo: portrait("1506794778202-cad84cf45f1d"),
    bio: "Fifteen years of paper-setting and curriculum design. Runs the educator review board that checks every question.",
    quote: "Good questions teach. Great questions diagnose.",
  },
  {
    id: "f4",
    name: "Rehan",
    role: "Founder",
    focus: "Operations & community",
    photo: portrait("1492562080023-ab3db95bfbce"),
    bio: "Built operations at two consumer start-ups. Owns educator onboarding, student support and school partnerships.",
    quote: "Students remember how quickly we helped, not how well we planned.",
  },
];

const HIGHLIGHTS = [
  { value: "60+", label: "years of combined experience" },
  { value: "4", label: "founders, 1 shared mission" },
  { value: "2018", label: "where it all began" },
];

// Fixed order, never random: yellow, cyan, blue, orange (same rotation the
// educator cards use). `ink` is the text colour that sits on the block.
const TONES = [
  { block: "bg-(--lp-yellow)", ink: "text-(--lp-ink)", soft: "bg-(--lp-ink)/[0.08]", accent: "border-(--lp-yellow)", sticker: "bg-(--lp-ink) text-white" },
  { block: "bg-rotation-3", ink: "text-(--lp-ink)", soft: "bg-white/35", accent: "border-rotation-3", sticker: "bg-(--lp-ink) text-white" },
  { block: "bg-(--lp-blue)", ink: "text-white", soft: "bg-white/15", accent: "border-(--lp-blue)", sticker: "bg-(--lp-yellow) text-(--lp-ink)" },
  { block: "bg-rotation-2", ink: "text-(--lp-ink)", soft: "bg-white/35", accent: "border-rotation-2", sticker: "bg-(--lp-ink) text-white" },
];

const initialsOf = (name = "") =>
  name.replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function FounderCard({ founder, index }) {
  const tone = TONES[index % TONES.length];
  const tilt = index % 2 === 0 ? "-rotate-6" : "rotate-6";
  return (
    <article
      aria-label={founder.name}
      className="group relative flex h-full flex-col rounded-[2rem] bg-white p-2.5 shadow-[0_1px_2px_rgb(15_17_21/0.04),0_18px_40px_-20px_rgb(15_17_21/0.25)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_34px_64px_-22px_rgb(15_17_21/0.32)]"
    >
      {/* portrait tile: concentric rings, dot grid, arch-framed photo */}
      <div className={`relative aspect-[4/4.3] overflow-hidden rounded-[1.5rem] ${tone.block} ${tone.ink}`}>
        <span className={`absolute -right-16 -top-20 h-56 w-56 rounded-full ${tone.soft}`} aria-hidden="true" />
        <span className="absolute left-1/2 top-[12%] aspect-square w-[92%] -translate-x-1/2 rounded-full border-2 border-current opacity-20" aria-hidden="true" />
        <span className="absolute left-1/2 top-[22%] aspect-square w-[70%] -translate-x-1/2 rounded-full border border-dashed border-current opacity-25" aria-hidden="true" />
        <span
          className="absolute inset-0 opacity-[0.16]"
          style={{ backgroundImage: "radial-gradient(currentColor 1.1px, transparent 1.1px)", backgroundSize: "16px 16px" }}
          aria-hidden="true"
        />

        {/* arch window */}
        <div className="absolute bottom-0 left-1/2 h-[80%] w-[68%] -translate-x-1/2 overflow-hidden rounded-t-full bg-(--lp-ink) ring-[5px] ring-white">
          <span className="absolute inset-0 grid place-items-center font-(family-name:--lp-font) text-5xl font-bold text-(--lp-yellow)" aria-hidden="true">
            {initialsOf(founder.name)}
          </span>
          <img
            src={founder.photo}
            alt={`${founder.name}, ${founder.role}`}
            loading="lazy"
            draggable="false"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        </div>

        {/* tilted sticker */}
        <span className={`absolute left-3 top-4 inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide shadow-sm transition-transform duration-300 ease-out group-hover:rotate-0 ${tilt} ${tone.sticker}`}>
          Founder
        </span>
      </div>

      {/* floating name plate overlaps the tile */}
      <div className="relative z-10 -mt-7 flex min-h-[5.5rem] items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 mx-3 shadow-[0_10px_24px_-12px_rgb(15_17_21/0.35)] ring-1 ring-(--lp-line)">
        <div className="min-w-0">
          <h3 className="font-(family-name:--lp-font) text-lg font-bold leading-tight tracking-tight text-(--lp-ink)">{founder.name}</h3>
          <p className="mt-0.5 text-[13px] font-semibold leading-4 text-(--lp-blue-deep)">{founder.role}</p>
        </div>
        {/* Profile links are placeholders: static marks until real URLs exist. */}
        <div className="flex shrink-0 items-center gap-1.5 text-(--lp-ink)" aria-hidden="true">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-(--lp-grey) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white"><LinkedInIcon width={15} height={15} /></span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-(--lp-grey) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white"><XSocialIcon width={13} height={13} /></span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5">
        <span className="inline-flex w-fit rounded-full bg-(--lp-blue-tint) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-(--lp-blue-deep)">{founder.focus}</span>
        <p className="mt-3 text-sm leading-6 text-(--lp-muted)">{founder.bio}</p>
        <blockquote className={`mt-4 border-l-4 ${tone.accent} pl-3.5 font-(family-name:--lp-font) text-[15px] font-semibold leading-snug tracking-tight text-(--lp-ink)`}>
          “{founder.quote}”
        </blockquote>
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
    <section id="founders" className="relative scroll-mt-24 overflow-x-clip bg-white py-16 md:py-24" aria-labelledby="founders-title">
      {/* soft backdrop shapes */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-32 top-10 h-[420px] w-[420px] rounded-full bg-(--lp-blue-tint)" />
        <div className="absolute -left-24 bottom-40 h-72 w-72 rounded-full bg-(--lp-yellow-soft)/70" />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: "radial-gradient(rgb(15 17 21 / 0.07) 1px, transparent 1.2px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse at 50% 20%, black 0%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 20%, black 0%, transparent 65%)",
          }}
        />
      </div>

      <div className={`${SHELL} relative`}>
        <Reveal className="grid items-end gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
          <div>
            <SectionHead
              align="left"
              maxW="max-w-2xl"
              eyebrow="Meet the founders"
              title={<span id="founders-title">Built by teachers and engineers who{" "}<span className="relative inline-block text-(--lp-blue)">sat the exams.<Squiggle className="absolute -bottom-2 left-0 h-2.5 w-full text-(--lp-yellow)" /></span></span>}
            />
            <p className="mt-5 max-w-xl text-base leading-relaxed text-(--lp-muted)">
              We started Universal Learning because good practice and honest feedback shouldn't depend on which city you live in. Four founders, one shared obsession: help every student know exactly what to fix next.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {HIGHLIGHTS.map((h, i) => (
              <div
                key={h.label}
                className={`rounded-2xl p-3.5 sm:rounded-3xl sm:p-4 ${i === 0 ? "bg-(--lp-ink) text-white" : i === 1 ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-(--lp-blue) text-white"}`}
              >
                <dd className="font-(family-name:--lp-font) text-2xl font-bold leading-none tracking-tight sm:text-3xl">{h.value}</dd>
                <dt className="mt-2 text-[11px] font-medium leading-snug opacity-80 sm:text-xs">{h.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* one level row: equal-height cards */}
        <div className="mt-14 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 xl:gap-6">
          {FOUNDERS.map((f, i) => (
            <Reveal key={f.id} delay={i * 90} className="h-full">
              <FounderCard founder={f} index={i} />
            </Reveal>
          ))}
        </div>

        {/* founding story band */}
        <Reveal delay={80} className="mt-16 md:mt-24">
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
