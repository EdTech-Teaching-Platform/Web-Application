import { getNow, joinState, JOIN_OPEN_MINUTES } from "./liveJoin";

// Meeting provider helpers for live classes. Video calling and recording are
// handled by the educator's own meeting provider, so a live class only stores
// where to meet: { provider, link, meetingId, passcode }.
export const MEETING_PROVIDERS = [
  { key: "zoom", label: "Zoom", chip: "bg-pastel-blue text-pastel-blue-ink" },
  { key: "meet", label: "Google Meet", chip: "bg-pastel-sage text-pastel-sage-ink" },
  { key: "teams", label: "Microsoft Teams", chip: "bg-pastel-lavender text-pastel-lavender-ink" },
  { key: "other", label: "Other", chip: "bg-pastel-orange text-pastel-orange-ink" },
];

export function providerMeta(key) {
  return MEETING_PROVIDERS.find((p) => p.key === key) || MEETING_PROVIDERS[MEETING_PROVIDERS.length - 1];
}

export function emptyMeeting() {
  return { provider: "zoom", link: "", meetingId: "", passcode: "" };
}

// Returns an inline error message, or null when the link is a valid http(s) URL.
export function validateMeetingLink(value) {
  const v = (value || "").trim();
  if (!v) return "Meeting link is required.";
  let url;
  try {
    url = new URL(v);
  } catch {
    return "Enter a full link, e.g. https://zoom.us/j/123456789.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "The link must start with https://";
  if (!url.hostname.includes(".")) return "Enter a full link, e.g. https://zoom.us/j/123456789.";
  return null;
}

export function isMeetingValid(meeting) {
  return Boolean(meeting) && validateMeetingLink(meeting.link) === null;
}

// Normalised copy that is safe to store.
export function cleanMeeting(meeting) {
  return {
    provider: meeting.provider || "other",
    link: (meeting.link || "").trim(),
    meetingId: (meeting.meetingId || "").trim(),
    passcode: (meeting.passcode || "").trim(),
  };
}

export function meetingOf(session) {
  return session?.liveClass?.meeting || session?.meeting || null;
}

// Opens the session's external meeting link in a new tab. Returns false when
// the session has no valid link (caller shows its own message).
export function openMeetingLink(session) {
  const m = meetingOf(session);
  if (!m || validateMeetingLink(m.link) !== null) return false;
  window.open(m.link.trim(), "_blank", "noopener,noreferrer");
  return true;
}

// The one Join action for every entry point: respects the 30-minute unlock
// rule (liveJoin.joinState) and opens the external meeting link in a new tab.
// Returns { ok, message } so the caller can flash feedback when it did not open.
export function joinLiveSession(session, now = getNow()) {
  const js = joinState(session, now);
  if (js.state === "locked") return { ok: false, message: `Join opens ${JOIN_OPEN_MINUTES} minutes before the session.` };
  if (js.state === "ended") return { ok: false, message: js.reason };
  if (!openMeetingLink(session)) return { ok: false, message: "This session has no meeting link yet — add one with Edit." };
  return { ok: true, message: "" };
}
