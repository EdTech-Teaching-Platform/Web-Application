// Steps shown while the wizard saves. "Publish now" is one RPC
// (upsert_test_series_full with p_publish = true): the server saves the
// questions, validates and publishes in one transaction, so nothing is kept
// unless every step succeeds.
export function saveSteps({ publish, scheduled, draftOnly }) {
  if (draftOnly) return ["Saving draft"];
  if (!publish) return ["Saving questions"];
  return ["Saving questions", "Validating", scheduled ? "Scheduling go-live" : "Publishing"];
}

// Messages raised by adm_publish_test_series / adm_set_series_availability.
const VALIDATION_ERROR = /has no questions|without a correct answer|Add at least one test|closing time must be after/i;

// Which step a failed save stopped at.
export function failedStepIndex(error, steps) {
  if (steps.length > 1 && VALIDATION_ERROR.test(error?.message || "")) return 1;
  return 0;
}

// An RPC error (it has a SQLSTATE code) means the server rolled everything
// back. Without a code the request never got an answer, so the save may have
// gone through.
export function saveErrorMessage(error) {
  if (error?.code) return `${error.message} Nothing was saved.`;
  return "The connection dropped before the server answered, so the series may or may not have been saved. Check the Test Series list before you retry.";
}
