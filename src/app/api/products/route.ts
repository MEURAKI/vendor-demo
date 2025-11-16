// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/**
 * CREATE PRODUCT
 */
export async function POST(req: Request) {
  const body = await req.json();
  const client = supa();

  const { data: product, error } = await client
    .from("products")
    .insert({
      name: body.name,
      description: body.description,
      base_sku: body.baseSku,
      is_variant: body.isVariant,
      price_cents: body.isVariant ? null : body.priceCents,
      discount_type: body.discount?.type ?? null,
      discount_value: body.discount?.value ?? null,
      discount_start_at: body.discount?.start ?? null,
      discount_end_at: body.discount?.end ?? null,
      discount_all_variants: !!body.discount?.applyToVariants,
      inventory_qty: body.isVariant ? null : body.inventoryQty,
      status: body.status,
    })
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 400 }
    );
  }

  const productId = product.id;

  // wellness / categories
  if (Array.isArray(body.wellnessIds) && body.wellnessIds.length) {
    await client.from("product_wellness_dimensions").insert(
      body.wellnessIds.map((id: number) => ({
        product_id: productId,
        dimension_id: id,
      }))
    );
  }

  if (Array.isArray(body.categoryIds) && body.categoryIds.length) {
    await client.from("product_categories").insert(
      body.categoryIds.map((id: number) => ({
        product_id: productId,
        category_id: id,
      }))
    );
  }

  // description sections
  if (Array.isArray(body.sections) && body.sections.length) {
    await client.from("product_description_sections").insert(
      body.sections.map((s: any, idx: number) => ({
        product_id: productId,
        sort_order: idx,
        title: s.title,
        body: s.body,
      }))
    );
  }

  if (body.isVariant) {
    // --- option groups ---
    const { data: groups, error: gErr } = await client
      .from("product_option_groups")
      .insert(
        body.optionGroups.map((g: any, idx: number) => ({
          product_id: productId,
          name: g.name,
          kind: g.kind,
          position: idx,
        }))
      )
      .select();

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 400 });
    }

    // map local ids (from the form) -> db group ids if you still use them
    const groupIdByName: Record<string, string> = {};
    groups.forEach((g) => {
      groupIdByName[g.name] = g.id;
    });

    // --- option values ---
    const allValueRows: any[] = [];
    body.optionGroups.forEach((g: any) => {
      const dbGroupId =
        groupIdByName[g.name as keyof typeof groupIdByName];
      g.values.forEach((v: any, idx: number) => {
        allValueRows.push({
          group_id: dbGroupId,
          label: v.label,
          color_hex: v.colorHex ?? null,
          position: idx,
        });
      });
    });

    const { data: values, error: vErr } = await client
      .from("product_option_values")
      .insert(allValueRows)
      .select();

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 400 });
    }

    const valueIdByKey: Record<string, string> = {};
    values.forEach((v) => {
      valueIdByKey[`${v.group_id}:${v.label}`] = v.id;
    });

    // --- variants ---
    const variantRows = (body.variants ?? []).map((vr: any, idx: number) => {
  const options =
    vr.optionsJson ??
    vr.options ??
    vr.options_json ??
    {}; // last resort

  return {
    product_id: productId,
    sku: vr.sku,
    price_cents: vr.priceCents,
    inventory_qty: vr.inventoryQty,
    image_url: vr.imageUrl ?? null,
    position: idx,
    is_active: (vr.inventoryQty ?? 0) > 0,
    options_json: options,    // ✅ NEVER null / undefined
  };
});

    const { data: variants, error: varErr } = await client
      .from("product_variants")
      .insert(variantRows)
      .select();

    if (varErr) {
      return NextResponse.json({ error: varErr.message }, { status: 400 });
    }

    // --- variant_option_values (optional, if you use this relation) ---
    const vovRows: any[] = [];
    variants.forEach((v, idx) => {
      const formVariant = body.variants[idx];
      if (!formVariant.options) return;

      Object.entries(formVariant.options).forEach(([groupName, valueLabel]) => {
        const group = groups.find((g: any) => g.name === groupName);
        if (!group) return;
        const key = `${group.id}:${valueLabel}`;
        const dbValueId = valueIdByKey[key];
        if (dbValueId) {
          vovRows.push({
            variant_id: v.id,
            value_id: dbValueId,
          });
        }
      });
    });

    if (vovRows.length) {
      await client.from("variant_option_values").insert(vovRows);
    }
  }

  return NextResponse.json({ ok: true, productId });
}

/**
 * LIST PRODUCTS (for All Products table)
 */
export async function GET() {
  const client = supa();

  // basic product info
  const { data: products, error } = await client
    .from("products")
    .select(
      "id, name, base_sku, is_variant, price_cents, inventory_qty, status"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const productIds = products.map((p: any) => p.id);

  // aggregate variants per product (count + stock)
  const { data: variants, error: vErr } = await client
    .from("product_variants")
    .select("product_id, inventory_qty")
    .in("product_id", productIds);

  const variantAgg: Record<
    string,
    { count: number; stock: number }
  > = {};

  if (!vErr && variants) {
    variants.forEach((v: any) => {
      if (!variantAgg[v.product_id]) {
        variantAgg[v.product_id] = { count: 0, stock: 0 };
      }
      variantAgg[v.product_id].count += 1;
      variantAgg[v.product_id].stock += v.inventory_qty ?? 0;
    });
  }

  // shape response for the All Products UI
  const payload = products.map((p: any) => {
    const agg = variantAgg[p.id] ?? { count: 0, stock: 0 };

    return {
      id: p.id,
      name: p.name,
      type: p.is_variant ? "Variant" : "Single",
      baseSku: p.base_sku,
      status: p.status,
      priceCents: p.price_cents,
      // if product has variants, compute stock from variants; otherwise use product row
      stock: p.is_variant ? agg.stock : p.inventory_qty,
      variantCount: agg.count,
      // you can add category / image fields here later if needed
    };
  });

  return NextResponse.json({ products: payload });
}