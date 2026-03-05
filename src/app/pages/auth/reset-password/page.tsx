"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";
import ClipLoader from "react-spinners/ClipLoader";

const bgVideos = ["/bg-1.mp4", "/bg-3.mp4", "/bg-4.mp4"];

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
  const [activeVideo, setActiveVideo] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      <div className="fixed inset-0 bg-gray-950 grid place-items-center">
        <ClipLoader size={28} color="#a855f7" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-950">
      {/* Video background */}
      <video
        ref={videoRef}
        key={activeVideo}
        src={bgVideos[activeVideo]}
        autoPlay
        muted
        playsInline
        onEnded={() => setActiveVideo((v) => (v + 1) % bgVideos.length)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div
        className="absolute inset-0 animate-gradient-shift"
        style={{
          backgroundSize: "300% 300%",
          backgroundImage:
            "linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(88,28,135,0.5) 20%, rgba(219,39,119,0.4) 40%, rgba(126,34,206,0.5) 60%, rgba(0,0,0,0.6) 80%, rgba(168,85,247,0.45) 100%)",
        }}
      />

      {/* Floating modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8 z-20">
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl shadow-black/60 bg-white p-8 sm:p-10 lg:p-12">
          <Link
            href="/pages/auth/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to sign in
          </Link>

          <h1 className="text-3xl font-extrabold leading-tight text-gray-900">
            Set your<br />new password
          </h1>
          <p className="mt-2 text-sm text-gray-500">Choose a strong password — at least 8 characters.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-bold tracking-wider text-gray-900 uppercase">
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="mt-2 w-full px-4 py-4 text-sm border border-gray-300 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                minLength={8}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold tracking-wider text-gray-900 uppercase">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="mt-2 w-full px-4 py-4 text-sm border border-gray-300 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                minLength={8}
                required
              />
            </div>

            {!!pwError && (
              <p className="text-xs text-red-600">{pwError}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || busy}
              className={`w-full py-4 rounded-2xl text-sm font-semibold text-white transition-all ${
                canSubmit && !busy
                  ? "bg-gray-900 hover:bg-gray-800"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {busy ? "Saving…" : "Set new password"}
            </button>

            <p className="text-xs text-gray-500">
              Need help?{" "}
              <a className="text-purple-600 font-medium" href="mailto:support@meuraki.com.sg">
                Contact support
              </a>
            </p>
          </form>

          <div className="flex justify-center mt-8">
            <Image src="/images/logo-meuraki.svg" alt="Meuraki" width={100} height={25} />
          </div>
        </div>
      </div>
    </div>
  );
}