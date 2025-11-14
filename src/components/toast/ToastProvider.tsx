"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";
type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms (default 3500)
};

type ToastContextType = {
  show: (t: Omit<Toast, "id">) => string;
  successToast: (t: Omit<Toast, "id" | "variant">) => string;
  errorToast: (t: Omit<Toast, "id" | "variant">) => string;
  info: (t: Omit<Toast, "id" | "variant">) => string;
  dismiss: (id: string) => void;
  promise: <T>(p: Promise<T>, msgs: {loading?: string; success?: string; error?: (e: any)=>string|string}) => Promise<T>;
};

const ToastContext = createContext<ToastContextType | null>(null);

// Dot color per variant
const dotByVariant: Record<ToastVariant, string> = {
  success: "bg-emerald-400",
  error: "bg-rose-400",
  info: "bg-purple-400",
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  const { id, title, description, variant = "info" } = toast;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-full max-w-sm rounded-full bg-black text-white shadow-lg ring-1 ring-black/5
                 transition-all data-[enter]:animate-[toast-in_160ms_ease] data-[leave]:animate-[toast-out_150ms_ease]"
      data-enter=""
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`mt-0.5 inline-block h-3.5 w-3.5 rounded-full ${dotByVariant[variant]}`} />
        <div className="min-w-0 flex-1">
          {title && <div className="text-[13px] font-semibold leading-tight">{title}</div>}
          {description && <div className="text-[12px] text-white/80">{description}</div>}
        </div>
        <button
          aria-label="Close"
          onClick={() => onClose(id)}
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Record<string, number>>({});

  // Core methods
  const dismiss = useCallback((id: string) => {
    setToasts((xs) => xs.filter((t) => t.id !== id));
    const tid = timeouts.current[id];
    if (tid) {
      window.clearTimeout(tid);
      delete timeouts.current[id];
    }
  }, []);

  const show = useCallback<ToastContextType["show"]>(
    ({ duration = 3500, ...rest }) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, duration, ...rest };
      setToasts((xs) => [toast, ...xs]);

      // auto close
      timeouts.current[id] = window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const successToast: ToastContextType["successToast"] = (t) => show({ ...t, variant: "success" });
  const errorToast: ToastContextType["errorToast"] = (t) => show({ ...t, variant: "error" });
  const info: ToastContextType["info"] = (t) => show({ ...t, variant: "info" });

  const promise: ToastContextType["promise"] = async (p, msgs) => {
    const id = show({ title: msgs.loading ?? "Working…", variant: "info", duration: 999_000 });
    try {
      const res = await p;
      dismiss(id);
      successToast({ title: msgs.success ?? "Done!", duration: 3000 });
      return res;
    } catch (e) {
      dismiss(id);
      const desc = typeof msgs.error === "function" ? msgs.error(e) : msgs.error ?? "Something went wrong.";
      errorToast({ title: "Error", description: desc, duration: 5000 });
      throw e;
    }
  };

  const value = useMemo(() => ({ show, successToast, errorToast, info, dismiss, promise }), [show, successToast, errorToast, info, dismiss, promise]);

  // Clean up timers on unmount
  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Portal container (bottom center on mobile, top-right on desktop) */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-3 px-4
                   sm:inset-auto sm:right-4 sm:top-4 sm:bottom-auto sm:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={dismiss} />
        ))}
      </div>

      {/* Keyframes (Tailwind inline) */}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(6px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-4px) scale(.98); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}