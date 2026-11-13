// Assign Educators form rules (QA, 13 Nov).
//   * validateAssignmentForm -> [{field, message}] so each field can show its
//     own message and the drawer can scroll to the first one.
//   * Test allocation: with N tests and several educators, every test has one
//     educator ("Test 1 -> ASHIKA, Test 2 -> Ravi"). By default the tests are
//     spread one per educator; the admin can change who builds which test.
//     The server gets [{educatorId, tests}] and creates one assignment per
//     educator with their share of the tests, questions and marks.

// allocation[i] = the educator id building test i+1.
export function defaultAllocation(testCount, educatorIds, previous = []) {
  const n = Math.max(0, Math.floor(Number(testCount) || 0));
  const ids = (educatorIds || []).filter(Boolean);
  if (!n || !ids.length) return [];
  const slots = Array.from({ length: n }, (_, i) => (ids.includes(previous[i]) ? previous[i] : null));
  const load = (id) => slots.filter((s) => s === id).length;
  // every educator gets a test when there are enough tests: take a slot from
  // whoever has the most
  for (const id of ids) {
    if (load(id) > 0) continue;
    const empty = slots.indexOf(null);
    if (empty !== -1) { slots[empty] = id; continue; }
    const busiest = ids.reduce((a, b) => (load(b) > load(a) ? b : a));
    if (load(busiest) > 1) slots[slots.lastIndexOf(busiest)] = id;
  }
  // fill the rest with the least-loaded educator
  for (let i = 0; i < n; i += 1) {
    if (slots[i]) continue;
    slots[i] = ids.reduce((a, b) => (load(b) < load(a) ? b : a));
  }
  return slots;
}

// [{educatorId, tests}] in selection order (educators with no test omitted).
export function allocationSummary(allocation, educatorIds) {
  return (educatorIds || [])
    .map((id) => ({ educatorId: id, tests: allocation.filter((s) => s === id).length }))
    .filter((a) => a.tests > 0);
}

// An educator's share of the questions / marks (as the server rounds them).
export function shareOf(total, tests, testCount) {
  const n = Number(testCount) || 0;
  if (!n || !(Number(total) > 0)) return 0;
  return Math.round((Number(total) * tests * 100) / n) / 100;
}

export function validateAssignmentForm(f, { mode = "create" } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (mode === "create" && f.seriesMode === "existing" && !f.seriesId) add("seriesId", "Select an existing test series, or switch to \"New series\".");
  if (mode === "create" && f.seriesMode === "new" && !String(f.newSeriesName || "").trim()) add("newSeriesName", "Enter a name for the new test series.");
  if (!String(f.subject || "").trim()) add("subject", "Subject is required.");
  if (!String(f.testName || "").trim()) add("testName", "Test / question paper name is required.");
  if (mode === "create" && (f.educatorIds || []).length === 0) add("educatorIds", "Select at least one educator.");
  const tests = Number(f.testCount);
  const testsOk = Number.isInteger(tests) && tests >= 1;
  if (!testsOk) add("testCount", "Number of tests must be a whole number of 1 or more.");
  if (mode === "create" && testsOk && (f.educatorIds || []).length > tests) {
    add("allocation", `You selected ${(f.educatorIds || []).length} educators for ${tests} test${tests === 1 ? "" : "s"}. Each educator needs at least one test: raise the number of tests or unselect an educator.`);
  }
  if (!f.questionCount || Number(f.questionCount) <= 0) add("questionCount", "Question count must be a positive number.");
  else if (testsOk && Number(f.questionCount) < tests) add("questionCount", "Question count must be at least the number of tests.");
  if (!f.totalMarks || Number(f.totalMarks) <= 0) add("totalMarks", "Total marks must be a positive number.");
  if (!f.duration || Number(f.duration) <= 0) add("duration", "Duration must be a positive number.");
  if (!f.deadline) add("deadline", "A deadline is required.");
  return errors;
}
