// app/api/products/[productId]/route.ts
import { NextRequest, NextResponse } from "next/server";
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
  _req: NextRequest,
  { params }: { params: { productId: string } }
) {
  const { productId } = params;
  const client = supa(); // service role, like your PUT

  // 1) main product
  const { data: product, error } = await client
    .from("products")
    .select(
      [
        "id",
        "name",
        "description",
        "base_sku",
        "is_variant",
        "price_cents",
        "inventory_qty",
        "status",
        "discount_type",
        "discount_value",
        "discount_start_at",
        "discount_end_at",
        "discount_all_variants",
        "image_url",
      ].join(",")
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

  // 3) option groups + values
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
      kind: g.kind,
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

  // 5) gallery images (from product_images)
  const { data: galleryRows } = await client
    .from("product_images")
    .select("url, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  const galleryImageUrls = galleryRows?.map((r) => r.url) ?? [];

  // 6) wellness dimensions (join table product_wellness_dimensions)
  const { data: wellnessRows, error: wErr } = await client
    .from("product_wellness_dimensions")
    .select("dimension_id")
    .eq("product_id", productId);

  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 400 });
  }

  const wellnessIds = (wellnessRows ?? []).map((row) => row.dimension_id);

  // 7) categories (join table product_categories)
  const { data: categoryRows, error: cErr } = await client
    .from("product_categories")
    .select("category")
    .eq("product_id", productId);

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 400 });
  }

  const categoryIds = (categoryRows ?? []).map((row) => row.category);

  // 8) tags (simple product_tags table)
const { data: tagRows, error: tErr } = await client
    .from("product_tags")
    .select("tag")
    .eq("product_id", productId);

  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 400 });
  }

  // Normalize: handle plain strings or old JSON like {"name":"sdf"}
  const tags =
    (tagRows ?? []).map((row) => {
      const raw = row.tag;
      if (!raw) return "";

      // if it was stored as JSON string, try to parse
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") return parsed;
        if (parsed && typeof parsed === "object" && "name" in parsed) {
          return (parsed as any).name ?? raw;
        }
      } catch {
        // not JSON, just return as-is
      }

      return raw;
    }).filter(Boolean);
  // Final response
  return NextResponse.json({
    id: (product as any).id || "",
    name: (product as any).name,
    description: (product as any).description ?? "",
    baseSku: (product as any).base_sku ?? "",
    isVariant: (product as any).is_variant,
    status: (product as any).status,
    priceCents: (product as any).price_cents,
    inventoryQty: (product as any).inventory_qty,
    discount: (product as any).discount_type
      ? {
          type: (product as any).discount_type,
          value: (product as any).discount_value,
          start: (product as any).discount_start_at,
          end: (product as any).discount_end_at,
          applyToVariants: (product as any).discount_all_variants,
        }
      : null,
    sections,
    optionGroups,
    variants,
    galleryImageUrls,
    wellnessIds,
    categoryIds,
    tags,
    productImageUrl: (product as any).image_url ?? null,
  });
}

/**
 * PUT /api/products/[productId]
 * Update product (your existing logic, slightly cleaned)
 */
