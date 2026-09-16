"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Command,
  Compass,
  Globe,
  Hash,
  LogOut,
  MessagesSquare,
  Pin,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Terminal,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AiAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { ConversationListSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/session-provider";
import { signOut } from "@/lib/data/api";
import type { ConversationSummary } from "@/lib/types";
import {
  cn,
  conversationTitle,
  partitionPinned,
  plainPreview,
  relativeTime,
  truncate,
} from "@/lib/utils";
import { popIn, SPRING, tEnter } from "@/lib/motion";

export function Sidebar({
  conversations,
  loading,
  onNew,
  onJoin,
  onSearch,
  onPalette,
  onNavigate,
  onTogglePin,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  onNew: () => void;
  onJoin: () => void;
  onSearch: () => void;
  onPalette: () => void;
  onNavigate?: () => void;
  onTogglePin?: (conversationId: string, pinned: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSession();

  const [aiExpanded, setAiExpanded] = React.useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);

  const { pinned, rest } = partitionPinned(conversations);
  const direct = rest.filter((c) => c.type === "direct_ai");
  const rooms = rest.filter((c) => c.type === "group");

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="relative flex h-full flex-col bg-[--bg-canvas]">
      {/* Header with Dashboard Brand Logo: 20px, 700 bold, -0.03em */}
      <div className="flex items-center justify-between gap-2 border-b border-[--border-subtle] px-4 py-3">
        <Link href="/app" onClick={onNavigate} className="flex items-center gap-2">
          <Logo className="h-5 w-5" />
          <span className="brand-logo-dashboard text-[20px] font-bold tracking-[-0.03em] text-[--text-primary]">
            ONYX
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Dual CTA Buttons & Search Actions */}
      <div className="space-y-2 border-b border-[--border-subtle] p-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onNew}
            size="sm"
            className="w-full justify-center gap-1.5 bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 font-semibold text-[13px] shadow-[--e1]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
          <Button
            onClick={onJoin}
            variant="secondary"
            size="sm"
            className="w-full justify-center gap-1.5 border border-[--border-color] bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[--bg-subtle] font-semibold text-[13px]"
          >
            <Compass className="h-3.5 w-3.5 text-[--text-secondary]" />
            Join Room
          </Button>
        </div>

        <div className="flex gap-1.5 pt-0.5">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 justify-start border border-[--border-color] bg-[--bg-surface] text-[--text-secondary] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:text-[--text-primary] hover:bg-[--bg-subtle]"
            onClick={onPalette}
          >
            <Command className="h-3.5 w-3.5" />
            Commands
            <kbd className="ml-auto hidden rounded border border-[--border-color] bg-[--bg-subtle] px-1.5 py-0.5 font-mono text-[10px] text-[--text-muted] sm:inline">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="border border-[--border-color] bg-[--bg-surface] text-[--text-secondary] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:text-[--text-primary] hover:bg-[--bg-subtle]"
            onClick={onSearch}
            aria-label="Search messages"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Collapsible AI Module */}
      <div className="border-b border-[--border-subtle] p-2.5">
        <button
          onClick={() => setAiExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-[6px] px-2 py-1 text-left transition-colors hover:bg-[--bg-subtle]"
        >
          <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[--ai-badge-text]">
            <Sparkles className="h-3.5 w-3.5" />
            AI Intelligence
          </span>
          {aiExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[--text-muted]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[--text-muted]" />
          )}
        </button>

        <AnimatePresence>
          {aiExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-1 space-y-0.5 overflow-hidden pl-1"
            >
              <button
                onClick={onNew}
                className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] font-medium text-[--text-secondary] transition-colors hover:bg-[--bg-subtle] hover:text-[--text-primary]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[--ai-badge-text]" />
                <span>AI Assistant (@ONYX)</span>
              </button>
              <div className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-[12px] text-[--text-secondary]">
                <span className="flex items-center gap-2.5">
                  <Globe className="h-3.5 w-3.5 text-[--text-muted]" />
                  <span>Live Web Context</span>
                </span>
                <span className="rounded bg-[--ai-badge-bg] px-1.5 py-0.2 font-mono text-[10px] font-bold text-[--ai-badge-text]">
                  READY
                </span>
              </div>
              <div className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-[12px] text-[--text-secondary]">
                <span className="flex items-center gap-2.5">
                  <Terminal className="h-3.5 w-3.5 text-[--text-muted]" />
                  <span>System Diagnostics</span>
                </span>
                <span className="rounded bg-[--bg-subtle] px-1.5 py-0.2 font-mono text-[10px] font-semibold text-[--text-muted]">
                  IDLE
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Conversations Feed */}
      <div className="min-h-0 flex-1 scroll-smooth overflow-y-auto px-2 py-2">
        {loading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <MessagesSquare className="mx-auto mb-3 h-8 w-8 text-[--text-muted]" />
            <p className="text-[13px] font-medium text-[--text-primary]">No conversations yet</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[--text-secondary]">
              Start a private AI chat or create a room.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pinned.length > 0 && (
              <Group label="Pinned">
                {pinned.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={pathname === `/app/c/${c.id}`}
                    onNavigate={onNavigate}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </Group>
            )}
            {direct.length > 0 && (
              <Group label="Direct Messages">
                {direct.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={pathname === `/app/c/${c.id}`}
                    onNavigate={onNavigate}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </Group>
            )}
            {rooms.length > 0 && (
              <Group label="Rooms">
                {rooms.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={pathname === `/app/c/${c.id}`}
                    onNavigate={onNavigate}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </Group>
            )}
          </div>
        )}
      </div>

      {/* Footer with User Avatar, Online Status Pulse Dot & Account Dropdown */}
      <div className="relative border-t border-[--border-subtle] p-2.5">
        {/* Account Dropdown Menu */}
        <AnimatePresence>
          {accountMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full inset-x-2.5 mb-2 rounded-[10px] border border-[--border-color] bg-[--bg-surface] p-1.5 shadow-[0_12px_24px_-8px_rgba(18,18,20,0.15)] z-30"
            >
              <div className="border-b border-[--border-subtle] px-2.5 py-1.5 mb-1">
                <p className="text-[13px] font-semibold text-[--text-primary] truncate">
                  {profile?.display_name ?? "Account"}
                </p>
                <p className="text-[11px] text-[--text-secondary] truncate">{profile?.id}</p>
              </div>

              <Link
                href="/app/settings"
                onClick={() => {
                  setAccountMenuOpen(false);
                  onNavigate?.();
                }}
                className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] text-[--text-secondary] transition-colors hover:bg-[--bg-subtle] hover:text-[--text-primary]"
              >
                <User className="h-4 w-4" />
                <span>Profile settings</span>
              </Link>

              <button
                onClick={() => {
                  setAccountMenuOpen(false);
                  handleSignOut();
                }}
                className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] text-[--text-secondary] transition-colors hover:bg-[--bg-subtle] hover:text-[--text-primary]"
              >
                <Repeat className="h-4 w-4" />
                <span>Switch account</span>
              </button>

              <button
                onClick={() => {
                  setAccountMenuOpen(false);
                  handleSignOut();
                }}
                className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium text-[--danger-color] transition-colors hover:bg-[--danger-subtle]"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete account</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          onClick={() => setAccountMenuOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-2.5 rounded-[8px] p-1.5 transition-colors duration-[--d-standard] hover:bg-[--bg-subtle]"
        >
          {/* Round User Avatar with Online Status Pulse Dot */}
          <div className="relative shrink-0">
            <Avatar name={profile?.display_name ?? "You"} url={profile?.avatar_url} size="sm" />
            <span
              role="status"
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[--bg-canvas] status-pulse"
              aria-label="Online"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-[--text-primary]">
              {profile?.display_name ?? "You"}
            </p>
            <span className="flex items-center gap-1 text-[11.5px] text-[--text-secondary]">
              Online · Ready
            </span>
          </div>

          <Button
            variant="ghost"
            size="iconSm"
            className="press-fluid text-[--text-secondary] hover:text-[--text-primary]"
            onClick={(e) => {
              e.stopPropagation();
              handleSignOut();
            }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-testid="conversation-group" data-group={label}>
      <p className="section-label-chip px-3 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[--text-muted]">
        {label}
      </p>
      <ul aria-label={label} className="space-y-px">
        {children}
      </ul>
    </div>
  );
}

