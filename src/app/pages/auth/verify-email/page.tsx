"use client";

import Link from "next/link";
import Image from "next/image";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16 text-center">
      <Image
        src="/images/logo-meuraki.svg"
        alt="Meuraki"
        width={140}
        height={40}
        className="mb-10 opacity-70"
      />

      <h1 className="text-3xl font-extrabold text-black mb-4">Verify your email</h1>
      <p className="text-gray-600 max-w-md mb-8">
        We’ve sent a verification link to your email address. Please check your inbox and click the link to activate your account.
      </p>

      <div className="flex flex-col items-center gap-4">
        <Link
          href="/pages/auth/login"
          className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-900 transition"
        >
          Go to Login
        </Link>
        <p className="text-gray-400 text-sm">
          Didn’t receive the email?{" "}
          <button
            onClick={() => window.location.reload()}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Resend
          </button>
        </p>
      </div>

      <footer className="mt-16 text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Meuraki Vendor Portal. All rights reserved.
      </footer>
    </div>
  );
}
