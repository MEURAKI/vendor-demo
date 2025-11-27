"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ClipLoader from "react-spinners/ClipLoader";

import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";

/* ---------- Types ---------- */

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
  contact_email: string | null;
  contact_phone: string | null;
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
  orders: OrderForBooking | null;
};

type BookingStatus = "confirmed" | "awaiting_payment" | "completed" | "cancelled";

type ServiceBookingRow = {
  order_item_id: string;
  total_sessions: number | null;
  remaining_sessions: number | null;
  package_label: string | null;
};

type BookingView = {
  id: string; // order_item id
  bookingCode: string;
  orderId: string;
  orderCode: string;
  dateTimeLabel: string;
  serviceName: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  locationLabel: string;
  isOnline: boolean;
  status: BookingStatus;
  totalLabel: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  // package meta
  packageLabel: string | null;
  sessionsCount: number | null;
  remainingSessions: number | null;
};

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

/* Multiple session inputs in the UI */
type SessionInput = { id: number; label: string; url: string; time: string };

/* ---------- Helpers ---------- */

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

function deriveLocationMeta(
  optionsSnapshot: any
): { label: string; isOnline: boolean } {
  if (optionsSnapshot && typeof optionsSnapshot === "string") {
    try {
      optionsSnapshot = JSON.parse(optionsSnapshot);
    } catch {
      // ignore bad JSON
    }
  }

  let locationValue: string | null = null;

  if (optionsSnapshot && typeof optionsSnapshot === "object") {
    locationValue =
      optionsSnapshot.location_type ||
      optionsSnapshot.location ||
      optionsSnapshot.venue ||
      null;
  }

  if (!locationValue) {
    return {
      isOnline: false,
      label: "Studio / location not set",
    };
  }

  const str = String(locationValue).toLowerCase();
  if (str === "online" || str === "zoom" || str === "google meet") {
    return { isOnline: true, label: "Online session" };
  }

  return { isOnline: false, label: String(locationValue) };
}

function deriveBookingStatus(order: OrderForBooking | null): BookingStatus {
  if (!order) return "confirmed";
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "delivered") return "completed";
  if (order.payment_status !== "paid") return "awaiting_payment";
  return "confirmed";
}

function normalisePhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

/** Extract sessions_count + package label from options_snapshot */
function extractPackageMeta(optionsSnapshot: any): {
  sessionsCount: number | null;
  packageLabel: string | null;
} {
  let obj = optionsSnapshot;

  if (obj && typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      obj = null;
    }
  }

  if (!obj || typeof obj !== "object") {
    return { sessionsCount: null, packageLabel: null };
  }

  const rawCount =
    (obj as any).sessions_count ??
    (obj as any).session_count ??
    (obj as any).total_sessions ??
    null;

  let sessionsCount: number | null = null;
  if (rawCount != null) {
    const n = Number(rawCount);
    sessionsCount = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }

  const packageLabel =
    (obj as any).package_label ??
    (obj as any).package ??
    (obj as any).plan_label ??
    null;

  return {
    sessionsCount,
    packageLabel: packageLabel ? String(packageLabel) : null,
  };
}

