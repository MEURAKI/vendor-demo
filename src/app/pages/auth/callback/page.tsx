"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client"; // adjust path if needed

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // 1) Read tokens from URL fragment: #access_token=...&refresh_token=...
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (!access_token || !refresh_token) {
        console.error("Missing tokens in callback URL");
        router.replace("/pages/auth/login");
        return;
      }

      // 2) Set Supabase session
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error || !data?.user) {
        console.error("Error setting session:", error);
        router.replace("/pages/auth/login");
        return;
      }

      const user = data.user;

      // 3) Mark email verified in your profile table
      //    (Assuming `profiles` table with `id = user.id` and `email_verified` boolean)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating profile email_verified:", updateError);
        // You *could* still continue to onboarding even if this fails
      }

      // 4) Go to onboarding screen
      router.replace("/pages/onboarding/start");
    };

    run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600 text-sm">Verifying your email…</p>
    </div>
  );
}