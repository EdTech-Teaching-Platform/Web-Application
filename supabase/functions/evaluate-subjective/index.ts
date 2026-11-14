// AI evaluation of a student's written answers (lead, 15 Nov 2026).
// POST { attemptId } from the student's report page (verify_jwt = true).
//   1. student_ai_eval_request (as the student): must own the attempt; claims
//      the job (one at a time, at most 3 tries). Not claimed -> returns the
//      current status (running / done / failed / not_needed).
//   2. Answers 202 at once; the rest runs in the background
//      (EdgeRuntime.waitUntil):
//      adm_ai_eval_context (service role): question, marks, model answer,
//      marking guide, the student's answer (no name or email)
//      -> OpenAI chat.completions with a strict JSON schema
//      -> normalizeEvaluation (marks clamped to 0..max, 0.5 steps)
//      -> adm_ai_eval_complete (service role): grades, score, report + AI section.
//      Any error -> adm_ai_eval_fail; the report page offers "Try again".
// Secrets: OPENAI_API_KEY (required), OPENAI_MODEL (optional, default gpt-4o-mini).
import { clients, fail, json, options, requireUser } from "../_shared/auth.ts";
import {
  DEFAULT_MODEL, EvalRequestError, OPENAI_TIMEOUT_MS, normalizeEvaluation, openAiRequestBody, parseOpenAiResponse, validateRequest,
} from "./evaluate.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

async function evaluate(admin: ReturnType<typeof clients>["admin"], attemptId: string) {
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;

    const { data: ctx, error: ctxError } = await admin.rpc("adm_ai_eval_context", { p_attempt_id: attemptId });
    if (ctxError) throw new Error(`context: ${ctxError.message}`);
    if (!ctx?.questions?.length) {
      const { error } = await admin.rpc("adm_ai_eval_complete", {
        p_attempt_id: attemptId, p_result: { questions: [], overall: {} }, p_model: null,
      });
      if (error) throw new Error(`save: ${error.message}`);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(openAiRequestBody(ctx, model)),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${payload?.error?.message ?? "request failed"}`);

    const parsed = parseOpenAiResponse(payload);
    const result = normalizeEvaluation(ctx, parsed.result);
    const { error } = await admin.rpc("adm_ai_eval_complete", {
      p_attempt_id: attemptId, p_result: result, p_model: parsed.model ?? model,
      p_input_tokens: parsed.usage.input, p_output_tokens: parsed.usage.output,
    });
    if (error) throw new Error(`save: ${error.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("evaluate-subjective", attemptId, message);
    await admin.rpc("adm_ai_eval_fail", { p_attempt_id: attemptId, p_error: message });
  }
}

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    await requireUser(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const { attemptId } = validateRequest(body);

    const { data: claim, error } = await userClient.rpc("student_ai_eval_request", { p_attempt_id: attemptId });
    if (error) return json({ error: error.message, code: error.code }, error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 400);
    if (!claim?.claimed) return json(claim ?? { status: "none" });

    const job = evaluate(admin, attemptId);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(job);
      return json({ status: "running" }, 202);
    }
    await job;
    return json({ status: "running" }, 202);
  } catch (error) {
    if (error instanceof EvalRequestError) return json({ error: error.message }, error.status);
    return fail(error);
  }
});
