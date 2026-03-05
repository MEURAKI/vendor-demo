"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import clsx from "clsx";
import type { TrafficPoint, AnalyticsDateRange } from "./types";

type TrafficChartProps = {
  data: TrafficPoint[];
};

const RANGES: { key: AnalyticsDateRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12m", label: "12 months" },
];

export default function TrafficChart({ data }: TrafficChartProps) {
  const [range, setRange] = useState<AnalyticsDateRange>("30d");

  const filtered = useMemo(() => {
    const now = new Date();
    const days =
      range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter((d) => new Date(d.date) >= cutoff);
  }, [data, range]);

  const summary = useMemo(() => {
    const yourTotal = filtered.reduce((s, d) => s + d.yourViews, 0);
    const marketTotal = filtered.reduce((s, d) => s + d.marketAvgViews, 0);
    const diff =
      marketTotal > 0
        ? Math.round(((yourTotal - marketTotal) / marketTotal) * 100)
        : 0;
    return { yourTotal, marketTotal, diff };
  }, [filtered]);

  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Traffic & Engagement
          </h2>
          <div className="mt-1 flex gap-4 text-sm text-gray-500">
            <span>
              Your Total:{" "}
              <span className="font-semibold text-gray-900">
                {summary.yourTotal.toLocaleString()}
              </span>
            </span>
            <span>
              Market Avg:{" "}
              <span className="font-semibold text-gray-900">
                {summary.marketTotal.toLocaleString()}
              </span>
            </span>
            <span>
              Difference:{" "}
              <span
                className={clsx(
                  "font-semibold",
                  summary.diff >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {summary.diff >= 0 ? "+" : ""}
                {summary.diff}%
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range === r.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={filtered}
          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="yourGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#7B61FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f3f4f6"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => {
              try {
                return format(parseISO(v), "MMM d");
              } catch {
                return v;
              }
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 13,
            }}
            labelFormatter={(label: string) => {
              try {
                return format(parseISO(label), "MMM d, yyyy");
              } catch {
                return label;
              }
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="plainline"
            formatter={(value: string) => (
              <span className="text-xs text-gray-500">{value}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="marketAvgViews"
            name="Market Average"
            stroke="#d1d5db"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="yourViews"
            name="Your Views"
            stroke="#7B61FF"
            strokeWidth={2}
            fill="url(#yourGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
