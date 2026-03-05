"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.removeItem("vendor:splashShown");
      sessionStorage.setItem("vendor:showSplash", "1");
    } catch {}
    router.replace("/pages/dashboard");
  }, [router]);

  return null;
}
