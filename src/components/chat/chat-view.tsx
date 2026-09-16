"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Check, Copy, Hash, Settings2, Sparkles, UserPlus, Users } from "lucide-react";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { RoomSettingsModal } from "./room-settings-modal";
import { StreamAnnouncer } from "./stream-announcer";
import { AiModeBadge } from "@/components/layout/sidebar";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MessageListSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { useNetworkStatus } from "@/components/network-provider";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  createInvite,
  deleteMessage,
  editMessage,
  invokeAi,
  listInvites,
  listMembers,
  listMessages,
  listReactions,
  markRead,
  postAiMessage,
  sendMessage,
  toggleReaction,
  uploadAttachment,
  type AiHandle,
} from "@/lib/data/api";
import type { Conversation, ConversationMember, Message, Reaction } from "@/lib/types";
import { conversationTitle, dayLabel, mentionsAi, shouldInvokeAi } from "@/lib/utils";
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
  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);
  const [activeInviteCode, setActiveInviteCode] = React.useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const aiHandle = React.useRef<AiHandle | null>(null);
  const isGroup = conversation.type === "group";
  const uid = profile?.id ?? "";

  const me = members.find((m) => m.user_id === uid);
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  const openInviteModal = React.useCallback(async () => {
    setInviteModalOpen(true);
    setLoadingInvite(true);
    try {
      const invs = await listInvites(conversation.id);
      if (invs.length > 0) {
        setActiveInviteCode(invs[0].code);
      } else {
        const newInv = await createInvite(conversation.id);
        setActiveInviteCode(newInv.code);
      }
    } catch {
      setActiveInviteCode(null);
    } finally {
      setLoadingInvite(false);
    }
  }, [conversation.id]);

  const copyInviteLink = async () => {
    const url = activeInviteCode
      ? `${window.location.origin}/join/${activeInviteCode}`
      : `${window.location.origin}/app/c/${conversation.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.push({ kind: "success", title: "Invite link copied to clipboard!" });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.push({ kind: "error", title: "Clipboard unavailable", description: url });
    }
  };

  const copyRoomCode = async () => {
    const codeToUse = activeInviteCode || conversation.id;
    try {
      await navigator.clipboard.writeText(codeToUse);
      setCopiedCode(true);
      toast.push({ kind: "success", title: "Join code copied to clipboard!" });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.push({ kind: "error", title: "Clipboard unavailable", description: codeToUse });
    }
  };

  /* ---------------- load ---------------- */
  const load = React.useCallback(async () => {
    const [msgs, mems, reacts] = await Promise.all([
      listMessages(conversation.id),
      listMembers(conversation.id),
      listReactions(conversation.id),
    ]);
    setMessages((prev) => {
      const unsavedAi = prev.filter(
        (m) =>
          m.sender_type === "ai" &&
          (m.content.trim().length > 0 || m.status === "streaming") &&
          !msgs.some((serverMsg) => serverMsg.id === m.id),
      );
      if (unsavedAi.length === 0) return msgs;
      const map = new Map<string, Message>();
      msgs.forEach((m) => map.set(m.id, m));
      unsavedAi.forEach((m) => {
        if (!map.has(m.id)) map.set(m.id, m);
      });
      return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
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
    if (atBottom) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [messages.length, streamText, atBottom, scrollToBottom]);

  React.useEffect(() => {
    if (!loading) {
      if (highlightId) {
        const el = document.getElementById(`msg-${highlightId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        requestAnimationFrame(() => scrollToBottom(false));
      }
    }
  }, [loading, highlightId, conversation.id, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  /* ---------------- derived ---------------- */
  const profilesById = React.useMemo(() => {
    const map = new Map<string, ConversationMember["profile"]>();
    members.forEach((m) => m.profile && map.set(m.user_id, m.profile));
    if (profile && !map.has(profile.id)) {
      map.set(profile.id, profile);
    }
    return map;
  }, [members, profile]);


  const profilesByIdRef = React.useRef(profilesById);
  const messagesRef = React.useRef<Message[]>([]);

  React.useEffect(() => {
    profilesByIdRef.current = profilesById;
  }, [profilesById]);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ---------------- AI ---------------- */
  const streamTextRef = React.useRef("");

  const runAi = React.useCallback(
    async (prompt: string, triggerId?: string, supersedesId?: string) => {
      const placeholderId = "ai-" + Date.now();
      streamTextRef.current = "";
      setStreamText("");
      setStreamingId(placeholderId);

      const placeholderMsg: Message = {
        id: placeholderId,
        conversation_id: conversation.id,
        sender_id: null,
        sender_type: "ai",
        content: "",
        content_format: "markdown",
        status: "streaming",
        trigger_message_id: triggerId ?? null,
        supersedes_id: supersedesId ?? null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      };

      setMessages((prev) => {
        const next = supersedesId ? prev.filter((m) => m.id !== supersedesId) : prev;
        return [...next, placeholderMsg];
      });

      // Extract recent history for multi-turn conversational context with author names
      const recentMessages = messagesRef.current.length > 0 ? messagesRef.current : messages;
      const myDisplayName = profile?.display_name || "You";
      const history = recentMessages
        .filter(
          (m) =>
            !m.deleted_at &&
            m.status !== "superseded" &&
            m.id !== placeholderId &&
            m.id !== supersedesId &&
            m.id !== triggerId,
        )
        .slice(-25)
        .map((m) => {
          const authorName =
            m.sender_type === "ai"
              ? "ONYX"
              : (m.sender_id ? profilesByIdRef.current.get(m.sender_id)?.display_name : undefined) ||
                (m.sender_id === uid ? myDisplayName : "Member");
          const authorPrefix = `[${authorName}]: `;
          return {
            role: m.sender_type === "ai" ? ("assistant" as const) : ("user" as const),
            content: `${authorPrefix}${m.content}`,
            name: authorName.replace(/[^a-zA-Z0-9_-]/g, ""),
          };
        });

      try {
        const handle = await invokeAi(
          conversation.id,
          {
            triggerMessageId: triggerId,
            supersedesId,
            isGroup,
            roomName: conversation.name,
            prompt,
            history,
          },
          {
            onStart: (_id) => {
              // placeholder already present in messages
            },
            onDelta: (chunk) => {
              streamTextRef.current += chunk;
              setStreamText((t) => t + chunk);
            },
            onDone: async (content?: string) => {
              const finalContent = (content || streamTextRef.current || "").trim();

              if (!finalContent) {
                setStreamingId(null);
                setStreamText("");
                streamTextRef.current = "";
                setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
                return;
              }

              // 1. Immediately stamp final content into the message in state so it NEVER flickers or disappears!
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? { ...m, content: finalContent, status: "sent" }
                    : m,
                ),
              );

              // 2. Clear streaming state now that message content is already displaying finalContent
              setStreamingId(null);
              setStreamText("");
              streamTextRef.current = "";

              // 3. Persist message to local storage & Supabase
              const aiMsg = await postAiMessage(
                conversation.id,
                finalContent,
                triggerId,
                supersedesId,
              );

              if (aiMsg && aiMsg.id !== placeholderId) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === placeholderId ? aiMsg : m)),
                );
              }
            },
            onBlocked: () => {
              setStreamingId(null);
              setStreamText("");
              streamTextRef.current = "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? {
                        ...m,
                        content: "_This response was withheld by the safety filter._",
                        status: "blocked",
                      }
                    : m,
                ),
              );
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
              streamTextRef.current = "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? { ...m, content: msg || "The assistant failed.", status: "error" }
                    : m,
                ),
              );
              toast.push({ kind: "error", title: "The assistant failed", description: msg });
              void load();
            },
          },
        );
        aiHandle.current = handle;
      } catch (err) {
        setStreamingId(null);
        setStreamText("");
        streamTextRef.current = "";
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        toast.push({
          kind: "error",
          title: "The assistant failed",
          description: String(err),
        });
      }
    },
    [conversation.id, conversation.name, isGroup, load, toast, profile, uid],
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
      const isDirectAi = conversation.type === "direct_ai";
      // Direct 1-on-1 AI chat: assistant responds directly.
      // Group rooms / team chats: assistant ONLY responds if explicitly tagged with @ai!
      const shouldTrigger = isDirectAi
        ? conversation.ai_mode !== "off"
        : conversation.ai_mode !== "off" && mentionsAi(text);
      if (shouldTrigger) {
        await runAi(text, msg.id);
      }
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't send", description: String(e) });
    }
  };

  const handleStop = () => {
    aiHandle.current?.stop();
    aiHandle.current = null;
    const partial = streamTextRef.current.trim();
    if (partial) {
      void postAiMessage(conversation.id, partial);
    }
    setStreamingId(null);
    setStreamText("");
    streamTextRef.current = "";
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


  const visible = React.useMemo(
    () => messages.filter((m) => !m.deleted_at && m.status !== "superseded"),
    [messages],
  );

  const title = conversationTitle(conversation);
  const canRegenerate = !streamingId;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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

        {isGroup && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 rounded-[8px] border border-[--border-color] bg-[--bg-surface] px-2.5 text-[12px] font-semibold text-[--text-primary] hover:bg-[--bg-subtle]"
            onClick={openInviteModal}
            aria-label="Invite to room"
          >
            <UserPlus className="h-3.5 w-3.5 text-[--text-secondary]" />
            <span className="hidden sm:inline">Invite</span>
          </Button>
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
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="custom-scrollbar h-full w-full scroll-smooth overflow-y-auto overscroll-contain px-2 pb-16 pt-2 sm:px-6"
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
      <div className="shrink-0">
        <Composer
          members={members}
          isGroup={isGroup}
          aiMode={conversation.ai_mode}
          streaming={Boolean(streamingId)}
          onSend={handleSend}
          onStop={handleStop}
          onTyping={handleTyping}
        />
      </div>

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

      {isGroup && (
        <Modal
          open={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          title={`Invite to ${conversation.name ?? "Room"}`}
          description="Share this code or link with others so they can join this room instantly."
          className="max-w-md overflow-hidden border-[--border-color] bg-[--bg-surface]"
        >
          <div className="space-y-4 pt-1">
            <div className="rounded-[10px] border border-[--border-color] bg-[--bg-subtle] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[--text-secondary]">Join Code:</span>
                <span className="font-mono text-[14px] font-bold tracking-wider text-[--text-primary]">
                  {loadingInvite ? "Generating..." : activeInviteCode || conversation.id.slice(0, 8)}
                </span>
              </div>
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copyRoomCode}
                  className="flex-1 justify-center gap-1.5 border border-[--border-color] bg-[--bg-surface] text-[12px]"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={copyInviteLink}
                  className="flex-1 justify-center gap-1.5 bg-[--accent-black] text-[--accent-foreground] text-[12px] font-semibold hover:opacity-90"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? "Copied" : "Copy Invite Link"}</span>
                </Button>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-[--text-secondary]">
              Anyone with this join code or link can join this group room directly without approval.
            </p>
          </div>
        </Modal>
      )}
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