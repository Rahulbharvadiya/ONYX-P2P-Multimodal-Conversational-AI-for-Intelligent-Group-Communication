"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Crown, DoorOpen, Link2, Shield, Trash2, User } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import {
  createInvite,
  deleteConversation,
  leaveConversation,
  listInvites,
  removeMember,
  setMemberRole,
  updateConversation,
} from "@/lib/data/api";
import type { AiMode, Conversation, ConversationMember, Invite, MemberRole } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { SPRING, tEnter, tExit } from "@/lib/motion";

const AI_MODES: Array<{ v: AiMode; label: string; body: string }> = [
  { v: "off", label: "Off", body: "Humans only. The assistant never posts here." },
  { v: "mention_only", label: "Mention only", body: "Responds when someone writes @ai." },
  { v: "auto", label: "Auto", body: "Replies to every message." },
];

const ROLE_ICON: Record<MemberRole, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

type Tab = "general" | "members" | "invites" | "danger";

export function RoomSettingsModal({
  open,
  onClose,
  conversation,
  members,
  isAdmin,
  currentUserId,
  onChanged,
  onLeft,
}: {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  members: ConversationMember[];
  isAdmin: boolean;
  currentUserId: string;
  onChanged: () => void | Promise<void>;
  onLeft: () => void;
}) {
  const toast = useToast();
  const isGroup = conversation.type === "group";
  const [tab, setTab] = React.useState<Tab>("general");
  const [name, setName] = React.useState(conversation.name ?? "");
  const [topic, setTopic] = React.useState(conversation.topic ?? "");
  const [aiMode, setAiMode] = React.useState<AiMode>(conversation.ai_mode);
  const [saving, setSaving] = React.useState(false);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // Captured once per open so expiry math stays pure during render.
  const [nowMs, setNowMs] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setName(conversation.name ?? "");
    setTopic(conversation.topic ?? "");
    setAiMode(conversation.ai_mode);
    setTab("general");
    setNowMs(Date.now());
    if (isGroup && isAdmin) void listInvites(conversation.id).then(setInvites);
  }, [open, conversation, isGroup, isAdmin]);

  const dirty =
    name !== (conversation.name ?? "") ||
    topic !== (conversation.topic ?? "") ||
    aiMode !== conversation.ai_mode;

  const save = async () => {
    setSaving(true);
    try {
      await updateConversation(conversation.id, {
        name: isGroup ? name.trim() || null : null,
        topic: topic.trim() || null,
        ai_mode: aiMode,
      });
      await onChanged();
      toast.push({ kind: "success", title: "Settings saved" });
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't save", description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const newInvite = async () => {
    try {
      const inv = await createInvite(conversation.id);
      setInvites((prev) => [inv, ...prev]);
      toast.push({ kind: "success", title: "Invite created" });
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't create invite", description: String(e) });
    }
  };

  const copyInvite = async (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      toast.push({ kind: "error", title: "Clipboard unavailable", description: url });
    }
  };

  const TABS: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "general", label: "General", show: true },
    { id: "members", label: `Members (${members.length})`, show: isGroup },
    { id: "invites", label: "Invites", show: isGroup && isAdmin },
    { id: "danger", label: "Danger zone", show: true },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isGroup ? "Room settings" : "Conversation settings"}
        description={
          isGroup
            ? "Name, topic, AI participation, members, and invites."
            : "Control how the assistant behaves in this thread."
        }
        className="max-w-2xl overflow-hidden border-[--border]/70 bg-[--bg-elevated] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-[--bg-elevated]/85"
        footer={
          tab === "general" ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button onClick={save} loading={saving} disabled={!dirty || (!isAdmin && isGroup)}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )
        }
      >
        {/* ambient top sheen — purely decorative, non-interactive */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[--accent]/[0.06] to-transparent"
        />

        {/* tabs */}
        <div className="relative mb-5 flex gap-1 border-b border-[--border]/80">
          {TABS.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative rounded-t-[--r-sm] px-3 py-2 text-[13px] font-medium tracking-[-0.005em] transition-colors duration-[--d-micro]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-elevated]",
                tab === t.id ? "text-[--fg]" : "text-[--fg-muted] hover:text-[--fg]",
              )}
            >
              {t.label}
              {tab === t.id && (
                <motion.span
                  layoutId="room-tab"
                  transition={SPRING}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[--accent] shadow-[0_0_10px_-1px_var(--accent)]"
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: tExit() }}
            transition={tEnter(0.2)}
            className="min-h-[16rem]"
          >
            {/* ---------- GENERAL ---------- */}
            {tab === "general" && (
              <div className="space-y-6">
                {isGroup && (
                  <div className="space-y-5 rounded-[--r-lg] border border-[--border]/70 bg-[--bg-subtle]/40 p-4">
                    <Field label="Room name" id="rs-name">
                      <Input
                        id="rs-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isAdmin}
                        placeholder="Launch war room"
                      />
                    </Field>
                    <Field
                      label="Topic"
                      id="rs-topic"
                      hint="Given to the assistant as context for every reply in this room."
                    >
                      <Textarea
                        id="rs-topic"
                        rows={2}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={!isAdmin}
                      />
                    </Field>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[13px] font-medium tracking-[-0.005em] text-[--fg]">
                    AI participation
                  </p>
                  <div className="space-y-1.5">
                    {AI_MODES.map((m) => {
                      const locked = !isGroup && m.v !== "auto";
                      const selected = aiMode === m.v;
                      return (
                        <button
                          key={m.v}
                          type="button"
                          disabled={(isGroup && !isAdmin) || locked}
                          onClick={() => setAiMode(m.v)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-[10px] border p-3 text-left transition-all duration-150 cursor-pointer select-none",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-primary]",
                            selected
                              ? "border-[--text-primary] bg-[--bg-surface] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-[--text-primary]"
                              : "border-[--border-color] bg-[--bg-surface]/60 hover:border-[--text-secondary] hover:bg-[--bg-surface]",
                            (locked || (isGroup && !isAdmin)) && "cursor-not-allowed opacity-45",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-all duration-150",
                              selected
                                ? "border-[--text-primary] bg-[--text-primary]"
                                : "border-[--border-color] bg-transparent",
                            )}
                          >
                            {selected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[--bg-surface]" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[13px] font-semibold",
                                  selected ? "text-[--text-primary]" : "text-[--text-secondary]",
                                )}
                              >
                                {m.label}
                              </span>
                              {selected && (
                                <span className="rounded-full bg-[--ai-badge-bg] px-2 py-0.5 font-mono text-[10px] font-bold text-[--ai-badge-text]">
                                  ACTIVE
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-[--text-secondary]">
                              {locked ? "Not applicable to a 1:1 AI chat." : m.body}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isGroup && !isAdmin && (
                  <p className="text-[12.5px] text-[--fg-subtle]">
                    Only owners and admins can change room settings.
                  </p>
                )}
              </div>
            )}

            {/* ---------- MEMBERS ---------- */}
            {tab === "members" && (
              <div className="space-y-1">
                {members.map((m) => {
                  const Icon = ROLE_ICON[m.role];
                  const isSelf = m.user_id === currentUserId;
                  return (
                    <div
                      key={m.user_id}
                      className="group flex items-center gap-3 rounded-[--r-md] px-2 py-2 transition-colors duration-[--d-micro] hover:bg-[--bg-hover]"
                    >
                      <Avatar
                        name={m.profile?.display_name ?? "?"}
                        url={m.profile?.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-[--fg]">
                          {m.profile?.display_name ?? "Unknown"}
                          {isSelf && (
                            <span className="ml-1.5 text-[11px] font-normal text-[--fg-subtle]">
                              you
                            </span>
                          )}
                        </p>
                        <p className="text-[11.5px] text-[--fg-muted]">
                          Joined {relativeTime(m.joined_at)}
                        </p>
                      </div>

                      <span className="flex items-center gap-1 rounded-full border border-[--border]/70 bg-[--bg-active] px-2 py-0.5 text-[11px] font-medium capitalize text-[--fg-muted]">
                        <Icon className="h-3 w-3" />
                        {m.role}
                      </span>

                      {isAdmin && !isSelf && m.role !== "owner" && (
                        <div className="flex gap-0.5 opacity-80 transition-opacity duration-[--d-micro] group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={m.role === "admin" ? "Demote to member" : "Promote to admin"}
                            title={m.role === "admin" ? "Demote to member" : "Promote to admin"}
                            onClick={async () => {
                              await setMemberRole(
                                conversation.id,
                                m.user_id,
                                m.role === "admin" ? "member" : "admin",
                              );
                              await onChanged();
                            }}
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label="Remove from room"
                            title="Remove from room"
                            onClick={async () => {
                              await removeMember(conversation.id, m.user_id);
                              await onChanged();
                              toast.push({ kind: "success", title: "Member removed" });
                            }}
                            className="hover:bg-[--danger-subtle] hover:text-[--danger]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ---------- INVITES ---------- */}
            {tab === "invites" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] text-[--fg-muted]">
                    Links expire after 7 days or 50 uses, whichever comes first.
                  </p>
                  <Button size="sm" onClick={newInvite}>
                    <Link2 className="h-3.5 w-3.5" />
                    New invite
                  </Button>
                </div>

                {invites.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-[--r-lg] border border-dashed border-[--border] py-10 text-center">
                    <Link2 className="mb-1 h-4 w-4 text-[--fg-subtle]" />
                    <p className="text-[13px] text-[--fg-subtle]">
                      No invites yet. Create one to bring people in.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {invites.map((inv) => {
                      const expired = new Date(inv.expires_at).getTime() < nowMs;
                      const exhausted = inv.uses >= inv.max_uses;
                      const dead = expired || exhausted;
                      return (
                        <div
                          key={inv.id}
                          className={cn(
                            "flex items-center gap-3 rounded-[--r-md] border border-[--border] bg-[--bg-subtle]/30 px-3 py-2.5 transition-opacity duration-[--d-micro]",
                            dead && "opacity-50",
                          )}
                        >
                          <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[--fg]">
                            /join/{inv.code}
                          </code>
                          <span className="shrink-0 text-[11.5px] text-[--fg-muted]">
                            {dead
                              ? expired
                                ? "Expired"
                                : "Used up"
                              : `${inv.uses}/${inv.max_uses} used`}
                          </span>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label="Copy invite link"
                            onClick={() => copyInvite(inv.code)}
                            disabled={dead}
                          >
                            {copiedCode === inv.code ? (
                              <Check className="h-3.5 w-3.5 text-[--success]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------- DANGER ---------- */}
            {tab === "danger" && (
              <div className="space-y-3">
                {isGroup && (
                  <DangerRow
                    icon={DoorOpen}
                    title="Leave this room"
                    body="You'll stop receiving messages and need a new invite to rejoin."
                    action="Leave room"
                    onClick={() => setConfirmLeave(true)}
                  />
                )}
                <DangerRow
                  icon={Trash2}
                  title={isGroup ? "Delete this room" : "Delete this conversation"}
                  body={
                    isGroup
                      ? "Permanently removes the room and every message in it, for everyone."
                      : "Permanently removes this thread and its entire history."
                  }
                  action="Delete permanently"
                  disabled={isGroup && !isAdmin}
                  onClick={() => setConfirmDelete(true)}
                />
                {isGroup && !isAdmin && (
                  <p className="text-[12.5px] text-[--fg-subtle]">
                    Only owners and admins can delete a room.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Modal>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave this room?"
        description="You'll need a new invite link to come back."
        confirmLabel="Leave room"
        onConfirm={async () => {
          await leaveConversation(conversation.id);
          onClose();
          onLeft();
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={isGroup ? "Delete this room?" : "Delete this conversation?"}
        description="This cannot be undone. Every message will be permanently removed."
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          await deleteConversation(conversation.id);
          onClose();
          onLeft();
        }}
      />
    </>
  );
}

function DangerRow({
  icon: Icon,
  title,
  body,
  action,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[--r-lg] border border-[--danger]/20 bg-[--danger-subtle]/30 p-4 transition-colors duration-[--d-micro] hover:border-[--danger]/30 sm:flex-row sm:items-start">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[--danger]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-[--fg]">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[--fg-muted]">{body}</p>
      </div>
      <Button
        variant="danger"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className="w-full shrink-0 sm:w-auto"
      >
        {action}
      </Button>
    </div>
  );
}