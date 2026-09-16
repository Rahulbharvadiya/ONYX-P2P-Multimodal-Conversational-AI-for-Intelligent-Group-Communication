"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquareOff } from "lucide-react";
import { ChatView } from "@/components/chat/chat-view";
import { MessageListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { getConversation } from "@/lib/data/api";
import type { Conversation } from "@/lib/types";
import { tEnter } from "@/lib/motion";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading: sessionLoading } = useSession();
  const [conversation, setConversation] = React.useState<Conversation | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing">("loading");

  React.useEffect(() => {
    if (sessionLoading || !profile) return;
    let alive = true;
    setState("loading");
    void getConversation(id).then((c) => {
      if (!alive) return;
      if (c) {
        setConversation(c);
        setState("ready");
      } else {
        setState("missing");
      }
    });
    return () => {
      alive = false;
    };
  }, [id, profile, sessionLoading]);

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
          It may have been deleted, or you might not be a member. Ask for a fresh invite link if you
          think this is a mistake.
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
