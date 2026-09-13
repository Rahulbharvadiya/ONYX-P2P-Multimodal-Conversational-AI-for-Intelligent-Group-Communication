"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "signin" | "register";
}

export function AuthModal({ open, onClose, initialTab = "signin" }: AuthModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = React.useState<"signin" | "register">(initialTab);
  const [email, setEmail] = React.useState(DEMO_MODE ? "you@example.com" : "");
  const [password, setPassword] = React.useState(DEMO_MODE ? "demo-password" : "");
  const [displayName, setDisplayName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (DEMO_MODE) {
        demo.signIn();
        toast.push({
          kind: "success",
          title: tab === "signin" ? "Welcome back" : "Account created",
          description: "Demo session started.",
        });
        onClose();
        router.push("/app");
        return;
      }

      const supa = getSupabaseBrowser();
      if (!supa) throw new Error("Supabase client not initialized");

      if (tab === "signin") {
        const { error: signInError } = await supa.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supa.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (signUpError) throw signUpError;
      }

      onClose();
      router.push("/app");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          id="auth-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#121214]/40 backdrop-blur-[12px]"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[420px] rounded-[18px] border border-[--border-color] bg-[--bg-surface] p-6 sm:p-7 shadow-[0_24px_48px_-12px_rgba(18,18,20,0.18)]"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close auth modal"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[--text-muted] transition-colors hover:bg-[--bg-subtle] hover:text-[--text-primary]"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header / Logo */}
            <div className="flex items-center gap-2.5 mb-5">
              <Logo className="h-6 w-6" />
              <span className="brand-logo-dashboard font-bold tracking-[-0.03em] text-[--text-primary]">
                ONYX
              </span>
            </div>

            <h2 id="auth-modal-title" className="text-[20px] font-bold tracking-tight text-[--text-primary]">
              {tab === "signin" ? "Sign in to ONYX" : "Create your ID"}
            </h2>
            <p className="mt-1 text-[13px] text-[--text-secondary]">
              {tab === "signin"
                ? "Enter your credentials to access your direct chats and rooms."
                : "Register a handle to start private threads and team rooms."}
            </p>

            {/* Segmented Dynamic Tab Switcher */}
            <div className="mt-5 grid grid-cols-2 rounded-[8px] bg-[--bg-subtle] p-1 border border-[--border-color]">
              <button
                type="button"
                onClick={() => {
                  setTab("signin");
                  setError(null);
                }}
                className={`rounded-[6px] py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                  tab === "signin"
                    ? "bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_3px_rgba(18,18,20,0.08)] border border-[--border-subtle]"
                    : "text-[--text-secondary] hover:text-[--text-primary]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("register");
                  setError(null);
                }}
                className={`rounded-[6px] py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                  tab === "register"
                    ? "bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_3px_rgba(18,18,20,0.08)] border border-[--border-subtle]"
                    : "text-[--text-secondary] hover:text-[--text-primary]"
                }`}
              >
                Create ID / Register
              </button>
            </div>

            {DEMO_MODE && (
              <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-[--border-subtle] bg-[--bg-subtle] p-2.5 text-[12px] text-[--text-secondary]">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[--ai-badge-text]" />
                <span>
                  <strong>Demo Mode Active:</strong> Quick-fill test user enabled. Simply click submit to start exploring immediately.
                </span>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-[6px] border border-[--danger-color]/30 bg-[#fce6e5] px-3 py-2 text-[12px] font-medium text-[--danger-color]">
                {error}
              </div>
            )}

            {/* Standardized Input Controls with Focus Rings */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
              {tab === "register" && (
                <Field label="Display Name / Handle" id="modal-name">
                  <Input
                    id="modal-name"
                    type="text"
                    placeholder="e.g. Alex"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="border-[--border-color] focus:border-[--accent-black] focus:ring-2 focus:ring-[--accent-black]/10"
                  />
                </Field>
              )}

              <Field label="Email address" id="modal-email">
                <Input
                  id="modal-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-[--border-color] focus:border-[--accent-black] focus:ring-2 focus:ring-[--accent-black]/10"
                />
              </Field>

              <Field label="Password" id="modal-password">
                <Input
                  id="modal-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-[--border-color] focus:border-[--accent-black] focus:ring-2 focus:ring-[--accent-black]/10"
                />
              </Field>

              <div className="pt-1.5">
                <Button
                  type="submit"
                  loading={loading}
                  className="w-full bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 font-semibold text-[14px] shadow-[--e1]"
                >
                  {tab === "signin" ? "Sign In" : "Register Account"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
