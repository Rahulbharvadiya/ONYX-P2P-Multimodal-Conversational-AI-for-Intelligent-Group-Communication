import { describe, it, expect } from "vitest";
import { composeDemoReply } from "@/lib/data/demo-ai";

describe("composeDemoReply context-awareness", () => {
  const sampleHistory = [
    { role: "user" as const, content: "[Rahul]: We need to launch the new authentication feature by Friday." },
    { role: "user" as const, content: "[Sarah]: I tested the database indices and they are performing 5x faster." },
  ];

  it("answers contextual questions about specific participants", () => {
    const reply = composeDemoReply("What did Rahul say about the launch?", true, "Engineering", sampleHistory);
    expect(reply).toContain("Rahul");
    expect(reply).toContain("authentication feature");
  });

  it("provides summaries of the ongoing chat discussion", () => {
    const reply = composeDemoReply("Summarize our discussion so far", true, "Engineering", sampleHistory);
    expect(reply).toContain("Conversation Summary");
    expect(reply).toContain("Rahul");
    expect(reply).toContain("Sarah");
  });

  it("gives recommendations connecting to recent team messages", () => {
    const reply = composeDemoReply("@ai what do you think?", true, "Engineering", sampleHistory);
    expect(reply).toContain("Sarah");
    expect(reply).toContain("Recommendation");
  });

  it("handles follow-up contextual questions accurately", () => {
    const reply = composeDemoReply("@ai why is that?", true, "Engineering", sampleHistory);
    expect(reply).toContain("Contextual Answer");
    expect(reply).toContain("Sarah");
  });

  it("calculates exact math equations accurately", () => {
    const reply = composeDemoReply("@ai calculate (25 * 4) + 150", false);
    expect(reply).toContain("250");
  });
});
