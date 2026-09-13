import { test } from "@playwright/test";
import { expect, gotoDashboard } from "./helpers";

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * Open it, navigate by keyboard, switch theme, create a room, sign out, and
 * confirm Escape closes it.
 */
test("palette: opens with Ctrl+K and closes with Escape", async ({ page }) => {
  await gotoDashboard(page);

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  // Escape dismisses without any navigation.
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("palette: keyboard navigation runs a command", async ({ page }) => {
  await gotoDashboard(page);

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  // Filter to the settings command and run it.
  await page.getByLabel("Command palette input").fill("Open settings");
  await page.keyboard.press("Enter");

  await page.waitForURL("**/app/settings");
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
});

test("palette: switches theme to dark", async ({ page }) => {
  await gotoDashboard(page);

  await page.keyboard.press("Control+k");
  await page.getByLabel("Command palette input").fill("dark");
  await page.keyboard.press("Enter");

  // The root element picks up the `.dark` class.
  await expect(page.locator("html")).toHaveClass(/dark/);

  // The theme toggle reflects the resolved dark state.
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});

test("palette: create a room action opens the room modal", async ({ page }) => {
  await gotoDashboard(page);

  await page.keyboard.press("Control+k");
  await page.getByLabel("Command palette input").fill("room");
  await page.keyboard.press("Enter");

  // The palette's "Create a room" action opens the new-conversation modal.
  await expect(page.getByRole("dialog", { name: "New conversation" })).toBeVisible();
});

test("palette: sign out returns to the landing page", async ({ page }) => {
  await gotoDashboard(page);

  await page.keyboard.press("Control+k");
  await page.getByLabel("Command palette input").fill("sign out");
  await page.keyboard.press("Enter");

  await page.waitForURL(/\/$/);
  // Landing hero CTA confirms we're on the public site. It is a link-styled
  // navigation (single <a>, not a button-in-link) — see Button `asChild`.
  await expect(page.getByRole("link", { name: /Start chatting/i })).toBeVisible();
});
