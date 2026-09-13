import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect, resetDemo, demoSignIn, startAiChat } from "./helpers";

/**
 * Real-browser accessibility audit (axe-core) — §4.
 *
 * Runs axe through Chromium over the public pages and the signed-in app
 * surfaces, in BOTH light and dark themes. We do NOT disable any rule: every
 * WCAG AA violation (including colour-contrast) is surfaced and must be fixed.
 * The `expect` message names the page + theme so a failure is actionable.
 */

const PUBLIC_PAGES = ["/", "/pricing", "/login", "/signup", "/forgot-password", "/changelog"];

async function scan(page: import("@playwright/test").Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    `${label} — axe violations: ${results.violations
      .map((v) => `${v.id}(${v.nodes.length})`)
      .join(", ")}`,
  ).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe: public pages have no violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await scan(page, `${colorScheme} · ${path}`);
    }
  });

  test(`axe: app surfaces have no violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await resetDemo(page);
    await demoSignIn(page);

    const surfaces: Array<() => Promise<void>> = [
      async () => {
        await page.goto("/app");
      },
      async () => {
        await page.goto("/app/settings");
      },
      async () => {
        await page.goto("/app");
        await startAiChat(page);
      },
    ];

    for (const go of surfaces) {
      await go();
      await page.waitForLoadState("load");
      await scan(page, `${colorScheme} · ${page.url()}`);
    }
  });
}
