// app/api/export/products-and-variants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// SERVER-SIDE Supabase client (service role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Force node runtime
export const runtime = "nodejs";

/* ------------ CSV helper ------------ */

function toCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value: any) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Quote and escape inner quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [
    headers.join(","), // header row
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

/* ------------ GET /api/export/products-and-variants ------------ */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "products").toLowerCase();

  if (type === "products") {
    return exportProductsCsv();
  } else if (type === "variants") {
    return exportVariantsCsv();
  } else {
    return NextResponse.json(
      { error: "Invalid type. Use ?type=products or ?type=variants" },
      { status: 400 }
    );
  }
}

/* ------------ Export PRODUCTS ------------ */
/**
 * Columns:
 * - product_id
 * - sku
 * - dimensions
 * - category
 * - description
 * - tags
 * - base_price
 *
 * Adjust the select() fields to match your table schema.
 * Here I assume:
 *   - products.dimensions (string or JSON)
 *   - products.category (string) OR you can join category table if needed
 *   - products.tags (array or string)
 *   - products.price_cents (integer)
 */
async function exportProductsCsv() {
  const { data: products, error } = await supabase
    .from("products")
    .select(
      `
      id,
      base_sku,
      description,
      price_cents,
      dimensions,
      category,
      tags
    `
    );

  if (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: error.message },
      { status: 500 }
    );
  }

  const rows =
    products?.map((p: any) => {
      // normalize tags (could be array in DB)
      const tags =
        Array.isArray(p.tags) ? p.tags.join("|") : p.tags ?? "";

      // if dimensions is JSON, stringify; else use directly
      const dimensions =
        typeof p.dimensions === "object" && p.dimensions !== null
          ? JSON.stringify(p.dimensions)
          : p.dimensions ?? "";

      const basePrice =
        typeof p.price_cents === "number"
          ? (p.price_cents / 100).toFixed(2)
          : "";

      return {
        product_id: p.id,
        sku: p.base_sku,
        dimensions,
        category: p.category ?? "",
        description: p.description ?? "",
        tags,
        base_price: basePrice,
      };
    }) ?? [];

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products.csv"`,
    },
  });
}

/* ------------ Export VARIANTS ------------ */
/**
 * Columns:
 * - variant_sku
 * - parent_product_id
 * - base_price
 * - quantity
 * - option_size
 * - option_color
 *
 * Assumes:
 *   - product_variants.price_cents (integer)
 *   - product_variants.inventory_qty (integer)
 *   - product_variants.options_json (JSON like { Size: "M", Color: "Black" })
 */
async function exportVariantsCsv() {
  const { data: variants, error } = await supabase
    .from("product_variants")
    .select(`
      id,
      product_id,
      sku,
      price_cents,
      inventory_qty,
      options_json
    `);

  if (error) {
    console.error("Error fetching variants:", error);
    return NextResponse.json(
      { error: "Failed to fetch variants", details: error.message },
      { status: 500 }
    );
  }

  const rows =
    variants?.map((v: any) => {
      const opts = (v.options_json as Record<string, any>) || {};

      const basePrice =
        typeof v.price_cents === "number"
          ? (v.price_cents / 100).toFixed(2)
          : "";

      // try both capitalized / lowercase keys just in case
      const size = opts.Size ?? opts.size ?? "";
      const color = opts.Color ?? opts.color ?? "";

      return {
        variant_sku: v.sku,
        parent_product_id: v.product_id,
        base_price: basePrice,
        quantity: v.inventory_qty ?? 0,
        option_size: size,
        option_color: color,
      };
    }) ?? [];

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="variants.csv"`,
    },
  });
}