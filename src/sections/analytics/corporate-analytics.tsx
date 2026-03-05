"use client";

import {
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  DollarSign,
  Briefcase,
} from "lucide-react";
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
import type {
  CorporateKPI,
  PartnerPerformance,
  CorporateTrendPoint,
} from "./types";

type CorporateAnalyticsProps = {
  kpis: CorporateKPI[];
  partners: PartnerPerformance[];
  trends: CorporateTrendPoint[];
  programBreakdown: { label: string; percentage: number; color: string }[];
};

const KPI_ICONS: Record<string, React.ElementType> = {
  Briefcase,
  DollarSign,
  Star,
};

export default function CorporateAnalytics({
  kpis,
  partners,
  trends,
  programBreakdown,
}: CorporateAnalyticsProps) {
  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100">
          <Building2 className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Corporate Wellness Analytics
          </h2>
          <p className="text-xs text-gray-400">
            Program performance and partner insights
          </p>
        </div>
      </div>

      {/* KPI cards + Program breakdown */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        {kpis.map((kpi) => {
          const Icon = KPI_ICONS[kpi.icon] ?? Briefcase;
          return (
            <div
              key={kpi.label}
              className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50">
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {kpi.label}
                </p>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">
                {kpi.value}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{kpi.subtitle}</p>
            </div>
          );
        })}

        {/* Program types mini donut */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Program Types
          </p>
          <div className="space-y-2">
            {programBreakdown.map((prog) => (
              <div key={prog.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700">{prog.label}</span>
                  <span className="text-xs font-semibold text-gray-900">
                    {prog.percentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full",
                      prog.color
                    )}
                    style={{ width: `${prog.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column: Partner table + Trends chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Partner performance table */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Partner Performance
          </h3>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Partner</th>
                  <th className="px-4 py-2.5 text-left">Program</th>
                  <th className="px-4 py-2.5 text-right">Bookings</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                  <th className="px-4 py-2.5 text-center">Trend</th>
                  <th className="px-4 py-2.5 text-center">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {partners.map((p) => (
                  <tr
                    key={p.name}
                    className="transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{p.program}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {p.bookings}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {p.revenue}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.trendDirection === "up" ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : p.trendDirection === "down" ? (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <Minus className="h-3 w-3 text-gray-400" />
                        )}
                        <span
                          className={clsx("text-[11px] font-semibold", {
                            "text-green-600": p.trendDirection === "up",
                            "text-red-600": p.trendDirection === "down",
                            "text-gray-400": p.trendDirection === "flat",
                          })}
                        >
                          {p.trend}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-[11px] font-medium text-gray-700">
                          {p.satisfaction.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Corporate revenue trends chart */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Revenue by Partner
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={trends}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="corpGrad1"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7B61FF" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="corpGrad2"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="corpGrad3"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
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
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                labelFormatter={(label: string) => {
                  try {
                    return format(parseISO(label), "MMM d, yyyy");
                  } catch {
                    return label;
                  }
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name,
                ]}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: string) => (
                  <span className="text-xs text-gray-500">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="TechCorp"
                name="TechCorp"
                stroke="#7B61FF"
                strokeWidth={2}
                fill="url(#corpGrad1)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="FinanceInc"
                name="Finance Inc"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#corpGrad2)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="StartupLabs"
                name="Startup Labs"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#corpGrad3)"
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
