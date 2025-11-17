// app/api/providers/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// SERVICE KEY – server-side only
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Node runtime
export const runtime = "nodejs";

/* ---------- Types ---------- */

type ProviderStatus = "draft" | "active" | "unavailable";

type CsvMappingKey =
  | "name"
  | "specialisationAreas"
  | "description"
  | "status"
  | "whatsappCountryCode"
  | "whatsappNumber"
  | "wellnessDimensions"
  | "categories"
  | "tags"
  | "images";

type Mapping = Record<CsvMappingKey, string>;

type PreparedRow = {
  providerInsert: {
    vendor_id: string;
    name: string;
    specialisation_areas: string | null;
    description: string | null;
    status: ProviderStatus;
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

/* ---------- Helpers ---------- */

function getMappedValue(
  row: Record<string, string>,
  mapping: Partial<Mapping>,
  key: CsvMappingKey
): string {
  const headerName = mapping[key];
  if (!headerName) return "";
  return (row[headerName] ?? "").trim();
}

function parseListCell(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/) // support comma OR semicolon separated
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ---------- POST handler ---------- */

export async function POST(req: NextRequest) {
  try {
    /* 0) Auth – use Bearer token from Authorization header */
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const vendorId = user.id;

    /* 1) Read CSV + mapping from multipart form-data */

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingJson = formData.get("mapping") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 }
      );
    }

    if (!mappingJson) {
      return NextResponse.json(
        { error: "Column mapping is required" },
        { status: 400 }
      );
    }

    const mapping = JSON.parse(mappingJson || "{}") as Partial<Mapping>;

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

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

    /* 2) Map CSV rows -> provider inserts */

    const prepared: PreparedRow[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // header is row 1

      const name = getMappedValue(row, mapping, "name");
      if (!name) {
        console.warn(
          `[providers bulk] Skipping row ${rowNumber} – missing name`
        );
        return;
      }

      const specialisationAreas = getMappedValue(
        row,
        mapping,
        "specialisationAreas"
      );
      const description = getMappedValue(row, mapping, "description");

      const statusRaw = getMappedValue(row, mapping, "status").toLowerCase();
      const status: ProviderStatus =
        statusRaw === "draft"
          ? "draft"
          : statusRaw === "unavailable"
          ? "unavailable"
          : "active"; // default

      const whatsappCountryCode = getMappedValue(
        row,
        mapping,
        "whatsappCountryCode"
      );
      const whatsappNumber = getMappedValue(row, mapping, "whatsappNumber");

      const wellnessDimensions = parseListCell(
        getMappedValue(row, mapping, "wellnessDimensions")
      );
      const categories = parseListCell(
        getMappedValue(row, mapping, "categories")
      );
      const tags = parseListCell(getMappedValue(row, mapping, "tags"));

      const imageCell = getMappedValue(row, mapping, "images");
      const rawImages = parseListCell(imageCell);

      const cleanImages = rawImages.filter(
        (url) => url && !url.startsWith("blob:")
      );
      const cover = cleanImages[0] ?? null;

      prepared.push({
        providerInsert: {
          vendor_id: vendorId,
          name,
          specialisation_areas: specialisationAreas || null,
          description: description || null,
          status,
          whatsapp_country_code: whatsappCountryCode || null,
          whatsapp_number: whatsappNumber || null,
          wellness_dimensions: wellnessDimensions,
          categories,
          tags,
          cover_image_url: cover,
          total_images: cleanImages.length,
        },
        imageUrls: cleanImages,
      });
    });

    if (!prepared.length) {
      return NextResponse.json(
        { error: "No valid provider rows found in CSV" },
        { status: 400 }
      );
    }

    /* 3) Insert into providers */

    const providerRows = prepared.map((p) => p.providerInsert);

    const { data: inserted, error: insertError } = await supabase
      .from("providers")
      .insert(providerRows)
      .select("id");

    if (insertError) {
      console.error("[providers bulk] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to insert providers", details: insertError.message },
        { status: 500 }
      );
    }

    const insertedProviders = (inserted ?? []) as { id: string }[];

    /* 4) Insert provider_images */

    const imageRows: { provider_id: string; image_url: string; position: number }[] =
      [];

    insertedProviders.forEach((prov, idx) => {
      const imgs = prepared[idx]?.imageUrls ?? [];
      imgs.forEach((url, pos) => {
        imageRows.push({
          provider_id: prov.id,
          image_url: url,
          position: pos,
        });
      });
    });

    if (imageRows.length) {
      const { error: imgErr } = await supabase
        .from("provider_images")
        .insert(imageRows);
      if (imgErr) {
        console.error("[providers bulk] provider_images insert error:", imgErr);
        // not fatal; providers are already created
      }
    }

    return NextResponse.json({
      ok: true,
      insertedCount: insertedProviders.length,
    });
  } catch (err: any) {
    console.error("Providers bulk upload error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}