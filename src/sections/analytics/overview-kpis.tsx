"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import type { AnalyticsKPI } from "./types";

type OverviewKPIsProps = {
  kpis: AnalyticsKPI[];
};

export default function OverviewKPIs({ kpis }: OverviewKPIsProps) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {kpi.label}
          </p>

          <p className="mt-2 text-2xl font-extrabold text-gray-900 tracking-tight">
            {kpi.value}
          </p>

          {/* Trend + vs market */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1">
              {kpi.trendDirection === "up" ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : kpi.trendDirection === "down" ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : (
                <Minus className="h-3 w-3 text-gray-400" />
              )}
              <span
                className={clsx("text-xs font-semibold", {
                  "text-green-600": kpi.trendDirection === "up",
                  "text-red-600": kpi.trendDirection === "down",
                  "text-gray-400": kpi.trendDirection === "flat",
                })}
              >
                {kpi.trend}
              </span>
            </div>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                kpi.vsMarketPositive
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              )}
            >
              {kpi.vsMarket}
            </span>
          </div>

          {/* Sparkline */}
          <div className="mt-3 h-[40px]">
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={kpi.sparkline}>
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#7B61FF"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#d1d5db"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
