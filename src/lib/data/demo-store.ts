"use client";

/**
 * DEMO MODE store — an in-browser stand-in for Supabase, persisted to
 * localStorage. Mirrors the schema in supabase_schema.sql 1:1 so the UI
 * code is identical in both modes. Includes a simulated streaming
 * assistant so the chat surface (streaming, stop, regenerate, moderation
 * verdicts) can be exercised without a backend.
 */
import type {
  AiMode,
  Conversation,
  ConversationMember,
  ConversationType,
  Invite,
  Message,
  Profile,
  Reaction,
} from "@/lib/types";

const KEY = "aichat.demo.v2";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
const BOT_MEMBERS: Array<{ id: string; name: string }> = [
  { id: "22222222-2222-4222-8222-222222222222", name: "Priya Raman" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Marcus Webb" },
];

interface DB {
  profiles: Profile[];
  conversations: Conversation[];
  members: ConversationMember[];
  messages: Message[];
  reactions: Reaction[];
  invites: Invite[];
  session: { userId: string } | null;
  onboarded: boolean;
}

const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function profile(id: string, name: string): Profile {
  return {
    id,
    display_name: name,
    avatar_url: null,
    theme_pref: "system",
    training_opt_in: false,
    created_at: ago(60 * 24 * 30),
    updated_at: now(),
  };
}

function seed(): DB {
  const roomId = uuid();
  const directId = uuid();

  const db: DB = {
    profiles: [
      profile(DEMO_USER_ID, "You"),
      ...BOT_MEMBERS.map((b) => profile(b.id, b.name)),
    ],
    conversations: [
      {
        id: directId,
        type: "direct_ai",
        name: null,
        topic: null,
        ai_mode: "auto",
        created_by: DEMO_USER_ID,
        created_at: ago(180),
        archived_at: null,
      },
      {
        id: roomId,
        type: "group",
        name: "Launch war room",
        topic: "Shipping v2.0 — design, backend, and the go/no-go call",
        ai_mode: "mention_only",
        created_by: DEMO_USER_ID,
        created_at: ago(240),
        archived_at: null,
      },
    ],
    members: [
      {
        conversation_id: directId,
        user_id: DEMO_USER_ID,
        role: "owner",
        joined_at: ago(180),
        last_read_at: now(),
        pinned_at: null,
      },
      {
        conversation_id: roomId,
        user_id: DEMO_USER_ID,
        role: "owner",
        joined_at: ago(240),
        last_read_at: ago(30),
        pinned_at: null,
      },
      ...BOT_MEMBERS.map((b, i) => ({
        conversation_id: roomId,
        user_id: b.id,
        role: (i === 0 ? "admin" : "member") as ConversationMember["role"],
        joined_at: ago(230 - i * 10),
        last_read_at: ago(5),
        pinned_at: null,
      })),
    ],
    messages: [
      {
        id: uuid(),
        conversation_id: directId,
        sender_id: DEMO_USER_ID,
        sender_type: "human",
        content: "Explain row level security like I have to ship tonight.",
        content_format: "markdown",
        status: "sent",
        supersedes_id: null,
        created_at: ago(175),
        edited_at: null,
        deleted_at: null,
      },
      {
        id: uuid(),
        conversation_id: directId,
        sender_id: null,
        sender_type: "ai",
        content:
          "**RLS in one breath:** Postgres checks a boolean expression on every row, for every query, per role.\n\n- `USING` guards what rows you can *read* / *update-target*.\n- `WITH CHECK` guards what rows you're allowed to *write*.\n- Enable it per table, then add policies. Enabled with **zero** policies = nothing is visible to `anon`/`authenticated`, which is exactly how the audit tables here stay service-role-only.\n\nShipping tonight? Verify one thing: every table shows the shield icon in the Table Editor.",
        content_format: "markdown",
        status: "sent",
        supersedes_id: null,
        created_at: ago(174),
        edited_at: null,
        deleted_at: null,
      },
      {
        id: uuid(),
        conversation_id: roomId,
        sender_id: BOT_MEMBERS[0].id,
        sender_type: "human",
        content: "Schema's applied on staging. Storage buckets came over clean.",
        content_format: "markdown",
        status: "sent",
        supersedes_id: null,
        created_at: ago(48),
        edited_at: null,
        deleted_at: null,
      },
      {
        id: uuid(),
        conversation_id: roomId,
        sender_id: BOT_MEMBERS[1].id,
        sender_type: "human",
        content: "Nice. Only open item on my side is the streaming placeholder row — does everyone in the room see the same stream?",
        content_format: "markdown",
        status: "sent",
        supersedes_id: null,
        created_at: ago(41),
        edited_at: null,
        deleted_at: null,
      },
      {
        id: uuid(),
        conversation_id: roomId,
        sender_id: DEMO_USER_ID,
        sender_type: "human",
        content: "@ai summarise where we landed and what's left before the go/no-go.",
        content_format: "markdown",
        status: "sent",
        supersedes_id: null,
        created_at: ago(36),
        edited_at: null,
        deleted_at: null,
      },
      {
        id: uuid(),
        conversation_id: roomId,
        sender_id: null,
        sender_type: "ai",
        content:
          "**Where you landed**\n\n1. Staging schema applied, storage buckets verified (Priya).\n2. Group streaming answered: yes — the orchestrator writes one placeholder row with `status: 'streaming'` and updates it, so every member follows the same stream over `postgres_changes`.\n\n**Left before go/no-go**\n\n- Marcus: confirm the placeholder reconciles if a client disconnects mid-stream.\n- Someone owns a rate-limit smoke test (`ai_invocations_per_min` is 10).\n- Flip `ai_mode` for this room from `mention_only` to whatever you want in prod.",
        content_format: "markdown",
        status: "sent",
        supersedes_id: null,
        created_at: ago(35),
        edited_at: null,
        deleted_at: null,
      },
    ],
    reactions: [],
    invites: [],
    session: null,
    onboarded: false,
  };
  return db;
}

let memory: DB | null = null;
const listeners = new Set<() => void>();

function load(): DB {
  if (memory) return memory;
  if (typeof window === "undefined") return (memory = seed());
  try {
    const raw = window.localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as DB) : seed();
  } catch {
    memory = seed();
  }
  return memory!;
}

