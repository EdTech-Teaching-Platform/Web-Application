// Original flat vector illustrations for the auth screens' showcase panel —
// one scene per role (student / educator / sign-up), drawn from the same
// blue · ink · yellow palette so they sit on the coloured panels instead of
// the old stock photograph. Decorative only (aria-hidden), static.
const INK = "#0f1115";
const INK2 = "#1b1f27";
const BLUE = "#3d7bf7";
const BLUE_DEEP = "#2557d6";
const BLUE_SOFT = "#e3ecff";
const YELLOW = "#ffd84d";
const SKIN = "#f4cfae";
const GREEN = "#1f9d6b";
const RED = "#e5484d";

function Spark({ x, y, s = 1, fill = "#fff", opacity = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      opacity={opacity}
      fill={fill}
      d="M0 -12c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z"
    />
  );
}

function OpenBook({ x, y, scale = 1, cover = INK }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-92 4 L0 16 L92 4 L92 12 L0 24 L-92 12Z" fill={cover} />
      <path d="M-88 0 L0 10 L0 -26 Q-44 -36 -88 -24Z" fill="#fff" />
      <path d="M88 0 L0 10 L0 -26 Q44 -36 88 -24Z" fill="#f3f6ff" />
      <path d="M0 10 L0 -26" stroke="#c9d4f3" strokeWidth="2" />
      {[-12, -2, 8].map((dy) => (
        <g key={dy} stroke="#c9d4f3" strokeWidth="3" strokeLinecap="round">
          <path d={`M-72 ${dy - 8} Q-38 ${dy - 16} -12 ${dy - 8}`} />
          <path d={`M12 ${dy - 8} Q38 ${dy - 16} 72 ${dy - 8}`} />
        </g>
      ))}
    </g>
  );
}

// ------------------------------------------------------------ student scene
function StudentScene() {
  return (
    <>
      <ellipse cx="200" cy="396" rx="150" ry="13" fill="rgba(15,17,21,0.2)" />
      {/* person */}
      <rect x="136" y="214" width="128" height="110" rx="54" fill="#fff" />
      <path d="M176 214 Q200 238 224 214" stroke="#d4dcf5" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="188" y="198" width="24" height="26" rx="10" fill="#e9b996" />
      <circle cx="200" cy="168" r="42" fill={SKIN} />
      <path d="M158 170 C150 112 250 112 242 170 C232 146 176 146 158 170Z" fill={INK} />
      <circle cx="200" cy="118" r="17" fill={INK} />
      <circle cx="186" cy="178" r="3.6" fill={INK} />
      <circle cx="214" cy="178" r="3.6" fill={INK} />
      <path d="M190 192 Q200 200 210 192" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="176" cy="190" r="6" fill="#f0a98f" opacity=".55" />
      <circle cx="224" cy="190" r="6" fill="#f0a98f" opacity=".55" />
      <path d="M154 172 C146 104 254 104 246 172" stroke={YELLOW} strokeWidth="8" fill="none" strokeLinecap="round" />
      <rect x="144" y="164" width="18" height="34" rx="9" fill={YELLOW} />
      <rect x="238" y="164" width="18" height="34" rx="9" fill={YELLOW} />
      {/* arms */}
      <path d="M152 250 L152 290" stroke="#fff" strokeWidth="26" strokeLinecap="round" />
      <path d="M248 250 L248 290" stroke="#fff" strokeWidth="26" strokeLinecap="round" />
      {/* desk */}
      <rect x="36" y="300" width="328" height="22" rx="11" fill={INK} />
      <rect x="66" y="320" width="14" height="72" rx="5" fill={INK} />
      <rect x="320" y="320" width="14" height="72" rx="5" fill={INK} />
      <OpenBook x={200} y={296} scale={0.95} />
      <circle cx="152" cy="290" r="10" fill={SKIN} />
      <circle cx="248" cy="290" r="10" fill={SKIN} />
      {/* book stack */}
      <rect x="298" y="284" width="66" height="16" rx="4" fill={YELLOW} />
      <rect x="304" y="268" width="56" height="16" rx="4" fill="#fff" />
      <rect x="296" y="252" width="62" height="16" rx="4" fill={BLUE_DEEP} />
      <rect x="300" y="256" width="20" height="3" rx="1.5" fill="#fff" opacity=".7" />
      {/* plant */}
      <path d="M72 274 C60 246 66 230 80 222 C84 242 82 258 72 274Z" fill={GREEN} />
      <path d="M72 274 C86 252 98 248 108 250 C100 262 88 270 72 274Z" fill="#2fbf87" />
      <rect x="58" y="272" width="36" height="28" rx="8" fill={YELLOW} />
      {/* floating chat bubble with check */}
      <g>
        <rect x="286" y="78" width="92" height="56" rx="18" fill="#fff" />
        <path d="M312 134 L304 152 L330 134Z" fill="#fff" />
        <circle cx="314" cy="106" r="15" fill={BLUE} />
        <path d="M307 106 l5 5 l9 -10" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="337" y="98" width="30" height="6" rx="3" fill={BLUE_SOFT} />
        <rect x="337" y="110" width="20" height="6" rx="3" fill={BLUE_SOFT} />
      </g>
      <Spark x={60} y={110} s={1.1} fill={YELLOW} />
      <Spark x={100} y={60} s={0.7} />
      <Spark x={350} y={200} s={0.8} fill={YELLOW} />
    </>
  );
}

