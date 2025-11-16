// app/api/providers/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type ProviderStatus = "draft" | "active" | "unavailable";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: provider, error } = await supabase
    .from("providers")
    .select(
      `
      id,
      vendor_id,
      name,
      specialisation_areas,
      description,
      whatsapp_country_code,
      whatsapp_number,
      status,
      wellness_dimensions,
      categories,
      tags,
      cover_image_url,
      created_at,
      updated_at,
      provider_images (
        id,
        image_url,
        position
      )
    `
    )
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id)
    .maybeSingle();

  if (error || !provider) {
    return NextResponse.json(
      { error: error?.message || "Not found" },
      { status: 404 }
    );
  }

  const imgs = (provider.provider_images ?? []).slice().sort(
    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
  );
  const gallery_image_urls = imgs.map((i: any) => i.image_url);
  const cover_image_url =
    provider.cover_image_url || gallery_image_urls[0] || null;

  const payload = {
    id: provider.id,
    name: provider.name,
    specialisation_areas: provider.specialisation_areas,
    description: provider.description,
    whatsapp_country_code: provider.whatsapp_country_code,
    whatsapp_number: provider.whatsapp_number,
    status: provider.status as ProviderStatus,
    wellness_dimensions: provider.wellness_dimensions ?? [],
    categories: provider.categories ?? [],
    tags: provider.tags ?? [],
    cover_image_url,
    gallery_image_urls,
    images: imgs,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
  };

  return NextResponse.json({ provider: payload });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
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
    name?: string;
    specialisationAreas?: string;
    description?: string;
    status?: ProviderStatus;
    whatsappCountryCode?: string;
    whatsappNumber?: string;
    wellnessDimensions?: string[];
    categories?: string[];
    tags?: string[];
    images?: string[];
  };

  const updatePayload: Record<string, any> = {
    name,
    specialisation_areas: specialisationAreas,
    description,
    status,
    whatsapp_country_code: whatsappCountryCode,
    whatsapp_number: whatsappNumber,
    wellness_dimensions: wellnessDimensions ?? [],
    categories: categories ?? [],
    tags: tags ?? [],
  };

  let cleanedImages: string[] = [];
  const hasImages = Array.isArray(images);

  if (hasImages) {
    cleanedImages = (images ?? []).filter(
      (url) => url && !url.startsWith("blob:")
    );
    updatePayload.cover_image_url = cleanedImages[0] ?? null;
    updatePayload.total_images = cleanedImages.length;
  }

  const { error } = await supabase
    .from("providers")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (hasImages) {
    const { error: delErr } = await supabase
      .from("provider_images")
      .delete()
      .eq("provider_id", params.id);
    if (delErr) console.error("provider_images delete error", delErr);

    if (cleanedImages.length > 0) {
      const rows = cleanedImages.map((url, idx) => ({
        provider_id: params.id,
        image_url: url,
        position: idx,
      }));
      const { error: insErr } = await supabase
        .from("provider_images")
        .insert(rows);
      if (insErr) console.error("provider_images insert error", insErr);
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
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // cascade will remove provider_images as well
  const { error } = await supabase
    .from("providers")
    .delete()
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}