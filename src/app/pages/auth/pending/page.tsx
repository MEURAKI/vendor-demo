"use client";
import Link from "next/link";
import Image from "next/image";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-white p-6 text-center">
      <Image
        src="/images/logo-meuraki.svg"
        alt="Meuraki"
        width={140}
        height={32}
        className="mb-6 opacity-70"
      />
      <div className="max-w-md bg-white shadow-xl rounded-3xl px-8 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
          Registration Submitted ✨
        </h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          Thank you for joining the <b>MEURAKI Wellness Collective</b>.
          <br />
          Your account is currently awaiting admin approval.
          Once approved, you’ll receive an email notification and gain access to
          your onboarding.
        </p>
        <div className="text-sm text-gray-500">
          Need help?{" "}
          <Link href="/contact" className="text-purple-600 hover:underline">
            Contact the Meuraki team
          </Link>
        </div>
      </div>
    </div>
  );
}
