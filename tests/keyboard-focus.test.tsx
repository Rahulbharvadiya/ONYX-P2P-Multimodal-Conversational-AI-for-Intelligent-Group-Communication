/**
 * Keyboard / focus behaviour of the dialog surfaces (§4, §10–§12).
 *
 * axe cannot see focus: a page can score zero violations and still leave a
 * keyboard user stranded behind a backdrop. These tests drive the real
 * components and assert where focus actually goes.
 *
 *   npx vitest run tests/keyboard-focus.test.tsx
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import * as React from "react";

import { Modal, ConfirmDialog } from "../src/components/ui/modal";
import { CommandPalette } from "../src/components/layout/command-palette";
import { Button } from "../src/components/ui/button";
import { Composer } from "../src/components/chat/composer";
import type { ConversationSummary } from "../src/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/app",
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** The dialog panel, once it exists. */
function dialog(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!el) throw new Error("no dialog in the DOM");
  return el;
}

/** Flush the requestAnimationFrame the components use before focusing. */
function flushFrame() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("Modal — focus management", () => {
  it("moves focus into the dialog when it opens", async () => {
    const { rerender } = render(<Modal open={false} onClose={() => {}} title="Room settings" />);
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(<Modal open onClose={() => {}} title="Room settings" />);
    await flushFrame();

    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it("returns focus to the trigger when it closes", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<Modal open onClose={() => {}} title="Room settings" />);
    await flushFrame();
    expect(dialog().contains(document.activeElement)).toBe(true);

    rerender(<Modal open={false} onClose={() => {}} title="Room settings" />);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("wraps Tab at both edges instead of tabbing into the page behind it", async () => {
    // A focusable control in the "page" that must never receive focus while
    // the dialog is open.
    const behind = document.createElement("button");
    behind.textContent = "behind the backdrop";
    document.body.appendChild(behind);

    render(
      <Modal open onClose={() => {}} title="Room settings" footer={<Button>Save</Button>}>
        <input defaultValue="first" />
        <input defaultValue="second" />
      </Modal>,
    );
    await flushFrame();

    const panel = dialog();
    const [firstInput] = panel.querySelectorAll("input");
    const close = panel.querySelector<HTMLButtonElement>("button[aria-label='Close']")!;
    const save = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Save")!;

    // Document order: close (header) -> inputs -> Save (footer).
    expect([...panel.querySelectorAll<HTMLElement>("input, button")].indexOf(close)).toBe(0);
    expect([...panel.querySelectorAll<HTMLElement>("input, button")].indexOf(save)).toBe(3);

    // Forward wrap: Tab on the last control returns to the first.
    save.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    // Backward wrap: Shift+Tab on the first control goes to the last.
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);

    // Backward from the panel itself also lands on the last control.
    panel.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);

    // jsdom does not implement sequential focus navigation, so mid-list Tab
    // is the browser's job; what matters here is that focus never escapes.
    firstInput.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(behind);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Room settings" />);
    await flushFrame();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a single Tab stop when the dialog has no focusable children", async () => {
    render(<Modal open onClose={() => {}} title="Notice" />);
    await flushFrame();
    const panel = dialog();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(panel);
  });
});

describe("ConfirmDialog — destructive confirm", () => {
  it("does not fire when confirmed inside the 450ms debounce window", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Delete room?"
        description="This cannot be undone."
        confirmLabel="Delete"
      />,
    );
    await flushFrame();

    const confirm = [...dialog().querySelectorAll("button")].find(
      (b) => b.textContent === "Delete",
    )!;
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(confirm.className).toContain("shake");
  });
});

