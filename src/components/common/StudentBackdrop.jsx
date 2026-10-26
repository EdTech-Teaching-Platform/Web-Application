// StudentBackdrop — decorative layer behind every student page. It lives inside the scrolling
// area and is as tall as the content, so it scrolls together with the page.
// "Study notebook" look: faint graph paper, thin maths/science line drawings
// and soft washes of colour. Presentation only: no text, no motion, and it
// ignores pointer input.
const BLUE = "var(--lp-blue-deep)";
const INK = "var(--lp-ink)";
const YEL = "var(--lp-yellow)";

const GRID = {
  backgroundImage:
    "linear-gradient(rgba(37,87,214,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37,87,214,0.06) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
  WebkitMaskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.55) 100%)",
  maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.55) 100%)",
};

const LINE = { fill: "none", stroke: BLUE, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

// One screen-sized block of artwork. Blocks are stacked down the page so the
// drawings keep their proportions however long the content is.
function Tile({ flip }) {
  return (
    <div className={`relative aspect-[1440/900] w-full ${flip ? "-scale-x-100" : ""}`}>
      {/* soft washes of colour */}
      <div className="absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-[#dbe6ff] opacity-70 blur-3xl" />
      <div className="absolute -right-24 top-[8%] h-[24rem] w-[24rem] rounded-full bg-[#e3f1fb] opacity-80 blur-3xl" />
      <div className="absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-[#fff1c2] opacity-70 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
    {/* highlighter strokes */}
    <path d="M58 520h150" stroke={YEL} strokeWidth="16" strokeLinecap="round" opacity="0.45" />
    <path d="M1215 452h128" stroke={YEL} strokeWidth="14" strokeLinecap="round" opacity="0.5" />

    {/* axes + parabola (top-left) */}
    <g {...LINE} opacity="0.3">
      <path d="M40 300V108M40 300H266" />
      <path d="M34 122l6-14 6 14M252 294l14 6-14 6" />
      <path d="M62 282Q150 56 238 282" />
      <path d="M90 296v8M140 296v8M190 296v8M236 296v8M32 250h8M32 200h8M32 150h8" />
      <path d="M150 170V300" strokeDasharray="4 6" opacity="0.8" />
    </g>
    <circle cx="150" cy="170" r="4" fill={BLUE} opacity="0.45" />

    {/* atom (top-right) */}
    <g transform="translate(1292 214)" {...LINE} opacity="0.28">
      <ellipse rx="98" ry="34" />
      <ellipse rx="98" ry="34" transform="rotate(60)" />
      <ellipse rx="98" ry="34" transform="rotate(120)" />
    </g>
    <g transform="translate(1292 214)" fill={BLUE} opacity="0.42">
      <circle r="7" />
      <circle cx="98" cy="0" r="4.5" />
      <circle cx="-49" cy="85" r="4.5" />
      <circle cx="-49" cy="-85" r="4.5" />
    </g>

    {/* triangle with angle marks + compass arc (bottom-left) */}
    <g {...LINE} opacity="0.28">
      <path d="M54 846L310 846L54 646Z" />
      <path d="M54 820h26v26" />
      <path d="M268 846A42 42 0 0 1 276 818" />
      <path d="M54 686A40 40 0 0 1 82 700" />
      <circle cx="54" cy="846" r="150" strokeDasharray="3 8" opacity="0.7" />
    </g>

    {/* ruler (bottom-right) */}
    <g transform="translate(1130 758) rotate(-10)" {...LINE} opacity="0.3">
      <rect x="0" y="0" width="270" height="46" rx="7" />
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={i} d={`M${14 + i * 18} 0v${i % 5 === 0 ? 20 : 11}`} />
      ))}
    </g>

    {/* small accents */}
    <g fill={BLUE} opacity="0.3">
      <circle cx="330" cy="120" r="3" />
      <circle cx="1090" cy="70" r="3" />
      <circle cx="400" cy="860" r="3" />
      <circle cx="1100" cy="860" r="3" />
    </g>
    <g {...LINE} opacity="0.26">
      <path d="M1390 560h20M1400 550v20" />
      <path d="M36 450h20M46 440v20" />
      <path d="M1330 640l6 12 12 1-9 8 3 12-12-6-11 6 2-12-8-8 12-2z" opacity="0.7" />
    </g>
  </svg>
    </div>
  );
}

const TILES = Array.from({ length: 14 });

export default function StudentBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f3f6fd_0%,#f8faff_55%,#fffcf3_100%)]" />
      {/* graph paper */}
      <div className="absolute inset-0" style={GRID} />
      <div className="absolute inset-x-0 top-0">
        {TILES.map((_, i) => (
          <Tile key={i} flip={i % 2 === 1} />
        ))}
      </div>
    </div>
  );
}
