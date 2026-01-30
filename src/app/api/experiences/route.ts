import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

type ExperienceStatus = "draft" | "published" | "cancelled";
type DateStatus = "draft" | "published" | "sold_out" | "cancelled";

type CreateExperiencePayload = {
  // A) basics
  title: string;
  short_description?: string | null;
  full_description?: string | null;
  categories?: string[];
  tags?: string[];
  cover_image_url?: string | null;
  gallery_images?: string[];
  location_type?: "online" | "in_person";
  address?: string | null;
  map_link?: string | null;
  host_name?: string | null;
  host_profile?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  refund_policy?: string | null;
  status?: ExperienceStatus;

  // B) dates
  dates?: Array<{
    // preferred format (matches SQL schema)
    session_date: string; // YYYY-MM-DD
    start_time: string; // HH:mm or HH:mm:ss
    end_time: string; // HH:mm or HH:mm:ss
    timezone: string;
    doors_open_time?: string | null; // HH:mm
    capacity?: number;
    cutoff_hours?: number;
    status?: DateStatus;

    // optional alternate format if your UI sends iso times:
    starts_at?: string; // ISO
    ends_at?: string; // ISO
  }>;

  // C) tickets
  tickets?: Array<{
    name: string;
    price: number;
    max_per_user?: number;
    min_per_order?: number | null;
    sales_start?: string | null; // ISO
    sales_end?: string | null; // ISO
    allow_xp?: boolean;
    allow_corporate?: boolean;
    allow_promocodes?: boolean;

    // nullable => global ticket
    experience_date_id?: string | null;
  }>;

  // NOH
  noh_policy?: {
    no_show_grace_minutes?: number;
    no_show_penalty_type?: "none" | "partial" | "full";
    no_show_penalty_value?: number | null;
    allow_late_entry?: boolean;
    late_entry_grace_minutes?: number | null;
    auto_mark_no_show?: boolean;
    lock_entry_after_minutes?: number | null;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toTimeHHMM(value?: string | null) {
  if (!value) return null;
  // Accept HH:mm or HH:mm:ss — keep HH:mm:ss if provided
  const v = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v;
  return null;
}

function isoToDateTimeParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return {
    session_date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}:${ss}`,
  };
}

async function requireAuthedVendor(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

// GET /api/experiences  -> list vendor experiences (basic)
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const user = await requireAuthedVendor(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("experiences")
    .select(
      `
      id,
      vendor_id,
      title,
      short_description,
      status,
      cover_image_url,
      created_at,
      updated_at,
      experience_dates ( id, session_date, start_time, end_time, status )
    `
    )
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ experiences: data ?? [] });
}

// POST /api/experiences -> create experience + optional dates/tickets/noh
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const user = await requireAuthedVendor(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  let payload: CreateExperiencePayload;
  try {
    payload = (await request.json()) as CreateExperiencePayload;
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!payload.title || payload.title.trim().length === 0) {
    return jsonError("title is required");
  }

  // 1) Create main experience row
  const { data: exp, error: expErr } = await supabase
    .from("experiences")
    .insert({
      vendor_id: user.id,
      title: payload.title.trim(),
      short_description: payload.short_description ?? null,
      full_description: payload.full_description ?? null,
      categories: payload.categories ?? [],
      tags: payload.tags ?? [],
      cover_image_url: payload.cover_image_url ?? null,
      gallery_images: payload.gallery_images ?? [],
      location_type: payload.location_type ?? "in_person",
      address: payload.address ?? null,
      map_link: payload.map_link ?? null,
      host_name: payload.host_name ?? null,
      host_profile: payload.host_profile ?? null,
      contact_email: payload.contact_email ?? null,
      contact_phone: payload.contact_phone ?? null,
      refund_policy: payload.refund_policy ?? null,
      status: payload.status ?? "draft",
    })
    .select("*")
    .single();

  if (expErr) return jsonError(expErr.message, 400);

  // 2) Insert dates (if any)
  if (Array.isArray(payload.dates) && payload.dates.length > 0) {
    const dateRows = payload.dates
      .map((d) => {
        // allow ISO fallback
        let session_date = d.session_date;
        let start_time = toTimeHHMM(d.start_time);
        let end_time = toTimeHHMM(d.end_time);

        if ((!session_date || !start_time || !end_time) && d.starts_at && d.ends_at) {
          const s = isoToDateTimeParts(d.starts_at);
          const e = isoToDateTimeParts(d.ends_at);
          if (s && e) {
            session_date = session_date || s.session_date;
            start_time = start_time || s.time;
            end_time = end_time || e.time;
          }
        }

        if (!session_date || !start_time || !end_time || !d.timezone) return null;

        return {
          experience_id: exp.id,
          session_date,
          start_time,
          end_time,
          timezone: d.timezone,
          doors_open_time: toTimeHHMM(d.doors_open_time ?? null),
          capacity: typeof d.capacity === "number" ? d.capacity : 0,
          cutoff_hours: typeof d.cutoff_hours === "number" ? d.cutoff_hours : 0,
          status: d.status ?? "draft",
        };
      })
      .filter(Boolean) as any[];

    if (dateRows.length > 0) {
      const { error: dErr } = await supabase.from("experience_dates").insert(dateRows);
      if (dErr) return jsonError(dErr.message, 400);
    }
  }

  // 3) Insert tickets (if any)
  if (Array.isArray(payload.tickets) && payload.tickets.length > 0) {
    const ticketRows = payload.tickets.map((t) => ({
      experience_id: exp.id,
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

    const { error: tErr } = await supabase.from("experience_tickets").insert(ticketRows);
    if (tErr) return jsonError(tErr.message, 400);
  }

  // 4) Upsert NOH policy (optional)
  if (payload.noh_policy) {
    const p = payload.noh_policy;
    const { error: nohErr } = await supabase.from("experience_noh_policies").upsert(
      {
        experience_id: exp.id,
        no_show_grace_minutes: p.no_show_grace_minutes ?? 0,
        no_show_penalty_type: p.no_show_penalty_type ?? "none",
        no_show_penalty_value: p.no_show_penalty_value ?? null,
        allow_late_entry: p.allow_late_entry ?? false,
        late_entry_grace_minutes: p.late_entry_grace_minutes ?? 0,
        auto_mark_no_show: p.auto_mark_no_show ?? true,
        lock_entry_after_minutes: p.lock_entry_after_minutes ?? null,
      },
      { onConflict: "experience_id" }
    );

    if (nohErr) return jsonError(nohErr.message, 400);
  }

  return NextResponse.json({ experience: exp }, { status: 201 });
}