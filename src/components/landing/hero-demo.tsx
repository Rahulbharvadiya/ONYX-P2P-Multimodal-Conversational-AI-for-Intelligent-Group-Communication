"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, Send } from "lucide-react";
import { Avatar, AiAvatar } from "@/components/ui/avatar";
import { messageIn, tExit } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Beat {
  kind: "human" | "ai" | "typing";
  name?: string;
  text: string;
  hold: number;
}

const SCRIPT: Beat[] = [
  { kind: "human", name: "Priya", text: "Staging's green. Do we ship tonight or Monday?", hold: 1500 },
  { kind: "human", name: "Marcus", text: "Tonight, if the rollback story is real.", hold: 1500 },
  { kind: "human", name: "You", text: "@ai settle it — what's the actual risk?", hold: 900 },
  { kind: "typing", text: "", hold: 1100 },
  {
    kind: "ai",
    text: "Ship tonight. The rollback is a single migration revert and traffic is 4% of Monday's. The real risk isn't the deploy — it's that nobody's on call at 2am. Assign that and it's a go.",
    hold: 4200,
  },
];

export function HeroDemo() {
  const [visible, setVisible] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const reduce = React.useRef(false);

  React.useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  React.useEffect(() => {
    if (reduce.current) {
      setVisible(SCRIPT.length);
      setTyped(SCRIPT[4].text);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      while (!cancelled) {
        for (let i = 0; i < SCRIPT.length; i++) {
          if (cancelled) return;
          const beat = SCRIPT[i];
          setVisible(i + 1);

          if (beat.kind === "ai") {
            setTyped("");
            const words = beat.text.split(" ");
            for (let w = 0; w < words.length; w++) {
              if (cancelled) return;
              setTyped((t) => (t ? `${t} ${words[w]}` : words[w]));
              await new Promise((r) => (timer = setTimeout(r, 42)));
            }
          }
          await new Promise((r) => (timer = setTimeout(r, beat.hold)));
        }
        if (cancelled) return;
        setVisible(0);
        setTyped("");
        await new Promise((r) => (timer = setTimeout(r, 700)));
      }
    };
    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const shown = SCRIPT.slice(0, visible).filter(
    (b, i) => !(b.kind === "typing" && visible > i + 1),
  );

  return (
    <div className="relative overflow-hidden rounded-[--r-xl] border border-[--border] bg-[--surface] shadow-[--e4]">
      {/* window chrome */}
      <div className="flex items-center gap-3 border-b border-[--border] bg-[--bg-subtle] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[--fg-muted]">
          <Hash className="h-3.5 w-3.5" />
          <span className="truncate">launch-war-room</span>
          <span className="ml-1 rounded-full bg-[--accent-subtle] px-2 py-0.5 text-[11px] font-semibold text-[--accent-text]">
            AI: mention only
          </span>
        </div>
      </div>

      <div className="flex h-[380px] flex-col gap-4 overflow-hidden p-4 sm:h-[420px] sm:p-5">
        <AnimatePresence initial={false}>
          {shown.map((beat, i) => {
            if (beat.kind === "typing") {
              return (
                <motion.div
                  key="typing"
                  variants={messageIn}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: tExit() }}
                  className="flex items-center gap-3"
                >
                  <AiAvatar size="sm" />
                  <div className="flex items-center gap-1 rounded-[--r-lg] bg-[--ai-bubble] px-3.5 py-3">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="typing-dot h-1.5 w-1.5 rounded-full bg-[--fg-subtle]"
                        style={{ animationDelay: `${d * 140}ms` }}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            }

            const isAi = beat.kind === "ai";
            const body = isAi ? typed : beat.text;

            return (
              <motion.div
                key={`${i}-${beat.name ?? "ai"}`}
                variants={messageIn}
                initial="hidden"
                animate="show"
                className="flex gap-3"
              >
                {isAi ? <AiAvatar size="sm" /> : <Avatar name={beat.name!} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="mb-1 flex items-baseline gap-2 text-[12.5px]">
                    <span className={cn("font-semibold", isAi ? "text-[--ai-accent]" : "text-[--fg]")}>
                      {isAi ? "Assistant" : beat.name}
                    </span>
                    {isAi && (
                      <span className="rounded bg-[--accent-subtle] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[--accent-text]">
                        AI
                      </span>
                    )}
                  </p>
                  <p
                    className={cn(
                      "text-pretty text-[13.5px] leading-relaxed",
                      isAi ? "text-[--fg]" : "text-[--fg-muted]",
                    )}
                  >
                    {body}
                    {isAi && typed.length < SCRIPT[4].text.length && (
                      <span className="stream-caret" />
                    )}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="border-t border-[--border] bg-[--bg-subtle] p-3">
        <div className="flex items-center gap-2 rounded-[--r-md] border border-[--border] bg-[--surface] px-3 py-2.5">
          <span className="flex-1 text-[13px] text-[--fg-subtle]">
            Message the room… use <span className="font-medium text-[--accent-text]">@ai</span> to bring
            in the assistant
          </span>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="grid h-7 w-7 place-items-center rounded-[--r-sm] bg-[--accent] text-[--accent-fg]"
          >
            <Send className="h-3.5 w-3.5" />
          </motion.span>
        </div>
      </div>
    </div>
  );
}
