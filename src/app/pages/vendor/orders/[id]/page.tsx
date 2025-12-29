// app/pages/vendor/orders/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type OrderStatus = "placed" | "fulfilled" | "shipped" | "delivered" | "cancelled";

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

  // internal notes column on orders
  internal_note?: string | null;
  vendor_promo_product_discount_cents?: number | null;
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

// timeline builder
function buildTimeline(order: Order, fulfilment: OrderFulfilment | null): TimelineStep[] {
  const isPickup = order.fulfilment_method === "pickup";

  const steps: TimelineStep[] = [];

  // 1. Placed: always done
  steps.push({
    label: "Placed",
    date: formatDateTime(order.created_at),
    done: true,
  });

  // 2. Fulfilled
  const fulfilledDone = ["fulfilled", "shipped", "delivered"].includes(order.status);
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
      !!fulfilment?.shipped_at || order.status === "shipped" || order.status === "delivered";

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
        ? formatDateTime(fulfilment.delivered_at || fulfilment.pickup_completed_at!)
        : finalDone
          ? formatDateTime(order.updated_at)
          : eta || "—",
    done: finalDone,
  });

  return steps;
}

function safeParseOptions(optionsSnapshot: any): any {
  let opts: any = optionsSnapshot || {};
  if (opts && typeof opts === "string") {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = {};
    }
  }
  return opts && typeof opts === "object" ? opts : {};
}

function formatOptionsText(optionsSnapshot: any): { optionsText: string; customSku?: string } {
  const optionsRaw = safeParseOptions(optionsSnapshot);

  const customSku =
    optionsRaw?.custom_sku || optionsRaw?.customSku || optionsRaw?.CustomSKU || "";

  const optionsText =
    optionsRaw && Object.keys(optionsRaw).length
      ? Object.entries(optionsRaw)
          .filter(([k]) => !["selectedOptions", "selectedOptionsDisplay", "bundleItemsSummary"].includes(k))
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(" · ")
      : "No options";

  return { optionsText, customSku: customSku || undefined };
}

function extractBundleContents(optionsSnapshot: any): string[] {
  const opts = safeParseOptions(optionsSnapshot);

  // Prefer the clean summary list if present
  const summary = opts?.bundleItemsSummary;
  if (Array.isArray(summary) && summary.length) {
    return summary.map((x: any) => x?.productName).filter(Boolean);
  }

  // Fall back to selectedOptionsDisplay
  const sod = opts?.selectedOptionsDisplay;
  if (sod && typeof sod === "object") {
    const lines: string[] = [];

    for (const key of Object.keys(sod)) {
      const item = sod[key];
      const itemName = item?.itemName;
      const slots = item?.slots;

      if (itemName && slots && typeof slots === "object") {
        for (const slotKey of Object.keys(slots)) {
          const groups = slots[slotKey]?.groups;

          if (groups && typeof groups === "object") {
            const parts = Object.values(groups)
              .map((g: any) => g?.valueLabel)
              .filter(Boolean);

            lines.push(parts.length ? `${itemName} — ${parts.join(", ")}` : itemName);
          } else {
            lines.push(itemName);
          }
        }
      } else if (itemName) {
        lines.push(itemName);
      }
    }

    if (lines.length) return lines;
  }

  return [];
}

