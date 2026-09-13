"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DEMO_MODE } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { demo } from "@/lib/data/demo-store";
import { getCurrentProfile } from "@/lib/data/api";
import type { Profile } from "@/lib/types";

interface Ctx {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionCtx = React.createContext<Ctx>({
  profile: null,
  loading: true,
  refresh: async () => {},
});

export const useSession = () => React.useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  const refresh = React.useCallback(async () => {
    const p = await getCurrentProfile();
    setProfile(p);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
    if (DEMO_MODE) return demo.subscribe(() => void refresh());
    const supa = getSupabaseBrowser();
    if (!supa) return;
    const { data } = supa.auth.onAuthStateChange(() => {
      void refresh();
      router.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, router]);

  return (
    <SessionCtx.Provider value={{ profile, loading, refresh }}>{children}</SessionCtx.Provider>
  );
}