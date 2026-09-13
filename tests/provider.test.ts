/**
 * Unit tests for the pure OpenRouter translation layer
 * (`supabase/functions/_shared/provider.ts`).
 *
 * The module is intentionally environment-free, so these run under
 * vitest (`npm test`) and would also run under Deno.
 */
import { describe, expect, it } from "vitest";
import {
  buildChatCompletionsBody,
  buildProviderRequest,
  OPENROUTER_CHAT_COMPLETIONS_URL,
  parseSSEFrame,
  ProviderSSEDecoder,
} from "../supabase/functions/_shared/provider";

const KEY = "sk-or-test-key-not-a-real-secret";

describe("buildProviderRequest", () => {
  const messages = [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi there" },
  ];

  it("targets the OpenRouter OpenAI-compatible Chat Completions endpoint", () => {
    const { url, init } = buildProviderRequest({
      model: "anthropic/claude-sonnet-4.6",
      maxTokens: 2048,
      system: "You are helpful.",
      messages,
      apiKey: KEY,
    });
    expect(url).toBe(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
  });

  it("sends the key as a Bearer token and never in the body", () => {
    const { init } = buildProviderRequest({
      model: "anthropic/claude-sonnet-4.6",
      maxTokens: 2048,
      system: null,
      messages,
      apiKey: KEY,
    });
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).not.toContain(KEY);
    expect(init.body).not.toContain("x-api-key");
    expect(init.body).not.toContain("anthropic-version");
  });

  it("builds the OpenAI-compatible body with stream + usage accounting", () => {
    const body = buildChatCompletionsBody({
      model: "anthropic/claude-sonnet-4.6",
      maxTokens: 2048,
      system: "You are helpful.",
      messages,
    });
    expect(body.model).toBe("anthropic/claude-sonnet-4.6");
    expect(body.max_tokens).toBe(2048);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("prepends the system prompt as the first system message", () => {
    const body = buildChatCompletionsBody({
      model: "m",
      maxTokens: 1,
      system: "System instructions.",
      messages,
    });
    expect(body.messages[0]).toEqual({ role: "system", content: "System instructions." });
    expect(body.messages.slice(1)).toEqual(messages);
  });

  it("omits an empty or whitespace-only system prompt", () => {
    for (const system of ["", "   "]) {
      const body = buildChatCompletionsBody({
        model: "m",
        maxTokens: 1,
        system,
        messages,
      });
      expect(body.messages).toEqual(messages);
    }
  });
});

describe("parseSSEFrame", () => {
  it("emits a delta for a content chunk", () => {
    const events = parseSSEFrame(
      `data: {"choices":[{"index":0,"delta":{"content":"Hello "}}]}`,
    );
    expect(events).toEqual([{ kind: "delta", text: "Hello " }]);
  });

  it("ignores OpenRouter keep-alive comment lines (never JSON)", () => {
    // A frame that is ONLY a comment must not throw and must not emit.
    expect(parseSSEFrame(": OPENROUTER PROCESSING")).toEqual([]);
    // Comment interleaved with a real data frame.
    const events = parseSSEFrame(
      `: OPENROUTER PROCESSING\ndata: {"choices":[{"delta":{"content":"ok"}}]}`,
    );
    expect(events).toEqual([{ kind: "delta", text: "ok" }]);
  });

  it("emits done on [DONE] and ignores junk after it", () => {
    expect(parseSSEFrame("data: [DONE]")).toEqual([{ kind: "done" }]);
    expect(parseSSEFrame("data: [DONE]\n: still connected")).toEqual([{ kind: "done" }]);
  });

  it("emits usage from the final accounting frame (OpenRouter keeps choices)", () => {
    const events = parseSSEFrame(
      `data: {"id":"gen-1","choices":[{"index":0,"delta":{"content":"","role":"assistant"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}`,
    );
    expect(events).toEqual([{ kind: "usage", inputTokens: 12, outputTokens: 34 }]);
  });

  it("emits usage even when choices is an empty array (OpenAI-spec shape)", () => {
    const events = parseSSEFrame(
      `data: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":2}}`,
    );
    expect(events).toEqual([{ kind: "usage", inputTokens: 7, outputTokens: 2 }]);
  });

  it("does not emit a delta for an empty content string", () => {
    expect(parseSSEFrame(`data: {"choices":[{"delta":{"content":""}}]}`)).toEqual([]);
  });

  it("handles a mid-stream error frame", () => {
    const events = parseSSEFrame(
      `data: {"id":"cmpl-1","error":{"code":"server_error","message":"Provider disconnected"},"choices":[{"index":0,"delta":{"content":""},"finish_reason":"error"}]}`,
    );
    expect(events).toEqual([
      { kind: "error", message: "Provider disconnected" },
    ]);
  });

  it("falls back to the error code when the message is missing", () => {
    const events = parseSSEFrame(`data: {"error":{"code":"rate_limited"}}`);
    expect(events).toEqual([{ kind: "error", message: "rate_limited" }]);
  });

  it("ignores malformed data frames instead of throwing", () => {
    expect(parseSSEFrame("data: {not json")).toEqual([]);
    expect(parseSSEFrame(": OPENROUTER PROCESSING\ndata: /")).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const events = parseSSEFrame(
      "data: {\"choices\":[{\"delta\":{\"content\":\"CRLF\"}}]}\r",
    );
    expect(events).toEqual([{ kind: "delta", text: "CRLF" }]);
  });
});

describe("ProviderSSEDecoder", () => {
  const deltaFrame = (text: string) =>
    `data: {"choices":[{"delta":{"content":${JSON.stringify(text)}}}]}`;

  it("buffers a frame split across pushes", () => {
    const decoder = new ProviderSSEDecoder();
    const frame = deltaFrame("split");

    const first = decoder.push(frame.slice(0, 10));
    expect(first).toEqual([]);

    const rest = decoder.push(frame.slice(10) + "\n\n");
    expect(rest).toEqual([{ kind: "delta", text: "split" }]);
  });

  it("parses a full realistic stream: comments, deltas, usage, done", () => {
    const decoder = new ProviderSSEDecoder();
    const events = [
      ...decoder.push(": OPENROUTER PROCESSING\n\n"),
      ...decoder.push(deltaFrame("Hel") + "\n\n"),
      ...decoder.push(": ping\n\n"),
      ...decoder.push(deltaFrame("lo") + "\r\n\r\n"),
      ...decoder.push(
        `data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\n`,
      ),
      ...decoder.push("data: [DONE]\n\n"),
    ];
    expect(events).toEqual([
      { kind: "delta", text: "Hel" },
      { kind: "delta", text: "lo" },
      { kind: "usage", inputTokens: 5, outputTokens: 2 },
      { kind: "done" },
    ]);
  });

  it("returns nothing for a trailing comment-only frame", () => {
    const decoder = new ProviderSSEDecoder();
    decoder.push("data: [DONE]\n\n");
    expect(decoder.flush()).toEqual([]);
  });
});
