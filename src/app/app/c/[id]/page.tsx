"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquareOff } from "lucide-react";
import { ChatView } from "@/components/chat/chat-view";
import { MessageListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { getConversation, getConversationPreview, consumeInvite } from "@/lib/data/api";
import type { Conversation } from "@/lib/types";
import { tEnter } from "@/lib/motion";
import { useToast } from "@/components/ui/toast";
import { DoorOpen, Hash, Sparkles } from "lucide-react";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile, loading: sessionLoading } = useSession();
  const [conversation, setConversation] = React.useState<Conversation | null>(null);
  const [previewRoom, setPreviewRoom] = React.useState<Conversation | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "join_preview" | "missing">("loading");
  const [joining, setJoining] = React.useState(false);

  React.useEffect(() => {
    if (sessionLoading || !profile) return;
    let alive = true;
    setState("loading");
    void getConversation(id).then(async (c) => {
      if (!alive) return;
      if (c) {
        setConversation(c);
        setState("ready");
      } else {
        // Check if it's a joinable group room that the user isn't a member of yet
        const preview = await getConversationPreview(id);
        if (!alive) return;
        if (preview && preview.type === "group") {
          setPreviewRoom(preview);
          setState("join_preview");
        } else {
          setState("missing");
        }
      }
    });
    return () => {
      alive = false;
    };
  }, [id, profile, sessionLoading]);

  const handleJoinDirect = async () => {
    setJoining(true);
    try {
      const { conversation: joined } = await consumeInvite(id);
      setConversation(joined);
      setState("ready");
      toast.push({ kind: "success", title: `Joined ${joined.name ?? "the room"}` });
    } catch {
      toast.push({ kind: "error", title: "Couldn't join room", description: "Please ask for an invite link." });
    } finally {
      setJoining(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[--border] px-4">
          <div className="skeleton h-8 w-8 rounded-[--r-md]" />
          <div className="space-y-1.5">
            <div className="skeleton h-3 w-40 rounded" />
            <div className="skeleton h-2.5 w-24 rounded" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1">
          <MessageListSkeleton />
        </div>
      </div>
    );
  }

  if (state === "join_preview" && previewRoom) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tEnter(0.32)}
        className="flex h-full flex-col items-center justify-center px-6 text-center"
      >
        <div className="mx-auto max-w-md rounded-[16px] border border-[--border-color] bg-[--bg-surface] p-8 shadow-[0_12px_36px_-8px_rgba(0,0,0,0.1)]">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[--bg-subtle] text-[--text-primary] shadow-sm">
            <DoorOpen className="h-7 w-7" />
          </span>

          <div className="mb-2 flex items-center justify-center gap-2">
            <Hash className="h-4 w-4 text-[--text-muted]" />
            <h1 className="text-[20px] font-bold tracking-tight text-[--text-primary]">
              {previewRoom.name ?? "Group Room"}
            </h1>
          </div>

          {previewRoom.topic && (
            <p className="mt-1 text-[13.5px] leading-relaxed text-[--text-secondary]">
              {previewRoom.topic}
            </p>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[--text-muted]">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[--ai-badge-text]" />
              AI: {previewRoom.ai_mode}
            </span>
          </div>

          <p className="mt-5 text-[13px] text-[--text-secondary]">
            You are not a member of this group room yet. Join now to collaborate and view messages.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              onClick={handleJoinDirect}
              loading={joining}
              className="h-11 w-full justify-center bg-[--accent-black] text-[14px] font-semibold text-[--accent-foreground] hover:opacity-90"
            >
              Join Room Now
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/app")}
              className="text-[13px] text-[--text-secondary]"
            >
              Back to conversations
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (state === "missing" || !conversation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tEnter(0.32)}
        className="flex h-full flex-col items-center justify-center px-6 text-center"
      >
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-[--r-lg] bg-[--bg-active] text-[--fg-muted]">
          <MessageSquareOff className="h-6 w-6" />
        </span>
        <h2 className="text-[16px] font-semibold">Conversation not found</h2>
        <p className="mt-2 max-w-sm text-pretty text-[13.5px] leading-relaxed text-[--fg-muted]">
          It may have been deleted, or you might not have access. Ask for a fresh invite link or join from available rooms.
        </p>
        <Button className="mt-6" onClick={() => router.push("/app")}>
          Back to your conversations
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden">
      <ChatView conversation={conversation} />
    </div>
  );
}
