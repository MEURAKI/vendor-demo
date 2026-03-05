"use client";

import { useState } from "react";
import { Lock, Lightbulb } from "lucide-react";
import clsx from "clsx";
import type { PerformanceRow } from "./types";

type PerformanceTableProps = {
  topProducts: PerformanceRow[];
  topServices: PerformanceRow[];
  insight?: string;
};

export default function PerformanceTable({
  topProducts,
  topServices,
  insight,
}: PerformanceTableProps) {
  const [tab, setTab] = useState<"products" | "services">("products");
  const rows = tab === "products" ? topProducts : topServices;

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Which Offerings Generate Interest
      </h2>
      <p className="mb-4 text-xs text-gray-400">
        Top performing listings by volume
      </p>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["products", "services"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-gray-400">
          Start selling to see your top performers
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-2.5 text-left font-semibold">#</th>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {tab === "products" ? "Orders" : "Bookings"}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="flex items-center justify-end gap-1 text-gray-300">
                    Views <Lock className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="flex items-center justify-end gap-1 text-gray-300">
                    Conv. <Lock className="h-3 w-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {row.count}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    ${(row.revenue / 100).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">--</td>
                  <td className="px-4 py-2.5 text-right text-gray-300">--</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Insight callout */}
      {insight && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">{insight}</p>
        </div>
      )}
    </div>
  );
}
