// Small browser-local store for student-facing prototype state. Keeping the
// key scoped to the signed-in learner avoids mixing demo activity when
// different accounts use the same browser.
const DEMO_ENROLLED_COURSE_IDS = ["c1", "c2", "c3", "c4"];

export function studentStorageId(userOrId) {
  const raw = typeof userOrId === "string"
    ? userOrId
    : userOrId?.identifier || userOrId?.id || userOrId?.name || "guest";
  return encodeURIComponent(String(raw).trim().toLowerCase() || "guest");
}

export function studentStorageKey(baseKey, userOrId) {
  return `${baseKey}:${studentStorageId(userOrId)}`;
}

function readEnrolledIds(userOrId) {
  try {
    const saved = JSON.parse(localStorage.getItem(studentStorageKey("ul_student_enrollments_v1", userOrId)) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function getStudentEnrolledCourseIds(userOrId) {
  return [...new Set([...DEMO_ENROLLED_COURSE_IDS, ...readEnrolledIds(userOrId)])];
}

export function isStudentCourseEnrolled(courseId, userOrId) {
  return getStudentEnrolledCourseIds(userOrId).includes(courseId);
}

export function enrollStudentInCourse(courseId, userOrId) {
  if (!courseId || !userOrId) return;
  const key = studentStorageKey("ul_student_enrollments_v1", userOrId);
  const ids = readEnrolledIds(userOrId);
  if (ids.includes(courseId)) return;
  try {
    localStorage.setItem(key, JSON.stringify([...ids, courseId]));
    window.dispatchEvent(new Event("ul-student-enrollments-changed"));
  } catch {
    // Keep the current checkout experience usable if browser storage is full.
  }
}
