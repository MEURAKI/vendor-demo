"use client";

import { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  CalendarCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import clsx from "clsx";
import type { WellnessDimension, VendorComparisonItem } from "./types";

type VendorInsightsProps = {
  wellnessDimensions: WellnessDimension[];
  strongest: { dimension: string; count: number };
  vendorComparison: VendorComparisonItem[];
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Products: Package,
  Sessions: CalendarCheck,
  Experiences: Sparkles,
};

export default function VendorInsights({
  wellnessDimensions,
  strongest,
  vendorComparison,
}: VendorInsightsProps) {
  const [period, setPeriod] = useState<"month" | "quarter">("month");

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">
            Wellness Dimensions
          </h2>
          <HelpCircle className="h-4 w-4 text-gray-300" />
        </div>
        <button
          onClick={() => setPeriod(period === "month" ? "quarter" : "month")}
          className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
        >
          vs Last Month
        </button>
      </div>
      <p className="mb-5 text-xs text-gray-400">
        Where your offerings perform across wellness categories
      </p>

      {/* Legend + Radar chart */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-purple-600" />
          <span className="text-[10px] text-gray-500">This month</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border-b border-dashed border-gray-300" />
          <span className="text-[10px] text-gray-500">Last month</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Radar Chart */}
        <div className="flex-1 -ml-2">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={wellnessDimensions} outerRadius="75%">
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Radar
                name="Last month"
                dataKey="previous"
                stroke="#d1d5db"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="transparent"
              />
              <Radar
                name="This month"
                dataKey="current"
                stroke="#7B61FF"
                strokeWidth={2}
                fill="#7B61FF"
                fillOpacity={0.1}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* STRONGEST callout */}
        <div className="shrink-0 w-36 rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Strongest
          </p>
          <p className="text-sm font-bold text-gray-900">
            {strongest.dimension}
          </p>
          <p className="text-lg font-extrabold text-purple-600">
            {strongest.count}
          </p>
          <p className="text-[10px] text-gray-400">activities</p>
        </div>
      </div>

      {/* Vendor comparison section */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-purple-500" />
          <p className="text-sm font-semibold text-gray-900">
            Your Performance vs Market
          </p>
        </div>
        <div className="space-y-3">
          {vendorComparison.map((item) => {
            const Icon = CATEGORY_ICONS[item.category] ?? Package;
            const pct =
              item.marketAvg > 0
                ? Math.round(
                    ((item.you - item.marketAvg) / item.marketAvg) * 100
                  )
                : 0;
            const above = pct >= 0;

            return (
              <div
                key={item.category}
                className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-50">
                  <Icon className="h-4 w-4 text-purple-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {item.category}
                    </p>
                    <span className="text-xs font-medium text-gray-400">
                      #{item.rank} of {item.totalVendors}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="relative flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                        style={{
                          width: `${Math.min(
                            (item.you / Math.max(item.you, item.marketAvg * 1.5)) * 100,
                            100
                          )}%`,
                        }}
                      />
                      {/* Market avg marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                        style={{
                          left: `${Math.min(
                            (item.marketAvg / Math.max(item.you, item.marketAvg * 1.5)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.trendDirection === "up" ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : item.trendDirection === "down" ? (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      ) : (
                        <Minus className="h-3 w-3 text-gray-400" />
                      )}
                      <span
                        className={clsx("text-[11px] font-semibold", {
                          "text-green-600": above,
                          "text-red-600": !above,
                        })}
                      >
                        {above ? "+" : ""}
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                    <span>
                      You: <span className="font-semibold text-gray-600">{item.you}</span>
                    </span>
                    <span>
                      Avg: <span className="font-semibold text-gray-600">{item.marketAvg}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
