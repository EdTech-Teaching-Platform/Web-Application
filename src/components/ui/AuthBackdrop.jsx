// Decorative background for full-screen auth/onboarding takeovers — the
// "dashboard doodles scattered behind a centered card" pattern the user
// referenced. Redrawn from scratch as generic UI motifs (browser window,
// bar/line charts, sliders, a person at a desk, gear, magnifier, stars) in
// our own primary token — not a copy of any specific illustration. Purely
// decorative: aria-hidden, pointer-events-none. Previously hidden below the
// lg breakpoint; now shown at md and up too, since it was disappearing
// entirely on viewports narrower than 1024px (only used for onboarding now,
// so no other screen relies on the old cutoff).
export default function AuthBackdrop() {
  const stroke = "var(--color-primary)";
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block" aria-hidden="true">
      {/* browser card, top-left */}
      <svg className="absolute left-10 top-20 opacity-[0.2]" width="120" height="90" viewBox="0 0 120 90" fill="none">
        <rect x="1" y="1" width="118" height="88" rx="10" stroke={stroke} strokeWidth="2" />
        <line x1="1" y1="24" x2="119" y2="24" stroke={stroke} strokeWidth="2" />
        <circle cx="14" cy="12" r="3" stroke={stroke} strokeWidth="2" />
        <circle cx="26" cy="12" r="3" stroke={stroke} strokeWidth="2" />
        <line x1="16" y1="45" x2="80" y2="45" stroke={stroke} strokeWidth="2" />
        <line x1="16" y1="60" x2="60" y2="60" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* bar chart, bottom-left */}
      <svg className="absolute bottom-16 left-16 opacity-[0.2]" width="90" height="70" viewBox="0 0 90 70" fill="none">
        <line x1="2" y1="68" x2="88" y2="68" stroke={stroke} strokeWidth="2" />
        <rect x="10" y="40" width="14" height="28" stroke={stroke} strokeWidth="2" />
        <rect x="34" y="20" width="14" height="48" stroke={stroke} strokeWidth="2" />
        <rect x="58" y="34" width="14" height="34" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* trend/line chart card, top-right */}
      <svg className="absolute right-14 top-24 opacity-[0.2]" width="110" height="70" viewBox="0 0 110 70" fill="none">
        <rect x="1" y="1" width="108" height="68" rx="10" stroke={stroke} strokeWidth="2" />
        <path d="M12 50 L34 30 L54 42 L76 18 L98 26" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* sliders, bottom-right */}
      <svg className="absolute bottom-20 right-16 opacity-[0.2]" width="90" height="50" viewBox="0 0 90 50" fill="none">
        <line x1="0" y1="10" x2="90" y2="10" stroke={stroke} strokeWidth="2" />
        <circle cx="34" cy="10" r="5" stroke={stroke} strokeWidth="2" />
        <line x1="0" y1="34" x2="90" y2="34" stroke={stroke} strokeWidth="2" />
        <circle cx="60" cy="34" r="5" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* magnifying glass over a search card, mid-left */}
      <svg className="absolute left-[6%] top-1/2 opacity-[0.2]" width="80" height="70" viewBox="0 0 80 70" fill="none">
        <rect x="1" y="1" width="78" height="52" rx="8" stroke={stroke} strokeWidth="2" />
        <line x1="12" y1="16" x2="46" y2="16" stroke={stroke} strokeWidth="2" />
        <line x1="12" y1="28" x2="34" y2="28" stroke={stroke} strokeWidth="2" />
        <circle cx="58" cy="46" r="12" stroke={stroke} strokeWidth="2" />
        <line x1="67" y1="55" x2="76" y2="64" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* gear / settings, mid-right */}
      <svg className="absolute right-[8%] top-[48%] opacity-[0.2]" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="12" stroke={stroke} strokeWidth="2" />
        <path
          d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l5.6 5.6M45.4 45.4L51 51M51 13l-5.6 5.6M18.6 45.4L13 51"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* speech bubble / notification, top-center */}
      <svg className="absolute left-[42%] top-10 opacity-[0.2]" width="70" height="52" viewBox="0 0 70 52" fill="none">
        <rect x="1" y="1" width="68" height="38" rx="10" stroke={stroke} strokeWidth="2" />
        <path d="M18 39 L18 50 L30 39" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <line x1="12" y1="14" x2="58" y2="14" stroke={stroke} strokeWidth="2" />
        <line x1="12" y1="24" x2="42" y2="24" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* person working at a desk, bottom-center — larger and a touch bolder */}
      <svg
        className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-[0.22]"
        width="220"
        height="180"
        viewBox="0 0 180 150"
        fill="none"
      >
        {/* desk */}
        <line x1="10" y1="120" x2="170" y2="120" stroke={stroke} strokeWidth="2.5" />
        <line x1="24" y1="120" x2="24" y2="146" stroke={stroke} strokeWidth="2.5" />
        <line x1="156" y1="120" x2="156" y2="146" stroke={stroke} strokeWidth="2.5" />
        {/* laptop */}
        <path d="M70 118 L74 96 L112 96 L116 118" stroke={stroke} strokeWidth="2.5" />
        <line x1="66" y1="118" x2="120" y2="118" stroke={stroke} strokeWidth="2.5" />
        {/* mug, beside the laptop */}
        <rect x="128" y="104" width="14" height="14" rx="2" stroke={stroke} strokeWidth="2" />
        <path d="M142 107 Q149 107 149 111 Q149 115 142 115" stroke={stroke} strokeWidth="2" />
        {/* chair back */}
        <path d="M78 116 L78 70 Q78 60 90 60 Q102 60 102 70 L102 116" stroke={stroke} strokeWidth="2.5" />
        {/* torso + arms */}
        <path d="M82 116 L82 92 Q90 84 98 92 L98 116" stroke={stroke} strokeWidth="2.5" />
        {/* head */}
        <circle cx="90" cy="70" r="12" stroke={stroke} strokeWidth="2.5" />
        {/* hair squiggle */}
        <path d="M79 64 Q83 54 90 58 Q97 52 101 62" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {/* calendar, upper-right (above the trend chart) */}
      <svg className="absolute right-[22%] top-8 opacity-[0.2]" width="64" height="60" viewBox="0 0 64 60" fill="none">
        <rect x="1" y="9" width="62" height="50" rx="8" stroke={stroke} strokeWidth="2" />
        <line x1="1" y1="23" x2="63" y2="23" stroke={stroke} strokeWidth="2" />
        <line x1="16" y1="1" x2="16" y2="15" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="48" y1="1" x2="48" y2="15" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="36" r="3" stroke={stroke} strokeWidth="2" />
        <circle cx="32" cy="36" r="3" stroke={stroke} strokeWidth="2" />
        <circle cx="16" cy="48" r="3" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* checklist / clipboard, far right edge */}
      <svg className="absolute right-2 top-[30%] opacity-[0.2]" width="70" height="88" viewBox="0 0 70 88" fill="none">
        <rect x="1" y="7" width="68" height="80" rx="8" stroke={stroke} strokeWidth="2" />
        <rect x="20" y="1" width="30" height="12" rx="4" stroke={stroke} strokeWidth="2" />
        <path d="M14 34 L20 40 L32 26" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="38" y1="34" x2="58" y2="34" stroke={stroke} strokeWidth="2" />
        <path d="M14 58 L20 64 L32 50" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="38" y1="58" x2="58" y2="58" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* puzzle piece, between the gear and the sliders */}
      <svg className="absolute right-[6%] top-[64%] opacity-[0.2]" width="58" height="58" viewBox="0 0 58 58" fill="none">
        <path
          d="M20 4h10a4 4 0 0 1 0 8h-2v6h6v-2a4 4 0 1 1 8 0v2h6v10a4 4 0 1 1 0 8v6h-6v-2a4 4 0 1 0-8 0v2h-6v-6h-2a4 4 0 1 1 0-8h2v-6H20a4 4 0 0 1 0-8h2V8a4 4 0 0 1 -2-4Z"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      {/* lightbulb, left side beneath the browser card */}
      <svg className="absolute left-[22%] top-[26%] opacity-[0.2]" width="52" height="70" viewBox="0 0 52 70" fill="none">
        <path
          d="M26 2c12 0 20 9 20 20 0 8-4 12-8 16-2 2-3 4-3 7v3H17v-3c0-3-1-5-3-7-4-4-8-8-8-16C6 11 14 2 26 2Z"
          stroke={stroke}
          strokeWidth="2"
        />
        <line x1="18" y1="56" x2="34" y2="56" stroke={stroke} strokeWidth="2" />
        <line x1="20" y1="64" x2="32" y2="64" stroke={stroke} strokeWidth="2" />
        <line x1="26" y1="16" x2="26" y2="34" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* rocket, left side between the magnifier and bar chart */}
      <svg className="absolute left-[16%] top-[64%] opacity-[0.2]" width="56" height="80" viewBox="0 0 56 80" fill="none">
        <path
          d="M28 2c9 8 13 20 13 32 0 10-4 20-13 30-9-10-13-20-13-30 0-12 4-24 13-32Z"
          stroke={stroke}
          strokeWidth="2"
        />
        <circle cx="28" cy="30" r="6" stroke={stroke} strokeWidth="2" />
        <path d="M15 46 4 60l12-4" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <path d="M41 46 52 60l-12-4" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <path d="M22 64 L20 76 M34 64 L36 76" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* trophy/badge, bottom-right below the sliders */}
      <svg className="absolute right-[16%] bottom-6 opacity-[0.2]" width="56" height="64" viewBox="0 0 56 64" fill="none">
        <circle cx="28" cy="24" r="18" stroke={stroke} strokeWidth="2" />
        <path d="M17 40 L12 62 L28 54 L44 62 L39 40" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 24 L26 30 L37 17" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* graduation cap, top-left */}
      <svg className="absolute left-[15%] top-[8%] opacity-[0.2]" width="70" height="52" viewBox="0 0 70 52" fill="none">
        <path d="M35 4 L68 18 L35 32 L2 18 Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <path d="M18 24 L18 38 Q35 48 52 38 L52 24" stroke={stroke} strokeWidth="2" />
        <path d="M63 20 L63 34" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <circle cx="63" cy="38" r="2.5" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* open book, top-right (big empty gap above the calendar) */}
      <svg className="absolute right-[30%] top-3 opacity-[0.2]" width="76" height="52" viewBox="0 0 76 52" fill="none">
        <path d="M38 10 C30 4 16 2 4 4 L4 44 C16 42 30 44 38 50 C46 44 60 42 72 44 L72 4 C60 2 46 4 38 10 Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <line x1="38" y1="10" x2="38" y2="50" stroke={stroke} strokeWidth="2" />
        <line x1="12" y1="16" x2="28" y2="14" stroke={stroke} strokeWidth="2" />
        <line x1="12" y1="26" x2="28" y2="24" stroke={stroke} strokeWidth="2" />
        <line x1="48" y1="14" x2="64" y2="16" stroke={stroke} strokeWidth="2" />
        <line x1="48" y1="24" x2="64" y2="26" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* target / bullseye, right side, between the checklist and puzzle piece */}
      <svg className="absolute right-[16%] top-[40%] opacity-[0.2]" width="58" height="58" viewBox="0 0 58 58" fill="none">
        <circle cx="29" cy="29" r="26" stroke={stroke} strokeWidth="2" />
        <circle cx="29" cy="29" r="16" stroke={stroke} strokeWidth="2" />
        <circle cx="29" cy="29" r="6" stroke={stroke} strokeWidth="2" />
      </svg>

      {/* folder, bottom-right (between the puzzle piece and trophy) */}
      <svg className="absolute right-[18%] top-[72%] opacity-[0.2]" width="66" height="52" viewBox="0 0 66 52" fill="none">
        <path d="M2 10 L2 46 Q2 50 6 50 L60 50 Q64 50 64 46 L64 16 Q64 12 60 12 L28 12 L22 4 L6 4 Q2 4 2 10 Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      </svg>

      {/* bell / notification, bottom-left (near the rocket) */}
      <svg className="absolute left-[20%] bottom-[8%] opacity-[0.2]" width="48" height="58" viewBox="0 0 48 58" fill="none">
        <path d="M24 4 C15 4 10 11 10 20 L10 34 L4 44 L44 44 L38 34 L38 20 C38 11 33 4 24 4 Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        <path d="M18 44 Q18 52 24 52 Q30 52 30 44" stroke={stroke} strokeWidth="2" />
      </svg>

      <Star className="absolute left-1/3 top-12 h-4 w-4 opacity-[0.28]" />
      <Star className="absolute right-1/3 bottom-14 h-3 w-3 opacity-[0.28]" />
      <Star className="absolute left-1/4 bottom-28 h-3 w-3 opacity-[0.28]" />
      <Star className="absolute right-[14%] top-[30%] h-3 w-3 opacity-[0.28]" />
      <Star className="absolute left-[10%] top-[12%] h-3 w-3 opacity-[0.28]" />
      <Star className="absolute right-[4%] top-[52%] h-3 w-3 opacity-[0.28]" />
      <Star className="absolute left-[30%] top-[4%] h-3 w-3 opacity-[0.28]" />
      <Star className="absolute right-[24%] bottom-[18%] h-3 w-3 opacity-[0.28]" />
    </div>
  );
}

function Star({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M6 18l4-4M14 10l4-4" />
    </svg>
  );
}
