// app/api/services/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// SERVICE ROLE key – server-side only
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const runtime = "nodejs";

type ServiceStatus = "draft" | "active" | "unavailable";
type LocationType = "online" | "in_person";
type DiscountType = "fixed" | "percent" | null;

type PreparedService = {
  serviceInsert: {
    vendor_id: string;
    sku: string | null;
    name: string;
    description: string | null;
    status: ServiceStatus;
    service_types: string[];
    location_types: LocationType[];
    wellness_dimensions: string[];
    categories: string[];
    tags: string[];
    cover_image_url: string | null;
    total_images: number;
  };
  descriptionTabs: { title: string; body: string; position: number }[];
  imageUrls: string[];
  locationConfig: {
    locationTypes: LocationType[];
    price: number | null;
    maxParticipants: number | null;
    discountType: DiscountType;
    discountValue: number | null;
    hasFixedSchedule: boolean;
    expiryType: "anytime" | "duration";
    expiryDurationUnit: "days" | "weeks" | "months" | null;
    expiryDurationValue: number | null;
  };
};

function parseListCell(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Only keep URLs that look like http(s) – ignore file names like "SRV-XXX.png"
function parseImageUrls(mainImage: string, subImages: string): string[] {
  const raw = [
    ...(mainImage ? [mainImage] : []),
    ...parseListCell(subImages),
  ];

  return raw.filter((url) => {
    const u = url.trim();
    if (!u) return false;
    return u.startsWith("http://") || u.startsWith("https://");
  });
}

function normalizeLocationTypes(raw: string | undefined | null): LocationType[] {
  if (!raw) return [];
  const parts = raw.split(/[;,/]/).map((p) => p.trim().toLowerCase());
  const result: LocationType[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (
      part.includes("online") ||
      part.includes("virtual") ||
      part.includes("zoom")
    ) {
      if (!result.includes("online")) result.push("online");
    }

    if (
      part.includes("in-person") ||
      part.includes("in person") ||
      part.includes("in_person") ||
      part.includes("physical") ||
      part.includes("space")
    ) {
      if (!result.includes("in_person")) result.push("in_person");
    }
  }

  return result;
}

function parsePrice(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseDiscountType(raw: string | undefined | null): DiscountType {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("fix")) return "fixed";
  if (v === "%" || v.includes("percent")) return "percent";
  return null;
}

function parseExpiryType(raw: string | undefined | null): "anytime" | "duration" {
  if (!raw) return "anytime";
  const v = raw.trim().toUpperCase();
  if (!v || v === "USE_ANYTIME") return "anytime";
  return "duration";
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

    // 2) Parse CSV
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

    // 3) Map CSV rows -> PreparedService
    const prepared: PreparedService[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // row 1 is header

      const name = (row["Service_Name"] || "").trim();
      if (!name) {
        console.warn(
          `[services bulk] Skipping row ${rowNumber} – missing Service_Name`
        );
        return;
      }

      const sku = (row["Service_ID"] || "").trim() || null;
      const description = (row["Description"] || "").trim() || null;

      const serviceTypes = parseListCell(row["Service_Type"]);
      const categories = parseListCell(row["Category"]);
      const wellnessDimensions = parseListCell(row["Wellness_Dimension"]);

      const locationTypes = normalizeLocationTypes(row["Location_Type"]);
      const finalLocationTypes =
        locationTypes.length > 0 ? locationTypes : (["in_person"] as LocationType[]);

      // Build some tags from a few useful fields
      const groupName = (row["Service_ID_Group_Name"] || "").trim();
      const providerIds = parseListCell(row["Provider_IDs"]);
      const spaceIds = parseListCell(row["Space_IDs"]);
      const extraTags: string[] = [];
      if (groupName) extraTags.push(groupName);
      extraTags.push(...providerIds, ...spaceIds);
      const tags = extraTags.filter(Boolean);

      // Images – only keep if they are full URLs
      const mainImage = (row["Main_Image"] || "").trim();
      const subImages = (row["Sub_Images_Videos"] || "").trim();
      const imageUrls = parseImageUrls(mainImage, subImages);
      const cover = imageUrls[0] ?? null;

      // Description tabs
      const tabs: { title: string; body: string; position: number }[] = [];
      const t1 = (row["Accordion_Title_1"] || "").trim();
      const d1 = (row["Accordion_Description_1"] || "").trim();
      const t2 = (row["Accordion_Title_2"] || "").trim();
      const d2 = (row["Accordion_Desc_2"] || "").trim();

      if (t1 || d1) {
        tabs.push({
          title: t1 || "Section 1",
          body: d1 || "",
          position: 0,
        });
      }
      if (t2 || d2) {
        tabs.push({
          title: t2 || "Section 2",
          body: d2 || "",
          position: 1,
        });
      }

      // Basic pricing / availability to feed into service_location_settings
      const price = parsePrice(row["Price_Per_Person"]);
      const maxParticipants = parseIntSafe(row["Max_Participants"]);
      const discountType = parseDiscountType(row["Discount_Type"]);
      const discountValue = parsePrice(row["Discount_Value"]);
      const hasFixedSchedule = !!(row["Session_Dates_Times"] || "").trim();
      const expiryType = parseExpiryType(row["Expiry_Type"]);

      // For now we don't parse unit/value properly – keep as nulls unless you decide a rule
      const expiryDurationUnit: "days" | "weeks" | "months" | null = null;
      const expiryDurationValue: number | null = null;

      prepared.push({
        serviceInsert: {
          vendor_id: vendorId,
          sku,
          name,
          description,
          status: "active", // default all imported services as active
          service_types: serviceTypes,
          location_types: finalLocationTypes,
          wellness_dimensions: wellnessDimensions,
          categories,
          tags,
          cover_image_url: cover,
          total_images: imageUrls.length,
        },
        descriptionTabs: tabs,
        imageUrls,
        locationConfig: {
          locationTypes: finalLocationTypes,
          price,
          maxParticipants,
          discountType,
          discountValue,
          hasFixedSchedule,
          expiryType,
          expiryDurationUnit,
          expiryDurationValue,
        },
      });
    });

    if (!prepared.length) {
      return NextResponse.json(
        { error: "No valid service rows found in CSV" },
        { status: 400 }
      );
    }

    // 4) Insert services one-by-one (so we can attach children)
    let insertedCount = 0;

    for (const p of prepared) {
      const { serviceInsert, descriptionTabs, imageUrls, locationConfig } = p;

      const { data: srv, error: srvErr } = await supabase
        .from("services")
        .insert({
          vendor_id: serviceInsert.vendor_id,
          sku: serviceInsert.sku,
          name: serviceInsert.name,
          description: serviceInsert.description,
          status: serviceInsert.status,
          service_types: serviceInsert.service_types,
          location_types: serviceInsert.location_types,
          wellness_dimensions: serviceInsert.wellness_dimensions,
          categories: serviceInsert.categories,
          tags: serviceInsert.tags,
          cover_image_url: serviceInsert.cover_image_url,
          total_images: serviceInsert.total_images,
        })
        .select("id")
        .single();

      if (srvErr || !srv) {
        console.error("[services bulk] insert error:", srvErr);
        continue;
      }

      const serviceId = srv.id as string;

      // description tabs
      if (descriptionTabs.length) {
        const tabRows = descriptionTabs.map((t) => ({
          service_id: serviceId,
          title: t.title,
          body: t.body,
          position: t.position,
        }));
        const { error: tabErr } = await supabase
          .from("service_description_tabs")
          .insert(tabRows);
        if (tabErr) {
          console.error(
            "[services bulk] service_description_tabs insert error:",
            tabErr
          );
        }
      }

      // images
      if (imageUrls.length) {
        const imgRows = imageUrls.map((url, idx) => ({
          service_id: serviceId,
          image_url: url,
          position: idx,
          is_cover: idx === 0,
        }));
        const { error: imgErr } = await supabase
          .from("service_images")
          .insert(imgRows);
        if (imgErr) {
          console.error(
            "[services bulk] service_images insert error:",
            imgErr
          );
        }
      }

      // per-location settings (simple version – no timeSlots or packages)
      const {
        locationTypes,
        price,
        maxParticipants,
        discountType,
        discountValue,
        hasFixedSchedule,
        expiryType,
        expiryDurationUnit,
        expiryDurationValue,
      } = locationConfig;

      for (const locType of locationTypes) {
        const { error: locErr } = await supabase
          .from("service_location_settings")
          .insert({
            service_id: serviceId,
            location_type: locType,
            sku: serviceInsert.sku,
            max_participants: maxParticipants,
            price_cents:
              price != null ? Math.round(price * 100) : null,
            discount_type: discountType,
            discount_value: discountValue,
            discount_cap: null,
            has_fixed_schedule: hasFixedSchedule,
            expiry_type: expiryType,
            expiry_duration_unit: expiryDurationUnit,
            expiry_duration_value: expiryDurationValue,
          });

        if (locErr) {
          console.error(
            "[services bulk] service_location_settings insert error:",
            locErr
          );
        }
      }

      insertedCount++;
    }

    return NextResponse.json({
      ok: true,
      insertedCount,
    });
  } catch (err: any) {
    console.error("Services bulk upload error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}