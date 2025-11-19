// app/api/products/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
  | "inventory"
  | "tags"; // 👈 NEW

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

type ParsedRow = {
  product: ProductInsert;
  wellnessNames: string[];
  categoryNames: string[];
  tags: string[];
};

// Helper to safely get a mapped field from a row
function getMappedValue(
  row: Record<string, string>,
  mapping: Partial<Mapping>,
  key: CsvMappingKey
): string {
  const headerName = mapping[key];
  if (!headerName) return "";
  return (row[headerName] ?? "").trim();
}

function parseList(str: string): string[] {
  if (!str) return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

    const parsedRows: ParsedRow[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because row 1 is header

      const name = getMappedValue(row, mapping, "name");
      const sku =
        getMappedValue(row, mapping, "sku") ||
        getMappedValue(row, mapping, "productUniqueCode");

      const inventoryRaw = getMappedValue(row, mapping, "inventory");

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
          : Math.round(priceNumber * 100),
        inventory_qty: Number.isNaN(inventoryNumber)
          ? null
          : Math.round(inventoryNumber),
        status: "published",
        vendor_id: vendorId,
      };

      const wellnessStr = getMappedValue(row, mapping, "wellness");
      const categoryStr = getMappedValue(row, mapping, "category");
      const tagsStr = getMappedValue(row, mapping, "tags");

      parsedRows.push({
        product,
        wellnessNames: parseList(wellnessStr),
        categoryNames: parseList(categoryStr),
        tags: parseList(tagsStr),
      });
    });

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // 4) Insert products
    const { data: insertedProducts, error } = await supabase
      .from("products")
      .insert(parsedRows.map((r) => r.product))
      .select();

    if (error || !insertedProducts) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to insert products", details: error?.message },
        { status: 500 }
      );
    }

    // Build lookup by base_sku to match inserted rows back to parsedRows
    const insertedBySku: Record<string, any> = {};
    insertedProducts.forEach((p: any) => {
      insertedBySku[p.base_sku] = p;
    });

    // 5) Fetch wellness + category master data to map by name
    const [wellnessRes, categoryRes] = await Promise.all([
      supabase.from("wellness_dimensions").select("id, name"),
      supabase.from("categories").select("id, name"),
    ]);

    const wellnessRows = wellnessRes.data ?? [];
    const categoryRows = categoryRes.data ?? [];

    const wellnessIdByName: Record<string, string> = {};
    wellnessRows.forEach((w: any) => {
      wellnessIdByName[w.name.trim().toLowerCase()] = w.id;
    });

    const categoryIdByName: Record<string, string> = {};
    categoryRows.forEach((c: any) => {
      categoryIdByName[c.name.trim().toLowerCase()] = c.id;
    });
    

    // 6) Build join-table rows
    const wellnessJoins: { product_id: string; dimension_id: string }[] = [];
    const categoryJoins: { product_id: string; category_id: string }[] = [];
    const tagJoins: { product_id: string; tag: string }[] = [];

    parsedRows.forEach((row) => {
      const inserted = insertedBySku[row.product.base_sku];
      if (!inserted) return;
      const productId = inserted.id;

      // wellness
      row.wellnessNames.forEach((n) => {
        const id = wellnessIdByName[n.toLowerCase()];
        if (id) {
          wellnessJoins.push({ product_id: productId, dimension_id: id });
        }
      });

      // categories
      row.categoryNames.forEach((n) => {
        const id = categoryIdByName[n.toLowerCase()];
        if (id) {
          categoryJoins.push({ product_id: productId, category_id: id });
        }
      });

      // tags (free text)
      row.tags.forEach((t) => {
        tagJoins.push({ product_id: productId, tag: t });
      });
    });

    // 7) Insert into join tables (if any)
    if (wellnessJoins.length) {
      await supabase.from("product_wellness_dimensions").insert(wellnessJoins);
    }
    if (categoryJoins.length) {
      await supabase.from("product_categories").insert(categoryJoins);
    }
    if (tagJoins.length) {
      await supabase.from("product_tags").insert(tagJoins);
    }

    return NextResponse.json({
      ok: true,
      insertedCount: insertedProducts.length,
      products: insertedProducts,
    });
  } catch (err: any) {
    console.error("Bulk upload unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}