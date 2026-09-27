// Small inline "cutout" illustrations for ColorBlockCard / CertificateCard —
// stand-ins for the real course/educator photography the design mockups
// call for ("cutout photo bleeding to one edge"). Drawn in flat
// white-on-color shapes (no new color tokens: everything here is either
// white/black at reduced opacity, or --color-primary) so they read as part
// of the same design system rather than ad hoc stock art. Swap for real
// photography once course/educator images exist.
function Base({ children, ...props }) {
  return (
    <svg viewBox="0 0 200 150" className="h-full w-full" preserveAspectRatio="xMidYMax slice" {...props}>
      {children}
    </svg>
  );
}

export function ProgrammingIllustration(props) {
  return (
    <Base {...props}>
      <rect x="35" y="45" width="130" height="80" rx="10" fill="#000" opacity="0.12" />
      <rect x="45" y="55" width="110" height="62" rx="6" fill="#fff" opacity="0.85" />
      <path d="M65 75 50 90l15 15M105 75l15 15-15 15M90 70l-10 45" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
    </Base>
  );
}

export function MathIllustration(props) {
  return (
    <Base {...props}>
      <circle cx="100" cy="90" r="55" fill="#000" opacity="0.1" />
      <text x="100" y="105" textAnchor="middle" fontSize="70" fontWeight="700" fill="#fff" opacity="0.9" fontFamily="ui-sans-serif, system-ui">
        π
      </text>
    </Base>
  );
}

export function LanguageIllustration(props) {
  return (
    <Base {...props}>
      <path d="M45 55h90a10 10 0 0 1 10 10v35a10 10 0 0 1-10 10H90l-20 18v-18H45a10 10 0 0 1-10-10V65a10 10 0 0 1 10-10Z" fill="#fff" opacity="0.85" />
      <circle cx="65" cy="82" r="5" fill="currentColor" opacity="0.5" />
      <circle cx="90" cy="82" r="5" fill="currentColor" opacity="0.5" />
      <circle cx="115" cy="82" r="5" fill="currentColor" opacity="0.5" />
    </Base>
  );
}

export function MusicIllustration(props) {
  return (
    <Base {...props}>
      <rect x="30" y="40" width="140" height="90" rx="10" fill="#000" opacity="0.1" />
      <circle cx="75" cy="105" r="14" fill="#fff" opacity="0.9" />
      <circle cx="130" cy="98" r="14" fill="#fff" opacity="0.9" />
      <path d="M89 105V55l55-12v55" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />
    </Base>
  );
}

export function DesignIllustration(props) {
  return (
    <Base {...props}>
      <circle cx="100" cy="88" r="50" fill="#000" opacity="0.1" />
      <path
        d="M100 48a40 40 0 1 0 12 78c-6 0-10-4-10-9 0-3 1-5 3-7 2-2 3-4 3-7 0-6-5-10-11-10H82a20 20 0 0 1-20-20 38 38 0 0 1 38-25Z"
        fill="#fff"
        opacity="0.9"
      />
      <circle cx="86" cy="70" r="4" fill="currentColor" opacity="0.5" />
      <circle cx="70" cy="88" r="4" fill="currentColor" opacity="0.5" />
      <circle cx="112" cy="66" r="4" fill="currentColor" opacity="0.5" />
    </Base>
  );
}

export function BusinessIllustration(props) {
  return (
    <Base {...props}>
      <rect x="45" y="70" width="110" height="55" rx="8" fill="#fff" opacity="0.88" />
      <rect x="80" y="52" width="40" height="22" rx="4" fill="#fff" opacity="0.88" />
      <path d="M45 92h110" stroke="currentColor" strokeWidth="3" opacity="0.35" />
    </Base>
  );
}

export function GeneralIllustration(props) {
  return (
    <Base {...props}>
      <path d="M100 45 165 72 100 99 35 72Z" fill="#fff" opacity="0.9" />
      <path d="M60 82v25c0 8 18 14 40 14s40-6 40-14V82" stroke="#fff" strokeWidth="5" fill="none" opacity="0.7" />
    </Base>
  );
}

const BY_CATEGORY = {
  Programming: ProgrammingIllustration,
  Math: MathIllustration,
  Languages: LanguageIllustration,
  Science: MathIllustration,
  Music: MusicIllustration,
  Design: DesignIllustration,
  Business: BusinessIllustration,
  Other: GeneralIllustration,
};

export function illustrationFor(category) {
  return BY_CATEGORY[category] ?? GeneralIllustration;
}

