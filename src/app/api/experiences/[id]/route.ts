import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAuthedVendor(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

// GET /api/experiences/:id -> fetch full experience with children
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  const user = await requireAuthedVendor(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("experiences")
    .select(
      `
      *,
      experience_dates (*),
      experience_tickets (*),
      experience_noh_policies (*)
    `
    )
    .eq("id", params.id)
    .single();

  if (error) return jsonError(error.message, 404);
  return NextResponse.json({ experience: data });
}

// PATCH /api/experiences/:id
// - updates experience fields
// - if dates provided => replaces all dates
// - if tickets provided => replaces all tickets
// - if noh_policy provided => upsert policy
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  const user = await requireAuthedVendor(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const {
    experience, // main fields
    dates,      // optional array => replace
    tickets,    // optional array => replace
    noh_policy, // optional object => upsert
  } = payload ?? {};

  // 1) update main experience fields (only provided keys)
  if (experience && typeof experience === "object") {
    const { error: upErr } = await supabase
      .from("experiences")
      .update({
        ...experience,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (upErr) return jsonError(upErr.message, 400);
  }

  // 2) replace dates if provided
  if (Array.isArray(dates)) {
    const { error: delErr } = await supabase
      .from("experience_dates")
      .delete()
      .eq("experience_id", params.id);

    if (delErr) return jsonError(delErr.message, 400);

    if (dates.length > 0) {
      const rows = dates.map((d: any) => ({
        experience_id: params.id,
        session_date: d.session_date,
        start_time: d.start_time,
        end_time: d.end_time,
        timezone: d.timezone,
        doors_open_time: d.doors_open_time ?? null,
        capacity: d.capacity ?? 0,
        cutoff_hours: d.cutoff_hours ?? 0,
        status: d.status ?? "draft",
      }));

      const { error: insErr } = await supabase.from("experience_dates").insert(rows);
      if (insErr) return jsonError(insErr.message, 400);
    }
  }

  // 3) replace tickets if provided
  if (Array.isArray(tickets)) {
    const { error: delTErr } = await supabase
      .from("experience_tickets")
      .delete()
      .eq("experience_id", params.id);

    if (delTErr) return jsonError(delTErr.message, 400);

    if (tickets.length > 0) {
      const rows = tickets.map((t: any) => ({
        experience_id: params.id,
        experience_date_id: t.experience_date_id ?? null,
        name: t.name,
        price: t.price ?? 0,
        max_per_user: t.max_per_user ?? 4,
        min_per_order: t.min_per_order ?? null,
        sales_start: t.sales_start ?? null,
        sales_end: t.sales_end ?? null,
        allow_xp: !!t.allow_xp,
        allow_corporate: !!t.allow_corporate,
        allow_promocodes: !!t.allow_promocodes,
      }));

      const { error: insErr } = await supabase.from("experience_tickets").insert(rows);
      if (insErr) return jsonError(insErr.message, 400);
    }
  }

  // 4) upsert NOH if provided
  if (noh_policy && typeof noh_policy === "object") {
    const { error: nohErr } = await supabase.from("experience_noh_policies").upsert(
      {
        experience_id: params.id,
        ...noh_policy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "experience_id" }
    );

    if (nohErr) return jsonError(nohErr.message, 400);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/experiences/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  const user = await requireAuthedVendor(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { error } = await supabase.from("experiences").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 400);

  // children cascade automatically
  return NextResponse.json({ ok: true });
}