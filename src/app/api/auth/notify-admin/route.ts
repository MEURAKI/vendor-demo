import { NextResponse } from "next/server";
import mailchimpTransactional from "@mailchimp/mailchimp_transactional";

const client = mailchimpTransactional(
  process.env.MAILCHIMP_TRANSACTIONAL_KEY as string
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL as string;

export async function POST(req: Request) {
  try {
    const { email, quickSignup, userId } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 }
      );
    }

    if (!process.env.MAILCHIMP_TRANSACTIONAL_KEY) {
      console.error("MAILCHIMP_TRANSACTIONAL_KEY is not set");
      return NextResponse.json(
        { error: "Mailchimp transactional not configured" },
        { status: 500 }
      );
    }

    if (!ADMIN_EMAIL) {
      console.error("ADMIN_EMAIL is not set");
      return NextResponse.json(
        { error: "Admin email not configured" },
        { status: 500 }
      );
    }

    const subject = quickSignup
      ? "New QUICK MEURAKI subscriber signup"
      : "New MEURAKI subscriber signup";

    const textLines = [
      "A new subscriber account has been created.",
      "",
      `Email: ${email}`,
      userId ? `User ID: ${userId}` : "",
      `Quick signup: ${quickSignup ? "Yes (onboarding skipped)" : "No"}`,
      "",
      `Timestamp: ${new Date().toISOString()}`,
    ].filter(Boolean);

    await client.messages.send({
      message: {
        subject,
        text: textLines.join("\n"),
        from_email: "no-reply@meuraki.com.sg", // this must be a verified sending domain in Mailchimp Transactional
        to: [
          {
            email: ADMIN_EMAIL,
            type: "to",
          },
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notify-admin error:", err);
    return NextResponse.json(
      { error: "Failed to notify admin" },
      { status: 500 }
    );
  }
}
