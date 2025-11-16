// app/api/providers/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type ProviderStatus = "draft" | "active" | "unavailable";

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  let query = supabase
    .from("providers")
    .select(
      `
      id,
      name,
      description,
      whatsapp_country_code,
      whatsapp_number,
      status,
      cover_image_url
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

  return NextResponse.json({ providers: data });
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const {
    name,
    specialisationAreas,
    description,
    status,
    whatsappCountryCode,
    whatsappNumber,
    wellnessDimensions,
    categories,
    tags,
    images,
  } = body as {
    name: string;
    specialisationAreas?: string;
    description?: string;
    status: ProviderStatus;
    whatsappCountryCode?: string;
    whatsappNumber?: string;
    wellnessDimensions?: string[];
    categories?: string[];
    tags?: string[];
    images?: string[];
  };

  const cleanImages = (images ?? []).filter(
    (url) => url && !url.startsWith("blob:")
  );
  const cover = cleanImages[0] ?? null;

  const { data: inserted, error } = await supabase
    .from("providers")
    .insert({
      vendor_id: auth.user.id,
      name,
      specialisation_areas: specialisationAreas,
      description,
      status,
      whatsapp_country_code: whatsappCountryCode,
      whatsapp_number: whatsappNumber,
      wellness_dimensions: wellnessDimensions ?? [],
      categories: categories ?? [],
      tags: tags ?? [],
      cover_image_url: cover,
      total_images: cleanImages.length,
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const providerId = inserted.id;

  if (cleanImages.length > 0) {
    const rows = cleanImages.map((url, idx) => ({
      provider_id: providerId,
      image_url: url,
      position: idx,
    }));
    const { error: imgErr } = await supabase
      .from("provider_images")
      .insert(rows);
    if (imgErr) console.error("provider_images insert error", imgErr);
  }

  return NextResponse.json({ id: providerId });
}