"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Search, X } from "lucide-react";
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
  | "processing"
  | "delivery"
  | "completed"
  | "cancelled"
  | "refunded";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId?: string | null;
  customerEmail?: string | null;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  itemsCount: number;
};

type CustomerRow = {
  key: string;
  id?: string | null;
  name: string;
  email?: string | null;
  totalOrders: number;
  totalCents: number;
  lastOrderAt: string | null;
  orders: OrderRow[];
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

export default function VendorCustomersPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  // NEW: selected customer for popup
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);

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

      // adjust endpoint if needed
      const res = await fetch("/api/vendor/orders", {
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch orders for customers list");
      }

      const data = await res.json();

      const mapped: OrderRow[] = (data.orders ?? data ?? []).map(
        (o: any): OrderRow => ({
          id: String(o.id),
          orderNumber: o.order_number ?? o.orderNo ?? `ORD-${o.id}`,
          customerName:
            (o.contact_name ??
            `${o.contact_name ?? ""} ${
              o.contact_name ?? ""
            }`.trim()) ||
            "Guest",
          customerId: o.customer_id ?? null,
          customerEmail: o.contact_email ?? null,
          status: (o.status ?? "pending") as OrderStatus,
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

  /* ---------- Group orders by customer ---------- */

  const allCustomers: CustomerRow[] = useMemo(() => {
    const map = new Map<string, CustomerRow>();

    for (const o of orders) {
      const key =
        o.customerId ||
        (o.customerEmail ? `email:${o.customerEmail}` : `name:${o.customerName}`);

      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          key,
          id: o.customerId ?? null,
          name: o.customerName,
          email: o.customerEmail ?? null,
          totalOrders: 1,
          totalCents: o.totalCents ?? 0,
          lastOrderAt: o.createdAt ?? null,
          orders: [o],
        });
      } else {
        existing.totalOrders += 1;
        existing.totalCents += o.totalCents ?? 0;

        if (
          !existing.lastOrderAt ||
          (o.createdAt ?? "") > (existing.lastOrderAt ?? "")
        ) {
          existing.lastOrderAt = o.createdAt ?? null;
        }

        existing.orders.push(o);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aDate = a.lastOrderAt ?? "";
      const bDate = b.lastOrderAt ?? "";
      return bDate.localeCompare(aDate);
    });
  }, [orders]);

  /* ---------- Filters & pagination ---------- */

  const filteredCustomers = allCustomers.filter((c) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    return (
      c.name.toLowerCase().includes(term) ||
      (c.email ?? "").toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize)
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const currentRows = filteredCustomers.slice(
    startIndex,
    startIndex + pageSize
  );
  const fromItem = filteredCustomers.length === 0 ? 0 : startIndex + 1;
  const toItem = startIndex + currentRows.length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* ---------- Modal content helper ---------- */

  const sortedModalOrders =
    selectedCustomer?.orders
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) ??
    [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                Customers
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {allCustomers.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
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
                  placeholder="Search by customer name or email…"
                  className="
                    w-80
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
                    <th className="px-3 py-3 text-left">Customer</th>
                    <th className="px-3 py-3 text-left">Email</th>
                    <th className="px-3 py-3 text-right">Orders</th>
                    <th className="px-3 py-3 text-right">Total Spend</th>
                    <th className="px-3 py-3 text-left">Last Order</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                        <ClipLoader
                          size={40}
                          color="#6B46C1"
                          cssOverride={{ animationDuration: "3s" }}
                        />
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((c, idx) => (
                      <tr
                        key={c.key}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        {/* Customer -> opens MODAL */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(c)}
                            className="inline-flex max-w-[220px] items-center gap-1 rounded-full px-2 py-1 text-left hover:bg-gray-100"
                          >
                            <span className="truncate font-medium">
                              {c.name}
                            </span>
                            <span className="text-[9px] text-gray-400">
                              {c.totalOrders} order
                              {c.totalOrders !== 1 ? "s" : ""} ▾
                            </span>
                          </button>
                        </td>

                        {/* Email */}
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {c.email || "—"}
                        </td>

                        {/* Orders count */}
                        <td className="px-3 py-3 text-right text-[11px] text-gray-700">
                          {c.totalOrders}
                        </td>

                        {/* Total spend */}
                        <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                          {formatMoneyFromCents(c.totalCents)}
                        </td>

                        {/* Last order */}
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {formatDate(c.lastOrderAt)}
                        </td>

                        {/* Action */}
                        <td className="px-3 py-3 text-center">
                          {c.orders.length > 0 ? (
                            <button
                              className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                              onClick={() =>
                                router.push(
                                  `/pages/vendor/orders/${c.orders[0].id}`
                                )
                              }
                            >
                              View latest order
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              No orders
                            </span>
                          )}
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
                Showing {fromItem}-{toItem} of {filteredCustomers.length}{" "}
                customers
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

      {/* ---------- CUSTOMER SUMMARY MODAL ---------- */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {selectedCustomer.name}
                </h2>
                {selectedCustomer.email && (
                  <p className="text-xs text-gray-500">
                    {selectedCustomer.email}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-gray-500">
                  {selectedCustomer.totalOrders} order
                  {selectedCustomer.totalOrders !== 1 ? "s" : ""} ·{" "}
                  {formatMoneyFromCents(selectedCustomer.totalCents)} total
                </p>
                {selectedCustomer.lastOrderAt && (
                  <p className="text-[11px] text-gray-500">
                    Last order: {formatDate(selectedCustomer.lastOrderAt)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Orders list */}
            <div className="mt-4 max-h-72 space-y-2 overflow-auto">
              {sortedModalOrders.length === 0 ? (
                <p className="text-[11px] text-gray-500">
                  No orders for this customer yet.
                </p>
              ) : (
                sortedModalOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-2xl bg-[#F8F7FF] px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-900">
                        {ord.orderNumber}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {formatDate(ord.createdAt)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        Status:{" "}
                        {ord.status.charAt(0).toUpperCase() +
                          ord.status.slice(1)}
                        {ord.itemsCount
                          ? ` · ${ord.itemsCount} item${
                              ord.itemsCount !== 1 ? "s" : ""
                            }`
                          : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-gray-900">
                        {formatMoneyFromCents(ord.totalCents)}
                      </p>
                      <button
                        type="button"
                        className="mt-1 rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white"
                        onClick={() =>
                          router.push(`/pages/vendor/orders/${ord.id}`)
                        }
                      >
                        View order
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}