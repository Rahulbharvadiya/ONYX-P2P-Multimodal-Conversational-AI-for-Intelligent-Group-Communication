import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.4";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

/**
 * service_role client — bypasses RLS. NEVER expose this key to the browser.
 * Used to write AI-authored messages, moderation events, usage logs.
 */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client bound to the caller's JWT — respects RLS. Used to verify identity. */
export function userClient(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "missing_authorization");
  }
  const supa = userClient(authHeader);
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "invalid_token");
  return { user: data.user, supa, authHeader };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, public detail?: string) {
    super(code);
  }
}
