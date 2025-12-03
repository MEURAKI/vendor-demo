// src/app/api/auth/send-reset/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import mailchimp from "@mailchimp/mailchimp_transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fallback site (used only if we can't detect the origin)
 */
const RAW_SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://vendor.meuraki.com.sg";

const FALLBACK_SITE = RAW_SITE.replace(/\/$/, "");

/**
 * Path to the reset page on each portal.
 * Change this if your route is different.
 */
const RESET_PATH = "/pages/auth/reset-password";

/**
 * Supabase admin client (SERVICE ROLE)
 */
function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service role key
  return createClient(url, key);
}

/**
 * Mailchimp Transactional (Mandrill) client
 */
const mch = mailchimp(process.env.MAILCHIMP_TRANSACTIONAL_KEY!);

export async function POST(req: Request) {
  try {
    const { email, userName } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    /**
     * Determine which portal called this API.
     * Example origins:
     *  - https://subscriber.meuraki.com.sg
     *  - https://vendor.meuraki.com.sg
     *  - http://localhost:3000
     */
    const origin = req.headers.get("origin") || FALLBACK_SITE;

    let portalBase: string;
    try {
      const url = new URL(origin);
      portalBase = `${url.protocol}//${url.host}`;
    } catch {
      portalBase = origin.replace(/\/$/, "");
    }

    // 👇 This is the crucial part: we append RESET_PATH
    const redirectTo = `${portalBase}${RESET_PATH}`;

    console.log("Using redirectTo:", redirectTo);

    // 1) Ask Supabase to generate a recovery link
    const { data, error } = await supaAdmin().auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error("generateLink error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const resetUrl =
      (data as any)?.properties?.action_link ?? (data as any)?.action_link;

    console.log("Generated reset URL:", resetUrl);

    if (!resetUrl) {
      return NextResponse.json(
        { error: "Could not obtain recovery link." },
        { status: 500 }
      );
    }

    // 2) Load & fill the HTML template
    const filePath = path.join(process.cwd(), "emails", "reset.html");
    let html = await fs.readFile(filePath, "utf8");

    html = html
      .replace(/{{\s*resetUrl\s*}}/g, resetUrl)
      .replace(/{{\s*userName\s*}}/g, userName || "there");

    // 3) Send via Mailchimp Transactional (Mandrill)
    await mch.messages.send({
      message: {
        from_email: "no-reply@meuraki.com.sg",
        from_name: "MEURAKI",
        to: [{ email, type: "to" }],
        subject: "Reset your MEURAKI password",
        html,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("send-reset error:", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
