"use client";

import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { tEnter } from "@/lib/motion";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

export function LandingNav({ onOpenAuth }: { onOpenAuth?: (tab: "signin" | "register") => void }) {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setStuck(y > 20));

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const targetId = href.slice(1);
      const element = document.getElementById(targetId);
      if (element) {
        // Sticky navbar height is 64px (h-16), offset by 76px for clean spacing and breathing room
        const navHeight = 76;
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = Math.max(0, elementPosition - navHeight);

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });

        window.history.pushState(null, "", href);
      }
    }
  };

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={tEnter(0.48)}
      className={cn(
        "sticky top-0 inset-x-0 z-50 transition-[background-color,box-shadow,border-color] duration-[--d-standard]",
        stuck
          ? "border-b border-[--border-color] bg-[--bg-surface]/80 backdrop-blur-[12px] shadow-[0_2px_8px_rgba(18,18,20,0.04)]"
          : "border-b border-transparent bg-[--bg-surface]/60 backdrop-blur-[12px]",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="brand-logo-landing text-[24px] font-bold tracking-[-0.03em] text-[--text-primary]">
            ONYX
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) =>
            l.href.startsWith("/") ? (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-[--r-sm] px-3 py-2 text-[14px] font-semibold text-[--text-secondary] transition-colors hover:text-[--text-primary]"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => handleAnchorClick(e, l.href)}
                className="rounded-[--r-sm] px-3 py-2 text-[14px] font-semibold text-[--text-secondary] transition-colors hover:text-[--text-primary]"
              >
                {l.label}
              </a>
            ),
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onOpenAuth ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenAuth("signin")}
                className="hidden sm:inline-flex text-[14px] font-semibold text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-subtle]"
              >
                Sign in
              </Button>
              <Button
                size="sm"
                onClick={() => onOpenAuth("register")}
                className="bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 text-[14px] font-semibold shadow-[--e1]"
              >
                Get started
              </Button>
            </>
          ) : (
            <>
              <Button asChild href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex text-[14px] font-semibold text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-subtle]">
                Sign in
              </Button>
              <Button asChild href="/signup" size="sm" className="bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 text-[14px] font-semibold shadow-[--e1]">
                Get started
              </Button>
            </>
          )}
          <button
            className="grid h-9 w-9 place-items-center rounded-[--r-md] border border-[--border-color] bg-[--bg-surface] text-[--text-secondary] hover:bg-[--bg-subtle] hover:text-[--text-primary] shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </nav>

      <motion.div
        initial={false}
        animate={{ opacity: open ? 1 : 0, y: open ? 0 : -8 }}
        transition={tEnter(0.2)}
        className={cn(
          "overflow-hidden border-t border-[--border] bg-[--bg]/95 backdrop-blur-xl md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{ height: open ? "auto" : 0 }}
      >
        <div className="flex flex-col p-3">
          {LINKS.map((l) =>
            l.href.startsWith("/") ? (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-[--r-md] px-3 py-2.5 text-sm font-medium text-[--fg-muted] hover:bg-[--bg-hover] hover:text-[--fg]"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => {
                  setOpen(false);
                  handleAnchorClick(e, l.href);
                }}
                className="rounded-[--r-md] px-3 py-2.5 text-sm font-medium text-[--fg-muted] hover:bg-[--bg-hover] hover:text-[--fg]"
              >
                {l.label}
              </a>
            ),
          )}
          <Button asChild href="/login" variant="secondary" className="mt-2 w-full" onClick={() => setOpen(false)}>
            Sign in
          </Button>
        </div>
      </motion.div>
    </motion.header>
  );
}
