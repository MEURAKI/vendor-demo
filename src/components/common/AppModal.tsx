"use client";

import Image from "next/image";
import React from "react";

interface AppModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
  onClose?: () => void;
}

export default function AppModal({
  open,
  title,
  message,
  primaryLabel = "Okay",
  onPrimaryClick,
  onClose,
}: AppModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl bg-[#F9F8FF] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)] border border-[#E5E0FF]">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1B1529]">
              {title}
            </h2>

            <div className="mt-2 text-xs text-gray-600 leading-relaxed">
              {message}
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:opacity-70 transition"
          >
            <Image
              src="/images/common/close-button.svg"
              alt="Close"
              width={26}
              height={26}
            />
          </button>
        </div>

        {/* CTA */}
        {onPrimaryClick && (
          <div className="mt-6">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="w-full rounded-full bg-[#5B33FF] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#4a2bd6] transition"
            >
              {primaryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}