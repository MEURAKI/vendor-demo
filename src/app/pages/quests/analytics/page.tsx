// app/pages/quests/analytics/page.tsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  BarChart3,
  TrendingUp,
  Users,
  MousePointer,
  ShoppingCart,
  Download,
  ChevronDown,
  Eye,
  Brain,
  Heart,
  Target,
  CalendarCheck,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";
import { useVendorProfile } from "../../../../context/VendorShellContext";

/* ================================================================ */
/* Mock Data                                                        */
/* ================================================================ */

const STATS = [
  { label: "Total Completions", value: "892", change: "+12%", up: true, icon: Users },
  { label: "This Week", value: "67", change: "+8%", up: true, icon: TrendingUp },
  { label: "Recommendations Shown", value: "412", change: "+23%", up: true, icon: Eye },
  { label: "Product Clicks", value: "89", change: "+15%", up: true, icon: MousePointer },
  { label: "Click-Through Rate", value: "21.6%", change: "+2.1%", up: true, icon: BarChart3 },
  { label: "Bookings from Quests", value: "14", change: "-3", up: false, icon: ShoppingCart },
];

const QUEST_BREAKDOWN = [
  {
    id: "q1", title: "Anxiety Pre-Screen", type: "Assessment", status: "Active",
    completions: 234, avgScore: 14.2,
    distribution: { Low: 35, Moderate: 45, High: 20 },
    productClicks: 47, conversions: 14,
  },
  {
    id: "q2", title: "Post-Session Feedback", type: "Feedback", status: "Active",
    completions: 89, avgScore: null,
    distribution: {},
    productClicks: 12, conversions: 3,
  },
];

const PLATFORM_PERFORMANCE = [
  {
    quest: "Stress Deep Dive",
    links: [
      { range: "Moderate", product: "Calm Mind Session", shown: 156, clicked: 34, booked: 8 },
      { range: "High", product: "Anxiety Package", shown: 89, clicked: 22, booked: 5 },
    ],
  },
  {
    quest: "Burnout Risk Check",
    links: [
      { range: "High Risk", product: "Recovery Package", shown: 45, clicked: 12, booked: 3 },
    ],
  },
];

/* ================================================================ */
/* PAGE                                                             */
/* ================================================================ */

export default function QuestAnalyticsPage() {
  const { loading: shellLoading } = useVendorProfile();
  const [period, setPeriod] = useState("30d");

  if (shellLoading) return <div className="flex h-full w-full items-center justify-center">
    <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
  </div>;

  const totalRevenue = PLATFORM_PERFORMANCE.reduce((sum, pq) => sum + pq.links.reduce((s, l) => s + l.booked * 85, 0), 0);

  return (
    <>
      {/* Hero */}
      <div className="shrink-0 relative z-30 overflow-visible bg-gradient-to-br from-[#7B61FF]/20 via-[#C084FC]/15 to-white px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#1B1529] tracking-tight">Quest Analytics</h1>
            <p className="text-xs text-gray-400 mt-0.5">Track completions, product clicks, and booking conversions</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 outline-none">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <button className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-3 sm:px-4 lg:px-6 py-4 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATS.map((s) => {
            const I = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <I className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[10px] font-medium text-gray-400">{s.label}</span>
                </div>
                <p className="text-lg font-bold text-[#1B1529]">{s.value}</p>
                <span className={clsx("inline-flex items-center gap-0.5 text-[10px] font-semibold", s.up ? "text-emerald-600" : "text-red-500")}>
                  {s.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {s.change}
                </span>
              </div>
            );
          })}
        </div>

        {/* Per-Quest breakdown */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Per-Quest Breakdown</h2>
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F6F5FF] text-[11px] font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Quest</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-right">Completions</th>
                  <th className="px-3 py-3 text-right">Avg Score</th>
                  <th className="px-3 py-3 text-left">Score Distribution</th>
                  <th className="px-3 py-3 text-right">Product Clicks</th>
                  <th className="px-3 py-3 text-right">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {QUEST_BREAKDOWN.map((q, idx) => (
                  <tr key={q.id} className={clsx("border-t border-gray-100", idx % 2 === 1 && "bg-[#FBFBFE]")}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900">{q.title}</p>
                      <p className="text-[10px] text-gray-400">{q.type}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">{q.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{q.completions}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{q.avgScore?.toFixed(1) || "—"}</td>
                    <td className="px-3 py-3">
                      {Object.keys(q.distribution).length > 0 ? (
                        <div className="flex items-center gap-1">
                          {Object.entries(q.distribution).map(([label, pct]) => (
                            <div key={label} className="flex items-center gap-0.5">
                              <div className="h-2 rounded-full bg-purple-200" style={{ width: `${pct * 0.6}px` }} />
                              <span className="text-[9px] text-gray-400">{label} {pct}%</span>
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-[10px] text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{q.productClicks}</td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-600">{q.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform Quest Performance */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Your Products in Platform Quests</h2>
          <div className="space-y-3">
            {PLATFORM_PERFORMANCE.map((pq) => (
              <div key={pq.quest} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-bold text-gray-900 mb-3">{pq.quest}</p>
                <div className="space-y-2">
                  {pq.links.map((link, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4 text-violet-400" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">{link.range}: {link.product}</p>
                          <p className="text-[10px] text-gray-400">
                            Shown: {link.shown} · Clicked: {link.clicked} · Booked: {link.booked}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-600">{((link.clicked / link.shown) * 100).toFixed(1)}%</p>
                        <p className="text-[9px] text-gray-400">CTR</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 px-5 py-4">
            <p className="text-sm font-bold text-emerald-800">Total quest-driven revenue: <span className="text-lg">${totalRevenue.toLocaleString()}</span></p>
            <p className="text-xs text-emerald-600 mt-0.5">From {PLATFORM_PERFORMANCE.reduce((s, p) => s + p.links.reduce((ss, l) => ss + l.booked, 0), 0)} bookings across all quests</p>
          </div>
        </div>
      </div>
    </>
  );
}
