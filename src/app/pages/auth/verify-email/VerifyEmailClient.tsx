"use client";

import Image from "next/image";
import { useToast } from "../../../../components/toast/ToastProvider";

type Props = {
  email: string;
};

export default function VerifyEmailClient({ email }: Props) {
  const { successToast, errorToast } = useToast();

  async function resend() {
    if (!email) return;
    const r = await fetch("/api/auth/send-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, userName: email.split("@")[0] }),
    });
    if (r.ok) {
      successToast({ title: "Sent", description: "Check your inbox again." });
    } else {
      const j = await r.json().catch(() => ({}));
      errorToast({
        title: "Error",
        description: j.error || "Couldn’t send email.",
      });
    }
  }

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md">
          <div className="mt-2 h-14 w-14 grid place-items-center rounded-full bg-[#EFEDFF] text-purple-600">
            ✉️
          </div>
          <h2 className="mt-4 text-2xl font-semibold">Confirm your email</h2>
          <p className="mt-2 text-sm text-gray-600">
            We sent a confirmation link to {email || "your inbox"}. Click it to
            continue.
          </p>

          <button
            onClick={resend}
            className="mt-6 w-full h-12 rounded-full border bg-white hover:bg-gray-50"
          >
            Resend email
          </button>

          <p className="mt-6 text-xs text-gray-500">
            Didn’t get it? Check Spam/Promotions. Link is single-use; if it’s
            expired, click Resend.
          </p>
        </div>
      </div>

      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 lg:rounded-l-[28px] overflow-hidden">
          <Image
            src="/images/auth-hero.svg"
            alt=""
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
