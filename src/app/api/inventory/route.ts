// app/api/inventory/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// keep this in sync with your frontend InventoryStatus
type InventoryStatus =
  | "draft"
  | "active"
  | "out_of_stock"
  | "published"
  | "inactive";

export async function GET() {
  const client = supa();

  /* ----------------- 1) VARIANT ROWS ----------------- */

  const { data: variantData, error: variantError } = await client
    .from("product_variants")
    .select(
      `
      id,
      sku,
      price_cents,
      inventory_qty,
      options_json,
      products:product_id (
        id,
        name,
        status,
        is_variant,
        base_sku,
        product_categories (
          category
        )
      )
    `
    );

  if (variantError) {
    console.error("[inventory] variant error:", variantError);
    return NextResponse.json(
      { error: variantError.message },
      { status: 400 }
    );
  }

  /* ----------------- 2) SINGLE PRODUCTS ----------------- */

  const { data: singleData, error: singleError } = await client
    .from("products")
    .select(
      `
      id,
      name,
      price_cents,
      inventory_qty,
      base_sku,
      status,
      is_variant,
      product_categories (
        category
      )
    `
    )
    .eq("is_variant", false); // only plain products

  if (singleError) {
    console.error("[inventory] single error:", singleError);
    return NextResponse.json(
      { error: singleError.message },
      { status: 400 }
    );
  }

  /* ----------------- 3) MAP VARIANT ROWS ----------------- */

  const variantRows = (variantData ?? []).map((v: any) => {
    const product = v.products;

    // product_categories looks like: [{ idx, product_id, category }]
    const catRel = product?.product_categories?.[0];
    const categoryName = catRel?.category ?? "—";

    // Build a label from options_json – e.g. "S", "S · Black"
    let variantLabel: string | null = null;
    if (v.options_json && typeof v.options_json === "object") {
      const parts = Object.values(v.options_json as Record<string, string>);
      if (parts.length) {
        variantLabel = parts.join(" · ");
      }
    }

    const stock = v.inventory_qty ?? 0;

    let status: InventoryStatus =
      (product?.status as InventoryStatus) ?? "draft";
    if (stock <= 0) status = "out_of_stock";

    return {
      id: String(v.id),
      productId: String(product?.id),
      productName: product?.name ?? "Untitled product",
      variantLabel,
      category: categoryName,
      priceCents: v.price_cents ?? 0,
      stock,
      sku: v.sku ?? product?.base_sku ?? "",
      status,
      // imageUrl: v.image_url ?? product?.image_url ?? null, // hook this up when you have it
    };
  });

  /* ----------------- 4) MAP SINGLE PRODUCT ROWS ----------------- */

  const singleRows = (singleData ?? []).map((p: any) => {
    const catRel = p.product_categories?.[0];
    const categoryName = catRel?.category ?? "—";

    const stock = p.inventory_qty ?? 0;

    let status: InventoryStatus =
      (p.status as InventoryStatus) ?? "draft";
    if (stock <= 0) status = "out_of_stock";

    return {
      id: String(p.id),
      productId: String(p.id),
      productName: p.name,
      variantLabel: null,
      category: categoryName,
      priceCents: p.price_cents ?? 0,
      stock,
      sku: p.base_sku ?? "",
      status,
      // imageUrl: p.image_url ?? null,
    };
  });

  /* ----------------- 5) MERGE & SORT ----------------- */

  const inventory = [...variantRows, ...singleRows];

  inventory.sort((a, b) => {
    const nameCmp = a.productName.localeCompare(b.productName);
    if (nameCmp !== 0) return nameCmp;
    // group variants of the same product together
    return (a.variantLabel ?? "").localeCompare(b.variantLabel ?? "");
  });

  return NextResponse.json({ inventory });
}