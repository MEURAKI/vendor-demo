// app/api/bundles/[bundleId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );



export async function GET(
  _req: Request,
  context: { params: { bundleId: string } }
) {
  const client = supa();
  const { bundleId } = context.params;

  const { data: bundle, error } = await client
    .from("bundles")
    .select(
      "id, name, description, base_sku, price_cents, discount_type, discount_value, discount_start, discount_end, status, image_url"
    )
    .eq("id", bundleId)
    .maybeSingle();

  if (error || !bundle) {
    return NextResponse.json(
      { error: error?.message ?? "Bundle not found" },
      { status: 404 }
    );
  }

  const { data: items, error: iErr } = await client
    .from("bundle_items")
    .select(
      "id, product_id, variant_id, position, products(name, base_sku), product_variants(sku, price_cents, inventory_qty, image_url, options_json)"
    )
    .eq("bundle_id", bundleId)
    .order("position", { ascending: true });

  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }

  const bundleItems =
    items?.map((row: any) => {
      const product = row.products;
      const variant = row.product_variants;

      const displayName = variant
        ? `${product.name} – ${
            Object.values(variant.options_json ?? {}).join(" / ")
          }`
        : product.name;

      return {
        id: row.id,
        productId: row.product_id,
        variantId: row.variant_id,
        // unitsPerBundle: row.units_per_bundle,
        name: displayName,
        sku: variant?.sku ?? product.base_sku,
        itemPrice: (variant?.price_cents ?? 0) / 100,
        currentStock: variant?.inventory_qty ?? 0,
        imageUrl: variant?.image_url ?? product.image_url ?? null,
      };
    }) ?? [];

  return NextResponse.json({
    id: bundle.id,
    name: bundle.name,
    description: bundle.description ?? "",
    baseSku: bundle.base_sku,
    status: bundle.status,
    priceCents: bundle.price_cents,
    discount: bundle.discount_type
      ? {
          type: bundle.discount_type,
          value: bundle.discount_value,
          start: bundle.discount_start,
          end: bundle.discount_end,
        }
      : null,
    imageUrl: bundle.image_url,
    items: bundleItems,
    wellnessIds: [],
    categoryIds: [],
    tags: [],
  });
}

export async function PUT(
  req: Request,
  context: { params: { bundleId: string } }
) {
  const client = supa();
  const { bundleId } = context.params;
  const body = await req.json();
  const { items, ...bundle } = body;

  const { data, error } = await client
    .from("bundles")
    .update({
      name: bundle.name,
      description: bundle.description,
      base_sku: bundle.baseSku,
      price_cents: bundle.priceCents,
      discount_type: bundle.discount?.type ?? null,
      discount_value: bundle.discount?.value ?? null,
      discount_start: bundle.discount?.start ?? null,
      discount_end: bundle.discount?.end ?? null,
      status: bundle.status,
      image_url: bundle.imageUrl ?? null,
    })
    .eq("id", bundleId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not update bundle" },
      { status: 400 }
    );
  }

  // replace items
  await client.from("bundle_items").delete().eq("bundle_id", bundleId);

  if (Array.isArray(items) && items.length) {
    await client.from("bundle_items").insert(
      items.map((item: any, idx: number) => ({
        bundle_id: bundleId,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        // units_per_bundle: item.unitsPerBundle ?? 1,
        position: idx,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}