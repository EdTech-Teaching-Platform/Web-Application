// Admin features that are visible but not available yet. Flip a flag only
// together with the backend it needs:
//  - AI_ENABLED: the ai-generate-test Edge Function and an AI provider key
//    (OPENAI_API_KEY). While false, no admin code path starts an AI job.
//  - SUBJECTIVE_ENABLED: short / long / subjective questions. On since
//    20261115090000_student_ai_evaluation.sql (server guard dropped; answers
//    are graded by AI through the evaluate-subjective Edge Function).
export const AI_ENABLED = false;
export const SUBJECTIVE_ENABLED = true;

export const AI_COMING_SOON = "AI-assisted building is coming soon. Build tests from scratch or import a CSV for now.";
