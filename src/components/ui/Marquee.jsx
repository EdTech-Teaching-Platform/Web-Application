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
function Avatar({ name, avatar }) {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt=""
        onError={() => setFailed(true)}
        className="h-10 w-10 rounded-full object-cover"
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
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
      {initials}
    </span>
  );
}

function MarqueeRow({ items, direction = "left", durationSeconds = 40 }) {
  const [paused, setPaused] = useState(false);
  const doubled = [...items, ...items]; // seamless loop

  return (
    <div
      className="flex w-max gap-4"
      style={{
        animation: `marquee-${direction} ${durationSeconds}s linear infinite`,
        animationPlayState: paused ? "paused" : "running",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {doubled.map((item, i) => (
        <div key={`${item.id}-${i}`} className="w-80 shrink-0 rounded-2xl bg-blush p-5 text-text">
          {typeof item.rating === "number" && (
            <div className="mb-2 flex items-center gap-0.5 text-primary">
              {Array.from({ length: 5 }, (_, star) => (
                <StarIcon
                  key={star}
                  className={star < Math.round(item.rating) ? "fill-current" : "fill-current opacity-25"}
                />
              ))}
            </div>
          )}
          <p className="line-clamp-3 text-sm text-text/80">"{item.quote}"</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={item.name} avatar={item.avatar} />
            <div>
              <p className="text-sm font-semibold text-text">{item.name}</p>
              {item.role && <p className="text-xs text-text/50">{item.role}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Marquee({ rows }) {
  return (
    <div
      className="flex flex-col gap-4 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
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
      `}</style>
      <MarqueeRow items={rows[0] ?? []} direction="left" durationSeconds={45} />
      <MarqueeRow items={rows[1] ?? rows[0] ?? []} direction="right" durationSeconds={50} />
    </div>
  );
}
