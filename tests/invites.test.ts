import { beforeEach, describe, expect, it } from "vitest";
import { consumeInvite, createConversation } from "../src/lib/data/api";
import { demo, DEMO_USER_ID } from "../src/lib/data/demo-store";

describe("consumeInvite", () => {
  beforeEach(() => {
    demo.reset();
  });

  it("throws invite_not_found for empty code", async () => {
    await expect(consumeInvite("")).rejects.toThrow("invite_not_found");
    await expect(consumeInvite("   ")).rejects.toThrow("invite_not_found");
  });

  it("throws invite_not_found when code does not exist", async () => {
    await expect(consumeInvite("nonexistent-code")).rejects.toThrow("invite_not_found");
  });

  it("successfully redeems a valid invite and joins the conversation", async () => {
    const db = demo.db();
    const convId = "conv-test-room";
    db.conversations.push({
      id: convId,
      type: "group",
      name: "Alpha Room",
      topic: "Testing invites",
      ai_mode: "mention_only",
      created_by: "other-user",
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    // Add invite
    db.invites.push({
      id: "inv-1",
      conversation_id: convId,
      code: "alphacode",
      created_by: "other-user",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      max_uses: 10,
      uses: 0,
      created_at: new Date().toISOString(),
    });
    demo.commit();

    const res = await consumeInvite("alphacode");
    expect(res.conversation.id).toBe(convId);
    expect(res.conversation.name).toBe("Alpha Room");

    // Verify member was added in db
    const currentDb = demo.db();
    const member = currentDb.members.find(
      (m) => m.conversation_id === convId && m.user_id === DEMO_USER_ID,
    );
    expect(member).toBeDefined();
    expect(member?.role).toBe("member");

    // Verify uses count increased
    const invite = currentDb.invites.find((i) => i.code === "alphacode");
    expect(invite?.uses).toBe(1);
  });

  it("is idempotent if already a member", async () => {
    const db = demo.db();
    const convId = "conv-test-room-2";
    db.conversations.push({
      id: convId,
      type: "group",
      name: "Beta Room",
      topic: null,
      ai_mode: "off",
      created_by: "other-user",
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    db.members.push({
      conversation_id: convId,
      user_id: DEMO_USER_ID,
      role: "member",
      joined_at: new Date().toISOString(),
      last_read_at: null,
      pinned_at: null,
    });
    db.invites.push({
      id: "inv-2",
      conversation_id: convId,
      code: "betacode",
      created_by: "other-user",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      max_uses: 10,
      uses: 1,
      created_at: new Date().toISOString(),
    });
    demo.commit();

    const res = await consumeInvite("betacode");
    expect(res.conversation.id).toBe(convId);
    // Uses should not increment again for existing member
    const currentDb = demo.db();
    const invite = currentDb.invites.find((i) => i.code === "betacode");
    expect(invite?.uses).toBe(1);
  });

  it("throws invite_expired for expired invites", async () => {
    const db = demo.db();
    const convId = "conv-expired-room";
    db.conversations.push({
      id: convId,
      type: "group",
      name: "Expired Room",
      topic: null,
      ai_mode: "off",
      created_by: "other-user",
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    db.invites.push({
      id: "inv-expired",
      conversation_id: convId,
      code: "oldcode",
      created_by: "other-user",
      expires_at: new Date(Date.now() - 10000).toISOString(), // expired
      max_uses: 10,
      uses: 0,
      created_at: new Date(Date.now() - 20000).toISOString(),
    });
    demo.commit();

    await expect(consumeInvite("oldcode")).rejects.toThrow("invite_expired");
  });

  it("throws invite_exhausted when max_uses reached", async () => {
    const db = demo.db();
    const convId = "conv-exhausted-room";
    db.conversations.push({
      id: convId,
      type: "group",
      name: "Exhausted Room",
      topic: null,
      ai_mode: "off",
      created_by: "other-user",
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    db.invites.push({
      id: "inv-exhausted",
      conversation_id: convId,
      code: "fullcode",
      created_by: "other-user",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      max_uses: 5,
      uses: 5, // fully used
      created_at: new Date().toISOString(),
    });
    demo.commit();

    await expect(consumeInvite("fullcode")).rejects.toThrow("invite_exhausted");
  });
});
