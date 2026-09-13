import { describe, expect, it } from "vitest";
import { computeReadReceipt, readReceiptLabel } from "@/lib/read-receipts";
import type { ConversationMember, Message, Profile } from "@/lib/types";

const NOW = "2026-01-01T12:00:00.000Z";

function msg(created_at: string): Message {
  return {
    id: "m1",
    conversation_id: "c1",
    sender_id: "me",
    sender_type: "human",
    content: "hello",
    content_format: "markdown",
    status: "sent",
    supersedes_id: null,
    created_at,
    edited_at: null,
    deleted_at: null,
  };
}

function profile(user_id: string, name: string): Profile {
  return {
    id: user_id,
    display_name: name,
    avatar_url: null,
    theme_pref: "system",
    training_opt_in: false,
    created_at: NOW,
    updated_at: NOW,
  };
}

function member(user_id: string, last_read_at: string | null, name?: string): ConversationMember {
  return {
    conversation_id: "c1",
    user_id,
    role: "member",
    joined_at: NOW,
    last_read_at,
    pinned_at: null,
    profile: name ? profile(user_id, name) : undefined,
  };
}

describe("computeReadReceipt", () => {
  it("excludes the sender", () => {
    const r = computeReadReceipt(msg(NOW), [member("me", NOW, "Me"), member("p", NOW, "Priya")], "me");
    expect(r.seenBy).toEqual(["Priya"]);
    expect(r.members).toBe(1);
  });

  it("counts a member as seen only when last_read_at >= message.created_at", () => {
    const r = computeReadReceipt(
      msg("2026-01-01T13:00:00.000Z"),
      [member("p", "2026-01-01T14:00:00.000Z", "Priya"), member("m", "2026-01-01T12:00:00.000Z", "Marcus")],
      "me",
    );
    // Priya read after the message; Marcus read before it.
    expect(r.seenBy).toEqual(["Priya"]);
    expect(r.allSeen).toBe(false);
  });

  it("ignores members who have never read", () => {
    const r = computeReadReceipt(msg(NOW), [member("p", null, "Priya"), member("m", NOW, "Marcus")], "me");
    expect(r.seenBy).toEqual(["Marcus"]);
  });

  it("allSeen is true only when every other member has seen it", () => {
    const r = computeReadReceipt(msg(NOW), [member("p", NOW, "Priya"), member("m", NOW, "Marcus")], "me");
    expect(r.allSeen).toBe(true);
  });

  it("handles missing profile names gracefully", () => {
    const r = computeReadReceipt(msg(NOW), [member("p", NOW)], "me");
    expect(r.seenBy).toEqual(["Someone"]);
  });
});

describe("readReceiptLabel", () => {
  it("returns empty when nobody has seen it", () => {
    expect(readReceiptLabel(computeReadReceipt(msg(NOW), [member("p", null)], "me"))).toBe("");
  });

  it("names up to maxNames then collapses the remainder", () => {
    const r = computeReadReceipt(
      msg(NOW),
      [
        member("a", NOW, "Ada"),
        member("b", NOW, "Ben"),
        member("c", NOW, "Cy"),
      ],
      "me",
    );
    expect(readReceiptLabel(r, 2)).toBe("Seen by Ada, Ben +1");
  });
});
