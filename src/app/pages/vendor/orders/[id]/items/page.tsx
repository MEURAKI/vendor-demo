"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../../lib/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type Order = {
  id: string;
  vendor_id: string;
  contact_name: string | null;
  created_at: string;
  total_cents: number;
};

type OrderItemLineType = "product" | "bundle" | "service";

type ItemFulfilmentStatus = "pending" | "processing" | "packed";

type OrderItem = {
  id: string;
  order_id: string;
  line_type: OrderItemLineType;
  name_snapshot: string;
  options_snapshot: any;
  quantity: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  item_fulfilment_status: ItemFulfilmentStatus;
};

const statusLabel: Record<ItemFulfilmentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  packed: "Packed",
};

const statusClasses: Record<ItemFulfilmentStatus, string> = {
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

function formatDateOnly(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OrderItemsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load profile + order + items
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

      // Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // Order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id,vendor_id,contact_name,created_at,total_cents")
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

      // Items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id,order_id,line_type,name_snapshot,options_snapshot,quantity,unit_price_cents,line_subtotal_cents,item_fulfilment_status"
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (itemsError) {
        setError("Failed to load order items.");
        setLoading(false);
        return;
      }

      setItems((itemsData as any as OrderItem[]) || []);
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

  async function updateItemStatus(
    itemId: string,
    newStatus: ItemFulfilmentStatus
  ) {
    setSavingId(itemId);
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
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509] text-slate-100">
        Loading items…
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

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const orderCode = buildOrderCode(order.id);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Main shell */}
      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto max-w-6xl">
              <div className="mb-4 text-sm text-slate-500">
                <Link
                  href={`/pages/vendor/orders/${order.id}`}
                  className="hover:underline"
                >
                  ← Back to order {orderCode}
                </Link>
              </div>

              {/* Header */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    Items for Order {orderCode}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {order.contact_name || "Unknown customer"} · Placed{" "}
                    {formatDateOnly(order.created_at)} ·{" "}
                    {totalItems} item{totalItems === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="text-right text-slate-500">
                    <div className="text-xs uppercase tracking-wide">
                      Total
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrencyFromCents(order.total_cents)}
                    </div>
                  </div>
                  <button className="rounded-full bg-white px-4 py-2 text-xs shadow-sm">
                    Print packing slip
                  </button>
                </div>
              </div>

              {/* Error banner (non-fatal) */}
              {error && (
                <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Items table */}
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 text-xs text-slate-500">
                  <span>
                    All items in this order · Manage variants, quantities &
                    fulfilment in one place.
                  </span>
                  <span>
                    {totalItems} item{totalItems === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="overflow-x-auto">
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
                        // options_snapshot might be JSON or JSON string
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
                          optionsRaw &&
                          Object.keys(optionsRaw).length > 0
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
                              {formatCurrencyFromCents(
                                item.unit_price_cents
                              )}
                            </td>
                            <td className="px-6 py-3 text-slate-800">
                              {formatCurrencyFromCents(
                                item.line_subtotal_cents
                              )}
                            </td>
                            <td className="px-6 py-3">
                              <button
                                disabled={savingId === item.id}
                                onClick={() =>
                                  updateItemStatus(item.id, nextStatus)
                                }
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                                  statusClasses[item.item_fulfilment_status]
                                } ${
                                  savingId === item.id
                                    ? "opacity-70 cursor-wait"
                                    : "cursor-pointer"
                                }`}
                                title="Click to cycle status"
                              >
                                {statusLabel[item.item_fulfilment_status]}
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
              </div>
              {/* end table wrapper */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}