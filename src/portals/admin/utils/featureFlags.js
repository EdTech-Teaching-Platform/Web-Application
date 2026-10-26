// Admin features that are visible but not available yet. Flip a flag only
// together with the backend it needs:
//  - AI_ENABLED: the ai-generate-test Edge Function and an AI provider key
//    (OPENAI_API_KEY). While false, no admin code path starts an AI job.
//  - SUBJECTIVE_ENABLED: a grading workflow for short / long / subjective
//    answers, and dropping the server guard in
//    supabase/migrations/20261027090000_admin_block_subjective.sql.
export const AI_ENABLED = false;
export const SUBJECTIVE_ENABLED = false;

export const AI_COMING_SOON = "AI-assisted building is coming soon. Build tests from scratch or import a CSV for now.";
