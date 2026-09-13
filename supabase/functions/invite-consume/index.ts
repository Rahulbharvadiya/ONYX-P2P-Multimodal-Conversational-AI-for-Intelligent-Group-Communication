// invite-consume — redeem an invite code and join the caller to the room.
// Runs with service_role because the client has no RLS path to read an
// invite for a conversation it isn't a member of yet.
import { preflight, json } from "../_shared/cors.ts";
import { requireUser, adminClient, HttpError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const { user } = await requireUser(req);
    const { code } = (await req.json()) as { code?: string };
    if (!code || typeof code !== "string") throw new HttpError(400, "code_required");

    const admin = adminClient();

    const { data: invite, error } = await admin
      .from("invites")
      .select("id, conversation_id, expires_at, max_uses, uses")
      .eq("code", code.trim().toLowerCase())
      .maybeSingle();

    // Postgres/PostgREST error text goes to the function logs, not the client:
    // it can name columns, constraints and the surrounding schema.
    if (error) {
      console.error("invite-consume: lookup_failed", error.message);
      throw new HttpError(500, "lookup_failed");
    }
    if (!invite) throw new HttpError(404, "invite_not_found");
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, "invite_expired");
    }
    if (invite.uses >= invite.max_uses) throw new HttpError(410, "invite_exhausted");

    // Already a member? Idempotent success.
    const { data: existing } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", invite.conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error: joinErr } = await admin.from("conversation_members").insert({
        conversation_id: invite.conversation_id,
        user_id: user.id,
        role: "member",
      });
      if (joinErr) {
        console.error("invite-consume: join_failed", joinErr.message);
        throw new HttpError(500, "join_failed");
      }

      await admin
        .from("invites")
        .update({ uses: invite.uses + 1 })
        .eq("id", invite.id);
    }

    const { data: conversation } = await admin
      .from("conversations")
      .select("id, name, type, topic")
      .eq("id", invite.conversation_id)
      .single();

    return json(req, { ok: true, conversation, already_member: Boolean(existing) });
  } catch (e) {
    if (e instanceof HttpError) {
      return json(req, { error: e.code, detail: e.detail ?? null }, e.status);
    }
    return json(req, { error: "internal_error" }, 500);
  }
});
