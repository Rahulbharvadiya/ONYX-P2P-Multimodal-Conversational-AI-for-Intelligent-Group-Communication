"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Users,
  Globe,
  Terminal,
  ArrowUp,
  Paperclip,
  Camera,
  Mic,
  Hash,
  CheckCircle2,
} from "lucide-react";
import { AiPill, AiAvatar, Avatar } from "@/components/ui/avatar";

type Mode = "solo" | "direct" | "collab" | "intel";

export function SlidePreview() {
  const [activeMode, setActiveMode] = React.useState<Mode>("solo");

  const MODES: { id: Mode; label: string; num: string; icon: React.ElementType }[] = [
    { id: "solo", label: "Solo AI", num: "01", icon: Sparkles },
    { id: "direct", label: "Direct", num: "02", icon: Users },
    { id: "collab", label: "Collab Room", num: "03", icon: Hash },
    { id: "intel", label: "AI Intel", num: "04", icon: Globe },
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-[--border-color] bg-[--bg-surface] shadow-[0_20px_40px_-15px_var(--accent-glow)]">
      {/* Slide Navigation Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-[--border-subtle] bg-[--bg-subtle]/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-[11px] font-bold tracking-[0.06em] text-[--text-muted]">
            MODE_PREVIEW // {activeMode.toUpperCase()}
          </span>
        </div>

        {/* 4 Mode Switcher Tabs */}
        <div className="flex items-center gap-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = activeMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveMode(m.id)}
                className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_3px_rgba(18,18,20,0.06)] border border-[--border-color]"
                    : "text-[--text-secondary] hover:bg-[--bg-subtle] hover:text-[--text-primary]"
                }`}
              >
                <Icon className={`h-3 w-3 ${active ? "text-[--ai-badge-text]" : "text-[--text-muted]"}`} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide Viewport */}
      <div className="relative h-[340px] overflow-hidden bg-[--bg-surface] p-4 flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {activeMode === "solo" && (
            <motion.div
              key="solo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3.5 flex-1 overflow-y-auto pr-1"
            >
              {/* Outgoing user message */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-[12px] bg-[--accent-black] px-3.5 py-2.5 text-[14px] leading-[1.5] text-[--accent-foreground] shadow-[--e1]">
                  Can you break down our quarterly cloud infrastructure costs and suggest optimizations?
                </div>
              </div>

              {/* AI response with @ONYX badge */}
              <div className="flex items-start gap-2.5">
                <AiAvatar size="sm" />
                <div className="max-w-[90%] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[--text-primary]">Assistant</span>
                    <AiPill label="@ONYX" />
                    <span className="text-[11px] text-[--text-muted]">Just now</span>
                  </div>
                  <div className="rounded-[12px] border border-[--border-color] bg-[--bg-surface] p-3 text-[14px] leading-[1.5] text-[--text-primary] shadow-[0_1px_2px_rgba(18,18,20,0.04)]">
                    Compute instances account for <strong className="font-semibold">68%</strong> of the spend. Migrating non-critical jobs to ARM spot nodes and consolidating idle Redis clusters will reduce monthly expenditure by ~34%.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeMode === "direct" && (
            <motion.div
              key="direct"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 flex-1 overflow-y-auto pr-1"
            >
              <div className="flex items-start gap-2.5">
                <Avatar name="Sarah Jenkins" size="sm" />
                <div className="max-w-[80%] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[--text-primary]">Sarah Jenkins</span>
                    <span className="text-[11px] text-[--text-muted]">10:24 AM</span>
                  </div>
                  <div className="rounded-[12px] border border-[--border-color] bg-[--bg-canvas] px-3.5 py-2.5 text-[14px] leading-[1.5] text-[--text-primary]">
                    Hey, did you review the revised security audit report? We are green to launch staging.
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[12px] bg-[--accent-black] px-3.5 py-2.5 text-[14px] leading-[1.5] text-[--accent-foreground] shadow-[--e1]">
                  Yes, reviewed and signed off! Everything passes strict conformance.
                </div>
              </div>

              <div className="flex justify-end items-center gap-1 text-[11px] text-[--text-muted]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[--ai-badge-text]" />
                <span>Delivered & read</span>
              </div>
            </motion.div>
          )}

          {activeMode === "collab" && (
            <motion.div
              key="collab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 flex-1 overflow-y-auto pr-1"
            >
              <div className="rounded-[8px] bg-[--bg-subtle] px-3 py-1.5 text-[12px] text-[--text-secondary] flex items-center justify-between border border-[--border-subtle]">
                <span className="font-semibold text-[--text-primary]">#core-architecture</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 status-pulse" /> 8 MEMBERS ONLINE
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Avatar name="David K" size="sm" />
                <div className="max-w-[85%] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[--text-primary]">David</span>
                    <span className="text-[11px] text-[--text-muted]">11:02 AM</span>
                  </div>
                  <div className="rounded-[12px] border border-[--border-color] bg-[--bg-canvas] px-3.5 py-2 text-[14px] text-[--text-primary]">
                    @ai should we decouple the ingestion pipeline into an independent event bus?
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <AiAvatar size="sm" />
                <div className="max-w-[88%] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[--text-primary]">ONYX AI</span>
                    <AiPill label="@ONYX" />
                  </div>
                  <div className="rounded-[12px] border border-[--border-color] bg-[--bg-surface] px-3.5 py-2 text-[14px] text-[--text-primary] shadow-[0_1px_2px_rgba(18,18,20,0.04)]">
                    Decoupling via an asynchronous event bus isolates spike traffic, prevents queue backpressure, and improves cluster fault-tolerance.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeMode === "intel" && (
            <motion.div
              key="intel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 flex-1 overflow-y-auto pr-1"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[10px] border border-[--border-color] bg-[--bg-subtle]/50 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[--text-primary]">
                    <Globe className="h-3.5 w-3.5 text-[--ai-badge-text]" />
                    <span>Live Web Context</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[--text-secondary] leading-snug">
                    Real-time internet retrieval feeds verified references into conversation threads.
                  </p>
                </div>

                <div className="rounded-[10px] border border-[--border-color] bg-[--bg-subtle]/50 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[--text-primary]">
                    <Terminal className="h-3.5 w-3.5 text-[--ai-badge-text]" />
                    <span>System Analysis</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[--text-secondary] leading-snug">
                    Automated stack trace analysis, schema diffing, and code reviews in monospace.
                  </p>
                </div>
              </div>

              <div className="rounded-[10px] bg-[#121214] p-3 font-mono text-[12px] text-[#F8F9FA] space-y-1">
                <div className="text-[--ai-badge-text] flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>$ onyx-intel --analyze-session --strict</span>
                </div>
                <div className="text-[#8C9199]">✓ Verified 4 source references</div>
                <div className="text-[#8C9199]">✓ Zero moderation flags encountered</div>
                <div className="text-emerald-400">→ Latency: 112ms | Model: anthropic/claude-sonnet-4.6</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Simulated Input Bar */}
        <div className="mt-2 flex items-center gap-2 rounded-full border border-[--border-color] bg-[--bg-canvas] px-3 py-1.5 shadow-[0_1px_2px_rgba(18,18,20,0.04)]">
          <div className="flex items-center gap-1.5 text-[--text-muted]">
            <Paperclip className="h-3.5 w-3.5" />
            <Camera className="h-3.5 w-3.5" />
            <Mic className="h-3.5 w-3.5" />
          </div>
          <span className="flex-1 text-[13px] text-[--text-muted] select-none">
            Message the conversation or type @ai...
          </span>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[--accent-black] text-[--accent-foreground] shadow-[--e1]">
            <ArrowUp className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}
