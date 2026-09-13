import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shared Playwright helpers for the E2E suite.
 *
 * The suite runs the app in DEMO MODE (in-browser store, simulated
 * streaming assistant), so every spec follows the same deterministic
 * preamble: reset the demo store → demo authenticate → reach the surface
 * being tested. No Supabase / network dependency.
 */

/** Demo store localStorage key (mirrors src/lib/data/demo-store.ts). */
const DEMO_KEY = "aichat.demo.v2";

/** Wipe the demo store so the in-browser seed is regenerated on next load. */
export async function resetDemo(page: Page): Promise<void> {
  await page.evaluate((key) => window.localStorage.removeItem(key), DEMO_KEY);
  await page.evaluate(() => window.localStorage.removeItem("aichat.theme"));
}

/**
 * Demo-authenticate. The login form is pre-filled in demo mode (you@example.com
 * / demo-password); we just submit it and wait for the dashboard.
 */
export async function demoSignIn(page: Page): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app");
  // Wait for the dashboard to actually render its session shell.
  await expect(page.getByRole("main")).toBeVisible();
}

/** Land on the dashboard as a signed-in demo user, with a fresh store. */
export async function gotoDashboard(page: Page): Promise<void> {
  await resetDemo(page);
  await demoSignIn(page);
}

/** Start a fresh 1:1 AI chat from the dashboard card and wait for navigation. */
export async function startAiChat(page: Page): Promise<void> {
  await page.getByRole("button", { name: /New AI chat/ }).click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);
  // Empty chat state is present once the composer is available.
  await expect(page.getByTestId("composer-input")).toBeVisible();
}

/**
 * Create a group room via the sidebar "New conversation" modal and wait for
 * navigation into the room.
 */
export async function createRoom(
  page: Page,
  opts: { name: string; topic?: string; aiMode?: "off" | "mention_only" | "auto" },
): Promise<void> {
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await page.getByRole("dialog", { name: "New conversation" }).waitFor();
  await page.getByRole("button", { name: /Group room/ }).click();

  const nameInput = page.getByLabel("Room name");
  await nameInput.fill(opts.name);
  if (opts.topic) {
    const topicInput = page.getByLabel(/Topic/);
    if (await topicInput.isVisible()) await topicInput.fill(opts.topic);
  }
  if (opts.aiMode && opts.aiMode !== "mention_only") {
    await page.getByRole("button", { name: new RegExp(opts.aiMode, "i") }).click();
  }

  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);
  await expect(page.getByTestId("composer-input")).toBeVisible();
}

/** The composer textarea exposed to the messages surface. */
export function composer(page: Page): Locator {
  return page.getByTestId("composer-input");
}

/** The message log region (role="log"). */
export function messageLog(page: Page): Locator {
  return page.locator('[role="log"]');
}

/** Type and send a message via the composer (Enter). */
export async function sendMessage(page: Page, text: string): Promise<void> {
  const box = composer(page);
  await box.fill(text);
  await box.press("Enter");
}

/** Wait until the assistant has finished streaming a reply into the log. */
export async function expectAssistantReply(page: Page): Promise<void> {
  // The demo assistant always ends its reply with a "Demo mode" note, which
  // only appears once the stream has fully flushed into the persisted row.
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 15_000 });
}

export { expect };
