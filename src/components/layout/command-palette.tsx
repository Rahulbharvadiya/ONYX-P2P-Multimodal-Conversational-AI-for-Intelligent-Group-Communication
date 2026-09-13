"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CornerDownLeft,
  Hash,
  LogOut,
  MessageSquarePlus,
  Monitor,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserPlus,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { signOut, createConversation } from "@/lib/data/api";
import type { ConversationSummary } from "@/lib/types";
import { cn, conversationTitle } from "@/lib/utils";
import { backdrop, modalPanel } from "@/lib/motion";

/**
 * §3 Command palette (Cmd+K) — navigate to any conversation, create a
 * room, toggle theme. Distinct from message full-text search, which
 * lives in SearchModal and is reachable from here as an action.
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ElementType;
  keywords?: string;
  run: () => void | Promise<void>;
}

export function CommandPalette({
  open,
  onClose,
  conversations,
  onNewConversation,
  onJoin,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  onNewConversation: () => void;
  onJoin: () => void;
  onSearch: () => void;
}) {
  const router = useRouter();
  const { setPref, resolved } = useTheme();
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The element that had focus before ⌘K opened the palette, so closing it
  // hands focus back instead of dropping it on <body>.
  const restoreTo = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const target = restoreTo.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  const act = React.useCallback(
    (fn: () => void | Promise<void>) => () => {
      onClose();
      void fn();
    },
    [onClose],
  );

  const commands = React.useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "new-chat",
        label: "New AI chat",
        hint: "Private thread with the assistant",
        group: "Actions",
        icon: Sparkles,
        keywords: "create start direct",
        run: act(async () => {
          const id = await createConversation({ type: "direct_ai", ai_mode: "auto" });
          router.push(`/app/c/${id}`);
        }),
      },
      {
        id: "new-room",
        label: "Create a room",
        hint: "Group conversation with invites",
        group: "Actions",
        icon: MessageSquarePlus,
        keywords: "group new create",
        run: act(onNewConversation),
      },
      {
        id: "join",
        label: "Join a room with an invite code",
        group: "Actions",
        icon: UserPlus,
        keywords: "invite code redeem",
        run: act(onJoin),
      },
      {
        id: "search",
        label: "Search messages",
        hint: "Full-text across every conversation",
        group: "Actions",
        icon: Search,
        keywords: "find text",
        run: act(onSearch),
      },
      {
        id: "theme-light",
        label: "Switch to light theme",
        group: "Theme",
        icon: Sun,
        keywords: "appearance mode",
        run: act(() => setPref("light")),
      },
      {
        id: "theme-dark",
        label: "Switch to dark theme",
        group: "Theme",
        icon: Moon,
        keywords: "appearance mode",
        run: act(() => setPref("dark")),
      },
      {
        id: "theme-system",
        label: "Match system theme",
        group: "Theme",
        icon: Monitor,
        keywords: "appearance mode auto",
        run: act(() => setPref("system")),
      },
      {
        id: "settings",
        label: "Open settings",
        group: "Navigate",
        icon: Settings,
        keywords: "profile privacy account",
        run: act(() => router.push("/app/settings")),
      },
      {
        id: "changelog",
        label: "What's new",
        hint: "Release notes",
        group: "Navigate",
        icon: ArrowRight,
        keywords: "changelog releases updates",
        run: act(() => router.push("/changelog")),
      },
      {
        id: "signout",
        label: "Sign out",
        group: "Navigate",
        icon: LogOut,
        keywords: "logout leave",
        run: act(async () => {
          await signOut();
          router.push("/");
        }),
      },
    ];

    for (const c of conversations) {
      list.push({
        id: `conv-${c.id}`,
        label: conversationTitle(c),
        hint: c.type === "group" ? "Room" : "AI chat",
        group: "Conversations",
        icon: c.type === "group" ? Hash : Sparkles,
        keywords: c.topic ?? "",
        run: act(() => router.push(`/app/c/${c.id}`)),
      });
    }

    return list;
  }, [act, conversations, onJoin, onNewConversation, onSearch, router, setPref]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = commands.filter((c) => {
      // hide the redundant "switch to X" for the theme already active
      if (c.id === `theme-${resolved}`) return false;
      return true;
    });
    if (!q) return pool;
    return pool.filter((c) =>
      `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q),
    );
  }, [commands, query, resolved]);

  React.useEffect(() => setCursor(0), [query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const flat = React.useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + flat.length) % Math.max(flat.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void flat[cursor]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!mounted) return null;

  let idx = -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative w-full max-w-xl overflow-hidden rounded-[--r-xl] border border-[--border-default]/70 bg-[--bg-surface-raised]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-[--bg-surface-raised]/80"
          >
            {/* ambient top sheen — purely decorative, non-interactive */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[--text-primary]/[0.04] to-transparent"
            />

            <div className="relative flex items-center gap-2.5 border-b border-[--border-default]/70 px-4">
              <Search className="h-4 w-4 shrink-0 text-[--text-secondary]" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a command or jump to a conversation…"
                aria-label="Command palette input"
                className="h-12 flex-1 bg-transparent text-[14px] tracking-[-0.005em] text-[--text-primary] outline-none placeholder:text-[--text-secondary]"
              />
              <kbd className="hidden rounded border border-[--border-default]/80 bg-[--bg-hover]/60 px-1.5 py-0.5 font-mono text-[10px] text-[--text-secondary] sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="relative max-h-[min(24rem,52vh)] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[--text-secondary]">
                  No commands match <span className="font-medium text-[--text-primary]">{query}</span>.
                </p>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group} className="mb-1.5 last:mb-0">
                    <p className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[--text-secondary]">
                      {group}
                    </p>
                    {items.map((c) => {
                      idx += 1;
                      const active = idx === cursor;
                      const myIdx = idx;
                      return (
                        <button
                          key={c.id}
                          data-idx={myIdx}
                          onMouseEnter={() => setCursor(myIdx)}
                          onClick={() => void c.run()}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-[--r-sm] border border-transparent px-2 py-2 text-left transition-all duration-[--d-micro]",
                            active
                              ? "border-[--border-default]/60 bg-[--bg-hover]"
                              : "hover:bg-[--bg-hover]",
                          )}
                        >
                          <c.icon className="h-4 w-4 shrink-0 text-[--text-secondary]" />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] text-[--text-primary]">
                            {c.label}
                          </span>
                          {c.hint && (
                            <span className="hidden shrink-0 text-[11.5px] text-[--text-secondary] sm:block">
                              {c.hint}
                            </span>
                          )}
                          {active && (
                            <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[--text-secondary]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="relative flex items-center gap-3 border-t border-[--border-default]/70 px-4 py-2 text-[11px] text-[--text-secondary]">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[--border-default]/80 px-1 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[--border-default]/80 px-1 font-mono">↵</kbd>
                run
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}