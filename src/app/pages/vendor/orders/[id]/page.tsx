"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type OrderStatus =
  | "placed"
  | "fulfilled"
  | "shipped"
  | "delivered"
  | "cancelled";

type FulfilmentStatus =
  | "pending"
  | "shipped"
  | "ready_for_pickup"
  | "delivered"
  | "cancelled";

type Order = {
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
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  pickup_location_name: string | null;
  pickup_address: string | null;
  pickup_reference: string | null;
  shipping_provider: string | null;
  tracking_number: string | null;
  payment_status: "pending" | "paid" | "refunded" | "failed";
  created_at: string;
  updated_at: string;
};

type OrderItemLineType = "product" | "bundle" | "service";

type ItemFulfilmentStatus = "pending" | "processing" | "packed";

type OrderItem = {
  id: string;
  order_id: string;
  line_type: OrderItemLineType;
  product_id: string | null;
  product_variant_id: string | null;
  bundle_id: string | null;
  name_snapshot: string;
  sku_snapshot: string | null;
  options_snapshot: any;
  image_url_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  created_at: string;
  vendor_id: string;
  service_id: string | null;
  service_location_settings_id: string | null;
  service_package_id: string | null;
  line_subtotal_cents: number;
  item_fulfilment_status: ItemFulfilmentStatus;
};

type OrderFulfilment = {
  id: string;
  order_id: string;
  vendor_id: string;
  fulfilment_method: "standard_delivery" | "express_delivery" | "pickup";
  shipping_provider: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: FulfilmentStatus;
  estimated_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  pickup_ready_at: string | null;
  pickup_completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OrderActivityType =
  | "placed"
  | "fulfilled"
  | "shipped"
  | "delivered"
  | "picked_up"
  | "note";

type OrderActivity = {
  id: string;
  order_id: string;
  vendor_id: string;
  type: OrderActivityType;
  description: string;
  meta: any;
  created_at: string;
};

type TimelineStep = {
  label: string;
  date: string;
  done: boolean;
};

const itemStatusLabel: Record<ItemFulfilmentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  packed: "Packed",
};

const itemStatusClasses: Record<ItemFulfilmentStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-700",
  packed: "bg-emerald-100 text-emerald-700",
};

function formatCurrencyFromCents(cents: number): string {
  return `SGD ${(cents / 100).toFixed(2)}`;
}