// ----------------------------------------------------------- educator scene
function EducatorScene() {
  return (
    <>
      <ellipse cx="200" cy="396" rx="160" ry="13" fill="rgba(15,17,21,0.18)" />
      {/* whiteboard */}
      <rect x="28" y="64" width="236" height="176" rx="18" fill="#fff" stroke={INK} strokeWidth="6" />
      <rect x="44" y="82" width="86" height="14" rx="7" fill={BLUE_SOFT} />
      <rect x="44" y="104" width="56" height="10" rx="5" fill={BLUE_SOFT} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={50 + i * 30} y={198 - [38, 62, 46, 84][i]} width="20" height={[38, 62, 46, 84][i]} rx="5" fill={[BLUE, YELLOW, BLUE_DEEP, INK][i]} />
      ))}
      <path d="M44 204 H176" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="218" cy="122" r="30" fill={BLUE} />
      <path d="M210 108 L232 122 L210 136Z" fill="#fff" />
      <path d="M192 196 Q206 166 224 188 T256 168" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="64" y="240" width="8" height="70" rx="4" fill={INK} />
      <rect x="220" y="240" width="8" height="70" rx="4" fill={INK} />
      {/* books + apple */}
      <rect x="40" y="350" width="108" height="20" rx="5" fill={INK} />
      <rect x="52" y="332" width="92" height="18" rx="5" fill={BLUE_DEEP} />
      <rect x="46" y="314" width="96" height="18" rx="5" fill="#fff" />
      <circle cx="98" cy="300" r="15" fill={RED} />
      <path d="M98 286 Q100 276 108 274" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M102 282 Q112 276 114 284 Q106 288 102 282Z" fill={GREEN} />
      <rect x="40" y="370" width="108" height="0" />
      {/* teacher */}
      <rect x="284" y="332" width="26" height="54" rx="8" fill={INK2} />
      <rect x="322" y="332" width="26" height="54" rx="8" fill={INK2} />
      <rect x="278" y="378" width="38" height="14" rx="7" fill={INK} />
      <rect x="318" y="378" width="38" height="14" rx="7" fill={INK} />
      <rect x="268" y="186" width="98" height="164" rx="46" fill={INK} />
      <path d="M298 190 L317 236 L336 190Z" fill="#fff" />
      <path d="M312 196 L317 214 L322 196Z" fill={BLUE} />
      <path d="M284 230 L240 176" stroke={INK} strokeWidth="24" strokeLinecap="round" />
      <circle cx="236" cy="170" r="12" fill={SKIN} />
      <path d="M350 238 L352 300" stroke={INK} strokeWidth="24" strokeLinecap="round" />
      <circle cx="352" cy="304" r="11" fill={SKIN} />
      <rect x="305" y="170" width="24" height="26" rx="10" fill="#e9b996" />
      <circle cx="317" cy="142" r="38" fill={SKIN} />
      <path d="M280 140 C278 96 356 96 354 140 C344 120 296 118 280 140Z" fill={INK} />
      <circle cx="302" cy="148" r="11" fill="none" stroke={INK} strokeWidth="3.5" />
      <circle cx="332" cy="148" r="11" fill="none" stroke={INK} strokeWidth="3.5" />
      <path d="M313 148 H321" stroke={INK} strokeWidth="3.5" />
      <circle cx="302" cy="148" r="3" fill={INK} />
      <circle cx="332" cy="148" r="3" fill={INK} />
      <path d="M306 164 Q317 173 328 164" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Spark x={344} y={80} s={1.1} fill={INK} />
      <Spark x={246} y={46} s={0.7} fill={INK} />
      <Spark x={178} y={330} s={0.8} fill={INK} opacity=".7" />
    </>
  );
}

