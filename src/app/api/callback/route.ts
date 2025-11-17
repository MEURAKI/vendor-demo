// src/app/pages/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    const err = url.searchParams.get("error_description") ?? "Missing authorization code";
    return NextResponse.redirect(new URL(`/pages/auth/login?error=${encodeURIComponent(err)}`, url.origin));
  }

  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.exchangeCodeForSession(code); // sets sb-* cookies

  // After login, middleware will route based on status
  return NextResponse.redirect(new URL("/pages/dashboard", url.origin));
}