function buildOrderCode(id: string): string {
  return `#${id.split("-")[0].toUpperCase()}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapFulfilmentMethodLabel(method: Order["fulfilment_method"]): string {
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

function lineTypeBadge(lineType: OrderItemLineType): string {
  switch (lineType) {
    case "product":
      return "Product";
    case "bundle":
      return "Bundle";
    case "service":
      return "Service";
  }
}

function buildTimeline(
  order: Order,
  fulfilment: OrderFulfilment | null
): TimelineStep[] {
  const isPickup = order.fulfilment_method === "pickup";

  const steps: TimelineStep[] = [];

  // 1. Placed: always done
  steps.push({
    label: "Placed",
    date: formatDateTime(order.created_at),
    done: true,
  });

  // 2. Fulfilled: based on order status
  const fulfilledDone = ["fulfilled", "shipped", "delivered"].includes(
    order.status
  );

  steps.push({
    label: "Fulfilled",
    date: fulfilledDone ? formatDateTime(order.updated_at) : "—",
    done: fulfilledDone,
  });

  // 3. Shipped / Ready for pickup
  if (isPickup) {
    const done =
      !!fulfilment?.pickup_ready_at ||
      ["fulfilled", "shipped", "delivered"].includes(order.status);

    steps.push({
      label: "Ready for pickup",
      date: fulfilment?.pickup_ready_at
        ? formatDateTime(fulfilment.pickup_ready_at)
        : done
        ? formatDateTime(order.updated_at)
        : "—",
      done,
    });
  } else {
    const shippedDone =
      !!fulfilment?.shipped_at ||
      order.status === "shipped" ||
      order.status === "delivered";

    steps.push({
      label: "Shipped",
      date: fulfilment?.shipped_at
        ? formatDateTime(fulfilment.shipped_at)
        : shippedDone
        ? formatDateTime(order.updated_at)
        : "—",
      done: shippedDone,
    });
  }

  // 4. Delivered / Picked up
  const finalDone =
    order.status === "delivered" ||
    !!fulfilment?.delivered_at ||
    !!fulfilment?.pickup_completed_at;

  const eta =
    fulfilment?.estimated_delivery_date &&
    !finalDone &&
    !isPickup &&
    `ETA ${formatDate(fulfilment.estimated_delivery_date)}`;

  steps.push({
    label: isPickup ? "Picked up" : "Delivered",
    date:
      fulfilment?.delivered_at || fulfilment?.pickup_completed_at
        ? formatDateTime(
            fulfilment.delivered_at || fulfilment.pickup_completed_at!
          )
        : finalDone
        ? formatDateTime(order.updated_at)
        : eta || "—",
    done: finalDone,
  });

  return steps;
}

// Fire-and-forget call to your Mandrill-backed API
async function sendStatusEmail(
  orderId: string,
  status: OrderStatus | "picked_up"
) {
  try {
    await fetch("/api/vendor/orders/send-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderId, status }),
    });
  } catch (err) {
    console.error("Failed to send status email", err);
  }
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [fulfilment, setFulfilment] = useState<OrderFulfilment | null>(null);
  const [activityLogs, setActivityLogs] = useState<OrderActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);

  // email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sessionLink, setSessionLink] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // Load profile + order data
  useEffect(() => {
    if (!orderId) return;

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

      // Profile for sidebar
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // Load order (and ensure it belongs to this vendor)
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !orderData) {
        setError("Order not found.");
        setLoading(false);
        return;
      }

      const typedOrder = orderData as Order;

      if (typedOrder.vendor_id !== userId) {
        setError("You do not have permission to view this order.");
        setLoading(false);
        return;
      }

      setOrder(typedOrder);

      // Load product-only items via API
      const itemsRes = await fetch(
        `/api/vendor/orders/${orderId}/product-items`,
        {
          credentials: "include",
        }
      );

      if (!itemsRes.ok) {
        setError("Failed to load order items.");
        setLoading(false);
        return;
      }

      const itemsJson = (await itemsRes.json()) as { items: OrderItem[] };
      setItems(itemsJson.items || []);

      // Load fulfilment row
// Load shipment row (shipping details now live in order_shipments)
const { data: fulfilmentData, error: fulfilmentError } = await supabase
  .from("order_shipments")
  .select("*")
  .eq("order_id", orderId)
  .maybeSingle();

if (!fulfilmentError && fulfilmentData) {
  setFulfilment(fulfilmentData as OrderFulfilment);
}

      if (!fulfilmentError && fulfilmentData) {
        setFulfilment(fulfilmentData as OrderFulfilment);
      }

      // Load activity logs
      const { data: activityData, error: activityError } = await supabase
        .from("order_activities")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (!activityError && activityData) {
        setActivityLogs(activityData as OrderActivity[]);
      }

      setLoading(false);
    })();
  }, [orderId]);

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

  async function handleMarkFinal() {
    if (!order) return;
    setSaving(true);
    setError(null);

    const nowIso = new Date().toISOString();
    const isPickup = order.fulfilment_method === "pickup";

    try {
      // Update order status → delivered
      const { data: updatedOrderData, error: orderUpdateError } = await supabase
        .from("orders")
        .update({ status: "delivered", updated_at: nowIso })
        .eq("id", order.id)
        .select("*")
        .maybeSingle();

      if (orderUpdateError || !updatedOrderData) {
        setError("Failed to update order status.");
        setSaving(false);
        return;
      }

      setOrder(updatedOrderData as Order);

      // Update fulfilment if exists
      if (fulfilment) {
        const payload: Partial<OrderFulfilment> = {
          status: "delivered",
          updated_at: nowIso,
        };

        if (isPickup) {
          payload.pickup_completed_at = nowIso;
        } else {
          payload.delivered_at = nowIso;
        }

          const { data: updatedFulfilmentData, error: fulfilmentUpdateError } =
    await supabase
      .from("order_shipments")
      .update(payload)
      .eq("id", fulfilment.id)
      .select("*")
      .maybeSingle();

        if (!fulfilmentUpdateError && updatedFulfilmentData) {
          setFulfilment(updatedFulfilmentData as OrderFulfilment);
        }
      }

      // Insert activity log
      const description = isPickup
        ? "Marked as picked up"
        : "Marked as delivered";

      const { data: activityInsert, error: activityInsertError } =
        await supabase
          .from("order_activities")
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            type: isPickup ? "picked_up" : "delivered",
            description,
            meta: null,
          })
          .select("*")
          .single();

      if (!activityInsertError && activityInsert) {
        setActivityLogs((prev) => [
          activityInsert as OrderActivity,
          ...prev,
        ]);
      }

      // Fire status email (delivered / picked up)
      await sendStatusEmail(order.id, isPickup ? "picked_up" : "delivered");
    } catch {
      setError("Something went wrong while updating.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(newStatus: OrderStatus) {
    if (!order || newStatus === order.status) return;

    // If they chose "delivered", reuse the dedicated flow so fulfilment & activity stay consistent
    if (newStatus === "delivered") {
      await handleMarkFinal();
      return;
    }

    setUpdatingStatus(true);
    setError(null);

    const nowIso = new Date().toISOString();

    try {
      const { data: updatedOrder, error: orderError } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: nowIso })
        .eq("id", order.id)
        .select("*")
        .maybeSingle();

      if (orderError || !updatedOrder) {
        setError("Failed to update status.");
        setUpdatingStatus(false);
        return;
      }

      setOrder(updatedOrder as Order);

      const description = `Status updated to "${newStatus}"`;

      const { data: activityInsert, error: activityInsertError } =
        await supabase
          .from("order_activities")
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            type: "note",
            description,
            meta: { status: newStatus },
          })
          .select("*")
          .single();

      if (!activityInsertError && activityInsert) {
        setActivityLogs((prev) => [
          activityInsert as OrderActivity,
          ...prev,
        ]);
      }

      // Send status email for relevant states
      if (["fulfilled", "shipped", "cancelled"].includes(newStatus)) {
        await sendStatusEmail(order.id, newStatus);
      }
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function updateItemStatus(
    itemId: string,
    newStatus: ItemFulfilmentStatus
  ) {
    if (!order) return;
    setSavingItemId(itemId);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("order_items")
        .update({ item_fulfilment_status: newStatus })
        .eq("id", itemId);

      if (updateError) {
        setError("Failed to update item status.");
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, item_fulfilment_status: newStatus }
            : item
        )
      );

      const description = `Updated item status to "${newStatus}"`;

      const { data: activityInsert, error: activityInsertError } =
        await supabase
          .from("order_activities")
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            type: "note",
            description,
            meta: { item_id: itemId, status: newStatus },
          })
          .select("*")
          .single();

      if (!activityInsertError && activityInsert) {
        setActivityLogs((prev) => [
          activityInsert as OrderActivity,
          ...prev,
        ]);
      }
    } finally {
      setSavingItemId(null);
    }
  }

  // Send online session link email via Supabase Edge Function
  async function handleSendSessionEmail() {
    if (!order || !order.contact_email || !sessionLink.trim()) return;
    setSendingEmail(true);
    setError(null);
    setEmailFeedback(null);

    try {
      const { error: fnError } = await supabase.functions.invoke(
        "send-session-link-email",
        {
          body: {
            order_id: order.id,
            customer_email: order.contact_email,
            customer_name: order.contact_name,
            session_link: sessionLink.trim(),
          },
        }
      );

      if (fnError) {
        setError("Failed to send session email.");
        setSendingEmail(false);
        return;
      }

      setEmailFeedback(`Session link sent to ${order.contact_email}.`);

      // Log activity
      const { data: activityInsert, error: activityInsertError } =
        await supabase
          .from("order_activities")
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            type: "note",
            description: "Sent online session link email to customer",
            meta: { session_link: sessionLink.trim() },
          })
          .select("*")
          .single();

      if (!activityInsertError && activityInsert) {
        setActivityLogs((prev) => [
          activityInsert as OrderActivity,
          ...prev,
        ]);
      }
    } finally {
      setSendingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        Loading order…
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        Order not found.
      </div>
    );
  }

  const code = buildOrderCode(order.id);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const isPickup = order.fulfilment_method === "pickup";
  const deliveryLabel = mapFulfilmentMethodLabel(order.fulfilment_method);
  const timeline = buildTimeline(order, fulfilment);

  const mainStatus =
    fulfilment?.status === "shipped" || order.status === "shipped"
      ? "Shipped"
      : fulfilment?.status === "ready_for_pickup"
      ? "Ready for pickup"
      : order.status.charAt(0).toUpperCase() + order.status.slice(1);

  const customerName = order.contact_name || "Unknown customer";
  const customerEmail = order.contact_email || "—";
  const customerPhone = order.contact_phone || "—";

  const shippingLines =
    order.shipping_address_line1 ||
    order.shipping_city ||
    order.shipping_postal_code
      ? [
          order.shipping_address_line1,
          order.shipping_address_line2,
          [order.shipping_city, order.shipping_postal_code]
            .filter(Boolean)
            .join(" "),
          order.shipping_country,
        ].filter(Boolean)
      : null;

  const noteText =
    fulfilment?.notes || "No customer or fulfilment notes have been added.";

  const paymentLabel =
    order.payment_status === "paid"
      ? "Paid"
      : order.payment_status.charAt(0).toUpperCase() +
        order.payment_status.slice(1);

  // Fallback activities (no explicit logs yet)
  const fallbackActivities: { label: string; at: string }[] = [];
  fallbackActivities.push({
    label: "Order placed",
    at: order.created_at,
  });
  if (fulfilment?.shipped_at) {
    fallbackActivities.push({
      label: `Shipped${
        fulfilment.shipping_provider
          ? ` with ${fulfilment.shipping_provider}`
          : ""
      }`,
      at: fulfilment.shipped_at,
    });
  }
  if (fulfilment?.pickup_ready_at) {
    fallbackActivities.push({
      label: "Ready for pickup",
      at: fulfilment.pickup_ready_at,
    });
  }
  if (fulfilment?.pickup_completed_at) {
    fallbackActivities.push({
      label: "Picked up",
      at: fulfilment.pickup_completed_at,
    });
  }
  if (fulfilment?.delivered_at) {
    fallbackActivities.push({
      label: "Marked as delivered",
      at: fulfilment.delivered_at,
    });
  }

  const activityToRender =
    activityLogs.length > 0
      ? activityLogs.map((a) => ({
          label: a.description,
          at: a.created_at,
        }))
      : fallbackActivities.sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
        );

  // product-only lines (items already come from product-only API, but we guard anyway)
  const productLines = items.filter((i) => i.line_type === "product");
  const serviceLines = items.filter((i) => i.line_type === "service");

  // detect if there is any ONLINE service (won't be true with product-only API, but kept for future use)
  const hasOnlineService = serviceLines.some((line) => {
    let opts = line.options_snapshot;
    if (opts && typeof opts === "string") {
      try {
        opts = JSON.parse(opts);
      } catch {
        // ignore
      }
    }
    if (!opts || typeof opts !== "object") return false;
    const lt = (opts.location_type || opts.location || "").toString();
    return lt.toLowerCase() === "online";
  });

  const steps = timeline;
  const firstNotDoneIndex = steps.findIndex((s) => !s.done);
  const currentStepIndex =
    firstNotDoneIndex === -1 ? steps.length - 1 : firstNotDoneIndex;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Main shell */}
      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Scrollable content */}
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto max-w-6xl">
              <div className="mb-4 text-sm text-slate-500">
                <Link href="/pages/vendor/orders" className="hover:underline">
                  Back to orders
                </Link>
              </div>

              {/* Header row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Order {code}
                  </h1>
                  <p className="text-sm text-slate-500">
                    Placed {formatDateTime(order.created_at)} · {totalItems}{" "}
                    item{totalItems === 1 ? "" : "s"} ·{" "}
                    {formatCurrencyFromCents(order.total_cents)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[#7B61FF] px-3 py-1 text-xs font-medium text-white">
                    {mainStatus}
                  </span>

                  {/* status dropdown */}
                  <select
                    className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm"
                    value={order.status}
                    disabled={updatingStatus}
                    onChange={(e) =>
                      handleChangeStatus(e.target.value as OrderStatus)
                    }
                  >
                    <option value="placed">Placed</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <button
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={handleMarkFinal}
                  >
                    {saving
                      ? "Saving…"
                      : isPickup
                      ? "Mark as picked up"
                      : "Mark as delivered"}
                  </button>

                  <button className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">
                    More actions ▾
                  </button>
                </div>
              </div>

              {/* Error banner (non-fatal) */}
              {error && (
                <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Progress bar / timeline */}
              <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Fulfilment status
                  </div>

                  {/* CTA to open items modal */}
                  <button
                    type="button"
                    onClick={() => setItemsModalOpen(true)}
                    className="inline-flex items-center rounded-full bg-[#7B61FF] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#6A4BEF]"
                  >
                    View items to pack
                  </button>
                </div>

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-center justify-between">
                    {steps.map((step, idx, arr) => {
                      const isCurrent = idx === currentStepIndex;
                      const isDone = step.done && idx < currentStepIndex;

                      const circleBase =
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors";

                      const circleClass = isCurrent
                        ? "bg-black text-white"
                        : isDone
                        ? "bg-[#7B61FF] text-white"
                        : "bg-slate-200 text-slate-500";

                      const underlineClass =
                        isDone || isCurrent
                          ? "bg-[#7B61FF]"
                          : "bg-slate-200";

                      return (
                        <div
                          key={step.label}
                          className="flex flex-1 items-center"
                        >
                          <div className="flex flex-col items-center">
                            <div className={`${circleBase} ${circleClass}`}>
                              {isDone ? "✓" : idx + 1}
                            </div>
                            <div className="mt-1 text-xs font-medium text-slate-700">
                              {step.label}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {step.date}
                            </div>
                            <div
                              className={`mt-2 h-0.5 w-12 rounded-full ${underlineClass}`}
                            />
                          </div>
                          {idx < arr.length - 1 && (
                            <div className="mx-2 h-px flex-1 bg-slate-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2-column layout */}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
                {/* Left column cards */}
                <div className="space-y-5">
                  {/* Customer card */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Customer
                    </h2>
                    <p className="text-sm font-medium text-slate-900">
                      {customerName}
                    </p>
                    <p className="text-sm text-slate-500">{customerEmail}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {customerPhone}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button className="rounded-full bg-white px-4 py-2 text-xs shadow-sm">
                        Email
                      </button>
                      <button className="rounded-full bg-purple-600 px-4 py-2 text-xs font-medium text-white">
                        Call / WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Delivery & fulfilment */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Delivery & fulfilment
                      </h2>

                      {hasOnlineService && order.contact_email && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailFeedback(null);
                            setSessionLink("");
                            setEmailModalOpen(true);
                          }}
                          className="rounded-full bg-[#7B61FF] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#6A4BEF]"
                        >
                          Send online session link
                        </button>
                      )}
                    </div>

                    <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {deliveryLabel}
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      {!isPickup && (
                        <>
                          <p>
                            <span className="font-medium">
                              Expected delivery:
                            </span>{" "}
                            {fulfilment?.estimated_delivery_date
                              ? formatDate(fulfilment.estimated_delivery_date)
                              : "Not set"}
                          </p>
                          <p>
                            {fulfilment?.shipping_provider ||
                              order.shipping_provider ||
                              "Shipping provider not set"}
                          </p>
                        </>
                      )}
                      {isPickup && (
                        <>
                          <p>
                            <span className="font-medium">Pickup from:</span>{" "}
                            {order.pickup_location_name ||
                              order.pickup_address ||
                              "Pickup details not set"}
                          </p>
                          {order.pickup_reference && (
                            <p>Reference: {order.pickup_reference}</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Tracking */}
                    {!isPickup &&
                      (fulfilment?.tracking_number ||
                        fulfilment?.tracking_url ||
                        order.tracking_number) && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              Tracking
                            </p>
                            <p className="text-slate-700">
                              {fulfilment?.tracking_number ||
                                order.tracking_number}
                            </p>
                          </div>
                          {fulfilment?.tracking_url && (
                            <button
                              className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline"
                              onClick={() =>
                                window.open(fulfilment.tracking_url!, "_blank")
                              }
                            >
                              View tracking page
                            </button>
                          )}
                        </div>
                      )}

                    {/* Address */}
                    {!isPickup && shippingLines && (
                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Ship to
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {customerName}
                          <br />
                          {shippingLines.map((l, idx) => (
                            <span key={idx}>
                              {l}
                              <br />
                            </span>
                          ))}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment & totals */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Payment & totals
                    </h2>

                    <dl className="space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between">
                        <dt>Subtotal</dt>
                        <dd>{formatCurrencyFromCents(order.subtotal_cents)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{isPickup ? "Service / pickup fee" : "Shipping"}</dt>
                        <dd>{formatCurrencyFromCents(order.shipping_cents)}</dd>
                      </div>
                      {order.discount_cents > 0 && (
                        <div className="flex justify-between">
                          <dt>
                            Promo{" "}
                            {order.promo_code ? `(${order.promo_code})` : ""}
                          </dt>
                          <dd>
                            – {formatCurrencyFromCents(order.discount_cents)}
                          </dd>
                        </div>
                      )}
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
                        <dt>Total</dt>
                        <dd>{formatCurrencyFromCents(order.total_cents)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                      <p>Payment status: {paymentLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Right column cards */}
                <div className="space-y-5">
                  {/* What to pack / fulfil */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      {isPickup ? "What to prepare" : "What to pack"}
                    </h2>

                    <div className="space-y-3">
                      {productLines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {line.name_snapshot} × {line.quantity}
                              </p>
                              <p className="text-xs text-slate-500">
                                {line.options_snapshot &&
                                Object.keys(line.options_snapshot).length
                                  ? Object.entries(line.options_snapshot)
                                      .map(
                                        ([k, v]) => `${k}: ${String(v)}`
                                      )
                                      .join(" · ")
                                  : "No options"}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatCurrencyFromCents(
                                  line.unit_price_cents
                                )}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-700">
                            {lineTypeBadge(line.line_type)}
                          </span>
                        </div>
                      ))}

                      {productLines.length === 0 && (
                        <p className="text-sm text-slate-500">
                          No items found for this order.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Customer / fulfilment note */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Customer / fulfilment note
                    </h2>
                    <p className="text-sm text-slate-600">{noteText}</p>
                  </div>

                  {/* Activity */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Activity
                    </h2>
                    {activityToRender.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No activity recorded.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-xs text-slate-600">
                        {activityToRender.map((a, idx) => (
                          <li
                            key={idx}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-slate-300" />
                              <span>{a.label}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {formatDateTime(a.at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Internal notes (local only) */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Internal notes
                    </h2>
                    <p className="mb-2 text-xs text-slate-500">
                      Add private notes about this order (visible only to you
                      and your team).
                    </p>
                    <textarea
                      className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="These notes are not shown to the customer. (Wire this up to a table or column when you're ready.)"
                    />
                    <div className="mt-3 flex justify-end">
                      <button className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white">
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

      {/* Items modal */}
      {itemsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Items to pack · Order {code}
                </h2>
                <p className="text-xs text-slate-500">
                  {totalItems} item{totalItems === 1 ? "" : "s"} in this order
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemsModalOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                Close ✕
              </button>
            </div>

            {/* Modal content */}
            <div className="max-h-[64vh] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">Item</th>
                    <th className="px-6 py-3">Options</th>
                    <th className="px-6 py-3">Qty</th>
                    <th className="px-6 py-3">Unit price</th>
                    <th className="px-6 py-3">Line total</th>
                    <th className="px-6 py-3">Fulfilment</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const optionsRaw =
                      item.options_snapshot &&
                      typeof item.options_snapshot === "string"
                        ? (() => {
                            try {
                              return JSON.parse(item.options_snapshot);
                            } catch {
                              return {};
                            }
                          })()
                        : item.options_snapshot || {};

                    const optionsText =
                      optionsRaw && Object.keys(optionsRaw).length > 0
                        ? Object.entries(optionsRaw)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(" · ")
                        : "—";

                    const nextStatus: ItemFulfilmentStatus =
                      item.item_fulfilment_status === "pending"
                        ? "processing"
                        : item.item_fulfilment_status === "processing"
                        ? "packed"
                        : "pending";

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-6 py-3 text-slate-800">
                          <div className="font-medium">
                            {item.name_snapshot}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.line_type.toUpperCase()}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                          {optionsText}
                        </td>
                        <td className="px-6 py-3 text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-3 text-slate-800">
                          {formatCurrencyFromCents(item.unit_price_cents)}
                        </td>
                        <td className="px-6 py-3 text-slate-800">
                          {formatCurrencyFromCents(item.line_subtotal_cents)}
                        </td>
                        <td className="px-6 py-3">
                          <button
                            disabled={savingItemId === item.id}
                            onClick={() =>
                              updateItemStatus(item.id, nextStatus)
                            }
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              itemStatusClasses[item.item_fulfilment_status]
                            } ${
                              savingItemId === item.id
                                ? "opacity-70 cursor-wait"
                                : "cursor-pointer"
                            }`}
                            title="Click to cycle status"
                          >
                            {itemStatusLabel[item.item_fulfilment_status]}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-6 text-center text-sm text-slate-500"
                      >
                        No items found for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
              <span>
                Tip: click the status pill to move items from Pending →
                Processing → Packed.
              </span>
              <button
                type="button"
                onClick={() => setItemsModalOpen(false)}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online session email modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Send online session link
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              This email will be sent to{" "}
              <span className="font-medium">
                {order.contact_name || "your customer"}
              </span>{" "}
              at{" "}
              <span className="font-mono">{order.contact_email || "—"}</span>.
            </p>

            <label className="mb-1 block text-xs font-medium text-slate-700">
              Session / meeting link
            </label>
            <input
              className="mb-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="https://… (Zoom, Google Meet, etc)"
              value={sessionLink}
              onChange={(e) => setSessionLink(e.target.value)}
            />

            {emailFeedback && (
              <div className="mb-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {emailFeedback}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  sendingEmail ||
                  !order.contact_email ||
                  sessionLink.trim().length === 0
                }
                onClick={handleSendSessionEmail}
                className="rounded-full bg-[#7B61FF] px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                {sendingEmail ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}