// src/app/api/vendor/bookings/send-session-email/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import mailchimp from "@mailchimp/mailchimp_transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SERVICE ROLE client (same pattern as send-status-email route)
function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

const mch = mailchimp(process.env.MAILCHIMP_TRANSACTIONAL_KEY!);

type SessionDescriptor = {
  label?: string;
  url: string;
};

type BookingSessionEmailPayload = {
  orderId: string;
  bookingId?: string;
  customer_email: string;
  customer_name?: string;
  // single-session shape (backwards compat)
  session_link?: string;
  session_label?: string;
  // multi-session shape
  sessions?: SessionDescriptor[];
};

function buildOrderCode(id: string): string {
  return `#${id.split("-")[0].toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingSessionEmailPayload;

    const {
      orderId,
      customer_email,
      customer_name,
      session_link,
      session_label,
      sessions,
    } = body || {};

    if (!orderId || !customer_email) {
      return NextResponse.json(
        { error: "orderId and customer_email are required" },
        { status: 400 }
      );
    }

    const supa = supaAdmin();

    // 1) Fetch order for validation + nicer email copy
    const { data: order, error: orderError } = await supa
      .from("orders")
      .select("id, contact_name, created_at")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order not found", orderError);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderCode = buildOrderCode(order.id);
    const name = customer_name || order.contact_name || "there";

    // 2) Normalise sessions list
    let finalSessions: SessionDescriptor[] = [];

    if (sessions && sessions.length > 0) {
      finalSessions = sessions
        .filter((s) => s.url && s.url.trim().length > 0)
        .map((s) => ({
          url: s.url.trim(),
          label: s.label?.trim(),
        }));
    } else if (session_link && session_link.trim().length > 0) {
      // backwards compat: single link
      finalSessions = [
        {
          url: session_link.trim(),
          label: session_label?.trim() || "Session link",
        },
      ];
    }

    if (finalSessions.length === 0) {
      return NextResponse.json(
        { error: "At least one session link is required" },
        { status: 400 }
      );
    }

    // 3) Build HTML listing all sessions
    const sessionsHtml = finalSessions
      .map((s, idx) => {
        const label = s.label || `Session ${idx + 1}`;
        const safeUrl = s.url;
        return `
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#111827;">
              ${label}
            </td>
            <td style="padding:8px 0;font-size:14px;text-align:right;">
              <a href="${safeUrl}" style="color:#4F46E5;text-decoration:none;">
                Join session
              </a>
            </td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#F9FAFB;">
        <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:24px;border:1px solid #E5E7EB;">
          <h1 style="font-size:18px;margin:0 0 8px;color:#111827;">
            Your MEURAKI session details
          </h1>
          <p style="margin:0 0 16px;font-size:14px;color:#4B5563;">
            Hi ${name}, here are the links for your upcoming session(s) for order
            <strong>${orderCode}</strong>.
          </p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tbody>
              ${sessionsHtml}
            </tbody>
          </table>

          <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">
            If you have any questions or need to reschedule, please reach out to your practitioner.
          </p>
        </div>
      </div>
    `;

    const subject =
      finalSessions.length === 1
        ? `Your MEURAKI session link for ${orderCode}`
        : `Your MEURAKI session links for ${orderCode}`;

    // 4) Send via Mandrill (Mailchimp Transactional)
    await mch.messages.send({
      message: {
        from_email: "no-reply@meuraki.com.sg",
        from_name: "MEURAKI",
        to: [
          {
            email: customer_email,
            type: "to",
          },
        ],
        subject,
        html,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("send-session-email error", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}