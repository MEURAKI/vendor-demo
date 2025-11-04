// server file — no "use client"
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/analytics
 * Example analytics endpoint returning dummy data.
 * Replace with your real analytics query.
 */
export async function GET() {
  // TODO: Replace this with a call to your database / service
  const analytics = {
    users: 248,
    sales: 176,
    conversionRate: 4.5,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, analytics });
}

/**
 * Optionally, add POST if you need to trigger analytics refresh.
 */
export async function POST(req: Request) {
  try {
    const { range } = await req.json();
    // Example stub for refresh logic
    console.log("Refreshing analytics for range:", range);
    return NextResponse.json({ ok: true, message: "Analytics refreshed" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
