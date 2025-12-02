"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/toast/ToastProvider";
import ClipLoader from "react-spinners/ClipLoader";

const redirectTo =
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
  "https://subscriber.meuraki.com.sg/pages/auth/callback";

type Errors = { email?: string; password?: string; form?: string };

export default function LoginForm() {
  const router = useRouter();
  const { successToast, errorToast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  function validate(): boolean {
    const next: Errors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) next.email = "Email is required.";
    else if (!emailRe.test(formData.email.trim()))
      next.email = "Enter a valid email address.";

    if (!formData.password) next.password = "Password is required.";
    else if (formData.password.length < 6)
      next.password = "Must be at least 6 characters.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // Check if already logged in
  useEffect(() => {
    let ignore = false;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (ignore) return;

        if (error) {
          console.error("session check error", error);
          setCheckingSession(false);
          return;
        }

        if (data?.session?.user) {
          router.replace("/pages/dashboard");
        } else {
          setCheckingSession(false);
        }
      } catch (err) {
        console.error("session check failed", err);
        if (!ignore) setCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      ignore = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      errorToast({
        title: "Check the form",
        description: "Please fix the highlighted fields.",
      });
      return;
    }

    try {
      setLoading(true);

      try {
        if (formData.rememberMe) {
          localStorage.setItem("remember:email", formData.email);
        } else {
          localStorage.removeItem("remember:email");
        }
      } catch {
        // ignore storage errors
      }

      const {
        data: { session },
        error: signErr,
      } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (signErr || !session) {
        const msg =
          signErr?.message
            ?.toLowerCase()
            .includes("invalid login credentials") ||
          signErr?.message?.toLowerCase().includes("invalid credentials")
            ? "Invalid email or password."
            : signErr?.message || "Unable to sign in.";

        setErrors((p) => ({ ...p, password: msg }));
        errorToast({ title: "Login failed", description: msg });
        return;
      }

      try {
        localStorage.setItem("vendor:isLoggedIn", "true");
      } catch {}

      successToast({
        title: "Welcome back",
        description: "You’re signed in.",
      });

      router.push("/pages/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error: oAuthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oAuthErr)
      errorToast({
        title: "Google sign-in failed",
        description: oAuthErr.message,
      });
  };

  // Block UI while checking session
  if (checkingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <ClipLoader size={28} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white lg:flex-row">
      {/* LEFT – FORM (scrollable if overflow) */}
      <div className="flex flex-1 items-start justify-center py-4 lg:items-center lg:py-0 overflow-y-auto">
        <div className="w-full max-w-sm px-4 sm:max-w-md sm:px-6 lg:max-w-lg lg:px-8 xl:px-10">
          {/* Heading */}
          <div className="mb-3 sm:mb-4 md:mb-5">
            <h1 className="mt-4 sm:mt-5 lg:mt-6 text-xl font-extrabold leading-tight text-black sm:text-3xl md:text-4xl lg:text-5xl">
              MEURAKI
              <br /> Subscriber Portal
            </h1>
            <p className="mt-2 text-xs text-gray-500 sm:mt-2 sm:text-sm md:text-sm">
              Welcome back! Please sign in to access your account.
            </p>
          </div>

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-3 sm:space-y-4 md:space-y-5"
          >
            {/* Email */}
            <div>
              <label className="text-xs font-semibold tracking-wide text-black sm:text-sm">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email)
                    setErrors((p) => ({ ...p, email: undefined }));
                }}
                className={[
                  "mt-2 w-full rounded-2xl border px-4",
                  "h-9 sm:h-10 md:h-11 lg:h-11 xl:h-12",
                  "bg-[#EFEDFF] text-gray-900 placeholder-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500",
                  errors.email ? "border-rose-500" : "border-transparent",
                ].join(" ")}
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="mt-1 text-xs text-rose-600 sm:text-sm"
                >
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold tracking-wide text-black sm:text-sm">
                PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: undefined }));
                }}
                className={[
                  "mt-2 w-full rounded-2xl border px-4",
                  "h-9 sm:h-10 md:h-11 lg:h-11 xl:h-12",
                  "bg-[#EFEDFF] text-gray-900 placeholder-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500",
                  errors.password ? "border-rose-500" : "border-transparent",
                ].join(" ")}
                required
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p
                  id="password-error"
                  className="mt-1 text-xs text-rose-600 sm:text-sm"
                >
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-500 sm:text-sm">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) =>
                    setFormData({ ...formData, rememberMe: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Remember me
              </label>
              <span />
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded-full bg-black text-xs font-medium text-white shadow-lg shadow-black/10 transition-colors hover:bg-gray-900 disabled:opacity-70 sm:h-10 sm:text-sm md:h-11 md:text-sm xl:h-12"
            >
              {loading ? "Signing in…" : "Login"}
            </button>

            {/* Forgot password */}
            <div className="-mt-1 text-center sm:-mt-1">
              <Link
                href="/pages/auth/forgot-password"
                className="text-xs font-medium text-purple-600 hover:text-purple-700 sm:text-sm"
              >
                Forgot your password?
              </Link>
            </div>

            {/* Divider */}
            <div className="relative my-3 sm:my-4 md:my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-500 sm:text-sm">
                  Or
                </span>
              </div>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex h-9 w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-xs font-medium text-gray-700 shadow-sm transition-shadow hover:shadow sm:h-10 sm:text-sm md:h-11 md:text-sm xl:h-12"
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

            {/* Subtext + register link */}
            <div className="mb-2 text-center sm:mb-3">
              <p className="text-xs text-gray-500 sm:text-sm">
                Don&apos;t have an account?{" "}
                <Link
                  href="/pages/auth/register"
                  className="font-medium text-purple-600 hover:text-purple-700"
                >
                  Register your brand
                </Link>
              </p>
              <div className="mt-2 flex justify-center sm:mt-3">
                <Image
                  src="/images/register-doodle.svg"
                  alt="Register doodle"
                  width={130}
                  height={55}
                />
              </div>
            </div>
          </form>

          {/* Footer Logo */}
          <div className="mb-3 mt-3 flex justify-center">
            <Image
              src="/images/logo-meuraki.svg"
              alt="Meuraki"
              width={110}
              height={26}
              className="opacity-60"
            />
          </div>
        </div>
      </div>

      {/* RIGHT – HERO (desktop only) */}
      <div className="relative hidden flex-1 lg:flex">
        <div className="absolute inset-0 overflow-hidden lg:rounded-l-3xl">
          <Image
            src="/images/hero-bg.gif"
            alt="Animated background"
            fill
            priority
            unoptimized
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/images/hero-overlay.png"
              alt="Meuraki overlay"
              width={320}
              height={640}
              className="pointer-events-none rounded-3xl"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}