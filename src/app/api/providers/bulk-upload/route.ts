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

type ProviderStatus = "draft" | "active" | "unavailable";

type Qualification = {
  year: string;
  title: string;
  institute: string;
};

type PreparedRow = {
  providerInsert: {
    vendor_id: string;
    name: string;
    specialisation_areas: string | null;
    description: string | null;
    whatsapp_country_code: string | null;
    whatsapp_number: string | null;
    wellness_dimensions: string[];
    categories: string[];
    tags: string[];
    cover_image_url: string | null;
    total_images: number;
    status: ProviderStatus;
    qualifications: Qualification[];
    designation?: string | null;
    years_experience?: number | null;
    clients_served?: number | null;
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

// crude parser for "65 8233 3832" → { code: "65", number: "82333832" }
function parseWhatsapp(raw: string | undefined | null): {
  countryCode: string | null;
  number: string | null;
} {
  if (!raw) return { countryCode: null, number: null };
  const digits = raw.replace(/[^\d]/g, ""); // keep only numbers

  if (!digits) return { countryCode: null, number: null };

  // If more than 8 digits, treat first part as country code, last 8 as number
  if (digits.length > 8) {
    const number = digits.slice(-8);
    const countryCode = digits.slice(0, digits.length - 8);
    return { countryCode, number };
  }

  // Otherwise, treat as number only
  return { countryCode: null, number: digits };
}

// safe integer parse: "" or NaN → null
function parseIntOrNull(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
  try {
    // 0) Auth via Bearer token
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

    // 3) Map CSV rows -> provider inserts
    const prepared: PreparedRow[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // header is row 1

      const name = (row["Provider_Name"] || "").trim();
      if (!name) {
        console.warn(
          `[providers bulk] Skipping row ${rowNumber} – missing Provider_Name`
        );
        return;
      }

      const specialisationAreas =
        (row["Specialisation_Areas"] || "").trim() || null;
      const description = (row["Profile_Paragraphs"] || "").trim() || null;

      // 🔹 Qualifications 1..15
      const qualifications: Qualification[] = [];
      const MAX_QUALIFICATIONS = 15;

      for (let i = 1; i <= MAX_QUALIFICATIONS; i++) {
        const title =
          (row[`Qualification_${i}_Title`] || "").trim();
        const institute =
          (row[`Qualification_${i}_Institute`] || "").trim();
        const year =
          (row[`Qualification_${i}_Year`] || "").trim();

        // Skip if all three empty
        if (!title && !institute && !year) continue;

        qualifications.push({
          title,
          institute,
          year,
        });
      }

      // WhatsApp
      const whatsappRaw = (row["Contact_Whatsapp_Number"] || "").trim();
      const { countryCode, number } = parseWhatsapp(whatsappRaw);

      // Arrays
      const categories = parseListCell(row["Provider_Categories"]);
      const wellnessDimensions = parseListCell(row["Provider_Wellness_Dimension"]);

      // Tags: linked services + availability + instagram link
      const linkedServices = parseListCell(row["Linked_Services"]);
      const availabilityTags = parseListCell(row["Provider_Availability"]);
      const instagramLink = (row["Provider_Instagram_Link"] || "").trim();
      const extraTags: string[] = [];
      if (instagramLink) extraTags.push(instagramLink);

      const tags = [...linkedServices, ...availabilityTags, ...extraTags];

      // Images: could be one or multiple URLs separated by comma / semicolon
      const imageUrls = parseListCell(row["Provider_Image"]);
      const cleanImages = imageUrls.filter(
        (url) => url && !url.startsWith("blob:")
      );
      const cover = cleanImages[0] ?? null;

      // Optional numeric fields from CSV
      const yearsExperience = parseIntOrNull(row["Years_Experience"]);
      const clientsServed = parseIntOrNull(row["Clients_Served"]);

      // default all imported providers as active
      const status: ProviderStatus = "active";

      prepared.push({
        providerInsert: {
          vendor_id: vendorId,
          name,
          specialisation_areas: specialisationAreas,
          description,
          status,
          whatsapp_country_code: countryCode,
          whatsapp_number: number,
          wellness_dimensions: wellnessDimensions,
          categories,
          tags,
          cover_image_url: cover,
          total_images: cleanImages.length,
          qualifications,
          designation: null, // or map from CSV if you add a column
          years_experience: yearsExperience,
          clients_served: clientsServed,
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

    // 4) Insert into providers
    const providerRows = prepared.map((p) => p.providerInsert);

    const { data: inserted, error: insertError } = await supabase
      .from("providers")
      .insert(providerRows)
      .select("id");

    if (insertError) {
      console.error("[providers bulk] insert error:", insertError);
      return NextResponse.json(
        {
          error: "Failed to insert providers",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    const insertedProviders = (inserted ?? []) as { id: string }[];

    // 5) Insert provider_images
    const imageRows: {
      provider_id: string;
      image_url: string;
      position: number;
    }[] = [];

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
        console.error(
          "[providers bulk] provider_images insert error:",
          imgErr
        );
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