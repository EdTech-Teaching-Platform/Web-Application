// Landing "Built by expert educators" section: a swipeable / draggable
// carousel of educator profile cards (name, headline, bio, subjects, rating,
// experience, students).
//
// Data: the shared EDUCATORS sample set (src/data/catalogMock.js) — the same
// placeholder profiles the rest of the discovery screens used. Swap
// `FEATURED_IDS` / the import for the real featured-educators endpoint
// (discoveryApi.getFeaturedEducators) once it exists; the card only reads
// name, headline, bio, subjects, qualifications, rating, experienceYears and
// studentsCount. Educator profile pages are not public yet, so the cards are
// informational and the CTA goes to the test series list.
//
// Interaction: native horizontal scroll with snap (touch swipe, trackpad,
// shift+wheel), mouse click-and-drag, prev/next buttons and ←/→ keys. Pure
// presentation — no routes, auth or data are touched.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EDUCATORS } from "../../../data/catalogMock";
import { BookOpenIcon, CheckCircleIcon, ChevronRightIcon, StarIcon } from "../../../components/ui/icons";
import { PillButton, Reveal, SectionHead } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

// Academic educators first — this is a test-series product.
const FEATURED_IDS = ["ed2", "ed6", "ed3", "ed1", "ed7", "ed5"];
const FEATURED = FEATURED_IDS.map((id) => EDUCATORS.find((e) => e.id === id)).filter(Boolean);

const TONES = [
  { block: "bg-(--lp-yellow)", ink: "text-(--lp-ink)", ring: "bg-(--lp-ink)/[0.07]" },
  { block: "bg-rotation-3", ink: "text-(--lp-ink)", ring: "bg-white/25" },
  { block: "bg-(--lp-blue)", ink: "text-white", ring: "bg-white/15" },
  { block: "bg-rotation-2", ink: "text-(--lp-ink)", ring: "bg-white/25" },
];

const initialsOf = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

function Stat({ value, label }) {
  return (
    <div className="rounded-2xl bg-(--lp-grey) px-2 py-3 text-center transition-colors duration-200 group-hover:bg-(--lp-blue-tint)">
      <dd className="font-(family-name:--lp-font) text-lg font-bold leading-none text-(--lp-ink)">{value}</dd>
      <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{label}</dt>
    </div>
  );
}

