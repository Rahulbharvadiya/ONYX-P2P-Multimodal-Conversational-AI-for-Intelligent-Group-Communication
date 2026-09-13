import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.4";

export type Verdict = "pass" | "blocked" | "error_failed_closed";

export interface ModerationResult {
  verdict: Verdict;
  reason?: string;
}

/**
 * Deterministic, dependency-free baseline classifier.
 * Runs as the `pre` stage (user input) and `post` stage (model output).
 *
 * Policy: FAIL CLOSED. If an upstream classifier is configured and errors,
 * the verdict is `error_failed_closed` and the content is NOT published.
 */
const PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(kill|murder|shoot|behead)\s+(yourself|himself|herself|them|him|her)\b/i, reason: "violence_incitement" },
  { re: /\bhow\s+to\s+(make|build|synthesize)\s+(a\s+)?(bomb|explosive|nerve\s*agent|meth|ricin)\b/i, reason: "dangerous_instructions" },
  { re: /\b(child|minor|underage)\s+(porn|sexual|nude)/i, reason: "csam" },
  { re: /\b(suicide|self[-\s]?harm)\s+(method|instructions|how\s+to)\b/i, reason: "self_harm" },
  { re: /-----BEGIN\s+(RSA|OPENSSH|PRIVATE)\s+KEY-----/i, reason: "credential_leak" },
  { re: /\bsk-(ant|proj|live)-[A-Za-z0-9_-]{16,}\b/, reason: "credential_leak" },
];

const MAX_LEN = 32_000;

export function classify(text: string): ModerationResult {
  if (text.length > MAX_LEN) {
    return { verdict: "blocked", reason: "content_too_long" };
  }
  for (const { re, reason } of PATTERNS) {
    if (re.test(text)) return { verdict: "blocked", reason };
  }
  return { verdict: "pass" };
}

/** Optional external classifier hook (set MODERATION_WEBHOOK_URL to enable). */
export async function moderate(text: string): Promise<ModerationResult> {
  const local = classify(text);
  if (local.verdict !== "pass") return local;

  const url = Deno.env.get("MODERATION_WEBHOOK_URL");
  if (!url) return local;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("MODERATION_WEBHOOK_TOKEN") ?? ""}`,
      },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { verdict: "error_failed_closed", reason: `upstream_${res.status}` };
    const body = (await res.json()) as { flagged?: boolean; reason?: string };
    return body.flagged
      ? { verdict: "blocked", reason: body.reason ?? "upstream_flagged" }
      : { verdict: "pass" };
  } catch {
    // FAIL CLOSED
    return { verdict: "error_failed_closed", reason: "upstream_unreachable" };
  }
}

export async function logModeration(
  admin: SupabaseClient,
  messageId: string | null,
  stage: "pre" | "post",
  result: ModerationResult,
) {
  await admin.from("moderation_events").insert({
    message_id: messageId,
    stage,
    verdict: result.verdict,
    reason: result.reason ?? null,
  });
}
