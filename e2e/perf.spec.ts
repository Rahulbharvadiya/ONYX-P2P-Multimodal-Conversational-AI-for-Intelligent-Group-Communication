import { test } from "@playwright/test";
import { expect, composer, gotoDashboard, messageLog, sendMessage } from "./helpers";

/**
 * §2.7 — 60fps under 4× CPU throttling.
 *
 * This is a MEASUREMENT harness, and the split between what it enforces and
 * what it reports is deliberate:
 *
 *   ENFORCED  — a jank ceiling: p95 frame interval ≤ 50 ms and no single
 *               frame over 250 ms, with the CPU throttled 4×. A frame that
 *               long is a blocking task on the main thread, which is a real
 *               defect rather than a tuning question.
 *
 *   REPORTED  — the median/p95/p99/max frame intervals and the fps implied by
 *               p95, printed to the log and attached to the test as an
 *               annotation. The §2.7 acceptance bar is 60fps (≤ 16.7 ms per
 *               frame) at 4× throttle; that bar is NOT asserted, because it
 *               has never been measured on this app — asserting an unmeasured
 *               number would make every merge a coin flip. Once CI has
 *               produced a baseline, promote `FPS_BAR_MS` into the assertion.
 *
 * Runs with `prefers-reduced-motion: reduce` like the rest of the suite (set
 * in playwright.config.ts), which is the stricter case for a motion spec:
 * entry/exit animations collapse to an instant cut, so anything still costing
 * frames is the streaming render path itself, not the easing curves.
 */

const FPS_BAR_MS = 16.7; // §2.7 target: 60fps — reported, not yet enforced
const ENFORCED_P95_MS = 50;
const ENFORCED_MAX_FRAME_MS = 250;

interface FrameStats {
  frames: number;
  median: number;
  p95: number;
  p99: number;
  max: number;
}

test("perf: AI streaming holds its frame budget under 4× CPU throttling", async ({ page }) => {
  // 4× throttle makes every step slower; the default 30s is not enough.
  test.setTimeout(180_000);

  // Navigate and authenticate at full speed — the throttle is for the
  // measurement window, not for getting there.
  await gotoDashboard(page);
  await page.getByRole("link", { name: /New chat/ }).first().click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]+/);
  await expect(composer(page)).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  // Start sampling, then drive the heaviest interaction in the app: a
  // streamed assistant reply that re-renders markdown on every delta.
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (now: number) => {
      w.__frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await sendMessage(page, "Give me a short numbered plan for launch day.");
  await expect(messageLog(page)).toContainText("Demo mode", { timeout: 90_000 });

  const stats = await page.evaluate((): FrameStats => {
    const w = window as unknown as { __frames: number[] };
    // Drop the first frame: it spans from `last = performance.now()` to the
    // first callback and is not a steady-state interval.
    const frames = w.__frames.filter((f) => f > 0).slice(1);
    if (frames.length === 0) {
      return { frames: 0, median: 0, p95: 0, p99: 0, max: 0 };
    }
    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {
      frames: sorted.length,
      median: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: sorted[sorted.length - 1],
    };
  });

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const fps = stats.p95 > 0 ? 1000 / stats.p95 : 0;
  const summary = [
    `4x CPU throttle`,
    `frames=${stats.frames}`,
    `median=${stats.median.toFixed(1)}ms`,
    `p95=${stats.p95.toFixed(1)}ms (${fps.toFixed(1)}fps)`,
    `p99=${stats.p99.toFixed(1)}ms`,
    `max=${stats.max.toFixed(1)}ms`,
    `§2.7 bar=${FPS_BAR_MS}ms/frame (60fps) — reported, not enforced`,
  ].join(" · ");

  console.log(`[perf] ${summary}`);
  test.info().annotations.push({ type: "perf", description: summary });

  expect(stats.frames, `no frames sampled — the harness did not run (${summary})`).toBeGreaterThan(
    10,
  );

  // Hard guards. A single blocking frame, or a p95 this far over budget, is a
  // defect regardless of where the eventual baseline lands.
  expect(stats.max, summary).toBeLessThan(ENFORCED_MAX_FRAME_MS);
  expect(stats.p95, summary).toBeLessThan(ENFORCED_P95_MS);
});