/* ---------- Main page ---------- */

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // status dropdown
  const [statusSaving, setStatusSaving] = useState(false);

  // online meeting – support multiple sessions
  const [sessionInputs, setSessionInputs] = useState<SessionInput[]>([
    { id: 1, label: "", url: "", time: "" },
  ]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // physical check-in
  const [codeInput, setCodeInput] = useState("");
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

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

      // sidebar profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // load order_item (service) with joined order
      const { data: itemData, error: itemError } = await supabase
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
            contact_email,
            contact_phone,
            created_at
          )
        `
        )
        .eq("id", bookingId)
        .eq("line_type", "service")
        .maybeSingle();

      if (itemError || !itemData) {
        setError("Booking not found.");
        setLoading(false);
        return;
      }

      const row = itemData as unknown as OrderItemWithOrder;

      if (!row.orders || row.orders.vendor_id !== userId) {
        setError("You do not have permission to view this booking.");
        setLoading(false);
        return;
      }

      const order = row.orders;
      const bookingStatus = deriveBookingStatus(order);
      const loc = deriveLocationMeta(row.options_snapshot);
      const pkgMeta = extractPackageMeta(row.options_snapshot);

      // try to load service_bookings row for this order_item
      const { data: sbData } = await supabase
        .from("service_bookings")
        .select("order_item_id,total_sessions,remaining_sessions,package_label")
        .eq("order_item_id", bookingId)
        .maybeSingle();

      let sessionsCount = pkgMeta.sessionsCount;
      let packageLabel = pkgMeta.packageLabel;
      let remainingSessions: number | null = null;

      if (sbData) {
        const sb = sbData as ServiceBookingRow;
        if (sb.total_sessions != null && sb.total_sessions > 0) {
          sessionsCount = sb.total_sessions;
        }
        if (sb.remaining_sessions != null && sb.remaining_sessions >= 0) {
          remainingSessions = sb.remaining_sessions;
        }
        if (sb.package_label) {
          packageLabel = sb.package_label;
        }
      }

      const mapped: BookingView = {
        id: row.id,
        bookingCode: buildBookingCode(row.id),
        orderId: order.id,
        orderCode: buildOrderCode(order.id),
        dateTimeLabel: formatDateTime(order.created_at),
        serviceName: row.name_snapshot,
        customerName: order.contact_name || "Unknown customer",
        customerEmail: order.contact_email,
        customerPhone: order.contact_phone,
        locationLabel: loc.label,
        isOnline: loc.isOnline,
        status: bookingStatus,
        totalLabel: formatCurrencyFromCents(row.line_subtotal_cents),
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        packageLabel,
        sessionsCount,
        remainingSessions,
      };

      setBooking(mapped);

      // initialise session inputs based on sessionsCount
      const count = sessionsCount && sessionsCount > 0 ? sessionsCount : 1;

      const initial: SessionInput[] = Array.from({ length: count }, (_, idx) => ({
        id: idx + 1,
        label:
          count > 1
            ? `Session ${idx + 1}`
            : mapped.dateTimeLabel || "Session",
        url: "",
        time: "", // datetime-local value
      }));
      setSessionInputs(initial);

      setLoading(false);
    })();
  }, [bookingId]);

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

  async function updateBookingStatus(newStatus: BookingStatus) {
    if (!booking) return;
    if (booking.status === newStatus) return;
    // if already completed / cancelled, don't allow any more edits
    if (booking.status === "completed" || booking.status === "cancelled") return;

    setStatusSaving(true);
    setError(null);

    try {
      // map booking status → orders table fields
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
          setError("Failed to update booking status.");
          setStatusSaving(false);
          return;
        }
      }

      setBooking((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              orderStatus:
                newStatus === "completed"
                  ? "delivered"
                  : newStatus === "cancelled"
                  ? "cancelled"
                  : newStatus === "confirmed"
                  ? "fulfilled"
                  : prev.orderStatus,
              paymentStatus:
                newStatus === "awaiting_payment" ? "pending" : prev.paymentStatus,
            }
          : prev
      );
    } finally {
      setStatusSaving(false);
    }
  }

  // Online meeting email via your own API route (multi-session support)
  async function handleSendMeetingEmail() {
    if (!booking || !booking.customerEmail) return;

    // Clean + validate sessions (drop empty links)
    const cleaned = sessionInputs
      .map((s) => ({
        label: s.label.trim(),
        url: s.url.trim(),
        time: s.time.trim(),
      }))
      .filter((s) => s.url.length > 0);

    if (cleaned.length === 0) {
      setError("Please add at least one session link before sending.");
      return;
    }

    setSendingEmail(true);
    setEmailFeedback(null);
    setError(null);

    try {
      const res = await fetch("/api/vendor/bookings/send-session-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: booking.orderId,
          customer_email: booking.customerEmail,
          customer_name: booking.customerName,
          sessions: cleaned, // label + time + url
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("send-session-email failed", data);
        setError(data?.error || "Failed to send session email.");
        return;
      }

      setEmailFeedback(
        cleaned.length === 1
          ? `Session link sent to ${booking.customerEmail}.`
          : `Session links sent to ${booking.customerEmail}.`
      );
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleCheckinWithCode() {
    if (!booking) return;
    setCheckinError(null);

    const expected = booking.bookingCode.replace(/[^A-Z0-9]/g, "").toUpperCase();
    const entered = codeInput.replace(/[^A-Z0-9]/g, "").toUpperCase();

    if (!entered) {
      setCheckinError("Please enter or scan the booking code.");
      return;
    }
    if (entered !== expected) {
      setCheckinError("Booking code does not match. Please check and try again.");
      return;
    }

    // Valid → mark as completed
    setCheckingIn(true);
    try {
      await updateBookingStatus("completed");
    } finally {
      setCheckingIn(false);
    }
  }

  function handleEmailButton() {
    if (!booking?.customerEmail) return;
    const subject = encodeURIComponent(`Your booking ${booking.bookingCode}`);
    const body = encodeURIComponent(
      `Hi ${booking.customerName},\n\nHere are the details for your booking ${booking.bookingCode}.\n\n`
    );
    window.location.href = `mailto:${booking.customerEmail}?subject=${subject}&body=${body}`;
  }

  function handleWhatsappButton() {
    if (!booking?.customerPhone) return;
    const phoneNorm = normalisePhone(booking.customerPhone);
    const waPhone = phoneNorm.replace(/^\+/, "");
    const url = `https://wa.me/${waPhone}`;
    window.open(url, "_blank");
  }

  const statusLocked =
    booking?.status === "completed" || booking?.status === "cancelled";

  function addSessionRow() {
    // package-level max
    if (booking?.sessionsCount && sessionInputs.length >= booking.sessionsCount)
      return;

    setSessionInputs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        label: `Session ${prev.length + 1}`,
        url: "",
        time: "",
      },
    ]);
  }

  function updateSessionRow(
    id: number,
    field: "label" | "url" | "time",
    value: string
  ) {
    setSessionInputs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function removeSessionRow(id: number) {
    setSessionInputs((prev) =>
      prev.length === 1 ? prev : prev.filter((s) => s.id !== id)
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        <ClipLoader color="#7B61FF" size={50} />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        {error}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        Booking not found.
      </div>
    );
  }

  const statusBgClass =
    booking.status === "completed"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : booking.status === "awaiting_payment"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : booking.status === "cancelled"
      ? "bg-rose-100 text-rose-700 border-rose-300"
      : "bg-slate-100 text-slate-700 border-slate-300";

  const maxSessions = booking.sessionsCount ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          <div className="flex-1 overflow-auto px-7 py-7">
            <div className="mx-auto max-w-5xl">
              {/* Back link */}
              <div className="mb-5 flex items-center justify-between text-[13px] text-slate-500">
                <Link href="/pages/vendor/bookings" className="hover:underline">
                  ← Back to bookings
                </Link>
                <Link
                  href={`/pages/vendor/orders/${booking.orderId}`}
                  className="text-xs font-medium text-[#7B61FF] underline-offset-2 hover:underline"
                >
                  View order {booking.orderCode}
                </Link>
              </div>

              {/* Header */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-[26px] font-semibold text-slate-900">
                    Booking {booking.bookingCode}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {booking.serviceName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {booking.dateTimeLabel} · Order {booking.orderCode} ·{" "}
                    {booking.totalLabel}
                  </p>
                  {booking.packageLabel && (
                    <p className="mt-1 text-xs text-slate-500">
                      Package:{" "}
                      <span className="font-medium text-slate-700">
                        {booking.packageLabel}
                      </span>{" "}
                      {booking.sessionsCount && (
                        <>
                          · {booking.sessionsCount} session
                          {booking.sessionsCount > 1 ? "s" : ""}
                          {booking.remainingSessions != null && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="font-medium">
                                {booking.remainingSessions} remaining
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Booking status
                    </span>
                    <div
                      className={`inline-flex items-center rounded-full border px-4 py-1.5 ${statusBgClass}`}
                    >
                      <select
                        className="appearance-none bg-transparent border-none text-xs font-medium text-slate-800 focus:outline-none focus:ring-0 pr-6 cursor-pointer"
                        value={booking.status}
                        disabled={statusSaving || statusLocked}
                        onChange={(e) =>
                          updateBookingStatus(e.target.value as BookingStatus)
                        }
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="awaiting_payment">Awaiting payment</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <span className="pointer-events-none -ml-4 text-[10px] text-slate-700">
                        ▼
                      </span>
                    </div>
                    {statusLocked && (
                      <span className="text-[11px] text-slate-400">
                        Status locked because booking is{" "}
                        <span className="font-semibold">
                          {bookingStatusLabel[booking.status].toLowerCase()}
                        </span>
                        .
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* 2-column layout */}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.15fr)]">
                {/* LEFT COLUMN */}
                <div className="space-y-5">
                  {/* Customer card */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-base font-semibold text-slate-900">
                      Customer
                    </h2>
                    <p className="text-[15px] font-medium text-slate-900">
                      {booking.customerName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {booking.customerEmail || "No email"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {booking.customerPhone || "No phone"}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleEmailButton}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7B61FF] to-[#B54CFF] px-5 py-2.5 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                        disabled={!booking.customerEmail}
                      >
                        <span>✉</span>
                        <span>Email</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleWhatsappButton}
                        className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-black disabled:opacity-40"
                        disabled={!booking.customerPhone}
                      >
                        <span>📞</span>
                        <span>Call / WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Session details: online vs physical */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-base font-semibold text-slate-900">
                      Session details
                    </h2>

                    <p className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {booking.isOnline ? "Online session" : "In-person / physical session"}
                    </p>

                    <p className="mb-4 text-sm text-slate-600">
                      {booking.isOnline
                        ? "Share the meeting link(s) with your customer and mark the booking completed after the session."
                        : "When the customer arrives, scan or enter their booking code to mark the session as completed."}
                    </p>

                    {booking.isOnline ? (
                      <div className="space-y-4">
                        {/* Multiple session link rows */}
                        <div className="space-y-3">
                          {sessionInputs.map((row, idx) => (
                            <div
                              key={row.id}
                              className="grid gap-3 rounded-2xl bg-slate-50 p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_auto]"
                            >
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                  Session label
                                  {maxSessions && (
                                    <span className="text-[10px] text-slate-400">
                                      {" "}
                                      · {idx + 1}/{maxSessions}
                                    </span>
                                  )}
                                </label>
                                <input
                                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                  placeholder="Session 1 – 12 Mar, 3:00pm"
                                  value={row.label}
                                  onChange={(e) =>
                                    updateSessionRow(row.id, "label", e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                  Date &amp; time
                                </label>
                                <input
                                  type="datetime-local"
                                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                  value={row.time}
                                  onChange={(e) =>
                                    updateSessionRow(row.id, "time", e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                  Meeting link
                                </label>
                                <input
                                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                  placeholder="https://… (Zoom, Google Meet, etc)"
                                  value={row.url}
                                  onChange={(e) =>
                                    updateSessionRow(row.id, "url", e.target.value)
                                  }
                                />
                              </div>
                              <div className="flex items-end justify-end">
                                <button
                                  type="button"
                                  className="rounded-full bg-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-40"
                                  onClick={() => removeSessionRow(row.id)}
                                  disabled={sessionInputs.length === 1}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add session button (respect package max) */}
                        {(!maxSessions || sessionInputs.length < maxSessions) && (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-[#7B61FF] underline-offset-4 hover:underline"
                            onClick={addSessionRow}
                          >
                            + Add another session
                          </button>
                        )}
                        {maxSessions && sessionInputs.length >= maxSessions && (
                          <p className="text-[11px] text-slate-400">
                            Max {maxSessions} sessions for this package.
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={sendingEmail || !booking.customerEmail || statusLocked}
                            onClick={handleSendMeetingEmail}
                            className="rounded-full bg-[#7B61FF] px-5 py-2.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {sendingEmail ? "Sending…" : "Send link(s) to customer"}
                          </button>

                          <button
                            type="button"
                            disabled={statusLocked}
                            onClick={() => updateBookingStatus("completed")}
                            className="rounded-full bg-black px-5 py-2.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Mark as completed
                          </button>
                        </div>

                        {emailFeedback && (
                          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                            {emailFeedback}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Sessions chip for physical session */}
                        {booking.sessionsCount && (
                          <p className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700">
                            {booking.sessionsCount} session
                            {booking.sessionsCount > 1 ? "s" : ""}{" "}
                            {booking.remainingSessions != null && (
                              <>· {booking.remainingSessions} remaining</>
                            )}
                          </p>
                        )}

                        <div>
                          <p className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Booking code to scan / enter
                          </p>
                          <p className="inline-flex rounded-full bg-slate-900 px-4 py-1.5 text-xs font-mono font-semibold text-white">
                            {booking.bookingCode}
                          </p>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">
                            Scan or type booking code
                          </label>
                          <input
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            placeholder="Scan QR here or type the code"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                          />
                        </div>

                        {checkinError && (
                          <p className="text-xs text-rose-600">{checkinError}</p>
                        )}

                        <button
                          type="button"
                          disabled={checkingIn || statusLocked}
                          onClick={handleCheckinWithCode}
                          className="rounded-full bg-black px-5 py-2.5 text-xs font-medium text-white disabled:opacity-40"
                        >
                          {checkingIn ? "Checking…" : "Confirm check-in & complete"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN – quick summary */}
                <div className="space-y-5">
                  {/* Summary card */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-base font-semibold text-slate-900">
                      Booking summary
                    </h2>
                    <dl className="space-y-2 text-[15px] text-slate-700">
                      <div className="flex justify-between gap-4">
                        <dt>Service</dt>
                        <dd className="text-right">{booking.serviceName}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Date &amp; time</dt>
                        <dd className="text-right">{booking.dateTimeLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Location</dt>
                        <dd className="text-right">{booking.locationLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Order</dt>
                        <dd className="text-right">{booking.orderCode}</dd>
                      </div>
                      {booking.packageLabel && (
                        <div className="flex justify-between gap-4">
                          <dt>Package</dt>
                          <dd className="text-right">
                            {booking.packageLabel}
                            {booking.sessionsCount && (
                              <>
                                {" "}
                                · {booking.sessionsCount} session
                                {booking.sessionsCount > 1 ? "s" : ""}
                                {booking.remainingSessions != null && (
                                  <> · {booking.remainingSessions} remaining</>
                                )}
                              </>
                            )}
                          </dd>
                        </div>
                      )}
                      <div className="mt-2 flex justify-between gap-4 border-t border-slate-100 pt-3 text-base font-semibold">
                        <dt>Total</dt>
                        <dd>{booking.totalLabel}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                      <p>Order status: {booking.orderStatus}</p>
                      <p>Payment status: {booking.paymentStatus}</p>
                    </div>
                  </div>

                  {/* Notes stub */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-2 text-base font-semibold text-slate-900">
                      Internal notes
                    </h2>
                    <p className="mb-2 text-xs text-slate-500">
                      Add private notes about this session (visible only to you and your
                      team).
                    </p>
                    <textarea
                      className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="Wire this up to an order_notes table or column when you're ready."
                    />
                    <div className="mt-3 flex justify-end">
                      <button className="rounded-full bg-slate-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-black">
                        Save note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* end grid */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
