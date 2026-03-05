"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/toast/ToastProvider";
import ClipLoader from "react-spinners/ClipLoader";
import clsx from "clsx";

const redirectTo =
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
  "https://subscriber.meuraki.com.sg/pages/auth/callback";

const bgVideos = ["/bg-1.mp4", "/bg-3.mp4", "/bg-4.mp4"];

type Errors = { email?: string; password?: string; form?: string };

/* ── Carousel slides ── */
const slides = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: "Grow Your\nWellness Brand",
    desc: "Reach thousands of wellness seekers and expand your business with Meuraki's trusted marketplace.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    title: "Manage Everything\nSeamlessly",
    desc: "Products, services, bookings, and payments — all in one powerful vendor dashboard.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    ),
    title: "Real Data, Real\nDecisions",
    desc: "Track your sales, bookings, and customer engagement with powerful analytics and insights.",
  },
];

export default function LoginForm() {
  const router = useRouter();
  const { errorToast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeVideo, setActiveVideo] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Auto-rotate carousel
  useEffect(() => {
    const timer = setInterval(
      () => setActiveSlide((s) => (s + 1) % slides.length),
      5000
    );
    return () => clearInterval(timer);
  }, []);

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

      try {
        sessionStorage.setItem("vendor:showSplash", "1");
      } catch {}

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
      {/* Frosted + animated gradient tint */}
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

        <div className="relative z-10 w-full max-w-5xl max-h-[92vh] flex rounded-3xl overflow-hidden shadow-2xl shadow-black/60">

          {/* Left panel — White form */}
          <div className="flex-1 flex flex-col justify-between p-8 sm:p-10 lg:p-12 bg-white overflow-y-auto">
            <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                MEURAKI
                <br />
                Vendor Portal
              </h1>
              <p className="text-sm text-gray-500 mt-3">
                Welcome back! Please sign in to access your account.
              </p>

              <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
                {/* Email */}
                <div>
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Email Address
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
                    className={clsx(
                      "w-full mt-2 px-4 py-4 text-sm border rounded-2xl bg-white transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400",
                      errors.email ? "border-red-300 bg-red-50" : "border-gray-300"
                    )}
                    required
                    autoFocus
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="mt-1 text-xs text-red-600">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (errors.password)
                          setErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={clsx(
                        "w-full mt-2 px-4 py-4 pr-12 text-sm border rounded-2xl bg-white transition-all",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400",
                        errors.password ? "border-red-300 bg-red-50" : "border-gray-300"
                      )}
                      required
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 translate-y-[-30%] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="mt-1 text-xs text-red-600">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Remember me + Forgot password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
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
                  <Link
                    href="/pages/auth/forgot-password"
                    className="text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Login button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-4 text-sm font-semibold text-white bg-gray-900 rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>

                {/* Divider */}
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-gray-400">
                      or continue with
                    </span>
                  </div>
                </div>

                {/* Google button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Register link */}
                <p className="text-center text-sm text-gray-500">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/pages/auth/register"
                    className="font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Register your brand
                  </Link>
                </p>
              </form>
            </div>

            {/* Bottom logo */}
            <div className="flex justify-center mt-6">
              <Image
                src="/images/logo-meuraki.svg"
                alt="Meuraki"
                width={120}
                height={30}
              />
            </div>
          </div>

          {/* Right panel — Glass carousel with video showing through */}
          <div className="hidden lg:flex lg:w-[45%] bg-white/[0.03] backdrop-blur-md p-10 flex-col justify-end relative overflow-hidden border-l border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-purple-800/20" />

            <div className="relative z-10 mb-12">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white mb-6">
                {slides[activeSlide].icon}
              </div>
              <h2 className="text-3xl font-extrabold text-white leading-tight whitespace-pre-line transition-all duration-500">
                {slides[activeSlide].title}
              </h2>
              <p className="text-sm text-white/70 mt-3 max-w-md leading-relaxed transition-all duration-500">
                {slides[activeSlide].desc}
              </p>
            </div>

            {/* Carousel controls */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === activeSlide ? "w-8 bg-white" : "w-2 bg-white/40"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setActiveSlide((activeSlide - 1 + slides.length) % slides.length)
                  }
                  className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    setActiveSlide((activeSlide + 1) % slides.length)
                  }
                  className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
