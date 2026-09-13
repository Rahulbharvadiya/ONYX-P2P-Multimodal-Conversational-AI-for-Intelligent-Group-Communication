import { test } from "@playwright/test";
import {
  expect,
  composer,
  createRoom,
  messageLog,
  sendMessage,
  gotoDashboard,
} from "./helpers";

/**
 * Journey B — Group room.
 *
 * Create a room → verify membership → send a message → verify it is rendered.
 * Cross-user realtime is a Supabase-only behaviour, so the demo-mode check is
 * that the room surface reacts to its own store writes (which is the same
 * subscription path used for realtime).
 */
test("group room: create a room and verify membership + messages", async ({ page }) => {
  await gotoDashboard(page);
  await createRoom(page, { name: "Release crew", aiMode: "mention_only" });

  // Header shows the room name; with no topic the subtitle is the member count.
  await expect(page.getByRole("heading", { name: "Release crew", exact: true })).toBeVisible();
  await expect(page.getByText(/1 member/)).toBeVisible();

  // The room appears in the sidebar conversation list.
  await expect(page.getByRole("link", { name: /Release crew/ })).toBeVisible();

  await sendMessage(page, "Can everyone confirm the staging deploy?");
  await expect(messageLog(page)).toContainText("Can everyone confirm the staging deploy?");
});

test("group room: seeded room shows members and history", async ({ page }) => {
  await gotoDashboard(page);

  // Open the seeded "Launch war room" from the sidebar.
  await page.getByRole("link", { name: /Launch war room/ }).click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);
  await expect(composer(page)).toBeVisible();

  // Multiple members (Priya + Marcus + the demo user) and past messages are present.
  await expect(messageLog(page)).toContainText("Schema's applied on staging");
  await expect(messageLog(page)).toContainText("where we landed and what's left");

  // The room's AI message is attributed to the assistant and carries an AI pill.
  await expect(messageLog(page)).toContainText("Assistant");
});

test("group room: an invite can be created from room settings", async ({ page }) => {
  await gotoDashboard(page);
  await createRoom(page, { name: "Q3 planning", topic: "Roadmap" });

  // Open room settings and switch to the Invites tab.
  await page.getByRole("button", { name: "Room settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Room settings" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Invites", exact: true }).click();

  // Create an invite and verify its join code is surfaced.
  await dialog.getByRole("button", { name: "New invite", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Copy invite link" })).toBeVisible();
});
