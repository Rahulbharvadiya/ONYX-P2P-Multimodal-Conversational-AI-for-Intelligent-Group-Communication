"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { riseIn, staggerParent } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Scroll-triggered fade + rise, staggered children (40–60ms). */
export function Reveal({
  children,
  className,
  stagger = 0.05,
  id,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  id?: string;
}) {
  return (
    <motion.div
      id={id}
      variants={staggerParent(stagger)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={riseIn} className={className}>
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow && (
        <RevealItem>
          <p className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[--accent-text]">
            {eyebrow}
          </p>
        </RevealItem>
      )}
      <RevealItem>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      </RevealItem>
      {subtitle && (
        <RevealItem>
          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-[--fg-muted]">
            {subtitle}
          </p>
        </RevealItem>
      )}
    </div>
  );
}
