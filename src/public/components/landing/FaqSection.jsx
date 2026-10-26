// Landing-page FAQ. Dedicated to the landing theme so the shared
// ui/Accordion (also used by Course Builder + Course Details) stays untouched.
//
// Design: sticky intro on the left with a tilted "Still curious?" contact
// card; on the right, topic-icon question cards. The open card lifts to white
// with a blue ring, its icon turns ink and the plus rotates into a cross.
// One answer is open at a time. Height animates with the grid-rows trick, so
// there is no fixed max-height clipping long answers.
import { useState } from "react";
import {
  BarChartIcon,
  BookOpenIcon,
  ClockIcon,
  HelpCircleIcon,
  MailIcon,
  PlusIcon,
  RefreshIcon,
  TagIcon,
} from "../../../components/ui/icons";
import { ArrowUpRight, Reveal, SectionHead } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

// Topic icon + tile colour per question id (fixed order, never random).
const TOPICS = {
  f1: { icon: ClockIcon, tile: "bg-(--lp-yellow) text-(--lp-ink)" },
  f2: { icon: RefreshIcon, tile: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  f3: { icon: BarChartIcon, tile: "bg-(--lp-yellow-soft) text-(--lp-ink)" },
  f4: { icon: BookOpenIcon, tile: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  f5: { icon: TagIcon, tile: "bg-(--lp-yellow) text-(--lp-ink)" },
};
const FALLBACK_TOPIC = { icon: HelpCircleIcon, tile: "bg-(--lp-grey) text-(--lp-ink)" };

function FaqItem({ item, open, onToggle }) {
  const topic = TOPICS[item.id] ?? FALLBACK_TOPIC;
  const Icon = topic.icon;
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-button-${item.id}`;

  return (
    <div
      className={`rounded-3xl transition-[background-color,box-shadow,transform] duration-300 ease-out ${
        open
          ? "bg-white shadow-[0_18px_44px_rgba(37,87,214,0.14)] ring-2 ring-(--lp-blue)/25"
          : "bg-(--lp-grey) ring-1 ring-transparent hover:-translate-y-0.5 hover:bg-(--lp-blue-tint) hover:ring-(--lp-blue)/15"
      }`}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-4 rounded-3xl px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--lp-blue) sm:px-5 sm:py-5"
        >
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${topic.tile}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="flex-1 font-(family-name:--lp-font) text-base font-bold leading-snug text-(--lp-ink) sm:text-lg">
            {item.question}
          </span>
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-300 ease-out ${
              open ? "rotate-45 bg-(--lp-ink) text-white" : "bg-(--lp-yellow) text-(--lp-ink)"
            }`}
            aria-hidden="true"
          >
            <PlusIcon className="h-4 w-4" />
          </span>
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-5 pl-4 text-sm leading-relaxed text-(--lp-muted) sm:pb-6 sm:pl-[5.25rem] sm:pr-16 sm:text-[15px]">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection({ items }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? null);

  return (
    <section id="faq" className="scroll-mt-24 py-14 md:py-20">
      <div className={`${SHELL} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}>
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead align="left" eyebrow="Frequently Asked Questions" title="Answers to your most common questions." />
          <p className="mt-5 max-w-sm text-base leading-relaxed text-(--lp-muted)">
            Quick answers about test series, timed tests, reports and refunds. Can't find yours? Just drop us an email.
          </p>

          <div className="relative mt-8 -rotate-1 overflow-hidden rounded-[28px] bg-(--lp-yellow) p-6 shadow-[0_16px_36px_rgba(255,216,77,0.45)]">
            <span className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-(--lp-ink)/[0.06]" aria-hidden="true" />
            <div className="relative flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-(--lp-ink) text-white">
                <MailIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="font-(family-name:--lp-font) text-lg font-bold leading-tight">Still curious?</p>
                <p className="mt-0.5 text-sm text-(--lp-ink)/70">We're happy to help.</p>
              </div>
            </div>
            <a
              href="mailto:support@universallearning.app"
              className="group relative mt-5 inline-flex max-w-full items-center gap-2 rounded-full bg-(--lp-ink) py-2.5 pl-5 pr-2.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5"
            >
              <span className="truncate">support@universallearning.app</span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </a>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="space-y-3">
            {items.map((item) => (
              <FaqItem key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
