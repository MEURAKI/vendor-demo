"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Calendar, ChevronDown, Search } from "lucide-react";
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

type OrderStatus =
  | "pending"
  | "placed"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus | string;
  totalCents: number;
  totalCount: number;
  order_items: any[];
  createdAt: string;
  itemsCount: number;
  fulfilmentMethod: string | null;
};

// NEW: tabs type
type FulfilmentTab = "all" | "delivery" | "pickup";

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

function prettyStatusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------- Page ---------- */

export default function DeliveryOrdersPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // NEW: top tab state
  const [fulfilmentTab, setFulfilmentTab] = useState<FulfilmentTab>("all");

  // date filter (yyyy-mm-dd)
  const [dateFrom, setDateFrom] = useState<string | "">("");
  const [dateTo, setDateTo] = useState<string | "">("");

  // bulk selection & quick actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [isPerformingQuickAction, setIsPerformingQuickAction] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);

        // Profile
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

      // Let the API return all vendor orders; we’ll filter by fulfilment in the UI
      const res = await fetch("/api/vendor/orders", {
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }

      const data = await res.json();

      const mapped: OrderRow[] = (data.orders ?? data ?? []).map(
        (o: any): OrderRow => ({
          id: String(o.id),
          orderNumber: o.order_number ?? `ORD-${String(o.id).slice(0, 8)}`,
          customerName: o.contact_name ?? o.customer_name ?? "Guest",
          status: o.status ?? "pending",
          order_items: o.order_items ?? [],
          totalCount:
            o.order_items?.length ?? o.order_items?.length ?? 0,
          totalCents:
            o.total_cents ?? (o.subtotal_cents ?? 0) + (o.shipping_cents ?? 0),
          createdAt: o.created_at ?? o.createdAt ?? "",
          itemsCount: o.items_count ?? o.itemsCount ?? 0,
          fulfilmentMethod: o.fulfilment_method ?? o.fulfilmentMethod ?? null,
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

  const filteredOrders = orders
    // NEW: fulfilment-tab filter
    .filter((o) => {
      if (fulfilmentTab === "delivery") {
        // change "standard_delivery" if your DB uses another string
        return o.fulfilmentMethod === "standard_delivery";
      }
      if (fulfilmentTab === "pickup") {
        // change "pickup" to whatever you use, e.g. "self_pickup"
        return o.fulfilmentMethod === "pickup";
      }
      // "all"
      return true;
    })
    .filter((o) => {
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        o.orderNumber.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term);

      const createdDate = new Date(o.createdAt);
      let matchesDate = true;

      if (!Number.isNaN(createdDate.getTime())) {
        if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          if (createdDate < from) matchesDate = false;
        }
        if (matchesDate && dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (createdDate > to) matchesDate = false;
        }
      }

      return matchesSearch && matchesDate;
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

  const allCurrentPageSelected =
    currentRows.length > 0 &&
    currentRows.every((o) => selectedOrderIds.has(o.id));

  const selectedCount = selectedOrderIds.size;

  /* ---------- Quick actions ---------- */

  async function handleBulkStatusChange(newStatus: OrderStatus) {
    if (selectedOrderIds.size === 0) return;

    try {
      setIsPerformingQuickAction(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch("/api/vendor/orders/bulk-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
        body: JSON.stringify({
          ids: Array.from(selectedOrderIds),
          status: newStatus,
        }),
      });

      // Optimistic local update
      setOrders((prev) =>
        prev.map((o) =>
          selectedOrderIds.has(o.id) ? { ...o, status: newStatus } : o
        )
      );
      setSelectedOrderIds(new Set());
      setQuickActionsOpen(false);
    } catch (err) {
      console.error("Failed to perform quick action", err);
    } finally {
      setIsPerformingQuickAction(false);
    }
  }

  function toggleSelectAllCurrentPage() {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allCurrentPageSelected) {
        currentRows.forEach((o) => next.delete(o.id));
      } else {
        currentRows.forEach((o) => next.add(o.id));
      }
      return next;
    });
  }

  function toggleRowSelected(id: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-3 py-4 md:px-6">
        <div className="flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
          <div className="sticky top-0 z-30 border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-4 py-4 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex flex-col">
                  <h1 className="text-lg font-semibold text-[#1B1529] md:text-xl">
                    Orders
                  </h1>

                  {/* Tabs: All | Delivery | Pickup */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {[
                      { id: "all", label: "All" as const },
                      { id: "delivery", label: "Delivery" as const },
                      { id: "pickup", label: "Pickup" as const },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setFulfilmentTab(tab.id as FulfilmentTab);
                          setCurrentPage(1);
                        }}
                        className={clsx(
                          "rounded-full px-4 py-1.5 text-xs font-semibold transition",
                          fulfilmentTab === tab.id
                            ? "bg-[#7C3AED] text-white shadow-sm"
                            : "bg-white text-[#3B3355] border border-[#E4D7FF] hover:bg-[#F4F0FF]"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Count badge (using filtered count so it reflects tab & filters) */}
                <span className="mt-2 inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                  {filteredOrders.length}
                </span>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
                {/* Date range pill */}
                <div className="flex items-center gap-2 rounded-[999px] border border-[#E4D7FF] bg-white/80 px-4 py-2 text-[11px] text-gray-700 shadow-sm">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      Date
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="h-5 rounded-md border border-transparent bg-transparent text-[11px] outline-none focus:border-[#7C3AED]"
                        placeholder="yyyy-mm-dd"
                      />
                      <span className="text-gray-300">–</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="h-5 rounded-md border border-transparent bg-transparent text-[11px] outline-none focus:border-[#7C3AED]"
                        placeholder="yyyy-mm-dd"
                      />
                    </div>
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                        setCurrentPage(1);
                      }}
                      className="ml-1 rounded-full bg-[#F2ECFF] px-2 py-0.5 text-[10px] font-semibold text-[#5A3BC6] hover:bg-[#E5DAFF]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Search + Quick actions */}
                <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                  <div className="relative flex-1 min-w-[180px] md:w-72">
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
                      className="w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 py-2 text-xs text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D8FD] focus:outline-none transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch(searchInput);
                      setCurrentPage(1);
                    }}
                    className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-[#18171E] transition"
                  >
                    Search
                  </button>

                  {/* Quick Actions */}
                  <div className="relative">
                    <button
                      type="button"
                      disabled={selectedCount === 0 || isPerformingQuickAction}
                      onClick={() =>
                        selectedCount > 0 &&
                        !isPerformingQuickAction &&
                        setQuickActionsOpen((o) => !o)
                      }
                      className={clsx(
                        "flex items-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition",
                        selectedCount === 0 || isPerformingQuickAction
                          ? "cursor-not-allowed bg-[#2A2834] text-gray-300 opacity-60"
                          : "bg-black text-white hover:bg-[#18171E]"
                      )}
                    >
                      Quick Actions
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </button>

                    {quickActionsOpen && (
                      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white text-[11px] shadow-lg z-40">
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Apply to {selectedCount} selected
                        </div>
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                          onClick={() => handleBulkStatusChange("shipped")}
                        >
                          Mark as shipped
                        </button>
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                          onClick={() => handleBulkStatusChange("delivered")}
                        >
                          Mark as delivered
                        </button>
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                          onClick={() => handleBulkStatusChange("cancelled")}
                        >
                          Mark as cancelled
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <div className="w-full overflow-x-auto">
                <table className="min-w-[880px] w-full text-xs table-fixed">
                  <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                    <tr>
                      <th className="w-10 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={
                            allCurrentPageSelected &&
                            currentRows.length > 0
                          }
                          onChange={toggleSelectAllCurrentPage}
                          className="h-3 w-3 rounded border-gray-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                        />
                      </th>
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
                          colSpan={8}
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
                          colSpan={8}
                          className="px-4 py-16 text-center text-xs text-gray-500"
                        >
                          No orders found.
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((o, idx) => {
                        const isSelected = selectedOrderIds.has(o.id);
                        const status = String(o.status) as
                          | OrderStatus
                          | string;

                        return (
                          <tr
                            key={o.id}
                            className={clsx(
                              "border-t border-gray-100",
                              idx % 2 === 1 && "bg-[#FBFBFE]"
                            )}
                          >
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleRowSelected(o.id)}
                                className="h-3 w-3 rounded border-gray-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                              />
                            </td>

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
                                  (status === "pending" ||
                                    status === "placed") &&
                                    "bg-amber-100 text-amber-800",
                                  (status === "processing" ||
                                    status === "shipped") &&
                                    "bg-indigo-100 text-indigo-800",
                                  (status === "delivered" ||
                                    status === "completed") &&
                                    "bg-emerald-100 text-emerald-800",
                                  status === "cancelled" &&
                                    "bg-red-100 text-red-700",
                                  status === "refunded" &&
                                    "bg-purple-100 text-purple-700"
                                )}
                              >
                                {prettyStatusLabel(status)}
                              </span>
                            </td>

                            <td className="px-3 py-3 text-right text-[11px] text-gray-700">
                              {o.totalCount}
                            </td>

                            <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                              {formatMoneyFromCents(o.totalCents)}
                            </td>

                            <td className="px-3 py-3 text-[11px] text-gray-600">
                              {formatDate(o.createdAt)}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <button
                                className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-[#18171E]"
                                onClick={() =>
                                  router.push(
                                    `/pages/vendor/orders/${o.id}`
                                  )
                                }
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span>
                  Showing {fromItem}-{toItem} of {filteredOrders.length} orders
                </span>
                {selectedCount > 0 && (
                  <span className="rounded-full bg-[#ECECFB] px-3 py-1 text-[10px] font-semibold text-[#4B3F73]">
                    {selectedCount} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-40"
                  onClick={() =>
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }
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
                    setCurrentPage((p) =>
                      Math.min(totalPages, p + 1)
                    )
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
