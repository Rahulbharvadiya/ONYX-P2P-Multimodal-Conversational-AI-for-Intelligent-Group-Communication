/**
 * §3 pinned conversations.
 *
 * The pin is a per-member preference stored on `conversation_members`, so
 * this suite covers both halves of that contract:
 *
 *   1. `partitionPinned` — the pure ordering rule the sidebar renders.
 *   2. `setPinned` / `listConversations` — the pin round-trips through the
 *      data layer (here in demo mode; in Supabase mode the same calls hit
 *      the membership row, gated by the `members_update_self` RLS policy).
 *
 *   npx vitest run tests/pinned-conversations.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest";
import { listConversations, setPinned } from "../src/lib/data/api";
import { demo } from "../src/lib/data/demo-store";
import { partitionPinned } from "../src/lib/utils";
import type { ConversationSummary } from "../src/lib/types";

function summary(
  id: string,
  pinned_at: string | null,
  type: "direct_ai" | "group" = "group",
): ConversationSummary {
  return {
    id,
    type,
    name: id,
    topic: null,
    ai_mode: "auto",
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    member_count: 1,
    last_message: null,
    unread: 0,
    pinned_at,
  };
}

describe("partitionPinned — sidebar ordering", () => {
  it("returns everything unpinned when nothing is pinned", () => {
    const { pinned, rest } = partitionPinned([summary("a", null), summary("b", null)]);
    expect(pinned).toEqual([]);
    expect(rest.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("floats pinned conversations to the front, most recently pinned first", () => {
    const list = [
      summary("older", "2026-01-01T10:00:00Z"),
      summary("plain", null),
      summary("newest", "2026-02-01T10:00:00Z"),
      summary("middle", "2026-01-15T10:00:00Z"),
    ];
    const { pinned, rest } = partitionPinned(list);
    expect(pinned.map((c) => c.id)).toEqual(["newest", "middle", "older"]);
    expect(rest.map((c) => c.id)).toEqual(["plain"]);
  });

  it("preserves the caller's ordering inside each partition", () => {
    const list = [
      summary("z", null),
      summary("p1", "2026-01-01T00:00:00Z"),
      summary("a", null),
      summary("p2", "2026-01-02T00:00:00Z"),
    ];
    const { pinned, rest } = partitionPinned(list);
    expect(rest.map((c) => c.id)).toEqual(["z", "a"]);
    expect(pinned.map((c) => c.id)).toEqual(["p2", "p1"]);
  });

  it("never drops or duplicates a conversation", () => {
    const list = [summary("a", null), summary("b", "x"), summary("c", null)];
    const { pinned, rest } = partitionPinned(list);
    expect(pinned.length + rest.length).toBe(list.length);
    expect(new Set([...pinned, ...rest].map((c) => c.id))).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("setPinned — data layer (demo mode)", () => {
  beforeEach(() => {
    demo.reset();
    demo.signIn();
  });

  it("round-trips a pin through listConversations", async () => {
    const before = await listConversations();
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((c) => c.pinned_at === null)).toBe(true);

    const target = before[0];
    await setPinned(target.id, true);

    const after = await listConversations();
    const row = after.find((c) => c.id === target.id);
    expect(row?.pinned_at).toBeTruthy();
    // Pinning one conversation must not touch the others.
    expect(after.filter((c) => c.pinned_at !== null)).toHaveLength(1);
  });

  it("unpinning clears the timestamp", async () => {
    const [target] = await listConversations();
    await setPinned(target.id, true);
    await setPinned(target.id, false);

    const after = await listConversations();
    expect(after.find((c) => c.id === target.id)?.pinned_at).toBeNull();
    expect(after.every((c) => c.pinned_at === null)).toBe(true);
  });

  it("stamps a monotonically later pinned_at on each re-pin", async () => {
    const [target] = await listConversations();
    await setPinned(target.id, true);
    const first = (await listConversations()).find((c) => c.id === target.id)!.pinned_at!;
    await setPinned(target.id, true);
    const second = (await listConversations()).find((c) => c.id === target.id)!.pinned_at!;
    expect(second >= first).toBe(true);
  });

  it("only writes the caller's own membership row", async () => {
    const [target] = await listConversations();
    await setPinned(target.id, true);
    const members = demo.db().members.filter((m) => m.conversation_id === target.id);
    expect(members.filter((m) => m.pinned_at !== null)).toHaveLength(1);
  });
});
