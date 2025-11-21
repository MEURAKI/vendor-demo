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
  | "description"
  | "type"
  | "category"
  | "wellness"
  | "price"
  | "inventory"
  | "tags"
  | "discountType"
  | "discountValue"
  | "discountStart"
  | "discountEnd";

type Mapping = Record<CsvMappingKey, string>;

type ProductInsert = {
  name: string;
  description: string;
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
  sections: { title: string; body: string; sort_order: number }[]; // 👈 NEW
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

/**
 * Build description sections from CSV columns:
 *  - Accordion_Title_1..5
 *  - Accordion_Description_1..5 OR Accordion_Desc_1..5
 *
 * No mapping required – uses header names directly.
 * If title is missing but body exists, fallback to "Section N".
 * sort_order = i - 1 (0-based).
 */
function buildDescriptionSections(
  row: Record<string, string>
): { title: string; body: string; sort_order: number }[] {
  const sections: { title: string; body: string; sort_order: number }[] = [];

  for (let i = 1; i <= 5; i++) {
    const titleKey = `Accordion_Title_${i}`;
    const descKey1 = `Accordion_Description_${i}`;
    const descKey2 = `Accordion_Desc_${i}`;

    const titleRaw = (row[titleKey] || "").trim();
    const bodyRaw = (
      (row[descKey1] || row[descKey2]) ||
      ""
    ).trim();

    if (titleRaw || bodyRaw) {
      sections.push({
        title: titleRaw || `Section ${i}`,
        body: bodyRaw,
        sort_order: i - 1,
      });
    }
  }

  return sections;
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

      const description = getMappedValue(row, mapping, "description");
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
        description,
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

      const sections = buildDescriptionSections(row); // 👈 NEW

      parsedRows.push({
        product,
        wellnessNames: parseList(wellnessStr),
        categoryNames: parseList(categoryStr),
        tags: parseList(tagsStr),
        sections,
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

    // 6) Build join-table + section rows
    const wellnessJoins: { product_id: string; dimension_id: string }[] = [];
    const categoryJoins: { product_id: string; category: string }[] = [];
    const tagJoins: { product_id: string; tag: string }[] = [];
    const sectionRows: {
      product_id: string;
      sort_order: number;
      title: string;
      body: string;
    }[] = [];

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

      // categories (free text)
      row.categoryNames.forEach((n) => {
        categoryJoins.push({ product_id: productId, category: n });
      });

      // tags (free text)
      row.tags.forEach((t) => {
        tagJoins.push({ product_id: productId, tag: t });
      });

      // 👇 NEW: description sections (accordions)
      row.sections.forEach((s) => {
        sectionRows.push({
          product_id: productId,
          sort_order: s.sort_order,
          title: s.title,
          body: s.body,
        });
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
    if (sectionRows.length) {
      await supabase.from("product_description_sections").insert(sectionRows);
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