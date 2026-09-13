"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { riseIn, staggerParent } from "@/lib/motion";
import { DEMO_MODE } from "@/lib/env";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[--bg]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        {/* primary ambient light — anchors the composition */}
        <div
          className="aurora absolute left-1/2 top-[-20rem] h-[34rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 62%)" }}
        />
        {/* secondary, quieter light for depth — offset and dimmer so it reads as atmosphere, not a second focal point */}
        <div
          className="absolute bottom-[-16rem] right-[-8rem] h-[28rem] w-[34rem] rounded-full opacity-[0.08] blur-[110px]"
          style={{ background: "radial-gradient(circle, var(--ai-accent, var(--accent)), transparent 65%)" }}
        />
        {/* faint top-to-bottom vignette so the card reads with more contrast without a literal border box */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[--bg]/40" />
      </div>

      <header className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo className="h-6 w-6 transition-transform duration-[--d-micro] group-hover:scale-105" />
          <span className="brand-logo-dashboard text-[20px] font-bold tracking-[-0.03em] text-[--text-primary]">
            ONYX
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <motion.div
          variants={staggerParent(0.05)}
          initial="hidden"
          animate="show"
          className="w-full max-w-[26rem]"
        >
          <motion.div variants={riseIn} className="mb-7 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-[14px] leading-relaxed text-[--text-secondary]">{subtitle}</p>
            )}
          </motion.div>

          <motion.div
            variants={riseIn}
            className="overflow-hidden rounded-[18px] border border-[--border-color] bg-[--bg-surface] p-6 shadow-[0_12px_24px_-8px_var(--accent-glow)]"
          >
            {DEMO_MODE && (
              <div className="mb-5 flex items-start gap-2.5 rounded-[--r-md] border border-[--accent-border] bg-[--accent-subtle] px-3.5 py-3 text-[12.5px] leading-relaxed text-[--accent-text]">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Demo mode.</strong> Supabase isn&apos;t
                  configured, so any details below will sign you into a local sandbox with seeded
                  conversations.
                </span>
              </div>
            )}
            {children}
          </motion.div>

          {footer && (
            <motion.div variants={riseIn} className="mt-5 text-center text-[13.5px] text-[--fg-muted]">
              {footer}
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}