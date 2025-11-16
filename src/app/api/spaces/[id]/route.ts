// app/api/spaces/[id]/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: space, error } = await supabase
    .from("spaces")
    .select(
      `
      id,
      vendor_id,
      name,
      description,
      status,
      space_type,
      address,
      postal_code,
      map_link,
      google_business_place_id,
      whatsapp_country_code,
      whatsapp_number,
      wellness_dimensions,
      categories,
      tags,
      cover_image_url,
      created_at,
      updated_at,
      space_images (
        id,
        image_url,
        position
      )
    `
    )
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id)
    .maybeSingle();

  if (error || !space) {
    return NextResponse.json(
      { error: error?.message || "Not found" },
      { status: 404 }
    );
  }

  // Sort & derive gallery + cover from space_images
  const images = (space.space_images ?? []).slice().sort((a: any, b: any) => {
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    return pa - pb;
  });

  const gallery_image_urls = images.map((img: any) => img.image_url);
  const cover_image_url =
    space.cover_image_url || gallery_image_urls[0] || null;

  // Shape the JSON to be nice for your EditSpacePage
  const payload = {
    id: space.id,
    vendor_id: space.vendor_id,
    name: space.name,
    description: space.description,
    status: space.status,
    space_type: space.space_type,
    address: space.address,
    postal_code: space.postal_code,
    map_link: space.map_link,
    google_business_place_id: space.google_business_place_id,
    whatsapp_country_code: space.whatsapp_country_code,
    whatsapp_number: space.whatsapp_number,
    wellness_dimensions: space.wellness_dimensions ?? [],
    categories: space.categories ?? [],
    tags: space.tags ?? [],
    cover_image_url,
    gallery_image_urls,
    start_at: space.created_at,
    updated_at: space.updated_at,
    // keep raw images if you still use them anywhere
    images,
  };

  // You can either return { space: payload } or just payload;
  // your EditSpacePage does `json.space ?? json`, so both work.
  return NextResponse.json({ space: payload });
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

  // Keep existing field names you already use on the frontend
  const {
    name,
    description,
    status,
    spaceType,
    address,
    postalCode,
    mapLink,
    googleBusinessPlaceId,
    whatsappCountryCode,
    whatsappNumber,
    wellnessDimensions,
    categories,
    tags,
    images, // optional – array of URLs (may include blob: previews)
  } = body as {
    name?: string;
    description?: string;
    status?: "draft" | "active" | "unavailable";
    spaceType?: "in_person" | "online" | "hybrid";
    address?: string;
    postalCode?: string;
    mapLink?: string;
    googleBusinessPlaceId?: string;
    whatsappCountryCode?: string;
    whatsappNumber?: string;
    wellnessDimensions?: string[];
    categories?: string[];
    tags?: string[];
    images?: string[];
  };

  const updatePayload: Record<string, any> = {
    name,
    description,
    status,
    space_type: spaceType,
    address,
    postal_code: postalCode,
    map_link: mapLink,
    google_business_place_id: googleBusinessPlaceId,
    whatsapp_country_code: whatsappCountryCode,
    whatsapp_number: whatsappNumber,
    wellness_dimensions: wellnessDimensions ?? [],
    categories: categories ?? [],
    tags: tags ?? [],
  };

  // Only touch images if the client actually sent an `images` array
  const hasImages = Array.isArray(images);
  let cleanedImages: string[] = [];

  if (hasImages) {
    cleanedImages = (images ?? []).filter(
      (url) => url && !url.startsWith("blob:")
    );
    const cover = cleanedImages[0] ?? null;

    updatePayload.cover_image_url = cover;
    updatePayload.total_images = cleanedImages.length;
  }

  const { error } = await supabase
    .from("spaces")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("vendor_id", auth.user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If images were provided, sync space_images table
  if (hasImages) {
    // wipe previous images
    const { error: delErr } = await supabase
      .from("space_images")
      .delete()
      .eq("space_id", params.id);

    if (delErr) {
      console.error("Error deleting old space_images", delErr);
      // don't fail whole request
    }

    if (cleanedImages.length > 0) {
      const rows = cleanedImages.map((url, idx) => ({
        space_id: params.id,
        image_url: url,
        position: idx,
      }));
      const { error: insErr } = await supabase
        .from("space_images")
        .insert(rows);

      if (insErr) {
        console.error("Error inserting new space_images", insErr);
        // again, do not fail entire request
      }
    }
  }

  return NextResponse.json({ ok: true });
}