// app/api/bundles/[bundleId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DiscountType } from "../../../../types/servuces.type";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// ---------------- GET ONE BUNDLE ----------------

export async function GET(
  _req: Request,
  context: { params: { bundleId: string } }
) {
  const client = supa();
  const { bundleId } = context.params;

  // 1) Load main bundle row (correct column names)
  const { data: bundle, error: bundleErr } = await client
    .from("bundles")
    .select(
      `
        id,
        vendor_id,
        name,
        description,
        base_sku,
        sku,
        price_cents,
        status,
        discount_type,
        discount_value,
        discount_start,
        discount_end,
        image_url
      `
    )
    .eq("id", bundleId)
    .maybeSingle();

  if (bundleErr) {
    console.error("[bundle GET] bundle error:", bundleErr);
    return NextResponse.json(
      { error: bundleErr.message },
      { status: 400 }
    );
  }

  if (!bundle) {
    return NextResponse.json(
      { error: "Bundle not found" },
      { status: 404 }
    );
  }

  // 2) Wellness dimensions (junction table)
  const { data: wellnessRows, error: wellnessErr } = await client
    .from("bundle_wellness_dimensions")
    .select("dimension_id")
    .eq("bundle_id", bundleId);

  if (wellnessErr) {
    console.error("[bundle GET] wellness error:", wellnessErr);
  }

  const wellnessIds: number[] =
    wellnessRows?.map((row: any) => row.dimension_id) ?? [];

  // 3) Categories (junction table)
  const { data: categoryRows, error: catErr } = await client
    .from("bundle_categories")
    .select("category_id")
    .eq("bundle_id", bundleId);

  if (catErr) {
    console.error("[bundle GET] categories error:", catErr);
  }

  const categoryIds: number[] =
    categoryRows?.map((row: any) => row.category_id) ?? [];

  // 4) Tags (simple table)
  const { data: tagRows, error: tagErr } = await client
    .from("bundle_tags")
    .select("tag")
    .eq("bundle_id", bundleId);

  if (tagErr) {
    console.error("[bundle GET] tags error:", tagErr);
  }

  const tags: string[] = tagRows?.map((row: any) => row.tag) ?? [];

  // 5) Items – join variant → product for live price / stock / options
  const { data: itemRows, error: itemsErr } = await client
    .from("bundle_items")
    .select(
      `
        id,
        bundle_id,
        variant_id,
        quantity,
        position,
        item_name,
        item_price_cents,
        product_variants:variant_id (
          id,
          sku,
          price_cents,
          inventory_qty,
          image_url,
          options_json,
          products:product_id (
            id,
            name,
            base_sku,
            image_url
          )
        )
      `
    )
    .eq("bundle_id", bundleId)
    .order("position", { ascending: true });

  if (itemsErr) {
    console.error("[bundle GET] items error:", itemsErr);
    return NextResponse.json(
      { error: itemsErr.message },
      { status: 400 }
    );
  }

  const items =
    itemRows?.map((row: any) => {
      const variant = row.product_variants;
      const product = variant?.products;

      const baseName =
        row.item_name ??
        product?.name ??
        "Unnamed product";

      let suffix = "";
      if (
        variant?.options_json &&
        typeof variant.options_json === "object"
      ) {
        const parts = Object.values(
          variant.options_json as Record<string, string>
        );
        if (parts.length) {
          suffix = " – " + parts.join(" / ");
        }
      }

      return {
        // BundleCandidateItem + quantity
        id: String(row.variant_id ?? row.id), // we use variant id as UI id
        productId: product ? String(product.id) : undefined,
        name: baseName + suffix,
        sku: variant?.sku ?? product?.base_sku ?? "",
        priceCents:
          row.item_price_cents ??
          variant?.price_cents ??
          0,
        stock: variant?.inventory_qty ?? 0,
        imageUrl: variant?.image_url ?? product?.image_url ?? null,
        quantity: row.quantity ?? 1,
      };
    }) ?? [];

  // 6) Return shape expected by EditBundlePage (LoadedBundle)
  return NextResponse.json({
    id: bundle.id as string,
    vendorId: bundle.vendor_id as string | null,
    name: bundle.name as string,
    baseSku: bundle.base_sku as string,
    sku: bundle.sku as string,
    description: (bundle.description as string) ?? "",
    status: bundle.status as "draft" | "active",
    priceCents: bundle.price_cents as number,
    discount: bundle.discount_type
      ? {
          type: bundle.discount_type as DiscountType,
          value: (bundle.discount_value as number) ?? 0,
          start: bundle.discount_start as string | null,
          end: bundle.discount_end as string | null,
        }
      : null,
    imageUrl: (bundle.image_url as string) ?? null,
    wellnessDimensions: wellnessIds,
    categories: categoryIds,
    tags,
    items,
  });
}

