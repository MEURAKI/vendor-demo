// app/api/services/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) main service row
  const { data: srv, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id)
    .maybeSingle();

  if (error || !srv) {
    return NextResponse.json(
      { error: error?.message || "Not found" },
      { status: 404 }
    );
  }

  // 2) children in parallel
  const [
    { data: tabs },
    { data: imgs },
    { data: locs },
    { data: providers },
    { data: spaces },
  ] = await Promise.all([
    supabase
      .from("service_description_tabs")
      .select("*")
      .eq("service_id", params.id)
      .order("position", { ascending: true }),
    supabase
      .from("service_images")
      .select("*")
      .eq("service_id", params.id)
      .order("position", { ascending: true }),
    supabase
      .from("service_location_settings")
      .select("*")
      .eq("service_id", params.id),
    supabase
      .from("service_providers")
      .select("provider_id")
      .eq("service_id", params.id),
    supabase
      .from("service_spaces")
      .select("space_id")
      .eq("service_id", params.id),
  ]);

  // 3) attach time slots & session packages per location
  const locationsWithChildren: any[] = [];
  for (const loc of locs ?? []) {
    const [{ data: slots }, { data: pkgs }] = await Promise.all([
      supabase
        .from("service_time_slots")
        .select("*")
        .eq("location_settings_id", loc.id),
      supabase
        .from("service_session_packages")
        .select("*")
        .eq("location_settings_id", loc.id)
        .order("position", { ascending: true }),
    ]);

    locationsWithChildren.push({
      ...loc,
      timeSlots: slots ?? [],
      sessionOptions: pkgs ?? [],
    });
  }

  // 4) Normalise into LoadedService shape expected by EditServicePage

  const descriptionTabs = (tabs ?? []).map((t: any, idx: number) => ({
    title: t.title,
    body: t.body,
    position: t.position ?? idx,
  }));

  // IMPORTANT: return just URLs, not full image objects
  const imageUrls: string[] = (imgs ?? []).map((img: any) => img.image_url);

  const locationSettings = (locationsWithChildren ?? []).map((loc: any) => ({
    locationType: loc.location_type,
    sku: loc.sku ?? "",
    maxParticipants: loc.max_participants ?? undefined,
    price:
      typeof loc.price_cents === "number"
        ? loc.price_cents / 100
        : undefined,
    discountType: loc.discount_type,
    discountValue: loc.discount_value ?? undefined,
    discountCap: loc.discount_cap ?? undefined,
    hasFixedSchedule: !!loc.has_fixed_schedule,
    expiryType: loc.expiry_type ?? "anytime",
    expiryDurationUnit: loc.expiry_duration_unit ?? undefined,
    expiryDurationValue: loc.expiry_duration_value ?? undefined,
    
    // ✅ Return full timeSlots with pricing & discounts
    timeSlots: (loc.timeSlots ?? []).map((s: any) => ({
      start: s.start_at,
      end: s.end_at,
      price: typeof s.price_cents === "number" ? s.price_cents / 100 : undefined,
      discountType: s.discount_type ?? null,
      discountValue: s.discount_value ?? undefined,
      discountCap: s.discount_cap ?? undefined,
    })),
    
    sessionOptions: (loc.sessionOptions ?? []).map((pkg: any, idx: number) => ({
      label: pkg.label,
      sessionsCount: pkg.sessions_count ?? idx + 1,
      price:
        typeof pkg.price_cents === "number"
          ? pkg.price_cents / 100
          : 0,
    })),
    
    // ✅ Return recurringRules from JSON column
    recurringRules: loc.recurring_rules ?? [],
  }));

  // 5) Flatten service row + children to match LoadedService
  return NextResponse.json({
    id: srv.id,
    sku: srv.sku,
    name: srv.name,
    description: srv.description ?? "",
    status: srv.status,
    serviceTypes: srv.service_types ?? [],
    locationTypes: srv.location_types ?? [],
    wellnessDimensions: srv.wellness_dimensions ?? [],
    categories: srv.categories ?? [],
    tags: srv.tags ?? [],
    coverImageUrl: srv.cover_image_url ?? null,
    images: imageUrls,
    descriptionTabs,
    providerIds: (providers ?? []).map((p: any) => p.provider_id),
    spaceIds: (spaces ?? []).map((s: any) => s.space_id),
    locationSettings,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
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
    images,
    descriptionTabs,
    providerIds,
    spaceIds,
    locationSettings,
  } = body;

  const cover = coverImageUrl || images?.[0] || null;

  const { error } = await supabase
    .from("services")
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id);

  if (error) {
    console.error("Error updating service:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // wipe and re-insert child tables (simpler)
  await Promise.all([
    supabase.from("service_description_tabs").delete().eq("service_id", params.id),
    supabase.from("service_images").delete().eq("service_id", params.id),
    supabase.from("service_providers").delete().eq("service_id", params.id),
    supabase.from("service_spaces").delete().eq("service_id", params.id),
    supabase.from("service_time_slots").delete().eq("service_id", params.id),
    supabase.from("service_session_packages").delete().eq("service_id", params.id),
    supabase.from("service_location_settings").delete().eq("service_id", params.id),
  ]);

  if (descriptionTabs?.length) {
    const { error: tabsError } = await supabase.from("service_description_tabs").insert(
      descriptionTabs.map((t: any, idx: number) => ({
        service_id: params.id,
        title: t.title,
        body: t.body,
        position: idx,
      }))
    );
    if (tabsError) console.error("Error inserting description tabs:", tabsError);
  }

  if (images?.length) {
    const { error: imgsError } = await supabase.from("service_images").insert(
      images.map((url: string, idx: number) => ({
        service_id: params.id,
        image_url: url,
        position: idx,
        is_cover: idx === 0,
      }))
    );
    if (imgsError) console.error("Error inserting images:", imgsError);
  }

  if (providerIds?.length) {
    const { error: providersError } = await supabase
      .from("service_providers")
      .insert(
        providerIds.map((pid: string) => ({
          service_id: params.id,
          provider_id: pid,
        }))
      );
    if (providersError) console.error("Error inserting providers:", providersError);
  }

  if (spaceIds?.length) {
    const { error: spacesError } = await supabase
      .from("service_spaces")
      .insert(
        spaceIds.map((sid: string) => ({
          service_id: params.id,
          space_id: sid,
        }))
      );
    if (spacesError) console.error("Error inserting spaces:", spacesError);
  }

  if (locationSettings?.length) {
    for (const loc of locationSettings) {
      console.log("Processing location:", loc.locationType, loc);
      
      // ✅ Save recurringRules to JSON column
      const { data: locRow, error: locErr } = await supabase
        .from("service_location_settings")
        .insert({
          service_id: params.id,
          location_type: loc.locationType,
          sku: loc.sku,
          max_participants: loc.maxParticipants ?? null,
          price_cents: loc.price != null ? Math.round(loc.price * 100) : null,
          discount_type: loc.discountType ?? null,
          discount_value: loc.discountValue ?? null,
          discount_cap: loc.discountCap ?? null,
          has_fixed_schedule: loc.hasFixedSchedule,
          expiry_type: loc.expiryType,
          expiry_duration_unit: loc.expiryDurationUnit ?? null,
          expiry_duration_value: loc.expiryDurationValue ?? null,
          recurring_rules: loc.recurringRules ?? [], // ✅ Save as JSON
        })
        .select("id")
        .single();

      if (locErr) {
        console.error("Error inserting location settings:", locErr);
        continue;
      }

      const locId = locRow.id;

      // ✅ Save timeSlots with pricing & discounts
      if (loc.timeSlots?.length) {
        const { error: slotsError } = await supabase.from("service_time_slots").insert(
          loc.timeSlots.map((slot: any) => ({
            service_id: params.id,
            location_settings_id: locId,
            start_at: slot.start,
            end_at: slot.end,
            price_cents: slot.price != null ? Math.round(slot.price * 100) : null,
            discount_type: slot.discountType ?? null,
            discount_value: slot.discountValue ?? null,
            discount_cap: slot.discountCap ?? null,
          }))
        );
       
      }

      // ✅ FIXED: Ensure price_cents is never null for session packages
      if (loc.sessionOptions?.length) {
        const packagesToInsert = loc.sessionOptions.map((pkg: any, idx: number) => ({
          service_id: params.id,
          location_settings_id: locId,
          label: pkg.label || `Option ${idx + 1}`,
          sessions_count: pkg.sessionsCount ?? (idx + 1),
          price_cents: Math.round((pkg.price ?? 0) * 100), 
          position: idx,
        }));
        
        
        const { error: pkgsError } = await supabase
          .from("service_session_packages")
          .insert(packagesToInsert);
          
        if (pkgsError) {
          console.error("Error inserting session packages:", pkgsError);
        } else {
          console.log("Successfully inserted", loc.sessionOptions.length, "session packages");
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}