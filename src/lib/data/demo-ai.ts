"use client";

/**
 * Simulated assistant used only in DEMO MODE. Produces a plausible,
 * context-aware markdown reply and streams it token-by-token at a
 * realistic cadence so the streaming UI (caret, stop, regenerate) is
 * exercised exactly as it will be against the real Edge Function.
 */
import { classifyLocal } from "./moderation-local";

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function composeDemoReply(prompt: string, isGroup: boolean, roomName?: string | null): string {
  const clean = prompt.replace(/@ai\b/gi, "").trim();
  const h = hash(clean.toLowerCase());
  const topic = clean.length > 80 ? clean.slice(0, 77) + "…" : clean || "that";

  if (/^(hi|hey|hello|yo)\b/i.test(clean)) {
    return isGroup
      ? `Hey — I'm listening in on **${roomName ?? "this room"}**. Mention me with \`@ai\` whenever you want me to weigh in.`
      : `Hey! What are we working on?`;
  }

  if (/\?$/.test(clean) || /^(what|why|how|when|who|can|should|is|are|does)\b/i.test(clean)) {
    return [
      `**Short answer:** ${pick(
        [
          "yes, with one caveat.",
          "it depends on where the boundary sits.",
          "no — and the reason is more interesting than the answer.",
        ],
        h,
      )}`,
      ``,
      `On *${topic}* — here's how I'd break it down:`,
      ``,
      `1. **The constraint that actually matters.** Most of the complexity here is downstream of one decision; name it first and the rest falls out.`,
      `2. **The cheap experiment.** Before committing, there's usually a 20-minute version that tells you 80% of what the full build would.`,
      `3. **The failure mode.** ${pick(
        [
          "The thing that bites people is state that lives in two places at once.",
          "Watch for the case where the happy path and the retry path disagree.",
          "The edge case is the empty state — it's almost never designed.",
        ],
        h >> 3,
      )}`,
      ``,
      `> Running in **Demo mode** — this reply is generated locally. Connect Supabase and set \`OPENROUTER_API_KEY\` to stream from the real model.`,
    ].join("\n");
  }

  if (isGroup) {
    return [
      `Picking up on *${topic}*:`,
      ``,
      `- **Where the room agrees:** the direction is settled; it's the sequencing that's open.`,
      `- **Where it doesn't:** someone should own the call on scope, otherwise this thread reopens tomorrow.`,
      `- **Suggested next step:** timebox it, ship the narrow version, and revisit with real usage data.`,
      ``,
      `> Demo mode — generated locally, not from the model.`,
    ].join("\n");
  }

  return [
    `Got it — on *${topic}*.`,
    ``,
    `Here's the shape of it:`,
    ``,
    `- **Start with the smallest thing that's actually true.** Broad framing tends to hide the decision.`,
    `- **Make the tradeoff explicit.** ${pick(
      ["Speed vs. reversibility.", "Simplicity vs. coverage.", "Consistency vs. latency."],
      h,
    )} Pick one on purpose.`,
    `- **Then write it down.** Whatever you choose, the note-to-future-you is worth more than the choice.`,
    ``,
    `Want me to go deeper on any of these?`,
    ``,
    `> Demo mode — generated locally. Connect Supabase for real streaming.`,
  ].join("\n");
}

export interface DemoStreamHandle {
  cancel: () => void;
}

export function streamDemoReply(
  text: string,
  onDelta: (chunk: string) => void,
  onDone: (full: string, blocked: boolean, reason?: string) => void,
): DemoStreamHandle {
  let cancelled = false;
  // Tokenise on word boundaries so the reveal looks like real generation.
  const tokens = text.match(/\S+\s*/g) ?? [text];
  let i = 0;
  let acc = "";

  const tick = () => {
    if (cancelled) return;
    if (i >= tokens.length) {
      const verdict = classifyLocal(acc);
      onDone(acc, verdict.verdict !== "pass", verdict.reason);
      return;
    }
    // burst 1–3 tokens per frame for a natural cadence
    const burst = 1 + Math.floor(Math.random() * 3);
    for (let b = 0; b < burst && i < tokens.length; b++, i++) {
      acc += tokens[i];
      onDelta(tokens[i]);
    }
    setTimeout(tick, 18 + Math.random() * 42);
  };

  setTimeout(tick, 260 + Math.random() * 280); // "thinking" beat
  return {
    cancel() {
      cancelled = true;
      onDone(acc, false);
    },
  };
}
