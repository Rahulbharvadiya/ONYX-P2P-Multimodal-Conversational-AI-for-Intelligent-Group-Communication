/**
 * Context-aware assistant engine used for fallback and local execution.
 * Intelligently analyzes conversation history, author statements, and context
 * so that mentions (@ai) directly address the ongoing discussion.
 */
import { classifyLocal } from "./moderation-local";

function tryEvalMath(input: string): string | null {
  const clean = input.replace(/@\w+\b/g, "").trim().toLowerCase();
  const mathMatch = clean.match(/(?:what\s+is|calculate|solve|evaluate)?\s*([\d\s\+\-\*\/\(\)\.\%]+)\??$/i);
  if (mathMatch && mathMatch[1] && /\d/.test(mathMatch[1])) {
    const expr = mathMatch[1].trim();
    if (/^[\d\s\+\-\*\/\(\)\.\%]+$/.test(expr) && expr.length <= 50 && /[+\-*\/%]/.test(expr)) {
      try {
        const sanitized = expr.replace(/%/g, "*0.01");
        const result = Function(`"use strict"; return (${sanitized})`)();
        if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
          return `**Calculation:**\n\n$$\\text{${expr}} = \\mathbf{${Number(result.toFixed(6)).toString()}}$$\n\nThe answer to \`${expr}\` is **${Number(result.toFixed(6)).toString()}**.`;
        }
      } catch {
        /* noop */
      }
    }
  }
  return null;
}

interface ParsedMessage {
  author: string;
  role: "user" | "assistant";
  text: string;
}

function parseHistory(
  history?: Array<{ role: "user" | "assistant"; content: string; name?: string }>,
): ParsedMessage[] {
  if (!Array.isArray(history) || history.length === 0) return [];

  return history
    .map((item) => {
      const content = (item.content || "").trim();
      let author = item.name || (item.role === "assistant" ? "ONYX" : "Team Member");
      let text = content;

      // Extract brackets format e.g. "[Rahul]: Hello"
      const bracketMatch = content.match(/^\[([^\]]+)\]:\s*([\s\S]+)$/);
      if (bracketMatch) {
        author = bracketMatch[1].trim();
        text = bracketMatch[2].trim();
      } else {
        // Extract colon format e.g. "Rahul: Hello"
        const colonMatch = content.match(/^([A-Za-z0-9_\s]{2,30}):\s*([\s\S]+)$/);
        if (colonMatch && !colonMatch[1].toLowerCase().startsWith("http")) {
          author = colonMatch[1].trim();
          text = colonMatch[2].trim();
        }
      }

      return { author, role: item.role, text };
    })
    .filter((m) => m.text.length > 0);
}

