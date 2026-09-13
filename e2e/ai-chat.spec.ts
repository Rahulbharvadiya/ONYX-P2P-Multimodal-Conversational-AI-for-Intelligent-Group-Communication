import { test } from "@playwright/test";
import {
  expect,
  composer,
  messageLog,
  startAiChat,
  gotoDashboard,
} from "./helpers";

/**
 * Journey A — AI chat.
 *
 * Authenticate → start a conversation → send a message → watch the assistant
 * stream its reply → verify the reply is persisted → reload → verify it is
 * still there.
 */
test("AI chat: send a message and a companion reply streams in", async ({ page }) => {
  await gotoDashboard(page);
  await startAiChat(page);

  // Empty chat state is shown before any message.
  await expect(page.getByRole("heading", { name: /What's on your mind/i })).toBeVisible();

  await composer(page).fill("What is a monad and why does it matter?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();

  // The human message is rendered immediately.
  await expect(messageLog(page)).toContainText("What is a monad");

  // The assistant streams a reply; its final "Demo mode" note only appears
  // once the whole reply has been persisted, so this also proves streaming
  // completed and the row was finalised.
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 15_000 });

  // Attribution: the reply must be authored by the assistant, not the user.
  await expect(messageLog(page)).toContainText("Assistant");
});

test("AI chat: assistant reply survives a refresh (persistence)", async ({ page }) => {
  await gotoDashboard(page);
  await startAiChat(page);

  await composer(page).fill("Summarise the tradeoffs.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 15_000 });

  // Reload: the conversation is re-read from the demo store, not a network.
  await page.reload();
  await expect(page.getByTestId("composer-input")).toBeVisible();
  await expect(messageLog(page)).toContainText("Summarise the tradeoffs.");
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 15_000 });
});

test("AI chat: the composer stays usable after a reply", async ({ page }) => {
  await gotoDashboard(page);
  await startAiChat(page);

  await composer(page).fill("Give me one good idea.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 15_000 });

  // After the stream completes the send control returns and input is editable.
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  await expect(composer(page)).toBeEnabled();
});
