// server file — no "use client"
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * POST /api/auth/refresh
 * Reads a `refresh_token` cookie, verifies/rotates it (stubbed here),
 * and issues a new short-lived `access_token` cookie.
 */
export async function POST() {
  const jar = cookies();
  const refresh = jar.get("refresh_token")?.value;

  if (!refresh) {
    return NextResponse.json({ ok: false, error: "Missing refresh token" }, { status: 401 });
  }

  // TODO: verify/rotate the refresh token (check DB, JWT, etc.)
  // If valid, mint a new access token (stub value for now):
  const newAccessToken = "stub.access.token"; // replace with real token

  const res = NextResponse.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      // short-lived access token
      `access_token=${newAccessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 15}`,
      // optional: rotate refresh token here too (example below commented)
      // `refresh_token=new.refresh.token; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    ].join(", ")
  );
  return res;
}

/**
 * Optional: allow GET for convenience (e.g., debugging)
 */
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
