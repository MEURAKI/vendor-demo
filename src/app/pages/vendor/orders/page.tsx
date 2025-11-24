// app/vendor/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

type OrderStatus = "placed" | "fulfilled" | "shipped" | "delivered" | "cancelled";

type OrderRow = {
  id: string;
  code: string;
  placedAt: string;
  customerName: string;
  itemsLabel: string;
  deliveryMethod: string;
  status: OrderStatus;
  statusLabel: string;
  total: string;
  lastUpdate: string;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

const MOCK_ORDERS: OrderRow[] = [
  {
    id: "1",
    code: "#M23920",
    placedAt: "Placed 16 May 2025",
    customerName: "Michelle Tan",
    itemsLabel: "3 items (includes bundle)",
    deliveryMethod: "Standard delivery",
    status: "placed",
    statusLabel: "Placed",
    total: "SGD 142.40",
    lastUpdate: "20 May 2025, 10:05",
  },
  {
    id: "2",
    code: "#M23921",
    placedAt: "Placed 15 May 2025",
    customerName: "Jason Lim",
    itemsLabel: "1 bundle · 2 items",
    deliveryMethod: "Express delivery",
    status: "fulfilled",
    statusLabel: "Fulfilled",
    total: "SGD 89.90",
    lastUpdate: "19 May 2025, 14:20",
  },
  // ...add more mock rows
];

const statusColors: Record<OrderStatus, string> = {
  placed: "bg-slate-100 text-slate-700",
  fulfilled: "bg-fuchsia-100 text-fuchsia-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Load profile for sidebar
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (data) setProfile(data as Profile);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: profile?.status ?? "active",
      }),
    [profile]
  );

  const filtered = MOCK_ORDERS.filter((o) => {
    const matchesSearch =
      !search ||
      o.code.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Main shell */}
      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Inner content */}
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
                  <p className="text-sm text-slate-500">
                    Overview of all product and bundle orders for your shop.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      className="w-52 bg-transparent text-sm outline-none placeholder:text-slate-400"
                      placeholder="Search by order no., customer, item…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {/* Date range pill – static for now */}
                  <button className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">
                    1 Jun – 30 Jun
                  </button>

                  {/* Status filter */}
                  <select
                    className="rounded-full bg-white px-4 py-2 text-sm shadow-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <option value="all">Status · All</option>
                    <option value="placed">Placed</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Quick actions – dropdown stub */}
                  <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    Quick Actions ▾
                  </button>
                </div>
              </div>

              {/* Table container */}
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4 text-sm font-medium text-slate-700">
                  All orders
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-6 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </th>
                        <th className="px-6 py-3">Order</th>
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Items</th>
                        <th className="px-6 py-3">Delivery method</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Total</th>
                        <th className="px-6 py-3">Last update</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">
                                {order.code}
                              </span>
                              <span className="text-xs text-slate-500">
                                {order.placedAt}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {order.customerName}
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {order.itemsLabel}
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                              {order.deliveryMethod}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                statusColors[order.status]
                              }`}
                            >
                              {order.statusLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-900">
                            {order.total}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {order.lastUpdate}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/vendor/orders/${order.id}`}
                              className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 text-xs text-slate-500">
                  <span>Showing 1–{filtered.length} of 120 orders</span>
                  <div className="flex items-center gap-2">
                    <button className="rounded-full border border-slate-200 px-3 py-1">
                      ‹
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
                      2
                    </button>
                    <button className="rounded-full border border-slate-200 px-3 py-1">
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
}