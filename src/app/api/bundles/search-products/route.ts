// app/api/bundles/search-products/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// Shape we return to the frontend
type BundleSearchItem = {
  id: string;
  kind: "variant" | "single";
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Number(searchParams.get("limit") ?? "25");

    const client = supa();

    // ---------- 0) AUTH ----------
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

    const vendorId = user.id;

    // ---------- 1) VARIANTS (GROUPED BY PRODUCT) ----------
    const {
      data: variantData,
      error: variantError,
    } = await client
      .from("product_variants")
      .select(
        `
          id,
          sku,
          price_cents,
          inventory_qty,
          options_json,
          image_url,
          products:product_id (
            id,
            name,
            vendor_id,
            is_variant,
            image_url
          )
        `
      )
      .gt("inventory_qty", 0)
      .eq("products.vendor_id", vendorId)
      .eq("products.is_variant", true)
      .ilike("products.name", q ? `%${q}%` : "%")
      // if this ever throws, switch to: .order("name", { ascending: true, foreignTable: "products" })
      .order("products(name)", { ascending: true });

    if (variantError) {
      console.error("[bundles/search-products] variant error:", variantError);
      return NextResponse.json(
        { error: variantError.message },
        { status: 400 }
      );
    }

    type VariantGroup = {
      productId: string;
      name: string;
      imageUrl: string | null;
      totalStock: number;
      minPriceCents: number | null;
      sku: string; // representative SKU (e.g. first variant's SKU)
    };

    const variantGroups: Record<string, VariantGroup> = {};

    for (const row of variantData ?? []) {
      const product = (row as any).products;

      // If somehow we got a variant without a product, skip it gracefully
      if (!product) {
        console.warn(
          "[bundles/search-products] variant without product",
          (row as any).id
        );
        continue;
      }

      const productId = String(product.id);

      if (!variantGroups[productId]) {
        variantGroups[productId] = {
          productId,
          name: product.name ?? "Untitled product",
          imageUrl: (row as any).image_url ?? product.image_url ?? null,
          totalStock: 0,
          minPriceCents: null,
          sku: (row as any).sku ?? "",
        };
      }

      const group = variantGroups[productId];

      // Accumulate stock
      const stock = (row as any).inventory_qty ?? 0;
      group.totalStock += stock;

      // Track minimum price (or change this to max/avg if you prefer)
      const price = (row as any).price_cents;
      if (typeof price === "number") {
        if (group.minPriceCents === null || price < group.minPriceCents) {
          group.minPriceCents = price;
        }
      }
    }

    const variantItems: BundleSearchItem[] = Object.values(variantGroups)
      // Only keep products that still have stock
      .filter((group) => group.totalStock > 0)
      .map(
        (group): BundleSearchItem => ({
          id: group.productId,
          kind: "variant", // marks this as a "variant product"
          productId: group.productId,
          variantId: null, // aggregated, not a single variant
          name: group.name,
          sku: group.sku,
          priceCents: group.minPriceCents ?? 0, // "from" price
          stock: group.totalStock, // total across all variants
          imageUrl: group.imageUrl,
        })
      );

    // ---------- 2) SINGLE PRODUCTS ----------
    const {
      data: singleData,
      error: singleError,
    } = await client
      .from("products")
      .select(
        `
          id,
          name,
          price_cents,
          inventory_qty,
          base_sku,
          is_variant,
          vendor_id,
          image_url
        `
      )
      .eq("vendor_id", vendorId)
      .eq("is_variant", false)
      .gt("inventory_qty", 0)
      .ilike("name", q ? `%${q}%` : "%")
      .order("name", { ascending: true });

    if (singleError) {
      console.error("[bundles/search-products] single error:", singleError);
      return NextResponse.json(
        { error: singleError.message },
        { status: 400 }
      );
    }

    const singleItems: BundleSearchItem[] =
      (singleData ?? []).map(
        (p: any): BundleSearchItem => ({
          id: String(p.id),
          kind: "single",
          productId: String(p.id),
          variantId: null,
          name: p.name ?? "Untitled product",
          sku: p.base_sku ?? "",
          priceCents: p.price_cents ?? 0,
          stock: p.inventory_qty ?? 0,
          imageUrl: p.image_url ?? null,
        })
      );

    // ---------- 3) MERGE / DEDUPE / LIMIT ----------
    let items: BundleSearchItem[] = [...variantItems, ...singleItems];

    const seen = new Set<string>();
    const deduped: BundleSearchItem[] = [];

    for (const item of items) {
      const key = [
        item.kind,
        item.productId,
        item.variantId ?? "noVariant",
        item.sku ?? "",
        item.name ?? "",
        item.priceCents ?? 0,
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    deduped.sort((a, b) => a.name.localeCompare(b.name));

    const finalItems =
      Number.isFinite(limit) && limit > 0
        ? deduped.slice(0, limit)
        : deduped;

    return NextResponse.json({ items: finalItems });
  } catch (err: any) {
    console.error("[bundles/search-products] UNHANDLED ERROR:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}