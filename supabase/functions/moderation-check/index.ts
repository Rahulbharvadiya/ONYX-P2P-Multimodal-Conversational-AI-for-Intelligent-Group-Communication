// moderation-check — standalone classifier endpoint.
// Lets the client pre-flight text (e.g. draft warnings) without ever
// touching the AI provider key. Same policy as the orchestrator: fail closed.
import { preflight, json } from "../_shared/cors.ts";
import { requireUser, adminClient, HttpError } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { moderate } from "../_shared/moderation.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const { user } = await requireUser(req);
    const { text, stage } = (await req.json()) as { text?: string; stage?: "pre" | "post" };
    if (typeof text !== "string") throw new HttpError(400, "text_required");

    // This endpoint is reachable with nothing but a valid session, so it is
    // its own abuse surface (each call may hit a paid upstream classifier).
    await enforceRateLimit(adminClient(), user.id, "moderation_checks_per_min");

    const result = await moderate(text);
    return json(req, {
      stage: stage ?? "pre",
      verdict: result.verdict,
      reason: result.reason ?? null,
      allowed: result.verdict === "pass",
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return json(req, { error: e.code, detail: e.detail ?? null }, e.status);
    }
    return json(req, { error: "internal_error" }, 500);
  }
});
