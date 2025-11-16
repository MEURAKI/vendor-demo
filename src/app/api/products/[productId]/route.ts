import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/**
 * GET /api/products/[productId]
 * Load full product for editing
 */
export async function GET(
  _req: Request,
  context: { params: { productId: string } }
) {
  const { productId } = context.params;
  const client = supa();

  // 1) main product
  const { data: product, error } = await client
    .from("products")
    .select(
      "id, name, description, base_sku, is_variant, price_cents, inventory_qty, status, discount_type, discount_value, discount_start_at, discount_end_at, discount_all_variants"
    )
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message || "Product not found" },
      { status: 404 }
    );
  }

  // 2) description sections
  const { data: sectionRows } = await client
    .from("product_description_sections")
    .select("id, title, body, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  const sections =
    sectionRows?.map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      sortOrder: s.sort_order ?? 0,
    })) ?? [];

  // 3) option groups + values (for variants)
  const { data: groups, error: gErr } = await client
    .from("product_option_groups")
    .select("id, name, kind")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 400 });
  }

  const groupIds = (groups ?? []).map((g) => g.id);

  let values: any[] = [];
  if (groupIds.length) {
    const { data: vData, error: vErr } = await client
      .from("product_option_values")
      .select("id, group_id, label, color_hex")
      .in("group_id", groupIds)
      .order("position", { ascending: true });

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 400 });
    }
    values = vData ?? [];
  }

  const optionGroups =
    (groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind, // "size" | "color" | "volume" | "weight" | "custom"
      values: values
        .filter((v) => v.group_id === g.id)
        .map((v) => ({
          id: v.id,
          label: v.label,
          colorHex: v.color_hex ?? undefined,
        })),
    })) ?? [];

  // 4) variants
  const { data: varRows, error: vErr } = await client
    .from("product_variants")
    .select("id, sku, price_cents, inventory_qty, image_url, options_json")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 400 });
  }

  const variants =
    varRows?.map((v) => ({
      id: v.id,
      sku: v.sku,
      priceCents: v.price_cents,
      inventoryQty: v.inventory_qty ?? 0,
      imageUrl: v.image_url,
      options: v.options_json ?? {},
    })) ?? [];

  // (These you can wire up later if actually stored)
  return NextResponse.json({
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    baseSku: product.base_sku ?? "",
    isVariant: product.is_variant,
    status: product.status,
    priceCents: product.price_cents,
    inventoryQty: product.inventory_qty,
    discount: product.discount_type
      ? {
          type: product.discount_type,
          value: product.discount_value,
          start: product.discount_start_at,
          end: product.discount_end_at,
          applyToVariants: product.discount_all_variants,
        }
      : null,
    sections,
    optionGroups,
    variants,
    wellnessIds: [],
    categoryIds: [],
    tags: [],
    productImageUrl: null,
  });
}

/**
 * PUT /api/products/[productId]
 * Update an existing product (mirrors POST /api/products logic)
 */
export async function PUT(
  req: Request,
  context: { params: { productId: string } }
) {
  const { productId } = context.params;
  const body = await req.json();
  const client = supa();

  // 1) Update main product row
  const { data: product, error } = await client
    .from("products")
    .update({
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
    .eq("id", productId)
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 400 }
    );
  }

  // 2) Clear related tables and reinsert from body
  // (simple and keeps logic aligned with your POST)

  // description sections
  await client
    .from("product_description_sections")
    .delete()
    .eq("product_id", productId);

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

  // wellness / categories
  await client
    .from("product_wellness_dimensions")
    .delete()
    .eq("product_id", productId);

  if (Array.isArray(body.wellnessIds) && body.wellnessIds.length) {
    await client.from("product_wellness_dimensions").insert(
      body.wellnessIds.map((id: number) => ({
        product_id: productId,
        dimension_id: id,
      }))
    );
  }

  await client.from("product_categories").delete().eq("product_id", productId);

  if (Array.isArray(body.categoryIds) && body.categoryIds.length) {
    await client.from("product_categories").insert(
      body.categoryIds.map((id: number) => ({
        product_id: productId,
        category_id: id,
      }))
    );
  }

  // variants & options: delete old and recreate
  await client.from("product_variants").delete().eq("product_id", productId);
  await client
    .from("product_option_groups")
    .delete()
    .eq("product_id", productId);

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
    const rawVariants = body.variants ?? body; // depending on whether you send { variants: [...] } or just [...]

const variantRows = (rawVariants as any[]).map((vr, idx) => {
  // IMPORTANT: always ensure options is at least {}
  const options = vr.options ?? vr.optionsJson ?? {};

  return {
    product_id: productId,
    sku: vr.sku,
    // your payload sends `price` in dollars, so convert to cents:
    price_cents:
      typeof vr.price === "number"
        ? Math.round(vr.price * 100)
        : vr.priceCents ?? null,
    // your payload sends `inventory`
    inventory_qty:
      typeof vr.inventory === "number"
        ? vr.inventory
        : vr.inventoryQty ?? 0,
    image_url: vr.imageUrl ?? null,
    position: idx,
    is_active: (vr.inventory ?? vr.inventoryQty ?? 0) > 0,
    options_json: options, // ✅ NEVER NULL
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