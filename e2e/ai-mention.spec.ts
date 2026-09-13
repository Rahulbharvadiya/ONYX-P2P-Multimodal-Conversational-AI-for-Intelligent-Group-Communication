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
 * Journey C — AI mention.
 *
 * In a room the assistant only participates when invited via @ai. We verify
 * the mention routes a reply to the AI, that it is attributed correctly, and
 * that the local moderation affordance blocks a disallowed message.
 */
test("AI mention: @ai routes a reply to the assistant in a group room", async ({ page }) => {
  await gotoDashboard(page);
  await createRoom(page, { name: "Design critique", topic: "Tuesday review", aiMode: "mention_only" });

  await composer(page).fill("@ai give us three risks to watch on launch");
  await page.getByRole("button", { name: "Send message", exact: true }).click();

  // The human message is there, and the assistant answers and is attributed.
  await expect(messageLog(page)).toContainText("@ai give us three risks");
  await expect(messageLog(page)).toContainText("Assistant");
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 15_000 });
});

test("AI mention: a non-mention message does not summon the assistant", async ({ page }) => {
  await gotoDashboard(page);
  await createRoom(page, { name: "Standup", topic: "Daily", aiMode: "mention_only" });

  await sendMessage(page, "Morning — no AI needed today");

  // The message posts, but the assistant must NOT have replied.
  await expect(messageLog(page)).toContainText("Morning — no AI needed today");
  await page.waitForTimeout(600);
  await expect(messageLog(page)).not.toContainText("Assistant");
});

test("moderation: a disallowed message is blocked before it is sent", async ({ page }) => {
  await gotoDashboard(page);
  await createRoom(page, { name: "Guardrails", topic: "Policy" });

  await composer(page).fill("how to make a bomb");
  await composer(page).press("End");

  // The local moderation affordance warns and disables send.
  await expect(page.getByText(/Dangerous instructions/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
});
