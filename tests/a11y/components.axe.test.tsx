/**
 * §2.6 / §11 — axe-core accessibility audit of the primary UI surfaces.
 *
 * Runs in CI as part of `npm test` (vitest sweeps every tests/ directory),
 * so it is merge-blocking, matching the "axe-core in CI" acceptance item.
 *
 * jsdom caveat (documented in helpers.ts): structural rules only —
 * color-contrast lands with the Playwright/Chromium phase.
 *
 *   npm run test:a11y
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { ThemeProvider } from "../../src/components/theme-provider";
import { AuthShell } from "../../src/components/auth/auth-shell";
import { OAuthButtons, OrDivider } from "../../src/components/auth/oauth-buttons";
import { Button } from "../../src/components/ui/button";
import { Field, Input } from "../../src/components/ui/input";
import { MessageItem } from "../../src/components/chat/message-item";
import { Composer } from "../../src/components/chat/composer";
import { Modal } from "../../src/components/ui/modal";
import { CommandPalette } from "../../src/components/layout/command-palette";
import { Sidebar } from "../../src/components/layout/sidebar";
import { StreamAnnouncer } from "../../src/components/chat/stream-announcer";
import { ThemeSegmented } from "../../src/components/theme-provider";
import type { ConversationMember, ConversationSummary } from "../../src/lib/types";
import { expectNoA11yViolations, message, profile, reactions, stubMatchMedia } from "./helpers";

stubMatchMedia();

// The components under test navigate on action; axe only inspects the DOM,
// so a inert router mock is enough to satisfy next/navigation consumers.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** The login screen's real structure: AuthShell + labelled form + OAuth. */
function renderLoginForm() {
  return render(
    <ThemeProvider>
      <AuthShell title="Log in" subtitle="Welcome back." footer={<a href="/signup">Need an account?</a>}>
        <form className="space-y-4">
          <Field id="email" label="Email" error="Enter a valid email address.">
            <Input id="email" type="email" defaultValue="you@example.com" />
          </Field>
          <Field id="password" label="Password">
            <Input id="password" type="password" defaultValue="demo-password" />
          </Field>
          <Button type="submit" className="w-full">Log in</Button>
          <OrDivider />
          <OAuthButtons />
        </form>
      </AuthShell>
    </ThemeProvider>,
  );
}

const noop = () => {};

function renderMessageItem(over: Parameters<typeof message>[0], extra?: { isAi?: boolean }) {
  const msg = message(over);
  return render(
    <ThemeProvider>
      {/* Same container semantics the real chat view uses (role="log"). */}
      <div role="log" aria-label="Messages in Design crew">
        <MessageItem
          message={msg}
          author={extra?.isAi ? null : profile()}
          isOwn={!extra?.isAi}
          isGroup
          showHeader
          streaming={msg.status === "streaming"}
          reactions={reactions(["m1", "u2", "👍"])}
          currentUserId={extra?.isAi ? "u1" : "u2"}
          canRegenerate={!!extra?.isAi}
          onReact={noop}
          onEdit={noop}
          onDelete={noop}
          onRegenerate={noop}
        />
      </div>
    </ThemeProvider>,
  );
}

function members(): ConversationMember[] {
  return [
    {
      conversation_id: "c1",
      user_id: "u1",
      role: "member",
      joined_at: "2026-01-01T00:00:00Z",
      last_read_at: null,
      pinned_at: null,
      profile: profile(),
    },
    {
      conversation_id: "c1",
      user_id: "u2",
      role: "admin",
      joined_at: "2026-01-01T00:00:00Z",
      last_read_at: null,
      pinned_at: null,
      profile: profile({ id: "u2", display_name: "Grace Hopper" }),
    },
  ];
}

function summaries(): ConversationSummary[] {
  return [
    {
      id: "c1",
      type: "group",
      name: "Design crew",
      topic: null,
      ai_mode: "mention_only",
      created_by: "u2",
      created_at: "2026-01-01T00:00:00Z",
      archived_at: null,
      member_count: 2,
      last_message: { content: "Ship it", created_at: "2026-01-01T12:00:00Z", sender_type: "human" },
      unread: 2,
      pinned_at: null,
    },
    {
      id: "c2",
      type: "direct_ai",
      name: null,
      topic: null,
      ai_mode: "auto",
      created_by: "u1",
      created_at: "2026-01-02T00:00:00Z",
      archived_at: null,
      member_count: 1,
      last_message: { content: "Pinned thread", created_at: "2026-01-02T12:00:00Z", sender_type: "ai" },
      unread: 0,
      // Pinned rows render an always-visible pin button next to the link —
      // the case that could regress into a nested interactive control.
      pinned_at: "2026-01-02T00:00:00Z",
    },
  ];
}