// Certificate seal — used by CertificateCard in place of a blank thumbnail.
export function CertificateIllustration(props) {
  return (
    <Base {...props}>
      <rect x="30" y="20" width="140" height="95" rx="8" fill="currentColor" opacity="0.08" />
      <rect x="42" y="32" width="116" height="71" rx="4" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <circle cx="100" cy="110" r="22" fill="currentColor" opacity="0.15" />
      <path d="M90 108l7 7 15-15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
    </Base>
  );
}

// Landing-page hero scene — a live online class in progress. Replaces an
// earlier version that used a wide 640x500 viewBox plus a separately
// positioned, blurred background div for its glow: on this component's
// actual rendered box (bound to the text column's height via
// `md:items-center`, not the SVG's own aspect ratio) those two boxes
// could disagree, which is what made the whole scene read as stretched.
// Fixed two ways: the viewBox is square (480x480) and the glow is baked
// in as an SVG radial gradient rather than a second DOM element, so
// there's nothing left that can be sized out of proportion to the
// artwork — pair with an `aspect-square` wrapper in LandingPage.jsx so
// the outer box can't force it out of true either. Idle motion (see the
// `hero-*` keyframes in index.css) is opacity/transform only, per
// design.md, and every animated group sets its own fill-box transform
// origin so it moves in place instead of swinging from the SVG's corner.
export function LandingHeroScene(props) {
  return (
    <svg viewBox="0 0 480 480" className="h-full w-full" role="img" aria-label="Student in a live online class" {...props}>
      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="44%" r="58%">
          <stop offset="0%" stopColor="var(--color-blush)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--color-blush)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="220" r="230" fill="url(#heroGlow)" />
      <ellipse cx="240" cy="408" rx="150" ry="16" fill="currentColor" opacity="0.08" />

      {/* Laptop showing a live class grid */}
      <path d="M150 300h180l14 34H136Z" fill="currentColor" opacity="0.14" />
      <rect x="140" y="150" width="200" height="150" rx="14" fill="currentColor" opacity="0.92" />
      <rect x="154" y="164" width="172" height="122" rx="8" fill="white" />
      <rect x="163" y="173" width="72" height="50" rx="6" fill="var(--color-rotation-3)" opacity="0.85" />
      <rect x="245" y="173" width="72" height="50" rx="6" fill="var(--color-rotation-1)" opacity="0.85" />
      <rect x="163" y="233" width="154" height="44" rx="6" fill="var(--color-blush)" />
      <circle cx="199" cy="198" r="14" fill="white" opacity="0.9" />
      <circle cx="281" cy="198" r="14" fill="white" opacity="0.9" />
      <path d="M187 250h20M215 250h50" stroke="var(--color-primary)" strokeWidth="4" strokeLinecap="round" opacity="0.4" />

      {/* "Live" indicator pulsing on the call */}
      <g className="hero-pulse">
        <circle cx="172" cy="182" r="6" fill="var(--color-success)" />
      </g>

      {/* Floating chat bubble */}
      <g className="hero-bob">
        <rect x="318" y="94" width="96" height="60" rx="16" fill="white" stroke="currentColor" strokeWidth="3" opacity="0.95" />
        <path d="M334 154l-10 16 22-10Z" fill="white" stroke="currentColor" strokeWidth="3" />
        <circle cx="341" cy="124" r="6" fill="var(--color-rotation-2)" />
        <circle cx="364" cy="124" r="6" fill="var(--color-rotation-3)" />
        <circle cx="387" cy="124" r="6" fill="var(--color-rotation-4)" />
      </g>

      {/* Floating "lesson complete" badge */}
      <g className="hero-bob-delayed">
        <circle cx="100" cy="128" r="34" fill="var(--color-rotation-1)" />
        <path d="M86 128l10 10 18-20" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Small potted plant */}
      <g>
        <path d="M64 396l6-38h34l6 38Z" fill="var(--color-rotation-4)" opacity="0.85" />
        <g className="hero-sway">
          <path d="M87 358c-4-26-28-34-40-30 6 18 22 28 40 30Z" fill="var(--color-success)" opacity="0.85" />
          <path d="M87 358c4-30 30-40 44-34-8 20-24 32-44 34Z" fill="var(--color-success)" />
        </g>
      </g>

      {/* Floating progress ring */}
      <g className="hero-bob">
        <circle cx="394" cy="326" r="30" fill="white" stroke="currentColor" strokeWidth="3" opacity="0.95" />
        <path d="M394 302a24 24 0 1 1-17 41" fill="none" stroke="var(--color-rotation-3)" strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
