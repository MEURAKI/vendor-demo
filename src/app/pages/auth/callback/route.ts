import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    const err = url.searchParams.get("error_description") ?? "Missing code";
    return NextResponse.redirect(new URL(`/pages/auth/login?error=${encodeURIComponent(err)}`, url.origin));
  }

  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.exchangeCodeForSession(code); // writes cookies in the expected encoding

  return NextResponse.redirect(new URL("/pages/dashboard", url.origin));
}
