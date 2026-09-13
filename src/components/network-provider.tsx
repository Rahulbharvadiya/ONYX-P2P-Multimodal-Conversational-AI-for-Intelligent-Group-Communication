"use client";

import * as React from "react";

/**
 * Network connectivity state (§27 offline experience).
 *
 * Exposes a three-state connection status the UI can react to:
 *   - "online"        the browser reports a connection and we're settled
 *   - "offline"       the browser reports no connection
 *   - "reconnecting"  the browser just came back online but we're still
 *                     re-establishing (a short, honest beat before we claim
 *                     "online" again)
 *
 * It listens to the browser `online` / `offline` events and `navigator.onLine`.
 * Consumers use `useNetworkStatus()` to drive the offline banner and to avoid
 * pretending a network-dependent operation (e.g. sending a message to the real
 * Supabase backend) succeeded while the connection is down.
 */
type Status = "online" | "offline" | "reconnecting";

interface Ctx {
  status: Status;
  /** True when the connection is not usable (offline or reconnecting). */
  unavailable: boolean;
}

const NetworkCtx = React.createContext<Ctx>({
  status: "online",
  unavailable: false,
});

export const useNetworkStatus = () => React.useContext(NetworkCtx);

const STABLE_MS = 1500; // how long we show "reconnecting" before "online"

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>(
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online",
  );
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const goOffline = () => {
      if (timer.current) clearTimeout(timer.current);
      setStatus("offline");
    };
    const goOnline = () => {
      // Coming back online is not instant — show a short "reconnecting"
      // beat, then settle on "online" once nothing flapped.
      setStatus("reconnecting");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("online"), STABLE_MS);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ status, unavailable: status !== "online" }),
    [status],
  );

  return <NetworkCtx.Provider value={value}>{children}</NetworkCtx.Provider>;
}