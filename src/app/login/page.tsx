"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthButtons, OrDivider } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DEMO_MODE } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { demo } from "@/lib/data/demo-store";
import { safeInternalPath } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // `next` is attacker-controllable (it comes from the query string), so it
  // is collapsed to a same-origin path before it ever reaches router.push().
  const next = safeInternalPath(params.get("next"));
  const toast = useToast();

  const [email, setEmail] = useState(DEMO_MODE ? "you@example.com" : "");
  const [password, setPassword] = useState(DEMO_MODE ? "demo-password" : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    if (DEMO_MODE) {
      demo.signIn();
      toast.push({ kind: "success", title: "Welcome back", description: "Demo session started." });
      router.push(next);
      return;
    }

    const supa = getSupabaseBrowser()!;
    const { error } = await supa.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrors({ password: error.message });
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where your conversations left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[--accent-text] underline-offset-2 transition-colors duration-[--d-micro] hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <OAuthButtons next={next} />
        <OrDivider />

        <form onSubmit={submit} className="space-y-5" noValidate>
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

          <Field label="Password" error={errors.password} id="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[12.5px] font-medium text-[--fg-muted] transition-colors duration-[--d-micro] hover:text-[--accent-text]"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}