export async function PUT(
  req: Request,
  context: { params: { productId: string } }
) {
  const { productId } = context.params;
  const body = await req.json();
  const client = supa();

  /* ---------------------- 1) Update product ---------------------- */

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
      image_url: body.productImageUrl ?? null,
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

  /* ------------------ 2) Clear related tables ------------------- */

  await client.from("product_description_sections").delete().eq("product_id", productId);
  await client.from("product_wellness_dimensions").delete().eq("product_id", productId);
  await client.from("product_categories").delete().eq("product_id", productId);
  await client.from("product_tags").delete().eq("product_id", productId);
  await client.from("product_images").delete().eq("product_id", productId);
  await client.from("product_variants").delete().eq("product_id", productId);
  await client.from("product_option_groups").delete().eq("product_id", productId);

  /* ---------------- 3) Insert description sections --------------- */

  if (Array.isArray(body.sections) && body.sections.length) {
    await client.from("product_description_sections").insert(
      body.sections.map((s: any, idx: number) => ({
        product_id: productId,
        sort_order: s.sortOrder ?? idx,
        title: s.title,
        body: s.body,
      }))
    );
  }

  /* ------------------ 4) Wellness dimensions --------------------- */

/* ------------------ 4) Wellness dimensions --------------------- */

if (Array.isArray(body.wellnessIds) && body.wellnessIds.length) {
  const wellnessRows = body.wellnessIds.map((dimensionId: string | number) => ({
    product_id: productId,
    // force to number in case frontend sends "1", "4", "7"
    dimension_id:
      typeof dimensionId === "string" ? Number(dimensionId) : dimensionId,
  }));

  const { error: wInsertErr } = await client
    .from("product_wellness_dimensions")
    .insert(wellnessRows);

  if (wInsertErr) {
    console.error("Wellness insert error:", wInsertErr);
    return NextResponse.json(
      { error: "Failed to insert wellness dimensions", details: wInsertErr.message },
      { status: 400 }
    );
  }
}

/* ---------------------- 5) Categories -------------------------- */

if (Array.isArray(body.categoryIds) && body.categoryIds.length) {
  const categoryRows = body.categoryIds.map((categoryId: string | number) => ({
    product_id: productId,
    // force to string so it always matches `category` TEXT column
    category: String(categoryId),
  }));

  const { error: cInsertErr } = await client
    .from("product_categories")
    .insert(categoryRows);

  if (cInsertErr) {
    console.error("Category insert error:", cInsertErr);
    return NextResponse.json(
      { error: "Failed to insert categories", details: cInsertErr.message },
      { status: 400 }
    );
  }
}

  /* ---------------------- 6) Tags (NEW) -------------------------- */

  
  if (Array.isArray(body.tags) && body.tags.length) {
    // normalize: support ["tag"] or [{ name: "tag" }]
    const normalizedTags: string[] = body.tags
      .map((t: any) => {
        if (!t) return null;
        if (typeof t === "string") return t;
        if (typeof t === "object" && "name" in t) return String(t.name);
        return null;
      })
      .filter((t: any): t is string => !!t);

    if (normalizedTags.length) {
      await client.from("product_tags").insert(
        normalizedTags.map((tag) => ({
          product_id: productId,
          tag,
        }))
      );
    }
  }

  /* ------------------- 7) Gallery images ------------------------- */

  if (Array.isArray(body.galleryImageUrls) && body.galleryImageUrls.length) {
  await client.from("product_images").insert(
    body.galleryImageUrls.map((url: string, idx: number) => ({
      product_id: productId,
      url,                      // 👈 inserted as "url"
      sort_order: idx,
    }))
  );
}

  /* ------------------- 8) Variants + Options --------------------- */

  if (body.isVariant) {
    // Insert option groups
    const { data: groups, error: gErr } = await client
      .from("product_option_groups")
      .insert(
        (body.optionGroups ?? []).map((g: any, idx: number) => ({
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
    (groups ?? []).forEach((g: any) => {
      groupIdByName[g.name] = g.id;
    });

    // Insert option values
    const allValueRows: any[] = [];
    (body.optionGroups ?? []).forEach((g: any) => {
      const dbGroupId = groupIdByName[g.name];
      if (!dbGroupId) return;

      (g.values ?? []).forEach((v: any, idx: number) => {
        allValueRows.push({
          group_id: dbGroupId,
          label: v.label,
          color_hex: v.colorHex ?? null,
          position: idx,
        });
      });
    });

    let values: any[] = [];
    if (allValueRows.length) {
      const { data: vData, error: vErr } = await client
        .from("product_option_values")
        .insert(allValueRows)
        .select();

      if (vErr) {
        return NextResponse.json({ error: vErr.message }, { status: 400 });
      }

      values = vData ?? [];
    }

    const valueIdByKey: Record<string, string> = {};
    values.forEach((v: any) => {
      valueIdByKey[`${v.group_id}:${v.label}`] = v.id;
    });

    // Insert variants
    const rawVariants: any[] = Array.isArray(body.variants) ? body.variants : [];

    const variantRows = rawVariants.map((vr, idx: number) => ({
      product_id: productId,
      sku: vr.sku,
      price_cents: vr.priceCents ?? null,
      inventory_qty: vr.inventoryQty ?? 0,
      image_url: vr.imageUrl ?? null,
      position: idx,
      is_active: (vr.inventoryQty ?? 0) > 0,
      options_json: vr.optionsJson ?? vr.options ?? {},
    }));

    const { data: createdVariants, error: varErr } = await client
      .from("product_variants")
      .insert(variantRows)
      .select();

    if (varErr) {
      return NextResponse.json({ error: varErr.message }, { status: 400 });
    }

    // Variant → option values join table
    const vovRows: any[] = [];

    (createdVariants ?? []).forEach((v: any, idx: number) => {
      const formVariant = rawVariants[idx];
      if (!formVariant?.options) return;

      Object.entries(formVariant.options).forEach(([groupName, valueLabel]) => {
        const group = (groups ?? []).find((g: any) => g.name === groupName);
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