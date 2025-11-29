// src/app/api/vendor/orders/send-status-email/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import mailchimp from "@mailchimp/mailchimp_transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "") ||
  "https://vendor.meuraki.com.sg";

// SERVICE ROLE client (same pattern as reset route)
function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

const mch = mailchimp(process.env.MAILCHIMP_TRANSACTIONAL_KEY!);

type OrderStatusEmailPayload = {
  orderId: string;
  status: "placed" | "fulfilled" | "shipped" | "delivered" | "cancelled" | "picked_up";
};

function formatCents(cents: number) {
  return `SGD ${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
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

function buildOrderCode(id: string): string {
  return `#${id.split("-")[0].toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OrderStatusEmailPayload;

    const { orderId, status } = body || {};
    if (!orderId || !status) {
      return NextResponse.json(
        { error: "orderId and status are required" },
        { status: 400 }
      );
    }

    const supa = supaAdmin();

    // 1) Fetch order
    const { data: order, error: orderError } = await supa
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order not found", orderError);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.contact_email) {
      // nothing to send – not an error
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 2) Fetch *product* order items only
    const { data: items, error: itemsError } = await supa
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .eq("line_type", "product")
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("Items error", itemsError);
    }

    // 3) Load HTML template
    const filePath = path.join(process.cwd(), "emails", "order-status.html");
    let html = await fs.readFile(filePath, "utf8");

    const code = buildOrderCode(order.id);
    const customerName = order.contact_name || "there";
    const placedOn = formatDateTime(order.created_at);

    // Derive a friendly status title / subtitle like your design
    let statusTitle = "Your order has been updated!";
    let subtitle =
      "Here’s the latest update on your MEURAKI wellness order.";

    if (status === "delivered" || status === "picked_up") {
      statusTitle = "Your order has been delivered!";
      subtitle =
        "Thank you for letting us be part of your wellness path.";
    } else if (status === "shipped") {
      statusTitle = "Your order is on the way!";
      subtitle =
        "We’ll let you know once it’s safely delivered to your doorstep.";
    } else if (status === "fulfilled") {
      statusTitle = "Your order has been fulfilled!";
      subtitle =
        "We’re preparing it for dispatch and will update you when it ships.";
    } else if (status === "cancelled") {
      statusTitle = "Your order has been cancelled.";
      subtitle =
        "If this wasn’t expected, please reach out to our team so we can help.";
    }

    // Compute a "delivered on" date for email (fallback: updated_at or created_at)
    const deliveredOn =
      order.delivered_at || order.updated_at || order.created_at;

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
        : [];
    const shippingAddressHtml = shippingLines.length
      ? shippingLines.join("<br/>")
      : "Address not available";

    const itemsRows =
      (items && items.length > 0
        ? items
            .map(
              (it: any) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
          <div style="font-size:13px;color:#111827;font-weight:500;">
            ${it.name_snapshot}
          </div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;text-align:center;font-size:13px;color:#111827;">
          x&nbsp;${it.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-size:13px;color:#111827;">
          ${formatCents(it.unit_price_cents)}
        </td>
      </tr>`
            )
            .join("")
        : `<tr>
        <td colspan="3" style="padding:12px 0;font-size:13px;color:#6B7280;">
          No items found for this order.
        </td>
      </tr>`) || "";

    const promoRow =
      order.discount_cents && order.discount_cents > 0
        ? `
      <tr>
        <td style="padding:4px 0;color:#8B5CF6;font-size:13px;">
          Promo Code${order.promo_code ? ` (${order.promo_code})` : ""}
        </td>
        <td></td>
        <td style="padding:4px 0;color:#8B5CF6;font-size:13px;text-align:right;">
          - ${formatCents(order.discount_cents)}
        </td>
      </tr>`
        : "";

    // Replace template variables
    html = html
      .replace(/{{\s*userName\s*}}/g, customerName)
      .replace(/{{\s*orderCode\s*}}/g, code)
      .replace(/{{\s*statusTitle\s*}}/g, statusTitle)
      .replace(/{{\s*subtitle\s*}}/g, subtitle)
      .replace(/{{\s*deliveredDate\s*}}/g, formatDate(deliveredOn))
      .replace(/{{\s*placedDateTime\s*}}/g, placedOn)
      .replace(/{{\s*shippingAddress\s*}}/g, shippingAddressHtml)
      .replace(/{{\s*subtotal\s*}}/g, formatCents(order.subtotal_cents))
      .replace(/{{\s*shipping\s*}}/g, formatCents(order.shipping_cents))
      .replace(/{{\s*total\s*}}/g, formatCents(order.total_cents))
      .replace(/{{\s*paymentStatus\s*}}/g, order.payment_status || "—")
      .replace(/{{\s*itemsRows\s*}}/g, itemsRows)
      .replace(/{{\s*promoRow\s*}}/g, promoRow);

    // 4) Send via Mandrill
    const subject =
      status === "delivered" || status === "picked_up"
        ? "Your MEURAKI order has been delivered"
        : status === "shipped"
        ? "Your MEURAKI order is on the way"
        : `Update on your MEURAKI order ${code}`;

    await mch.messages.send({
      message: {
        from_email: "no-reply@meuraki.com.sg",
        from_name: "MEURAKI",
        to: [
          {
            email: order.contact_email as string,
            type: "to",
          },
        ],
        subject,
        html,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("send-status-email error", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}