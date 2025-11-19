// src/app/api/auth/send-reset/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import mailchimp from "@mailchimp/mailchimp_transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "") || "https://vendor.meuraki.com.sg";

// ✅ server client with SERVICE ROLE (needed for admin.generateLink)
function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // <-- service key
  return createClient(url, key);
}

const mch = mailchimp(process.env.MAILCHIMP_TRANSACTIONAL_KEY!);

export async function POST(req: Request) {
  try {
    const { email, userName } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // 1) Ask Supabase to generate a recovery link that carries the tokens
    const redirectTo = `${SITE}/pages/auth/reset-password`; // <-- correct route
    const { data, error } = await supaAdmin().auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // data.properties.action_link contains the full URL with the token(s)
    const resetUrl =
      (data as any).properties?.action_link ?? (data as any).action_link;


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

    // 3) Send via Mandrill (Mailchimp Transactional)
    await mch.messages.send({
      message: {
        from_email: "no-reply@meuraki.com.sg", // must be from your authenticated domain
        from_name: "MEURAKI",
        to: [{ email, type: "to" }],
        subject: "Reset your MEURAKI password",
        html,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}