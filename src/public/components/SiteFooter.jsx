// Site-wide marketing footer — currently only rendered at the bottom of
// LandingPage (see src/public/pages/LandingPage.jsx). Pulled into its own
// component because it's sizable on its own.
//
// 2026 redesign: dark "ink" footer on the landing theme (--lp-* variables,
// defined on LandingPage's wrapper — this component renders inside it).
// Links/columns are unchanged.
//
// Link destinations: routed to real pages/anchors wherever one exists
// (Explore, Live Classes, My Learning, etc. — these correctly bounce an
// unauthenticated visitor to /login via ProtectedRoute, which is expected,
// not broken). Items with no real destination were removed entirely (see
// Item 12 in the previous revision): the Community column's Future-Scope
// entries, Career/Internships/AI Study Assistant, About Us/Accessibility.
import { Link } from "react-router-dom";
import { InstagramIcon, LinkedInIcon, MailIcon } from "../../components/ui/icons";

// Social links. Paste the real profile URLs into LINKEDIN_URL / INSTAGRAM_URL;
// until then those two icons stay visible but inactive (no made-up URLs).
const SUPPORT_EMAIL = "support@universallearning.app";
const LINKEDIN_URL = "";
const INSTAGRAM_URL = "";
const SOCIAL_LINKS = [
  { label: "LinkedIn", icon: LinkedInIcon, href: LINKEDIN_URL },
  { label: "Instagram", icon: InstagramIcon, href: INSTAGRAM_URL },
  { label: "Email", icon: MailIcon, href: `mailto:${SUPPORT_EMAIL}` },
];

// Only destinations that exist today are listed: the product is test series
// (public list + the student portal), plus the legal pages and support email.
const FOOTER_COLUMNS = [
  {
    title: "Learn",
    links: [
      { label: "Test Series", href: "/test-series" },
      { label: "My Tests", href: "/student/my-tests" },
      { label: "History", href: "/student/history" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact Support", href: `mailto:${SUPPORT_EMAIL}` },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

// A column link can point at an in-app route (react-router Link), an
// in-page anchor, or a mailto — render the right element instead of
// forcing everything through Link (which would mangle "#"/"mailto:").
function FooterLink({ href, children }) {
  const className = "text-sm text-white/60 transition-colors duration-150 hover:text-(--lp-yellow)";
  if (!href) {
    return <span title="Coming soon" aria-disabled="true" className="text-sm text-white/35">{children} <span className="text-[10px]">Coming soon</span></span>;
  }
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden rounded-t-[44px] bg-(--lp-ink) text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-(--lp-blue)/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-(--lp-yellow)/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1200px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-x-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 lg:max-w-xs">
            <Link to="/" className="inline-flex items-center gap-2.5 font-(family-name:--lp-font) text-xl font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-blue)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <path d="M3 8l9-4 9 4-9 4-9-4Z" />
                  <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
                </svg>
              </span>
              Universal Learning
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Learn from expert educators, build practical skills, and grow at your own pace.
            </p>
            <div className="mt-6 flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ label, icon: Icon, href }) => {
                const cls = "grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70";
                return href ? (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className={`${cls} transition-[background-color,color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-yellow) hover:text-(--lp-ink)`}
                  >
                    <Icon className="h-[15px] w-[15px]" />
                  </a>
                ) : (
                  <span key={label} aria-label={label} aria-disabled="true" title={`${label} link coming soon`} className={`${cls} opacity-60`}>
                    <Icon className="h-[15px] w-[15px]" />
                  </span>
                );
              })}
            </div>
          </div>

          {/* Navigation columns */}
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="font-(family-name:--lp-font) text-sm font-bold">{column.title}</p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        <p className="pointer-events-none mt-12 select-none overflow-hidden whitespace-nowrap text-center font-(family-name:--lp-font) text-[clamp(2.5rem,11.5vw,9.5rem)] font-extrabold leading-[0.9] tracking-tighter text-white/[0.07]" aria-hidden="true">
          Universal <span className="text-(--lp-yellow)/80">Learning</span>
        </p>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col-reverse items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/45">
            © {year} Universal Learning. All rights reserved.
          </p>
          <nav className="flex items-center gap-5 text-xs text-white/45">
            <Link to="/privacy" className="transition-colors duration-150 hover:text-(--lp-yellow)">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors duration-150 hover:text-(--lp-yellow)">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
