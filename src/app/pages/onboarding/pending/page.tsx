"use client";
import Image from "next/image";
import WizardHeader from "../../../../components/auth/onboarding/WizardHeader";

export default function PendingReview() {
  return (
    <div className="relative min-h-screen bg-gradient-to-tr from-purple-50 via-white to-purple-50 overflow-hidden font-poppins">
      <div className="pointer-events-none absolute left-0 top-0 h-[520px] w-[520px] bg-purple-200/40 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-[520px] w-[520px] bg-fuchsia-200/40 blur-[140px]" />

      <div className="hidden md:block fixed top-4 left-0 right-0 z-40">
        <div className="mx-auto max-w-3xl px-4">
          <div className="relative rounded-xl bg-white/90 backdrop-blur-md shadow-sm border border-gray-100">
            <span className="absolute left-0 top-0 h-[3px] w-48 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
            <div className="px-4 py-2">
              <WizardHeader current={3} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center pt-10 md:pt-[140px] pb-24 px-4">
        <div className="max-w-lg w-full text-center bg-white rounded-[28px] shadow-xl p-10">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-3xl">🌧️</span>
          </div>
          <h1 className="text-2xl font-extrabold mb-2">
            Are you sure?<br/>We won’t be able to verify your business yet.
          </h1>
          <p className="text-gray-600 leading-relaxed">
            You can complete your onboarding later from your account. However, <b>you won’t be able to start selling or receive payments</b> until all required details and documents are submitted and approved.
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <a href="/pages/onboarding/verify" className="px-6 py-3 rounded-full bg-black text-white hover:bg-gray-900">Go back to onboarding</a>
            <a href="/pages/dashboard" className="px-6 py-3 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200">Finish later</a>
          </div>
        </div>
      </div>

      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2">
        <Image src="/images/logo-meuraki.svg" width={120} height={30} alt="Meuraki" />
      </div>
    </div>
  );
}
