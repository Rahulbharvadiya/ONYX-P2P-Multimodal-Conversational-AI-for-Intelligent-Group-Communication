/**
 * Client-side mirror of the Edge Function classifier
 * (supabase/functions/_shared/moderation.ts).
 *
 * This is a UX affordance only — it warns the user before they send.
 * It is NOT a security boundary: the authoritative check always runs
 * server-side in the Edge Function, which fails closed.
 */
export type Verdict = "pass" | "blocked" | "error_failed_closed";

const PATTERNS: Array<{ re: RegExp; reason: string; label: string }> = [
  {
    re: /\b(kill|murder|shoot|behead)\s+(yourself|himself|herself|them|him|her)\b/i,
    reason: "violence_incitement",
    label: "Violence or incitement",
  },
  {
    re: /\bhow\s+to\s+(make|build|synthesize)\s+(a\s+)?(bomb|explosive|nerve\s*agent|meth|ricin)\b/i,
    reason: "dangerous_instructions",
    label: "Dangerous instructions",
  },
  {
    re: /\b(child|minor|underage)\s+(porn|sexual|nude)/i,
    reason: "csam",
    label: "Prohibited sexual content",
  },
  {
    re: /\b(suicide|self[-\s]?harm)\s+(method|instructions|how\s+to)\b/i,
    reason: "self_harm",
    label: "Self-harm",
  },
  {
    re: /-----BEGIN\s+(RSA|OPENSSH|PRIVATE)\s+KEY-----/i,
    reason: "credential_leak",
    label: "Looks like a private key",
  },
  {
    re: /\bsk-(ant|proj|live)-[A-Za-z0-9_-]{16,}\b/,
    reason: "credential_leak",
    label: "Looks like an API key",
  },
];

export const MAX_MESSAGE_LENGTH = 32_000;

export function classifyLocal(text: string): { verdict: Verdict; reason?: string; label?: string } {
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { verdict: "blocked", reason: "content_too_long", label: "Message is too long" };
  }
  for (const p of PATTERNS) {
    if (p.re.test(text)) return { verdict: "blocked", reason: p.reason, label: p.label };
  }
  return { verdict: "pass" };
}
