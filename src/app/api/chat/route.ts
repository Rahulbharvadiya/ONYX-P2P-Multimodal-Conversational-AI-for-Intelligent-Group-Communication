import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { composeDemoReply } from "@/lib/data/demo-ai";

/**
 * Dynamically reads an environment variable, checking process.env first,
 * and falling back to reading .env.local from disk so that keys added while
 * the dev server is running take effect immediately without restarting.
 */
function readEnv(name: string): string {
  const val = process.env[name];
  if (val && typeof val === "string" && val.trim().length > 0) {
    return val.trim();
  }
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const text = fs.readFileSync(envPath, "utf-8");
      const match = text.match(new RegExp(`^\\s*${name}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, "m"));
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {}
  return "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      conversation_id,
      prompt,
      is_group = false,
      room_name = null,
      trigger_message_id = null,
      supersedes_id = null,
      history = [],
    } = body;

    const cleanPrompt = (prompt || "").replace(/@(ai|onyx|assistant|bot)\b/gi, "").trim();

    // 1. Format conversation history
    const formattedHistory: Array<{ role: "user" | "assistant"; content: string; name?: string }> = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-25)) {
        if (!item || typeof item.content !== "string") continue;
        const text = item.content.trim();
        if (!text) continue;
        const role = item.role === "assistant" ? "assistant" : "user";
        formattedHistory.push({
          role,
          content: text,
          ...(item.name ? { name: item.name.replace(/[^a-zA-Z0-9_-]/g, "") } : {}),
        });
      }
    }

    // Build human-readable transcript of recent messages for context
    const transcriptLines = formattedHistory.map((m) => {
      const prefix = m.content.startsWith("[") ? "" : m.role === "assistant" ? "[ONYX (AI)]: " : "[User]: ";
      return `${prefix}${m.content}`;
    });

    const contextTranscript =
      transcriptLines.length > 0
        ? `--- Recent Conversation Context in this chat (${room_name ? `Room: "${room_name}"` : "Chat"}) ---\n${transcriptLines.join("\n")}\n--- End of Context ---`
        : "";

    // 2. Determine active AI provider
    const geminiKey = readEnv("GEMINI_API_KEY");
    const deepseekKey = readEnv("DEEPSEEK_API_KEY");
    const groqKey = readEnv("GROQ_API_KEY");
    const openRouterKey = readEnv("OPENROUTER_API_KEY");
    const openAiKey = readEnv("OPENAI_API_KEY");

    let apiKey = "";
    let endpoint = "";
    let model = "";
    let providerName = "";
    let extraHeaders: Record<string, string> = {};

    // Provider selection: Gemini (100% free) -> DeepSeek -> Groq (free) -> OpenRouter -> OpenAI
    if (geminiKey) {
      apiKey = geminiKey;
      endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      model = readEnv("GEMINI_MODEL") || "gemini-3.6-flash";
      providerName = "Google Gemini";
    } else if (groqKey) {
      apiKey = groqKey;
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      model = readEnv("GROQ_MODEL") || "openai/gpt-oss-120b";
      providerName = "Groq";
    } else if (deepseekKey) {
      apiKey = deepseekKey;
      endpoint = "https://api.deepseek.com/chat/completions";
      model = readEnv("DEEPSEEK_MODEL") || "deepseek-chat";
      providerName = "DeepSeek";
    } else if (openRouterKey) {
      apiKey = openRouterKey;
      endpoint = "https://openrouter.ai/api/v1/chat/completions";
      model = readEnv("AI_MODEL") || "anthropic/claude-sonnet-4.6";
      providerName = "OpenRouter";
      extraHeaders = { "HTTP-Referer": "https://onyx.chat", "X-Title": "ONYX AI" };
    } else if (openAiKey) {
      apiKey = openAiKey;
      endpoint = "https://api.openai.com/v1/chat/completions";
      model = readEnv("AI_MODEL") || "gpt-4o-mini";
      providerName = "OpenAI";
    }

    // 3. If an API provider is configured, attempt live call
    if (apiKey) {
      const systemPrompt = is_group
        ? `You are ONYX, an expert AI assistant participating in a team room called "${room_name ?? "General"}".
You have full access to the recent messages in this conversation.
When a user tags or asks you something:
- Carefully review the preceding chat messages to understand the full context: what was discussed, who proposed what, any code or decisions, and what is being asked.
- Answer questions directly, factually, and accurately using the conversation context.
- If asked what someone said or agreed to, quote or summarize their actual statements from the chat.
- For math or logic queries, show the exact steps and the precise final answer.
- For code requests, write clean, robust, modern, production-grade code with syntax highlighting.
- Be concise, clear, and avoid generic filler.
- Format all responses cleanly using GitHub Markdown.`
        : `You are ONYX, an expert, highly intelligent AI assistant.
You have full visibility of the conversation history.
- Answer the user's questions directly and accurately without making mistakes.
- Pay close attention to conversation history to maintain context on follow-up questions.
- For math, science, or logic problems, calculate carefully and provide the exact answer with clear reasoning.
- For programming questions, provide bug-free, idiomatic code examples with explanations.
- Format all responses cleanly using GitHub Markdown.`;

      const userContent = contextTranscript
        ? `${contextTranscript}\n\nCurrent User Request:\n${cleanPrompt || prompt}`
        : cleanPrompt || prompt;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify({
            model,
            stream: true,
            messages: apiMessages,
            max_tokens: 2048,
          }),
        });

        if (response.ok && response.body) {
          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              const decoder = new TextDecoder();
              const reader = response.body!.getReader();
              let fullText = "";

              controller.enqueue(
                encoder.encode(`event: start\ndata: ${JSON.stringify({ message_id: "ai-" + Date.now() })}\n\n`),
              );

              let buffer = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith(":")) continue;
                  if (trimmed === "data: [DONE]") continue;
                  if (trimmed.startsWith("data: ")) {
                    try {
                      const parsed = JSON.parse(trimmed.slice(6));
                      const delta =
                        parsed.choices?.[0]?.delta?.content ??
                        parsed.choices?.[0]?.delta?.reasoning_content ??
                        "";
                      if (delta) {
                        fullText += delta;
                        controller.enqueue(
                          encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`),
                        );
                      }
                    } catch {}
                  }
                }
              }

              controller.enqueue(
                encoder.encode(`event: done\ndata: ${JSON.stringify({ content: fullText })}\n\n`),
              );
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }

        // Live call was not OK (e.g. 402 Insufficient Balance, 401 Invalid Key)
        const errText = await response.text().catch(() => "");
        console.error(`[AI Provider Error] (${endpoint}) Status ${response.status}:`, errText);

        // Build helpful diagnostic notice to stream to the user
        let diagnosticNotice = "";
        if (response.status === 402 || errText.toLowerCase().includes("insufficient balance")) {
          diagnosticNotice = [
            `> ⚠️ **DeepSeek API Notice: Insufficient Balance (HTTP 402)**`,
            `> Your DeepSeek API key was received, but your account balance on [platform.deepseek.com/top_up](https://platform.deepseek.com/top_up) is currently **$0.00** (DeepSeek requires purchasing credits to use their API).`,
            `>`,
            `> 💡 **Free Alternative (No Credit Card Required):**`,
            `> You can use Google Gemini API for **100% FREE** with generous limits:`,
            `> 1. Get a key in 30 seconds at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)`,
            `> 2. Add it to your \`.env.local\`: \`GEMINI_API_KEY=AIzaSy...\``,
            `>`,
            `---`,
            ``,
          ].join("\n");
        } else if (response.status === 401) {
          diagnosticNotice = [
            `> ⚠️ **${providerName} API Notice: Authentication Failed (HTTP 401)**`,
            `> The provided API key for ${providerName} is invalid or expired. Please check your key in \`.env.local\`.`,
            `>`,
            `---`,
            ``,
          ].join("\n");
        }

        // Stream diagnostic notice followed by the context-aware fallback answer
        const fallbackReply = composeDemoReply(cleanPrompt || prompt, is_group, room_name, formattedHistory);
        const combinedText = diagnosticNotice ? `${diagnosticNotice}\n${fallbackReply}` : fallbackReply;
        const tokens = combinedText.match(/\S+\s*/g) ?? [combinedText];

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(`event: start\ndata: ${JSON.stringify({ message_id: "ai-" + Date.now() })}\n\n`),
            );

            let accumulated = "";
            for (let i = 0; i < tokens.length; i++) {
              accumulated += tokens[i];
              controller.enqueue(
                encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: tokens[i] })}\n\n`),
              );
              await new Promise((r) => setTimeout(r, 15 + Math.random() * 20));
            }

            controller.enqueue(
              encoder.encode(`event: done\ndata: ${JSON.stringify({ content: accumulated.trim() })}\n\n`),
            );
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err) {
        console.error(`[AI Provider Exception] (${endpoint}):`, err);
      }
    }

    // 4. Default / Built-in Context-Aware Streaming Engine
    const replyText = composeDemoReply(cleanPrompt || prompt, is_group, room_name, formattedHistory);
    const words = replyText.match(/\S+\s*/g) ?? [replyText];

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const fakeId = "ai-" + Math.random().toString(36).slice(2, 10);

        controller.enqueue(
          encoder.encode(`event: start\ndata: ${JSON.stringify({ message_id: fakeId })}\n\n`),
        );

        let fullText = "";
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i];
          fullText += chunk;
          controller.enqueue(
            encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: chunk })}\n\n`),
          );
          await new Promise((r) => setTimeout(r, 15 + Math.random() * 20));
        }

        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ content: fullText.trim() })}\n\n`),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "chat_failed", detail: String(err) },
      { status: 500 },
    );
  }
}
