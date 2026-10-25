import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRole } from "./roles.ts";

export { isAdminRole };

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function options(req: Request) {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export function clients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  return { userClient, admin: createClient(url, service), auth };
}

export async function requireUser(req: Request, client: SupabaseClient): Promise<User> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Authentication required");
  return data.user;
}

// admin and super_admin may use admin functions (mapped to the app role "admin").
export async function requireAdmin(req: Request, client: SupabaseClient) {
  const user = await requireUser(req, client);
  const { data, error } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (error || !isAdminRole(data?.role)) throw new Error("Admins only");
  return user;
}

// For server-to-server calls (cron / schedulers): the bearer token must be the
// service-role key itself.
export function requireServiceRole(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!service || token !== service) throw new Error("Authentication required");
}

export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // Only auth failures are 403; validation messages ("userId is required") stay 400.
  return json({ error: message }, /^(Authentication required|Admins only)$|forbidden/i.test(message) ? 403 : 400);
}

export async function hmacValid(req: Request, body: string, secretName: string) {
  const secret = Deno.env.get(secretName);
  const supplied = req.headers.get("x-webhook-signature");
  if (!secret || !supplied) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return supplied.replace(/^sha256=/, "") === expected;
}
