"use client";

import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import type { CorporatePartner } from "./types";

type CorporateSummaryProps = {
  activePartners: number;
  pendingApproval: number;
  topPartners: CorporatePartner[];
};

export default function CorporateSummary({
  activePartners,
  pendingApproval,
  topPartners,
}: CorporateSummaryProps) {
  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100">
          <Building2 className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Corporate Wellness Programs
          </h2>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-5 flex gap-6">
        <div>
          <p className="text-2xl font-extrabold text-gray-900">
            {activePartners}
          </p>
          <p className="text-xs text-gray-500">Active Partners</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-amber-600">
            {pendingApproval}
          </p>
          <p className="text-xs text-gray-500">Pending Approval</p>
        </div>
      </div>

      {/* Top partners table */}
      {topPartners.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-2.5 text-left font-semibold">
                  Partner
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Bookings
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topPartners.map((partner, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {partner.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {partner.bookings}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {partner.revenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="#"
          className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Configure Discounts
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="#"
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View Analytics
        </Link>
        {pendingApproval > 0 && (
          <Link
            href="#"
            className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Pending ({pendingApproval})
          </Link>
        )}
      </div>
    </div>
  );
}
