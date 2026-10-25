import { useState } from "react";
import { StarIcon } from "./icons";

// Marquee — design.md Section 4: testimonials only. Two rows, continuous
// constant-speed LINEAR scroll (the one exception to ease-out everywhere
// else), edge fade via gradient mask, pause on hover/resume on leave
// (independently per row), card set duplicated end-to-end for a seamless
// loop, fixed card size with line-clamp truncation.
//
// Direction: the two rows scroll in OPPOSITE directions (row 1 right to
// left, row 2 left to right) — this isn't just this page's choice, it's a
// real behavior of the reusable Marquee component, so it's the default
// here rather than something each caller has to remember to set up. (Flag
// carried over from the Landing Page build spec: worth adding this detail
// to design.md's Marquee entry itself, since it only currently says "two
// rows, continuous scroll" without specifying opposite directions.)
//
// `rows` is an array of two arrays of testimonial items:
// { id, quote, name, role, rating, avatar }. `avatar` is an image URL;
// falls back to initials when omitted.
const AVATAR_TONES = [
  "bg-(--lp-blue-soft) text-(--lp-blue-deep)",
  "bg-(--lp-yellow-soft) text-(--lp-ink)",
  "bg-(--lp-grey) text-(--lp-ink)",
];

function Avatar({ name, avatar, index = 0 }) {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt=""
        onError={() => setFailed(true)}
        className="h-11 w-11 rounded-full object-cover ring-1 ring-(--lp-line)"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {initials}
    </span>
  );
}

function QuoteMark() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
      <path d="M9.6 5C5.9 6.7 3.5 9.9 3.5 14.2V19h6.2v-6H6.6c.1-2.2 1.3-3.8 3.6-5L9.6 5Zm10 0c-3.7 1.7-6.1 4.9-6.1 9.2V19h6.2v-6h-3.1c.1-2.2 1.3-3.8 3.6-5L19.6 5Z" />
    </svg>
  );
}

function MarqueeRow({ items, direction = "left", durationSeconds = 40, cardClassName = "bg-white", starClassName = "text-(--lp-yellow)" }) {
  const [paused, setPaused] = useState(false);
  // 4 copies (scroll distance = 2 copies = -50%) so the row still fills very
  // wide screens when there are only a few cards.
  const copies = [...items, ...items, ...items, ...items]; // seamless loop

  return (
    <div
      className="marquee-track flex w-max gap-5"
      style={{
        animation: `marquee-${direction} ${durationSeconds}s linear infinite`,
        animationPlayState: paused ? "paused" : "running",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {copies.map((item, i) => (
        <figure
          key={`${item.id}-${i}`}
          aria-hidden={i >= items.length ? "true" : undefined}
          className={`group flex h-56 w-[22rem] shrink-0 flex-col justify-between rounded-3xl border border-(--lp-line) ${item.cardClassName ?? cardClassName} p-6 text-(--lp-ink) transition-[transform,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-(--lp-blue)/40`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-(--lp-blue)/25">
                <QuoteMark />
              </span>
              {typeof item.rating === "number" && (
                <div className={`flex items-center gap-0.5 ${starClassName}`} role="img" aria-label={`${item.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, star) => (
                    <StarIcon
                      key={star}
                      width="14"
                      height="14"
                      className={star < Math.round(item.rating) ? "fill-current" : "fill-(--lp-line)"}
                    />
                  ))}
                </div>
              )}
            </div>
            <blockquote className="mt-4 line-clamp-4 text-[1.0625rem] font-medium leading-relaxed tracking-tight text-(--lp-ink)">
              {item.quote}
            </blockquote>
          </div>
          <figcaption className="flex items-center gap-3 border-t border-(--lp-line) pt-4">
            <Avatar name={item.name} avatar={item.avatar} index={i} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-(--lp-ink)">{item.name}</p>
              {item.role && <p className="truncate text-xs text-(--lp-muted)">{item.role}</p>}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// Optional `cardClassName` / `starClassName` restyle the cards; the defaults
// give the clean white-card look used on the Landing page.
export default function Marquee({ rows, cardClassName, starClassName }) {
  return (
    <div
      className="marquee-mask flex flex-col gap-5 overflow-hidden py-1"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; }
          .marquee-mask { overflow-x: auto; }
        }
      `}</style>
      <MarqueeRow items={rows[0] ?? []} direction="left" durationSeconds={110} cardClassName={cardClassName} starClassName={starClassName} />
      <MarqueeRow items={rows[1] ?? rows[0] ?? []} direction="right" durationSeconds={120} cardClassName={cardClassName} starClassName={starClassName} />
    </div>
  );
}