function EducatorCard({ educator, index }) {
  const tone = TONES[index % TONES.length];
  return (
    <article
      className="group relative flex w-[288px] shrink-0 snap-start flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_1px_2px_rgb(15_17_21/0.04),0_14px_34px_-18px_rgb(15_17_21/0.22)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_30px_60px_-20px_rgb(15_17_21/0.28)] sm:w-[348px]"
      aria-label={educator.name}
    >
      {/* colour block: soft circles + dot grid */}
      <div className={`relative h-36 overflow-hidden ${tone.block} ${tone.ink}`}>
        <span className={`absolute -right-12 -top-16 h-48 w-48 rounded-full ${tone.ring}`} aria-hidden="true" />
        <span className={`absolute -bottom-20 left-28 h-44 w-44 rounded-full ${tone.ring}`} aria-hidden="true" />
        <span
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(currentColor 1.1px, transparent 1.1px)", backgroundSize: "16px 16px" }}
          aria-hidden="true"
        />
        <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-(--lp-ink) shadow-sm backdrop-blur">
          <CheckCircleIcon className="h-3.5 w-3.5 text-(--lp-blue)" aria-hidden="true" />
          Verified educator
        </span>
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-(--lp-ink) px-3 py-1 text-[11px] font-bold text-white shadow-sm">
          <StarIcon className="h-3.5 w-3.5 text-(--lp-yellow)" aria-hidden="true" />
          {educator.rating.toFixed(1)}
        </span>
      </div>
      <span
        className="absolute left-6 top-[5.5rem] grid h-[4.75rem] w-[4.75rem] place-items-center rounded-full bg-(--lp-ink) font-(family-name:--lp-font) text-[1.65rem] font-bold text-(--lp-yellow) shadow-[0_10px_24px_-8px_rgb(15_17_21/0.5)] ring-[5px] ring-white transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-3"
        aria-hidden="true"
      >
        {initialsOf(educator.name)}
      </span>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-12">
        <h3 className="font-(family-name:--lp-font) text-[1.35rem] font-bold leading-tight tracking-tight text-(--lp-ink)">{educator.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-(--lp-blue-deep)">{educator.headline}</p>
        <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-(--lp-muted)">{educator.bio}</p>

        <ul className="mt-4 flex min-h-[3.75rem] flex-wrap content-start gap-1.5" aria-label="Subjects">
          {educator.subjects.slice(0, 3).map((s) => (
            <li key={s} className="h-fit rounded-full bg-(--lp-blue-tint) px-3 py-1 text-xs font-semibold text-(--lp-blue-deep) ring-1 ring-(--lp-blue)/15">{s}</li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          {educator.qualifications?.[0] && (
            <p className="mb-4 flex items-center gap-2 text-xs font-medium text-(--lp-muted)">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-(--lp-yellow-soft) text-(--lp-ink)" aria-hidden="true">
                <BookOpenIcon className="h-3.5 w-3.5" />
              </span>
              <span className="line-clamp-1">{educator.qualifications[0]}</span>
            </p>
          )}
          <dl className="grid grid-cols-3 gap-2">
            <Stat value={`${educator.experienceYears}+`} label="Years" />
            <Stat value={compact(educator.studentsCount)} label="Students" />
            <Stat value={compact(educator.reviewCount)} label="Reviews" />
          </dl>
        </div>
      </div>
    </article>
  );
}

export default function EducatorsCarousel() {
  const navigate = useNavigate();
  const scroller = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ start: true, end: false, progress: 0, thumb: 1 });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft >= max - 2,
      progress: max > 0 ? el.scrollLeft / max : 0,
      thumb: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [update]);

  const step = (dir) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.firstElementChild;
    const amount = (card ? card.getBoundingClientRect().width : 320) + 20;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * amount, behavior: reduce ? "auto" : "smooth" });
  };

  // click-and-drag for mouse users (touch / trackpad already scroll natively)
  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scroller.current;
    drag.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
    setDragging(true);
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    scroller.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const endDrag = (e) => {
    if (!drag.current) return;
    scroller.current?.releasePointerCapture?.(drag.current.id);
    drag.current = null;
    setDragging(false);
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  };

  if (FEATURED.length === 0) return null;

  const arrowBase =
    "grid h-12 w-12 place-items-center rounded-full ring-1 ring-(--lp-line) transition-[transform,background-color,color,opacity] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue)";

  return (
    <section id="educators" className="scroll-mt-24 overflow-x-clip bg-(--lp-grey) py-16 md:py-24" aria-labelledby="educators-title">
      <div className={SHELL}>
        <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHead
            align="left"
            maxW="max-w-2xl"
            eyebrow="Our educators"
            title={<span id="educators-title">Test series built by expert educators.</span>}
            subtitle="Every series is designed, reviewed and updated by verified teachers who know the syllabus and the exam. Meet a few of the people behind your practice."
          />
          <div className="flex items-center gap-3" role="group" aria-label="Carousel controls">
            <button type="button" onClick={() => step(-1)} disabled={pos.start} aria-label="Previous educators"
              className={`${arrowBase} bg-white text-(--lp-ink) hover:-translate-x-0.5 hover:bg-(--lp-ink) hover:text-white disabled:pointer-events-none disabled:opacity-35`}>
              <ChevronRightIcon className="h-5 w-5 rotate-180" />
            </button>
            <button type="button" onClick={() => step(1)} disabled={pos.end} aria-label="Next educators"
              className={`${arrowBase} bg-(--lp-ink) text-white hover:translate-x-0.5 hover:bg-(--lp-blue-deep) disabled:pointer-events-none disabled:opacity-35`}>
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </Reveal>
      </div>

      <Reveal delay={80} className="relative mt-10">
        {/* Blurred, fading edges: cards dissolve into the section background and
            the edge only shows when there is more to scroll in that direction. */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-(--lp-grey) via-(--lp-grey)/70 to-transparent backdrop-blur-[6px] transition-opacity duration-300 [mask-image:linear-gradient(to_right,black_35%,transparent)] sm:w-28 ${pos.start ? "opacity-0" : "opacity-100"}`}
          aria-hidden="true"
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-(--lp-grey) via-(--lp-grey)/70 to-transparent backdrop-blur-[6px] transition-opacity duration-300 [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:w-28 ${pos.end ? "opacity-0" : "opacity-100"}`}
          aria-hidden="true"
        />
        <div
          ref={scroller}
          role="region"
          aria-roledescription="carousel"
          aria-label="Educator profiles"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`flex gap-5 overflow-x-auto px-5 pb-10 pt-3 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-(--lp-blue)/40 sm:px-8 [&::-webkit-scrollbar]:hidden ${
            dragging ? "cursor-grabbing select-none snap-none scroll-auto" : "cursor-grab snap-x snap-mandatory scroll-smooth"
          } scroll-pl-5 sm:scroll-pl-8 xl:pl-[max(2rem,calc((100vw_-_1200px)/2_+_2rem))] xl:scroll-pl-[max(2rem,calc((100vw_-_1200px)/2_+_2rem))]`}
        >
          {FEATURED.map((educator, i) => (
            <EducatorCard key={educator.id} educator={educator} index={i} />
          ))}
          <span className="w-1 shrink-0" aria-hidden="true" />
        </div>
      </Reveal>

      <div className={`${SHELL} mt-2 flex flex-col items-center gap-8`}>
        {/* position indicator */}
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-(--lp-ink)/10" aria-hidden="true">
          <div
            className="h-full rounded-full bg-(--lp-ink) transition-[margin] duration-150 ease-out"
            style={{ width: `${pos.thumb * 100}%`, marginLeft: `${pos.progress * (1 - pos.thumb) * 100}%` }}
          />
        </div>
        <Reveal>
          <PillButton tone="ink" onClick={() => navigate("/test-series")}>Explore their test series</PillButton>
        </Reveal>
      </div>
    </section>
  );
}
