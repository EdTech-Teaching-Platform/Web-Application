// HeroIllustration — the landing hero artwork: a staircase of colour blocks
// climbing from a test paper to a trophy ("every test gets you higher").
// Flat shapes with ink outlines, the same language as the student portal.
// Purely decorative: no text, aria-hidden.
const INK = "var(--lp-ink)";
const SW = 4;
const stroke = { stroke: INK, strokeWidth: SW, strokeLinecap: "round", strokeLinejoin: "round" };

const STEPS = [
  { x: 52, top: 404, fill: "var(--color-rotation-3, #56ccf2)" },
  { x: 174, top: 334, fill: "var(--color-rotation-2, #f2994a)" },
  { x: 296, top: 264, fill: "var(--lp-blue-deep)" },
  { x: 418, top: 194, fill: "var(--lp-yellow)" },
];

// 5-point star centred on 0,0 (outer radius 14, inner 6).
const STAR5 = `M${Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 6 : 14;
  const t = (Math.PI / 5) * i - Math.PI / 2;
  return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`;
}).join("L")}Z`;

function Spark({ x, y, s = 1, fill = INK, delay = 0 }) {
  return (
    <path
      className="ul-blink"
      style={{ animationDelay: `${delay}s` }}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -14C1.2 -6 6 -1.2 14 0 6 1.2 1.2 6 0 14-1.2 6-6 1.2-14 0-6-1.2-1.2-6 0-14Z"
      fill={fill}
    />
  );
}

export default function HeroIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 620 540" fill="none" className={className} aria-hidden="true" focusable="false">
      <style>{`
        @keyframes ul-blink { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
        .ul-blink { animation: ul-blink 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ul-blink { animation: none; opacity: 1; } }
      `}</style>

      {/* backdrop discs */}
      <circle cx="310" cy="262" r="252" fill="var(--lp-blue-soft)" />
      <circle cx="310" cy="262" r="196" stroke="var(--lp-blue)" strokeOpacity=".28" strokeDasharray="3 9" />
      <circle cx="568" cy="86" r="30" fill="var(--lp-yellow)" />
      <circle cx="96" cy="196" r="20" fill="var(--color-rotation-3, #56ccf2)" opacity=".55" />

      {/* dashed path climbing the steps */}
      <path d="M104 296C150 110 318 52 396 78" {...stroke} strokeWidth="3" strokeDasharray="1 10" opacity=".55" />
      <path d="M384 62L402 80 380 90" {...stroke} strokeWidth="3.5" opacity=".7" />

      {/* ground */}
      <path d="M26 478H594" {...stroke} />

      {/* steps */}
      {STEPS.map((s) => (
        <g key={s.x}>
          <rect x={s.x} y={s.top} width="116" height={478 - s.top} rx="16" fill={s.fill} {...stroke} />
          <rect x={s.x + 12} y={s.top + 12} width="92" height="9" rx="4.5" fill="#fff" opacity=".4" />
          <circle cx={s.x + 24} cy={470 - 18} r="3.5" fill="#fff" opacity=".35" />
          <circle cx={s.x + 40} cy={470 - 18} r="3.5" fill="#fff" opacity=".35" />
        </g>
      ))}

      {/* 1 — test paper + pencil */}
      <g transform="translate(110 404)">
        <g transform="rotate(-8)">
          <rect x="-36" y="-100" width="72" height="98" rx="9" fill="#fff" {...stroke} />
          <rect x="-26" y="-90" width="52" height="11" rx="5" fill="var(--lp-blue-deep)" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${-66 + i * 21})`}>
              <rect x="-26" y="0" width="13" height="13" rx="4" fill={i < 2 ? "var(--lp-yellow)" : "#fff"} stroke={INK} strokeWidth="3" />
              {i < 2 && <path d="M-23 6.5l3 3 5-6" {...stroke} strokeWidth="2.6" />}
              <rect x="-7" y="4" width="32" height="5" rx="2.5" fill="#d9dde4" />
            </g>
          ))}
        </g>
        <g transform="translate(52 -34) rotate(24)">
          <rect x="-7" y="-52" width="14" height="70" rx="3" fill="var(--lp-yellow)" {...stroke} strokeWidth="3.5" />
          <path d="M-7 18h14l-7 17Z" fill="#f6d9b4" {...stroke} strokeWidth="3.5" />
          <path d="M-3.5 28h7l-3.5 7Z" fill={INK} />
          <rect x="-7" y="-60" width="14" height="10" rx="3" fill="var(--color-rotation-2, #f2994a)" {...stroke} strokeWidth="3.5" />
        </g>
      </g>

      {/* 2 — stopwatch */}
      <g transform="translate(232 334)">
        <rect x="-9" y="-98" width="18" height="12" rx="4" fill={INK} />
        <rect x="26" y="-82" width="12" height="9" rx="3" fill={INK} transform="rotate(40 32 -78)" />
        <circle cy="-46" r="42" fill="#fff" {...stroke} />
        <circle cy="-46" r="31" fill="var(--lp-blue-tint)" stroke="var(--lp-blue)" strokeOpacity=".35" strokeWidth="2" />
        <path d="M0 -46V-77A31 31 0 0 1 27 -61Z" fill="var(--lp-yellow)" />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M0 -34v6" {...stroke} strokeWidth="3" transform={`translate(0 -46) rotate(${a})`} />
        ))}
        <path d="M0 -46L0 -72M0 -46L16 -38" {...stroke} strokeWidth="4" />
        <circle cy="-46" r="5" fill={INK} />
      </g>

      {/* 3 — medal */}
      <g transform="translate(354 264)">
        <path d="M-24 -108L-4 -66 14 -74 -6 -116Z" fill="var(--color-rotation-2, #f2994a)" {...stroke} strokeWidth="3.5" />
        <path d="M24 -108L4 -66-14 -74 6 -116Z" fill="var(--lp-yellow)" {...stroke} strokeWidth="3.5" />
        <circle cy="-46" r="36" fill="var(--lp-yellow)" {...stroke} />
        <circle cy="-46" r="25" fill="#fff" stroke={INK} strokeWidth="3" strokeDasharray="2 6" />
        <path d={STAR5} transform="translate(0 -46) scale(1.25)" fill="var(--lp-blue-deep)" {...stroke} strokeWidth="3" />
      </g>

      {/* 4 — trophy */}
      <g transform="translate(476 194)">
        <rect x="-34" y="-16" width="68" height="16" rx="5" fill={INK} />
        <rect x="-9" y="-54" width="18" height="40" fill="var(--lp-blue-deep)" {...stroke} strokeWidth="3.5" />
        <path d="M-40 -122H40V-96C40 -68 20 -50 0 -50S-40 -68 -40 -96Z" fill="#fff" {...stroke} />
        <path d="M-40 -108H-58C-60 -82 -48 -72 -36 -70M40 -108H58C60 -82 48 -72 36 -70" {...stroke} />
        <path d="M-37 -100H37" stroke="var(--lp-blue-deep)" strokeWidth="9" />
        <path d={STAR5} transform="translate(0 -86) scale(1.2)" fill="var(--lp-yellow)" {...stroke} strokeWidth="3.4" />
      </g>

      {/* sparkles */}
      <Spark x={60} y={132} s={1.1} />
      <Spark x={214} y={86} s={0.9} fill="var(--lp-yellow)" delay={0.8} />
      <Spark x={572} y={286} s={1} fill="var(--lp-blue)" delay={1.6} />
      <Spark x={392} y={34} s={0.7} fill="var(--lp-blue)" delay={0.4} />
      <Spark x={34} y={380} s={0.7} fill="var(--lp-yellow)" delay={2.1} />
      <path d="M556 396h16M564 388v16" {...stroke} strokeWidth="2.6" opacity=".5" />
      <path d="M150 40h14M157 33v14" {...stroke} strokeWidth="2.6" opacity=".5" />
    </svg>
  );
}
