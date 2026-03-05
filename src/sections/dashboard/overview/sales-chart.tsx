"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import clsx from "clsx";
import type { RevenueTrendPoint, DateRangeKey } from "./types";

type SalesChartProps = {
  data: RevenueTrendPoint[];
};

export default function SalesChart({ data }: SalesChartProps) {
  const [range, setRange] = useState<DateRangeKey>("30d");

  const filteredData = useMemo(() => {
    const now = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    return data.filter((d) => new Date(d.date) >= cutoff);
  }, [data, range]);

  const totals = useMemo(() => {
    const totalRevenue = filteredData.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = filteredData.reduce((s, d) => s + d.orders, 0);
    const avg = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalRevenue, totalOrders, avg };
  }, [filteredData]);

  const ranges: { key: DateRangeKey; label: string }[] = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
  ];

  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Revenue Trend
          </h2>
          <div className="mt-1 flex gap-4 text-sm text-gray-500">
            <span>
              Total:{" "}
              <span className="font-semibold text-gray-900">
                ${totals.totalRevenue.toLocaleString()}
              </span>
            </span>
            <span>
              Orders:{" "}
              <span className="font-semibold text-gray-900">
                {totals.totalOrders}
              </span>
            </span>
            <span>
              Avg:{" "}
              <span className="font-semibold text-gray-900">
                ${totals.avg.toFixed(0)}
              </span>
            </span>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {ranges.map((r) => (
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
      {filteredData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">
          Not enough data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={filteredData}
            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3} />
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
                try { return format(parseISO(v), "MMM d"); } catch { return v; }
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontSize: 13,
              }}
              labelFormatter={(label: string) => {
                try { return format(parseISO(label), "MMM d, yyyy"); } catch { return label; }
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#7B61FF"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
