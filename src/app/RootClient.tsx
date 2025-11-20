"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";

// ❌ These are auth pages (allowed without login)
const AUTH_PAGES = [
  "/pages/auth/login",
  "/pages/auth/register",
  "/pages/auth/forgot-password",
];

function isAuthPage(path: string) {
  return AUTH_PAGES.some((r) => path.startsWith(r));
}

// ✅ ANY page starting with "/pages/" is protected (except auth)
function isProtected(path: string) {
  return path.startsWith("/pages/") && !isAuthPage(path);
}

export default function RootClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;

    const check = async () => {
      // Public auth pages require no protection
      if (isAuthPage(pathname)) {
        setChecking(false);
        return;
      }

      // All other /pages/** require protection
      if (isProtected(pathname)) {
        const { data } = await supabase.auth.getSession();
        if (ignore) return;

        const user = data?.session?.user ?? null;

        // ❌ Not logged in → send to login
        if (!user) {
          setChecking(false);
          router.replace("/pages/auth/login");
          return;
        }
      }

      // Everything is OK
      setChecking(false);
    };

    setChecking(true);
    check();

    return () => {
      ignore = true;
    };
  }, [pathname, router]);

  // 🔁 Multi-tab logout protection
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "vendor:logout") {
        router.replace("/pages/auth/login");
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [router]);

  if (checking && isProtected(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <ClipLoader size={28} />
      </div>
    );
  }

  return <>{children}</>;
}