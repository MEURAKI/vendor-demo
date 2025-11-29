"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";

/* ---------- Types ---------- */

type OrderStatus = "placed" | "fulfilled" | "shipped" | "delivered" | "cancelled";
type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

type Order = {
  id: string;
  vendor_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_cents: number;
  created_at: string;
  contact_name: string | null;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
};

type TrendPoint = {
  rawDate: string; // YYYY-MM-DD
  date: string; // "Aug 21"
  value: number; // dollars
};

type DateRangeKey = "30d" | "7d" | "90d";

/* ---------- Helpers ---------- */

function formatCurrencyFromCents(cents: number): string {
  return `$ ${(cents / 100).toFixed(2)}`;
}

function buildOrderCode(id: string): string {
  return `#${id.split("-")[0].toUpperCase()}`;
}

function formatDateShort(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
  });
}

function calcFeeCents(totalCents: number): number {
  // Simple example: 3% + $0.50 fee per order
  const percentage = Math.round(totalCents * 0.03);
  const fixed = 50; // 50 cents
  return percentage + fixed;
}

function getRangeStart(range: DateRangeKey): Date {
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "90d") d.setDate(d.getDate() - 90);
  return d;
}

/* ---------- Page ---------- */

export default function VendorFinancePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<DateRangeKey>("30d");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) {
        setError("Failed to load user.");
        setLoading(false);
        return;
      }

      const userId = auth.user.id;

      // Sidebar profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,full_name,status")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // Fetch up to 1 year of orders – we’ll filter by range in-memory
      const since = new Date();
      since.setFullYear(since.getFullYear() - 1);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id,vendor_id,status,payment_status,total_cents,created_at,contact_name")
        .eq("vendor_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      if (ordersError) {
        console.error(ordersError);
        setError("Failed to load earnings data.");
        setLoading(false);
        return;
      }

      setOrders((ordersData || []) as Order[]);
      setLoading(false);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? profile?.email ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: profile?.status ?? "Active",
      }),
    [profile]
  );

  /* ---------- Derived metrics ---------- */

  const {
    filteredOrders,
    pendingPayoutCents,
    lifetimePaidCents,
    thisMonthCents,
    trendData,
    sourceMetrics,
  } = useMemo(() => {
    const now = new Date();
    const rangeStart = getRangeStart(range);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let pendingPayout = 0;
    let lifetimePaid = 0;
    let thisMonth = 0;

    const byDate: Record<string, number> = {};

    let ordersCount = 0;
    let ordersGross = 0;
    let ordersNet = 0;

    let refundsCount = 0;
    let refundsGross = 0;
    let refundsNet = 0;

    const filtered: Order[] = [];

    for (const o of orders) {
      const created = new Date(o.created_at);

      // filter by range (for table & chart)
      if (created >= rangeStart) {
        filtered.push(o);
      }

      // lifetime + month metrics
      const sign = o.payment_status === "refunded" ? -1 : 1;
      const amount = sign * o.total_cents;

      lifetimePaid += amount;

      if (created >= startOfMonth && o.payment_status === "paid") {
        thisMonth += amount;
      }

      // pending payout = paid but not yet delivered/cancelled
      if (
        o.payment_status === "paid" &&
        o.status !== "delivered" &&
        o.status !== "cancelled"
      ) {
        pendingPayout += o.total_cents;
      }

      // trend: last 30d only (independent of top filter)
      const thirtyDaysAgo = getRangeStart("30d");
      if (created >= thirtyDaysAgo) {
        const key = o.created_at.slice(0, 10); // YYYY-MM-DD
        byDate[key] = (byDate[key] || 0) + amount;
      }

      // source metrics (orders + refunds – bookings would come from another table)
      const fee = calcFeeCents(o.total_cents);
      const net = o.total_cents - fee;

      if (o.payment_status === "refunded") {
        refundsCount += 1;
        refundsGross -= o.total_cents;
        refundsNet -= net;
      } else {
        ordersCount += 1;
        ordersGross += o.total_cents;
        ordersNet += net;
      }
    }

    const trend: TrendPoint[] = Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([raw, cents]) => {
        const d = new Date(raw);
        const label = d.toLocaleDateString("en-SG", {
          day: "2-digit",
          month: "short",
        });
        return {
          rawDate: raw,
          date: label,
          value: cents / 100,
        };
      });

    return {
      filteredOrders: filtered,
      pendingPayoutCents: pendingPayout,
      lifetimePaidCents: lifetimePaid,
      thisMonthCents: thisMonth,
      trendData: trend,
      sourceMetrics: {
        ordersCount,
        ordersGross,
        ordersNet,
        bookingsCount: 0,
        bookingsGross: 0,
        bookingsNet: 0,
        refundsCount,
        refundsGross,
        refundsNet,
      },
    };
  }, [orders, range]);

  /* ---------- Download CSV ---------- */

  function handleDownloadReport() {
    if (filteredOrders.length === 0) return;

    const header = [
      "Order ID",
      "Date",
      "Customer",
      "Status",
      "Payment Status",
      "Gross",
      "Fees",
      "Net",
    ];

    const rows = filteredOrders.map((o) => {
      const fee = calcFeeCents(o.total_cents);
      const net = o.total_cents - fee;
      const date = new Date(o.created_at).toISOString();
      return [
        buildOrderCode(o.id),
        date,
        o.contact_name || "",
        o.status,
        o.payment_status,
        (o.total_cents / 100).toFixed(2),
        (fee / 100).toFixed(2),
        (net / 100).toFixed(2),
      ];
    });

    const csv =
      [header, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "earnings-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        Loading finance…
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Main shell */}
      <div className="flex flex-1 items-stretch justify-center px-3 py-3 md:px-6 md:py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)] md:rounded-[32px]">
          <div className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6">
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
                    Earnings overview
                  </h1>
                  <p className="text-xs text-slate-500 md:text-sm">
                    Understand your payouts across orders and bookings.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as DateRangeKey)}
                    className="h-9 rounded-full bg-white px-3 text-xs text-slate-700 shadow-sm outline-none ring-0"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>

                  <button
                    onClick={handleDownloadReport}
                    className="h-9 rounded-full bg-black px-4 text-xs font-medium text-white shadow-sm hover:bg-slate-900"
                  >
                    Download report
                  </button>
                </div>
              </div>

              {/* Top summary cards */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Pending payout */}
                <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs text-slate-500">Pending payout</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCurrencyFromCents(pendingPayoutCents)}
                  </p>
                  <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                    Releases as orders are delivered
                  </p>
                </div>

                {/* Lifetime paid */}
                <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs text-slate-500">Paid out (lifetime)</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCurrencyFromCents(lifetimePaidCents)}
                  </p>
                  {/* You can add % vs last month here if you want */}
                </div>

                {/* This month */}
                <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs text-slate-500">This month</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCurrencyFromCents(thisMonthCents)}
                  </p>
                  <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                    From {sourceMetrics.ordersCount} orders &amp; 0 bookings
                  </p>
                </div>
              </div>

              {/* Middle grid: trend + earnings by source */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Earnings trend */}
                <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-600">
                      Earnings trend
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Orders + bookings (last 30 days)
                    </p>
                  </div>
                  <div className="h-40 rounded-xl bg-slate-50 px-2 py-2">
                    {trendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-[11px] text-slate-400">
                        Not enough data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trendData}
                          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="earningsArea"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#7B61FF"
                                stopOpacity={0.9}
                              />
                              <stop
                                offset="95%"
                                stopColor="#7B61FF"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E2E8F0"
                          />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: "#64748B" }}
                            padding={{ left: 4, right: 4 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: "#64748B" }}
                            tickFormatter={(v) => `$${v}`}
                            width={48}
                          />
                          <Tooltip
                            formatter={(value: any) => [
                              `$${Number(value).toFixed(2)}`,
                              "Earnings",
                            ]}
                            labelFormatter={(label) => `Date: ${label}`}
                            contentStyle={{
                              fontSize: 11,
                              borderRadius: 8,
                              borderColor: "#E2E8F0",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#7B61FF"
                            strokeWidth={2}
                            fill="url(#earningsArea)"
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Earnings by source */}
                <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-600">
                      Earnings by source
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#EFE6FF] text-[11px] uppercase tracking-wide text-slate-600">
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Count</th>
                          <th className="px-4 py-2">Gross</th>
                          <th className="px-4 py-2">Net to you</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-700">Orders</td>
                          <td className="px-4 py-2 text-slate-700">
                            {sourceMetrics.ordersCount}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {formatCurrencyFromCents(
                              sourceMetrics.ordersGross
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {formatCurrencyFromCents(sourceMetrics.ordersNet)}
                          </td>
                        </tr>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-700">Bookings</td>
                          <td className="px-4 py-2 text-slate-700">0</td>
                          <td className="px-4 py-2 text-slate-700">
                            $ 0.00
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            $ 0.00
                          </td>
                        </tr>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-700">Refunds</td>
                          <td className="px-4 py-2 text-slate-700">
                            {sourceMetrics.refundsCount}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            -{formatCurrencyFromCents(
                              sourceMetrics.refundsGross
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            -{formatCurrencyFromCents(
                              sourceMetrics.refundsNet
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Earnings by order / booking table */}
              <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <div className="mb-2">
                  <p className="text-sm font-medium text-slate-800">
                    Earnings by order / booking
                  </p>
                  <p className="text-xs text-slate-500">
                    Payout-ready and historical earnings.
                  </p>
                </div>

                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#EFE6FF] text-[11px] uppercase tracking-wide text-slate-600">
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Customer</th>
                        <th className="px-4 py-2">Gross</th>
                        <th className="px-4 py-2">Fees</th>
                        <th className="px-4 py-2">Net</th>
                        <th className="px-4 py-2">Payout status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => {
                        const fee = calcFeeCents(o.total_cents);
                        const net = o.total_cents - fee;
                        const payoutStatus =
                          o.payment_status === "paid" &&
                          o.status === "delivered"
                            ? "Batch paid"
                            : "Pending";

                        return (
                          <tr
                            key={o.id}
                            className="border-t border-slate-100 last:border-b-0"
                          >
                            <td className="px-4 py-2 text-slate-800">
                              {buildOrderCode(o.id)}
                            </td>
                            <td className="px-4 py-2 text-slate-700">Order</td>
                            <td className="px-4 py-2 text-slate-700">
                              {formatDateShort(o.created_at)}
                            </td>
                            <td className="px-4 py-2 text-slate-700">
                              {o.contact_name || "Unknown"}
                            </td>
                            <td className="px-4 py-2 text-slate-800">
                              {formatCurrencyFromCents(o.total_cents)}
                            </td>
                            <td className="px-4 py-2 text-slate-700">
                              {formatCurrencyFromCents(fee)}
                            </td>
                            <td className="px-4 py-2 text-slate-800">
                              {formatCurrencyFromCents(net)}
                            </td>
                            <td className="px-4 py-2 text-slate-700">
                              {payoutStatus}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredOrders.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-6 text-center text-xs text-slate-500"
                          >
                            No earnings in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
}
