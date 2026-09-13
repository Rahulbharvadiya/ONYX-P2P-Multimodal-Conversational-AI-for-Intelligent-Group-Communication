/**
 * Shared harness for the axe-core accessibility suite (§2.6 / §11).
 *
 * Scope note: these run in **jsdom**, which loads no CSS — so structural
 * rules (roles, labels, names, landmarks, ARIA validity, focus order
 * semantics) are enforced here, while color-contrast needs a real browser
 * and is covered by the Playwright phase (axe against the rendered app).
 */
import { expect } from "vitest";
import * as axeModule from "axe-core";
import type { AxeResults, RuleObject } from "axe-core";
import type { Message, Profile, Reaction } from "../../src/lib/types";

type AxeRun = (context: HTMLElement, options?: { rules?: RuleObject }) => Promise<AxeResults>;

/**
 * axe-core's export shape differs across CJS/ESM interop modes (callable in
 * some bundlers, an object exposing `.run` in others) — normalize it once.
 */
const axe: AxeRun = (() => {
  const m = axeModule as unknown as {
    axe?: AxeRun;
    default?: AxeRun | { run?: AxeRun };
  };
  if (typeof m.axe === "function") return m.axe;
  const d = m.default;
  if (typeof d === "function") return d;
  if (d && typeof d.run === "function") return d.run;
  throw new Error("could not resolve a runnable axe-core export");
})();

/** jsdom lacks matchMedia; ThemeProvider and friends need it. */
export function stubMatchMedia() {
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
}

export function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    display_name: "Ada Lovelace",
    avatar_url: null,
    theme_pref: "system",
    training_opt_in: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function message(over: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversation_id: "c1",
    sender_id: "u1",
    sender_type: "human",
    content: "Hello there",
    content_format: "text",
    status: "sent",
    supersedes_id: null,
    created_at: "2026-01-01T12:00:00Z",
    edited_at: null,
    deleted_at: null,
    ...over,
  };
}

export function reactions(...rs: Array<[string, string, string]>): Reaction[] {
  return rs.map(([message_id, user_id, emoji]) => ({
    message_id,
    user_id,
    emoji,
    created_at: "2026-01-01T12:00:01Z",
  }));
}

function format(results: AxeResults): string {
  return results.violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    ${n.html} [${String(n.target)}]`).join("\n");
      return `  ✗ [${v.id}] ${v.help}\n${nodes}`;
    })
    .join("\n");
}

/**
 * Assert an element has no axe violations.
 * `rules` can relax specific rules when a jsdom artifact (not a real app
 * defect) triggers them — each such use must be justified in a comment
 * at the call site.
 */
export async function expectNoA11yViolations(
  element: HTMLElement,
  rules: RuleObject = {},
) {
  const results = await axe(element, { rules });
  expect.soft(results.violations, `axe violations:\n${format(results)}\n`).toEqual([]);
  return results;
}
