"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Hash, Settings2, Sparkles, Users } from "lucide-react";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { RoomSettingsModal } from "./room-settings-modal";
import { StreamAnnouncer } from "./stream-announcer";
import { AiModeBadge } from "@/components/layout/sidebar";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageListSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { useNetworkStatus } from "@/components/network-provider";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  deleteMessage,
  editMessage,
  invokeAi,
  listMembers,
  listMessages,
  listReactions,
  markRead,
  sendMessage,
  toggleReaction,
  uploadAttachment,
  type AiHandle,
} from "@/lib/data/api";
import type { Conversation, ConversationMember, Message, Reaction } from "@/lib/types";
import { conversationTitle, dayLabel, shouldInvokeAi } from "@/lib/utils";
import { computeReadReceipt } from "@/lib/read-receipts";
import { tEnter, tExit } from "@/lib/motion";

export function ChatView({ conversation: initial }: { conversation: Conversation }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { profile } = useSession();
  const { unavailable } = useNetworkStatus();
  const highlightId = params.get("m");

  const [conversation, setConversation] = React.useState(initial);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [members, setMembers] = React.useState<ConversationMember[]>([]);
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [streamingId, setStreamingId] = React.useState<string | null>(null);
  const [streamText, setStreamText] = React.useState("");
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const aiHandle = React.useRef<AiHandle | null>(null);
  const isGroup = conversation.type === "group";
  const uid = profile?.id ?? "";

  const me = members.find((m) => m.user_id === uid);
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  /* ---------------- load ---------------- */
  const load = React.useCallback(async () => {
    const [msgs, mems, reacts] = await Promise.all([
      listMessages(conversation.id),
      listMembers(conversation.id),
      listReactions(conversation.id),
    ]);
    setMessages(msgs);
    setMembers(mems);
    setReactions(reacts);
    setLoading(false);
  }, [conversation.id]);

  React.useEffect(() => {
    setLoading(true);
    void load();
    void markRead(conversation.id);
  }, [load, conversation.id]);

  React.useEffect(() => setConversation(initial), [initial]);

  /* ---------------- realtime ---------------- */
  React.useEffect(() => {
    if (DEMO_MODE) return demo.subscribe(() => void load());

    const supa = getSupabaseBrowser();
    if (!supa || !profile) return;

    const channel = supa
      .channel(`conv:${conversation.id}`, { config: { presence: { key: uid } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => {
            if (payload.eventType === "INSERT") {
              return prev.some((m) => m.id === row.id) ? prev : [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((m) => (m.id === row.id ? { ...m, ...row } : m));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as Message).id);
            }
            return prev;
          });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
        void listReactions(conversation.id).then(setReactions);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => {
        // Last-read timestamps (read receipts) live here — refresh when they change.
        void listMembers(conversation.id).then(setMembers);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { user_id, name } = payload as { user_id: string; name: string };
        if (user_id === profile.id) return;
        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
        setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== name)), 3200);
      })
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [conversation.id, profile, load]);

  /* ---------------- scroll ---------------- */
  const scrollToBottom = React.useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  React.useEffect(() => {
    if (atBottom) scrollToBottom(false);
  }, [messages.length, streamText, atBottom, scrollToBottom]);

  React.useEffect(() => {
    if (!loading && highlightId) {
      const el = document.getElementById(`msg-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  /* ---------------- AI ---------------- */
  const runAi = React.useCallback(
    async (prompt: string, triggerId?: string, supersedesId?: string) => {
      setStreamText("");
      const handle = await invokeAi(
        conversation.id,
        {
          triggerMessageId: triggerId,
          supersedesId,
          isGroup,
          roomName: conversation.name,
          prompt,
        },
        {
          onStart: (id) => {
            setStreamingId(id);
            if (DEMO_MODE) void load();
          },
          onDelta: (chunk) => setStreamText((t) => t + chunk),
          onDone: () => {
            setStreamingId(null);
            setStreamText("");
            void load();
          },
          onBlocked: () => {
            setStreamingId(null);
            setStreamText("");
            toast.push({
              kind: "warning",
              title: "Response withheld",
              description: "The answer didn't pass moderation.",
            });
            void load();
          },
          onError: (msg) => {
            setStreamingId(null);
            setStreamText("");
            toast.push({ kind: "error", title: "The assistant failed", description: msg });
            void load();
          },
        },
      );
      aiHandle.current = handle;
    },
    [conversation.id, conversation.name, isGroup, load, toast],
  );

  const handleSend = async (text: string, files: File[]) => {
    setAtBottom(true);
    // In real (Supabase) mode we must not pretend a message reached the server
    // while the connection is down. Demo mode is localStorage-backed, so a
    // send works offline — but we still tell the user they're offline.
    if (unavailable && !DEMO_MODE) {
      toast.push({
        kind: "warning",
        title: "You're offline",
        description: "Reconnect before sending — your message hasn't been sent yet.",
      });
      return;
    }
    try {
      const msg = await sendMessage(conversation.id, text);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      // Upload any attached files now that the message row exists.
      for (const file of files) {
        try {
          await uploadAttachment(conversation.id, msg.id, file);
        } catch (e) {
          toast.push({
            kind: "error",
            title: "Couldn't upload attachment",
            description: String(e),
          });
        }
      }
      if (files.length > 0) void load();
      if (shouldInvokeAi(text, conversation.ai_mode)) {
        await runAi(text, msg.id);
      }
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't send", description: String(e) });
    }
  };

  const handleStop = () => {
    aiHandle.current?.stop();
    aiHandle.current = null;
    setStreamingId(null);
    setStreamText("");
    void load();
  };

  const handleRegenerate = async (aiMessage: Message) => {
    const idx = messages.findIndex((m) => m.id === aiMessage.id);
    const prompt =
      [...messages.slice(0, idx)].reverse().find((m) => m.sender_type === "human")?.content ?? "";
    setAtBottom(true);
    await runAi(prompt, undefined, aiMessage.id);
  };

  const broadcastTyping = React.useRef(0);
  const handleTyping = () => {
    if (DEMO_MODE || !isGroup || !profile) return;
    const now = Date.now();
    if (now - broadcastTyping.current < 1800) return;
    broadcastTyping.current = now;
    void getSupabaseBrowser()
      ?.channel(`conv:${conversation.id}`)
      .send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: profile.id, name: profile.display_name },
      });
  };

  /* ---------------- derived ---------------- */
  const profilesById = React.useMemo(() => {
    const map = new Map<string, ConversationMember["profile"]>();
    members.forEach((m) => m.profile && map.set(m.user_id, m.profile));
    return map;
  }, [members]);

  const visible = React.useMemo(
    () => messages.filter((m) => !m.deleted_at && m.status !== "superseded"),
    [messages],
  );

  const title = conversationTitle(conversation);
  const canRegenerate = !streamingId;

  return (
    <div className="relative flex h-full flex-col">
      {/* ambient conversation atmosphere — extremely restrained, purely decorative */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-14rem] h-[26rem] w-[38rem] -translate-x-1/2 rounded-full opacity-[0.05] blur-[110px]"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }}
        />
        {!isGroup && (
          <div
            className="absolute bottom-[-12rem] right-[-6rem] h-[22rem] w-[26rem] rounded-full opacity-[0.05] blur-[110px]"
            style={{ background: "radial-gradient(circle, var(--ai-accent, var(--accent)), transparent 65%)" }}
          />
        )}
      </div>

      {/* ---------- header ----------
          A translucent tray rather than an opaque bar with a hard rule —
          it lets the ambient field behind the shell read through faintly
          while still separating the chrome from the message canvas via
          its own soft border + shadow (see .glass-subtle in globals.css). */}
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-[--border-color] bg-[--bg-surface] px-4 shadow-[0_1px_2px_rgba(18,18,20,0.03)]">
        {isGroup ? (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] border border-[--border-color] bg-[--bg-subtle] text-[--text-primary]">
            <Hash className="h-4 w-4" />
          </span>
        ) : (
          <AiAvatar size="sm" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span role="status" className="h-2 w-2 rounded-full bg-emerald-500 status-pulse shrink-0" aria-label="Online" />
            <h1 className="chat-header-title truncate text-[16px] font-[700] tracking-tight text-[--text-primary]">
              {title}
            </h1>
            <AiModeBadge mode={conversation.ai_mode} />
          </div>
          <p className="truncate text-[12px] font-normal text-[--text-secondary]">
            {isGroup
              ? conversation.topic ||
                `${members.length} member${members.length === 1 ? "" : "s"}`
              : "Private conversation with assistant (@ONYX)"}
          </p>
        </div>

        {isGroup && (
          <div className="hidden items-center -space-x-1.5 sm:flex">
            {members.slice(0, 4).map((m) => (
              <Avatar
                key={m.user_id}
                name={m.profile?.display_name ?? "?"}
                url={m.profile?.avatar_url}
                size="xs"
                className="ring-2 ring-[--bg]"
              />
            ))}
            {members.length > 4 && (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[--bg-active] text-[10px] font-semibold text-[--fg-muted] ring-2 ring-[--bg]">
                +{members.length - 4}
              </span>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="press-fluid"
          onClick={() => setSettingsOpen(true)}
          aria-label={isGroup ? "Room settings" : "Conversation settings"}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </header>

      {/* ---------- messages ---------- */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full scroll-smooth overflow-y-auto overscroll-contain px-2 pb-6 sm:px-6"
        >
          {loading ? (
            <MessageListSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState isGroup={isGroup} aiMode={conversation.ai_mode} />
          ) : (
            <div
              className="mx-auto max-w-4xl"
              role="log"
              aria-label={isGroup ? `Messages in ${title}` : "Conversation with the assistant"}
            >
              {visible.map((m, i) => {
                const prev = visible[i - 1];
                const newDay =
                  !prev ||
                  new Date(prev.created_at).toDateString() !==
                    new Date(m.created_at).toDateString();
                const showHeader =
                  newDay ||
                  !prev ||
                  prev.sender_id !== m.sender_id ||
                  prev.sender_type !== m.sender_type ||
                  new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() >
                    5 * 60_000;

                const isStreaming = m.id === streamingId;
                const content = isStreaming ? streamText : m.content;

                return (
                  <React.Fragment key={m.id}>
                    {newDay && (
                      <div className="sticky top-2 z-10 my-4 flex justify-center">
                        <span className="rounded-full border border-[--border]/70 bg-[--surface]/80 px-3 py-1 text-[11px] font-medium tracking-[-0.005em] text-[--fg-muted] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,var(--e1)] backdrop-blur-sm">
                          {dayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <MessageItem
                      message={{ ...m, content }}
                      author={
                        m.sender_id ? (profilesById.get(m.sender_id) ?? null) : null
                      }
                      isOwn={m.sender_id === uid}
                      isGroup={isGroup}
                      showHeader={showHeader}
                      streaming={isStreaming}
                      highlighted={m.id === highlightId}
                      currentUserId={uid}
                      canRegenerate={canRegenerate}
                      reactions={reactions.filter((r) => r.message_id === m.id)}
                      readReceipt={
                        isGroup && m.sender_type === "human" && m.sender_id === uid
                          ? computeReadReceipt(m, members, uid)
                          : null
                      }
                      onReact={async (emoji) => {
                        await toggleReaction(m.id, emoji);
                        setReactions(await listReactions(conversation.id));
                      }}
                      onEdit={async (content) => {
                        await editMessage(m.id, content);
                        void load();
                      }}
                      onDelete={async () => {
                        await deleteMessage(m.id);
                        void load();
                      }}
                      onRegenerate={() => handleRegenerate(m)}
                    />
                  </React.Fragment>
                );
              })}

              {/* typing indicator */}
              <AnimatePresence>
                {typingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: tExit() }}
                    transition={tEnter(0.2)}
                    className="mt-1 flex w-fit items-center gap-2 rounded-full border border-[--border]/60 bg-[--surface]/60 px-3 py-1.5 backdrop-blur-sm"
                  >
                    <div className="flex w-8 justify-center">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="typing-dot mx-px h-1.5 w-1.5 rounded-full bg-[--fg-subtle]"
                          style={{ animationDelay: `${d * 140}ms` }}
                        />
                      ))}
                    </div>
                    <span className="text-[12px] text-[--fg-muted]">
                      {typingUsers.slice(0, 2).join(" and ")}
                      {typingUsers.length > 2 ? ` and ${typingUsers.length - 2} more` : ""}{" "}
                      {typingUsers.length === 1 ? "is" : "are"} typing…
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-2" />
            </div>
          )}
        </div>

        {/* jump to latest */}
        <AnimatePresence>
          {!atBottom && !loading && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94, transition: tExit() }}
              transition={tEnter(0.2)}
              onClick={() => {
                setAtBottom(true);
                scrollToBottom();
              }}
              className="press-fluid absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[--border]/80 bg-[--surface-raised]/90 px-3.5 py-2 text-[12.5px] font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,var(--e3)] backdrop-blur-md transition-colors duration-[--d-micro] hover:border-[--border-strong] hover:bg-[--surface-raised]"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to latest
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* §10: batched aria-live announcements for streamed tokens */}
      <StreamAnnouncer text={streamText} active={Boolean(streamingId)} />

      {/* ---------- composer ---------- */}
      <Composer
        members={members}
        isGroup={isGroup}
        aiMode={conversation.ai_mode}
        streaming={Boolean(streamingId)}
        onSend={handleSend}
        onStop={handleStop}
        onTyping={handleTyping}
      />

      <RoomSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        conversation={conversation}
        members={members}
        isAdmin={Boolean(isAdmin)}
        currentUserId={uid}
        onChanged={async () => {
          await load();
          router.refresh();
        }}
        onLeft={() => router.push("/app")}
      />
    </div>
  );
}

function EmptyState({ isGroup, aiMode }: { isGroup: boolean; aiMode: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tEnter(0.32)}
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <span
        className={`mb-4 grid h-14 w-14 place-items-center rounded-[--r-lg] border border-[--border]/50 bg-[--accent-subtle] text-[--accent-text] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,var(--e2)] ${
          isGroup ? "" : "glow-ai"
        }`}
      >
        {isGroup ? <Users className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </span>
      <h2 className="text-[16px] font-semibold tracking-[-0.005em]">
        {isGroup ? "The room is quiet" : "What's on your mind?"}
      </h2>
      <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-[--fg-muted]">
        {isGroup
          ? aiMode === "off"
            ? "Say hello. The assistant is switched off here, so this is a human-only space."
            : aiMode === "mention_only"
              ? "Say hello, or write @ai when you want the assistant to weigh in."
              : "Say hello — the assistant replies to every message in this room."
          : "Ask a question, paste something to work through, or start with a half-formed thought. The assistant streams its answer as it writes."}
      </p>
    </motion.div>
  );
}