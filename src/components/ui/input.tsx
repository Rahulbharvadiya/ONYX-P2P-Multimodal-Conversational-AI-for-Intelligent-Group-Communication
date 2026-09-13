"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fieldError } from "@/lib/motion";

const base =
  "w-full rounded-[--r-md] border border-[--border] bg-[--surface] px-3 text-sm text-[--fg] " +
  "placeholder:text-[--fg-subtle] transition-[border-color,box-shadow] duration-[--d-micro] " +
  "focus:border-[--accent] focus:outline-none focus:ring-4 focus:ring-[--accent]/12 " +
  "disabled:opacity-60";

export interface FieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  id?: string;
  children?: React.ReactNode;
}

export function Field({ label, error, hint, id, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-[--fg]">
          {label}
        </label>
      )}
      {children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            variants={fieldError}
            initial="hidden"
            animate="show"
            exit="exit"
            className="overflow-hidden text-[12.5px] text-[--danger]"
            role="alert"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p className="text-[12.5px] text-[--fg-subtle]">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(base, "py-2.5 leading-relaxed", className)} {...props} />;
  },
);
