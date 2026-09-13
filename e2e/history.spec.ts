import { test } from "@playwright/test";
import { expect, gotoDashboard, messageLog } from "./helpers";

/**
 * History.
 *
 * A previous conversation is listed, opens intact, and its messages survive a
 * reload — the demo store is the source of truth, so nothing is lost.
 */
test("history: a previous conversation appears and persists across a reload", async ({ page }) => {
  await gotoDashboard(page);

  // The seeded direct chat is listed in the sidebar.
  const previous = page.getByRole("link", { name: /New chat/ });
  await expect(previous).toBeVisible();
  await previous.click();

  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);

  // The conversation opens with its persisted human + assistant messages.
  await expect(messageLog(page)).toContainText("Explain row level security");
  await expect(messageLog(page)).toContainText("Assistant");

  // Reload: the conversation is re-read from storage and nothing is lost.
  await page.reload();
  await expect(messageLog(page)).toContainText("Explain row level security");
  await expect(messageLog(page)).toContainText("RLS in one breath");
});

test("history: navigating from the dashboard back into a room keeps state", async ({ page }) => {
  await gotoDashboard(page);

  await page.getByRole("link", { name: /Launch war room/ }).click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);
  await expect(messageLog(page)).toContainText("where we landed and what's left");

  // Leave and return — state is re-read from the store each time.
  await page.goto("/app");
  await page.getByRole("link", { name: /Launch war room/ }).click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);
  await expect(messageLog(page)).toContainText("where we landed and what's left");
});
