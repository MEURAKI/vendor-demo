"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";

export type VendorProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  onboarding_completed: boolean;
  email_verified: boolean;
};

type VendorShellContextValue = {
  profile: VendorProfile | null;
  loading: boolean;
};

const VendorShellContext = createContext<VendorShellContextValue>({
  profile: null,
  loading: true,
});

export function useVendorProfile() {
  return useContext(VendorShellContext);
}

export function VendorShellProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      // Use getSession (reads localStorage) instead of getUser (network call)
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        setLoading(false);
        return;
      }
      const auth = { user: session.session.user };
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, status, onboarding_completed, email_verified")
        .eq("id", auth.user.id)
        .single();

      if (prof) setProfile(prof as VendorProfile);
      setLoading(false);

      // Subscribe to profile changes
      const channel = supabase
        .channel(`shell-profiles:${auth.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${auth.user.id}`,
          },
          (payload) => setProfile(payload.new as VendorProfile)
        )
        .subscribe();

      unsub = () => supabase.removeChannel(channel);
    })();

    return () => unsub?.();
  }, []);

  return (
    <VendorShellContext.Provider value={{ profile, loading }}>
      {children}
    </VendorShellContext.Provider>
  );
}
