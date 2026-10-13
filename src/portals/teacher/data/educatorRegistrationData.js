// Educator registration — shared constants, empty-entry factories and field
// configs for the UNIFIED registration flow (Registration.jsx).
//
// This file is the merge of the two flows that used to be separate:
//   * the old Registration wizard (Professional Info / Contact Info /
//     Your Objective / Verify), and
//   * the old post-approval Profile Setup form (photo, basic info, work
//     experience, education, certifications, volunteering, awards, grades
//     & subjects, specializations, languages, references, Discovery).
// Every option list and field config from both now lives here unchanged,
// so the form and the data model can't drift apart.

export const SUBJECT_AREAS = [
  "Mathematics",
  "Science",
  "English & Languages",
  "Computer Science",
  "Test Prep",
  "Music & Arts",
  "Other",
];

export const QUALIFICATIONS = ["Bachelor's Degree", "Master's Degree", "Doctorate (PhD)", "Teaching Diploma/Certificate", "Other"];
export const TEACHING_MODES = ["Online", "In-person", "Hybrid"];
export const OBJECTIVES = [
  "Get certified as a verified educator",
  "Increase visibility to students",
  "Attract more students",
  "Build trust with parents & students",
];
export const EMPLOYMENT_TYPES = ["Independent Educator", "Institution-affiliated", "Both"];
export const AGE_GROUPS = ["K–5", "6–8", "9–12", "College / Adult"];

// Common international dial codes — a short curated list rather than every
// ITU code, since this is a picker next to a phone field, not a full
// country directory (that lives in COUNTRY_STATE_MAP below).
export const DIAL_CODES = [
  { code: "+91", country: "India" },
  { code: "+1", country: "US/Canada" },
  { code: "+44", country: "UK" },
  { code: "+61", country: "Australia" },
  { code: "+971", country: "UAE" },
  { code: "+65", country: "Singapore" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+27", country: "South Africa" },
  { code: "+234", country: "Nigeria" },
  { code: "+92", country: "Pakistan" },
  { code: "+880", country: "Bangladesh" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+60", country: "Malaysia" },
  { code: "+63", country: "Philippines" },
];

// Country -> states/provinces, for the dependent Country/State dropdowns.
// "Other" keeps the flow open for anyone else with a free-text state field.
export const COUNTRY_STATE_MAP = {
  India: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi (NCT)", "Jammu & Kashmir", "Ladakh",
    "Puducherry", "Chandigarh",
  ],
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida",
    "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska",
    "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
    "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  Canada: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia",
    "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Northwest Territories", "Nunavut", "Yukon",
  ],
  Australia: [
    "New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania",
    "Australian Capital Territory", "Northern Territory",
  ],
  "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Fujairah", "Ras Al Khaimah"],
  Other: [],
};
export const COUNTRIES = Object.keys(COUNTRY_STATE_MAP);

// ---- Fields that came from the old Profile Setup form ---------------------

export const GRADES = [
  "Pre-K", "Kindergarten", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th",
  "College / Adult",
];

export const SUBJECTS = [
  "Mathematics",
  "Science",
  "English & Languages",
  "Computer Science",
  "Social Studies",
  "Test Prep",
  "Music & Arts",
  "Physical Education",
];

export const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Mandarin", "Arabic"];
export const PRONOUNS = ["He/Him", "She/Her", "They/Them", "Prefer not to say"];

export const SPECIALIZATIONS = [
  "Curriculum Design",
  "Special Education",
  "Exam Prep Coaching",
  "STEM Enrichment",
  "Early Childhood Education",
  "Gifted & Talented",
  "ESL / Language Support",
  "Career Counseling",
  "Classroom Technology",
  "Project-Based Learning",
];

export function uid() {
  return crypto.randomUUID();
}
export function emptyGradeRow() {
  return { id: uid(), grade: "", subjects: [] };
}
export function emptyWorkExperience() {
  return { id: uid(), jobTitle: "", employer: "", location: "", startDate: "", endDate: "", current: false, description: "" };
}
export function emptyEducation() {
  return { id: uid(), degree: "", institution: "", fieldOfStudy: "", startYear: "", endYear: "", gpa: "" };
}
export function emptyCertification() {
  return { id: uid(), name: "", issuingOrg: "", issueDate: "", expiryDate: "", credentialId: "" };
}
export function emptyVolunteering() {
  return { id: uid(), organization: "", role: "", cause: "", startDate: "", endDate: "", description: "" };
}
export function emptyAward() {
  return { id: uid(), title: "", issuer: "", year: "" };
}
export function emptyReference() {
  return { id: uid(), name: "", relationship: "", organization: "", email: "", phone: "" };
}

// Field configs for RepeatableEntryList — one per "career history" section.
export const WORK_FIELDS = [
  { key: "jobTitle", label: "Job title", placeholder: "e.g. Senior Math Teacher" },
  { key: "employer", label: "School / organization", placeholder: "e.g. Delhi Public School" },
  { key: "location", label: "Location", placeholder: "e.g. Bengaluru, India" },
  { key: "current", label: "I currently work here", type: "checkbox" },
  { key: "startDate", label: "Start date", type: "month" },
  { key: "endDate", label: "End date", type: "month", disabledWhen: (e) => e.current },
  { key: "description", label: "Responsibilities & impact", type: "textarea", span: "full", placeholder: "What did you teach, lead or achieve in this role?" },
];

