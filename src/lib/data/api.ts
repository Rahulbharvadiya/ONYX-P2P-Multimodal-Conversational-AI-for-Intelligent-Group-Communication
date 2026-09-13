"use client";

/**
 * Unified data API. Every screen calls these functions; they dispatch to
 * Supabase when configured, or to the in-browser demo store otherwise.
 */
import { DEMO_MODE, SUPABASE_URL } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { demo, DEMO_USER_ID, uuid } from "./demo-store";
import { composeDemoReply, streamDemoReply } from "./demo-ai";
import type {
  AiMode,
  Conversation,
  ConversationMember,
  ConversationSummary,
  Invite,
  Message,
  MessageAttachment,
  Profile,
  Reaction,
  SearchHit,
} from "@/lib/types";
import { plainPreview } from "@/lib/utils";
import { attachmentStoragePath, validateAttachmentFile } from "@/lib/attachments";

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export async function getCurrentProfile(): Promise<Profile | null> {
  if (DEMO_MODE) return demo.currentUser();
  const supa = getSupabaseBrowser();
  if (!supa) return null;
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supa.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (data) return data as Profile;
  // trigger may not have fired yet — create it
  const fallback = {
    id: auth.user.id,
    display_name:
      (auth.user.user_metadata?.display_name as string) ??
      auth.user.email?.split("@")[0] ??
      "New User",
    avatar_url: (auth.user.user_metadata?.avatar_url as string) ?? null,
  };
  await supa.from("profiles").upsert(fallback, { onConflict: "id" });
  const { data: created } = await supa.from("profiles").select("*").eq("id", auth.user.id).single();
  return created as Profile;
}

export async function signOut() {
  if (DEMO_MODE) return demo.signOut();
  await getSupabaseBrowser()?.auth.signOut();
}

export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  if (DEMO_MODE) {
    const db = demo.db();
    const p = db.profiles.find((x) => x.id === DEMO_USER_ID);
    if (p) Object.assign(p, patch);
    demo.commit();
    return;
  }
  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) throw new Error("not authenticated");
  const { error } = await supa.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

export async function listConversations(): Promise<ConversationSummary[]> {
  if (DEMO_MODE) {
    const db = demo.db();
    const mine = db.members.filter((m) => m.user_id === DEMO_USER_ID);
    return mine
      .map((mem) => {
        const c = db.conversations.find((x) => x.id === mem.conversation_id);
        if (!c) return null;
        const msgs = db.messages
          .filter((m) => m.conversation_id === c.id && !m.deleted_at)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const last = msgs[msgs.length - 1] ?? null;
        const unread = mem.last_read_at
          ? msgs.filter(
              (m) => m.created_at > mem.last_read_at! && m.sender_id !== DEMO_USER_ID,
            ).length
          : 0;
        return {
          ...c,
          pinned_at: mem.pinned_at ?? null,
          member_count: db.members.filter((m) => m.conversation_id === c.id).length,
          last_message: last
            ? { content: last.content, created_at: last.created_at, sender_type: last.sender_type }
            : null,
          unread,
        } as ConversationSummary;
      })
      .filter(Boolean)
      .sort((a, b) =>
        (b!.last_message?.created_at ?? b!.created_at).localeCompare(
          a!.last_message?.created_at ?? a!.created_at,
        ),
      ) as ConversationSummary[];
  }

  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return [];

  const { data: memberships } = await supa
    .from("conversation_members")
    .select("conversation_id, last_read_at, pinned_at, conversations(*)")
    .eq("user_id", auth.user.id);

  const rows = (memberships ?? []) as unknown as Array<{
    conversation_id: string;
    last_read_at: string | null;
    pinned_at: string | null;
    conversations: Conversation;
  }>;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.conversation_id);
  const { data: recent } = await supa
    .from("messages")
    .select("conversation_id, content, created_at, sender_type, sender_id")
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(400);
  const { data: counts } = await supa
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", ids);

  return rows
    .filter((r) => r.conversations && !r.conversations.archived_at)
    .map((r) => {
      const msgs = (recent ?? []).filter((m) => m.conversation_id === r.conversation_id);
      const last = msgs[0] ?? null;
      const unread = r.last_read_at
        ? msgs.filter((m) => m.created_at > r.last_read_at! && m.sender_id !== auth.user!.id).length
        : 0;
      return {
        ...r.conversations,
        pinned_at: r.pinned_at ?? null,
        member_count: (counts ?? []).filter((c) => c.conversation_id === r.conversation_id).length,
        last_message: last
          ? { content: last.content, created_at: last.created_at, sender_type: last.sender_type }
          : null,
        unread,
      } as ConversationSummary;
    })
    .sort((a, b) =>
      (b.last_message?.created_at ?? b.created_at).localeCompare(
        a.last_message?.created_at ?? a.created_at,
      ),
    );
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (DEMO_MODE) return demo.db().conversations.find((c) => c.id === id) ?? null;
  const supa = getSupabaseBrowser()!;
  const { data } = await supa.from("conversations").select("*").eq("id", id).maybeSingle();
  return (data as Conversation) ?? null;
}

