// app/api/services/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  // Include relation to service_location_settings
  let query = supabase
    .from("services")
    .select(
      `
      id,
      name,
      status,
      cover_image_url,
      service_types,
      location_types,
      service_location_settings (
        id,
        location_type,
        sku,
        max_participants,
        price_cents,
        discount_type,
        discount_value,
        discount_cap
      )
    `
    )
    .eq("vendor_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Normalize services + nested location settings
  const services = (data ?? []).map((p: any) => {
    // --- cover_image_url -> imageUrl ---
    let imageUrl: string | null = null;
    const raw = p.cover_image_url;

    if (raw) {
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          imageUrl = parsed.image_url ?? parsed.url ?? null;
        } catch {
          imageUrl = raw; // plain URL
        }
      } else if (typeof raw === "object") {
        imageUrl = raw.image_url ?? raw.url ?? null;
      }
    }

    // --- service_location_settings -> locations[] ---
    const locations = (p.service_location_settings ?? []).map((s: any) => ({
      id: s.id,
      locationType: s.location_type,
      sku: s.sku,
      maxParticipants: s.max_participants,
      priceCents: s.price_cents,
      discount: {
        type: s.discount_type,
        value: s.discount_value,
        cap: s.discount_cap,
      },
    }));

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      type: "Service",
      serviceTypes: p.service_types ?? [],
      locationTypes: p.location_types ?? [],
      imageUrl,
      locations, // <-- pricing/discount/max participants per location
    };
  });

  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // ----- unpack payload -----
  const {
    sku,
    name,
    description,
    status,
    serviceTypes,
    locationTypes,
    wellnessDimensions,
    categories,
    tags,
    coverImageUrl,
    images, // string[]
    descriptionTabs,
    providerIds,
    spaceIds,
    locationSettings, // array (see type below)
  } = body;

  const cover = coverImageUrl || images?.[0] || null;

  const { data: inserted, error } = await supabase
    .from("services")
    .insert({
      vendor_id: auth.user.id,
      sku,
      name,
      description,
      status,
      service_types: serviceTypes ?? [],
      location_types: locationTypes ?? [],
      wellness_dimensions: wellnessDimensions ?? [],
      categories: categories ?? [],
      tags: tags ?? [],
      cover_image_url: cover,
      total_images: images?.length ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const serviceId = inserted.id;

  // description tabs
  if (descriptionTabs?.length) {
    const rows = descriptionTabs.map((t: any, idx: number) => ({
      service_id: serviceId,
      title: t.title,
      body: t.body,
      position: idx,
    }));
    await supabase.from("service_description_tabs").insert(rows);
  }

  // images
  if (images?.length) {
    const rows = images.map((url: string, idx: number) => ({
      service_id: serviceId,
      image_url: url,
      position: idx,
      is_cover: idx === 0,
    }));
    await supabase.from("service_images").insert(rows);
  }

  // providers
  if (providerIds?.length) {
    await supabase
      .from("service_providers")
      .insert(providerIds.map((pid: string) => ({ service_id: serviceId, provider_id: pid })));
  }


  // wellness
if (Array.isArray(wellnessDimensions) && wellnessDimensions.length) {
  await supabase.from("service_wellness_dimensions").insert(
    wellnessDimensions.map((id: string | number) => ({
      service_id: serviceId,
      dimension_id: id,
    }))
  );
}

// categories (free text)
if (Array.isArray(categories) && categories.length) {
  await supabase.from("service_categories").insert(
    categories.map((cat: string) => ({
      service_id: serviceId,
      category: cat,
    }))
  );
}

// tags (free text)
if (Array.isArray(tags) && tags.length) {
  await supabase.from("service_tags").insert(
    tags.map((tag: string) => ({
      service_id: serviceId,
      tag,
    }))
  );
}

// spaces
if (Array.isArray(spaceIds) && spaceIds.length) {
  await supabase
    .from("service_spaces")
    .insert(spaceIds.map((sid: string) => ({ service_id: serviceId, space_id: sid })));
  }

  // per-location settings
  if (locationSettings?.length) {
    for (const loc of locationSettings) {
      const { data: locRow, error: locErr } = await supabase
        .from("service_location_settings")
        .insert({
          service_id: serviceId,
          location_type: loc.locationType,
          sku: loc.sku,
          max_participants: loc.maxParticipants,
          price_cents: Math.round((loc.price ?? 0) * 100),
          discount_type: loc.discountType,
          discount_value: loc.discountValue ?? null,
          discount_cap: loc.discountCap ?? null,
          has_fixed_schedule: loc.hasFixedSchedule,
          expiry_type: loc.expiryType,
          expiry_duration_unit: loc.expiryDurationUnit ?? null,
          expiry_duration_value: loc.expiryDurationValue ?? null,
        })
        .select("id")
        .single();

      if (locErr) {
        console.error(locErr);
        continue;
      }

      const locId = locRow.id;

      // time slots
      if (loc.timeSlots?.length) {
        await supabase.from("service_time_slots").insert(
          loc.timeSlots.map((slot: any) => ({
            service_id: serviceId,
            location_settings_id: locId,
            start_at: slot.start,
            end_at: slot.end,
          }))
        );
      }

      // session packages
      if (loc.sessionOptions?.length) {
        await supabase.from("service_session_packages").insert(
          loc.sessionOptions.map((pkg: any, idx: number) => ({
            service_id: serviceId,
            location_settings_id: locId,
            label: pkg.label,
            sessions_count: pkg.sessionsCount,
            price_cents: Math.round((pkg.price ?? 0) * 100),
            position: idx,
          }))
        );
      }
    }
  }

  return NextResponse.json({ id: serviceId });
}