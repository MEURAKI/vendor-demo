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

export async function GET(req: Request) {
  const client = supa();

  /* ----------------- 0) GET LOGGED-IN USER ----------------- */

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;

  if (!token) {
    return NextResponse.json(
      { error: "Missing access token" },
      { status: 401 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: userError?.message ?? "Unauthenticated" },
      { status: 401 }
    );
  }

  // assumes products.vendor_id references the logged-in vendor
  const vendorId = user.id;

  /* ----------------- 1) LOAD ALL PRODUCTS FOR THIS VENDOR ----------------- */

  const { data: productsData, error: productsError } = await client
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
      vendor_id,
      product_categories (
        category
      )
    `
    )
    .eq("vendor_id", vendorId);

  if (productsError) {
    console.error("[inventory] products error:", productsError);
    return NextResponse.json(
      { error: productsError.message },
      { status: 400 }
    );
  }

  const products = productsData ?? [];

  // split into single products and variant products
  const singleProducts = products.filter((p: any) => !p.is_variant);
  const variantParentProducts = products.filter((p: any) => p.is_variant);

  const variantParentIds = variantParentProducts.map((p: any) => p.id);

  /* ----------------- 2) LOAD VARIANTS FOR THIS VENDOR'S PRODUCTS ONLY ----------------- */

  let variantData: any[] = [];

  if (variantParentIds.length > 0) {
    const { data: rawVariantData, error: variantError } = await client
      .from("product_variants")
      .select(
        `
        id,
        sku,
        price_cents,
        inventory_qty,
        options_json,
        product_id
      `
      )
      .in("product_id", variantParentIds);

    if (variantError) {
      console.error("[inventory] variant error:", variantError);
      return NextResponse.json(
        { error: variantError.message },
        { status: 400 }
      );
    }

    variantData = rawVariantData ?? [];
  }

  /* ----------------- 3) MAP VARIANT ROWS ----------------- */

  const variantRows = variantData.map((v: any) => {
    const product = variantParentProducts.find(
      (p: any) => p.id === v.product_id
    );

    // if for some reason there's no matching product, skip this row
    if (!product) {
      return null;
    }

    const catRel = product.product_categories?.[0];
    const categoryName = catRel?.category ?? "—";

    let variantLabel: string | null = null;
    if (v.options_json && typeof v.options_json === "object") {
      const parts = Object.values(v.options_json as Record<string, string>);
      if (parts.length) {
        variantLabel = parts.join(" · ");
      }
    }

    const stock = v.inventory_qty ?? 0;

    let status: InventoryStatus =
      (product.status as InventoryStatus) ?? "draft";
    if (stock <= 0) status = "out_of_stock";

    return {
      id: String(v.id),
      productId: String(product.id),
      productName: product.name ?? "Untitled product",
      variantLabel,
      category: categoryName,
      priceCents: v.price_cents ?? 0,
      stock,
      sku: v.sku ?? product.base_sku ?? "",
      status,
      // imageUrl: v.image_url ?? product.image_url ?? null,
    };
  }).filter(Boolean) as {
    id: string;
    productId: string;
    productName: string;
    variantLabel: string | null;
    category: string;
    priceCents: number;
    stock: number;
    sku: string;
    status: InventoryStatus;
  }[];

  /* ----------------- 4) MAP SINGLE PRODUCT ROWS ----------------- */

  const singleRows = singleProducts.map((p: any) => {
    const catRel = p.product_categories?.[0];
    const categoryName = catRel?.category ?? "—";

    const stock = p.inventory_qty ?? 0;

    let status: InventoryStatus = (p.status as InventoryStatus) ?? "draft";
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
    return (a.variantLabel ?? "").localeCompare(b.variantLabel ?? "");
  });

  return NextResponse.json({ inventory });
}