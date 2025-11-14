// src/app/api/auth/send-verify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import mailchimp from "@mailchimp/mailchimp_transactional";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "");

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

const mch = mailchimp(process.env.MAILCHIMP_TRANSACTIONAL_KEY!);

export async function POST(req: Request) {
  try {
    const { email, userName } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const redirectTo = `${SITE}/pages/auth/verify-email`;

    // ✅ TS requires password for 'signup'. Provide a throwaway value.
    const { data, error } = await supaAdmin().auth.admin.generateLink({
      type: "signup",
      email,
      password: crypto.randomUUID(), // dummy; ignored if user already exists
      options: { redirectTo },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const verifyUrl = data.properties?.action_link ?? data.properties.action_link;
    if (!verifyUrl) return NextResponse.json({ error: "No action link returned" }, { status: 500 });

    const filePath = path.join(process.cwd(), "emails", "verify.html");
    let html = await fs.readFile(filePath, "utf8");
    html = html
      .replace(/{{\s*verifyUrl\s*}}/g, verifyUrl)
      .replace(/{{\s*userName\s*}}/g, userName || "there");

    await mch.messages.send({
      message: {
        from_email: "no-reply@meuraki.com.sg",
        from_name: "MEURAKI",
        to: [{ email, type: "to" }],
        subject: "Confirm your MEURAKI email",
        html,
        // Mandrill flags (avoid click-wrapping so the URL hash survives)
        track_opens: true,
        track_clicks: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}