// ------------------------------------------------------------ sign-up scene
function SignupScene() {
  return (
    <>
      <ellipse cx="200" cy="398" rx="150" ry="12" fill="rgba(0,0,0,0.35)" />
      <path d="M200 340 Q214 300 206 270" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeDasharray="2 12" strokeLinecap="round" fill="none" />
      {/* flame */}
      <path d="M180 282 Q200 372 220 282Z" fill={YELLOW} />
      <path d="M190 282 Q200 336 210 282Z" fill="#fff" />
      {/* fins */}
      <path d="M164 214 L120 280 L166 262Z" fill={BLUE} />
      <path d="M236 214 L280 280 L234 262Z" fill={BLUE} />
      {/* body */}
      <path d="M200 40 C256 96 262 196 238 266 L162 266 C138 196 144 96 200 40Z" fill="#fff" />
      <path d="M200 40 C224 64 240 92 247 124 L153 124 C160 92 176 64 200 40Z" fill={RED} />
      <rect x="180" y="266" width="40" height="14" rx="5" fill={INK2} stroke="#fff" strokeOpacity=".2" />
      <circle cx="200" cy="176" r="30" fill={BLUE_DEEP} stroke={INK} strokeWidth="7" />
      <path d="M184 168 Q192 156 206 160" stroke="#fff" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M170 240 H230" stroke="#dbe3f7" strokeWidth="5" strokeLinecap="round" />
      {/* open book base */}
      <OpenBook x={200} y={342} scale={1.1} cover={BLUE_DEEP} />
      {/* grad cap */}
      <g transform="translate(66 128) rotate(-12)">
        <path d="M-40 0 L0 -16 L40 0 L0 16Z" fill={YELLOW} />
        <path d="M-22 10 V28 Q0 40 22 28 V10 L0 20Z" fill="#fff" />
        <path d="M40 0 V26" stroke={YELLOW} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="30" r="4" fill={YELLOW} />
      </g>
      {/* floating cards */}
      <g transform="translate(300 220) rotate(8)">
        <rect x="-34" y="-26" width="68" height="52" rx="12" fill="#fff" />
        <circle cx="-14" cy="-4" r="9" fill={YELLOW} />
        <rect x="2" y="-10" width="22" height="6" rx="3" fill={BLUE_SOFT} />
        <rect x="2" y="2" width="14" height="6" rx="3" fill={BLUE_SOFT} />
        <path d="M-24 14 H20" stroke={BLUE} strokeWidth="4" strokeLinecap="round" />
      </g>
      <Spark x={84} y={250} s={0.9} fill={YELLOW} />
      <Spark x={330} y={100} s={1.2} />
      <Spark x={140} y={48} s={0.7} fill={YELLOW} />
      <Spark x={352} y={330} s={0.6} />
      <circle cx="104" cy="318" r="5" fill="#fff" opacity=".5" />
      <circle cx="298" cy="60" r="4" fill={YELLOW} />
    </>
  );
}

const SCENES = { student: StudentScene, educator: EducatorScene, signup: SignupScene };

export default function AuthIllustration({ variant = "student", className = "" }) {
  const Scene = SCENES[variant] ?? StudentScene;
  return (
    <svg viewBox="0 0 400 410" className={className} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <Scene />
    </svg>
  );
}
