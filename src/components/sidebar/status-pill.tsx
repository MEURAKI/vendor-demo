// components/sidebar/status-pill.tsx
import React from "react";
import type { VendorStatus } from "./sidebar-types";

const STATUS_MAP: Record<
  VendorStatus,
  { label: string; bg: string; dot: string; intent: string }
> = {
  incomplete_registration: { label: "Incomplete Registration", bg: "bg-red-100 text-red-700", dot: "bg-red-500", intent: "Urgent" },
  under_review:            { label: "Under Review",            bg: "bg-amber-100 text-amber-700", dot: "bg-amber-500", intent: "Info" },
  agreement_pending:       { label: "Agreement Pending",       bg: "bg-purple-100 text-purple-700", dot: "bg-purple-500", intent: "Formal" },
  active:                  { label: "Shop Active",             bg: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", intent: "Success" },
  inactive:                { label: "Shop Inactive",           bg: "bg-zinc-200 text-zinc-700", dot: "bg-zinc-500", intent: "Neutral" },
  draft:                   { label: "No Listings",             bg: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400", intent: "Info" },
  suspended:               { label: "Shop Suspended",          bg: "bg-rose-100 text-rose-700", dot: "bg-rose-600", intent: "Critical" },
};

export function StatusPill({ status }: { status?: VendorStatus }) {
  if (!status) return null;
  const s = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
