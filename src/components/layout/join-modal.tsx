"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Compass, DoorOpen, Hash, KeyRound, Sparkles, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { consumeInvite, listDiscoverableRooms } from "@/lib/data/api";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  invite_not_found: "That code, link, or room name doesn't match any room.",
  invite_expired: "That invite has expired.",
  invite_exhausted: "That invite has reached its use limit.",
  not_authenticated: "Please sign in to join this room.",
};

type Tab = "browse" | "code";

interface DiscoverableRoom extends Conversation {
  member_count: number;
  invite_code?: string;
  is_member: boolean;
}

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
  const [tab, setTab] = useState<Tab>("browse");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<DiscoverableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Load available rooms whenever the modal opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingRooms(true);
    listDiscoverableRooms()
      .then((data) => {
        if (alive) {
          setRooms(data);
          const unjoined = data.filter((r) => !r.is_member);
          if (data.length === 0 || unjoined.length === 0) {
            setTab("code");
          } else {
            setTab("browse");
          }
        }
      })
      .catch(() => {
        if (alive) setRooms([]);
      })
      .finally(() => {
        if (alive) setLoadingRooms(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const close = () => {
    onClose();
    setTimeout(() => {
      setCode("");
      setError(null);
      setLoading(false);
      setJoiningRoomId(null);
    }, 260);
  };

  const handleJoinByIdOrCode = async (identifier: string) => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Enter a room name, invite code, or link.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { conversation } = await consumeInvite(trimmed);
      onJoined?.();
      close();
      toast.push({ kind: "success", title: `Joined ${conversation.name ?? "the room"}` });
      router.push(`/app/c/${conversation.id}`);
    } catch (e) {
      setLoading(false);
      const key = String((e as Error).message);
      setError(MESSAGES[key] ?? "Couldn't join that room. Please check the code or room name.");
    }
  };

  const handleJoinDirect = async (room: DiscoverableRoom) => {
    setJoiningRoomId(room.id);
    try {
      const identifier = room.invite_code || room.id;
      const { conversation } = await consumeInvite(identifier);
      onJoined?.();
      close();
      toast.push({ kind: "success", title: `Joined ${conversation.name ?? "the room"}` });
      router.push(`/app/c/${conversation.id}`);
    } catch (e) {
      setJoiningRoomId(null);
      const key = String((e as Error).message);
      toast.push({
        kind: "error",
        title: "Could not join",
        description: MESSAGES[key] ?? "Unable to connect to this room.",
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join Group Room"
      description="Connect to an existing room with 1 click, or join using an invite code or link."
      className="max-w-lg overflow-hidden border-[--border-color] bg-[--bg-surface] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          {tab === "code" && (
            <Button onClick={() => handleJoinByIdOrCode(code)} loading={loading}>
              Join room
            </Button>
          )}
        </div>
      }
    >
      {/* Ambient top sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[--accent-black]/[0.05] to-transparent dark:from-white/[0.05]"
      />

      <div className="relative space-y-4">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-[--border-color] bg-[--bg-subtle] p-1">
          <button
            type="button"
            onClick={() => {
              setTab("browse");
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-[7px] py-1.5 text-[13px] font-semibold transition-all",
              tab === "browse"
                ? "bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[--text-secondary] hover:text-[--text-primary]",
            )}
          >
            <Compass className="h-4 w-4" />
            <span>Available Rooms</span>
            {rooms.filter((r) => !r.is_member).length > 0 && (
              <span className="rounded-full bg-[--accent-black] px-1.5 py-0.2 text-[10px] font-bold text-[--accent-foreground]">
                {rooms.filter((r) => !r.is_member).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("code");
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-[7px] py-1.5 text-[13px] font-semibold transition-all",
              tab === "code"
                ? "bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[--text-secondary] hover:text-[--text-primary]",
            )}
          >
            <KeyRound className="h-4 w-4" />
            <span>Enter Code or Link</span>
          </button>
        </div>

        {/* Tab 1: Available Rooms (The direct "Other Way") */}
        {tab === "browse" && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[--text-secondary]">
              Choose any open room below to join instantly without needing a join code:
            </p>

            {loadingRooms ? (
              <div className="space-y-2 py-4">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-16 w-full animate-pulse rounded-[10px] border border-[--border-color] bg-[--bg-subtle]"
                  />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[--border-color] p-6 text-center">
                <Users className="mx-auto mb-2 h-7 w-7 text-[--text-muted]" />
                <p className="text-[13px] font-semibold text-[--text-primary]">No open rooms found</p>
                <p className="mt-1 text-[12px] text-[--text-secondary]">
                  Switch to the code tab to join using an invite link, code, or room name.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setTab("code")}
                >
                  Enter code or name
                </Button>
              </div>
            ) : (
              <div className="max-h-[280px] space-y-2.5 overflow-y-auto pr-1">
                {rooms.map((r) => {
                  const isJoining = joiningRoomId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[12px] border p-3 transition-all",
                        r.is_member
                          ? "border-[--border-color]/70 bg-[--bg-subtle]/50"
                          : "border-[--border-color] bg-[--bg-surface] hover:border-[--text-secondary]/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[--bg-subtle] text-[--text-primary]">
                            <Hash className="h-3.5 w-3.5" />
                          </span>
                          <p className="truncate text-[13.5px] font-semibold text-[--text-primary]">
                            {r.name ?? "Unnamed Room"}
                          </p>
                          {r.is_member && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Check className="h-2.5 w-2.5" />
                              Joined
                            </span>
                          )}
                        </div>
                        {r.topic && (
                          <p className="mt-1 truncate text-[12px] text-[--text-secondary]">
                            {r.topic}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[--text-muted]">
                          <span>{r.member_count} members</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-[--ai-badge-text]" />
                            {r.ai_mode}
                          </span>
                          {r.invite_code && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10.5px]">code: {r.invite_code}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        {r.is_member ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-[12px]"
                            onClick={() => {
                              close();
                              router.push(`/app/c/${r.id}`);
                            }}
                          >
                            Open
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            loading={isJoining}
                            className="h-8 bg-[--accent-black] text-[--accent-foreground] text-[12px] font-semibold hover:opacity-90"
                            onClick={() => handleJoinDirect(r)}
                          >
                            Join Room
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Join by Code, URL, ID, or Name */}
        {tab === "code" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[--border-color] bg-[--bg-subtle]/50 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[--border-color] bg-[--bg-surface] text-[--text-primary]">
                <DoorOpen className="h-4 w-4" />
              </span>
              <p className="text-[12.5px] leading-snug text-[--text-secondary]">
                You can enter an <strong>invite code</strong>, <strong>room link</strong>,{" "}
                <strong>room ID</strong>, or the <strong>room name</strong>.
              </p>
            </div>

            <Field label="Invite code, link, or room name" error={error} id="invite-code">
              <Input
                id="invite-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByIdOrCode(code)}
                placeholder="e.g. launch2026, or Launch war room"
                autoFocus
                className="font-mono text-[13px] tracking-[0.01em]"
              />
            </Field>

            {/* Quick Demo Suggestions / Seed code quick-picks */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11.5px] font-medium text-[--text-muted]">Suggested room codes:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "launch2026", desc: "Launch war room" },
                  { label: "guild123", desc: "Design & AI Guild" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setCode(chip.label);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[--border-color] bg-[--bg-surface] px-2.5 py-1 text-[11px] font-medium text-[--text-secondary] transition-colors hover:border-[--text-primary] hover:text-[--text-primary]"
                  >
                    <span className="font-mono font-bold text-[--text-primary]">{chip.label}</span>
                    <span className="text-[--text-muted]">({chip.desc})</span>
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