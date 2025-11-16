// app/api/products/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
};

// Utility: split a CSV line (very simple, no quoted commas support)
function splitCsvLine(line: string): string[] {
  return line
    .split(",")
    .map((c) => c.trim().replace(/^"|"$/g, ""));
}

// ---------- POST handler ----------

export async function POST(req: NextRequest) {
  try {
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

    // Read entire CSV as text
    const text = await file.text();

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // Header row
    const headers = splitCsvLine(lines[0]);
    const headerIndex: Record<string, number> = {};
    headers.forEach((h, idx) => {
      headerIndex[h] = idx;
    });

    const getValue = (
      cols: string[],
      mappingKey: CsvMappingKey
    ): string => {
      const headerName = mapping[mappingKey];
      if (!headerName) return "";
      const idx = headerIndex[headerName];
      if (idx === undefined) return "";
      return cols[idx] ?? "";
    };

    const productsToInsert: ProductInsert[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const cols = splitCsvLine(row);

      // Skip completely empty lines
      if (cols.every((c) => c === "")) continue;

      const name = getValue(cols, "name");
      const sku =
        getValue(cols, "sku") || getValue(cols, "productUniqueCode");

      if (!name || !sku) {
        // If key data missing, skip this row
        console.warn(
          `Skipping row ${i + 1} because name or sku is missing`
        );
        continue;
      }

      const typeRaw = getValue(cols, "type").toLowerCase();
      const priceRaw = getValue(cols, "price");
      const inventoryRaw = getValue(cols, "inventory");

      const priceNumber = priceRaw ? Number(priceRaw) : NaN;
      const inventoryNumber = inventoryRaw ? Number(inventoryRaw) : NaN;

      const product: ProductInsert = {
        name,
        base_sku: sku,
        is_variant: typeRaw === "variant" || typeRaw === "variants",
        price_cents: isNaN(priceNumber)
          ? null
          : Math.round(priceNumber * 100), // assume SGD
        inventory_qty: isNaN(inventoryNumber)
          ? null
          : Math.round(inventoryNumber),
        status: "draft",
      };

      productsToInsert.push(product);
    }

    if (productsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Insert into products table
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

    // TODO later: handle categories / wellness / tags using mapping.category / mapping.wellness
    // (insert / upsert to categories, wellness_dimensions, etc.)

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
