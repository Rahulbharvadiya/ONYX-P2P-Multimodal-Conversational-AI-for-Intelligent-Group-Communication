"use client";

import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { demo } from "@/lib/data/demo-store";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { safeInternalPath } from "@/lib/utils";

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
      />
    </svg>
  );
}

export function OAuthButtons({ next = "/app" }: { next?: string }) {
  // The target is echoed into the OAuth redirectTo URL, so it is sanitised
  // here as well as at the callback — defence in depth, not decoration.
  const target = safeInternalPath(next);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const google = async () => {
    setLoading(true);
    if (DEMO_MODE) {
      demo.signIn();
      toast.push({ kind: "success", title: "Signed in", description: "Demo session started." });
      router.push(target);
      return;
    }
    const supa = getSupabaseBrowser()!;
    const { error } = await supa.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}` },
    });
    if (error) {
      toast.push({ kind: "error", title: "Google sign-in failed", description: error.message });
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      className="group relative w-full overflow-hidden border border-[--border-color] bg-[--bg-surface] text-[--text-primary] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-[--d-micro] hover:border-[--border-color] hover:bg-[--bg-subtle] active:scale-[0.985]"
      onClick={google}
      loading={loading}
    >
      {!loading && <GoogleMark />}
      Continue with Google
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[--border]" />
      <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-[--fg-subtle]">
        or
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[--border]" />
    </div>
  );
}