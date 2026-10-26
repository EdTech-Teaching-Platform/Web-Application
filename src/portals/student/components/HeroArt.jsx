// Flat, hand-built hero illustrations for the student portal page headers.
// Pure SVG (no text, no images). Colours come from the existing theme tokens.
const INK = "var(--lp-ink)";
const BLUE = "var(--lp-blue-deep)";
const SKY = "var(--color-rotation-3)";
const PEACH = "var(--color-rotation-2)";
const YEL = "var(--lp-yellow)";
const GREEN = "var(--color-success)";
const W = "#ffffff";
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" };

function Star({ x, y, s = 1, fill = W }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0-14C2-4 4-2 14 0C4 2 2 4 0 14C-2 4-4 2-14 0C-4-2-2-4 0-14Z"
      fill={fill}
      stroke={INK}
      strokeWidth={2.5 / s}
      strokeLinejoin="round"
    />
  );
}

function Floor({ y = 280 }) {
  return <line x1="24" y1={y} x2="470" y2={y} {...S} />;
}

function Book({ x, y, w, h, fill, bands = [YEL, W] }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={fill} {...S} />
      <rect x={x + 14} y={y} width="9" height={h} fill={bands[0]} stroke={INK} strokeWidth="2.5" />
      <rect x={x + 30} y={y} width="5" height={h} fill={bands[1]} stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

// Dashboard — books, graduation cap, checklist notebook, pencil.
function Study({ className }) {
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <Floor />
      {/* notebook */}
      <g transform="rotate(-7 150 210)">
        <rect x="78" y="112" width="134" height="168" rx="12" fill={W} {...S} />
        <rect x="78" y="112" width="134" height="26" rx="12" fill={BLUE} {...S} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="98" y={156 + i * 38} width="20" height="20" rx="5" fill={i < 2 ? YEL : W} {...S} strokeWidth="2.5" />
            {i < 2 && <path d={`M103 ${166 + i * 38}l4 5 7-10`} stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            <rect x="128" y={162 + i * 38} width="64" height="8" rx="4" fill={INK} opacity="0.18" />
          </g>
        ))}
      </g>
      {/* book stack */}
      <Book x={236} y={238} w={196} h={42} fill={BLUE} bands={[YEL, W]} />
      <Book x={252} y={198} w={166} h={40} fill={W} bands={[PEACH, SKY]} />
      <Book x={244} y={160} w={178} h={38} fill={PEACH} bands={[W, INK]} />
      {/* graduation cap */}
      <path d="M290 132v22c0 10 20 18 43 18s43-8 43-18v-22" fill={INK} {...S} />
      <path d="M333 96l82 31-82 31-82-31z" fill="var(--lp-ink-soft)" {...S} />
      <path d="M404 131v34" {...S} />
      <circle cx="404" cy="170" r="6" fill={YEL} {...S} strokeWidth="2.5" />
      {/* pencil */}
      <g transform="translate(40 262) rotate(-5)">
        <rect x="0" y="0" width="120" height="16" fill={SKY} {...S} />
        <path d="M120 0l32 8-32 8z" fill="#f4dcc0" {...S} />
        <path d="M144 5.5l8 2.5-8 2.5z" fill={INK} />
        <rect x="-14" y="0" width="14" height="16" rx="3" fill={PEACH} {...S} />
        <rect x="26" y="0" width="5" height="16" fill={INK} opacity="0.2" />
      </g>
      <Star x={440} y={72} s={1.2} fill={W} />
      <Star x={236} y={90} s={0.8} fill={INK} />
      <Star x={60} y={78} s={0.9} fill={W} />
      <circle cx="460" cy="150" r="5" fill={INK} />
      <circle cx="40" cy="170" r="4" fill={INK} />
    </svg>
  );
}

