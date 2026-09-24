import {
  CodeIcon,
  PiIcon,
  FlaskIcon,
  ChatIcon,
  MusicNoteIcon,
  PaletteIcon,
  BriefcaseIcon,
  GridIcon,
} from "../components/ui/icons";

export const ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
};

// Same 8-subject taxonomy as Student Onboarding's Interests step
// (src/portals/student/pages/onboarding/OnboardingInterests.jsx) — reused
// verbatim on the Landing page's category grid/chips and the Explore
// page's category filter, per the Discovery build spec, so the taxonomy
// stays consistent across the product instead of separate copies drifting
// apart.
//
// Flag carried over from the Landing Page build spec: the mockup's own
// category-grid tiles use different labels (Data Science, Marketing,
// Mathematics instead of Science/Business/Math, plus no "Other") — kept
// this existing shared list rather than the mockup's wording, per
// instruction, since Onboarding + Explore already ship with it live.
// Confirm with whoever owns the mockup whether the taxonomy itself should
// actually change before this diverges further from future mockups.
export const COURSE_CATEGORIES = [
  "Programming",
  "Math",
  "Science",
  "Languages",
  "Music",
  "Design",
  "Business",
  "Other",
];

// Icon + pastel tile tint per category, for the Landing page's "Find your
// subject." grid — kept next to the taxonomy it indexes rather than
// duplicated in the page file. Tints are the same rotation tokens used
// everywhere else (at low opacity, for a pastel/light-tint tile per
// design.md's tile spec) rather than new ad hoc pastel colors.
export const CATEGORY_META = {
  Programming: { icon: CodeIcon, tint: "bg-rotation-3/15", iconColor: "text-rotation-3" },
  Math: { icon: PiIcon, tint: "bg-rotation-4/15", iconColor: "text-rotation-4" },
  Science: { icon: FlaskIcon, tint: "bg-rotation-1/20", iconColor: "text-primary" },
  Languages: { icon: ChatIcon, tint: "bg-rotation-2/15", iconColor: "text-rotation-2" },
  Music: { icon: MusicNoteIcon, tint: "bg-rotation-4/15", iconColor: "text-rotation-4" },
  Design: { icon: PaletteIcon, tint: "bg-rotation-2/15", iconColor: "text-rotation-2" },
  Business: { icon: BriefcaseIcon, tint: "bg-rotation-3/15", iconColor: "text-rotation-3" },
  Other: { icon: GridIcon, tint: "bg-rotation-1/20", iconColor: "text-primary" },
};
