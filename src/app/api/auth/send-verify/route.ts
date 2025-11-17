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
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const redirectTo = `${SITE}/pages/auth/callback`;
    
    const { data, error } = await supaAdmin().auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

    if (error) {
      console.error("generateLink error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const verifyUrl = (data as any)?.properties?.action_link;
    if (!verifyUrl) {
      console.error("No action_link in generateLink response:", data);
      return NextResponse.json({ error: "No action link returned" }, { status: 500 });
    }

    const filePath = path.join(process.cwd(), "emails", "verify.html");
    let html = await fs.readFile(filePath, "utf8");
    html = html
      .replace(/{{\s*verifyUrl\s*}}/g, verifyUrl)
      .replace(/{{\s*userName\s*}}/g, userName || "there");

    const resp = await mch.messages.send({
      message: {
        from_email: "no-reply@meuraki.com.sg",
        from_name: "MEURAKI",
        to: [{ email, type: "to" }],
        subject: "Confirm your MEURAKI email",
        html,
        track_opens: true,
        track_clicks: false, // avoid hash-breaking click wrapping
      },
    });

    // Optional debug:
    console.log("Mandrill send response:", resp);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("send-verify route error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}