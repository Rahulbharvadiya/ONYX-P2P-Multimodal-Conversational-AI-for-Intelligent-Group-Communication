import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic hue from a string — stable avatar colours without storage. */
export function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function conversationTitle(c: {
  type: string;
  name: string | null;
  topic?: string | null;
}): string {
  if (c.name) return c.name;
  return c.type === "direct_ai" ? "New chat" : "Untitled room";
}

export function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

/** Strip markdown to a plain-text preview for list rows / search results. */
export function plainPreview(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " [image] ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[>#\-*+]\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PinnedPartition<T> {
  pinned: T[];
  rest: T[];
}

/**
 * Split a conversation list into the pinned group and everything else.
 *
 * Pinned rows float to the top of the sidebar, ordered by when they were
 * pinned (most recent first) rather than by recency — a pin is a deliberate
 * placement, so it should hold still while other conversations move under
 * it. Unpinned rows keep the order the caller already sorted them into.
 */
export function partitionPinned<T extends { pinned_at?: string | null }>(
  items: readonly T[],
): PinnedPartition<T> {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (item.pinned_at) pinned.push(item);
    else rest.push(item);
  }
  pinned.sort((a, b) => (b.pinned_at ?? "").localeCompare(a.pinned_at ?? ""));
  return { pinned, rest };
}

export const MENTION_RE = /@(ai|onyx|assistant|bot)\b/i;

export function mentionsAi(text: string): boolean {
  return MENTION_RE.test(text);
}

export function shouldInvokeAi(text: string, aiMode: string): boolean {
  if (aiMode === "off") return false;
  if (aiMode === "auto") return true;
  return mentionsAi(text);
}

/**
 * Sanitise a `?next=` style redirect target down to a safe in-app path.
 *
 * Login, signup and the OAuth callback all echo a caller-supplied `next`
 * back into `router.push()` / `NextResponse.redirect()`. Without this,
 * `/login?next=https://evil.example` turns the login form into an open
 * redirect — a convincing phishing hop, because the victim starts on the
 * real domain.
 *
 * Rejects anything that is not a single-slash, same-origin path: absolute
 * URLs, protocol-relative `//host`, backslash variants (`/\host`, which
 * browsers normalise to `//host`), embedded schemes, and control
 * characters (including their percent-encoded forms).
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/app",
): string {
  if (!value) return fallback;

  let candidate = value.trim();
  if (candidate.length === 0) return fallback;

  // Decode once so `%2f%2fevil.example` cannot smuggle a protocol-relative
  // host past the checks below.
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Malformed percent-encoding — not a path we want to honour.
    return fallback;
  }

  if (!candidate.startsWith("/")) return fallback;
  // Protocol-relative host, or `/\host` (browsers rewrite `\` to `/`).
  if (/^\/[/\\]/.test(candidate)) return fallback;
  // Any embedded scheme anywhere in the value.
  if (candidate.includes("://")) return fallback;
  // Control characters / newlines (header + log injection).
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  return candidate;
}