function save() {
  if (typeof window === "undefined" || !memory) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* quota — non-fatal in demo mode */
  }
  listeners.forEach((l) => l());
}

export const demo = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  db: load,
  commit: save,
  reset() {
    memory = seed();
    save();
  },

  /* ---- auth ---- */
  signIn(displayName?: string) {
    const db = load();
    db.session = { userId: DEMO_USER_ID };
    if (displayName) {
      const p = db.profiles.find((x) => x.id === DEMO_USER_ID);
      if (p) p.display_name = displayName;
    }
    save();
  },
  signOut() {
    const db = load();
    db.session = null;
    save();
  },
  currentUser(): Profile | null {
    const db = load();
    if (!db.session) return null;
    return db.profiles.find((p) => p.id === db.session!.userId) ?? null;
  },

  /* ---- conversations ---- */
  createConversation(input: {
    type: ConversationType;
    name?: string | null;
    topic?: string | null;
    ai_mode?: AiMode;
  }): string {
    const db = load();
    const id = uuid();
    db.conversations.push({
      id,
      type: input.type,
      name: input.name ?? null,
      topic: input.topic ?? null,
      ai_mode: input.type === "direct_ai" ? "auto" : (input.ai_mode ?? "auto"),
      created_by: DEMO_USER_ID,
      created_at: now(),
      archived_at: null,
    });
    db.members.push({
      conversation_id: id,
      user_id: DEMO_USER_ID,
      role: "owner",
      joined_at: now(),
      last_read_at: now(),
      pinned_at: null,
    });
    save();
    return id;
  },

  addMessage(m: Partial<Message> & { conversation_id: string }): Message {
    const db = load();
    const msg: Message = {
      id: m.id ?? uuid(),
      conversation_id: m.conversation_id,
      sender_id: m.sender_id ?? null,
      sender_type: m.sender_type ?? "human",
      content: m.content ?? "",
      content_format: "markdown",
      status: m.status ?? "sent",
      supersedes_id: m.supersedes_id ?? null,
      created_at: m.created_at ?? now(),
      edited_at: null,
      deleted_at: null,
    };
    db.messages.push(msg);
    save();
    return msg;
  },

  updateMessage(id: string, patch: Partial<Message>) {
    const db = load();
    const m = db.messages.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
    save();
  },
};
