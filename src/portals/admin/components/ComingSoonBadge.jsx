// Small "Coming soon" pill for admin controls that are shown but disabled
// (AI-assisted building, subjective question types). Reuses the shared
// status-badge style so it matches the rest of the admin portal.
export default function ComingSoonBadge({ label = "Coming soon", className = "" }) {
  return <span className={`ul-status-badge is-pending ul-coming-soon ${className}`.trim()}>{label}</span>;
}
