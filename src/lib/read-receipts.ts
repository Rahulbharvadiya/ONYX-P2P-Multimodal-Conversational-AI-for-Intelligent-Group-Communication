import type { ConversationMember, Message } from "@/lib/types";

export interface ReadReceipt {
  /** Names of members who have seen this message (excluding the sender). */
  seenBy: string[];
  /** Whether every other human member has seen it. */
  allSeen: boolean;
  /** Total number of other members. */
  members: number;
}

/**
 * Compute the read receipt for a human message in a group room.
 *
 * Model: each member row carries a single `last_read_at` — the last time that
 * member read the conversation. A member has "seen" a message when their
 * `last_read_at` is at or after the message's `created_at`. This is the
 * standard last-read model (it avoids a per-message write per reader).
 *
 * The sender is excluded. Members without a `last_read_at` (never read) are
 * not counted as seeing it. Returns a `ReadReceipt` suitable for a "Seen by …"
 * indicator.
 */
export function computeReadReceipt(
  message: Message,
  members: ConversationMember[],
  currentUserId: string,
): ReadReceipt {
  const others = members.filter((m) => m.user_id !== currentUserId);
  const seenBy = others
    .filter((m) => m.last_read_at && m.last_read_at >= message.created_at)
    .map((m) => m.profile?.display_name ?? "Someone")
    .filter(Boolean);

  return {
    seenBy,
    allSeen: others.length > 0 && seenBy.length === others.length,
    members: others.length,
  };
}

/** Single-label summary, e.g. "Seen by Priya, Marcus" / "Seen by 2". */
export function readReceiptLabel(receipt: ReadReceipt, maxNames = 2): string {
  if (receipt.seenBy.length === 0) return "";
  const names = receipt.seenBy.slice(0, maxNames);
  const extra = receipt.seenBy.length - names.length;
  let label = `Seen by ${names.join(", ")}`;
  if (extra > 0) label += ` +${extra}`;
  return label;
}
