"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client"; // keep your path
import { useToast } from "../../components/toast/ToastProvider";

const redirectTo = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || "https://vendor.meuraki.com.sg/pages/auth/callback";

export default function SignupForm() {
  const router = useRouter();
  const { successToast, errorToast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    acceptTerms: false,
  });

  // Password checks
  const checks = useMemo(() => {
    const p = formData.password || "";
    return {
      length: p.length >= 8,
      lower: /[a-z]/.test(p),
      upper: /[A-Z]/.test(p),
      number: /\d/.test(p),
      special: /[^A-Za-z0-9]/.test(p),
    };
  }, [formData.password]);

  const allGood =
    checks.length &&
    checks.lower &&
    checks.upper &&
    checks.number &&
    checks.special &&
    formData.acceptTerms;

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.acceptTerms) {
    errorToast({ title: "Error", description: "Please accept the terms and conditions" });
    return;
  }

  const { email, password } = formData;

  // 1) Create the user in Supabase (no need for emailRedirectTo anymore)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Signup error:", error.message);
    errorToast({ title: "Error", description: error.message });
    return;
  }

  // 2) Send verification email via your Mandrill endpoint
  try {
    const r = await fetch("/api/auth/send-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, userName: email.split("@")[0] }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.error("send-verify error:", j);
      errorToast({
        title: "Error",
        description: j.error || "Couldn’t send verification email.",
      });
      return; // don't redirect if email didn't send
    }

    // Optional: toast to confirm we sent it
    successToast({
      title: "Check your email",
      description: "We’ve sent a verification link to your inbox.",
    });

    // 3) Clear form
    setFormData({
      email: "",
      password: "",
      acceptTerms: false,
    });

    // 4) Redirect, pass email so Verify page can display & resend
    router.push(`/pages/auth/verify-email?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Network error sending verify email:", err);
    errorToast({
      title: "Error",
      description: "Network error. Please try again.",
    });
  }
};

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo },
    });
    if (error) errorToast({ title: "Error", description: error.message });
  };

  return (
    // Whole page is scrollable; right hero sticks on desktop
    <div className="min-h-[100svh] bg-white lg:grid lg:grid-cols-2">
      {/* Left – Form (scrolls naturally when tall) */}
      <div className="flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-black mb-1">
              Create an account
            </h1>
            <p className="text-gray-500">Please fill in your login details</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="text-black font-semibold tracking-wide text-sm">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((s) => ({ ...s, email: e.target.value }))
                }
                className="mt-2 w-full h-14 rounded-2xl px-4
                           bg-[#EFEDFF] border border-transparent
                           text-gray-900 placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Email Address"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-black font-semibold tracking-wide text-sm">
                PASSWORD
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((s) => ({ ...s, password: e.target.value }))
                }
                className={`mt-2 w-full h-14 rounded-2xl px-4
                           bg-[#EFEDFF] border
                           ${
                             formData.password && !allGood
                               ? "border-purple-300"
                               : "border-transparent"
                           }
                           text-gray-900 placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="Create a strong password"
                required
                aria-describedby="password-hints"
              />

              {/* Hints only when typing */}
              {formData.password.length > 0 && (
                <div id="password-hints" className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Password must include:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Req ok={checks.lower} label="1 lowercase" />
                    <Req ok={checks.upper} label="1 uppercase" />
                    <Req ok={checks.number} label="1 number" />
                    <Req ok={checks.special} label="1 special character" />
                    <Req ok={checks.length} label="8+ characters" />
                  </div>
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) =>
                  setFormData((s) => ({ ...s, acceptTerms: e.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>
                By clicking “Sign up”, you are creating a{" "}
                <b>MEURAKI Subscriber account</b> and therefore you agree to
                MEURAKI{" "}
                <Link
                  href="/terms"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {/* CTA */}
            <button
              type="submit"
              disabled={!allGood}
              className={`w-full h-14 rounded-full text-base font-medium transition-colors shadow-lg
                         ${
                           allGood
                             ? "bg-black text-white hover:bg-gray-900"
                             : "bg-gray-200 text-gray-500 cursor-not-allowed"
                         }`}
            >
              Sign up
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-sm text-gray-500">Or</span>
              </div>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              className="w-full h-14 rounded-2xl bg-white border border-gray-200
                         flex items-center justify-center gap-3 text-gray-700 font-medium
                         shadow-sm hover:shadow transition-shadow"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>


            {/* Switch to login */}
            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/pages/auth/login"
                className="text-black font-semibold hover:underline"
              >
                Log in
              </Link>
            </p>
          </form>

          {/* Footer logo */}
          <div className="mt-10 flex justify-center">
            <Image
              src="/images/logo-meuraki.svg"
              alt="Meuraki"
              width={120}
              height={28}
              className="opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Right – Hero (sticky on desktop) */}
      <aside className="hidden lg:block relative">
        <div className="sticky top-0 h-[100svh] lg:rounded-l-[28px] overflow-hidden">
          <Image
            src="/images/auth-hero.svg"
            alt="Fashion model"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
          {/* <div className="absolute bottom-10 left-10 right-10 text-white">
            <p className="text-lg leading-relaxed font-medium max-w-[480px]">
              “Untitled Laboratory: a haven of avant-garde. With unceasing
              innovation, we transform abstract ideas into tangible reality.”
            </p>
            <p className="mt-4 text-white/80 text-sm">
              Amelia Laurent
              <br />
              <span className="text-white/60">Founder, Elevatar</span>
            </p>
          </div> */}
        </div>
      </aside>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs
                  ${ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
      role="status"
      aria-live="polite"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 20.3 7.7l-1.4-1.4z"
          fill="currentColor"
          opacity={ok ? 1 : 0.45}
        />
      </svg>
      {label}
    </span>
  );
}
