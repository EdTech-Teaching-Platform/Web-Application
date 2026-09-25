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
} from "../../components/ui/icons";

const SOCIAL_LINKS = [
  { label: "LinkedIn", href: "#", icon: LinkedInIcon },
  { label: "YouTube", href: "#", icon: YoutubeIcon },
  { label: "Instagram", href: "#", icon: InstagramIcon },
  { label: "X / Twitter", href: "#", icon: XSocialIcon },
];

const FOOTER_COLUMNS = [
  {
    title: "Learn",
    links: [
      { label: "Explore Courses", href: "/explore" },
      { label: "My Learning", href: "/student/my-learning" },
      { label: "Live Classes", href: "/student/live-classes" },
      { label: "Recorded Classes", href: "/student/explore?mode=recorded" },
      { label: "Assessments", href: "/student/assessments" },
      { label: "Certificates", href: "/student/certificates" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Discussions", href: "#" },
      { label: "Study Groups", href: "#" },
      { label: "Mentorship", href: "#" },
      { label: "Events", href: "#" },
      { label: "Q&A", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Career", href: "#" },
      { label: "Internships & Jobs", href: "#" },
      { label: "AI Study Assistant", href: "#" },
      { label: "Learning Resources", href: "#" },
      { label: "Help Center", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "#" },
      { label: "Contact Support", href: "mailto:support@universallearning.app" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Accessibility", href: "#" },
    ],
  },
];

// A column link can point at an in-app route (react-router Link), an
// in-page anchor, or a mailto — render the right element instead of
// forcing everything through Link (which would mangle "#"/"mailto:").
function FooterLink({ href, children }) {
  const className = "text-sm text-text/55 transition-colors duration-150 hover:text-primary";
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
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] lg:gap-x-6">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 lg:max-w-xs">
            <span className="font-display text-lg font-bold text-text">Universal Learning</span>
            <p className="mt-3 text-sm leading-relaxed text-text/55">
              Learn from expert educators, build practical skills, and grow at your own pace.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-text/10 text-text/50 transition-colors duration-150 hover:border-primary/30 hover:text-primary"
                >
                  <Icon className="h-[14px] w-[14px]" />
                </a>
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
            <a href="#" className="transition-colors duration-150 hover:text-primary">
              Cookies
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
