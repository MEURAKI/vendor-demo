// src/hooks/useAuthGuard.ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";

export function useAuthGuard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;

    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (ignore) return;

        if (error) {
          console.error("auth guard error", error);
          setChecking(false);
          router.replace("/pages/auth/login");
          return;
        }

        if (!data?.session?.user) {
          // ❌ not logged in → send to login
          router.replace("/pages/auth/login");
        } else {
          // ✅ logged in → allow page to render
          setChecking(false);
        }
      } catch (err) {
        console.error("auth guard failed", err);
        if (!ignore) {
          setChecking(false);
          router.replace("/pages/auth/login");
        }
      }
    };

    check();

    return () => {
      ignore = true;
    };
  }, [router]);

  return { checking };
}