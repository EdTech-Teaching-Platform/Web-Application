// Site-wide marketing footer — currently only rendered at the bottom of
// LandingPage (see src/public/pages/LandingPage.jsx). Pulled into its own
// component because it's sizable on its own; nothing above the closing CTA
// banner changes as part of this.
//
// Link destinations: routed to real pages/anchors wherever one exists
// (Explore, Live Classes, My Learning, etc. — these correctly bounce an
// unauthenticated visitor to /login via ProtectedRoute, which is expected,
// not broken). Everywhere no page/module exists yet — the whole
// "Community" column (explicitly Future Scope per the LMS doc, same call
// PublicLayout's nav already makes), Career/Internships/AI Study
// Assistant/Learning Resources under Resources, and About Us/
// Accessibility under Company — the link is left as "#" rather than
// inventing a destination. Flag and wire these up once those pages exist.
import { Link } from "react-router-dom";
import {
  LinkedInIcon,
  YoutubeIcon,
  InstagramIcon,
  XSocialIcon,
  GoogleIcon,
  AppleIcon,
} from "../../components/ui/icons";

const SOCIAL_LINKS = [
  { label: "LinkedIn", icon: LinkedInIcon },
  { label: "YouTube", icon: YoutubeIcon },
  { label: "Instagram", icon: InstagramIcon },
  { label: "X / Twitter", icon: XSocialIcon },
];

// Item 12: placeholder "coming soon" links/columns removed entirely
// (not just delinked) — the Community column (Study Groups, Mentorship —
// Future Scope per the LMS doc — plus its remaining items had no real
// destination of their own), Career/Internships & Jobs/AI Study Assistant
// under Resources, and About Us/Accessibility under Company. Every
// remaining link below points at a real route; ones under /student/* are
// auth-gated and already correctly bounce a logged-out visitor through
// /login?redirect=... via ProtectedRoute rather than 404ing or silently
// rendering someone else's data.
const FOOTER_COLUMNS = [
  {
    title: "Learn",
    links: [
      { label: "Explore Courses", href: "/explore" },
      { label: "My Learning", href: "/student/my-learning" },
      { label: "Live Classes", href: "/student/live-classes" },
      { label: "Test Series", href: "/student/assessments/test-series" },
      { label: "Certificates", href: "/student/certificates" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Discussions", href: "/student/messages" },
      { label: "Events", href: "/student/calendar" },
      { label: "Q&A", href: "/student/messages" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Learning Resources", href: "/student/explore" },
      { label: "Help Center", href: "/student/help-complaints" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact Support", href: "mailto:support@universallearning.app" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

// A column link can point at an in-app route (react-router Link), an
// in-page anchor, or a mailto — render the right element instead of
// forcing everything through Link (which would mangle "#"/"mailto:").
function FooterLink({ href, children }) {
  const className = "text-sm text-text/55 transition-colors duration-150 hover:text-primary";
  if (!href) {
    return <span title="Coming soon" aria-disabled="true" className="text-sm text-text/35">{children} <span className="text-[10px]">Coming soon</span></span>;
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
    <footer className="relative overflow-hidden border-t border-text/10 bg-bg">
      {/* Same quiet decorative language as the rest of the page
          (AmbientPortalBackdrop's accent palette), used far more sparingly
          here: one large faded circle behind the brand column, one small
          geometric educational mark, one small circle balancing the right
          edge — static, no motion, well under the hero's decoration count. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 -top-24 h-80 w-80 rounded-full bg-accent-lilac/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-accent-peach/10 blur-3xl" />
        <svg
          className="absolute right-10 top-8 hidden h-14 w-14 text-accent-teal/25 sm:block"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M24 8 4 18l20 10 20-10Z" />
          <path d="M14 22v9c0 3 4.5 5.5 10 5.5s10-2.5 10-5.5v-9" />
          <path d="M44 18v11" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr] lg:gap-x-6">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 lg:max-w-xs">
            <Link to="/" className="font-display text-lg font-bold text-text">Universal Learning</Link>
            <p className="mt-3 text-sm leading-relaxed text-text/55">
              Learn from expert educators, build practical skills, and grow at your own pace.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  aria-label={label}
                  aria-disabled="true"
                  title={`${label} link coming soon`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-text/10 text-text/30"
                >
                  <Icon className="h-[14px] w-[14px]" />
                </span>
              ))}
            </div>
          </div>

          {/* Navigation columns */}
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="font-display text-sm font-semibold text-text">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Download App -- presentational only, no real mobile app exists
              yet (see LandingPage's Learn Anywhere section and FAQ f5). Not
              links: no real store URLs to point at yet, so these render as
              static badges rather than fabricated destinations. */}
          <div>
            <p className="font-display text-sm font-semibold text-text">Download App</p>
            <div className="mt-4 flex flex-col items-start gap-2.5">
              <span
                className="inline-flex min-w-[112px] items-center gap-2 rounded-md border border-primary/20 bg-primary px-2.5 py-1.5 text-white shadow-sm"
                title="Coming soon -- no mobile app yet"
              >
                <GoogleIcon className="h-4 w-4 shrink-0" />
                <span className="text-left leading-tight"><span className="block text-[10px] font-semibold">Google Play</span></span>
              </span>
              <span
                className="inline-flex min-w-[112px] items-center gap-2 rounded-md border border-primary/20 bg-primary px-2.5 py-1.5 text-white shadow-sm"
                title="Coming soon -- no mobile app yet"
              >
                <AppleIcon className="h-4 w-4 shrink-0" />
                <span className="text-left leading-tight"><span className="block text-[10px] font-semibold">App Store</span></span>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col-reverse items-center gap-4 border-t border-text/10 pt-6 sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text/40">
            © {year} Universal Learning. All rights reserved.
          </p>
          <nav className="flex items-center gap-5 text-xs text-text/40">
            <Link to="/privacy" className="transition-colors duration-150 hover:text-primary">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors duration-150 hover:text-primary">
              Terms
            </Link>
            <span aria-disabled="true" title="Cookie settings coming soon">Cookies</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
