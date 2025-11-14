"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onCancel: () => void;     // close dialog, keep editing
  onDiscard: () => void;    // discard changes & continue nav
  onSave: () => void;       // call your save handler then close/continue
};

export default function UnsavedChangesDialog({
  open,
  onCancel,
  onDiscard,
  onSave,
}: Props) {
  // lock scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Dialog */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-[420px] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="p-6">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-yellow-100 text-yellow-700">
              {/* warning icon */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
              </svg>
            </div>
            <h3 className="text-center text-[15px] font-semibold text-gray-900">
              Unsaved Changes
            </h3>
            <p className="mt-1 text-center text-xs text-gray-500">
              You’ve made changes that haven’t been saved. If you leave this page,
              your updates will be lost.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                className="h-10 rounded-full border border-gray-200 px-5 text-sm text-gray-700 hover:bg-gray-50"
                onClick={onDiscard}
              >
                Discard
              </button>
              <button
                type="button"
                className="h-10 rounded-full bg-black px-6 text-sm font-medium text-white hover:bg-gray-900"
                onClick={onSave}
              >
                Save changes
              </button>
            </div>

            <button
              className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100"
              onClick={onCancel}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.42L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
