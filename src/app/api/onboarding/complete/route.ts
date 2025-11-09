// src/app/api/onboarding/complete/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json(); // whatever your form sends

  // Save onboarding payload
  await supabase
    .from("onboarding")
    .upsert({
      user_id: user.id,
      step: 99, // mark final
      data: payload,
      completed_at: new Date().toISOString()
    });

  // Flip flags to unlock dashboard
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true, status: "active" })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