// My tests — bookshelf with a plant.
function Shelf({ className }) {
  const books = [
    { x: 70, w: 34, h: 128, f: YEL },
    { x: 106, w: 28, h: 150, f: W },
    { x: 136, w: 38, h: 112, f: PEACH },
    { x: 176, w: 30, h: 140, f: SKY },
    { x: 208, w: 34, h: 122, f: INK },
  ];
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <rect x="40" y="250" width="400" height="22" rx="6" fill={W} {...S} />
      {books.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={250 - b.h} width={b.w} height={b.h} rx="4" fill={b.f} {...S} />
          <rect x={b.x} y={250 - b.h + 18} width={b.w} height="9" fill={b.f === INK ? YEL : INK} opacity={b.f === INK ? 1 : 0.85} />
          <rect x={b.x} y={250 - 34} width={b.w} height="6" fill={b.f === INK ? W : YEL} stroke={INK} strokeWidth="2" />
        </g>
      ))}
      {/* leaning book */}
      <g transform="rotate(16 262 250)">
        <rect x="248" y="112" width="34" height="138" rx="4" fill={BLUE} {...S} />
        <rect x="248" y="130" width="34" height="9" fill={YEL} stroke={INK} strokeWidth="2" />
      </g>
      {/* flat stack */}
      <rect x="296" y="226" width="110" height="24" rx="5" fill={PEACH} {...S} />
      <rect x="304" y="202" width="96" height="24" rx="5" fill={W} {...S} />
      <rect x="312" y="178" width="82" height="24" rx="5" fill={YEL} {...S} />
      {/* trophy-free: plant */}
      <path d="M404 250h-44l8-38h28z" fill={W} {...S} />
      <path d="M382 212c-30-4-40-34-28-56 22 8 30 30 28 56z" fill={GREEN} {...S} />
      <path d="M382 212c8-26 26-40 50-38-2 26-22 40-50 38z" fill={GREEN} {...S} />
      <Star x={430} y={70} s={1.1} />
      <Star x={52} y={92} s={0.8} fill={INK} />
      <circle cx="456" cy="120" r="5" fill={INK} />
    </svg>
  );
}

// History — clock + calendar.
function Clock({ className }) {
  const ticks = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <Floor y={282} />
      {/* calendar */}
      <g transform="rotate(5 340 190)">
        <rect x="236" y="96" width="190" height="168" rx="14" fill={W} {...S} />
        <rect x="236" y="96" width="190" height="38" rx="14" fill={BLUE} {...S} />
        <rect x="236" y="120" width="190" height="14" fill={BLUE} stroke="none" />
        <path d="M236 134h190" {...S} />
        <rect x="270" y="82" width="10" height="28" rx="5" fill={W} {...S} strokeWidth="2.5" />
        <rect x="382" y="82" width="10" height="28" rx="5" fill={W} {...S} strokeWidth="2.5" />
        {[0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => {
          const done = (r * 4 + c) % 3 !== 2 && r * 4 + c < 9;
          return (
            <g key={`${r}-${c}`}>
              <rect x={254 + c * 40} y={150 + r * 36} width="28" height="26" rx="7" fill={done ? YEL : W} stroke={INK} strokeWidth="2.5" />
              {done && <path d={`M${262 + c * 40} ${163 + r * 36}l5 6 9-12`} stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            </g>
          );
        }))}
      </g>
      {/* clock */}
      <circle cx="148" cy="170" r="98" fill={W} {...S} />
      <circle cx="148" cy="170" r="84" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="2 8" />
      {ticks.map((i) => {
        const a = (i * Math.PI) / 6;
        return <line key={i} x1={148 + Math.sin(a) * 72} y1={170 - Math.cos(a) * 72} x2={148 + Math.sin(a) * 82} y2={170 - Math.cos(a) * 82} {...S} strokeWidth={i % 3 === 0 ? 4 : 2.5} />;
      })}
      <path d="M148 170V114" {...S} strokeWidth="6" />
      <path d="M148 170l36 22" {...S} strokeWidth="6" />
      <path d="M148 170l-18-4" stroke={PEACH} strokeWidth="3" strokeLinecap="round" />
      <circle cx="148" cy="170" r="8" fill={YEL} {...S} />
      <path d="M96 78l-22-16M200 78l22-16" {...S} strokeWidth="5" />
      <circle cx="68" cy="58" r="12" fill={PEACH} {...S} />
      <circle cx="228" cy="58" r="12" fill={PEACH} {...S} />
      <Star x={450} y={66} s={1.1} />
      <Star x={44} y={120} s={0.7} fill={INK} />
      <circle cx="456" cy="140" r="5" fill={INK} />
    </svg>
  );
}

