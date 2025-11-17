// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function supaWithAuth(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const token = req.headers.get("authorization") || "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token,
      },
    },
  });
}

/**
 * GET /api/products
 * List vendor products; imageUrl comes straight from products.image_url
 */
export async function GET(req: NextRequest) {
  const client = supaWithAuth(req);

  // 1) Get user
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2) Vendor products (include image_url)
  const { data: products, error } = await client
    .from("products")
    .select(
      "id, name, base_sku, is_variant, price_cents, inventory_qty, status, image_url"
    )
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const productIds = products.map((p: any) => p.id);

  // 3) Aggregate variants (for stock + variant count)
  const { data: variants, error: vErr } = await client
    .from("product_variants")
    .select("product_id, inventory_qty")
    .in("product_id", productIds);

  const variantAgg: Record<string, { count: number; stock: number }> = {};

  if (!vErr && variants) {
    variants.forEach((v: any) => {
      if (!variantAgg[v.product_id]) {
        variantAgg[v.product_id] = { count: 0, stock: 0 };
      }
      variantAgg[v.product_id].count += 1;
      variantAgg[v.product_id].stock += v.inventory_qty ?? 0;
    });
  }

  // 4) Shape response
  const payload = products.map((p: any) => {
    const agg = variantAgg[p.id] ?? { count: 0, stock: 0 };

    return {
      id: p.id,
      name: p.name,
      type: p.is_variant ? "Variant" : "Single",
      baseSku: p.base_sku,
      status: p.status,
      priceCents: p.price_cents,
      stock: p.is_variant ? agg.stock : p.inventory_qty,
      variantCount: agg.count,
      imageUrl: p.image_url ?? null, // URL stored in DB
    };
  });

  return NextResponse.json({ products: payload });
}

/**
 * POST /api/products
 * Create a new product (matches NewProductPage body shape)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const client = supa(); // service role, like your PUT

  const {
    status,
    vendorId,
    name,
    description,
    baseSku,
    isVariant,
    priceCents,
    inventoryQty,
    discount,
    wellnessIds,
    categoryIds,
    tags,
    sections,
    productImageUrl,
    galleryImageUrls,
    optionGroups,
    variants,
  } = body;

  // 1) Create main product row (store main image URL)
  const { data: product, error } = await client
    .from("products")
    .insert({
      vendor_id: vendorId,
      name,
      description,
      base_sku: baseSku,
      is_variant: isVariant,
      price_cents: isVariant ? null : priceCents,
      discount_type: discount?.type ?? null,
      discount_value: discount?.value ?? null,
      discount_start_at: discount?.start ?? null,
      discount_end_at: discount?.end ?? null,
      discount_all_variants: !!discount?.applyToVariants,
      inventory_qty: isVariant ? null : inventoryQty,
      status,
      image_url: productImageUrl ?? null, // store main image URL
      // if you have a tags column (e.g. text[]), you can add:
      // tags,
    })
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message ?? "Product create failed" },
      { status: 400 }
    );
  }

  const productId = product.id;

  // 2) Description sections
  if (Array.isArray(sections) && sections.length) {
    await client.from("product_description_sections").insert(
      sections.map((s: any, idx: number) => ({
        product_id: productId,
        sort_order: s.sortOrder ?? idx,
        title: s.title,
        body: s.body,
      }))
    );
  }

  // 3) Wellness dimensions (join table)
  if (Array.isArray(wellnessIds) && wellnessIds.length) {
    await client.from("product_wellness_dimensions").insert(
      wellnessIds.map((id: number | string) => ({
        product_id: productId,
        dimension_id: id,
      }))
    );
  }

  // 4) Categories (join table)
  if (Array.isArray(categoryIds) && categoryIds.length) {
    await client.from("product_categories").insert(
      categoryIds.map((id: number | string) => ({
        product_id: productId,
        category_id: id,
      }))
    );
  }

  // 5) Gallery images → product_images table
  if (Array.isArray(galleryImageUrls) && galleryImageUrls.length) {
    await client.from("product_images").insert(
      galleryImageUrls.map((url: string, idx: number) => ({
        product_id: productId,
        url,
        sort_order: idx,
      }))
    );
  }

  // 6) Variants & options (only if isVariant)
  if (isVariant) {
    // --- option groups ---
    const { data: groups, error: gErr } = await client
      .from("product_option_groups")
      .insert(
        (optionGroups ?? []).map((g: any, idx: number) => ({
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

    // --- option values ---
    const allValueRows: any[] = [];
    (optionGroups ?? []).forEach((g: any) => {
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
      const { data: valueData, error: vErr } = await client
        .from("product_option_values")
        .insert(allValueRows)
        .select();

      if (vErr) {
        return NextResponse.json({ error: vErr.message }, { status: 400 });
      }
      values = valueData ?? [];
    }

    const valueIdByKey: Record<string, string> = {};
    values.forEach((v: any) => {
      valueIdByKey[`${v.group_id}:${v.label}`] = v.id;
    });

    // --- variants ---
    const rawVariants: any[] = Array.isArray(variants) ? variants : [];

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

    // --- variant_option_values (link variants <-> option values) ---
    const vovRows: any[] = [];
    (createdVariants ?? []).forEach((v: any, idx: number) => {
      const formVariant = rawVariants[idx];
      if (!formVariant?.options) return;

      Object.entries(formVariant.options).forEach(
        ([groupName, valueLabel]) => {
          const group = (groups ?? []).find(
            (g: any) => g.name === groupName
          );
          if (!group) return;
          const key = `${group.id}:${valueLabel}`;
          const dbValueId = valueIdByKey[key];
          if (dbValueId) {
            vovRows.push({
              variant_id: v.id,
              value_id: dbValueId,
            });
          }
        }
      );
    });

    if (vovRows.length) {
      await client.from("variant_option_values").insert(vovRows);
    }
  }

  return NextResponse.json({ ok: true, productId });
}