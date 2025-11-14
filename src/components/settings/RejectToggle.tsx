import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

// helper (optional): small red pill/button
function RejectToggle({
  hasReason,
  onClick,
  open,
}: { hasReason: boolean; onClick: () => void; open: boolean }) {
  if (!hasReason) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
      title="Show rejection reason"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      Why rejected?
      <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

export default RejectToggle;