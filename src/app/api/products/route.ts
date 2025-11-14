// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(req: Request) {
  const body = await req.json();

  // body is ProductFormState (see below)
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
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 400 });
  }

  const productId = product.id;

  // wellness / categories / tags
  await client.from("product_wellness_dimensions").insert(
    body.wellnessIds.map((id: number) => ({ product_id: productId, dimension_id: id }))
  );

  await client.from("product_categories").insert(
    body.categoryIds.map((id: number) => ({ product_id: productId, category_id: id }))
  );

  // tags: upsert names -> ids first (left as pseudocode)

  // description sections
  await client.from("product_description_sections").insert(
    body.sections.map((s: any, idx: number) => ({
      product_id: productId,
      sort_order: idx,
      title: s.title,
      body: s.body,
    }))
  );

  if (body.isVariant) {
    // option groups
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

    const groupIdByLocalId: Record<string, string> = {};
    groups.forEach((g, idx) => {
      groupIdByLocalId[body.optionGroups[idx].localId] = g.id;
    });

    // option values
    const allValueRows: any[] = [];
    body.optionGroups.forEach((g: any) => {
      const dbGroupId = groupIdByLocalId[g.localId];
      g.values.forEach((v: any, idx: number) => {
        allValueRows.push({
          group_id: dbGroupId,
          label: v.label,
          color_hex: v.colorHex ?? null,
          position: idx,
          local_value_id: v.localId, // temporary, stripped after insert
        });
      });
    });

    const { data: values, error: vErr } = await client
      .from("product_option_values")
      .insert(allValueRows.map(({ local_value_id, ...rest }) => rest))
      .select();

    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });

    // map local temp ids → db ids
    const valueIdByLabel: Record<string, string> = {};
    values.forEach((v) => {
      valueIdByLabel[`${v.group_id}:${v.label}`] = v.id;
    });

    // variants
    const variantRows = body.variants.map((vr: any, idx: number) => ({
      product_id: productId,
      sku: vr.sku,
      price_cents: vr.priceCents,
      inventory_qty: vr.inventoryQty,
      image_url: vr.imageUrl ?? null,
      position: idx,
      is_active: vr.inventoryQty > 0,
      options_json: vr.optionsJson,
    }));

    const { data: variants, error: varErr } = await client
      .from("product_variants")
      .insert(variantRows)
      .select();

    if (varErr) return NextResponse.json({ error: varErr.message }, { status: 400 });

    // variant_option_values
    const vovRows: any[] = [];
    variants.forEach((v, idx) => {
      const formVariant = body.variants[idx];
      formVariant.optionKeys.forEach((k: any) => {
        const dbValueId = valueIdByLabel[`${k.groupDbId}:${k.valueLabel}`];
        vovRows.push({
          variant_id: v.id,
          value_id: dbValueId,
        });
      });
    });

    if (vovRows.length) {
      await client.from("variant_option_values").insert(vovRows);
    }
  }

  return NextResponse.json({ ok: true, productId });
}