import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ ok: false, message: "Valid email required" }, { status: 400 });
    }

    const API_KEY = process.env.MAILCHIMP_API_KEY!;
    const LIST_ID = process.env.MAILCHIMP_LIST_ID!;
    const DC = process.env.MAILCHIMP_SERVER_PREFIX!;
    if (!API_KEY || !LIST_ID || !DC) {
      return NextResponse.json({ ok: false, message: "Mailchimp not configured" }, { status: 500 });
    }

    const url = `https://${DC}.api.mailchimp.com/3.0/lists/${LIST_ID}/members`;
    const body = {
      email_address: email.toLowerCase(),
      status_if_new: "subscribed",
      status: "subscribed",
      marketing_permissions: [],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`anystring:${API_KEY}`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });

    // Mailchimp returns 200/201/400 depending on existing state; treat already-subscribed as ok
    const json = await res.json().catch(() => ({}));
    if (res.status === 200 || res.status === 201 || (res.status === 400 && json?.title === "Member Exists")) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, message: json?.detail || "Mailchimp error" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Error" }, { status: 500 });
  }
}