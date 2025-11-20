"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";

// Adjust these to your real protected routes
const PROTECTED = [
  "/pages/dashboard",
  "/pages/profile",
  "/pages/orders",
];

const PUBLIC_AUTH = [
  "/pages/auth/login",
  "/pages/auth/register",
  "/pages/auth/forgot-password",
];

function isProtectedRoute(path: string) {
  return PROTECTED.some((r) => path === r || path.startsWith(r + "/"));
}

function isAuthPage(path: string) {
  return PUBLIC_AUTH.includes(path);
}

export default function RootClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  // 🔒 Global Auth Check
  useEffect(() => {
    let ignore = false;

    const checkSession = async () => {
      // If page is public and not an auth page → no need to check
      if (!isProtectedRoute(pathname) && !isAuthPage(pathname)) {
        setChecking(false);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (ignore) return;

      const user = data?.session?.user ?? null;

      // If protected & no user → redirect
      if (isProtectedRoute(pathname) && !user) {
        setChecking(false);
        router.replace("/pages/auth/login");
        return;
      }

      // If auth page & already logged in → redirect to dashboard
      if (isAuthPage(pathname) && user) {
        setChecking(false);
        router.replace("/pages/dashboard");
        return;
      }

      setChecking(false);
    };

    setChecking(true);
    checkSession();

    return () => {
      ignore = true;
    };
  }, [pathname, router]);

  // 🔁 Multi-tab logout sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "vendor:logout") {
        router.replace("/pages/auth/login");
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [router]);

  // Show loader ONLY while checking protected pages
  if (checking && isProtectedRoute(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <ClipLoader size={28} />
      </div>
    );
  }

  return <>{children}</>;
}