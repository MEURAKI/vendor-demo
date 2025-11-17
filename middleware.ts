// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  // Public routes (tweak as needed)
  const publicPaths = new Set([
    "/",
    "/pages/auth/login",
    "/pages/auth/register",
    "/pages/auth/callback",
    "/pages/auth/verify-email",
    "/pages/auth/pending"
  ]);
  if (publicPaths.has(path)) return res;

  // Require auth
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/pages/auth/login";
    return NextResponse.redirect(url);
  }

  // Fetch status + onboarding flag
  const { data: profile } = await supabase
    .from("profiles")
    .select("status, onboarding_completed, email_verified")
    .eq("id", user.id)
    .single();
  
    console.log("Middleware profile:", profile);

  if (!profile) return res;

  // Pending → show holding page
  if (profile.email_verified === false && path !== "/pages/auth/pending") {
    const url = req.nextUrl.clone();
    url.pathname = "/pages/auth/pending";
    return NextResponse.redirect(url);
  }

  // Approved but not finished onboarding → force onboarding
  if (profile.email_verified === true && !path.startsWith("/onboarding")) {
    const url = req.nextUrl.clone();
    url.pathname = "/pages/onboarding/start";
    return NextResponse.redirect(url);
  }

  // Active users should not see onboarding
  if (profile.status === "active" && path.startsWith("/onboarding")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|images|favicon.ico|api/public).*)"],
};
