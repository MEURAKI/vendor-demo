"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

const bgVideos = ["/bg-1.mp4", "/bg-3.mp4", "/bg-4.mp4"];

const RESET_REDIRECT =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") + "/pages/auth/reset-password";

export default function ForgotPasswordPage() {
  const { successToast, errorToast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [activeVideo, setActiveVideo] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canSend = useMemo(() => cooldown === 0, [cooldown]);

  useEffect(() => {
    if (!sent) return;
    setCooldown(30);
  }, [sent]);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const subscribeMailchimp = async (addr: string) => {
    try {
      await fetch("/api/mailchimp/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      // ignore non-critical errors silently
    } catch {}
  };

async function sendLink() {
  if (!email) { errorToast({ title: "Email required", description: "Enter a valid email." }); return; }
  const r = await fetch("/api/auth/send-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const j = await r.json();
  if (!r.ok) return errorToast({ title: "Error", description: j.error || "Failed to send." });
  setSent(true);
  successToast({ title: "Email sent", description: "Check your inbox for the reset link." });
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

          {!sent ? (
            <>
              <h1 className="text-3xl font-extrabold leading-tight text-gray-900">Recover your<br />password</h1>
              <p className="mt-2 text-sm text-gray-500">
                Enter the email used to sign up. We&apos;ll email you a reset link.
              </p>

              <label className="mt-6 block text-xs font-bold tracking-wider text-gray-900 uppercase">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full px-4 py-4 text-sm border border-gray-300 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                autoFocus
              />

              <button
                onClick={sendLink}
                className="mt-5 w-full py-4 rounded-2xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all"
              >
                Send Reset Link
              </button>

              <p className="mt-5 text-xs text-gray-500">
                Need help?{" "}
                <a className="text-purple-600 font-medium" href="mailto:support@meuraki.com.sg">
                  Contact support
                </a>
              </p>
            </>
          ) : (
            <>
              <div className="h-14 w-14 grid place-items-center rounded-2xl bg-purple-50 text-2xl mb-4">
                ✉️
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">Check your email</h2>
              <p className="mt-2 text-sm text-gray-500">
                We sent a reset link to <span className="font-medium text-gray-700">{email}</span>.
                Can&apos;t find it? Check spam or promotions.
              </p>

              <button
                disabled={!canSend}
                onClick={sendLink}
                className={`mt-6 w-full py-4 rounded-2xl text-sm font-semibold border transition-all ${
                  canSend
                    ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {canSend ? "Resend Link" : `Resend in ${cooldown}s`}
              </button>
            </>
          )}

          <div className="flex justify-center mt-8">
            <Image src="/images/logo-meuraki.svg" alt="Meuraki" width={100} height={25} />
          </div>
        </div>
      </div>
    </div>
  );
}