"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";
import ClipLoader from "react-spinners/ClipLoader";

function readHash() {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    access_token: p.get("access_token"),
    refresh_token: p.get("refresh_token"),
    type: p.get("type"),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { successToast, errorToast } = useToast();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const pwError =
    pw1.length > 0 && pw1.length < 8
      ? "Password must be at least 8 characters."
      : pw1 && pw2 && pw1 !== pw2
      ? "Passwords do not match."
      : "";

  const canSubmit = useMemo(() => pw1.length >= 8 && pw1 === pw2, [pw1, pw2]);

  // Validate the recovery link & set the session
  useEffect(() => {
    (async () => {
      const { access_token, refresh_token, type } = readHash();
      // If the link doesn't carry a recovery session, we still show the form;
      // submission will fail with a clear error.
      if (type !== "recovery" || !access_token || !refresh_token) {
        setReady(true);
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) {
        errorToast({
          title: "Invalid or expired link",
          description: error.message,
        });
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);

    if (error) {
      errorToast({ title: "Couldn’t set password", description: error.message });
      return;
    }
    successToast({
      title: "Password updated",
      description: "You can now sign in with your new password.",
    });
    router.push("/pages/auth/login");
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
               <ClipLoader size={24} color="gray" />
      </div>
    ); 
  }

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link
            href="/pages/auth/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            <span className="-rotate-90 text-lg leading-none">⌃</span>
            Go Back
          </Link>

          {/* Heading */}
          <div className="mt-6 mb-6">
            <h1 className="text-3xl font-extrabold leading-tight text-black">
              Enter your
              <br /> new password
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            {/* New password */}
            <div>
              <label className="block text-xs font-semibold tracking-wide text-black">
                NEW PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className={[
                  "mt-2 w-full h-12 rounded-2xl px-4",
                  "bg-[#EFEDFF] border border-transparent",
                  "text-gray-900 placeholder-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500",
                ].join(" ")}
                minLength={8}
                required
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold tracking-wide text-black">
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className={[
                  "mt-2 w-full h-12 rounded-2xl px-4",
                  "bg-[#EFEDFF] border border-transparent",
                  "text-gray-900 placeholder-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500",
                ].join(" ")}
                minLength={8}
                required
              />
            </div>

            {/* Inline validation */}
            {!!pwError && (
              <p className="text-xs text-red-600 -mt-2">{pwError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit || busy}
              className={[
                "w-full h-12 rounded-full text-white text-base font-medium",
                "shadow-lg shadow-black/10 transition-colors",
                canSubmit && !busy
                  ? "bg-black hover:bg-gray-900"
                  : "bg-gray-300 cursor-not-allowed",
              ].join(" ")}
            >
              {busy ? "Saving…" : "Set new password"}
            </button>

            {/* Support */}
            <p className="mt-2 text-xs text-gray-500">
              If you need further assistance{" "}
              <a
                className="text-purple-600 font-medium"
                href="mailto:support@meuraki.com.sg"
              >
                contact our support team
              </a>
            </p>
          </form>
        </div>
      </div>

      {/* Right — hero panel */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 lg:rounded-l-[28px] overflow-hidden">
      
          {/* --- GIF Background --- */}
          <Image
            src="/images/hero-bg.gif"
            alt="Animated background"
            fill
            priority
            unoptimized
            className="object-cover"
          />
      
          {/* --- PNG Overlay (logo, text, etc.) --- */}
           <div className="absolute inset-0 flex items-center justify-center">
                      <Image
                        src="/images/hero-overlay.png"
                        alt="Meuraki overlay"
                        width={320} // adjust if needed
                        height={640}
                        className="rounded-[28px] pointer-events-none"
                      />
                    </div>
      
          {/* Optional gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}