"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthButtons, OrDivider } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DEMO_MODE } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { demo } from "@/lib/data/demo-store";
import { updateProfile } from "@/lib/data/api";
import { tEnter } from "@/lib/motion";

const schema = z.object({
  displayName: z.string().min(2, "Use at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "At least 8 characters.")
    .regex(/[0-9]/, "Include at least one number."),
});

function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { score: s, label: labels[s] };
}

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // §8 hard requirement: training opt-in defaults OFF, never pre-checked.
  const [trainingOptIn, setTrainingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const pw = strength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    if (DEMO_MODE) {
      demo.signIn(displayName);
      void updateProfile({ training_opt_in: trainingOptIn });
      router.push("/onboarding");
      return;
    }

    const supa = getSupabaseBrowser()!;
    const { data, error } = await supa.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, training_opt_in: trainingOptIn },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (error) {
      setErrors({ email: error.message });
      return;
    }
    // Session present = email confirmation disabled; go straight in.
    if (data.session) router.push("/onboarding");
    else setSent(true);
  };

  return (
    <AuthShell
      title={sent ? "Check your inbox" : "Create your account"}
      subtitle={
        sent
          ? undefined
          : "Free forever for 1:1 AI chat. No credit card, no sales call."
      }
      footer={
        sent ? null : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[--accent-text] underline-offset-2 transition-colors duration-[--d-micro] hover:underline"
            >
              Sign in
            </Link>
          </>
        )
      }
    >
      {/* success state crossfades in place — never a route navigation */}
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={tEnter()}
            className="py-5 text-center"
          >
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[--success-subtle] text-[--success] ring-1 ring-inset ring-[--success]/20">
              <MailCheck className="h-6 w-6" />
            </span>
            <p className="text-[14px] leading-relaxed text-[--fg-muted]">
              We sent a confirmation link to{" "}
              <span className="font-medium text-[--fg]">{email}</span>. Open it to finish setting up
              your account.
            </p>
            <Button variant="ghost" className="mt-5" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tEnter()}
            className="space-y-6"
          >
            <div className="space-y-6">
              <OAuthButtons next="/onboarding" />
              <OrDivider />
            </div>

            <form onSubmit={submit} className="space-y-5" noValidate>
              <Field label="Display name" error={errors.displayName} id="displayName">
                <Input
                  id="displayName"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  aria-invalid={Boolean(errors.displayName)}
                />
              </Field>

              <Field label="Email" error={errors.email} id="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>

              <Field
                label="Password"
                error={errors.password}
                id="password"
                hint={password ? undefined : "At least 8 characters, including a number."}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
                />
                {password && (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="flex h-1 flex-1 gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.span
                          key={i}
                          className="h-full flex-1 rounded-full bg-[--bg-active]"
                          animate={{
                            backgroundColor:
                              i < pw.score
                                ? pw.score <= 2
                                  ? "var(--danger)"
                                  : pw.score <= 3
                                    ? "var(--warning)"
                                    : "var(--success)"
                                : "var(--bg-active)",
                          }}
                          transition={tEnter(0.2)}
                        />
                      ))}
                    </div>
                    <span className="w-20 shrink-0 text-right text-[11.5px] text-[--fg-subtle]">
                      {pw.label}
                    </span>
                  </div>
                )}
              </Field>

              {/* §3 + §8: training-data opt-in, NEVER pre-checked. */}
              <label className="flex cursor-pointer items-start gap-3 rounded-[--r-lg] border border-[--border-default] p-3.5 transition-colors duration-[--d-micro] hover:bg-[--bg-hover] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[--accent]/50 has-[:focus-visible]:ring-offset-2">
                <input
                  type="checkbox"
                  checked={trainingOptIn}
                  onChange={(e) => setTrainingOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[--brand] focus-visible:outline-none"
                />
                <span className="text-[13px] leading-relaxed">
                  <span className="font-medium text-[--text-primary]">
                    Help improve the assistant
                  </span>
                  <br />
                  <span className="text-[--fg-muted]">
                    Allow my conversations to be used for training. Off by default — you can change
                    this any time in Settings.
                  </span>
                </span>
              </label>

              <Button type="submit" className="w-full" loading={loading}>
                Create account
              </Button>

              <p className="text-center text-[12px] leading-relaxed text-[--fg-subtle]">
                By continuing you agree to our Terms and Privacy Policy.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}