"use client";

import { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  BarChart3,
  Activity,
} from "lucide-react";
import clsx from "clsx";
import type { MarketCompRow } from "./types";

type MarketComparisonProps = {
  rows: MarketCompRow[];
};

type TabKey = "overview" | "details" | "trends";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Target },
  { key: "details", label: "Details", icon: BarChart3 },
  { key: "trends", label: "Trends", icon: Activity },
];

export default function MarketComparison({ rows }: MarketComparisonProps) {
  const [tab, setTab] = useState<TabKey>("overview");

  const aboveCount = rows.filter((r) => r.youPct > r.marketAvgPct).length;

  /* Radar data — include raw values for tooltip */
  const radarData = rows.map((r) => ({
    metric: r.metric,
    you: r.youPct,
    market: r.marketAvgPct,
    top10: r.top10Pct,
    youRaw: r.you,
    marketRaw: r.marketAvg,
    top10Raw: r.top10,
    rank: r.rank,
    totalVendors: r.totalVendors,
  }));

  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50">
            <Trophy className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Market Comparison
            </h2>
            <p className="text-xs text-gray-400">
              Your position among {rows[0]?.totalVendors ?? 0} subscribers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5">
          <span className="text-xs font-bold text-green-700">
            {aboveCount}/{rows.length}
          </span>
          <span className="text-[10px] text-green-600">above market</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ====== OVERVIEW TAB: 2-column layout ====== */}
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* LEFT: Radar chart */}
          <div>
            <ResponsiveContainer width="100%" height={420}>
              <RadarChart data={radarData} outerRadius="78%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    const aboveMarket = d.you > d.market;
                    return (
                      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg text-xs">
                        <p className="font-bold text-gray-900 mb-2 text-sm">
                          {d.metric}
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-[#7B61FF]" />
                              <span className="text-gray-500">You</span>
                            </span>
                            <span className="font-bold text-gray-900">
                              {d.youRaw}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
                              <span className="text-gray-500">Market Avg</span>
                            </span>
                            <span className="font-medium text-gray-600">
                              {d.marketRaw}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-purple-200" />
                              <span className="text-gray-500">Top 10%</span>
                            </span>
                            <span className="font-medium text-purple-600">
                              {d.top10Raw}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-gray-400">Rank</span>
                          <span className="font-bold text-gray-900">
                            #{d.rank} of {d.totalVendors}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-400">vs Market</span>
                          <span
                            className={clsx(
                              "font-bold",
                              aboveMarket ? "text-green-600" : "text-red-500"
                            )}
                          >
                            {aboveMarket ? "Above" : "Below"}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Radar
                  name="Top 10%"
                  dataKey="top10"
                  stroke="#e9d5ff"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="#f5f3ff"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Market Avg"
                  dataKey="market"
                  stroke="#d1d5db"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
                <Radar
                  name="You"
                  dataKey="you"
                  stroke="#7B61FF"
                  strokeWidth={2.5}
                  fill="#7B61FF"
                  fillOpacity={0.12}
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 -mt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded bg-[#7B61FF]" />
                <span className="text-[11px] text-gray-500">You</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded border-b border-dashed border-gray-400" />
                <span className="text-[11px] text-gray-500">Market Avg</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded border-b border-dashed border-purple-300" />
                <span className="text-[11px] text-gray-500">Top 10%</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Metric cards */}
          <div className="space-y-2.5">
            {rows.map((row) => {
              const aboveMarket = row.youPct > row.marketAvgPct;
              const rankPercentile = row.rank / row.totalVendors;
              const isTop = rankPercentile <= 0.15;

              return (
                <div
                  key={row.metric}
                  className={clsx(
                    "rounded-xl border px-4 py-3.5 transition-colors",
                    isTop
                      ? "border-purple-200 bg-purple-50/40"
                      : "border-gray-100 bg-gray-50/50 hover:bg-white hover:border-purple-100"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">
                        {row.metric}
                      </p>
                      <p className="text-lg font-extrabold text-gray-900">
                        {row.you}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Market avg */}
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase">
                          Market
                        </p>
                        <p className="text-xs font-semibold text-gray-500">
                          {row.marketAvg}
                        </p>
                      </div>

                      {/* Top 10% */}
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase">
                          Top 10%
                        </p>
                        <p className="text-xs font-semibold text-purple-600">
                          {row.top10}
                        </p>
                      </div>

                      {/* Rank + trend */}
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                            aboveMarket ? "text-green-600" : "text-red-500"
                          )}
                        >
                          {aboveMarket ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                          )}
                        </span>
                        <span
                          className={clsx(
                            "text-[10px] font-bold",
                            isTop ? "text-purple-600" : "text-gray-400"
                          )}
                        >
                          {isTop && "★ "}#{row.rank}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== DETAILS TAB ====== */}
      {tab === "details" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const aboveMarket = row.youPct > row.marketAvgPct;
            const rankPercentile = row.rank / row.totalVendors;
            const isTop = rankPercentile <= 0.15;
            const isGood = rankPercentile <= 0.35;

            return (
              <div
                key={row.metric}
                className="rounded-xl border border-gray-100 bg-gray-50/50 px-5 py-4 transition-colors hover:bg-white hover:border-purple-100 hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {row.metric}
                    </span>
                    {row.trendDirection === "up" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    ) : row.trendDirection === "down" ? (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-gray-300" />
                    )}
                  </div>
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold",
                      isTop
                        ? "bg-purple-100 text-purple-700"
                        : isGood
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {isTop && <Trophy className="h-2.5 w-2.5" />}
                    #{row.rank} of {row.totalVendors}
                  </span>
                </div>

                {/* Position bar */}
                <div className="relative mb-3">
                  <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 rounded-r-full bg-purple-50/60"
                      style={{ width: "10%" }}
                    />
                    <div
                      className={clsx(
                        "absolute inset-y-0 left-0 rounded-full transition-all",
                        aboveMarket
                          ? "bg-gradient-to-r from-[#7B61FF] to-[#A78BFA]"
                          : "bg-gradient-to-r from-gray-300 to-gray-400"
                      )}
                      style={{ width: `${row.youPct}%` }}
                    />
                  </div>
                  <div
                    className="absolute top-0 h-3 flex items-center"
                    style={{ left: `${row.marketAvgPct}%` }}
                  >
                    <div className="h-5 w-0.5 -translate-y-1 bg-gray-400 rounded-full" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-[#7B61FF]" />
                    <span className="text-[11px] text-gray-400">You</span>
                    <span className="text-sm font-bold text-gray-900">
                      {row.you}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3.5 w-0.5 rounded-full bg-gray-400" />
                    <span className="text-[11px] text-gray-400">Market</span>
                    <span className="text-xs font-medium text-gray-500">
                      {row.marketAvg}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3 w-3 text-purple-400" />
                    <span className="text-[11px] text-gray-400">Top 10%</span>
                    <span className="text-xs font-medium text-purple-600">
                      {row.top10}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====== TRENDS TAB ====== */}
      {tab === "trends" && (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => {
            if (!row.history) return null;

            return (
              <div
                key={row.metric}
                className="rounded-xl border border-gray-100 bg-gray-50/30 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      {row.metric}
                    </p>
                    <p className="text-lg font-extrabold text-gray-900">
                      {row.you}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                        row.trendDirection === "up"
                          ? "text-green-600"
                          : row.trendDirection === "down"
                          ? "text-red-500"
                          : "text-gray-400"
                      )}
                    >
                      {row.trendDirection === "up" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : row.trendDirection === "down" ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                    </span>
                    <p className="text-[10px] text-gray-400">
                      Mkt: {row.marketAvg}
                    </p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart
                    data={row.history}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`grad-${row.metric.replace(/\s/g, "")}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#7B61FF"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#7B61FF"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f3f4f6"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 9, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        fontSize: 11,
                        padding: "6px 10px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="market"
                      name="Market"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="transparent"
                    />
                    <Area
                      type="monotone"
                      dataKey="you"
                      name="You"
                      stroke="#7B61FF"
                      strokeWidth={2}
                      fill={`url(#grad-${row.metric.replace(/\s/g, "")})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
