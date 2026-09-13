"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { consumeInvite } from "@/lib/data/api";

const MESSAGES: Record<string, string> = {
  invite_not_found: "That code doesn't match any invite.",
  invite_expired: "That invite has expired.",
  invite_exhausted: "That invite has reached its use limit.",
};

export function JoinModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setCode("");
      setError(null);
      setLoading(false);
    }, 260);
  };

  const join = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Paste an invite code or link.");
      return;
    }
    // accept a full URL as well as a bare code
    const parsed = trimmed.includes("/join/")
      ? trimmed.split("/join/").pop()!.split(/[?#]/)[0]
      : trimmed;

    setError(null);
    setLoading(true);
    try {
      const { conversation } = await consumeInvite(parsed);
      onJoined?.();
      close();
      toast.push({ kind: "success", title: `Joined ${conversation.name ?? "the room"}` });
      router.push(`/app/c/${conversation.id}`);
    } catch (e) {
      setLoading(false);
      const key = String((e as Error).message);
      setError(MESSAGES[key] ?? "Couldn't redeem that invite.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join a room"
      description="Paste the invite code or the full link someone shared with you."
      className="max-w-md overflow-hidden border-[--border]/70 bg-[--bg-elevated] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-[--bg-elevated]/85"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={join} loading={loading}>
            Join room
          </Button>
        </>
      }
    >
      {/* ambient top sheen — purely decorative, non-interactive */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[--accent]/[0.06] to-transparent"
      />

      <div className="relative space-y-4">
        <div className="flex items-center gap-3 rounded-[--r-lg] border border-[--border]/70 bg-[--bg-subtle]/40 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[--border]/70 bg-[--bg-active] text-[--fg-muted]">
            <DoorOpen className="h-4 w-4" />
          </span>
          <p className="text-[12.5px] leading-snug text-[--fg-muted]">
            You're about to enter a shared workspace — messages, members, and the
            assistant's context all carry over the moment you join.
          </p>
        </div>

        <Field label="Invite code" error={error} id="invite-code">
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="a1b2c3d4e5f6"
            autoFocus
            className="font-mono tracking-[0.01em]"
          />
        </Field>
      </div>
    </Modal>
  );
}