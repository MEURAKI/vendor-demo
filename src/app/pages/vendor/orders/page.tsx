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

type OrderFromDB = {
  id: string;
  customer_id: string;
  vendor_id: string;
  status: OrderStatus;
  fulfilment_method: "standard_delivery" | "express_delivery" | "pickup";
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  promo_code: string | null;
  promo_description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
};

const statusColors: Record<OrderStatus, string> = {
  placed: "bg-slate-100 text-slate-700",
  fulfilled: "bg-fuchsia-100 text-fuchsia-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

function formatCurrencyFromCents(cents: number): string {
  return `SGD ${(cents / 100).toFixed(2)}`;
}

function mapFulfilmentMethod(method: OrderFromDB["fulfilment_method"]): string {
  switch (method) {
    case "standard_delivery":
      return "Standard delivery";
    case "express_delivery":
      return "Express delivery";
    case "pickup":
      return "Pickup";
    default:
      return method;
  }
}

function mapDbOrderToRow(o: OrderFromDB): OrderRow {
  const created = new Date(o.created_at);
  const updated = new Date(o.updated_at);

  return {
    id: o.id,
    // Simple human-friendly code derived from UUID
    code: `#${o.id.split("-")[0].toUpperCase()}`,
    placedAt: `Placed ${created.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`,
    customerName: o.contact_name || "Unknown customer",
    // You can replace this with a real item summary if you have an order_items table
    itemsLabel: "Items summary not available",
    deliveryMethod: mapFulfilmentMethod(o.fulfilment_method),
    status: o.status,
    statusLabel: o.status.charAt(0).toUpperCase() + o.status.slice(1),
    total: formatCurrencyFromCents(o.total_cents),
    lastUpdate: updated.toLocaleString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profile + vendor orders
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setError("Failed to load user.");
        setLoading(false);
        return;
      }
      if (!auth.user) {
        setError("No authenticated user.");
        setLoading(false);
        return;
      }

      const userId = auth.user.id;

      // Load profile for sidebar
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Load orders belonging to this vendor
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("vendor_id", userId)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error(ordersError);
        setError("Failed to load orders.");
        setLoading(false);
        return;
      }

      const mapped = (ordersData as OrderFromDB[] | null)?.map(mapDbOrderToRow) ?? [];
      setOrders(mapped);
      setLoading(false);
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

  const filtered = orders.filter((o) => {
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

                {loading ? (
                  <div className="px-6 py-10 text-sm text-slate-500">
                    Loading orders…
                  </div>
                ) : error ? (
                  <div className="px-6 py-10 text-sm text-rose-600">{error}</div>
                ) : filtered.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-slate-500">
                    No orders found for your filters.
                  </div>
                ) : (
                  <>
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
                                  href={`/pages/vendor/orders/${order.id}`}
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
                      <span>Showing 1–{filtered.length} orders</span>
                      <div className="flex items-center gap-2">
                        <button className="rounded-full border border-slate-200 px-3 py-1">
                          ‹
                        </button>
                        <button className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
                          1
                        </button>
                        <button className="rounded-full border border-slate-200 px-3 py-1">
                          ›
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}