// app/api/spaces/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Join space_images so we can get images from the right place
  const { data, error } = await supabase
    .from("spaces")
    .select(
      `
      id,
      name,
      address,
      space_type,
      whatsapp_number,
      map_link,
      status,
      cover_image_url,
      space_images (
        image_url,
        position
      )
    `
    )
    .eq("vendor_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Shape result: compute cover + gallery_image_urls
  const rawSpaces = data ?? [];

  const spaces = rawSpaces
    .filter((s) => {
      if (!q) return true;
      const name = (s.name || "").toLowerCase();
      const address = (s.address || "").toLowerCase();
      return name.includes(q) || address.includes(q);
    })
    .map((s: any) => {
      const images = (s.space_images ?? []).slice().sort((a: any, b: any) => {
        const pa = a.position ?? 0;
        const pb = b.position ?? 0;
        return pa - pb;
      });

      const gallery_image_urls = images.map((img: any) => img.image_url);
      const cover_image_url =
        s.cover_image_url || gallery_image_urls[0] || null;

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        space_type: s.space_type,
        whatsapp_number: s.whatsapp_number,
        map_link: s.map_link,
        status: s.status,
        cover_image_url,
        gallery_image_urls,
      };
    });

  return NextResponse.json({ spaces });
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
    images, // string[] (public URLs from storage – we’ll clean out blob:// just in case)
  } = body as {
    name: string;
    description?: string;
    status: "draft" | "active" | "unavailable";
    spaceType: "in_person" | "online" | "hybrid";
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

  // Ignore local blob: previews – only keep real URLs (from Supabase storage)
  const cleanedImages = (images ?? []).filter(
    (url) => url && !url.startsWith("blob:")
  );

  const cover = cleanedImages[0] ?? null;

  const { data: inserted, error } = await supabase
    .from("spaces")
    .insert({
      vendor_id: auth.user.id,
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
      cover_image_url: cover,
      total_images: cleanedImages.length,
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const spaceId = inserted.id;

  // Store gallery images in space_images table, ordered by position
  if (cleanedImages.length > 0) {
    const rows = cleanedImages.map((url, idx) => ({
      space_id: spaceId,
      image_url: url,
      position: idx,
    }));

    const { error: imgErr } = await supabase.from("space_images").insert(rows);
    if (imgErr) {
      console.error("Error inserting space_images", imgErr);
      // Don’t fail entire request – just log
    }
  }

  return NextResponse.json({ id: spaceId });
}