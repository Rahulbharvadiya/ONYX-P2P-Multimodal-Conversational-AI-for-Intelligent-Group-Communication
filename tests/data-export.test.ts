/**
 * Settings → Privacy & data → "Export my data".
 *
 *   npx vitest run tests/data-export.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDataExport, downloadJson, EXPORT_VERSION, exportFilename } from "../src/lib/data-export";
import { demo, DEMO_USER_ID } from "../src/lib/data/demo-store";

beforeEach(() => {
  demo.reset();
  demo.signIn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildDataExport", () => {
  it("includes the profile without leaking anything beyond it", async () => {
    const data = await buildDataExport();
    expect(data.version).toBe(EXPORT_VERSION);
    expect(data.profile?.id).toBe(DEMO_USER_ID);
    expect(data.profile?.training_opt_in).toBe(false);
    expect(Object.keys(data.profile ?? {}).sort()).toEqual([
      "display_name",
      "id",
      "theme_pref",
      "training_opt_in",
    ]);
  });

  it("exports every conversation the user belongs to, with its messages", async () => {
    const data = await buildDataExport();
    expect(data.conversations).toHaveLength(2);

    const room = data.conversations.find((c) => c.type === "group")!;
    expect(room.name).toBe("Launch war room");
    // Seeded: two human messages + the @ai question + the AI summary.
    expect(room.messages.length).toBeGreaterThanOrEqual(4);
    expect(room.messages.some((m) => m.sender_type === "ai")).toBe(true);
    // Humans are attributed by name, AI messages are not attributed to a user.
    const human = room.messages.find((m) => m.sender_type === "human")!;
    expect(human.sender_name).toBeTruthy();
    const ai = room.messages.find((m) => m.sender_type === "ai")!;
    expect(ai.sender_name).toBeNull();
  });

  it("carries membership, pin state and attachment metadata", async () => {
    const data = await buildDataExport();
    const room = data.conversations.find((c) => c.type === "group")!;
    expect(room.members.map((m) => m.role).sort()).toEqual(["admin", "member", "owner"]);
    expect(room.pinned_at).toBeNull();
    for (const m of room.messages) {
      expect(Array.isArray(m.attachments)).toBe(true);
      expect(Array.isArray(m.reactions)).toBe(true);
    }
  });

  it("orders messages oldest-first inside each conversation", async () => {
    const data = await buildDataExport();
    for (const c of data.conversations) {
      const times = c.messages.map((m) => m.created_at);
      expect([...times].sort()).toEqual(times);
    }
  });

  it("drops deleted messages", async () => {
    const db = demo.db();
    const victim = db.messages[0];
    victim.deleted_at = new Date().toISOString();
    demo.commit();

    const data = await buildDataExport();
    const all = data.conversations.flatMap((c) => c.messages.map((m) => m.id));
    expect(all).not.toContain(victim.id);
  });

  it("states its own scope limits", async () => {
    const data = await buildDataExport();
    expect(data.notes.join(" ")).toMatch(/other members/i);
    expect(data.notes.join(" ")).toMatch(/metadata/i);
  });
});

describe("exportFilename", () => {
  it("is dated and obviously an export", () => {
    expect(exportFilename(new Date("2026-08-28T12:00:00Z"))).toBe(
      "onyx-export-2026-08-28.json",
    );
  });
});

describe("downloadJson", () => {
  it("writes a JSON blob and clicks a transient anchor", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        created.push(blob.type);
        return "blob:mock";
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    });

    const clicks: string[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        el.click = () => clicks.push(String((el as HTMLAnchorElement).download));
      }
      return el;
    }) as typeof document.createElement);

    downloadJson("export.json", { hello: "world" });

    expect(created).toEqual(["application/json"]);
    expect(clicks).toEqual(["export.json"]);
    // The anchor must not survive in the DOM.
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoked).toEqual([]); // revoked on the next tick, after the click
  });
});
