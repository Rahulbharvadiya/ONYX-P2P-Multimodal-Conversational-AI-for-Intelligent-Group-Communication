"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DEMO_MODE } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters.").regex(/[0-9]/, "Include a number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    if (!DEMO_MODE) {
      const { error } = await getSupabaseBrowser()!.auth.updateUser({ password });
      if (error) {
        setLoading(false);
        setErrors({ password: error.message });
        return;
      }
    }
    toast.push({ kind: "success", title: "Password updated" });
    router.push("/app");
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose something you haven't used before.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="New password" error={errors.password} id="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>
        <Field label="Confirm password" error={errors.confirm} id="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
          />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}