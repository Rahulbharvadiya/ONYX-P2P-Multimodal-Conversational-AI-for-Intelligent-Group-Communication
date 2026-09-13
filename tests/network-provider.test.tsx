import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkProvider, useNetworkStatus } from "@/components/network-provider";

function Probe() {
  const { status } = useNetworkStatus();
  return <output data-testid="status">{status}</output>;
}

function renderProbe() {
  return render(
    <NetworkProvider>
      <Probe />
    </NetworkProvider>,
  );
}

describe("NetworkProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom defaults navigator.onLine to true.
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts online when the browser reports a connection", () => {
    renderProbe();
    expect(screen.getByTestId("status").textContent).toBe("online");
  });

  it("goes offline when the offline event fires", () => {
    renderProbe();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("status").textContent).toBe("offline");
  });

  it("shows reconnecting, then settles on online after a beat", () => {
    renderProbe();
    act(() => {
      Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("status").textContent).toBe("offline");

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByTestId("status").textContent).toBe("reconnecting");

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByTestId("status").textContent).toBe("online");
  });

  it("starts offline if initial navigator.onLine is false", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    renderProbe();
    expect(screen.getByTestId("status").textContent).toBe("offline");
  });
});
