"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { CategoryMetric } from "./types";

type CategoryBreakdownProps = {
  data: CategoryMetric[];
  insights: string[];
};

export default function CategoryBreakdown({
  data,
  insights,
}: CategoryBreakdownProps) {
  const [metric, setMetric] = useState<"revenue" | "bookings">("revenue");
  const maxVal = Math.max(...data.map((d) => Math.max(d.you, d.marketAvg)));

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Category Performance
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            You vs market by category
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["revenue", "bookings"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                metric === m
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Custom horizontal bar rows */}
      <div className="space-y-5">
        {data.map((cat) => {
          const youPct = maxVal > 0 ? (cat.you / maxVal) * 100 : 0;
          const mktPct = maxVal > 0 ? (cat.marketAvg / maxVal) * 100 : 0;
          const diffPct =
            cat.marketAvg > 0
              ? Math.round(((cat.you - cat.marketAvg) / cat.marketAvg) * 100)
              : 0;
          const above = diffPct >= 0;

          return (
            <div key={cat.category}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {cat.category}
                  </span>
                  <span
                    className={clsx(
                      "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      above
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-600"
                    )}
                  >
                    {cat.trendDirection === "up" ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : cat.trendDirection === "down" ? (
                      <TrendingDown className="h-2.5 w-2.5" />
                    ) : (
                      <Minus className="h-2.5 w-2.5" />
                    )}
                    {cat.trend}
                  </span>
                </div>
                <span
                  className={clsx(
                    "text-xs font-bold",
                    above ? "text-green-600" : "text-red-600"
                  )}
                >
                  {above ? "+" : ""}
                  {diffPct}% vs market
                </span>
              </div>

              {/* Your bar */}
              <div className="mb-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-[10px] font-medium text-gray-400">
                    You
                  </span>
                  <div className="relative flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-[#7B61FF] to-[#A78BFA]"
                      style={{ width: `${youPct}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">
                      {cat.you}
                    </span>
                  </div>
                </div>
              </div>

              {/* Market bar */}
              <div>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-[10px] font-medium text-gray-400">
                    Avg
                  </span>
                  <div className="relative flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-gray-200"
                      style={{ width: `${mktPct}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                      {cat.marketAvg}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mt-6 rounded-xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
              Insights
            </span>
          </div>
          <div className="space-y-1.5">
            {insights.map((insight, i) => (
              <p key={i} className="text-xs leading-relaxed text-gray-600">
                {insight}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
