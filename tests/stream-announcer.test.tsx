/**
 * §10 — batched aria-live announcements.
 * The requirement is explicitly "batched … not per-token", so the thing
 * worth testing is that N deltas do NOT produce N announcements.
 *
 *   npx vitest run tests/stream-announcer.test.tsx
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { StreamAnnouncer } from "../src/components/chat/stream-announcer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function live(container: HTMLElement) {
  return container.querySelector('[aria-live="polite"]')!;
}

describe("StreamAnnouncer (§10)", () => {
  it("exposes a polite, atomic live region that is visually hidden", () => {
    const { container } = render(<StreamAnnouncer text="" active={false} />);
    const region = live(container);
    expect(region).toBeTruthy();
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(region.className).toContain("sr-only");
  });

  it("announces the start of a response rather than staying silent", () => {
    const { container } = render(<StreamAnnouncer text="" active />);
    expect(live(container).textContent).toBe("Assistant is responding.");
  });

  it("does NOT announce once per token — many deltas, at most one batch/sec", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<StreamAnnouncer text="" active />);

    const words = "the quick brown fox jumps over the lazy dog and keeps running".split(" ");
    let acc = "";

    // 12 separate deltas inside a single batch window.
    act(() => {
      for (const w of words) {
        acc += `${w} `;
        rerender(<StreamAnnouncer text={acc} active />);
      }
      vi.advanceTimersByTime(999);
    });

    // Still the opening announcement — no per-token chatter.
    expect(live(container).textContent).toBe("Assistant is responding.");

    // After the window elapses, one consolidated batch.
    act(() => {
      vi.advanceTimersByTime(2);
    });
    const batched = live(container).textContent ?? "";
    expect(batched).toContain("quick brown fox");
    expect(batched.split(" ").length).toBeGreaterThan(5);
  });

  it("never announces a partial word", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<StreamAnnouncer text="" active />);

    act(() => {
      rerender(<StreamAnnouncer text="internatio" active />);
      vi.advanceTimersByTime(1001);
    });

    // No word boundary yet, so nothing new is spoken.
    expect(live(container).textContent).toBe("Assistant is responding.");
  });

  it("flushes the remaining tail and confirms completion when the stream ends", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<StreamAnnouncer text="" active />);

    act(() => {
      rerender(<StreamAnnouncer text="All done here" active />);
    });
    act(() => {
      rerender(<StreamAnnouncer text="All done here" active={false} />);
    });

    const final = live(container).textContent ?? "";
    expect(final).toContain("All done here");
    expect(final).toContain("Response complete.");
  });
});
