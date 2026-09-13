"use client";

import { Sparkles } from "lucide-react";
import { cn, hueFrom, initials } from "@/lib/utils";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-xl",
} as const;

export function Avatar({
  name,
  url,
  size = "md",
  className,
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const hue = hueFrom(name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
        sizes[size],
        className,
      )}
      style={
        url
          ? undefined
          : {
              background: `linear-gradient(140deg, hsl(${hue} 62% 58%), hsl(${(hue + 42) % 360} 62% 48%))`,
              color: "white",
            }
      }
      aria-hidden
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AiAvatar({
  size = "md",
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[--ai-badge-bg] text-[--ai-badge-text] ring-1 ring-[--ai-badge-text]/30",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      <Sparkles className="h-1/2 w-1/2" strokeWidth={2.25} />
    </span>
  );
}

/** Monospace AI tag chip (@ONYX) */
export function AiPill({ label = "@ONYX", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] bg-[--ai-badge-bg] px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[--ai-badge-text]",
        className,
      )}
    >
      {label}
    </span>
  );
}
