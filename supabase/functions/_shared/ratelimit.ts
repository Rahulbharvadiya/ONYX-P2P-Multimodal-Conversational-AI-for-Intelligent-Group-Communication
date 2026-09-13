import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.4";
import { HttpError } from "./supabase.ts";

export const LIMITS: Record<string, { max: number; windowSec: number }> = {
  messages_per_min: { max: 30, windowSec: 60 },
  ai_invocations_per_min: { max: 10, windowSec: 60 },
  invites_per_hour: { max: 20, windowSec: 3600 },
  moderation_checks_per_min: { max: 60, windowSec: 60 },
};

/**
 * Fixed-window counter persisted in `rate_limit_events`.
 * Atomic-enough: upsert on the unique (user_id, bucket, window_start) key,
 * then read the resulting count.
 */
export async function enforceRateLimit(
  admin: SupabaseClient,
  userId: string,
  bucket: keyof typeof LIMITS | string,
): Promise<void> {
  const cfg = LIMITS[bucket] ?? { max: 60, windowSec: 60 };
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (cfg.windowSec * 1000)) * cfg.windowSec * 1000);

  const { data: existing } = await admin
    .from("rate_limit_events")
    .select("id, count")
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("rate_limit_events").insert({
      user_id: userId,
      bucket,
      window_start: windowStart.toISOString(),
      count: 1,
    });
    // Unique violation => a concurrent request created it; fall through to increment.
    if (!error) return;
  }

  const next = (existing?.count ?? 1) + 1;
  if (next > cfg.max) {
    throw new HttpError(
      429,
      "rate_limited",
      `Limit of ${cfg.max} per ${cfg.windowSec}s exceeded for ${bucket}.`,
    );
  }

  await admin
    .from("rate_limit_events")
    .update({ count: next })
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .eq("window_start", windowStart.toISOString());
}
