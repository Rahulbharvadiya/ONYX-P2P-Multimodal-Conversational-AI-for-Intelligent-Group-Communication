/**
 * §11 unit sample — pure logic.
 * `shouldInvokeAi` encodes the §2.5/§7 ai_mode contract, so it's the
 * highest-value pure function to pin down.
 *
 *   npx vitest run tests/utils.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  initials,
  mentionsAi,
  plainPreview,
  safeInternalPath,
  shouldInvokeAi,
} from "../src/lib/utils";

describe("shouldInvokeAi — ai_mode contract (§7)", () => {
  it("never invokes when the room has AI off", () => {
    expect(shouldInvokeAi("@ai please help", "off")).toBe(false);
    expect(shouldInvokeAi("anything at all", "off")).toBe(false);
  });

  it("always invokes in auto mode", () => {
    expect(shouldInvokeAi("no mention here", "auto")).toBe(true);
  });

  it("invokes in mention_only ONLY when @ai is present", () => {
    expect(shouldInvokeAi("hey @ai what do you think", "mention_only")).toBe(true);
    expect(shouldInvokeAi("just chatting with the team", "mention_only")).toBe(false);
  });

  it("matches @ai case-insensitively but not as a substring", () => {
    expect(mentionsAi("@AI help")).toBe(true);
    expect(mentionsAi("@Ai help")).toBe(true);
    expect(mentionsAi("@airplane mode")).toBe(false);
  });
});

describe("plainPreview", () => {
  it("strips markdown for list previews", () => {
    expect(plainPreview("**bold** and `code`")).toBe("bold and code");
    expect(plainPreview("# Heading\n- item")).toBe("Heading item");
  });

  it("collapses fenced code to a placeholder", () => {
    expect(plainPreview("see ```js\nconst a=1;\n``` here")).toBe("see [code] here");
  });
});

describe("initials", () => {
  it("derives avatar initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Prince")).toBe("PR");
    expect(initials("")).toBe("?");
  });
});

describe("safeInternalPath — open-redirect guard", () => {
  it("accepts ordinary in-app paths", () => {
    expect(safeInternalPath("/app")).toBe("/app");
    expect(safeInternalPath("/app/settings")).toBe("/app/settings");
    expect(safeInternalPath("/join/abc123")).toBe("/join/abc123");
    expect(safeInternalPath("/app?tab=privacy")).toBe("/app?tab=privacy");
  });

  it("falls back when the value is missing or blank", () => {
    expect(safeInternalPath(null)).toBe("/app");
    expect(safeInternalPath(undefined)).toBe("/app");
    expect(safeInternalPath("   ")).toBe("/app");
    expect(safeInternalPath("")).toBe("/app");
  });

  it("rejects absolute URLs", () => {
    expect(safeInternalPath("https://evil.example/steal")).toBe("/app");
    expect(safeInternalPath("http://evil.example")).toBe("/app");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/app");
  });

  it("rejects protocol-relative hosts, including encoded and backslash forms", () => {
    expect(safeInternalPath("//evil.example")).toBe("/app");
    expect(safeInternalPath("/\\evil.example")).toBe("/app");
    expect(safeInternalPath("/%2f%2fevil.example")).toBe("/app");
    expect(safeInternalPath("/https://evil.example")).toBe("/app");
  });

  it("rejects control characters (header / log injection)", () => {
    expect(safeInternalPath("/app\nSet-Cookie: a=b")).toBe("/app");
    expect(safeInternalPath("/app\u0000")).toBe("/app");
  });

  it("honours an explicit fallback", () => {
    expect(safeInternalPath("https://evil.example", "/onboarding")).toBe("/onboarding");
  });
});
