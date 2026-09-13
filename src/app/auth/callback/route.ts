import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Caller-supplied: never redirect off-origin (open redirect / phishing hop).
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supa = await getSupabaseServer();
    if (supa) {
      const { error } = await supa.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
