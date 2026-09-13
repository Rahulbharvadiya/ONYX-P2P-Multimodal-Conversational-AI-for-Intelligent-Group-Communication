export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/**
 * When Supabase credentials are absent the app runs in DEMO MODE:
 * an in-browser store with a simulated streaming assistant, so the full
 * UI is explorable without a backend. Every data call routes through
 * `src/lib/data/*`, which picks the real or demo implementation here.
 */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

export const DEMO_MODE = !isSupabaseConfigured;