function ConversationRow({
  c,
  active,
  onNavigate,
  onTogglePin,
}: {
  c: ConversationSummary;
  active: boolean;
  onNavigate?: () => void;
  onTogglePin?: (conversationId: string, pinned: boolean) => void;
}) {
  const title = conversationTitle(c);
  const pinned = Boolean(c.pinned_at);
  const preview = c.last_message
    ? `${c.last_message.sender_type === "ai" ? "AI: " : ""}${truncate(plainPreview(c.last_message.content), 44)}`
    : "No messages yet";

  return (
    <motion.li
      layout
      transition={SPRING}
      // `group` scopes the pin button's hover/focus reveal to this row.
      // `isolate` + `overflow-hidden` contain the hover-illuminate glow and
      // the active accent bar to this row's own rounded shape.
      className={cn(
        "hover-illuminate group relative isolate flex items-center overflow-hidden rounded-[--r-md] pr-1 transition-all duration-[--d-standard] ease-[--ease-fluid]",
        active
          ? "bg-gradient-to-r from-[--bg-active] to-[--bg-active]/30 shadow-[--e1]"
          : "hover:bg-[--bg-hover] hover:shadow-[--e1]",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-[--accent-500] to-[--ai-teal-500]"
        />
      )}

      <Link
        href={`/app/c/${c.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[--r-md] px-2.5 py-2"
      >
        {c.type === "direct_ai" ? (
          <AiAvatar size="sm" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] bg-[--bg-active] text-[--fg-muted]">
            <Hash className="h-4 w-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={cn(
                "sidebar-title truncate text-[13.5px] font-semibold",
                c.unread > 0 ? "text-[--text-primary]" : "text-[--text-primary]",
              )}
            >
              {title}
            </p>
            {c.last_message && (
              <span className="shrink-0 text-[10.5px] text-[--text-muted]">
                {relativeTime(c.last_message.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="sidebar-snippet min-w-0 flex-1 truncate text-[12px] font-normal text-[--text-secondary]">
              {preview}
            </p>
            <AnimatePresence>
              {c.unread > 0 && (
                <motion.span
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[--accent] px-1 text-[10px] font-bold text-[--accent-fg]"
                >
                  {c.unread > 9 ? "9+" : c.unread}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Link>

      {onTogglePin && (
        <button
          type="button"
          data-testid={pinned ? "unpin-button" : "pin-button"}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
          title={pinned ? "Unpin" : "Pin to top"}
          onClick={() => onTogglePin(c.id, !pinned)}
          className={cn(
            "press-fluid grid h-6 w-6 shrink-0 place-items-center rounded-[--r-sm] text-[--fg-subtle] transition-opacity duration-[--d-micro]",
            "hover:bg-[--bg-active] hover:text-[--fg]",
            // Revealed on hover / keyboard focus so the row stays clean,
            // but always visible once pinned (state must be discoverable).
            pinned
              ? "text-[--accent-text] opacity-100"
              : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <Pin
            className={cn("h-3.5 w-3.5", pinned && "fill-current")}
            strokeWidth={pinned ? 2.5 : 2}
          />
        </button>
      )}
    </motion.li>
  );
}

/**
 * §2.5 ai_mode badge:
 *   OFF           → neutral-500 dot
 *   MENTION_ONLY  → ai-teal-500 OUTLINE pill
 *   AUTO          → ai-teal-500 FILLED pill
 */
export function AiModeBadge({ mode }: { mode: string }) {
  if (mode === "off") {
    return (
      <motion.span
        layout
        transition={tEnter(0.2)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[--neutral-500]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[--neutral-500]" aria-hidden />
        AI off
      </motion.span>
    );
  }

  const filled = mode === "auto";
  return (
    <motion.span
      layout
      transition={tEnter(0.2)}
      className={cn(
        "inline-flex items-center gap-1 rounded-[--r-pill] px-2 py-0.5 text-[11px] font-semibold",
        filled
          ? "bg-[--ai] text-[--ai-foreground]"
          : "border border-[--ai-teal-500] text-[--ai-teal-500]",
      )}
    >
      <Sparkles className="h-3 w-3" />
      {filled ? "AI auto" : "@ai only"}
    </motion.span>
  );
}