// ---------------- UPDATE BUNDLE ----------------

export async function PUT(
  req: Request,
  context: { params: { bundleId: string } }
) {
  const client = supa();
  const { bundleId } = context.params;
  const body = await req.json();

  const {
    items = [],
    wellnessDimensions = [],
    categories = [],
    tags = [],
    ...bundle
  } = body;

  // 1) Update bundle row (you already have this part correct)
  const { data: updated, error: updateErr } = await client
    .from("bundles")
    .update({
      vendor_id: bundle.vendorId ?? null,
      name: bundle.name,
      description: bundle.description ?? "",
      base_sku: bundle.baseSku,
      sku: bundle.sku,
      status: bundle.status,
      price_cents: bundle.priceCents,
      discount_type: bundle.discount?.type ?? null,
      discount_value: bundle.discount?.value ?? null,
      discount_start: bundle.discount?.start ?? null,
      discount_end: bundle.discount?.end ?? null,
      image_url: bundle.imageUrl ?? null,
    })
    .eq("id", bundleId)
    .select()
    .single();

  if (updateErr || !updated) {
    console.error("[bundle PUT] bundle error:", updateErr);
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update bundle" },
      { status: 400 }
    );
  }

  // 2) Reset wellness / categories / tags (your logic here is fine)
  await client
    .from("bundle_wellness_dimensions")
    .delete()
    .eq("bundle_id", bundleId);
  if (Array.isArray(wellnessDimensions) && wellnessDimensions.length) {
    await client.from("bundle_wellness_dimensions").insert(
      wellnessDimensions.map((id: string | number) => ({
        bundle_id: bundleId,
        dimension_id: Number(id),
      }))
    );
  }

  await client.from("bundle_categories").delete().eq("bundle_id", bundleId);
  if (Array.isArray(categories) && categories.length) {
    await client.from("bundle_categories").insert(
      categories.map((id: string | number) => ({
        bundle_id: bundleId,
        category_id: Number(id),
      }))
    );
  }

  await client.from("bundle_tags").delete().eq("bundle_id", bundleId);
  if (Array.isArray(tags) && tags.length) {
    await client.from("bundle_tags").insert(
      tags.map((tag: string) => ({
        bundle_id: bundleId,
        tag,
      }))
    );
  }

  // 3) Reset items
  await client.from("bundle_items").delete().eq("bundle_id", bundleId);

  if (Array.isArray(items) && items.length) {
    const rows = items.map((item: any, idx: number) => ({
      bundle_id: bundleId,
      // 🔑 IMPORTANT: set BOTH product_id and variant_id correctly
      product_id: item.productId ?? null,
      variant_id: item.variantId ?? null,
      item_name: item.itemName,
      item_price_cents: item.itemPriceCents ?? 0,
      quantity: item.quantity ?? 1,
      position: idx,
    }));

    const { error: itemsErr } = await client
      .from("bundle_items")
      .insert(rows);

    if (itemsErr) {
      console.error("[bundle PUT] items error:", itemsErr);
      return NextResponse.json(
        { error: itemsErr.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true, bundleId });
}