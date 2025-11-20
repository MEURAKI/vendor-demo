// app/api/bundles/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

type DiscountType = "fixed" | "percent" | null;

// GET /api/bundles  -> list bundles for logged-in vendor
export async function GET(req: Request) {
  const client = supa();

  // --- auth: get vendor from bearer token (same pattern as inventory) ---
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

  const { data, error } = await client
    .from("bundles")
    .select(
      `
      id,
      vendor_id,
      name,
      base_sku,
      sku,
      price_cents,
      discount_type,
      discount_value,
      discount_start_at,
      discount_end_at,
      status,
      image_url
    `
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[bundles GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const bundles =
    data?.map((b) => ({
      id: b.id as string,
      name: b.name as string,
      sku: b.sku as string,
      baseSku: b.base_sku as string,
      priceCents: b.price_cents ?? 0,
      discount: b.discount_type
        ? {
            type: b.discount_type as DiscountType,
            value: b.discount_value ?? 0,
            start: b.discount_start_at ?? null,
            end: b.discount_end_at ?? null,
          }
        : null,
      status: b.status as "draft" | "active" | "inactive",
      imageUrl: b.image_url ?? null,
    })) ?? [];

  return NextResponse.json({ bundles });
}

// POST /api/bundles  -> create bundle
export async function POST(req: Request) {
  const body = await req.json();
  const client = supa();

  // --- 1. Insert main bundle row ---
  const { data: bundle, error: bundleErr } = await client
    .from("bundles")
    .insert({
      vendor_id: body.vendorId ?? null,
      name: body.name,
      description: body.description ?? "",
      sku: body.sku,
      base_sku: body.base_sku ?? body.sku,
      status: body.status ?? "draft",
      price_cents: body.priceCents ?? 0,
      discount_type: body.discount?.type ?? null,
      discount_value: body.discount?.value ?? null,
      discount_start_at: body.discount?.start ?? null,
      discount_end_at: body.discount?.end ?? null,
      image_url: body.imageUrl ?? null,
      inventory_qty: 0,
    })
    .select("*")
    .single();

  if (bundleErr || !bundle) {
    console.error("[bundles POST] bundle error:", bundleErr);
    return NextResponse.json(
      { error: bundleErr?.message ?? "Failed to create bundle" },
      { status: 400 }
    );
  }

  // --- 2. Insert bundle items ---
  if (Array.isArray(body.items) && body.items.length > 0) {
    const itemRows = body.items.map((item: any, idx: number) => {
      const isVariant = !!item.variantId;

      return {
        bundle_id: bundle.id,
        product_id: isVariant ? null : item.productId ?? null,
        variant_id: isVariant ? item.variantId : null,
        item_name: item.itemName ?? "Untitled item",
        item_price_cents: item.itemPriceCents ?? 0,
        quantity: item.quantity ?? 1,
        position: item.position ?? idx,
      };
    });

    const { error: itemsErr } = await client
      .from("bundle_items")
      .insert(itemRows);

    if (itemsErr) {
      console.error("[bundles POST] items error:", itemsErr);
      return NextResponse.json(
        { error: itemsErr.message },
        { status: 400 }
      );
    }
  }

  // --- 3. Wellness / categories / tags ---

  if (
    Array.isArray(body.wellnessDimensions) &&
    body.wellnessDimensions.length
  ) {
    await client.from("bundle_wellness_dimensions").insert(
      body.wellnessDimensions.map((dimId: string | number) => ({
        bundle_id: bundle.id,
        dimension_id: dimId,
      }))
    );
  }

  if (Array.isArray(body.categories) && body.categories.length) {
    await client.from("bundle_categories").insert(
      body.categories.map((cat: string) => ({
        bundle_id: bundle.id,
        category: cat,
      }))
    );
  }

  if (Array.isArray(body.tags) && body.tags.length) {
    await client.from("bundle_tags").insert(
      body.tags.map((tag: string) => ({
        bundle_id: bundle.id,
        tag,
      }))
    );
  }

  return NextResponse.json({ ok: true, bundleId: bundle.id });
}