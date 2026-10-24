import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient, admin } = clients(req); const user = await requireAdmin(req, userClient);
    const input = await req.json(); const { data: job, error } = await admin.from("ai_test_jobs").insert({ ...input, requested_by: user.id, status: "queued" }).select().single();
    if (error) throw error;
    const apiKey = Deno.env.get("OPENAI_API_KEY"); if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "system", content: "Generate a test structure and questions as valid JSON. Return {structure,questions}." }, { role: "user", content: JSON.stringify(input) }] }) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "AI provider failed");
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    await admin.from("ai_test_jobs").update({ status: "completed", structure: parsed.structure ?? parsed, model: payload.model, output_tokens: payload.usage?.completion_tokens ?? 0, completed_at: new Date().toISOString() }).eq("id", job.id);
    return json({ ...job, status: "completed", structure: parsed.structure ?? parsed, questions: parsed.questions ?? [] });
  } catch (error) { return fail(error); }
});
