"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const redirectTo = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || "https://vendor.meuraki.com.sg/pages/auth/callback";


export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const { email, password } = formData;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login error:", error.message);
    alert(error.message);
  } else {
    // Redirect to dashboard
    router.push("/pages/dashboard");
  }
};

  const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo },
  });
  if (error) alert(error.message);
};


  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left – form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md">
          {/* Logo + Heading */}
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-black">
              MEURAKI<br />Vendor Portal
            </h1>
            <p className="mt-3 text-base text-gray-500">
              Welcome back! Please sign in to access your account.
            </p>
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
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-2 w-full h-14 rounded-2xl px-4
                           bg-[#EFEDFF] border border-transparent
                           text-gray-900 placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-2 w-full h-14 rounded-2xl px-4
                           bg-[#EFEDFF] border border-transparent
                           text-gray-900 placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            {/* Row: remember + forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Remember me
              </label>

              <Link href="/auth/forgot-password" className="text-sm font-medium text-purple-600 hover:text-purple-700">
                Forgot password?
              </Link>
            </div>

            {/* Login button */}
            <button
              type="submit"
              className="w-full h-14 rounded-full bg-black text-white text-base font-medium
                         shadow-lg shadow-black/10 hover:bg-gray-900 transition-colors"
            >
              Login
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

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-14 rounded-2xl bg-white border border-gray-200
                         flex items-center justify-center gap-3 text-gray-700 font-medium
                         shadow-sm hover:shadow transition-shadow"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Subtext */}
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/pages/auth/register" className="text-purple-600 hover:text-purple-700 font-medium">
                Register your brand
              </Link>
            </p>
          </form>

          {/* Footer Logo */}
          <div className="mt-10 flex justify-center">
            <Image src="/images/logo-meuraki.svg" alt="Meuraki" width={120} height={28} className="opacity-60" />
          </div>
        </div>
      </div>

      {/* Right – hero panel */}
      <div className="hidden lg:block lg:w-1/2 relative">
        {/* rounded card feel */}
        <div className="absolute inset-0 lg:rounded-l-[28px] overflow-hidden">
          <Image
            src="/images/auth-hero.svg"   // NOTE: path from /public
            alt="Fashion model"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        </div>

        {/* Quote text */}
        {/* <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-lg leading-relaxed font-medium max-w-[480px]">
            “Untitled Labs were a breeze to work alongside, we can’t recommend them enough.
            We launched 6 months earlier than expected and are growing 30% MoM.”
          </p>
          <p className="mt-4 text-white/80 text-sm">
            Amélie Laurent<br />
            <span className="text-white/60">Founder, Sisyphus</span>
          </p>
        </div> */}
      </div>
    </div>
  );
}
