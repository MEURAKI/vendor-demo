// app/api/bundles/[bundleId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DiscountType } from "../../../../types/servuces.type";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async function getAuthedVendor(req: Request) {
  const client = supa();

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;

  if (!token) {
    return { client, error: "Missing access token", vendorId: null as string | null };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    return {
      client,
      error: error?.message ?? "Unauthenticated",
      vendorId: null as string | null,
    };
  }

  return { client, error: null as string | null, vendorId: user.id as string };
}

// ---------------- GET ONE BUNDLE ----------------
export async function GET(
  _req: Request,
  context: { params: { bundleId: string } }
) {
  const client = supa();
  const { bundleId } = context.params;

  // 1) Load bundle
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
    return NextResponse.json({ error: bundleErr.message }, { status: 400 });
  }
  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  // 2) Wellness
  const { data: wellnessRows } = await client
    .from("bundle_wellness_dimensions")
    .select("dimension_id")
    .eq("bundle_id", bundleId);

  const wellnessIds: number[] =
    wellnessRows?.map((row: any) => row.dimension_id) ?? [];

  // 3) Categories
  const { data: categoryRows } = await client
    .from("bundle_categories")
    .select("category_id")
    .eq("bundle_id", bundleId);

  const categoryIds: number[] =
    categoryRows?.map((row: any) => row.category_id) ?? [];

  // 4) Tags
  const { data: tagRows } = await client
    .from("bundle_tags")
    .select("tag")
    .eq("bundle_id", bundleId);

  const tags: string[] = tagRows?.map((row: any) => row.tag) ?? [];

  // 5) Items – join to BOTH variants and products
  const { data: itemRows, error: itemsErr } = await client
    .from("bundle_items")
    .select(
      `
        id,
        bundle_id,
        product_id,
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
        ),
        products:product_id (
          id,
          name,
          base_sku,
          image_url
        )
      `
    )
    .eq("bundle_id", bundleId)
    .order("position", { ascending: true });

  if (itemsErr) {
    console.error("[bundle GET] items error:", itemsErr);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  const items =
    itemRows?.map((row: any) => {
      const variant = row.product_variants;
      const productFromVariant = variant?.products;
      const productDirect = row.products;
      const product = productDirect ?? productFromVariant ?? null;

      const baseName =
        row.item_name ??
        product?.name ??
        "Unnamed product";

      let suffix = "";
      if (variant?.options_json && typeof variant.options_json === "object") {
        const parts = Object.values(
          variant.options_json as Record<string, string>
        );
        if (parts.length) {
          suffix = " – " + parts.join(" / ");
        }
      }

      return {
        // UI key
        id: String(row.id),
        // 🔑 IDs we need for PUT
        productId: product ? String(product.id) : row.product_id ? String(row.product_id) : null,
        variantId: row.variant_id ? String(row.variant_id) : null,

        name: baseName + suffix,
        sku: variant?.sku ?? product?.base_sku ?? "",
        priceCents: row.item_price_cents ?? variant?.price_cents ?? 0,
        stock: variant?.inventory_qty ?? 0,
        imageUrl: variant?.image_url ?? product?.image_url ?? null,
        quantity: row.quantity ?? 1,
      };
    }) ?? [];

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
    const rows = items.map((item: any, idx: number) => {
      const variantId = item.variantId ?? null;
      const productId = item.productId ?? variantId; // ✅ fallback

      return {
        bundle_id: bundleId,
        product_id: productId,
        variant_id: variantId,
        item_name: item.itemName,
        item_price_cents: item.itemPriceCents ?? 0,
        quantity: item.quantity ?? 1,
        position: idx,
      };
    });

  const { error: itemsErr } = await client.from("bundle_items").insert(rows);

  if (itemsErr) {
    console.error("[bundle PUT] items error:", itemsErr);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }
  }

  return NextResponse.json({ ok: true, bundleId });
}

export async function DELETE(
  req: Request,
  context: { params: { bundleId: string } }
) {
  const { client, error, vendorId } = await getAuthedVendor(req);
  if (error || !vendorId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { bundleId } = context.params;

  // Ensure bundle belongs to this vendor
  const { data: bundle, error: bundleErr } = await client
    .from("bundles")
    .select("id, vendor_id")
    .eq("id", bundleId)
    .maybeSingle();

  if (bundleErr) {
    console.error("[bundle DELETE] bundle error:", bundleErr);
    return NextResponse.json({ error: bundleErr.message }, { status: 400 });
  }

  if (!bundle || bundle.vendor_id !== vendorId) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  // HARD DELETE: remove children then bundle
  // If you prefer SOFT DELETE, comment these out and just do an update to status='inactive'
  await client.from("bundle_items").delete().eq("bundle_id", bundleId);
  await client.from("bundle_wellness_dimensions").delete().eq("bundle_id", bundleId);
  await client.from("bundle_categories").delete().eq("bundle_id", bundleId);
  await client.from("bundle_tags").delete().eq("bundle_id", bundleId);

  const { error: deleteErr } = await client
    .from("bundles")
    .delete()
    .eq("id", bundleId);

  if (deleteErr) {
    console.error("[bundle DELETE] delete error:", deleteErr);
    return NextResponse.json({ error: deleteErr.message }, { status: 400 });
  }

  // SOFT DELETE alternative:
  // const { error: softErr } = await client
  //   .from("bundles")
  //   .update({ status: "inactive" })
  //   .eq("id", bundleId);
  // if (softErr) { ... }

  return NextResponse.json({ ok: true });
}