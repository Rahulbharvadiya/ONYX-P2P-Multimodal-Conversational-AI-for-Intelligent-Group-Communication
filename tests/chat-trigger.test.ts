import { describe, it, expect } from "vitest";
import { mentionsAi, shouldInvokeAi } from "@/lib/utils";

describe("AI trigger condition in group chats", () => {
  it("does not trigger AI for normal group chat messages without tagging @ai", () => {
    expect(mentionsAi("Hey team, how is the project going?")).toBe(false);
    expect(mentionsAi("Good morning everyone!")).toBe(false);
    expect(mentionsAi("Can someone check the database migration?")).toBe(false);
  });

  it("only triggers AI when @ai is explicitly tagged", () => {
    expect(mentionsAi("@ai how do we fix this bug?")).toBe(true);
    expect(mentionsAi("Can @ai summarize our discussion?")).toBe(true);
    expect(mentionsAi("What do you think @ai?")).toBe(true);
  });

  it("respects ai_mode off", () => {
    expect(shouldInvokeAi("@ai help", "off")).toBe(false);
  });
});
