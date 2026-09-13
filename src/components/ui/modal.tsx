"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { backdrop, modalPanel } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { FOCUSABLE_SELECTOR } from "@/lib/focus";
import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => setMounted(true), []);

  /**
   * Dialog focus management (WCAG 2.4.3 / 2.1.2).
   *
   * Without this the dialog is a keyboard dead end: `aria-modal="true"`
   * tells assistive tech the rest of the page is inert, but the browser
   * still tabs straight through the background content behind the
   * backdrop — and when the dialog closes, focus is left on <body>.
   *
   * So: remember the trigger, move focus into the panel, wrap Tab inside
   * it, and hand focus back to the trigger on close. The panel itself is
   * focused rather than its first control, because some dialogs open onto
   * a destructive confirm (see ConfirmDialog) that must not be one stray
   * Enter away from firing.
   */
  React.useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Wait a frame: the panel is mounted by AnimatePresence in the same
    // commit that flips `open`, so it is not in the DOM yet on this tick.
    const frame = requestAnimationFrame(() => panelRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");

      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const target = restoreTo.current;
      // The trigger may have unmounted while the dialog was open.
      if (target && document.contains(target)) target.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            // Focusable container: focus lands here when the dialog opens so
            // the dialog's accessible name is announced immediately.
            tabIndex={-1}
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn(
              "relative w-full max-w-lg rounded-t-[--r-xl] border border-[--border] bg-[--surface-raised]",
              "shadow-[--e4] sm:rounded-[--r-xl]",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[--border] px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-[--fg]">{title}</h2>
                {description && (
                  <p className="mt-0.5 text-[13px] text-[--fg-muted]">{description}</p>
                )}
              </div>
              <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {children && <div className="px-5 py-4">{children}</div>}
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-[--border] px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Destructive confirm. Guards accidental double-clicks with a debounce
 * that has a VISUAL TELL (shake), never a silent one.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  const [shake, setShake] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const openedAt = React.useRef(0);

  React.useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setBusy(false);
    }
  }, [open]);

  const handle = async () => {
    // too fast = almost certainly a double-click carried over
    if (Date.now() - openedAt.current < 450) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handle}
            loading={busy}
            className={shake ? "shake" : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
