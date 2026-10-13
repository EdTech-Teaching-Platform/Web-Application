// Small inline icon set for auth screens — no icon library dependency.
// Keep additions here generic (usable by any portal), not auth-specific.

export function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.9 13.9 0 0 1-3.15 4.05M6.6 6.6C3.55 8.4 1.5 12 1.5 12s3.5 7 10.5 7a10.4 10.4 0 0 0 4.4-.95" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" {...props}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

export function UploadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" {...props}>
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 12v4M9.5 13.5 12 11l2.5 2.5" />
    </svg>
  );
}

export function AppleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <path d="M16.36 1c.12 1.02-.28 2.02-.9 2.75-.65.77-1.72 1.36-2.75 1.28-.14-1 .34-2.04.94-2.72C14.32 1.5 15.4.94 16.36 1ZM20.4 17.13c-.5 1.14-.73 1.65-1.37 2.66-.9 1.4-2.16 3.14-3.72 3.16-1.39.02-1.75-.9-3.63-.89-1.88.01-2.28.9-3.67.89-1.56-.02-2.75-1.6-3.65-3-2.5-3.9-2.77-8.48-1.22-10.92 1.1-1.74 2.84-2.76 4.47-2.76 1.67 0 2.72.92 4.1.92 1.34 0 2.16-.92 4.1-.92 1.45 0 2.99.79 4.09 2.16-3.6 1.97-3.02 7.1.5 8.7Z" />
    </svg>
  );
}

// --- Dashboard / portal-chrome icon set --------------------------------
// Generic, stroke-based, matching the set above (24x24 viewBox, round caps).
// Kept here (not portal-local) since sidebar nav, stat cards and list rows
// are patterns every portal's dashboard chrome will need.

export function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5v0A1.5 1.5 0 0 1 13.5 15v5H17a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

export function BookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
    </svg>
  );
}

export function VideoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.2" />
      <path d="m21.5 8.5-5.5 3.5 5.5 3.5v-7Z" />
    </svg>
  );
}

export function UsersIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 8.2a3.2 3.2 0 1 1 0 6.4" />
      <path d="M18.4 13.8a6.2 6.2 0 0 1 3.8 5.7" />
    </svg>
  );
}

export function MentorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.2v3.8l2.6 1.5" />
      <path d="M12 3v1.4M21 12h-1.4M12 21v-1.4M3 12h1.4" />
    </svg>
  );
}

export function WalletIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5" />
      <rect x="3" y="8" width="18" height="11.5" rx="2.3" />
      <path d="M16 13.2h2.2" />
    </svg>
  );
}

export function ChartIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function BellIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.3 1.5 5.3H4.5S6 14 6 10Z" />
      <path d="M9.7 18.5a2.3 2.3 0 0 0 4.6 0" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

export function StarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...props}>
      <path d="M12 2.5l2.95 6.15 6.55.62-4.95 4.55 1.35 6.68L12 17.9l-5.9 2.6 1.35-6.68-4.95-4.55 6.55-.62L12 2.5Z" />
    </svg>
  );
}

export function CalendarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <rect x="3" y="5.5" width="18" height="15" rx="2.3" />
      <path d="M3 10h18M8 3v4.5M16 3v4.5" />
    </svg>
  );
}

export function ChevronRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrendingUpIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <path d="m3 16 6.5-6.5 4 4L22 5" />
      <path d="M16 5h6v6" />
    </svg>
  );
}

export function TrendingDownIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <path d="m3 8 6.5 6.5 4-4L22 19" />
      <path d="M16 19h6v-6" />
    </svg>
  );
}

export function SettingsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 6.14 8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.5a1.7 1.7 0 0 0 1-1.55V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.55 1H19.5a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </svg>
  );
}

export function HelpIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 1.9" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <path d="M9 20H5.5A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4H9" />
      <path d="M16 16.5 21 12l-5-4.5M21 12H9" />
    </svg>
  );
}

export function MoreIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" {...props}>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

// --- Course Builder / curriculum icon set --------------------------------

export function ArticleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </svg>
  );
}

export function QuizIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 1.9" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function AssignmentIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M8 3.5h8a1 1 0 0 1 1 1V20l-5-2.5L7 20V4.5a1 1 0 0 1 1-1Z" />
      <path d="m9.5 10.5 2 2 3-3.5" />
    </svg>
  );
}

export function DownloadFileIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
      <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </svg>
  );
}

export function LiveSessionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3" />
      <path d="m18.4 5.6-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
    </svg>
  );
}

export function GripIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...props}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.7" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

export function PencilIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 20l.9-4L16 4.9a1.8 1.8 0 0 1 2.5 0l.6.6a1.8 1.8 0 0 1 0 2.5L8 19l-4 1Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  );
}

export function DuplicateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M6 15.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5v1" />
    </svg>
  );
}

