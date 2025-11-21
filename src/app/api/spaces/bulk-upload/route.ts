// app/api/providers/bulk-upload/route.ts
// (Consider moving to app/api/spaces/bulk-upload/route.ts later)

import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

type SpaceStatus = "draft" | "active" | "unavailable";

type PreparedRow = {
  spaceInsert: {
    vendor_id: string;
    name: string;
    description: string | null;
    status: SpaceStatus;
    space_type: "in_person" | "online" | "hybrid";
    address: string | null;
    postal_code: string | null;
    map_link: string | null;
    google_business_place_id: string | null;
    whatsapp_country_code: string | null;
    whatsapp_number: string | null;
    wellness_dimensions: string[];
    categories: string[];
    tags: string[];
    cover_image_url: string | null;
    total_images: number;
  };
  imageUrls: string[];
};

// split on comma / semicolon, trim, remove empties
function parseListCell(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// crude parser for "65 91829318" → { code: "65", number: "91829318" }
// or "91829318" → { code: null, number: "91829318" }
function parseWhatsapp(raw: string | undefined | null): {
  countryCode: string | null;
  number: string | null;
} {
  if (!raw) return { countryCode: null, number: null };
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { countryCode: null, number: null };

  if (digits.length > 8) {
    const number = digits.slice(-8);
    const countryCode = digits.slice(0, digits.length - 8);
    return { countryCode, number };
  }

  return { countryCode: null, number: digits };
}

// map CSV Space_Type → "in_person" | "online" | "hybrid"
function mapSpaceType(raw: string | undefined | null): "in_person" | "online" | "hybrid" {
  if (!raw) return "in_person";
  const v = raw.trim().toLowerCase();

  if (v.includes("online") || v.includes("virtual")) return "online";
  if (v.includes("hybrid")) return "hybrid";

  // "In Person", "Private", etc. → treat as in-person
  return "in_person";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendorId = auth.user.id;

    // 1) Read CSV from multipart form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 }
      );
    }

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // 2) Parse CSV (header row as columns)
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (!records.length) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // 3) Map CSV rows -> space inserts
    const prepared: PreparedRow[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // header is row 1

      const name = (row["Space_Name"] || "").trim();
      if (!name) {
        console.warn(
          `[spaces bulk] Skipping row ${rowNumber} – missing Space_Name`
        );
        return;
      }

      const spaceType = mapSpaceType(row["Space_Type"]);
      const address = (row["Address"] || "").trim() || null;
      const postalCode = (row["Postal_Code"] || "").trim() || null;
      const mapLink = (row["Map_Link"] || "").trim() || null;
      const googleBusinessPlaceId =
        (row["google_places_id"] || "").trim() || null;

      // Integration_Status → status (fallback to "active")
      const integrationStatus = (row["Integration_Status"] || "").trim();
      let status: SpaceStatus = "active";
      const statusLower = integrationStatus.toLowerCase();
      if (statusLower === "draft") status = "draft";
      if (statusLower === "unavailable") status = "unavailable";

      // Contact number -> WhatsApp fields
      const contactNumberRaw = (row["Contact_Number"] || "").trim();
      const { countryCode, number } = parseWhatsapp(contactNumberRaw);

      // Facilities -> tags (so they’re not lost)
      const facilities = parseListCell(row["Facilities"]);

      // Images
      const imageUrls = parseListCell(row["Space_Image"]);
      const cleanImages = imageUrls.filter(
        (url) => url && !url.startsWith("blob:")
      );
      const cover = cleanImages[0] ?? null;

      prepared.push({
        spaceInsert: {
          vendor_id: vendorId,
          name,
          description: null, // CSV has no description column
          status,
          space_type: spaceType,
          address,
          postal_code: postalCode,
          map_link: mapLink,
          google_business_place_id: googleBusinessPlaceId,
          whatsapp_country_code: countryCode,
          whatsapp_number: number,
          wellness_dimensions: [], // not provided in CSV
          categories: [], // not provided in CSV
          tags: facilities, // using Facilities as tags
          cover_image_url: cover,
          total_images: cleanImages.length,
        },
        imageUrls: cleanImages,
      });
    });

    if (!prepared.length) {
      return NextResponse.json(
        { error: "No valid space rows found in CSV" },
        { status: 400 }
      );
    }

    // 4) Insert into spaces
    const spaceRows = prepared.map((p) => p.spaceInsert);

    const { data: inserted, error: insertError } = await supabase
      .from("spaces")
      .insert(spaceRows)
      .select("id");

    if (insertError) {
      console.error("[spaces bulk] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to insert spaces", details: insertError.message },
        { status: 400 }
      );
    }

    const insertedSpaces = (inserted ?? []) as { id: string }[];

    // 5) Insert space_images
    const imageRows: {
      space_id: string;
      image_url: string;
      position: number;
    }[] = [];

    insertedSpaces.forEach((space, idx) => {
      const imgs = prepared[idx]?.imageUrls ?? [];
      imgs.forEach((url, pos) => {
        imageRows.push({
          space_id: space.id,
          image_url: url,
          position: pos,
        });
      });
    });

    if (imageRows.length) {
      const { error: imgErr } = await supabase
        .from("space_images")
        .insert(imageRows);
      if (imgErr) {
        console.error("[spaces bulk] space_images insert error:", imgErr);
        // not fatal; spaces are already created
      }
    }

    return NextResponse.json({
      ok: true,
      insertedCount: insertedSpaces.length,
    });
  } catch (err: any) {
    console.error("Spaces bulk upload error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}