export function composeDemoReply(
  prompt: string,
  isGroup: boolean,
  roomName?: string | null,
  history?: Array<{ role: "user" | "assistant"; content: string; name?: string }>,
): string {
  const clean = prompt.replace(/@(ai|onyx|assistant|bot)\b/gi, "").trim();
  const lower = clean.toLowerCase();

  // 1. Math queries
  const mathResult = tryEvalMath(clean);
  if (mathResult) return mathResult;

  // 2. Parse conversation history for context
  const parsedHistory = parseHistory(history);
  const humanMessages = parsedHistory.filter((m) => m.role === "user");
  const authors = Array.from(new Set(humanMessages.map((m) => m.author))).filter(Boolean);

  // 3. User specifically asking about a member or what was said by someone
  // e.g. "what did Rahul say?", "what does Sarah think?"
  for (const author of authors) {
    const authorRegex = new RegExp(`\\b${author}\\b`, "i");
    if (authorRegex.test(clean)) {
      const authorMsgs = humanMessages.filter((m) => m.author.toLowerCase() === author.toLowerCase());
      if (authorMsgs.length > 0) {
        const latestText = authorMsgs[authorMsgs.length - 1].text;
        return [
          `### Context from **${author}**:`,
          ``,
          `In this conversation, **${author}** shared:`,
          ...authorMsgs.map((m) => `> "${m.text}"`),
          ``,
          `**Analysis / Takeaway**:`,
          `${author}'s main point centers around *"${latestText.slice(0, 100)}${latestText.length > 100 ? "…" : ""}"*. `,
          `If you'd like to follow up on this or need a solution addressing their question, let me know!`,
        ].join("\n");
      }
    }
  }

  // 4. Summarization / Recap requests
  // e.g. "summarize the chat", "recap", "what are we talking about?", "catch me up"
  if (/\b(summariz\w*|summaris\w*|summary|recap|overview|catch me up|what happened|what are we talking|what have we discussed)\b/i.test(lower)) {
    if (parsedHistory.length > 0) {
      const summaryItems: string[] = [];
      authors.forEach((a) => {
        const msgs = humanMessages.filter((m) => m.author.toLowerCase() === a.toLowerCase());
        if (msgs.length > 0) {
          const sample = msgs.map((m) => m.text).join(" • ");
          summaryItems.push(`- **${a}**: ${sample.length > 140 ? sample.slice(0, 137) + "…" : sample}`);
        }
      });

      return [
        `### Conversation Summary (${roomName ? `Room: "${roomName}"` : "Recent Chat"}):`,
        ``,
        `Here is an overview of what the team has been discussing:`,
        ``,
        ...summaryItems,
        ``,
        `### Key Takeaways:`,
        `- **Active Discussion**: The group is actively coordinating on the points mentioned above.`,
        `- **Action Item**: Verify next steps or confirm agreement on the latest proposals.`,
        ``,
        `Let me know if you want me to expand on any specific topic!`,
      ].join("\n");
    }
  }

  // 5. Questions asking for opinion / recommendation on previous conversation
  // e.g. "what do you think?", "which one is better?", "how should we proceed?", "is that right?"
  if (
    /\b(what do you think|which one|how should we proceed|what should we do|your opinion|thoughts\??|is that right|is that good|recommend)\b/i.test(
      lower,
    ) &&
    humanMessages.length > 0
  ) {
    const lastMsg = humanMessages[humanMessages.length - 1];
    const secondLast = humanMessages.length > 1 ? humanMessages[humanMessages.length - 2] : null;

    return [
      `### Review of Ongoing Discussion:`,
      ``,
      `Looking at the latest message from **${lastMsg.author}**:`,
      `> "${lastMsg.text}"`,
      secondLast ? `*(and previously from **${secondLast.author}**: "${secondLast.text}")*` : "",
      ``,
      `### Recommendation & Analysis:`,
      `1. **Core Consideration**: The key factor here is ensuring simplicity and alignment with the team's goals.`,
      `2. **Pros & Tradeoffs**:`,
      `   - Following through with **${lastMsg.author}**'s direction provides immediate clarity.`,
      `   - Keep the scope contained so the team can test and validate before expanding further.`,
      `3. **Proposed Next Step**: Confirm the requirements with the team and proceed with a minimal working draft.`,
      ``,
      `Would you like me to write a detailed plan or draft code for this?`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // 6. Contextual reference: Check if prompt refers to topics in previous messages
  if (humanMessages.length > 0 && clean.length < 50) {
    // If user asks a short follow-up question like "how to do that?" or "why?"
    if (/\b(that|this|why|how|when|where|who)\b/i.test(lower)) {
      const prev = humanMessages[humanMessages.length - 1];
      return [
        `### Contextual Answer (Regarding: *"${prev.text}"* from **${prev.author}**):`,
        ``,
        `To address your question regarding **${clean}**:`,
        ``,
        `1. **Direct Assessment**: Building directly on what **${prev.author}** noted (*"${prev.text}"*), the primary objective is to resolve any ambiguities first.`,
        `2. **Recommended Approach**:`,
        `   - Review the existing setup to make sure all dependencies are accounted for.`,
        `   - Test edge cases before rolling out to the rest of the room.`,
        ``,
        `Let me know if you'd like me to provide specific instructions or code!`,
      ].join("\n");
    }
  }

  // 7. Identity and capabilities
  if (/\b(who are you|what are you|what is your name|what can you do)\b/i.test(clean)) {
    return [
      `I am **ONYX**, an intelligent AI assistant built into your chat platform.`,
      ``,
      `Here is what I can do:`,
      `- **Understand Chat Context**: I read the ongoing conversation so you can ask follow-up questions, summarize discussions, and reference team members.`,
      `- **Solve Complex Problems**: Math calculations, technical questions, and code generation.`,
      `- **Team Collaboration**: Mention \`@ai\` in any group room to get instant answers.`,
      ``,
      `*(Tip: Connect \`GEMINI_API_KEY\` (100% Free) or \`DEEPSEEK_API_KEY\` in \`.env.local\` for live deep reasoning!)*`,
    ].join("\n");
  }

  // 8. Greetings
  if (/^(hi|hey|hello|yo|good\s*(morning|afternoon|evening))\b/i.test(clean)) {
    return isGroup
      ? `Hello! I'm active and listening in on **${roomName ?? "this room"}**.\n\nI have full visibility of the chat context. Tag \`@ai\` anytime to ask questions, summarize points, or get help with your work!`
      : `Hello! I'm ONYX, your AI assistant. How can I help you today? Ask me any question, request code, or paste notes to summarize.`;
  }

  // 9. Code & Programming requests
  if (/\b(code|function|component|script|python|javascript|typescript|react|html|css|sql|regex|bug|debug)\b/i.test(clean)) {
    if (/\b(python)\b/i.test(clean)) {
      return [
        `Here is a clean, idiomatic Python implementation for **${clean}**:`,
        ``,
        `\`\`\`python`,
        `def solve_task(*args, **kwargs):`,
        `    """`,
        `    Implementation for: ${clean}`,
        `    """`,
        `    result = []`,
        `    for item in args:`,
        `        if item is not None:`,
        `            result.append(item)`,
        `    return result`,
        ``,
        `if __name__ == "__main__":`,
        `    output = solve_task("sample", 42, True)`,
        `    print("Output:", output)`,
        `\`\`\``,
        ``,
        `### Key Highlights:`,
        `1. **Type Safety & Documentation**: Clean docstring and modular structure.`,
        `2. **Defensive**: Handles empty or unexpected values gracefully.`,
      ].join("\n");
    }

    return [
      `Here is a production-ready TypeScript / React implementation for **${clean}**:`,
      ``,
      `\`\`\`tsx`,
      `import React, { useState, useCallback } from "react";`,
      ``,
      `interface SolutionProps {`,
      `  title?: string;`,
      `  onAction?: (value: string) => void;`,
      `}`,
      ``,
      `export const SolutionComponent: React.FC<SolutionProps> = ({ title = "${clean}", onAction }) => {`,
      `  const [active, setActive] = useState(false);`,
      ``,
      `  const handleClick = useCallback(() => {`,
      `    setActive((prev) => !prev);`,
      `    onAction?.("triggered");`,
      `  }, [onAction]);`,
      ``,
      `  return (`,
      `    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-sm">`,
      `      <h3 className="font-semibold text-base mb-2">{title}</h3>`,
      `      <button`,
      `        onClick={handleClick}`,
      `        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"`,
      `      >`,
      `        {active ? "Active" : "Click to execute"}`,
      `      </button>`,
      `    </div>`,
      `  );`,
      `};`,
      `\`\`\``,
      ``,
      `Let me know if you need API integration, state management, or custom styling for this!`,
    ].join("\n");
  }

  // 10. General questions
  return [
    `### Regarding: *${clean}*`,
    ``,
    `Here is a direct, structured response:`,
    ``,
    `1. **Direct Answer**: Regarding **${clean}**, the recommended approach is to evaluate the requirements and choose the most reliable path.`,
    `2. **Key Points**:`,
    `   - **Correctness & Reliability**: Always prioritize verified standards.`,
    `   - **Maintainability**: Keep implementation straightforward so all team members can understand it.`,
    `3. **Next Steps**: Let me know if you'd like specific code examples or an outline for the next steps!`,
  ].join("\n");
}

export interface DemoStreamHandle {
  cancel: () => void;
}

export function streamDemoReply(
  text: string,
  onDelta: (chunk: string) => void,
  onDone: (full: string, blocked: boolean, reason?: string) => void,
): DemoStreamHandle {
  let cancelled = false;
  const tokens = text.match(/\S+\s*/g) ?? [text];
  let i = 0;
  let acc = "";

  const tick = () => {
    if (cancelled) return;
    if (i >= tokens.length) {
      const verdict = classifyLocal(acc);
      onDone(acc, verdict.verdict !== "pass", verdict.reason);
      return;
    }
    const burst = 1 + Math.floor(Math.random() * 3);
    for (let b = 0; b < burst && i < tokens.length; b++, i++) {
      acc += tokens[i];
      onDelta(tokens[i]);
    }
    setTimeout(tick, 18 + Math.random() * 42);
  };

  setTimeout(tick, 260 + Math.random() * 280);
  return {
    cancel() {
      cancelled = true;
      onDone(acc, false);
    },
  };
}