export function CertificateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" {...props}>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 6.5v5l2.8 1.6" />
      <path d="m8.5 14 -1.3 6.5 4.8-2 4.8 2L15.5 14" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function BoldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" {...props}>
      <path d="M7 4.5h6.2a3.3 3.3 0 0 1 0 6.6H7Z" />
      <path d="M7 11.1h7a3.4 3.4 0 0 1 0 6.9H7Z" />
    </svg>
  );
}

export function ItalicIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" {...props}>
      <path d="M10.5 4.5h7M6.5 19.5h7M14 4.5 10 19.5" />
    </svg>
  );
}

export function ListBulletIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.2" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HeadingIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" {...props}>
      <path d="M5 5v14M15 5v14M5 12h10" />
      <path d="M19 8v.01" />
      <text x="17" y="18" fontSize="9" fill="currentColor" stroke="none">2</text>
    </svg>
  );
}

export function LinkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.5 5a3.2 3.2 0 0 1 4.5 4.5L15.5 11" />
      <path d="M13 17.5 11.5 19A3.2 3.2 0 0 1 7 14.5L8.5 13" />
    </svg>
  );
}

export function InfoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.01" />
    </svg>
  );
}

// --- Content Upload / Course Preview icon set ----------------------------

export function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

export function PlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...props}>
      <path d="M6 4.2v15.6a1 1 0 0 0 1.53.85l12.5-7.8a1 1 0 0 0 0-1.7l-12.5-7.8A1 1 0 0 0 6 4.2Z" />
    </svg>
  );
}

export function MonitorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 17.5V21" />
    </svg>
  );
}

export function TabletIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2.2" />
      <path d="M12 18.5h.01" />
    </svg>
  );
}

export function MobileIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M12 18.2h.01" />
    </svg>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M12 3.5 22 20.5H2Z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </svg>
  );
}

export function CaptionsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.3" />
      <path d="M8.5 13.2a2 2 0 1 1 0-2.4M15.7 13.2a2 2 0 1 1 0-2.4" />
    </svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function FileGenericIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
    </svg>
  );
}

export function SparkleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40" {...props}>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" opacity=".9" />
      <path d="M19 14l.9 2.5L22.4 17.4 19.9 18.3 19 20.8 18.1 18.3 15.6 17.4 18.1 16.5 19 14Z" opacity=".55" />
    </svg>
  );
}

export function ArchiveIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="2.5" y="4" width="19" height="4.5" rx="1.2" />
      <path d="M4 8.5V19a1.2 1.2 0 0 0 1.2 1.2h13.6A1.2 1.2 0 0 0 20 19V8.5" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function FlagIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M5 21V4" />
      <path d="M5 4.5h11.5l-2.6 4 2.6 4H5" />
    </svg>
  );
}

export function TagIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M11.7 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.7c0 .4.16.78.44 1.06l9.6 9.6a1.5 1.5 0 0 0 2.12 0l6.7-6.7a1.5 1.5 0 0 0 0-2.12l-9.6-9.6a1.5 1.5 0 0 0-1.06-.44Z" />
      <path d="M8 8.5h.01" />
    </svg>
  );
}

export function PackageIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M21 8.2 12 3.5 3 8.2v7.6L12 20.5l9-4.7z" />
      <path d="M3 8.2 12 12.5l9-4.3M12 12.5V20.5" />
    </svg>
  );
}

export function SendIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M21.5 2.5 11 13" />
      <path d="M21.5 2.5 15 21.5l-4-8.5-8.5-4Z" />
    </svg>
  );
}

export function GridIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function RowsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.3" />
      <rect x="3.5" y="10.5" width="17" height="4.5" rx="1.3" />
      <rect x="3.5" y="16.5" width="17" height="3" rx="1.3" />
    </svg>
  );
}

export function MessageIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function ReplyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h9a7 7 0 0 1 7 7v2" />
    </svg>
  );
}

export function RepeatIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...props}>
      <path d="M17 2.5 20 5.5l-3 3" />
      <path d="M20 5.5H8a5 5 0 0 0-5 5v1" />
      <path d="M7 21.5 4 18.5l3-3" />
      <path d="M4 18.5h12a5 5 0 0 0 5-5v-1" />
    </svg>
  );
}

// -- Live Class Host View icon set ---------------------------------------
// Added for Scheduled Live Class + Host View (Sec 5.7): control-dock,
// whiteboard-toolbar and in-session-tool icons. Kept generic/reusable, not
// live-class-specific in name, per the file's own convention above.

export function MicIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5v4" />
      <path d="M8.5 21.5h7" />
    </svg>
  );
}

