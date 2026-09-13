"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createConversation } from "@/lib/data/api";
import type { AiMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const AI_MODES: Array<{ v: AiMode; label: string; body: string }> = [
  { v: "off", label: "Off", body: "Humans only. The assistant never posts." },
  { v: "mention_only", label: "Mention only", body: "Responds when someone writes @ai." },
  { v: "auto", label: "Auto", body: "Replies to every message. Best for small rooms." },
];

export function NewConversationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"direct_ai" | "group">("direct_ai");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [aiMode, setAiMode] = useState<AiMode>("mention_only");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setKind("direct_ai");
    setName("");
    setTopic("");
    setAiMode("mention_only");
    setError(null);
    setLoading(false);
  };

  const close = () => {
    onClose();
    setTimeout(reset, 260);
  };

  const create = async () => {
    if (kind === "group" && name.trim().length < 2) {
      setError("Give the room a name.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const id = await createConversation(
        kind === "group"
          ? { type: "group", name: name.trim(), topic: topic.trim() || null, ai_mode: aiMode }
          : { type: "direct_ai", ai_mode: "auto" },
      );
      onCreated?.();
      close();
      router.push(`/app/c/${id}`);
    } catch (e) {
      setLoading(false);
      toast.push({ kind: "error", title: "Couldn't create", description: String(e) });
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New conversation"
      description="A private thread with the assistant, or a room you can invite people to."
      className="overflow-hidden border-[--border]/70 bg-[--bg-elevated] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-[--bg-elevated]/85"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={create} loading={loading}>
            {kind === "group" ? "Create room" : "Start chat"}
          </Button>
        </>
      }
    >
      {/* ambient top sheen — purely decorative, non-interactive */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[--accent]/[0.06] to-transparent"
      />

      <div className="relative space-y-6">
        <div>
          <p className="mb-2 text-[13px] font-medium tracking-[-0.005em] text-[--fg]">
            What are you creating?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                v: "direct_ai" as const,
                icon: MessagesSquare,
                title: "Chat with AI",
                body: "Private, just you and the assistant.",
              },
              {
                v: "group" as const,
                icon: Users,
                title: "Group room",
                body: "Invite people; AI joins on your terms.",
              },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setKind(o.v)}
                className={cn(
                  "group relative overflow-hidden rounded-[--r-lg] border p-4 text-left transition-all duration-[--d-micro]",
                  kind === o.v
                    ? "border-[--accent]/60 bg-[--accent-subtle] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
                    : "border-[--border] hover:border-[--border-strong] hover:bg-[--bg-hover]",
                )}
              >
                <o.icon
                  className={cn(
                    "mb-2 h-5 w-5 transition-colors duration-[--d-micro]",
                    kind === o.v ? "text-[--accent-text]" : "text-[--fg-muted] group-hover:text-[--fg]",
                  )}
                />
                <p className="text-[13.5px] font-semibold text-[--fg]">{o.title}</p>
                <p className="mt-1 text-[12px] leading-snug text-[--fg-muted]">{o.body}</p>
              </button>
            ))}
          </div>
        </div>

        {kind === "group" && (
          <div className="space-y-5 rounded-[--r-lg] border border-[--border]/70 bg-[--bg-subtle]/40 p-4">
            <Field label="Room name" error={error} id="room-name">
              <Input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Launch war room"
                autoFocus
              />
            </Field>

            <Field
              label="Topic"
              hint="Optional — shapes how the assistant answers here."
              id="room-topic"
            >
              <Textarea
                id="room-topic"
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What this room is for"
              />
            </Field>

            <div>
              <p className="mb-2 text-[13px] font-medium tracking-[-0.005em] text-[--fg]">
                AI participation
              </p>
              <div className="space-y-1.5">
                {AI_MODES.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setAiMode(m.v)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[--r-md] border p-3 text-left transition-all duration-[--d-micro]",
                      aiMode === m.v
                        ? "border-[--accent]/60 bg-[--accent-subtle] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]"
                        : "border-[--border] hover:border-[--border-strong] hover:bg-[--bg-hover]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors duration-[--d-micro]",
                        aiMode === m.v ? "border-[--accent]" : "border-[--border-strong]",
                      )}
                    >
                      {aiMode === m.v && <span className="h-1.5 w-1.5 rounded-full bg-[--accent]" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-[--fg]">{m.label}</span>
                      <span className="block text-[12px] leading-snug text-[--fg-muted]">
                        {m.body}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}