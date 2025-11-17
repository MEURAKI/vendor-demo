// app/api/products/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

// ---------- Supabase server client ----------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// DO NOT expose service key anywhere client-side.
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Make sure this runs on the Node runtime (not edge)
export const runtime = "nodejs";

// ---------- Types for mapping ----------

type CsvMappingKey =
  | "productUniqueCode"
  | "sku"
  | "name"
  | "type"
  | "category"
  | "wellness"
  | "price"
  | "inventory";

type Mapping = Record<CsvMappingKey, string>;

type ProductInsert = {
  name: string;
  base_sku: string;
  is_variant: boolean;
  price_cents: number | null;
  inventory_qty: number | null;
  status: "draft" | "published";
  vendor_id: string;
};

// Helper to safely get a mapped field from a row
function getMappedValue(
  row: Record<string, string>,
  mapping: Partial<Mapping>,
  key: CsvMappingKey
): string {
  const headerName = mapping[key];
  if (!headerName) return "";
  // headerName should exactly match the CSV column header
  return (row[headerName] ?? "").trim();
}

// ---------- POST handler ----------

export async function POST(req: NextRequest) {
  try {
    // 0) Authenticate vendor using Bearer token
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

    // 1) Get CSV + mapping from multipart form-data
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

    // 2) Read entire CSV as text
    const text = await file.text();

    if (!text.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // 3) Parse CSV
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

    const productsToInsert: ProductInsert[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because row 1 is header

      const name = getMappedValue(row, mapping, "name");
      const sku =
        getMappedValue(row, mapping, "sku") ||
        getMappedValue(row, mapping, "productUniqueCode");

      const inventoryRaw = getMappedValue(row, mapping, "inventory");
      console.log(`Processing row ${rowNumber}:`, inventoryRaw);

      // Skip rows missing key fields
      if (!name || !sku) {
        console.warn(
          `Skipping row ${rowNumber} because name or sku is missing`,
          { name, sku }
        );
        return;
      }

      const typeRaw = getMappedValue(row, mapping, "type").toLowerCase();
      const priceRaw = getMappedValue(row, mapping, "price");

      const priceNumber = priceRaw ? Number(priceRaw) : NaN;
      const inventoryNumber = inventoryRaw ? Number(inventoryRaw) : NaN;

      const product: ProductInsert = {
        name,
        base_sku: sku,
        is_variant: typeRaw === "variant" || typeRaw === "variants",
        price_cents: Number.isNaN(priceNumber)
          ? null
          : Math.round(priceNumber * 100), // assume SGD
        inventory_qty: Number.isNaN(inventoryNumber)
          ? null
          : Math.round(inventoryNumber),
        status: "published",
        vendor_id: vendorId, // 👈 attach authenticated vendor
      };

      productsToInsert.push(product);
    });

    if (productsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // 4) Insert into products table
    const { data, error } = await supabase
      .from("products")
      .insert(productsToInsert)
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to insert products", details: error.message },
        { status: 500 }
      );
    }

    // TODO: handle categories / wellness via mapping.category / mapping.wellness

    return NextResponse.json({
      ok: true,
      insertedCount: data?.length ?? 0,
      products: data,
    });
  } catch (err: any) {
    console.error("Bulk upload unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}