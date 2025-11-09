import type { VendorStatus } from "../../../../lib/vendorStatus";

const COLORS: Record<VendorStatus,string> = {
  incomplete_registration: "bg-red-50 text-red-700 ring-red-200",
  under_review:           "bg-amber-50 text-amber-700 ring-amber-200",
  agreement_pending:      "bg-purple-50 text-purple-700 ring-purple-200",
  active:                 "bg-green-50 text-green-700 ring-green-200",
  inactive:               "bg-gray-50 text-gray-600 ring-gray-200",
  draft:                  "bg-gray-50 text-gray-600 ring-gray-200",
  suspended:              "bg-red-50 text-red-700 ring-red-200",
};

export default function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${COLORS[status]}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-current opacity-70" />
      {status.replace(/_/g, " ")}
    </span>
  );
}
