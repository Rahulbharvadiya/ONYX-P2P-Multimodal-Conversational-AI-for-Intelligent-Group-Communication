"use client";

import * as React from "react";

/**
 * §10: `aria-live="polite"` BATCHED announcements for streamed tokens.
 *
 * Announcing every delta would flood a screen reader — the spec explicitly
 * requires batching ("not per-token"). So we buffer and speak roughly once
 * per second, and flush whatever is left when the stream ends.
 *
 * Only the *newly arrived* slice is announced each tick; assistive tech
 * re-reads the whole node on change, so emitting the cumulative buffer
 * would repeat the entire answer on every update.
 *
 * Renders nothing visible.
 */
const BATCH_MS = 1000;

export function StreamAnnouncer({ text, active }: { text: string; active: boolean }) {
  const [announcement, setAnnouncement] = React.useState("");

  // Latest full buffer. Only ever grows during a stream, so a parent
  // clearing `text` on completion can't wipe the pending tail.
  const bufferRef = React.useRef("");
  const announcedTo = React.useRef(0);

  React.useEffect(() => {
    if (text.length > 0) bufferRef.current = text;
  }, [text]);

  // While streaming: announce the new slice about once a second.
  React.useEffect(() => {
    if (!active) return;

    bufferRef.current = "";
    announcedTo.current = 0;
    setAnnouncement("Assistant is responding.");

    const id = setInterval(() => {
      const full = bufferRef.current;
      if (full.length <= announcedTo.current) return;

      // Cut at the last sentence/word boundary so we never announce a
      // half-word; the remainder rides along with the next batch.
      const pending = full.slice(announcedTo.current);
      const lastBreak = Math.max(
        pending.lastIndexOf(". "),
        pending.lastIndexOf("\n"),
        pending.lastIndexOf(" "),
      );
      if (lastBreak <= 0) return;

      const chunk = pending.slice(0, lastBreak + 1).trim();
      announcedTo.current += lastBreak + 1;
      if (chunk) setAnnouncement(chunk);
    }, BATCH_MS);

    return () => clearInterval(id);
  }, [active]);

  // On completion: flush the unannounced tail and confirm the end.
  React.useEffect(() => {
    if (active) return;
    const full = bufferRef.current;
    if (!full) return;

    const rest = full.slice(announcedTo.current).trim();
    announcedTo.current = full.length;
    bufferRef.current = "";
    setAnnouncement(rest ? `${rest}. Response complete.` : "Response complete.");
  }, [active]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}