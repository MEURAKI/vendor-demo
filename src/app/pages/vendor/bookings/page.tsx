// app/vendor/bookings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type OrderStatus = "placed" | "fulfilled" | "shipped" | "delivered" | "cancelled";

type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

type OrderForBooking = {
  id: string;
  vendor_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  contact_name: string | null;
  created_at: string;
};

type OrderItemLineType = "product" | "bundle" | "service";

type ItemFulfilmentStatus = "pending" | "processing" | "packed";

type OrderItemWithOrder = {
  id: string;
  order_id: string;
  line_type: OrderItemLineType;
  name_snapshot: string;
  options_snapshot: any;
  quantity: number;
  line_subtotal_cents: number;
  item_fulfilment_status: ItemFulfilmentStatus | null;
  created_at: string;
  // joined order
  orders: OrderForBooking | null;
};

type BookingStatus = "confirmed" | "awaiting_payment" | "completed" | "cancelled";

type BookingRow = {
  id: string; // order_item id
  bookingCode: string;
  orderId: string;
  orderCode: string;
  dateTimeLabel: string;
  serviceName: string;
  customerName: string;
  locationLabel: string;
  status: BookingStatus;
  statusLabel: string;
  totalLabel: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
};

type FilterTab = "all" | "upcoming" | "completed" | "cancelled";

const bookingStatusLabel: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  awaiting_payment: "Awaiting payment",
  completed: "Completed",
  cancelled: "Cancelled",
};

const bookingStatusClasses: Record<BookingStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  awaiting_payment: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-200 text-rose-800",
};

function formatCurrencyFromCents(cents: number): string {
  return `SGD ${(cents / 100).toFixed(2)}`;
}

function buildOrderCode(id: string): string {
  return `#${id.split("-")[0].toUpperCase()}`;
}

function buildBookingCode(id: string): string {
  return `B-${id.split("-")[0].toUpperCase()}`;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return d.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deriveLocationLabel(
  order: OrderForBooking | null,
  optionsSnapshot: any
): string {
  if (optionsSnapshot && typeof optionsSnapshot === "string") {
    try {
      optionsSnapshot = JSON.parse(optionsSnapshot);
    } catch {
      // ignore bad JSON
    }
  }

  const fromOptions =
    optionsSnapshot && typeof optionsSnapshot === "object"
      ? optionsSnapshot.location_type || optionsSnapshot.location
      : null;

  if (fromOptions === "online") return "Online";
  if (typeof fromOptions === "string" && fromOptions.length > 0) {
    return fromOptions;
  }

  // Fallback – refine when you have richer schema
  return "Studio / location not set";
}

function deriveBookingStatus(order: OrderForBooking | null): BookingStatus {
  if (!order) return "confirmed";
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "delivered") return "completed";
  if (order.payment_status !== "paid") return "awaiting_payment";
  return "confirmed";
}

