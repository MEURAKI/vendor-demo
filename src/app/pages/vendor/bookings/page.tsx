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

type ServiceBookingForItem = {
  order_item_id: string;
  total_sessions: number;
  remaining_sessions: number;
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
  dateTime: string;        // raw ISO for grouping
  dateTimeLabel: string;   // pretty
  serviceName: string;
  customerName: string;
  locationLabel: string;
  status: BookingStatus;
  statusLabel: string;
  totalLabel: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  totalSessions: number;
  remainingSessions: number;
  hasSessionTracking: boolean;
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
  _order: OrderForBooking | null,
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

type ViewMode = "list" | "calendar";

export default function BookingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
        console.error(itemsError);
        setError("Failed to load bookings.");
        setLoading(false);
        return;
      }

      const typedItems = (itemsData || []) as unknown as OrderItemWithOrder[];

      const orderItemIds = typedItems.map((i) => i.id);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from("service_bookings")
        .select("order_item_id,total_sessions,remaining_sessions")
        .in("order_item_id", orderItemIds);

      if (sessionsError) {
        console.error(sessionsError);
        // optional: surface error, but don't block the page
      }

      const sessionsByOrderItem = new Map<string, ServiceBookingForItem>();
      (sessionsData || []).forEach((sb) => {
        sessionsByOrderItem.set(sb.order_item_id, sb as ServiceBookingForItem);
      });

      const mapped: BookingRow[] = typedItems
        .filter((row) => row.orders && row.orders.vendor_id === userId)
        .map((row) => {
          const order = row.orders!;
          const status = deriveBookingStatus(order);

          const sessionInfo = sessionsByOrderItem.get(row.id);
          const hasSessionTracking = !!sessionInfo;
          const totalSessions = sessionInfo?.total_sessions ?? 1;
          const remainingSessions = sessionInfo
            ? sessionInfo.remaining_sessions
            : 0; // if no tracking row, treat as fully used so you can complete

          return {
            id: row.id,
            bookingCode: buildBookingCode(row.id),
            orderId: order.id,
            orderCode: buildOrderCode(order.id),
            dateTime: order.created_at,
            dateTimeLabel: formatDateTime(order.created_at),
            serviceName: row.name_snapshot,
            customerName: order.contact_name || "Unknown customer",
            locationLabel: deriveLocationLabel(order, row.options_snapshot),
            status,
            statusLabel: bookingStatusLabel[status],
            totalLabel: formatCurrencyFromCents(row.line_subtotal_cents),
            orderStatus: order.status,
            paymentStatus: order.payment_status,
            totalSessions,
            remainingSessions,
            hasSessionTracking,
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

    // lock once completed/cancelled
    if (booking.status === "completed" || booking.status === "cancelled") return;
    if (booking.status === newStatus) return;

    // NEW: don't allow completed if there are remaining sessions (for tracked packages)
    if (
      newStatus === "completed" &&
      booking.hasSessionTracking &&
      booking.remainingSessions > 0
    ) {
      setError(
        "Cannot mark this booking as completed while there are remaining sessions."
      );
      return;
    }

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

  // Build simple "calendar" groups: date (YYYY-MM-DD) → bookings[]
  const calendarGroups: Record<string, BookingRow[]> = {};
  filtered.forEach((b) => {
    const d = new Date(b.dateTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    if (!calendarGroups[key]) calendarGroups[key] = [];
    calendarGroups[key].push(b);
  });
  const sortedCalendarDates = Object.keys(calendarGroups).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  function formatCalendarDate(key: string): string {
    const d = new Date(key);
    return d.toLocaleDateString("en-SG", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Main shell */}
      <div className="flex flex-1 items-stretch justify-center px-3 py-3 md:px-6 md:py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)] md:rounded-[32px]">
          <div className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
                    Bookings
                  </h1>
                  <p className="text-xs text-slate-500 md:text-sm">
                    Manage upcoming and past service sessions. (Service lines only)
                  </p>
                </div>
                <div className="rounded-full bg-black px-3 py-1.5 text-[11px] font-medium text-white shadow-sm md:px-4">
                  {rows.length} booking{rows.length === 1 ? "" : "s"}
                </div>
              </div>

              {/* Filters row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:gap-4">
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
                          className={`rounded-full px-3 py-1.5 text-xs font-medium md:px-4 ${
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
                  <button className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-700 md:px-4">
                    This month ▾
                  </button>
                </div>

                {/* View toggle */}
                <div className="flex rounded-full bg-white p-1 text-[11px] md:text-xs">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`rounded-full px-3 py-1 font-medium md:px-4 ${
                      viewMode === "list"
                        ? "bg-[#7B61FF] text-white"
                        : "text-slate-600"
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={`rounded-full px-3 py-1 font-medium md:px-4 ${
                      viewMode === "calendar"
                        ? "bg-[#7B61FF] text-white"
                        : "text-slate-600"
                    }`}
                  >
                    Calendar
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4 rounded-full bg-white px-3 py-2 shadow-sm md:px-4">
                <input
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 md:text-sm"
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

              {/* LIST VIEW ================================================== */}
              {viewMode === "list" && (
                <>
                  {/* MOBILE CARDS */}
                  <div className="space-y-3 md:hidden">
                    {filtered.map((b) => {
                      const statusLocked =
                        b.status === "completed" || b.status === "cancelled";

                      return (
                        <div
                          key={b.id}
                          className="rounded-2xl bg-white p-4 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-mono text-[11px] font-semibold text-slate-800">
                                {b.bookingCode}
                              </p>
                              <p className="text-xs text-slate-500">
                                Order {b.orderCode}
                              </p>
                            </div>
                            <Link
                              href={`/pages/vendor/bookings/${b.id}`}
                              className="rounded-full bg-[#EFE6FF] px-3 py-1 text-[11px] font-medium text-slate-800 hover:bg-[#E2D3FF]"
                            >
                              View
                            </Link>
                          </div>

                          <p className="mb-1 text-[13px] font-medium text-slate-900">
                            {b.serviceName}
                          </p>
                          <p className="text-[12px] text-slate-600">
                            {b.dateTimeLabel}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[12px] text-slate-600">
                            <span>{b.customerName}</span>
                            <span>{b.locationLabel}</span>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div
                              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${bookingStatusClasses[b.status]}`}
                            >
                              <select
                                value={b.status}
                                disabled={statusSavingId === b.id || statusLocked}
                                onChange={(e) =>
                                  handleBookingStatusChange(
                                    b.id,
                                    e.target.value as BookingStatus
                                  )
                                }
                                className="cursor-pointer bg-transparent pr-4 text-[11px] font-medium outline-none"
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
                            <p className="text-[12px] font-semibold text-slate-900">
                              {b.totalLabel}
                            </p>
                          </div>

                          <p className="mt-1 text-[11px] text-slate-500">
                            Sessions: {b.remainingSessions}/{b.totalSessions}
                          </p>
                        </div>
                      );
                    })}

                    {filtered.length === 0 && (
                      <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500">
                        No bookings found for this filter/search.
                      </div>
                    )}
                  </div>

                  {/* DESKTOP / TABLET TABLE */}
                  <div className="hidden overflow-hidden rounded-3xl bg-white shadow-sm md:block">
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
                            <th className="px-6 py-3">Sessions</th>
                            <th className="px-6 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((b) => {
                            const statusLocked =
                              b.status === "completed" || b.status === "cancelled";

                            return (
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
                                    href={`/pages/vendor/bookings/${b.id}`}
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
                                    className={`relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${bookingStatusClasses[b.status]}`}
                                  >
                                    <select
                                      value={b.status}
                                      disabled={statusSavingId === b.id || statusLocked}
                                      onChange={(e) =>
                                        handleBookingStatusChange(
                                          b.id,
                                          e.target.value as BookingStatus
                                        )
                                      }
                                      className="
                                        bg-transparent
                                        border-0
                                        outline-none
                                        pl-0
                                        pr-6
                                        appearance-none
                                        text-xs font-medium
                                        cursor-pointer
                                        focus:ring-0
                                        focus:outline-none
                                        text-inherit
                                        [&::-ms-expand]:hidden
                                      "
                                      style={{
                                        WebkitAppearance: "none",
                                        MozAppearance: "none",
                                        appearance: "none",
                                        color: "inherit",
                                        backgroundColor: "transparent",
                                      }}
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

                                    {/* Custom single arrow */}
                                    <svg
                                      className="pointer-events-none absolute right-2 h-3 w-3 opacity-60 text-inherit"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </div>
                                </td>

                                <td className="px-6 py-3 text-slate-800">
                                  {b.totalLabel}
                                </td>

                                <td className="px-6 py-3 text-slate-700">
                                  {b.remainingSessions}/{b.totalSessions}
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
                            );
                          })}

                          {filtered.length === 0 && (
                            <tr>
                              <td
                                colSpan={10}
                                className="px-6 py-6 text-center text-sm text-slate-500"
                              >
                                No bookings found for this filter/search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                      Showing {filtered.length} booking
                      {filtered.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </>
              )}

              {/* CALENDAR VIEW ============================================== */}
              {viewMode === "calendar" && (
                <div className="mt-2 space-y-4">
                  {sortedCalendarDates.length === 0 && (
                    <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500">
                      No bookings found for this filter/search.
                    </div>
                  )}

                  {sortedCalendarDates.map((dateKey) => {
                    const dayBookings = calendarGroups[dateKey];
                    return (
                      <div
                        key={dateKey}
                        className="rounded-3xl bg-white p-4 shadow-sm md:p-5"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {formatCalendarDate(dateKey)}
                          </p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                            {dayBookings.length} booking
                            {dayBookings.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {dayBookings.map((b) => {
                            const statusLocked =
                              b.status === "completed" || b.status === "cancelled";

                            return (
                              <div
                                key={b.id}
                                className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 hover:border-slate-200"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-mono text-[11px] font-semibold text-slate-800">
                                      {b.bookingCode}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {b.dateTimeLabel.split(", ")[1] ?? b.dateTimeLabel}
                                    </p>
                                  </div>
                                  <Link
                                    href={`/pages/vendor/bookings/${b.id}`}
                                    className="rounded-full bg-[#EFE6FF] px-3 py-1 text-[11px] font-medium text-slate-800 hover:bg-[#E2D3FF]"
                                  >
                                    View
                                  </Link>
                                </div>

                                <p className="text-[13px] font-medium text-slate-900">
                                  {b.serviceName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {b.customerName} · {b.locationLabel}
                                </p>

                                <div className="mt-3 flex items-center justify-between">
                                  <div
                                    className={`relative inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${bookingStatusClasses[b.status]}`}
                                  >
                                    <select
                                      value={b.status}
                                      disabled={statusSavingId === b.id || statusLocked}
                                      onChange={(e) =>
                                        handleBookingStatusChange(
                                          b.id,
                                          e.target.value as BookingStatus
                                        )
                                      }
                                      className="bg-transparent border-0 outline-none pr-4 text-[11px] cursor-pointer"
                                      style={{
                                        WebkitAppearance: "none",
                                        MozAppearance: "none",
                                        appearance: "none",
                                        color: "inherit",
                                      }}
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
                                  <div className="text-right">
                                    <p className="text-[12px] font-semibold text-slate-900">
                                      {b.totalLabel}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      Sessions: {b.remainingSessions}/{b.totalSessions}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