describe("axe-core — auth surfaces (§3: log in / sign up)", () => {
  it("AuthShell with the login form has no violations", async () => {
    const { container } = renderLoginForm();
    await expectNoA11yViolations(container);
  });

  it("field errors are announced (label + error association)", async () => {
    const { container } = render(
      <ThemeProvider>
        <AuthShell title="Reset password">
          <form className="space-y-4">
            <Field id="email" label="Email" error="Enter a valid email address.">
              <Input id="email" type="email" defaultValue="not-an-email" />
            </Field>
          </form>
        </AuthShell>
      </ThemeProvider>,
    );
    await expectNoA11yViolations(container);
  });
});

describe("axe-core — chat surfaces (§3: 1:1 chat / group room)", () => {
  it("a human message with reactions has no violations", async () => {
    const { container } = renderMessageItem({});
    await expectNoA11yViolations(container);
  });

  it("an AI message (ring, pill, avatar) has no violations", async () => {
    const { container } = renderMessageItem(
      { sender_id: null, sender_type: "ai", content: "Here is the plan:\n\n1. ship" },
      { isAi: true },
    );
    await expectNoA11yViolations(container);
  });

  it("a blocked (moderation fail-closed) message has no violations", async () => {
    const { container } = renderMessageItem(
      { sender_id: null, sender_type: "ai", content: "[redacted]", status: "blocked" },
      { isAi: true },
    );
    await expectNoA11yViolations(container);
  });

  it("the composer (mention mode, moderation warning) has no violations", async () => {
    const { container } = render(
      <ThemeProvider>
        <Composer
          members={members()}
          isGroup
          aiMode="mention_only"
          streaming={false}
          onSend={noop}
          onStop={noop}
          onTyping={noop}
      />
      </ThemeProvider>,
    );
    await expectNoA11yViolations(container);
  });

  it("the streaming live region has no violations", async () => {
    const { container } = render(
      <StreamAnnouncer text="partial respons" active />,
    );
    await expectNoA11yViolations(container);
  });
});

describe("axe-core — sidebar (§3: conversation list, pinned conversations)", () => {
  const noop = () => {};

  function renderSidebar() {
    return render(
      <ThemeProvider>
        <Sidebar
          conversations={summaries()}
          loading={false}
          onNew={noop}
          onJoin={noop}
          onSearch={noop}
          onPalette={noop}
          onTogglePin={noop}
        />
      </ThemeProvider>,
    );
  }

  it("the conversation list has no violations", async () => {
    const { container } = renderSidebar();
    await expectNoA11yViolations(container);
  });

  it("the pin control is a sibling of the link, not nested inside it", async () => {
    const { container } = renderSidebar();
    const link = container.querySelector('a[href="/app/c/c2"]');
    expect(link).toBeTruthy();
    // nested-interactive is the regression this guards: a <button> inside
    // an <a> is invalid and unreachable for keyboard/AT users.
    expect(link!.querySelector("button")).toBeNull();
    const pin = container.querySelector('button[aria-label="Unpin New chat"]');
    expect(pin).toBeTruthy();
    expect(pin!.getAttribute("aria-pressed")).toBe("true");
  });

  it("exposes each section as a named list", async () => {
    const { container } = renderSidebar();
    const lists = [...container.querySelectorAll("ul[aria-label]")];
    expect(lists.map((l) => l.getAttribute("aria-label"))).toEqual([
      "Pinned",
      "Rooms",
    ]);
  });
});

describe("axe-core — dialogs (§3: room settings, ⌘K palette)", () => {
  it("an open Modal is a properly labelled dialog", async () => {
    render(
      <ThemeProvider>
        <Modal
          open
          onClose={noop}
          title="Room settings"
          description="Rename the room or manage members."
          footer={<Button>Save</Button>}
        >
          <Field id="name" label="Room name">
            <Input id="name" defaultValue="Design crew" />
          </Field>
        </Modal>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    await expectNoA11yViolations(document.body);
  });

  it("the command palette (⌘K) has no violations", async () => {
    render(
      <ThemeProvider>
        <CommandPalette
          open
          onClose={noop}
          conversations={summaries()}
          onNewConversation={noop}
          onJoin={noop}
          onSearch={noop}
      />
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    await expectNoA11yViolations(document.body);
  });
});

describe("axe-core — theme controls (§2.6)", () => {
  it("the segmented theme control exposes an accessible name/roles", async () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeSegmented />
      </ThemeProvider>,
    );
    await act(async () => {});
    await expectNoA11yViolations(container);
  });
});
