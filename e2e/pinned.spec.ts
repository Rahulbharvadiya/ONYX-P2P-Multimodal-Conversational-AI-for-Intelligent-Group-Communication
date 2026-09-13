import { test } from "@playwright/test";
import { expect, gotoDashboard } from "./helpers";

/**
 * §3 pinned conversations.
 *
 * The pin is a per-member preference on the membership row, so the
 * behaviour that matters is: pin → the conversation moves into its own
 * group at the top of the sidebar → it survives a reload (i.e. it was
 * persisted, not just reordered in memory) → unpin puts it back.
 *
 * Runs in demo mode like the rest of the suite — no Supabase.
 */

const SEEDED_ROOM = "Launch war room";

/** The group wrapper the sidebar renders around each list section. */
function group(page: import("@playwright/test").Page, label: string) {
  return page.locator(`[data-testid="conversation-group"][data-group="${label}"]`);
}

test("pinning a conversation floats it into the Pinned group", async ({ page }) => {
  await gotoDashboard(page);

  // Before: the seeded room lives under "Rooms" and there is no Pinned group.
  await expect(group(page, "Rooms").getByRole("link", { name: new RegExp(SEEDED_ROOM) })).toBeVisible();
  await expect(group(page, "Pinned")).toHaveCount(0);

  await page.getByRole("button", { name: `Pin ${SEEDED_ROOM}` }).click();

  const pinned = group(page, "Pinned");
  await expect(pinned).toBeVisible();
  await expect(pinned.getByRole("link", { name: new RegExp(SEEDED_ROOM) })).toBeVisible();
  // …and it is no longer in its type group.
  await expect(group(page, "Rooms")).toHaveCount(0);
});

test("a pin survives a reload (it is persisted, not just reordered)", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: `Pin ${SEEDED_ROOM}` }).click();
  await expect(group(page, "Pinned").getByRole("link", { name: new RegExp(SEEDED_ROOM) })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(group(page, "Pinned").getByRole("link", { name: new RegExp(SEEDED_ROOM) })).toBeVisible();
});

test("the pin button is a toggle with correct pressed state", async ({ page }) => {
  await gotoDashboard(page);

  const pin = page.getByRole("button", { name: `Pin ${SEEDED_ROOM}` });
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await pin.click();

  const unpin = page.getByRole("button", { name: `Unpin ${SEEDED_ROOM}` });
  await expect(unpin).toHaveAttribute("aria-pressed", "true");

  await unpin.click();
  await expect(page.getByRole("button", { name: `Pin ${SEEDED_ROOM}` })).toBeVisible();
  await expect(group(page, "Pinned")).toHaveCount(0);
  await expect(group(page, "Rooms").getByRole("link", { name: new RegExp(SEEDED_ROOM) })).toBeVisible();
});

test("pinning one conversation leaves the others alone", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: `Pin ${SEEDED_ROOM}` }).click();

  await expect(group(page, "Pinned").getByRole("link")).toHaveCount(1);
  // The seeded 1:1 chat is still listed under its own group.
  await expect(group(page, "Direct AI chats").getByRole("link")).toHaveCount(1);
});
