// app/api/quests/[id]/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function supaWithAuth(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const token = req.headers.get("authorization") || "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token,
      },
    },
  });
}

/**
 * POST /api/quests/[id]/submit
 * Submit quest for approval
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = supaWithAuth(req);

  // 1) Auth check
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2) Verify quest belongs to user and is in eligible status
  const { data: quest, error } = await client
    .from("quests")
    .select("id, vendor_id, status")
    .eq("id", id)
    .eq("vendor_id", user.id)
    .single();

  if (error || !quest) {
    return NextResponse.json(
      { error: "Quest not found" },
      { status: 404 }
    );
  }

  const submittableStatuses = ["draft", "revision_requested", "rejected"];
  if (!submittableStatuses.includes(quest.status)) {
    return NextResponse.json(
      { error: "Quest must be in draft, rejected, or revision_requested status to submit" },
      { status: 400 }
    );
  }

  // 3) Update status to pending_approval
  const serviceClient = supa();

  const { error: updateErr } = await serviceClient
    .from("quests")
    .update({
      status: "pending_approval",
      requires_approval: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
