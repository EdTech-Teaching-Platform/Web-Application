// How many tests an assignment asks for and how many the educator has built
// (educator_list_assignments / educator_get_assignment, 20261118090000).
// {required, created, published, remaining, tests} or null on an older server
// (no test_count in the answer).
export function assignmentTestProgress(a) {
  if (!a || a.test_count == null) return null;
  const required = Math.max(Number(a.test_count) || 1, 1);
  const created = Number(a.tests_created || 0);
  return {
    required, created,
    published: Number(a.tests_published || 0),
    remaining: Math.max(Number(a.tests_remaining ?? required - created), 0),
    tests: Array.isArray(a.tests) ? a.tests : [],
  };
}
