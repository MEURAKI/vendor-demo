"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import type { HeroMetric } from "./types";

type StatsOverviewProps = {
  metrics: HeroMetric[];
};

export default function StatsOverview({ metrics }: StatsOverviewProps) {
  return (
    <div className="mb-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
          <div
            key={m.label}
            className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100"
          >
            <div className="p-5 pb-0">
              {/* Header row: label + arrow button */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {m.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.subtitle}</p>
                </div>
                {m.href ? (
                  <Link
                    href={m.href}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-900 text-white">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Big number */}
              <p className="mt-4 text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
                {m.value}
              </p>

              {/* Trend */}
              <div className="mt-2 flex items-center gap-1.5">
                {m.trendDirection === "up" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : m.trendDirection === "down" ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                ) : null}
                <span
                  className={clsx("text-sm font-semibold", {
                    "text-green-600": m.trendDirection === "up",
                    "text-red-600": m.trendDirection === "down",
                    "text-gray-400": m.trendDirection === "flat",
                  })}
                >
                  {m.trend}
                </span>
                <span className="text-xs text-gray-400">{m.trendLabel}</span>
              </div>
            </div>

            {/* Mini chart area */}
            <div className="mt-4 px-2">
              {m.chartType === "line" && m.sparkline && (
                <SparklineChart data={m.sparkline} />
              )}
              {m.chartType === "bar" && m.weeklyBars && (
                <WeeklyBarChart data={m.weeklyBars} />
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

/* ---- Mini sparkline chart with current vs previous ---- */
function SparklineChart({
  data,
}: {
  data: { current: number; previous: number }[];
}) {
  return (
    <div className="h-[80px]">
      {/* Legend */}
      <div className="flex items-center gap-4 px-3 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-purple-600" />
          <span className="text-[10px] text-gray-400">This month</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border-b border-dashed border-gray-300" />
          <span className="text-[10px] text-gray-400">Last month</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={55}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
        >
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#d1d5db"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="#7B61FF"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---- Weekly horizontal bar chart ---- */
function WeeklyBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="px-3 pb-3 space-y-1.5">
      {data.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="w-8 text-[10px] font-medium text-gray-400 shrink-0">
            {bar.label}
          </span>
          <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
              style={{ width: `${(bar.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
