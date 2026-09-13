"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { toastIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  kind: Kind;
  title: string;
  description?: string;
  duration: number;
}

interface Ctx {
  push: (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
}

const ToastCtx = React.createContext<Ctx>({ push: () => {} });
export const useToast = () => React.useContext(ToastCtx);

const ICONS: Record<Kind, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const ACCENT: Record<Kind, string> = {
  success: "text-[--success]",
  error: "text-[--danger]",
  info: "text-[--accent-text]",
  warning: "text-[--warning]",
};

const BAR: Record<Kind, string> = {
  success: "bg-[--success]",
  error: "bg-[--danger]",
  info: "bg-[--accent]",
  warning: "bg-[--warning]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const remove = React.useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = React.useCallback<Ctx["push"]>(
    ({ duration = 4200, ...t }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev.slice(-3), { ...t, id, duration }]);
      setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col-reverse gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t, idx) => {
            const Icon = ICONS[t.kind];
            const depth = toasts.length - 1 - idx; // older toasts scale down
            return (
              <motion.div
                key={t.id}
                layout
                variants={toastIn}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ scale: 1 - Math.min(depth, 2) * 0.03 }}
                className={cn(
                  "pointer-events-auto relative overflow-hidden rounded-[--r-md] border border-[--border]",
                  "bg-[--surface-raised] shadow-[--e3]",
                )}
              >
                <div className="flex gap-3 p-3.5 pr-9">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ACCENT[t.kind])} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium leading-snug text-[--fg]">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 text-[12.5px] leading-snug text-[--fg-muted]">
                        {t.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                  className="absolute right-2 top-2.5 rounded p-1 text-[--fg-subtle] transition-colors hover:bg-[--bg-hover] hover:text-[--fg]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {/* visible shrinking progress bar — no surprise disappearance */}
                <div
                  className={cn("absolute bottom-0 left-0 h-0.5 w-full origin-left", BAR[t.kind])}
                  style={{
                    animation: `toastProgress ${t.duration}ms linear forwards`,
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
