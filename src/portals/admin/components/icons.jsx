// Small inline icon set used across the Admin portal's chrome (sidebar,
// topbar) and dashboard. Kept local to this portal — promote to
// src/components if a second portal ends up needing icons too.

const base = (children, { size = 18, color = "currentColor", strokeWidth = 2 } = {}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const IconDashboard = (p) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>,
    p
  );

export const IconUsers = (p) =>
  base(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
    p
  );

export const IconTeach = (p) =>
  base(
    <>
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5Z" />
      <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </>,
    p
  );

export const IconCourse = (p) =>
  base(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>,
    p
  );

export const IconInstitution = (p) =>
  base(<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" />, p);

export const IconBranch = (p) =>
  base(
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M6 8.5V15.5M8.2 7.2 15.8 10.8M8.2 16.8 15.8 13.2" />
    </>,
    p
  );

export const IconLayers = (p) =>
  base(
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </>,
    p
  );

export const IconWallet = (p) =>
  base(
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>,
    p
  );

export const IconChart = (p) =>
  base(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>,
    p
  );

export const IconGlobe = (p) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>,
    p
  );

export const IconReport = (p) =>
  base(
    <>
      <path d="M9 12h6M9 16h6M9 8h6" />
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    </>,
    p
  );

export const IconShield = (p) =>
  base(<path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />, p);

export const IconFlag = (p) =>
  base(
    <>
      <path d="M5 21V4" />
      <path d="M5 5h11l-2 4 2 4H5" />
    </>,
    p
  );

export const IconHistory = (p) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>,
    p
  );

export const IconGear = (p) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.48.55.83 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>,
    p
  );

export const IconHelp = (p) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.75c0 1.5-2.15 1.85-2.4 3.25" />
      <path d="M12 17h.01" />
    </>,
    p
  );

export const IconSearch = (p) =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>,
    p
  );

export const IconBell = (p) =>
  base(
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>,
    p
  );

export const IconLock = (p) =>
  base(
    <>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
    p
  );

export const IconCheck = (p) => base(<path d="M20 6 9 17l-5-5" />, p);

export const IconAlert = (p) =>
  base(
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>,
    p
  );

export const IconChevronLeft = (p) => base(<path d="M15 18l-6-6 6-6" />, p);

export const IconChevronRight = (p) => base(<path d="M9 18l6-6-6-6" />, p);

export const IconPlus = (p) => base(<path d="M12 5v14M5 12h14" />, p);

export const IconMenu = (p) =>
  base(
    <>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </>,
    p
  );

export const IconClose = (p) => base(<path d="M18 6 6 18M6 6l12 12" />, p);
export const IconChevronDown = (p) => base(<path d="m6 9 6 6 6-6" />, p);

export const IconStar = (p) =>
  base(<path d="M12 2.5 15 9l7 1-5.2 4.9L18.2 22 12 18.3 5.8 22 7.2 14.9 2 10l7-1 3-6.5Z" />, p);

export const IconMore = (p) =>
  base(
    <>
      <circle cx="12" cy="5" r="1.4" fill={p?.color || "currentColor"} stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill={p?.color || "currentColor"} stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill={p?.color || "currentColor"} stroke="none" />
    </>,
    p
  );

export const IconEdit = (p) =>
  base(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
    p
  );

export const IconMail = (p) =>
  base(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 10 7 10-7" />
    </>,
    p
  );

export const IconPhone = (p) =>
  base(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />, p);

export const IconSend = (p) =>
  base(<path d="M22 2 11 13M22 2 15 22l-4-9-9-4Z" />, p);

export const IconDownload = (p) =>
  base(
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>,
    p
  );

export const IconUpload = (p) =>
  base(
    <>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </>,
    p
  );

export const IconRefresh = (p) =>
  base(
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </>,
    p
  );

export const IconLogout = (p) =>
  base(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>,
    p
  );

export const IconBook = (p) =>
  base(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z" />
      <path d="M4 19.5V6.5" />
      <path d="M8 8h8M8 11.5h5" />
    </>,
    p
  );

export const IconGraduationCap = (p) =>
  base(
    <>
      <path d="M2 9.5 12 5l10 4.5-10 4.5L2 9.5Z" />
      <path d="M6.5 11.5V16c0 1.2 2.46 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.5" />
      <path d="M21 9.5v5" />
    </>,
    p
  );

export const IconPencil = (p) =>
  base(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
    p
  );

export const IconCalculator = (p) =>
  base(
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M8 6.5h8" />
      <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" />
    </>,
    p
  );

export const IconAtom = (p) =>
  base(
    <>
      <circle cx="12" cy="12" r="1.4" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </>,
    p
  );

export const IconLightbulb = (p) =>
  base(
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6.5 6.5 0 0 0-3.9 11.7c.6.45 1 1.15 1 1.95V17h5.8v-.35c0-.8.4-1.5 1-1.95A6.5 6.5 0 0 0 12 3Z" />
    </>,
    p
  );

export const IconEye = (p) =>
  base(
    <>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>,
    p
  );

export const IconEyeOff = (p) =>
  base(
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 3.9M6.6 6.7C3.6 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.27 3.86-.73" />
      <path d="M9.5 9.7a3.2 3.2 0 0 0 4.6 4.5" />
    </>,
    p
  );

export const IconSun = (p) =>
  base(
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </>,
    p
  );

export const IconMoon = (p) =>
  base(
    <path d="M20.5 14.7A8.5 8.5 0 1 1 9.3 3.5a7 7 0 0 0 11.2 11.2Z" />,
    p
  );