// Account — ID card + medal.
function Card({ className }) {
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <Floor />
      <g transform="rotate(-6 250 170)">
        <rect x="120" y="80" width="250" height="168" rx="18" fill={W} {...S} />
        <rect x="120" y="80" width="250" height="34" rx="18" fill={INK} {...S} />
        <rect x="120" y="98" width="250" height="16" fill={INK} stroke="none" />
        <circle cx="142" cy="97" r="5" fill={YEL} />
        <circle cx="158" cy="97" r="5" fill={SKY} />
        {/* avatar */}
        <circle cx="180" cy="170" r="36" fill={YEL} {...S} />
        <circle cx="180" cy="160" r="14" fill={W} {...S} strokeWidth="2.5" />
        <path d="M154 196c4-16 48-16 52 0" fill={W} {...S} strokeWidth="2.5" />
        {/* lines */}
        <rect x="236" y="140" width="104" height="11" rx="5.5" fill={INK} />
        <rect x="236" y="164" width="84" height="9" rx="4.5" fill={INK} opacity="0.2" />
        <rect x="236" y="184" width="96" height="9" rx="4.5" fill={INK} opacity="0.2" />
        <rect x="150" y="218" width="190" height="10" rx="5" fill={BLUE} opacity="0.9" />
      </g>
      {/* medal */}
      <path d="M372 150l-16 46 24-8 10 22 16-50" fill={BLUE} {...S} />
      <circle cx="394" cy="132" r="32" fill={YEL} {...S} />
      <circle cx="394" cy="132" r="21" fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="3 5" />
      <Star x={394} y={132} s={0.9} fill={W} />
      <Star x={74} y={90} s={1} />
      <Star x={444} y={52} s={0.7} fill={INK} />
      <circle cx="60" cy="190" r="5" fill={INK} />
    </svg>
  );
}

// Report — bar chart + medal.
function Chart({ className }) {
  const bars = [
    { x: 118, h: 60, f: SKY },
    { x: 178, h: 96, f: YEL },
    { x: 238, h: 78, f: PEACH },
    { x: 298, h: 138, f: W },
  ];
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <rect x="84" y="62" width="300" height="218" rx="18" fill="var(--lp-blue-tint)" {...S} />
      {[0, 1, 2].map((i) => <line key={i} x1="102" y1={110 + i * 50} x2="366" y2={110 + i * 50} stroke={INK} strokeWidth="2" strokeDasharray="2 8" />)}
      {bars.map((b, i) => <rect key={i} x={b.x} y={258 - b.h} width="44" height={b.h} rx="8" fill={b.f} {...S} />)}
      <path d="M130 196l60-44 58 24 80-76" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M312 92l14 0 0 14" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[[130, 196], [190, 152], [248, 176]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={W} {...S} strokeWidth="2.5" />)}
      <path d="M418 186l-14 52 22-12 8 24 16-62" fill={PEACH} {...S} />
      <circle cx="430" cy="160" r="34" fill={YEL} {...S} />
      <circle cx="430" cy="160" r="22" fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="3 5" />
      <path d="M430 146l5 10 11 1-8 8 2 11-10-6-10 6 2-11-8-8 11-1z" fill={W} {...S} strokeWidth="2" />
      <Star x={430} y={60} s={1} />
      <Star x={52} y={110} s={0.8} fill={INK} />
      <circle cx="56" cy="222" r="5" fill={INK} />
    </svg>
  );
}

// Find a test series — magnifier over cards.
function Search({ className }) {
  return (
    <svg className={className} viewBox="0 0 480 300" fill="none" aria-hidden="true">
      <Floor />
      <g transform="rotate(-8 190 190)">
        <rect x="90" y="118" width="190" height="130" rx="14" fill={W} {...S} />
        <rect x="108" y="138" width="60" height="60" rx="10" fill={YEL} {...S} />
        <rect x="184" y="144" width="78" height="10" rx="5" fill={INK} />
        <rect x="184" y="166" width="62" height="8" rx="4" fill={INK} opacity="0.2" />
        <rect x="108" y="212" width="150" height="8" rx="4" fill={INK} opacity="0.2" />
      </g>
      <g transform="rotate(7 330 200)">
        <rect x="256" y="144" width="170" height="112" rx="14" fill={W} {...S} />
        <rect x="274" y="162" width="50" height="50" rx="10" fill={SKY} {...S} />
        <rect x="338" y="168" width="68" height="10" rx="5" fill={INK} />
        <rect x="338" y="190" width="54" height="8" rx="4" fill={INK} opacity="0.2" />
        <rect x="274" y="226" width="132" height="8" rx="4" fill={INK} opacity="0.2" />
      </g>
      {/* magnifier */}
      <circle cx="318" cy="110" r="52" fill="rgba(255,255,255,0.55)" {...S} strokeWidth="6" />
      <path d="M354 148l40 44" {...S} strokeWidth="14" />
      <path d="M354 148l40 44" stroke={PEACH} strokeWidth="7" strokeLinecap="round" />
      <path d="M296 96c6-12 20-18 32-14" stroke={W} strokeWidth="5" strokeLinecap="round" />
      <Star x={440} y={60} s={1.1} />
      <Star x={52} y={98} s={0.8} fill={INK} />
      <circle cx="456" cy="230" r="5" fill={INK} />
    </svg>
  );
}

export const HERO_ART = { study: Study, shelf: Shelf, clock: Clock, card: Card, chart: Chart, search: Search };