describe("CommandPalette — keyboard behaviour", () => {
  const conversations: ConversationSummary[] = [
    {
      id: "c1",
      type: "group",
      name: "Design crew",
      topic: null,
      ai_mode: "auto",
      created_by: "u1",
      created_at: "2026-01-01T00:00:00Z",
      archived_at: null,
      member_count: 2,
      last_message: null,
      unread: 0,
      pinned_at: null,
    },
  ];

  function renderPalette(open: boolean, onClose = () => {}) {
    return render(
      <CommandPalette
        open={open}
        onClose={onClose}
        conversations={conversations}
        onNewConversation={() => {}}
        onJoin={() => {}}
        onSearch={() => {}}
      />,
    );
  }

  it("focuses its input when opened", async () => {
    renderPalette(true);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    await flushFrame();
    expect(document.activeElement).toBe(
      dialog().querySelector("input[aria-label='Command palette input']"),
    );
  });

  it("returns focus to the opener when closed", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = renderPalette(true);
    await flushFrame();

    rerender(
      <CommandPalette
        open={false}
        onClose={() => {}}
        conversations={conversations}
        onNewConversation={() => {}}
        onJoin={() => {}}
        onSearch={() => {}}
      />,
    );
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("runs the highlighted command on Enter", async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await flushFrame();

    const input = dialog().querySelector("input")!;
    // "New AI chat" is the first item in the Actions group.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await flushFrame();
    fireEvent.keyDown(dialog().querySelector("input")!, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Composer — @mention combobox", () => {
  const members = [
    {
      conversation_id: "c1",
      user_id: "u2",
      role: "member" as const,
      joined_at: "2026-01-01T00:00:00Z",
      last_read_at: null,
      pinned_at: null,
      profile: {
        id: "u2",
        display_name: "Grace Hopper",
        avatar_url: null,
        theme_pref: "system" as const,
        training_opt_in: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    },
  ];

  function renderComposer() {
    return render(
      <Composer
        members={members}
        isGroup
        aiMode="mention_only"
        streaming={false}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );
  }

  it("is collapsed until a mention is typed", () => {
    const { container } = renderComposer();
    const combo = container.querySelector('[role="combobox"]')!;
    expect(combo.getAttribute("aria-expanded")).toBe("false");
    expect(combo.getAttribute("aria-controls")).toBeNull();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("exposes the suggestions as a listbox with a selected option", () => {
    const { container } = renderComposer();
    const combo = container.querySelector('[role="combobox"]')!;
    const input = container.querySelector("textarea")!;

    fireEvent.change(input, { target: { value: "@" } });

    expect(combo.getAttribute("aria-expanded")).toBe("true");
    const listbox = container.querySelector('[role="listbox"]')!;
    expect(combo.getAttribute("aria-controls")).toBe(listbox.id);

    const options = [...container.querySelectorAll('[role="option"]')];
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    // activedescendant names the highlighted option, so it is announced.
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
  });

  it("moves the highlighted option with the arrow keys", () => {
    const { container } = renderComposer();
    const input = container.querySelector("textarea")!;
    fireEvent.change(input, { target: { value: "@" } });

    const options = [...container.querySelectorAll('[role="option"]')];
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
  });

  it("closes the listbox on Escape and after applying a mention", () => {
    const { container } = renderComposer();
    const combo = container.querySelector('[role="combobox"]')!;
    const input = container.querySelector<HTMLTextAreaElement>("textarea")!;

    fireEvent.change(input, { target: { value: "@" } });
    expect(combo.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(combo.getAttribute("aria-expanded")).toBe("false");

    fireEvent.change(input, { target: { value: "@ai" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(combo.getAttribute("aria-expanded")).toBe("false");
    expect(input.value.trim()).toBe("@ai");
  });

  it("announces the moderation warning in a live region that exists up front", () => {
    const { container } = renderComposer();
    // The region is present before the warning, otherwise the update is missed.
    const status = container.querySelector('[role="status"]')!;
    expect(status).toBeTruthy();
    expect(status.textContent).toBe("");

    const input = container.querySelector("textarea")!;
    fireEvent.change(input, { target: { value: "how to make a bomb" } });

    expect(status.textContent).toMatch(/Dangerous instructions/i);
  });
});
