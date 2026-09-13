"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING } from "@/lib/motion";

const button = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--r-md] font-semibold text-[14px] select-none " +
    "transition-colors duration-[--d-micro] disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--accent]",
  {
    variants: {
      variant: {
        primary: "bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 shadow-[--e1]",
        secondary:
          "bg-[--bg-surface] text-[--text-primary] border border-[--border-color] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[--bg-subtle] hover:border-[--border-color]",
        ghost: "text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-subtle]",
        subtle: "bg-[--bg-subtle] text-[--text-primary] border border-transparent hover:border-[--border-subtle] hover:bg-[--border-subtle]",
        danger: "bg-[--danger-color] text-white hover:opacity-90 shadow-[--e1]",
        dangerGhost: "text-[--danger-color] hover:bg-[--danger-subtle]",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-[14px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-9 w-9",
        iconSm: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof button> {
  loading?: boolean;
  children?: React.ReactNode;
  /**
   * Render the button styling onto a navigation element instead of a
   * `<button>`. Use with `href` — the result is a single `<a>` carrying the
   * button classes, which is how you make a link that looks like a button
   * without nesting interactive elements (axe: nested-interactive, WCAG 2.1 AA).
   */
  asChild?: boolean;
  href?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, children, disabled, asChild, href, ...props },
  ref,
) {
  const classes = cn(button({ variant, size }), className);

  // Single interactive element: the anchor carries the button styling.
  if (asChild) {
    const MotionLink = motion.create(Link);
    // framer-motion's onDrag collides with the anchor's onDrag type; the
    // public API stays fully typed, the spread is widened at the boundary.
    const anchorProps = props as unknown as Record<string, unknown>;
    return (
      <MotionLink
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        whileTap={disabled || loading ? undefined : { scale: 0.97 }}
        whileHover={disabled || loading ? undefined : { scale: 1.015 }}
        transition={SPRING}
        aria-disabled={disabled || loading || undefined}
        href={href}
        {...anchorProps}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </MotionLink>
    );
  }

  return (
    <motion.button
      ref={ref}
      className={classes}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      whileHover={disabled || loading ? undefined : { scale: 1.015 }}
      transition={SPRING}
      disabled={disabled || loading}
      {...props}
    >
      {/* inline spinner morph — never a separate loading page */}
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
});