// Fire-and-forget call to your Mandrill-backed API
async function sendStatusEmail(orderId: string, status: OrderStatus | "picked_up") {
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

function normalisePhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
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

  // internal notes
  const [internalNote, setInternalNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // more actions dropdown
  const [actionsOpen, setActionsOpen] = useState(false);

  // email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sessionLink, setSessionLink] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // shipment edit fields
  const [shippingProviderInput, setShippingProviderInput] = useState("");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");
  const [trackingUrlInput, setTrackingUrlInput] = useState("");
  const [etaInput, setEtaInput] = useState<string>("");
  const [savingShipment, setSavingShipment] = useState(false);
  const [editingShipment, setEditingShipment] = useState(false);

  // ref for "What to pack" scrolling
  const whatToPackRef = useRef<HTMLDivElement | null>(null);

  // =============== AUTO-FULFILL HELPERS (NEW) ===============
  function allProductItemsPacked(nextItems: OrderItem[]) {
    const productLines = nextItems.filter((i) => i.line_type === "product");
    if (productLines.length === 0) return false; // don't auto-fulfill if no product items
    return productLines.every((i) => i.item_fulfilment_status === "packed");
  }

  async function autoFulfillIfReady(nextItems: OrderItem[]) {
    if (!order) return;
    if (order.status === "delivered" || order.status === "cancelled") return;

    // only auto-fulfill from "placed" → "fulfilled" (don't override shipped etc)
    if (order.status !== "placed") return;

    if (!allProductItemsPacked(nextItems)) return;

    const nowIso = new Date().toISOString();

    // Update orders.status
    const { data: updatedOrder, error: orderErr } = await supabase
      .from("orders")
      .update({ status: "fulfilled", updated_at: nowIso })
      .eq("id", order.id)
      .select("*")
      .maybeSingle();

    if (orderErr || !updatedOrder) {
      setError("Failed to auto-update order to fulfilled.");
      return;
    }

    setOrder(updatedOrder as Order);

    // Log activity
    const { data: activityInsert, error: activityErr } = await supabase
      .from("order_activities")
      .insert({
        order_id: order.id,
        vendor_id: order.vendor_id,
        type: "fulfilled",
        description: "Auto-fulfilled (all items packed)",
        meta: { auto: true },
      })
      .select("*")
      .single();

    if (!activityErr && activityInsert) {
      setActivityLogs((prev) => [activityInsert as OrderActivity, ...prev]);
    }

    // Send fulfilled email (optional but usually desired)
    await sendStatusEmail(order.id, "fulfilled");
  }
  // =========================================================

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
      setInternalNote(typedOrder.internal_note ?? "");

      // Load product-only items via API
      const itemsRes = await fetch(`/api/vendor/orders/${orderId}/product-items`, {
        credentials: "include",
      });

      if (!itemsRes.ok) {
        setError("Failed to load order items.");
        setLoading(false);
        return;
      }

      const itemsJson = (await itemsRes.json()) as { items: OrderItem[] };
      setItems(itemsJson.items || []);

      // Load shipment row from order_shipments
      const { data: fulfilmentData, error: fulfilmentError } = await supabase
        .from("order_shipments")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (!fulfilmentError && fulfilmentData) {
        const f = fulfilmentData as OrderFulfilment;
        setFulfilment(f);
        setShippingProviderInput(f.shipping_provider ?? "");
        setTrackingNumberInput(f.tracking_number ?? "");
        setTrackingUrlInput(f.tracking_url ?? "");
        setEtaInput(f.estimated_delivery_date ?? "");
      } else {
        // fall back to values on order if no shipment row yet
        setShippingProviderInput(typedOrder.shipping_provider ?? "");
        setTrackingNumberInput(typedOrder.tracking_number ?? "");
        setTrackingUrlInput("");
        setEtaInput("");
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

  async function handleSaveShipment() {
    if (!order || order.status === "delivered") return; // no edits when delivered
    setSavingShipment(true);
    setError(null);

    const nowIso = new Date().toISOString();

    try {
      let updatedRow: OrderFulfilment | null = null;

      if (fulfilment) {
        const { data, error } = await supabase
          .from("order_shipments")
          .update({
            shipping_provider: shippingProviderInput || null,
            tracking_number: trackingNumberInput || null,
            tracking_url: trackingUrlInput || null,
            estimated_delivery_date: etaInput || null,
            updated_at: nowIso,
          })
          .eq("id", fulfilment.id)
          .select("*")
          .maybeSingle();

        if (error) {
          setError("Failed to save shipping details.");
        } else if (data) {
          updatedRow = data as OrderFulfilment;
        }
      } else {
        const { data, error } = await supabase
          .from("order_shipments")
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            fulfilment_method: order.fulfilment_method,
            status: "pending",
            shipping_provider: shippingProviderInput || null,
            tracking_number: trackingNumberInput || null,
            tracking_url: trackingUrlInput || null,
            estimated_delivery_date: etaInput || null,
          })
          .select("*")
          .single();

        if (error) {
          setError("Failed to save shipping details.");
        } else if (data) {
          updatedRow = data as OrderFulfilment;
        }
      }

      if (updatedRow) {
        setFulfilment(updatedRow);
        // also mirror provider / tracking onto order (for legacy uses)
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                shipping_provider: shippingProviderInput || null,
                tracking_number: trackingNumberInput || null,
              }
            : prev
        );
      }
    } finally {
      setSavingShipment(false);
    }
  }

  // single black button behaviour
  async function handleToggleShipmentEdit() {
    if (!order || order.status === "delivered") return;

    if (editingShipment) {
      // finishing → save
      await handleSaveShipment();
      setEditingShipment(false);
    } else {
      setEditingShipment(true);
    }
  }

  async function handleMarkFinal() {
    if (!order || order.status === "delivered") return;
    setSaving(true);
    setError(null);

    const isPickup = order.fulfilment_method === "pickup";

    // cannot mark final if any product line isn't packed
    const hasUnpacked = items.some(
      (i) => i.line_type === "product" && i.item_fulfilment_status !== "packed"
    );

    if (hasUnpacked) {
      setError(
        "You still have items that are not packed. Please mark all items as packed before marking the order as delivered / picked up."
      );
      setSaving(false);
      return;
    }

    const nowIso = new Date().toISOString();

    try {
      // ensure latest shipping details are in DB before email
      await handleSaveShipment();

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

      const updatedOrder = updatedOrderData as Order;
      setOrder(updatedOrder);

      // Update shipment if exists
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

        const { data: updatedFulfilmentData, error: fulfilmentUpdateError } = await supabase
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
      const description = isPickup ? "Marked as picked up" : "Marked as delivered";

      const { data: activityInsert, error: activityInsertError } = await supabase
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
        setActivityLogs((prev) => [activityInsert as OrderActivity, ...prev]);
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
    if (!order || order.status === "delivered" || newStatus === order.status) return;

    // If they chose "delivered", reuse the dedicated flow so shipment & activity stay consistent
    if (newStatus === "delivered") {
      await handleMarkFinal();
      return;
    }

    setUpdatingStatus(true);
    setError(null);

    const nowIso = new Date().toISOString();

    try {
      // keep shipment up to date before email fires
      await handleSaveShipment();

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

      const { data: activityInsert, error: activityInsertError } = await supabase
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
        setActivityLogs((prev) => [activityInsert as OrderActivity, ...prev]);
      }

      // Send status email for relevant states
      if (["fulfilled", "shipped", "cancelled"].includes(newStatus)) {
        await sendStatusEmail(order.id, newStatus);
      }
    } finally {
      setUpdatingStatus(false);
    }
  }

  // =============== ITEM STATUS UPDATE (AUTO-FULFILL ADDED) ===============
  async function updateItemStatus(itemId: string, newStatus: ItemFulfilmentStatus) {
    if (!order || order.status === "delivered") return;
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

      // Build next items array deterministically
      const nextItems = items.map((item) =>
        item.id === itemId ? { ...item, item_fulfilment_status: newStatus } : item
      );

      setItems(nextItems);

      const description = `Updated item status to "${newStatus}"`;

      const { data: activityInsert, error: activityInsertError } = await supabase
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
        setActivityLogs((prev) => [activityInsert as OrderActivity, ...prev]);
      }

      // ✅ NEW: auto-fulfill if all product items are packed
      await autoFulfillIfReady(nextItems);
    } finally {
      setSavingItemId(null);
    }
  }
  // =====================================================================

  async function bulkUpdateAllItems(newStatus: ItemFulfilmentStatus) {
    if (!items.length || order?.status === "delivered") return;
    for (const item of items) {
      await updateItemStatus(item.id, newStatus);
    }
  }

  // Send online session link email via Supabase Edge Function
  async function handleSendSessionEmail() {
    if (!order || !order.contact_email || !sessionLink.trim()) return;
    setSendingEmail(true);
    setError(null);
    setEmailFeedback(null);

    try {
      const { error: fnError } = await supabase.functions.invoke("send-session-link-email", {
        body: {
          order_id: order.id,
          customer_email: order.contact_email,
          customer_name: order.contact_name,
          session_link: sessionLink.trim(),
        },
      });

      if (fnError) {
        setError("Failed to send session email.");
        setSendingEmail(false);
        return;
      }

      setEmailFeedback(`Session link sent to ${order.contact_email}.`);

      // Log activity
      const { data: activityInsert, error: activityInsertError } = await supabase
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
        setActivityLogs((prev) => [activityInsert as OrderActivity, ...prev]);
      }
    } finally {
      setSendingEmail(false);
    }
  }

  function handleEmailButton() {
    if (!order?.contact_email) return;
    const code = buildOrderCode(order.id);
    const subject = encodeURIComponent(`Your order ${code}`);
    const body = encodeURIComponent("Hi,\n\nHere's an update on your order.\n\n");
    window.location.href = `mailto:${order.contact_email}?subject=${subject}&body=${body}`;
  }

  function handleCallWhatsappButton() {
    if (!order?.contact_phone) return;
    const phoneNorm = normalisePhone(order.contact_phone);
    const waPhone = phoneNorm.replace(/^\+/, "");
    const url = `https://wa.me/${waPhone}`;
    window.open(url, "_blank");
  }

  // save internal note
  async function handleSaveInternalNote() {
    if (!order) return;
    setSavingNote(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from("orders")
        .update({ internal_note: internalNote || null })
        .eq("id", order.id)
        .select("*")
        .maybeSingle();

      if (updateError || !data) {
        setError("Failed to save internal note.");
        setSavingNote(false);
        return;
      }

      setOrder(data as Order);
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        <ClipLoader color="#7B61FF" size={50} />
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
    order.shipping_address_line1 || order.shipping_city || order.shipping_postal_code
      ? [
          order.shipping_address_line1,
          order.shipping_address_line2,
          [order.shipping_city, order.shipping_postal_code].filter(Boolean).join(" "),
          order.shipping_country,
        ].filter(Boolean)
      : null;

  const noteText = fulfilment?.notes || "No customer or fulfilment notes have been added.";

  const paymentLabel =
    order.payment_status === "paid"
      ? "Paid"
      : order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1);

  const isDelivered = order.status === "delivered";

  // Fallback activities (no explicit logs yet)
  const fallbackActivities: { label: string; at: string }[] = [];
  fallbackActivities.push({
    label: "Order placed",
    at: order.created_at,
  });
  if (fulfilment?.shipped_at) {
    fallbackActivities.push({
      label: `Shipped${fulfilment.shipping_provider ? ` with ${fulfilment.shipping_provider}` : ""}`,
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
      : fallbackActivities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const packLines = items.filter((i) => i.line_type === "product" || i.line_type === "bundle");
const productLines = items.filter((i) => i.line_type === "product"); // keep for auto-fulfill logic + other usage
const serviceLines = items.filter((i) => i.line_type === "service");

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
  const currentStepIndex = firstNotDoneIndex === -1 ? steps.length - 1 : firstNotDoneIndex;

  // single thick progress bar behind the steps
  const progressPercent = steps.length > 1 ? (currentStepIndex / (steps.length - 1)) * 100 : 0;

  // status select color
  const statusBgClass =
    order.status === "delivered"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : order.status === "shipped"
        ? "bg-indigo-100 text-indigo-800 border-indigo-300"
        : order.status === "fulfilled"
          ? "bg-violet-100 text-violet-800 border-violet-300"
          : order.status === "cancelled"
            ? "bg-rose-100 text-rose-700 border-rose-300"
            : "bg-slate-100 text-slate-700 border-slate-300";

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
                  <h1 className="text-2xl font-semibold text-slate-900">Order {code}</h1>
                  <p className="text-sm text-slate-500">
                    Placed {formatDateTime(order.created_at)} · {totalItems} item
                    {totalItems === 1 ? "" : "s"} · {formatCurrencyFromCents(order.total_cents)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </span>
                    <select
                      className={`rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm ${statusBgClass}`}
                      value={order.status}
                      disabled={updatingStatus || isDelivered}
                      onChange={(e) => handleChangeStatus(e.target.value as OrderStatus)}
                    >
                      <option value="placed">Placed</option>
                      <option value="fulfilled">Fulfilled</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <span className="text-[11px] text-slate-400">
                      Current: <span className="font-medium text-slate-700">{mainStatus}</span>
                    </span>
                    {isDelivered && (
                      <span className="text-[11px] text-slate-400">
                        This order is delivered and can no longer be updated.
                      </span>
                    )}
                  </div>

                  <button
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={saving || isDelivered}
                    onClick={handleMarkFinal}
                  >
                    {saving ? "Saving…" : isPickup ? "Mark as picked up" : "Mark as delivered"}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setActionsOpen((v) => !v)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                      type="button"
                    >
                      More actions ▾
                    </button>
                    {actionsOpen && (
                      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs text-slate-700 shadow-xl">
                        <button
                          className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                          type="button"
                          onClick={() => {
                            setActionsOpen(false);
                            setItemsModalOpen(true);
                          }}
                        >
                          Open items modal
                        </button>
                        <button
                          className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                          type="button"
                          onClick={async () => {
                            setActionsOpen(false);
                            await bulkUpdateAllItems("packed");
                          }}
                        >
                          Mark all items as packed
                        </button>
                      </div>
                    )}
                  </div>
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
                </div>

                <div className="relative mt-2 flex flex-1 items-center justify-between">
                  {/* background track */}
                  <div className="absolute left-4 right-4 top-4 h-2 rounded-full bg-slate-200" />
                  {/* progress */}
                  <div
                    className="absolute left-4 top-4 h-2 rounded-full bg-[#7B61FF] transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />

                  {/* steps */}
                  {steps.map((step, idx) => {
                    const isCurrent = idx === currentStepIndex;
                    const isDone = idx < currentStepIndex;

                    const circleBase =
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors";

                    const circleClass = isCurrent
                      ? "bg-black text-white"
                      : isDone
                        ? "bg-[#7B61FF] text-white"
                        : "bg-slate-200 text-slate-500";

                    return (
                      <div key={step.label} className="relative z-10 flex flex-1 flex-col items-center">
                        <div className={`${circleBase} ${circleClass}`}>{isDone ? "✓" : idx + 1}</div>
                        <div className="mt-1 text-xs font-medium text-slate-700">{step.label}</div>
                        <div className="text-[11px] text-slate-400">{step.date}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2-column layout */}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
                {/* Left column cards */}
                <div className="space-y-5">
                  {/* Customer card */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">Customer</h2>
                    <p className="text-sm font-medium text-slate-900">{customerName}</p>
                    <p className="text-sm text-slate-500">{customerEmail}</p>
                    <p className="mt-1 text-sm text-slate-500">{customerPhone}</p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleEmailButton}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7B61FF] to-[#B54CFF] px-5 py-2 text-xs font-medium text-white shadow-sm hover:opacity-90"
                      >
                        <span>✉</span>
                        <span>Email</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCallWhatsappButton}
                        className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-black"
                      >
                        <span>📞</span>
                        <span>Call / WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery & fulfilment */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-900">Delivery &amp; fulfilment</h2>

                      <div className="flex items-center gap-2">
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

                        {/* SINGLE black button now */}
                        <button
                          type="button"
                          disabled={isDelivered || savingShipment}
                          onClick={handleToggleShipmentEdit}
                          className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
                        >
                          {editingShipment ? "Done editing" : "Edit details"}
                        </button>
                      </div>
                    </div>

                    <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {deliveryLabel}
                    </p>

                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                      {!isPickup && (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Shipping provider
                            </p>
                            <input
                              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                              placeholder="Eg. Ninja Van"
                              value={shippingProviderInput}
                              onChange={(e) => setShippingProviderInput(e.target.value)}
                              disabled={!editingShipment || isDelivered}
                            />
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Tracking number
                              </p>
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                                value={trackingNumberInput}
                                onChange={(e) => setTrackingNumberInput(e.target.value)}
                                disabled={!editingShipment || isDelivered}
                              />
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Tracking link
                              </p>
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                                placeholder="https://tracking…"
                                value={trackingUrlInput}
                                onChange={(e) => setTrackingUrlInput(e.target.value)}
                                disabled={!editingShipment || isDelivered}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Expected delivery date
                            </p>
                            <input
                              type="date"
                              className="w-full max-w-xs rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                              value={etaInput ?? ""}
                              onChange={(e) => setEtaInput(e.target.value)}
                              disabled={!editingShipment || isDelivered}
                            />
                          </div>
                        </>
                      )}

                      {isPickup && (
                        <>
                          <p>
                            <span className="font-medium">Pickup from:</span>{" "}
                            {order.pickup_location_name || order.pickup_address || "Pickup details not set"}
                          </p>
                          {order.pickup_reference && <p>Reference: {order.pickup_reference}</p>}
                        </>
                      )}
                    </div>

                    {/* Tracking quick view */}
                    {!isPickup && (trackingNumberInput || trackingUrlInput) && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Tracking preview</p>
                          <p className="text-slate-700">{trackingNumberInput}</p>
                        </div>
                        {trackingUrlInput && (
                          <button
                            className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline"
                            onClick={() => window.open(trackingUrlInput, "_blank")}
                          >
                            Open tracking page
                          </button>
                        )}
                      </div>
                    )}

                    {/* Address */}
                    {!isPickup && shippingLines && (
                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Ship to</p>
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
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">Payment &amp; totals</h2>

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
                          <dt>Promo {order.vendor_promo_product_discount_cents ? `(${order.vendor_promo_product_discount_cents})` : ""}</dt>
                          <dd>– {formatCurrencyFromCents(order.vendor_promo_product_discount_cents || 0)}</dd>
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
                  <div
                    ref={whatToPackRef}
                    className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                          {isPickup ? "What to prepare" : "What to pack"}
                        </h2>
                       <p className="mt-1 text.[11px] text-slate-500">
  {packLines.length} item{packLines.length === 1 ? "" : "s"} in this order
</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setItemsModalOpen(true)}
                        className="inline-flex items-center rounded-full bg-[#7B61FF] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#6A4BEF]"
                      >
                        View items to pack
                      </button>
                    </div>

                   <div className="space-y-3">
  {packLines.map((line) => {
    const isPacked = line.item_fulfilment_status === "packed";

    const optionsRaw = safeParseOptions(line.options_snapshot);

    const subtitle = (line as any).subtitle_snapshot as string | null | undefined;
    const { optionsText, customSku } = formatOptionsText(optionsRaw);

    const sku = line.sku_snapshot || "No SKU";

    const bundleContents =
      line.line_type === "bundle" ? extractBundleContents(optionsRaw) : [];

    return (
      <div
        key={line.id}
        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 transition-colors hover:border-slate-200 hover:bg-slate-50/80"
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#7B61FF] focus:ring-[#7B61FF]"
            checked={isPacked}
            disabled={isDelivered || savingItemId === line.id}
            onChange={(e) => {
              const next: ItemFulfilmentStatus = e.target.checked ? "packed" : "pending";
              updateItemStatus(line.id, next);
            }}
          />

          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {line.name_snapshot} × {line.quantity}
            </p>

            {line.line_type === "bundle" ? (
              <div className="text-xs text-slate-600">
                <div className="text-xs text-slate-500">Bundle includes:</div>

                {bundleContents.length ? (
                  <ul className="mt-1 list-disc pl-5">
                    {bundleContents.map((x, idx) => (
                      <li key={idx}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-slate-500">Bundle items not available.</div>
                )}

                {subtitle && <div className="mt-1 text-slate-500">{subtitle}</div>}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{subtitle || optionsText}</p>
            )}

            <p className="text-xs text-slate-500">
              SKU: {sku}
              {customSku && <> · Custom SKU: {customSku}</>}
            </p>

            <p className="text-xs font-medium text-slate-400">
              {formatCurrencyFromCents(line.unit_price_cents)}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center rounded-full bg-slate-900/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {lineTypeBadge(line.line_type)}
        </span>
      </div>
    );
  })}

  {packLines.length === 0 && (
    <p className="rounded-2xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
      No items found for this order.
    </p>
  )}
</div>
                  </div>

                  {/* Customer / fulfilment note */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <h2 className="mb-2 text-sm font-semibold text-slate-900">Customer / fulfilment note</h2>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{noteText}</p>
                  </div>

                  {/* Activity */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
                    {activityToRender.length === 0 ? (
                      <p className="text-xs text-slate-500">No activity recorded.</p>
                    ) : (
                      <ul className="space-y-2 text-xs text-slate-600">
                        {activityToRender.map((a, idx) => (
                          <li
                            key={idx}
                            className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                              <span>{a.label}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">{formatDateTime(a.at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Internal notes */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <h2 className="mb-2 text-sm font-semibold text-slate-900">Internal notes</h2>
                    <p className="mb-2 text-xs text-slate-500">
                      Add private notes about this order (visible only to you and your team).
                    </p>
                    <textarea
                      className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="These notes are not shown to the customer."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveInternalNote}
                        disabled={savingNote}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                      >
                        {savingNote ? "Saving…" : "Save note"}
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
                <h2 className="text-sm font-semibold text-slate-900">Items to pack · Order {code}</h2>
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
                      item.options_snapshot && typeof item.options_snapshot === "string"
                        ? (() => {
                            try {
                              return JSON.parse(item.options_snapshot);
                            } catch {
                              return {};
                            }
                          })()
                        : item.options_snapshot || {};

                        const bundleContents = item.line_type === "bundle" ? extractBundleContents(optionsRaw) : [];


                    const optionsText =
  item.line_type === "bundle"
    ? (bundleContents.length
        ? `Bundle includes: ${bundleContents.join(" · ")}`
        : "Bundle items not available.")
    : (optionsRaw && Object.keys(optionsRaw).length > 0
        ? Object.entries(optionsRaw)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(" · ")
        : "—");

                    return (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-6 py-3 text-slate-800">
                          <div className="font-medium">{item.name_snapshot}</div>
                          <div className="text-xs text-slate-400">{item.line_type.toUpperCase()}</div>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{optionsText}</td>
                        <td className="px-6 py-3 text-slate-800">{item.quantity}</td>
                        <td className="px-6 py-3 text-slate-800">{formatCurrencyFromCents(item.unit_price_cents)}</td>
                        <td className="px-6 py-3 text-slate-800">{formatCurrencyFromCents(item.line_subtotal_cents)}</td>
                        <td className="px-6 py-3">
                          <select
                            disabled={savingItemId === item.id || isDelivered}
                            value={item.item_fulfilment_status}
                            onChange={(e) => updateItemStatus(item.id, e.target.value as ItemFulfilmentStatus)}
                            className={`rounded-full px-3 py-1 text-xs font-medium border border-slate-200 ${
                              itemStatusClasses[item.item_fulfilment_status]
                            } disabled:opacity-60`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="packed">Packed</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}

                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-center text-sm text-slate-500">
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
                Choose fulfilment status per line, or use “Mark all items as packed” from More actions.
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
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Send online session link</h2>
            <p className="mb-3 text-xs text-slate-500">
              This email will be sent to{" "}
              <span className="font-medium">{order.contact_name || "your customer"}</span> at{" "}
              <span className="font-mono">{order.contact_email || "—"}</span>.
            </p>

            <label className="mb-1 block text-xs font-medium text-slate-700">Session / meeting link</label>
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
                disabled={sendingEmail || !order.contact_email || sessionLink.trim().length === 0}
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