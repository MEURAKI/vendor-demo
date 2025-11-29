"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Search } from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";

import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

/* ---------- Types ---------- */

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

// extend to include "delivery"
type OrderStatus =
  | "pending"
  | "processing"
  | "delivery"
  | "completed"
  | "cancelled"
  | "refunded";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  itemsCount: number;
};

/* ---------- Helpers ---------- */

function formatMoneyFromCents(cents: number) {
  const value = (cents ?? 0) / 100;
  return `SGD ${value.toFixed(2)}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString();
}

/* ---------- Page ---------- */

export default function DeliveryOrdersPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // default to delivery-only, but allow switching
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">(
    "delivery"
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const pageOptions = [15, 25, 50]; // kept for consistency if you want to make it dynamic later

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);

        // Load profile
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id,email,status,onboarding_completed,full_name")
            .eq("id", auth.user.id)
            .maybeSingle();

          if (isMounted && prof) {
            setProfile(prof as Profile);
          }
        }

        // Load delivery orders
        await loadOrders(isMounted);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadOrders(isStillMounted: boolean) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Adjust this backend endpoint to match your API
      // Here we assume it filters by `status=delivery`
      const res = await fetch("/api/vendor/orders?status=delivery", {
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch delivery orders");
      }

      const data = await res.json();

      const mapped: OrderRow[] = (data.orders ?? data ?? []).map(
        (o: any): OrderRow => ({
          id: String(o.id),
          orderNumber: o.order_number ?? o.orderNo ?? `ORD-${o.id}`,
          customerName:
            (o.customer_name ?? `${o.customer_first_name ?? ""} ${o.customer_last_name ?? ""}`.trim()) ||
            "Guest",
          status: (o.status ?? "delivery") as OrderStatus,
          totalCents: o.total_cents ?? o.totalCents ?? 0,
          createdAt: o.created_at ?? o.createdAt ?? "",
          itemsCount: o.items_count ?? o.itemsCount ?? 0,
        })
      );

      if (isStillMounted) {
        setOrders(mapped);
      }
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sidebar config
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

  /* ---------- Filters & pagination ---------- */

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      o.orderNumber.toLowerCase().includes(term) ||
      o.customerName.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === "all" ? true : o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const currentRows = filteredOrders.slice(startIndex, startIndex + pageSize);
  const fromItem = filteredOrders.length === 0 ? 0 : startIndex + 1;
  const toItem = startIndex + currentRows.length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                Delivery Orders
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {orders.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as OrderStatus | "all")
                }
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm"
              >
                <option value="delivery">Delivery only</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
                <option value="all">All statuses</option>
              </select>

              {/* Search box */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearch(searchInput);
                      setCurrentPage(1);
                    }
                  }}
                  placeholder="Search by order # or customer…"
                  className="
                    w-72
                    rounded-full
                    bg-white
                    pl-11
                    pr-4
                    py-2
                    text-xs
                    text-gray-700
                    shadow-sm
                    border border-gray-200
                    placeholder:text-gray-400
                    focus:border-[#7C3AED]
                    focus:ring-2 
                    focus:ring-[#E9D8FD] 
                    focus:outline-none
                    transition-all
                  "
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearch(searchInput);
                  setCurrentPage(1);
                }}
                className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white"
              >
                Search
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-left">Order #</th>
                    <th className="px-3 py-3 text-left">Customer</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-right">Items</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-left">Created</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                        <ClipLoader
                          size={40}
                          color="#6B46C1"
                          cssOverride={{ animationDuration: "3s" }}
                        />
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No delivery orders found.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((o, idx) => (
                      <tr
                        key={o.id}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        <td className="px-3 py-3 font-semibold text-gray-900">
                          {o.orderNumber}
                        </td>

                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          {o.customerName}
                        </td>

                        <td className="px-3 py-3 text-[11px]">
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              o.status === "pending" &&
                                "bg-amber-100 text-amber-800",
                              o.status === "processing" &&
                                "bg-blue-100 text-blue-800",
                              o.status === "delivery" &&
                                "bg-indigo-100 text-indigo-800",
                              o.status === "completed" &&
                                "bg-emerald-100 text-emerald-800",
                              o.status === "cancelled" &&
                                "bg-red-100 text-red-700",
                              o.status === "refunded" &&
                                "bg-purple-100 text-purple-700"
                            )}
                          >
                            {o.status.charAt(0).toUpperCase() +
                              o.status.slice(1)}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right text-[11px] text-gray-700">
                          {o.itemsCount}
                        </td>

                        <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                          {formatMoneyFromCents(o.totalCents)}
                        </td>

                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {formatDate(o.createdAt)}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <button
                            className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                            onClick={() =>
                              router.push(`/pages/vendor/orders/${o.id}`)
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
              <span>
                Showing {fromItem}-{toItem} of {filteredOrders.length} orders
              </span>

              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-40"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  &lt; Back
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={clsx(
                        "min-w-[28px] rounded-md border px-2 py-1",
                        page === safePage
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-white text-gray-700"
                      )}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-40"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safePage === totalPages}
                >
                  Next &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}