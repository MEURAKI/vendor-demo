// server file — no "use client"
import { NextResponse } from "next/server";

/**
 * POST /api/auth/register
 * Create a new user. Replace the TODOs with your own persistence/validation.
 */
export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    // Very light validation (swap for zod/yup if you like)
    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // TODO: check if user exists, hash password, save to DB
    // const user = await db.users.create({ email, passwordHash, name });

    return NextResponse.json({ ok: true /*, userId: user.id */ }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

// Optional: make non-POST calls explicit
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
