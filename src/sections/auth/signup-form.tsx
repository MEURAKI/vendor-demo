"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/toast/ToastProvider";

const redirectTo =
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
  "https://subscriber.meuraki.com.sg/pages/auth/callback";

export default function SignupForm() {
  const router = useRouter();
  const { successToast, errorToast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    acceptTerms: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const doSignup = async (opts?: { quick?: boolean }) => {
    const quick = opts?.quick ?? false;

    if (!formData.acceptTerms) {
      errorToast({
        title: "Error",
        description: "Please accept the terms and conditions",
      });
      return;
    }

    const { email, password } = formData;

    setIsSubmitting(true);

    // 1) Supabase sign up with metadata flag
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          quick_signup: quick,
        },
      },
    });

    if (error) {
      console.error("Signup error:", error.message);
      errorToast({ title: "Error", description: error.message });
      setIsSubmitting(false);
      return;
    }

    // 1.5) If quick signup, mark onboarding_completed = true on profiles
    if (quick && data.user?.id) {
      try {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true, status: "incomplete_registration", email_verified: true })
          .eq("id", data.user.id);

        if (profileError) {
          console.error(
            "Error setting onboarding_completed on profile:",
            profileError.message
          );
        }
      } catch (e) {
        console.error("Unexpected error updating profile onboarding flag:", e);
      }
    }

    try {
      if (quick) {
        // QUICK SIGN UP FLOW:
        // - no email verification
        // - log the user in
        // - notify admin
        // - go straight to dashboard

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error("Quick signup sign-in error:", signInError.message);
          errorToast({
            title: "Error",
            description:
              signInError.message ||
              "Could not sign you in after creating your account.",
          });
          setIsSubmitting(false);
          return;
        }

        // Notify admin (fire-and-forget)
        fetch("/api/auth/notify-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            quickSignup: true,
            userId: data.user?.id,
          }),
        }).catch((err) => {
          console.error("Failed to notify admin:", err);
        });

        successToast({
          title: "Welcome!",
          description: "Your account is ready and you’re now logged in.",
        });

        setFormData({
          email: "",
          password: "",
          acceptTerms: false,
        });

        router.push("/pages/dashboard");
        setIsSubmitting(false);
        return;
      }

      // NORMAL SIGNUP FLOW:
      // 2) Send verification email (your existing endpoint)
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
        setIsSubmitting(false);
        return;
      }

      // 3) Notify admin for normal signup as well
      fetch("/api/auth/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          quickSignup: false,
          userId: data.user?.id,
        }),
      }).catch((err) => {
        console.error("Failed to notify admin:", err);
      });

      successToast({
        title: "Check your email",
        description: "We’ve sent a verification link to your inbox.",
      });

      setFormData({
        email: "",
        password: "",
        acceptTerms: false,
      });

      // 4) Normal flow → verify email screen
      router.push(
        `/pages/auth/verify-email?email=${encodeURIComponent(email)}`
      );
    } catch (err) {
      console.error("Network error during signup:", err);
      errorToast({
        title: "Error",
        description: "Network error. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await doSignup({ quick: false });
  };

  const handleQuickSignup = async () => {
    await doSignup({ quick: true });
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) errorToast({ title: "Error", description: error.message });
  };

  return (
    // Full-page scroll (scrollbar on far right), 2-column on desktop
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Left – Form */}
      <div className="flex flex-1 items-start justify-center px-6 sm:px-10 lg:px-16 py-8 lg:items-center">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-black mb-1">
              Create an account
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Please fill in your login details
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-black font-semibold tracking-wide text-xs sm:text-sm">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((s) => ({ ...s, email: e.target.value }))
                }
                className="mt-2 w-full h-11 sm:h-12 rounded-2xl px-4
                           bg-[#EFEDFF] border border-transparent
                           text-gray-900 placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Email Address"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-black font-semibold tracking-wide text-xs sm:text-sm">
                PASSWORD
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((s) => ({ ...s, password: e.target.value }))
                }
                className={`mt-2 w-full h-11 sm:h-12 rounded-2xl px-4
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

              {formData.password.length > 0 && (
                <div id="password-hints" className="mt-2">
                  <p className="text-xs text-gray-500 mb-1.5">
                    Password must include:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
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
            <label className="flex items-start gap-3 text-xs sm:text-sm text-gray-600">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) =>
                  setFormData((s) => ({
                    ...s,
                    acceptTerms: e.target.checked,
                  }))
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

            {/* CTA – normal sign up */}
            <button
              type="submit"
              disabled={!allGood || isSubmitting}
              className={`w-full h-11 sm:h-12 rounded-full text-sm sm:text-base font-medium transition-colors shadow-lg
                         ${
                           allGood && !isSubmitting
                             ? "bg-black text-white hover:bg-gray-900"
                             : "bg-gray-200 text-gray-500 cursor-not-allowed"
                         }`}
            >
              {isSubmitting ? "Signing up..." : "Sign up"}
            </button>

            {/* Quick sign up – skips confirmation & onboarding */}
            <button
              type="button"
              onClick={handleQuickSignup}
              disabled={!allGood || isSubmitting}
              className="w-full h-10 sm:h-11 rounded-full text-xs sm:text-sm font-medium mt-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              Quick sign up (skip email & onboarding)
            </button>

            {/* Divider */}
            <div className="relative my-4 sm:my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs sm:text-sm text-gray-500">
                  Or
                </span>
              </div>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isSubmitting}
              className="w-full h-11 sm:h-12 rounded-2xl bg-white border border-gray-200
                         flex items-center justify-center gap-3 text-sm text-gray-700 font-medium
                         shadow-sm hover:shadow transition-shadow disabled:cursor-not-allowed"
            >
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
            <p className="text-center text-xs sm:text-sm text-gray-600">
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
          <div className="mt-8 flex justify-center">
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

      {/* Right – hero panel */}
      <div className="relative hidden flex-1 lg:flex">
        <div className="absolute inset-0 lg:rounded-l-[28px] overflow-hidden">
          {/* GIF background – full column */}
          <Image
            src="/images/hero-bg.gif"
            alt="Animated background"
            fill
            priority
            unoptimized
            className="object-cover"
          />

          {/* PNG overlay – centered card */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/images/hero-overlay.png"
              alt="Meuraki overlay"
              width={320}
              height={640}
              className="rounded-[28px] pointer-events-none"
            />
          </div>
        </div>
      </div>
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
