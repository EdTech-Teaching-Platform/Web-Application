// Small, local, always-static accent for a section that sits on a solid
// `bg-white` background — the fixed-position AmbientPortalBackdrop is
// always fully hidden there (a fully opaque white block in front of it
// covers it completely, by definition), so instead of hacking white
// sections to be translucent, a couple of the SAME shapes/tokens from
// the main backdrop are rendered again here, locally, faint and inert,
// scoped to just that section's own corner. Reuses the exact paths/
// colors above rather than inventing a second illustration style.
export function LocalAmbientAccent({ className = "" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg className="absolute -right-6 -top-6 h-32 w-32 opacity-[0.07]" viewBox="0 0 96 78" fill="none">
        <path d="M48 6l45 18-45 18-45-18Z" fill="var(--color-accent-teal)" />
        <path d="M18 32v14c0 5 13 9 30 9s30-4 30-9V32" fill="none" stroke="var(--color-accent-teal)" strokeWidth="3" />
      </svg>
      <svg className="absolute -bottom-8 -left-8 h-28 w-28 opacity-[0.07]" viewBox="0 0 66 52" fill="none">
        <path d="M2 10 L2 46 Q2 50 6 50 L60 50 Q64 50 64 46 L64 16 Q64 12 60 12 L28 12 L22 4 L6 4 Q2 4 2 10 Z" fill="var(--color-accent-lilac)" />
      </svg>
    </div>
  );
}

export default function AmbientPortalBackdrop({ variant = "student" }) {
  return (
    <div className={`ambient-portal-backdrop ambient-portal-backdrop--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <circle className="ambient-drift ambient-pulse" cx="118" cy="170" r="92" fill="var(--color-accent-teal)" opacity="0.08" />
        <circle className="ambient-drift-slow ambient-pulse" cx="1320" cy="240" r="130" fill="var(--color-accent-lilac)" opacity="0.11" />
        <circle className="ambient-drift ambient-pulse" cx="1260" cy="760" r="105" fill="var(--color-accent-peach)" opacity="0.18" />
        <circle className="ambient-drift-slow ambient-pulse" cx="260" cy="780" r="115" fill="var(--color-accent-sky)" opacity="0.16" />
        <path className="ambient-dash" d="M44 320c65-48 125-45 178 10s76 63 132 20" fill="none" stroke="var(--color-accent-teal)" strokeWidth="4" strokeDasharray="7 12" opacity="0.34" />
        <path className="ambient-dash ambient-dash--delayed" d="M1175 510c62-42 112-35 157 12s67 54 110 18" fill="none" stroke="var(--color-accent-lilac)" strokeWidth="4" strokeDasharray="7 12" opacity="0.34" />
        <g className="ambient-drift-slow ambient-orbit" opacity="0.5">
          <path d="m1288 138 18-9 18 9v30l-18 10-18-10Z" fill="var(--color-accent-peach)" />
          <path d="m1298 143 8-4 8 4v15l-8 5-8-5Z" fill="white" opacity="0.85" />
        </g>
        {/* Graduation-cap accent — replaces the two shapes removed earlier
            (a teal badge at y=105 and a white notebook card at y=145),
            which sat inside the header/top-nav strip's own box and
            showed through its translucent, blurred background as stray
            shapes over real chrome. This one is placed at y≈450 instead,
            past every fixed header/nav strip on the page, in the same
            quiet margin the other lower shapes below already use. */}
        <g className="ambient-bob ambient-bob--delayed ambient-sway" opacity="0.4">
          <path d="M1345 452l45-18 45 18-45 18Z" fill="var(--color-accent-teal)" />
          <path d="M1345 452v20c0 7 20 13 45 13s45-6 45-13v-20" fill="none" stroke="var(--color-accent-teal)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1445 452v18" stroke="var(--color-accent-teal)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="1445" cy="474" r="4" fill="var(--color-accent-peach)" />
        </g>
        <g className="ambient-bob ambient-sway" opacity="0.52">
          <path d="M1330 650h48v34h-48z" fill="var(--color-accent-sky)" />
          <path d="M1338 641h32v9h-32zM1342 684h24v31h-24z" fill="var(--color-accent-lilac)" />
        </g>
        <g className="ambient-bob ambient-bob--delayed" opacity="0.42">
          <path d="M150 690h92l-10 54h-72Z" fill="var(--color-accent-lilac)" />
          <path d="M162 681h68l8 9h-84Z" fill="var(--color-accent-sky)" />
          <path d="M174 709h44M170 721h54" stroke="white" strokeWidth="5" strokeLinecap="round" />
        </g>
        <g className="ambient-sway" opacity="0.42">
          <circle cx="300" cy="760" r="24" fill="var(--color-accent-peach)" />
          <path d="M288 760h24M300 748v24" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* Additional shapes below — same filled color-block language as
            the set above, reusing the existing token palette, placed to
            fill sections further down the page that previously had no
            decoration at all (per the "sections look bare" note) rather
            than inventing a new illustration style. */}
        <g className="ambient-bob ambient-sway" opacity="0.4">
          {/* lightbulb */}
          <circle cx="1120" cy="470" r="20" fill="var(--color-accent-lilac)" />
          <path d="M1112 490h16M1114 498h12" stroke="white" strokeWidth="4" strokeLinecap="round" />
          <path d="M1120 442v-10M1098 460l-8-6M1142 460l8-6" stroke="var(--color-accent-lilac)" strokeWidth="4" strokeLinecap="round" />
        </g>
        <g className="ambient-drift-slow ambient-bob--delayed" opacity="0.38">
          {/* rocket */}
          <path d="M210 420c0-26 12-44 26-52 14 8 26 26 26 52 0 12-6 20-12 24h-28c-6-4-12-12-12-24Z" fill="var(--color-accent-sky)" />
          <circle cx="236" cy="410" r="7" fill="white" opacity="0.85" />
          <path d="M212 442l-10 16M260 442l10 16" stroke="var(--color-accent-sky)" strokeWidth="4" strokeLinecap="round" />
        </g>
        <g className="ambient-sway ambient-pulse" opacity="0.4">
          {/* bell */}
          <path d="M1160 800c0-16 10-27 24-27s24 11 24 27v14l8 12h-64l8-12Z" fill="var(--color-accent-teal)" />
          <path d="M1176 826c0 6 4 10 8 10s8-4 8-10" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}
