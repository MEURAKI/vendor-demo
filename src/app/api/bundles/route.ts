// app/api/bundles/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET() {
    const client = supa();

  const { data, error } = await client
    .from("bundles")
    .select(
      "id, name, base_sku, price_cents, discount_type, discount_value, discount_start, discount_end, status, image_url"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const bundles =
    data?.map((b) => ({
      id: b.id,
      name: b.name,
      type: "Multiple" as const, // you can compute from items if you want
      productsIncluded: 0, // will be filled in in detail API
      sku: b.base_sku,
      priceCents: b.price_cents,
      discountType: b.discount_type,
      discountValue: b.discount_value,
      status: b.status,
      imageUrl: b.image_url,
    })) ?? [];

  return NextResponse.json({ bundles });
}

export async function POST(req: Request) {
  const body = await req.json();
  const client = supa();

  // --- 1. Insert main bundle row ---
  const { data: bundle, error: bundleErr } = await client
    .from("bundles")
    .insert({
      vendor_id: body.vendorId ?? null,          // FK to profiles / vendors
      name: body.name,
      description: body.description ?? "",
      sku: body.sku,                             // e.g. BUNDLE-SDFSD-12122323
      base_sku: body.base_sku ?? body.sku,       // *** IMPORTANT LINE ***
      status: body.status ?? "draft",
      price_cents: body.priceCents ?? 0,
      discount_type: body.discount?.type ?? null,
      discount_value: body.discount?.value ?? null,
      discount_start_at: body.discount?.start ?? null,
      discount_end_at: body.discount?.end ?? null,
      image_url: body.imageUrl ?? null,
      // if you have inventory_qty column on bundles and want it 0 by default:
      inventory_qty: 0,
    })
    .select("*")
    .single();

  if (bundleErr || !bundle) {
    console.error(bundleErr);
    return NextResponse.json(
      { error: bundleErr?.message ?? "Failed to create bundle" },
      { status: 400 }
    );
  }

  // --- 2. Insert bundle items (products / variants) ---
  // Expecting body.items like:
  // [{ variantId, itemName, itemPriceCents, quantity }]
  if (Array.isArray(body.items) && body.items.length > 0) {
    const itemRows = body.items.map((item: any, idx: number) => ({
      bundle_id: bundle.id,
      variant_id: item.variantId,        // or product_id, depending on schema
      item_name: item.itemName,
      item_price_cents: item.itemPriceCents ?? 0,
      quantity: item.quantity ?? 1,
      position: idx,
    }));

    const { error: itemsErr } = await client
      .from("bundle_items")
      .insert(itemRows);

    if (itemsErr) {
      console.error(itemsErr);
      return NextResponse.json(
        { error: itemsErr.message },
        { status: 400 }
      );
    }
  }

  // --- 3. Wellness / categories / tags (optional) ---
  // Only do these if you actually created the tables.
  if (Array.isArray(body.wellnessDimensions) && body.wellnessDimensions.length) {
    await client.from("bundle_wellness_dimensions").insert(
      body.wellnessDimensions.map((dimId: string | number) => ({
        bundle_id: bundle.id,
        dimension_id: dimId,
      }))
    );
  }

  if (Array.isArray(body.categories) && body.categories.length) {
    await client.from("bundle_categories").insert(
      body.categories.map((catId: string | number) => ({
        bundle_id: bundle.id,
        category_id: catId,
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

export async function PUT(
  req: Request,
  context: { params: { bundleId: string } }
) {
  const { bundleId } = context.params;
  const body = await req.json();
  const client = supa();

  // 1) Update bundle row
  const { data: bundle, error } = await client
    .from("bundles")
    .update({
      vendor_id: body.vendorId ?? null,
      name: body.name,
      base_sku: body.baseSku,
      sku: body.sku,
      description: body.description,
      status: body.status,
      price_cents: body.priceCents,
      discount_type: body.discount?.type ?? null,
      discount_value: body.discount?.value ?? null,
      discount_start_at: body.discount?.start ?? null,
      discount_end_at: body.discount?.end ?? null,
      start_at: body.startAt ?? null,
      end_at: body.endAt ?? null,
      image_url: body.imageUrl ?? null,
    })
    .eq("id", bundleId)
    .select()
    .single();

  if (error || !bundle) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 400 }
    );
  }

  // 2) Reset wellness / categories / tags
  await client
    .from("bundle_wellness_dimensions")
    .delete()
    .eq("bundle_id", bundleId);

  if (Array.isArray(body.wellnessDimensions) && body.wellnessDimensions.length) {
    await client.from("bundle_wellness_dimensions").insert(
      body.wellnessDimensions.map((id: string | number) => ({
        bundle_id: bundleId,
        dimension_id: id,
      }))
    );
  }

  await client.from("bundle_categories").delete().eq("bundle_id", bundleId);
  if (Array.isArray(body.categories) && body.categories.length) {
    await client.from("bundle_categories").insert(
      body.categories.map((id: string | number) => ({
        bundle_id: bundleId,
        category_id: id,
      }))
    );
  }

  await client.from("bundle_tags").delete().eq("bundle_id", bundleId);
  if (Array.isArray(body.tags) && body.tags.length) {
    await client.from("bundle_tags").insert(
      body.tags.map((tag: string) => ({
        bundle_id: bundleId,
        tag,
      }))
    );
  }

  // 3) Reset items
  await client.from("bundle_items").delete().eq("bundle_id", bundleId);

  if (Array.isArray(body.items) && body.items.length) {
    const itemRows = body.items.map((item: any, idx: number) => ({
      bundle_id: bundleId,
      variant_id: item.variantId,
      item_name: item.itemName,
      item_price_cents: item.itemPriceCents,
      quantity: item.quantity ?? 1,
      position: idx,
    }));

    const { error: itemsErr } = await client
      .from("bundle_items")
      .insert(itemRows);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, bundleId });
}