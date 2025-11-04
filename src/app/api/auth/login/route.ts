// server file — do NOT add "use client"
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password, rememberMe } = await req.json();

    // TODO: validate & authenticate user here
    console.log("Login attempt:", { email, rememberMe });

    // Example success payload
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
