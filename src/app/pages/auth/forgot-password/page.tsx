"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

const RESET_REDIRECT =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") + "/pages/auth/reset-password";

export default function ForgotPasswordPage() {
  const { successToast, errorToast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
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
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md">
          <Link href="/pages/auth/login" className="text-purple-600 text-sm font-medium inline-flex items-center gap-2 mb-6">
            <span className="rotate-180">›</span> Go Back
          </Link>

          {!sent ? (
            <>
              <h1 className="text-[28px] font-extrabold leading-tight text-black">Recover your password</h1>
              <p className="mt-2 text-sm text-gray-500">
                Enter the email used to sign up. We’ll email you a reset link.
              </p>

              <label className="mt-6 block text-xs font-semibold tracking-wide text-black">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full h-12 rounded-2xl px-4 bg-[#EFEDFF] border border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              <button
                onClick={sendLink}
                className="mt-5 w-full h-12 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900"
              >
                Send Link
              </button>

              <p className="mt-6 text-xs text-gray-500">
                If you need further assistance{" "}
                <a className="text-purple-600 font-medium" href="mailto:support@meuraki.com.sg">
                  contact our support team
                </a>
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 h-14 w-14 grid place-items-center rounded-full bg-[#EFEDFF] text-purple-600">
                ✉️
              </div>
              <h2 className="mt-4 text-xl font-semibold">We’ve sent you an email</h2>
              <p className="mt-2 text-sm text-gray-600">
                Can’t find it? Check your Spam or Promotions. It may take up to 30 seconds.
              </p>

              <button
                disabled={!canSend}
                onClick={sendLink}
                className={`mt-6 w-full h-12 rounded-full border ${
                  canSend ? "bg-white hover:bg-gray-50" : "bg-gray-50 text-gray-400"
                }`}
                title={canSend ? "Resend link" : "Please wait"}
              >
                {canSend ? "Resend Link" : `Resend in ${cooldown}s`}
              </button>

              <p className="mt-6 text-xs text-gray-500">
                Didn’t receive your email?{" "}
                <button
                  className="text-purple-600 font-medium disabled:text-gray-400"
                  onClick={sendLink}
                  disabled={!canSend}
                >
                  Resend
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right – hero */}
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