export function MicOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-.32 1.35" />
      <path d="M6.5 10v1a5.5 5.5 0 0 0 8.4 4.66" />
      <path d="M5.5 11a6.5 6.5 0 0 0 .13 1.3" />
      <path d="M12 17.5v4" />
      <path d="M8.5 21.5h7" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function CameraIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.2 21 7v10l-5.5-3.2" />
    </svg>
  );
}

export function CameraOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M2.5 8.5V16a2 2 0 0 0 2 2h8.5" />
      <path d="M15.5 10.2 21 7v10l-5.5-3.2" />
      <path d="M2.5 6.3A2 2 0 0 1 4.3 6H13a2 2 0 0 1 2 2v.5" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function ScreenShareIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M12 8v6" />
      <path d="M9 11l3-3 3 3" />
      <path d="M8 21.5h8" />
      <path d="M12 17.5v4" />
    </svg>
  );
}

export function HandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M9 11.5V5a1.5 1.5 0 0 1 3 0v5.5" />
      <path d="M12 10.3V4a1.5 1.5 0 0 1 3 0v6.7" />
      <path d="M15 10.5V6.5a1.5 1.5 0 0 1 3 0v9c0 3.9-2.7 7-7 7-3 0-4.4-1-5.8-2.9L2.7 15a1.6 1.6 0 0 1 2.5-2l1.8 1.8V9.2a1.5 1.5 0 0 1 3-.1" />
    </svg>
  );
}

export function PollIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
      <path d="M2.5 20h19" />
    </svg>
  );
}

export function PenIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 20l.9-4.2L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.2 19.1 4 20Z" />
      <path d="M14 6.5l3.5 3.5" />
    </svg>
  );
}

export function EraserIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M17.5 3.5 21 7l-9.5 9.5H8L3.5 12 13 2.5a1.7 1.7 0 0 1 2.4 0l2.1 2.1a1.7 1.7 0 0 1 0 2.4Z" />
      <path d="M8 21.5h13" />
    </svg>
  );
}

export function ShapeSquareIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export function ShapeCircleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

export function ShapeLineIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 20 20 4" />
    </svg>
  );
}

export function ShapeArrowIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 20 20 4" />
      <path d="M20 4v7" />
      <path d="M20 4h-7" />
    </svg>
  );
}

export function TextToolIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M5 5.5h14" />
      <path d="M12 5.5v13" />
      <path d="M9 18.5h6" />
    </svg>
  );
}

export function UndoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M7 7.5 3 11.5l4 4" />
      <path d="M3 11.5h11a6 6 0 0 1 0 12h-2" />
    </svg>
  );
}

export function RedoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M17 7.5l4 4-4 4" />
      <path d="M21 11.5H10a6 6 0 0 0 0 12h2" />
    </svg>
  );
}

export function PhoneOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M11 5.3a15.6 15.6 0 0 1 7.6 4 1.6 1.6 0 0 1 .2 2l-1.8 1.9a1.5 1.5 0 0 1-1.8.3 11 11 0 0 1-2.3-1.5" />
      <path d="M9.4 9.8A11 11 0 0 1 8 8.1a1.5 1.5 0 0 1 .3-1.8l1.9-1.8" />
      <path d="M4.9 4.9a15.7 15.7 0 0 0 14.2 14.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function LayersIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M12 3 21 8l-9 5-9-5Z" />
      <path d="M3 13.5 12 18.5l9-5" />
    </svg>
  );
}

export function MaximizeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M8 3H4v4" />
      <path d="M16 3h4v4" />
      <path d="M8 21H4v-4" />
      <path d="M16 21h4v-4" />
    </svg>
  );
}

export function PauseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function StopIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

export function DownloadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function SignalIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="12" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
    </svg>
  );
}

export function UserMinusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M17 10h5" />
    </svg>
  );
}

export function BankIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M3 10l9-6 9 6" />
      <path d="M4 10v9" />
      <path d="M20 10v9" />
      <path d="M8 14v4" />
      <path d="M12 14v4" />
      <path d="M16 14v4" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function CreditCardIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h4" />
    </svg>
  );
}

export function ArrowUpRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function ArrowDownLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M17 7L7 17" />
      <path d="M16 17H7V8" />
    </svg>
  );
}

export function PaperclipIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M20.5 12.5l-8.4 8.4a5 5 0 0 1-7.1-7.1l9-9a3.5 3.5 0 0 1 5 5l-8.9 8.9a2 2 0 0 1-2.8-2.8l8.2-8.2" />
    </svg>
  );
}

export function MegaphoneIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l3.5 5v-16L6 9H5a2 2 0 0 0-2 2z" />
      <path d="M14 8.5a4 4 0 0 1 0 7" />
      <path d="M17.5 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

export function CopyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </svg>
  );
}

export function CheckCheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M2.5 12.5l4 4L15 8" />
      <path d="M9.5 12.5l4 4L22 8" />
    </svg>
  );
}

export function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </svg>
  );
}