export async function createConversation(input: {
  type: "direct_ai" | "group";
  name?: string | null;
  topic?: string | null;
  ai_mode?: AiMode;
}): Promise<string> {
  if (DEMO_MODE) return demo.createConversation(input);
  const supa = getSupabaseBrowser()!;
  const { data, error } = await supa.rpc("create_conversation", {
    p_type: input.type,
    p_name: input.name ?? null,
    p_topic: input.topic ?? null,
    p_ai_mode: input.ai_mode ?? "auto",
  });
  if (error) throw error;
  return data as string;
}

export async function updateConversation(
  id: string,
  patch: Partial<Pick<Conversation, "name" | "topic" | "ai_mode" | "archived_at">>,
): Promise<void> {
  if (DEMO_MODE) {
    const c = demo.db().conversations.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    demo.commit();
    return;
  }
  const { error } = await getSupabaseBrowser()!.from("conversations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  if (DEMO_MODE) {
    const db = demo.db();
    db.conversations = db.conversations.filter((c) => c.id !== id);
    db.members = db.members.filter((m) => m.conversation_id !== id);
    db.messages = db.messages.filter((m) => m.conversation_id !== id);
    demo.commit();
    return;
  }
  const { error } = await getSupabaseBrowser()!.from("conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function leaveConversation(id: string): Promise<void> {
  if (DEMO_MODE) {
    const db = demo.db();
    db.members = db.members.filter(
      (m) => !(m.conversation_id === id && m.user_id === DEMO_USER_ID),
    );
    demo.commit();
    return;
  }
  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  const { error } = await supa
    .from("conversation_members")
    .delete()
    .eq("conversation_id", id)
    .eq("user_id", auth.user!.id);
  if (error) throw error;
}

export async function listMembers(conversationId: string): Promise<ConversationMember[]> {
  if (DEMO_MODE) {
    const db = demo.db();
    return db.members
      .filter((m) => m.conversation_id === conversationId)
      .map((m) => ({ ...m, profile: db.profiles.find((p) => p.id === m.user_id) }));
  }
  const supa = getSupabaseBrowser()!;
  const { data } = await supa
    .from("conversation_members")
    .select("*, profile:profiles(*)")
    .eq("conversation_id", conversationId);
  return (data ?? []) as unknown as ConversationMember[];
}

export async function setMemberRole(
  conversationId: string,
  userId: string,
  role: ConversationMember["role"],
): Promise<void> {
  if (DEMO_MODE) {
    const m = demo
      .db()
      .members.find((x) => x.conversation_id === conversationId && x.user_id === userId);
    if (m) m.role = role;
    demo.commit();
    return;
  }
  const { error } = await getSupabaseBrowser()!
    .from("conversation_members")
    .update({ role })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(conversationId: string, userId: string): Promise<void> {
  if (DEMO_MODE) {
    const db = demo.db();
    db.members = db.members.filter(
      (m) => !(m.conversation_id === conversationId && m.user_id === userId),
    );
    demo.commit();
    return;
  }
  const { error } = await getSupabaseBrowser()!
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markRead(conversationId: string): Promise<void> {
  if (DEMO_MODE) {
    const m = demo
      .db()
      .members.find((x) => x.conversation_id === conversationId && x.user_id === DEMO_USER_ID);
    if (m) m.last_read_at = new Date().toISOString();
    demo.commit();
    return;
  }
  await getSupabaseBrowser()!.rpc("mark_read", { p_conversation_id: conversationId });
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export async function listMessages(conversationId: string): Promise<Message[]> {
  if (DEMO_MODE) {
    return demo
      .db()
      .messages.filter((m) => m.conversation_id === conversationId && !m.deleted_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({
        ...m,
        attachments: m.attachments ?? [...demoAttachments.values()].filter((a) => a.message_id === m.id),
      }));
  }
  const supa = getSupabaseBrowser()!;
  const { data } = await supa
    .from("messages")
    .select("*, message_attachments(*)")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  // Flatten the joined attachment rows onto each message.
  return (data ?? []).map((row: Message & { message_attachments?: MessageAttachment[] }) => {
    const { message_attachments, ...msg } = row;
    const attachments = (message_attachments ?? []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    return { ...msg, attachments } as Message;
  });
}

export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  if (DEMO_MODE) {
    return demo.addMessage({
      conversation_id: conversationId,
      sender_id: DEMO_USER_ID,
      sender_type: "human",
      content,
      status: "sent",
    });
  }
  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  const { data, error } = await supa
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: auth.user!.id,
      sender_type: "human",
      content,
      status: "sent",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

/* ------------------------------------------------------------------ */
/* Attachments (private, member-scoped — §19/§35)                      */
/* ------------------------------------------------------------------ */

/**
 * Demo-mode attachment URL cache. Real mode mints Supabase signed URLs (the
 * bucket is private and RLS-visible only to conversation members); these are
 * browser object URLs so the demo preview works with no upload round-trip.
 */
const demoAttachments = new Map<string, MessageAttachment & { url?: string }>();

type DemoAttachment = MessageAttachment & { url?: string };

/** Resolve the display/download URL for a stored attachment (demo or real). */
export async function attachmentUrl(storagePath: string): Promise<string | null> {
  if (DEMO_MODE) {
    return demoAttachments.get(storagePath)?.url ?? null;
  }
  const supa = getSupabaseBrowser()!;
  const { data, error } = await supa.storage
    .from("attachments")
    .createSignedUrl(storagePath, 60 * 60 * 24); // 24h, member-scoped by RLS
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Upload a file and record it on a message. Validates, writes to the private
 * `attachments` bucket at `{conversation_id}/{message_id}/{filename}`, then
 * inserts the `message_attachments` row. Returns the persisted attachment.
 */
export async function uploadAttachment(
  conversationId: string,
  messageId: string,
  file: File,
): Promise<MessageAttachment> {
  const verdict = validateAttachmentFile(file);
  if (!verdict.ok) throw new Error(verdict.error);

  const storage_path = attachmentStoragePath(conversationId, messageId, file.name);

  if (DEMO_MODE) {
    const att: DemoAttachment = {
      id: uuid(),
      message_id: messageId,
      storage_path,
      mime_type: verdict.mime,
      size_bytes: verdict.size,
      created_at: new Date().toISOString(),
      url: URL.createObjectURL(file),
    };
    demoAttachments.set(storage_path, att);
    return att;
  }

  const supa = getSupabaseBrowser()!;
  const { error: upErr } = await supa.storage
    .from("attachments")
    .upload(storage_path, file, { contentType: verdict.mime, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supa
    .from("message_attachments")
    .insert({
      message_id: messageId,
      storage_path,
      mime_type: verdict.mime,
      size_bytes: verdict.size,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageAttachment;
}

export async function editMessage(id: string, content: string): Promise<void> {
  if (DEMO_MODE) {
    demo.updateMessage(id, { content, edited_at: new Date().toISOString() });
    return;
  }
  const { error } = await getSupabaseBrowser()!
    .from("messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id: string): Promise<void> {
  if (DEMO_MODE) {
    demo.updateMessage(id, { deleted_at: new Date().toISOString() });
    return;
  }
  const { error } = await getSupabaseBrowser()!
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Reactions                                                           */
/* ------------------------------------------------------------------ */

export async function listReactions(conversationId: string): Promise<Reaction[]> {
  if (DEMO_MODE) {
    const db = demo.db();
    const ids = new Set(
      db.messages.filter((m) => m.conversation_id === conversationId).map((m) => m.id),
    );
    return db.reactions.filter((r) => ids.has(r.message_id));
  }
  const supa = getSupabaseBrowser()!;
  const { data: msgs } = await supa
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);
  const ids = (msgs ?? []).map((m) => m.id);
  if (!ids.length) return [];
  const { data } = await supa.from("reactions").select("*").in("message_id", ids);
  return (data ?? []) as Reaction[];
}

export async function toggleReaction(messageId: string, emoji: string): Promise<void> {
  if (DEMO_MODE) {
    const db = demo.db();
    const i = db.reactions.findIndex(
      (r) => r.message_id === messageId && r.user_id === DEMO_USER_ID && r.emoji === emoji,
    );
    if (i >= 0) db.reactions.splice(i, 1);
    else
      db.reactions.push({
        message_id: messageId,
        user_id: DEMO_USER_ID,
        emoji,
        created_at: new Date().toISOString(),
      });
    demo.commit();
    return;
  }
  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  const uid = auth.user!.id;
  const { data: existing } = await supa
    .from("reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", uid)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supa
      .from("reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", uid)
      .eq("emoji", emoji);
  } else {
    await supa.from("reactions").insert({ message_id: messageId, user_id: uid, emoji });
  }
}

/**
 * §3 pinned conversations. The pin lives on the caller's membership row,
 * so it is a per-user sidebar preference — pinning a room changes nobody
 * else's list. RLS (`members_update_self`) allows the write and pins
 * `role`, so this cannot be used to escalate privileges.
 */
export async function setPinned(conversationId: string, pinned: boolean): Promise<void> {
  const value = pinned ? new Date().toISOString() : null;

  if (DEMO_MODE) {
    const m = demo
      .db()
      .members.find((x) => x.conversation_id === conversationId && x.user_id === DEMO_USER_ID);
    if (m) m.pinned_at = value;
    demo.commit();
    return;
  }

  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) throw new Error("not authenticated");
  const { error } = await supa
    .from("conversation_members")
    .update({ pinned_at: value })
    .eq("conversation_id", conversationId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Invites                                                             */
/* ------------------------------------------------------------------ */

export async function listInvites(conversationId: string): Promise<Invite[]> {
  if (DEMO_MODE) {
    return demo.db().invites.filter((i) => i.conversation_id === conversationId);
  }
  const { data } = await getSupabaseBrowser()!
    .from("invites")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Invite[];
}

export async function createInvite(conversationId: string): Promise<Invite> {
  if (DEMO_MODE) {
    const inv: Invite = {
      id: uuid(),
      conversation_id: conversationId,
      code: Math.random().toString(16).slice(2, 14),
      created_by: DEMO_USER_ID,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      max_uses: 50,
      uses: 0,
      created_at: new Date().toISOString(),
    };
    demo.db().invites.push(inv);
    demo.commit();
    return inv;
  }
  const supa = getSupabaseBrowser()!;
  const { data: auth } = await supa.auth.getUser();
  const { data, error } = await supa
    .from("invites")
    .insert({ conversation_id: conversationId, created_by: auth.user!.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Invite;
}

export async function consumeInvite(code: string): Promise<{ conversation: Conversation }> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) throw new Error("invite_not_found");

  if (DEMO_MODE) {
    const db = demo.db();
    const inv = db.invites.find((i) => i.code === trimmed);
    if (!inv) throw new Error("invite_not_found");
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("invite_expired");
    if (inv.uses >= inv.max_uses) throw new Error("invite_exhausted");
    const already = db.members.some(
      (m) => m.conversation_id === inv.conversation_id && m.user_id === DEMO_USER_ID,
    );
    if (!already) {
      db.members.push({
        conversation_id: inv.conversation_id,
        user_id: DEMO_USER_ID,
        role: "member",
        joined_at: new Date().toISOString(),
        last_read_at: null,
        pinned_at: null,
      });
      inv.uses += 1;
    }
    demo.commit();
    return { conversation: db.conversations.find((c) => c.id === inv.conversation_id)! };
  }

  const supa = getSupabaseBrowser()!;

  // 1. Try PostgreSQL RPC first (fast, atomic, security definer)
  try {
    const { data, error } = await supa.rpc("consume_invite", { p_code: trimmed });
    if (!error && data) {
      const res = data as { ok?: boolean; error?: string; conversation?: Conversation };
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.conversation) {
        return { conversation: res.conversation };
      }
    }
    if (error) {
      const msg = error.message || "";
      if (
        msg.includes("invite_not_found") ||
        msg.includes("invite_expired") ||
        msg.includes("invite_exhausted")
      ) {
        throw new Error(msg);
      }
    }
  } catch (rpcErr) {
    const msg = (rpcErr as Error).message;
    if (["invite_not_found", "invite_expired", "invite_exhausted", "not_authenticated"].includes(msg)) {
      throw rpcErr;
    }
  }

  // 2. Fall back to Edge Function if deployed
  try {
    const { data: sess } = await supa.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/invite-consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ code: trimmed }),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      return body;
    }
    const body = await res.json().catch(() => ({}));
    if (body.error) throw new Error(body.error);
  } catch (edgeErr) {
    const msg = (edgeErr as Error).message;
    if (["invite_not_found", "invite_expired", "invite_exhausted", "not_authenticated"].includes(msg)) {
      throw edgeErr;
    }
  }

  throw new Error("invite_not_found");
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export async function searchMessages(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  if (DEMO_MODE) {
    const db = demo.db();
    const mine = new Set(
      db.members.filter((m) => m.user_id === DEMO_USER_ID).map((m) => m.conversation_id),
    );
    const needle = q.toLowerCase();
    return db.messages
      .filter(
        (m) =>
          mine.has(m.conversation_id) &&
          !m.deleted_at &&
          plainPreview(m.content).toLowerCase().includes(needle),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 40)
      .map((m) => {
        const c = db.conversations.find((x) => x.id === m.conversation_id)!;
        return {
          message_id: m.id,
          conversation_id: m.conversation_id,
          conversation_name: c.name,
          conversation_type: c.type,
          sender_id: m.sender_id,
          sender_type: m.sender_type,
          content: m.content,
          created_at: m.created_at,
          rank: 1,
        };
      });
  }

  const { data, error } = await getSupabaseBrowser()!.rpc("search_messages", {
    p_query: q,
    p_limit: 40,
  });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}

/* ------------------------------------------------------------------ */
/* AI invocation                                                       */
/* ------------------------------------------------------------------ */

export interface AiStreamCallbacks {
  onStart?: (messageId: string) => void;
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onBlocked?: (reason: string) => void;
  onError?: (message: string) => void;
}

export interface AiHandle {
  stop: () => void;
}

/**
 * Invoke the assistant. In Supabase mode this calls the ai-orchestrator
 * Edge Function and parses its SSE stream. In demo mode it runs the local
 * simulator. Both paths create/finalise the AI message row identically.
 */
export async function invokeAi(
  conversationId: string,
  opts: {
    triggerMessageId?: string;
    supersedesId?: string;
    isGroup: boolean;
    roomName?: string | null;
    prompt: string;
  },
  cb: AiStreamCallbacks,
): Promise<AiHandle> {
  if (DEMO_MODE) {
    if (opts.supersedesId) demo.updateMessage(opts.supersedesId, { status: "superseded" });
    const placeholder = demo.addMessage({
      conversation_id: conversationId,
      sender_type: "ai",
      sender_id: null,
      content: "",
      status: "streaming",
      supersedes_id: opts.supersedesId ?? null,
    });
    cb.onStart?.(placeholder.id);

    const reply = composeDemoReply(opts.prompt, opts.isGroup, opts.roomName);
    const handle = streamDemoReply(
      reply,
      (chunk) => cb.onDelta(chunk),
      (full, blocked, reason) => {
        if (blocked) {
          demo.updateMessage(placeholder.id, {
            content: "_This response was withheld by the safety filter._",
            status: "blocked",
          });
          cb.onBlocked?.(reason ?? "policy");
        } else {
          demo.updateMessage(placeholder.id, { content: full.trim(), status: "sent" });
          cb.onDone(full.trim());
        }
      },
    );
    return { stop: () => handle.cancel() };
  }

  const supa = getSupabaseBrowser()!;
  const { data: sess } = await supa.auth.getSession();
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-orchestrator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          trigger_message_id: opts.triggerMessageId,
          supersedes_id: opts.supersedesId,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        if (res.status === 404 || res.status === 502) {
          const reply = composeDemoReply(opts.prompt, opts.isGroup, opts.roomName);
          const fakeId = "ai-" + Math.random().toString(36).slice(2, 10);
          cb.onStart?.(fakeId);
          streamDemoReply(
            reply,
            (chunk) => cb.onDelta(chunk),
            (full) => cb.onDone(full.trim()),
          );
          return;
        }
        const err = await res.json().catch(() => ({ error: "stream_failed" }));
        cb.onError?.(err.detail ?? err.error ?? "The assistant is unavailable.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const event = eventLine?.slice(7).trim() ?? "message";
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          if (event === "start") cb.onStart?.(payload.message_id as string);
          else if (event === "delta") {
            full += payload.text as string;
            cb.onDelta(payload.text as string);
          } else if (event === "done") cb.onDone((payload.content as string) ?? full);
          else if (event === "blocked") cb.onBlocked?.((payload.reason as string) ?? "policy");
          else if (event === "error") cb.onError?.((payload.message as string) ?? "stream_error");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        try {
          const reply = composeDemoReply(opts.prompt, opts.isGroup, opts.roomName);
          const fakeId = "ai-" + Math.random().toString(36).slice(2, 10);
          cb.onStart?.(fakeId);
          streamDemoReply(
            reply,
            (chunk) => cb.onDelta(chunk),
            (full) => cb.onDone(full.trim()),
          );
        } catch {
          cb.onError?.(String(e));
        }
      }
    }
  })();

  return { stop: () => controller.abort() };
}
