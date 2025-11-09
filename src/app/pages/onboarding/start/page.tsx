"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";

export default function OnboardingStart() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Soft purple background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-purple-300/30 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-fuchsia-300/25 blur-[140px]"
      />

      {/* Left / Right slogans */}
      <div className="absolute inset-0 max-w-7xl mx-auto px-6">
        <p
          aria-hidden
          className="select-none hidden md:block absolute left-0 top-1/3 -translate-y-1/2 text-[11px] tracking-[0.35em] font-semibold text-purple-300/60"
          style={{ writingMode: "vertical-rl" }}
        >
          MEURAKI HOLISTIC REVOLUTION
        </p>
        <p
          aria-hidden
          className="select-none hidden md:block absolute right-0 top-1/3 -translate-y-1/2 text-[11px] tracking-[0.35em] font-semibold text-purple-300/60"
          style={{ writingMode: "vertical-rl" }}
        >
          JOIN THE WELLNESS COMMUNITY
        </p>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 mx-6 w-full max-w-xl rounded-[28px] bg-white/95 shadow-2xl ring-1 ring-black/5"
      >
        <div className="px-8 sm:px-12 py-10 sm:py-12 text-center">
          {/* Badge */}
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-purple-500 to-purple-600 shadow-md">
            <svg width="22" height="22" viewBox="0 0 24 24" className="text-white">
              <path
                fill="currentColor"
                d="M9 16.2 5.5 12.7 4.1 14.1 9 19l11.3-11.3-1.4-1.4z"
              />
            </svg>
          </div>

          {/* Headline */}
          <h1 className="text-[22px] sm:text-[26px] font-extrabold leading-tight text-gray-900">
            Welcome to the <span className="whitespace-nowrap">MEURAKI Wellness Collective</span> 🌿
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            To begin your journey, let’s complete your onboarding in two quick steps.
          </p>

          {/* Divider */}
          <div className="mx-auto my-6 h-px w-24 bg-gray-200" />

          {/* Steps */}
          <div className="mx-auto w-full max-w-sm space-y-4 text-left">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-semibold tracking-widest text-gray-500">STEP 1</div>
              <div className="mt-1 text-sm text-gray-700">
                Tell us about your brand and offerings so we can set up your profile.
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-semibold tracking-widest text-gray-500">STEP 2</div>
              <div className="mt-1 text-sm text-gray-700">
                Once approved by the MEURAKI team, your dashboard will unlock and you’ll receive a confirmation email.
              </div>
            </div>
          </div>

          {/* CTA pill */}
          <button
            onClick={() => router.push("/pages/onboarding/form")}
            className="group relative mx-auto mt-8 inline-flex w-full max-w-sm items-center justify-center rounded-full bg-black px-6 py-3 text-white shadow-lg transition hover:bg-gray-900"
          >
            <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M8 5l8 7-8 7V5z"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </svg>
            </span>
            <span className="text-sm font-medium">Swipe to start onboarding</span>
          </button>
        </div>
      </motion.div>

      {/* Footer logo */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 opacity-80">
        <Image src="/images/logo-meuraki.svg" alt="Meuraki" width={110} height={26} />
      </div>
    </div>
  );
}