export default function BookingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

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
      if (!auth?.user) {
        setError("No authenticated user.");
        setLoading(false);
        return;
      }

      const userId = auth.user.id;

      // Sidebar profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // Load SERVICE line items joined with their orders
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          `
          id,
          order_id,
          line_type,
          name_snapshot,
          options_snapshot,
          quantity,
          line_subtotal_cents,
          item_fulfilment_status,
          created_at,
          orders:order_id (
            id,
            vendor_id,
            status,
            payment_status,
            contact_name,
            created_at
          )
        `
        )
        .eq("vendor_id", userId)
        .eq("line_type", "service")
        .order("created_at", { ascending: false });

      if (itemsError) {
        setError("Failed to load bookings.");
        setLoading(false);
        return;
      }

      const typedItems = (itemsData || []) as unknown as OrderItemWithOrder[];

      const mapped: BookingRow[] = typedItems
        .filter((row) => row.orders && row.orders.vendor_id === userId)
        .map((row) => {
          const order = row.orders!;
          const status = deriveBookingStatus(order);

          return {
            id: row.id,
            bookingCode: buildBookingCode(row.id),
            orderId: order.id,
            orderCode: buildOrderCode(order.id),
            dateTimeLabel: formatDateTime(order.created_at),
            serviceName: row.name_snapshot,
            customerName: order.contact_name || "Unknown customer",
            locationLabel: deriveLocationLabel(order, row.options_snapshot),
            status,
            statusLabel: bookingStatusLabel[status],
            totalLabel: formatCurrencyFromCents(row.line_subtotal_cents),
            orderStatus: order.status,
            paymentStatus: order.payment_status,
          };
        });

      setRows(mapped);
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

  const filtered = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      row.customerName.toLowerCase().includes(term) ||
      row.serviceName.toLowerCase().includes(term) ||
      row.bookingCode.toLowerCase().includes(term) ||
      row.orderCode.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (tab === "all") return true;
    if (tab === "upcoming")
      return row.status === "confirmed" || row.status === "awaiting_payment";
    if (tab === "completed") return row.status === "completed";
    if (tab === "cancelled") return row.status === "cancelled";
    return true;
  });

  async function handleBookingStatusChange(bookingId: string, newStatus: BookingStatus) {
    const booking = rows.find((r) => r.id === bookingId);
    if (!booking) return;

    setStatusSavingId(bookingId);
    setError(null);

    try {
      // Map booking status → order status / payment status
      const orderUpdates: Partial<OrderForBooking> = {};

      if (newStatus === "completed") {
        orderUpdates.status = "delivered";
      } else if (newStatus === "cancelled") {
        orderUpdates.status = "cancelled";
      } else if (newStatus === "confirmed") {
        // treat as fulfilled; tweak this mapping if you want
        orderUpdates.status = "fulfilled";
      }

      if (newStatus === "awaiting_payment") {
        orderUpdates.payment_status = "pending";
      }

      if (Object.keys(orderUpdates).length > 0) {
        const { error: updateError } = await supabase
          .from("orders")
          .update(orderUpdates)
          .eq("id", booking.orderId);

        if (updateError) {
          console.error(updateError);
          setError("Failed to update booking status.");
          setStatusSavingId(null);
          return;
        }
      }

      // Update local state
      setRows((prev) =>
        prev.map((row) =>
          row.id === bookingId
            ? {
                ...row,
                status: newStatus,
                statusLabel: bookingStatusLabel[newStatus],
                orderStatus:
                  newStatus === "completed"
                    ? "delivered"
                    : newStatus === "cancelled"
                    ? "cancelled"
                    : newStatus === "confirmed"
                    ? "fulfilled"
                    : row.orderStatus,
                paymentStatus:
                  newStatus === "awaiting_payment" ? "pending" : row.paymentStatus,
              }
            : row
        )
      );
    } finally {
      setStatusSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        Loading bookings…
      </div>
    );
  }

  if (error && rows.length === 0) {
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
      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Bookings
                  </h1>
                  <p className="text-sm text-slate-500">
                    Manage upcoming and past service sessions. (Service lines only)
                  </p>
                </div>
                <div className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white shadow-sm">
                  {rows.length} booking{rows.length === 1 ? "" : "s"}
                </div>
              </div>

              {/* Filters row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "upcoming", "completed", "cancelled"] as FilterTab[]).map(
                    (key) => {
                      const isActive = tab === key;
                      const labelMap: Record<FilterTab, string> = {
                        all: "All",
                        upcoming: "Upcoming",
                        completed: "Completed",
                        cancelled: "Cancelled",
                      };
                      return (
                        <button
                          key={key}
                          onClick={() => setTab(key)}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                            isActive
                              ? "bg-[#7B61FF] text-white shadow-sm"
                              : "bg-white text-slate-700"
                          }`}
                        >
                          {labelMap[key]}
                        </button>
                      );
                    }
                  )}
                  {/* Time filter stub */}
                  <button className="rounded-full bg-white px-4 py-1.5 text-xs text-slate-700">
                    This month ▾
                  </button>
                </div>

                {/* View toggle stub */}
                <div className="flex rounded-full bg-white p-1 text-xs">
                  <button className="rounded-full bg-[#7B61FF] px-4 py-1 font-medium text-white">
                    List
                  </button>
                  <button className="rounded-full px-4 py-1 text-slate-600">
                    Calendar
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4 rounded-full bg-white px-4 py-2 shadow-sm">
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Search by customer, service, booking ID, or order ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Error banner (non-fatal) */}
              {error && rows.length > 0 && (
                <div className="mb-3 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Table container */}
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4 text-sm font-medium text-slate-700">
                  All bookings
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-[#EFE6FF] text-xs uppercase tracking-wide text-slate-600">
                        <th className="px-6 py-3">Booking ID</th>
                        <th className="px-6 py-3">Order</th>
                        <th className="px-6 py-3">Date &amp; time</th>
                        <th className="px-6 py-3">Service</th>
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Total</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-6 py-3 text-slate-800">
                            <span className="font-mono text-xs font-semibold">
                              {b.bookingCode}
                            </span>
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            <Link
                              href={`/pages/vendor/orders/${b.orderId}`}
                              className="text-xs font-medium text-[#7B61FF] underline-offset-2 hover:underline"
                            >
                              {b.orderCode}
                            </Link>
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            {b.dateTimeLabel}
                          </td>

                          <td className="px-6 py-3 text-slate-800">
                            {b.serviceName}
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            {b.customerName}
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            {b.locationLabel}
                          </td>

                          <td className="px-6 py-3">
                            <div
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${bookingStatusClasses[b.status]}`}
                            >
                              <select
                                value={b.status}
                                disabled={statusSavingId === b.id}
                                onChange={(e) =>
                                  handleBookingStatusChange(
                                    b.id,
                                    e.target.value as BookingStatus
                                  )
                                }
                                className="cursor-pointer bg-transparent pr-4 text-xs font-medium outline-none"
                              >
                                <option value="confirmed">
                                  {bookingStatusLabel.confirmed}
                                </option>
                                <option value="awaiting_payment">
                                  {bookingStatusLabel.awaiting_payment}
                                </option>
                                <option value="completed">
                                  {bookingStatusLabel.completed}
                                </option>
                                <option value="cancelled">
                                  {bookingStatusLabel.cancelled}
                                </option>
                              </select>
                            </div>
                          </td>

                          <td className="px-6 py-3 text-slate-800">
                            {b.totalLabel}
                          </td>

                          <td className="px-6 py-3 text-right">
                         <Link
  href={`/pages/vendor/bookings/${b.id}`}
  className="inline-flex items-center rounded-full bg-[#EFE6FF] px-4 py-1.5 text-xs font-medium text-slate-800 hover:bg-[#E2D3FF]"
>
  View booking
</Link>
                          </td>
                        </tr>
                      ))}

                      {filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-6 py-6 text-center text-sm text-slate-500"
                          >
                            No bookings found for this filter/search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer (simple) */}
                <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                  Showing {filtered.length} booking
                  {filtered.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}