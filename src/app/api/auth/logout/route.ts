// server file — no "use client"
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Support both POST (button/form) and GET (link) if you like:
export async function POST() {
  const jar = cookies();
  // delete whatever you set when logging in
  jar.delete("session");       // or "token", "auth", etc.
  // If you used a cookie with options (path, domain), match them when deleting
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const jar = cookies();
  jar.delete("session");
  return NextResponse.json({ ok: true });
}
