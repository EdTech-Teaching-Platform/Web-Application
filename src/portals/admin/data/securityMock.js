// Placeholder Admin security-center data. Replace with real calls through
// src/portals/admin/services/adminApi.js once the backend endpoints
// (Administration & Governance / Security & Access) are available.

export const mfaStatus = {
  enabled: true,
  method: "Authenticator app (TOTP)",
  phoneBackup: "+1 •••• •• 42",
  enrolledOn: "Mar 4, 2026",
  lastVerified: "Sep 22, 2026 · 09:14",
  backupCodesRemaining: 6,
  backupCodesTotal: 10,
};

export const passwordInfo = {
  lastChanged: "Jul 30, 2026",
  daysSinceChange: 54,
  strength: "Strong",
};

export const securityPolicyDefaults = {
  minPasswordLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
  passwordExpiryDays: 90,
  mfaRequiredForAdmins: true,
  sessionTimeoutMinutes: 30,
  maxFailedAttemptsBeforeLock: 5,
  lockoutDurationMinutes: 15,
  notifyOnNewDeviceLogin: true,
};

export const activeSessionSeeds = [
  {
    id: "SS-4471",
    device: "MacBook Pro 16\"",
    deviceType: "desktop",
    browser: "Chrome 128",
    os: "macOS Sonoma",
    location: "Bengaluru, IN",
    ip: "103.21.244.18",
    lastActive: "Active now",
    signedIn: "Sep 22, 2026 · 08:02",
    current: true,
  },
  {
    id: "SS-4468",
    device: "iPhone 15 Pro",
    deviceType: "mobile",
    browser: "Safari (App)",
    os: "iOS 18",
    location: "Bengaluru, IN",
    ip: "103.21.244.52",
    lastActive: "12 minutes ago",
    signedIn: "Sep 22, 2026 · 07:40",
    current: false,
  },
  {
    id: "SS-4451",
    device: "Windows Desktop",
    deviceType: "desktop",
    browser: "Edge 127",
    os: "Windows 11",
    location: "Pune, IN",
    ip: "49.36.88.201",
    lastActive: "Yesterday · 18:52",
    signedIn: "Sep 21, 2026 · 09:10",
    current: false,
  },
  {
    id: "SS-4439",
    device: "iPad Air",
    deviceType: "tablet",
    browser: "Safari 17",
    os: "iPadOS 17",
    location: "Mumbai, IN",
    ip: "117.99.12.7",
    lastActive: "Sep 19, 2026 · 21:04",
    signedIn: "Sep 19, 2026 · 20:31",
    current: false,
  },
];

export const loginActivitySeeds = [
  { id: "LG-8834", timestamp: "Sep 22, 2026 · 08:02", device: "MacBook Pro 16\"", location: "Bengaluru, IN", ip: "103.21.244.18", method: "Password + MFA", status: "Success" },
  { id: "LG-8833", timestamp: "Sep 22, 2026 · 07:40", device: "iPhone 15 Pro", location: "Bengaluru, IN", ip: "103.21.244.52", method: "Password + MFA", status: "Success" },
  { id: "LG-8829", timestamp: "Sep 21, 2026 · 09:10", device: "Windows Desktop", location: "Pune, IN", ip: "49.36.88.201", method: "Password + MFA", status: "Success" },
  { id: "LG-8825", timestamp: "Sep 20, 2026 · 23:47", device: "Unknown device", location: "Lagos, NG", ip: "197.210.55.9", method: "Password only", status: "Failed" },
  { id: "LG-8824", timestamp: "Sep 20, 2026 · 23:44", device: "Unknown device", location: "Lagos, NG", ip: "197.210.55.9", method: "Password only", status: "Failed" },
  { id: "LG-8819", timestamp: "Sep 19, 2026 · 20:31", device: "iPad Air", location: "Mumbai, IN", ip: "117.99.12.7", method: "Password + MFA", status: "Success" },
  { id: "LG-8811", timestamp: "Sep 18, 2026 · 14:12", device: "MacBook Pro 16\"", location: "Bengaluru, IN", ip: "103.21.244.18", method: "Password + MFA", status: "Success" },
];

export const failedAttemptSeeds = [
  { id: "FA-2291", timestamp: "Sep 20, 2026 · 23:47", account: "admin@universallearning.com", ip: "197.210.55.9", location: "Lagos, NG", reason: "Incorrect password", attemptNumber: 4 },
  { id: "FA-2290", timestamp: "Sep 20, 2026 · 23:44", account: "admin@universallearning.com", ip: "197.210.55.9", location: "Lagos, NG", reason: "Incorrect password", attemptNumber: 3 },
  { id: "FA-2276", timestamp: "Sep 17, 2026 · 03:12", account: "admin@universallearning.com", ip: "45.132.19.44", location: "Unknown", reason: "MFA challenge not completed", attemptNumber: 1 },
  { id: "FA-2251", timestamp: "Sep 12, 2026 · 11:05", account: "marcus.lee@universallearning.com", ip: "88.212.4.19", location: "Kyiv, UA", reason: "Incorrect password", attemptNumber: 2 },
];

export const securityAlertSeeds = [
  {
    id: "AL-SEC-118",
    severity: "high",
    title: "Repeated failed sign-ins from a new location",
    description: "4 failed password attempts from Lagos, NG (197.210.55.9) within 3 minutes — location not seen on this account before.",
    timestamp: "Sep 20, 2026 · 23:47",
    status: "New",
  },
  {
    id: "AL-SEC-113",
    severity: "medium",
    title: "MFA challenge abandoned",
    description: "A sign-in from an unrecognized IP (45.132.19.44) passed the password step but did not complete the MFA challenge.",
    timestamp: "Sep 17, 2026 · 03:12",
    status: "Acknowledged",
  },
  {
    id: "AL-SEC-107",
    severity: "low",
    title: "Backup codes running low",
    description: "Only 6 of 10 MFA backup codes remain. Regenerate a new set once you're below 3.",
    timestamp: "Sep 10, 2026 · 09:00",
    status: "Acknowledged",
  },
  {
    id: "AL-SEC-099",
    severity: "medium",
    title: "New device signed in",
    description: "iPad Air signed in from Mumbai, IN for the first time. Confirm this was you if unexpected.",
    timestamp: "Sep 19, 2026 · 20:31",
    status: "Resolved",
  },
];
