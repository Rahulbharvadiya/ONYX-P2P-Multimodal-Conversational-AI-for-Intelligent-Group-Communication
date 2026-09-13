// =====================================================================
// provider — pure, dependency-free OpenRouter translation layer.
//
// Translates between the app's internal representation and OpenRouter's
// OpenAI-compatible Chat Completions wire format:
//
//   POST https://openrouter.ai/api/v1/chat/completions
//   Authorization: Bearer <OPENROUTER_API_KEY>
//
// Everything in this module is environment-free (no Deno.*, no
// @supabase/supabase-js, no fetch of its own) so it can be unit-tested
// from vitest and typechecked under Deno without a key or network.
//
// The module owns the two places where the provider wire format is
// (mis)understood:
//   1. Request building  — OpenAI-compatible body incl. `stream: true`
//      and `stream_options: { include_usage: true }`.
//   2. SSE parsing       — OpenRouter keep-alive comment lines (e.g.
//      `: OPENROUTER PROCESSING`) are NOT JSON; they must be skipped
//      before any JSON.parse. Mid-stream errors arrive as ordinary
//      `data:` frames with a top-level `error` object. The final chunk
//      carries the `usage` accounting frame, then `data: [DONE]`.
// =====================================================================

export const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export type ProviderRole = "system" | "user" | "assistant";

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
}

/** The conversation messages (history), independent of the system prompt. */
export type ConversationMessage = Omit<ProviderMessage, "role" | "content"> & {
  role: "user" | "assistant";
  content: string;
};

/** Exactly the OpenAI-compatible Chat Completions request body. */
export interface ChatCompletionsBody {
  model: string;
  messages: ProviderMessage[];
  max_tokens: number;
  stream: true;
  stream_options: { include_usage: true };
}

export interface BuildRequestInput {
  model: string;
  maxTokens: number;
  /** Optional system prompt — becomes the first `system` message. */
  system: string | null;
  messages: ConversationMessage[];
  apiKey: string;
}

/**
 * Build the OpenAI-compatible request body. The system prompt is prepended
 * as a `role: "system"` message — the canonical OpenAI Chat Completions
 * shape, which OpenRouter maps onto the upstream provider (OpenRouter's
 * OpenAI-compat layer handles the Claude/Anthropic conversion for
 * `anthropic/*` models).
 */
export function buildChatCompletionsBody(input: {
  model: string;
  maxTokens: number;
  system: string | null;
  messages: ConversationMessage[];
}): ChatCompletionsBody {
  const messages: ProviderMessage[] = [];
  if (input.system && input.system.trim().length > 0) {
    messages.push({ role: "system", content: input.system });
  }
  messages.push(...input.messages);
  return {
    model: input.model,
    messages,
    max_tokens: input.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  };
}

/** Build the full fetch request (URL + init) for the OpenRouter endpoint. */
export function buildProviderRequest(
  input: BuildRequestInput,
): { url: string; init: RequestInit } {
  return {
    url: OPENROUTER_CHAT_COMPLETIONS_URL,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(buildChatCompletionsBody(input)),
    },
  };
}

// ---------------------------------------------------------------------
// SSE decoding
// ---------------------------------------------------------------------

/** App-level event emitted by the SSE decoder. */
export type ProviderStreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "usage"; inputTokens: number; outputTokens: number }
  | { kind: "done" }
  | { kind: "error"; message: string };

const DONE = "[DONE]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Parse one complete SSE frame (the text between two blank lines, with
 * `\r\n` already normalized to `\n`). Returns zero or more app-level
 * events; malformed frames are ignored rather than thrown.
 */
export function parseSSEFrame(frame: string): ProviderStreamEvent[] {
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    // SSE comment / keep-alive (`: OPENROUTER PROCESSING`) — never JSON.
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      // `data:` or `data: payload` (one optional leading space per spec).
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    // `event:`, `id:`, `retry:` fields are not used by the Chat
    // Completions stream; ignore them.
  }
  if (dataLines.length === 0) return [];

  const data = dataLines.join("\n");
  if (data === DONE) return [{ kind: "done" }];

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    // Not JSON (e.g. a stray keep-alive body) — ignore, per OpenRouter docs.
    return [];
  }
  if (!isRecord(payload)) return [];

  // Mid-stream errors: `{"error": {"code": ..., "message": ...}}` at the
  // top level, with `finish_reason: "error"` in choices. The stream is
  // terminated by the provider right after this frame.
  const err = payload.error;
  if (isRecord(err)) {
    return [
      {
        kind: "error",
        message: asString(err.message) ?? asString(err.code) ?? "provider_stream_error",
      },
    ];
  }

  const events: ProviderStreamEvent[] = [];

  const usage = isRecord(payload.usage) ? payload.usage : undefined;
  if (usage) {
    const inputTokens = asNumber(usage.prompt_tokens) ?? 0;
    const outputTokens = asNumber(usage.completion_tokens) ?? 0;
    events.push({ kind: "usage", inputTokens, outputTokens });
  }

  // Content delta. OpenRouter keeps `choices` non-empty even on the final
  // usage frame (delta content is "" there), so treat missing/empty
  // content as a no-op.
  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0];
    if (isRecord(choice)) {
      const delta = isRecord(choice.delta) ? choice.delta : undefined;
      const text = delta ? asString(delta.content) : undefined;
      if (text && text.length > 0) {
        events.push({ kind: "delta", text });
      }
    }
  }

  return events;
}

/**
 * Streaming SSE parser. Feed decoded text chunks; it keeps the partially
 * received frame in an internal buffer and returns the events for each
 * completed frame. Call `flush()` when the upstream reader is done to
 * emit anything left in the buffer (usually nothing).
 */
export class ProviderSSEDecoder {
  private buffer = "";

  push(text: string): ProviderStreamEvent[] {
    // Normalize CRLF so frames split on a single `\n\n` delimiter.
    const normalized = this.buffer + text.replace(/\r\n/g, "\n");
    const frames = normalized.split("\n\n");
    this.buffer = frames.pop() ?? "";

    const events: ProviderStreamEvent[] = [];
    for (const frame of frames) {
      events.push(...parseSSEFrame(frame));
    }
    return events;
  }

  flush(): ProviderStreamEvent[] {
    const leftover = this.buffer;
    this.buffer = "";
    if (!leftover.trim()) return [];
    return parseSSEFrame(leftover);
  }
}
