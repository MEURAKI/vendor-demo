"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Tracks 'dirty' state and blocks SPA route changes + page unload.
 * Returns helpers and an interceptor you can call before navigating away.
 */
export function useUnsavedChanges() {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [onConfirm, setOnConfirm] = useState<null | (() => void)>(null);

  // Block hard refresh/close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = ""; // required by some browsers
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function confirmNavigate(next: () => void) {
    if (!dirty) return next();
    setOnConfirm(() => next);
    setConfirmOpen(true);
  }

  function proceed() {
    setConfirmOpen(false);
    setDirty(false);
    if (onConfirm) onConfirm();
  }

  function cancel() {
    setConfirmOpen(false);
    pendingHref.current = null;
  }

  return {
    dirty,
    setDirty,
    confirmOpen,
    confirmNavigate,
    proceed,
    cancel,
    router,
    setPendingHref: (href: string) => (pendingHref.current = href),
    getPendingHref: () => pendingHref.current,
  };
}
