import { test } from "@playwright/test";
import { expect, gotoDashboard } from "./helpers";

/**
 * §3 settings: profile, appearance, privacy & data.
 *
 * Covers the two behaviours that are easy to regress silently: the training
 * opt-in must default to OFF and stay OFF unless it is explicitly saved,
 * and "Export my data" must actually produce a file the user can read.
 */

test("settings: training opt-in defaults to off and persists when saved", async ({ page }) => {
  await gotoDashboard(page);
  await page.goto("/app/settings");

  const training = page.getByRole("checkbox", { name: /Allow training on my conversations/i });
  await expect(training).toBeVisible();
  await expect(training).not.toBeChecked();

  // Toggling alone must not write — the Save button is what commits.
  await training.check();
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: /Allow training on my conversations/i }),
  ).toBeChecked();

  // …and it can be turned back off again.
  await page.getByRole("checkbox", { name: /Allow training on my conversations/i }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: /Allow training on my conversations/i }),
  ).not.toBeChecked();
});

test("settings: a display name shorter than two characters is rejected", async ({ page }) => {
  await gotoDashboard(page);
  await page.goto("/app/settings");

  const name = page.getByLabel("Display name");
  await name.fill("A");
  await page.getByRole("button", { name: "Save changes" }).first().click();

  await expect(page.getByText("Name is too short")).toBeVisible();
});

test("settings: Export my data downloads a readable JSON archive", async ({ page }) => {
  await gotoDashboard(page);
  await page.goto("/app/settings");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export my data/ }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^onyx-export-\d{4}-\d{2}-\d{2}\.json$/);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const archive = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  expect(archive.version).toBe(1);
  expect(Array.isArray(archive.conversations)).toBe(true);
  expect(archive.conversations.length).toBe(2);
  // The seeded room and its messages survive the round-trip.
  const room = archive.conversations.find((c: { type: string }) => c.type === "group");
  expect(room.name).toBe("Launch war room");
  expect(room.messages.length).toBeGreaterThanOrEqual(4);
});