export const EDUCATION_FIELDS = [
  { key: "degree", label: "Degree / qualification", placeholder: "e.g. Master of Education" },
  { key: "institution", label: "School / university", placeholder: "e.g. University of Delhi" },
  { key: "fieldOfStudy", label: "Field of study", placeholder: "e.g. Educational Psychology" },
  { key: "gpa", label: "GPA (optional)", type: "number", placeholder: "e.g. 3.8" },
  { key: "startYear", label: "Start year", placeholder: "e.g. 2015" },
  { key: "endYear", label: "End year", placeholder: "e.g. 2019" },
];

export const CERTIFICATION_FIELDS = [
  { key: "name", label: "Certification / license", placeholder: "e.g. State Teaching License" },
  { key: "issuingOrg", label: "Issuing organization", placeholder: "e.g. Board of Education" },
  { key: "issueDate", label: "Issue date", type: "month" },
  { key: "expiryDate", label: "Expiry date (optional)", type: "month" },
  { key: "credentialId", label: "Credential ID / URL (optional)", span: "full", placeholder: "Credential number or verification link" },
];

export const VOLUNTEER_FIELDS = [
  { key: "organization", label: "Organization", placeholder: "e.g. Teach For India" },
  { key: "role", label: "Role", placeholder: "e.g. Volunteer Tutor" },
  { key: "cause", label: "Cause area", placeholder: "e.g. Literacy, Youth Mentorship" },
  { key: "startDate", label: "Start date", type: "month" },
  { key: "endDate", label: "End date (optional)", type: "month" },
  { key: "description", label: "What did you do?", type: "textarea", span: "full", placeholder: "Briefly describe your involvement" },
];

export const AWARD_FIELDS = [
  { key: "title", label: "Award / recognition", placeholder: "e.g. Educator of the Year" },
  { key: "issuer", label: "Awarded by", placeholder: "e.g. State Education Board" },
  { key: "year", label: "Year", placeholder: "e.g. 2023" },
];

export const REFERENCE_FIELDS = [
  { key: "name", label: "Full name", placeholder: "e.g. Anjali Mehta" },
  { key: "relationship", label: "Relationship", placeholder: "e.g. Former Principal" },
  { key: "organization", label: "Organization", placeholder: "e.g. Delhi Public School" },
  { key: "email", label: "Email", placeholder: "name@example.com" },
  { key: "phone", label: "Phone", placeholder: "+1 (555) 987-6543" },
];

// Deterministic-looking educator ID: real generation belongs server-side
// once registration posts to teacherApi — this is a demo-friendly stand-in
// derived from the educator's name + current year, not a secure identifier.
export function generateEducatorId(fullName) {
  const digits = Array.from(fullName || "EDU")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    .toString()
    .padStart(6, "0")
    .slice(-6);
  return `UL-EDU-${new Date().getFullYear()}-${digits}`;
}

// The ONE merged form shape. Overlapping fields were deduplicated:
//   fullName   <- Registration "Full Name" + Registration contact "Name" +
//                 ProfileSetup "Full name"
//   headline   <- Registration "Professional Headline" + ProfileSetup headline
//   city       <- Registration "City" + ProfileSetup "City"
//   experience <- Registration "Years of Teaching Experience" + ProfileSetup
//                 "Total years of teaching experience" (kept required)
//   website    <- Registration "Portfolio / Website" + ProfileSetup "Portfolio"
// `references` (free-text, from the old Verify step) is kept as-is and the
// structured `referenceList` (from Profile Setup) sits alongside it.
// `password` / `confirmPassword` are new: neither old flow collected one,
// but an educator can now log in immediately after registering.
export function createInitialForm() {
  return {
    // Account & contact
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    dialCode: "+91",
    phone: "",
    altPhone: "",
    address: "",
    country: "",
    state: "",
    otherState: "",
    city: "",
    zipCode: "",
    // Teaching profile
    photo: null,
    headline: "",
    pronouns: "",
    bio: "",
    qualification: "",
    institution: "",
    experience: "",
    website: "",
    linkedin: "",
    primarySubject: "",
    additionalSubjects: [],
    teachingModes: [],
    gradeRows: [emptyGradeRow()],
    specializations: [],
    languages: [],
    listInDiscovery: true,
    // Career history
    workExperience: [emptyWorkExperience()],
    education: [emptyEducation()],
    certifications: [],
    volunteering: [],
    awards: [],
    referenceList: [emptyReference()],
    // Objective
    objectives: [],
    employmentType: "",
    ageGroups: [],
    // Verification documents
    govId: null,
    govIdStatus: "success",
    certificate: null,
    certificateStatus: "success",
    backgroundCheck: null,
    backgroundCheckStatus: "success",
    noBackgroundCheck: false,
    resume: null,
    references: "",
    acceptedTerms: false,
    acceptedPrivacy: false,
  };
}
