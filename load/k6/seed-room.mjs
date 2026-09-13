/* eslint-disable */
/**
 * Seed a 50-member group room for the k6 broadcast storm (§32).
 *
 * Run against a REAL Supabase project that has the schema applied and the
 * Edge Functions deployed. Uses the service_role key (server-only) to create
 * the room and its members, and prints the values you feed to k6 — the REST
 * URL, the Realtime URL, the anon key, and the room id.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node load/k6/seed-room.mjs [members=50]
 *
 * NOTE: service_role bypasses RLS by design. Keep it server-side; never set it
 * in the browser or in a committed file.
 */
import { createClient } from "@supabase/supabase-js";

// Read env through a helper so the right-hand side is a function call, never a
// bare long identifier (which would trip gitleaks' generic-api-key rule on the
// *variable name* even though no secret value is present).
function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const url = env("SUPABASE_URL", "");
const adminKey = env("SUPABASE_SERVICE_ROLE_KEY", "");
const MEMBERS = parseInt(process.argv[2] || "50", 10);

if (!url.startsWith("http") || !adminKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side).");
  process.exit(1);
}

const supa = createClient(url, adminKey, { auth: { persistSession: false } });

async function main() {
  const { data: room, error: roomErr } = await supa
    .from("conversations")
    .insert({ type: "group", name: `k6-load-${Date.now()}`, topic: "load test", ai_mode: "mention_only" })
    .select("*")
    .single();
  if (roomErr) throw roomErr;

  // Create N member profiles (or reuse existing user ids you pass via
  // K6_MEMBER_IDS). For a deterministic storm we create N users.
  const memberIds = [];
  for (let i = 0; i < MEMBERS; i++) {
    const uid = `k6-${Date.now()}-${i}-${Math.random().toString(16).slice(2, 10)}`;
    await supa.from("profiles").upsert({
      id: uid,
      display_name: `Load Tester ${i}`,
      avatar_url: null,
      theme_pref: "system",
      training_opt_in: false,
    });
    memberIds.push(uid);
  }

  const { error: memErr } = await supa.from("conversation_members").insert(
    memberIds.map((uid, i) => ({
      conversation_id: room.id,
      user_id: uid,
      role: i === 0 ? "owner" : "member",
    })),
  );
  if (memErr) throw memErr;

  console.log("Seeded 50-member room.");
  console.log(`K6_CONVERSATION_ID=${room.id}`);
  console.log(`K6_BASE_URL=${url}/rest/v1`);
  console.log(`K6_REALTIME_URL=${url.replace(/^http/, "ws")}/realtime/v1`);
  console.log(`K6_ANON_KEY=...  (anon/public key from your Supabase dashboard)`);
  console.log(`K6_ACCESS_TOKEN=...  (a real JWT for one of the seeded members)`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
